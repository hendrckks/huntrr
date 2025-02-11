import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { onKYCSubmission } from './kycNotifications';
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import type {
  ListingDocument,
  AdminNotificationDocument,
} from "../types/types";

admin.initializeApp();
const db = admin.firestore();

// Function to create a notification
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
export const onListingFlagged = onDocumentUpdated(
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

export { onKYCSubmission };

// Send email notifications to admins
// export const sendAdminEmailNotifications = onDocumentCreated(
//   "adminNotifications/{notificationId}",
//   async (event) => {
//     const snapshot = event.data;
//     if (!snapshot) return;

//     const notification = snapshot.data() as AdminNotificationDocument;
//     const adminsSnapshot = await db.collection("admins").get();
//     const adminEmails = adminsSnapshot.docs.map((doc) => doc.data().email);

//     // Using SendGrid (you'll need to set up the SendGrid SDK)
//     const sgMail = require("@sendgrid/mail");
//     sgMail.setApiKey(process.env.SENDGRID_API_KEY);

//     for (const email of adminEmails) {
//       const msg = {
//         to: email,
//         from: "notifications@yourdomain.com",
//         subject: notification.title,
//         text: notification.message,
//         html: `<strong>${notification.message}</strong><br><a href="https://yourdomain.com/admin/notifications/${notification.id}">View Notification</a>`,
//       };

//       await sgMail.send(msg);
//     }
//   }
// );
