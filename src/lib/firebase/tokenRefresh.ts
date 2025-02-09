import { User } from "firebase/auth";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "./clientApp";
// import { getUserClaims } from "../../utils/authUtils";

export const refreshUserClaims = async (user: User): Promise<void> => {
  try {
    // Force token refresh
    await user.getIdToken(true);
    // Wait a short time for propagation
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Get fresh token with updated claims
    await user.getIdTokenResult(true);
  } catch (error) {
    console.error("Error refreshing user claims:", error);
    throw error;
  }
};

export const processRoleUpdate = async (userId: string, newRole: string, batch?: ReturnType<typeof writeBatch>) => {
  try {
    const shouldCommit = !batch;
    const writeBatchToUse = batch || writeBatch(db);

    // Update user's role in Firestore
    const userRef = doc(db, "users", userId);
    writeBatchToUse.update(userRef, {
      role: newRole,
      updatedAt: serverTimestamp(),
    });

    // Add audit log
    const auditRef = doc(db, "auditLogs", `role_${Date.now()}`);
    writeBatchToUse.set(auditRef, {
      type: "role_update",
      userId,
      newRole,
      timestamp: serverTimestamp(),
    });

    // Only commit if we created the batch here
    if (shouldCommit) {
      await writeBatchToUse.commit();
    }

    return userRef;
  } catch (error) {
    console.error("Error processing role update:", error);
    throw error;
  }
};