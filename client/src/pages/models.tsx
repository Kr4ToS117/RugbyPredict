import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type EvaluationMetrics = {
  accuracy?: number;
  brierScore?: number;
  roi?: number;
  yield?: number;
  hitRate?: number;
};

type CalibrationCurvePoint = { predicted: number; actual: number };

interface ModelMetrics {
  training?: EvaluationMetrics;
  backtest?: EvaluationMetrics;
  roiSeries?: Array<{ period: string; roi: number }>;
  calibration?: { method?: string; curve?: CalibrationCurvePoint[] };
  featureImportance?: Array<{ feature: string; importance: number }>;
  status?: string;
  promotedAt?: string;
}

interface ModelSummary {
  id: string;
  name: string;
  version: string;
  algorithm: string;
  description: string | null;
  trainingWindow: string | null;
  createdAt: string;
  status: "production" | "staging" | "archived";
  metrics: ModelMetrics;
}

export interface ModelsResponse {
  models: ModelSummary[];
  productionVersion: string | null;
}

function formatFeatureLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

export default function Models() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useQuery<ModelsResponse>({
    queryKey: ["/api/models"],
  });

  const promoteMutation = useMutation({
    mutationFn: async ({
      version,
      action,
    }: {
      version: string;
      action: "promote" | "rollback";
    }) => {
      await apiRequest("POST", `/api/models/${version}/promote`, { action });
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({
        title: variables.action === "promote" ? "Model promoted" : "Rollback appliqué",
        description:
          variables.action === "promote"
            ? `La version ${variables.version} est désormais en production.`
            : `La version ${variables.version} a été retirée de la production.`,
      });
    },
    onError: (mutationError: unknown) => {
      const message =
        mutationError instanceof Error ? mutationError.message : "Erreur inattendue";
      toast({
        title: "Action impossible",
        description: message,
        variant: "destructive",
      });
    },
  });

  const models = data?.models ?? [];
  const productionModel = useMemo(
    () => models.find((model) => model.status === "production") ?? null,
    [models],
  );

  const featureImportanceData = useMemo(() => {
    const items = productionModel?.metrics.featureImportance ?? [];
    return items
      .map((item) => ({
        feature: formatFeatureLabel(item.feature),
        importance: Number((item.importance ?? 0).toFixed(4)),
      }))
      .slice(0, 12);
  }, [productionModel]);

  const handleLifecycleAction = (version: string, action: "promote" | "rollback") => {
    promoteMutation.mutate({ version, action });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Model Lab</h1>
        <p className="text-muted-foreground mt-1">
          Manage models, features, and backtests
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Feature Importance</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Model Versions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-24 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive">
              {(error as Error)?.message ?? "Une erreur est survenue lors du chargement des modèles."}
            </p>
          </CardContent>
        </Card>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Feature Importance</CardTitle>
          </CardHeader>
          <CardContent>
            {featureImportanceData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={featureImportanceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    stroke="hsl(var(--muted-foreground))"
                    width={160}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Bar dataKey="importance" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune importance de feature disponible pour le modèle en production.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {models.map((model) => {
                const backtest = model.metrics.backtest ?? model.metrics.training;
                const brier = backtest?.brierScore ?? 0;
                const accuracy = backtest?.accuracy ?? 0;
                const isProduction = model.status === "production";

                return (
                <div
                  key={model.version}
                  className="p-4 rounded-md border border-border hover-elevate"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono">{model.version}</span>
                      <Badge variant="outline">{model.algorithm}</Badge>
                      {isProduction && (
                        <Badge className="bg-chart-2 text-white">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Production
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isProduction ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLifecycleAction(model.version, "rollback")}
                          disabled={promoteMutation.isPending}
                        >
                          Rollback
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-promote-${model.version}`}
                          onClick={() => handleLifecycleAction(model.version, "promote")}
                          disabled={promoteMutation.isPending}
                        >
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Promote
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Brier Score:</span>
                      <span className="ml-2 font-mono font-medium">{brier.toFixed(3)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Accuracy:</span>
                      <span className="ml-2 font-mono font-medium">{accuracy.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
