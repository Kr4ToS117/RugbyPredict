import { RiskMeter } from "@/components/risk-meter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";
import { KPICard } from "@/components/kpi-card";

//todo: remove mock functionality
const bets = [
  { id: 1, fixture: "Toulouse vs La Rochelle", market: "Home Win", stake: 52, odds: 1.85, status: "pending" },
  { id: 2, fixture: "Leinster vs Munster", market: "Home Win", stake: 38, odds: 1.50, status: "won", pnl: 19 },
  { id: 3, fixture: "Racing 92 vs Stade Français", market: "Draw", stake: 25, odds: 3.20, status: "lost", pnl: -25 },
];

export default function Bankroll() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Bankroll & Bets</h1>
          <p className="text-muted-foreground mt-1">
            Manage your betting bankroll and track performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button data-testid="button-add-bet">
            <Plus className="h-4 w-4 mr-2" />
            Add Bet
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Total Bankroll" value="985" suffix="€" trend={2.3} />
        <KPICard title="Active Bets" value="3" />
        <KPICard title="This Week ROI" value="4.2" suffix="%" trend={1.8} />
        <KPICard title="Win Rate" value="58.3" suffix="%" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RiskMeter title="Daily Exposure" current={120} limit={500} />
        <RiskMeter title="Top14 Exposure" current={380} limit={500} />
        <RiskMeter title="Weekly Stop-Loss" current={45} limit={50} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Bets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-sm text-muted-foreground">
                  <th className="text-left py-3 px-4">Fixture</th>
                  <th className="text-left py-3 px-4">Market</th>
                  <th className="text-right py-3 px-4">Stake</th>
                  <th className="text-right py-3 px-4">Odds</th>
                  <th className="text-center py-3 px-4">Status</th>
                  <th className="text-right py-3 px-4">P&L</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => (
                  <tr
                    key={bet.id}
                    className="border-b border-border hover-elevate"
                  >
                    <td className="py-3 px-4">{bet.fixture}</td>
                    <td className="py-3 px-4 text-muted-foreground">{bet.market}</td>
                    <td className="py-3 px-4 text-right font-mono">€{bet.stake}</td>
                    <td className="py-3 px-4 text-right font-mono">{bet.odds.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs ${
                          bet.status === "won"
                            ? "bg-chart-2/10 text-chart-2"
                            : bet.status === "lost"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {bet.status}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-medium ${
                        bet.pnl && bet.pnl > 0
                          ? "text-chart-2"
                          : bet.pnl && bet.pnl < 0
                          ? "text-destructive"
                          : ""
                      }`}
                    >
                      {bet.pnl !== undefined
                        ? `${bet.pnl > 0 ? "+" : ""}€${bet.pnl}`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
