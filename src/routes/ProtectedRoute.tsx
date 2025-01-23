import type React from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { UserRole } from "../lib/types/auth";
// import { getAuth } from "firebase/auth"; // Removed as not used anymore

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireUnauth?: boolean;
  allowedRoles?: (
    | "user"
    | "landlord_verified"
    | "landlord_unverified"
    | "admin"
  )[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireUnauth = false,
  allowedRoles = [],
}) => {
  const { user, loading, isAuthenticated, isRefreshing, isInitialized } =
    useAuth();
  const location = useLocation();
  // const auth = getAuth(); // Removed as not used anymore
  // const [userRole, setUserRole] = useState<string | null>(null); // Removed as user.role is directly used now
  // const [isRoleChecked, setIsRoleChecked] = useState(false); // Removed as not needed anymore

  // useEffect(() => {
  //   const checkUserRole = async () => {
  //     const userAuth = auth.currentUser;
  //     if (userAuth) {
  //       try {
  //         const idTokenResult = await userAuth.getIdTokenResult();
  //         setUserRole(idTokenResult.claims.role as string);
  //       } catch (error) {
  //         console.error("Error fetching user role:", error);
  //         setUserRole(null);
  //       } finally {
  //         setIsRoleChecked(true);
  //       }
  //     } else {
  //       setIsRoleChecked(true);
  //     }
  //   };

  //   if (!loading && !isRefreshing && isInitialized) {
  //     checkUserRole();
  //   }
  // }, [loading, isRefreshing, isInitialized, auth.currentUser]); // Removed useEffect hook

  // Show loading state while checking authentication and role
  if (loading || isRefreshing || !isInitialized) {
    return <div>Loading...</div>;
  }

  // Redirect to role dialog if authentication is required but not present
  if (requireAuth && !isAuthenticated()) {
    if (location.pathname.startsWith("/admin-dashboard")) {
      return <Navigate to="/admin" state={{ from: location }} replace />;
    }
    return <Navigate to="/role-dialog" state={{ from: location }} replace />;
  }

  // Redirect to home if unauthenticated access is not allowed
  if (requireUnauth && isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  if (isAuthenticated() && user) {
    if (
      allowedRoles.length > 0 &&
      (!user.role || !allowedRoles.includes(user.role as UserRole))
    ) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // If all checks pass, render the children
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
