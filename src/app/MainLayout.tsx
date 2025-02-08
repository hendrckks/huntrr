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
      <div className="flex h-screen tracking-wide word-spacing-sm bg-[#121212] font-clash overflow-auto">
        <ScrollToTop />
        {!shouldHideNavbar && <Sidebar />}
        <div className={`flex-1 flex flex-col min-h-0 ${!shouldHideNavbar ? 'ml-[calc(0.5rem+16rem)]' : ''} mt-2`}>
          <main className="flex-1 font-clash tracking-normal p-6 mb-2 mx-2 bg-[#171717] shadow-lg rounded-xl overflow-y-auto">
            {!shouldHideNavbar && <BreadcrumbNav />}
            <Outlet />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default MainLayout;
