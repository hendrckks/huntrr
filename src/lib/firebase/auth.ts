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
} from "../types/auth";
import { auth, db } from "./clientApp";
import { getUserClaims } from "../../utils/authUtils";

// Configuration
const CONFIG = {
  MAX_LOGIN_ATTEMPTS: 9999, // Temporarily increased for testing
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  RETRY_ATTEMPTS: 9999,
  RETRY_DELAY: 1000, // 1 second
  SESSION_CHECK_INTERVAL: 60000, // 1 minute
  SESSION_DURATION: 2 * 60 * 60 * 1000, // 2 hours
  VERIFICATION_RESEND_DELAY: 0, // No delay for first attempt
  VERIFICATION_RETRY_BASE_DELAY: 120000, // 2 minutes base delay for subsequent attempts
  MAX_VERIFICATION_RETRIES: 9999, // Maximum number of retries before extended lockout // Temporarily increased for testing
} as const;

// Types
interface LoginAttempts {
  [email: string]: {
    count: number;
    lockoutUntil?: number;
    lastAttempt: number;
  };
}

type LoginAttempt = LoginAttempts[string];
export class AuthStateManager {
  private static instance: AuthStateManager;
  private loginAttempts: Map<string, LoginAttempt>;
  private sessionTimeout: NodeJS.Timeout | null;
  private sessionCheckInterval: NodeJS.Timeout | null;

  private constructor() {
    this.loginAttempts = new Map();
    this.sessionTimeout = null;
    this.sessionCheckInterval = null;
    this.initializeSessionCheck();
  }

  static getInstance(): AuthStateManager {
    if (!AuthStateManager.instance) {
      AuthStateManager.instance = new AuthStateManager();
    }
    return AuthStateManager.instance;
  }

  private initializeSessionCheck() {
    // Clean up any existing interval
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }

