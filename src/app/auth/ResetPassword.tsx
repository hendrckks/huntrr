import React, { useState, useEffect } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { resetPassword } from "../../lib/firebase/auth";
import { ResetPasswordInput } from "../../lib/types/auth";
import { toast } from "../../hooks/useToast";

// Import shadcn components
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardContent } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Progress } from "../../components/ui/progress";

const COUNTDOWN_TIME = 60; // 60 seconds = 1 minute

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      setCanResend(false);
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown]);

  const startCountdown = () => {
    setCountdown(COUNTDOWN_TIME);
    setCanResend(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const resetData: ResetPasswordInput = { email };
      const result = await resetPassword(resetData);

      if (result.success) {
        setHasSubmitted(true);
        startCountdown();
        toast({
          title: "Success",
          variant: "success",
          description: result.message,
          duration: 5000,
        });
      }
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Error",
        variant: "error",
        description: error.message,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!canResend || isSubmitting || countdown > 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const resetData: ResetPasswordInput = { email };
      const result = await resetPassword(resetData);

      if (result.success) {
        startCountdown();
        toast({
          title: "Success",
          variant: "success",
          description: result.message,
          duration: 5000,
        });
      }
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Error",
        variant: "error",
        description: error.message,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center overflow-hidden bg-textBlack">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <h2 className="text-2xl font-medium text-center">Reset Password</h2>
          <p className="text-sm text-muted-foreground text-center">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="pl-10"
                  required
                  disabled={isSubmitting}
                />
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {!hasSubmitted ? (
              <Button 
                type="submit"
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Send Reset Link
              </Button>
            ) : (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendVerification}
                  disabled={!canResend || isSubmitting || countdown > 0}
                  className="w-full"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {countdown > 0
                    ? `Resend available in ${formatTime(countdown)}`
                    : "Resend Reset Link"}
                </Button>
                {countdown > 0 && (
                  <Progress 
                    value={(countdown / COUNTDOWN_TIME) * 100} 
                    className="h-1"
                  />
                )}
              </div>
            )}

            <div className="text-center text-sm">
              <Link
                to="/login"
                className="text-foreground underline hover:text-foreground/80"
              >
                Back to Sign In
              </Link>
            </div>
          </form>

          <Alert className="mt-6">
            <AlertDescription>
              <div className="space-y-2">
                <h3 className="font-medium">Security Note</h3>
                <p className="text-sm text-muted-foreground">
                  For your security, the reset link will expire after 24 hours. 
                  Please check your spam folder if you don't see the email.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword; 