import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/navigation/Sidebar";
import ScrollToTop from "../components/ScrollToTop";
import { useTheme } from "../contexts/ThemeContext";
import BreadcrumbNav from "../components/navigation/BreadcrumbNav";
import { Moon, Sun } from "lucide-react";
import FilterModal from "../components/FilterModal";
import AffordabilityModal from "../components/AffordabilityModal";
import PresenceHandler from "../components/PresenceHandler";
import { useAuth } from "../contexts/AuthContext";
import CookieBanner from "../components/CookieBanner";

const MainLayout: React.FC = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const hideNavbarPaths = [
    "/login",
    "/reset-password",
    "/signup",
    "/admin",
    "/signup-dialog",
    "/Admin",
    "/auth",
    "/verify-email",
    "/forgot-password",
    "/admin-login",
    "/signin",
  ];
  const shouldHideNavbar = hideNavbarPaths.includes(location.pathname);
  const isHomePage = location.pathname === "/";
  const isChatsRoute = location.pathname === "/chats";
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex fixed inset-0 tracking-normal word-spacing-sm bg-black/5 dark:bg-black/50 font-noto overflow-hidden">
      <CookieBanner />
      {isAuthenticated && <PresenceHandler />}
      <ScrollToTop />
      {!shouldHideNavbar && <Sidebar />}
      <div
        className={`flex-1 flex flex-col font-noto ${
          !shouldHideNavbar ? "md:ml-[calc(0.5rem+16rem)]" : ""
        } ${isHomePage ? "md:mt-2" : "md:mt-2"} overflow-hidden md:mx-2`}
      >
        <main
          className={`flex-1 font-inter tracking-tight p-4 md:p-6 md:mb-2 mb-0 -mx-5 md:mx-0 ${
            isHomePage
              ? "shadow-lg"
              : "bg-white/60 dark:bg-[#111111]  shadow-lg backdrop-blur-3xl"
          } bg-white/60 dark:bg-[#121212] rounded-xl border dark:border-white/5 border-black/10 overflow-y-auto h-[calc(100vh-1rem)] pb-20 md:pb-6`}
        >
          {!shouldHideNavbar && (
            <div className="flex mx-auto max-w-7xl justify-between items-center px-2 md:mb-6 gap-4">
              <div className="flex items-center">
                <BreadcrumbNav />
              </div>
              <div className="flex items-center gap-4">
                {isHomePage && (
                  <div className="flex gap-2">
                    <div className="hidden md:block">
                      <AffordabilityModal />
                    </div>
                    <FilterModal />
                  </div>
                )}
                {!isChatsRoute && (
                  <button
                    onClick={toggleTheme}
                    className="md:hidden p-2 dark:bg-white/5 bg-background/40 dark:hover:bg-white/10 hover:bg-black/5 dark:border-white/10 border border-black/5 rounded-lg md:shadow-lg shadow-md backdrop-blur-6xl transition-colors flex items-center justify-center"
                    aria-label="Toggle theme"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <Moon className="h-5 w-5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
