import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { updateUserStatus } from "../lib/firebase/chat";

const PresenceHandler = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) return;

    // Set user as online
    updateUserStatus(user.uid, "online");

    // Handle window events for presence
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateUserStatus(user.uid, "online");
      } else {
        updateUserStatus(user.uid, "offline");
      }
    };

    // Handle window focus/blur
    const handleWindowFocus = () => updateUserStatus(user.uid, "online");
    const handleWindowBlur = () => updateUserStatus(user.uid, "offline");

    // Set up cleanup for page unload
    const handleBeforeUnload = () => updateUserStatus(user.uid, "offline");

    // Add event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup function
    return () => {
      updateUserStatus(user.uid, "offline");
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user]);

  return null; // This component doesn't render anything
};

export default PresenceHandler;
