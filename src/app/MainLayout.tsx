import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/navigation/NavBar";
import ScrollToTop from "../components/ScrollToTop";

const MainLayout: React.FC = () => {
  const location = useLocation();
  const hideNavbarPaths = ["/login", "/reset-password", "/signup", "/admin", "/role-dialog", "/Admin"];
  const shouldHideNavbar = hideNavbarPaths.includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      {!shouldHideNavbar && <Navbar />}
      <main className="flex-1 py-20">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
