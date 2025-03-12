import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "./clientApp";
import type { ListingDocument } from "../types/Listing";

const ANALYTICS_COLLECTION = "analytics";

export const getPopularListings = async (
  limit_count: number = 10
): Promise<ListingDocument[]> => {
  try {
    // Get analytics sorted by viewCount
    const analyticsRef = collection(db, ANALYTICS_COLLECTION);
    const q = query(
      analyticsRef,
      orderBy("viewCount", "desc"),
      limit(limit_count)
    );
    const querySnapshot = await getDocs(q);

    // Extract listing IDs from analytics
    const listingIds = querySnapshot.docs.map((doc) => doc.data().listingId);

    if (listingIds.length === 0) return [];

    // Fetch the actual listings using the IDs
    const listings = await Promise.all(
      listingIds.map(async (id) => {
        const listingRef = doc(db, "listings", id);
        const listingDoc = await getDoc(listingRef);
        if (listingDoc.exists() && listingDoc.data().status === "published") {
          return { ...listingDoc.data(), id: listingDoc.id } as ListingDocument;
        }
        return undefined;
      })
    );

    // Filter out any undefined listings and return
    return listings.filter(
      (listing): listing is ListingDocument => listing !== undefined
    );
  } catch (error) {
    console.error("Error fetching popular listings:", error);
    return [];
  }
};
