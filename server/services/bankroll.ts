import { desc, eq } from "drizzle-orm";
import {
  bets,
  fixtures,
  predictions,
  seasons,
  competitions,
  teams,
  users,
  type Bet,
} from "@shared/schema";
import { db } from "../db";
import { listFiles, saveFile, type StoredFile } from "../storage";
import { createTraceLogger, fixtureLogger } from "../logging";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return 0;
}

interface BetWithContext extends Bet {
  fixture?: typeof fixtures.$inferSelect & {
    season?: typeof seasons.$inferSelect & { competition?: typeof competitions.$inferSelect | null } | null;
    homeTeam?: typeof teams.$inferSelect | null;
    awayTeam?: typeof teams.$inferSelect | null;
  } | null;
  prediction?: typeof predictions.$inferSelect | null;
}

export interface RiskExposure {
  id: string;
  type: "competition" | "team" | "stop_loss";
  label: string;
  exposure: number;
  limit: number;
  breaching: boolean;
}

export interface BankrollSegment {
  key: string;
  label: string;
  category: "competition" | "bet_type";
  stakes: number;
  profit: number;
  roi: number;
  yield: number;
  sample: number;
}

export interface StakeRecommendation {
  strategy: "kelly_fractional" | "fixed_percentage" | "flat";
  percentage: number;
  amount: number;
  label: string;
}

export interface BankrollHistoryPoint {
  date: string;
  bankroll: number;
}

export interface BankrollSummaryResponse {
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
  segments: BankrollSegment[];
  exposures: RiskExposure[];
  recommendations: StakeRecommendation[];
  history: BankrollHistoryPoint[];
  exports: StoredFile[];
}

export interface BetView {
  id: string;
  fixtureId: string;
  fixtureLabel: string;
  competition: string | null;
  kickoffAt: string | null;
  betType: string;
  selection: string;
  oddsTaken: number;
  stake: number;
  potentialPayout: number | null;
  status: string;
  placedAt: string;
  settledAt: string | null;
  notes: string | null;
}

export interface CreateBetInput {
  userId?: string;
  fixtureId: string;
  predictionId?: string | null;
  betType: string;
  selection: string;
  oddsTaken: number;
  stake: number;
  potentialPayout?: number | null;
  status?: string;
  placedAt?: string;
  settledAt?: string | null;
  notes?: string | null;
}

export type UpdateBetInput = Partial<Omit<CreateBetInput, "fixtureId">> & { id: string };

const STARTING_BANKROLL = Number(process.env.STARTING_BANKROLL ?? 1_000);
const LEAGUE_EXPOSURE_LIMIT = Number(process.env.LEAGUE_EXPOSURE_LIMIT ?? 0.3);
const TEAM_EXPOSURE_LIMIT = Number(process.env.TEAM_EXPOSURE_LIMIT ?? 0.15);
const WEEKLY_STOP_LOSS = Number(process.env.WEEKLY_STOP_LOSS ?? 0.1);
const FIXED_PERCENT_STAKE = Number(process.env.FIXED_PERCENT_STAKE ?? 0.02);
const FLAT_STAKE_AMOUNT = Number(process.env.FLAT_STAKE_AMOUNT ?? 25);
const KELLY_FRACTION = Number(process.env.KELLY_FRACTION ?? 0.5);

function computeProfit(row: BetWithContext): number {
  const stake = toNumber(row.stake);
  const payout = row.potentialPayout ? toNumber(row.potentialPayout) : 0;
  switch (row.status) {
    case "won":
      return payout > 0 ? payout - stake : stake * (toNumber(row.oddsTaken) - 1);
    case "lost":
      return -stake;
    case "void":
    case "cancelled":
      return 0;
    default:
      return 0;
  }
}

