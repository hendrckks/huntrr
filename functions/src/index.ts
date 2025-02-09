import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {
  CustomError,
  ValidationError,
  NotFoundError,
  PermissionError,
} from "../../shared/CustomErrors";

admin.initializeApp();

// Listen for user role changes and update custom claims
export const onUserRoleUpdate = onDocumentUpdated(
  "users/{userId}",
  async (event) => {
    const newValue = event.data?.after.data();
    const previousValue = event.data?.before.data();

    // Only proceed if the role has changed
    if (newValue?.role !== previousValue?.role) {
      try {
        // Update custom claims
        await admin.auth().setCustomUserClaims(event.params.userId, {
          role: newValue?.role,
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

// Type definitions for request data
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

// // Listen for user role changes and update custom claims
// export const onUserRoleUpdate = onDocumentUpdated('users/{userId}', async (event) => {
//   const newData = event.data?.after.data();
//   const previousData = event.data?.before.data();
//   const userId = event.params.userId;

//   // Only proceed if the role has changed
//   if (newData?.role !== previousData?.role) {
//     try {
//       // Get the current custom claims
//       const user = await admin.auth().getUser(userId);
//       const currentClaims = user.customClaims || {};

//       // Update custom claims with new role
//       await admin.auth().setCustomUserClaims(userId, {
//         ...currentClaims,
//         role: newData?.role
//       });

//       // Add a notification in Firestore about the role change
//       await admin.firestore().collection('adminNotifications').add({
//         type: 'role_update',
//         userId: userId,
//         previousRole: previousData?.role,
//         newRole: newData?.role,
//         timestamp: admin.firestore.FieldValue.serverTimestamp(),
//         message: `User ${userId} role updated from ${previousData?.role} to ${newData?.role}`,
//         read: false
//       });

//       console.log(`Successfully updated custom claims for user ${userId}. New role: ${newData?.role}`);
//     } catch (error) {
//       console.error('Error updating custom claims:', error);
//       throw new Error(`Failed to update custom claims for user ${userId}`);
//     }
//   }
// });

// Function to verify a landlord
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
