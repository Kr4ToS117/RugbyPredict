import { useRef } from "react";
import type { ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RiskMeter } from "@/components/risk-meter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Plus, Upload } from "lucide-react";
import { KPICard } from "@/components/kpi-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface StoredFile {
  key: string;
  filename: string;
  url: string;
  createdAt: string;
}

interface StakeRecommendation {
  strategy: "kelly_fractional" | "fixed_percentage" | "flat";
  percentage: number;
  amount: number;
  label: string;
}

interface RiskExposure {
  id: string;
  type: "competition" | "team" | "stop_loss";
  label: string;
  exposure: number;
  limit: number;
  breaching: boolean;
}

interface BankrollSummaryResponse {
  bankroll: {
    starting: number;
    current: number;
    available: number;
    totalStaked: number;
    netProfit: number;
    roi: number;
    yield: number;
    hitRate: number;
    activeBets: number;
    settledBets: number;
    pendingExposure: number;
    weeklyStopLossUsed: number;
  };
  recommendations: StakeRecommendation[];
  exposures: RiskExposure[];
  exports: StoredFile[];
}

interface BetView {
  id: string;
  fixtureLabel: string;
  betType: string;
  selection: string;
  stake: number;
  oddsTaken: number;
  potentialPayout: number | null;
  status: string;
}

interface BetsResponse {
  bets: BetView[];
}

function parseBetsCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const headers = lines[0]
    .split(",")
    .map((header) => header.replace(/^"|"$/g, "").trim().toLowerCase());

  const indexOf = (name: string) => headers.findIndex((header) => header === name);
  const fixtureIdx = indexOf("fixture_id");
  const betTypeIdx = indexOf("bet_type");
  const selectionIdx = indexOf("selection");
  const oddsIdx = indexOf("odds");
  const stakeIdx = indexOf("stake");
  const payoutIdx = indexOf("potential_payout");
  const statusIdx = indexOf("status");

  return lines.slice(1).map((line) => {
    const columns = line
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((value) => value.replace(/^"|"$/g, "").trim());

    return {
      fixtureId: columns[fixtureIdx] ?? "",
      betType: columns[betTypeIdx] ?? "match_winner",
      selection: columns[selectionIdx] ?? "",
      oddsTaken: Number(columns[oddsIdx] ?? "0"),
      stake: Number(columns[stakeIdx] ?? "0"),
      potentialPayout: columns[payoutIdx] ? Number(columns[payoutIdx]) : null,
      status: columns[statusIdx] ?? "pending",
    };
  });
}

function computeProfit(bet: BetView): number | null {
  if (bet.status === "pending") return null;
  if (bet.status === "lost") return -bet.stake;
  if (bet.status === "won") {
    const payout = bet.potentialPayout ?? bet.stake * bet.oddsTaken;
    return payout - bet.stake;
  }
  return 0;
}

export default function Bankroll() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: summary } = useQuery<BankrollSummaryResponse>({
    queryKey: ["/api/bankroll/summary"],
  });

  const { data: betsData } = useQuery<BetsResponse>({ queryKey: ["/api/bets"] });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bankroll/export");
      return (await res.json()) as { file: StoredFile };
    },
    onSuccess: async () => {
      toast({ title: "Export généré", description: "Le CSV est disponible dans la liste des exports." });
      await queryClient.invalidateQueries({ queryKey: ["/api/bankroll/summary"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Export impossible",
        description: error instanceof Error ? error.message : "Erreur inattendue",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (payload: { bets: Array<Record<string, unknown>> }) => {
      await apiRequest("POST", "/api/bets", payload);
    },
    onSuccess: async () => {
      toast({ title: "Import réussi", description: "Les paris ont été ajoutés à la bankroll." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/bets"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/bankroll/summary"] }),
      ]);
    },
    onError: (error: unknown) => {
      toast({
        title: "Import impossible",
        description: error instanceof Error ? error.message : "Format de fichier non supporté",
        variant: "destructive",
      });
    },
  });

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseBetsCsv(text).filter((row) => row.fixtureId);
    if (!parsed.length) {
      toast({ title: "Import vide", description: "Aucune ligne valide détectée", variant: "destructive" });
      return;
    }

    importMutation.mutate({ bets: parsed });
    event.target.value = "";
  };

  const bets = betsData?.bets ?? [];
  const exposures = summary?.exposures ?? [];
  const competitionExposure = exposures.find((exposure) => exposure.type === "competition");
  const teamExposure = exposures.find((exposure) => exposure.type === "team");
  const stopLoss = exposures.find((exposure) => exposure.type === "stop_loss");

  const recommendations = summary?.recommendations ?? [];

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
          <Button
            variant="outline"
            data-testid="button-export"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" data-testid="button-import" onClick={handleImportClick}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button data-testid="button-add-bet" disabled>
            <Plus className="h-4 w-4 mr-2" />
            Add Bet
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Bankroll"
          value={(summary?.bankroll.current ?? 0).toFixed(2)}
          suffix="€"
          trend={summary ? summary.bankroll.netProfit : undefined}
        />
        <KPICard
          title="Exposure"
          value={(summary?.bankroll.pendingExposure ?? 0).toFixed(2)}
          suffix="€"
        />
        <KPICard
          title="ROI"
          value={(summary?.bankroll.roi ?? 0).toFixed(2)}
          suffix="%"
        />
        <KPICard
          title="Hit Rate"
          value={(summary?.bankroll.hitRate ?? 0).toFixed(2)}
          suffix="%"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {competitionExposure ? (
          <RiskMeter
            title={`Exposure ${competitionExposure.label}`}
            current={Math.round(competitionExposure.exposure)}
            limit={Math.round(competitionExposure.limit)}
          />
        ) : null}
        {teamExposure ? (
          <RiskMeter
            title={`Exposure ${teamExposure.label}`}
            current={Math.round(teamExposure.exposure)}
            limit={Math.round(teamExposure.limit)}
          />
        ) : null}
        {stopLoss ? (
          <RiskMeter
            title="Weekly Stop-Loss"
            current={Math.round(stopLoss.exposure)}
            limit={Math.round(stopLoss.limit)}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Staking Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.length ? (
              recommendations.map((item) => (
                <div key={item.strategy} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.percentage.toFixed(2)}% de la bankroll</p>
                  </div>
                  <span className="font-mono font-semibold">€{item.amount.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Aucune recommandation disponible.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Derniers exports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary?.exports?.length ? (
              summary.exports.map((file) => (
                <a
                  key={file.key}
                  href={file.url}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
                >
                  <span>{file.filename}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(file.createdAt).toLocaleString()}
                  </span>
                </a>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Pas encore d'export généré.</p>
            )}
          </CardContent>
        </Card>
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
                {bets.map((bet) => {
                  const profit = computeProfit(bet);
                  return (
                  <tr
                    key={bet.id}
                    className="border-b border-border hover-elevate"
                  >
                    <td className="py-3 px-4">{bet.fixtureLabel}</td>
                    <td className="py-3 px-4 text-muted-foreground">{bet.betType}</td>
                    <td className="py-3 px-4 text-right font-mono">€{bet.stake.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono">{bet.oddsTaken.toFixed(2)}</td>
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
                        profit && profit > 0
                          ? "text-chart-2"
                          : profit && profit < 0
                          ? "text-destructive"
                          : ""
                      }`}
                    >
                      {profit === null ? "-" : `${profit > 0 ? "+" : ""}€${Math.abs(profit).toFixed(2)}`}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <input
        type="file"
        accept=".csv,text/csv"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
