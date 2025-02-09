import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase/clientApp";
import { useAuth } from "./AuthContext";
import { useToast } from "../hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";

interface BookmarkContextType {
  bookmarks: Set<string>;
  isLoading: boolean;
  addBookmark: (listingId: string) => Promise<void>;
  removeBookmark: (listingId: string) => Promise<void>;
  isBookmarked: (listingId: string) => boolean;
}

const BookmarkContext = createContext<BookmarkContextType | null>(null);

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export const BookmarkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, boolean>>(
    new Map()
  );

  // Load initial bookmarks
  useEffect(() => {
    const loadBookmarks = async () => {
      if (!user) {
        setBookmarks(new Set());
        setIsLoading(false);
        return;
      }

      try {
        const bookmarksRef = query(
          collection(db, "bookmarks"),
          where("userId", "==", user.uid)
        );
        const snapshot = await getDocs(bookmarksRef);
        const bookmarkIds = snapshot.docs.map((doc) => doc.data().listingId);
        setBookmarks(new Set(bookmarkIds));
      } catch (error) {
        console.error("Error loading bookmarks:", error);
        toast({
          title: "Error",
          description: "Failed to load bookmarks",
          variant: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadBookmarks();
  }, [user, toast]);

  // Batch update function with proper error handling
  const processPendingUpdates = useCallback(async () => {
    if (!user || pendingUpdates.size === 0) return;

    const batch = writeBatch(db);
    const updates = new Map(pendingUpdates);
    setPendingUpdates(new Map()); // Clear pending updates

    try {
      // First, verify all documents that we're trying to delete actually exist
      const deleteChecks: Promise<boolean>[] = [];
      for (const [listingId, isAdding] of updates) {
        if (!isAdding) {
          const bookmarkId = `${user.uid}_${listingId}`;
          const bookmarkRef = doc(db, "bookmarks", bookmarkId);
          deleteChecks.push(getDoc(bookmarkRef).then((doc) => doc.exists()));
        }
      }

      const existenceResults = await Promise.all(deleteChecks);
      const hasNonExistentDocs = existenceResults.some((exists) => !exists);

      if (hasNonExistentDocs) {
        // Some documents don't exist, refresh the bookmark list instead
        const bookmarksRef = query(
          collection(db, "bookmarks"),
          where("userId", "==", user.uid)
        );
        const snapshot = await getDocs(bookmarksRef);
        const bookmarkIds = snapshot.docs.map((doc) => doc.data().listingId);
        setBookmarks(new Set(bookmarkIds));
        return;
      }

      // Process updates for documents we know exist
      for (const [listingId, isAdding] of updates) {
        const bookmarkId = `${user.uid}_${listingId}`;
        const bookmarkRef = doc(db, "bookmarks", bookmarkId);

        if (isAdding) {
          batch.set(bookmarkRef, {
            userId: user.uid,
            listingId,
            id: bookmarkId,
            createdAt: serverTimestamp(),
          });
        } else {
          batch.delete(bookmarkRef);
        }
      }

      await batch.commit();

      // Invalidate relevant queries after successful update
      queryClient.invalidateQueries({ queryKey: ["bookmarks", user.uid] });
    } catch (error) {
      console.error("Error processing bookmark updates:", error);

      // Revert local state on error
      setBookmarks((prevBookmarks) => {
        const newBookmarks = new Set(prevBookmarks);
        for (const [listingId, isAdding] of updates) {
          if (isAdding) {
            newBookmarks.delete(listingId);
          } else {
            newBookmarks.add(listingId);
          }
        }
        return newBookmarks;
      });

      // Only show toast for actual errors, not for non-existent documents
      if (
        error instanceof Error &&
        !error.message.includes("Missing or insufficient permissions")
      ) {
        toast({
          title: "Error",
          description: "Failed to update bookmarks",
          variant: "error",
        });
      }
    }
  }, [user, pendingUpdates, queryClient, toast]);

  const debouncedProcessUpdates = useCallback(
    debounce(processPendingUpdates, 500) as {
      (): void;
      cancel?: () => void;
    },
    [processPendingUpdates]
  );

  useEffect(() => {
    if (pendingUpdates.size > 0) {
      debouncedProcessUpdates();
    }

    // Cleanup function to cancel any pending debounced operations
    return () => {
      debouncedProcessUpdates.cancel?.();
    };
  }, [pendingUpdates, debouncedProcessUpdates]);

  const addBookmark = useCallback(
    async (listingId: string) => {
      if (!user) return;

      // Optimistic update
      setBookmarks((prev) => new Set([...prev, listingId]));
      setPendingUpdates((prev) => new Map(prev).set(listingId, true));
    },
    [user]
  );

  const removeBookmark = useCallback(
    async (listingId: string) => {
      if (!user) return;

      // Optimistic update
      setBookmarks((prev) => {
        const newBookmarks = new Set(prev);
        newBookmarks.delete(listingId);
        return newBookmarks;
      });
      setPendingUpdates((prev) => new Map(prev).set(listingId, false));
    },
    [user]
  );

  const isBookmarked = useCallback(
    (listingId: string) => {
      return bookmarks.has(listingId);
    },
    [bookmarks]
  );

  return (
    <BookmarkContext.Provider
      value={{
        bookmarks,
        isLoading,
        addBookmark,
        removeBookmark,
        isBookmarked,
      }}
    >
      {children}
    </BookmarkContext.Provider>
  );
};

export const useBookmarks = () => {
  const context = useContext(BookmarkContext);
  if (!context) {
    throw new Error("useBookmarks must be used within a BookmarkProvider");
  }
  return context;
};
