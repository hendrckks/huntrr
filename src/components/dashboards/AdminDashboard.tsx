import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "../../lib/firebase/auth";
import { useToast } from "../../hooks/useToast";
import { useQuery } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  serverTimestamp,
  writeBatch,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase/clientApp";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import type { KYCDocument } from "../../lib/types/kyc";
import { refreshUserClaims } from "../../lib/firebase/tokenRefresh";
import {
  BellDot,
  User2Icon,
  FileText,
  Check,
  X,
  Eye,
  User,
} from "lucide-react";
import type { ListingDocument } from "../../lib/types/Listing";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  RejectionDialog,
  type RejectionReason,
  rejectionReasons,
} from "../dialogs/RejectionDialog";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    null
  );
  const [isRejectionDialogOpen, setIsRejectionDialogOpen] = useState(false);

  // Fetch KYC submissions (unchanged)
  const {
    data: kycSubmissions,
    isLoading: isLoadingKYC,
    error: kycError,
    refetch: refetchKYC,
  } = useQuery({
    queryKey: ["kyc-submissions"],
    queryFn: async () => {
      try {
        const q = query(
          collection(db, "kyc"),
          where("status", "==", "pending"),
          orderBy("submittedAt", "desc")
        );
        const snapshot = await getDocs(q);

        // Fetch user data for each KYC submission with proper typing
        const kycData = await Promise.all(
          snapshot.docs.map(async (docSnapshot) => {
            const data = docSnapshot.data();
            const userDocRef = doc(db, "users", data.userId);
            const userDoc = await getDoc(userDocRef);
            const userData = userDoc.data() || {
              displayName: "N/A",
              email: "N/A",
              phoneNumber: "N/A",
            };

            return {
              id: docSnapshot.id,
              ...data,
              submittedAt: data.submittedAt?.toDate(),
              createdAt: data.createdAt?.toDate(),
              updatedAt: data.updatedAt?.toDate(),
              reviewedAt: data.reviewedAt?.toDate(),
              userData: {
                displayName: userData.displayName || "N/A",
                email: userData.email || "N/A",
                phoneNumber: userData.phoneNumber || "N/A",
              },
            } as KYCDocument & {
              userData: {
                displayName: string;
                email: string;
                phoneNumber: string;
              };
            };
          })
        );

        return kycData;
      } catch (error: any) {
        if (
          error.code === "failed-precondition" ||
          error.message?.includes("index")
        ) {
          throw new Error(
            "Database index is being created. Please wait a few minutes and try again."
          );
        }
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  // Updated notifications query to use existing index
  const {
    data: notifications,
    isLoading: isLoadingNotifications,
    error: notificationsError,
  } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      try {
        // Use the existing index (read Ascending, createdAt Descending)
        const q = query(
          collection(db, "adminNotifications"),
          where("read", "==", false),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map((doc) => {
          const data = doc.data();
          // Normalize the date field, checking both timestamp and createdAt
          const dateValue = data.createdAt || data.timestamp;

          return {
            id: doc.id,
            title: data.title || "Notification",
            message: data.message || "No message provided",
            createdAt: dateValue?.toDate() || new Date(),
            read: data.read ?? false,
            type: data.type || "general",
            priority: data.priority || "normal",
            relatedUserId: data.userId || data.relatedUserId || null,
            relatedListingId: data.relatedListingId || null,
            metadata: data.metadata || {},
          };
        });
      } catch (error: any) {
        console.error("Raw error:", error);
        if (
          error.code === "failed-precondition" ||
          error.message?.includes("index")
        ) {
          throw new Error(
            "Database index is being created. Please wait a few minutes and try again."
          );
        }
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  const handleProcessKYC = async (userId: string, approved: boolean) => {
    const functions = getFunctions();
    const revokeTokens = httpsCallable(functions, "revokeUserTokens");

    const maxRetries = 3;
    let currentRetry = 0;

    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    const verifyAdminPrivileges = async () => {
      if (!auth.currentUser) {
        throw new Error("No authenticated user found");
      }
      await refreshUserClaims(auth.currentUser);
      const idTokenResult = await auth.currentUser.getIdTokenResult(true);
      if (idTokenResult.claims.role !== "admin") {
        throw new Error("Insufficient admin privileges");
      }
      return auth.currentUser;
    };

    const performBatchOperations = async (currentUser: any) => {
      const batch = writeBatch(db);

      // Update KYC document status
      const kycRef = doc(db, "kyc", userId);
      batch.update(kycRef, {
        status: approved ? "approved" : "rejected",
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.uid,
      });

      // If approved, update user's role in Firestore
      if (approved) {
        const userRef = doc(db, "users", userId);
        batch.update(userRef, {
          role: "landlord_verified",
          verifiedAt: serverTimestamp(),
        });
        await revokeTokens({ userId }); // Fixed: Use userId directly instead of kyc.userId
      }

      await batch.commit();
    };

    const sendUserNotification = async () => {
      const notificationRef = doc(collection(db, "notifications"));
      await setDoc(notificationRef, {
        userId,
        type: "kyc_verification",
        message: approved
          ? "Your KYC verification has been approved. You can now list properties. Please sign out and sign in again to refresh your permissions."
          : "Your KYC verification was not approved. Please contact support for more information.",
        read: false,
        createdAt: serverTimestamp(),
      });
    };

    try {
      setProcessingId(userId);

      while (currentRetry < maxRetries) {
        try {
          // Step 1: Verify admin privileges
          const currentUser = await verifyAdminPrivileges();

          // Step 2: Perform batch operations
          await performBatchOperations(currentUser);

          // Step 3: Send notification
          await sendUserNotification();

          // Step 4: Refresh UI
          await refetchKYC();

          // Success! Break the retry loop
          toast({
            title: "Success",
            description: `KYC ${
              approved ? "approved" : "rejected"
            } successfully`,
            variant: "success",
          });
          return;
        } catch (error: any) {
          currentRetry++;

          // If we've exhausted all retries, throw the error
          if (currentRetry === maxRetries) {
            throw error;
          }

          // Calculate delay with exponential backoff (1s, 2s, 4s)
          const delay = Math.pow(2, currentRetry - 1) * 1000;
          console.log(
            `Attempt ${currentRetry} failed, retrying in ${delay}ms...`
          );
          await sleep(delay);
        }
      }
    } catch (error: any) {
      console.error("Error processing KYC:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process KYC submission",
        variant: "error",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
      toast({
        title: "",
        variant: "success",
        description: "Admin Sign Out successful",
      });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Add new query for pending listings
  const {
    data: pendingListings,
    isLoading: isLoadingListings,
    error: listingsError,
    refetch: refetchListings,
  } = useQuery({
    queryKey: ["pending-listings"],
    queryFn: async () => {
      try {
        const q = query(
          collection(db, "listings"),
          where("status", "==", "pending_review"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ListingDocument[];
      } catch (error: any) {
        if (
          error.code === "failed-precondition" ||
          error.message?.includes("index")
        ) {
          throw new Error(
            "Database index is being created. Please wait a few minutes and try again."
          );
        }
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  const handleListingAction = async (listingId: string, approved: boolean) => {
    if (!approved) {
      setSelectedListingId(listingId);
      setIsRejectionDialogOpen(true);
      return;
    }

    try {
      // Verify admin privileges
      if (!auth.currentUser) {
        throw new Error("No authenticated user found");
      }
      await refreshUserClaims(auth.currentUser);
      const idTokenResult = await auth.currentUser.getIdTokenResult(true);
      if (idTokenResult.claims.role !== "admin") {
        throw new Error("Insufficient admin privileges");
      }

      // Update listing status
      const batch = writeBatch(db);
      const listingRef = doc(db, "listings", listingId);

      batch.update(listingRef, {
        status: "published",
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser.uid,
      });

      // Create notification for the landlord
      const listingDoc = await getDoc(listingRef);
      const listingData = listingDoc.data();

      if (listingData) {
        const notificationRef = doc(collection(db, "notifications"));
        await setDoc(notificationRef, {
          userId: listingData.landlordId,
          type: "listing_review",
          message: "Your listing has been approved and is now live.",
          read: false,
          createdAt: serverTimestamp(),
          listingId: listingId,
        });
      }

      await batch.commit();
      await refetchListings();

      toast({
        title: "Success",
        description: "Listing approved successfully",
        variant: "success",
      });
    } catch (error: any) {
      console.error("Error processing listing:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process listing",
        variant: "error",
      });
    }
  };

  const handleReject = async (reason: RejectionReason) => {
    if (!selectedListingId || !auth.currentUser) return;

    try {
      const batch = writeBatch(db);
      const listingRef = doc(db, "listings", selectedListingId);

      batch.update(listingRef, {
        status: "denied",
        rejectionReason: reason,
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser.uid,
      });

      const listingDoc = await getDoc(listingRef);
      const listingData = listingDoc.data();

      if (listingData) {
        const notificationRef = doc(collection(db, "notifications"));
        await setDoc(notificationRef, {
          userId: listingData.landlordId,
          type: "listing_review",
          message: `Your listing was not approved. Reason: ${
            rejectionReasons.find((r) => r.value === reason)?.label
          }`,
          read: false,
          createdAt: serverTimestamp(),
          listingId: selectedListingId,
        });
      }

      await batch.commit();
      await refetchListings();

      toast({
        title: "Success",
        description: "Listing rejected successfully",
        variant: "success",
      });
    } catch (error: any) {
      console.error("Error rejecting listing:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reject listing",
        variant: "error",
      });
    }
  };

  return (
    <div className="container mx-auto px-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <User className="h-6 w-6" />
          <h1 className="text-xl font-medium">Admin Dashboard</h1>
        </div>{" "}
        <Button variant="outline" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>

      <Tabs defaultValue="kyc" className="space-y-4 text-black dark:text-white" >
        <TabsList>
          <TabsTrigger
            value="kyc"
            className="flex items-center gap-2"
          >
            <span>
              <User2Icon className="h-4 w-4" />
            </span>
            KYC Verifications
            {kycSubmissions?.length ? (
              <Badge variant="default" className="ml-2">
                {kycSubmissions.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger
            value="listings"
            className="flex items-center gap-2"
          >
            <span>
              <FileText className="h-4 w-4" />
            </span>
            Pending Listings
            {pendingListings?.length ? (
              <Badge variant="default" className="ml-2">
                {pendingListings.length}
              </Badge>
            ) : null}
          </TabsTrigger>

          {/* <TabsTrigger
            value="listings"
            className="text-white flex items-center gap-2"
          >
            <span>
              <FileText className="h-4 w-4" />
            </span>
            Pending Listings
            {pendingListings?.length ? (
              <Badge variant="destructive" className="ml-2">
                {pendingListings.length}
              </Badge>
            ) : null}
          </TabsTrigger> */}
          <TabsTrigger
            value="notifications"
            className="flex items-center gap-2"
          >
            <span>
              <BellDot className="h-4 w-4" />
            </span>
            Notifications
            {notifications?.length ? (
              <Badge variant="destructive" className="ml-2">
                {notifications.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          {/* <TabsTrigger value="listings">
            Pending Listings
            {pendingListings && pendingListings.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingListings.length}
              </Badge>
            )}
          </TabsTrigger> */}
        </TabsList>

        <TabsContent value="listings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Listings</CardTitle>
              <CardDescription>
                Review and approve or reject new listings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {isLoadingListings ? (
                  <div className="flex items-center justify-center p-4">
                    <p className="text-gray-600">Loading listings...</p>
                  </div>
                ) : listingsError ? (
                  <div className="flex items-center justify-center p-4">
                    <p className="text-red-500">
                      Error loading listings. Please try again.
                    </p>
                  </div>
                ) : pendingListings?.length === 0 ? (
                  <p className="text-center text-gray-500">
                    No listings pending review
                  </p>
                ) : (
                  <div className="space-y-4">
                    {pendingListings?.map((listing) => (
                      <Card key={listing.id}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">
                                  {listing.title}
                                </h3>
                                <Badge>PENDING REVIEW</Badge>
                              </div>
                              <p className="text-sm text-gray-500">
                                {listing.location.area}, {listing.location.city}
                              </p>
                              <p className="text-sm">
                                ${listing.price}/month • {listing.bedrooms} beds
                                • {listing.bathrooms} baths
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  navigate(`/listings/${listing.id}`)
                                } // Changed from "/listing" to "/listings"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="default"
                                size="icon"
                                onClick={() =>
                                  handleListingAction(listing.id, true)
                                }
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() =>
                                  handleListingAction(listing.id, false)
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kyc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending KYC Verifications</CardTitle>
              <CardDescription>
                Review and process landlord verification requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {isLoadingKYC ? (
                  <div className="flex items-center justify-center p-4">
                    <p className="text-gray-600">Loading KYC submissions...</p>
                  </div>
                ) : kycError ? (
                  <div className="p-4 rounded-md bg-amber-50 border border-amber-200">
                    <p className="text-amber-800">
                      {kycError.message?.includes("index")
                        ? "The system is being initialized. Please wait a few minutes and refresh the page."
                        : `Error loading KYC submissions: ${
                            (kycError as Error).message
                          }`}
                    </p>
                  </div>
                ) : kycSubmissions?.length ? (
                  <div className="space-y-4">
                    {kycSubmissions.map((kyc) => (
                      <Card key={kyc.id}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start text-sm">
                            <div className="flex justify-between w-1/2 ">
                              <div className="space-y-1">
                                <p>
                                  <strong>Name:</strong>
                                  <span className="ml-2">
                                    {kyc.userData.displayName}
                                  </span>
                                </p>
                                <p>
                                  <strong>Email:</strong>
                                  <span className="ml-2">
                                    {kyc.userData.email}
                                  </span>
                                </p>
                                <p>
                                  <strong>Phone:</strong>
                                  <span className="ml-2">
                                    {kyc.userData.phoneNumber}
                                  </span>
                                </p>
                                <p>
                                  <strong>Document Type:</strong>
                                  <span className="ml-2">
                                    {kyc.documentType}
                                  </span>
                                </p>
                                <p>
                                  <strong>Document Number:</strong>
                                  <span className="ml-2">
                                    {kyc.documentNumber}
                                  </span>
                                </p>
                                <p>
                                  <strong>Submitted:</strong>
                                  <span className="ml-2">
                                    {kyc.submittedAt.toLocaleString()}
                                  </span>
                                </p>
                              </div>

                              <div>
                                <div className="space-y-1 text-sm">
                                  <a
                                    href={kyc.frontDocumentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-blue-500 hover:underline"
                                  >
                                    View Front Document
                                  </a>
                                  <a
                                    href={kyc.backDocumentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-blue-500 hover:underline"
                                  >
                                    View Back Document
                                  </a>
                                  <a
                                    href={kyc.selfieUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-blue-500 hover:underline"
                                  >
                                    View Selfie
                                  </a>
                                </div>
                              </div>
                            </div>
                            <div className="space-x-2">
                              <Button
                                variant="default"
                                onClick={() =>
                                  handleProcessKYC(kyc.userId, true)
                                }
                                disabled={!!processingId}
                              >
                                {processingId === kyc.userId
                                  ? "Processing..."
                                  : "Approve"}
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() =>
                                  handleProcessKYC(kyc.userId, false)
                                }
                                disabled={!!processingId}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-4">
                    <p className="text-gray-600">
                      No pending KYC verifications
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>System notifications and alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {isLoadingNotifications ? (
                  <p>Loading notifications...</p>
                ) : notificationsError ? (
                  <p className="text-red-500">
                    Error loading notifications:{" "}
                    {(notificationsError as Error).message}
                  </p>
                ) : notifications?.length ? (
                  <div className="space-y-4">
                    {notifications?.map((notification) => (
                      <Card key={notification.id}>
                        <CardContent className="pt-6">
                          <h3 className="font-semibold">
                            {notification.title}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {notification.message}
                          </p>
                          {notification.type === "kyc_submission" && (
                            <Button
                              variant="link"
                              className="p-0 h-auto font-normal text-blue-500"
                              onClick={() => {
                                (
                                  document.querySelector(
                                    '[value="kyc"]'
                                  ) as HTMLElement
                                )?.click();
                              }}
                            >
                              View KYC Submission
                            </Button>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            {notification.createdAt.toLocaleString()}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p>No new notifications</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <RejectionDialog
          open={isRejectionDialogOpen}
          onOpenChange={setIsRejectionDialogOpen}
          onConfirm={handleReject}
        />
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
