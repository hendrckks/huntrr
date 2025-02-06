import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router";
import { Toaster } from "./components/toast/Toaster";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="antialiased min-h-screen bg-background font-clash">
      <RouterProvider router={router} />
      <Toaster />
    </div>
  </React.StrictMode>
);
