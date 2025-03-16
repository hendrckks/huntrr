import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  updateUserStatus,
  setupOnlineStatusTracking,
} from "../lib/firebase/chat";
import { auth } from "../lib/firebase/clientApp";

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

const PresenceHandler = () => {
  const { user } = useAuth();
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupFunctionRef = useRef<(() => void) | null>(null);
  const isOfflineRef = useRef(false);

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    if (!user?.uid || isOfflineRef.current) return;

    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Set user as online
    if (isOfflineRef.current) {
      isOfflineRef.current = false;
      updateUserStatus(user.uid, "online");
    }

    // Set new inactivity timer
    inactivityTimerRef.current = setTimeout(() => {
      if (user?.uid) {
        console.log("User inactive, setting status to offline");
        isOfflineRef.current = true;
        updateUserStatus(user.uid, "offline");
      }
    }, INACTIVITY_TIMEOUT);
  };

  useEffect(() => {
    if (!user?.uid) return;

    // Set up RTDB presence system
    cleanupFunctionRef.current = setupOnlineStatusTracking(user.uid);

    // Set user as online initially
    isOfflineRef.current = false;
    updateUserStatus(user.uid, "online");

    // Reset inactivity timer on mount
    resetInactivityTimer();

    // Handle window events for presence
    const handleVisibilityChange = () => {
      if (!user?.uid) return;

      if (document.visibilityState === "visible") {
        isOfflineRef.current = false;
        updateUserStatus(user.uid, "online");
        resetInactivityTimer();
      } else {
        isOfflineRef.current = true;
        updateUserStatus(user.uid, "offline");
        // Clear timer when tab is hidden
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
      }
    };

    // Handle window focus/blur
    const handleWindowFocus = () => {
      if (user?.uid) {
        isOfflineRef.current = false;
        updateUserStatus(user.uid, "online");
        resetInactivityTimer();
      }
    };

    const handleWindowBlur = () => {
      if (user?.uid) {
        isOfflineRef.current = true;
        updateUserStatus(user.uid, "offline");
        // Clear timer when window loses focus
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
      }
    };

    // User activity detection
    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    // Set up cleanup for page unload
    const handleBeforeUnload = () => {
      if (user?.uid) {
        updateUserStatus(user.uid, "offline");
      }
    };

    // Add event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Activity listeners
    document.addEventListener("mousemove", handleUserActivity);
    document.addEventListener("keypress", handleUserActivity);
    document.addEventListener("click", handleUserActivity);
    document.addEventListener("scroll", handleUserActivity);
    document.addEventListener("touchstart", handleUserActivity);

    // Cleanup function
    return () => {
      // Call RTDB cleanup function
      if (cleanupFunctionRef.current) {
        cleanupFunctionRef.current();
      }

      // Only update status to offline if this component is unmounting
      // and not due to a sign-out (which is handled separately)
      if (user?.uid && auth.currentUser) {
        updateUserStatus(user.uid, "offline");
      }

      // Clear inactivity timer
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }

      // Remove event listeners
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Remove activity listeners
      document.removeEventListener("mousemove", handleUserActivity);
      document.removeEventListener("keypress", handleUserActivity);
      document.removeEventListener("click", handleUserActivity);
      document.removeEventListener("scroll", handleUserActivity);
      document.removeEventListener("touchstart", handleUserActivity);
    };
  }, [user]);

  return null; // This component doesn't render anything
};

export default PresenceHandler;
