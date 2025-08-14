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
import type { ListingAnalytics, AnalyticsUpdate, RollingWindowMetrics, RollingMetricsTotals } from "../types/Analytics";
import { globalCache } from "../cache/cacheManager";

// Collection name
const ANALYTICS_COLLECTION = "analytics";
const ANALYTICS_DAILY_COLLECTION = "analytics_daily"; // Subcollection under each listing doc
const ANALYTICS_HOURLY_COLLECTION = "analytics_hourly"; // Subcollection under each listing doc

// Utility to format a Date as YYYY-MM-DD in UTC
const toUTCDateKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Utility to format a Date as YYYY-MM-DD-HH in UTC
const toUTCHourKey = (date: Date): string => {
  const dateKey = toUTCDateKey(date);
  const hour = String(date.getUTCHours()).padStart(2, "0");
  return `${dateKey}-${hour}`;
};

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
  const dailyRef = doc(
    collection(db, ANALYTICS_COLLECTION, listingId, ANALYTICS_DAILY_COLLECTION),
    toUTCDateKey(update.timestamp)
  );
  const hourlyRef = doc(
    collection(db, ANALYTICS_COLLECTION, listingId, ANALYTICS_HOURLY_COLLECTION),
    toUTCHourKey(update.timestamp)
  );

  try {
    await updateDoc(analyticsRef, {
      [`${update.type}Count`]: increment(update.value),
      lastUpdated: update.timestamp,
    });

    // Update/create daily rollup for the given metric
    const existingDaily = await getDoc(dailyRef);
    if (existingDaily.exists()) {
      await updateDoc(dailyRef, {
        [`${update.type}Count`]: increment(update.value),
        lastUpdated: update.timestamp,
      });
    } else {
      await setDoc(dailyRef, {
        listingId,
        date: toUTCDateKey(update.timestamp),
        viewCount: update.type === "view" ? update.value : 0,
        bookmarkCount: update.type === "bookmark" ? update.value : 0,
        flagCount: update.type === "flag" ? update.value : 0,
        lastUpdated: update.timestamp,
      });
    }

    // Update/create hourly rollup for the given metric
    const existingHourly = await getDoc(hourlyRef);
    if (existingHourly.exists()) {
      await updateDoc(hourlyRef, {
        [`${update.type}Count`]: increment(update.value),
        lastUpdated: update.timestamp,
      });
    } else {
      await setDoc(hourlyRef, {
        listingId,
        hour: toUTCHourKey(update.timestamp),
        viewCount: update.type === "view" ? update.value : 0,
        bookmarkCount: update.type === "bookmark" ? update.value : 0,
        flagCount: update.type === "flag" ? update.value : 0,
        lastUpdated: update.timestamp,
      });
    }

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
      // Ensure daily rollup exists
      const existingDaily = await getDoc(dailyRef);
      if (existingDaily.exists()) {
        await updateDoc(dailyRef, {
          [`${update.type}Count`]: increment(update.value),
          lastUpdated: update.timestamp,
        });
      } else {
        await setDoc(dailyRef, {
          listingId,
          date: toUTCDateKey(update.timestamp),
          viewCount: update.type === "view" ? update.value : 0,
          bookmarkCount: update.type === "bookmark" ? update.value : 0,
          flagCount: update.type === "flag" ? update.value : 0,
          lastUpdated: update.timestamp,
        });
      }
      // Ensure hourly rollup exists
      const existingHourly = await getDoc(hourlyRef);
      if (existingHourly.exists()) {
        await updateDoc(hourlyRef, {
          [`${update.type}Count`]: increment(update.value),
          lastUpdated: update.timestamp,
        });
      } else {
        await setDoc(hourlyRef, {
          listingId,
          hour: toUTCHourKey(update.timestamp),
          viewCount: update.type === "view" ? update.value : 0,
          bookmarkCount: update.type === "bookmark" ? update.value : 0,
          flagCount: update.type === "flag" ? update.value : 0,
          lastUpdated: update.timestamp,
        });
      }
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
  // console.log("Getting analytics for listings:", listingIds);

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

  // console.log(`Found ${querySnapshot.size} analytics documents`);

  querySnapshot.forEach((doc) => {
    const data = doc.data() as ListingAnalytics;
    const lastUpdated = data.lastUpdated;
    analytics.push({
      ...data,
      lastUpdated: lastUpdated instanceof Timestamp ? lastUpdated.toDate() : lastUpdated,
    });
  });

  // Log the final results
  // console.log("Returning analytics:", analytics);

  return analytics;
};

