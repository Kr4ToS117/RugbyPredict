import { db } from "./db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  Competition,
  Team,
  Fixture,
  Lineup,
  Event,
  Odds,
  Boxscore,
  Weather,
  Prediction,
  Bet,
  ValidationFlag,
  ModelRegistry,
  InsertCompetition,
  InsertTeam,
  InsertFixture,
  InsertLineup,
  InsertEvent,
  InsertOdds,
  InsertBoxscore,
  InsertWeather,
  InsertPrediction,
  InsertBet,
  InsertValidationFlag,
  InsertModelRegistry,
} from "@shared/schema";

export interface IStorage {
  // Competitions
  getCompetitions(): Promise<Competition[]>;
  createCompetition(data: InsertCompetition): Promise<Competition>;

  // Teams
  getTeamsByCompetition(competitionId: number): Promise<Team[]>;
  createTeam(data: InsertTeam): Promise<Team>;

  // Fixtures
  getFixtures(filters?: {
    competitionId?: number;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<Fixture[]>;
  getFixtureById(id: number): Promise<Fixture | undefined>;
  createFixture(data: InsertFixture): Promise<Fixture>;
  updateFixtureScore(id: number, scoreHome: number, scoreAway: number): Promise<void>;

  // Lineups
  getLineupsByFixture(fixtureId: number): Promise<Lineup[]>;
  createLineup(data: InsertLineup): Promise<Lineup>;

  // Events
  getEventsByFixture(fixtureId: number): Promise<Event[]>;
  createEvent(data: InsertEvent): Promise<Event>;

  // Odds
  getOddsByFixture(fixtureId: number): Promise<Odds[]>;
  createOdds(data: InsertOdds): Promise<Odds>;

  // Boxscore
  getBoxscoreByFixture(fixtureId: number): Promise<Boxscore | undefined>;
  createBoxscore(data: InsertBoxscore): Promise<Boxscore>;

  // Weather
  getWeatherByFixture(fixtureId: number): Promise<Weather[]>;
  createWeather(data: InsertWeather): Promise<Weather>;

  // Predictions
  getPredictionsByFixture(fixtureId: number): Promise<Prediction | undefined>;
  createPrediction(data: InsertPrediction): Promise<Prediction>;

  // Bets
  getBets(filters?: { fromDate?: Date; toDate?: Date }): Promise<Bet[]>;
  createBet(data: InsertBet): Promise<Bet>;
  updateBetResult(id: number, result: string, pnl: number): Promise<void>;

  // Validation Flags
  getValidationFlags(status?: string): Promise<ValidationFlag[]>;
  createValidationFlag(data: InsertValidationFlag): Promise<ValidationFlag>;
  resolveValidationFlag(id: number, resolver: string, comment?: string): Promise<void>;

  // Models
  getModels(): Promise<ModelRegistry[]>;
  getDeployedModel(): Promise<ModelRegistry | undefined>;
  createModel(data: InsertModelRegistry): Promise<ModelRegistry>;
  deployModel(version: string): Promise<void>;
}

export class DbStorage implements IStorage {
  // Competitions
  async getCompetitions(): Promise<Competition[]> {
    return await db.select().from(schema.competitions);
  }

  async createCompetition(data: InsertCompetition): Promise<Competition> {
    const [competition] = await db.insert(schema.competitions).values(data).returning();
    return competition;
  }

  // Teams
  async getTeamsByCompetition(competitionId: number): Promise<Team[]> {
    return await db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.competitionId, competitionId));
  }

  async createTeam(data: InsertTeam): Promise<Team> {
    const [team] = await db.insert(schema.teams).values([data]).returning();
    return team;
  }

