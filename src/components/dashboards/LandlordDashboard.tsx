import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getLandlordListings,
  updateListingStatus,
} from "../../lib/firebase/firestore";
import { signOut } from "../../lib/firebase/auth";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Badge } from "../../components/ui/badge";
import { ScrollArea } from "../../components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import AnalyticsTab from "./AnalyticsTab";
import type { ListingDocument, ListingStatus } from "../../lib/types/Listing";
import { getMultipleListingsAnalytics } from "../../lib/firebase/analytics";
import { rejectionReasons } from "../dialogs/RejectionDialog";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase/clientApp";
import type { ListingAnalytics } from "../../lib/types/Analytics";

interface ListingCardProps {
  listing: ListingDocument;
}

const LandlordDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedListing, setSelectedListing] = React.useState<string | null>(
    null
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = React.useState<string>(() =>
    searchParams.get("tab") ||
    localStorage.getItem("landlordDashboardTab") ||
    "published"
  );

  React.useEffect(() => {
    try {
      localStorage.setItem("landlordDashboardTab", activeTab);
    } catch (e) {
      void e;
    }
    const params = Object.fromEntries(searchParams.entries());
    params.tab = activeTab;
    setSearchParams(params, { replace: true });
  }, [activeTab]);

  React.useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  // Fetch all listings for the landlord
  const {
    data: listings = [],
    isLoading,
    refetch,
    error,
  } = useQuery<ListingDocument[]>({
    queryKey: ["landlord-listings"],
    queryFn: async () => {
      try {
        if (!user?.uid) throw new Error("User not authenticated");
        return await getLandlordListings(user.uid);
      } catch (error) {
        console.error("Fetch error:", error);
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  const analyticsQuery = useQuery<ListingAnalytics[]>({
    queryKey: ["listings-analytics", listings.map((l) => l.id)],
    queryFn: async () => {
      // console.log(
      //   "Fetching analytics for listings:",
      //   listings.map((l) => l.id)
      // );
      try {
        const result = await getMultipleListingsAnalytics(
          listings.map((l) => l.id)
        );
        // console.log("Fetched analytics result:", result);
        return result;
      } catch (error) {
        console.error("Error fetching analytics:", error);
        throw error;
      }
    },
    enabled: listings.length > 0,
    retry: 3,
    retryDelay: 1000,
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
      toast({
        title: "Success",
        description: "Sign out successful",
        variant: "success",
      });
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "error",
      });
    }
  };

  const handleArchive = async (listingId: string) => {
    try {
      const listingRef = doc(db, "listings", listingId);
      const listingDoc = await getDoc(listingRef);
      const currentStatus = listingDoc.data()?.status;

      await updateDoc(listingRef, {
        status: "archived",
        previousStatus: currentStatus,
        archivedAt: new Date(),
      });

      refetch();
      toast({
        title: "Success",
        description: "Listing archived successfully",
        variant: "success",
        duration: 5000,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to archive listing",
        variant: "error",
        duration: 5000,
      });
    }
  };

  const handleUnarchive = async (listingId: string) => {
    try {
      const listingRef = doc(db, "listings", listingId);
      const listingDoc = await getDoc(listingRef);
      const previousStatus = listingDoc.data()?.previousStatus || "draft";

      await updateDoc(listingRef, {
        status: previousStatus,
        previousStatus: null,
        archivedAt: null,
      });

      refetch();
      toast({
        title: "Success",
        description: "Listing unarchived successfully",
        variant: "success",
        duration: 5000,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to unarchive listing",
        variant: "error",
        duration: 5000,
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedListing) return;

    try {
      await updateListingStatus(selectedListing, "denied");
      setIsDeleteDialogOpen(false);
      setSelectedListing(null);
      refetch();
      toast({
        title: "Success",
        description: "Listing deleted successfully",
        variant: "success",
        duration: 5000,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete listing",
        variant: "error",
        duration: 5000,
      });
    }
  };

  const getStatusBadge = (status: ListingStatus) => {
    const variants = {
      published: "success",
      pending_review: "warning",
      archived: "secondary",
      denied: "destructive",
      draft: "outline",
      recalled: "destructive",
    } as const;

    return (
      <Badge
        className="bg-black/10 dark:bg-white/10 ml-2 py-0.5 shadow-md border border-black/10 dark:border-white/10"
        variant={
          variants[status] as
            | "secondary"
            | "destructive"
            | "outline"
            | "default"
        }
      >
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  // Filter listings by status
  const publishedListings = listings.filter((l) => l.status === "published");
  const pendingListings = listings.filter((l) => l.status === "pending_review");
  const draftListings = listings.filter((l) =>
    ["draft", "denied", "recalled"].includes(l.status)
  );
  const archivedListings = listings.filter((l) => l.status === "archived");

  const ListingCard: React.FC<ListingCardProps> = ({ listing }) => (
    <Card
      key={listing.id}
      className="mb-4 w-full hover:shadow-md dark:bg-white/5 bg-black/5 border-black/5 border dark:border-white/5 cursor-pointer transition-shadow duration-200"
    >
      <CardContent className="pt-6 px-2 sm:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-3 w-full sm:w-auto max-w-[75%]">
            <div className="flex items-start gap-2 flex-wrap">
              <h3 className="font-semibold break-words text-base">
                {listing.title}
              </h3>
              {getStatusBadge(listing.status)}
            </div>
            <p className="text-sm dark:text-white/50 text-black/50 break-words">
              {listing.location.area}, {listing.location.city}
            </p>
            <p className="text-sm break-words">
              ${listing.price.toLocaleString()} /month • {listing.bedrooms} beds
              • {listing.bathrooms} baths
            </p>
            {listing.status === "denied" && listing.rejectionReason && (
              <p className="text-sm text-red-500 break-words">
                Rejection Reason:{" "}
                {rejectionReasons.find(
                  (r) => r.value === listing.rejectionReason
                )?.label || listing.rejectionReason}
              </p>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end items-center">
            {/* View */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="hover:bg-gray-100"
                    onClick={() => navigate(`/listings/${listing.id}`)}
                  >
                    <img src="/icons/eye.svg" alt="" className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-inter">View</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Edit */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="hover:bg-gray-100"
                    onClick={() => navigate(`/edit-listing/${listing.id}`)}
                  >
                    <img src="/icons/pen.svg" alt="" className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-inter">Edit</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Archive/Unarchive */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="hover:bg-gray-100"
                    onClick={() =>
                      listing.status === "archived"
                        ? handleUnarchive(listing.id)
                        : handleArchive(listing.id)
                    }
                  >
                    <img src="/icons/inbox.svg" alt="" className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-inter">
                    {listing.status === "archived" ? "Unarchive" : "Archive"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Delete */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="hover:bg-red-500 bg-red-600"
                    onClick={() => {
                      setSelectedListing(listing.id);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto max-w-7xl sm:px-6 lg:px-3 p-4 md:p-0 space-y-4 md:mt-0 mt-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <img src="/icons/user.svg" alt="" className="h-6 w-6" />
          <h1 className="text-xl font-medium">Landlord Dashboard</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => {
              if (user?.role === "landlord_unverified") {
                navigate("/verify-documents");
                toast({
                  title: "Verification Required",
                  description:
                    "You need to verify your account before creating listings",
                  variant: "warning",
                  duration: 5000,
                });
              } else {
                navigate("/add-listing");
              }
            }}
            className="flex bg-black/90 hover:bg-black/80 hover:text-white dark:bg-white/90 text-white dark:text-black items-center gap-2 shadow-md w-full sm:w-auto justify-center"
          >
            <img src="/icons/duplicate-plus.svg" alt="" className="h-5 w-5" />
            Add Listing
          </Button>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="shadow-md w-full sm:w-auto justify-center"
          >
            Sign Out
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="w-full overflow-x-auto pb-4">
          <TabsList className="bg-black/5 border border-black/5 dark:border-white/5 dark:bg-white/10 w-max md:min-w-fit overflow-auto inline-flex p-1 gap-2">
            <TabsTrigger
              className="flex items-center gap-2 whitespace-nowrap px-4 py-1 data-[state=active]:bg-black/80 dark:data-[state=active]:bg-[#fafafa] dark:data-[state=active]:text-black data-[state=active]:text-white [&[data-state=active]_svg]:text-white dark:[&[data-state=active]_svg]:text-black"
              value="published"
            >
              <img src="/icons/tasks.svg" alt="" className="h-5 w-5" />
              Published
              {publishedListings.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 bg-white/80 text-black dark:bg-black/90 dark:text-white"
                >
                  {publishedListings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="flex items-center gap-2 whitespace-nowrap px-4 py-1 data-[state=active]:bg-black/80 dark:data-[state=active]:bg-[#fafafa] data-[state=active]:text-white dark:data-[state=active]:text-black [&[data-state=active]_svg]:text-white dark:[&[data-state=active]_svg]:text-black"
            >
              <span>
                <img src="/icons/tab-close.svg" alt="" className="h-5 w-5" />
              </span>
              Pending Review
              {pendingListings.length > 0 && (
                <Badge className="ml-2 bg-white/70 text-black dark:bg-black/70 dark:text-white">
                  {pendingListings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="drafts"
              className="flex items-center gap-2 whitespace-nowrap px-4 py-1 data-[state=active]:bg-black/80 dark:data-[state=active]:bg-[#fafafa] data-[state=active]:text-white dark:data-[state=active]:text-black [&[data-state=active]_svg]:text-white dark:[&[data-state=active]_svg]:text-black"
            >
              <span>
                <img src="/icons/folder.svg" alt="" className="h-5 w-5" />
              </span>
              Drafts
              {draftListings.length > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-2 bg-white/70 text-black dark:bg-black/70 dark:text-white"
                >
                  {draftListings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="flex items-center gap-2 whitespace-nowrap px-4 py-1 data-[state=active]:bg-black/80 dark:data-[state=active]:bg-[#fafafa] data-[state=active]:text-white dark:data-[state=active]:text-black [&[data-state=active]_svg]:text-white dark:[&[data-state=active]_svg]:text-black"
            >
              <span>
                <img src="/icons/code-editor.svg" alt="" className="h-5 w-5" />
              </span>
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              className="flex items-center gap-2 whitespace-nowrap px-4 py-1 data-[state=active]:bg-black/80 dark:data-[state=active]:bg-[#fafafa] data-[state=active]:text-white dark:data-[state=active]:text-black [&[data-state=active]_svg]:text-white dark:[&[data-state=active]_svg]:text-black"
            >
              <span>
                <img src="/icons/inbox.svg" alt="" className="h-5 w-5" />
              </span>
              Archived
              {archivedListings.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 bg-white/70 text-black dark:bg-black/70 dark:text-white"
                >
                  {archivedListings.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {isLoading ? (
          <Card className="w-full mt-4">
            <CardContent className="p-6">
              <p className="text-center text-gray-500">Loading listings...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="w-full mt-4">
            <CardContent className="p-6">
              <p className="text-center text-red-500">Error loading listings</p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 space-y-4">
            <TabsContent value="published">
              <Card className="w-full">
                <CardHeader className="p-6">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <img src="/icons/tasks.svg" alt="" className="h-5 w-5" />
                    Published Listings
                  </CardTitle>
                  <CardDescription>
                    Your active listings that are visible to tenants
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4">
                  <ScrollArea className="h-[calc(100vh-24rem)]">
                    {publishedListings.length === 0 ? (
                      <p className="text-center text-gray-500">
                        No published listings
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {publishedListings.map((listing) => (
                          <ListingCard key={listing.id} listing={listing} />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pending">
              <Card className="w-full">
                <CardHeader className="p-6">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <img src="/icons/tab-close.svg" alt="" className="h-5 w-5" />
                    Pending Review
                  </CardTitle>
                  <CardDescription>
                    Listings waiting for admin approval
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4">
                  <ScrollArea className="h-[500px] pr-2 sm:pr-4">
                    {pendingListings.length === 0 ? (
                      <p className="text-center text-gray-500">
                        No pending listings
                      </p>
                    ) : (
                      pendingListings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} />
                      ))
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="drafts">
              <Card className="w-full">
                <CardHeader className="p-6">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <img src="/icons/folder.svg" alt="" className="h-5 w-5" />
                    Drafts
                  </CardTitle>
                  <CardDescription>
                    Saved drafts and rejected listings
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4">
                  <ScrollArea className="h-[500px] -mt-5 pr-2 sm:pr-4">
                    {draftListings.length === 0 ? (
                      <p className="text-center text-gray-500">
                        No draft listings
                      </p>
                    ) : (
                      draftListings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} />
                      ))
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              {isLoading ? (
                <Card className="w-full">
                  <CardContent className="px-4">
                    <p className="text-center text-gray-500">
                      Loading analytics...
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <AnalyticsTab
                  listings={listings}
                  analyticsQuery={analyticsQuery}
                />
              )}
            </TabsContent>

            <TabsContent value="archived">
              <Card className="w-full">
                <CardHeader className="p-6">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <img src="/icons/inbox.svg" alt="" className="h-5 w-5" />
                    Archived Listings
                  </CardTitle>
                  <CardDescription>
                    Previously published listings that are no longer active
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4">
                  <ScrollArea className="h-[500px] pr-2 sm:pr-4">
                    {archivedListings.length === 0 ? (
                      <p className="text-center text-gray-500">
                        No archived listings
                      </p>
                    ) : (
                      archivedListings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} />
                      ))
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        )}
      </Tabs>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              listing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LandlordDashboard;
