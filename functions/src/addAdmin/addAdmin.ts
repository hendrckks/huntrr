import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const createAdminUser = onCall<{
  email: string;
  password: string;
  displayName?: string;
}>(
  {
    enforceAppCheck: false,
    maxInstances: 10,
  },
  async (request) => {
    try {
      // Check if the requester has admin privileges
      const adminUsers = await admin
        .firestore()
        .collection("users")
        .where("role", "==", "admin")
        .get();

      // If no admin users exist, prevent creation through this method
      if (adminUsers.empty) {
        throw new HttpsError(
          "permission-denied",
          "Initial admin must be created through the secure script"
        );
      }

      // Ensure only existing admins can create new admin users
      if (!request.auth || request.auth.token.role !== "admin") {
        throw new HttpsError(
          "permission-denied",
          "Only existing admins can create new admin users"
        );
      }

      const { email, password, displayName } = request.data;

      // Validate input
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });

      // Set admin custom claim
      await admin.auth().setCustomUserClaims(userRecord.uid, {
        role: "admin",
      });

      // Create a corresponding user document in Firestore
      await admin.firestore().collection("users").doc(userRecord.uid).set({
        email,
        role: "admin",
        displayName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
      });

      return {
        success: true,
        message: "Admin user created successfully",
        uid: userRecord.uid,
      };
    } catch (error) {
      console.error("Error creating admin user:", error);
      if (error instanceof HttpsError) {
        throw error; // Preserve existing HttpsErrors
      }
      // Wrap all other errors
      throw new HttpsError("internal", "Failed to create admin user");
    }
  }
);

// async function addAdminUser(
//   email: string,
//   displayName: string,
//   password: string
// ) {
//   try {
//     // Create user in Firebase Authentication
//     const userRecord = await admin.auth().createUser({
//       email,
//       password,
//       displayName,
//     });

//     // Set admin custom claim
//     await admin.auth().setCustomUserClaims(userRecord.uid, { role: "admin" });

//     // Create user document in Firestore
//     await admin.firestore().collection("users").doc(userRecord.uid).set({
//       email,
//       role: "admin",
//       displayName,
//       createdAt: admin.firestore.FieldValue.serverTimestamp(),
//       lastLoggedIn: admin.firestore.FieldValue.serverTimestamp(),
//     });

//     console.log(`Admin user added successfully: ${email}`);
//     return userRecord.uid;
//   } catch (error) {
//     console.error("Error adding admin user:", error);
//     throw error;
//   }
// }

// // Example usage: Replace with actual values
// addAdminUser("samueltetenga@gmail.com", "sam tetenga", "Master321!")
//   .then(() => process.exit(0))
//   .catch(() => process.exit(1));
