import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
// import { AnimatePresence } from "framer-motion";
import ProtectedRoute from "./ProtectedRoute";
import SkeletonLoader from "../components/SkeletonLoader";

// Lazy load components
const LazyMainLayout = lazy(() => import("../app/MainLayout"));
const LazyHome = lazy(() => import("../app/pages/Home"));
const LazySignUp = lazy(() => import("../app/auth/SignUp"));
const LazySignIn = lazy(() => import("../app/auth/SignIn"));
const LazyResetPassword = lazy(() => import("../app/auth/ResetPasword"));
const LazyRoleSelectionDialog = lazy(
  () => import("../components/RoleSelectioDialog")
);
const LazyTenantDashboard = lazy(
  () => import("../components/dashboards/TenantDashboard")
);

const LazyLandlordDashboard = lazy(
  () => import("../components/dashboards/LandloardDashboard")
);
const LazyAdminDashboard = lazy(
  () => import("../components/dashboards/AdminDashboard")
);
const LazyUnauthorized = lazy(() => import("../components/Unauthorized"));
const LazyEditAccount = lazy(() => import("../app/pages/EditAccount"));
const LazyAdminAuthPage = lazy(() => import("../components/admin/Auth"));

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Suspense fallback={<SkeletonLoader />}>
        <LazyMainLayout />
      </Suspense>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<SkeletonLoader />}>
            <LazyHome />
          </Suspense>
        ),
      },
      {
        path: "/role-dialog",
        element: (
          <Suspense fallback={<SkeletonLoader />}>
            <LazyRoleSelectionDialog />
          </Suspense>
        ),
      },

      {
        path: "/edit-account",
        element: (
          <Suspense fallback={<SkeletonLoader />}>
            <LazyEditAccount />
          </Suspense>
        ),
      },
      {
        path: "/admin",
        element: (
          <Suspense fallback={<SkeletonLoader />}>
            <LazyAdminAuthPage />
          </Suspense>
        ),
      },
      {
        path: "/admin-dashboard",
        element: (
          <ProtectedRoute allowedRoles={["admin"]}>
            <Suspense fallback={<SkeletonLoader />}>
              <LazyAdminDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "/unauthorized",
        element: (
          <Suspense fallback={<SkeletonLoader />}>
            <LazyUnauthorized />
          </Suspense>
        ),
      },
      {
        path: "/login",
        element: (
          <ProtectedRoute requireAuth={false} requireUnauth={true}>
            <Suspense fallback={<SkeletonLoader />}>
              <LazySignIn />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "/profile",
        element: (
          <ProtectedRoute allowedRoles={["user"]}>
            <Suspense fallback={<SkeletonLoader />}>
              <LazyTenantDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "/dashboard",
        element: (
          <ProtectedRoute
            allowedRoles={["landlord_verified", "landlord_unverified"]}
          >
            <Suspense fallback={<SkeletonLoader />}>
              <LazyLandlordDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "/signup",
        element: (
          <ProtectedRoute requireAuth={false} requireUnauth={true}>
            <Suspense fallback={<SkeletonLoader />}>
              <LazySignUp />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "/reset-password",
        element: (
          <ProtectedRoute requireAuth={false} requireUnauth={true}>
            <Suspense fallback={<SkeletonLoader />}>
              <LazyResetPassword />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
