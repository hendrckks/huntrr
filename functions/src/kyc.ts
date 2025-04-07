import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { KYCDocument } from "./types/types";

// Trigger when a new KYC document is created
export const onKYCSubmitted = onDocumentCreated(
  "kyc/{userId}",
  async (event) => {
    const kycData = event.data?.data();
    if (!kycData) return;

    try {
      // Update the KYC document to include status if not already set
      const kycRef = event.data?.ref;
      if (kycRef) {
        await kycRef.update({
          status: "pending",
          submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Create notification for admin
      const notificationRef = admin
        .firestore()
        .collection("adminNotifications")
        .doc();

      await notificationRef.set({
        id: notificationRef.id,
        type: "kyc_submission",
        title: "New KYC Submission",
        message: `New KYC verification submitted by user ${kycData.userId}`,
        relatedUserId: kycData.userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });
    } catch (error) {
      console.error("Error creating KYC notification:", error);
    }
  }
);

// Function for admin to approve/reject KYC
export const processKYC = onCall({ enforceAppCheck: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  // Verify admin role
  const callerRole = request.auth.token.role;
  if (callerRole !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can process KYC submissions."
    );
  }

  const { userId, approved, rejectionReason } = request.data;

  if (!userId || typeof approved !== "boolean") {
    throw new HttpsError("invalid-argument", "Invalid request data.");
  }

  try {
    const batch = admin.firestore().batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const now = admin.firestore.Timestamp.now();
    
    // Calculate scheduled deletion date based on status
    const status = approved ? "approved" : "rejected";
    const retentionDays = approved ? 730 : 90; // 2 years for approved, 90 days for rejected
    const deletionDate = new Date(now.toMillis() + (retentionDays * 24 * 60 * 60 * 1000));

    // Update KYC document
    const kycRef = admin.firestore().collection("kyc").doc(userId);
    batch.update(kycRef, {
      status: status,
      reviewedAt: timestamp,
      reviewedBy: request.auth.uid,
      rejectionReason: approved ? null : rejectionReason,
      updatedAt: timestamp,
      scheduledDeletionDate: admin.firestore.Timestamp.fromDate(deletionDate)
    });

    // If approved, update user role to landlord_verified
    if (approved) {
      const userRef = admin.firestore().collection("users").doc(userId);
      batch.update(userRef, {
        role: "landlord_verified",
        verifiedAt: timestamp,
        verifiedBy: request.auth.uid,
        updatedAt: timestamp,
      });

      // Update custom claims
      // await admin
      //   .auth()
      //   .setCustomUserClaims(userId, { role: "landlord_verified" });
    }

    await batch.commit();

    return { success: true };
  } catch (error) {
    console.error("Error processing KYC:", error);
    throw new HttpsError(
      "internal",
      "An error occurred while processing the KYC submission."
    );
  }
});

export const onKYCStatusUpdate = onDocumentUpdated(
  "kyc/{docId}",
  async (event) => {
    const beforeData = event.data?.before.data() as KYCDocument;
    const afterData = event.data?.after.data() as KYCDocument;

    // Only proceed if status has changed
    if (beforeData.status === afterData.status) {
      return;
    }

    const userId = afterData.userId;
    const userRef = admin.firestore().collection("users").doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (!userData) {
      console.error("User document not found");
      return;
    }

    // Prepare notification data
    const notificationData = {
      userId: userId,
      type: afterData.status === "approved" ? "kyc_approved" : "kyc_rejected",
      title: afterData.status === "approved" 
        ? "KYC Verification Approved" 
        : "KYC Verification Update",
      message: afterData.status === "approved"
        ? "Your KYC verification has been approved. You can now list properties on our platform."
        : `Your KYC verification was not approved. Reason: ${afterData.rejectionReason || "No reason provided"}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    };

    // Create notification in Firestore
    await admin
      .firestore()
      .collection("notifications")
      .add(notificationData);

    // If user has a notification token, send push notification
    if (userData.notificationToken) {
      try {
        await admin.messaging().send({
          token: userData.notificationToken,
          notification: {
            title: notificationData.title,
            body: notificationData.message
          }
        });
      } catch (error) {
        console.error("Error sending push notification:", error);
      }
    }

    // Send email notification
    if (userData.email) {
      try {
        await admin.firestore().collection("mail").add({
          to: userData.email,
          message: {
            subject: notificationData.title,
            text: notificationData.message
          }
        });
      } catch (error) {
        console.error("Error sending email notification:", error);
      }
    }

    // If approved, update user role to landlord_verified
    if (afterData.status === "approved") {
      await userRef.update({
        role: "landlord_verified",
        kycVerifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Force token refresh to update claims
      await admin.auth().revokeRefreshTokens(userId);
    }
  }
);