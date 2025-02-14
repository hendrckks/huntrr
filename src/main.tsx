import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router";
import { Toaster } from "./components/toast/Toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { BookmarkProvider } from "./contexts/BookmarkContext";
import { ThemeProvider } from "./contexts/ThemeContext";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BookmarkProvider>
          <ThemeProvider>
            <div className="antialiased bg-background font-sans">
              <RouterProvider router={router} />
              <Toaster />
            </div>
          </ThemeProvider>
        </BookmarkProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
