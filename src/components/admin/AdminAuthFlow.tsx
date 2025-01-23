import React, { useState } from "react";
import { KeyRound, Mail, Loader2 } from "lucide-react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../../lib/firebase/clientApp";
import { loginSchema, resetPasswordSchema } from "../../lib/types/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../hooks/useToast";

const AdminAuthFlow: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const validatedData = loginSchema.parse({ email, password });
      const userCredential = await signInWithEmailAndPassword(
        auth,
        validatedData.email,
        validatedData.password
      );

      const idTokenResult = await userCredential.user.getIdTokenResult();

      if (idTokenResult.claims.role !== "admin") {
        throw new Error("You do not have admin privileges.");
      }

      setUser(userCredential.user);
      navigate("/admin-dashboard");
      toast({
        title: "",
        variant: "success",
        description: "Admin Sign In successful",
        duration: 5000,
      });
    } catch (error: any) {
      let errorMessage = "Login failed";

      if (error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "No admin account found with this email";
      } else if (error.message === "You do not have admin privileges.") {
        errorMessage = "You do not have admin privileges";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const validatedData = resetPasswordSchema.parse({ email });
      await sendPasswordResetEmail(auth, validatedData.email);
      toast({
        title: "",
        variant: "success",
        description: "Password reset email sent",
        duration: 5000,
      });
      setMode("login");
    } catch (error: any) {
      let errorMessage = "Password reset failed";

      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center overflow-hidden bg-background md:mt-0 mt-20">
      <div className="w-full h-full rounded-2xl bg-background flex items-center justify-center">
        <div className="w-full max-w-md p-4 lg:p-6">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-medium text-textBlack">
              {mode === "login" ? "Admin Login" : "Reset Password"}
            </h2>
          </div>

          {error && (
            <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div className="mb-4 flex justify-center space-x-4">
            <button
              onClick={() => setMode("login")}
              className={`px-4 py-2 rounded-md text-sm ${
                mode === "login"
                  ? "bg-gradient-to-b from-[#637257] to-[#4b5942] text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setMode("reset")}
              className={`px-4 py-2 rounded-md text-sm ${
                mode === "reset"
                  ? "bg-gradient-to-b from-[#637257] to-[#4b5942] text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Reset Password
            </button>
          </div>

          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Email
                </label>
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
          )}

          {mode === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Email
                </label>
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

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-gradient-to-b from-[#637257] to-[#4b5942] px-4 py-2 text-sm font-medium text-white hover:from-[#4b5942] hover:to-[#3c4735] focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Reset Password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAuthFlow;
