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
  Clock,
  Check,
  CheckCheck,
  ArrowLeft,
  Loader2,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { format } from "date-fns";
import {
  subscribeToChats,
  subscribeToMessages,
  sendMessage,
  createChat,
  markMessagesAsRead,
  setTypingStatus,
  setupTypingStatusCleanup,
  subscribeToTypingStatus,
  loadOlderMessages,
  type Message,
  type Chat,
  createTypingHandler,
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
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const landlordId = params.get("landlordId");

    if (landlordId && user?.uid && user?.role) {
      setCreatingNewChat(true);
      setLoading(true);

      createChat(user.uid, landlordId)
        .then((chatId) => {
          if (chatId) {
            navigate("/chats", { replace: true });
            setSelectedChat(chatId);
            setShowMessages(true);

            getDoc(doc(db, "users", landlordId)).then((landlordDoc) => {
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
                setLoading(false);
              }
            });
          }
        })
        .catch((error) => {
          console.error("Error initializing chat:", error);
          setLoading(false);
          setCreatingNewChat(false);
        });
    }
  }, [location, user?.uid, user?.role, navigate]);

  useEffect(() => {
    if (!user?.uid || !user?.role) return;

    if (!creatingNewChat && !selectedChatData) {
      setLoading(true);
    }

    const unsubscribe = subscribeToChats(user.uid, user.role, (chatsList) => {
      setChats(chatsList);

      if (selectedChat) {
        const matchingChat = chatsList.find(
          (chat) => chat.chatId === selectedChat
        );
        if (matchingChat) {
          setSelectedChatData(matchingChat);
          setCreatingNewChat(false);
        }
      } else if (!selectedChat && chatsList.length > 0 && !creatingNewChat) {
        setSelectedChat(chatsList[0].chatId);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, selectedChat, creatingNewChat, selectedChatData]);

  useEffect(() => {
    if (!selectedChat || !user?.uid) return;

    const unsubscribe = subscribeToMessages(selectedChat, (messagesList) => {
      setMessages(messagesList);
      // Ensure scroll to bottom after messages are set
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }

      // Check if there are potentially more messages to load
      // Use MESSAGE_PAGE_SIZE instead of hardcoded 10
      setHasMoreMessages(messagesList.length >= MESSAGE_PAGE_SIZE);

      const unreadMessages = messagesList.filter(
        (msg) => msg.senderId !== user.uid && !msg.read
      );

      if (unreadMessages.length > 0) {
        markMessagesAsRead(
          selectedChat,
          unreadMessages.map((msg) => msg.id)
        ).then(() => {
          // Update the unread count in the chats list
          setChats((prevChats) =>
            prevChats.map((chat) =>
              chat.chatId === selectedChat ? { ...chat, unreadCount: 0 } : chat
            )
          );
        });
      }
    });

    return () => unsubscribe();
  }, [selectedChat, user]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedChat]);

  // Handle scroll to determine when to show the scroll button
  const handleScroll = () => {
    if (messageContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messageContainerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 20; // 20px threshold
      setShowScrollButton(!isAtBottom);
    }
  };

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
  }, [selectedChat, messages]);

  useEffect(() => {
    if (selectedChat && window.innerWidth < 768) {
      setShowMessages(true);
    }
  }, [selectedChat]);

  useEffect(() => {
    if (!selectedChat || !user?.uid || !selectedChatData) return;

    const otherUserId = selectedChatData.userId;

    const unsubscribe = subscribeToTypingStatus(
      selectedChat,
      otherUserId,
      (isTyping) => {
        setOtherUserTyping(isTyping);
      }
    );

    setupTypingStatusCleanup(selectedChat, user.uid);

    return () => {
      unsubscribe();
      if (isTypingRef.current) {
        setTypingStatus(selectedChat, user.uid, false);
        isTypingRef.current = false;
      }
    };
  }, [selectedChat, user?.uid, selectedChatData]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (selectedChat && user?.uid && isTypingRef.current) {
        setTypingStatus(selectedChat, user.uid, false);
      }
    };
  }, [selectedChat, user?.uid]);

  // In Chats.tsx
  const typingHandlerRef = useRef<{
    handleTyping: () => void;
    cleanup: () => void;
  } | null>(null);

  useEffect(() => {
    if (!selectedChat || !user?.uid) return;

    const handler = createTypingHandler(selectedChat, user.uid);
    typingHandlerRef.current = handler;

    return () => {
      handler.cleanup();
      typingHandlerRef.current = null;
    };
  }, [selectedChat, user?.uid]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setNewMessage(newValue);

    if (typingHandlerRef.current && newValue.trim().length > 0) {
      typingHandlerRef.current.handleTyping();
    }
  };

  // Memoize chat selection function
  const handleChatSelection = useCallback((chatId: string) => {
    setSelectedChat(chatId);
    if (window.innerWidth < 768) {
      setShowMessages(true);
    }
  }, []);

  // Memoize filtered and sorted chats
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
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

      setIsTyping(true);

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
        }
      } catch (error) {
        console.error("Error sending message:", error);
      } finally {
        setIsTyping(false);
      }
    },
    [newMessage, selectedChat, user, selectedChatData]
  );

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return "";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "HH:mm");
  };

  // Memoize the messages rendering
  const messageElements = useMemo(() => {
    return messages.map((message) => (
      <div
        key={message.id}
        className={`flex ${
          message.senderId === user?.uid ? "justify-end" : "justify-start"
        }`}
      >
        <div className="flex flex-col space-y-1 max-w-[70%]">
          <div
            className={`p-3 md:px-6 px-4 ${message.senderId === user?.uid ? "bg-[#8752f3] text-primary-foreground rounded-t-full rounded-bl-full" : "bg-primary dark:bg-white dark:text-black text-white rounded-t-full rounded-br-full"}`}
          >
            <p className="text-sm">{message.content}</p>
          </div>
          <div
            className={`flex items-center space-x-2 text-xs text-muted-foreground ${
              message.senderId === user?.uid ? "justify-end" : "justify-start"
            }`}
          >
            <span>{formatMessageTime(message.timestamp)}</span>
            {message.senderId === user?.uid && (
              <span>
                {message.read ? (
                  <CheckCheck className="h-3 w-3" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </span>
            )}
          </div>
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
  const handleLoadOlderMessages = async () => {
    if (!selectedChat || !messages.length || loadingOlderMessages) return;

    setLoadingOlderMessages(true);
    try {
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
    }
  };

  return (
    <div className="container mx-auto p-4 md:-mt-4 -mt-6 md:-mb-4 mb-0 max-w-7xl md:h-[calc(100vh-6rem)] h-fit overflow-scroll">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-[85vh] md:h-full">
        {(!showMessages || window.innerWidth >= 768) && (
          <Card className="md:col-span-1 h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <Button
                  onClick={() => navigate(-1)}
                  className="text-sm py-2 px-4 rounded-lg"
                >
                  Back
                </Button>
                <span>Conversations</span>
                <Badge variant="secondary" className="ml-2 py-2 px-4">
                  {chats.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-2 h-[calc(100dvh-6rem)] md:h-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading conversations...</span>
                </div>
              ) : chats.length === 0 && !selectedChatData ? (
                <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                  <div>
                    <p>No conversations yet</p>
                    <p className="text-sm mt-2">Your chats will appear here</p>
                  </div>
                </div>
              ) : (
                <>
                  {creatingNewChat && selectedChatData && (
                    <div className="p-3 rounded-lg bg-secondary">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={selectedChatData.photoURL} />
                          <AvatarFallback>
                            {selectedChatData.displayName
                              ?.charAt(0)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {selectedChatData.displayName}
                          </p>
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
                      className={`flex items-center space-x-4 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedChat === chat.chatId
                          ? "bg-secondary"
                          : "hover:bg-secondary/50"
                      }`}
                      onClick={() => handleChatSelection(chat.chatId)}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12 border border-black/20 dark:border-white/20">
                          <AvatarImage src={chat.photoURL} />
                          <AvatarFallback>
                            {chat.displayName?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {chat.status === "online" && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium truncate">
                            {chat.displayName}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {chat.lastMessageTime &&
                              formatMessageTime(chat.lastMessageTime)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge
                            variant="outline"
                            className="text-xs border border-black/20 dark:border-white/20"
                          >
                            {chat.role === "landlord_verified"
                              ? "Landlord"
                              : "Tenant"}
                          </Badge>
                          {chat.unreadCount &&
                            chat.unreadCount > 0 &&
                            chat.chatId !== selectedChat && (
                              <Badge variant="default" className="text-xs">
                                {chat.unreadCount}
                              </Badge>
                            )}
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
          <Card className="md:col-span-2 h-[86vh] md:h-full flex flex-col">
            <CardHeader className="border-b p-4">
              {selectedChatData ? (
                <div className="flex items-center space-x-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={handleBackToList}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedChatData?.photoURL} />
                    <AvatarFallback>
                      {selectedChatData?.displayName?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="">
                      {selectedChatData?.displayName}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {otherUserTyping
                        ? "Typing..."
                        : selectedChatData?.status === "online"
                        ? "Online"
                        : selectedChatData?.lastSeen
                        ? `Last seen ${formatLastSeen(
                            selectedChatData.lastSeen
                          )}`
                        : "Offline"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-10">
                  <p className="text-muted-foreground">
                    {loading ? "" : "Select a conversation"}
                  </p>
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
                          <p>No messages yet</p>
                          <p className="text-sm mt-2">
                            Send a message to start the conversation
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {hasMoreMessages && (
                          <div className="flex  justify-center mb-4">
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
                      disabled={isTyping || !selectedChatData}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={isTyping || !newMessage.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="h-full md:h-[400px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p>
                      {loading
                        ? "Loading conversations..."
                        : "Select a conversation to start chatting"}
                    </p>
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
