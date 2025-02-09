import { Timestamp, collection, doc, getDocs, query, where, orderBy, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/clientApp';

export interface BaseNotification {
  id: string;
  type: string;
  title?: string;
  message: string;
  read: boolean;
  readAt?: Timestamp;
  relatedUserId?: string;
  relatedListingId?: string;
  createdAt?: Date;
}

// Normalize the timestamp/createdAt field when fetching from Firestore
export const normalizeNotificationDate = (data: any): BaseNotification => {
  return {
    id: data.id,
    type: data.type,
    title: data.title || getDefaultTitle(data.type),
    message: data.message,
    read: data.read ?? false,
    readAt: data.readAt,
    relatedUserId: data.relatedUserId,
    relatedListingId: data.relatedListingId,
    // Handle both timestamp and createdAt fields
    createdAt: (data.createdAt || data.timestamp)?.toDate() || new Date(),
  };
};

// Get default title based on notification type
export const getDefaultTitle = (type: string): string => {
  const titles: { [key: string]: string } = {
    kyc_submission: 'New KYC Submission',
    new_listing: 'New Listing Created',
    listing_verification: 'Listing Verified',
    landlord_verification: 'Landlord Verified',
    role_update: 'Role Update',
    flag_threshold_reached: 'Listing Flagged',
    default: 'Notification'
  };
  return titles[type] || titles.default;
};

// Fetch notifications with proper typing and error handling
export const fetchNotifications = async (): Promise<BaseNotification[]> => {
  try {
    const q = query(
      collection(db, "adminNotifications"),
      where("read", "==", false),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => normalizeNotificationDate({
      ...doc.data(),
      id: doc.id
    }));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

// Create a new notification with consistent timestamp handling
export const createNotification = async (
  data: Omit<BaseNotification, 'id' | 'createdAt' | 'read'>
): Promise<string> => {
  try {
    const notificationRef = doc(collection(db, "adminNotifications"));
    const now = serverTimestamp();
    
    await setDoc(notificationRef, {
      ...data,
      id: notificationRef.id,
      timestamp: now,  // Keep timestamp for backward compatibility
      createdAt: now,  // Add createdAt for future consistency
      read: false
    });
    
    return notificationRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};