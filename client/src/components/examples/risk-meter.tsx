import { RiskMeter } from "../risk-meter";

export default function RiskMeterExample() {
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RiskMeter title="Daily Exposure" current={120} limit={500} />
        <RiskMeter title="Top14 Exposure" current={380} limit={500} />
        <RiskMeter title="Weekly Stop-Loss" current={45} limit={50} />
      </div>
    </div>
  );
}
