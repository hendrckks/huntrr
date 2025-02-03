import * as admin from "firebase-admin";
import { cert } from "firebase-admin/app";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Debugging: Print values
console.log("FB_PROJECT_ID:", process.env.FB_PROJECT_ID);
console.log("FB_CLIENT_EMAIL:", process.env.FB_CLIENT_EMAIL);
console.log(
  "FB_PRIVATE_KEY:",
  process.env.FB_PRIVATE_KEY ? "Loaded" : "Not Loaded"
);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: cert({
    projectId: process.env.FB_PROJECT_ID,
    clientEmail: process.env.FB_CLIENT_EMAIL,
    privateKey: process.env.FB_PRIVATE_KEY?.replace(/\\n/g, "\n"), 
  }),
});

async function createFirstAdminUser() {
  try {
    // Use environment variables for first admin credentials
    const adminEmail = process.env.FIRST_ADMIN_EMAIL;
    const adminPassword = process.env.FIRST_ADMIN_PASSWORD;
    const adminDisplayName = process.env.FIRST_ADMIN_NAME;

    if (!adminEmail || !adminPassword || !adminDisplayName) {
      throw new Error("Admin credentials must be set in environment variables");
    }

    // Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: adminDisplayName,
    });

    // Set admin custom claim
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: "admin",
    });

    // Create user document in Firestore
    await admin.firestore().collection("users").doc(userRecord.uid).set({
      email: adminEmail,
      role: "admin",
      displayName: adminDisplayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoggedIn: admin.firestore.FieldValue.serverTimestamp(), // Add this line
    });

    console.log(`First admin user created successfully: ${adminEmail}`);
    return userRecord.uid;
  } catch (error) {
    console.error("Error creating first admin user:", error);
    throw error;
  }
}

// Run the script
createFirstAdminUser()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
