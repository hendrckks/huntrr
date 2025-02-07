import { useAuth } from "../../contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

const Navbar = () => {
  const { user, isLoading, isInitialized } = useAuth();
  const [mounted, setMounted] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything until after first mount to prevent hydration mismatch
  if (!mounted || !isInitialized) return null;

  // Hide Navbar on protected routes; use startsWith to catch nested routes
  const hiddenPaths = ["/profile", "/dashboard", "/admin-dashboard", "/add-listing", "/edit-account"];
  if (hiddenPaths.some(path => location.pathname.startsWith(path))) return null;

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

    // Determine effective user from auth context or session storage
    let effectiveUser = user;
    if (!effectiveUser && typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('user');
      if (stored) {
        effectiveUser = JSON.parse(stored);
      }
    }

    // Show login/register for unauthenticated users
    if (!effectiveUser) {
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

    // Updated role-based links mapping
    const roleBasedLinks = {
      user: { to: "/profile", text: "Profile" },
      landlord_verified: { to: "/dashboard", text: "Dashboard" },
      landlord_unverified: { to: "/dashboard", text: "Profile" },
      admin: { to: "/admin-dashboard", text: "Admin Dashboard" },
    };

    const linkConfig = effectiveUser?.role
      ? roleBasedLinks[effectiveUser.role]
      : roleBasedLinks.user;

    return (
      <div className="space-x-4">
        <Link to={linkConfig.to}>
          <img
            src={effectiveUser?.photoURL || "/default-avatar.png"}
            alt="User Avatar"
            className="w-8 h-8 rounded-full"
            onError={(e) => { e.currentTarget.src = '/default-avatar.png'; }}
          />
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
