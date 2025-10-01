import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  trend?: number;
  suffix?: string;
  className?: string;
}

export function KPICard({ title, value, trend, suffix, className }: KPICardProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;

  return (
    <Card className={className} data-testid={`card-kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold font-mono" data-testid={`text-kpi-${title.toLowerCase().replace(/\s+/g, '-')}-value`}>
            {value}
          </div>
          {suffix && (
            <span className="text-lg text-muted-foreground">{suffix}</span>
          )}
        </div>
        {trend !== undefined && (
          <div className="mt-2 flex items-center gap-1 text-sm">
            {isPositive && (
              <>
                <TrendingUp className="h-4 w-4 text-chart-2" />
                <span className="text-chart-2 font-medium">+{trend}%</span>
              </>
            )}
            {isNegative && (
              <>
                <TrendingDown className="h-4 w-4 text-destructive" />
                <span className="text-destructive font-medium">{trend}%</span>
              </>
            )}
            <span className="text-muted-foreground ml-1">vs last week</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
