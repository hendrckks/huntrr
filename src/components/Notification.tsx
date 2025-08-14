import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent } from "./ui/card";
import { CheckCheck, Trash2 } from "lucide-react";
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
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";

// Simple in-memory cache keyed by user and role
type NotificationCacheEntry = {
  data: BaseNotification[];
  timestamp: number;
};
const NOTIFICATIONS_CACHE_TTL_MS = 60_000; // 1 minute
const notificationsCache: Record<string, NotificationCacheEntry> = {};
const getCacheKey = (userId?: string, role?: string) => `${userId || "anon"}:${role || "guest"}`;

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(
    () => searchParams.get("tab") || localStorage.getItem("notificationsTab") || "unread"
  );

  useEffect(() => {
    try {
      localStorage.setItem("notificationsTab", activeTab);
    } catch (e) {
      void e;
    }
    const params = Object.fromEntries(searchParams.entries());
    params.tab = activeTab;
    setSearchParams(params, { replace: true });
  }, [activeTab]);

  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user?.uid) return;
    const cacheKey = getCacheKey(user.uid, user.role);
    const cached = notificationsCache[cacheKey];
    if (cached) {
      setNotifications(cached.data);
      setLoading(false);
    }
    const isStale = !cached || Date.now() - cached.timestamp > NOTIFICATIONS_CACHE_TTL_MS;
    if (isStale) {
      fetchUserNotifications({ silent: !!cached });
    }
  }, [user?.uid]);

  useEffect(() => {
    const handleFocus = () => {
      if (!user?.uid) return;
      const cacheKey = getCacheKey(user.uid, user.role);
      const cached = notificationsCache[cacheKey];
      const isStale = !cached || Date.now() - cached.timestamp > NOTIFICATIONS_CACHE_TTL_MS;
      if (isStale) {
        fetchUserNotifications({ silent: true });
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user?.uid, user?.role]);

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
      const collectionName =
        user?.role === "admin" ? "adminNotifications" : "notifications";
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

  const fetchUserNotifications = async (options?: { silent?: boolean }) => {
    if (!user?.uid) return;
    const { silent } = options || {};

    if (!silent) {
      setLoading(true);
    }
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
      const cacheKey = getCacheKey(user.uid, user.role);
      notificationsCache[cacheKey] = {
        data: validNotifs,
        timestamp: Date.now(),
      };
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
      const cacheKey = user ? getCacheKey(user.uid, user.role) : getCacheKey();
      const cached = notificationsCache[cacheKey];
      if (!cached) {
        setNotifications([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
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
      const collectionName =
        user?.role === "admin" ? "adminNotifications" : "notifications";
      const notificationRef = doc(db, collectionName, selectedNotification);
      await deleteDoc(notificationRef);

      setNotifications((prev) => {
        const next = prev.filter((n) => n.id !== selectedNotification);
        const cacheKey = getCacheKey(user?.uid, user?.role);
        notificationsCache[cacheKey] = { data: next, timestamp: Date.now() };
        return next;
      });
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
      const collectionName =
        user?.role === "admin" ? "adminNotifications" : "notifications";
      const notificationRef = doc(db, collectionName, notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: Timestamp.now(),
      });

      setNotifications((prev) => {
        const next = prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true, readAt: Timestamp.now() }
            : notification
        );
        const cacheKey = getCacheKey(user?.uid, user?.role);
        notificationsCache[cacheKey] = { data: next, timestamp: Date.now() };
        return next;
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      setOperationError(
        "Failed to mark notification as read. Please try again."
      );
    }
  };

  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const markAllAsRead = async () => {
    if (unreadNotifications.length === 0 || isMarkingAll) return;

    setIsMarkingAll(true);
    try {
      // Use the correct collection based on user role
      const collectionName =
        user?.role === "admin" ? "adminNotifications" : "notifications";

      // Update all unread notifications in Firestore
      const updatePromises = unreadNotifications.map(async (notification) => {
        if (await verifyNotificationExists(notification.id)) {
          const notificationRef = doc(db, collectionName, notification.id);
          return updateDoc(notificationRef, {
            read: true,
            readAt: Timestamp.now(),
          });
        }
        return Promise.resolve();
      });

      await Promise.all(updatePromises);

      // Update local state and cache
      setNotifications((prev) => {
        const next = prev.map((notification) => ({
          ...notification,
          read: true,
          readAt: Timestamp.now(),
        }));
        const cacheKey = getCacheKey(user?.uid, user?.role);
        notificationsCache[cacheKey] = { data: next, timestamp: Date.now() };
        return next;
      });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      setOperationError(
        "Failed to mark all notifications as read. Please try again."
      );
    } finally {
      setIsMarkingAll(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "kyc_approved":
        return <CheckCheck className="h-5 w-5 text-green-500" />;
      case "kyc_rejected":
        return <img src="/icons/bell.svg" alt="" className="h-6 w-6" />;
      case "new_tenant_application":
        return <img src="/icons/bell.svg" alt="" className="h-6 w-6" />;
      case "application_status_update":
        return <img src="/icons/bell.svg" alt="" className="h-6 w-6" />;
      default:
        return <img src="/icons/bell.svg" alt="" className="h-6 w-6" />;
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
            <img src="/icons/bell.svg" alt="" className="h-12 w-12 mb-4" />
            <p>{error}</p>
            <button
              onClick={() => fetchUserNotifications()}
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
    <div className="max-w-7xl mx-auto sm:px-6 lg:px-3 p-4 md:p-0 font-noto">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative">
          <img src="/icons/bell.svg" alt="" className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <h1 className="text-xl font-medium">Notifications</h1>
      </div>

      {operationError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{operationError}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 bg-black/5 border dark:border-white/5 border-black/5 dark:bg-white/5 w-max md:min-w-fit">
          <TabsTrigger
            value="unread"
            className="flex items-center gap-2 text-sm px-4 py-1 data-[state=active]:bg-black/80 data-[state=active]:text-white dark:data-[state=active]:bg-[#fafafa] dark:data-[state=active]:text-black [&[data-state=active]_svg]:text-white dark:[&[data-state=active]_svg]:text-black"
          >
            <img src="/icons/eye-slash.svg" alt="" className="h-3 w-3 sm:h-4 sm:w-4" />
            Unread ({unreadNotifications.length})
          </TabsTrigger>
          <TabsTrigger value="read" className="flex items-center gap-2 text-sm px-4 py-1 data-[state=active]:bg-black/80 data-[state=active]:text-white dark:data-[state=active]:bg-[#fafafa] dark:data-[state=active]:text-black [&[data-state=active]_svg]:text-white dark:[&[data-state=active]_svg]:text-black">
            <img src="/icons/eye.svg" alt="" className="h-3 w-3 sm:h-4 sm:w-4" />
            Read ({readNotifications.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unread">
          {unreadNotifications.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-6 sm:py-8 text-center text-muted-foreground">
                  <img src="/icons/bell.svg" alt="" className="h-8 w-8 sm:h-12 sm:w-12" />
                  <p className="text-sm">No unread notifications</p>
                </CardContent>
              </Card>
          ) : (
            <>
              <div className="flex justify-end cursor-pointer mb-4">
                <Button
                  onClick={markAllAsRead}
                  disabled={isMarkingAll}
                  className="flex items-center gap-2 text-sm bg-black/80 hover:bg-black/75 dark:bg-white/90 dark:hover:bg-white/80 text-white dark:text-black rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* <img src="/icons/eye.svg" alt="" className="h-5 w-5" /> */}
                  {isMarkingAll ? "Marking..." : "Mark All as Read"}
                </Button>
              </div>
              <div className="space-y-3 sm:space-y-4">
                {unreadNotifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className="hover:bg-accent/50 transition-colors"
                  >
                    <CardContent className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 p-3 sm:p-4">
                      <div className="hidden sm:block">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="font-medium text-base">
                          {notification.title}
                        </h3>
                        <p className="text-sm dark:text-muted-foreground text-black">
                          {notification.message}
                        </p>
                        <p className="text-[12px] dark:text-white text-black">
                          {formatDate(notification.createdAt!)}
                        </p>
                      </div>
                      <div className="flex flex-row sm:flex-nowrap gap-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                        {user?.role === "admin" &&
                          notification.type === "kyc_submission" && (
                            <button
                              onClick={handleViewKYCSubmission}
                              className="flex-1 sm:flex-initial px-2 sm:px-3 py-1 text-xs sm:text-sm dark:bg-primary bg-black/80 hover:bg-black/50 dark:hover:bg-primary/90 dark:text-black text-white rounded-md transition-colors"
                            >
                              View KYC
                            </button>
                          )}
                        <button
                          onClick={(e) => markAsRead(notification.id, e)}
                          className="flex-1 sm:flex-initial flex border border-black/5 dark:border-white/5 shadow-md backdrop-blur-3xl items-center gap-2 justify-center px-2 sm:px-3 py-2 text-sm bg-black/5 dark:bg-white/5 hover:bg-primary/20 text-primary rounded-md transition-colors"
                        >
                          <span>Mark as read</span>
                        </button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNotification(notification.id);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="hover:bg-red-600 shadow-md"
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="read">
          {readNotifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-6 sm:py-8 text-center text-muted-foreground">
                <CheckCheck className="h-8 w-8 sm:h-12 sm:w-12 mb-2 sm:mb-4" />
                <p className="text-sm sm:text-base">No read notifications</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {readNotifications.map((notification) => (
                <Card key={notification.id} className="">
                  <CardContent className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 p-3 sm:p-4">
                    <div className="hidden sm:block">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="font-medium text-base">
                        {notification.title}
                      </h3>
                      <p className="text-sm dark:text-muted-foreground text-black">
                        {notification.message}
                      </p>
                      <p className="text-[12px]  dark:text-white text-black">
                        {formatDate(notification.createdAt!)}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNotification(notification.id);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="bg-red-600 hover:bg-red-500"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
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
        <AlertDialogContent className="sm:max-w-md font-noto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">
              Delete Notification
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to delete this notification? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="text-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-sm"
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
