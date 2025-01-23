import { Link } from "react-router-dom";

const TenantDashboard = () => {
  return <Link to="/edit-account" className="p-10 text-xl font-semibold"><div className="p-4 border rounded-md w-fit">Edit Account</div></Link>;
};

export default TenantDashboard;
