import { useQuery, useMutation, useQueryClient } from "react-query";
import {
  addListing,
  updateListing,
  deleteListing,
  getListing,
  getListings,
  submitListingForVerification,
  verifyListing,
  draftListing,
  getNotifications,
  markNotificationAsRead,
} from "../lib/firebase/firestore";
import type { Listing, ListingQuery } from "../lib/types/Listing";
import { CustomError } from "../../shared/CustomErrors";

export const useListings = (queryParams: ListingQuery) => {
  return useQuery(["listings", queryParams], () => getListings(queryParams), {
    keepPreviousData: true,
    onError: (error) => {
      if (error instanceof CustomError) {
        console.error(
          `Error fetching listings: ${error.code} - ${error.message}`
        );
      } else {
        console.error(
          "An unexpected error occurred while fetching listings:",
          error
        );
      }
    },
  });
};

export const useListing = (id: string) => {
  return useQuery(["listing", id], () => getListing(id), {
    onError: (error) => {
      if (error instanceof CustomError) {
        console.error(
          `Error fetching listing: ${error.code} - ${error.message}`
        );
      } else {
        console.error(
          "An unexpected error occurred while fetching the listing:",
          error
        );
      }
    },
  });
};

export const useAddListing = () => {
  const queryClient = useQueryClient();
  return useMutation(addListing, {
    onSuccess: () => {
      queryClient.invalidateQueries("listings");
    },
    onError: (error: CustomError) => {
      console.error(`Error adding listing: ${error.code} - ${error.message}`);
    },
  });
};

export const useUpdateListing = () => {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, listing }: { id: string; listing: Partial<Listing> }) =>
      updateListing(id, listing),
    {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries(["listing", id]);
        queryClient.invalidateQueries("listings");
      },
      onError: (error: CustomError) => {
        console.error(
          `Error updating listing: ${error.code} - ${error.message}`
        );
      },
    }
  );
};

export const useDeleteListing = () => {
  const queryClient = useQueryClient();
  return useMutation(deleteListing, {
    onSuccess: () => {
      queryClient.invalidateQueries("listings");
    },
    onError: (error: CustomError) => {
      console.error(`Error deleting listing: ${error.code} - ${error.message}`);
    },
  });
};

export const useSubmitListingForVerification = () => {
  const queryClient = useQueryClient();
  return useMutation(submitListingForVerification, {
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(["listing", id]);
      queryClient.invalidateQueries("listings");
    },
    onError: (error: CustomError) => {
      console.error(
        `Error submitting listing for verification: ${error.code} - ${error.message}`
      );
    },
  });
};

export const useVerifyListing = () => {
  const queryClient = useQueryClient();
  return useMutation(verifyListing, {
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(["listing", id]);
      queryClient.invalidateQueries("listings");
    },
    onError: (error: CustomError) => {
      console.error(
        `Error verifying listing: ${error.code} - ${error.message}`
      );
    },
  });
};

export const useDraftListing = () => {
  const queryClient = useQueryClient();
  return useMutation(draftListing, {
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(["listing", id]);
      queryClient.invalidateQueries("listings");
    },
    onError: (error: CustomError) => {
      console.error(
        `Error setting listing as draft: ${error.code} - ${error.message}`
      );
    },
  });
};

export const useNotifications = (landlordId: string) => {
  return useQuery(
    ["notifications", landlordId],
    () => getNotifications(landlordId),
    {
      onError: (error: CustomError) => {
        console.error(
          `Error fetching notifications: ${error.code} - ${error.message}`
        );
      },
    }
  );
};

export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation(markNotificationAsRead, {
    onSuccess: () => {
      queryClient.invalidateQueries("notifications");
    },
    onError: (error: CustomError) => {
      console.error(
        `Error marking notification as read: ${error.code} - ${error.message}`
      );
    },
  });
};
