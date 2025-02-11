import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/navigation/Sidebar";
import ScrollToTop from "../components/ScrollToTop";
import { ThemeProvider } from "../contexts/ThemeContext";
import BreadcrumbNav from "../components/navigation/BreadcrumbNav";

const MainLayout: React.FC = () => {
  const location = useLocation();
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
    <ThemeProvider>
      <div className="flex fixed inset-0 tracking-wide word-spacing-sm bg-black/5 dark:bg-[#121212] font-clash overflow-hidden">
        <ScrollToTop />
        {!shouldHideNavbar && <Sidebar />}
        <div className={`flex-1 flex flex-col ${!shouldHideNavbar ? 'ml-[calc(0.5rem+16rem)]' : ''} mt-2 overflow-hidden`}>
          <main className="flex-1 font-clash tracking-normal p-6 mb-2 mx-2 bg-white/60 dark:bg-[#171717] shadow-lg backdrop-blur-3xl rounded-xl overflow-y-auto h-[calc(100vh-1rem)]">
            {!shouldHideNavbar && <BreadcrumbNav />}
            <Outlet />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default MainLayout;
