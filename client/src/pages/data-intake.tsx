import { ConnectorStatus } from "@/components/connector-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

//todo: remove mock functionality
const connectors = [
  { name: "Top14 API", status: "success" as const, lastRun: "2 min ago", duration: "1.2s", successRate: 98.5 },
  { name: "ProD2 API", status: "success" as const, lastRun: "3 min ago", duration: "0.9s", successRate: 97.8 },
  { name: "URC API", status: "success" as const, lastRun: "2 min ago", duration: "1.5s", successRate: 99.2 },
  { name: "Premiership API", status: "running" as const, lastRun: "Just now", duration: "0.8s", successRate: 100 },
  { name: "Weather API", status: "success" as const, lastRun: "1 min ago", duration: "0.5s", successRate: 100 },
  { name: "Odds Provider", status: "error" as const, lastRun: "5 min ago", duration: "timeout", successRate: 85.2 },
];

const logs = [
  { time: "14:32:15", level: "INFO", message: "Top14 API: Fetched 12 fixtures", connector: "Top14 API" },
  { time: "14:32:10", level: "INFO", message: "URC API: Fetched 8 fixtures", connector: "URC API" },
  { time: "14:31:45", level: "ERROR", message: "Odds Provider: Connection timeout after 30s", connector: "Odds Provider" },
  { time: "14:31:30", level: "INFO", message: "Weather API: Retrieved forecast for 20 venues", connector: "Weather API" },
  { time: "14:31:15", level: "WARN", message: "ProD2 API: Rate limit approaching (450/500)", connector: "ProD2 API" },
];

export default function DataIntake() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Data Intake Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Track data collection from all sources
          </p>
        </div>
        <Button data-testid="button-refresh-connectors">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {connectors.map((connector) => (
          <ConnectorStatus key={connector.name} {...connector} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 font-mono text-sm">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 p-2 rounded hover-elevate"
              >
                <span className="text-muted-foreground">{log.time}</span>
                <span
                  className={
                    log.level === "ERROR"
                      ? "text-destructive"
                      : log.level === "WARN"
                      ? "text-chart-3"
                      : "text-chart-2"
                  }
                >
                  {log.level}
                </span>
                <span className="flex-1">{log.message}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
