import React from "react";
import { Outlet, useLocation } from "react-router-dom";
// import Navbar from "../components/navigation/NavBar";
import Sidebar from "../components/navigation/Sidebar";
import ScrollToTop from "../components/ScrollToTop";
import { ThemeProvider } from "../contexts/ThemeContext";

const MainLayout: React.FC = () => {
  const location = useLocation();
  const hideNavbarPaths = [
    "/login",
    "/reset-password",
    "/signup",
    "/admin",
    "/role-dialog",
    "/Admin",
  ];
  const shouldHideNavbar = hideNavbarPaths.includes(location.pathname);

  return (
    <ThemeProvider>
      <div className="min-h-screen flex tracking-wide word-spacing-sm font-clash">
        <ScrollToTop />
        {!shouldHideNavbar && <Sidebar />}
        <div className="flex-1 flex flex-col ml-64">
          {/* {!shouldHideNavbar && <Navbar />} */}
          <main className="flex-1 font-clash tracking-normal p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default MainLayout;
