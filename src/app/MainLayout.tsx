import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/navigation/NavBar";
import ScrollToTop from "../components/ScrollToTop";

const MainLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
