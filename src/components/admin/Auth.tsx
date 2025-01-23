import type React from "react";
import AdminAuthFlow from "./AdminAuthFlow";

const AdminAuthPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-2xl">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Admin Authentication
        </h1>
        <AdminAuthFlow />
      </div>
    </div>
  );
};

export default AdminAuthPage;
