import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  // deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  increment,
  writeBatch,
  type QueryDocumentSnapshot,
  // type DocumentReference,
  type WriteBatch,
  serverTimestamp,
  runTransaction,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "./clientApp";
import {
  type Listing,
  type ListingDocument,
  // Bookmark,
  type BookmarkDocument,
  type AdminNotification,
  type AdminNotificationDocument,
  type ListingStatus,
  type Flag,
  listingSchema,
  Photo,
} from "../types/Listing";
import { globalCache } from "../cache/cacheManager";
import { uploadImage } from "./storage";
// Remove slugify from import since we don't use it directly
import { generateUniqueSlug } from "../utils/slugify";

const LISTINGS_PER_PAGE = 20;
// Remove the following line
// const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache management
// interface CacheEntry<T> {
//   data: T;
//   timestamp: number;
// }

// const cache = new Map<string, CacheEntry<any>>();

// const isCacheValid = (key: string): boolean => {
//   const entry = cache.get(key);
//   if (!entry) return false;
//   return Date.now() - entry.timestamp < CACHE_DURATION;
// };

// const clearCacheByPrefix = (prefix: string) => {
//   for (const key of cache.keys()) {
//     if (key.startsWith(prefix)) {
//       cache.delete(key);
//     }
//   }
// };
interface FilterParams {
  id?: string;
  type?: string;
  bedrooms?: string;
  bathrooms?: string;
  minPrice?: number;
  maxPrice?: number;
  amenities?: string[];
  water?: string;
  location_area?: string;
  location_city?: string;
  location_neighborhood?: string;
}

// Utility functions
const convertTimestamps = <T extends { [key: string]: any }>(
  doc: QueryDocumentSnapshot<T>
): T => {
  const convertValue = (value: any): any => {
    if (value instanceof Timestamp) {
      return value.toDate();
    }
    if (Array.isArray(value)) {
      return value.map(convertValue);
    }
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, convertValue(v)])
      );
    }
    return value;
  };

  return convertValue(doc.data()) as T;
};

const checkSlugExists = async (slug: string): Promise<boolean> => {
  const q = query(collection(db, "listings"), where("slug", "==", slug));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
};

export const getFilteredListings = async (
  params: FilterParams,
  lastDoc?: any,
  pageSize: number = 9
) => {
  // Base constraints that will always be applied
  const baseConstraints: QueryConstraint[] = [
    where("status", "==", "published"),
  ];

  // Handle property type
  if (params.type) {
    baseConstraints.push(where("type", "==", params.type));
  }

  // Handle bedrooms - use the existing compound index
  if (params.bedrooms) {
    if (params.bedrooms === "5+") {
      baseConstraints.push(where("bedrooms", ">=", 5));
    } else {
      baseConstraints.push(where("bedrooms", "==", parseInt(params.bedrooms)));
    }
  }

  // Price filtering will be handled client-side after fetching results

  // Water availability
  if (params.water) {
    baseConstraints.push(
      where("utilities.waterAvailability", "==", params.water)
    );
  }

  // Security amenities - use separate queries for each security feature
  if (params.amenities) {
    if (params.amenities.includes("security")) {
      baseConstraints.push(where("security.hasGuard", "==", true));
    }
    if (params.amenities.includes("cctv")) {
      baseConstraints.push(where("security.hasCCTV", "==", true));
    }
    if (params.amenities.includes("parking")) {
      baseConstraints.push(where("security.hasSecureParking", "==", true));
    }
    if (params.amenities.includes("pets")) {
      baseConstraints.push(where("terms.petsAllowed", "==", true));
    }
  }

  // Location search using array-contains
  if (
    params.location_area ||
    params.location_city ||
    params.location_neighborhood
  ) {
    const searchTerm = [
      params.location_area,
      params.location_city,
      params.location_neighborhood,
    ]
      .find(Boolean)
      ?.toLowerCase();

    if (searchTerm) {
      baseConstraints.push(
        where("location.searchKeywords", "array-contains", searchTerm)
      );
    }
  }

  // Add pagination constraints
  if (lastDoc) {
    baseConstraints.push(startAfter(lastDoc));
  }
  baseConstraints.push(limit(pageSize));

  // Create and execute the query
  const listingsQuery = query(collection(db, "listings"), ...baseConstraints);
  const querySnapshot = await getDocs(listingsQuery);

  // Transform the results and filter by price
  const listings = querySnapshot.docs
    .filter((doc) => {
      const price = doc.data().price;
      return (
        (!params.minPrice || price >= params.minPrice) &&
        (!params.maxPrice || price <= params.maxPrice)
      );
    })
    .map((doc) => ({
      ...doc.data(),
      id: doc.id,
    })) as ListingDocument[];

  // Handle bathrooms filter in memory since it's less commonly used
  const filteredListings = params.bathrooms
    ? listings.filter((listing) => {
        const bathroomsNum = parseInt(params.bathrooms!);
        if (params.bathrooms === "4+") {
          return listing.bathrooms >= 4;
        }
        return listing.bathrooms === bathroomsNum;
      })
    : listings;

  return {
    listings: filteredListings.slice(0, pageSize),
    lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
  };
};

