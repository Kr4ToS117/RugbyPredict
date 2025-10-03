import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  decimal,
  jsonb,
  boolean,
  serial,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const competitions = pgTable("competitions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  country: varchar("country", { length: 100 }),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  competitionId: integer("competition_id").references(() => competitions.id),
  name: varchar("name", { length: 200 }).notNull(),
  aliases: jsonb("aliases").$type<string[]>(),
}, (table) => ({
  compIdx: index("teams_competition_idx").on(table.competitionId),
}));

export const fixtures = pgTable("fixtures", {
  id: serial("id").primaryKey(),
  competitionId: integer("competition_id").references(() => competitions.id).notNull(),
  season: varchar("season", { length: 20 }).notNull(),
  round: varchar("round", { length: 50 }),
  dateUtc: timestamp("date_utc").notNull(),
  homeId: integer("home_id").references(() => teams.id).notNull(),
  awayId: integer("away_id").references(() => teams.id).notNull(),
  venue: varchar("venue", { length: 200 }),
  status: varchar("status", { length: 50 }).notNull().default("scheduled"),
  weatherForecast: text("weather_forecast"),
  scoreHome: integer("score_home"),
  scoreAway: integer("score_away"),
}, (table) => ({
  dateIdx: index("fixtures_date_idx").on(table.dateUtc),
  statusIdx: index("fixtures_status_idx").on(table.status),
  compIdx: index("fixtures_competition_idx").on(table.competitionId),
}));

export const lineups = pgTable("lineups", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixture_id").references(() => fixtures.id).notNull(),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  starters: jsonb("starters").$type<string[]>(),
  bench: jsonb("bench").$type<string[]>(),
  absences: jsonb("absences").$type<string[]>(),
}, (table) => ({
  fixtureIdx: index("lineups_fixture_idx").on(table.fixtureId),
}));

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixture_id").references(() => fixtures.id).notNull(),
  minute: integer("minute").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  player: varchar("player", { length: 200 }),
  teamId: integer("team_id").references(() => teams.id),
  value: integer("value"),
}, (table) => ({
  fixtureIdx: index("events_fixture_idx").on(table.fixtureId),
}));

export const odds = pgTable("odds", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixture_id").references(() => fixtures.id).notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  home: decimal("home", { precision: 10, scale: 3 }),
  draw: decimal("draw", { precision: 10, scale: 3 }),
  away: decimal("away", { precision: 10, scale: 3 }),
  handicap: decimal("handicap", { precision: 10, scale: 2 }),
  total: decimal("total", { precision: 10, scale: 2 }),
}, (table) => ({
  fixtureIdx: index("odds_fixture_idx").on(table.fixtureId),
  timestampIdx: index("odds_timestamp_idx").on(table.timestamp),
}));

export const boxscore = pgTable("boxscore", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixture_id").references(() => fixtures.id).notNull().unique(),
  homeMetrics: jsonb("home_metrics").$type<Record<string, number>>(),
  awayMetrics: jsonb("away_metrics").$type<Record<string, number>>(),
});

export const weather = pgTable("weather", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixture_id").references(() => fixtures.id).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  temp: decimal("temp", { precision: 5, scale: 2 }),
  windKmh: decimal("wind_kmh", { precision: 5, scale: 2 }),
  rainMm: decimal("rain_mm", { precision: 5, scale: 2 }),
  humidity: integer("humidity"),
}, (table) => ({
  fixtureIdx: index("weather_fixture_idx").on(table.fixtureId),
}));

export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixture_id").references(() => fixtures.id).notNull(),
  modelVersion: varchar("model_version", { length: 50 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  pHome: decimal("p_home", { precision: 5, scale: 4 }).notNull(),
  pDraw: decimal("p_draw", { precision: 5, scale: 4 }).notNull(),
  pAway: decimal("p_away", { precision: 5, scale: 4 }).notNull(),
  fairHome: decimal("fair_home", { precision: 10, scale: 3 }),
  fairDraw: decimal("fair_draw", { precision: 10, scale: 3 }),
  fairAway: decimal("fair_away", { precision: 10, scale: 3 }),
  edgeHome: decimal("edge_home", { precision: 5, scale: 2 }),
  edgeDraw: decimal("edge_draw", { precision: 5, scale: 2 }),
  edgeAway: decimal("edge_away", { precision: 5, scale: 2 }),
  stake: decimal("stake", { precision: 10, scale: 2 }),
}, (table) => ({
  fixtureIdx: index("predictions_fixture_idx").on(table.fixtureId),
  modelIdx: index("predictions_model_idx").on(table.modelVersion),
}));

