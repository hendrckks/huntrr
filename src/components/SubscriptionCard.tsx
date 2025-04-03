import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Building, Search, Stars } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "../hooks/useToast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { RiPulseAiLine } from "@remixicon/react";
import AffordabilityModal from "./AffordabilityModal";

const SubscriptionCard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const addListingClick = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create listings",
        variant: "warning",
        duration: 5000,
      });
      navigate("/login");
      return;
    }

    if (user.role === "landlord_unverified") {
      navigate("/verify-documents");
      toast({
        title: "Verification Required",
        description: "You need to verify your account before creating listings",
        variant: "warning",
        duration: 5000,
      });
    } else {
      navigate("/add-listing");
    }
  };

  return (
    <TooltipProvider>
      <div className="rounded-xl col-span-2 h-full min-h-80 bg-card text-card-foreground relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-0 shadow-xl">
        <div className="absolute inset-0 shadow-md">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-purple-500/20 blur-[100px] rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-500/20 via-blue-500/20 to-sky-500/20 blur-[100px] rounded-full"></div>
        </div>

        {/* Content Container */}
        <div className="relative z-10 p-8 text-white h-full">
          <div className="mb-6 flex gap-3">
            <Badge className="bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary hover:bg-secondary/80 bg-gradient-to-r from-blue-500 to-indigo-500 border-0">
              <Stars className="mr-1 h-4 w-4" /> Exclusive Listings
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="border-slate-400 py-1 inline-flex items-center justify-center whitespace-nowrap text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm rounded-md px-2 bg-white/10 hover:bg-white/20 text-white border-white/20 gap-2 cursor-pointer"
                >
                  Pro enabled
                </Badge>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-black/90 text-white border border-white/10"
              >
                Features like individual properties analytics are only
                accessible to pro users
              </TooltipContent>
            </Tooltip>
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight">
            List Your Properties
          </h1>

          <p className="mb-12 tracking-tight max-w-xl text-slate-300 text-lg">
            Connect with quality tenants faster. Create, manage, and promote
            your rental properties all in one place with better results.
          </p>

          <div className="mb-12 md:mb-16 flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
            <Button
              onClick={addListingClick}
              size="lg"
              className="bg-white text-slate-900 hover:bg-slate-200 w-full sm:w-auto"
            >
              <span className="mr-2 text-lg">+</span> Add Your Property
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                document
                  .getElementById("available-properties")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground rounded-md px-4 sm:px-8 bg-white/10 hover:bg-white/20 text-white border-white/20 gap-2 w-full sm:w-auto"
            >
              <Search className="mr-2 h-5 w-5" /> View Properties
            </Button>
            <div className="block md:hidden w-full">
              <AffordabilityModal />
            </div>
          </div>

          <div className="flex flex-col space-y-4 border-t border-slate-700 pt-6 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="flex items-center text-sm text-slate-300">
              <Building className="mr-2 h-5 w-5 text-emerald-400" />
              <span className="mr-2">Properties Listed</span>
              <span className="font-bold text-emerald-400">2+</span>
            </div>
            <div className="flex items-center text-sm text-slate-300">
              <RiPulseAiLine className="mr-2 h-5 w-5 text-blue-400" />
              <span className="mr-2">Occupancy Rate</span>
              <span className="font-bold text-blue-400">95%</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default SubscriptionCard;
