import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface GreenButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

const GreenButton = forwardRef<HTMLButtonElement, GreenButtonProps>(
  ({ className, children, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-nexapay-400 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-nexapay-500 hover:bg-nexapay-600 text-white": variant === "primary",
            "bg-white border border-nexapay-500 text-nexapay-600 hover:bg-nexapay-50": variant === "secondary",
            "bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-100": variant === "outline",
            "bg-transparent text-nexapay-600 hover:bg-nexapay-50": variant === "ghost",
            "px-3 py-1.5 text-sm rounded": size === "sm",
            "px-4 py-2": size === "md",
            "px-6 py-3 text-lg": size === "lg",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

GreenButton.displayName = "GreenButton";

export default GreenButton;