function getOutcomeProbability(bet: BetWithContext): number | null {
  const prediction = bet.prediction;
  if (!prediction) {
    return null;
  }

  const selection = bet.selection.toLowerCase();
  const home = toNumber(prediction.homeWinProbability);
  const draw = toNumber(prediction.drawProbability);
  const away = toNumber(prediction.awayWinProbability);

  if (bet.fixture) {
    if (bet.fixture.homeTeam?.name && selection.includes(bet.fixture.homeTeam.name.toLowerCase())) {
      return home;
    }
    if (bet.fixture.awayTeam?.name && selection.includes(bet.fixture.awayTeam.name.toLowerCase())) {
      return away;
    }
  }

  if (selection.includes("draw") || selection.includes("nul")) {
    return draw;
  }

  const highest = Math.max(home, draw, away);
  return Number.isFinite(highest) ? highest : null;
}

function computeKellyStake(probability: number, odds: number): number {
  if (!Number.isFinite(probability) || !Number.isFinite(odds) || odds <= 1) {
    return 0;
  }

  const b = odds - 1;
  const edge = probability * odds - (1 - probability);
  const fraction = edge / b;
  if (!Number.isFinite(fraction)) {
    return 0;
  }
  return Math.max(0, fraction);
}

function buildBetView(row: BetWithContext): BetView {
  const stake = toNumber(row.stake);
  const odds = toNumber(row.oddsTaken);
  const payout = row.potentialPayout ? toNumber(row.potentialPayout) : null;
  const competition = row.fixture?.season?.competition?.name ?? null;
  const fixtureLabel = row.fixture
    ? `${row.fixture.homeTeam?.name ?? "Home"} vs ${row.fixture.awayTeam?.name ?? "Away"}`
    : "Unknown fixture";

  const view: BetView = {
    id: row.id,
    fixtureId: row.fixtureId,
    fixtureLabel,
    competition,
    kickoffAt: row.fixture?.kickoffAt?.toISOString() ?? null,
    betType: row.betType,
    selection: row.selection,
    oddsTaken: odds,
    stake,
    potentialPayout: payout,
    status: row.status,
    placedAt: row.placedAt?.toISOString() ?? new Date().toISOString(),
    settledAt: row.settledAt?.toISOString() ?? null,
    notes: row.notes ?? null,
  };

  fixtureLogger(row.fixtureId, "bankroll").debug("Bet view computed", {
    betId: row.id,
    status: row.status,
    stake,
  });

  return view;
}

async function fetchBets(): Promise<BetWithContext[]> {
  const rows = await db.query.bets.findMany({
    with: {
      fixture: {
        with: {
          season: { with: { competition: true } },
          homeTeam: true,
          awayTeam: true,
        },
      },
      prediction: true,
    },
    orderBy: (betRow, { desc: descOp }) => descOp(betRow.placedAt),
  });
  return rows;
}

export async function listBetViews(): Promise<{ bets: BetView[] }> {
  const rows = await fetchBets();
  const views = rows.map(buildBetView);
  return { bets: views };
}

