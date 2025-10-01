import type { ETLConnector, ConnectorLog, ConnectorAnomaly } from "../types";
import { ensureCompetition, ensureSeason, ensureTeam, upsertFixture, toUtcDate, buildFixtureLabel } from "../utils";

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

const fixturesPayload: RugbyFixturePayload[] = [
  {
    id: "00000000-0000-0000-0000-00000000f101",
    competitionCode: "TOP14",
    round: 5,
    matchDay: 5,
    homeTeam: "Stade Toulousain",
    awayTeam: "Stade Rochelais",
    kickoffLocal: "2024-10-12T21:05:00+02:00",
    venue: "Stadium de Toulouse",
  },
  {
    id: "00000000-0000-0000-0000-00000000f102",
    competitionCode: "TOP14",
    round: 5,
    matchDay: 5,
    homeTeam: "Racing 92",
    awayTeam: "Stade Français Paris",
    kickoffLocal: "2024-10-13T17:15:00+02:00",
    venue: "Paris La Défense Arena",
  },
  {
    id: "00000000-0000-0000-0000-00000000f201",
    competitionCode: "URC",
    round: 4,
    matchDay: 4,
    homeTeam: "Leinster Rugby",
    awayTeam: "Munster Rugby",
    kickoffLocal: "2024-10-20T19:30:00+01:00",
    venue: "Aviva Stadium",
  },
];

export const rugbyApiConnector: ETLConnector = {
  id: "rugby_api",
  label: "Rugby Fixtures API",
  description: "Synchronises competition calendars from federation endpoints.",
  async execute({ db }) {
    const logs: ConnectorLog[] = [];
    const anomalies: ConnectorAnomaly[] = [];

    for (const payload of fixturesPayload) {
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

      logs.push({
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: `${competition.code} :: Stored fixture ${buildFixtureLabel(homeTeam, awayTeam)} on ${kickoffAt.toISOString()}`,
      });

      if (payload.id === "00000000-0000-0000-0000-00000000f101") {
        anomalies.push({
          connectorId: rugbyApiConnector.id,
          fixtureId: fixture.id,
          fixtureLabel: buildFixtureLabel(homeTeam, awayTeam),
          field: "Kick-off Time",
          severity: "medium",
          reason: "Discrepancy between broadcaster and federation feeds",
          sources: [
            { name: "Federation", value: "2024-10-12T21:05:00+02:00" },
            { name: "Broadcaster", value: "2024-10-12T21:00:00+02:00" },
          ],
        });
      }
    }

    return {
      recordsProcessed: fixturesPayload.length,
      successRate: 100,
      logs,
      anomalies,
    };
  },
};
