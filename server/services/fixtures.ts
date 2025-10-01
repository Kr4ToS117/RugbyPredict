import { asc, desc, eq, gte, or } from "drizzle-orm";
import { db } from "../db";
import { fixtures, predictions, modelRegistry } from "@shared/schema";
import { getProductionModelInfo } from "./models";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface FixturePredictionSummary {
  modelId: string;
  modelVersion: string;
  probabilities: {
    home: number;
    draw: number;
    away: number;
  };
  expectedScores: {
    home: number | null;
    away: number | null;
  };
  edge: number | null;
  createdAt: string;
  explanation: Record<string, unknown> | null;
}

export interface FixtureSummary {
  id: string;
  competition: string | null;
  season: string | null;
  kickoffAt: string;
  venue: string | null;
  status: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  probabilities: FixturePredictionSummary["probabilities"] | null;
  expectedScores: FixturePredictionSummary["expectedScores"] | null;
  edge: number | null;
  impliedProbabilities: {
    home: number | null;
    draw: number | null;
    away: number | null;
  };
  weather: {
    temperatureC: number | null;
    humidity: number | null;
    windSpeedKph: number | null;
    condition: string | null;
  } | null;
  modelVersion: string | null;
}

export interface FixturesResponse {
  fixtures: FixtureSummary[];
  productionVersion: string | null;
}

export interface FixturePredictionsResponse {
  fixtureId: string;
  predictions: FixturePredictionSummary[];
}

function parsePrediction(row: typeof predictions.$inferSelect & { model?: typeof modelRegistry.$inferSelect | null }): FixturePredictionSummary {
  const modelVersion = row.model?.version ?? "unknown";
  const explanation = (row.explanation as Record<string, unknown> | null) ?? null;

  const edge = typeof explanation?.edge === "number" ? (explanation.edge as number) : null;

  return {
    modelId: row.modelId,
    modelVersion,
    probabilities: {
      home: Number(toNumber(row.homeWinProbability) ?? 0),
      draw: Number(toNumber(row.drawProbability) ?? 0),
      away: Number(toNumber(row.awayWinProbability) ?? 0),
    },
    expectedScores: {
      home: toNumber(row.expectedHomeScore),
      away: toNumber(row.expectedAwayScore),
    },
    edge,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    explanation,
  };
}

export async function listFixtures(limit = 25): Promise<FixturesResponse> {
  const production = await getProductionModelInfo();

  const rows = await db.query.fixtures.findMany({
    where: (fixture, { or: orOp, gte: gteOp, eq: eqOp }) =>
      orOp(eqOp(fixture.status, "scheduled"), gteOp(fixture.kickoffAt, new Date())),
    with: {
      season: {
        with: {
          competition: true,
        },
      },
      homeTeam: true,
      awayTeam: true,
      predictions: production
        ? {
            where: (prediction, { eq: eqOp }) => eqOp(prediction.modelId, production.id),
            orderBy: (prediction, { desc: descOp }) => descOp(prediction.createdAt),
            limit: 1,
            with: {
              model: true,
            },
          }
        : {
            orderBy: (prediction, { desc: descOp }) => descOp(prediction.createdAt),
            limit: 1,
            with: {
              model: true,
            },
          },
      odds: true,
      weather: true,
    },
    orderBy: (fixture, { asc: ascOp }) => ascOp(fixture.kickoffAt),
    limit,
  });

  const fixturesSummaries: FixtureSummary[] = rows.map((fixture) => {
    const prediction = fixture.predictions?.[0];
    const parsedPrediction = prediction ? parsePrediction(prediction) : null;
    const latestOdds = fixture.odds
      ?.filter((odd) => odd.market === "1X2")
      .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))[0];

    const homeImplied = latestOdds ? toNumber(latestOdds.home) : null;
    const drawImplied = latestOdds ? toNumber(latestOdds.draw) : null;
    const awayImplied = latestOdds ? toNumber(latestOdds.away) : null;

    return {
      id: fixture.id,
      competition: fixture.season?.competition?.name ?? null,
      season: fixture.season?.name ?? null,
      kickoffAt: fixture.kickoffAt?.toISOString() ?? new Date().toISOString(),
      venue: fixture.venue ?? null,
      status: fixture.status ?? "scheduled",
      homeTeam: {
        id: fixture.homeTeamId,
        name: fixture.homeTeam?.name ?? "",
      },
      awayTeam: {
        id: fixture.awayTeamId,
        name: fixture.awayTeam?.name ?? "",
      },
      probabilities: parsedPrediction?.probabilities ?? null,
      expectedScores: parsedPrediction?.expectedScores ?? null,
      edge: parsedPrediction?.edge ?? null,
      impliedProbabilities: {
        home: homeImplied ? Number((1 / homeImplied).toFixed(4)) : null,
        draw: drawImplied ? Number((1 / drawImplied).toFixed(4)) : null,
        away: awayImplied ? Number((1 / awayImplied).toFixed(4)) : null,
      },
      weather: fixture.weather
        ? {
            temperatureC: toNumber(fixture.weather.temperatureC),
            humidity: toNumber(fixture.weather.humidity),
            windSpeedKph: toNumber(fixture.weather.windSpeedKph),
            condition: fixture.weather.condition ?? null,
          }
        : null,
      modelVersion: parsedPrediction?.modelVersion ?? null,
    };
  });

  return {
    fixtures: fixturesSummaries,
    productionVersion: production?.version ?? null,
  };
}

export async function getFixturePredictions(fixtureId: string): Promise<FixturePredictionsResponse> {
  const rows = await db.query.predictions.findMany({
    where: (prediction, { eq: eqOp }) => eqOp(prediction.fixtureId, fixtureId),
    with: {
      model: true,
    },
    orderBy: (prediction, { desc: descOp }) => descOp(prediction.createdAt),
  });

  const predictionsSummaries = rows.map((row) => parsePrediction(row));
  return {
    fixtureId,
    predictions: predictionsSummaries,
  };
}
