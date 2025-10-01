import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "./status-badge";

interface ValidationIssue {
  id: string;
  fixture: string;
  field: string;
  severity: "high" | "medium" | "low";
  sources: Array<{ name: string; value: string }>;
}

interface ValidationCardProps {
  issue: ValidationIssue;
  onResolve?: (issueId: string, chosenSource: string) => void;
}

export function ValidationCard({ issue, onResolve }: ValidationCardProps) {
  return (
    <Card className="hover-elevate" data-testid={`card-validation-${issue.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-chart-3" />
            <CardTitle className="text-sm">{issue.fixture}</CardTitle>
          </div>
          <StatusBadge
            status={issue.severity}
            variant={issue.severity === "high" ? "error" : "warning"}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Conflict in <span className="font-medium">{issue.field}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {issue.sources.map((source, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover-elevate"
            >
              <div>
                <div className="text-sm font-medium">{source.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {source.value}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResolve?.(issue.id, source.name)}
                data-testid={`button-resolve-${source.name.toLowerCase()}`}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Use This
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
