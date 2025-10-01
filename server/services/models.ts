import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { modelRegistry, predictions } from "@shared/schema";
import { trainModel, type TrainingJobConfig, type TrainingResult } from "../models/training";
import { createTraceLogger, fixtureLogger } from "../logging";

export type ModelStatus = "production" | "staging" | "archived";

export interface ModelMetrics {
  training?: TrainingResult["metrics"]["training"];
  backtest?: TrainingResult["metrics"]["backtest"];
  calibration?: TrainingResult["metrics"]["calibration"];
  roiSeries?: TrainingResult["metrics"]["roiSeries"];
  trainedAt?: string;
  sampleSizes?: TrainingResult["metrics"]["sampleSizes"];
  featureImportance?: TrainingResult["featureImportance"];
  status?: ModelStatus;
  statusHistory?: Array<{ status: ModelStatus; at: string }>;
  promotedAt?: string;
}

export interface ModelSummary {
  id: string;
  name: string;
  version: string;
  description: string | null;
  algorithm: string;
  trainingWindow: string | null;
  createdAt: string;
  status: ModelStatus;
  metrics: ModelMetrics;
  hyperparameters: Record<string, unknown> | null;
}

export interface ModelsResponse {
  models: ModelSummary[];
  productionVersion: string | null;
}

export type LifecycleAction = "promote" | "rollback";

function coerceMetrics(raw: unknown): ModelMetrics {
  if (!raw || typeof raw !== "object") {
    return { status: "staging" };
  }

  const metrics = { ...(raw as Record<string, unknown>) };
  const status =
    typeof metrics.status === "string" &&
    ["production", "staging", "archived"].includes(metrics.status)
      ? (metrics.status as ModelStatus)
      : "staging";

  const statusHistory = Array.isArray(metrics.statusHistory)
    ? (metrics.statusHistory as Array<{ status: ModelStatus; at: string }>)
    : [];

  return {
    training: metrics.training as ModelMetrics["training"],
    backtest: metrics.backtest as ModelMetrics["backtest"],
    calibration: metrics.calibration as ModelMetrics["calibration"],
    roiSeries: metrics.roiSeries as ModelMetrics["roiSeries"],
    trainedAt: typeof metrics.trainedAt === "string" ? metrics.trainedAt : undefined,
    sampleSizes: metrics.sampleSizes as ModelMetrics["sampleSizes"],
    featureImportance: metrics.featureImportance as ModelMetrics["featureImportance"],
    status,
    statusHistory,
    promotedAt: typeof metrics.promotedAt === "string" ? metrics.promotedAt : undefined,
  };
}

function mergeMetrics(base: ModelMetrics, updates: Partial<ModelMetrics>): ModelMetrics {
  return {
    ...base,
    ...updates,
    status: updates.status ?? base.status,
    statusHistory: updates.statusHistory ?? base.statusHistory,
    promotedAt: updates.promotedAt ?? base.promotedAt,
  };
}

function normalizeHyperparameters(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  return raw as Record<string, unknown>;
}

function parseAlgorithm(hyperparameters: Record<string, unknown> | null): string {
  const candidate = hyperparameters?.algorithm;
  return typeof candidate === "string" ? candidate : "unknown";
}

function mapRowToSummary(row: typeof modelRegistry.$inferSelect): ModelSummary {
  const metrics = coerceMetrics(row.metrics);
  const hyperparameters = normalizeHyperparameters(row.hyperparameters);
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    description: row.description ?? null,
    algorithm: parseAlgorithm(hyperparameters),
    trainingWindow: row.trainingWindow ?? null,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    status: metrics.status ?? "staging",
    metrics,
    hyperparameters,
  };
}

async function listModelsInternal(): Promise<ModelsResponse> {
  const rows = await db
    .select()
    .from(modelRegistry)
    .orderBy(desc(modelRegistry.createdAt));

  const models = rows.map(mapRowToSummary);
  const production = models.find((model) => model.status === "production");

  return {
    models,
    productionVersion: production?.version ?? null,
  };
}

export async function listModels(): Promise<ModelsResponse> {
  return await listModelsInternal();
}

function bumpPatch(version: string): string {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  const [major, minor, patch] = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  return `${major}.${minor}.${patch + 1}`;
}

