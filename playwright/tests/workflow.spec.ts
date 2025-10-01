import { test, expect } from "../../playwright-shim";
import type { Database } from "../../server/etl/types";
import type { NotificationDispatcher, NotificationMessage } from "../../server/notifications";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/test";

const { runConnector } = await import("../../server/etl");
const { clearTraces, getFixtureTraces } = await import("../../server/logging");
const { __testing: featureTesting, FEATURE_KEYS } = await import("../../server/models/features");
const { __testing: bankrollTesting } = await import("../../server/services/bankroll");
const { __testing: modelsTesting } = await import("../../server/services/models");

test.describe("end-to-end domain workflow", () => {
  test("intake to review", async () => {
    clearTraces();

    const records: Array<{ type: "escalation" | "failure"; payload: NotificationMessage }> = [];
    const createMockDb = (): Database => {
      return {
        insert: () => ({
          values: () => ({
            returning: async () => [{ id: "run-1" }],
          }),
        }),
        update: () => ({
          set: () => ({
            where: async () => undefined,
          }),
        }),
      } as unknown as Database;
    };

    const notifier: NotificationDispatcher = {
      async notifyEscalation(payload) {
        records.push({ type: "escalation", payload });
      },
      async notifyFailure(payload) {
        records.push({ type: "failure", payload });
      },
    };

    await runConnector({
      jobName: "intake",
      connector: {
        id: "test",
        label: "Test Connector",
        execute: async () => ({
          recordsProcessed: 3,
          successRate: 0.75,
          anomalies: [
            {
              connectorId: "test",
              fixtureId: "fx-1",
              field: "score",
              severity: "high",
              reason: "Score mismatch",
              sources: [
                { name: "fixture_feed", value: "24-18" },
                { name: "odds_feed", value: "24-20" },
              ],
            },
          ],
          logs: [],
        }),
      },
      db: createMockDb(),
      notifier,
    });

    expect(records.some((item) => item.type === "escalation")).toBeTruthy();

    const traces = getFixtureTraces("fx-1");
    expect(traces.length).toBeGreaterThan(0);

    const recentFixtures = [
      {
        homeTeamId: "home",
        awayTeamId: "away",
        homeScore: 24,
        awayScore: 18,
        kickoffAt: new Date("2024-01-01T12:00:00.000Z"),
      },
    ];
    const fixture = {
      id: "fx-1",
      kickoffAt: new Date("2024-01-10T12:00:00.000Z"),
      homeTeamId: "home",
      awayTeamId: "away",
      odds: [],
      weather: null,
    } as any;

    const form = featureTesting.computeFormRating(recentFixtures as any, "home");
    expect(form.rating).toBeGreaterThan(50);

    const restDays = featureTesting.computeRestDays(fixture, recentFixtures as any);
    expect(restDays).toBeGreaterThan(5);

    const vector = featureTesting.vectorToArray(
      Object.fromEntries(FEATURE_KEYS.map((key) => [key, 1])) as any,
    );
    expect(vector).toHaveLength(FEATURE_KEYS.length);

    const betView = bankrollTesting.buildBetView({
      id: "bet-1",
      fixtureId: "fx-1",
      fixture: {
        id: "fx-1",
        kickoffAt: new Date("2024-01-10T12:00:00.000Z"),
        season: { competition: { name: "League" } },
        homeTeam: { id: "home", name: "Home" },
        awayTeam: { id: "away", name: "Away" },
      },
      betType: "1X2",
      selection: "Home",
      oddsTaken: "2.2",
      stake: "25",
      potentialPayout: "55",
      status: "pending",
      placedAt: new Date(),
      settledAt: null,
      prediction: null,
      notes: null,
    } as any);

    expect(betView.stake).toBeCloseTo(25);

    const mergedMetrics = modelsTesting.mergeMetrics(
      { status: "staging", statusHistory: [] } as any,
      { status: "production" },
    );
    expect(mergedMetrics.status).toBe("production");
  });
});
