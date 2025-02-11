import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth } from "../lib/firebase/clientApp";
import { getAuthStateManager } from "../lib/firebase/auth";

type UserRole =
  | "user"
  | "admin"
  | "landlord_unverified"
  | "landlord_verified"
  | undefined;

interface User extends FirebaseUser {
  createdAt?: string;
  role?: UserRole;
  lastLoggedIn?: Date;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: Error | null;
}

interface AuthContextType extends AuthState {
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
  hasRequiredRole: (requiredRoles?: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isInitialized: false,
    error: null,
  });

  // Subscribe to auth state changes
  useEffect((): (() => void) => {
    const authManager = getAuthStateManager();
    const unsubscribe = authManager.subscribeToAuthState(() => {
      setAuthState({
        user: null,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    });

    return () => unsubscribe();
  }, []);

  // Initialize from session storage immediately
  useEffect(() => {
    const initializeFromSession = () => {
      const sessionExpiration = sessionStorage.getItem("sessionExpiration");
      const cachedUser = sessionStorage.getItem("user");

      if (
        sessionExpiration &&
        cachedUser &&
        Date.now() < parseInt(sessionExpiration)
      ) {
        try {
          const userData = JSON.parse(cachedUser);
          setAuthState({
            user: userData,
            isLoading: false,
            isInitialized: true,
            error: null,
          });
          return true; // Session is valid
        } catch (error) {
          console.error("Error parsing session user:", error);
        }
      }
      return false; // No valid session
    };

    // Try to initialize from session first
    const hasValidSession = initializeFromSession();

    if (!hasValidSession) {
      // Only if no valid session exists, wait for Firebase auth
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (sessionStorage.getItem("suppressAuth") === "true") {
          return;
        }

        try {
          if (firebaseUser) {
            if (!firebaseUser.emailVerified) {
              setAuthState({
                user: null,
                isLoading: false,
                isInitialized: true,
                error: new Error("Email not verified"),
              });
              return;
            }

            // Get role from token and check for requiresReauth
            const idTokenResult = await firebaseUser.getIdTokenResult(true);
            const role = idTokenResult.claims.role as UserRole;
            const requiresReauth = idTokenResult.claims.requiresReauth as boolean;

            // If reauth is required, sign out the user
            if (requiresReauth) {
              console.log("Reauth required, signing out...");
              sessionStorage.clear();
              localStorage.removeItem("user");
              await auth.signOut();
              setAuthState({
                user: null,
                isLoading: false,
                isInitialized: true,
                error: new Error("Re-authentication required"),
              });
              return;
            }

            const userData: User = { ...firebaseUser, role };

            // Set session expiration (2 hours from now)
            const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
            sessionStorage.setItem("sessionExpiration", expiresAt.toString());

            // Store user data
            sessionStorage.setItem("user", JSON.stringify(userData));
            localStorage.setItem("user", JSON.stringify(userData));

            setAuthState({
              user: userData,
              isLoading: false,
              isInitialized: true,
              error: null,
            });
          } else {
            // Clear storage and state
            sessionStorage.clear();
            localStorage.removeItem("user");

            setAuthState({
              user: null,
              isLoading: false,
              isInitialized: true,
              error: null,
            });
          }
        } catch (error) {
          console.error("Auth state change error:", error);
          sessionStorage.clear();
          localStorage.removeItem("user");

          setAuthState({
            user: null,
            isLoading: false,
            isInitialized: true,
            error: error as Error,
          });
        }
      });

      return () => {
        unsubscribe();
        getAuthStateManager().cleanup();
      };
    }
  }, []);

  // Session check interval
  useEffect(() => {
    const checkSession = debounce(() => {
      const sessionExpiration = sessionStorage.getItem("sessionExpiration");
      if (!sessionExpiration || Date.now() > parseInt(sessionExpiration)) {
        // Session expired
        sessionStorage.clear();
        localStorage.removeItem("user");
        setAuthState({
          user: null,
          isLoading: false,
          isInitialized: true,
          error: new Error("Session expired"),
        });
      }
    }, 300);

    const interval = setInterval(checkSession, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Storage event listener for cross-tab synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === null || e.key === "user") {
        const sessionExpiration = sessionStorage.getItem("sessionExpiration");
        const user = localStorage.getItem("user");

        if (
          !sessionExpiration ||
          !user ||
          Date.now() > parseInt(sessionExpiration)
        ) {
          setAuthState({
            user: null,
            isLoading: false,
            isInitialized: true,
            error: null,
          });
        } else if (user) {
          try {
            const userData = JSON.parse(user);
            setAuthState({
              user: userData,
              isLoading: false,
              isInitialized: true,
              error: null,
            });
          } catch (error) {
            console.error("Error parsing stored user:", error);
          }
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const hasRequiredRole = (requiredRoles?: UserRole[]): boolean => {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    return (
      !!authState.user?.role && requiredRoles.includes(authState.user.role)
    );
  };

  const contextValue: AuthContextType = {
    ...authState,
    setUser: (user: User | null) => setAuthState((prev) => ({ ...prev, user })),
    isAuthenticated: !!authState.user && !authState.isLoading,
    hasRequiredRole,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthProvider;
