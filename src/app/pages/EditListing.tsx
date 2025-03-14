import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase/clientApp";
import { updateListing } from "../../lib/firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../hooks/useToast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  listingFormSchema,
  type ListingFormData,
} from "../../lib/types/Listing";
import {
  PropertyType,
  PropertyCondition,
  CarrierCoverage,
  WaterAvailability,
  NoiseLevel,
} from "../../lib/types/Listing";
import Container from "../../components/Container";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function EditListingForm() {
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);

  const addDebugLog = (message: string) => {
    console.log(message);
    setDebugLog((prev) => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const form = useForm<ListingFormData>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: {
      title: "",
      type: "apartment" as const,
      price: 1,
      bedrooms: 1,
      bathrooms: 1,
      description: "",
      condition: "good" as const,
      squareFootage: 1,
      location: {
        address: "",
        area: "",
        neighborhood: "",
        city: "",
      },
      utilities: {
        carrierCoverage: "good" as const,
        waterAvailability: "24_7" as const,
        includedUtilities: [],
      },
      noiseLevel: "moderate" as const,
      terms: {
        depositAmount: 1,
        leaseLength: 12,
        petsAllowed: false,
        smokingAllowed: false,
        utilityResponsibilities: [],
      },
      security: {
        hasGuard: false,
        hasCCTV: false,
        hasSecureParking: false,
        additionalSecurity: [],
      },
      landlordName: "",
      landlordContact: {
        phone: "",
        email: "",
        showEmail: false,
      },
      // Initialize these fields that might be causing validation issues
      status: "draft" as const,
      flags: [],
      flagCount: 0,
      bookmarkCount: 0,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      verifiedAt: null,
      verifiedBy: null,
      FLAG_THRESHOLD: 5,
    },
  });

  const { isLoading, data } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      if (!id) return null;
      const docRef = doc(db, "listings", id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      // Convert Firestore data to correctly formatted form data
      const docData = docSnap.data();

      // Convert Timestamp fields to JavaScript Date objects
      const processTimestamp = (timestamp: any) => {
        if (!timestamp) return null;
        return timestamp instanceof Timestamp
          ? timestamp.toDate()
          : timestamp instanceof Date
          ? timestamp
          : null;
      };

      // Process flags array to convert timestamps to dates
      const processedFlags = docData.flags
        ? docData.flags.map((flag: any) => ({
            ...flag,
            createdAt: processTimestamp(flag.createdAt) || new Date(),
            resolvedAt: flag.resolvedAt
              ? processTimestamp(flag.resolvedAt)
              : null,
          }))
        : [];

      return {
        ...docData,
        flags: processedFlags,
        createdAt: processTimestamp(docData.createdAt) || new Date(),
        updatedAt: processTimestamp(docData.updatedAt) || new Date(),
        verifiedAt: processTimestamp(docData.verifiedAt),
        // Ensure status is properly set
        status: docData.status || "draft",
        // Make sure all required fields have default values
        flagCount: docData.flagCount || 0,
        bookmarkCount: docData.bookmarkCount || 0,
        viewCount: docData.viewCount || 0,
        FLAG_THRESHOLD: docData.FLAG_THRESHOLD || 5,
      } as ListingFormData;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (data) {
      // Ensure any array fields are properly initialized
      const formattedData = {
        ...data,
        utilities: {
          ...data.utilities,
          includedUtilities: data.utilities?.includedUtilities || [],
        },
        terms: {
          ...data.terms,
          utilityResponsibilities: data.terms?.utilityResponsibilities || [],
        },
        security: {
          ...data.security,
          additionalSecurity: data.security?.additionalSecurity || [],
        },
        flags: data.flags || [],
        // Ensure these fields exist with proper values
        status: data.status || "draft",
        flagCount: data.flagCount || 0,
        bookmarkCount: data.bookmarkCount || 0,
        viewCount: data.viewCount || 0,
        FLAG_THRESHOLD: data.FLAG_THRESHOLD || 5,
      };

      form.reset(formattedData);
    }
  }, [data, form]);

  const updateMutation = useMutation({
    mutationFn: async ({
      formData,
      images,
    }: {
      formData: ListingFormData;
      images: File[];
    }) => {
      if (!id || !user?.uid) throw new Error("Missing required data");

      // Ensure all required fields are present to pass validation
      const updatedData = {
        ...formData,
        updatedAt: new Date(),
        // Ensure all these fields exist
        status: formData.status || "pending_review",
        flags: formData.flags || [],
        flagCount: formData.flagCount || 0,
        bookmarkCount: formData.bookmarkCount || 0,
        viewCount: formData.viewCount || 0,
        FLAG_THRESHOLD: formData.FLAG_THRESHOLD || 5,
      };

      // If user is not an admin, set status to pending_review
      if (user?.role !== "admin") {
        updatedData.status = "pending_review";
      }

      await updateListing(id, updatedData, images, user.uid);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Listing updated successfully",
        duration: 5000,
      });
      navigate("/landlord-dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to update listing: " + error.message,
        variant: "error",
        duration: 5000,
      });
    },
  });

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      addDebugLog(
        `Form field changed: ${name}, type: ${type}, value: ${JSON.stringify(
          value
        )}`
      );
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setImages(Array.from(e.target.files));
  };

  const onSubmit = (values: ListingFormData) => {
    // Ensure all required fields are present
    const formData = {
      ...values,
      createdAt: values.createdAt || new Date(),
      updatedAt: new Date(),
      status:
        user?.role !== "admin"
          ? "pending_review"
          : values.status || "pending_review",
      flags: values.flags || [],
      flagCount: values.flagCount || 0,
      bookmarkCount: values.bookmarkCount || 0,
      viewCount: values.viewCount || 0,
      FLAG_THRESHOLD: values.FLAG_THRESHOLD || 5,
    };

    updateMutation.mutate({ formData, images });
  };

  if (isLoading) return <div>Loading...</div>;
  return (
    <Container>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Edit Listing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter listing title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Property Type and Price */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select property type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PropertyType.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price / month</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter price"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Bedrooms and Bathrooms */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bedrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bedrooms</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Number of bedrooms"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bathrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bathrooms</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Number of bathrooms"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the property"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Condition and Square Footage */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PropertyCondition.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="squareFootage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Square Footage (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter square footage"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Location Fields */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  {["address", "area", "neighborhood", "city"].map((field) => (
                    <FormField
                      key={field}
                      control={form.control}
                      name={`location.${field}` as any}
                      render={({ field: locationField }) => (
                        <FormItem>
                          <FormLabel>
                            {field.charAt(0).toUpperCase() + field.slice(1)}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={`Enter ${field}`}
                              {...locationField}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Utilities Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Utilities</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="utilities.carrierCoverage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carrier Coverage</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select carrier coverage" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CarrierCoverage.options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option.replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="utilities.waterAvailability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Water Availability</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select water availability" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {WaterAvailability.options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option.replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Fix for includedUtilities handling - properly convert string to array */}
                <FormField
                  control={form.control}
                  name="utilities.includedUtilities"
                  render={({ field }) => {
                    // Format the array as a comma-separated string for display
                    const displayValue = Array.isArray(field.value)
                      ? field.value.join(", ")
                      : "";

                    return (
                      <FormItem>
                        <FormLabel>Included Utilities</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter included utilities (comma-separated)"
                            value={displayValue}
                            onChange={(e) => {
                              // Split by comma and trim whitespace
                              const values = e.target.value
                                .split(",")
                                .map((item) => item.trim())
                                .filter((item) => item.length > 0);
                              field.onChange(values);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Noise Level */}
              <FormField
                control={form.control}
                name="noiseLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Noise Level</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select noise level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NoiseLevel.options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Terms Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Terms</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="terms.depositAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deposit Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Enter deposit amount"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="terms.leaseLength"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lease Length (months)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Enter lease length"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="terms.petsAllowed"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Pets Allowed</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="terms.smokingAllowed"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Smoking Allowed</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Fix for utilityResponsibilities handling - properly convert string to array */}
                <FormField
                  control={form.control}
                  name="terms.utilityResponsibilities"
                  render={({ field }) => {
                    // Format the array as a comma-separated string for display
                    const displayValue = Array.isArray(field.value)
                      ? field.value.join(", ")
                      : "";

                    return (
                      <FormItem>
                        <FormLabel>Utility Responsibilities</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter utility responsibilities (comma-separated)"
                            value={displayValue}
                            onChange={(e) => {
                              // Split by comma and trim whitespace
                              const values = e.target.value
                                .split(",")
                                .map((item) => item.trim())
                                .filter((item) => item.length > 0);
                              field.onChange(values);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Security Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Security</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="security.hasGuard"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Has Guard</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="security.hasCCTV"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Has CCTV</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="security.hasSecureParking"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Has Secure Parking</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Fix for additionalSecurity handling - properly convert string to array */}
                <FormField
                  control={form.control}
                  name="security.additionalSecurity"
                  render={({ field }) => {
                    // Format the array as a comma-separated string for display
                    const displayValue = Array.isArray(field.value)
                      ? field.value.join(", ")
                      : "";

                    return (
                      <FormItem>
                        <FormLabel>Additional Security</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter additional security info (comma-separated)"
                            value={displayValue}
                            onChange={(e) => {
                              // Split by comma and trim whitespace
                              const values = e.target.value
                                .split(",")
                                .map((item) => item.trim())
                                .filter((item) => item.length > 0);
                              field.onChange(values);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Landlord Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Landlord Information</h3>
                <FormField
                  control={form.control}
                  name="landlordName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Landlord Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter landlord name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="landlordContact.phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Landlord Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter landlord phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="landlordContact.email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Landlord Email (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter landlord email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="landlordContact.showEmail"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Show Email Publicly</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {/* Image Upload Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Photos</h3>
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="dropzone-file"
                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg
                        className="w-8 h-8 mb-4 text-gray-500"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 20 16"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                        />
                      </svg>
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span>{" "}
                        or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                        PNG, JPG or GIF (MAX. 5MB per image)
                      </p>
                    </div>
                    <input
                      id="dropzone-file"
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
                {images.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500">
                      {images.length} image(s) selected
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {images.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Selected ${index + 1}`}
                            className="w-20 h-20 object-cover rounded-md"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={updateMutation.isPending || !form.formState.isValid}
            className="disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? "Updating..." : "Update Listing"}
          </Button>

          {updateMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {updateMutation.error.message}
              </AlertDescription>
            </Alert>
          )}

          {updateMutation.isSuccess && (
            <Alert
              variant="default"
              className="bg-green-50 text-green-800 border-green-300"
            >
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>Listing updated successfully!</AlertDescription>
            </Alert>
          )}

          {debugLog.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Debug Log</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-60 text-sm">
                  {debugLog.join("\n")}
                </pre>
              </CardContent>
            </Card>
          )}
        </form>
      </Form>
    </Container>
  );
}
