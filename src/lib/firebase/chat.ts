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
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, onValue, set, onDisconnect, get } from "firebase/database";
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
  replyTo?: {
    messageId: string;
    content: string;
    senderId: string;
    senderName: string;
  };
  // Soft-delete fields
  deleted?: boolean;
  deletedBy?: string;
  deletedAt?: any;
}

export interface Chat {
  chatId: string;
  userId: string;
  displayName: string;
  photoURL?: string | null;
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
  photoURL?: string | null;
  role?: string;
  status?: string;
  lastSeen?: any;
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
    const chatData: { [chatId: string]: DocumentData } = {};
    const otherUserIds: { [chatId: string]: string } = {};

    // First pass: extract basic chat data and collect IDs for batch operations
    snapshot.docs.forEach(
      (docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnapshot.data();
        chatData[docSnapshot.id] = data;
        const otherUserId =
          userRole === "landlord_verified" && data.landlordId === userId
            ? data.userId
            : data.landlordId;
        otherUserIds[docSnapshot.id] = otherUserId;
      }
    );

    // Batch get participant data
    const participantPromises = Object.entries(otherUserIds).map(
      async ([chatId, otherUserId]) => {
        const participantRef = doc(
          collection(db, "chats", chatId, "participants"),
          otherUserId
        );
        const userDoc = await getDoc(participantRef);

        // If participant data doesn't exist or is missing photoURL, fetch from users collection
        let userData = userDoc.exists()
          ? (userDoc.data() as ParticipantData)
          : {};

        if (!userData.photoURL) {
          // Try to get user data from users collection as fallback
          const userProfileRef = doc(db, "users", otherUserId);
          const userProfileDoc = await getDoc(userProfileRef);

          if (userProfileDoc.exists()) {
            const profileData = userProfileDoc.data();
            // Update participant data with profile data
            userData = {
              ...userData,
              photoURL: profileData.photoURL || "",
              displayName:
                userData.displayName || profileData.displayName || "User",
            };

            // Update the participants collection with the latest data
            await setDoc(participantRef, userData, { merge: true });
          }
        }

        return {
          chatId,
          userData: userData,
        };
      }
    );

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
        unreadCount: unreadSnapshot.size,
      };
    });

    // Wait for all batch operations to complete
    const [participantResults, unreadResults] = await Promise.all([
      Promise.all(participantPromises),
      Promise.all(unreadPromises),
    ]);

    // Create a map for faster lookups
    const participantMap: { [chatId: string]: ParticipantData } = {};
    participantResults.forEach((result) => {
      participantMap[result.chatId] = result.userData;
    });

    const unreadMap: { [chatId: string]: number } = {};
    unreadResults.forEach((result) => {
      // Check if we have a cached unread count of 0 for this chat
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
    snapshot.docs.forEach(
      (docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
        const chatId = docSnapshot.id;
        const data = chatData[chatId];
        const otherUserId = otherUserIds[chatId];
        const userData = participantMap[chatId] || {};

        chatsList.push({
          chatId,
          userId: otherUserId,
          displayName: userData.displayName || "User",
          photoURL: userData.photoURL || "",
          lastMessage: data.lastMessage,
          lastMessageTime: data.lastMessageTime,
          timestamp: data.timestamp,
          role: userData.role || data.role,
          senderId: data.lastMessageSenderId,
          unreadCount: unreadMap[chatId] || 0,
          status: userData.status || "offline",
          lastSeen: userData.lastSeen || null,
        });
      }
    );

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

    // Preserve original photoURL (do not strip query params like token)
    callback(chatsList);
  });
};

