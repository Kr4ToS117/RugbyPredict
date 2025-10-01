import { KPICard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { AlertCircle, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from "recharts";

//todo: remove mock functionality
const roiData = [
  { date: "Oct", roi: 0 },
  { date: "Nov", roi: 5.2 },
  { date: "Dec", roi: 8.5 },
  { date: "Jan", roi: 12.5 },
];

const calibrationData = [
  { predicted: 10, actual: 12 },
  { predicted: 25, actual: 22 },
  { predicted: 40, actual: 38 },
  { predicted: 55, actual: 58 },
  { predicted: 70, actual: 68 },
  { predicted: 85, actual: 82 },
];

const upcomingMatches = [
  { home: "Toulouse", away: "La Rochelle", date: "Sat 21:05", edge: 5.8 },
  { home: "Leinster", away: "Munster", date: "Sun 15:30", edge: 3.2 },
  { home: "Racing 92", away: "Stade Français", date: "Sun 17:00", edge: 1.8 },
];

const alerts = [
  { type: "error", message: "Odds Provider API timeout", time: "2 min ago" },
  { type: "warning", message: "Lineup conflict: Toulouse vs La Rochelle", time: "15 min ago" },
  { type: "info", message: "Model drift detected: 0.8% variance", time: "1 hour ago" },
];

export default function Overview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Overview</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your predictions performance and system health
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="ROI" value="12.5" suffix="%" trend={3.2} />
        <KPICard title="Yield" value="8.3" suffix="%" trend={-1.5} />
        <KPICard title="Hit Rate" value="54.2" suffix="%" trend={2.1} />
        <KPICard title="Brier Score" value="0.184" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              ROI Cumulative
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={roiData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="roi"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-1))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Calibration Plot</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="predicted"
                  name="Predicted"
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  dataKey="actual"
                  name="Actual"
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Scatter
                  data={calibrationData}
                  fill="hsl(var(--chart-2))"
                />
                <Line
                  type="linear"
                  dataKey="predicted"
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  dot={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Fixtures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingMatches.map((match, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-md hover-elevate border border-border"
                >
                  <div>
                    <div className="font-medium">
                      {match.home} vs {match.away}
                    </div>
                    <div className="text-sm text-muted-foreground">{match.date}</div>
                  </div>
                  {match.edge > 3 && (
                    <StatusBadge status={`+${match.edge}% Edge`} variant="success" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-md border border-border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge
                        status={alert.type}
                        variant={
                          alert.type === "error" ? "error" :
                          alert.type === "warning" ? "warning" : "info"
                        }
                      />
                      <span className="text-xs text-muted-foreground">{alert.time}</span>
                    </div>
                    <div className="text-sm">{alert.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
