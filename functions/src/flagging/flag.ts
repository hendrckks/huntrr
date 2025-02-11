import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin
initializeApp();

const db = getFirestore();

// Types for the listing document
interface Listing {
  id: string;
  title: string;
  flagCount: number;
  status: string;
}

export const onListingFlagged = onDocumentUpdated(
  "listings/{listingId}",
  async (event) => {
    const newData = event.data?.after?.data() as Listing | undefined;
    const previousData = event.data?.before?.data() as Listing | undefined;

    if (!newData || !previousData) {
      console.log("No data available");
      return;
    }

    // Check if flagCount was incremented
    if (newData.flagCount !== previousData.flagCount) {
      // If flag count reaches or exceeds threshold (5)
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
  }
);
