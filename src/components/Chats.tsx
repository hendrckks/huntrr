import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Check,
  CheckCheck,
  ArrowLeft,
  Loader2,
  ArrowDown,
  ArrowUp,
  Smile,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Badge } from "./ui/badge";
import { format } from "date-fns";
import {
  subscribeToChats,
  subscribeToMessages,
  sendMessage,
  createChat,
  markMessagesAsRead,
  loadOlderMessages,
  type Message,
  type Chat,
  checkForExistingChat,
} from "../lib/firebase/chat";
import { MESSAGE_PAGE_SIZE } from "../lib/cache/messageCache";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase/clientApp";

const Chats = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [selectedChatData, setSelectedChatData] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  // typing feature removed
  const [loading, setLoading] = useState(true);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [creatingNewChat, setCreatingNewChat] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const processingLandlordIdRef = useRef(false);

  // Add this ref to track when we're loading older messages
  const isLoadingOlderMessagesRef = useRef(false);
  // Add this ref to preserve scroll position when loading older messages
  const oldMessagesHeightRef = useRef(0);

  // Add a ref to track if user is manually scrolling
  const userIsScrollingRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  // Add a ref to track if we just sent a message
  const justSentMessageRef = useRef(false);

  // use shared helper from firebase/chat

  // In the Chats component, modify the useEffect for chat subscription

  useEffect(() => {
    if (!user?.uid || !user?.role) return;

    // Don't set loading to true if we're in the middle of creating a new chat
    if (!creatingNewChat && !selectedChatData) {
      setLoading(true);
    }

    const unsubscribe = subscribeToChats(user.uid, user.role, (chatsList) => {
      // Keep original photoURL intact (signed URLs require their full query string)
      const safeChats: Chat[] = chatsList.filter(
        (c): c is Chat => Boolean(c && typeof c === "object" && (c as any).chatId)
      );
      setChats(safeChats);

      if (selectedChat) {
        const matchingChat = safeChats.find((chat) => chat && chat.chatId === selectedChat);

        if (matchingChat) {
          setSelectedChatData(matchingChat);

          // Only reset creatingNewChat state when the chat data is fully loaded and visible
          // Set a small delay to ensure the UI has time to update
          setTimeout(() => {
            setCreatingNewChat(false);
            setLoading(false);
            processingLandlordIdRef.current = false;
          }, 1000); // Add a small delay to ensure the message shows
        }
      } else {
        // Only set loading to false if we're not creating a new chat
        if (!creatingNewChat) {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [user, selectedChat, creatingNewChat, selectedChatData]);

  // Also modify the landlordId effect to ensure loading state is properly maintained
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const landlordId = params.get("landlordId");

    if (
      landlordId &&
      user?.uid &&
      user?.role &&
      !processingLandlordIdRef.current
    ) {
      processingLandlordIdRef.current = true;
      setLoading(true);
      setCreatingNewChat(true);

      (async () => {
        try {
          const existingChatId = await checkForExistingChat(
            user.uid,
            landlordId
          );

          if (existingChatId) {
            navigate("/chats", { replace: true });
            setSelectedChat(existingChatId);
            setShowMessages(true);

            const landlordDoc = await getDoc(doc(db, "users", landlordId));
            if (landlordDoc.exists()) {
              const landlordData = landlordDoc.data();
              setSelectedChatData({
                chatId: existingChatId,
                userId: landlordId,
                displayName: landlordData.displayName || "Landlord",
                lastMessage: "",
                role: landlordData.role || "landlord_verified",
                status: "offline",
                photoURL: landlordData.photoURL || "",
                unreadCount: 0,
              });
            }
          } else {
            try {
              const chatId = await createChat(user.uid, landlordId);

              if (chatId) {
                navigate("/chats", { replace: true });
                setSelectedChat(chatId);
                setShowMessages(true);

                const landlordDoc = await getDoc(doc(db, "users", landlordId));
                if (landlordDoc.exists()) {
                  const landlordData = landlordDoc.data();
                  setSelectedChatData({
                    chatId: chatId,
                    userId: landlordId,
                    displayName: landlordData.displayName || "Landlord",
                    lastMessage: "",
                    role: landlordData.role || "landlord_verified",
                    status: "offline",
                    photoURL: landlordData.photoURL || "",
                    unreadCount: 0,
                  });
                }
              }
            } catch (error) {
              console.error("Error creating new chat:", error);
              setLoading(false);
              setCreatingNewChat(false);
              processingLandlordIdRef.current = false;
            }
          }

          // Don't reset states here - let the chat subscription handle it
          // when the chat data is fully loaded
        } catch (error) {
          console.error("Error in landlordId processing:", error);
          setLoading(false);
          setCreatingNewChat(false);
          processingLandlordIdRef.current = false;
        }
      })();
    }
  }, [location, user?.uid, user?.role, navigate]);

  useEffect(() => {
    if (!selectedChat || !user?.uid) return;

    const unsubscribe = subscribeToMessages(selectedChat, (messagesList) => {
      setMessages(messagesList);
      setHasMoreMessages(messagesList.length >= MESSAGE_PAGE_SIZE);

      // Get the latest message if there are any messages
      const latestMessage =
        messagesList.length > 0 ? messagesList[messagesList.length - 1] : null;

      // Update unread count in real-time when new message arrives
      if (
        latestMessage &&
        latestMessage.senderId !== user.uid &&
        !latestMessage.read
      ) {
        setChats((prevChats) =>
          prevChats.map((chat) => {
            // For the chat where the message was received
            if (chat && chat.chatId === latestMessage.chatId) {
              // Only increment if it's not the selected chat
              return chat.chatId !== selectedChat
                ? { ...chat, unreadCount: (chat.unreadCount || 0) + 1 }
                : chat;
            }
            return chat;
          })
        );
      }

      // Mark messages as read for the selected chat
      const unreadMessages = messagesList.filter(
        (msg) => msg.senderId !== user.uid && !msg.read
      );

      if (unreadMessages.length > 0) {
        // Optimistically update the UI
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            unreadMessages.some((unread) => unread.id === msg.id)
              ? { ...msg, read: true }
              : msg
          )
        );

        // Reset unread count for the selected chat
        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat && chat.chatId === selectedChat
              ? { ...chat, unreadCount: 0 }
              : chat
          )
        );

        // Update in the database
        markMessagesAsRead(
          selectedChat,
          unreadMessages.map((msg) => msg.id)
        );
      }
    });

    return () => unsubscribe();
  }, [selectedChat, user]);

  // Modified useEffect for scrolling to properly handle loading older messages
  useEffect(() => {
    // Don't scroll if we're loading older messages
    if (isLoadingOlderMessagesRef.current) {
      setTimeout(() => {
        if (messageContainerRef.current) {
          // After older messages are loaded, maintain the scroll position relative to the content that was already there
          const newScrollPosition =
            messageContainerRef.current.scrollHeight -
            oldMessagesHeightRef.current;
          messageContainerRef.current.scrollTop = newScrollPosition;
        }
        isLoadingOlderMessagesRef.current = false;
      }, 0);
    } else if (messagesEndRef.current && !isLoadingOlderMessagesRef.current) {
      // Auto-scroll only when:
      // 1. User just sent a message (justSentMessageRef.current)
      // 2. Messages first load (selectedChat changes)
      // 3. User is already at the bottom when new message arrives
      if (messageContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } =
          messageContainerRef.current;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;

        // Only auto-scroll if we just sent a message, or if we're near bottom and not manually scrolling
        const shouldAutoScroll =
          messages.length > 0 &&
          (justSentMessageRef.current ||
            (isNearBottom && !userIsScrollingRef.current));

        if (shouldAutoScroll) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  }, [messages, selectedChat, user?.uid]);

  // Handle scroll to determine when to show the scroll button
  const handleScroll = useCallback(() => {
    if (messageContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messageContainerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 20; // 20px threshold
      setShowScrollButton(!isAtBottom);

      // Set userIsScrolling flag when scrolling up
      if (scrollTop < lastScrollTopRef.current) {
        userIsScrollingRef.current = true;
        justSentMessageRef.current = false;
      }
      lastScrollTopRef.current = scrollTop;

      // Reset the scrolling flag if user reaches bottom
      if (isAtBottom) {
        userIsScrollingRef.current = false;
      }
    }
  }, []);

  // Scroll to bottom function for the arrow button
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Add scroll event listener to message container
  useEffect(() => {
    const container = messageContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      // Initial check
      handleScroll();
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [selectedChat, messages, handleScroll]);

  useEffect(() => {
    if (selectedChat && window.innerWidth < 768) {
      setShowMessages(true);
    }
  }, [selectedChat]);

  // typing effect removed

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setNewMessage(newValue);

    // typing feature removed
  };

  // Memoize chat selection function
  const handleChatSelection = useCallback(
    (chatId: string) => {
      setSelectedChat(chatId);
      const chat = chats.find(
        (c) => c && typeof c === "object" && c.chatId === chatId
      );
      if (chat) {
        setSelectedChatData(chat);
        // Reset unread count when selecting a chat
        setChats((prevChats) =>
          prevChats.map((c) =>
            c && c.chatId === chatId ? { ...c, unreadCount: 0 } : c
          )
        );
      }
      // Reset scroll flags when selecting a new chat
      userIsScrollingRef.current = false;
      justSentMessageRef.current = false;
      if (window.innerWidth < 768) {
        setShowMessages(true);
      }
      // Reset messages to ensure clean state for new chat
      setMessages([]);
      // Scroll to bottom after messages load
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 200); // Increased delay to ensure messages are loaded
    },
    [chats]
  );

  // Memoize filtered and sorted chats
  const sortedChats = useMemo(() => {
    // Filter out any undefined or null chat objects before sorting
    return [...chats]
      .filter((chat) => chat && typeof chat === "object" && chat.chatId)
      .sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return b.lastMessageTime.seconds - a.lastMessageTime.seconds;
      });
  }, [chats]);

  // Memoize the message sending function
  const handleSendMessage = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }

      if (
        !newMessage.trim() ||
        !selectedChat ||
        !user?.uid ||
        !user?.displayName
      )
        return;

      // Reset scroll flags when sending a new message
      userIsScrollingRef.current = false;
      justSentMessageRef.current = true;
      // typing feature removed

      try {
        const success = await sendMessage({
          chatId: selectedChat,
          content: newMessage,
          senderId: user.uid,
          senderName: user.displayName,
          receiverId: selectedChatData?.userId || "",
        });

        if (success) {
          setNewMessage("");
          // Clear justSentMessage flag after a short delay
          setTimeout(() => {
            justSentMessageRef.current = false;
          }, 500);
        }
      } catch (error) {
        console.error("Error sending message:", error);
      } finally {
        // typing feature removed
      }
    },
    [newMessage, selectedChat, user, selectedChatData]
  );

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return "";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "HH:mm");
  };

  // Handle emoji selection
  const handleEmojiClick = (emojiData: any) => {
    setNewMessage((prevMessage) => prevMessage + emojiData.emoji);
  };

  // Memoize the messages rendering
  const messageElements = useMemo(() => {
    // Inside the messageElements useMemo function
    return messages.map((message) => (
      <div
        key={message.id}
        className={`flex flex-col ${
          message.senderId === user?.uid ? "items-end" : "items-start"
        }`}
      >
        <div className="flex flex-col space-y-1 max-w-[80%] w-fit">
          <div
            className={`py-2 md:px-4 px-4 flex items-center ${
              message.senderId === user?.uid
                ? "bg-black/20 dark:bg-white/20 dark:text-white text-black rounded-t-full rounded-bl-full"
                : "bg-black/80 dark:bg-white dark:text-black text-white rounded-t-full rounded-br-full"
            }`}
          >
            {message.senderId !== user?.uid && (
              <span className="text-[10px] text-opacity-80 mr-4">
                {formatMessageTime(message.timestamp)}
              </span>
            )}
            <div className="text-sm text-opacity-85 mb-0.5">
              {message.content}
            </div>
            {message.senderId === user?.uid && (
              <span className="text-[10px] text-opacity-80 ml-4">
                {formatMessageTime(message.timestamp)}
              </span>
            )}
          </div>
        </div>
        <div
          className={`flex items-center space-x-2 text-xs text-muted-foreground ${
            message.senderId === user?.uid ? "justify-end" : "justify-start"
          }`}
        >
          {message.senderId === user?.uid && (
            <span>
              {message.read ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs">Read</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs">delivered</span>
                </div>
              )}
            </span>
          )}
          {/* Only show check marks for messages sent by the current user */}
          {message.senderId === user?.uid && (
            <span className="ml-1">
              {message.read ? (
                <div className="flex items-center gap-2">
                  <CheckCheck className="h-4 w-4" />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </span>
          )} 
        </div>
      </div>
    ));
  }, [messages, user?.uid]);

  const formatLastSeen = (timestamp: any) => {
    if (!timestamp) return "";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    return format(date, "MMM d, HH:mm");
  };

  const handleBackToList = () => {
    setShowMessages(false);
  };

  // Function to load older messages
  // Modified function to load older messages
  const handleLoadOlderMessages = async () => {
    if (!selectedChat || !messages.length || loadingOlderMessages) return;

    setLoadingOlderMessages(true);
    isLoadingOlderMessagesRef.current = true;

    try {
      // Store the current scroll height before loading older messages
      if (messageContainerRef.current) {
        oldMessagesHeightRef.current = messageContainerRef.current.scrollHeight;
      }

      // Get the oldest message ID as the cursor
      const oldestMessage = messages[0];

      // Load older messages before this one
      const olderMessages = await loadOlderMessages(
        selectedChat,
        oldestMessage.id
      );

      if (olderMessages.length > 0) {
        // Update messages state with older messages prepended
        setMessages((prevMessages) => [...olderMessages, ...prevMessages]);
        // Check if there might be more messages to load
        setHasMoreMessages(olderMessages.length >= MESSAGE_PAGE_SIZE);
      } else {
        // No more messages to load
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Error loading older messages:", error);
      setHasMoreMessages(false);
    } finally {
      setLoadingOlderMessages(false);
      // Note: We don't reset isLoadingOlderMessagesRef.current here
      // It will be reset in the useEffect that handles scrolling
    }
  };

  return (
    <div className="container mx-auto p-4 px-2 md:-mt-4 -mt-6 md:-mb-4 mb-2s max-w-7xl md:h-[calc(100vh-6rem)] h-fit overflow-scroll">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-transparent h-[88vh] md:h-full">
        {(!showMessages || window.innerWidth >= 768) && (
          <Card className="md:col-span-1 h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <Button
                  onClick={() => navigate(-1)}
                  className="text-xs py-2 px-3 shadow-lg bg-black/90 dark:bg-white/90 backdrop-blur-2xl rounded-lg"
                >
                  <ArrowLeft size={18} />
                </Button>
                <span>Conversations</span>
                <Badge
                  variant="secondary"
                  className="ml-2 py-2 px-4 dark:bg-white dark:text-black shadow-lg backdrop-blur-xl rounded-lg"
                >
                  {chats.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-2 h-[calc(100dvh-6rem)] md:h-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>
                    {creatingNewChat
                      ? "Creating new conversation..."
                      : "Loading conversations..."}
                  </span>
                </div>
              ) : chats.length === 0 && !selectedChatData ? (
                <div className="flex flex-col items-center -mt-4 justify-center h-full text-center text-muted-foreground">
                  <div className="text-xl dark:text-white text-black font-medium">No conversations yet</div>
                  <div className="text-sm mt-2">
                    Your chats will appear here
                  </div>
                </div>
              ) : (
                <>
                  {creatingNewChat && selectedChatData && (
                    <div className="p-3 rounded-lg bg-secondary">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          {selectedChatData.photoURL ? (
                            <AvatarImage src={selectedChatData.photoURL} alt={selectedChatData.displayName || "User"} />
                          ) : null}
                          <AvatarFallback>
                            {selectedChatData.displayName
                              ?.charAt(0)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">
                            {selectedChatData.displayName}
                          </div>
                          <Badge variant="outline" className="text-xs mt-1">
                            {selectedChatData.role === "landlord_verified"
                              ? "Landlord"
                              : "Tenant"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}

                  {sortedChats.map((chat) => (
                    <div
                      key={chat.chatId}
                      className={`flex items-center space-x-4 p-3 bg-black/5 dark:bg-white/5 mb-3 border border-black/5 dark:border-white/5 shadow-sm backdrop-blur-3xl rounded-xl cursor-pointer transition-colors ${
                        selectedChat === chat.chatId
                          ? "bg-black/10 dark:bg-white/10"
                          : "hover:bg-black/10 dark:hover:bg-white/10"
                      }`}
                      onClick={() => handleChatSelection(chat.chatId)}
                    >
                      <div className="relative">
                        <Avatar className="h-14 w-14 border border-black/20 dark:border-white/20">
                          {chat.photoURL ? (
                            <AvatarImage src={chat.photoURL} alt={chat.displayName || "User"} />
                          ) : null}
                          <AvatarFallback>
                            {chat.displayName?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {chat.status === "online" && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <div className="md:text-base text-[15px] tracking-tight flex items-center font-medium truncate">
                            {chat.displayName}

                            {chat.role === "landlord_verified" && (
                              <svg
                                width="20px"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                className="inline-block ml-2"
                              >
                                <path
                                  clipRule="evenodd"
                                  d="M6.26202 4.15083C6.61985 4.18385 6.98697 4.16957 7.31887 4.03183C7.6505 3.89421 7.92359 3.64355 8.15302 3.36736C8.59325 2.83743 9.25722 2.5 10 2.5C10.7428 2.5 11.4067 2.83743 11.847 3.36737C12.0764 3.64355 12.3495 3.89421 12.6811 4.03183C13.013 4.16956 13.3801 4.18385 13.7379 4.15083C14.4238 4.08755 15.1317 4.31847 15.6568 4.84357C16.182 5.36881 16.4129 6.07693 16.3495 6.76296C16.3164 7.12056 16.3307 7.48746 16.4683 7.81917C16.6058 8.15061 16.8563 8.42355 17.1324 8.65282C17.6625 9.09305 18 9.75711 18 10.5C18 11.2429 17.6625 11.907 17.1324 12.3472C16.8563 12.5764 16.6058 12.8494 16.4683 13.1808C16.3307 13.5125 16.3164 13.8794 16.3495 14.237C16.4129 14.9231 16.182 15.6312 15.6568 16.1564C15.1317 16.6815 14.4238 16.9124 13.7379 16.8492C13.3801 16.8162 13.013 16.8304 12.6811 16.9682C12.3495 17.1058 12.0764 17.3564 11.847 17.6326C11.4067 18.1626 10.7428 18.5 10 18.5C9.25722 18.5 8.59325 18.1626 8.15302 17.6326C7.92359 17.3565 7.6505 17.1058 7.31887 16.9682C6.98696 16.8304 6.61985 16.8161 6.26202 16.8492C5.57615 16.9124 4.86826 16.6815 4.34315 16.1564C3.81788 15.6312 3.58699 14.923 3.65047 14.2369C3.68356 13.8794 3.66932 13.5125 3.53169 13.1808C3.39418 12.8494 3.14369 12.5765 2.86765 12.3472C2.33755 11.907 2 11.2429 2 10.5C2 9.75709 2.33755 9.09302 2.86765 8.65279C3.14369 8.42354 3.39418 8.15063 3.53169 7.81921C3.66932 7.48752 3.68356 7.12065 3.65047 6.76306C3.58699 6.077 3.81788 5.36883 4.34315 4.84357C4.86826 4.31846 5.57616 4.08755 6.26202 4.15083Z"
                                  fill="#FF6143"
                                  fillRule="evenodd"
                                ></path>
                                <path
                                  d="M8 10.5L9.5 12L12 9"
                                  stroke="white"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                            <div className="flex items-center text-transparent gap-1 ml-2">
                              {(chat.unreadCount ?? 0) > 0 && (
                                <div className="w-2 h-2 rounded-full bg-[#8752f3]" />
                              )}
                              {/* <Badge
                              variant="outline"
                              className="text-xs border border-black/20 bg-[#8752f3]/30 rounded-sm dark:border-white/20"
                            >
                              {chat.role === "landlord_verified"
                                ? "Landlord"
                                : "Tenant"}
                            </Badge> */}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {chat.lastMessageTime &&
                              formatMessageTime(chat.lastMessageTime)}
                          </span>
                        </div>

                        {chat.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {chat.senderId === user?.uid ? "You: " : ""}
                            {chat.lastMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {(showMessages || window.innerWidth >= 768) && (
          <Card className="md:col-span-2 h-[88vh] md:h-full flex flex-col">
            <CardHeader className="border-b p-4">
              {selectedChatData ? (
                <div className="flex items-center justify-between ">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={handleBackToList}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-12 w-12 border border-black/20 dark:border-white/20">
                      {selectedChatData?.photoURL ? (
                        <AvatarImage src={selectedChatData.photoURL} alt={selectedChatData.displayName || "User"} />
                      ) : null}
                      <AvatarFallback>
                        {selectedChatData?.displayName?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="flex items-center">
                        {selectedChatData?.displayName}

                        {selectedChatData?.role === "landlord_verified" && (
                          <svg
                            width="20px"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            className="inline-block ml-2"
                          >
                            <path
                              clipRule="evenodd"
                              d="M6.26202 4.15083C6.61985 4.18385 6.98697 4.16957 7.31887 4.03183C7.6505 3.89421 7.92359 3.64355 8.15302 3.36736C8.59325 2.83743 9.25722 2.5 10 2.5C10.7428 2.5 11.4067 2.83743 11.847 3.36737C12.0764 3.64355 12.3495 3.89421 12.6811 4.03183C13.013 4.16956 13.3801 4.18385 13.7379 4.15083C14.4238 4.08755 15.1317 4.31847 15.6568 4.84357C16.182 5.36881 16.4129 6.07693 16.3495 6.76296C16.3164 7.12056 16.3307 7.48746 16.4683 7.81917C16.6058 8.15061 16.8563 8.42355 17.1324 8.65282C17.6625 9.09305 18 9.75711 18 10.5C18 11.2429 17.6625 11.907 17.1324 12.3472C16.8563 12.5764 16.6058 12.8494 16.4683 13.1808C16.3307 13.5125 16.3164 13.8794 16.3495 14.237C16.4129 14.9231 16.182 15.6312 15.6568 16.1564C15.1317 16.6815 14.4238 16.9124 13.7379 16.8492C13.3801 16.8162 13.013 16.8304 12.6811 16.9682C12.3495 17.1058 12.0764 17.3564 11.847 17.6326C11.4067 18.1626 10.7428 18.5 10 18.5C9.25722 18.5 8.59325 18.1626 8.15302 17.6326C7.92359 17.3565 7.6505 17.1058 7.31887 16.9682C6.98696 16.8304 6.61985 16.8161 6.26202 16.8492C5.57615 16.9124 4.86826 16.6815 4.34315 16.1564C3.81788 15.6312 3.58699 14.923 3.65047 14.2369C3.68356 13.8794 3.66932 13.5125 3.53169 13.1808C3.39418 12.8494 3.14369 12.5765 2.86765 12.3472C2.33755 11.907 2 11.2429 2 10.5C2 9.75709 2.33755 9.09302 2.86765 8.65279C3.14369 8.42354 3.39418 8.15063 3.53169 7.81921C3.66932 7.48752 3.68356 7.12065 3.65047 6.76306C3.58699 6.077 3.81788 5.36883 4.34315 4.84357C4.86826 4.31846 5.57616 4.08755 6.26202 4.15083Z"
                              fill="#FF6143"
                              fillRule="evenodd"
                            ></path>
                            <path
                              d="M8 10.5L9.5 12L12 9"
                              stroke="white"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </CardTitle>
                      <div className="text-xs text-muted-foreground">
                        {selectedChatData?.status === "online"
                          ? "Online"
                          : selectedChatData?.lastSeen
                          ? `Last seen ${formatLastSeen(
                              selectedChatData.lastSeen
                            )}`
                          : "Offline"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-10">
                  <p className="text-muted-foreground">{loading ? "" : ""}</p>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col">
              {selectedChatData ? (
                <div className="flex-1 overflow-y-auto p-4 h-full md:h-[450px]">
                  <div
                    ref={messageContainerRef}
                    className="md:h-[450px] h-[calc(100dvh-16rem)] overflow-y-auto space-y-4 p-4 scrollbar-thin scrollbar-thumb-muted-foreground/10 scrollbar-track-transparent transition-all duration-200"
                    onScroll={handleScroll}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-muted-foreground">
                          <div className="text-center">
                            <div>No messages yet</div>
                            <div className="text-sm mt-2">
                              Start a conversation to begin messaging
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {hasMoreMessages && (
                          <div className="flex justify-center mb-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1"
                              onClick={handleLoadOlderMessages}
                              disabled={loadingOlderMessages}
                            >
                              {loadingOlderMessages ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <ArrowUp className="h-3 w-3" />
                                  Load Previous Messages
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                        {messageElements}
                      </>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <AnimatePresence>
                    {showScrollButton && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="fixed bottom-40 md:bottom-24 md:left-2/3 left-1/2 -translate-x-1/2 z-50"
                      >
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-10 w-10 rounded-full shadow-lg dark:bg-zinc-800 dark:hover:bg-zinc-700"
                          onClick={scrollToBottom}
                        >
                          <ArrowDown className="h-5 w-5" />
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <form
                    onSubmit={handleSendMessage}
                    className="flex items-center space-x-2 p-4 border-t mt-auto"
                  >
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={handleInputChange}
                      className="flex-1"
                      disabled={!selectedChatData}
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-full"
                          disabled={!selectedChatData}
                        >
                          <Smile className="h-full w-full text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-full p-0 border-none shadow-lg"
                        align="end"
                        side="top"
                      >
                        <EmojiPicker
                          onEmojiClick={handleEmojiClick}
                          searchDisabled
                          skinTonesDisabled
                          width={300}
                          height={350}
                          previewConfig={{ showPreview: false }}
                        />
                      </PopoverContent>
                    </Popover>
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!newMessage.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="h-full md:h-[400px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center flex flex-col items-center w-1/2 justify-center gap-3 p-8 backdrop-blur-3xl bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 shadow-md">
                    <p className="text-base text-black/90 font-medium dark:text-[#fafafa]">
                      {loading
                        ? creatingNewChat
                          ? "Creating new conversation..."
                          : "Loading conversations..."
                        : "Select a conversation"}
                    </p>
                    <p className="w-2/3">
                      {loading
                        ? creatingNewChat
                          ? "Please wait while we set up your conversation..."
                          : ""
                        : "Choose from your existing conversations, start a new one, or just keep hunting."}
                    </p>
                    {loading ? (
                      <Loader2 className="h-10 w-10 mx-auto text-muted-foreground/50 animate-spin" />
                    ) : (
                      <span className="flex select-none items-center justify-center text-[72px] before:absolute before:opacity-80 before:blur-[40px] before:content-[var(--emoji)]">
                        👀
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Chats;
