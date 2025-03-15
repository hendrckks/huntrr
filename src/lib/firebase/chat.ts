import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  doc,
  getDoc,
  writeBatch,
  limit,
  setDoc,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./clientApp";

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: any;
  senderName: string;
  read?: boolean;
}

export interface Chat {
  chatId: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  lastMessage?: string;
  lastMessageTime?: any;
  timestamp?: any;
  role?: string;
  senderId?: string;
  unreadCount?: number;
  status?: string;
  lastSeen?: any;
}

// Type for participant data
interface ParticipantData {
  displayName?: string;
  photoURL?: string;
  role?: string;
  status?: string;
}

// Subscribe to user's chats with real-time updates
export const subscribeToChats = (
  userId: string,
  userRole: string,
  callback: (chats: Chat[]) => void
) => {
  const chatsQuery = query(
    collection(db, "chats"),
    where(
      userRole === "landlord_verified" ? "landlordId" : "userId",
      "==",
      userId
    )
  );

  // Add a second query for landlord_verified users to also get their tenant chats
  const additionalQuery =
    userRole === "landlord_verified"
      ? query(collection(db, "chats"), where("userId", "==", userId))
      : null;

  const handleSnapshot = async (snapshot: any) => {
    const chatsList: Chat[] = [];
    const promises = snapshot.docs.map(
      async (docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
        const chatData = docSnapshot.data();
        const otherUserId =
          userRole === "landlord_verified" && chatData.landlordId === userId
            ? chatData.userId
            : chatData.landlordId;

        // Get user profile info
        const participantRef = doc(
          collection(docSnapshot.ref, "participants"),
          otherUserId
        );
        const userDoc = await getDoc(participantRef);
        const userData = userDoc.exists()
          ? (userDoc.data() as ParticipantData)
          : {};

        // Get unread count
        const unreadQuery = query(
          collection(db, "messages"),
          where("chatId", "==", docSnapshot.id),
          where("senderId", "==", otherUserId),
          where("read", "==", false)
        );
        const unreadSnapshot = await getDocs(unreadQuery);

        chatsList.push({
          chatId: docSnapshot.id,
          userId: otherUserId,
          displayName: userData.displayName || chatData.displayName || "User",
          photoURL: userData.photoURL || chatData.photoURL,
          lastMessage: chatData.lastMessage,
          lastMessageTime: chatData.lastMessageTime,
          timestamp: chatData.timestamp,
          role: userData.role || chatData.role,
          senderId: chatData.lastMessageSenderId,
          unreadCount: unreadSnapshot.size,
          status: userData.status || "offline",
        });
      }
    );

    await Promise.all(promises);
    return chatsList;
  };

  // Set up listeners for both queries if needed
  if (additionalQuery) {
    return onSnapshot(chatsQuery, async (snapshot1) => {
      const chats1 = await handleSnapshot(snapshot1);

      // Get chats from additional query
      const snapshot2 = await getDocs(additionalQuery);
      const chats2 = await handleSnapshot(snapshot2);

      // Merge and sort all chats
      const allChats = [...chats1, ...chats2];
      allChats.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return b.lastMessageTime.seconds - a.lastMessageTime.seconds;
      });

      // Remove duplicate chats (same user in different roles)
      const uniqueChats = allChats.reduce((acc: Chat[], current) => {
        const x = acc.find((item) => item.userId === current.userId);
        if (!x) {
          return acc.concat([current]);
        } else {
          // If duplicate found, merge the unread counts
          x.unreadCount = (x.unreadCount || 0) + (current.unreadCount || 0);
          // Take the most recent message time
          if (
            current.lastMessageTime &&
            (!x.lastMessageTime ||
              current.lastMessageTime.seconds > x.lastMessageTime.seconds)
          ) {
            x.lastMessageTime = current.lastMessageTime;
            x.lastMessage = current.lastMessage;
            x.senderId = current.senderId;
          }
          return acc;
        }
      }, []);

      callback(uniqueChats);
    });
  }

  // If not a landlord, just use the main query
  return onSnapshot(chatsQuery, async (snapshot) => {
    const chatsList = await handleSnapshot(snapshot);

    // Sort chats by last message time (most recent first)
    chatsList.sort((a, b) => {
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return b.lastMessageTime.seconds - a.lastMessageTime.seconds;
    });

    callback(chatsList);
  });
};

