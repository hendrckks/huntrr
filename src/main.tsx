import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router";
import { Toaster } from "./components/toast/Toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="antialiased bg-background font-clash">
        <RouterProvider router={router} />
        <Toaster />
      </div>
    </QueryClientProvider>
  </React.StrictMode>
);
