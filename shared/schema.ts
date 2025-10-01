import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable(
  "users",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    username: text("username").notNull().unique(),
    password: text("password").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    usernameIdx: uniqueIndex("users_username_idx").on(table.username),
  }),
);

export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    country: text("country"),
    level: text("level"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    codeIdx: uniqueIndex("competitions_code_idx").on(table.code),
    nameIdx: index("competitions_name_idx").on(table.name),
  }),
);

export const seasons = pgTable(
  "seasons",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    competitionId: uuid("competition_id")
      .references(() => competitions.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    year: integer("year"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    competitionIdx: index("seasons_competition_idx").on(table.competitionId),
    nameIdx: uniqueIndex("seasons_competition_name_idx").on(
      table.competitionId,
      table.name,
    ),
  }),
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    shortName: varchar("short_name", { length: 32 }),
    code: varchar("code", { length: 16 }),
    foundedYear: smallint("founded_year"),
    city: text("city"),
    country: text("country"),
    primaryColor: varchar("primary_color", { length: 16 }),
    secondaryColor: varchar("secondary_color", { length: 16 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nameIdx: uniqueIndex("teams_name_idx").on(table.name),
    codeIdx: uniqueIndex("teams_code_idx").on(table.code),
  }),
);

export const teamSeasons = pgTable(
  "team_seasons",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    seasonId: uuid("season_id")
      .references(() => seasons.id, { onDelete: "cascade" })
      .notNull(),
    competitionId: uuid("competition_id")
      .references(() => competitions.id, { onDelete: "cascade" })
      .notNull(),
    groupName: text("group_name"),
    homeStadium: text("home_stadium"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    teamSeasonIdx: uniqueIndex("team_seasons_team_season_idx").on(
      table.teamId,
      table.seasonId,
    ),
    seasonIdx: index("team_seasons_season_idx").on(table.seasonId),
  }),
);

export const fixtures = pgTable(
  "fixtures",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    seasonId: uuid("season_id")
      .references(() => seasons.id, { onDelete: "cascade" })
      .notNull(),
    round: integer("round"),
    matchDay: integer("match_day"),
    stage: text("stage"),
    homeTeamId: uuid("home_team_id")
      .references(() => teams.id, { onDelete: "restrict" })
      .notNull(),
    awayTeamId: uuid("away_team_id")
      .references(() => teams.id, { onDelete: "restrict" })
      .notNull(),
    venue: text("venue"),
    referee: text("referee"),
    attendance: integer("attendance"),
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
    status: text("status").default("scheduled").notNull(),
    homeScore: smallint("home_score"),
    awayScore: smallint("away_score"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    seasonIdx: index("fixtures_season_idx").on(table.seasonId),
    kickoffIdx: index("fixtures_kickoff_idx").on(table.kickoffAt),
    teamsIdx: index("fixtures_teams_idx").on(table.homeTeamId, table.awayTeamId),
  }),
);

export const lineups = pgTable(
  "lineups",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    fixtureId: uuid("fixture_id")
      .references(() => fixtures.id, { onDelete: "cascade" })
      .notNull(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    formation: varchar("formation", { length: 32 }),
    tactic: text("tactic"),
    coach: text("coach"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    fixtureTeamIdx: uniqueIndex("lineups_fixture_team_idx").on(
      table.fixtureId,
      table.teamId,
    ),
  }),
);

export const lineupPlayers = pgTable(
  "lineup_players",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    lineupId: uuid("lineup_id")
      .references(() => lineups.id, { onDelete: "cascade" })
      .notNull(),
    playerName: text("player_name").notNull(),
    position: varchar("position", { length: 32 }),
    shirtNumber: smallint("shirt_number"),
    isStarting: boolean("is_starting").default(true).notNull(),
    minuteOn: smallint("minute_on"),
    minuteOff: smallint("minute_off"),
  },
  (table) => ({
    lineupIdx: index("lineup_players_lineup_idx").on(table.lineupId),
  }),
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    fixtureId: uuid("fixture_id")
      .references(() => fixtures.id, { onDelete: "cascade" })
      .notNull(),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    playerName: text("player_name"),
    eventType: text("event_type").notNull(),
    minute: smallint("minute"),
    second: smallint("second"),
    period: varchar("period", { length: 16 }),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    fixtureIdx: index("events_fixture_idx").on(table.fixtureId),
    teamIdx: index("events_team_idx").on(table.teamId),
  }),
);

