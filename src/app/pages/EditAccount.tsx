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
    <div className="max-w-4xl mx-auto py-8 md:py-32 md:mt-0 mt-20 px-4 ">
      <h1 className="text-3xl md:text-4xl font-normal text-gray-900 mb-2">
        Your Account
      </h1>
      <p className="text-gray-600 mb-8">
        Update your account information below.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg p-4 md:p-6 shadow-sm space-y-8"
      >
        {/* Personal Information Section */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-6">
            Personal Information
          </h2>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
            <div className="relative">
              <img
                src={profileImage}
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover border border-gray-300"
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
            <label
              htmlFor="profile-upload"
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
            >
              {isLoading ? "Uploading..." : "Upload New"}
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Name</label>
              <input
                type="text"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading || isGoogleUser}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {isGoogleUser && (
                <p className="mt-1 text-sm text-gray-500">
                  Email cannot be changed for Google accounts
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Password Section */}
        {!isGoogleUser && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-6">Password</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter current password"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter new password"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isLoading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-textBlack"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-[#aab4a1] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-textBlack"
          >
            {isLoading ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditAccount;
