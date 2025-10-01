import { and, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import { differenceInHours } from "date-fns";
import { fixtures, odds, weather as weatherTable } from "@shared/schema";
import { getDb } from "../db/registry";
import { fixtureLogger } from "../logging";

export const FEATURE_KEYS = [
  "homeFormRating",
  "awayFormRating",
  "formDiff",
  "homeElo",
  "awayElo",
  "eloDiff",
  "homeRestDays",
  "awayRestDays",
  "restDiff",
  "homeFatigueIndex",
  "awayFatigueIndex",
  "fatigueDiff",
  "homeImpliedProbability",
  "drawImpliedProbability",
  "awayImpliedProbability",
  "impliedEdge",
  "weatherSeverity",
  "homeHeadToHeadWinRate",
  "awayHeadToHeadWinRate",
  "headToHeadDiff",
] as const;

export type FeatureName = (typeof FEATURE_KEYS)[number];

export interface FeatureVector {
  homeFormRating: number;
  awayFormRating: number;
  formDiff: number;
  homeElo: number;
  awayElo: number;
  eloDiff: number;
  homeRestDays: number;
  awayRestDays: number;
  restDiff: number;
  homeFatigueIndex: number;
  awayFatigueIndex: number;
  fatigueDiff: number;
  homeImpliedProbability: number;
  drawImpliedProbability: number;
  awayImpliedProbability: number;
  impliedEdge: number;
  weatherSeverity: number;
  homeHeadToHeadWinRate: number;
  awayHeadToHeadWinRate: number;
  headToHeadDiff: number;
}

export interface FixtureFeatureVector {
  fixtureId: string;
  kickoffAt: string;
  homeTeamId: string;
  awayTeamId: string;
  featureVector: FeatureVector;
  impliedOdds: {
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
}

export interface TrainingRow extends FixtureFeatureVector {
  outcome: "home" | "away" | "draw";
  label: number;
  homeScore: number | null;
  awayScore: number | null;
}

export interface TrainingDataset {
  rows: TrainingRow[];
  featureOrder: FeatureName[];
}

type FixtureRecord = typeof fixtures.$inferSelect;
type OddsRecord = typeof odds.$inferSelect;
type WeatherRecord = typeof weatherTable.$inferSelect;

interface FixtureWithContext extends FixtureRecord {
  odds: OddsRecord[];
  weather: WeatherRecord | null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return null;
}

function computeResult(teamScore: number | null, opponentScore: number | null): number | null {
  if (teamScore === null || opponentScore === null) {
    return null;
  }

  if (teamScore > opponentScore) {
    return 1;
  }

  if (teamScore === opponentScore) {
    return 0.5;
  }

  return 0;
}

async function getRecentFixtures(
  teamId: string,
  before: Date,
  limit: number,
): Promise<FixtureRecord[]> {
  const database = getDb();
  return await database.query.fixtures.findMany({
    where: (fixture, { and: andOp, lt: ltOp, or: orOp, eq: eqOp }) =>
      andOp(
        ltOp(fixture.kickoffAt, before),
        orOp(eqOp(fixture.homeTeamId, teamId), eqOp(fixture.awayTeamId, teamId)),
        eqOp(fixture.status, "completed"),
      ),
    orderBy: (fixture, { desc: descOp }) => descOp(fixture.kickoffAt),
    limit,
  });
}

function computeFormRating(
  matches: FixtureRecord[],
  teamId: string,
): {
  rating: number;
  winRate: number;
  averageFor: number;
  averageAgainst: number;
} {
  if (!matches.length) {
    return { rating: 50, winRate: 0.5, averageFor: 0, averageAgainst: 0 };
  }

  let weightedResult = 0;
  let totalWeight = 0;
  let wins = 0;
  let draws = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let counted = 0;

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const isHome = match.homeTeamId === teamId;
    const teamScore = isHome ? match.homeScore : match.awayScore;
    const opponentScore = isHome ? match.awayScore : match.homeScore;
    const result = computeResult(teamScore, opponentScore);

    if (result === null || teamScore === null || opponentScore === null) {
      continue;
    }

    counted += 1;
    if (result === 1) {
      wins += 1;
    } else if (result === 0.5) {
      draws += 1;
    }

    goalsFor += teamScore;
    goalsAgainst += opponentScore;

    const weight = Math.max(0.2, 1 - index * 0.15);
    weightedResult += weight * result;
    totalWeight += weight;
  }

  if (!totalWeight || !counted) {
    return { rating: 50, winRate: 0.5, averageFor: 0, averageAgainst: 0 };
  }

  const rating = (weightedResult / totalWeight) * 100;
  const winRate = (wins + draws * 0.5) / counted;
  const averageFor = goalsFor / counted;
  const averageAgainst = goalsAgainst / counted;

  return {
    rating,
    winRate,
    averageFor,
    averageAgainst,
  };
}

function computeElo(winRate: number, averageMargin: number): number {
  const baseline = 1500;
  const winComponent = (winRate - 0.5) * 400;
  const marginComponent = averageMargin * 12;
  return baseline + winComponent + marginComponent;
}

function computeRestDays(currentFixture: FixtureRecord, recentMatches: FixtureRecord[]): number {
  if (!recentMatches.length) {
    return 10;
  }

  const [lastMatch] = recentMatches;
  const diffHours = differenceInHours(currentFixture.kickoffAt, lastMatch.kickoffAt ?? currentFixture.kickoffAt);
  return Math.max(diffHours / 24, 0);
}

function computeFatigueIndex(restDays: number): number {
  if (!Number.isFinite(restDays)) {
    return 0.5;
  }

  if (restDays >= 8) {
    return 0;
  }

  if (restDays <= 1) {
    return 1;
  }

  return Math.max(0, Math.min(1, (8 - restDays) / 7));
}

function computeImpliedProbability(decimalOdds: number | null): number {
  if (!decimalOdds || decimalOdds <= 1) {
    return 0;
  }

  return 1 / decimalOdds;
}

function computeWeatherSeverity(weather: WeatherRecord | null): number {
  if (!weather) {
    return 0;
  }

  const temperature = toNumber(weather.temperatureC);
  const humidity = toNumber(weather.humidity);
  const wind = toNumber(weather.windSpeedKph);

  const temperaturePenalty = temperature === null ? 0 : Math.min(Math.abs(temperature - 15) / 25, 1);
  const humidityPenalty = humidity === null ? 0 : Math.min(Math.abs(humidity - 60) / 50, 1);
  const windPenalty = wind === null ? 0 : Math.min(wind / 50, 1);

  return Number(((temperaturePenalty + humidityPenalty + windPenalty) / 3).toFixed(4));
}

async function computeHeadToHead(
  fixture: FixtureRecord,
): Promise<{ homeWinRate: number; awayWinRate: number; diff: number }> {
  const database = getDb();
  const rows = await database.query.fixtures.findMany({
    where: (row, { and: andOp, or: orOp, eq: eqOp, lt: ltOp }) =>
      andOp(
        ltOp(row.kickoffAt, fixture.kickoffAt),
        eqOp(row.status, "completed"),
        orOp(
          andOp(eqOp(row.homeTeamId, fixture.homeTeamId), eqOp(row.awayTeamId, fixture.awayTeamId)),
          andOp(eqOp(row.homeTeamId, fixture.awayTeamId), eqOp(row.awayTeamId, fixture.homeTeamId)),
        ),
      ),
    orderBy: (row, { desc: descOp }) => descOp(row.kickoffAt),
    limit: 10,
  });

  if (!rows.length) {
    return { homeWinRate: 0.5, awayWinRate: 0.5, diff: 0 };
  }

  let homeScore = 0;
  let awayScore = 0;
  let samples = 0;

  for (const match of rows) {
    if (match.homeScore === null || match.awayScore === null) {
      continue;
    }

    const weight = Math.max(0.3, 1 - samples * 0.1);

    if (match.homeTeamId === fixture.homeTeamId) {
      if (match.homeScore > match.awayScore) {
        homeScore += weight;
      } else if (match.homeScore < match.awayScore) {
        awayScore += weight;
      } else {
        homeScore += weight * 0.5;
        awayScore += weight * 0.5;
      }
    } else {
      if (match.awayScore > match.homeScore) {
        homeScore += weight;
      } else if (match.awayScore < match.homeScore) {
        awayScore += weight;
      } else {
        homeScore += weight * 0.5;
        awayScore += weight * 0.5;
      }
    }

    samples += 1;
  }

  if (!samples) {
    return { homeWinRate: 0.5, awayWinRate: 0.5, diff: 0 };
  }

  const total = homeScore + awayScore;
  if (!total) {
    return { homeWinRate: 0.5, awayWinRate: 0.5, diff: 0 };
  }

  const homeWinRate = homeScore / total;
  const awayWinRate = awayScore / total;

  return {
    homeWinRate,
    awayWinRate,
    diff: homeWinRate - awayWinRate,
  };
}

function selectLatestMarketOdds(context: FixtureWithContext): {
  home: number | null;
  draw: number | null;
  away: number | null;
} {
  const market = context.odds
    .filter((entry) => entry.market === "1X2")
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));

  if (!market.length) {
    return { home: null, draw: null, away: null };
  }

  const [latest] = market;
  return {
    home: toNumber(latest.home),
    draw: toNumber(latest.draw),
    away: toNumber(latest.away),
  };
}

