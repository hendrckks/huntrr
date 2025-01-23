import { db, storage } from "./clientApp";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type DocumentSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  type Listing,
  type ListingQuery,
  listingSchema,
  ListingStatus,
  type ListingNotification,
} from "../types/Listing";
import {
  CustomError,
  NotFoundError,
} from "../../../shared/CustomErrors";

const LISTINGS_COLLECTION = "listings";
const NOTIFICATIONS_COLLECTION = "notifications";

export const addListing = async (
  listing: Omit<
    Listing,
    "id" | "createdAt" | "updatedAt" | "status" | "searchKeywords"
  >
): Promise<string> => {
  try {
    const newListing = {
      ...listing,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: ListingStatus.Enum.draft,
      searchKeywords: generateSearchKeywords(listing),
    };

    const validatedListing = listingSchema.parse(newListing);
    const docRef = await addDoc(
      collection(db, LISTINGS_COLLECTION),
      validatedListing
    );
    return docRef.id;
  } catch (error) {
    console.error("Error adding listing:", error);
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(
      "UNKNOWN",
      "An unexpected error occurred while adding the listing"
    );
  }
};

export const updateListing = async (
  id: string,
  listing: Partial<Listing>
): Promise<void> => {
  try {
    const updatedListing = {
      ...listing,
      updatedAt: serverTimestamp(),
      searchKeywords: generateSearchKeywords(listing),
    };

    await updateDoc(doc(db, LISTINGS_COLLECTION, id), updatedListing);
  } catch (error) {
    console.error("Error updating listing:", error);
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(
      "UNKNOWN",
      "An unexpected error occurred while updating the listing"
    );
  }
};

export const deleteListing = async (id: string): Promise<void> => {
  try {
    // Delete associated images from storage
    const listing = await getListing(id);
    if (listing && listing.photos) {
      for (const photo of listing.photos) {
        await deleteListingImage(photo.url);
      }
    }

    await deleteDoc(doc(db, LISTINGS_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting listing:", error);
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(
      "UNKNOWN",
      "An unexpected error occurred while deleting the listing"
    );
  }
};

export const getListing = async (id: string): Promise<Listing> => {
  try {
    const docSnap = await getDoc(doc(db, LISTINGS_COLLECTION, id));
    if (!docSnap.exists()) {
      throw new NotFoundError(`Listing with ID ${id} not found`);
    }
    return docSnap.data() as Listing;
  } catch (error) {
    console.error("Error getting listing:", error);
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(
      "UNKNOWN",
      "An unexpected error occurred while fetching the listing"
    );
  }
};

export const getListings = async (
  queryParams: ListingQuery
): Promise<{ listings: Listing[]; lastVisible: DocumentSnapshot | null }> => {
  try {
    const { filters, sort, limit: queryLimit = 10, lastVisible } = queryParams;

    let q = query(collection(db, LISTINGS_COLLECTION));

    if (filters) {
      if (filters.type) q = query(q, where("type", "==", filters.type));
      if (filters.minPrice)
        q = query(q, where("price", ">=", filters.minPrice));
      if (filters.maxPrice)
        q = query(q, where("price", "<=", filters.maxPrice));
      if (filters.bedrooms)
        q = query(q, where("bedrooms", "==", filters.bedrooms));
      if (filters.status) q = query(q, where("status", "==", filters.status));
    }

    if (sort) {
      q = query(q, orderBy(sort.field, sort.direction));
    } else {
      // Default sorting
      q = query(q, orderBy("createdAt", "desc"));
    }

    q = query(q, limit(queryLimit));

    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    const querySnapshot = await getDocs(q);
    const listings = querySnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Listing)
    );
    const newLastVisible =
      querySnapshot.docs[querySnapshot.docs.length - 1] || null;

    return { listings, lastVisible: newLastVisible };
  } catch (error) {
    console.error("Error getting listings:", error);
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(
      "UNKNOWN",
      "An unexpected error occurred while fetching listings"
    );
  }
};