// Get last 24 hours totals across listings (UTC-based hours)
export const getLast24hMetricsForListings = async (
  listingIds: string[]
): Promise<RollingMetricsTotals> => {
  if (listingIds.length === 0) {
    return { views: 0, bookmarks: 0, flags: 0 };
  }
  const now = new Date();
  const endHour = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
  const startHour = new Date(endHour);
  startHour.setUTCHours(startHour.getUTCHours() - 23);

  const startKey = toUTCHourKey(startHour);
  const endKey = toUTCHourKey(endHour);

  const totals: RollingMetricsTotals = { views: 0, bookmarks: 0, flags: 0 };

  for (const id of listingIds) {
    const subCol = collection(db, ANALYTICS_COLLECTION, id, ANALYTICS_HOURLY_COLLECTION);
    const q = query(subCol, where("hour", ">=", startKey), where("hour", "<=", endKey));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const data = d.data() as {
        hour: string;
        viewCount: number;
        bookmarkCount: number;
        flagCount: number;
      };
      totals.views += data.viewCount || 0;
      totals.bookmarks += data.bookmarkCount || 0;
      totals.flags += data.flagCount || 0;
    });
  }

  return totals;
};

// Fetch rolling 30-day window metrics vs previous 30 days for the provided listings
export const getRollingWindowMetricsForListings = async (
  listingIds: string[],
  days: number = 30
): Promise<RollingWindowMetrics> => {
  if (listingIds.length === 0) {
    return {
      currentWindow: { views: 0, bookmarks: 0, flags: 0 },
      previousWindow: { views: 0, bookmarks: 0, flags: 0 },
    };
  }

  // Calculate date keys
  const now = new Date();
  const endCurrent = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startCurrent = new Date(endCurrent);
  startCurrent.setUTCDate(startCurrent.getUTCDate() - (days - 1));

  const endPrevious = new Date(startCurrent);
  endPrevious.setUTCDate(endPrevious.getUTCDate() - 1);
  const startPrevious = new Date(endPrevious);
  startPrevious.setUTCDate(startPrevious.getUTCDate() - (days - 1));

  // Build a set of date keys for both windows for quick membership check
  const buildDateKeys = (start: Date, end: Date): Set<string> => {
    const keys = new Set<string>();
    const d = new Date(start);
    while (d <= end) {
      keys.add(toUTCDateKey(d));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return keys;
  };

  const currentKeys = buildDateKeys(startCurrent, endCurrent);
  const previousKeys = buildDateKeys(startPrevious, endPrevious);

  const totals = {
    current: { views: 0, bookmarks: 0, flags: 0 },
    previous: { views: 0, bookmarks: 0, flags: 0 },
  };

  // For each listing, query its daily subcollection for the union of both windows
  // We will fetch all docs in the last 2*days window in one go using where on date range
  for (const id of listingIds) {
    const subCol = collection(db, ANALYTICS_COLLECTION, id, ANALYTICS_DAILY_COLLECTION);
    const startAll = toUTCDateKey(startPrevious);
    const endAll = toUTCDateKey(endCurrent);
    const q = query(subCol, where("date", ">=", startAll), where("date", "<=", endAll));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const data = d.data() as {
        date: string;
        viewCount: number;
        bookmarkCount: number;
        flagCount: number;
      };
      if (currentKeys.has(data.date)) {
        totals.current.views += data.viewCount || 0;
        totals.current.bookmarks += data.bookmarkCount || 0;
        totals.current.flags += data.flagCount || 0;
      } else if (previousKeys.has(data.date)) {
        totals.previous.views += data.viewCount || 0;
        totals.previous.bookmarks += data.bookmarkCount || 0;
        totals.previous.flags += data.flagCount || 0;
      }
    });
  }

  return {
    currentWindow: totals.current,
    previousWindow: totals.previous,
  };
};