async function hydrateFixture(fixtureId: string): Promise<FixtureWithContext | null> {
  const database = getDb();
  const row = await database.query.fixtures.findFirst({
    where: eq(fixtures.id, fixtureId),
    with: {
      odds: true,
      weather: true,
    },
  });

  if (!row) {
    return null;
  }

  return row;
}

function toFeatureVector(
  fixture: FixtureRecord,
  context: FixtureWithContext,
  homeForm: ReturnType<typeof computeFormRating>,
  awayForm: ReturnType<typeof computeFormRating>,
  homeRest: number,
  awayRest: number,
  headToHead: { homeWinRate: number; awayWinRate: number; diff: number },
): FeatureVector {
  const odds = selectLatestMarketOdds(context);

  const homeImplied = computeImpliedProbability(odds.home);
  const drawImplied = computeImpliedProbability(odds.draw);
  const awayImplied = computeImpliedProbability(odds.away);
  const impliedEdge = homeImplied - awayImplied;

  const weatherSeverity = computeWeatherSeverity(context.weather);

  const homeElo = computeElo(homeForm.winRate, homeForm.averageFor - homeForm.averageAgainst);
  const awayElo = computeElo(awayForm.winRate, awayForm.averageFor - awayForm.averageAgainst);

  const homeFatigue = computeFatigueIndex(homeRest);
  const awayFatigue = computeFatigueIndex(awayRest);

  return {
    homeFormRating: Number(homeForm.rating.toFixed(3)),
    awayFormRating: Number(awayForm.rating.toFixed(3)),
    formDiff: Number((homeForm.rating - awayForm.rating).toFixed(3)),
    homeElo: Number(homeElo.toFixed(3)),
    awayElo: Number(awayElo.toFixed(3)),
    eloDiff: Number((homeElo - awayElo).toFixed(3)),
    homeRestDays: Number(homeRest.toFixed(3)),
    awayRestDays: Number(awayRest.toFixed(3)),
    restDiff: Number((homeRest - awayRest).toFixed(3)),
    homeFatigueIndex: Number(homeFatigue.toFixed(3)),
    awayFatigueIndex: Number(awayFatigue.toFixed(3)),
    fatigueDiff: Number((homeFatigue - awayFatigue).toFixed(3)),
    homeImpliedProbability: Number(homeImplied.toFixed(4)),
    drawImpliedProbability: Number(drawImplied.toFixed(4)),
    awayImpliedProbability: Number(awayImplied.toFixed(4)),
    impliedEdge: Number(impliedEdge.toFixed(4)),
    weatherSeverity,
    homeHeadToHeadWinRate: Number(headToHead.homeWinRate.toFixed(4)),
    awayHeadToHeadWinRate: Number(headToHead.awayWinRate.toFixed(4)),
    headToHeadDiff: Number(headToHead.diff.toFixed(4)),
  };
}

