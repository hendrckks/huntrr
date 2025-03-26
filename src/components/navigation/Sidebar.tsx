import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Moon,
  Sun,
  HomeIcon,
  Bell,
  Bookmark,
  Settings,
  User,
  LogOut,
  MoreHorizontal,
  PlusIcon as HousePlus,
  HelpCircle,
  FileCheck,
  MessageCircle,
} from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase/clientApp";
import { normalizeNotificationDate } from "../../lib/utils/NotificationUtils";
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
import { useToast } from "../../hooks/useToast";
import { signOut } from "../../lib/firebase/auth";
import { useEffect, useState } from "react";
import type { BaseNotification } from "../../lib/utils/NotificationUtils";
// type NavItem = {
//   icon: LucideIcon;
//   label: string;
//   path: string;
//   badge?: number;
// };

const Sidebar = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, isLoading, setUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<BaseNotification[]>([]);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.uid) {
      fetchNotifications();
    }
  }, [user?.uid]);

  // Add this in the Sidebar component's useEffect
  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent) => {
      if (event.detail?.photoURL) {
        // First, get the current user data from session storage
        const sessionUser = sessionStorage.getItem("user");

        if (sessionUser) {
          try {
            // Parse the current user data
            const userData = JSON.parse(sessionUser);

            // Update the photoURL with the new one
            userData.photoURL = event.detail.photoURL;

            // Update session and local storage
            sessionStorage.setItem("user", JSON.stringify(userData));
            localStorage.setItem("user", JSON.stringify(userData));

            // Update the Auth context state
            setUser(userData);

            // Force reload the current user's image
            const avatarImage = document.querySelector(
              ".Avatar .AvatarImage"
            ) as HTMLImageElement;
            if (avatarImage) {
              // Add timestamp to bypass cache
              avatarImage.src = `${event.detail.photoURL}&_=${Date.now()}`;
            }
          } catch (error) {
            console.error("Error updating profile image in session:", error);
          }
        }
      }
    };

    window.addEventListener(
      "profileImageUpdated",
      handleProfileUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        "profileImageUpdated",
        handleProfileUpdate as EventListener
      );
    };
  }, [setUser]); // Make sure to include setUser in the dependency array

  const fetchNotifications = async () => {
    try {
      let allNotifs = [];

      const baseQuery = query(
        collection(db, "notifications"),
        where("userId", "==", user?.uid)
      );

      const landlordQuery = query(
        collection(db, "notifications"),
        where("landlordId", "==", user?.uid)
      );

      const [userSnapshot, landlordSnapshot] = await Promise.all([
        getDocs(baseQuery),
        getDocs(landlordQuery),
      ]);

      allNotifs = [...userSnapshot.docs, ...landlordSnapshot.docs].map((doc) =>
        normalizeNotificationDate({
          ...doc.data(),
          id: doc.id,
        })
      );

      // Only fetch admin notifications if user is admin
      if (user?.role === "admin") {
        const adminQuery = query(
          collection(db, "adminNotifications"),
          where("read", "==", false)
        );
        const adminSnapshot = await getDocs(adminQuery);
        const adminNotifs = adminSnapshot.docs.map((doc) =>
          normalizeNotificationDate({
            ...doc.data(),
            id: doc.id,
            type: doc.data().type || "admin_notification",
            message: doc.data().message || "New admin notification",
          })
        );
        allNotifs = [...allNotifs, ...adminNotifs];
      }

      setNotifications(allNotifs);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem("user");
      sessionStorage.clear();
      await signOut();
      setUser(null);
      navigate("/");
      toast({
        title: "",
        variant: "success",
        description: "Sign out successful",
        duration: 5000,
      });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navItems = [
    { icon: HomeIcon, label: "Home", path: "/", color: "text-blue-400/90" },
    {
      icon: User,
      label: "Dashboard",
      path:
        user?.role === "admin"
          ? "/admin-dashboard"
          : user?.role === "landlord_verified" ||
            user?.role === "landlord_unverified"
          ? "/dashboard"
          : "/profile",
      color: "text-pink-400/70",
    },
    user?.role === "landlord_unverified"
      ? {
          icon: FileCheck,
          label: "Verify Documents",
          path: "/verify-documents",
          color: "text-orange-400/70",
        }
      : null,
    {
      icon: MessageCircle,
      label: "Chats",
      path: "/chats",
      color: "text-violet-400/90",
      onClick: () => {
        if (!isAuthenticated) {
          navigate("/login");
          toast({
            title: "Error",
            variant: "error",
            description: "Please login to chat with the owners",
            duration: 5000,
          });
          return;
        }
        return true;
      },
    },
    {
      icon: Bell,
      label: "Notifications",
      path: "/notifications",
      color: "text-yellow-400/90",
      badge:
        notifications.filter((n) => !n.read).length > 0 ||
        (user?.role === "admin" &&
          notifications.filter((n) => !n.read).length > 0),
    },
    {
      icon: Bookmark,
      label: "Bookmarks",
      path: "/bookmarks",
      color: "text-pink-400/70",
    },
    user?.role === "admin" || user?.role === "landlord_verified"
      ? {
          icon: HousePlus,
          label: "List your property",
          path: "/add-listing",
          color: "text-purple-400/90",
        }
      : null,

    {
      icon: Settings,
      label: "Settings & privacy",
      path: "/account-settings",
      color: "text-teal-400/90",
    },
    {
      icon: HelpCircle,
      label: "Help & support",
      path: "/spend-groups",
      color: "text-indigo-400/90",
    },
  ].filter((item): item is Exclude<typeof item, null> => item !== null);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-transparent text-foreground h-[calc(100vh-1rem)] ml-2 fixed left-0 top-0 p-4 mt-4 mr-2 flex-col overflow-y-auto">
        {/* Logo Section */}
        <Link to="/" className="flex items-center h-10 w-10 mb-6 gap-2 ">
          <img
            src={theme === "dark" ? "/hlogo.png" : "/hlogo.png"}
            alt="Huntrr Logo"
            className="w-fit h-full -p-8 rounded-lg border bg-black/2 border-black/30 dark:border-white/20 backdrop-blur-3xl shadow-md"
          />
          <span className="text-lg font-medium tracking-tight mt-1">
            Huntrr
            <span className="text-[10px] px-2 py-0.5 ml-2 rounded-sm bg-[#8752f3]/20 font-medium">
              beta
            </span>
          </span>
        </Link>

        {/* Navigation Items */}
        <p className="py-4 text-sm font-medium dark:text-white/70">General</p>
        <nav className="flex-1 space-y-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-black/90 dark:bg-white/90 shadow-xs dark:text-black text-white"
                    : "dark:hover:bg-white/5 hover:bg-black/5 dark:text-white/80 text-[#4b5563]"
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 ${
                      isActive
                        ? "text-[#8752f3]/80 dark:text-[#8752f3]"
                        : `${item.color}`
                    }`}
                  />
                  {item.badge && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </div>
                <span className="text-base font-medium tracking-normal">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile Section with Theme Toggle */}
        <div className="border-t dark:border-white/10 border-black/10 pt-4 mt-4 text-sm">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center  justify-between py-2 rounded-lg transition-colors">
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
                  <Avatar className="h-12 w-12 mr-2 border dark:border-white/10 border-black/15">
                    <AvatarImage
                      src={user?.photoURL || ""}
                      className="object-cover w-full h-full"
                    />
                    <AvatarFallback>
                      {user?.displayName ? getInitials(user.displayName) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium">
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
              className="flex items-center justify-between bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 px-4 py-2 rounded-lg transition-colors"
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

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#121212] backdrop-blur-lg border-t dark:border-white/10 border-black/10 p-2 z-50 overflow-x-auto">
        <nav className="flex items-center justify-between space-x-2 px-2 min-w-max">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-white border bg-background/50 font-medium dark:hover:bg-white/10 dark:border-white/10 p-3 rounded-lg md:shadow-lg shadow-md backdrop-blur-6xl hover:bg-black/5 transition-colors backdrop-blur-6xl w-full flex justify-between items-center dark:bg-white/5 text-black dark:text-white backdrop-blur-6xl"
                    : "hover:bg-gray-100 dark:hover:bg-white/5 text-black/80 dark:text-white/80"
                }`}
              >
                <div className="relative z-10">
                  <Icon
                    className={`w-5 h-5 ${
                      isActive
                        ? "text-[#8752f3]"
                        : `${item.color} dark:${item.color}`
                    }`}
                  />
                  {item.badge && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </div>
                <span className="text-[15px] tracking-tight whitespace-nowrap z-10">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
