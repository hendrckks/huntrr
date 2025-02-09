import React, { useEffect, useState } from "react";
import { User, KeyRound, Mail, Loader2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signInWithGoogle, signUp } from "../../lib/firebase/auth";
import { SignUpInput, SignUpRole, UserRole } from "../../lib/types/auth";
import { toast } from "../../hooks/useToast";
import { useAuth } from "../../contexts/AuthContext";

// Import shadcn components
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardContent } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";

const SignUp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [googleSignupLoading, setGoogleSignupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    password: "",
  });
  const { setUser } = useAuth();

  interface LocationState {
    userType: "tenant" | "landlord";
    role: SignUpRole;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const locationState = location.state as LocationState;
  const userRole: SignUpRole =
    locationState?.userType === "landlord" ? "landlord_unverified" : "user";

  useEffect(() => {
    if (!locationState?.userType) {
      navigate("/");
    }
  }, [locationState, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Set a flag to suppress auth state updates during the sign-in process
    sessionStorage.setItem("suppressAuth", "true");

    try {
      const signUpData: SignUpInput = {
        displayName: formData.displayName,
        email: formData.email,
        password: formData.password,
        role: userRole,
      };

      const result = await signUp(signUpData);

      if (result?.success) {
        // Clear any existing auth state
        localStorage.removeItem("user");
        sessionStorage.clear();
        
        toast({
          title: "Verification Email Sent",
          variant: "info",
          description:
            "A verification email has been sent to your email address. Please check your inbox and verify your account.",
          duration: 5000,
        });
        setSuccess(result.message);
        
        // Remove the flag and navigate immediately
        sessionStorage.removeItem("suppressAuth");
        navigate("/login", {
          state: {
            email: formData.email,
            message:
              "Account created successfully! Please check your email for verification before logging in.",
          },
          replace: true, // Replace the current history entry
        });
      }
    } catch (err: any) {
      // Remove the suppression flag so that later auth events are processed normally
      sessionStorage.removeItem("suppressAuth");
      if (err.message.includes("verify")) {
        toast({
          title: "Email Not Verified",
          variant: "error",
          description:
            "Please verify your email before logging in. Check your inbox for the verification email.",
          duration: 5000,
        });
        setError("Please verify your email before logging in.");
      } else if (err.message.includes("Access denied")) {
        setError("This account requires a specialized login method. Please contact support.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleSignupLoading(true);
    setError(null);

    try {
      const signedInUser = await signInWithGoogle(setUser, userRole);

      if (!signedInUser) {
        throw new Error("Sign-in failed. Please try again.");
      }

      if (!signedInUser.emailVerified) {
        setError("Your email has not been verified. Please check your inbox and verify your email.");
        return;
      }

      // Wait for the correct role assignment
      const checkRoleInterval = setInterval(async () => {
        const idTokenResult = await signedInUser.getIdTokenResult(true);
        const role = idTokenResult.claims.role as UserRole;

        if (role && role !== "user" as UserRole) {
          clearInterval(checkRoleInterval);

          if (!signedInUser.emailVerified) {
            setError("Please verify your email before proceeding.");
            return;
          }

          switch (role) {
            case "landlord_unverified":
            case "landlord_verified":
              navigate("/dashboard");
              break;
            case "user":
              navigate("/profile");
              break;
            case "admin":
              navigate("/admin-dashboard");
              break;
            default:
              navigate("/");
          }

          toast({
            title: "Success",
            description: "Sign In successful",
            duration: 3000,
          });
        }
      }, 1000); // Check every second

      // Stop checking after 10 seconds to avoid infinite loops
      setTimeout(() => clearInterval(checkRoleInterval), 10000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGoogleSignupLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center overflow-hidden">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h2 className="text-xl font-medium text-center">Create an account</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Full Name</Label>
              <div className="relative">
                <Input
                  id="displayName"
                  name="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  className="pl-10"
                  required
                />
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Personal Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
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
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className="pl-10"
                  required
                />
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2 text-center text-muted-foreground">
              <h2 className="font-medium">
                Creating an account as
                <span className="ml-1 text-foreground font-semibold">
                  {locationState?.userType === "tenant" ? "Tenant" : "Landlord"}
                </span>
              </h2>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sign Up
            </Button>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">Already have an account?</span>
              <Link
                to="/login"
                className="ml-1.5 text-foreground underline hover:text-foreground/80"
              >
                Log in
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
              disabled={loading || googleSignupLoading}
              className="w-full"
            >
              {googleSignupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
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
              )}
              Continue with Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignUp;
