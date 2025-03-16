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
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { ref, onValue, set, onDisconnect } from "firebase/database";
import { db, rtdb } from "./clientApp";
import { globalCache } from "../cache/cacheManager";
import { messageCache, MESSAGE_PAGE_SIZE } from "../cache/messageCache";

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
    // const chatPromises: Promise<void>[] = [];
    const chatData: { [chatId: string]: DocumentData } = {};
    const otherUserIds: { [chatId: string]: string } = {};
    
    // First pass: extract basic chat data and collect IDs for batch operations
    snapshot.docs.forEach((docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
      const data = docSnapshot.data();
      chatData[docSnapshot.id] = data;
      const otherUserId =
        userRole === "landlord_verified" && data.landlordId === userId
          ? data.userId
          : data.landlordId;
      otherUserIds[docSnapshot.id] = otherUserId;
    });
    
    // Batch get participant data
    const participantPromises = Object.entries(otherUserIds).map(async ([chatId, otherUserId]) => {
      const participantRef = doc(
        collection(db, "chats", chatId, "participants"),
        otherUserId
      );
      const userDoc = await getDoc(participantRef);
      return {
        chatId,
        userData: userDoc.exists() ? (userDoc.data() as ParticipantData) : {}
      };
    });
    
    // Batch get unread counts
    const unreadPromises = Object.keys(chatData).map(async (chatId) => {
      const unreadQuery = query(
        collection(db, "messages"),
        where("chatId", "==", chatId),
        where("senderId", "==", otherUserIds[chatId]),
        where("read", "==", false)
      );
      const unreadSnapshot = await getDocs(unreadQuery);
      return {
        chatId,
        unreadCount: unreadSnapshot.size
      };
    });
    
    // Wait for all batch operations to complete
    const [participantResults, unreadResults] = await Promise.all([
      Promise.all(participantPromises),
      Promise.all(unreadPromises)
    ]);
    
    // Create a map for faster lookups
    const participantMap: { [chatId: string]: ParticipantData } = {};
    participantResults.forEach(result => {
      participantMap[result.chatId] = result.userData;
    });
    
    const unreadMap: { [chatId: string]: number } = {};
    unreadResults.forEach(result => {
      // Check if we have a cached unread count of 0 for this chat
      // This ensures that if we've marked messages as read, we don't show unread count
      // even if we switch to another chat and back
      const cacheKey = `unread_${result.chatId}`;
      const cachedUnreadCount = globalCache.get(cacheKey);
      
      // If we have a cached value of 0, use it instead of the query result
      if (cachedUnreadCount === 0) {
        unreadMap[result.chatId] = 0;
      } else {
        unreadMap[result.chatId] = result.unreadCount;
      }
    });
    
    // Build final chat list
    snapshot.docs.forEach((docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
      const chatId = docSnapshot.id;
      const data = chatData[chatId];
      const otherUserId = otherUserIds[chatId];
      const userData = participantMap[chatId] || {};
      
      chatsList.push({
        chatId,
        userId: otherUserId,
        displayName: userData.displayName || data.displayName || "User",
        photoURL: userData.photoURL || data.photoURL,
        lastMessage: data.lastMessage,
        lastMessageTime: data.lastMessageTime,
        timestamp: data.timestamp,
        role: userData.role || data.role,
        senderId: data.lastMessageSenderId,
        unreadCount: unreadMap[chatId] || 0,
        status: userData.status || "offline",
      });
    });
    
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
  callback: (messages: Message[]) => void,
  messagesLimit = MESSAGE_PAGE_SIZE // Use MESSAGE_PAGE_SIZE instead of 100
) => {
  // Import messageCache here to avoid circular dependencies
  
  // Check if we have a cached first page
  const cachedPage = messageCache.getCachedMessagePage(chatId, 0);
  if (cachedPage) {
    // Use cached messages immediately for better UX
    callback(cachedPage.messages);
  }

  const messagesQuery = query(
    collection(db, "messages"),
    where("chatId", "==", chatId),
    orderBy("timestamp", "desc"),
    limit(messagesLimit)
  );

  return onSnapshot(messagesQuery, (snapshot) => {
    const messagesList: Message[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const message = {
        id: doc.id,
        ...data,
        timestamp: data.timestamp || new Date(),
      } as Message;
      
      messagesList.push(message);
      
      // Cache individual message
      messageCache.cacheMessage(message);
    });
    
    // Reverse the messages list to maintain chronological order in UI
    const orderedMessages = [...messagesList].reverse();
    
    // Cache the entire page
    messageCache.cacheMessagePage(chatId, 0, orderedMessages, messagesList.length >= messagesLimit);
    
    callback(orderedMessages);
  });
};

