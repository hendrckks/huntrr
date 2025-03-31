import { z } from "zod";
import type { Timestamp } from "firebase/firestore";

// Base Enums
export const PropertyType = z.enum(["apartment", "house", "studio", "villa"]);
export type PropertyType = z.infer<typeof PropertyType>;

export const coordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});
export type Coordinates = z.infer<typeof coordinatesSchema>;

export const ListingStatus = z.enum([
  "draft",
  "pending_review",
  "published",
  "archived",
  "recalled",
  "denied",
]);
export type ListingStatus = z.infer<typeof ListingStatus>;

export const PropertyCondition = z.enum([
  "new",
  "excellent",
  "good",
  "requires_minor_repairs",
  "requires_major_repairs",
]);
export type PropertyCondition = z.infer<typeof PropertyCondition>;

export const NoiseLevel = z.enum([
  "very_quiet",
  "quiet",
  "moderate",
  "noisy",
  "very_noisy",
]);
export type NoiseLevel = z.infer<typeof NoiseLevel>;

export const WaterAvailability = z.enum([
  "24_7",
  "scheduled_daily",
  "scheduled_weekly",
  "irregular",
]);
export type WaterAvailability = z.infer<typeof WaterAvailability>;

export const CarrierCoverage = z.enum([
  "excellent",
  "good",
  "fair",
  "poor",
  "no_coverage",
]);
export type CarrierCoverage = z.infer<typeof CarrierCoverage>;

// Flag schemas
export const FlagReason = z.enum([
  "scam",
  "inappropriate",
  "misleading",
  "wrong_information",
  "other",
]);
export type FlagReason = z.infer<typeof FlagReason>;

export const flagSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  reason: FlagReason,
  description: z.string().min(1).max(500),
  createdAt: z.date(),
  resolved: z.boolean().default(false),
  resolvedBy: z.string().optional(),
  resolvedAt: z.date().optional(),
});
export type Flag = z.infer<typeof flagSchema>;

// Photo schema
export const photoSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  caption: z.string().optional(),
  isPrimary: z.boolean(),
});
export type Photo = z.infer<typeof photoSchema>;

// Location schema
export const locationSchema = z.object({
  address: z.string().min(1, "Address is required"),
  area: z.string().min(1, "Area is required"),
  neighborhood: z.string().min(1, "Neighborhood is required"),
  city: z.string().min(1, "City is required"),
  searchKeywords: z.array(z.string()).optional(),
  coordinates: coordinatesSchema.optional(),
  hasMapLocation: z.boolean().optional().default(false),
});
export type Location = z.infer<typeof locationSchema>;

// Utilities schema
export const utilitiesSchema = z.object({
  carrierCoverage: CarrierCoverage,
  waterAvailability: WaterAvailability,
  includedUtilities: z.array(z.string().trim().min(1)),
});
export type Utilities = z.infer<typeof utilitiesSchema>;

// Security schema
export const securitySchema = z.object({
  hasGuard: z.boolean(),
  hasCCTV: z.boolean(),
  hasSecureParking: z.boolean(),
  additionalSecurity: z.array(z.string()).optional(),
});
export type Security = z.infer<typeof securitySchema>;

// Terms schema
export const termsSchema = z.object({
  depositAmount: z.number().nonnegative(),
  leaseLength: z.number().positive(),
  petsAllowed: z.boolean(),
  smokingAllowed: z.boolean(),
  utilityResponsibilities: z.array(z.string()),
  additionalRules: z.array(z.string()).optional(),
});
export type Terms = z.infer<typeof termsSchema>;

// Main listing schema
// In the listingSchema definition
export const listingSchema = z.object({
  id: z.string(),
  slug: z.string().optional(), // Changed from optional to required
  imageUrls: z.array(z.string()).optional(),
  photos: z.array(photoSchema).optional(),
  title: z.string().min(5).max(100),
  type: PropertyType,
  price: z.number().positive(),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().positive(),
  description: z.string().min(20),
  condition: PropertyCondition,
  squareFootage: z.number().positive(),

  location: locationSchema,
  utilities: utilitiesSchema,
  security: securitySchema,
  noiseLevel: NoiseLevel,
  terms: termsSchema,

  landlordId: z.string(),
  landlordName: z.string(),
  landlordContact: z.object({
    phone: z.string(),
    email: z.string().email().optional(),
    showEmail: z.boolean(),
  }),

  // Metadata
  status: ListingStatus,
  rejectionReason: z.string().optional(),
  flags: z.array(flagSchema),
  flagCount: z.number().min(0),
  bookmarkCount: z.number().min(0),
  viewCount: z.number().min(0),

  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
  verifiedAt: z.date().nullable(),
  verifiedBy: z.string().nullable(),

  // Configuration
  FLAG_THRESHOLD: z.number().int().min(1).default(5),
});

export type Listing = z.infer<typeof listingSchema>;

// schema for the form data
export const listingFormSchema = z.object({
  title: z.string().min(5).max(100),
  type: PropertyType,
  price: z.number().positive(),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().positive(),
  description: z.string().min(20),
  condition: PropertyCondition,
  squareFootage: z.number().positive(),

  location: locationSchema,
  utilities: utilitiesSchema,
  security: securitySchema,
  noiseLevel: NoiseLevel,
  terms: termsSchema,

  landlordName: z.string(),
  landlordContact: z.object({
    phone: z.string(),
    email: z.string().email().optional(),
    showEmail: z.boolean(),
  }),
});

// Bookmark schema
export const bookmarkSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  listingId: z.string(),
  createdAt: z.date(),
});
export type Bookmark = z.infer<typeof bookmarkSchema>;

// Admin notification schema
export const notificationSchema = z.object({
  id: z.string().optional(),
  type: z.enum([
    "new_listing",
    "flag_threshold_reached",
    "listing_updated",
    "listing_deleted",
    "other",
  ]),
  title: z.string(),
  message: z.string(),
  relatedListingId: z.string().optional(),
  createdAt: z.date(),
  read: z.boolean().default(false),
  readAt: z.date().optional(),
});
export type AdminNotification = z.infer<typeof notificationSchema>;

// Firestore document types
export interface ListingDocument
  extends Omit<
    Listing,
    "createdAt" | "updatedAt" | "publishedAt" | "archivedAt" | "verifiedAt"
  > {
  slug: string; // Add this line
  photos?: Photo[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt: Timestamp | null;
  archivedAt: Timestamp | null;
  verifiedAt: Timestamp | null;
  verifiedBy: string | null;
}

export type ListingFormData = Omit<Listing, "id">;
export interface BookmarkDocument extends Omit<Bookmark, "createdAt"> {
  createdAt: Timestamp;
}

export interface AdminNotificationDocument
  extends Omit<AdminNotification, "createdAt" | "readAt"> {
  createdAt: Timestamp;
  readAt?: Timestamp;
}
