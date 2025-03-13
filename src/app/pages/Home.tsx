import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import ListingCard from "../../components/ListingCard";
import { useEffect, useRef, useCallback, useState, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { getFilteredListings } from "../../lib/firebase/firestore";
import { getPopularListings } from "../../lib/firebase/popularListings";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { RefreshCcw, AlertCircle } from "lucide-react";
import { ScrollArea } from "../../components/ui/scroll-area";
import SubscriptionCard from "../../components/SubscriptionCard";
import QuickFilter from "../../components/QuickFilter";

const LISTINGS_PER_PAGE = 9;
const POPULAR_LISTINGS_COUNT = 10;

// Skeleton loader component for listings that matches the design of real listing cards
const ListingCardSkeleton = () => (
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

interface PopularListingsProps {
  filterParams: Record<string, any>;
  hasFilters: boolean;
}

interface AvailableListingsProps {
  data: {
    pages: Array<{
      listings: Array<any>;
    }>;
  } | undefined;
  isLoading: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  hasListings: boolean;
  previousPageCount: number;
}

// Wrapper for popular listings with suspense
const PopularListings = ({ filterParams, hasFilters }: PopularListingsProps) => {
  const [previousListingsCount, setPreviousListingsCount] = useState(0);
  
  const { data: popularListings, isLoading: isLoadingPopular } = useQuery({
    queryKey: ["popular-listings", JSON.stringify(filterParams)],
    queryFn: async () => {
      if (hasFilters) {
        // First get popular listing IDs
        const popularIds = await getPopularListings(POPULAR_LISTINGS_COUNT);

        if (popularIds.length === 0) return [];

        // Then fetch filtered listings and filter by the popular IDs
        const allFilteredResponse = await getFilteredListings(
          filterParams,
          null,
          100 // Fetch more to ensure we have enough after filtering
        );

        // Filter the listings to only include those that are in the popular list
        const popularIdsSet = new Set(popularIds.map((listing) => listing.id));
        const filteredPopular = allFilteredResponse.listings
          .filter((listing) => popularIdsSet.has(listing.id))
          .slice(0, POPULAR_LISTINGS_COUNT);
        
        // Store the count for future skeleton loaders
        setPreviousListingsCount(filteredPopular.length);
        return filteredPopular;
      } else {
        // If no filters, just get regular popular listings
        const populars = await getPopularListings(POPULAR_LISTINGS_COUNT);
        setPreviousListingsCount(populars.length);
        return populars;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoadingPopular) {
    // Show the same number of skeletons as there were listings previously
    const skeletonCount = Math.max(previousListingsCount, 3);
    return (
      <div className="pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <ListingCardSkeleton key={`popular-skeleton-${index}`} />
        ))}
      </div>
    );
  }

  if (!popularListings?.length) {
    return null;
  }

  return (
    <div className="pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
      {popularListings.map((listing) => (
        <div key={listing.id}>
          <ListingCard listing={listing} />
        </div>
      ))}
    </div>
  );
};

// Wrapper for available listings with suspense
const AvailableListings = ({ 
  data, 
  isLoading, 
  loadMoreRef, 
  isFetchingNextPage, 
  hasNextPage, 
  hasListings,
  previousPageCount 
}: AvailableListingsProps) => {
  if (isLoading) {
    // Calculate how many skeleton cards to show based on previous listings
    const skeletonCount = previousPageCount > 0 ? previousPageCount : LISTINGS_PER_PAGE;
    
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <ListingCardSkeleton key={`skeleton-${index}`} />
          ))}
        </div>
      </>
    );
  }

  if (!hasListings) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          No properties found matching your criteria
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        {data?.pages.map((page, i: number) =>
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
    </>
  );
};

const Home = () => {
  const [searchParams] = useSearchParams();
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [previousListingsCount, setPreviousListingsCount] = useState(0);

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

  const filterParams = getFilterParams();
  const hasFilters = Object.keys(filterParams).length > 0;

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

  // Save the previous listing count whenever we have data
  useEffect(() => {
    if (data?.pages?.[0]?.listings) {
      const totalListings = data.pages.reduce(
        (count, page) => count + page.listings.length, 
        0
      );
      setPreviousListingsCount(totalListings);
    }
  }, [data]);

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

  const hasListings = Boolean(data?.pages?.[0]?.listings?.length);

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="grid w-full grid-cols-1 md:grid-cols-3 py-6 md:-mt-10 gap-3">
        <div className="col-span-1 md:col-span-2">
          <SubscriptionCard />
        </div>
        <div className="col-span-1">
          <QuickFilter />
        </div>
      </div>

      {/* Popular Listings Section */}
      <div className="mb-8 mt-5">
        <h2 className="md:text-lg text-xl flex flex-col font-medium mb-4">
          Popular Properties
          {hasFilters && (
            <span className="text-sm font-normal text-muted-foreground">
              (Showing filtered results)
            </span>
          )}
        </h2>
        <ScrollArea className="w-full whitespace-nowrap pb-4">
          <Suspense fallback={
            <div className="pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <ListingCardSkeleton key={`suspense-popular-skeleton-${index}`} />
              ))}
            </div>
          }>
            <PopularListings 
              filterParams={filterParams} 
              hasFilters={hasFilters} 
            />
          </Suspense>
        </ScrollArea>
      </div>

      <h1 id="available-properties" className="md:text-lg text-xl mb-4 font-medium">Available Properties</h1>

      {hasFilters && (
        <div className="mb-4 text-sm text-muted-foreground">
          (Showing filtered results)
        </div>
      )}

      <Suspense fallback={
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
          {Array.from({ length: LISTINGS_PER_PAGE }).map((_, index) => (
            <ListingCardSkeleton key={`suspense-skeleton-${index}`} />
          ))}
        </div>
      }>
        <AvailableListings 
          data={data}
          isLoading={isLoading}
          loadMoreRef={loadMoreRef}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          hasListings={hasListings}
          previousPageCount={previousListingsCount}
        />
      </Suspense>
    </div>
  );
};

export default Home;