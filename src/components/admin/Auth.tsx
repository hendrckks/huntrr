import type React from "react";
import AdminAuthFlow from "./AdminAuthFlow";

const AdminAuthPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-background p-8 rounded-lg shadow-md w-full">
        <AdminAuthFlow />
      </div>
    </div>
  );
};

export default AdminAuthPage;
