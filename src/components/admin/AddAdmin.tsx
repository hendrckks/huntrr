import type React from "react";
import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { z } from "zod";
import { signUpSchema, UserRole } from "../../lib/types/auth";

const functions = getFunctions();

const adminCreationSchema = signUpSchema
  .omit({ role: true }) // Remove the original role from signUpSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm your password"),
    role: UserRole.default("admin"), // Use UserRole which includes 'admin'
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type AdminCreationFormData = z.infer<typeof adminCreationSchema>;

const CreateAdminUserForm: React.FC = () => {
  const [formData, setFormData] = useState<AdminCreationFormData>({
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
    role: "admin",
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    try {
      const validatedData = adminCreationSchema.parse(formData);
      setErrors({});
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMap = error.errors.reduce((acc, curr) => {
          acc[curr.path[0]] = curr.message;
          return acc;
        }, {} as { [key: string]: string });
        setErrors(errorMap);
      }
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    const validatedData = validateForm();
    if (!validatedData) {
      setSubmitting(false);
      return;
    }

    try {
      const createAdminUser = httpsCallable(functions, "createAdminUser");
      const result = await createAdminUser({
        email: validatedData.email,
        password: validatedData.password,
        displayName: validatedData.displayName,
      });

      if (
        result.data &&
        typeof result.data === "object" &&
        "success" in result.data
      ) {
        setSuccessMessage("Admin user created successfully!");
        // Reset form
        setFormData({
          email: "",
          password: "",
          confirmPassword: "",
          displayName: "",
          role: "admin",
        });
      }
    } catch (error: any) {
      let errorMessage = "An unexpected error occurred";
      if (error.code === "permission-denied") {
        errorMessage = "You don't have permission to create admin users.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      setServerError(errorMessage);
      console.error("Admin creation error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h3 className="text-2xl font-semibold">Create Admin User</h3>
      </div>

      <div className="space-y-4">
        {serverError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <div className="flex items-center">
              <span className="font-bold">Error</span>
            </div>
            <p className="mt-1">{serverError}</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            <div className="flex items-center">
              <span className="font-bold">Success</span>
            </div>
            <p className="mt-1">{successMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium mb-1"
            >
              Full Name
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleInputChange}
              placeholder="Enter full name"
              disabled={submitting}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.displayName && (
              <p className="text-red-500 text-sm mt-1">{errors.displayName}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter email address"
              disabled={submitting}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter password"
              disabled={submitting}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium mb-1"
            >
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm password"
              disabled={submitting}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {submitting ? "Creating Admin..." : "Create Admin User"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateAdminUserForm;
