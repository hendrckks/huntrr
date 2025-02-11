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
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { KYCDocument, AdminNotificationDocument, ListingDocument } from "./types/types";
import { onSchedule } from "firebase-functions/scheduler";




admin.initializeApp();
const db = getFirestore();


interface SetCustomClaimsRequest {
  uid: string;
  role: string;
}

interface Listing {
  id: string;
  title: string;
  flagCount: number;
  status: string;
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


export const onListingFlagged = onDocumentUpdated( 
  "listings/{listingId}",
  async (event) => {
    const newData = event.data?.after?.data() as Listing | undefined;
    const previousData = event.data?.before?.data() as Listing | undefined;

    if (!newData || !previousData) {
      console.log("No data available");
      return;
    }

    // Check if listing should be recalled based on flag count, regardless of increment
    if (newData.flagCount >= 5 && newData.status !== "recalled") {
      const listingRef = event.data?.after?.ref;

      if (!listingRef) {
        console.error("Listing reference is undefined");
        return;
      }

      try {
        await listingRef.update({
          status: "recalled",
          archivedAt: Timestamp.now(),
        });

        // Create admin notification
        const notificationRef = db.collection("adminNotifications").doc();
        await notificationRef.set({
          type: "flag_threshold_reached",
          title: "Listing Auto-Recalled",
          message: `Listing "${newData.title}" has been auto-recalled due to reaching the flag threshold`,
          relatedListingId: event.params.listingId,
          createdAt: Timestamp.now(),
          read: false,
          id: notificationRef.id,
        });

        console.log(
          `Successfully recalled listing ${event.params.listingId}`
        );
      } catch (error) {
        console.error("Error updating listing status:", error);
        throw error;
      }
    }
  }
);


export const onKYCSubmission = onDocumentCreated(
  "kyc/{docId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const kycDoc = snapshot.data() as KYCDocument;

    // Create notification reference
    const notificationRef = admin.firestore().collection("AdminNotifications").doc();
    
    // Prepare notification data
    const notificationData: AdminNotificationDocument = {
      id: notificationRef.id,
      type: "kyc_submission",
      title: "New KYC Submission",
      message: `New KYC document submitted for review. Document type: ${kycDoc.documentType}`,
      relatedUserId: kycDoc.userId,
      createdAt: admin.firestore.Timestamp.now(),
      read: false
    };

    // Save the notification
    await notificationRef.set(notificationData);
  }
);

const createNotification = async (
  notification: Omit<AdminNotificationDocument, "id" | "read" | "readAt">
): Promise<string> => {
  const notificationRef = db.collection("adminNotifications").doc();
  const notificationData: AdminNotificationDocument = {
    ...notification,
    id: notificationRef.id,
    read: false,
    createdAt: admin.firestore.Timestamp.now(),
  };

  await notificationRef.set(notificationData);
  return notificationRef.id;
};

// Trigger when a new listing is created
export const onNewListing = onDocumentCreated(
  "listings/{listingId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const listing = snapshot.data() as ListingDocument;

    await createNotification({
      type: "new_listing",
      title: "New Listing Requires Review",
      message: `New listing "${listing.title}" needs review`,
      relatedListingId: snapshot.id,
      createdAt: admin.firestore.Timestamp.now(),
    });
  }
);

// Trigger when a listing's flag count changes
export const onListingFlaggedUser = onDocumentUpdated(
  "listings/{listingId}",
  async (event) => {
    const beforeData = event.data?.before.data() as ListingDocument | undefined;
    const afterData = event.data?.after.data() as ListingDocument | undefined;

    if (!beforeData || !afterData) return;

    // Only proceed if flag count has increased AND exactly hits threshold
    if (
      afterData.flagCount !== afterData.FLAG_THRESHOLD ||
      beforeData.flagCount >= afterData.FLAG_THRESHOLD
    )
      return;

    // Use transaction to ensure atomic updates
    await db.runTransaction(async (transaction) => {
      // Verify the condition is still true
      const freshDoc = await transaction.get(event.data!.after.ref);
      const freshData = freshDoc.data() as ListingDocument;

      if (freshData.flagCount !== freshData.FLAG_THRESHOLD) return;

      // Update listing status
      transaction.update(event.data!.after.ref, {
        status: "recalled",
        archivedAt: admin.firestore.Timestamp.now(),
      });

      // Create notification
      const notificationRef = db.collection("notifications").doc();
      const notification: AdminNotificationDocument = {
        id: notificationRef.id,
        type: "flag_threshold_reached",
        title: "Listing Auto-Recalled",
        message: `Listing "${afterData.title}" has been auto-recalled due to reaching the flag threshold`,
        relatedListingId: event.params.listingId,
        createdAt: admin.firestore.Timestamp.now(),
        read: false,
      };

      transaction.set(notificationRef, notification);
    });
  }
);

// Trigger when a listing is updated
export const onListingUpdate = onDocumentUpdated(
  "listings/{listingId}",
  async (event) => {
    const before = event.data?.before.data() as ListingDocument | undefined;
    const after = event.data?.after.data() as ListingDocument | undefined;

    if (!before || !after) return;

    // Only proceed if relevant fields changed
    const relevantFieldsChanged = [
      "title",
      "price",
      "description",
      "photos",
      "location",
      "status",
    ].some(
      (field) =>
        JSON.stringify(before[field as keyof ListingDocument]) !==
        JSON.stringify(after[field as keyof ListingDocument])
    );

    if (!relevantFieldsChanged) return;

    if (before.status === "draft" && after.status === "pending_review") {
      await createNotification({
        type: "new_listing",
        title: "New Listing Requires Review",
        message: `Listing "${after.title}" has been submitted for review`,
        relatedListingId: event.params.listingId,
        createdAt: admin.firestore.Timestamp.now(),
      });
      return;
    }
  }
);

// Cleanup old notifications
export const cleanupOldNotifications = onSchedule(
  "every 24 hours",
  async () => {
    const cutoffDate = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    );

    const snapshot = await db
      .collection("adminNotifications")
      .where("read", "==", true)
      .where("createdAt", "<=", cutoffDate)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }
);