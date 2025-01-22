import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  NextOrObserver,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendEmailVerification,
  updatePassword,
  AuthErrorCodes,
  setPersistence,
  browserSessionPersistence,
  type UserCredential,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
  Timestamp,
  runTransaction,
  DocumentReference,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ZodError } from "zod";
import {
  type SignUpInput,
  type LoginInput,
  type ResetPasswordInput,
  type User,
  signUpSchema,
  loginSchema,
  resetPasswordSchema,
  passwordChangeSchema,
  UserRole,
} from "../types/types";
import { auth, db } from "./clientApp";

// Configuration
const CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  SESSION_CHECK_INTERVAL: 60000, // 1 minute
  SESSION_DURATION: 2 * 60 * 60 * 1000, // 2 hours
} as const;

// Types
interface LoginAttempts {
  [email: string]: {
    count: number;
    lockoutUntil?: number;
    lastAttempt: number;
  };
}

// Auth State Manager
class AuthStateManager {
  private static instance: AuthStateManager;
  private loginAttempts: LoginAttempts = {};
  private sessionTimeout: NodeJS.Timeout | null = null;
  private sessionCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeSessionCheck();
  }

  static getInstance(): AuthStateManager {
    if (!AuthStateManager.instance) {
      AuthStateManager.instance = new AuthStateManager();
    }
    return AuthStateManager.instance;
  }

  private initializeSessionCheck() {
    this.sessionCheckInterval = setInterval(() => {
      this.cleanupExpiredLockouts();
    }, CONFIG.SESSION_CHECK_INTERVAL);
  }

  private cleanupExpiredLockouts() {
    const now = Date.now();
    Object.keys(this.loginAttempts).forEach((email) => {
      const attempt = this.loginAttempts[email];
      if (attempt.lockoutUntil && now > attempt.lockoutUntil) {
        delete this.loginAttempts[email];
      }
    });
  }

  isUserLockedOut(email: string): boolean {
    const attempt = this.loginAttempts[email];
    if (!attempt?.lockoutUntil) return false;
    return Date.now() <= attempt.lockoutUntil;
  }

  recordLoginAttempt(email: string, success: boolean) {
    if (success) {
      delete this.loginAttempts[email];
      return;
    }

    if (!this.loginAttempts[email]) {
      this.loginAttempts[email] = {
        count: 1,
        lastAttempt: Date.now(),
      };
    } else {
      this.loginAttempts[email].count++;
      this.loginAttempts[email].lastAttempt = Date.now();

      if (this.loginAttempts[email].count >= CONFIG.MAX_LOGIN_ATTEMPTS) {
        this.loginAttempts[email].lockoutUntil =
          Date.now() + CONFIG.LOCKOUT_DURATION;
      }
    }
  }

  async startSessionTimeout() {
    // Remove 'user: User' parameter
    this.clearSessionTimeout();
    await setPersistence(auth, browserSessionPersistence);
    const expirationTime = Date.now() + CONFIG.SESSION_DURATION;
    localStorage.setItem("sessionExpiration", expirationTime.toString());
    this.sessionTimeout = setTimeout(
      () => this.signOut(),
      CONFIG.SESSION_DURATION
    );
  }
  clearSessionTimeout() {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }
    localStorage.removeItem("sessionExpiration");
  }

  async checkSession(): Promise<boolean> {
    const expirationTime = localStorage.getItem("sessionExpiration");
    if (expirationTime) {
      if (Date.now() > parseInt(expirationTime)) {
        await this.signOut();
        return false;
      }
      return true;
    }
    return false;
  }

  async signOut() {
    try {
      await auth.signOut();
      this.clearSessionTimeout();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  cleanup() {
    this.clearSessionTimeout();
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }
}

// Utility Functions
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = CONFIG.RETRY_ATTEMPTS
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      if (attempt === maxAttempts) break;

      if (error?.code === AuthErrorCodes.NETWORK_REQUEST_FAILED) {
        await new Promise((resolve) =>
          setTimeout(resolve, CONFIG.RETRY_DELAY * attempt)
        );
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

const handleAuthError = (error: any): never => {
  console.error("Auth error:", error);
  const errorMessage = (() => {
    switch (error?.code) {
      case AuthErrorCodes.EMAIL_EXISTS:
        return "This email is already in use. Please use a different email or sign in.";
      case AuthErrorCodes.USER_DELETED:
        return "No account found with this email. Please check your credentials or sign up.";
      case AuthErrorCodes.INVALID_PASSWORD:
        return "Incorrect password. Please try again.";
      case AuthErrorCodes.INVALID_LOGIN_CREDENTIALS:
        return "Invalid email or password. Please check your credentials.";
      case AuthErrorCodes.TOO_MANY_ATTEMPTS_TRY_LATER:
        return "Too many failed attempts. Please try again later or reset your password.";
      case AuthErrorCodes.INVALID_EMAIL:
        return "Invalid email format. Please enter a valid email address.";
      case AuthErrorCodes.NETWORK_REQUEST_FAILED:
        return "Network error. Please check your internet connection and try again.";
      case AuthErrorCodes.POPUP_CLOSED_BY_USER:
        return "Sign in popup was closed. Please try again.";
      case "auth/requires-recent-login":
        return "This operation requires recent authentication. Please log in again.";
      case "auth/user-disabled":
        return "This account has been disabled. Please contact support.";
      default:
        return (
          error.message || "An unexpected error occurred. Please try again."
        );
    }
  })();

  throw new Error(errorMessage);
};

const getZodErrorMessage = (error: ZodError): string => {
  return error.errors
    .map((err) => {
      const field = err.path.join(".");
      return `${field}: ${err.message}`;
    })
    .join(", ");
};

async function updateUserData(
  userRef: DocumentReference,
  data: object,
  merge: boolean = true
): Promise<void> {
  return withRetry(async () => {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists() && !merge) {
        transaction.set(userRef, {
          ...data,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        });
      } else {
        transaction.set(
          userRef,
          {
            ...data,
            lastLogin: serverTimestamp(),
          },
          { merge: true }
        );
      }
    });
  });
}

