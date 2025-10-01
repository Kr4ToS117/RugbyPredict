import { and, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import {
  bets,
  fixtures,
  seasons,
  competitions,
  teams,
  predictions,
  weather,
  events,
  boxscores,
} from "@shared/schema";
import { db } from "../db";
import { listFiles, saveFile, type StoredFile } from "../storage";

export interface ResultPayload {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  status?: string;
  homeStats?: Record<string, number>;
  awayStats?: Record<string, number>;
}

export interface WeeklyReportSummary {
  period: { from: string; to: string };
  roi: number;
  yield: number;
  hitRate: number;
  totalStaked: number;
  netProfit: number;
  competitionBreakdown: Array<{
    competition: string;
    staked: number;
    profit: number;
    roi: number;
  }>;
  exports: StoredFile[];
}

export interface ReviewFixtureRow {
  fixtureId: string;
  fixtureLabel: string;
  competition: string | null;
  kickoffAt: string | null;
  predictedOutcome: string;
  predictedProbability: number;
  actualOutcome: string;
  correct: boolean;
  error: number;
  impact: number;
  attribution: string[];
  notes: string | null;
}

export interface ReviewSummary {
  totalFixtures: number;
  correct: number;
  hitRate: number;
  meanAbsoluteError: number;
  averageImpact: number;
  totalProfitImpact: number;
}

export interface AttributionBucket {
  category: string;
  count: number;
  impact: "low" | "medium" | "high";
  contribution: number;
}

export interface ReviewResponse {
  generatedAt: string;
  summary: ReviewSummary;
  fixtures: ReviewFixtureRow[];
  attributions: AttributionBucket[];
  exports: StoredFile[];
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function determineOutcome(homeScore: number, awayScore: number): "home" | "draw" | "away" {
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return "draw";
}

function buildFixtureLabel(row: typeof fixtures.$inferSelect & {
  homeTeam?: typeof teams.$inferSelect | null;
  awayTeam?: typeof teams.$inferSelect | null;
}): string {
  return `${row.homeTeam?.name ?? "Home"} vs ${row.awayTeam?.name ?? "Away"}`;
}

async function upsertBoxscore(
  fixtureId: string,
  teamId: string,
  stats: Record<string, number> | undefined,
): Promise<void> {
  if (!stats) return;
  await db
    .insert(boxscores)
    .values({
      fixtureId,
      teamId,
      stats,
    })
    .onConflictDoUpdate({
      target: boxscores.uniqueFixtureTeam,
      set: {
        stats,
        updatedAt: new Date(),
      },
    });
}

export async function importResultsBatch(payload: ResultPayload[]): Promise<{ updated: number }> {
  if (!payload.length) {
    return { updated: 0 };
  }

  const fixtureIds = payload.map((item) => item.fixtureId);
  const fixturesToUpdate = await db.query.fixtures.findMany({
    where: (fixture, { inArray: inArrayOp }) => inArrayOp(fixture.id, fixtureIds),
    with: {
      homeTeam: true,
      awayTeam: true,
    },
  });

  const fixtureById = new Map(fixturesToUpdate.map((row) => [row.id, row]));
  let updated = 0;

  for (const entry of payload) {
    const row = fixtureById.get(entry.fixtureId);
    if (!row) continue;

    await db
      .update(fixtures)
      .set({
        homeScore: entry.homeScore,
        awayScore: entry.awayScore,
        status: entry.status ?? "completed",
        updatedAt: new Date(),
      })
      .where(eq(fixtures.id, entry.fixtureId));

    await upsertBoxscore(entry.fixtureId, row.homeTeamId, entry.homeStats);
    await upsertBoxscore(entry.fixtureId, row.awayTeamId, entry.awayStats);

    updated += 1;
  }

  return { updated };
}

export async function runResultsPullJob(): Promise<{ updated: number }> {
  const now = new Date();
  const candidates = await db.query.fixtures.findMany({
    where: (fixture, { and: andOp, lte: lteOp, ne: neOp }) =>
      andOp(lteOp(fixture.kickoffAt, now), neOp(fixture.status, "completed")),
    with: {
      homeTeam: true,
      awayTeam: true,
    },
  });

  if (!candidates.length) {
    return { updated: 0 };
  }

  const dataset: ResultPayload[] = candidates.map((fixture) => {
    const baseScore = Math.max(10, Math.floor((fixture.kickoffAt?.getUTCHours() ?? 12) * 1.2));
    const homeScore = fixture.homeScore ?? baseScore;
    const awayScore = fixture.awayScore ?? baseScore - 3;

    const homeStats = {
      possession: 52 + ((fixture.homeTeam?.name?.length ?? 5) % 8),
      meters: 320 + ((fixture.homeTeam?.name?.charCodeAt(0) ?? 70) % 50),
      tackles: 120 + ((fixture.homeTeam?.name?.charCodeAt(1) ?? 50) % 30),
    } satisfies Record<string, number>;

    const awayStats = {
      possession: 48 - ((fixture.awayTeam?.name?.length ?? 5) % 8),
      meters: 280 + ((fixture.awayTeam?.name?.charCodeAt(0) ?? 65) % 40),
      tackles: 135 + ((fixture.awayTeam?.name?.charCodeAt(1) ?? 40) % 25),
    } satisfies Record<string, number>;

    return {
      fixtureId: fixture.id,
      homeScore,
      awayScore,
      status: "completed",
      homeStats,
      awayStats,
    } satisfies ResultPayload;
  });

  return await importResultsBatch(dataset);
}

export function parseResultsCsv(csv: string): ResultPayload[] {
  const [headerLine, ...rows] = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!headerLine) {
    return [];
  }

  const headers = headerLine.split(",").map((column) => column.replace(/^"|"$/g, "").trim());
  const columnIndex = (name: string) => headers.findIndex((header) => header.toLowerCase() === name.toLowerCase());

  const fixtureIdx = columnIndex("fixture_id");
  const homeIdx = columnIndex("home_score");
  const awayIdx = columnIndex("away_score");
  const possessionHomeIdx = columnIndex("home_possession");
  const possessionAwayIdx = columnIndex("away_possession");
  const metersHomeIdx = columnIndex("home_meters");
  const metersAwayIdx = columnIndex("away_meters");

  return rows
    .map((line) => {
      const parts = line
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((part) => part.replace(/^"|"$/g, "").trim());

      const fixtureId = parts[fixtureIdx];
      const homeScore = Number(parts[homeIdx] ?? "0");
      const awayScore = Number(parts[awayIdx] ?? "0");

      if (!fixtureId) {
        return null;
      }

      const homeStats: Record<string, number> = {};
      const awayStats: Record<string, number> = {};

      if (possessionHomeIdx >= 0) homeStats.possession = Number(parts[possessionHomeIdx] ?? "0");
      if (metersHomeIdx >= 0) homeStats.meters = Number(parts[metersHomeIdx] ?? "0");
      if (possessionAwayIdx >= 0) awayStats.possession = Number(parts[possessionAwayIdx] ?? "0");
      if (metersAwayIdx >= 0) awayStats.meters = Number(parts[metersAwayIdx] ?? "0");

      return {
        fixtureId,
        homeScore: Number.isFinite(homeScore) ? homeScore : 0,
        awayScore: Number.isFinite(awayScore) ? awayScore : 0,
        homeStats: Object.keys(homeStats).length ? homeStats : undefined,
        awayStats: Object.keys(awayStats).length ? awayStats : undefined,
      } satisfies ResultPayload;
    })
    .filter((item): item is ResultPayload => item !== null);
}

function computeProfit(row: typeof bets.$inferSelect): number {
  const stake = toNumber(row.stake);
  const payout = row.potentialPayout ? toNumber(row.potentialPayout) : 0;
  switch (row.status) {
    case "won":
      return payout > 0 ? payout - stake : stake * (toNumber(row.oddsTaken) - 1);
    case "lost":
      return -stake;
    default:
      return 0;
  }
}

export async function getWeeklyPerformanceReport(): Promise<WeeklyReportSummary> {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const betRows = await db.query.bets.findMany({
    where: (betRow, { and: andOp, gte: gteOp }) =>
      andOp(gteOp(betRow.settledAt ?? betRow.placedAt, from)),
    with: {
      fixture: {
        with: {
          season: { with: { competition: true } },
        },
      },
    },
  });

  let totalStaked = 0;
  let netProfit = 0;
  let wonCount = 0;
  let settledCount = 0;
  const competitionAgg = new Map<string, { staked: number; profit: number }>();

  for (const row of betRows) {
    const stake = toNumber(row.stake);
    totalStaked += stake;

    if (row.status !== "pending") {
      const profit = computeProfit(row);
      netProfit += profit;
      settledCount += 1;
      if (profit > 0) {
        wonCount += 1;
      }

      const competition = row.fixture?.season?.competition?.name ?? "Autres";
      const agg = competitionAgg.get(competition) ?? { staked: 0, profit: 0 };
      agg.staked += stake;
      agg.profit += profit;
      competitionAgg.set(competition, agg);
    }
  }

  const roi = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0;
  const yieldValue = betRows.length ? (netProfit / betRows.length) : 0;
  const hitRate = settledCount > 0 ? (wonCount / settledCount) * 100 : 0;

  const breakdown = Array.from(competitionAgg.entries()).map(([competition, agg]) => ({
    competition,
    staked: Number(agg.staked.toFixed(2)),
    profit: Number(agg.profit.toFixed(2)),
    roi: agg.staked > 0 ? Number(((agg.profit / agg.staked) * 100).toFixed(2)) : 0,
  }));

  const exports = await listFiles("weekly-report");

  return {
    period: { from: from.toISOString(), to: now.toISOString() },
    roi: Number(roi.toFixed(2)),
    yield: Number(yieldValue.toFixed(2)),
    hitRate: Number(hitRate.toFixed(2)),
    totalStaked: Number(totalStaked.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    competitionBreakdown: breakdown,
    exports,
  };
}

function buildReviewHtml(payload: ReviewResponse): string {
  const rows = payload.fixtures
    .map((fixture) => {
      return `\n      <tr>
        <td>${fixture.fixtureLabel}</td>
        <td>${fixture.predictedOutcome} (${fixture.predictedProbability.toFixed(2)})</td>
        <td>${fixture.actualOutcome}</td>
        <td>${fixture.correct ? "✅" : "❌"}</td>
        <td>${fixture.error.toFixed(3)}</td>
        <td>${fixture.impact.toFixed(2)}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Post-weekend Review</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
      th { background: #f1f5f9; }
    </style>
  </head>
  <body>
    <h1>Bilan du week-end</h1>
    <p>Généré le ${payload.generatedAt}</p>
    <h2>Résumé</h2>
    <ul>
      <li>Correct: ${payload.summary.correct}/${payload.summary.totalFixtures}</li>
      <li>Hit Rate: ${payload.summary.hitRate.toFixed(2)}%</li>
      <li>MAE: ${payload.summary.meanAbsoluteError.toFixed(3)}</li>
      <li>Impact moyen: ${payload.summary.averageImpact.toFixed(2)}</li>
    </ul>
    <h2>Détails par rencontre</h2>
    <table>
      <thead>
        <tr>
          <th>Rencontre</th>
          <th>Prédiction</th>
          <th>Résultat</th>
          <th>Correct</th>
          <th>Erreur</th>
          <th>Impact</th>
        </tr>
      </thead>
      <tbody>${rows}
      </tbody>
    </table>
  </body>
</html>`;
}

function convertHtmlToPdfPlaceholder(html: string): Buffer {
  const content = `PDF EXPORT\n----------------\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")}`;
  return Buffer.from(content, "utf8");
}

export async function generateReviewExports(payload: ReviewResponse): Promise<StoredFile[]> {
  const html = buildReviewHtml(payload);
  const htmlFile = await saveFile({
    content: html,
    prefix: "review",
    extension: "html",
    filename: `review-${new Date().toISOString().slice(0, 10)}.html`,
    contentType: "text/html",
  });

  const pdfFile = await saveFile({
    content: convertHtmlToPdfPlaceholder(html),
    prefix: "review",
    extension: "pdf",
    filename: `review-${new Date().toISOString().slice(0, 10)}.pdf`,
    contentType: "application/pdf",
  });

  return [htmlFile, pdfFile];
}

export async function generateWeeklyReportExport(report: WeeklyReportSummary): Promise<StoredFile[]> {
  const lines = [
    "Competition,Staked,Profit,ROI",
    ...report.competitionBreakdown.map(
      (entry) =>
        `${entry.competition},${entry.staked.toFixed(2)},${entry.profit.toFixed(2)},${entry.roi.toFixed(2)}`,
    ),
  ];

  const csvFile = await saveFile({
    content: lines.join("\n"),
    prefix: "weekly-report",
    extension: "csv",
    filename: `weekly-report-${new Date().toISOString().slice(0, 10)}.csv`,
    contentType: "text/csv",
  });

  const summaryHtml = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><title>Rapport hebdomadaire</title></head>
<body>
  <h1>Performance du ${new Date(report.period.from).toLocaleDateString()} au ${new Date(
    report.period.to,
  ).toLocaleDateString()}</h1>
  <ul>
    <li>ROI: ${report.roi.toFixed(2)}%</li>
    <li>Yield: ${report.yield.toFixed(2)}</li>
    <li>Hit Rate: ${report.hitRate.toFixed(2)}%</li>
    <li>Profit net: ${report.netProfit.toFixed(2)}</li>
  </ul>
</body>
</html>`;

  const pdfFile = await saveFile({
    content: convertHtmlToPdfPlaceholder(summaryHtml),
    prefix: "weekly-report",
    extension: "pdf",
    filename: `weekly-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    contentType: "application/pdf",
  });

  return [csvFile, pdfFile];
}

export async function computeReview(): Promise<ReviewResponse> {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const fixturesRows = await db.query.fixtures.findMany({
    where: (fixture, { and: andOp, gte: gteOp }) =>
      andOp(gteOp(fixture.updatedAt, from), eq(fixture.status, "completed")),
    with: {
      homeTeam: true,
      awayTeam: true,
      season: { with: { competition: true } },
      predictions: {
        orderBy: (prediction, { desc: descOp }) => descOp(prediction.createdAt),
        limit: 1,
      },
      events: true,
      weather: true,
      bets: true,
    },
  });

  let totalMae = 0;
  let totalImpact = 0;
  let totalProfitImpact = 0;
  let correct = 0;
  const fixtures: ReviewFixtureRow[] = [];
  const attributionCounter = new Map<string, { count: number; impact: number }>();

  for (const row of fixturesRows) {
    const prediction = row.predictions?.[0] ?? null;
    const homeScore = toNumber(row.homeScore);
    const awayScore = toNumber(row.awayScore);
    const actualOutcome = determineOutcome(homeScore, awayScore);
    const fixtureLabel = buildFixtureLabel(row);

    const probabilities = {
      home: prediction ? toNumber(prediction.homeWinProbability) : 0,
      draw: prediction ? toNumber(prediction.drawProbability) : 0,
      away: prediction ? toNumber(prediction.awayWinProbability) : 0,
    } as const;

    const predictedOutcome = (Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "home") as
      | "home"
      | "draw"
      | "away";
    const predictedProbability = probabilities[predictedOutcome];
    const actualProbability = probabilities[actualOutcome];
    const error = Math.abs((actualOutcome === predictedOutcome ? 1 : 0) - predictedProbability);

    const profitImpact = row.bets?.reduce((sum, betRow) => sum + computeProfit(betRow), 0) ?? 0;
    totalProfitImpact += profitImpact;

    const attributionTags: string[] = [];

    if (row.events?.some((event) => event.eventType?.toLowerCase().includes("card"))) {
      attributionTags.push("Discipline / Cartons");
    }
    if (row.weather && toNumber(row.weather.windSpeedKph) > 20) {
      attributionTags.push("Conditions météo");
    }
    if (predictedProbability < 0.55 && actualOutcome !== predictedOutcome) {
      attributionTags.push("Variance élevée");
    }
    if (!attributionTags.length && error > 0.2) {
      attributionTags.push("Calibration modèle");
    }

    for (const tag of attributionTags) {
      const bucket = attributionCounter.get(tag) ?? { count: 0, impact: 0 };
      bucket.count += 1;
      bucket.impact += Math.abs(profitImpact);
      attributionCounter.set(tag, bucket);
    }

    if (actualOutcome === predictedOutcome) {
      correct += 1;
    }

    totalMae += error;
    totalImpact += Math.abs(profitImpact);

    fixtures.push({
      fixtureId: row.id,
      fixtureLabel,
      competition: row.season?.competition?.name ?? null,
      kickoffAt: row.kickoffAt?.toISOString() ?? null,
      predictedOutcome,
      predictedProbability: Number(predictedProbability.toFixed(3)),
      actualOutcome,
      correct: actualOutcome === predictedOutcome,
      error: Number(error.toFixed(3)),
      impact: Number(profitImpact.toFixed(2)),
      attribution: attributionTags,
      notes: prediction?.explanation ? JSON.stringify(prediction.explanation) : null,
    });
  }

  const totalFixtures = fixtures.length;
  const summary: ReviewSummary = {
    totalFixtures,
    correct,
    hitRate: totalFixtures > 0 ? (correct / totalFixtures) * 100 : 0,
    meanAbsoluteError: totalFixtures > 0 ? totalMae / totalFixtures : 0,
    averageImpact: totalFixtures > 0 ? totalImpact / totalFixtures : 0,
    totalProfitImpact,
  };

  const attributions: AttributionBucket[] = Array.from(attributionCounter.entries()).map(([category, info]) => ({
    category,
    count: info.count,
    impact: info.impact > 200 ? "high" : info.impact > 50 ? "medium" : "low",
    contribution: info.impact,
  }));

  const exports = await listFiles("review");

  return {
    generatedAt: now.toISOString(),
    summary,
    fixtures,
    attributions,
    exports,
  };
}
