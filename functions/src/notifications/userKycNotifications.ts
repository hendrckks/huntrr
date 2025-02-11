import * as admin from "firebase-admin";
import type { AdminNotificationDocument } from "../types/types";

// Function to query KYC notifications from the user notifications collection
export const queryUserKYCNotifications = async (): Promise<AdminNotificationDocument[]> => {
  try {
    const notificationsRef = admin.firestore().collection("notifications");
    
    // Query notifications where type is "kyc_submission"
    const snapshot = await notificationsRef
      .where("type", "==", "kyc_submission")
      .orderBy("createdAt", "desc")
      .get();

    if (snapshot.empty) {
      return [];
    }

    // Map the documents to the AdminNotificationDocument type
    const notifications: AdminNotificationDocument[] = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as AdminNotificationDocument[];

    return notifications;
  } catch (error) {
    console.error("Error querying user KYC notifications:", error);
    throw error;
  }
};