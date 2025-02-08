import { useQuery } from "@tanstack/react-query";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase/clientApp";
import type { ListingDocument } from "../../lib/types/Listing";
import ListingCard from "../../components/ListingCard";

const Home = () => {
  const { data: listings, isLoading } = useQuery<ListingDocument[]>({
    queryKey: ["listings"],
    queryFn: async () => {
      const querySnapshot = await getDocs(collection(db, "listings"));
      return querySnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as ListingDocument[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="text-xl font-medium mb-4">Available Properties</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <ListingCard key={`skeleton-${index}`} isLoading={true} />
            ))
          : listings?.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
      </div>
    </div>
  );
};

export default Home;