// Subscribe to messages for a specific chat with real-time updates
export const subscribeToMessages = (
  chatId: string,
  callback: (messages: Message[]) => void
) => {
  const messagesQuery = query(
    collection(db, "messages"),
    where("chatId", "==", chatId),
    orderBy("timestamp", "asc"),
    limit(100) // Limit to last 100 messages for performance
  );

  return onSnapshot(messagesQuery, (snapshot) => {
    const messagesList: Message[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      messagesList.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp || new Date(),
      } as Message);
    });
    callback(messagesList);
  });
};

// Send a new message
export const sendMessage = async ({
  chatId,
  content,
  senderId,
  senderName,
  receiverId,
}: {
  chatId: string;
  content: string;
  senderId: string;
  senderName: string;
  receiverId: string;
}) => {
  try {
    const batch = writeBatch(db);

    // Add new message
    const messageRef = doc(collection(db, "messages"));
    batch.set(messageRef, {
      chatId,
      content,
      senderId,
      senderName,
      receiverId,
      timestamp: serverTimestamp(),
      read: false,
    });

    // Update chat with last message details
    const chatRef = doc(db, "chats", chatId);
    batch.update(chatRef, {
      lastMessage: content,
      lastMessageTime: serverTimestamp(),
      lastMessageSenderId: senderId,
    });

    // Execute batch write
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error sending message:", error);
    return false;
  }
};

// Create a new chat between tenant and landlord if it doesn't exist
export const createChat = async (userId: string, landlordId: string) => {
  try {
    // Check if chat already exists
    const chatsQuery = query(
      collection(db, "chats"),
      where("userId", "==", userId),
      where("landlordId", "==", landlordId)
    );

    const snapshot = await getDocs(chatsQuery);

    if (!snapshot.empty) {
      // Chat already exists
      return snapshot.docs[0].id;
    }

    // Get user and landlord profiles
    const userDoc = await getDoc(doc(db, "users", userId));
    const landlordDoc = await getDoc(doc(db, "users", landlordId));

    if (!userDoc.exists() || !landlordDoc.exists()) {
      throw new Error("User or landlord not found");
    }

    const userData = userDoc.data() as DocumentData;
    const landlordData = landlordDoc.data() as DocumentData;

    // Create new chat
    const chatRef = doc(collection(db, "chats"));
    await setDoc(chatRef, {
      userId,
      landlordId,
      displayName: landlordData.displayName || "Landlord",
      photoURL: landlordData.photoURL || null,
      userDisplayName: userData.displayName || "User",
      userPhotoURL: userData.photoURL || null,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    // Add participants data to subcollection - FIXED
    const participantsCollection = collection(chatRef, "participants");
    const userParticipantRef = doc(participantsCollection, userId);
    await setDoc(userParticipantRef, {
      displayName: userData.displayName,
      photoURL: userData.photoURL || null,
      role: userData.role,
      status: "online",
    });

    const landlordParticipantRef = doc(participantsCollection, landlordId);
    await setDoc(landlordParticipantRef, {
      displayName: landlordData.displayName,
      photoURL: landlordData.photoURL || null,
      role: landlordData.role,
      status: "offline",
    });

    return chatRef.id;
  } catch (error) {
    console.error("Error creating chat:", error);
    throw error;
  }
};

// Mark messages as read
export const markMessagesAsRead = async (
  chatId: string,
  messageIds: string[]
) => {
  try {
    const batch = writeBatch(db);

    messageIds.forEach((messageId) => {
      const messageRef = doc(db, "messages", messageId);
      batch.update(messageRef, {
        read: true,
      });
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return false;
  }
};

// Update user status (online/offline)
export const updateUserStatus = async (
  userId: string,
  status: "online" | "offline"
) => {
  try {
    const chatsQuery = query(
      collection(db, "chats"),
      where("userId", "==", userId)
    );

    const landlordChatsQuery = query(
      collection(db, "chats"),
      where("landlordId", "==", userId)
    );

    const batch = writeBatch(db);

    // Update as tenant
    const snapshot = await getDocs(chatsQuery);
    snapshot.forEach((docSnapshot) => {
      const participantRef = doc(
        collection(docSnapshot.ref, "participants"),
        userId
      );
      batch.update(participantRef, { 
        status,
        lastSeen: status === "offline" ? serverTimestamp() : null
      });
    });

    // Update as landlord
    const landlordSnapshot = await getDocs(landlordChatsQuery);
    landlordSnapshot.forEach((docSnapshot) => {
      const participantRef = doc(
        collection(docSnapshot.ref, "participants"),
        userId
      );
      batch.update(participantRef, { 
        status,
        lastSeen: status === "offline" ? serverTimestamp() : null
      });
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error updating user status:", error);
    return false;
  }
};
