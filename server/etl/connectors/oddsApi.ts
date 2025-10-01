import { odds } from "@shared/schema";
import type { ETLConnector, ConnectorLog, ConnectorError } from "../types";

interface OddsPayload {
  fixtureId: string;
  bookmaker: string;
  market: string;
  home: number;
  draw?: number;
  away: number;
}

const ODDS_API_BASE_URL = (process.env.ODDS_API_URL ?? "https://bookmakers.example.com")
  .replace(/\/$/, "");

async function fetchOddsPayload(): Promise<OddsPayload[]> {
  const token = process.env.ODDS_API_TOKEN;
  if (!token) {
    throw new Error("Missing ODDS_API_TOKEN environment variable for odds_api connector");
  }

  const endpoint = `${ODDS_API_BASE_URL}/markets`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Odds API responded with ${response.status} ${response.statusText}: ${body ?? ""}`.trim());
  }

  const data = (await response.json()) as OddsPayload[] | { markets?: OddsPayload[] };

  if (Array.isArray(data)) {
    return data;
  }

  if (data.markets) {
    return data.markets;
  }

  return [];
}

export const oddsApiConnector: ETLConnector = {
  id: "odds_api",
  label: "Odds Provider",
  description: "Consolidates bookmaker prices into the pricing warehouse.",
  async execute({ db }) {
    const oddsPayload = await fetchOddsPayload();
    const logs: ConnectorLog[] = [];
    const errors: ConnectorError[] = [];

    logs.push({
      timestamp: new Date().toISOString(),
      level: "INFO",
      message: `Fetched ${oddsPayload.length} odds rows from provider`,
    });

    let processed = 0;

    for (const payload of oddsPayload) {
      try {
        const values: typeof odds.$inferInsert = {
          fixtureId: payload.fixtureId,
          bookmaker: payload.bookmaker,
          market: payload.market,
          home: payload.home.toFixed(2),
          draw: payload.draw ? payload.draw.toFixed(2) : null,
          away: payload.away.toFixed(2),
        };

        await db
          .insert(odds)
          .values(values)
          .onConflictDoUpdate({
            target: [odds.fixtureId, odds.bookmaker, odds.market],
            set: {
              home: payload.home.toFixed(2),
              draw: payload.draw ? payload.draw.toFixed(2) : null,
              away: payload.away.toFixed(2),
              updatedAt: new Date(),
            },
          });

        processed += 1;

        logs.push({
          timestamp: new Date().toISOString(),
          level: "INFO",
          message: `${payload.bookmaker} updated ${payload.market} market for ${payload.fixtureId}`,
        });
      } catch (error) {
        errors.push({
          severity: "medium",
          message: error instanceof Error ? error.message : "Failed to persist odds row",
          scope: payload.fixtureId,
          context: { payload },
        });
      }
    }

    const total = oddsPayload.length;
    const successRate = total === 0 ? 100 : (processed / total) * 100;

    return {
      recordsProcessed: processed,
      successRate,
      logs,
      errors,
      metrics: {
        bookmakers: new Set(oddsPayload.map((item) => item.bookmaker)).size,
        markets: new Set(oddsPayload.map((item) => item.market)).size,
      },
    };
  },
};
