// Tremor Raw Toast [v0.0.2]

import React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { RiCloseCircleFill, RiInformationFill, RiLoader2Fill } from "@remixicon/react";

import { cx } from "../../lib/utils";

const ToastProvider = ToastPrimitives.Provider;
ToastProvider.displayName = "ToastProvider";

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, forwardedRef) => (
  <ToastPrimitives.Viewport
    ref={forwardedRef}
    className={cx(
      "fixed right-0 top-0 z-[9999] m-0 flex w-full max-w-[100vw] list-none flex-col gap-2 p-[var(--viewport-padding)] [--viewport-padding:_15px] sm:max-w-md sm:gap-4",
      className
    )}
    {...props}
  />
));

ToastViewport.displayName = "ToastViewport";

interface ActionProps {
  label: string;
  altText: string;
  onClick: () => void | Promise<void>;
}

interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> {
  variant?: "info" | "success" | "warning" | "error" | "loading";
  title?: string;
  description?: string;
  action?: ActionProps;
  disableDismiss?: boolean;
//   className: string;
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  ToastProps
>(
  (
    {
      className,
      variant,
      title,
      description,
      action,
      disableDismiss = false,
      ...props
    }: ToastProps,
    forwardedRef
  ) => {
    let Icon: React.ReactNode = null;

    switch (variant) {
      case "success":
        Icon = (
          <img
            src="/icons/thumbs-up.svg"
            alt=""
            className="w-6 h-6 shrink-0"
            aria-hidden="true"
          />
        );
        break;
      case "warning":
        Icon = (
          <img
            src="/icons/triangle-warning.svg"
            alt=""
            className="w-6 h-6 shrink-0"
            aria-hidden="true"
          />
        );
        break;
      case "error":
        Icon = (
          <RiCloseCircleFill
            className="size-5 shrink-0 text-red-600 dark:text-red-500"
            aria-hidden="true"
          />
        );
        break;
      case "loading":
        Icon = (
          <RiLoader2Fill
            className="size-5 shrink-0 animate-spin text-gray-600 dark:text-gray-500"
            aria-hidden="true"
          />
        );
        break;
      default:
        Icon = (
          <RiInformationFill
            className="size-5 shrink-0 text-primary dark:text-primary"
            aria-hidden="true"
          />
        );
        break;
    }

    return (
      <ToastPrimitives.Root
        ref={forwardedRef}
        className={cx(
          // base
          "flex h-fit min-h-16 w-full overflow-hidden rounded-xl border shadow-xl shadow-black/5",
          // background color
          "bg-black/90 dark:bg-[#fafafa]",
          // border color
          "border-white/50 dark:border-white/50",
          // swipe
          "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
          // transition
          "data-[state=open]:animate-slideLeftAndFade",
          "data-[state=closed]:animate-hide",
          className
        )}
        {...props}
      >
        <div
          className={cx(
            // base
            "flex flex-1 items-start gap-3 p-5",
            // border
            !disableDismiss || action
              ? "border-r border-textBlack/80 dark:border-textBlack/80"
              : ""
          )}
        >
          {Icon}
          <div className="flex flex-col gap-1">
            {title && (
              <ToastPrimitives.Title className="text-sm font-semibold dark:text-gray-900 text-white">
                {title}
              </ToastPrimitives.Title>
            )}
            {description && (
              <ToastPrimitives.Description className="text-sm dark:text-gray-600 text-white/70">
                {description}
              </ToastPrimitives.Description>
            )}
          </div>
        </div>
        <div className="flex flex-col">
          {action && (
            <>
              <ToastPrimitives.Action
                altText={action.altText}
                className={cx(
                  // base
                  "flex flex-1 items-center justify-center px-6 text-sm font-semibold transition-colors",
                  // hover
                  "hover:bg-gray-50 hover:dark:bg-gray-900/30",
                  // text color
                  "text-textBlack dark:text-textBlack",
                  // active
                  "active:bg-gray-100 active:dark:bg-gray-800",
                  {
                    "text-red-600 dark:text-red-500": variant === "error",
                  }
                )}
                onClick={(event) => {
                  event.preventDefault();
                  action.onClick();
                }}
                type="button"
              >
                {action.label}
              </ToastPrimitives.Action>
              <div className="h-px w-full bg-gray-200 dark:bg-gray-800" />
            </>
          )}
          {!disableDismiss && (
            <ToastPrimitives.Close
              className={cx(
                // base
                "flex flex-1 items-center justify-center px-6 text-sm font-medium transition-colors",
                // text color
                "dark:text-gray-600 text-white/90",
                // hover
                "hover:bg-white/5 hover:dark:bg-primary/40",
                // active
                "active:bg-gray-100",
                action ? "h-1/2" : "h-full"
              )}
              aria-label="Close"
            >
              Close
            </ToastPrimitives.Close>
          )}
        </div>
      </ToastPrimitives.Root>
    );
  }
);
Toast.displayName = "Toast";

type ToastActionElement = ActionProps;

export {
  Toast,
  ToastProvider,
  ToastViewport,
  type ToastActionElement,
  type ToastProps,
};
