import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import ProtectedRoute from "./ProtectedRoute";
import SkeletonLoader from "../components/SkeletonLoader";
import { UserRole } from "../lib/types/auth";
import { AuthProvider } from "../contexts/AuthContext";

// Lazy load components
const Components = {
  MainLayout: lazy(() => import("../app/MainLayout")),
  Home: lazy(() => import("../app/pages/Home")),
  CreateListing: lazy(() => import("../app/pages/CreateListing")),
  SignUp: lazy(() => import("../app/auth/SignUp")),
  SignIn: lazy(() => import("../app/auth/SignIn")),
  ResetPassword: lazy(() => import("../app/auth/ResetPassword")),
  RoleSelectionDialog: lazy(() => import("../components/RoleSelectionDialog")),
  TenantDashboard: lazy(
    () => import("../components/dashboards/TenantDashboard")
  ),
  LandlordDashboard: lazy(
    () => import("../components/dashboards/LandloardDashboard")
  ),
  AdminDashboard: lazy(() => import("../components/dashboards/AdminDashboard")),
  Unauthorized: lazy(() => import("../components/Unauthorized")),
  EditAccount: lazy(() => import("../app/pages/EditAccount")),
  AdminAuthPage: lazy(() => import("../components/admin/Auth")),
};

const createProtectedRoute = (
  element: JSX.Element,
  options?: {
    requireAuth?: boolean;
    requireUnauth?: boolean;
    allowedRoles?: UserRole[];
  }
) => (
  <ProtectedRoute {...options}>
    <Suspense fallback={<SkeletonLoader />}>{element}</Suspense>
  </ProtectedRoute>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AuthProvider>
        <div className={`antialiased min-h-screen bg-background font-athauss`}>
          <Suspense fallback={<SkeletonLoader />}>
            <Components.MainLayout />
          </Suspense>
        </div>
      </AuthProvider>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<SkeletonLoader />}>
            <Components.Home />
          </Suspense>
        ),
      },
      // Public routes
      {
        path: "role-dialog",
        element: createProtectedRoute(<Components.RoleSelectionDialog />, {
          requireAuth: false,
          requireUnauth: true,
        }),
      },
      {
        path: "login",
        element: createProtectedRoute(<Components.SignIn />, {
          requireAuth: false,
          requireUnauth: true,
        }),
      },
      {
        path: "signup",
        element: createProtectedRoute(<Components.SignUp />, {
          requireAuth: false,
          requireUnauth: true,
        }),
      },
      {
        path: "reset-password",
        element: createProtectedRoute(<Components.ResetPassword />, {
          requireAuth: false,
          requireUnauth: true,
        }),
      },
      {
        path: "unauthorized",
        element: (
          <Suspense fallback={<SkeletonLoader />}>
            <Components.Unauthorized />
          </Suspense>
        ),
      },

      // Protected routes for all authenticated users
      {
        path: "edit-account",
        element: createProtectedRoute(<Components.EditAccount />, {
          requireAuth: true,
        }),
      },
      {
        path: "add-listing",
        element: createProtectedRoute(<Components.CreateListing />, {
          requireAuth: true,
          allowedRoles: ["landlord_unverified"],
        }),
      },

      // Role-specific routes
      {
        path: "profile",
        element: createProtectedRoute(<Components.TenantDashboard />, {
          requireAuth: true,
          allowedRoles: ["user"],
        }),
      },
      {
        path: "dashboard",
        element: createProtectedRoute(<Components.LandlordDashboard />, {
          requireAuth: true,
          allowedRoles: ["landlord_verified", "landlord_unverified"],
        }),
      },
      {
        path: "admin",
        element: createProtectedRoute(<Components.AdminAuthPage />, {
          requireAuth: false,
        }),
      },
      {
        path: "admin-dashboard",
        element: createProtectedRoute(<Components.AdminDashboard />, {
          requireAuth: true,
          allowedRoles: ["admin"],
        }),
      },

      // Fallback route
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