// export function subscribeToUserProfile(
//   userId: string,
//   callback: (userData: DocumentData) => void
// ) {
//   const userRef = doc(db, "users", userId);
//   return onSnapshot(userRef, (doc) => {
//     if (doc.exists()) {
//       callback(doc.data());
//     }
//   });
// }

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
    messageCache.cacheMessagePage(
      chatId,
      0,
      orderedMessages,
      messagesList.length >= messagesLimit
    );

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
    if (pageIndex !== undefined && typeof pageIndex === "number") {
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
  replyTo,
}: {
  chatId: string;
  content: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  replyTo?: {
    messageId: string;
    content: string;
    senderId: string;
    senderName: string;
  };
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
      replyTo: replyTo || null,
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


/**
 * Soft-delete a message for everyone (kept in DB but hidden content in UI)
 * Marks message with deleted flags so all participants see a placeholder
 */
export const deleteMessageForEveryone = async (
  messageId: string,
  userId: string
): Promise<boolean> => {
  try {
    const messageRef = doc(db, "messages", messageId);
    await updateDoc(messageRef, {
      deleted: true,
      deletedBy: userId,
      deletedAt: serverTimestamp(),
    });
    // No need to mutate caches here; snapshot listeners will propagate
    return true;
  } catch (error) {
    console.error("Error deleting message:", error);
    return false;
  }
};


// Create a new chat between tenant and landlord if it doesn't exist
export const createChat = async (userId: string, landlordId: string) => {
  console.log("🔍 createChat - START", { userId, landlordId });

  try {
    // Create the participants array
    const participants = [userId, landlordId];
    console.log("🔍 Participants array created:", participants);

    // Check for existing chat
    console.log("🔍 Checking for existing chat...");
    const existingChatId = await checkForExistingChat(userId, landlordId);
    console.log("🔍 Existing chat check complete:", existingChatId);

    if (existingChatId) {
      console.log("🔍 Found existing chat, returning ID:", existingChatId);
      return existingChatId;
    }

    // Fetch user profiles
    console.log("🔍 Fetching user profiles...");
    const userDoc = await getDoc(doc(db, "users", userId));
    console.log("🔍 User document fetched:", userDoc.exists());

    const landlordDoc = await getDoc(doc(db, "users", landlordId));
    console.log("🔍 Landlord document fetched:", landlordDoc.exists());

    if (!userDoc.exists() || !landlordDoc.exists()) {
      throw new Error("User or landlord not found");
    }

    const userData = userDoc.data() as DocumentData;
    const landlordData = landlordDoc.data() as DocumentData;

    // Check landlord's actual online status from RTDB
    console.log("🔍 Checking landlord status...");
    let landlordStatus = "offline"; // Default status
    let landlordLastSeen = null;

    try {
      const landlordStatusRef = ref(rtdb, `status/${landlordId}`);

      // Create a promise that will reject after 5 seconds
      const statusPromise = get(landlordStatusRef);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("RTDB status check timed out")),
          5000
        );
      });

      // Race between the actual fetch and the timeout
      const result = await Promise.race([statusPromise, timeoutPromise]).catch(
        (error) => {
          console.warn("⚠️ Error or timeout getting landlord status:", error);
          return null; // Return null to indicate failure
        }
      );

      if (result) {
        // Use type assertion to handle the TypeScript issue
        const snapshot = result as any;
        if (snapshot.exists && snapshot.exists()) {
          const val = snapshot.val();
          landlordStatus = val.status || "offline";
          landlordLastSeen = val.lastSeen || null;
        }
      }
    } catch (error) {
      console.error("❌ Error in landlord status check:", error);
    }

    console.log("🔍 Landlord status (determined):", landlordStatus);

    // STEP 1: Create just the main chat document first
    console.log("🔍 Creating main chat document...");
    const chatRef = doc(collection(db, "chats"));
    await setDoc(chatRef, {
      userId,
      landlordId,
      participants, // This array is critical for your query to work
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastMessageTime: serverTimestamp(),
    });
    console.log("✅ Main chat document created successfully:", chatRef.id);

    // STEP 2: Now create the user participant document separately
    try {
      console.log("🔍 Creating user participant document...");
      const userParticipantRef = doc(
        collection(db, `chats/${chatRef.id}/participants`),
        userId
      );
      await setDoc(userParticipantRef, {
        displayName: userData.displayName || "User",
        role: userData.role,
        status: "online",
        updatedAt: serverTimestamp(),
      });
      console.log("✅ User participant document created successfully");
    } catch (error) {
      console.error("⚠️ Error creating user participant:", error);
      // Continue anyway since we already created the main chat
    }

    // STEP 3: Create the landlord participant document separately
    try {
      console.log("🔍 Creating landlord participant document...");
      const landlordParticipantRef = doc(
        collection(db, `chats/${chatRef.id}/participants`),
        landlordId
      );
      await setDoc(landlordParticipantRef, {
        displayName: landlordData.displayName || "Landlord",
        role: landlordData.role,
        status: landlordStatus,
        lastSeen: landlordStatus === "offline" ? landlordLastSeen : null,
        updatedAt: serverTimestamp(),
      });
      console.log("✅ Landlord participant document created successfully");
    } catch (error) {
      console.error("⚠️ Error creating landlord participant:", error);
      // Continue anyway since we already created the main chat
    }

    // STEP 4: Return the chat ID even if some steps failed
    console.log("🎉 Chat creation process complete with ID:", chatRef.id);
    return chatRef.id;
  } catch (error) {
    console.error("❌ Error creating chat:", error);
    throw error;
  } finally {
    console.log("🔍 createChat - COMPLETE (success or failure)");
  }
};

