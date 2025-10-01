import { odds } from "@shared/schema";
import type { ETLConnector, ConnectorLog } from "../types";

interface OddsPayload {
  fixtureId: string;
  bookmaker: string;
  market: string;
  home: number;
  draw?: number;
  away: number;
}

const oddsPayload: OddsPayload[] = [
  {
    fixtureId: "00000000-0000-0000-0000-00000000f101",
    bookmaker: "Bet365",
    market: "1X2",
    home: 1.8,
    draw: 21,
    away: 2.05,
  },
  {
    fixtureId: "00000000-0000-0000-0000-00000000f102",
    bookmaker: "Unibet",
    market: "1X2",
    home: 1.95,
    draw: 19,
    away: 1.95,
  },
  {
    fixtureId: "00000000-0000-0000-0000-00000000f201",
    bookmaker: "Pinnacle",
    market: "1X2",
    home: 1.7,
    draw: 18,
    away: 2.25,
  },
];

export const oddsApiConnector: ETLConnector = {
  id: "odds_api",
  label: "Odds Provider",
  description: "Consolidates bookmaker prices into the pricing warehouse.",
  async execute({ db }) {
    const logs: ConnectorLog[] = [];

    for (const payload of oddsPayload) {
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

      logs.push({
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: `${payload.bookmaker} updated ${payload.market} market for ${payload.fixtureId}`,
      });
    }

    return {
      recordsProcessed: oddsPayload.length,
      successRate: 100,
      logs,
    };
  },
};