export const getLocationSuggestions = async (
  searchTerm: string,
  field: "area" | "city" | "neighborhood"
): Promise<string[]> => {
  if (!searchTerm || searchTerm.length < 3) return [];

  const searchTermLower = searchTerm.toLowerCase();

  // Query using searchKeywords instead of direct field
  const q = query(
    collection(db, "listings"),
    where("status", "==", "published"),
    where("location.searchKeywords", "array-contains", searchTermLower),
    limit(5)
  );

  const querySnapshot = await getDocs(q);

  // Extract unique location values from the specific field
  const suggestions = new Set<string>();
  querySnapshot.docs.forEach((doc) => {
    const location = doc.data().location[field];
    if (location && location.toLowerCase().includes(searchTermLower)) {
      suggestions.add(location);
    }
  });

  return Array.from(suggestions);
};

// Listing functions
export const createListing = async (
  listing: Omit<Listing, "id" | "status" | "createdAt" | "updatedAt" | "slug">,
  images: File[],
  status: ListingStatus = "pending_review"
): Promise<string> => {
  // Generate a unique slug from the listing title
  const slug = await generateUniqueSlug(listing.title, checkSlugExists);

  // Create a new document reference with the slug as the ID
  const listingRef = doc(collection(db, "listings"), slug);
  const timestamp = Timestamp.now();

  try {
    // Upload images first
    const imageUrls: string[] = [];
    const photos: Photo[] = [];

    for (const image of images) {
      const url = await uploadImage(image, slug, listing.landlordId);
      imageUrls.push(url);
      photos.push({
        id: `photo_${photos.length}`,
        url,
        isPrimary: photos.length === 0,
      });
    }

    // Generate search keywords from location
    const searchKeywords = generateLocationSearchKeywords(
      listing.location.area,
      listing.location.city,
      listing.location.neighborhood
    );

    // Create the listing data with the slug and search keywords
    const listingData: ListingDocument = {
      ...listing,
      id: slug,
      slug,
      status,
      createdAt: timestamp,
      updatedAt: timestamp,
      flagCount: 0,
      bookmarkCount: 0,
      viewCount: 0,
      flags: [],
      FLAG_THRESHOLD: 5,
      photos,
      imageUrls,
      verifiedAt: null,
      verifiedBy: null,
      publishedAt: null,
      archivedAt: null,
      location: {
        ...listing.location,
        searchKeywords,
      },
    };

    // Validate the data
    const validationResult = listingSchema.safeParse({
      ...listingData,
      createdAt: timestamp.toDate(),
      updatedAt: timestamp.toDate(),
    });

    if (!validationResult.success) {
      throw new Error(
        `Validation failed: ${validationResult.error.errors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    await setDoc(listingRef, listingData);
    globalCache.invalidate("listings_");
    return listingRef.id;
  } catch (error) {
    console.error("Firestore create error:", error);
    throw error;
  }
};

// firestore.ts
export const updateListing = async (
  listingId: string,
  updates: Partial<Omit<Listing, "id" | "status" | "createdAt" | "updatedAt">>,
  images: File[] = [],
  userId: string
): Promise<void> => {
  const listingRef = doc(db, "listings", listingId);
  const userDoc = await getDoc(doc(db, "users", userId));

  // Always set status to pending_review for non-admin users
  if (userDoc.exists() && userDoc.data().role !== "admin") {
    (updates as Partial<Listing>).status = "pending_review";
  }
  // Upload new images
  const imageUrls: string[] = [];
  const photos: Photo[] = [];

  if (images.length > 0) {
    for (const image of images) {
      const url = await uploadImage(image, listingId, userId);
      imageUrls.push(url);
      photos.push({
        id: `photo_${photos.length}`,
        url,
        isPrimary: photos.length === 0,
      });
    }
  }

  // Merge updates with image data
  const mergedUpdates = {
    ...updates,
    ...(images.length > 0 && { imageUrls, photos }),
    updatedAt: serverTimestamp(),
  };

  // Validate and update
  const currentDoc = await getDoc(listingRef);
  if (!currentDoc.exists()) throw new Error("Listing not found");

  const validationData = {
    ...currentDoc.data(),
    ...mergedUpdates,
    id: listingId,
    createdAt: currentDoc.data().createdAt.toDate(),
    updatedAt: new Date(),
  };

  const validationResult = listingSchema.safeParse(validationData);
  if (!validationResult.success) {
    throw new Error(
      `Validation failed: ${validationResult.error.errors
        .map((e) => e.message)
        .join(", ")}`
    );
  }

  await updateDoc(listingRef, mergedUpdates);
  globalCache.invalidate("listings_");
};

const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "") // Remove special characters
    .replace(/\s+/g, " "); // Normalize spaces
};

export const generateLocationSearchKeywords = (
  area: string,
  city: string,
  neighborhood: string
): string[] => {
  const keywords = new Set<string>();
  const locations = [area, city, neighborhood];

  // Process each location field
  locations.forEach((location) => {
    const normalizedLocation = normalizeText(location);
    const words = normalizedLocation.split(" ");

    // Add individual words
    words.forEach((word) => {
      if (word.length >= 2) {
        keywords.add(word);
      }
    });

    // Add pairs of consecutive words
    for (let i = 0; i < words.length - 1; i++) {
      keywords.add(`${words[i]} ${words[i + 1]}`);
    }

    // Add complete normalized location
    keywords.add(normalizedLocation);

    // Add partial matches (substrings of 2 or more characters)
    words.forEach((word) => {
      for (let i = 0; i < word.length - 1; i++) {
        for (let j = i + 2; j <= word.length; j++) {
          keywords.add(word.slice(i, j));
        }
      }
    });
  });

  return Array.from(keywords);
};

export const getListingsByStatus = async (
  status: ListingStatus,
  lastDoc?: QueryDocumentSnapshot<ListingDocument>,
  pageSize: number = LISTINGS_PER_PAGE
): Promise<ListingDocument[]> => {
  const cacheKey = `listings_${status}_${lastDoc?.id}_${pageSize}`;

  const cached = globalCache.get(cacheKey);

  if (cached) {
    return cached as ListingDocument[];
  }

  let q = query(
    collection(db, "listings"),
    where("status", "==", status),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snapshot = await getDocs(q);
  const listings = snapshot.docs.map((doc) => ({
    ...convertTimestamps(doc),
    id: doc.id,
  })) as ListingDocument[];

  globalCache.set(cacheKey, listings);
  return listings;
};

export const getLandlordListings = async (
  landlordId: string,
  status?: ListingStatus
): Promise<ListingDocument[]> => {
  const cacheKey = `landlord_listings_${landlordId}_${status ?? "all"}`;
  const cached = globalCache.get(cacheKey);

  if (cached) {
    return cached as ListingDocument[];
  }

  let q = query(
    collection(db, "listings"),
    where("landlordId", "==", landlordId),
    orderBy("createdAt", "desc") // Must match index ordering
  );

  if (status) {
    q = query(
      q,
      where("status", "==", status),
      orderBy("status") // Add this if filtering by status
    );
  }

  const snapshot = await getDocs(q);
  const listings = snapshot.docs.map((doc) => ({
    ...convertTimestamps(doc),
    id: doc.id,
  })) as ListingDocument[];

  globalCache.set(cacheKey, listings);
  return listings;
};

export const updateListingStatus = async (
  listingId: string,
  status: ListingStatus,
  adminId?: string
): Promise<void> => {
  await runTransaction(db, async (transaction) => {
    const listingRef = doc(db, "listings", listingId);
    const timestamp = serverTimestamp();

    const updateData: Partial<ListingDocument> = {
      status,
      updatedAt: timestamp as any,
    };

    if (status === "published") {
      updateData.publishedAt = timestamp as any;
      updateData.verifiedAt = timestamp as any;
      updateData.verifiedBy = adminId;
    } else if (status === "archived" || status === "recalled") {
      updateData.archivedAt = timestamp as any;
    }

    transaction.update(listingRef, updateData);
  });
  globalCache.invalidate("listings_");
};

// Bookmark functions
export const toggleBookmark = async (
  userId: string,
  listingId: string
): Promise<boolean> => {
  const bookmarkId = `${userId}_${listingId}`;
  const bookmarkRef = doc(db, "bookmarks", bookmarkId);
  const listingRef = doc(db, "listings", listingId);

  try {
    return await runTransaction(db, async (transaction) => {
      // First verify the listing exists
      const listingDoc = await transaction.get(listingRef);
      if (!listingDoc.exists()) {
        throw new Error("Listing not found");
      }

      // Then check bookmark status
      const bookmarkDoc = await transaction.get(bookmarkRef);
      const isBookmarking = !bookmarkDoc.exists();

      if (isBookmarking) {
        const bookmarkData: BookmarkDocument = {
          userId,
          listingId,
          id: bookmarkId,
          createdAt: Timestamp.now(),
        };
        transaction.set(bookmarkRef, bookmarkData);
        transaction.update(listingRef, { bookmarkCount: increment(1) });
      } else {
        transaction.delete(bookmarkRef);
        transaction.update(listingRef, { bookmarkCount: increment(-1) });
      }

      return isBookmarking;
    });
  } catch (error) {
    console.error("Error toggling bookmark:", error);
    throw error;
  }
};

export const getUserBookmarks = async (userId: string) => {
  const cacheKey = `user_bookmarks_${userId}`;
  const cached = globalCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const q = query(
    collection(db, "bookmarks"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);
  const bookmarks = snapshot.docs.map(convertTimestamps);

  globalCache.set(cacheKey, bookmarks);
  return bookmarks;
};

// Flag functions
// In firestore.ts
export const flagListing = async (
  listingId: string,
  flag: Omit<Flag, "createdAt" | "resolved" | "resolvedAt" | "resolvedBy">
): Promise<void> => {
  const listingRef = doc(db, "listings", listingId);

  await runTransaction(db, async (transaction) => {
    const listingDoc = await transaction.get(listingRef);
    if (!listingDoc.exists()) {
      throw new Error("Listing not found");
    }

    const listingData = listingDoc.data() as ListingDocument;
    const timestamp = Timestamp.now();

    // Create the new flag
    const newFlag: Flag = {
      ...flag,
      createdAt: timestamp.toDate(),
      resolved: false,
    };

    const newFlags = [...(listingData.flags || []), newFlag];
    const newFlagCount = (listingData.flagCount || 0) + 1;

    // Update analytics collection
    const analyticsRef = doc(db, "analytics", listingId);
    const analyticsDoc = await transaction.get(analyticsRef);

    if (analyticsDoc.exists()) {
      transaction.update(analyticsRef, {
        flagCount: increment(1),
        lastUpdated: serverTimestamp(),
      });
    } else {
      transaction.set(analyticsRef, {
        listingId,
        flagCount: 1,
        viewCount: 0,
        bookmarkCount: 0,
        lastUpdated: serverTimestamp(),
      });
    }

    // Let the cloud function handle status changes and notifications
    transaction.update(listingRef, {
      flags: newFlags,
      flagCount: newFlagCount,
      updatedAt: serverTimestamp(),
    });
  });

  globalCache.invalidate("listings_");
};

export const resolveListing = async (
  listingId: string,
  flagId: string,
  adminId: string,
  resolution: "approve" | "remove"
): Promise<void> => {
  const listingRef = doc(db, "listings", listingId);
  const timestamp = Timestamp.now();

  const listing = await getDoc(listingRef);
  if (!listing.exists()) {
    throw new Error("Listing not found");
  }

  const listingData = listing.data() as ListingDocument;
  const updatedFlags = listingData.flags.map((flag) =>
    flag.id === flagId
      ? { ...flag, resolved: true, resolvedAt: timestamp, resolvedBy: adminId }
      : flag
  );

  const batch = writeBatch(db);
  batch.update(listingRef, {
    flags: updatedFlags,
    status: resolution === "approve" ? "published" : "recalled",
    ...(resolution === "approve"
      ? { verifiedAt: timestamp, verifiedBy: adminId }
      : { archivedAt: timestamp }),
  });

  await batch.commit();
  globalCache.invalidate("listings_");
};

// Admin notification functions
export const createAdminNotification = async (
  notification: Omit<AdminNotification, "id" | "createdAt" | "read" | "readAt">
): Promise<string> => {
  const notificationRef = doc(collection(db, "adminNotifications"));
  const timestamp = Timestamp.now();

  const notificationData: AdminNotificationDocument = {
    ...notification,
    id: notificationRef.id,
    createdAt: timestamp,
    read: false,
  };

  // Optional: Add validation if you create a schema for AdminNotification
  await setDoc(notificationRef, notificationData);
  globalCache.invalidate("admin_notifications");
  return notificationRef.id;
};

export const getAdminNotifications = async (
  onlyUnread = false,
  limitCount = 50
) => {
  const cacheKey = `admin_notifications_${onlyUnread}_${limitCount}`;
  const cached = globalCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  let q = query(
    collection(db, "adminNotifications"),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  if (onlyUnread) {
    q = query(q, where("read", "==", false));
  }

  const snapshot = await getDocs(q);
  const notifications = snapshot.docs.map(convertTimestamps);

  globalCache.set(cacheKey, notifications);
  return notifications;
};

export const markNotificationAsRead = async (
  notificationId: string
): Promise<void> => {
  const notificationRef = doc(db, "adminNotifications", notificationId);
  await updateDoc(notificationRef, {
    read: true,
    readAt: Timestamp.now(),
  });

  globalCache.invalidate("admin_notifications");
};

// Listing view tracking
export const incrementListingView = async (
  listingId: string
): Promise<void> => {
  const listingRef = doc(db, "listings", listingId);
  await updateDoc(listingRef, {
    viewCount: increment(1),
  });
};

// Batch operations
export const batchUpdateListings = async (
  updates: Array<{ id: string; data: Partial<ListingDocument> }>
): Promise<void> => {
  const batches: WriteBatch[] = [];
  const batchSize = 500; // Firestore limit

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = writeBatch(db);
    const batchUpdates = updates.slice(i, i + batchSize);

    batchUpdates.forEach(({ id, data }) => {
      const ref = doc(db, "listings", id);
      batch.update(ref, { ...data, updatedAt: Timestamp.now() });
    });

    batches.push(batch);
  }

  await Promise.all(batches.map((batch) => batch.commit()));
  globalCache.invalidate("listings_");
};

// Cleanup functions
export const deleteExpiredDrafts = async (daysOld = 30): Promise<void> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

  const q = query(
    collection(db, "listings"),
    where("status", "==", "draft"),
    where("updatedAt", "<=", cutoffTimestamp)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  globalCache.invalidate("listings_");
};

export const cleanupOldNotifications = async (daysOld = 30): Promise<void> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

  const q = query(
    collection(db, "adminNotifications"),
    where("read", "==", true),
    where("createdAt", "<=", cutoffTimestamp)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  globalCache.invalidate("admin_notifications");
};
// Add this new function at the end of the file
// export const migrateListingSlugs = async (): Promise<{ success: boolean; processed: number; errors: string[] }> => {
//   const batchSize = 500; // Firestore batch limit
//   let processed = 0;
//   let hasMore = true;
//   let lastDoc: QueryDocumentSnapshot | null = null;
//   const errors: string[] = [];
//   const slugMap = new Map<string, number>(); // Track slug counts for proper suffixing

//   try {
//     while (hasMore) {
//       let q = query(
//         collection(db, "listings"),
//         orderBy("createdAt", "desc"),
//         limit(batchSize)
//       );

//       if (lastDoc) {
//         q = query(q, startAfter(lastDoc));
//       }

//       const snapshot = await getDocs(q);

//       if (snapshot.empty) {
//         hasMore = false;
//         continue;
//       }

//       const batch = writeBatch(db);

//       // Process documents sequentially to handle duplicates properly
//       for (const doc of snapshot.docs) {
//         const data = doc.data();
//         if (!data.title) {
//           errors.push(`Document ${doc.id} has no title, skipping`);
//           continue;
//         }

//         // Generate base slug
//         const baseSlug = slugify(data.title);

//         // Get current count for this base slug
//         const currentCount = slugMap.get(baseSlug) || 0;
//         slugMap.set(baseSlug, currentCount + 1);

//         // Generate final slug with suffix if needed
//         const finalSlug = currentCount === 0 ? baseSlug : `${baseSlug}-${currentCount}`;

//         try {
//           // Create new document with slug as ID
//           const newDocRef = doc(db, "listings", finalSlug);

//           // Prepare the new document data
//           const newData = {
//             ...data,
//             id: finalSlug,
//             slug: finalSlug,
//             updatedAt: serverTimestamp()
//           };

//           // Set the new document and delete the old one
//           batch.set(newDocRef, newData);
//           batch.delete(doc.ref);

//           processed++;
//         } catch (error: any) {
//           errors.push(`Failed to process document ${doc.id}: ${error.message}`);
//         }
//       }

//       try {
//         await batch.commit();
//         lastDoc = snapshot.docs[snapshot.docs.length - 1];
//       } catch (error: any) {
//         errors.push(`Batch update failed: ${error.message}`);
//         continue;
//       }
//     }

//     globalCache.invalidate("listings_");
//     return { success: true, processed, errors };
//   } catch (error: any) {
//     return {
//       success: false,
//       processed,
//       errors: [...errors, `Migration failed: ${error.message}`]
//     };
//   }
// };

// // Add a new function to verify the migration results
// export const verifyListingSlugs = async (): Promise<{
//   total: number;
//   withSlug: number;
//   withoutSlug: number;
//   duplicates: { slug: string; count: number }[];
// }> => {
//   const slugCounts = new Map<string, number>();
//   let total = 0;
//   let withSlug = 0;
//   let withoutSlug = 0;
//   let lastDoc: QueryDocumentSnapshot | null = null;
//   let hasMore = true;

//   while (hasMore) {
//     let q = query(
//       collection(db, "listings"),
//       orderBy("createdAt", "desc"),
//       limit(500)
//     );

//     if (lastDoc) {
//       q = query(q, startAfter(lastDoc));
//     }

//     const snapshot = await getDocs(q);

//     if (snapshot.empty) {
//       hasMore = false;
//       continue;
//     }

//     for (const doc of snapshot.docs) {
//       total++;
//       const data = doc.data();

//       if (data.slug) {
//         withSlug++;
//         slugCounts.set(data.slug, (slugCounts.get(data.slug) || 0) + 1);
//       } else {
//         withoutSlug++;
//       }
//     }

//     lastDoc = snapshot.docs[snapshot.docs.length - 1];
//   }

//   const duplicates = Array.from(slugCounts.entries())
//     .filter(([_, count]) => count > 1)
//     .map(([slug, count]) => ({ slug, count }));

//   return {
//     total,
//     withSlug,
//     withoutSlug,
//     duplicates
//   };
// };
