import { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import type { UserRole } from "../lib/types/auth";
import SpinningLoader from "../components/SpinningLoader";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireUnauth?: boolean;
  allowedRoles?: UserRole[];
  redirectPath?: string;
  loadingComponent?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireUnauth = false,
  allowedRoles = [],
  redirectPath,
  loadingComponent = <SpinningLoader />,
}) => {
  const { user, isLoading, isInitialized, isAuthenticated, hasRequiredRole } = useAuth();
  const location = useLocation();

  const authState = useMemo(() => {
    // Don't make any decisions until auth is initialized
    if (!isInitialized) {
      return { shouldRender: false, redirect: null };
    }

    // Handle loading state
    if (isLoading) {
      return { shouldRender: false, redirect: null };
    }

    // Handle authentication requirements
    if (requireAuth && !isAuthenticated) {
      const loginPath = location.pathname.startsWith("/admin-dashboard")
        ? "/admin"
        : "/login";
      return {
        shouldRender: false,
        redirect: {
          to: loginPath,
          state: { from: location, intended: true }
        }
      };
    }

    // Handle unauthenticated route requirements
    if (requireUnauth && isAuthenticated) {
      const defaultRedirectPath = user?.role ? (() => {
        switch (user.role) {
          case "admin": return "/admin-dashboard";
          case "landlord_verified":
          case "landlord_unverified": return "/dashboard";
          case "user": return "/profile";
          default: return "/";
        }
      })() : "/";

      return {
        shouldRender: false,
        redirect: {
          to: redirectPath || defaultRedirectPath,
          state: { from: location }
        }
      };
    }

    // Handle role-based access
    if (isAuthenticated && !hasRequiredRole(allowedRoles)) {
      return {
        shouldRender: false,
        redirect: {
          to: "/unauthorized",
          state: { from: location, role: user?.role }
        }
      };
    }

    return { shouldRender: true, redirect: null };
  }, [
    isInitialized,
    isLoading,
    isAuthenticated,
    requireAuth,
    requireUnauth,
    user,
    redirectPath,
    location,
    hasRequiredRole,
    allowedRoles
  ]);

  if (!authState.shouldRender) {
    if (authState.redirect) {
      return <Navigate to={authState.redirect.to} state={authState.redirect.state} replace />;
    }
    return <>{loadingComponent}</>;
  }

  return <>{children}</>;
};

export default ProtectedRoute;