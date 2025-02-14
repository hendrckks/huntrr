import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "./clientApp";
import { getFilteredListings } from "./firestore";
import type { ListingDocument } from "../types/Listing";

const ANALYTICS_COLLECTION = "analytics";

export const getPopularListings = async (limit_count: number = 10): Promise<ListingDocument[]> => {
  try {
    // Get analytics sorted by viewCount
    const analyticsRef = collection(db, ANALYTICS_COLLECTION);
    const q = query(analyticsRef, orderBy("viewCount", "desc"), limit(limit_count));
    const querySnapshot = await getDocs(q);

    // Extract listing IDs from analytics
    const listingIds = querySnapshot.docs.map(doc => doc.data().listingId);

    if (listingIds.length === 0) return [];

    // Fetch the actual listings using the IDs
    const listings = await Promise.all(
      listingIds.map(async (id) => {
        // Changed to fetch the exact listing by ID
        const result = await getFilteredListings({ id }, null, limit_count);
        return result.listings.find(listing => listing.id === id);
      })
    );

    // Filter out any undefined listings and return
    return listings.filter((listing): listing is ListingDocument => listing !== undefined);
  } catch (error) {
    console.error("Error fetching popular listings:", error);
    return [];
  }
};