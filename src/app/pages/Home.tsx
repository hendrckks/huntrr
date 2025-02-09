import { useInfiniteQuery } from "@tanstack/react-query";
import { collection, query, getDocs, orderBy, limit, startAfter, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { db } from "../../lib/firebase/clientApp";
import type { ListingDocument } from "../../lib/types/Listing";
import ListingCard from "../../components/ListingCard";
import { useEffect, useRef, useCallback } from "react";

const LISTINGS_PER_PAGE = 9;

const Home = () => {
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery<{
    listings: ListingDocument[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }>(
    {
      queryKey: ["listings"],
      initialPageParam: null as QueryDocumentSnapshot<DocumentData> | null,
      queryFn: async ({ pageParam }) => {
        let q = query(
          collection(db, "listings"),
          orderBy("createdAt", "desc"),
          limit(LISTINGS_PER_PAGE)
        );

        if (pageParam) {
          q = query(q, startAfter(pageParam));
        }

        const querySnapshot = await getDocs(q);
        const listings = querySnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as ListingDocument[];

        return {
          listings,
          lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
        };
      },
      getNextPageParam: (lastPage) => lastPage.lastDoc,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  );

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(handleObserver, {
      threshold: 0.5,
    });

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  if (isError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-red-500">Error loading listings</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4">
      <h1 className="text-xl font-medium mb-4">Available Properties</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: LISTINGS_PER_PAGE }).map((_, index) => (
              <ListingCard key={`skeleton-${index}`} isLoading={true} />
            ))
          : data?.pages.map((page) =>
              page.listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))
            )}
      </div>

      {/* Loading more indicator */}
      <div
        ref={loadMoreRef}
        className="mt-8 text-xs text-center pb-8"
      >
        {isFetchingNextPage ? (
          <p className="text-gray-600">Loading more listings...</p>
        ) : hasNextPage ? (
          <p className="text-gray-600">Scroll for more</p>
        ) : data?.pages[0]?.listings.length ? (
          <p className="text-gray-600">No more listings to load</p>
        ) : null}
      </div>
    </div>
  );
};

export default Home;
