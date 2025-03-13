import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createListing } from "../../lib/firebase/firestore";
import { uploadImage } from "../../lib/firebase/storage";
import {
  type ListingFormData,
  listingFormSchema,
  listingSchema,
  type Photo,
} from "../../lib/types/Listing";
import { Button } from "../../components/ui/button";
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
import { AlertCircle, CheckCircle2, HousePlus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import Container from "../../components/Container";
import {
  PropertyType,
  PropertyCondition,
  NoiseLevel,
  WaterAvailability,
  CarrierCoverage,
} from "../../lib/types/Listing";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function CreateListingForm() {
  const { user, isAuthenticated } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [debugLog, setDebugLog] = useState<string[]>([]);

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
      flags: [],
      flagCount: 0,
      bookmarkCount: 0,
      viewCount: 0,
      FLAG_THRESHOLD: 5,
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

  useEffect(() => {
    console.log("Form errors:", form.formState.errors);
  }, [form.formState.errors]);

  useEffect(() => {
    const errors = form.formState.errors;
    if (Object.keys(errors).length > 0) {
      const errorDetails = Object.entries(errors).map(
        ([key, error]) => `${key}: ${error.message || "Unknown error"}`
      );
      addDebugLog("Form errors detected:\n" + errorDetails.join("\n"));
      console.log("Detailed form errors:", errors);
    }
  }, [form.formState.errors]);

  // Helper function to add debug logs
  const addDebugLog = (message: string) => {
    console.log(message); // Console logging
    setDebugLog((prev) => [...prev, `${new Date().toISOString()}: ${message}`]); // UI logging
  };

  // Check authentication and role
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }

    if (!user?.role || user.role === "landlord_unverified") {
      navigate("/verify-documents");
      return;
    }
  }, [isAuthenticated, user, navigate]);

  async function onSubmit(data: ListingFormData) {
    addDebugLog("Form submission attempted");
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    setUploadProgress(0);

    const sanitizedData = {
      ...data,
      utilities: {
        ...data.utilities,
        includedUtilities: data.utilities.includedUtilities.map((item) =>
          item.trim()
        ),
      },
      terms: {
        ...data.terms,
        utilityResponsibilities: data.terms.utilityResponsibilities.map(
          (item) => item.trim()
        ),
      },
    };

    addDebugLog(`Form data: ${JSON.stringify(sanitizedData, null, 2)}`);

    try {
      if (!user?.uid) {
        throw new Error("You must be logged in to create a listing");
      }

      if (images.length === 0) {
        throw new Error("At least one image is required");
      }

      // Upload images first
      addDebugLog("Starting image upload...");
      const imageUrls: Photo[] = [];
      if (
        !user.uid ||
        !user.role ||
        !(
          user.role === "landlord_verified" ||
          user.role === "admin"
        )
      ) {
        throw new Error("You don't have permission to upload listing images");
      }
      const tempListingId = `temp_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}`;

      for (let i = 0; i < images.length; i++) {
        const url = await uploadImage(images[i], tempListingId, user.uid);
        imageUrls.push({ id: `photo_${i}`, url, isPrimary: i === 0 });
        setUploadProgress(((i + 1) / images.length) * 100);
      }

      const listingData = {
        ...data,
        landlordId: user.uid,
        flags: [],
        flagCount: 0,
        bookmarkCount: 0,
        viewCount: 0,
        FLAG_THRESHOLD: 5,
        status: "pending_review",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate the final data
      const validationResult = listingSchema.safeParse({
        ...listingData,
        id: "temp_id", // Add temporary id for validation
        status: "pending_review",
        createdAt: new Date(),
        updatedAt: new Date(),
        verifiedAt: null, // Add this line
        verifiedBy: null, // Add this line
      });

      if (!validationResult.success) {
        const allErrors = validationResult.error.errors.map(
          (e, i) => `Error ${i + 1}: ${e.path.join(".")} - ${e.message}`
        );
        throw new Error(`Validation failed:\n${allErrors.join("\n")}`);
      }

      // Submit to Firestore
      addDebugLog("Submitting to Firestore...");
      const listingId = await createListing(
        listingData,
        images,
        "pending_review"
      );
      addDebugLog(`Listing created successfully with ID: ${listingId}`);

      console.log("Form validity:", form.formState.isValid);
      console.log("Form errors:", form.formState.errors);

      setSubmitSuccess(true);
      toast({ title: "Success", description: "Listing created successfully" });
      navigate("/");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setSubmitError(errorMessage);
      addDebugLog(`Error: ${errorMessage}`);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      console.log("Images selected:", e.target.files.length); // Add this log
      setImages(Array.from(e.target.files));
    }
  };
  return (
    <Container className="max-w-7xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 ">
                <HousePlus className="h-6 w-6" />
                <CardTitle className="text-xl">Create New Listing</CardTitle>
              </div>
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

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  {["address", "area", "neighborhood", "city"].map((field) => (
                    <FormField
                      key={field}
                      control={form.control}
                      name={
                        `location.${field}` as
                          | "location.address"
                          | "location.area"
                          | "location.neighborhood"
                          | "location.city"
                      }
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
                <FormField
                  control={form.control}
                  name="utilities.includedUtilities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Included Utilities</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter included utilities (comma-separated)"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.split(","))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                        <FormLabel>Lease Length (months) (optional)</FormLabel>
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
                <FormField
                  control={form.control}
                  name="terms.utilityResponsibilities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Utility Responsibilities</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter utility responsibilities (comma-separated)"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.split(","))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                <FormField
                  control={form.control}
                  name="security.additionalSecurity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Security</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter additional security info (comma-separated)"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.split(","))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Photos</h3>
                {/* {form.formState.errors.ima && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.photos.message}
                  </p>
                )} */}
                {images.length === 0 && (
                  <p className="text-sm text-destructive">
                    At least one image is required
                  </p>
                )}
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="dropzone-file"
                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg
                        className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400"
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
                      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Click to upload</span>{" "}
                        or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
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
                            src={
                              URL.createObjectURL(image) || "/placeholder.svg"
                            }
                            alt={`Selected ${index + 1}`}
                            className="w-20 h-20 object-cover rounded-md"
                          />
                          <Button
                            type="submit"
                            disabled={(() => {
                              const isButtonDisabled =
                                isSubmitting ||
                                !form.formState.isValid ||
                                images.length === 0;
                              console.log({
                                isSubmitting,
                                formStateValid: form.formState.isValid,
                                imagesLength: images.length,
                                isButtonDisabled,
                              });
                              return isButtonDisabled;
                            })()}
                            className="disabled:cursor-not-allowed"
                          >
                            {isSubmitting ? "Creating..." : "Create Listing"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}

          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {submitSuccess && (
            <Alert
              variant="default"
              className="bg-green-50 text-green-800 border-green-300"
            >
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                Your listing has been created successfully.
              </AlertDescription>
            </Alert>
          )}

          {debugLog.length > 0 && (
            <Card className="mt-4 text-black">
              <CardHeader>
                <CardTitle className="text-white">Debug Log</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-60 text-sm">
                  {debugLog.join("\n")}
                </pre>
              </CardContent>
            </Card>
          )}

          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {submitSuccess && (
            <Alert
              variant="default"
              className="bg-green-50 text-green-800 border-green-300"
            >
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                Your listing has been created successfully.
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={
              isSubmitting || !form.formState.isValid || images.length === 0
            }
            className="disabled:cursor-not-allowed"
          >
            {!form.formState.isValid && !isSubmitting && "Fix errors to submit"}
            {form.formState.isValid && isSubmitting && "Creating..."}
            {form.formState.isValid && !isSubmitting && "Create Listing"}
          </Button>
        </form>
      </Form>
    </Container>
  );
}
