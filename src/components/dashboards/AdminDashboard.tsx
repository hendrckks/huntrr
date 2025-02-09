import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "../../lib/firebase/auth";
import { useToast } from "../../hooks/useToast";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase/clientApp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase/clientApp";
import type { KYCDocument } from "../../lib/types/kyc";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch KYC submissions
  const { data: kycSubmissions, isLoading: isLoadingKYC } = useQuery({
    queryKey: ["kyc-submissions"],
    queryFn: async () => {
      const q = query(
        collection(db, "kyc"),
        where("status", "==", "pending"),
        orderBy("submittedAt", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data() })) as KYCDocument[];
    },
  });

  // Fetch admin notifications
  const { data: notifications, isLoading: isLoadingNotifications } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const q = query(
        collection(db, "adminNotifications"),
        where("read", "==", false),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data() }));
    },
  });

  const handleProcessKYC = async (userId: string, approved: boolean) => {
    try {
      setProcessingId(userId);
      const processKYC = httpsCallable(functions, 'processKYC');
      await processKYC({ userId, approved });

      toast({
        title: "Success",
        description: `KYC ${approved ? 'approved' : 'rejected'} successfully`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error processing KYC:", error);
      toast({
        title: "Error",
        description: "Failed to process KYC submission",
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
      </div>

      <Tabs defaultValue="kyc" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kyc">
            KYC Verifications
            {kycSubmissions?.length ? (
              <Badge variant="destructive" className="ml-2">
                {kycSubmissions.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="notifications">
            Notifications
            {notifications?.length ? (
              <Badge variant="destructive" className="ml-2">
                {notifications.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kyc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending KYC Verifications</CardTitle>
              <CardDescription>
                Review and process landlord verification requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {isLoadingKYC ? (
                  <p>Loading KYC submissions...</p>
                ) : kycSubmissions?.length ? (
                  <div className="space-y-4">
                    {kycSubmissions.map((kyc) => (
                      <Card key={kyc.id}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <p><strong>Document Type:</strong> {kyc.documentType}</p>
                              <p><strong>Document Number:</strong> {kyc.documentNumber}</p>
                              <p><strong>Submitted:</strong> {kyc.submittedAt.toDate().toLocaleString()}</p>
                              <div className="space-y-2">
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
                            <div className="space-x-2">
                              <Button
                                variant="default"
                                onClick={() => handleProcessKYC(kyc.userId, true)}
                                disabled={!!processingId}
                              >
                                {processingId === kyc.userId ? "Processing..." : "Approve"}
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleProcessKYC(kyc.userId, false)}
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
                  <p>No pending KYC verifications</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                System notifications and alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {isLoadingNotifications ? (
                  <p>Loading notifications...</p>
                ) : notifications?.length ? (
                  <div className="space-y-4">
                    {notifications.map((notification) => (
                      <Card key={notification.id}>
                        <CardContent className="pt-6">
                          <h3 className="font-semibold">{notification.title}</h3>
                          <p className="text-sm text-gray-500">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {notification.createdAt.toDate().toLocaleString()}
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
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
