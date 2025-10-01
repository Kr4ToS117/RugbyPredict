import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload } from "lucide-react";

//todo: remove mock functionality
const predictions = [
  {
    fixture: "Toulouse vs La Rochelle",
    predicted: "Home Win (52%)",
    actual: "Home Win",
    correct: true,
    error: 0.02,
  },
  {
    fixture: "Leinster vs Munster",
    predicted: "Home Win (68%)",
    actual: "Home Win",
    correct: true,
    error: 0.05,
  },
  {
    fixture: "Racing 92 vs Stade Français",
    predicted: "Draw (45%)",
    actual: "Away Win",
    correct: false,
    error: 0.28,
  },
];

const errorCategories = [
  { category: "Lineup Changes", count: 3, impact: "High" },
  { category: "Weather Variance", count: 2, impact: "Medium" },
  { category: "Upset Results", count: 1, impact: "High" },
];

export default function Review() {
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
          <Button variant="outline" data-testid="button-import-results">
            <Upload className="h-4 w-4 mr-2" />
            Import Results
          </Button>
          <Button data-testid="button-generate-report">
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

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
                {predictions.map((pred, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-border hover-elevate"
                  >
                    <td className="py-3 px-4">{pred.fixture}</td>
                    <td className="py-3 px-4 text-muted-foreground">{pred.predicted}</td>
                    <td className="py-3 px-4">{pred.actual}</td>
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
                    cat.impact === "High"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-chart-3/10 text-chart-3"
                  }`}
                >
                  {cat.impact} Impact
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
