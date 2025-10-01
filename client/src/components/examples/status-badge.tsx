import { StatusBadge } from "../status-badge";

export default function StatusBadgeExample() {
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex flex-wrap gap-3">
        <StatusBadge status="Success" variant="success" />
        <StatusBadge status="Warning" variant="warning" />
        <StatusBadge status="Error" variant="error" />
        <StatusBadge status="Info" variant="info" />
        <StatusBadge status="Pending" variant="default" />
      </div>
    </div>
  );
}
