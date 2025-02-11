import { firestore } from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

// Base Enums
export const PropertyType = {
  apartment: "apartment",
  house: "house",
  studio: "studio",
  villa: "villa",
} as const;
export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];

export const ListingStatus = {
  draft: "draft",
  pending_review: "pending_review",
  published: "published",
  archived: "archived",
  recalled: "recalled",
  denied: "denied",
} as const;
export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

export const FlagReason = {
  scam: "scam",
  inappropriate: "inappropriate",
  misleading: "misleading",
  wrong_information: "wrong_information",
  other: "other",
} as const;
export type FlagReason = (typeof FlagReason)[keyof typeof FlagReason];

// Basic interfaces needed for the backend
interface Flag {
  id?: string;
  userId: string;
  reason: FlagReason;
  description: string;
  createdAt: Timestamp;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: firestore.Timestamp;
}

interface Photo {
  id: string;
  url: string;
  caption?: string;
  isPrimary: boolean;
}

interface Location {
  address: string;
  area: string;
  neighborhood: string;
  city: string;
}

// Firestore document types
export interface ListingDocument {
  id: string;
  title: string;
  type: PropertyType;
  price: number;
  description: string;
  photos: Photo[];
  location: Location;
  status: ListingStatus;

  landlordId: string;
  landlordName: string;
  landlordContact: {
    phone: string;
    email?: string;
    showEmail: boolean;
  };

  flags: Flag[];
  flagCount: number;
  FLAG_THRESHOLD: number;

  createdAt: firestore.Timestamp;
  updatedAt: firestore.Timestamp;
  publishedAt?: firestore.Timestamp;
  archivedAt?: firestore.Timestamp;
  verifiedAt?: firestore.Timestamp;
  verifiedBy?: string;
}

export interface BookmarkDocument {
  id?: string;
  userId: string;
  listingId: string;
  createdAt: firestore.Timestamp;
}

export interface AdminNotificationDocument {
  id: string;
  type:
    | "new_listing"
    | "flag_threshold_reached"
    | "listing_updated"
    | "kyc_submission"
    | "listing_deleted"
    | "other";
  title: string;
  message: string;
  relatedListingId?: string;
  createdAt: firestore.Timestamp;
  read: boolean;
  readAt?: firestore.Timestamp;
  relatedUserId?: string;
}

export type KYCStatus = "pending" | "approved" | "rejected";

export interface KYCDocument {
  id: string;
  userId: string;
  documentType: "national_id" | "passport" | "drivers_license";
  documentNumber: string;
  frontDocumentUrl: string;
  backDocumentUrl: string;
  selfieUrl: string;
  status: KYCStatus;
  personalInfo: {
    dateOfBirth: string;
    address: string;
    city: string;
    country: string;
    postalCode: string;
    phoneNumber: string;
  };
  submittedAt: Timestamp;
  reviewedAt?: Timestamp | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface KYCSubmission {
  documentType: "national_id" | "passport" | "drivers_license";
  documentNumber: string;
  frontDocumentFile: File;
  backDocumentFile: File;
  selfieFile: File;
  personalInfo: {
    dateOfBirth: string;
    address: string;
    city: string;
    country: string;
    postalCode: string;
    phoneNumber: string;
  };
}

