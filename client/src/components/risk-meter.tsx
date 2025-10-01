import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RiskMeterProps {
  title: string;
  current: number;
  limit: number;
  unit?: string;
}

export function RiskMeter({ title, current, limit, unit = "€" }: RiskMeterProps) {
  const percentage = (current / limit) * 100;
  const isHigh = percentage > 80;
  const isMedium = percentage > 50 && percentage <= 80;
  const isLow = percentage <= 50;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-mono font-medium">
            {unit}{current}
          </span>
          <span className="text-muted-foreground">
            {unit}{limit} limit
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              isLow && "bg-chart-2",
              isMedium && "bg-chart-3",
              isHigh && "bg-destructive"
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{percentage.toFixed(1)}% used</span>
          <span className={cn(
            isLow && "text-chart-2",
            isMedium && "text-chart-3",
            isHigh && "text-destructive"
          )}>
            {isLow && "Safe"}
            {isMedium && "Moderate"}
            {isHigh && "High Risk"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
