import { describe, test, expect } from "../../test-shim";
import { etlJobRuns, validationFlags } from "@shared/schema";
import {
  connectorRegistry,
  getConnector,
  listConnectors,
  runConnector,
} from "./index";
import type { Database } from "./types";

type InsertCall = { table: unknown; values: any };

type UpdateCall = { table: unknown; payload: any };

function createMockDb() {
  const insertCalls: InsertCall[] = [];
  const updateCalls: UpdateCall[] = [];

  const db = {
    insert(table: unknown) {
      return {
        values(values: any) {
          insertCalls.push({ table, values });
          if (table === etlJobRuns) {
            return {
              returning: async () => [{ id: "run-1" }],
            };
          }

          return {
            returning: async () => values,
          };
        },
        onConflictDoUpdate() {
          return {
            returning: async () => [{ id: "run-1" }],
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(payload: any) {
          return {
            where: async () => {
              updateCalls.push({ table, payload });
            },
          };
        },
      };
    },
  } as unknown as Database;

  return { db, insertCalls, updateCalls };
}

describe("etl service", () => {
  test("exposes registered connectors", () => {
    const connectors = listConnectors();
    expect(connectors.length).toBeGreaterThan(0);
    for (const connector of connectors) {
      expect(connectorRegistry[connector.id]).toBe(connector);
    }
  });

  test("returns a connector by id", () => {
    const connectors = listConnectors();
    const sample = connectors[0];
    expect(getConnector(sample.id)).toBe(sample);
    expect(getConnector("unknown")).toBeUndefined();
  });

  test("persists successful connector runs", async () => {
    const { db, insertCalls, updateCalls } = createMockDb();
    const escalations: any[] = [];
    const failures: any[] = [];
    const connector = {
      id: "sample",
      label: "Sample",
      async execute() {
        return {
          recordsProcessed: 5,
          successRate: 0.8,
          anomalies: [],
          logs: [],
        };
      },
    };

    await runConnector({
      jobName: "daily",
      connector,
      db,
      notifier: {
        notifyEscalation: (payload) => escalations.push(payload),
        notifyFailure: (payload) => failures.push(payload),
      },
    });

    expect(insertCalls[0]?.table).toBe(etlJobRuns);
    expect(updateCalls.length).toBe(1);
    expect(escalations.length).toBe(0);
    expect(failures.length).toBe(0);
  });

  test("escalates high severity anomalies", async () => {
    const { db } = createMockDb();
    const escalations: any[] = [];
    const connector = {
      id: "sample",
      label: "Sample",
      async execute() {
        return {
          recordsProcessed: 1,
          successRate: 0.5,
          anomalies: [
            { fixtureId: "fx-1", severity: "high", reason: "Mismatch" },
            { severity: "low", reason: "Minor" },
          ],
          logs: [],
        };
      },
    };

    await runConnector({
      jobName: "daily",
      connector,
      db,
      notifier: {
        notifyEscalation: (payload) => escalations.push(payload),
        notifyFailure: () => {
          throw new Error("unexpected failure call");
        },
      },
    });

    expect(escalations.length).toBe(1);
    expect(escalations[0].title).toContain("Sample");
  });

  test("handles connector failures", async () => {
    const { db, updateCalls } = createMockDb();
    const failures: any[] = [];
    const connector = {
      id: "sample",
      label: "Sample",
      async execute() {
        throw new Error("boom");
      },
    };

    await runConnector({
      jobName: "daily",
      connector,
      db,
      notifier: {
        notifyEscalation: () => undefined,
        notifyFailure: (payload) => failures.push(payload),
      },
    });

    expect(failures.length).toBe(1);
    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].payload.status).toBe("error");
  });

  test("records anomalies in validation flags", async () => {
    const { db, insertCalls } = createMockDb();
    const connector = {
      id: "sample",
      label: "Sample",
      async execute() {
        return {
          recordsProcessed: 1,
          successRate: 1,
          anomalies: [
            { fixtureId: "fx-1", severity: "low", reason: "Check" },
          ],
          logs: [],
        };
      },
    };

    await runConnector({
      jobName: "daily",
      connector,
      db,
      notifier: {
        notifyEscalation: () => undefined,
        notifyFailure: () => undefined,
      },
    });

    const validationInsert = insertCalls.find((call) => call.table === validationFlags);
    expect(validationInsert).toBeDefined();
    expect((validationInsert as InsertCall | undefined)?.values?.reason).toBe("Check");
  });
});
