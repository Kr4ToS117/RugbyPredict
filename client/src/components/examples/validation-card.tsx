import { ValidationCard } from "../validation-card";

export default function ValidationCardExample() {
  const issue = {
    id: "val-001",
    fixture: "Toulouse vs La Rochelle",
    field: "Kick-off Time",
    severity: "high" as const,
    sources: [
      { name: "Official API", value: "21:05 CET" },
      { name: "Team Website", value: "21:00 CET" },
    ],
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-2xl">
        <ValidationCard
          issue={issue}
          onResolve={(id, source) => console.log(`Resolved ${id} with ${source}`)}
        />
      </div>
    </div>
  );
}