// Auth Functions
export const signUp = async (userData: SignUpInput) => {
  try {
    const validatedData = signUpSchema.parse(userData);

    const usersRef = collection(db, "users");
    const emailQuery = query(
      usersRef,
      where("email", "==", validatedData.email.toLowerCase())
    );
    const querySnapshot = await getDocs(emailQuery);

    if (!querySnapshot.empty) {
      throw new Error(
        "This email is already registered. Please try signing in."
      );
    }

    const userCredential = await withRetry(() =>
      createUserWithEmailAndPassword(
        auth,
        validatedData.email,
        validatedData.password
      )
    );

    const user = userCredential.user;
    const createdAt = serverTimestamp();

    const functions = getFunctions();
    const setCustomClaims = httpsCallable(functions, "setCustomClaims");
    await setCustomClaims({ uid: user.uid, role: validatedData.role });

    await Promise.all([
      sendEmailVerification(user),
      updateProfile(user, {
        displayName: validatedData.displayName,
      }),
      setDoc(doc(db, "users", user.uid), {
        displayName: validatedData.displayName,
        email: validatedData.email.toLowerCase(),
        role: validatedData.role,
        createdAt,
      }),
    ]);

    await auth.signOut();
    return {
      success: true,
      message: "Verification email sent. Please check your inbox.",
    };
  } catch (error: any) {
    if (error instanceof ZodError) {
      throw new Error(getZodErrorMessage(error));
    }
    return handleAuthError(error);
  }
};

export const signInWithGoogle = async (
  setUser: (user: User | null) => void,
  role?: UserRole // Add this parameter
) => {
  const authManager = AuthStateManager.getInstance();

  try {
    const result = await withRetry(() =>
      signInWithPopup(auth, new GoogleAuthProvider())
    );

    const user = result.user;
    const userRef = doc(db, "users", user.uid);

    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    // Use the provided role or default to 'user'
    const defaultRole: UserRole = role || "user";

    const functions = getFunctions();
    const setCustomClaims = httpsCallable(functions, "setCustomClaims");
    await setCustomClaims({ uid: user.uid, role: defaultRole });

    const userUpdateData: Record<string, any> = {
      displayName: user.displayName,
      email: user.email,
      provider: "google",
      role: defaultRole,
    };

    if (!userData?.createdAt) {
      userUpdateData.createdAt = serverTimestamp();
    }

    await updateUserData(userRef, userUpdateData);

    const updatedUserDoc = await getDoc(userRef);
    const updatedUserData = updatedUserDoc.data();

    const userWithMetadata: User = {
      ...user,
      role: defaultRole,
      createdAt: updatedUserData?.createdAt?.toDate().toISOString(),
    };

    await authManager.startSessionTimeout();
    setUser(userWithMetadata);

    return userWithMetadata;
  } catch (error) {
    return handleAuthError(error);
  }
};

