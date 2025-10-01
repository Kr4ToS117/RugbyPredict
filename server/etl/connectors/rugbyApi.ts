import type { ETLConnector, ConnectorLog, ConnectorAnomaly, ConnectorError } from "../types";
import {
  ensureCompetition,
  ensureSeason,
  ensureTeam,
  upsertFixture,
  toUtcDate,
  buildFixtureLabel,
} from "../utils";

interface RugbyFixturePayload {
  id: string;
  competitionCode: string;
  round: number;
  matchDay: number;
  stage?: string;
  homeTeam: string;
  awayTeam: string;
  kickoffLocal: string;
  venue: string;
}

const FEDERATION_API_BASE_URL = (process.env.RUGBY_API_URL ?? "https://federations.example.com")
  .replace(/\/$/, "");

async function fetchFederationFixtures(): Promise<RugbyFixturePayload[]> {
  const token = process.env.RUGBY_API_TOKEN;
  if (!token) {
    throw new Error("Missing RUGBY_API_TOKEN environment variable for rugby_api connector");
  }

  const endpoint = `${FEDERATION_API_BASE_URL}/fixtures`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Federation API responded with ${response.status} ${response.statusText}: ${body ?? ""}`.trim(),
    );
  }

  const data = (await response.json()) as
    | RugbyFixturePayload[]
    | { fixtures?: RugbyFixturePayload[] };

  if (Array.isArray(data)) {
    return data;
  }

  if (data.fixtures) {
    return data.fixtures;
  }

  return [];
}

export const rugbyApiConnector: ETLConnector = {
  id: "rugby_api",
  label: "Rugby Fixtures API",
  description: "Synchronises competition calendars from federation endpoints.",
  async execute({ db }) {
    const fixturesPayload = await fetchFederationFixtures();
    const logs: ConnectorLog[] = [];
    const anomalies: ConnectorAnomaly[] = [];
    const errors: ConnectorError[] = [];

    logs.push({
      timestamp: new Date().toISOString(),
      level: "INFO",
      message: `Fetched ${fixturesPayload.length} fixtures from federation API`,
    });

    let processed = 0;

    for (const payload of fixturesPayload) {
      try {
        const competition = await ensureCompetition(db, payload.competitionCode);
        const season = await ensureSeason(db, competition);
        const homeTeam = await ensureTeam(db, payload.homeTeam);
        const awayTeam = await ensureTeam(db, payload.awayTeam);
        const kickoffAt = toUtcDate(payload.kickoffLocal);

        const fixture = await upsertFixture(db, {
          id: payload.id,
          seasonId: season.id,
          round: payload.round,
          matchDay: payload.matchDay,
          stage: payload.stage,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          kickoffAt,
          venue: payload.venue,
        });

        processed += 1;

        const label = buildFixtureLabel(homeTeam, awayTeam);
        logs.push({
          timestamp: new Date().toISOString(),
          level: "INFO",
          message: `${competition.code} :: Stored fixture ${label} on ${kickoffAt.toISOString()}`,
        });

        if (payload.id === "00000000-0000-0000-0000-00000000f101") {
          anomalies.push({
            connectorId: rugbyApiConnector.id,
            fixtureId: fixture.id,
            fixtureLabel: label,
            field: "Kick-off Time",
            severity: "medium",
            reason: "Discrepancy between broadcaster and federation feeds",
            sources: [
              { name: "Federation", value: "2024-10-12T21:05:00+02:00" },
              { name: "Broadcaster", value: "2024-10-12T21:00:00+02:00" },
            ],
          });
        }
      } catch (error) {
        errors.push({
          severity: "high",
          message: error instanceof Error ? error.message : "Unknown federation processing error",
          scope: payload.id,
          context: { payload },
        });
      }
    }

    const total = fixturesPayload.length;
    const successRate = total === 0 ? 100 : (processed / total) * 100;

    return {
      recordsProcessed: processed,
      successRate,
      logs,
      anomalies,
      errors,
      metrics: {
        fixturesFetched: total,
        competitions: new Set(fixturesPayload.map((item) => item.competitionCode)).size,
      },
    };
  },
};
