import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { signOut } from "../../lib/firebase/auth";
import { toast } from "../../hooks/useToast";

const TenantDashboard = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
      toast({
        title: "",
        variant: "success",
        description: "Admin Sign Out successful",
        duration: 5000,
      });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div>
      <Link to="/edit-account" className="p-10 text-xl font-semibold">
        <div className="p-4 border rounded-md w-fit">Edit Account</div>
      </Link>
      <div className="mt-8">
        <button
          onClick={handleSignOut}
          className="bg-gradient-to-b text-sm from-[#637257] to-[#4b5942] text-textWhite py-2 px-4 rounded"
        >
          Signout
        </button>
      </div>
    </div>
  );
};

export default TenantDashboard;
