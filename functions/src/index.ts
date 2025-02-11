import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {
  CustomError,
  ValidationError,
  NotFoundError,
  PermissionError,
} from "../../shared/CustomErrors";

admin.initializeApp();

interface SetCustomClaimsRequest {
  uid: string;
  role: string;
}

// Constants for roles
const Roles = {
  ADMIN: "admin",
  LANDLORD_VERIFIED: "landlord_verified",
} as const;

// Rate limiting helper
const rateLimiter = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT = 10; // Max 10 requests
const RATE_LIMIT_WINDOW = 60000; // per minute (in milliseconds)

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const userRateLimit = rateLimiter.get(uid) || { count: 0, lastReset: now };

  if (now - userRateLimit.lastReset > RATE_LIMIT_WINDOW) {
    userRateLimit.count = 1;
    userRateLimit.lastReset = now;
  } else {
    userRateLimit.count++;
  }

  rateLimiter.set(uid, userRateLimit);
  return userRateLimit.count <= RATE_LIMIT;
}

// Listen for user role changes and update custom claims
export const onUserRoleUpdate = onDocumentUpdated(
  "users/{userId}",
  async (event) => {
    const newValue = event.data?.after.data();
    const previousValue = event.data?.before.data();

    if (newValue?.role !== previousValue?.role) {
      try {
        // Force token revocation
        await admin.auth().revokeRefreshTokens(event.params.userId);

        // Update custom claims
        await admin.auth().setCustomUserClaims(event.params.userId, {
          role: newValue?.role,
        });

        // Update user document with claims update metadata
        await event.data?.after.ref.update({
          lastClaimsUpdate: admin.firestore.FieldValue.serverTimestamp(),
          requiresReauth: true
        });

        // Add a notification in Firestore about the role change
        await admin
          .firestore()
          .collection("adminNotifications")
          .add({
            type: "role_update",
            userId: event.params.userId,
            previousRole: previousValue?.role,
            newRole: newValue?.role,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            message: `User ${event.params.userId} role updated from ${previousValue?.role} to ${newValue?.role}`,
            read: false,
          });

        console.log(
          `Updated custom claims for user ${event.params.userId} to role: ${newValue?.role}`
        );
      } catch (error) {
        console.error("Error updating custom claims:", error);
      }
    }
  }
);

export const revokeUserTokens = onCall(async (request) => {
  if (!request.auth || request.auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Not authorized");
  }

  const { userId } = request.data;
  await admin.auth().revokeRefreshTokens(userId);
  return { success: true };
});

// Type definitions for request data

// Function to set custom claims for a user
export const setCustomClaims = onCall<SetCustomClaimsRequest>(
  { enforceAppCheck: false },
  async (request) => {
    try {
      if (!request.auth) {
        throw new PermissionError(
          "The function must be called while authenticated."
        );
      }

      if (!checkRateLimit(request.auth.uid)) {
        throw new HttpsError(
          "resource-exhausted",
          "Rate limit exceeded. Please try again later."
        );
      }

      const { uid, role } = request.data;

      if (!uid || typeof uid !== "string") {
        throw new ValidationError("Invalid UID provided.");
      }
      if (!role || typeof role !== "string") {
        throw new ValidationError("Invalid role provided.");
      }

      if (request.auth.uid !== uid) {
        throw new PermissionError(
          "The function must be called by the user themselves."
        );
      }

      // Check if the user has permission to set this role
      const currentUserRecord = await admin.auth().getUser(request.auth.uid);
      const currentUserClaims = currentUserRecord.customClaims || {};
      if (role === "admin" && currentUserClaims.role !== "admin") {
        throw new PermissionError("Only admins can set admin role.");
      }

      const currentClaims =
        (await admin.auth().getUser(uid)).customClaims || {};
      await admin.auth().setCustomUserClaims(uid, { ...currentClaims, role });

      return {
        message: "Custom claims set successfully. Please refresh the page.",
      };
    } catch (error) {
      console.error("Error in setCustomClaims:", error);
      if (error instanceof CustomError) {
        throw new HttpsError(error.code as any, error.message);
      }
      throw new HttpsError("internal", "An unexpected error occurred.");
    }
  }
);

