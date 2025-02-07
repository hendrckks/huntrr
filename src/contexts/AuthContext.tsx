import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth } from "../lib/firebase/clientApp";
import { checkSession, getAuthStateManager } from "../lib/firebase/auth";
// import { useLocation } from "react-router-dom";

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

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
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
  // const location = useLocation();

  const debouncedCheckSession = debounce(async () => {
    try {
      const isSessionValid = await checkSession();
      if (!isSessionValid) {
        setAuthState((prev) => ({
          ...prev,
          user: null,
          error: new Error("Session expired"),
        }));
        sessionStorage.removeItem("user");
      }
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        error: error as Error,
      }));
    }
  }, 300);

  useEffect(() => {
    // Initialize auth state from sessionStorage if available
    const cachedUser = sessionStorage.getItem("user");
    if (cachedUser) {
      setAuthState((prev) => ({
        ...prev,
        user: JSON.parse(cachedUser),
        isLoading: false,
      }));
    }

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // If a signup is in progress, ignore this auth change.
      if (sessionStorage.getItem("suppressAuth") === "true") {
        return;
      }

      try {
        if (firebaseUser) {
          await debouncedCheckSession();
          let role: UserRole | undefined;

          // Optionally wait for proper role assignment
          for (let i = 0; i < 10; i++) {
            const idTokenResult = await firebaseUser.getIdTokenResult(true);
            role = idTokenResult.claims.role as UserRole;
            if (role && role !== "user") break;
            await new Promise((res) => setTimeout(res, 1000));
          }

          const userData: User = { ...firebaseUser, role };
          setAuthState({
            user: userData,
            isLoading: false,
            isInitialized: true,
            error: null,
          });
          sessionStorage.setItem("user", JSON.stringify(userData));
        } else {
          const sessionExpiration = sessionStorage.getItem("sessionExpiration");
          const cachedUser = sessionStorage.getItem("user");
          if (sessionExpiration && Date.now() < parseInt(sessionExpiration) && cachedUser) {
            // Session still valid and a user is cached in sessionStorage, so use it
            setAuthState({
              user: JSON.parse(cachedUser),
              isLoading: false,
              isInitialized: true,
              error: null,
            });
            return;
          }

          // Clear session storage when user is truly signed out
          sessionStorage.clear();
          
          setAuthState({
            user: null,
            isLoading: false,
            isInitialized: true,
            error: null,
          });
        }
      } catch (error) {
        // Clear session storage on error as well
        sessionStorage.clear();
        
        setAuthState({
          user: null,
          isLoading: false,
          isInitialized: true,
          error: error as Error,
        });
      }
    });

    // Set up session timeout checker
    const sessionInterval = setInterval(debouncedCheckSession, 60000);

    return () => {
      unsubscribe();
      clearInterval(sessionInterval);
      getAuthStateManager().cleanup();
    };
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
