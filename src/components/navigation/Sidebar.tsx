import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CreditCard,
  PieChart,
  Moon,
  Sun,
  HomeIcon,
  Bell,
  Bookmark,
  Search,
  Settings,
  User,
  LogOut,
  MoreHorizontal,
  HousePlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { signOut } from "../../lib/firebase/auth";

const Sidebar = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navItems = [
    { icon: HomeIcon, label: "Home", path: "/" },
    { icon: Bell, label: "Notifications", path: "/accounts" },
    { icon: CreditCard, label: "Cards", path: "/cards" },
    { icon: Bookmark, label: "Bookmarks", path: "/transactions" },
    { icon: PieChart, label: "Spend Groups", path: "/spend-groups" },
    {
      icon: User,
      label: "Profile",
      path:
        user?.role === "admin"
          ? "/admin-dashboard"
          : user?.role === "landlord_verified" ||
            user?.role === "landlord_unverified"
          ? "/dashboard"
          : "/profile",
    },
    { icon: HousePlus, label: "List your property", path: "/insights" },
    { icon: Settings, label: "Settings & privacy", path: "/invoices" },
  ];

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="w-auto bg-[#121212] text-foreground h-[calc(100vh-1rem)] ml-2 fixed left-0 top-0 p-4 mt-2 mr-2 flex flex-col overflow-y-auto">
      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Explore"
            className="w-full bg-white/5 text-sm text-foreground pl-10 pr-4 py-2 rounded-lg border border-white/10 focus:outline-none focus:ring-1 focus:ring-white/20 hover:bg-white/10 transition-colors"
          />
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? "bg-white/10 shadow-lg" : "hover:bg-white/5"}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile Section with Theme Toggle */}
      <div className="border-t border-white/10 pt-4 mt-4 text-sm">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between py-2 rounded-lg transition-colors">
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-white/10 rounded animate-pulse" />
                </div>
              </div>
            ) : (
              <>
                <Avatar className="h-10 w-10 mr-2">
                  <AvatarImage src={user?.photoURL || ""} />
                  <AvatarFallback>
                    {user?.displayName ? getInitials(user.displayName) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-sm">
                    {user?.displayName || "User Name"}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                    {user?.email || "user@email.com"}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="hover:bg-white/10 p-2 rounded-full transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[232px] mt-3">
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="text-red-500 focus:text-red-500"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
          <button
            className="flex items-center justify-between hover:bg-white/5 px-4 py-2 rounded-lg transition-colors"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <span className="text-sm">
              {theme === "dark" ? "Dark Mode" : "Light Mode"}
            </span>
            {theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
