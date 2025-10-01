import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "error" | "info" | "default";

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  warning: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  default: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status, variant = "default", className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs uppercase font-medium",
        variantStyles[variant],
        className
      )}
      data-testid={`badge-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {status}
    </Badge>
  );
}
