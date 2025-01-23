import { User, getAuth } from "firebase/auth";

export type UserClaims = {
  role: "user" | "landlord_verified" | "landlord_unverified";
};

export const getUserClaims = async (user: User): Promise<UserClaims | null> => {
  try {
    // Force token refresh to get the latest claims
    await user.getIdToken(true);
    const decodedToken = await getAuth().currentUser?.getIdTokenResult();
    return decodedToken?.claims as UserClaims;
  } catch (error) {
    console.error("Error getting user claims:", error);
    return null;
  }
};

export const isLandlord = (claims: UserClaims | null): boolean => {
  return (
    claims?.role === "landlord_verified" ||
    claims?.role === "landlord_unverified"
  );
};

export const isUser = (claims: UserClaims | null): boolean => {
  return claims?.role === "user";
};

export const canAccessDashboard = (claims: UserClaims | null): boolean => {
  return isLandlord(claims);
};

export const canAccessProfile = (claims: UserClaims | null): boolean => {
  return isUser(claims);
};
