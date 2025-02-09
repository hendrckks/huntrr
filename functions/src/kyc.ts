import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

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

    // Update KYC document
    const kycRef = admin.firestore().collection("kyc").doc(userId);
    batch.update(kycRef, {
      status: approved ? "approved" : "rejected",
      reviewedAt: timestamp,
      reviewedBy: request.auth.uid,
      rejectionReason: approved ? null : rejectionReason,
      updatedAt: timestamp,
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
      await admin
        .auth()
        .setCustomUserClaims(userId, { role: "landlord_verified" });
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
