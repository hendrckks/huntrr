import { useNavigate } from "react-router-dom";
import { User, Home, LogIn } from "lucide-react";

// Import shadcn components
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardContent } from "../components/ui/card";

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
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <h2 className="text-2xl font-medium">Try for free</h2>
          <p className="text-sm text-muted-foreground">
            Please select how you want to continue
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => handleSelection("tenant")}
            className="w-full"
          >
            <User className="h-5 w-5 mr-2" />
            Sign Up as Tenant
          </Button>

          <Button
            onClick={() => handleSelection("landlord")}
            className="w-full"
          >
            <Home className="h-5 w-5 mr-2" />
            Sign Up as Landlord
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-2 bg-background text-muted-foreground">Or</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => handleSelection("login")}
            className="w-full"
          >
            <LogIn className="h-5 w-5 mr-2" />
            Login to your account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleSelectionDialog; 