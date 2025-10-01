import { ConnectorStatus } from "../connector-status";

export default function ConnectorStatusExample() {
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ConnectorStatus
          name="Top14 API"
          status="success"
          lastRun="2 min ago"
          duration="1.2s"
          successRate={98.5}
        />
        <ConnectorStatus
          name="Weather API"
          status="running"
          lastRun="Just now"
          duration="0.8s"
          successRate={100}
        />
        <ConnectorStatus
          name="Odds Provider"
          status="error"
          lastRun="5 min ago"
          duration="timeout"
          successRate={85.2}
        />
      </div>
    </div>
  );
}