export const uploadListingImage = async (
  file: File,
  listingId: string
): Promise<string> => {
  try {
    const storageRef = ref(storage, `listings/${listingId}/${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  } catch (error) {
    console.error("Error uploading listing image:", error);
    throw new CustomError("UPLOAD_ERROR", "Failed to upload listing image");
  }
};

export const deleteListingImage = async (imageUrl: string): Promise<void> => {
  try {
    const imageRef = ref(storage, imageUrl);
    await deleteObject(imageRef);
  } catch (error) {
    console.error("Error deleting listing image:", error);
    throw new CustomError("DELETE_ERROR", "Failed to delete listing image");
  }
};

export const submitListingForVerification = async (
  id: string
): Promise<void> => {
  try {
    await updateDoc(doc(db, LISTINGS_COLLECTION, id), {
      status: ListingStatus.Enum.awaiting_verification,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error submitting listing for verification:", error);
    throw new CustomError(
      "SUBMISSION_ERROR",
      "Failed to submit listing for verification"
    );
  }
};

export const verifyListing = async (id: string): Promise<void> => {
  try {
    await updateDoc(doc(db, LISTINGS_COLLECTION, id), {
      status: ListingStatus.Enum.published,
      verificationDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error verifying listing:", error);
    throw new CustomError("VERIFICATION_ERROR", "Failed to verify listing");
  }
};

export const draftListing = async (id: string): Promise<void> => {
  try {
    await updateDoc(doc(db, LISTINGS_COLLECTION, id), {
      status: ListingStatus.Enum.draft,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error drafting listing:", error);
    throw new CustomError("DRAFT_ERROR", "Failed to set listing as draft");
  }
};

export const addNotification = async (
  notification: Omit<ListingNotification, "id" | "createdAt" | "read">
): Promise<string> => {
  try {
    const newNotification = {
      ...notification,
      createdAt: serverTimestamp(),
      read: false,
    };

    const docRef = await addDoc(
      collection(db, NOTIFICATIONS_COLLECTION),
      newNotification
    );
    return docRef.id;
  } catch (error) {
    console.error("Error adding notification:", error);
    throw new CustomError("NOTIFICATION_ERROR", "Failed to add notification");
  }
};

export const getNotifications = async (
  landlordId: string
): Promise<ListingNotification[]> => {
  try {
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("landlordId", "==", landlordId),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as ListingNotification)
    );
  } catch (error) {
    console.error("Error getting notifications:", error);
    throw new CustomError(
      "NOTIFICATION_ERROR",
      "Failed to fetch notifications"
    );
  }
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
  try {
    await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), { read: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw new CustomError(
      "NOTIFICATION_ERROR",
      "Failed to mark notification as read"
    );
  }
};

// Optimize search keyword generation
export const generateSearchKeywords = (listing: Partial<Listing>): string[] => {
  const keywords = new Set<string>();
  const addTerm = (term: string) => {
    const words = term.toLowerCase().split(/\s+/);
    words.forEach((word) => {
      if (word.length >= 2) {
        keywords.add(word);
        // Add partial matches for words longer than 4 characters
        if (word.length > 4) {
          for (let i = 2; i < word.length; i++) {
            keywords.add(word.slice(0, i));
          }
        }
      }
    });
    // Add consecutive word pairs
    for (let i = 0; i < words.length - 1; i++) {
      keywords.add(`${words[i]} ${words[i + 1]}`);
    }
  };

  if (listing.title) addTerm(listing.title);
  if (listing.description) addTerm(listing.description);
  if (listing.location?.address) addTerm(listing.location.address);
  if (listing.location?.area) addTerm(listing.location.area);
  if (listing.location?.neighborhood) addTerm(listing.location.neighborhood);
  if (listing.location?.city) addTerm(listing.location.city);

  if (listing.type) keywords.add(listing.type.toLowerCase());

  if (listing.bedrooms !== undefined) {
    keywords.add(`${listing.bedrooms}br`);
    keywords.add(`${listing.bedrooms}bed`);
    keywords.add(`${listing.bedrooms}bedroom`);
  }

  if (listing.price) {
    const priceRanges = [
      `under${Math.ceil(listing.price / 1000)}k`,
      `${Math.floor(listing.price / 1000)}kto${Math.ceil(
        listing.price / 1000
      )}k`,
      `price${Math.floor(listing.price / 1000)}k`,
    ];
    priceRanges.forEach((range) => keywords.add(range));
  }

  if (listing.condition) {
    keywords.add(listing.condition.toLowerCase());
    keywords.add(listing.condition.replace(/_/g, " ").toLowerCase());
  }

  if (listing.utilities?.includedUtilities) {
    listing.utilities.includedUtilities.forEach((utility) => {
      keywords.add(utility.toLowerCase());
    });
  }

  return Array.from(keywords);
};
