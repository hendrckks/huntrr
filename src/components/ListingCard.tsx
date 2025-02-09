import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { useToast } from "../hooks/useToast";
import type { ListingDocument } from "../lib/types/Listing";
import { toggleBookmark } from "../lib/firebase/firestore";
import { useAuth } from "../contexts/AuthContext"; // Assuming you have an auth context

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
  isBookmarked = false,
  onBookmarkToggle,
}: ListingCardProps) => {
  const { toast } = useToast();
  const { user } = useAuth();

  const handleBookmarkClick = async (e: React.MouseEvent) => {
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

    try {
      const isNowBookmarked = await toggleBookmark(user.uid, listing.id);
      onBookmarkToggle?.(listing.id);

      toast({
        title: isNowBookmarked ? "Listing Bookmarked" : "Bookmark Removed",
        description: isNowBookmarked
          ? "The listing has been added to your bookmarks"
          : "The listing has been removed from your bookmarks",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update bookmark",
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
    <Link
      to={`/listings/${listing.id}`}
      className="block rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 relative"
    >
      {showBookmark && (
        <button
          onClick={handleBookmarkClick}
          className="absolute top-2 right-2 z-10 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
        >
          <Bookmark
            className={`w-4 h-4 ${
              isBookmarked ? "fill-current text-blue-500" : "text-gray-600"
            }`}
          />
        </button>
      )}
      <div className="relative w-full pb-[75%] overflow-hidden rounded-lg">
        <img
          src={primaryPhoto?.url || defaultImage}
          alt={listing.title}
          className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform rounded-lg duration-300"
        />
      </div>
      <div className="mt-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 dark:text-white max-w-[340px] truncate">
              {listing.title}
            </h3>
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
        <p className="text-white font-medium mt-2 mb-4 text-sm">
          KSh {listing.price.toLocaleString()}
          <span className="font-normal"> month</span>
        </p>
      </div>
    </Link>
  );
};

export default ListingCard;
