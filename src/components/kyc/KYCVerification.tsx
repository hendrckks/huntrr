import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../hooks/useToast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { uploadImage } from "../../lib/firebase/storage";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase/clientApp";
import { BirthdayPicker } from "../ui/birthday-picker";

const kycSubmissionSchema = z.object({
  documentType: z.enum(["national_id", "passport", "drivers_license"]),
  documentNumber: z.string().min(1, "Document number is required"),
  frontDocumentFile: z.instanceof(File, { message: "Front document image is required" }),
  backDocumentFile: z.instanceof(File, { message: "Back document image is required" }),
  selfieFile: z.instanceof(File, { message: "Selfie photo is required" }),
  personalInfo: z.object({
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    country: z.string().min(1, "Country is required"),
    postalCode: z.string().min(1, "Postal code is required"),
    phoneNumber: z.string().min(1, "Phone number is required")
  })
});

type KYCFormData = z.infer<typeof kycSubmissionSchema>;

const KYCVerification = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<KYCFormData>({
    resolver: zodResolver(kycSubmissionSchema),
    defaultValues: {
      documentType: "national_id",
      documentNumber: "",
      personalInfo: {
        dateOfBirth: "",
        address: "",
        city: "",
        country: "",
        postalCode: "",
        phoneNumber: "",
      },
    },
  });

  const handleFileChange =
    (field: keyof Pick<KYCFormData, "frontDocumentFile" | "backDocumentFile" | "selfieFile">) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        form.setValue(field, e.target.files[0]);
      }
    };


  const onSubmit = async (data: KYCFormData) => {
    if (!user) return;

    try {
      setIsSubmitting(true);

      // 1. First check if KYC document already exists
      const kycRef = doc(db, "kyc", user.uid);
      const kycDoc = await getDoc(kycRef);

      if (kycDoc.exists()) {
        toast({
          title: "Error",
          description: "KYC verification has already been submitted.",
          variant: "error",
        });
        return;
      }

      // 2. Upload documents with proper file names
      const frontDocumentUrl = await uploadImage(
        data.frontDocumentFile,
        `users/${user.uid}/kyc`,
        user.uid
      );

      const backDocumentUrl = await uploadImage(
        data.backDocumentFile,
        `users/${user.uid}/kyc`,
        user.uid
      );

      const selfieUrl = await uploadImage(
        data.selfieFile,
        `users/${user.uid}/kyc`,
        user.uid
      );

      // 3. Create KYC document with validated structure
      const timestamp = Timestamp.now();
      const kycData = {
        id: user.uid,
        userId: user.uid,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        frontDocumentUrl,
        backDocumentUrl,
        selfieUrl,
        personalInfo: {
          ...data.personalInfo,
        },
        status: "pending" as const,
        submittedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
      };

      await setDoc(kycRef, kycData);

      toast({
        title: "Success",
        description: "Your documents have been submitted for verification.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error submitting KYC:", error);
      toast({
        title: "Error",
        description: "Failed to submit documents. Please try again.",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Verify Your Identity</CardTitle>
        <CardDescription>
          Please provide your identification documents and personal information
          for verification.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="documentType">Document Type</Label>
            <Select
              value={form.getValues("documentType")}
              onValueChange={(value) => form.setValue("documentType", value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="national_id">National ID</SelectItem>
                <SelectItem value="passport">Passport</SelectItem>
                <SelectItem value="drivers_license">
                  Driver's License
                </SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.documentType && (
              <p className="text-sm text-red-500">{form.formState.errors.documentType.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="documentNumber">Document Number</Label>
            <Input
              id="documentNumber"
              {...form.register("documentNumber")}
            />
            {form.formState.errors.documentNumber && (
              <p className="text-sm text-red-500">{form.formState.errors.documentNumber.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="frontDocument">Front of Document</Label>
            <Input
              id="frontDocument"
              type="file"
              accept="image/*"
              onChange={handleFileChange("frontDocumentFile")}
              capture="environment"
            />
            {form.formState.errors.frontDocumentFile && (
              <p className="text-sm text-red-500">{form.formState.errors.frontDocumentFile.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="backDocument">Back of Document</Label>
            <Input
              id="backDocument"
              type="file"
              accept="image/*"
              onChange={handleFileChange("backDocumentFile")}
              capture="environment"
            />
            {form.formState.errors.backDocumentFile && (
              <p className="text-sm text-red-500">{form.formState.errors.backDocumentFile.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="selfie">Selfie Photo</Label>
            <Input
              id="selfie"
              type="file"
              accept="image/*"
              onChange={handleFileChange("selfieFile")}
              capture="user"
            />
            {form.formState.errors.selfieFile && (
              <p className="text-sm text-red-500">{form.formState.errors.selfieFile.message}</p>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Personal Information</h3>

            <div className="space-y-2 flex items-center gap-2">
              <Label htmlFor="dateOfBirth" className="font-medium">
                Date of Birth
              </Label>
              <BirthdayPicker
                onSelect={(date) =>
                  form.setValue(
                    "personalInfo.dateOfBirth",
                    date ? date.toISOString().split("T")[0] : ""
                  )
                }
              />
              {form.formState.errors.personalInfo?.dateOfBirth && (
                <p className="text-sm text-red-500">{form.formState.errors.personalInfo.dateOfBirth.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                {...form.register("personalInfo.address")}
              />
              {form.formState.errors.personalInfo?.address && (
                <p className="text-sm text-red-500">{form.formState.errors.personalInfo.address.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  {...form.register("personalInfo.city")}
                />
                {form.formState.errors.personalInfo?.city && (
                  <p className="text-sm text-red-500">{form.formState.errors.personalInfo.city.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  {...form.register("personalInfo.country")}
                />
                {form.formState.errors.personalInfo?.country && (
                  <p className="text-sm text-red-500">{form.formState.errors.personalInfo.country.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  {...form.register("personalInfo.postalCode")}
                />
                {form.formState.errors.personalInfo?.postalCode && (
                  <p className="text-sm text-red-500">{form.formState.errors.personalInfo.postalCode.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  {...form.register("personalInfo.phoneNumber")}
                />
                {form.formState.errors.personalInfo?.phoneNumber && (
                  <p className="text-sm text-red-500">{form.formState.errors.personalInfo.phoneNumber.message}</p>
                )}
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Submitting..." : "Submit for Verification"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default KYCVerification;
