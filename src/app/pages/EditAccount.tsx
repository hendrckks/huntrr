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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Upload } from "lucide-react";

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
  const [user, setUser] = useState<User | null>(null);
  const [profileImage, setProfileImage] = useState<string>(
    DEFAULT_PROFILE_IMAGE
  );
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

        // Determine profile image priority
        const googleProfilePicture = currentUser.photoURL;
        const storedCustomProfilePicture = currentUser.photoURL;

        // Set profile image with fallback
        setProfileImage(
          googleProfilePicture ||
            storedCustomProfilePicture ||
            DEFAULT_PROFILE_IMAGE
        );

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
      const imageUrl = await uploadImage(e.target.files[0]);

      if (user) {
        await updateProfile(user, { photoURL: imageUrl });
        await updateDoc(doc(db, "users", user.uid), { photoURL: imageUrl });
        setUser({ ...user, photoURL: imageUrl });
        setProfileImage(imageUrl);
        toast({
          title: "",
          variant: "success",
          description: "Profile picture updated successfully",
          duration: 5000,
        });
      }
    } catch (error) {
      toast({
        title: "",
        variant: "error",
        description: "Failed to update profile picture",
        duration: 5000,
      });
      console.error(error);
    } finally {
      setIsLoading(false);
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
    <div className="container mx-auto px-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-medium">Account Settings</h1>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your profile details and preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <img
                src={profileImage}
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover"
                onError={() => setProfileImage(DEFAULT_PROFILE_IMAGE)}
              />
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
              <CardTitle>Password</CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
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
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
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
          <Button
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditAccount;
