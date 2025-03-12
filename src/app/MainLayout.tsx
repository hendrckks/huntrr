import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/navigation/Sidebar";
import ScrollToTop from "../components/ScrollToTop";
import { useTheme } from "../contexts/ThemeContext";
import BreadcrumbNav from "../components/navigation/BreadcrumbNav";
import { Moon, Sun } from "lucide-react";
import FilterModal from "../components/FilterModal";

const MainLayout: React.FC = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const hideNavbarPaths = [
    "/login",
    "/reset-password",
    "/signup",
    "/admin",
    "/role-dialog",
    "/Admin",
    "/auth",
    "/verify-email",
    "/forgot-password",
    "/admin-login",
    "/signin"
  ];
  const shouldHideNavbar = hideNavbarPaths.includes(location.pathname);
  const isHomePage = location.pathname === "/";

  return (
    <div className="flex fixed inset-0 tracking-normal word-spacing-sm bg-black/5 dark:bg-[#171717] font-noto overflow-hidden">
      <ScrollToTop />
      {!shouldHideNavbar && <Sidebar />}
      <div className={`flex-1 flex flex-col font-noto ${!shouldHideNavbar ? 'md:ml-[calc(0.5rem+16rem)]' : ''} ${isHomePage ? 'mt-2' : 'mt-2'} overflow-hidden`}>
        <main className={`flex-1 font-noto tracking-tight p-4 md:p-6 md:mb-2 mb-0 mx-0 ${isHomePage ? 'shadow-lg' : 'bg-white/60 dark:bg-[#121212] shadow-lg backdrop-blur-3xl'} bg-white/60 dark:bg-[#121212] rounded-xl overflow-y-auto h-[calc(100vh-1rem)] pb-20 md:pb-6`}>
          {!shouldHideNavbar && (
            <div className="flex mx-auto max-w-7xl justify-between items-center md:px-4 md:mb-6 gap-4">
              <div className="flex items-center">
                <BreadcrumbNav />
              </div>
              <div className="flex items-center gap-4">
                {isHomePage && <FilterModal />}
                <button
                  onClick={toggleTheme}
                  className="md:hidden p-2 dark:bg-white/5 bg-background/40 dark:hover:bg-white/10 hover:bg-black/5 dark:border-white/10 rounded-lg shadow-md backdrop-blur-3xl transition-colors flex items-center justify-center"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </button>
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
