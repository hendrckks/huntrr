import { onSchedule } from "firebase-functions/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as admin from "firebase-admin";
import { KYCDocument } from "./types/types";

const db = getFirestore();
const storage = getStorage();

// Constants for retention periods
const APPROVED_RETENTION_DAYS = 730; // 2 years for approved documents
const REJECTED_RETENTION_DAYS = 90; // 90 days for rejected documents

/**
 * Scheduled function that runs daily to check for KYC documents that have exceeded
 * their retention period and should be deleted.
 */
export const cleanupExpiredKYCDocuments = onSchedule("every 24 hours", async () => {
  console.log("Starting scheduled KYC document cleanup");
  
  try {
    const now = admin.firestore.Timestamp.now();
    
    // Get all KYC documents that have a scheduledDeletionDate in the past
    const expiredDocsSnapshot = await db
      .collection("kyc")
      .where("scheduledDeletionDate", "<=", now)
      .get();
    
    if (expiredDocsSnapshot.empty) {
      console.log("No expired KYC documents found");
      return;
    }
    
    console.log(`Found ${expiredDocsSnapshot.size} expired KYC documents to delete`);
    
    // Process each expired document
    const batch = db.batch();
    const deletionPromises = [];
    
    for (const doc of expiredDocsSnapshot.docs) {
      const kycData = doc.data() as KYCDocument;
      
      // Delete the associated files from Storage
      if (kycData.frontDocumentUrl) {
        deletionPromises.push(deleteFileFromUrl(kycData.frontDocumentUrl));
      }
      
      if (kycData.backDocumentUrl) {
        deletionPromises.push(deleteFileFromUrl(kycData.backDocumentUrl));
      }
      
      if (kycData.selfieUrl) {
        deletionPromises.push(deleteFileFromUrl(kycData.selfieUrl));
      }
      
      // Mark the document for deletion in Firestore
      batch.delete(doc.ref);
      
      // Create an audit log entry
      const auditLogRef = db.collection("kycDeletionLogs").doc();
      batch.set(auditLogRef, {
        kycId: kycData.id,
        userId: kycData.userId,
        documentType: kycData.documentType,
        status: kycData.status,
        submittedAt: kycData.submittedAt,
        reviewedAt: kycData.reviewedAt,
        deletedAt: now,
        reason: "retention_period_expired"
      });
    }
    
    // Wait for all storage deletions to complete
    await Promise.all(deletionPromises);
    
    // Commit the batch to delete documents and create audit logs
    await batch.commit();
    
    console.log(`Successfully deleted ${expiredDocsSnapshot.size} expired KYC documents`);
  } catch (error) {
    console.error("Error cleaning up expired KYC documents:", error);
  }
});

/**
 * Helper function to extract the storage path from a download URL and delete the file
 */
async function deleteFileFromUrl(downloadUrl: string): Promise<void> {
  try {
    // Extract the path from the download URL
    const url = new URL(downloadUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+)\?/);
    
    if (!pathMatch || !pathMatch[1]) {
      console.error(`Could not extract path from URL: ${downloadUrl}`);
      return;
    }
    
    const path = decodeURIComponent(pathMatch[1]);
    const fileRef = storage.bucket().file(path);
    
    // Check if file exists before attempting to delete
    const [exists] = await fileRef.exists();
    if (exists) {
      await fileRef.delete();
      console.log(`Successfully deleted file: ${path}`);
    } else {
      console.log(`File does not exist, skipping deletion: ${path}`);
    }
  } catch (error) {
    console.error(`Error deleting file from URL ${downloadUrl}:`, error);
  }
}

/**
 * Function to update KYC documents with scheduled deletion dates when they are approved or rejected
 */
export const updateKYCRetentionPeriod = async (kycId: string, status: string): Promise<void> => {
  try {
    const kycRef = db.collection("kyc").doc(kycId);
    const kycDoc = await kycRef.get();
    
    if (!kycDoc.exists) {
      console.error(`KYC document ${kycId} not found`);
      return;
    }
    
    let retentionDays: number;
    
    // Set retention period based on status
    if (status === "approved") {
      retentionDays = APPROVED_RETENTION_DAYS;
    } else if (status === "rejected") {
      retentionDays = REJECTED_RETENTION_DAYS;
    } else {
      console.log(`Status ${status} does not trigger retention period update`);
      return;
    }
    
    // Calculate scheduled deletion date
    const now = admin.firestore.Timestamp.now();
    const deletionDate = new Date(now.toMillis() + (retentionDays * 24 * 60 * 60 * 1000));
    
    // Update the document with scheduled deletion date
    await kycRef.update({
      scheduledDeletionDate: admin.firestore.Timestamp.fromDate(deletionDate),
      updatedAt: now
    });
    
    console.log(`Updated KYC document ${kycId} with scheduled deletion date: ${deletionDate}`);
  } catch (error) {
    console.error(`Error updating retention period for KYC document ${kycId}:`, error);
  }
};