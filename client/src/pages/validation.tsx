import { ValidationCard } from "@/components/validation-card";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

//todo: remove mock functionality
const mockIssues = [
  {
    id: "val-001",
    fixture: "Toulouse vs La Rochelle",
    field: "Kick-off Time",
    severity: "high" as const,
    sources: [
      { name: "Official API", value: "21:05 CET" },
      { name: "Team Website", value: "21:00 CET" },
    ],
  },
  {
    id: "val-002",
    fixture: "Leinster vs Munster",
    field: "Venue Capacity",
    severity: "medium" as const,
    sources: [
      { name: "Stadium DB", value: "51,700" },
      { name: "Team Records", value: "51,900" },
    ],
  },
  {
    id: "val-003",
    fixture: "Racing 92 vs Stade Français",
    field: "Weather Forecast",
    severity: "low" as const,
    sources: [
      { name: "Weather API", value: "Rain, 12°C" },
      { name: "Local Service", value: "Light Rain, 13°C" },
    ],
  },
];

export default function Validation() {
  const [issues, setIssues] = useState(mockIssues);
  const { toast } = useToast();

  const handleResolve = (issueId: string, chosenSource: string) => {
    setIssues(issues.filter(i => i.id !== issueId));
    toast({
      title: "Conflict Resolved",
      description: `Used data from ${chosenSource}`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Validation Queue</h1>
        <p className="text-muted-foreground mt-1">
          Resolve data conflicts and discrepancies
        </p>
      </div>

      {issues.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No pending validation issues</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {issues.map((issue) => (
            <ValidationCard
              key={issue.id}
              issue={issue}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}