export const verifyLandlord = onCall(
  { enforceAppCheck: true },
  async (request) => {
    try {
      if (!request.auth) {
        throw new PermissionError("User must be logged in.");
      }

      // Verify admin role from custom claims
      const callerRole = request.auth.token.role;
      if (callerRole !== Roles.ADMIN) {
        throw new PermissionError("Only admins can verify landlords.");
      }

      const { uid } = request.data;
      if (!uid || typeof uid !== "string") {
        throw new ValidationError("Invalid UID provided.");
      }

      // Run everything in a transaction to ensure consistency
      await admin.firestore().runTransaction(async (transaction) => {
        const userRef = admin.firestore().collection("users").doc(uid);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new NotFoundError("User document not found.");
        }

        // Update user document with new role and verification timestamp
        transaction.update(userRef, {
          role: Roles.LANDLORD_VERIFIED,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Add admin notification about landlord verification
        const notificationRef = admin
          .firestore()
          .collection("adminNotifications")
          .doc();
        transaction.set(notificationRef, {
          type: "landlord_verification",
          userId: uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          message: `Landlord ${uid} has been verified`,
          read: false,
        });
      });

      return { success: true };
    } catch (error) {
      console.error("Error in verifyLandlord:", error);
      if (error instanceof CustomError) {
        throw new HttpsError(error.code as any, error.message);
      }
      throw new HttpsError("internal", "An unexpected error occurred.");
    }
  }
);

export const onListingVerified = onDocumentUpdated(
  "listings/{listingId}",
  async (event) => {
    try {
      const newValue = event.data?.after.data();
      const previousValue = event.data?.before.data();

      if (!newValue || !previousValue) {
        throw new ValidationError("No data associated with the event");
      }

      if (
        newValue.status === "published" &&
        previousValue.status === "awaiting_verification"
      ) {
        const landlordId = newValue.landlord.uid;
        const landlordRef = admin
          .firestore()
          .collection("users")
          .doc(landlordId);
        const landlordDoc = await landlordRef.get();

        if (!landlordDoc.exists) {
          throw new NotFoundError("Landlord document not found");
        }

        const landlordData = landlordDoc.data();
        const notificationToken = landlordData?.notificationToken;

        // Add notification to the notifications collection
        await admin
          .firestore()
          .collection("notifications")
          .add({
            listingId: event.params.listingId,
            landlordId: landlordId,
            message: `Your listing "${newValue.title}" has been verified and is now published.`,
            type: "verification",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
          });

        // Add admin notification about listing verification
        await admin
          .firestore()
          .collection("adminNotifications")
          .add({
            type: "listing_verification",
            listingId: event.params.listingId,
            landlordId: landlordId,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            message: `Listing ${event.params.listingId} has been verified and published`,
            read: false,
          });

        if (notificationToken) {
          await admin.messaging().send({
            token: notificationToken,
            notification: {
              title: "Listing Verified",
              body: `Your listing "${newValue.title}" has been verified and is now published.`,
            },
          });
        }

        // Send an email notification
        await admin
          .firestore()
          .collection("mail")
          .add({
            to: landlordData?.email,
            message: {
              subject: "Your Listing Has Been Verified",
              text: `Your listing "${newValue.title}" has been verified and is now published.`,
            },
          });
      }
    } catch (error) {
      console.error("Error in onListingVerified:", error);
      // Since this is a background function, we can't return an error to the client
      // But we can log it for monitoring purposes
    }
  }
);

export const onNewListing = onDocumentCreated(
  "listings/{listingId}",
  async (event) => {
    try {
      const listingData = event.data?.data();

      if (!listingData) {
        throw new ValidationError("No data associated with the new listing");
      }

      // Add admin notification about the new listing
      await admin
        .firestore()
        .collection("adminNotifications")
        .add({
          type: "new_listing",
          listingId: event.params.listingId,
          landlordId: listingData.landlord.uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          message: `New listing "${listingData.title}" created by landlord ${listingData.landlord.uid}`,
          read: false,
        });

      console.log(
        `Created notification for new listing ${event.params.listingId}`
      );
    } catch (error) {
      console.error("Error in onNewListing:", error);
      // Since this is a background function, we can't return an error to the client
      // But we can log it for monitoring purposes
    }
  }
);