export function vectorToArray(vector: FeatureVector): number[] {
  return FEATURE_KEYS.map((key) => {
    const value = vector[key];
    return Number.isFinite(value) ? value : 0;
  });
}

export async function computeFixtureFeatureVector(
  fixtureId: string,
): Promise<FixtureFeatureVector | null> {
  const context = await hydrateFixture(fixtureId);
  if (!context) {
    return null;
  }

  return await computeFixtureFeatureVectorFromRecord(context);
}

export async function computeFixtureFeatureVectorFromRecord(
  fixture: FixtureWithContext,
): Promise<FixtureFeatureVector> {
  const kickoffAt = fixture.kickoffAt instanceof Date ? fixture.kickoffAt : new Date(fixture.kickoffAt);

  const [homeRecent, awayRecent] = await Promise.all([
    getRecentFixtures(fixture.homeTeamId, kickoffAt, 6),
    getRecentFixtures(fixture.awayTeamId, kickoffAt, 6),
  ]);

  const homeForm = computeFormRating(homeRecent, fixture.homeTeamId);
  const awayForm = computeFormRating(awayRecent, fixture.awayTeamId);

  const homeRest = computeRestDays(fixture, homeRecent);
  const awayRest = computeRestDays(fixture, awayRecent);

  const headToHead = await computeHeadToHead(fixture);

  const featureVector = toFeatureVector(fixture, fixture, homeForm, awayForm, homeRest, awayRest, headToHead);

  const impliedOdds = selectLatestMarketOdds(fixture);

  fixtureLogger(fixture.id, "features").debug("Feature vector computed", {
    impliedEdge: featureVector.impliedEdge,
    weatherSeverity: featureVector.weatherSeverity,
    restDiff: featureVector.restDiff,
  });

  return {
    fixtureId: fixture.id,
    kickoffAt: kickoffAt.toISOString(),
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    featureVector,
    impliedOdds,
    weather: fixture.weather
      ? {
          temperatureC: toNumber(fixture.weather.temperatureC),
          humidity: toNumber(fixture.weather.humidity),
          windSpeedKph: toNumber(fixture.weather.windSpeedKph),
          condition: fixture.weather.condition ?? null,
        }
      : null,
  };
}