export async function nextVersion(modelName: string): Promise<string> {
  const rows = await db
    .select({ version: modelRegistry.version })
    .from(modelRegistry)
    .where(eq(modelRegistry.name, modelName));

  if (!rows.length) {
    return "1.0.0";
  }

  const latest = rows
    .map((row) => row.version)
    .filter((version): version is string => typeof version === "string")
    .sort((a, b) => {
      const [aMaj, aMin, aPatch] = a.split(".").map((value) => Number.parseInt(value, 10));
      const [bMaj, bMin, bPatch] = b.split(".").map((value) => Number.parseInt(value, 10));
      if (aMaj !== bMaj) return aMaj - bMaj;
      if (aMin !== bMin) return aMin - bMin;
      return aPatch - bPatch;
    })
    .at(-1);

  if (!latest) {
    return "1.0.0";
  }

  return bumpPatch(latest);
}

interface RegisterModelOptions extends Omit<TrainingJobConfig, "version"> {
  version?: string;
}

export interface RegisterModelResult {
  summary: ModelSummary;
  training: TrainingResult;
}

export async function trainAndRegisterModel(options: RegisterModelOptions): Promise<RegisterModelResult> {
  const version = options.version ?? (await nextVersion(options.modelName));
  const span = createTraceLogger("models", {});
  span.info("Model training started", {
    model: options.modelName,
    version,
    algorithm: options.algorithm,
  });
  const training = await trainModel({ ...options, version });

  span.info("Model training completed", {
    model: options.modelName,
    version,
    metrics: training.metrics.training,
  });

  const metricsPayload: ModelMetrics = {
    training: training.metrics.training,
    backtest: training.metrics.backtest,
    calibration: training.metrics.calibration,
    roiSeries: training.metrics.roiSeries,
    trainedAt: training.metrics.trainedAt,
    sampleSizes: training.metrics.sampleSizes,
    featureImportance: training.featureImportance,
    status: "staging",
    statusHistory: [],
  };

  const hyperparameters: Record<string, unknown> = {
    algorithm: options.algorithm,
    holdoutRatio: options.holdoutRatio ?? 0.2,
    logistic: options.logistic ?? null,
    gradientBoosting: options.gradientBoosting ?? null,
    trainingWindow: options.trainingWindow ?? null,
    featureOrder: training.featureImportance.map((item) => item.feature),
    modelParameters: training.modelParameters,
  };

  let summary: ModelSummary | null = null;

  await db.transaction(async (tx) => {
    const [modelRow] = await tx
      .insert(modelRegistry)
      .values({
        name: options.modelName,
        version,
        description: options.description ?? null,
        trainingWindow: training.trainingWindowLabel,
        hyperparameters,
        metrics: metricsPayload,
      })
      .returning();

    summary = mapRowToSummary(modelRow);

    if (training.predictions.length) {
      const predictionRows = training.predictions.map((prediction) => ({
        fixtureId: prediction.fixtureId,
        modelId: modelRow.id,
        homeWinProbability: prediction.probabilities.home.toFixed(4),
        drawProbability: prediction.probabilities.draw.toFixed(4),
        awayWinProbability: prediction.probabilities.away.toFixed(4),
        expectedHomeScore: prediction.expectedScores.home.toFixed(2),
        expectedAwayScore: prediction.expectedScores.away.toFixed(2),
        explanation: {
          ...prediction.explanation,
          edge: prediction.edge,
          version,
        },
      }));

      await tx
        .insert(predictions)
        .values(predictionRows)
        .onConflictDoUpdate({
          target: [predictions.fixtureId, predictions.modelId],
          set: {
            homeWinProbability: sql`excluded.home_win_probability`,
            drawProbability: sql`excluded.draw_probability`,
            awayWinProbability: sql`excluded.away_win_probability`,
            expectedHomeScore: sql`excluded.expected_home_score`,
            expectedAwayScore: sql`excluded.expected_away_score`,
            explanation: sql`excluded.explanation`,
          },
        });

      for (const prediction of training.predictions) {
        fixtureLogger(prediction.fixtureId, "models").info("Prediction persisted", {
          model: options.modelName,
          version,
          edge: prediction.edge,
        });
      }
    }
  });

  if (!summary) {
    throw new Error("Failed to persist trained model");
  }

  span.info("Model registration completed", {
    model: options.modelName,
    version,
  });

  return { summary, training };
}

function buildStatusHistory(
  history: Array<{ status: ModelStatus; at: string }> | undefined,
  entry: { status: ModelStatus; at: string },
): Array<{ status: ModelStatus; at: string }> {
  const next = Array.isArray(history) ? [...history] : [];
  next.push(entry);
  return next;
}

