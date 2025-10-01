import { randomUUID } from "node:crypto";
import { describe, test, expect, beforeEach } from "../../test-shim";
import type { DatabaseInstance } from "../db/registry";
import { COMPETITIONS, TEAM_DATA } from "../data/sampleSeasons";
import { modelRegistry, predictions } from "@shared/schema";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/test";

let trainAndRegisterModel: typeof import("../services/models").trainAndRegisterModel;
let setDbFn: typeof import("../db/registry").setDb;
let resetDbFn: typeof import("../db/registry").resetDb;

interface MockFixture {
  id: string;
  seasonId: string;
  round?: number;
  matchDay?: number;
  stage?: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: Date;
  status: string;
  venue?: string;
  referee?: string;
  attendance?: number;
  homeScore: number | null;
  awayScore: number | null;
  odds: Array<{
    bookmaker: string;
    market: string;
    home: string;
    draw: string;
    away: string;
    updatedAt: Date;
  }>;
  weather: {
    temperatureC: string;
    humidity: number;
    windSpeedKph: string;
    condition: string;
    recordedAt: Date;
  } | null;
}

function toCamelCase(column: string): keyof MockFixture {
  const normalized = column.replace(/"/g, "");
  return normalized.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase()) as keyof MockFixture;
}

function resolveColumnName(column: unknown): string {
  if (typeof column === "string") {
    return column;
  }

  if (column && typeof column === "object") {
    if ("name" in column && typeof (column as any).name === "string") {
      return (column as any).name as string;
    }
    if ("columnName" in column && typeof (column as any).columnName === "string") {
      return (column as any).columnName as string;
    }
    if ("fieldName" in column && typeof (column as any).fieldName === "string") {
      return (column as any).fieldName as string;
    }
  }

  return String(column);
}

function toDateValue(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  return Number(value) || 0;
}

function buildFixtures(): MockFixture[] {
  const fixtures: MockFixture[] = [];

  for (const competition of COMPETITIONS) {
    for (const season of competition.seasons) {
      for (const fixture of season.fixtures) {
        const homeSeed = TEAM_DATA[fixture.homeTeam];
        const awaySeed = TEAM_DATA[fixture.awayTeam];
        if (!homeSeed || !awaySeed) {
          continue;
        }

        fixtures.push({
          id: fixture.id,
          seasonId: season.id,
          round: fixture.round,
          matchDay: fixture.matchDay,
          stage: fixture.stage,
          homeTeamId: homeSeed.id,
          awayTeamId: awaySeed.id,
          kickoffAt: new Date(fixture.kickoffAt),
          status: fixture.status,
          venue: fixture.venue,
          referee: fixture.referee,
          attendance: fixture.attendance,
          homeScore: fixture.status === "completed" ? fixture.result?.homeScore ?? null : null,
          awayScore: fixture.status === "completed" ? fixture.result?.awayScore ?? null : null,
          odds: (fixture.odds ?? []).map((entry) => ({
            bookmaker: entry.bookmaker,
            market: entry.market,
            home: entry.home,
            draw: entry.draw,
            away: entry.away,
            updatedAt: new Date(entry.updatedAt),
          })),
          weather: fixture.weather
            ? {
                temperatureC: fixture.weather.temperatureC,
                humidity: fixture.weather.humidity,
                windSpeedKph: fixture.weather.windSpeedKph,
                condition: fixture.weather.condition,
                recordedAt: new Date(fixture.weather.recordedAt),
              }
            : null,
        });
      }
    }
  }

  return fixtures;
}

function buildPredicate(where: any): ((fixture: MockFixture) => boolean) | null {
  if (!where) {
    return null;
  }

  const columnProxy = new Proxy(
    {},
    {
      get: (_, prop: string) => prop,
    },
  );

  const operators = {
    eq: (column: unknown, value: unknown) => {
      const key = toCamelCase(resolveColumnName(column));
      return (fixture: MockFixture) => fixture[key] === value;
    },
    ne: (column: unknown, value: unknown) => {
      const key = toCamelCase(resolveColumnName(column));
      return (fixture: MockFixture) => fixture[key] !== value;
    },
    lt: (column: unknown, value: unknown) => {
      const key = toCamelCase(resolveColumnName(column));
      return (fixture: MockFixture) => toDateValue(fixture[key]) < toDateValue(value);
    },
    lte: (column: unknown, value: unknown) => {
      const key = toCamelCase(resolveColumnName(column));
      return (fixture: MockFixture) => toDateValue(fixture[key]) <= toDateValue(value);
    },
    gt: (column: unknown, value: unknown) => {
      const key = toCamelCase(resolveColumnName(column));
      return (fixture: MockFixture) => toDateValue(fixture[key]) > toDateValue(value);
    },
    gte: (column: unknown, value: unknown) => {
      const key = toCamelCase(resolveColumnName(column));
      return (fixture: MockFixture) => toDateValue(fixture[key]) >= toDateValue(value);
    },
    and: (...predicates: Array<((fixture: MockFixture) => boolean) | undefined | null>) => {
      const filters = predicates.filter(Boolean) as Array<(fixture: MockFixture) => boolean>;
      return (fixture: MockFixture) => filters.every((predicate) => predicate(fixture));
    },
    or: (...predicates: Array<((fixture: MockFixture) => boolean) | undefined | null>) => {
      const filters = predicates.filter(Boolean) as Array<(fixture: MockFixture) => boolean>;
      if (!filters.length) {
        return () => true;
      }
      return (fixture: MockFixture) => filters.some((predicate) => predicate(fixture));
    },
    inArray: (column: unknown, values: unknown[]) => {
      const key = toCamelCase(resolveColumnName(column));
      return (fixture: MockFixture) => values.includes(fixture[key] as unknown);
    },
  } as const;

  const result = where(columnProxy, operators);
  return typeof result === "function" ? result : null;
}

