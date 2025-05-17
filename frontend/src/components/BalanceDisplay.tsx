
import { cn } from "@/lib/utils";

interface BalanceDisplayProps {
  amount: number;
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  type?: "primary" | "secondary" | "reserved";
  icon?: React.ReactNode;
}

const BalanceDisplay = ({ 
  amount, 
  label, 
  size = "md", 
  className,
  type = "primary",
  icon
}: BalanceDisplayProps) => {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="flex items-center gap-2">
        {icon && <div className="text-dark-lighter">{icon}</div>}
        <span className="text-dark-lighter text-sm">{label}</span>
      </div>
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
