import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "./clientApp";

export const uploadImage = async (
  file: File,
  path: string,
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

  // For KYC documents, ensure proper path structure
  const fullPath = path.includes("kyc")
    ? `users/${userId}/kyc/${fileName}`
    : path.includes("listings")
    ? `listings/${userId}/${path}/${fileName}`
    : `${path}/${fileName}`;

  const storageRef = ref(storage, fullPath);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

export const deleteImage = async (path: string): Promise<void> => {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
};
