import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import type { KYCDocument, AdminNotificationDocument } from "../types/types";

// Function to create a notification when a new KYC document is submitted
export const onKYCSubmission = onDocumentCreated(
  "kyc/{docId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const kycDoc = snapshot.data() as KYCDocument;

    // Create notification reference
    const notificationRef = admin.firestore().collection("notifications").doc();
    
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