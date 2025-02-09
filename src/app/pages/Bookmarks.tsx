import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase/clientApp";
import ListingCard from "../../components/ListingCard";
import { useToast } from "../../hooks/useToast";
import type { ListingDocument, BookmarkDocument } from "../../lib/types/Listing";

const BookmarksPage = () => {
  const [listings, setListings] = useState<ListingDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchBookmarks = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        // First get the user's bookmarks
        const bookmarksQuery = query(
          collection(db, "bookmarks"),
          where("userId", "==", user.uid)
        );
        const bookmarksSnapshot = await getDocs(bookmarksQuery);
        const bookmarkDocs = bookmarksSnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as BookmarkDocument[];

        // Then fetch the corresponding listings
        const listingPromises = bookmarkDocs.map(async bookmark => {
          const listingRef = collection(db, "listings");
          const listingSnapshot = await getDocs(
            query(listingRef, where("id", "==", bookmark.listingId))
          );
          return {
            ...listingSnapshot.docs[0].data(),
            id: listingSnapshot.docs[0].id
          } as ListingDocument;
        });
        
        const listingData = await Promise.all(listingPromises);
        setListings(listingData);
      } catch (error) {
        console.error("Error fetching bookmarks:", error);
        toast({
          title: "Error",
          description: "Failed to load bookmarks",
          variant: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookmarks();
  }, [user, toast]);

  const handleBookmarkToggle = (listingId: string) => {
    setListings(prevListings => 
      prevListings.filter(listing => listing.id !== listingId)
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4">
        <h1 className="text-xl font-medium mb-4">Your Bookmarks</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <ListingCard key={i} isLoading={true} />
          ))}
        </div>
      </div>
    );
  }

  if (!listings.length) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4">
        <h1 className="text-xl font-medium mb-4">Your Bookmarks</h1>
        <p className="text-gray-500 text-center py-8">
          You haven't bookmarked any listings yet.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4">
      <h1 className="text-xl font-medium mb-4">Your Bookmarks</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            isBookmarked={true}
            onBookmarkToggle={handleBookmarkToggle}
          />
        ))}
      </div>
    </div>
  );
};

export default BookmarksPage;