export const login = async (
  loginData: LoginInput,
  setUser: (user: User | null) => void
): Promise<User> => {
  const authManager = AuthStateManager.getInstance();

  try {
    const validatedData = loginSchema.parse(loginData);

    if (authManager.isUserLockedOut(validatedData.email)) {
      throw new Error("Account is temporarily locked. Please try again later.");
    }

    const usersRef = collection(db, "users");
    const emailQuery = query(
      usersRef,
      where("email", "==", validatedData.email.toLowerCase())
    );
    const querySnapshot = await getDocs(emailQuery);

    if (querySnapshot.empty) {
      throw new Error(
        "This email is not registered. Please sign up to use it."
      );
    }

    const userCredential: UserCredential = await withRetry(() =>
      signInWithEmailAndPassword(
        auth,
        validatedData.email,
        validatedData.password
      )
    );

    const user = userCredential.user;

    if (!user.emailVerified) {
      await auth.signOut();
      throw new Error("Please verify your email before logging in.");
    }

    authManager.recordLoginAttempt(validatedData.email, true);

    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();

    const idTokenResult = await user.getIdTokenResult();
    const role = idTokenResult.claims.role as UserRole;

    const userWithMetadata: User = {
      ...user,
      role,
      createdAt:
        userData?.createdAt instanceof Timestamp
          ? userData.createdAt.toDate().toISOString()
          : undefined,
    };

    await authManager.startSessionTimeout();
    setUser(userWithMetadata);

    return userWithMetadata;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(getZodErrorMessage(error));
    }

    if (
      error instanceof Error &&
      (error.name === AuthErrorCodes.INVALID_PASSWORD ||
        error.name === AuthErrorCodes.USER_DELETED)
    ) {
      authManager.recordLoginAttempt(loginData.email, false);
    }

    return handleAuthError(error);
  }
};

export const resetPassword = async (resetData: ResetPasswordInput) => {
  try {
    const validatedData = resetPasswordSchema.parse(resetData);
    await withRetry(() => sendPasswordResetEmail(auth, validatedData.email));
    return {
      success: true,
      message: "Password reset email sent. Please check your inbox.",
    };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(getZodErrorMessage(error));
    }
    return handleAuthError(error);
  }
};

export const changePassword = async (
  user: User,
  currentPassword: string,
  newPassword: string
) => {
  try {
    if (!user.email) {
      throw new Error("User email not found");
    }

    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );

    await withRetry(async () => {
      await reauthenticateWithCredential(user, credential);
      passwordChangeSchema.parse({
        currentPassword,
        newPassword,
        confirmPassword: newPassword,
      });
      await updatePassword(user, newPassword);
    });
    return {
      success: true,
      message: "Password successfully updated.",
    };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(getZodErrorMessage(error));
    }
    return handleAuthError(error);
  }
};

// ... [previous code remains the same until verifyLandlord]

export const verifyLandlord = async (uid: string) => {
  const functions = getFunctions();
  const verifyLandlordFunction = httpsCallable(functions, "verifyLandlord");
  try {
    const result = await verifyLandlordFunction({ uid });
    return result.data;
  } catch (error) {
    console.error("Error verifying landlord:", error);
    throw error;
  }
};

export const resendVerificationEmail = async (user: User) => {
  try {
    await withRetry(() => sendEmailVerification(user));
    return {
      success: true,
      message: "Verification email resent. Please check your inbox.",
    };
  } catch (error) {
    return handleAuthError(error);
  }
};

export const signOut = async () => {
  const authManager = AuthStateManager.getInstance();
  await authManager.signOut();
};

export const onAuthStateChanged = (cb: NextOrObserver<User>) => {
  return auth.onAuthStateChanged(cb);
};

export const checkSession = async (): Promise<boolean> => {
  const authManager = AuthStateManager.getInstance();
  return authManager.checkSession();
};

export const cleanup = () => {
  AuthStateManager.getInstance().cleanup();
};

// Export AuthStateManager for direct access if needed
export const getAuthStateManager = () => {
  return AuthStateManager.getInstance();
};
