import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/clientApp';

export const uploadImage = async (file: File, userId: string): Promise<string> => {
  try {
    const fileName = `${Date.now()}-${file.name}`;
    // Update the path to match your security rules
    const storageRef = ref(storage, `users/${userId}/profile/${fileName}`);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return url;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};