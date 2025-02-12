import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent } from "./ui/card";
import { Bell, CheckCheck, Clock, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
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
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase/clientApp";
import { useAuth } from "../contexts/AuthContext";
import {
  normalizeNotificationDate,
  type BaseNotification,
} from "../lib/utils/NotificationUtils";
import SpinningLoader from "./SpinningLoader";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "./ui/alert";

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<BaseNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<
    string | null
  >(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.uid) {
      fetchUserNotifications();
    }
  }, [user?.uid]);

  useEffect(() => {
    if (operationError) {
      const timer = setTimeout(() => {
        setOperationError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [operationError]);

  const removeNonExistentNotification = async (notificationId: string) => {
    setNotifications((prev) => {
      const filtered = prev.filter((n) => n.id !== notificationId);
      if (filtered.length !== prev.length) {
        setOperationError(
          "This notification no longer exists and has been removed from your list."
        );
      }
      return filtered;
    });

    if (selectedNotification === notificationId) {
      setIsDeleteDialogOpen(false);
      setSelectedNotification(null);
    }
  };

  const verifyNotificationExists = async (
    notificationId: string
  ): Promise<boolean> => {
    try {
      // Determine which collection to check based on user role
      const collectionName = user?.role === "admin" ? "adminNotifications" : "notifications";
      const notificationRef = doc(db, collectionName, notificationId);
      const docSnap = await getDoc(notificationRef);
      
      if (!docSnap.exists()) {
        await removeNonExistentNotification(notificationId);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error verifying notification:", error);
      return false;
    }
  };

  const fetchUserNotifications = async () => {
    if (!user?.uid) return;

    setLoading(true);
    setError(null);

    try {
      let q;
      if (user.role === "admin") {
        q = query(
          collection(db, "adminNotifications"),
          where("read", "==", false),
          orderBy("createdAt", "desc")
        );
      } else {
        q = query(
          collection(db, "notifications"),
          or(
            where("userId", "==", user.uid),
            where("landlordId", "==", user.uid)
          ),
          orderBy("createdAt", "desc")
        );
      }

      const snapshot = await getDocs(q);
      const validNotifs: BaseNotification[] = [];

      // Process notifications in batches for efficiency
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        batches.push(snapshot.docs.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const existenceChecks = await Promise.all(
          batch.map((doc) => getDoc(doc.ref))
        );

        batch.forEach((doc, index) => {
          if (!existenceChecks[index].exists()) {
            console.warn(`Notification ${doc.id} no longer exists`);
            return;
          }

          const data = existenceChecks[index].data();
          const dateValue = data.createdAt || data.timestamp;

          if (user.role === "admin") {
            validNotifs.push({
              id: doc.id,
              title: data.title || "Notification",
              message: data.message || "No message provided",
              createdAt: dateValue?.toDate() || new Date(),
              read: data.read ?? false,
              type: data.type || "general",
              relatedUserId: data.userId || data.relatedUserId || null,
              relatedListingId: data.relatedListingId || null,
            });
          } else {
            validNotifs.push(
              normalizeNotificationDate({
                ...data,
                id: doc.id,
              })
            );
          }
        });
      }

      setNotifications(validNotifs);
    } catch (error: any) {
      console.error("Raw error:", error);
      if (
        error.code === "failed-precondition" ||
        error.message?.includes("index")
      ) {
        setError(
          "Database index is being created. Please wait a few minutes and try again."
        );
      } else {
        setError("Unable to load notifications at this time.");
      }
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewKYCSubmission = () => {
    navigate("/admin-dashboard");
  };

  const handleDelete = async () => {
    if (!selectedNotification) return;

    try {
      if (!(await verifyNotificationExists(selectedNotification))) {
        return;
      }

      // Use the correct collection based on user role
      const collectionName = user?.role === "admin" ? "adminNotifications" : "notifications";
      const notificationRef = doc(db, collectionName, selectedNotification);
      await deleteDoc(notificationRef);

      setNotifications((prev) =>
        prev.filter((n) => n.id !== selectedNotification)
      );
      setIsDeleteDialogOpen(false);
      setSelectedNotification(null);
    } catch (error) {
      console.error("Error deleting notification:", error);
      setOperationError("Failed to delete notification. Please try again.");
    }
  };

  const markAsRead = async (notificationId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    try {
      if (!(await verifyNotificationExists(notificationId))) {
        return;
      }

      // Use the correct collection based on user role
      const collectionName = user?.role === "admin" ? "adminNotifications" : "notifications";
      const notificationRef = doc(db, collectionName, notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: Timestamp.now(),
      });

      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true, readAt: Timestamp.now() }
            : notification
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
      setOperationError(
        "Failed to mark notification as read. Please try again."
      );
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
    return <SpinningLoader />;
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
              className="mt-4 px-4 py-2 bg-primary dark:text-black text-sm text-white rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4">
      <div className="flex items-center gap-2 mb-6">
        <div className="relative">
          <Bell className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-medium">Notifications</h1>
      </div>

      {operationError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{operationError}</AlertDescription>
        </Alert>
      )}

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
                  className="hover:bg-accent/50 transition-colors"
                >
                  <CardContent className="flex items-start gap-4 p-4">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">{notification.title}</h3>
                      <p className="text-sm dark:text-muted-foreground text-black w-2/3">
                        {notification.message}
                      </p>
                      <p className="text-xs mt-2 dark:text-white text-black">
                        {formatDate(notification.createdAt!)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {user?.role === "admin" &&
                        notification.type === "kyc_submission" && (
                          <button
                            onClick={handleViewKYCSubmission}
                            className="px-3 py-1 text-sm dark:bg-primary bg-black/80 hover:bg-black/50 dark:hover:bg-primary/90 dark:text-black text-white rounded-md transition-colors"
                          >
                            View KYC Submission
                          </button>
                        )}
                      <button
                        onClick={(e) => markAsRead(notification.id, e)}
                        className="px-3 py-1 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors"
                      >
                        Mark as read
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNotification(notification.id);
                          setIsDeleteDialogOpen(true);
                        }}
                        className="p-2 text-gray-500 hover:text-red-500 dark:hover:bg-white/10 hover:bg-black/10 rounded-md transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
                      <p className="text-sm dark:text-muted-foreground text-black">
                        {notification.message}
                      </p>
                      <p className="text-xs mt-2 dark:text-white text-black">
                        {formatDate(notification.createdAt!)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNotification(notification.id);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="p-2 text-gray-500 hover:text-red-500 dark:hover:bg-white/10 hover:bg-black/10 rounded-md transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notification</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this notification? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default NotificationsPage;
