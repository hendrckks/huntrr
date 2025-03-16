import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "firebase/auth";
import { auth, db } from "../../lib/firebase/clientApp";
import {
  updateProfile,
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { uploadImage } from "../../lib/actions/uploadImage";
import { toast } from "../../hooks/useToast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Settings, Upload } from "lucide-react";
import { updateProfileInAllChats } from "../../lib/firebase/chat";

// Default placeholder image path
const DEFAULT_PROFILE_IMAGE = "/default image.webp";

interface FormData {
  displayName: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EditAccount: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [profileImage, setProfileImage] = useState<string>(
    DEFAULT_PROFILE_IMAGE
  );
  const [imageTimestamp, setImageTimestamp] = useState<number>(Date.now());
  const [formData, setFormData] = useState<FormData>({
    displayName: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // Determine profile image priority and add timestamp to bypass cache
        const userPhotoURL = currentUser.photoURL;
        const timestampedPhotoURL = userPhotoURL
          ? `${userPhotoURL}${
              userPhotoURL.includes("?") ? "&" : "?"
            }t=${Date.now()}`
          : DEFAULT_PROFILE_IMAGE;

        setProfileImage(timestampedPhotoURL);
        setImageTimestamp(Date.now());

        setFormData((prevState) => ({
          ...prevState,
          displayName: currentUser.displayName || "",
          email: currentUser.email || "",
        }));
      } else {
        navigate("/login");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const refreshProfileImage = () => {
    setImageTimestamp(Date.now());
    if (user?.photoURL) {
      const baseUrl = user.photoURL.split("?")[0]; // Remove any existing query params
      setProfileImage(`${baseUrl}?t=${Date.now()}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;

    try {
      setIsLoading(true);
      setImageLoading(true);
      if (!user) return;

      const file = e.target.files[0];
      const imageUrl = await uploadImage(file, user.uid);

      // Add timestamp to URL to prevent caching
      const timestampedUrl = `${imageUrl}?t=${Date.now()}`;

      if (user) {
        // Maximum retry attempts for Firebase operations
        const maxRetries = 3;
        let retryCount = 0;

        while (retryCount < maxRetries) {
          try {
            // Update Firebase Auth profile first
            await updateProfile(user, { photoURL: timestampedUrl });

            // Then update Firestore document with retry mechanism
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
              photoURL: timestampedUrl,
              updatedAt: new Date(),
            });

            // Update participant data in all chats where this user participates
            await updateProfileInAllChats(user.uid, {
              photoURL: timestampedUrl,
            });

            // Force token refresh to ensure the new photoURL is immediately available
            await user.getIdToken(true);
            await user.reload();

            // Get the updated user object after reload
            const freshUser = auth.currentUser;
            setUser(freshUser);

            // Update profile image with cache-busting timestamp
            setProfileImage(timestampedUrl);
            setImageTimestamp(Date.now());

            // Broadcast profile image change event for other components
            window.dispatchEvent(
              new CustomEvent("profileImageUpdated", {
                detail: { photoURL: timestampedUrl },
              })
            );

            toast({
              title: "",
              variant: "success",
              description: "Profile picture updated successfully",
              duration: 5000,
            });

            // If we reach here, all operations succeeded
            break;
          } catch (retryError: any) {
            retryCount++;
            
            // Check if it's a network error or client-side blocking
            if (retryError.code === 'failed-precondition' || 
                retryError.message?.includes('ERR_BLOCKED_BY_CLIENT') ||
                retryError.name === 'FirebaseError') {
              
              if (retryCount === maxRetries) {
                throw new Error('Network request blocked. Please disable any ad blockers or try again later.');
              }
              
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
              continue;
            }
            
            // If it's not a network error, throw immediately
            throw retryError;
          }
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        variant: "error",
        description: error.message || "Failed to update profile picture",
        duration: 5000,
      });
      console.error('Profile update error:', error);
    } finally {
      setIsLoading(false);
      setImageLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (
      formData.newPassword &&
      formData.newPassword !== formData.confirmPassword
    ) {
      toast({
        title: "",
        variant: "warning",
        description: "New passwords do not match",
        duration: 5000,
      });
      return;
    }

    try {
      setIsLoading(true);

      if (formData.currentPassword) {
        const credential = EmailAuthProvider.credential(
          user.email!,
          formData.currentPassword
        );
        await reauthenticateWithCredential(user, credential);

        if (formData.email !== user.email) {
          await updateEmail(user, formData.email);
        }

        if (formData.newPassword) {
          await updatePassword(user, formData.newPassword);
        }
      }

      await updateProfile(user, { displayName: formData.displayName });
      await updateDoc(doc(db, "users", user.uid), {
        displayName: formData.displayName,
        email: formData.email,
      });

      // Update display name in all chats
      await updateProfileInAllChats(user.uid, {
        displayName: formData.displayName,
      });

      // Force token refresh
      await user.getIdToken(true);

      toast({
        title: "",
        variant: "success",
        description: "Profile updated successfully",
        duration: 5000,
      });
      navigate("/account");
    } catch (error) {
      toast({
        title: "",
        variant: "error",
        description: (error as Error).message || "Failed to update profile",
        duration: 5000,
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const isGoogleUser = user?.providerData[0]?.providerId === "google.com";

  return (
    <div className="container mx-auto px-4 mb-10 md:mt-0 mt-5">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-xl font-medium">Account Settings</h1>
        </div>{" "}
        <Button variant="outline" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Update your profile details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div
                  className={`w-16 h-16 rounded-full overflow-hidden ${
                    imageLoading ? "opacity-60" : ""
                  }`}
                >
                  <img
                    src={`${profileImage}&_=${imageTimestamp}`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onLoad={() => setImageLoading(false)}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (
                        !img.dataset.retryCount ||
                        parseInt(img.dataset.retryCount) < 3
                      ) {
                        // Set retry count
                        img.dataset.retryCount = img.dataset.retryCount
                          ? (parseInt(img.dataset.retryCount) + 1).toString()
                          : "1";
                        // Add a small delay before retrying
                        setTimeout(() => {
                          refreshProfileImage();
                        }, 1000);
                      } else {
                        // Only set fallback after retry attempts fail
                        setProfileImage(DEFAULT_PROFILE_IMAGE);
                        setImageLoading(false);
                      }
                    }}
                  />
                  {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isLoading}
                  className="hidden"
                  id="profile-upload"
                />
                <label
                  htmlFor="profile-upload"
                  className="absolute inset-0 cursor-pointer"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                disabled={isLoading}
                asChild
              >
                <label htmlFor="profile-upload" className="cursor-pointer">
                  <Upload className="h-4 w-4" />
                  {isLoading ? "Uploading..." : "Upload New"}
                </label>
              </Button>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="displayName">Name</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isLoading || isGoogleUser}
                />
                {isGoogleUser && (
                  <p className="text-sm text-muted-foreground">
                    Email cannot be changed for Google accounts
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {!isGoogleUser && (
          <Card>
            <CardHeader>
              <CardTitle>Change your Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                    placeholder="Enter current password"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleChange}
                      disabled={isLoading}
                      placeholder="Enter new password"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      disabled={isLoading}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            type="button"
            onClick={() => navigate(-1)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditAccount;