export const odds = pgTable(
  "odds",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    fixtureId: uuid("fixture_id")
      .references(() => fixtures.id, { onDelete: "cascade" })
      .notNull(),
    bookmaker: text("bookmaker").notNull(),
    market: text("market").notNull(),
    home: numeric("home", { precision: 8, scale: 3 }),
    draw: numeric("draw", { precision: 8, scale: 3 }),
    away: numeric("away", { precision: 8, scale: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    fixtureIdx: index("odds_fixture_idx").on(table.fixtureId),
    uniqueMarketIdx: uniqueIndex("odds_fixture_market_idx").on(
      table.fixtureId,
      table.bookmaker,
      table.market,
    ),
  }),
);

export const weather = pgTable(
  "weather",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    fixtureId: uuid("fixture_id")
      .references(() => fixtures.id, { onDelete: "cascade" })
      .notNull(),
    temperatureC: numeric("temperature_c", { precision: 5, scale: 2 }),
    humidity: smallint("humidity"),
    windSpeedKph: numeric("wind_speed_kph", { precision: 5, scale: 2 }),
    condition: text("condition"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    fixtureIdx: uniqueIndex("weather_fixture_idx").on(table.fixtureId),
  }),
);

export const modelRegistry = pgTable(
  "model_registry",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    version: text("version").notNull(),
    description: text("description"),
    trainingWindow: text("training_window"),
    hyperparameters: jsonb("hyperparameters"),
    metrics: jsonb("metrics"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nameVersionIdx: uniqueIndex("model_registry_name_version_idx").on(
      table.name,
      table.version,
    ),
  }),
);

export const predictions = pgTable(
  "predictions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    fixtureId: uuid("fixture_id")
      .references(() => fixtures.id, { onDelete: "cascade" })
      .notNull(),
    modelId: uuid("model_id")
      .references(() => modelRegistry.id, { onDelete: "cascade" })
      .notNull(),
    homeWinProbability: numeric("home_win_probability", { precision: 5, scale: 4 })
      .notNull(),
    drawProbability: numeric("draw_probability", { precision: 5, scale: 4 }),
    awayWinProbability: numeric("away_win_probability", { precision: 5, scale: 4 })
      .notNull(),
    expectedHomeScore: numeric("expected_home_score", { precision: 5, scale: 2 }),
    expectedAwayScore: numeric("expected_away_score", { precision: 5, scale: 2 }),
    explanation: jsonb("explanation"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    fixtureModelIdx: uniqueIndex("predictions_fixture_model_idx").on(
      table.fixtureId,
      table.modelId,
    ),
    fixtureIdx: index("predictions_fixture_idx").on(table.fixtureId),
  }),
);

export const validationFlags = pgTable(
  "validation_flags",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    predictionId: uuid("prediction_id").references(() => predictions.id, {
      onDelete: "cascade",
    }),
    level: varchar("level", { length: 16 }).notNull(),
    reason: text("reason").notNull(),
    resolved: boolean("resolved").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    source: text("source"),
    details: jsonb("details"),
  },
  (table) => ({
    predictionIdx: index("validation_flags_prediction_idx").on(table.predictionId),
  }),
);

export const etlJobRuns = pgTable(
  "etl_job_runs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    jobName: text("job_name").notNull(),
    connectorName: text("connector_name").notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    recordsProcessed: integer("records_processed"),
    successRate: numeric("success_rate", { precision: 5, scale: 2 }),
    issues: integer("issues"),
    metadata: jsonb("metadata"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    jobIdx: index("etl_job_runs_job_idx").on(table.jobName),
    connectorIdx: index("etl_job_runs_connector_idx").on(table.connectorName),
    startedIdx: index("etl_job_runs_started_idx").on(table.startedAt),
  }),
);

export const bets = pgTable(
  "bets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    fixtureId: uuid("fixture_id")
      .references(() => fixtures.id, { onDelete: "cascade" })
      .notNull(),
    predictionId: uuid("prediction_id").references(() => predictions.id, {
      onDelete: "set null",
    }),
    betType: text("bet_type").notNull(),
    selection: text("selection").notNull(),
    oddsTaken: numeric("odds_taken", { precision: 8, scale: 3 }).notNull(),
    stake: numeric("stake", { precision: 10, scale: 2 }).notNull(),
    potentialPayout: numeric("potential_payout", { precision: 12, scale: 2 }),
    status: varchar("status", { length: 16 }).default("pending").notNull(),
    placedAt: timestamp("placed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (table) => ({
    userIdx: index("bets_user_idx").on(table.userId),
    fixtureIdx: index("bets_fixture_idx").on(table.fixtureId),
  }),
);

