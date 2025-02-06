import React from "react";
import { cn } from "../../lib/utils";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export const Spinner = ({ className, size = "md", ...props }: SpinnerProps) => {
  return (
    <div className="flex items-center justify-center min-h-[100px] space-x-4">
      {/* space-x-4 adds horizontal spacing between child elements */}
      <div
        className={cn(
          "border-2 border-textBlack/20 rounded-full",
          "border-t-textBlack animate-spin",
          sizeClasses[size],
          className
        )}
        {...props}
      />
    </div>
  );
}; 