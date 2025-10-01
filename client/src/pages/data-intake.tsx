import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { ConnectorStatus } from "@/components/connector-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface ConnectorApiResponse {
  connectors: Array<{
    id: string;
    name: string;
    status: "success" | "error" | "running";
    lastRun: string | null;
    duration: string;
    successRate: number;
  }>;
  logs: Array<{
    time: string;
    level: string;
    message: string;
    connector: string;
  }>;
}

export default function DataIntake() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<ConnectorApiResponse>({
    queryKey: ["/api/etl/connectors"],
  });

  const connectors = data?.connectors ?? [];
  const logs = data?.logs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Data Intake Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Track data collection from all sources
          </p>
        </div>
        <Button
          data-testid="button-refresh-connectors"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {isFetching ? "Refreshing" : "Refresh All"}
        </Button>
      </div>

      {isError ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load connectors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Check your network configuration or retry once the scheduler has populated fresh data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading && connectors.length === 0 &&
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="animate-pulse">
                <CardHeader>
                  <CardTitle className="text-base">Loading…</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="h-4 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}

          {connectors.map((connector) => {
            const lastRunLabel = connector.lastRun
              ? formatDistanceToNowStrict(new Date(connector.lastRun), { addSuffix: true })
              : "Never";

            return (
              <ConnectorStatus
                key={connector.id}
                name={connector.name}
                status={connector.status}
                lastRun={lastRunLabel}
                duration={connector.duration ?? "—"}
                successRate={Number.isFinite(connector.successRate) ? connector.successRate : 0}
              />
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && logs.length === 0 ? (
            <div className="space-y-2 font-mono text-sm text-muted-foreground">
              <p>Awaiting scheduler bootstrap…</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No recent ETL activity captured yet.</div>
          ) : (
            <div className="space-y-2 font-mono text-sm">
              {logs.map((log, idx) => {
                const timestamp = new Date(log.time);
                const displayTime = Number.isNaN(timestamp.getTime())
                  ? log.time
                  : timestamp.toLocaleTimeString();

                return (
                  <div
                    key={`${log.connector}-${log.time}-${idx}`}
                    className="flex items-start gap-4 p-2 rounded hover-elevate"
                  >
                    <span className="text-muted-foreground">{displayTime}</span>
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
                    <span className="text-xs text-muted-foreground">{log.connector}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
