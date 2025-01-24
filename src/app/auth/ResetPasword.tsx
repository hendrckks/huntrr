import React, { useState, useEffect } from "react";
import { Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { resetPassword } from "../../lib/firebase/auth";
import { ResetPasswordInput } from "../../lib/types/auth";
import { toast } from "../../hooks/useToast";

const COUNTDOWN_TIME = 60; // 60 seconds = 1 minute

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [_error, setError] = useState<string | null>(null);

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
        setShowResend(true);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!canResend || isSubmitting || countdown > 0) {
      return;
    }

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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center overflow-hidden bg-textBlack">
      <div className="w-full max-w-md p-6 bg-background rounded-2xl">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-medium text-textBlack">Reset Password</h2>
          <p className="mt-2 text-sm text-gray-500 px-4">
            Enter your email address and we'll send you a link to reset your
            password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 mb-2">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 pl-10 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                placeholder="example@email.com"
                required
                disabled={isSubmitting}
              />
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            </div>
          </div>

          {!hasSubmitted && (
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-gradient-to-b from-[#637257] to-[#4b5942] px-4 py-2 text-sm font-medium text-white hover:from-[#4b5942] hover:to-[#3c4735] focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </button>
          )}

          {showResend && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={!canResend || isSubmitting || countdown > 0}
                className={`w-full rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 ${
                  !canResend || isSubmitting || countdown > 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {countdown > 0
                  ? `Wait ${formatTime(countdown)} to resend`
                  : "Resend Reset Link"}
              </button>
              {countdown > 0 && (
                <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-1000"
                    style={{
                      width: `${(countdown / COUNTDOWN_TIME) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="text-center text-sm">
            <Link
              to="/login"
              className="text-gray-900 underline hover:text-gray-800"
            >
              Back to Sign In
            </Link>
          </div>
        </form>

        <div className="mt-8">
          <div className="rounded-md bg-gray-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-800">
                  Security Note
                </h3>
                <div className="mt-2 text-sm text-gray-500">
                  <p>
                    For your security, the reset link will expire after 24
                    hours. Please make sure to check your spam folder if you
                    don't see the email.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
