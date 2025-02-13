import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase/clientApp";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../hooks/useToast";
import ListingCard from "../../components/ListingCard";
import type {
  ListingDocument,
  BookmarkDocument,
} from "../../lib/types/Listing";
import { toggleBookmark } from "../../lib/firebase/firestore";
import { Bookmark } from "lucide-react";

// Query keys for better cache management
const queryKeys = {
  bookmarks: (userId: string) => ["bookmarks", userId],
  listings: (listingIds: string[]) => ["listings", listingIds],
};

// Custom hook to manage bookmarks state and operations
const useBookmarks = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch bookmarks
  const bookmarksQuery = useQuery({
    queryKey: queryKeys.bookmarks(user?.uid || ""),
    queryFn: async () => {
      if (!user) return [];

      const bookmarksRef = query(
        collection(db, "bookmarks"),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(bookmarksRef);
      return snapshot.docs.map((doc) => doc.data() as BookmarkDocument);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });

  // Fetch listings for bookmarks
  const listingsQuery = useQuery({
    queryKey: queryKeys.listings(
      bookmarksQuery.data?.map((b) => b.listingId) || []
    ),
    queryFn: async () => {
      if (!bookmarksQuery.data?.length) return [];

      const listingIds = bookmarksQuery.data.map((b) => b.listingId);
      const listings: ListingDocument[] = [];

      // Batch fetch listings in groups of 10
      for (let i = 0; i < listingIds.length; i += 10) {
        const batch = listingIds.slice(i, i + 10);
        const q = query(collection(db, "listings"), where("id", "in", batch));
        const snapshot = await getDocs(q);
        listings.push(
          ...snapshot.docs.map(
            (doc) => ({ ...doc.data(), id: doc.id } as ListingDocument)
          )
        );
      }

      return listings;
    },
    enabled: !!bookmarksQuery.data?.length,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Optimistic updates for bookmark toggle
  const toggleBookmarkMutation = useMutation({
    mutationFn: async (listingId: string) => {
      if (!user) throw new Error("User not authenticated");
      return toggleBookmark(user.uid, listingId);
    },
    onMutate: async (listingId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.bookmarks(user?.uid || ""),
      });

      // Snapshot previous value
      const previousBookmarks = queryClient.getQueryData(
        queryKeys.bookmarks(user?.uid || "")
      );

      // Optimistically update bookmarks
      queryClient.setQueryData(
        queryKeys.bookmarks(user?.uid || ""),
        (old: BookmarkDocument[] = []) => {
          const exists = old.some((b) => b.listingId === listingId);
          if (exists) {
            return old.filter((b) => b.listingId !== listingId);
          }
          return [
            ...old,
            {
              userId: user!.uid,
              listingId,
              id: `${user!.uid}_${listingId}`,
              createdAt: new Date(),
            },
          ];
        }
      );

      return { previousBookmarks };
    },
    onError: (_err, _listingId, context) => {
      // Revert on error
      if (context?.previousBookmarks) {
        queryClient.setQueryData(
          queryKeys.bookmarks(user?.uid || ""),
          context.previousBookmarks
        );
      }
      toast({
        title: "Error",
        description: "Failed to update bookmark",
        variant: "error",
      });
    },
    onSettled: () => {
      // Refresh queries after mutation
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookmarks(user?.uid || ""),
      });
    },
  });

  return {
    listings: listingsQuery.data || [],
    isLoading: bookmarksQuery.isLoading || listingsQuery.isLoading,
    toggleBookmark: toggleBookmarkMutation.mutate,
  };
};

// Optimized Bookmarks Page Component
const BookmarksPage = () => {
  const { listings, isLoading, toggleBookmark } = useBookmarks();

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-0 md:px-4">
        <div className="flex items-center gap-2 mb-6">
          <Bookmark className="h-6 w-6" />
          <h1 className="text-xl font-medium">Your Bookmarks</h1>
        </div>{" "}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <ListingCard key={i} isLoading={true} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-0 md:px-4">
      <div className="flex items-center gap-2 mb-6">
        <Bookmark className="h-6 w-6" />
        <h1 className="text-xl font-medium">Your Bookmarks</h1>
      </div>
      {!listings.length ? (
        <p className="text-gray-500 text-center py-8">
          You haven't bookmarked any listings yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isBookmarked={true}
              onBookmarkToggle={() => toggleBookmark(listing.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BookmarksPage;
