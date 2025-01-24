import type React from "react";
import { useState } from "react";
import { KeyRound, Mail, Loader2 } from "lucide-react";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth } from "../../lib/firebase/clientApp";
import { loginSchema, type UserRole } from "../../lib/types/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../hooks/useToast";
import { AuthStateManager } from "../../lib/firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase/clientApp";
import type { User } from "../../lib/types/auth";

const AdminAuthFlow: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate the login input
      const validatedData = loginSchema.parse({ email, password });

      // Set session persistence to browser session
      await setPersistence(auth, browserSessionPersistence);

      // Sign in using Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(
        auth,
        validatedData.email,
        validatedData.password
      );

      // Fetch the ID token and validate admin role
      const idTokenResult = await userCredential.user.getIdTokenResult(true);
      console.log("Claims on Login:", idTokenResult.claims);

      if (idTokenResult.claims.role !== "admin") {
        throw new Error("You do not have admin privileges.");
      }

      // Update last logged in timestamp
      const userRef = doc(db, "users", userCredential.user.uid);
      await updateDoc(userRef, {
        lastLoggedIn: serverTimestamp(),
      });

      // Update user state with the role
      const userWithRole: User = {
        ...userCredential.user,
        role: idTokenResult.claims.role as UserRole,
      };

      setUser(userWithRole);

      // Start session timeout for admin users
      const authManager = AuthStateManager.getInstance();
      await authManager.startSessionTimeout();

      console.log("Admin user logged in:", userWithRole);
      navigate("/admin-dashboard");

      toast({
        title: "Welcome!",
        variant: "success",
        description: "Admin Sign In successful",
        duration: 5000,
      });
    } catch (error: any) {
      let errorMessage = "Login failed";

      if (error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password.";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "No admin account found with this email.";
      } else if (error.message === "You do not have admin privileges.") {
        errorMessage = "You do not have admin privileges.";
      }

      setError(errorMessage);
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center bg-background md:mt-0 mt-20">
      <div className="w-full h-full rounded-2xl bg-background flex items-center justify-center">
        <div className="w-full max-w-md p-4 lg:p-6">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-medium text-textBlack">Admin Login</h2>
          </div>

          {error && (
            <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 pl-10 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="example@email.com"
                  required
                />
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-gray-300 pl-10 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="••••••••"
                  required
                />
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-gradient-to-b from-[#637257] to-[#4b5942] px-4 py-2 text-sm font-medium text-white hover:from-[#4b5942] hover:to-[#3c4735] focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Login as Admin
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminAuthFlow;
