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
import type { ListingDocument, ListingStatus } from "../../lib/types/Listing";
import { rejectionReasons } from "../dialogs/RejectionDialog";

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
      await updateListingStatus(listingId, "archived");
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
    <Card key={listing.id} className="mb-4">
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{listing.title}</h3>
              {getStatusBadge(listing.status)}
            </div>
            <p className="text-sm text-gray-400">
              {listing.location.area}, {listing.location.city}
            </p>
            <p className="text-sm">
              ${listing.price} /month • {listing.bedrooms} beds •{" "}
              {listing.bathrooms} baths
            </p>
            {listing.status === "denied" && listing.rejectionReason && (
              <p className="text-sm text-red-500">
                Rejection Reason:{" "}
                {rejectionReasons.find(
                  (r) => r.value === listing.rejectionReason
                )?.label || listing.rejectionReason}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(`/listings/${listing.id}`)} // Changed from "/listing" to "/listings"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(`/edit-listing/${listing.id}`)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleArchive(listing.id)}
            >
              <Archive className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <User className="h-6 w-6" />
          <h1 className="text-xl font-medium">Landlord Dashboard</h1>
        </div>
        <div className="flex gap-2 ">
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
            className="flex items-center gap-2 shadow-md"
          >
            <Plus className="h-4 w-4" />
            Add Listing
          </Button>
          <Button variant="outline" onClick={handleSignOut} className="shadow-md">
            Sign Out
          </Button>
        </div>
      </div>

      <Tabs defaultValue="published" className="space-y-4 text-black dark:text-white">
        <TabsList className="bg-black/5">
          <TabsTrigger
            className="flex items-center gap-2"
            value="published"
          >
            <span>
              <Upload className="h-4 w-4" />
            </span>
            Published
            {publishedListings.length > 0 && (
              <Badge variant="secondary" className="ml-2 ">
                {publishedListings.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="flex items-center gap-2 "
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
            className="flex items-center gap-2"
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
            value="archived"
            className="flex items-center gap-2"
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

        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-gray-500">Loading listings...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-red-500">Error loading listings</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <TabsContent value="published">
              <Card>
                <CardHeader>
                  <CardTitle>Published Listings</CardTitle>
                  <CardDescription>
                    Your active listings that are visible to tenants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    {publishedListings.length === 0 ? (
                      <p className="text-center text-gray-500">
                        No published listings
                      </p>
                    ) : (
                      publishedListings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} />
                      ))
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Review</CardTitle>
                  <CardDescription>
                    Listings waiting for admin approval
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
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
              <Card>
                <CardHeader>
                  <CardTitle>Drafts</CardTitle>
                  <CardDescription>
                    Saved drafts and rejected listings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
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

            <TabsContent value="archived">
              <Card>
                <CardHeader>
                  <CardTitle>Archived Listings</CardTitle>
                  <CardDescription>
                    Previously published listings that are no longer active
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
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
          </>
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
