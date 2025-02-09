import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./clientApp";

export const uploadImage = async (file: File, listingId: string, landlordId: string): Promise<string> => {
  // Create a path that matches the storage rules structure:
  // /listings/{landlordId}/{listingId}/{fileName}
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const path = `listings/${landlordId}/${listingId}/${fileName}`;
  
  // Verify file is an image and under 5MB
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File size must be under 5MB');
  }
  
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

export const deleteImage = async (path: string): Promise<void> => {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
};