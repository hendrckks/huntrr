import { useEffect, useState } from "react";
import { KeyRound, Mail, Loader2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { login, signInWithGoogle } from "../../lib/firebase/auth";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../hooks/useToast";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase/clientApp";
import { signInWithEmailAndPassword, sendEmailVerification } from "firebase/auth";

const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const location = useLocation();
  const [message, setMessage] = useState<string | null>(null);
  const { setUser } = useAuth();

  useEffect(() => {
    const state = location.state;
    if (state?.email) {
      setEmail(state.email);
    }
    if (state?.message) {
      setMessage(state.message);
      console.log(message);
    }
    window.history.replaceState({}, document.title);
  }, [location, message]);

  const handleResendVerification = async () => {
    if (resendLoading) return;
    
    setResendLoading(true);
    try {
      // Try to sign in again to get the user object
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      
      toast({
        title: "Verification Email Sent",
        variant: "success",
        description: "A new verification email has been sent to your inbox.",
        duration: 5000,
      });
    } catch (_error: any) {
      toast({
        title: "Error",
        variant: "error",
        description: "Failed to resend verification email. Please try again.",
        duration: 5000,
      });
    } finally {
      // Sign out immediately after sending verification email
      await auth.signOut();
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setShowVerificationMessage(false);

    try {
      await login({ email, password }, setUser);
      toast({
        title: "Success",
        variant: "success",
        description: "Sign In successful",
        duration: 5000,
      });
    } catch (_error: any) {
      if (_error.code === "auth/too-many-requests") {
        toast({
          title: "Too Many Attempts",
          variant: "error",
          description:
            "You've made too many attempts. Please wait a few minutes before trying again.",
          duration: 8000,
        });
        setError(
          "Too many attempts. Please wait a few minutes before trying again."
        );
      } else if (_error.message.includes("has not been verified")) {
        setShowVerificationMessage(true);
        toast({
          title: "Email Verification Required",
          variant: "warning",
          description: _error.message,
          duration: 8000,
        });
        setError(_error.message);
      } else if (_error.message.includes("Access denied")) {
        setError(
          "This account requires a specialized login method. Please contact support."
        );
      } else {
        setError(_error.message);
        toast({
          title: "Error",
          variant: "error",
          description: _error.message,
          duration: 5000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);

    try {
      const user = await signInWithGoogle(setUser);

      // Add null check for user
      if (!user) {
        throw new Error("Sign-in failed. Please try again.");
      }

      await Promise.all([
        new Promise<void>((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser && firebaseUser.uid === user.uid) {
              unsubscribe();
              resolve();
            }
          });
        }),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center overflow-hidden bg-textBlack">
      <div className="w-full max-w-md p-6 bg-background rounded-2xl">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-medium text-textBlack">Welcome back!</h2>
        </div>

        {error && (
          <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Email Address
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
                className="w-full rounded-md border border-gray-300 pl-10 py-2 mb-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
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
            Login
          </button>

          <div className="text-center text-sm py-2">
            <span className="text-gray-500">No account yet?</span>
            <Link
              to="/role-dialog"
              className="ml-1.5 text-gray-900 underline hover:text-gray-800"
            >
              Create account for free
            </Link>
          </div>

          <div className="text-center text-sm">
            <Link
              to="/reset-password"
              className="text-gray-900 underline hover:text-gray-800"
            >
              Forgot password?
            </Link>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-gray-500">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        </form>

        {showVerificationMessage && (
          <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Verification Required</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>We've sent a verification email to {email}. Please check your inbox and spam folder.</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className={`text-sm font-medium text-yellow-800 hover:text-yellow-900 underline ${
                      resendLoading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {resendLoading ? 'Sending...' : 'Resend verification email'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignIn;
