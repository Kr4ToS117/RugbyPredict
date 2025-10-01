import { desc, eq } from "drizzle-orm";
import { etlJobRuns, validationFlags } from "@shared/schema";
import { db } from "../db";
import { getRecentTraces, getFixtureTraces, type TraceEvent } from "../logging";

export interface ObservabilityDashboard {
  traces: TraceEvent[];
  etl: Array<{
    id: string;
    connector: string;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    durationMs: number | null;
  }>;
  validation: Array<{
    id: string;
    level: string;
    reason: string;
    createdAt: string;
    fixtureId?: string | null;
  }>;
}

export interface FixtureTraceDetails {
  fixture: {
    id: string;
    label: string;
    kickoffAt: string | null;
    competition: string | null;
    status: string | null;
  } | null;
  bets: Array<{
    id: string;
    status: string;
    stake: number;
    selection: string;
    placedAt: string;
  }>;
  predictions: Array<{
    id: string;
    model: string | null;
    version: string | null;
    createdAt: string;
  }>;
  validations: ObservabilityDashboard["validation"];
  traces: TraceEvent[];
}

function normalizeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function getObservabilityDashboard(limit = 25): Promise<ObservabilityDashboard> {
  const [runs, flags] = await Promise.all([
    db
      .select({
        id: etlJobRuns.id,
        connector: etlJobRuns.connectorName,
        status: etlJobRuns.status,
        startedAt: etlJobRuns.startedAt,
        finishedAt: etlJobRuns.finishedAt,
        durationMs: etlJobRuns.durationMs,
      })
      .from(etlJobRuns)
      .orderBy(desc(etlJobRuns.startedAt))
      .limit(10),
    db
      .select()
      .from(validationFlags)
      .orderBy(desc(validationFlags.createdAt))
      .limit(limit),
  ]);

  const validation = flags.map((row) => {
    const details = (row.details as { fixtureId?: string | null } | null) ?? null;
    return {
      id: row.id,
      level: row.level ?? "info",
      reason: row.reason,
      createdAt: normalizeDate(row.createdAt) ?? new Date().toISOString(),
      fixtureId: details?.fixtureId ?? null,
    };
  });

  const etl = runs.map((run) => ({
    id: run.id,
    connector: run.connector ?? "unknown",
    status: run.status ?? "unknown",
    startedAt: normalizeDate(run.startedAt),
    finishedAt: normalizeDate(run.finishedAt),
    durationMs: run.durationMs ?? null,
  }));

  return {
    traces: getRecentTraces(limit),
    etl,
    validation,
  };
}

export async function getFixtureTraceDetails(fixtureId: string): Promise<FixtureTraceDetails> {
  const [fixture] = await db.query.fixtures.findMany({
    where: (fixtureTable, { eq: eqOp }) => eqOp(fixtureTable.id, fixtureId),
    with: {
      season: { with: { competition: true } },
      homeTeam: true,
      awayTeam: true,
    },
    limit: 1,
  });

  const betsRows = await db.query.bets.findMany({
    where: (bet, { eq: eqOp }) => eqOp(bet.fixtureId, fixtureId),
    orderBy: (bet, { desc: descOp }) => descOp(bet.placedAt),
    limit: 25,
  });

  const predictionRows = await db.query.predictions.findMany({
    where: (prediction, { eq: eqOp }) => eqOp(prediction.fixtureId, fixtureId),
    with: { model: true },
    orderBy: (prediction, { desc: descOp }) => descOp(prediction.createdAt),
    limit: 25,
  });

  const validationsRows = await db
    .select()
    .from(validationFlags)
    .orderBy(desc(validationFlags.createdAt))
    .limit(50);

  const validations = validationsRows
    .filter((flag) => {
      const details = (flag.details as { fixtureId?: string | null } | null) ?? null;
      return details?.fixtureId === fixtureId;
    })
    .map((flag) => ({
      id: flag.id,
      level: flag.level ?? "info",
      reason: flag.reason,
      createdAt: normalizeDate(flag.createdAt) ?? new Date().toISOString(),
      fixtureId,
    }));

  const fixtureSummary = fixture
    ? {
        id: fixture.id,
        label: `${fixture.homeTeam?.name ?? "Home"} vs ${fixture.awayTeam?.name ?? "Away"}`,
        kickoffAt: fixture.kickoffAt?.toISOString() ?? null,
        competition: fixture.season?.competition?.name ?? null,
        status: fixture.status ?? null,
      }
    : null;

  return {
    fixture: fixtureSummary,
    bets: betsRows.map((row) => ({
      id: row.id,
      status: row.status ?? "pending",
      stake: Number(row.stake ?? 0),
      selection: row.selection,
      placedAt: normalizeDate(row.placedAt) ?? new Date().toISOString(),
    })),
    predictions: predictionRows.map((row) => ({
      id: row.id,
      model: row.model?.name ?? null,
      version: row.model?.version ?? null,
      createdAt: normalizeDate(row.createdAt) ?? new Date().toISOString(),
    })),
    validations,
    traces: getFixtureTraces(fixtureId, 50),
  };
}
