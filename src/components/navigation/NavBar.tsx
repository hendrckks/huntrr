// Navbar.tsx
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";

const Navbar = () => {
  const { user, isAuthenticated, loading } = useAuth();

  const renderAuthButton = () => {
    // Show loading state or Register if auth state isn't ready
    if (loading || !isAuthenticated()) {
      return (
        <Link
          to="/role-dialog"
          className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
        >
          Register
        </Link>
      );
    }

    // Show role-specific buttons when authenticated
    switch (user?.role) {
      case "user":
        return (
          <Link
            to="/profile"
            className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
          >
            Profile
          </Link>
        );
      case "landlord_verified":
      case "landlord_unverified":
        return (
          <Link
            to="/dashboard"
            className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
          >
            Dashboard
          </Link>
        );
      case "admin":
        return (
          <Link
            to="/admin-dashboard"
            className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
          >
            Admin Dashboard
          </Link>
        );
      default:
        return (
          <Link
            to="/role-dialog"
            className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
          >
            Register
          </Link>
        );
    }
  };

  return (
    <nav className="bg-black text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">
          Your Logo
        </Link>
        <div className="space-x-4">{renderAuthButton()}</div>
      </div>
    </nav>
  );
};

export default Navbar;
