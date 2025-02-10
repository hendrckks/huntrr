import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent } from "./ui/card";
import { Bell, CheckCheck, Clock } from "lucide-react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
  or,
} from "firebase/firestore";
import { db } from "../lib/firebase/clientApp";
import { useAuth } from "../contexts/AuthContext";
import {
  normalizeNotificationDate,
  type BaseNotification,
} from "../lib/utils/NotificationUtils";

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<BaseNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.uid) {
      fetchUserNotifications();
    }
  }, [user?.uid]);

  const fetchUserNotifications = async () => {
    if (!user?.uid) return;
  
    setLoading(true);
    setError(null);
  
    try {
      const q = query(
        collection(db, "notifications"),
        or(
          where("userId", "==", user.uid),
          where("landlordId", "==", user.uid)
        ),
        orderBy("createdAt", "desc")
      );
  
      const snapshot = await getDocs(q);
      const notifs = snapshot.docs.map((doc) =>
        normalizeNotificationDate({
          ...doc.data(),
          id: doc.id,
        })
      );
  
      setNotifications(notifs);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setError("Unable to load notifications at this time.");
      setNotifications([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, "notifications", notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: Timestamp.now(),
      });

      // Update local state
      setNotifications((prevNotifications) =>
        prevNotifications.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true, readAt: Timestamp.now() }
            : notification
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
      setError("Failed to mark notification as read. Please try again.");
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "kyc_approved":
        return <CheckCheck className="h-5 w-5 text-green-500" />;
      case "kyc_rejected":
        return <Bell className="h-5 w-5 text-red-500" />;
      case "new_tenant_application":
        return <Bell className="h-5 w-5 text-blue-500" />;
      case "application_status_update":
        return <Bell className="h-5 w-5 text-yellow-500" />;
      default:
        return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto p-4 pt-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center text-red-500">
            <Bell className="h-12 w-12 mb-4" />
            <p>{error}</p>
            <button
              onClick={fetchUserNotifications}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-4 pt-8">
      <div className="flex items-center gap-2 mb-6">
        <Bell className="h-6 w-6" />
        <h1 className="text-xl font-medium">Notifications</h1>
      </div>

      <Tabs defaultValue="unread" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="unread" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Unread ({unreadNotifications.length})
          </TabsTrigger>
          <TabsTrigger value="read" className="flex items-center gap-2">
            <CheckCheck className="h-4 w-4" />
            Read ({readNotifications.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unread">
          {unreadNotifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Bell className="h-12 w-12" />
                <p>No unread notifications</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {unreadNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className="hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => markAsRead(notification.id)}
                >
                  <CardContent className="flex items-start gap-4 p-4">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">{notification.title}</h3>
                      <p className="text-sm text-muted-foreground w-2/3">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 text-white">
                        {formatDate(notification.createdAt!)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="read">
          {readNotifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <CheckCheck className="h-12 w-12 mb-4" />
                <p>No read notifications</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {readNotifications.map((notification) => (
                <Card key={notification.id} className="opacity-75">
                  <CardContent className="flex items-start gap-4 p-4">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">{notification.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(notification.createdAt!)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationsPage;
