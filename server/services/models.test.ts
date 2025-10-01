import { test, expect } from "../../test-shim";
import { modelRegistry } from "@shared/schema";
import { __testing } from "./models";

const {
  coerceMetrics,
  mergeMetrics,
  bumpPatch,
  mapRowToSummary,
  buildStatusHistory,
} = __testing;

test("normalizes raw metrics", () => {
  const metrics = coerceMetrics({ status: "production", trainedAt: "2024-01-01T00:00:00.000Z" });
  expect(metrics.status).toBe("production");
  expect(metrics.trainedAt).toBe("2024-01-01T00:00:00.000Z");
});

test("merges metric updates", () => {
  const base = { status: "staging", statusHistory: [{ status: "staging", at: "yesterday" }] } as any;
  const merged = mergeMetrics(base, { status: "production" });
  expect(merged.status).toBe("production");
  expect(merged.statusHistory).toEqual(base.statusHistory);
});

test("bumps semantic versions", () => {
  expect(bumpPatch("1.0.0")).toBe("1.0.1");
  expect(bumpPatch("2.3")).toBe("2.3.1");
});

test("maps registry rows to summaries", () => {
  const row: typeof modelRegistry.$inferSelect = {
    id: "model-1",
    name: "Main",
    version: "1.0.0",
    description: "Primary model",
    algorithm: "gbm",
    trainingWindow: "30d",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: null,
    hyperparameters: { algorithm: "gbm" },
    metrics: { status: "production" },
  } as any;

  const summary = mapRowToSummary(row);
  expect(summary.id).toBe("model-1");
  expect(summary.status).toBe("production");
  expect(summary.hyperparameters?.algorithm).toBe("gbm");
});

test("builds status history", () => {
  const history = buildStatusHistory([{ status: "staging", at: "yesterday" }], {
    status: "production",
    at: "today",
  });
  expect(history.length).toBe(2);
  expect(history[1]).toEqual({ status: "production", at: "today" });
});
