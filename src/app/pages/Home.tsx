import { useInfiniteQuery } from "@tanstack/react-query";
import ListingCard from "../../components/ListingCard";
import { useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getFilteredListings } from "../../lib/firebase/firestore";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { RefreshCcw, AlertCircle } from "lucide-react";

const LISTINGS_PER_PAGE = 9;

const Home = () => {
  const [searchParams] = useSearchParams();
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const getFilterParams = () => {
    const params: Record<string, any> = {};

    // Property filters
    if (searchParams.has("type")) params.type = searchParams.get("type");
    if (searchParams.has("bedrooms"))
      params.bedrooms = searchParams.get("bedrooms");
    if (searchParams.has("bathrooms"))
      params.bathrooms = searchParams.get("bathrooms");

    // Price range
    if (searchParams.has("minPrice"))
      params.minPrice = Number(searchParams.get("minPrice"));
    if (searchParams.has("maxPrice"))
      params.maxPrice = Number(searchParams.get("maxPrice"));

    // Amenities
    if (searchParams.has("amenities")) {
      params.amenities = searchParams.get("amenities")?.split(",");
    }

    // Water availability
    if (searchParams.has("water")) params.water = searchParams.get("water");

    // Location
    if (searchParams.has("location_area"))
      params.location_area = searchParams.get("location_area");
    if (searchParams.has("location_city"))
      params.location_city = searchParams.get("location_city");
    if (searchParams.has("location_neighborhood")) {
      params.location_neighborhood = searchParams.get("location_neighborhood");
    }

    return params;
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["listings", searchParams.toString()],
    queryFn: async ({ pageParam }) => {
      try {
        const filterParams = getFilterParams();
        return await getFilteredListings(
          filterParams,
          pageParam,
          LISTINGS_PER_PAGE
        );
      } catch (err) {
        console.error("Error fetching listings:", err);
        throw err;
      }
    },
    initialPageParam: null as null | QueryDocumentSnapshot<DocumentData>,
    getNextPageParam: (lastPage) => lastPage.lastDoc || null,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading listings</AlertTitle>
          <AlertDescription className="w-[300px]">
            {error instanceof Error
              ? error.message
              : "There was a problem loading the listings. Please try again."}
          </AlertDescription>
          <div className="mt-4">
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  const hasListings = data?.pages?.[0]?.listings?.length ?? 0 > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4">
      <h1 className="text-xl font-medium mb-4">Available Properties</h1>

      {searchParams.toString() && (
        <div className="mb-4 text-sm text-muted-foreground">
          Showing filtered results
        </div>
      )}

      {!isLoading && !hasListings && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            No properties found matching your criteria
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: LISTINGS_PER_PAGE }).map((_, index) => (
              <ListingCard key={`skeleton-${index}`} isLoading={true} />
            ))
          : data?.pages.map((page, i) =>
              page.listings.map((listing) => (
                <ListingCard key={`${listing.id}-${i}`} listing={listing} />
              ))
            )}
      </div>

      {/* Loading more indicator */}
      <div ref={loadMoreRef} className="mt-8 text-xs text-center pb-8">
        {isFetchingNextPage ? (
          <p className="text-gray-600">Loading more listings...</p>
        ) : hasNextPage ? (
          <p className="text-gray-600">Scroll for more</p>
        ) : hasListings ? (
          <p className="text-gray-600">No more listings to load</p>
        ) : null}
      </div>
    </div>
  );
};

export default Home;
