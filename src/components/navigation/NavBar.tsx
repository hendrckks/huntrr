import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

const Navbar = () => {
  const { user, isLoading, isAuthenticated, isInitialized } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything until after first mount to prevent hydration mismatch
  if (!mounted || !isInitialized) return null;

  const getAuthContent = () => {
    // Show loading skeleton while initializing or loading
    if (isLoading) {
      return (
        <div className="flex space-x-4">
          <div className="w-20 h-8 bg-gray-200 rounded-md animate-pulse" />
          <div className="w-20 h-8 bg-gray-200 rounded-md animate-pulse" />
        </div>
      );
    }

    // Show login/register for unauthenticated users
    if (!isAuthenticated) {
      return (
        <div className="space-x-4">
          <Link
            to="/login"
            className="bg-transparent text-white px-4 py-2 rounded-md hover:bg-white/10 transition-colors"
          >
            Login
          </Link>
          <Link
            to="/role-dialog"
            className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
          >
            Register
          </Link>
        </div>
      );
    }

    // Show role-based links for authenticated users
    const roleBasedLinks = {
      user: { to: "/profile", text: "Profile" },
      landlord_verified: { to: "/dashboard", text: "Dashboard" },
      landlord_unverified: {
        to: "/verification",
        text: "Complete Verification",
      },
      admin: { to: "/admin-dashboard", text: "Admin Dashboard" },
    };

    const linkConfig = user?.role
      ? roleBasedLinks[user.role]
      : roleBasedLinks.user;

    return (
      <div className="space-x-4">
        <Link
          to={linkConfig.to}
          className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
        >
          {linkConfig.text}
        </Link>
      </div>
    );
  };

  return (
    <nav className="bg-black/80 backdrop-blur-2xl text-white p-4 fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">
          Your Logo
        </Link>
        {getAuthContent()}
      </div>
    </nav>
  );
};

export default Navbar;
