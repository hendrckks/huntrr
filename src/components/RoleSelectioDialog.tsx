import { useNavigate } from "react-router-dom";
import { User, Home, LogIn } from "lucide-react";

const RoleSelectionDialog = () => {
  const navigate = useNavigate();

  const handleSelection = (type: "tenant" | "landlord" | "login") => {
    if (type === "login") {
      navigate("/login");
      return;
    }

    navigate("/signup", {
      state: {
        userType: type,
        role: type === "tenant" ? "user" : "landlord_unverified",
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Welcome</h2>
          <p className="mt-2 text-gray-600">
            Please select how you want to continue
          </p>
        </div>

        <div className="space-y-4 mt-8">
          <button
            onClick={() => handleSelection("tenant")}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-b from-[#637257] to-[#4b5942] hover:from-[#4b5942] hover:to-[#3c4735] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#637257]"
          >
            <User className="h-5 w-5" />
            Sign Up as Tenant
          </button>

          <button
            onClick={() => handleSelection("landlord")}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-b from-[#637257] to-[#4b5942] hover:from-[#4b5942] hover:to-[#3c4735] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#637257]"
          >
            <Home className="h-5 w-5" />
            Sign Up as Landlord
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or</span>
            </div>
          </div>

          <button
            onClick={() => handleSelection("login")}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#637257]"
          >
            <LogIn className="h-5 w-5" />
            Login to your account
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelectionDialog;
