import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase/clientApp";
import { checkSession } from "../lib/firebase/auth";

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

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  isRefreshing: boolean;
  refreshToken: () => Promise<void>;
  isAuthenticated: () => boolean;
  isAuthReady: () => boolean;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const refreshToken = async () => {
    if (auth.currentUser) {
      setIsRefreshing(true);
      try {
        await auth.currentUser.getIdToken(true);
        const isSessionValid = await checkSession();
        if (!isSessionValid) {
          setUser(null);
          localStorage.removeItem("user");
        }
      } catch (error) {
        console.error("Error refreshing token:", error);
        setUser(null);
        localStorage.removeItem("user");
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      try {
        if (firebaseUser) {
          const isSessionValid = await checkSession();
          if (isSessionValid) {
            // Get the token result first
            const idTokenResult = await firebaseUser.getIdTokenResult(true);
            const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
            const userData = userDoc.data();

            if (mounted) {
              const userWithMetadata: User = {
                ...firebaseUser,
                // Explicitly set role from token claims
                role: idTokenResult.claims.role as UserRole,
                createdAt: userData?.createdAt?.toDate().toISOString(),
                lastLoggedIn: userData?.lastLoggedIn?.toDate(),
              };
              console.log(
                "Setting user with role from claims:",
                userWithMetadata.role
              );
              setUser(userWithMetadata);
              localStorage.setItem("user", JSON.stringify(userWithMetadata));
            }
          } else {
            if (mounted) {
              setUser(null);
              localStorage.removeItem("user");
            }
          }
        } else {
          if (mounted) {
            setUser(null);
            localStorage.removeItem("user");
          }
        }
      } catch (error) {
        console.error("Error in auth state change:", error);
        if (mounted) {
          setUser(null);
          localStorage.removeItem("user");
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setIsInitialized(true);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const isAuthenticated = () => {
    console.log("Checking authentication - user:", user?.role);
    return !!user && !loading && !isRefreshing;
  };

  const isAuthReady = () => !loading && !isRefreshing;

  const value: AuthContextType = {
    user,
    loading,
    setUser,
    isRefreshing,
    refreshToken,
    isAuthenticated,
    isAuthReady,
    isInitialized,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