function determineOutcome(fixture: FixtureRecord): "home" | "away" | "draw" {
  if (fixture.homeScore === null || fixture.awayScore === null) {
    return "draw";
  }

  if (fixture.homeScore > fixture.awayScore) {
    return "home";
  }

  if (fixture.homeScore < fixture.awayScore) {
    return "away";
  }

  return "draw";
}

export async function buildTrainingDataset(options: {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
} = {}): Promise<TrainingDataset> {
  const database = getDb();
  const rows = await database.query.fixtures.findMany({
    where: (fixture, { and: andOp, gte: gteOp, lte: lteOp, eq: eqOp }) => {
      const predicates = [eqOp(fixture.status, "completed")];

      if (options.startDate) {
        predicates.push(gteOp(fixture.kickoffAt, options.startDate));
      }

      if (options.endDate) {
        predicates.push(lteOp(fixture.kickoffAt, options.endDate));
      }

      return andOp(...predicates);
    },
    with: {
      odds: true,
      weather: true,
    },
    orderBy: (fixture, { asc }) => asc(fixture.kickoffAt),
    limit: options.limit,
  });

  const dataset: TrainingRow[] = [];

  for (const fixture of rows) {
    if (fixture.homeScore === null || fixture.awayScore === null) {
      continue;
    }

    const vector = await computeFixtureFeatureVectorFromRecord(fixture as FixtureWithContext);
    const outcome = determineOutcome(fixture);
    const label = outcome === "home" ? 1 : 0;

    dataset.push({
      ...vector,
      outcome,
      label,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
    });
  }

  return { rows: dataset, featureOrder: FEATURE_KEYS.slice() };
}

export const __testing = {
  computeFormRating,
  computeElo,
  computeRestDays,
  computeFatigueIndex,
  computeImpliedProbability,
  computeWeatherSeverity,
  computeResult,
  vectorToArray,
};
