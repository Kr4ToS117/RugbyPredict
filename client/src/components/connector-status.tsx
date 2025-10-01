import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectorStatusProps {
  name: string;
  status: "success" | "error" | "running";
  lastRun: string;
  duration: string;
  successRate: number;
}

export function ConnectorStatus({
  name,
  status,
  lastRun,
  duration,
  successRate,
}: ConnectorStatusProps) {
  const statusConfig = {
    success: {
      icon: CheckCircle2,
      color: "text-chart-2",
      bg: "bg-chart-2/10",
    },
    error: {
      icon: XCircle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    running: {
      icon: Clock,
      color: "text-chart-4",
      bg: "bg-chart-4/10",
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card className="hover-elevate" data-testid={`card-connector-${name.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{name}</CardTitle>
          <div className={cn("p-2 rounded-md", config.bg)}>
            <StatusIcon className={cn("h-4 w-4", config.color)} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Last Run</div>
            <div className="font-medium mt-1">{lastRun}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Duration</div>
            <div className="font-medium font-mono mt-1">{duration}</div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Success Rate</span>
            <span className="font-medium font-mono">{successRate}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full",
                successRate >= 90 ? "bg-chart-2" : successRate >= 70 ? "bg-chart-3" : "bg-destructive"
              )}
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