function buildOrderClause(orderBy: any): Array<{ key: keyof MockFixture; direction: "asc" | "desc" }> {
  if (!orderBy) {
    return [];
  }

  const columnProxy = new Proxy(
    {},
    {
      get: (_, prop: string) => prop,
    },
  );

  const operators = {
    asc: (column: unknown) => ({ key: toCamelCase(resolveColumnName(column)), direction: "asc" as const }),
    desc: (column: unknown) => ({ key: toCamelCase(resolveColumnName(column)), direction: "desc" as const }),
  } as const;

  const clause = orderBy(columnProxy, operators);
  if (!clause) {
    return [];
  }

  return Array.isArray(clause) ? clause : [clause];
}

class MockDb {
  readonly fixtures: MockFixture[];
  readonly modelRows: any[] = [];
  readonly predictionRows: any[] = [];

  constructor(fixtures: MockFixture[]) {
    this.fixtures = fixtures;
  }

  query = {
    fixtures: {
      findMany: async (config: any) => {
        const predicate = buildPredicate(config?.where);
        const order = buildOrderClause(config?.orderBy);
        const limit = config?.limit as number | undefined;

        let rows = this.fixtures.slice();
        if (predicate) {
          rows = rows.filter((row) => predicate(row));
        }

        if (order.length) {
          rows.sort((a, b) => {
            for (const clause of order) {
              const left = a[clause.key];
              const right = b[clause.key];
              if (left === right) {
                continue;
              }

              const comparison = toDateValue(left) - toDateValue(right);
              if (comparison !== 0) {
                return clause.direction === "asc" ? comparison : -comparison;
              }
            }
            return 0;
          });
        }

        if (typeof limit === "number") {
          rows = rows.slice(0, limit);
        }

        return rows.map((row) => ({
          ...row,
          odds: row.odds.map((entry) => ({ ...entry })),
          weather: row.weather ? { ...row.weather } : null,
        }));
      },
      findFirst: async (config: any) => {
        const rows = await this.query.fixtures.findMany({ ...config, limit: 1 });
        return rows[0] ?? null;
      },
    },
  };

  insert(table: unknown) {
    return {
      values: (payload: any) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        const inserted = rows.map((row) => this.applyInsert(table, row));
        const builder = {
          onConflictDoUpdate: () => builder,
          onConflictDoNothing: () => builder,
          returning: async () => inserted,
        };
        return builder;
      },
    };
  }

  update(_table: unknown) {
    return {
      set: (_payload: any) => ({
        where: async (_predicate: any) => undefined,
      }),
    };
  }

  async transaction<T>(callback: (tx: { insert: typeof this.insert; update: typeof this.update }) => Promise<T> | T): Promise<T> {
    return await callback({
      insert: this.insert.bind(this),
      update: this.update.bind(this),
    });
  }

  private applyInsert(table: unknown, row: any) {
    if (table === modelRegistry) {
      const record = {
        ...row,
        id: row.id ?? randomUUID(),
        createdAt: row.createdAt ?? new Date(),
      };
      this.modelRows.push(record);
      return record;
    }

    if (table === predictions) {
      const record = {
        ...row,
        id: row.id ?? randomUUID(),
        createdAt: row.createdAt ?? new Date(),
      };
      this.predictionRows.push(record);
      return record;
    }

    return row;
  }
}

describe("trainAndRegisterModel integration", () => {
  let mockDb: MockDb;

  beforeEach(async () => {
    if (!trainAndRegisterModel || !setDbFn || !resetDbFn) {
      const [models, registry] = await Promise.all([
        import("../services/models"),
        import("../db/registry"),
      ]);
      trainAndRegisterModel = models.trainAndRegisterModel;
      setDbFn = registry.setDb;
      resetDbFn = registry.resetDb;
    }

    resetDbFn();
    mockDb = new MockDb(buildFixtures());
    setDbFn(mockDb as unknown as DatabaseInstance);
  });

  test("trains and registers a model using historical fixtures", async () => {
    const result = await trainAndRegisterModel({
      modelName: "integration-test",
      version: "9.9.9",
      description: "integration smoke test",
      algorithm: "logit",
      holdoutRatio: 0.4,
      trainingWindow: {
        start: new Date("2024-05-01T00:00:00Z"),
        end: new Date("2024-06-30T23:59:59Z"),
      },
    });

    expect(result.summary.name).toBe("integration-test");
    expect(result.summary.version).toBe("9.9.9");
    expect(result.training.metrics.sampleSizes.training).toBeGreaterThan(0);
    expect(result.training.metrics.sampleSizes.backtest).toBeGreaterThan(0);
    expect(result.training.predictions.length).toBe(mockDb.predictionRows.length);
    expect(mockDb.modelRows).toHaveLength(1);
    expect(mockDb.predictionRows.length).toBeGreaterThan(0);
    expect(mockDb.predictionRows[0]?.fixtureId).toBeDefined();

    resetDbFn();
  });
});
