import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth } from "../lib/firebase/clientApp";
import { getAuthStateManager } from "../lib/firebase/auth";
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
      const sessionExpiration = sessionStorage.getItem("sessionExpiration");
      const cachedUser = localStorage.getItem("user");

      // Only clear session if there's no expiration time or it has expired
      if (!sessionExpiration || Date.now() > parseInt(sessionExpiration)) {
        setAuthState((prev) => ({
          ...prev,
          user: null,
          error: new Error(sessionExpiration ? "Session expired" : "No session found"),
        }));
        sessionStorage.clear();
        localStorage.removeItem("user");
        return;
      }

      // If we have a valid session and cached user, ensure the state is in sync
      if (cachedUser) {
        const parsedUser = JSON.parse(cachedUser);
        setAuthState((prev) => ({
          ...prev,
          user: parsedUser,
          error: null,
        }));
      }
    } catch (error) {
      console.error("Session check error:", error);
      setAuthState((prev) => ({
        ...prev,
        error: error as Error,
      }));
    }
  }, 300);

  useEffect(() => {
    // Add storage event listener to handle cross-tab synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === null) {  // Storage was cleared
        setAuthState({
          user: null,
          isLoading: false,
          isInitialized: true,
          error: null,
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Initialize auth state from localStorage if available and session is valid
    const sessionExpiration = sessionStorage.getItem("sessionExpiration");
    const cachedUser = localStorage.getItem("user");
    
    if (sessionExpiration && Date.now() < parseInt(sessionExpiration) && cachedUser) {
      try {
        const parsedUser = JSON.parse(cachedUser);
        setAuthState({
          user: parsedUser,
          isLoading: false,
          isInitialized: true,
          error: null,
        });
      } catch (error) {
        console.error("Error parsing cached user:", error);
      }
    }

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // If a signup is in progress, ignore this auth change
      if (sessionStorage.getItem("suppressAuth") === "true") {
        return;
      }

      setAuthState(prev => ({ ...prev, isLoading: true }));

      try {
        // Check for existing valid session first
        const sessionExpiration = sessionStorage.getItem("sessionExpiration");
        const cachedUser = localStorage.getItem("user");
        
        if (sessionExpiration && Date.now() < parseInt(sessionExpiration) && cachedUser) {
          const existingUser = JSON.parse(cachedUser);
          if (!firebaseUser) {
            // Keep the existing session if it's still valid
            setAuthState({
              user: existingUser,
              isLoading: false,
              isInitialized: true,
              error: null,
            });
            return;
          }
        }

        if (firebaseUser) {
          let role: UserRole | undefined;

          // Optionally wait for proper role assignment
          for (let i = 0; i < 3; i++) {
            const idTokenResult = await firebaseUser.getIdTokenResult(true);
            role = idTokenResult.claims.role as UserRole;
            if (role && role !== "user") break;
            if (i < 2) await new Promise((res) => setTimeout(res, 500));
          }

          const userData: User = { ...firebaseUser, role };
          
          // Set session expiration (2 hours from now)
          const expiresAt = Date.now() + (2 * 60 * 60 * 1000);
          sessionStorage.setItem("sessionExpiration", expiresAt.toString());
          
          // Store user data in both storages
          localStorage.setItem("user", JSON.stringify(userData));
          sessionStorage.setItem("user", JSON.stringify(userData));

          setAuthState({
            user: userData,
            isLoading: false,
            isInitialized: true,
            error: null,
          });
        } else {
          // Only clear session if we don't have a valid one
          const sessionExpiration = sessionStorage.getItem("sessionExpiration");
          const cachedUser = localStorage.getItem("user");
          
          if (!sessionExpiration || !cachedUser || Date.now() > parseInt(sessionExpiration)) {
            // No valid session, clear everything
            localStorage.removeItem("user");
            sessionStorage.clear();
            
            setAuthState({
              user: null,
              isLoading: false,
              isInitialized: true,
              error: null,
            });
          }
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        // Clear all storage on error
        localStorage.removeItem("user");
        sessionStorage.clear();
        
        setAuthState({
          user: null,
          isLoading: false,
          isInitialized: true,
          error: error as Error,
        });
      }
    });

    // Set up periodic session check (every 30 seconds)
    const sessionCheckInterval = setInterval(debouncedCheckSession, 30000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      unsubscribe();
      clearInterval(sessionCheckInterval);
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