// Add this helper function within the same file
export const checkForExistingChat = async (
  userId: string,
  landlordId: string
) => {
  try {
    const userChatsQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", userId)
    );

    const querySnapshot = await getDocs(userChatsQuery);

    for (const doc of querySnapshot.docs) {
      const chatData = doc.data();
      if (chatData.participants && chatData.participants.includes(landlordId)) {
        return doc.id;
      }
    }

    return null;
  } catch (error) {
    console.error("Error checking for existing chat:", error);
    return null;
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

// Typing feature removed

// Optimized user status tracking
export const setupOnlineStatusTracking = (userId: string) => {
  const userStatusRef = ref(rtdb, `status/${userId}`);

  // Set when online
  set(userStatusRef, { status: "online", lastSeen: Date.now() });

  // When user disconnects, update to offline
  onDisconnect(userStatusRef).set({
    status: "offline",
    lastSeen: Date.now(),
  });

  // Create a connection reference to track connection state
  const connectedRef = ref(rtdb, ".info/connected");

  // Subscribe to connection state
  const unsubscribe = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      // We're connected (or reconnected)
      // Update status in RTDB
      set(userStatusRef, { status: "online", lastSeen: Date.now() });

      // Set up disconnect handler
      onDisconnect(userStatusRef).set({
        status: "offline",
        lastSeen: Date.now(),
      });
    }
  });

  return () => {
    // Cleanup function
    unsubscribe();
    set(userStatusRef, { status: "offline", lastSeen: Date.now() });

    // Update all chat participants with offline status
    updateUserStatus(userId, "offline");
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

    // Also update the user's status in RTDB
    const userStatusRef = ref(rtdb, `status/${userId}`);
    set(userStatusRef, {
      status,
      lastSeen: status === "offline" ? Date.now() : null,
    });

    // Update as tenant
    const snapshot = await getDocs(chatsQuery);
    snapshot.forEach((docSnapshot) => {
      const participantRef = doc(
        collection(docSnapshot.ref, "participants"),
        userId
      );
      batch.update(participantRef, {
        status,
        lastSeen: status === "offline" ? serverTimestamp() : null,
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
        lastSeen: status === "offline" ? serverTimestamp() : null,
      });
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error updating user status:", error);
    return false;
  }
};

// Add this function to your chat.ts file in the firebase/lib directory

/**
 * Hides a chat for a specific user without deleting the actual messages
 * @param chatId The ID of the chat to hide
 * @param userId The ID of the user hiding the chat
 * @returns Promise that resolves when the chat is hidden
 */
export const hideChat = async (
  chatId: string,
  userId: string
): Promise<boolean> => {
  try {
    const userChatRef = doc(db, "users", userId, "hiddenChats", chatId);

    await setDoc(userChatRef, {
      hidden: true,
      hiddenAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error("Error hiding chat:", error);
    return false;
  }
};

/**
 * Updates a user's profile data in all participant collections where they appear
 * @param userId The user ID whose profile data should be updated
 * @param profileData An object containing profile data to update (photoURL, displayName, etc.)
 */
export const updateProfileInAllChats = async (
  userId: string,
  profileData: { [key: string]: any }
) => {
  try {
    // Remove photoURL from profile data if it exists
    const { ...otherData } = profileData;

    // Find all chats where the user is a landlord
    const landlordChatsQuery = query(
      collection(db, "chats"),
      where("landlordId", "==", userId)
    );

    // Find all chats where the user is a tenant
    const tenantChatsQuery = query(
      collection(db, "chats"),
      where("userId", "==", userId)
    );

    // Get results from both queries
    const [landlordChats, tenantChats] = await Promise.all([
      getDocs(landlordChatsQuery),
      getDocs(tenantChatsQuery),
    ]);

    // Combine the chat IDs
    const chatIds = [
      ...landlordChats.docs.map((doc) => doc.id),
      ...tenantChats.docs.map((doc) => doc.id),
    ];

    // Update participant data in each chat
    const updatePromises = chatIds.map((chatId) => {
      const participantRef = doc(db, "chats", chatId, "participants", userId);
      const chatRef = doc(db, "chats", chatId);

      // Add timestamp to data for Firestore triggers
      const dataWithTimestamp = {
        ...otherData,
        updatedAt: serverTimestamp(),
      };

      // Update both participant document and parent chat document
      return Promise.all([
        updateDoc(participantRef, dataWithTimestamp),
        updateDoc(chatRef, {
          updatedAt: serverTimestamp(),
          lastParticipantUpdate: serverTimestamp(),
        }),
      ]);
    });

    // Execute all updates
    await Promise.all(updatePromises);

    return true;
  } catch (error) {
    console.error("Error updating profile in chats:", error);
    return false;
  }
};
