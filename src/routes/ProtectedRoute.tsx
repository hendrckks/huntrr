import type React from "react";
import { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import type { UserRole } from "../lib/types/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireUnauth?: boolean;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireUnauth = false,
  allowedRoles = [],
}) => {
  const { user, loading, isAuthenticated, isInitialized } = useAuth();
  const location = useLocation();

  const authState = useMemo(() => {
    const isAuth = isAuthenticated();
    const userRole = user?.role;
    const hasAllowedRole =
      allowedRoles.length === 0 ||
      (userRole && allowedRoles.includes(userRole as UserRole));

    let redirectPath = "/";
    if (isAuth && user) {
      switch (user.role) {
        case "admin":
          redirectPath = "/admin-dashboard";
          break;
        case "user":
          redirectPath = "/profile";
          break;
        case "landlord_verified":
        case "landlord_unverified":
          redirectPath = "/dashboard";
          break;
      }
    }

    return { isAuth, userRole, hasAllowedRole, redirectPath };
  }, [isAuthenticated, user, allowedRoles]);

  if (loading || !isInitialized) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center h-screen"
      >
        Loading...
      </div>
    );
  }

  if (requireAuth && !authState.isAuth) {
    const redirectPath = location.pathname.startsWith("/admin-dashboard")
      ? "/admin"
      : "/role-dialog";
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  if (requireUnauth && authState.isAuth) {
    return <Navigate to={authState.redirectPath} replace />;
  }

  if (authState.isAuth && !authState.hasAllowedRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
