
import { cn } from "@/lib/utils";

interface BalanceDisplayProps {
  amount: number;
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  type?: "primary" | "secondary" | "reserved";
}

const BalanceDisplay = ({ 
  amount, 
  label, 
  size = "md", 
  className,
  type = "primary" 
}: BalanceDisplayProps) => {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-dark-lighter text-sm">{label}</span>
      <span
        className={cn("font-semibold", {
          "text-greenleaf-600": type === "primary",
          "text-dark": type === "secondary",
          "text-amber-600": type === "reserved",
          "text-xl": size === "sm",
          "text-2xl": size === "md",
          "text-4xl": size === "lg",
        })}
      >
        ${amount.toFixed(2)}
      </span>
    </div>
  );
};

export default BalanceDisplay;
