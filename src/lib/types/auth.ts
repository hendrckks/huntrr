import { z } from "zod";
import { User as FirebaseUser } from "firebase/auth";

export const SignUpRole = z.enum(["user", "landlord_unverified"]);
export type SignUpRole = z.infer<typeof SignUpRole>;

export const UserRole = z.enum([
  "user",
  "admin",
  "landlord_unverified",
  "landlord_verified",
]);
export type UserRole = z.infer<typeof UserRole>;

// Extended User interface with role
export interface User extends FirebaseUser {
  createdAt?: string;
  role?: UserRole;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

// Helper function to format Zod errors
export const getZodErrorMessage = (error: z.ZodError): string => {
  return error.errors
    .map((err) => {
      const field = err.path.join(".");
      return `${field}: ${err.message}`;
    })
    .join(", ");
};

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .refine(
    (password) => /[A-Z]/.test(password),
    "Password must include an uppercase letter"
  )
  .refine(
    (password) => /[a-z]/.test(password),
    "Password must include a lowercase letter"
  )
  .refine(
    (password) => /[0-9]/.test(password),
    "Password must include a number"
  )
  .refine(
    (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
    "Password must include a special character"
  );

export const signUpSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"),
  password: passwordSchema,
  displayName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name is too long"),
  role: SignUpRole.default("user"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const resetPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Schema for landlord verification
export const verifyLandlordSchema = z.object({
  uid: z.string().min(1, "User ID is required"),
});

// Response types
export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
}

// Input types
export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type VerifyLandlordInput = z.infer<typeof verifyLandlordSchema>;

// Session types
export interface SessionInfo {
  expiresAt: number;
  lastActivity: number;
}
