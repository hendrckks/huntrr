// ProtectedRoute.tsx
import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getUserClaims, UserClaims } from "../utils/authUtils";
import { getAuth } from "firebase/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireUnauth?: boolean;
  allowedRoles?: ("user" | "landlord_verified" | "landlord_unverified")[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireUnauth = false,
  allowedRoles = [],
}) => {
  const { loading, isAuthenticated, isRefreshing, isInitialized } = useAuth();
  const location = useLocation();
  const [isReady, setIsReady] = useState(false);
  const [claims, setClaims] = useState<UserClaims | null>(null);
  const [claimsLoaded, setClaimsLoaded] = useState(false);
  const auth = getAuth();

  useEffect(() => {
    let mounted = true;
    let timeout: NodeJS.Timeout;

    const fetchClaims = async () => {
      if (auth.currentUser) {
        try {
          const userClaims = await getUserClaims(auth.currentUser);
          if (mounted) {
            setClaims(userClaims);
          }
        } catch (error) {
          console.error("Error fetching claims:", error);
        } finally {
          if (mounted) {
            setClaimsLoaded(true);
          }
        }
      } else {
        if (mounted) {
          setClaimsLoaded(true);
        }
      }
    };

    if (!loading && !isRefreshing && isInitialized) {
      fetchClaims();
      timeout = setTimeout(() => {
        if (mounted) {
          setIsReady(true);
        }
      }, 300);
    }

    return () => {
      mounted = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [loading, isRefreshing, isInitialized, auth.currentUser]);

  if (!isReady || !claimsLoaded) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        loading
      </div>
    );
  }

  if (requireAuth && !isAuthenticated()) {
    return <Navigate to="/role-dialog" state={{ from: location }} replace />;
  }

  if (requireUnauth && isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  // Only check roles if the user is authenticated and roles are required
  if (isAuthenticated() && allowedRoles.length > 0) {
    if (!claims || !allowedRoles.includes(claims.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
