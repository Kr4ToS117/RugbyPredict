import { events } from "@shared/schema";
import type { ETLConnector, ConnectorLog, ConnectorAnomaly } from "../types";
import { ensureTeam, buildFixtureLabel } from "../utils";

interface EventPayload {
  id: string;
  fixtureId: string;
  team: string;
  eventType: string;
  minute: number;
  playerName: string;
  description: string;
}

const eventPayload: EventPayload[] = [
  {
    id: "00000000-0000-0000-0000-00000000e101",
    fixtureId: "00000000-0000-0000-0000-00000000f101",
    team: "Stade Toulousain",
    eventType: "TRY",
    minute: 12,
    playerName: "Antoine Dupont",
    description: "Line break on the right wing",
  },
  {
    id: "00000000-0000-0000-0000-00000000e201",
    fixtureId: "00000000-0000-0000-0000-00000000f201",
    team: "Munster Rugby",
    eventType: "YELLOW_CARD",
    minute: 54,
    playerName: "Peter O'Mahony",
    description: "Repeated infringements at the ruck",
  },
];

export const scrapingConnector: ETLConnector = {
  id: "scraping",
  label: "Match Centre Scraper",
  description: "Scrapes auxiliary sources (club websites, news feeds) for missing context.",
  async execute({ db }) {
    const logs: ConnectorLog[] = [];
    const anomalies: ConnectorAnomaly[] = [];

    for (const payload of eventPayload) {
      const team = await ensureTeam(db, payload.team);

      await db
        .insert(events)
        .values({
          id: payload.id,
          fixtureId: payload.fixtureId,
          teamId: team.id,
          eventType: payload.eventType,
          minute: payload.minute,
          playerName: payload.playerName,
          description: payload.description,
        })
        .onConflictDoUpdate({
          target: events.id,
          set: {
            teamId: team.id,
            eventType: payload.eventType,
            minute: payload.minute,
            playerName: payload.playerName,
            description: payload.description,
          },
        });

      logs.push({
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: `Scraped ${payload.eventType} for ${payload.playerName} (${payload.fixtureId})`,
      });

      if (payload.id === "00000000-0000-0000-0000-00000000e201") {
        const opponent = await ensureTeam(db, "Leinster Rugby");
        anomalies.push({
          connectorId: scrapingConnector.id,
          fixtureId: payload.fixtureId,
          fixtureLabel: buildFixtureLabel(opponent, team),
          field: "Disciplinary",
          severity: "high",
          reason: "Second independent source flagged a potential suspension requirement.",
          sources: [
            { name: "Club Website", value: "Yellow card at 54'" },
            { name: "League Feed", value: "No card reported" },
          ],
        });
      }
    }

    return {
      recordsProcessed: eventPayload.length,
      successRate: 100,
      logs,
      anomalies,
    };
  },
};
