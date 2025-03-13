import React from "react";
import { useNavigate } from "react-router-dom";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  Archive,
  Eye,
  Pencil,
  Trash2,
  Plus,
  FileText,
  Upload,
  File,
  ArchiveIcon,
  User,
} from "lucide-react";
import { BarChart } from "lucide-react";
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
        console.log("Fetching analytics for listings:", listings.map(l => l.id));
        try {
          const result = await getMultipleListingsAnalytics(listings.map(l => l.id));
          console.log("Fetched analytics result:", result);
          return result;
        } catch (error) {
          console.error("Error fetching analytics:", error);
          throw error;
        }
      },
      enabled: listings.length > 0,
      retry: 3,
      retryDelay: 1000
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
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to archive listing",
        variant: "error",
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
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to unarchive listing",
        variant: "error",
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
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete listing",
        variant: "error",
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
      className="mb-4 w-full hover:shadow-lg transition-shadow duration-200"
    >
      <CardContent className="pt-6 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-3 w-full sm:w-auto max-w-[70%]">
            <div className="flex items-start gap-2 flex-wrap">
              <h3 className="font-semibold break-words text-base">
                {listing.title}
              </h3>
              {getStatusBadge(listing.status)}
            </div>
            <p className="text-sm text-gray-500 break-words">
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
            <Button
              variant="outline"
              size="icon"
              className="hover:bg-gray-100"
              onClick={() => navigate(`/listings/${listing.id}`)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hover:bg-gray-100"
              onClick={() => navigate(`/edit-listing/${listing.id}`)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
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
              {listing.status === "archived" ? (
                <Upload className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="hover:bg-red-600"
              onClick={() => {
                setSelectedListing(listing.id);
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto max-w-7xl px-4 space-y-4 md:mt-0 mt-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <User className="h-6 w-6" />
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
                  duration: 10000,
                });
              } else {
                navigate("/add-listing");
              }
            }}
            className="flex bg-black/90 hover:bg-black/80 hover:text-white dark:bg-white/90 text-white dark:text-black items-center gap-2 shadow-md w-full sm:w-auto justify-center"
          >
            <Plus className="h-4 w-4" />
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

      <Tabs defaultValue="published" className="w-full">
        <div className="w-full overflow-x-auto pb-4">
          <TabsList className="bg-black/5 dark:bg-white/5 w-max md:min-w-fit overflow-auto inline-flex p-1 gap-2">
            <TabsTrigger
              className="flex items-center gap-2 whitespace-nowrap px-4 py-1 [&[data-state=active]_svg]:text-[#8752f3]"
              value="published"
            >
              <Upload className="h-4 w-4" />
              Published
              {publishedListings.length > 0 && (
                <Badge variant="secondary" className="ml-2 dark:bg-white/10">
                  {publishedListings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="flex items-center gap-2 whitespace-nowrap [&[data-state=active]_svg]:text-[#8752f3]"
            >
              <span>
                <FileText className="h-4 w-4" />
              </span>
              Pending Review
              {pendingListings.length > 0 && (
                <Badge className="ml-2">{pendingListings.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="drafts"
              className="flex items-center gap-2 whitespace-nowrap [&[data-state=active]_svg]:text-[#8752f3]"
            >
              <span>
                <File className="h-4 w-4" />
              </span>
              Drafts
              {draftListings.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {draftListings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="flex items-center gap-2 whitespace-nowrap [&[data-state=active]_svg]:text-[#8752f3]"
            >
              <span>
                <BarChart className="h-4 w-4" />
              </span>
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              className="flex items-center gap-2 whitespace-nowrap [&[data-state=active]_svg]:text-[#8752f3]"
            >
              <span>
                <ArchiveIcon className="h-4 w-4" />
              </span>
              Archived
              {archivedListings.length > 0 && (
                <Badge variant="secondary" className="ml-2">
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
                  <CardTitle>Published Listings</CardTitle>
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
                  <CardTitle>Pending Review</CardTitle>
                  <CardDescription>
                    Listings waiting for admin approval
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
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
                  <CardTitle>Drafts</CardTitle>
                  <CardDescription>
                    Saved drafts and rejected listings
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <ScrollArea className="h-[500px] pr-2 sm:pr-4">
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
                  <CardContent className="p-6">
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
                  <CardTitle>Archived Listings</CardTitle>
                  <CardDescription>
                    Previously published listings that are no longer active
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
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