  // Fixtures
  async getFixtures(filters?: {
    competitionId?: number;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<Fixture[]> {
    let query = db.select().from(schema.fixtures);

    const conditions = [];
    if (filters?.competitionId) {
      conditions.push(eq(schema.fixtures.competitionId, filters.competitionId));
    }
    if (filters?.status) {
      conditions.push(eq(schema.fixtures.status, filters.status));
    }
    if (filters?.fromDate) {
      conditions.push(gte(schema.fixtures.dateUtc, filters.fromDate));
    }
    if (filters?.toDate) {
      conditions.push(lte(schema.fixtures.dateUtc, filters.toDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(schema.fixtures.dateUtc);
  }

  async getFixtureById(id: number): Promise<Fixture | undefined> {
    const [fixture] = await db
      .select()
      .from(schema.fixtures)
      .where(eq(schema.fixtures.id, id));
    return fixture;
  }

  async createFixture(data: InsertFixture): Promise<Fixture> {
    const [fixture] = await db.insert(schema.fixtures).values(data).returning();
    return fixture;
  }

  async updateFixtureScore(id: number, scoreHome: number, scoreAway: number): Promise<void> {
    await db
      .update(schema.fixtures)
      .set({ scoreHome, scoreAway, status: "completed" })
      .where(eq(schema.fixtures.id, id));
  }

  // Lineups
  async getLineupsByFixture(fixtureId: number): Promise<Lineup[]> {
    return await db
      .select()
      .from(schema.lineups)
      .where(eq(schema.lineups.fixtureId, fixtureId));
  }

  async createLineup(data: InsertLineup): Promise<Lineup> {
    const [lineup] = await db.insert(schema.lineups).values(data).returning();
    return lineup;
  }

  // Events
  async getEventsByFixture(fixtureId: number): Promise<Event[]> {
    return await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.fixtureId, fixtureId))
      .orderBy(schema.events.minute);
  }

  async createEvent(data: InsertEvent): Promise<Event> {
    const [event] = await db.insert(schema.events).values(data).returning();
    return event;
  }

  // Odds
  async getOddsByFixture(fixtureId: number): Promise<Odds[]> {
    return await db
      .select()
      .from(schema.odds)
      .where(eq(schema.odds.fixtureId, fixtureId))
      .orderBy(desc(schema.odds.timestamp));
  }

  async createOdds(data: InsertOdds): Promise<Odds> {
    const [odds] = await db.insert(schema.odds).values(data).returning();
    return odds;
  }

  // Boxscore
  async getBoxscoreByFixture(fixtureId: number): Promise<Boxscore | undefined> {
    const [boxscore] = await db
      .select()
      .from(schema.boxscore)
      .where(eq(schema.boxscore.fixtureId, fixtureId));
    return boxscore;
  }

  async createBoxscore(data: InsertBoxscore): Promise<Boxscore> {
    const [boxscore] = await db.insert(schema.boxscore).values(data).returning();
    return boxscore;
  }

  // Weather
  async getWeatherByFixture(fixtureId: number): Promise<Weather[]> {
    return await db
      .select()
      .from(schema.weather)
      .where(eq(schema.weather.fixtureId, fixtureId))
      .orderBy(desc(schema.weather.timestamp));
  }

  async createWeather(data: InsertWeather): Promise<Weather> {
    const [weather] = await db.insert(schema.weather).values(data).returning();
    return weather;
  }

  // Predictions
  async getPredictionsByFixture(fixtureId: number): Promise<Prediction | undefined> {
    const [prediction] = await db
      .select()
      .from(schema.predictions)
      .where(eq(schema.predictions.fixtureId, fixtureId))
      .orderBy(desc(schema.predictions.timestamp))
      .limit(1);
    return prediction;
  }

  async createPrediction(data: InsertPrediction): Promise<Prediction> {
    const [prediction] = await db.insert(schema.predictions).values(data).returning();
    return prediction;
  }

  // Bets
  async getBets(filters?: { fromDate?: Date; toDate?: Date }): Promise<Bet[]> {
    let query = db.select().from(schema.bets);

    const conditions = [];
    if (filters?.fromDate) {
      conditions.push(gte(schema.bets.placedAt, filters.fromDate));
    }
    if (filters?.toDate) {
      conditions.push(lte(schema.bets.placedAt, filters.toDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(desc(schema.bets.placedAt));
  }

  async createBet(data: InsertBet): Promise<Bet> {
    const [bet] = await db.insert(schema.bets).values(data).returning();
    return bet;
  }

  async updateBetResult(id: number, result: string, pnl: number): Promise<void> {
    await db
      .update(schema.bets)
      .set({ result, pnl: pnl.toString() })
      .where(eq(schema.bets.id, id));
  }

  // Validation Flags
  async getValidationFlags(status?: string): Promise<ValidationFlag[]> {
    let query = db.select().from(schema.validationFlags);

    if (status) {
      query = query.where(eq(schema.validationFlags.status, status)) as any;
    }

    return await query.orderBy(desc(schema.validationFlags.createdAt));
  }

  async createValidationFlag(data: InsertValidationFlag): Promise<ValidationFlag> {
    const [flag] = await db.insert(schema.validationFlags).values([data]).returning();
    return flag;
  }

  async resolveValidationFlag(id: number, resolver: string, comment?: string): Promise<void> {
    await db
      .update(schema.validationFlags)
      .set({
        status: "resolved",
        resolver,
        comment,
        resolvedAt: new Date(),
      })
      .where(eq(schema.validationFlags.id, id));
  }

  // Models
  async getModels(): Promise<ModelRegistry[]> {
    return await db
      .select()
      .from(schema.modelRegistry)
      .orderBy(desc(schema.modelRegistry.createdAt));
  }

  async getDeployedModel(): Promise<ModelRegistry | undefined> {
    const [model] = await db
      .select()
      .from(schema.modelRegistry)
      .where(eq(schema.modelRegistry.deployed, true))
      .orderBy(desc(schema.modelRegistry.deployedAt))
      .limit(1);
    return model;
  }

  async createModel(data: InsertModelRegistry): Promise<ModelRegistry> {
    const [model] = await db.insert(schema.modelRegistry).values(data).returning();
    return model;
  }

  async deployModel(version: string): Promise<void> {
    // Undeploy all current models
    await db
      .update(schema.modelRegistry)
      .set({ deployed: false, deployedAt: null })
      .where(eq(schema.modelRegistry.deployed, true));

    // Deploy the specified version
    await db
      .update(schema.modelRegistry)
      .set({ deployed: true, deployedAt: new Date() })
      .where(eq(schema.modelRegistry.version, version));
  }
}

export const storage = new DbStorage();