export const bets = pgTable("bets", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixture_id").references(() => fixtures.id).notNull(),
  market: varchar("market", { length: 100 }).notNull(),
  selection: varchar("selection", { length: 100 }).notNull(),
  stake: decimal("stake", { precision: 10, scale: 2 }).notNull(),
  odds: decimal("odds", { precision: 10, scale: 3 }).notNull(),
  placedAt: timestamp("placed_at").notNull().defaultNow(),
  result: varchar("result", { length: 50 }),
  pnl: decimal("pnl", { precision: 10, scale: 2 }),
}, (table) => ({
  fixtureIdx: index("bets_fixture_idx").on(table.fixtureId),
  placedIdx: index("bets_placed_idx").on(table.placedAt),
}));

export const validationFlags = pgTable("validation_flags", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixture_id").references(() => fixtures.id).notNull(),
  field: varchar("field", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  sources: jsonb("sources").$type<Array<{ name: string; value: string }>>().notNull(),
  resolver: varchar("resolver", { length: 100 }),
  comment: text("comment"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("validation_flags_status_idx").on(table.status),
  fixtureIdx: index("validation_flags_fixture_idx").on(table.fixtureId),
}));

export const modelRegistry = pgTable("model_registry", {
  id: serial("id").primaryKey(),
  version: varchar("version", { length: 50 }).notNull().unique(),
  algo: varchar("algo", { length: 100 }).notNull(),
  featuresHash: varchar("features_hash", { length: 64 }),
  trainSpan: varchar("train_span", { length: 100 }),
  metrics: jsonb("metrics").$type<Record<string, number>>(),
  deployed: boolean("deployed").notNull().default(false),
  deployedAt: timestamp("deployed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  deployedIdx: index("model_registry_deployed_idx").on(table.deployed),
}));

// Insert schemas
export const insertCompetitionSchema = createInsertSchema(competitions).omit({ id: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export const insertFixtureSchema = createInsertSchema(fixtures).omit({ id: true });
export const insertLineupSchema = createInsertSchema(lineups).omit({ id: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true });
export const insertOddsSchema = createInsertSchema(odds).omit({ id: true });
export const insertBoxscoreSchema = createInsertSchema(boxscore).omit({ id: true });
export const insertWeatherSchema = createInsertSchema(weather).omit({ id: true });
export const insertPredictionSchema = createInsertSchema(predictions).omit({ id: true });
export const insertBetSchema = createInsertSchema(bets).omit({ id: true });
export const insertValidationFlagSchema = createInsertSchema(validationFlags).omit({ id: true });
export const insertModelRegistrySchema = createInsertSchema(modelRegistry).omit({ id: true });

// Select types
export type Competition = typeof competitions.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Fixture = typeof fixtures.$inferSelect;
export type Lineup = typeof lineups.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Odds = typeof odds.$inferSelect;
export type Boxscore = typeof boxscore.$inferSelect;
export type Weather = typeof weather.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type Bet = typeof bets.$inferSelect;
export type ValidationFlag = typeof validationFlags.$inferSelect;
export type ModelRegistry = typeof modelRegistry.$inferSelect;

// Insert types
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertFixture = z.infer<typeof insertFixtureSchema>;
export type InsertLineup = z.infer<typeof insertLineupSchema>;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type InsertOdds = z.infer<typeof insertOddsSchema>;
export type InsertBoxscore = z.infer<typeof insertBoxscoreSchema>;
export type InsertWeather = z.infer<typeof insertWeatherSchema>;
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type InsertBet = z.infer<typeof insertBetSchema>;
export type InsertValidationFlag = z.infer<typeof insertValidationFlagSchema>;
export type InsertModelRegistry = z.infer<typeof insertModelRegistrySchema>;