    this.sessionCheckInterval = setInterval(() => {
      this.cleanupExpiredLockouts();
    }, CONFIG.SESSION_CHECK_INTERVAL);
  }

  private cleanupExpiredLockouts() {
    const now = Date.now();
    for (const [email, attempt] of this.loginAttempts.entries()) {
      if (attempt.lockoutUntil && now > attempt.lockoutUntil) {
        this.loginAttempts.delete(email);
      }
    }
  }

  isUserLockedOut(email: string): boolean {
    const attempt = this.loginAttempts.get(email);
    if (!attempt?.lockoutUntil) return false;
    return Date.now() <= attempt.lockoutUntil;
  }

  recordLoginAttempt(email: string, success: boolean) {
    if (success) {
      this.loginAttempts.delete(email);
      return;
    }

    const attempt = this.loginAttempts.get(email) || {
      count: 0,
      lastAttempt: Date.now(),
    };

    attempt.count++;
    attempt.lastAttempt = Date.now();

    if (attempt.count >= CONFIG.MAX_LOGIN_ATTEMPTS) {
      attempt.lockoutUntil = Date.now() + CONFIG.LOCKOUT_DURATION;
    }

    this.loginAttempts.set(email, attempt);
  }

  async startSessionTimeout() {
    this.clearSessionTimeout();

    // Set Firebase persistence
    await setPersistence(auth, browserSessionPersistence);

    // Store only the session expiration time and minimal session info
    const sessionData = {
      expiresAt: Date.now() + CONFIG.SESSION_DURATION,
      // Only store non-sensitive data if absolutely necessary
      uid: auth.currentUser?.uid, // only if needed
    };

    // Use sessionStorage for session management
    sessionStorage.setItem(
      "sessionExpiration",
      sessionData.expiresAt.toString()
    );

    // If you absolutely need the UID, store it separately
    if (sessionData.uid) {
      sessionStorage.setItem("sessionUID", sessionData.uid);
    }

    // Set timeout for session expiration
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
    // Clear all session-related items individually
    sessionStorage.removeItem("sessionExpiration");
    sessionStorage.removeItem("sessionUID");
  }
  async checkSession(): Promise<boolean> {
    const expirationTime = sessionStorage.getItem("sessionExpiration");

    if (!expirationTime) {
      return false;
    }

    const hasExpired = Date.now() > parseInt(expirationTime);

    if (hasExpired) {
      await this.signOut();
      return false;
    }

    return true;
  }

  async signOut() {
    try {
      // Clear all storage first
      localStorage.removeItem("user");
      localStorage.removeItem("sessionId");
      sessionStorage.clear();

      // Clear auth manager state
      const authManager = AuthStateManager.getInstance();
      authManager.clearSessionTimeout();

      // Finally, sign out from Firebase
      await auth.signOut();
    } catch (error) {
      console.error("Error during sign out:", error);
      // Ensure storage is cleared even if Firebase sign out fails
      localStorage.removeItem("user");
      localStorage.removeItem("sessionId");
      sessionStorage.clear();
    }
  }

  cleanup() {
    this.clearSessionTimeout();
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
    this.loginAttempts.clear();
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

    // Force a token refresh to ensure the callable function receives a valid auth context
    await user.getIdToken(true);

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
  role?: UserRole
) => {
  const authManager = AuthStateManager.getInstance();

  try {
    const result = await withRetry(() =>
      signInWithPopup(auth, new GoogleAuthProvider())
    );

    const user = result.user;
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    // Check for admin role immediately, before any state updates
    if (userDoc.exists()) {
      const idTokenResult = await user.getIdTokenResult(true);
      const existingRole = idTokenResult.claims.role as UserRole;

      if (existingRole === "admin") {
        await auth.signOut();
        setUser(null); // Clear user state immediately
        window.location.replace("/admin"); // Use replace to prevent back navigation
        return null;
      }
    }

    const userData = userDoc.data();

    // Rest of the sign in logic for non-admin users
    if (userDoc.exists()) {
      const idTokenResult = await user.getIdTokenResult(true);
      const existingRole = idTokenResult.claims.role as UserRole;

      const userWithMetadata: User = {
        ...user,
        role: existingRole,
        createdAt:
          userData?.createdAt instanceof Timestamp
            ? userData.createdAt.toDate().toISOString()
            : undefined,
      };

      await updateUserData(userRef, {
        lastLogin: serverTimestamp(),
      });

      await authManager.startSessionTimeout();
      setUser(userWithMetadata);
      return userWithMetadata;
    }

    // For new users during signup
    const defaultRole: UserRole = role || "user";
    const functions = getFunctions();
    const setCustomClaims = httpsCallable(functions, "setCustomClaims");
    await setCustomClaims({ uid: user.uid, role: defaultRole });

    const userUpdateData: Record<string, any> = {
      displayName: user.displayName,
      email: user.email,
      provider: "google",
      role: defaultRole,
      createdAt: serverTimestamp(),
    };

    await updateUserData(userRef, userUpdateData, false);

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

    // Suppress auth state changes during verification check
    sessionStorage.setItem("suppressAuth", "true");

    // First get the user credential
    const userCredential: UserCredential = await withRetry(() =>
      signInWithEmailAndPassword(
        auth,
        validatedData.email,
        validatedData.password
      )
    );

    const user = userCredential.user;

    // Force reload user to get latest email verification status
    await user.reload();

    // Check email verification status immediately
    if (!user.emailVerified) {
      // Sign out and clear any potential state
      await auth.signOut();
      setUser(null);
      sessionStorage.removeItem("suppressAuth");

      // Don't count unverified email attempts as failed login attempts
      // Only throw the verification error
      throw new Error(
        "Your email address has not been verified. Please check your inbox or spam folder to verify."
      );
    }

    // Remove suppression only after verification is confirmed
    sessionStorage.removeItem("suppressAuth");

    // Continue with the rest of the login process
    const idTokenResult = await user.getIdTokenResult();
    const role = idTokenResult.claims.role as UserRole;

    const claims = await getUserClaims(user);
    console.log("User role:", claims?.role);

    if (role === "admin") {
      await auth.signOut();
      throw new Error(
        "Access denied. Admin login requires a specialized authentication method."
      );
    }

    authManager.recordLoginAttempt(validatedData.email, true);

    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();

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
  } catch (error) {
    // Always clean up suppression in case of error
    sessionStorage.removeItem("suppressAuth");

    if (error instanceof ZodError) {
      throw new Error(getZodErrorMessage(error));
    }

    // Only record failed attempts for invalid credentials, not for unverified emails
    if (
      error instanceof Error &&
      (error.name === AuthErrorCodes.INVALID_PASSWORD ||
        error.name === AuthErrorCodes.USER_DELETED) &&
      !error.message.includes("not been verified") // Add this check
    ) {
      authManager.recordLoginAttempt(loginData.email, false);
    }

    throw error;
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

export const resendVerificationEmail = async (
  email: string,
  password: string
) => {
  // const authManager = AuthStateManager.getInstance();

  try {
    // Temporarily suppress auth state changes
    sessionStorage.setItem("suppressAuth", "true");

    // Get user credential without triggering auth state change
    const userCredential = await withRetry(() =>
      signInWithEmailAndPassword(auth, email, password)
    );

    await sendEmailVerification(userCredential.user);

    // Sign out silently
    await auth.signOut();

    // Remove suppression
    sessionStorage.removeItem("suppressAuth");

    // Don't record this as a login attempt at all, since it's just for verification
    return {
      success: true,
      message: "Verification email resent. Please check your inbox.",
    };
  } catch (error) {
    // Don't record verification attempts as failed login attempts
    sessionStorage.removeItem("suppressAuth");

    // If it's an invalid credentials error, we still want to show that
    if (error && typeof error === 'object' && 'code' in error && error.code === AuthErrorCodes.INVALID_LOGIN_CREDENTIALS) {
      return handleAuthError(error);
    }

    // For other errors, just throw them normally
    throw error;
  }
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

export const signOut = async () => {
  try {
    // Clear all storage first
    localStorage.removeItem("user");
    localStorage.removeItem("sessionId");
    sessionStorage.clear();

    // Clear auth manager state
    const authManager = AuthStateManager.getInstance();
    authManager.clearSessionTimeout();

    // Finally, sign out from Firebase
    await auth.signOut();
  } catch (error) {
    console.error("Error during sign out:", error);
    // Ensure storage is cleared even if Firebase sign out fails
    localStorage.removeItem("user");
    localStorage.removeItem("sessionId");
    sessionStorage.clear();
  }
};
