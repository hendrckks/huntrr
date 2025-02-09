import { User } from "firebase/auth";

export type UserClaims = {
  role: "user" | "landlord_verified" | "landlord_unverified" | "admin";
};

export const getUserClaims = async (user: User): Promise<UserClaims | null> => {
  try {
    // Force token refresh and wait for it to complete
    await user.getIdToken(true);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Allow time for token to propagate
    
    const decodedToken = await user.getIdTokenResult(true);
    if (!decodedToken.claims.role) {
      console.warn("No role claim found in token");
      return null;
    }
    
    return { role: decodedToken.claims.role as UserClaims["role"] };
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

export const isAdmin = (claims: UserClaims | null): boolean => {
  return claims?.role === "admin";
};

export const canAccessDashboard = (claims: UserClaims | null): boolean => {
  return isLandlord(claims) || isAdmin(claims);
};

export const canAccessProfile = (claims: UserClaims | null): boolean => {
  return isUser(claims);
};
