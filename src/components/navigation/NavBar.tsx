import { useAuth } from "../../contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import type { User, UserRole } from "../../lib/types/auth";

const Navbar = () => {
  const { user, isLoading, isInitialized } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [effectiveUser, setEffectiveUser] = useState<User | null>(null);
  const location = useLocation();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Update effective user when auth user changes
    if (user) {
      setEffectiveUser(user);
    } else {
      // Check session storage for valid session
      const sessionExpiration = sessionStorage.getItem("sessionExpiration");
      const cachedUser = localStorage.getItem("user");
      
      if (sessionExpiration && Date.now() < parseInt(sessionExpiration) && cachedUser) {
        setEffectiveUser(JSON.parse(cachedUser));
      } else {
        setEffectiveUser(null);
      }
    }
  }, [user]);

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = () => {
      const sessionExpiration = sessionStorage.getItem("sessionExpiration");
      const cachedUser = localStorage.getItem("user");
      
      if (!sessionExpiration || !cachedUser || Date.now() > parseInt(sessionExpiration)) {
        setEffectiveUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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
            to="/signup-dialog"
            className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
          >
            Register
          </Link>
        </div>
      );
    }

    // Updated role-based links mapping with proper typing
    const roleBasedLinks: Record<UserRole, { to: string; text: string }> = {
      user: { to: "/profile", text: "Profile" },
      landlord_verified: { to: "/dashboard", text: "Dashboard" },
      landlord_unverified: { to: "/dashboard", text: "Profile" },
      admin: { to: "/admin-dashboard", text: "Admin Dashboard" },
    };

    const linkConfig = effectiveUser?.role
      ? roleBasedLinks[effectiveUser.role]
      : roleBasedLinks.user;

    const getInitials = (name: string | null | undefined) => {
      if (!name) return '?';
      return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    const initials = getInitials(effectiveUser?.displayName);

    return (
      <div className="space-x-4">
        <Link to={linkConfig.to}>
          {effectiveUser?.photoURL ? (
            <img
              src={effectiveUser.photoURL}
              alt="User Avatar"
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-base font-medium">
              {initials}
            </div>
          )}
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
