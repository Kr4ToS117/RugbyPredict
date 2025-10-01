import { KPICard } from "../kpi-card";

export default function KPICardExample() {
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="ROI" value="12.5" suffix="%" trend={3.2} />
        <KPICard title="Yield" value="8.3" suffix="%" trend={-1.5} />
        <KPICard title="Hit Rate" value="54.2" suffix="%" trend={2.1} />
        <KPICard title="Brier Score" value="0.184" />
      </div>
    </div>
  );
}
