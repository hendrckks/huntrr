import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth } from "../lib/firebase/clientApp";
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

// Debounce utility
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const debouncedCheckSession = debounce(async () => {
    const isSessionValid = await checkSession();
    if (!isSessionValid) {
      setUser(null);
      localStorage.removeItem("user");
    }
  }, 300);

  useEffect(() => {
    const cachedUser = localStorage.getItem("user");
    if (cachedUser) {
      setUser(JSON.parse(cachedUser));
      setLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await debouncedCheckSession();
        const idTokenResult = await firebaseUser.getIdTokenResult(true);
        const role = idTokenResult.claims.role as UserRole;

        const userData: User = { ...firebaseUser, role };
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
      } else {
        setUser(null);
        localStorage.removeItem("user");
      }
      setLoading(false);
      setIsInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  const isAuthenticated = () => !!user && !loading;
  const isAuthReady = () => !loading;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        setUser,
        isAuthenticated,
        isAuthReady,
        isInitialized,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