export async function updateModelLifecycle(
  version: string,
  action: LifecycleAction = "promote",
): Promise<ModelsResponse> {
  const span = createTraceLogger("model-lifecycle", {});
  span.info("Lifecycle update requested", { version, action });
  await db.transaction(async (tx) => {
    const rows = await tx.select().from(modelRegistry);
    const target = rows.find((row) => row.version === version);

    if (!target) {
      throw new Error(`Model version ${version} not found`);
    }

    const now = new Date().toISOString();

    if (action === "promote") {
      for (const row of rows) {
        const metrics = coerceMetrics(row.metrics);
        if (row.id === target.id) {
          const updated = mergeMetrics(metrics, {
            status: "production",
            promotedAt: now,
            statusHistory: buildStatusHistory(metrics.statusHistory, { status: "production", at: now }),
          });
          await tx.update(modelRegistry).set({ metrics: updated }).where(eq(modelRegistry.id, row.id));
          span.info("Model promoted", { version });
        } else if (metrics.status === "production") {
          const updated = mergeMetrics(metrics, {
            status: "archived",
            statusHistory: buildStatusHistory(metrics.statusHistory, { status: "archived", at: now }),
          });
          await tx.update(modelRegistry).set({ metrics: updated }).where(eq(modelRegistry.id, row.id));
          span.info("Model archived", { version: row.version });
        }
      }
      return;
    }

    const current = rows.find((row) => coerceMetrics(row.metrics).status === "production");

    if (!current) {
      return;
    }

    if (current.id !== target.id) {
      // Rollback to the requested version, demoting current production.
      const currentMetrics = coerceMetrics(current.metrics);
      const targetMetrics = coerceMetrics(target.metrics);

      const demoted = mergeMetrics(currentMetrics, {
        status: "archived",
        statusHistory: buildStatusHistory(currentMetrics.statusHistory, { status: "archived", at: now }),
      });
      await tx.update(modelRegistry).set({ metrics: demoted }).where(eq(modelRegistry.id, current.id));

      const promoted = mergeMetrics(targetMetrics, {
        status: "production",
        promotedAt: now,
        statusHistory: buildStatusHistory(targetMetrics.statusHistory, { status: "production", at: now }),
      });
      await tx.update(modelRegistry).set({ metrics: promoted }).where(eq(modelRegistry.id, target.id));
      span.info("Model rolled back into production", { version });
      return;
    }

    const fallback = rows
      .filter((row) => row.id !== target.id)
      .map((row) => ({
        row,
        metrics: coerceMetrics(row.metrics),
      }))
      .sort((a, b) => {
        const aDate = new Date(a.metrics.promotedAt ?? a.row.createdAt ?? now).getTime();
        const bDate = new Date(b.metrics.promotedAt ?? b.row.createdAt ?? now).getTime();
        return bDate - aDate;
      })
      .at(0);

    const targetMetrics = coerceMetrics(target.metrics);
    const demotedTarget = mergeMetrics(targetMetrics, {
      status: "archived",
      statusHistory: buildStatusHistory(targetMetrics.statusHistory, { status: "archived", at: now }),
    });
    await tx.update(modelRegistry).set({ metrics: demotedTarget }).where(eq(modelRegistry.id, target.id));

    if (fallback) {
      const promoted = mergeMetrics(fallback.metrics, {
        status: "production",
        promotedAt: now,
        statusHistory: buildStatusHistory(fallback.metrics.statusHistory, { status: "production", at: now }),
      });
      await tx
        .update(modelRegistry)
        .set({ metrics: promoted })
        .where(eq(modelRegistry.id, fallback.row.id));
      span.info("Fallback model promoted", { version: fallback.row.version });
    }
  });

  return await listModelsInternal();
}

export async function getProductionModelInfo(): Promise<{ id: string; version: string } | null> {
  const rows = await db
    .select({ id: modelRegistry.id, version: modelRegistry.version, metrics: modelRegistry.metrics })
    .from(modelRegistry);
  const production = rows.find((row) => coerceMetrics(row.metrics).status === "production");
  if (!production) {
    return null;
  }

  return { id: production.id, version: production.version };
}

export async function getProductionModelId(): Promise<string | null> {
  const info = await getProductionModelInfo();
  return info?.id ?? null;
}

export const __testing = {
  coerceMetrics,
  mergeMetrics,
  bumpPatch,
  mapRowToSummary,
  buildStatusHistory,
};
