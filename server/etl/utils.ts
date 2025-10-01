import {
  competitions,
  seasons,
  teams,
  fixtures,
  validationFlags,
  type Competition,
  type Season,
  type Team,
} from "@shared/schema";

import {
  getLeagueByCode,
  getSeasonByCompetition,
  getTeamByName,
  type LeagueMapping,
  type SeasonMapping,
  type TeamMapping,
} from "./mappings";
import type { ConnectorAnomaly, ConnectorError, Database } from "./types";

export function toUtcDate(value: string | Date): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return new Date(date.toISOString());
}

export async function ensureCompetition(
  db: Database,
  competitionCode: string,
): Promise<Competition> {
  const mapping: LeagueMapping | undefined = getLeagueByCode(competitionCode);
  if (!mapping) {
    throw new Error(`Unknown competition code: ${competitionCode}`);
  }

  const [record] = await db
    .insert(competitions)
    .values({
      id: mapping.id,
      code: mapping.code,
      name: mapping.name,
      country: mapping.country,
      level: mapping.level,
    })
    .onConflictDoUpdate({
      target: competitions.code,
      set: {
        name: mapping.name,
        country: mapping.country,
        level: mapping.level,
      },
    })
    .returning();

  return record;
}

export async function ensureSeason(
  db: Database,
  competition: Competition,
): Promise<Season> {
  const mapping: SeasonMapping | undefined = getSeasonByCompetition(competition.code);
  if (!mapping) {
    throw new Error(`Missing season mapping for competition ${competition.code}`);
  }

  const [season] = await db
    .insert(seasons)
    .values({
      id: mapping.id,
      competitionId: competition.id,
      name: mapping.name,
      startDate: mapping.startDate,
      endDate: mapping.endDate,
      year: mapping.year,
    })
    .onConflictDoUpdate({
      target: [seasons.competitionId, seasons.name],
      set: {
        startDate: mapping.startDate,
        endDate: mapping.endDate,
        year: mapping.year,
      },
    })
    .returning();

  return season;
}

export async function ensureTeam(db: Database, name: string): Promise<Team> {
  const mapping: TeamMapping | undefined = getTeamByName(name);
  if (!mapping) {
    throw new Error(`Unknown team mapping for ${name}`);
  }

  const [team] = await db
    .insert(teams)
    .values({
      id: mapping.id,
      name: mapping.name,
      shortName: mapping.shortName,
      code: mapping.code,
      city: mapping.city,
      country: mapping.country,
    })
    .onConflictDoUpdate({
      target: teams.id,
      set: {
        name: mapping.name,
        shortName: mapping.shortName,
        code: mapping.code,
        city: mapping.city,
        country: mapping.country,
      },
    })
    .returning();

  return team;
}

export interface FixtureInput {
  id: string;
  seasonId: string;
  round?: number;
  matchDay?: number;
  stage?: string;
  kickoffAt: Date;
  status?: string;
  homeTeamId: string;
  awayTeamId: string;
  venue?: string;
  referee?: string;
}

export async function upsertFixture(db: Database, input: FixtureInput) {
  const [fixture] = await db
    .insert(fixtures)
    .values({
      id: input.id,
      seasonId: input.seasonId,
      round: input.round,
      matchDay: input.matchDay,
      stage: input.stage,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      venue: input.venue,
      referee: input.referee,
      kickoffAt: input.kickoffAt,
      status: input.status ?? "scheduled",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: fixtures.id,
      set: {
        round: input.round,
        matchDay: input.matchDay,
        stage: input.stage,
        homeTeamId: input.homeTeamId,
        awayTeamId: input.awayTeamId,
        venue: input.venue,
        referee: input.referee,
        kickoffAt: input.kickoffAt,
        status: input.status ?? "scheduled",
        updatedAt: new Date(),
      },
    })
    .returning();

  return fixture;
}

export function buildFixtureLabel(homeTeam: Team, awayTeam: Team) {
  return `${homeTeam.shortName ?? homeTeam.name} vs ${awayTeam.shortName ?? awayTeam.name}`;
}

async function insertValidationFlags(
  db: Database,
  items:
    | ConnectorAnomaly[]
    | ConnectorError[]
    | (ConnectorAnomaly | ConnectorError)[]
    | undefined,
  mapDetails: (item: ConnectorAnomaly | ConnectorError) => Record<string, unknown>,
) {
  if (!items?.length) {
    return;
  }

  await Promise.all(
    items.map(async (item) => {
      const details = mapDetails(item);
      await db.insert(validationFlags).values({
        level: item.severity,
        reason: "reason" in item ? item.reason : item.message,
        source: (details.source as string | undefined) ?? "unknown", 
        details,
      });
    }),
  );
}

export async function recordAnomalies(
  db: Database,
  anomalies: ConnectorAnomaly[] | undefined,
) {
  await insertValidationFlags(
    db,
    anomalies,
    (anomaly) => ({
      type: "anomaly",
      source: (anomaly as ConnectorAnomaly).connectorId,
      fixtureId: (anomaly as ConnectorAnomaly).fixtureId,
      fixtureLabel: (anomaly as ConnectorAnomaly).fixtureLabel,
      field: (anomaly as ConnectorAnomaly).field,
      sources: (anomaly as ConnectorAnomaly).sources,
    }),
  );
}

export async function recordConnectorErrors(
  db: Database,
  connectorId: string,
  errors: ConnectorError[] | undefined,
) {
  await insertValidationFlags(
    db,
    errors,
    (error) => ({
      type: "error",
      source: connectorId,
      scope: (error as ConnectorError).scope,
      context: (error as ConnectorError).context,
    }),
  );
}

export function countHighSeverity(
  issues: Array<{ severity: ConnectorAnomaly["severity"] }> | undefined,
) {
  return issues?.filter((item) => item.severity === "high").length ?? 0;
}
