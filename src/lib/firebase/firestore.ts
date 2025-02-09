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

// Utility functions
const convertTimestamps = <T extends { [key: string]: any }>(
  doc: QueryDocumentSnapshot<T>
): T => {
  const data = doc.data();
  const result: { [key: string]: any } = {};

  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate();
    } else {
      result[key] = value;
    }
  }

  return result as T;
};

// Listing functions
export const createListing = async (
  listing: Omit<Listing, "id" | "status" | "createdAt" | "updatedAt">,
  images: File[],
  status: ListingStatus = "pending_review"
): Promise<string> => {
  const listingRef = doc(collection(db, "listings"));
  const timestamp = Timestamp.now();

  try {
    // Upload images first
    const imageUrls: string[] = [];
    const photos: Photo[] = [];

    for (const image of images) {
      const url = await uploadImage(image, listingRef.id, listing.landlordId);
      imageUrls.push(url);

      photos.push({
        id: `photo_${photos.length}`,
        url,
        isPrimary: photos.length === 0,
      });
    }

    // Create the listing data, explicitly setting optional fields to null instead of undefined
    const listingData: ListingDocument = {
      ...listing,
      id: listingRef.id,
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
      // Explicitly set optional fields to null
      verifiedAt: null,
      verifiedBy: null,
      publishedAt: null,
      archivedAt: null,
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

export const updateListing = async (
  listingId: string,
  updates: Partial<Omit<Listing, "id" | "status" | "createdAt" | "updatedAt">>
): Promise<void> => {
  const listingRef = doc(db, "listings", listingId);

  // First get the current listing to merge with updates
  const currentListing = await getDoc(listingRef);
  if (!currentListing.exists()) {
    throw new Error("Listing not found");
  }

  const currentData = currentListing.data() as ListingDocument;

  // Merge current data with updates
  const mergedData = {
    ...currentData,
    ...updates,
    updatedAt: serverTimestamp(),
  };

  // Validate the merged data
  const validationResult = listingSchema.safeParse({
    ...mergedData,
    id: listingId,
    createdAt: currentData.createdAt.toDate(),
    updatedAt: new Date(),
  });

  if (!validationResult.success) {
    throw new Error(
      `Validation failed: ${validationResult.error.errors
        .map((e) => e.message)
        .join(", ")}`
    );
  }

  await updateDoc(listingRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  globalCache.invalidate("listings_");
};

export const getListingsByStatus = async (
  status: ListingStatus,
  lastDoc?: QueryDocumentSnapshot<ListingDocument>,
  pageSize: number = LISTINGS_PER_PAGE
): Promise<ListingDocument[]> => {
  const cacheKey = `listings_${status}_${lastDoc?.id}_${pageSize}`;

  // Remove explicit type argument and use type inference
  const cached = globalCache.get(cacheKey);

  if (cached) {
    // Add type assertion since we know this cache entry contains ListingDocument[]
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
) => {
  const cacheKey = `landlord_listings_${landlordId}_${status ?? "all"}`;
  const cached = globalCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  let q = query(
    collection(db, "listings"),
    where("landlordId", "==", landlordId),
    orderBy("createdAt", "desc")
  );

  if (status) {
    q = query(q, where("status", "==", status));
  }

  const snapshot = await getDocs(q);
  const listings = snapshot.docs.map(convertTimestamps);

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
export const flagListing = async (
  listingId: string,
  flag: Omit<Flag, "createdAt" | "resolved" | "resolvedAt" | "resolvedBy">
): Promise<void> => {
  await runTransaction(db, async (transaction) => {
    const listingRef = doc(db, "listings", listingId);
    const listingDoc = await transaction.get(listingRef);

    if (!listingDoc.exists()) {
      throw new Error("Listing not found");
    }

    const listingData = listingDoc.data() as ListingDocument;
    const timestamp = Timestamp.now();

    const newFlag: Flag = {
      ...flag,
      createdAt: timestamp.toDate(),
      resolved: false,
    };

    const newFlags = [...listingData.flags, newFlag];
    const newFlagCount = listingData.flagCount + 1;

    const updates: Partial<ListingDocument> = {
      flags: newFlags,
      flagCount: newFlagCount,
      updatedAt: serverTimestamp() as any,
    };

    if (newFlagCount >= (listingData.FLAG_THRESHOLD || 5)) {
      updates.status = "recalled";
      updates.archivedAt = serverTimestamp() as any;

      // Create admin notification for recalled listing
      const notificationRef = doc(collection(db, "adminNotifications"));
      const notificationData: AdminNotificationDocument = {
        type: "flag_threshold_reached",
        title: "Listing Auto-Recalled",
        message: `Listing "${listingData.title}" has been auto-recalled due to reaching the flag threshold`,
        relatedListingId: listingId,
        createdAt: timestamp,
        read: false,
        id: notificationRef.id,
      };

      transaction.set(notificationRef, notificationData);
    }

    transaction.update(listingRef, updates);
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
