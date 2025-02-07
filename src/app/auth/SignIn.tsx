import { useEffect, useState } from "react";
import { KeyRound, Mail, Loader2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { login, signInWithGoogle } from "../../lib/firebase/auth";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../hooks/useToast";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase/clientApp";
// import { signInWithEmailAndPassword, sendEmailVerification } from "firebase/auth";

// Import shadcn components
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardContent } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";

const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
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

  // const handleResendVerification = async () => {
  //   if (resendLoading) return;
    
  //   setResendLoading(true);
  //   try {
  //     const result = await resendVerificationEmail(email, password);
      
  //     if (result.success) {
  //       toast({
  //         title: "Verification Email Sent",
  //         variant: "success",
  //         description: result.message,
  //         duration: 5000,
  //       });
  //     }
  //   } catch (error: any) {
  //     console.error(error);
  //     toast({
  //       title: "Error",
  //       variant: "error",
  //       description: "Failed to resend verification email. Please try again.",
  //       duration: 5000,
  //     });
  //   } finally {
  //     setResendLoading(false);
  //   }
  // };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setShowVerificationMessage(false);

    try {
      const user = await login({ email, password }, setUser);
      
      if (!user.emailVerified) {
        setShowVerificationMessage(true);
        throw new Error("Your email has not been verified. Please check your inbox and verify your email.");
      }

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
    <div className="h-screen flex items-center justify-center overflow-hidden bg-textBlack fontc">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h2 className="text-2xl font-medium text-center">Welcome back!</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="pl-10"
                  required
                />
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  required
                />
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Login
            </Button>

            <div className="text-center text-sm py-2">
              <span className="text-muted-foreground">No account yet?</span>
              <Link
                to="/role-dialog"
                className="ml-1.5 text-foreground underline hover:text-foreground/80"
              >
                Create account for free
              </Link>
            </div>

            <div className="text-center text-sm">
              <Link
                to="/reset-password"
                className="text-foreground underline hover:text-foreground/80"
              >
                Forgot password?
              </Link>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full"
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
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
            </Button>
          </form>

          {showVerificationMessage && (
            <Alert className="mt-4">
              <div className="flex flex-col space-y-2">
                <AlertDescription className="text-xs">
                  <h3 className="font-medium">Verification Required</h3>
                  <p className="mt-1">We've sent a verification email to {email}. Please check your inbox and spam folder.</p>
                </AlertDescription>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SignIn;
