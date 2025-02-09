import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase/clientApp";
import type { ListingDocument } from "../lib/types/Listing";
import { useState } from "react";
import ImageModal from "./ImageModal";

const ListingView = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: listing, isLoading } = useQuery<ListingDocument>({
    queryKey: ["listing", id],
    queryFn: async () => {
      const docRef = doc(db, "listings", id!);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error("Listing not found");
      }
      return { ...docSnap.data(), id: docSnap.id } as ListingDocument;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Gallery Skeleton */}
          <div className="space-y-4">
            <div className="relative w-full pb-[56.25%] bg-gray-200 rounded-lg animate-pulse">
              <div className="absolute inset-0"></div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="relative w-full pb-[100%] bg-gray-200 rounded-lg animate-pulse">
                  <div className="absolute inset-0"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Listing Details Skeleton */}
          <div className="space-y-6">
            <div>
              <div className="h-8 bg-gray-200 rounded-md w-3/4 animate-pulse mb-2"></div>
              <div className="h-6 bg-gray-200 rounded-md w-1/4 animate-pulse"></div>
            </div>

            <div className="flex items-center gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 bg-gray-200 rounded-md w-16 animate-pulse"></div>
              ))}
            </div>

            {[1, 2, 3, 4, 5].map((section) => (
              <div key={section} className="border-t pt-6">
                <div className="h-6 bg-gray-200 rounded-md w-1/3 animate-pulse mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded-md w-full animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded-md w-5/6 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-xl text-gray-600">Listing not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          <div 
            className="relative w-full pb-[56.25%] rounded-lg overflow-hidden cursor-pointer"
            onClick={() => setIsModalOpen(true)}
          >
            <img
              src={listing.photos?.[selectedImageIndex]?.url || "https://via.placeholder.com/800x600?text=No+Image"}
              alt={listing.title}
              className="absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-in-out transform hover:scale-[1.02]"
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {listing.photos?.map((photo, index) => (
              <div 
                key={photo.id} 
                className="relative w-full pb-[100%] rounded-lg overflow-hidden cursor-pointer"
                onClick={() => {
                  setSelectedImageIndex(index);
                  setIsModalOpen(true);
                }}
              >
                <img
                  src={photo.url}
                  alt={photo.caption || listing.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                />
              </div>
            ))}
          </div>

          {/* Contact Landlord Section */}
          <div className="border-t pt-4 mt-4">
            <h2 className="font-semibold mb-2">Contact Landlord</h2>
            <div className="space-y-2 text-sm">
              <p className="text-gray-600 dark:text-gray-300">
                {listing.landlordName}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                Phone: {listing.landlordContact.phone}
              </p>
              {listing.landlordContact.showEmail && listing.landlordContact.email && (
                <p className="text-gray-600 dark:text-gray-300">
                  Email: {listing.landlordContact.email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Listing Details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{listing.title}</h1>
            <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
              KSh {listing.price.toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
            <span>{listing.bedrooms} beds</span>
            <span>•</span>
            <span>{listing.bathrooms} baths</span>
            <span>•</span>
            <span>{listing.squareFootage} sqft</span>
          </div>

          <div className="border-t pt-6">
            <h2 className="font-semibold mb-4">Location</h2>
            <p className="text-gray-600 text-sm dark:text-gray-300">
              {listing.location.address}, {listing.location.neighborhood}
              <br />
              {listing.location.area}, {listing.location.city}
            </p>
          </div>

          <div className="border-t pt-6">
            <h2 className="font-semibold mb-4">Description</h2>
            <p className="text-gray-600 text-sm tracking-wide dark:text-gray-300 whitespace-pre-line">
              {listing.description}
            </p>
          </div>

          <div className="border-t pt-6">
            <h2 className=" font-semibold mb-4">Property Details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Property Type</dt>
                <dd className="text-gray-900 dark:text-white capitalize">{listing.type}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Condition</dt>
                <dd className="text-gray-900 dark:text-white capitalize">
                  {listing.condition.replace(/_/g, " ")}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Noise Level</dt>
                <dd className="text-gray-900 dark:text-white capitalize">
                  {listing.noiseLevel.replace(/_/g, " ")}
                </dd>
              </div>
            </dl>
          </div>

          <div className="border-t pt-6">
            <h2 className="font-semibold mb-4">Utilities & Amenities</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="text-sm">
                <dt className="text-gray-500 dark:text-gray-400">Water Availability</dt>
                <dd className="text-gray-900 dark:text-white capitalize">
                  {listing.utilities.waterAvailability.replace(/_/g, " ")}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Carrier Coverage</dt>
                <dd className="text-gray-900 dark:text-white capitalize">
                  {listing.utilities.carrierCoverage}
                </dd>
              </div>
            </dl>
            {listing.utilities.includedUtilities.length > 0 && (
              <div className="mt-4">
                <dt className="text-gray-500 dark:text-white font-medium mb-2">Included Utilities</dt>
                <dd className="flex flex-wrap gap-2 text-sm">
                  {listing.utilities.includedUtilities.map((utility) => (
                    <span
                      key={utility}
                      className="px-3 py-1 bg-gray-100 dark:bg-white/20 rounded-md text-sm"
                    >
                      {utility}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </div>

          <div className="border-t pt-6">
            <h2 className="font-semibold mb-4">Security Features</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center">
                <span className="text-gray-600 dark:text-gray-300">
                  {listing.security.hasGuard ? "✓" : "✗"} Security Guard
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 dark:text-gray-300">
                  {listing.security.hasCCTV ? "✓" : "✗"} CCTV
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 dark:text-gray-300">
                  {listing.security.hasSecureParking ? "✓" : "✗"} Secure Parking
                </span>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h2 className="font-semibold mb-4">Terms</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Deposit</dt>
                <dd className="text-gray-900 dark:text-white">
                  KSh {listing.terms.depositAmount.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Lease Length</dt>
                <dd className="text-gray-900 dark:text-white">
                  {listing.terms.leaseLength} months
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Pets Allowed</dt>
                <dd className="text-gray-900 dark:text-white">
                  {listing.terms.petsAllowed ? "Yes" : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Smoking Allowed</dt>
                <dd className="text-gray-900 dark:text-white">
                  {listing.terms.smokingAllowed ? "Yes" : "No"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageUrl={listing?.photos?.[selectedImageIndex]?.url || ''}
        alt={listing?.title}
      />
    </div>
  );
};

export default ListingView;