export async function getBankrollSummary(): Promise<BankrollSummaryResponse> {
  const rows = await fetchBets();
  const span = createTraceLogger("bankroll", {});
  span.info("Computing bankroll summary", { totalBets: rows.length });
  const starting = STARTING_BANKROLL;

  let totalStaked = 0;
  let netProfit = 0;
  let settledCount = 0;
  let wonCount = 0;
  let pendingExposure = 0;

  const segments = new Map<string, BankrollSegment>();
  const addSegment = (
    key: string,
    label: string,
    category: BankrollSegment["category"],
    stake: number,
    profit: number,
    sampleIncrement = 1,
  ) => {
    const existing = segments.get(key) ?? {
      key,
      label,
      category,
      stakes: 0,
      profit: 0,
      roi: 0,
      yield: 0,
      sample: 0,
    };

    existing.stakes += stake;
    existing.profit += profit;
    existing.sample += sampleIncrement;
    existing.roi = existing.stakes > 0 ? (existing.profit / existing.stakes) * 100 : 0;
    existing.yield = starting > 0 ? (existing.profit / starting) * 100 : 0;
    segments.set(key, existing);
  };

  const competitionExposure = new Map<string, { label: string; stake: number }>();
  const teamExposure = new Map<string, { label: string; stake: number }>();

  const settledHistory: Array<{ at: Date; delta: number }> = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let weeklyLoss = 0;

  for (const row of rows) {
    const stake = toNumber(row.stake);
    totalStaked += stake;

    const competitionLabel = row.fixture?.season?.competition?.name ?? "Autres compétitions";
    addSegment(`competition:${competitionLabel}`, competitionLabel, "competition", stake, 0, 0);
    addSegment(`betType:${row.betType}`, row.betType, "bet_type", stake, 0, 0);

    if (row.status === "pending") {
      pendingExposure += stake;
      const compEntry = competitionExposure.get(competitionLabel) ?? {
        label: competitionLabel,
        stake: 0,
      };
      compEntry.stake += stake;
      competitionExposure.set(competitionLabel, compEntry);

      const selection = row.selection.toLowerCase();
      if (row.fixture?.homeTeam?.name && selection.includes(row.fixture.homeTeam.name.toLowerCase())) {
        const entry = teamExposure.get(row.fixture.homeTeam.id) ?? {
          label: row.fixture.homeTeam.name,
          stake: 0,
        };
        entry.stake += stake;
        teamExposure.set(row.fixture.homeTeam.id, entry);
      }
      if (row.fixture?.awayTeam?.name && selection.includes(row.fixture.awayTeam.name.toLowerCase())) {
        const entry = teamExposure.get(row.fixture.awayTeam.id) ?? {
          label: row.fixture.awayTeam.name,
          stake: 0,
        };
        entry.stake += stake;
        teamExposure.set(row.fixture.awayTeam.id, entry);
      }
      continue;
    }

    const profit = computeProfit(row);
    netProfit += profit;
    settledCount += 1;
    if (profit > 0) {
      wonCount += 1;
    }

    settledHistory.push({ at: row.settledAt ?? row.placedAt ?? new Date(), delta: profit });

    addSegment(`competition:${competitionLabel}`, competitionLabel, "competition", stake, profit);
    addSegment(`betType:${row.betType}`, row.betType, "bet_type", stake, profit);

    if ((row.settledAt ?? row.placedAt ?? new Date()) >= sevenDaysAgo && profit < 0) {
      weeklyLoss += Math.abs(profit);
    }
  }

  const current = starting + netProfit;
  const available = current - pendingExposure;
  const roi = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0;
  const yieldValue = starting > 0 ? ((current - starting) / starting) * 100 : 0;
  const hitRate = settledCount > 0 ? (wonCount / settledCount) * 100 : 0;

  settledHistory.sort((a, b) => a.at.getTime() - b.at.getTime());
  let running = starting;
  const history: BankrollHistoryPoint[] = settledHistory.map((entry) => {
    running += entry.delta;
    return {
      date: entry.at.toISOString(),
      bankroll: Number(running.toFixed(2)),
    };
  });

  const exposures: RiskExposure[] = [];
  const leagueLimit = current * LEAGUE_EXPOSURE_LIMIT;
  const teamLimit = current * TEAM_EXPOSURE_LIMIT;
  const stopLossLimit = current * WEEKLY_STOP_LOSS;

  for (const [label, info] of Array.from(competitionExposure.entries())) {
    exposures.push({
      id: `competition:${label}`,
      type: "competition",
      label: info.label,
      exposure: Number(info.stake.toFixed(2)),
      limit: Number(leagueLimit.toFixed(2)),
      breaching: info.stake > leagueLimit,
    });
  }

  for (const [teamId, info] of Array.from(teamExposure.entries())) {
    exposures.push({
      id: `team:${teamId}`,
      type: "team",
      label: info.label,
      exposure: Number(info.stake.toFixed(2)),
      limit: Number(teamLimit.toFixed(2)),
      breaching: info.stake > teamLimit,
    });
  }

  exposures.push({
    id: "stop_loss:weekly",
    type: "stop_loss",
    label: "Stop-loss hebdomadaire",
    exposure: Number(weeklyLoss.toFixed(2)),
    limit: Number(stopLossLimit.toFixed(2)),
    breaching: weeklyLoss > stopLossLimit,
  });

  const pendingWithPredictions = rows.filter((row) => row.status === "pending");
  let avgProbability = 0;
  let avgOdds = 0;
  if (pendingWithPredictions.length > 0) {
    let probabilitySum = 0;
    let oddsSum = 0;
    let count = 0;
    for (const bet of pendingWithPredictions) {
      const probability = getOutcomeProbability(bet);
      const odds = toNumber(bet.oddsTaken);
      if (probability && probability > 0) {
        probabilitySum += probability;
        oddsSum += odds;
        count += 1;
      }
    }
    if (count > 0) {
      avgProbability = probabilitySum / count;
      avgOdds = oddsSum / count;
    }
  }

  if (avgProbability <= 0) {
    avgProbability = 0.55;
  }
  if (avgOdds <= 0) {
    avgOdds = 1.9;
  }

  const kellyFraction = computeKellyStake(avgProbability, avgOdds) * KELLY_FRACTION;
  const recommendations: StakeRecommendation[] = [
    {
      strategy: "kelly_fractional",
      percentage: Number((kellyFraction * 100).toFixed(2)),
      amount: Number((current * kellyFraction).toFixed(2)),
      label: `${Math.round(KELLY_FRACTION * 100)}% Kelly`,
    },
    {
      strategy: "fixed_percentage",
      percentage: Number((FIXED_PERCENT_STAKE * 100).toFixed(2)),
      amount: Number((current * FIXED_PERCENT_STAKE).toFixed(2)),
      label: `${Math.round(FIXED_PERCENT_STAKE * 1000) / 10}% fixe`,
    },
    {
      strategy: "flat",
      percentage: Number(((FLAT_STAKE_AMOUNT / current) * 100).toFixed(2)),
      amount: Number(FLAT_STAKE_AMOUNT.toFixed(2)),
      label: "Flat stake",
    },
  ];

  const exports = await listFiles("bankroll");

  const summary: BankrollSummaryResponse = {
    bankroll: {
      starting,
      current: Number(current.toFixed(2)),
      available: Number(available.toFixed(2)),
      totalStaked: Number(totalStaked.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      roi: Number(roi.toFixed(2)),
      yield: Number(yieldValue.toFixed(2)),
      hitRate: Number(hitRate.toFixed(2)),
      activeBets: pendingWithPredictions.length,
      settledBets: settledCount,
      pendingExposure: Number(pendingExposure.toFixed(2)),
      weeklyStopLossUsed: Number(weeklyLoss.toFixed(2)),
    },
    segments: Array.from(segments.values()).sort((a, b) => b.profit - a.profit),
    exposures,
    recommendations,
    history,
    exports,
  };

  span.info("Bankroll summary computed", {
    current: summary.bankroll.current,
    roi: summary.bankroll.roi,
    exposures: summary.exposures.length,
  });

  return summary;
}

async function resolveDefaultUserId(): Promise<string> {
  const [row] = await db.select({ id: users.id }).from(users).limit(1);
  if (row?.id) {
    return row.id;
  }
  throw new Error("No default user configured");
}

export async function createBet(input: CreateBetInput): Promise<BetView> {
  const userId = input.userId ?? (await resolveDefaultUserId());
  const [inserted] = await db
    .insert(bets)
    .values({
      userId,
      fixtureId: input.fixtureId,
      predictionId: input.predictionId ?? null,
      betType: input.betType,
      selection: input.selection,
      oddsTaken: input.oddsTaken.toString(),
      stake: input.stake.toString(),
      potentialPayout: input.potentialPayout ? input.potentialPayout.toString() : null,
      status: input.status ?? "pending",
      placedAt: input.placedAt ? new Date(input.placedAt) : new Date(),
      settledAt: input.settledAt ? new Date(input.settledAt) : null,
      notes: input.notes ?? null,
    })
    .returning();

  const [row] = await db.query.bets.findMany({
    where: (betRow, { eq: eqOp }) => eqOp(betRow.id, inserted.id),
    with: {
      fixture: {
        with: {
          season: { with: { competition: true } },
          homeTeam: true,
          awayTeam: true,
        },
      },
      prediction: true,
    },
    limit: 1,
  });

  if (!row) {
    throw new Error("Bet creation failed");
  }

  return buildBetView(row);
}

export async function updateBet(input: UpdateBetInput): Promise<BetView> {
  const values: Partial<typeof bets.$inferInsert> = {};
  if (input.predictionId !== undefined) values.predictionId = input.predictionId;
  if (input.betType !== undefined) values.betType = input.betType;
  if (input.selection !== undefined) values.selection = input.selection;
  if (input.oddsTaken !== undefined) values.oddsTaken = input.oddsTaken.toString();
  if (input.stake !== undefined) values.stake = input.stake.toString();
  if (input.potentialPayout !== undefined)
    values.potentialPayout = input.potentialPayout !== null ? input.potentialPayout.toString() : null;
  if (input.status !== undefined) values.status = input.status;
  if (input.placedAt !== undefined) values.placedAt = input.placedAt ? new Date(input.placedAt) : new Date();
  if (input.settledAt !== undefined) values.settledAt = input.settledAt ? new Date(input.settledAt) : null;
  if (input.notes !== undefined) values.notes = input.notes;

  await db.update(bets).set(values).where(eq(bets.id, input.id));

  const [row] = await db.query.bets.findMany({
    where: (betRow, { eq: eqOp }) => eqOp(betRow.id, input.id),
    with: {
      fixture: {
        with: {
          season: { with: { competition: true } },
          homeTeam: true,
          awayTeam: true,
        },
      },
      prediction: true,
    },
    limit: 1,
  });

  if (!row) {
    throw new Error("Bet update failed");
  }

  return buildBetView(row);
}

export async function deleteBet(id: string): Promise<void> {
  await db.delete(bets).where(eq(bets.id, id));
}

export async function importBets(batch: CreateBetInput[]): Promise<{ inserted: number }> {
  let inserted = 0;
  for (const payload of batch) {
    await createBet(payload);
    inserted += 1;
  }
  return { inserted };
}

function serializeBetsToCsv(rows: BetView[]): string {
  const header = [
    "id",
    "fixture",
    "competition",
    "bet_type",
    "selection",
    "odds",
    "stake",
    "potential_payout",
    "status",
    "placed_at",
    "settled_at",
  ];

  const lines = rows.map((row) =>
    [
      row.id,
      row.fixtureLabel,
      row.competition ?? "",
      row.betType,
      row.selection,
      row.oddsTaken.toFixed(2),
      row.stake.toFixed(2),
      row.potentialPayout?.toFixed(2) ?? "",
      row.status,
      row.placedAt,
      row.settledAt ?? "",
    ]
      .map((value) => `"${value.replace(/"/g, '""')}"`)
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

export async function generateBankrollExport(): Promise<StoredFile> {
  const { bets: rows } = await listBetViews();
  const csv = serializeBetsToCsv(rows);
  return await saveFile({
    content: csv,
    prefix: "bankroll",
    extension: "csv",
    filename: `bankroll-${new Date().toISOString().slice(0, 10)}.csv`,
    contentType: "text/csv",
  });
}

export const __testing = {
  toNumber,
  computeProfit,
  computeKellyStake,
  getOutcomeProbability,
  buildBetView,
};
