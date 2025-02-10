import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "./clientApp";

export const uploadImage = async (
  file: File,
  listingId: string,
  userId: string
): Promise<string> => {
  // Verify file is an image and under 5MB
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File size must be under 5MB");
  }

  // Generate filename with timestamp and random string
  const fileExtension = file.name.split(".").pop();
  const fileName = `${Date.now()}_${Math.random()
    .toString(36)
    .substring(7)}.${fileExtension}`;

  // Structure the path according to the storage rules
  let fullPath: string;

  if (listingId.startsWith("temp_")) {
    // For new listings being created
    fullPath = `listings/${userId}/${listingId}/${fileName}`;
  } else if (listingId.includes("kyc")) {
    // For KYC documents
    fullPath = `users/${userId}/kyc/${fileName}`;
  } else if (listingId.includes("profile")) {
    // For profile images
    fullPath = `users/${userId}/profile/${fileName}`;
  } else {
    // For existing listings
    fullPath = `listings/${userId}/${listingId}/${fileName}`;
  }

  try {
    const storageRef = ref(storage, fullPath);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  } catch (error) {
    console.error("Error uploading image:", error);
    throw new Error(
      `Failed to upload image: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

export const deleteImage = async (path: string): Promise<void> => {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
};
