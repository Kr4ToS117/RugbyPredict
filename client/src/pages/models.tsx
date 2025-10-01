import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

//todo: remove mock functionality
const featureImportance = [
  { feature: "Home Advantage", importance: 0.185 },
  { feature: "Form (5 games)", importance: 0.162 },
  { feature: "Elo Rating", importance: 0.148 },
  { feature: "Rest Days", importance: 0.095 },
  { feature: "Implied Odds", importance: 0.088 },
  { feature: "Set Piece Stats", importance: 0.072 },
  { feature: "Weather Impact", importance: 0.058 },
  { feature: "Head-to-Head", importance: 0.045 },
];

const models = [
  { version: "v2.3.1", algo: "LightGBM", deployed: true, brier: 0.184, accuracy: 54.2 },
  { version: "v2.3.0", algo: "XGBoost", deployed: false, brier: 0.192, accuracy: 52.8 },
  { version: "v2.2.5", algo: "Logistic", deployed: false, brier: 0.218, accuracy: 51.3 },
];

export default function Models() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Model Lab</h1>
        <p className="text-muted-foreground mt-1">
          Manage models, features, and backtests
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Feature Importance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={featureImportance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  type="category"
                  dataKey="feature"
                  stroke="hsl(var(--muted-foreground))"
                  width={120}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {models.map((model) => (
                <div
                  key={model.version}
                  className="p-4 rounded-md border border-border hover-elevate"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono">{model.version}</span>
                      <Badge variant="outline">{model.algo}</Badge>
                      {model.deployed && (
                        <Badge className="bg-chart-2 text-white">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Production
                        </Badge>
                      )}
                    </div>
                    {!model.deployed && (
                      <Button size="sm" variant="outline" data-testid={`button-promote-${model.version}`}>
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Promote
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Brier Score:</span>
                      <span className="ml-2 font-mono font-medium">{model.brier}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Accuracy:</span>
                      <span className="ml-2 font-mono font-medium">{model.accuracy}%</span>
                    </div>
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
