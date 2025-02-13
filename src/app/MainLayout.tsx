import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/navigation/Sidebar";
import ScrollToTop from "../components/ScrollToTop";
import { useTheme } from "../contexts/ThemeContext";
import BreadcrumbNav from "../components/navigation/BreadcrumbNav";
import { Moon, Sun } from "lucide-react";

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

  return (
    <div className="flex fixed inset-0 tracking-wide word-spacing-sm bg-black/5 dark:bg-[#121212] font-clash overflow-hidden">
      <ScrollToTop />
      {!shouldHideNavbar && <Sidebar />}
      <div className={`flex-1 flex flex-col ${!shouldHideNavbar ? 'md:ml-[calc(0.5rem+16rem)]' : ''} mt-2 overflow-hidden`}>
        <main className="flex-1 font-clash tracking-normal p-4 md:p-6 mb-2 mx-2 bg-white/60 dark:bg-[#171717] shadow-lg backdrop-blur-3xl rounded-xl overflow-y-auto h-[calc(100vh-1rem)] pb-20 md:pb-6">
          {!shouldHideNavbar && (
            <div className="flex justify-between items-center mb-4 md:mb-0">
              <BreadcrumbNav />
              <button
                onClick={toggleTheme}
                className="md:hidden p-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
