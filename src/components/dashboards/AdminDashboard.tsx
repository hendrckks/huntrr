import { Link, useNavigate } from "react-router-dom";
import { signOut } from "../../lib/firebase/auth";
import { toast } from "../../hooks/useToast";

const AdminDashboard = () => {
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
    <div className="p-10 text-3xl text-black">
      AdminDashboard
      <div className="mt-8">
        <button
          onClick={handleSignOut}
          className="bg-gradient-to-b text-sm from-[#637257] to-[#4b5942] text-textWhite py-2 px-4 rounded"
        >
          Sign Out
        </button>
        <Link
          to="/add-listing"
          className="bg-gradient-to-b text-sm from-[#637257] to-[#4b5942] text-textWhite py-2 px-4 rounded"
        >
          Add Listing
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