export const competitionRelations = relations(competitions, ({ many }) => ({
  seasons: many(seasons),
  teamSeasons: many(teamSeasons),
}));

export const seasonRelations = relations(seasons, ({ many, one }) => ({
  competition: one(competitions, {
    fields: [seasons.competitionId],
    references: [competitions.id],
  }),
  fixtures: many(fixtures),
  teamSeasons: many(teamSeasons),
}));

export const teamRelations = relations(teams, ({ many }) => ({
  homeFixtures: many(fixtures, { relationName: "homeTeam" }),
  awayFixtures: many(fixtures, { relationName: "awayTeam" }),
  lineups: many(lineups),
  teamSeasons: many(teamSeasons),
}));

export const teamSeasonRelations = relations(teamSeasons, ({ one }) => ({
  team: one(teams, {
    fields: [teamSeasons.teamId],
    references: [teams.id],
  }),
  season: one(seasons, {
    fields: [teamSeasons.seasonId],
    references: [seasons.id],
  }),
  competition: one(competitions, {
    fields: [teamSeasons.competitionId],
    references: [competitions.id],
  }),
}));

export const fixtureRelations = relations(fixtures, ({ one, many }) => ({
  season: one(seasons, {
    fields: [fixtures.seasonId],
    references: [seasons.id],
  }),
  homeTeam: one(teams, {
    fields: [fixtures.homeTeamId],
    references: [teams.id],
    relationName: "homeTeam",
  }),
  awayTeam: one(teams, {
    fields: [fixtures.awayTeamId],
    references: [teams.id],
    relationName: "awayTeam",
  }),
  lineups: many(lineups),
  events: many(events),
  odds: many(odds),
  weather: one(weather),
  predictions: many(predictions),
  bets: many(bets),
}));

export const lineupRelations = relations(lineups, ({ one, many }) => ({
  fixture: one(fixtures, {
    fields: [lineups.fixtureId],
    references: [fixtures.id],
  }),
  team: one(teams, {
    fields: [lineups.teamId],
    references: [teams.id],
  }),
  players: many(lineupPlayers),
}));

export const lineupPlayersRelations = relations(
  lineupPlayers,
  ({ one }) => ({
    lineup: one(lineups, {
      fields: [lineupPlayers.lineupId],
      references: [lineups.id],
    }),
  }),
);

export const eventRelations = relations(events, ({ one }) => ({
  fixture: one(fixtures, {
    fields: [events.fixtureId],
    references: [fixtures.id],
  }),
  team: one(teams, {
    fields: [events.teamId],
    references: [teams.id],
  }),
}));

export const oddsRelations = relations(odds, ({ one }) => ({
  fixture: one(fixtures, {
    fields: [odds.fixtureId],
    references: [fixtures.id],
  }),
}));

export const weatherRelations = relations(weather, ({ one }) => ({
  fixture: one(fixtures, {
    fields: [weather.fixtureId],
    references: [fixtures.id],
  }),
}));

export const modelRelations = relations(modelRegistry, ({ many }) => ({
  predictions: many(predictions),
}));

export const predictionRelations = relations(predictions, ({ one, many }) => ({
  fixture: one(fixtures, {
    fields: [predictions.fixtureId],
    references: [fixtures.id],
  }),
  model: one(modelRegistry, {
    fields: [predictions.modelId],
    references: [modelRegistry.id],
  }),
  validationFlags: many(validationFlags),
  bets: many(bets),
}));

export const validationFlagRelations = relations(
  validationFlags,
  ({ one }) => ({
    prediction: one(predictions, {
      fields: [validationFlags.predictionId],
      references: [predictions.id],
    }),
  }),
);

export const betRelations = relations(bets, ({ one }) => ({
  user: one(users, {
    fields: [bets.userId],
    references: [users.id],
  }),
  fixture: one(fixtures, {
    fields: [bets.fixtureId],
    references: [fixtures.id],
  }),
  prediction: one(predictions, {
    fields: [bets.predictionId],
    references: [predictions.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Competition = typeof competitions.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Fixture = typeof fixtures.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type Bet = typeof bets.$inferSelect;
export type ValidationFlag = typeof validationFlags.$inferSelect;
export type EtlJobRun = typeof etlJobRuns.$inferSelect;