// Load older messages with pagination support
export const loadOlderMessages = async (
  chatId: string,
  beforeMessageId: string,
  pageSize = MESSAGE_PAGE_SIZE
): Promise<Message[]> => {
  try {
    // Get the message to use as cursor
    const cursorMsgRef = doc(db, "messages", beforeMessageId);
    const cursorMsgSnap = await getDoc(cursorMsgRef);
    
    if (!cursorMsgSnap.exists()) {
      throw new Error("Cursor message not found");
    }
    
    const cursorMsg = cursorMsgSnap.data();
    
    // Query for older messages
    const olderMsgsQuery = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
      orderBy("timestamp", "desc"),
      where("timestamp", "<", cursorMsg.timestamp),
      limit(pageSize)
    );
    
    const olderMsgsSnap = await getDocs(olderMsgsQuery);
    const olderMessages: Message[] = [];
    
    olderMsgsSnap.forEach((doc) => {
      const data = doc.data();
      const message = {
        id: doc.id,
        ...data,
        timestamp: data.timestamp || new Date(),
      } as Message;
      
      olderMessages.push(message);
      
      // Cache individual message
      messageCache.cacheMessage(message);
    });
    
    // Determine page number based on message ID
    const pageIndex = messageCache.getMessagePageIndex(chatId, beforeMessageId);
    if (pageIndex !== undefined && typeof pageIndex === 'number') {
      // Reverse the messages to maintain chronological order (oldest to newest)
      const orderedMessages = [...olderMessages].reverse();
      messageCache.cacheMessagePage(
        chatId,
        pageIndex + 1,
        orderedMessages,
        olderMessages.length >= pageSize
      );
      return orderedMessages;
    }
    
    // If no page index found, still return in chronological order
    return [...olderMessages].reverse();
  } catch (error) {
    console.error("Error loading older messages:", error);
    return [];
  }
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

    // Use batch operations for creating chat and participants
    const batch = writeBatch(db);
    
    // Create new chat
    const chatRef = doc(collection(db, "chats"));
    batch.set(chatRef, {
      userId,
      landlordId,
      displayName: landlordData.displayName || "Landlord",
      photoURL: landlordData.photoURL || null,
      userDisplayName: userData.displayName || "User",
      userPhotoURL: userData.photoURL || null,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    // Add participants data to subcollection
    const participantsCollection = collection(chatRef, "participants");
    const userParticipantRef = doc(participantsCollection, userId);
    batch.set(userParticipantRef, {
      displayName: userData.displayName,
      photoURL: userData.photoURL || null,
      role: userData.role,
      status: "online",
    });

    const landlordParticipantRef = doc(participantsCollection, landlordId);
    batch.set(landlordParticipantRef, {
      displayName: landlordData.displayName,
      photoURL: landlordData.photoURL || null,
      role: landlordData.role,
      status: "offline",
    });

    // Execute all operations in a single batch
    await batch.commit();
    
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
    if (messageIds.length === 0) return true;
    
    // Import messageCache here to avoid circular dependencies
    
    const batch = writeBatch(db);

    messageIds.forEach((messageId) => {
      const messageRef = doc(db, "messages", messageId);
      batch.update(messageRef, {
        read: true,
      });
    });

    // Also update the unread count in the local cache to ensure consistency
    // This helps prevent the unread counter from reappearing when switching chats
    const cacheKey = `unread_${chatId}`;
    globalCache.set(cacheKey, 0);
    
    // Update read status in message cache
    messageCache.updateMessageReadStatus(chatId, messageIds);

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return false;
  }
};

// Typing indicator methods
export const setTypingStatus = (chatId: string, userId: string, isTyping: boolean) => {
  const typingRef = ref(rtdb, `typing/${chatId}/${userId}`);
  return set(typingRef, {
    isTyping,
    timestamp: Date.now()
  });
};

// More efficient debounced typing handler
export const createTypingHandler = (chatId: string, userId: string) => {
  let typingTimeout: NodeJS.Timeout | null = null;
  let isCurrentlyTyping = false;
  let lastUpdateTime = 0;
  
  // Setup cleanup handler
  const typingRef = ref(rtdb, `typing/${chatId}/${userId}`);
  onDisconnect(typingRef).remove();
  
  return {
    handleTyping: () => {
      const now = Date.now();
      // Only update if not currently typing or if last update was > 2 seconds ago
      if (!isCurrentlyTyping || (now - lastUpdateTime > 2000)) {
        isCurrentlyTyping = true;
        lastUpdateTime = now;
        set(typingRef, { isTyping: true, timestamp: now });
      }
      
      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      // Set a new timeout to stop typing status
      typingTimeout = setTimeout(() => {
          isCurrentlyTyping = false;
          set(typingRef, { isTyping: false, timestamp: Date.now() });
        }, 2000);
      },
      cleanup: () => {
        if (typingTimeout) {
          clearTimeout(typingTimeout);
        }
        set(typingRef, { isTyping: false, timestamp: Date.now() });
      }
    };
  };

export const setupTypingStatusCleanup = (chatId: string, userId: string) => {
  const typingRef = ref(rtdb, `typing/${chatId}/${userId}`);
  onDisconnect(typingRef).remove();
};

export const subscribeToTypingStatus = (chatId: string, otherUserId: string, callback: (isTyping: boolean) => void) => {
  const typingRef = ref(rtdb, `typing/${chatId}/${otherUserId}`);
  
  return onValue(typingRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.isTyping) {
      // Check if typing event is recent (within last 3 seconds)
      const now = Date.now();
      if (now - data.timestamp < 3000) {
        callback(true);
        return;
      }
    }
    callback(false);
  });
};

// Optimized user status tracking
export const setupOnlineStatusTracking = (userId: string) => {
  const userStatusRef = ref(rtdb, `status/${userId}`);
  
  // Set when online
  set(userStatusRef, { status: 'online', lastSeen: serverTimestamp() });
  
  // When user disconnects, update to offline
  onDisconnect(userStatusRef).set({ 
    status: 'offline', 
    lastSeen: serverTimestamp() 
  });
  
  return () => {
    // Cleanup function
    set(userStatusRef, { status: 'offline', lastSeen: serverTimestamp() });
  };
};

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
