import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

// Type definitions for request data
interface SetCustomClaimsRequest {
  uid: string;
  role: string;
}

interface VerifyLandlordRequest {
  uid: string;
}

// Constants for roles
const Roles = {
  ADMIN: "admin",
  LANDLORD_VERIFIED: "landlord_verified",
} as const;

// Function to set custom claims for a user
export const setCustomClaims = onCall<SetCustomClaimsRequest>(
  { enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }

    const { uid, role } = request.data;

    // Validate input data
    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "Invalid UID provided.");
    }
    if (!role || typeof role !== "string") {
      throw new HttpsError("invalid-argument", "Invalid role provided.");
    }

    // Ensure users can only modify their own claims
    if (request.auth.uid !== uid) {
      throw new HttpsError(
        "permission-denied",
        "The function must be called by the user themselves."
      );
    }

    try {
      // Merge existing custom claims with the new role
      const currentClaims =
        (await admin.auth().getUser(uid)).customClaims || {};
      await admin.auth().setCustomUserClaims(uid, { ...currentClaims, role });

      return {
        message: "Custom claims set successfully. Please refresh the page.",
      };
    } catch (error) {
      console.error(
        "Error setting custom claims for UID:",
        uid,
        "Error:",
        error
      );
      throw new HttpsError(
        "internal",
        "An error occurred while setting custom claims."
      );
    }
  }
);

// Function to verify a landlord
export const verifyLandlord = onCall<VerifyLandlordRequest>(
  { enforceAppCheck: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    // Fetch caller's role from auth token
    const callerRole = request.auth.token.role;
    if (callerRole !== Roles.ADMIN) {
      throw new HttpsError(
        "permission-denied",
        "Only admins can verify landlords."
      );
    }

    const { uid } = request.data;

    // Validate input data
    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "Invalid UID provided.");
    }

    try {
      // Perform Firestore update in a transaction
      const userDocRef = admin.firestore().collection("users").doc(uid);
      await admin.firestore().runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userDocRef);

        if (!userDoc.exists) {
          throw new HttpsError("not-found", "User document not found.");
        }

        transaction.update(userDocRef, {
          role: Roles.LANDLORD_VERIFIED,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Update custom claims
      const currentClaims =
        (await admin.auth().getUser(uid)).customClaims || {};
      await admin.auth().setCustomUserClaims(uid, {
        ...currentClaims,
        role: Roles.LANDLORD_VERIFIED,
      });

      return { success: true };
    } catch (error) {
      console.error(
        "Error verifying landlord for UID:",
        uid,
        "Caller UID:",
        request.auth.uid,
        "Error:",
        error
      );
      throw new HttpsError(
        "internal",
        "An error occurred while verifying the landlord."
      );
    }
  }
);
