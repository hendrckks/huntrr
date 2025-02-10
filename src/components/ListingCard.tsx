import { Link } from "react-router-dom";
import { Bookmark, Flag } from "lucide-react";
import type { ListingDocument, FlagReason } from "../lib/types/Listing";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { flagListing } from "../lib/firebase/firestore";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../contexts/AuthContext"; // Assuming you have an auth context
import { useQueryClient } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase/clientApp";
import { useBookmarks } from "../contexts/BookmarkContext";
import { useCallback, useEffect, useRef, useState } from "react";

interface ListingCardProps {
  listing?: ListingDocument;
  isLoading?: boolean;
  showBookmark?: boolean;
  isBookmarked?: boolean;
  onBookmarkToggle?: (listingId: string) => void;
}

const ListingCard = ({
  listing,
  isLoading = false,
  showBookmark = true,
  onBookmarkToggle,
}: ListingCardProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();
  const [localBookmarkState, setLocalBookmarkState] = useState<
    boolean | undefined
  >(undefined);
  const [isDissolving, setIsDissolving] = useState(false);
  const dissolveAnimRef = useRef<SVGAnimateElement>(null);

  // Prefetch listing details on hover
  const handleMouseEnter = () => {
    if (listing) {
      queryClient.prefetchQuery({
        queryKey: ["listing", listing.id],
        queryFn: async () => {
          const docRef = doc(db, "listings", listing.id);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            throw new Error("Listing not found");
          }
          return { ...docSnap.data(), id: docSnap.id } as ListingDocument;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
      });
    }
  };

  // Initialize local state when component mounts or isBookmarked changes
  useEffect(() => {
    if (listing) {
      setLocalBookmarkState(isBookmarked(listing.id));
    }
  }, [listing, isBookmarked]);

  const handleBookmarkClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent navigation when clicking bookmark
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to bookmark listings",
          variant: "error",
        });
        return;
      }

      if (!listing) return;

      const isCurrentlyBookmarked =
        localBookmarkState ?? isBookmarked(listing.id);
      // Update local state immediately for instant UI feedback
      setLocalBookmarkState(!isCurrentlyBookmarked);

      try {
        if (isCurrentlyBookmarked) {
          // Start dissolve animation immediately for visual feedback
          setIsDissolving(true);
          dissolveAnimRef.current?.beginElement();
          await removeBookmark(listing.id);
          onBookmarkToggle?.(listing.id);
          toast({
            title: "Success",
            description: "Listing removed from bookmarks",
            variant: "success",
          });
          // Complete the dissolve animation
          setTimeout(() => {
            setIsDissolving(false);
          }, 1500);
        } else {
          await addBookmark(listing.id);
          onBookmarkToggle?.(listing.id);
          toast({
            title: "Success",
            description: "Listing added to bookmarks",
            variant: "success",
          });
        }
      } catch (error) {
        console.error("Error toggling bookmark:", error);
        toast({
          title: "Error",
          description: "Failed to update bookmark. Please try again.",
          variant: "error",
        });
        setIsDissolving(false); // Reset dissolving state on error
      }
    },
    [
      user,
      listing,
      isBookmarked,
      addBookmark,
      removeBookmark,
      onBookmarkToggle,
      toast,
    ]
  );

  const [flagReason, setFlagReason] = useState<FlagReason>();
  const [flagDescription, setFlagDescription] = useState("");

  const handleFlag = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to flag listings",
        variant: "error",
      });
      return;
    }

    if (!listing || !flagReason) return;

    try {
      await flagListing(listing.id, {
        reason: flagReason,
        description: flagDescription,
        userId: user.uid,
      });

      toast({
        title: "Success",
        description: "Listing has been flagged for review",
        variant: "success",
      });

      // Reset the form
      setFlagReason(undefined);
      setFlagDescription("");
    } catch (error) {
      console.error("Error flagging listing:", error);
      toast({
        title: "Error",
        description: "Failed to flag listing. Please try again.",
        variant: "error",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="block rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
        <div className="relative w-full pb-[75%] overflow-hidden rounded-lg bg-gray-200 animate-pulse"></div>
        <div className="mt-2">
          <div className="flex justify-between items-start">
            <div className="flex-1 space-y-2">
              <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-4 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-4 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
          </div>
          <div className="h-5 bg-gray-200 rounded w-24 animate-pulse mt-2 mb-4"></div>
        </div>
      </div>
    );
  }

  if (!listing) return null;

  const primaryPhoto = listing.photos?.find((photo) => photo.isPrimary);
  const defaultImage = "https://via.placeholder.com/300x200?text=No+Image";

  return (
    <div>
      <Link
        to={`/listings/${listing.id}`}
        className="block rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 relative"
        onMouseEnter={handleMouseEnter}
      >
        {showBookmark && (
          <>
            <button
              onClick={handleBookmarkClick}
              className="absolute top-2 right-2 z-10 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
              style={{
                filter: isDissolving
                  ? `url(#dissolve-filter-${listing?.id})`
                  : "none",
              }}
            >
              <Bookmark
                className={`w-4 h-4 ${
                  localBookmarkState ?? isBookmarked(listing?.id || "")
                    ? "fill-current text-black"
                    : "text-gray-600"
                }`}
              />
            </button>
          </>
        )}
        <div className="relative w-full pb-[75%] overflow-hidden rounded-lg">
          <img
            src={primaryPhoto?.url || defaultImage}
            alt={listing.title}
            className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform rounded-lg duration-300"
          />
        </div>
      </Link>

      <div className="mt-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-gray-900 dark:text-white max-w-[300px] truncate">
                {listing.title}
              </h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/10">
                    <Flag className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Flag Listing</DialogTitle>
                    <DialogDescription>
                      Please select a reason for flagging this listing.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Select
                      onValueChange={(value) =>
                        setFlagReason(value as FlagReason)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scam">Scam</SelectItem>
                        <SelectItem value="inappropriate">
                          Inappropriate
                        </SelectItem>
                        <SelectItem value="misleading">Misleading</SelectItem>
                        <SelectItem value="wrong_information">
                          Wrong Information
                        </SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      placeholder="Additional details about your flag (optional)"
                      value={flagDescription}
                      onChange={(e) => setFlagDescription(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button onClick={handleFlag} disabled={!flagReason}>
                      Submit Flag
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-1">
              {listing.location.neighborhood}, {listing.location.city}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 mt-1">
          <span>{listing.bedrooms} beds</span>
          <span>•</span>
          <span>{listing.bathrooms} baths</span>
          <span>•</span>
          <span>{listing.squareFootage} sqft</span>
        </div>
        <p className="dark:text-white text-black font-medium mt-2 mb-4 text-sm">
          KSh {listing.price.toLocaleString()}
          <span className="font-normal"> month</span>
        </p>
      </div>
    </div>
  );
};

export default ListingCard;
