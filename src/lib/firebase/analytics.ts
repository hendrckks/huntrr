import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  increment,
  Timestamp,
} from "firebase/firestore";
import { db } from "./clientApp";
import type { ListingAnalytics, AnalyticsUpdate } from "../types/Analytics";
import { globalCache } from "../cache/cacheManager";

// Collection name
const ANALYTICS_COLLECTION = "analytics";

// Initialize or update analytics for a listing
export const initializeAnalytics = async (listingId: string) => {
  const analyticsRef = doc(db, ANALYTICS_COLLECTION, listingId);
  const analyticsDoc = await getDoc(analyticsRef);

  if (!analyticsDoc.exists()) {
    await setDoc(analyticsRef, {
      listingId,
      viewCount: 0,
      bookmarkCount: 0,
      flagCount: 0,
      lastUpdated: new Date(),
    });
  }
};

// Update analytics for a specific metric
export const updateAnalytics = async (
  listingId: string,
  update: AnalyticsUpdate
) => {
  const analyticsRef = doc(db, ANALYTICS_COLLECTION, listingId);

  try {
    await updateDoc(analyticsRef, {
      [`${update.type}Count`]: increment(update.value),
      lastUpdated: update.timestamp,
    });

    // Clear both the global cache and force a refetch
    globalCache.invalidate(`analytics_${listingId}`);

    // Force a new fetch to get the latest data
    const freshData = await getDoc(analyticsRef);
    if (freshData.exists()) {
      const newData = freshData.data() as ListingAnalytics;
      globalCache.set(`analytics_${listingId}`, newData);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("no document to update")
    ) {
      await initializeAnalytics(listingId);
      await updateDoc(analyticsRef, {
        [`${update.type}Count`]: increment(update.value),
        lastUpdated: update.timestamp,
      });
      globalCache.invalidate(`analytics_${listingId}`);
    } else {
      throw error;
    }
  }
};

// Increment a specific metric
export const incrementAnalyticMetric = async (
  listingId: string,
  type: "view" | "bookmark" | "flag"
) => {
  return updateAnalytics(listingId, {
    type,
    value: 1,
    timestamp: new Date(),
  });
};

// Decrement a specific metric
export const decrementAnalyticMetric = async (
  listingId: string,
  type: "view" | "bookmark" | "flag"
) => {
  return updateAnalytics(listingId, {
    type,
    value: -1,
    timestamp: new Date(),
  });
};

// Get analytics for a specific listing
export const getListingAnalytics = async (
  listingId: string
): Promise<ListingAnalytics> => {
  // Try to get from cache first
  const cacheKey = `analytics_${listingId}`;
  const cachedData = globalCache.get(cacheKey) as ListingAnalytics | null;
  if (cachedData) return cachedData;

  const analyticsRef = doc(db, ANALYTICS_COLLECTION, listingId);
  const analyticsDoc = await getDoc(analyticsRef);

  if (!analyticsDoc.exists()) {
    // Initialize analytics if they don't exist
    await initializeAnalytics(listingId);
    const initialData = {
      listingId,
      viewCount: 0,
      bookmarkCount: 0,
      flagCount: 0,
      lastUpdated: new Date(),
    };
    globalCache.set(cacheKey, initialData);
    return initialData;
  }

  const data = analyticsDoc.data() as ListingAnalytics;
  globalCache.set(cacheKey, data);
  return data;
};

// Get analytics for multiple listings
export const getMultipleListingsAnalytics = async (
  listingIds: string[]
): Promise<ListingAnalytics[]> => {
  console.log("Getting analytics for listings:", listingIds);

  if (listingIds.length === 0) return [];

  const analytics: ListingAnalytics[] = [];

  // First ensure all listings have analytics documents
  for (const id of listingIds) {
    const analyticsRef = doc(db, ANALYTICS_COLLECTION, id);
    const analyticsDoc = await getDoc(analyticsRef);

    if (!analyticsDoc.exists()) {
      console.log(`Initializing analytics for listing ${id}`);
      await setDoc(analyticsRef, {
        listingId: id,
        viewCount: 0,
        bookmarkCount: 0,
        flagCount: 0,
        lastUpdated: new Date(),
      });
    }
  }

  // Now get all analytics documents
  const analyticsRef = collection(db, ANALYTICS_COLLECTION);
  const q = query(analyticsRef, where("listingId", "in", listingIds));
  const querySnapshot = await getDocs(q);

  console.log(`Found ${querySnapshot.size} analytics documents`);

  querySnapshot.forEach((doc) => {
    const data = doc.data() as ListingAnalytics;
    const lastUpdated = data.lastUpdated;
    analytics.push({
      ...data,
      lastUpdated: lastUpdated instanceof Timestamp ? lastUpdated.toDate() : lastUpdated,
    });
  });

  // Log the final results
  console.log("Returning analytics:", analytics);

  return analytics;
};
