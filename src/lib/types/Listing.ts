import { z } from "zod";

// Enums
export const PropertyType = z.enum(["apartment", "house", "studio", "villa"]);
export type PropertyType = z.infer<typeof PropertyType>;

export const ListingStatus = z.enum([
  "draft",
  "awaiting_verification",
  "published",
  "archived",
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

// Enhanced text normalization function
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "") // Remove special characters
    .replace(/\s+/g, " "); // Normalize spaces
};

// Enhanced search keyword generation
export const generateSearchKeywords = (listing: Partial<Listing>): string[] => {
  const keywords = new Set<string>();

  // Helper function to add normalized terms
  const addTerms = (text: string | undefined) => {
    if (!text) return;
    const normalized = normalizeText(text);

    // Add full term
    keywords.add(normalized);

    // Add individual words
    const words = normalized.split(" ");
    words.forEach((word) => {
      if (word.length >= 2) {
        keywords.add(word);
      }
    });

    // Add consecutive word pairs
    for (let i = 0; i < words.length - 1; i++) {
      keywords.add(`${words[i]} ${words[i + 1]}`);
    }

    // Add consecutive word triplets
    for (let i = 0; i < words.length - 2; i++) {
      keywords.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }

    // Add partial matches (substrings of 2 or more characters)
    words.forEach((word) => {
      for (let i = 0; i < word.length - 1; i++) {
        for (let j = i + 2; j <= word.length; j++) {
          keywords.add(word.slice(i, j));
        }
      }
    });
  };

  // Process various listing fields
  if (listing.title) addTerms(listing.title);
  if (listing.description) addTerms(listing.description);
  if (listing.location?.address) addTerms(listing.location.address);
  if (listing.location?.area) addTerms(listing.location.area);
  if (listing.location?.neighborhood) addTerms(listing.location.neighborhood);
  if (listing.location?.city) addTerms(listing.location.city);

  // Add property type
  if (listing.type) keywords.add(listing.type.toLowerCase());

  // Add bedroom-specific keywords
  if (listing.bedrooms !== undefined) {
    keywords.add(`${listing.bedrooms}br`);
    keywords.add(`${listing.bedrooms}bed`);
    keywords.add(`${listing.bedrooms}bedroom`);
    keywords.add(`${listing.bedrooms} br`);
    keywords.add(`${listing.bedrooms} bed`);
    keywords.add(`${listing.bedrooms} bedroom`);
  }

  // Add price ranges
  if (listing.price) {
    const priceRanges = [
      `under${Math.ceil(listing.price / 1000)}k`,
      `${Math.floor(listing.price / 1000)}kto${Math.ceil(
        listing.price / 1000
      )}k`,
      `price${Math.floor(listing.price / 1000)}k`,
      `${Math.floor(listing.price / 1000)}k`,
    ];
    priceRanges.forEach((range) => keywords.add(range));
  }

  // Add condition keywords
  if (listing.condition) {
    keywords.add(listing.condition.toLowerCase());
    keywords.add(listing.condition.replace(/_/g, " ").toLowerCase());
  }

  // Add amenity-based keywords
  if (listing.utilities?.includedUtilities) {
    listing.utilities.includedUtilities.forEach((utility) => {
      keywords.add(normalizeText(utility));
    });
  }

  return Array.from(keywords);
};

// Main listing schema
export const listingSchema = z.object({
  // Basic Information
  id: z.string().uuid(),
  productId: z.string().min(1, "Product ID is required"),
  title: z.string().min(1, "Title is required").max(100),
  type: PropertyType,
  price: z.number().positive("Price must be positive"),
  searchKeywords: z.array(z.string()).optional(),

  // Property Details
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().positive(),
  description: z.string().min(10, "Description must be at least 10 characters"),
  condition: PropertyCondition,

  // Location & Accessibility
  location: z.object({
    address: z.string(),
    area: z.string(),
    neighborhood: z.string(),
    city: z.string(),
  }),

  // Amenities & Features
  utilities: z.object({
    carrierCoverage: CarrierCoverage,
    waterAvailability: WaterAvailability,
    includedUtilities: z.array(z.string()),
  }),

  // Security & Environment
  security: z.object({
    hasGuard: z.boolean(),
    hasCCTV: z.boolean(),
    hasSecureParking: z.boolean(),
    additionalSecurity: z.array(z.string()).optional(),
  }),
  noiseLevel: NoiseLevel,

  // Transportation
  publicTransport: z.object({
    busStopDistance: z.number().optional(),
    trainStationDistance: z.number().optional(),
    nearbyRoutes: z.array(z.string()).optional(),
  }),

  // Media
  photos: z
    .array(
      z.object({
        id: z.string(),
        url: z.string().url(),
        caption: z.string().optional(),
        isPrimary: z.boolean(),
      })
    )
    .min(1, "At least one photo is required")
    .max(8, "Maximum 8 photos allowed"),

  // Owner/Landlord Information
  landlord: z.object({
    uid: z.string(),
    firstName: z.string(),
    contactNumber: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
    email: z.string().email().optional(),
    showEmail: z.boolean().default(false),
  }),

  // Terms & Conditions
  terms: z.object({
    depositAmount: z.number().nonnegative(),
    leaseLength: z.number().positive(),
    petsAllowed: z.boolean(),
    smokingAllowed: z.boolean(),
    utilityResponsibilities: z.array(z.string()),
    additionalRules: z.array(z.string()).optional(),
  }),

  // Metadata
  metadata: z
    .object({
      views: z.number().int().default(0),
      favoriteCount: z.number().int().default(0),
      lastViewedAt: z.string().datetime().optional(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
      status: z
        .enum(["draft", "published", "under_review", "archived"])
        .default("draft"),
    })
    .optional(),

  //Listing status
  status: ListingStatus.default("draft"),
  verificationDate: z.date().optional(),
});

export type Listing = z.infer<typeof listingSchema>;

export interface ListingNotification {
  id: string;
  listingId: string;
  landlordId: string;
  message: string;
  type: "verification" | "publication" | "draft" | "deletion";
  createdAt: Date;
  read: boolean;
}

// Query interface for filtering listings
export interface ListingQuery {
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  propertyType?: PropertyType;
  area?: string;
  condition?: PropertyCondition;
  sortBy?: "price" | "createdAt" | "bedrooms";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
  lastVisible?: any;
  filters?: {
    type?: PropertyType;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    status?: string;
  };
  sort?: {
    field: string;
    direction: "asc" | "desc";
  };
}

// Helper function to format listing title
export const formatListingTitle = (
  bedrooms: number,
  area: string,
  ownerFirstName: string
): string => {
  return `${bedrooms}BR in ${area}, ${ownerFirstName}`;
};
