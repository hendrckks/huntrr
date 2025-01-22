// Navbar.tsx
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";
import { getUserClaims, UserClaims } from "../../utils/authUtils";
import { getAuth } from "firebase/auth";

const Navbar = () => {
  const { isAuthenticated } = useAuth();
  const [claims, setClaims] = useState<UserClaims | null>(null);
  const [claimsLoaded, setClaimsLoaded] = useState(false);
  const auth = getAuth();

  useEffect(() => {
    const fetchClaims = async () => {
      if (auth.currentUser) {
        try {
          const userClaims = await getUserClaims(auth.currentUser);
          setClaims(userClaims);
        } catch (error) {
          console.error("Error fetching claims:", error);
        } finally {
          setClaimsLoaded(true);
        }
      } else {
        setClaimsLoaded(true);
      }
    };

    fetchClaims();
  }, [auth.currentUser]);

  const renderAuthButton = () => {
    if (!isAuthenticated() || !claimsLoaded) {
      return (
        <Link
          to="/role-dialog"
          className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
        >
          Register
        </Link>
      );
    }

    // For debugging - remove in production
    console.log("Current claims:", claims);

    // Show different buttons based on user role
    if (claims?.role === "user") {
      return (
        <Link
          to="/profile"
          className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
        >
          Profile
        </Link>
      );
    }

    if (
      claims?.role === "landlord_verified" ||
      claims?.role === "landlord_unverified"
    ) {
      return (
        <Link
          to="/dashboard"
          className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
        >
          Dashboard
        </Link>
      );
    }

    // Default button if no role matches
    return (
      <Link
        to="/"
        className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
      >
        Home
      </Link>
    );
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
