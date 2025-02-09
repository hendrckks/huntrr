import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import ProtectedRoute from "./ProtectedRoute";
import SpinningLoader from "../components/SpinningLoader";
import { UserRole } from "../lib/types/auth";
import { AuthProvider } from "../contexts/AuthContext";
import { BookmarkProvider } from "../contexts/BookmarkContext";

// Lazy load components
const Components = {
  MainLayout: lazy(() => import("../app/MainLayout")),
  Home: lazy(() => import("../app/pages/Home")),
  CreateListing: lazy(() => import("../app/pages/CreateListing")),
  SignUp: lazy(() => import("../app/auth/SignUp")),
  SignIn: lazy(() => import("../app/auth/SignIn")),
  ResetPassword: lazy(() => import("../app/auth/ResetPassword")),
  RoleSelectionDialog: lazy(() => import("../components/RoleSelectionDialog")),
  TenantDashboard: lazy(() => import("../components/dashboards/TenantDashboard")),
  LandlordDashboard: lazy(() => import("../components/dashboards/LandlordDashboard")),
  AdminDashboard: lazy(() => import("../components/dashboards/AdminDashboard")),
  Unauthorized: lazy(() => import("../components/Unauthorized")),
  EditAccount: lazy(() => import("../app/pages/EditAccount")),
  AdminAuthPage: lazy(() => import("../components/admin/Auth")),
  LandingPage: lazy(() => import("../app/pages/LandingPage")),
  ListingView: lazy(() => import("../components/ListingView")),
  BookmarksPage: lazy(() => import("../app/pages/Bookmarks")),
  KYCVerification: lazy(() => import("../app/pages/KYCVerification")),
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
    <Suspense fallback={<SpinningLoader />}>{element}</Suspense>
  </ProtectedRoute>
);

export const router = createBrowserRouter([
  // {
  //   path: "/",
  //   element: (
  //     <Suspense fallback={<SpinningLoader />}>
  //       <Components.LandingPage />
  //     </Suspense>
  //   ),
  // },
  {
    path: "/",
    element: (
      <AuthProvider>
        <BookmarkProvider>
          <div className="antialiased bg-background font-athauss">
            <Suspense fallback={<SpinningLoader />}>
              <Components.MainLayout />
            </Suspense>
          </div>
        </BookmarkProvider>
      </AuthProvider>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<SpinningLoader />}>
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
        path: "bookmarks",
        element: createProtectedRoute(<Components.BookmarksPage />, {
          requireAuth: true,
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
          <Suspense fallback={<SpinningLoader />}>
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
        path: "listings/:id",
        element: (
          <Suspense fallback={<SpinningLoader />}>
            <Components.ListingView />
          </Suspense>
        ),
      },
      {
        path: "add-listing",
        element: createProtectedRoute(<Components.CreateListing />, {
          requireAuth: true,
          allowedRoles: ["landlord_verified", "landlord_unverified"],
        }),
      },

      // Role-specific routes
      {
        path: "verify-documents",
        element: createProtectedRoute(<Components.KYCVerification />, {
          requireAuth: true,
          allowedRoles: ["landlord_unverified"],
        }),
      },
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
