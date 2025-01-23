import { createBrowserRouter } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import MainLayout from "../app/MainLayout";
import Home from "../app/pages/Home";
import SignUp from "../app/auth/SignUp";
import SignIn from "../app/auth/SignIn";
import ResetPassword from "../app/auth/ResetPasword";
import RoleSelectionDialog from "../components/RoleSelectioDialog";
import TenantDashboard from "../components/dashboards/TenantDashboard";
import LandloardDashboard from "../components/dashboards/LandloardDashboard";
import ProtectedRoute from "./ProtectedRoute";
import Unauthorized from "../components/Unauthorized";
import EditAccount from "../app/pages/EditAccount";
import AdminAuthPage from "../components/admin/Auth";
import AdminDashboard from "../components/dashboards/AdminDashboard";
import { Navigate } from "react-router-dom";

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AnimatePresence mode="sync">
        <MainLayout />
      </AnimatePresence>
    ),
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "/role-dialog",
        element: <RoleSelectionDialog />,
      },
      {
        path: "/edit-account",
        element: <EditAccount />,
      },
      {
        path: "/admin",
        element: <AdminAuthPage />,
      },
      {
        path: "/admin-dashboard",
        element: (
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "/unauthorized",
        element: <Unauthorized />,
      },
      {
        path: "/login",
        element: (
          <ProtectedRoute requireAuth={false} requireUnauth={true}>
            <SignIn />
          </ProtectedRoute>
        ),
      },
      {
        path: "/profile",
        element: (
          <ProtectedRoute allowedRoles={["user"]}>
            <TenantDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "/dashboard",
        element: (
          <ProtectedRoute
            allowedRoles={["landlord_verified", "landlord_unverified"]}
          >
            <LandloardDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "/signup",
        element: (
          <ProtectedRoute requireAuth={false} requireUnauth={true}>
            <SignUp />
          </ProtectedRoute>
        ),
      },
      {
        path: "/reset-password",
        element: (
          <ProtectedRoute requireAuth={false} requireUnauth={true}>
            <ResetPassword />
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
