import { Link, useNavigate } from "react-router-dom";
import { toast } from "../../hooks/useToast";
import { signOut } from "../../lib/firebase/auth";

const LandlordDashboard = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
      toast({
        title: "",
        variant: "success",
        description: "Sign out successful",
        duration: 5000,
      });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="p-10 py-20 text-2xl font-semibold">
      <div>Dashboard</div>
      <Link to="/edit-account" className="mt-4 text-xl">
        <div className="p-4 mt-4 border rounded-md w-fit">Edit Account</div>
      </Link>
      <div className="mt-8">
        <button
          onClick={handleSignOut}
          className="bg-gradient-to-b text-sm from-[#637257] to-[#4b5942] text-textWhite py-2 px-4 rounded"
        >
          Sign out
        </button>
        <Link to="/add-listing" className="mt-4 text-xl">
          <div className="p-4 mt-4 border rounded-md w-fit">add listing</div>
        </Link>
      </div>
    </div>
  );
};

export default LandlordDashboard;
