import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

import type { ModelsResponse } from "./models";

interface FixturesResponse {
  fixtures: Array<{
    id: string;
    competition: string | null;
    kickoffAt: string;
    venue: string | null;
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
    probabilities: { home: number; draw: number; away: number } | null;
    expectedScores: { home: number | null; away: number | null } | null;
    edge: number | null;
    modelVersion: string | null;
  }>;
  productionVersion: string | null;
}

interface ValidationIssue {
  id: string;
  fixture: string;
  field: string;
  severity: "high" | "medium" | "low";
  sources: Array<{ name: string; value: string }>;
}

interface ValidationResponse {
  issues: ValidationIssue[];
}

interface RiskExposure {
  id: string;
  type: "competition" | "team" | "stop_loss";
  label: string;
  exposure: number;
  limit: number;
  breaching: boolean;
}

interface StakeRecommendation {
  strategy: string;
  percentage: number;
  amount: number;
  label: string;
}

interface OverviewResponse {
  models: ModelsResponse;
  fixtures: FixturesResponse;
  validation: ValidationResponse;
  risk: {
    exposures: RiskExposure[];
    recommendations: StakeRecommendation[];
    bankroll: {
      roi: number;
      hitRate: number;
      yield: number;
      netProfit: number;
    } & Record<string, number>;
  };
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export default function Overview() {
  const { data, isError, error } = useQuery<OverviewResponse>({
    queryKey: ["/api/overview"],
  });

  if (isError) {
    throw error;
  }

  const modelsData = data?.models;
  const fixturesData = data?.fixtures;
  const validationData = data?.validation;
  const riskData = data?.risk;

  const productionModel = useMemo(
    () => modelsData?.models.find((model) => model.status === "production") ?? null,
    [modelsData],
  );

  const backtestMetrics = productionModel?.metrics.backtest ?? productionModel?.metrics.training;
  const roiValue = backtestMetrics?.roi ?? 0;
  const yieldPercent = backtestMetrics?.yield && backtestMetrics.yield > 0
    ? (backtestMetrics.yield - 1) * 100
    : 0;
  const hitRate = backtestMetrics?.hitRate ?? 0;
  const brierScore = backtestMetrics?.brierScore ?? 0;

  const roiSeries = productionModel?.metrics.roiSeries ?? [];
  const roiData = roiSeries.map((point) => ({ date: point.period, roi: point.roi }));
  const roiTrend =
    roiSeries.length > 1
      ? Number((roiSeries[roiSeries.length - 1].roi - roiSeries[roiSeries.length - 2].roi).toFixed(2))
      : undefined;

  const calibrationData =
    productionModel?.metrics.calibration?.curve?.map((point) => ({
      predicted: point.predicted,
      actual: point.actual,
    })) ?? [];

  const upcomingMatches = fixturesData?.fixtures.map((fixture) => ({
    id: fixture.id,
    competition: fixture.competition ?? "",
    home: fixture.homeTeam.name,
    away: fixture.awayTeam.name,
    date: formatDateLabel(fixture.kickoffAt),
    venue: fixture.venue ?? "",
    edge: fixture.edge !== null ? Number((fixture.edge * 100).toFixed(1)) : 0,
    probabilities: fixture.probabilities,
  })) ?? [];

  const riskAlerts = (riskData?.exposures ?? [])
    .filter((exposure) => exposure.breaching)
    .map((exposure) => ({
      id: exposure.id,
      fixture: exposure.label,
      field: exposure.type === "stop_loss" ? "Stop-loss" : "Exposure",
      severity: "high" as const,
      sources: [
        {
          name: "Exposition",
          value: `€${exposure.exposure.toFixed(2)} / €${exposure.limit.toFixed(2)}`,
        },
      ],
    }));

  const alerts = [...(validationData?.issues ?? []), ...riskAlerts];
  const exposures = riskData?.exposures ?? [];
  const recommendations = riskData?.recommendations ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Overview</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your predictions performance and system health
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="ROI" value={roiValue.toFixed(2)} suffix="%" trend={roiTrend} />
        <KPICard title="Yield" value={yieldPercent.toFixed(2)} suffix="%" />
        <KPICard title="Hit Rate" value={hitRate.toFixed(2)} suffix="%" />
        <KPICard title="Brier Score" value={brierScore.toFixed(3)} />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Fixtures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingMatches.map((match) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between p-3 rounded-md hover-elevate border border-border"
                >
                  <div>
                    <div className="font-medium">
                      {match.home} vs {match.away}
                    </div>
                    <div className="text-sm text-muted-foreground">{match.date}</div>
                  </div>
                  {match.edge > 1 && (
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
              {alerts.map((alert) => {
                const variant =
                  alert.severity === "high"
                    ? "error"
                    : alert.severity === "medium"
                      ? "warning"
                      : "info";
                const primarySource = alert.sources?.[0];

                return (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-md border border-border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={alert.severity} variant={variant} />
                      <span className="text-xs text-muted-foreground">{alert.field}</span>
                    </div>
                    <div className="text-sm">
                      {primarySource?.value ?? primarySource?.name ?? alert.fixture}
                    </div>
                </div>
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {exposures.map((exposure) => (
                <div
                  key={exposure.id}
                  className={`flex items-center justify-between rounded-md border border-border p-3 ${
                    exposure.breaching ? "bg-destructive/5" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium">{exposure.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {exposure.type === "stop_loss" ? "Stop-loss" : "Exposure"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">
                      €{exposure.exposure.toFixed(2)} / €{exposure.limit.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {((exposure.exposure / exposure.limit) * 100).toFixed(1)}% utilisé
                    </div>
                  </div>
                </div>
              ))}
              {!exposures.length && (
                <p className="text-sm text-muted-foreground">Aucune exposition suivie.</p>
              )}
            </div>
            {recommendations.length ? (
              <div className="mt-4 border-t border-border pt-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Recommandations de mise
                </div>
                {recommendations.map((item) => (
                  <div key={item.strategy} className="flex items-center justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="font-mono">€{item.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
