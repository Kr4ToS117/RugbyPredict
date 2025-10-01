import { useRef } from "react";
import type { ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ReviewFixture {
  fixtureId: string;
  fixtureLabel: string;
  predictedOutcome: string;
  predictedProbability: number;
  actualOutcome: string;
  correct: boolean;
  error: number;
  impact: number;
}

interface AttributionBucket {
  category: string;
  count: number;
  impact: "low" | "medium" | "high";
  contribution: number;
}

interface ReviewResponse {
  generatedAt: string;
  summary: {
    totalFixtures: number;
    correct: number;
    hitRate: number;
    meanAbsoluteError: number;
    totalProfitImpact: number;
  };
  fixtures: ReviewFixture[];
  attributions: AttributionBucket[];
  exports: Array<{ key: string; filename: string; url: string; createdAt: string }>;
}

export default function Review() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: review } = useQuery<ReviewResponse>({ queryKey: ["/api/review"] });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/review");
      return (await res.json()) as ReviewResponse;
    },
    onSuccess: async () => {
      toast({ title: "Rapport généré", description: "Le rapport HTML/PDF est disponible." });
      await queryClient.invalidateQueries({ queryKey: ["/api/review"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Génération impossible",
        description: error instanceof Error ? error.message : "Erreur inattendue",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (csv: string) => {
      await apiRequest("POST", "/api/review/import", { csv });
    },
    onSuccess: async () => {
      toast({ title: "Résultats importés", description: "Les fixtures ont été mises à jour." });
      await queryClient.invalidateQueries({ queryKey: ["/api/review"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Import impossible",
        description: error instanceof Error ? error.message : "Format non pris en charge",
        variant: "destructive",
      });
    },
  });

  const handleImport = () => fileInputRef.current?.click();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    importMutation.mutate(text);
    event.target.value = "";
  };

  const fixtures = review?.fixtures ?? [];
  const errorCategories = review?.attributions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Post-Weekend Review</h1>
          <p className="text-muted-foreground mt-1">
            Analyze prediction accuracy and learn from errors
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            data-testid="button-import-results"
            onClick={handleImport}
            disabled={importMutation.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Results
          </Button>
          <Button data-testid="button-generate-report" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Fixtures reviewed</div>
            <div className="text-lg font-semibold">{review?.summary.totalFixtures ?? 0}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Hit rate</div>
            <div className="text-lg font-semibold">{(review?.summary.hitRate ?? 0).toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Mean Absolute Error</div>
            <div className="text-lg font-semibold">{(review?.summary.meanAbsoluteError ?? 0).toFixed(3)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prediction Accuracy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-sm text-muted-foreground">
                  <th className="text-left py-3 px-4">Fixture</th>
                  <th className="text-left py-3 px-4">Predicted</th>
                  <th className="text-left py-3 px-4">Actual</th>
                  <th className="text-center py-3 px-4">Result</th>
                  <th className="text-right py-3 px-4">Error</th>
                </tr>
              </thead>
              <tbody>
                {fixtures.map((pred) => (
                  <tr
                    key={pred.fixtureId}
                    className="border-b border-border hover-elevate"
                  >
                    <td className="py-3 px-4">{pred.fixtureLabel}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {pred.predictedOutcome} ({(pred.predictedProbability * 100).toFixed(1)}%)
                    </td>
                    <td className="py-3 px-4">{pred.actualOutcome}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs ${
                          pred.correct
                            ? "bg-chart-2/10 text-chart-2"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {pred.correct ? "Correct" : "Incorrect"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{pred.error.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Error Attribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {errorCategories.map((cat, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-md border border-border"
              >
                <div>
                  <div className="font-medium">{cat.category}</div>
                  <div className="text-sm text-muted-foreground">{cat.count} occurrences</div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    cat.impact === "high"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-chart-3/10 text-chart-3"
                  }`}
                >
                  {cat.impact === "high" ? "High" : cat.impact === "medium" ? "Medium" : "Low"} Impact
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {review?.exports?.length ? (
            review.exports.map((file) => (
              <a
                key={file.key}
                href={file.url}
                className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                <span>{file.filename}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(file.createdAt).toLocaleString()}
                </span>
              </a>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Aucun export disponible.</p>
          )}
        </CardContent>
      </Card>

      <input
        type="file"
        accept=".csv,text/csv"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
