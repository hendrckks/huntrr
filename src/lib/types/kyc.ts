import { Timestamp } from "firebase/firestore";

export type KYCStatus = "pending" | "approved" | "rejected";

export interface KYCDocument {
  id: string;
  userId: string;
  documentType: "national_id" | "passport" | "drivers_license";
  documentNumber: string;
  frontDocumentUrl: string;
  backDocumentUrl: string;
  selfieUrl: string;
  status: KYCStatus;
  personalInfo: {
    dateOfBirth: string;
    address: string;
    city: string;
    country: string;
    postalCode: string;
    phoneNumber: string;
  };
  submittedAt: Timestamp;
  reviewedAt?: Timestamp | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface KYCSubmission {
  documentType: "national_id" | "passport" | "drivers_license";
  documentNumber: string;
  frontDocumentFile: File;
  backDocumentFile: File;
  selfieFile: File;
  personalInfo: {
    dateOfBirth: string;
    address: string;
    city: string;
    country: string;
    postalCode: string;
    phoneNumber: string;
  };
}