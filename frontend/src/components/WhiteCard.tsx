
import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface WhiteCardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
}

const WhiteCard = forwardRef<HTMLDivElement, WhiteCardProps>(
  ({ className, children, padding = "md", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-white rounded-lg shadow-sm border border-gray-100",
          {
            "p-3": padding === "sm",
            "p-5": padding === "md",
            "p-7": padding === "lg",
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

WhiteCard.displayName = "WhiteCard";

export default WhiteCard;
