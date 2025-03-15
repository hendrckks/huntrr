import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase/clientApp";
import type { ListingDocument } from "../lib/types/Listing";
import { useState, useEffect } from "react";
import { incrementAnalyticMetric } from "../lib/firebase/analytics";
import ImageModal from "./ImageModal";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { MessageSquare } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const ListingView = () => {
  const { slug } = useParams<{ slug: string }>(); // Change from id to slug
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const { data: listing, isLoading } = useQuery<ListingDocument>({
    queryKey: ["listing", slug],
    queryFn: async () => {
      const docRef = doc(db, "listings", slug!);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Listing not found");
      }

      return {
        ...docSnap.data(),
        id: docSnap.id,
        slug: docSnap.id,
      } as ListingDocument;
    },
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  // Track view count when listing is viewed
  useEffect(() => {
    if (listing?.id) {
      incrementAnalyticMetric(listing.id, "view").catch(console.error);
    }
  }, [listing?.id]);

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
                <div
                  key={i}
                  className="relative w-full pb-[100%] bg-gray-200 rounded-lg animate-pulse"
                >
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
                <div
                  key={i}
                  className="h-4 bg-gray-200 rounded-md w-16 animate-pulse"
                ></div>
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
          <div className="relative">
            <div
              className="overflow-x-auto scroll-smooth listing-gallery-scroll"
              style={{ scrollBehavior: "smooth" }}
            >
              <div className="flex gap-3 pb-4">
                {listing.photos?.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="flex-none w-[calc(25%-9px)] relative pb-[calc(25%-9px)] rounded-lg overflow-hidden cursor-pointer"
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
            </div>
            {/* <style>
              {`
              .listing-gallery-scroll::-webkit-scrollbar {
                height: 8px;
              }
              .listing-gallery-scroll::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 4px;
              }
              .listing-gallery-scroll::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 4px;
              }
              .listing-gallery-scroll::-webkit-scrollbar-thumb:hover {
                background: #555;
              }
              `}
            </style> */}
          </div>

          {/* Contact Landlord Section */}
          <section className="border-t pt-4 mt-4">
            <h2 className="text-xl font-semibold mb-2">Contact Landlord</h2>
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <p className="text-gray-600 dark:text-gray-300">{listing.landlordName}</p>
                <p className="text-gray-600 dark:text-gray-300">Phone: {listing.landlordContact.phone}</p>
                {listing.landlordContact.showEmail && listing.landlordContact.email && (
                  <p className="text-gray-600 dark:text-gray-300">Email: {listing.landlordContact.email}</p>
                )}
              </div>
              <div className="flex items-center justify-start">
                <Button
                  onClick={() => {
                    if (!isAuthenticated) {
                      navigate('/login');
                      return;
                    }
                    navigate(`/chats?landlordId=${listing.landlordId}`);
                  }}
                  className="w-full sm:w-auto"
                  variant="default"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat with Owner
                </Button>
              </div>
            </div>
          </section>
        </div>

        {/* Listing Details */}
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">{listing.title}</h1>
            {listing.status !== "published" && (
              <Badge variant={listing.status === "denied" ? "destructive" : listing.status === "pending_review" ? "default" : "secondary"} className="w-fit">
                {listing.status.replace("_", " ").toUpperCase()}
              </Badge>
            )}
          </div>

          <section className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-4">Location</h2>
            <p className="text-gray-600 text-sm dark:text-gray-300">
              {listing.location.address}, {listing.location.neighborhood}<br />
              {listing.location.area}, {listing.location.city}
            </p>
          </section>

          <section className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-4">Description</h2>
            <p className="text-gray-600 text-sm tracking-wide dark:text-gray-300 whitespace-pre-line">{listing.description}</p>
          </section>

          <section className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-4">Utilities & Amenities</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="text-sm">
                <dt className="text-gray-500 dark:text-gray-400">
                  Water Availability
                </dt>
                <dd className="text-gray-900 dark:text-white capitalize">
                  {listing.utilities.waterAvailability.replace(/_/g, " ")}
                </dd>
              </div>
              <div className="text-sm">
                <dt className="text-gray-500 dark:text-gray-400">
                  Carrier Coverage
                </dt>
                <dd className="text-gray-900 dark:text-white capitalize">
                  {listing.utilities.carrierCoverage}
                </dd>
              </div>
            </dl>
            {listing.utilities.includedUtilities.length > 0 && (
              <div className="mt-4">
                <dt className="text-gray-600 dark:text-white font-semibold mb-2">
                  Included Utilities
                </dt>
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
          </section>

          <section className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-4">Security Features</h2>
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
          </section>

          <section className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-4">Terms</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Deposit</dt>
                <dd className="text-gray-900 dark:text-white">
                  KSh {listing.terms.depositAmount.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">
                  Lease Length
                </dt>
                <dd className="text-gray-900 dark:text-white">
                  {listing.terms.leaseLength} months
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">
                  Pets Allowed
                </dt>
                <dd className="text-gray-900 dark:text-white">
                  {listing.terms.petsAllowed ? "Yes" : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">
                  Smoking Allowed
                </dt>
                <dd className="text-gray-900 dark:text-white">
                  {listing.terms.smokingAllowed ? "Yes" : "No"}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageUrl={listing?.photos?.[selectedImageIndex]?.url || ""}
        alt={listing?.title}
      />
    </div>
  );
};

export default ListingView;
