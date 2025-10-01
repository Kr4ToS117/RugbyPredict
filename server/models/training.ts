import { asc, eq, gte, or } from "drizzle-orm";
import { formatISO9075 } from "date-fns";
import {
  fixtures,
} from "@shared/schema";
import { db } from "../db";
import {
  buildTrainingDataset,
  computeFixtureFeatureVectorFromRecord,
  vectorToArray,
  type FeatureName,
  type FeatureVector,
  type TrainingRow,
} from "./features";

const EPSILON = 1e-9;

type Algorithm = "logit" | "gbdt";
type CalibrationMethod = "platt" | "isotonic" | "none";

interface LogisticHyperparameters {
  learningRate: number;
  iterations: number;
  l2: number;
}

interface GradientBoostingHyperparameters {
  trees: number;
  learningRate: number;
  lambda: number;
}

interface TrainingWindow {
  start?: Date;
  end?: Date;
}

export interface TrainingJobConfig {
  modelName: string;
  version: string;
  algorithm: Algorithm;
  description?: string;
  calibration?: CalibrationMethod;
  trainingWindow?: TrainingWindow;
  holdoutRatio?: number;
  logistic?: Partial<LogisticHyperparameters>;
  gradientBoosting?: Partial<GradientBoostingHyperparameters>;
}

interface LogisticModel {
  type: "logit";
  weights: number[];
  means: number[];
  stds: number[];
}

interface GradientBoostingStump {
  featureIndex: number;
  threshold: number;
  leftValue: number;
  rightValue: number;
}

interface GradientBoostingModel {
  type: "gbdt";
  bias: number;
  shrinkage: number;
  stumps: GradientBoostingStump[];
}

export type SerializedModel = LogisticModel | GradientBoostingModel;

interface EvaluationMetrics {
  accuracy: number;
  brierScore: number;
  logLoss: number;
  roi: number;
  yield: number;
  hitRate: number;
  bets: number;
  sampleSize: number;
}

interface RoiPoint {
  period: string;
  roi: number;
}

interface CalibrationBin {
  range: [number, number];
  count: number;
  averagePrediction: number;
  actualRate: number;
}

interface CalibrationModel {
  method: CalibrationMethod;
  slope?: number;
  intercept?: number;
  mapping?: Array<{ threshold: number; value: number }>;
}

interface CalibrationSummary {
  method: CalibrationMethod;
  slope?: number;
  intercept?: number;
  mapping?: Array<{ threshold: number; value: number }>;
  bins: CalibrationBin[];
  curve: Array<{ predicted: number; actual: number }>;
}

export interface PredictionArtifact {
  fixtureId: string;
  kickoffAt: string;
  homeTeamId: string;
  awayTeamId: string;
  modelVersion: string;
  probabilities: {
    home: number;
    draw: number;
    away: number;
  };
  expectedScores: {
    home: number;
    away: number;
  };
  edge: number | null;
  explanation: Record<string, unknown>;
}

export interface TrainingResult {
  config: TrainingJobConfig;
  trainingWindowLabel: string;
  featureImportance: Array<{ feature: FeatureName; importance: number }>;
  modelParameters: SerializedModel;
  metrics: {
    training: EvaluationMetrics;
    backtest: EvaluationMetrics;
    calibration: CalibrationSummary;
    roiSeries: RoiPoint[];
    trainedAt: string;
    sampleSizes: {
      training: number;
      backtest: number;
    };
  };
  predictions: PredictionArtifact[];
}

function clampProbability(value: number): number {
  if (value <= EPSILON) {
    return EPSILON;
  }

  if (value >= 1 - EPSILON) {
    return 1 - EPSILON;
  }

  return value;
}

function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }

  const z = Math.exp(x);
  return z / (1 + z);
}

function standardizeMatrix(matrix: number[][]): {
  normalized: number[][];
  means: number[];
  stds: number[];
} {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const means = new Array(cols).fill(0);
  const stds = new Array(cols).fill(0);

  for (let col = 0; col < cols; col++) {
    let sum = 0;
    for (let row = 0; row < rows; row++) {
      sum += matrix[row][col];
    }
    means[col] = sum / rows;
  }

  for (let col = 0; col < cols; col++) {
    let squared = 0;
    for (let row = 0; row < rows; row++) {
      const diff = matrix[row][col] - means[col];
      squared += diff * diff;
    }
    const variance = squared / Math.max(rows - 1, 1);
    stds[col] = Math.sqrt(variance) || 1;
  }

  const normalized = matrix.map((row) =>
    row.map((value, index) => (value - means[index]) / stds[index]),
  );

  return { normalized, means, stds };
}

function applyStandardization(row: number[], means: number[], stds: number[]): number[] {
  return row.map((value, index) => (value - means[index]) / stds[index]);
}

function logisticPredict(weights: number[], row: number[]): number {
  let logit = weights[0];
  for (let index = 0; index < row.length; index++) {
    logit += weights[index + 1] * row[index];
  }
  return sigmoid(logit);
}

function trainLogisticRegression(
  matrix: number[][],
  labels: number[],
  hyperparameters: LogisticHyperparameters,
): number[] {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const weights = new Array(cols + 1).fill(0);

  for (let iteration = 0; iteration < hyperparameters.iterations; iteration++) {
    let gradient0 = 0;
    const gradients = new Array(cols).fill(0);

    for (let i = 0; i < rows; i++) {
      const prediction = logisticPredict(weights, matrix[i]);
      const error = prediction - labels[i];
      gradient0 += error;
      for (let j = 0; j < cols; j++) {
        gradients[j] += error * matrix[i][j];
      }
    }

    weights[0] -= (hyperparameters.learningRate / rows) * gradient0;

    for (let j = 0; j < cols; j++) {
      gradients[j] += hyperparameters.l2 * weights[j + 1];
      weights[j + 1] -= (hyperparameters.learningRate / rows) * gradients[j];
    }

    const maxGrad = Math.max(
      Math.abs(gradient0),
      ...gradients.map((value) => Math.abs(value)),
    );

    if (maxGrad < 1e-4) {
      break;
    }
  }

  return weights;
}

function createLogisticModel(
  weights: number[],
  means: number[],
  stds: number[],
): LogisticModel {
  return {
    type: "logit",
    weights,
    means,
    stds,
  };
}

function predictWithLogistic(model: LogisticModel, features: number[]): number {
  const standardized = applyStandardization(features, model.means, model.stds);
  return logisticPredict(model.weights, standardized);
}

function trainGradientBoosting(
  matrix: number[][],
  labels: number[],
  hyperparameters: GradientBoostingHyperparameters,
): GradientBoostingModel {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;

  const baseRate = clampProbability(
    labels.reduce((sum, value) => sum + value, 0) / Math.max(labels.length, 1),
  );
  const baseBias = Math.log(baseRate / (1 - baseRate));
  let logits = new Array(rows).fill(baseBias);

  const featureOrder = Array.from({ length: cols }, (_, column) =>
    Array.from({ length: rows }, (_, index) => index).sort(
      (a, b) => matrix[a][column] - matrix[b][column],
    ),
  );

  const stumps: GradientBoostingStump[] = [];
  const maxTrees = Math.max(hyperparameters.trees, 1);

  for (let tree = 0; tree < maxTrees; tree++) {
    const gradients = new Array(rows);
    const hessians = new Array(rows);
    let totalGradient = 0;
    let totalHessian = 0;

    for (let i = 0; i < rows; i++) {
      const probability = sigmoid(logits[i]);
      const gradient = labels[i] - probability;
      const hessian = Math.max(probability * (1 - probability), 1e-6);
      gradients[i] = gradient;
      hessians[i] = hessian;
      totalGradient += gradient;
      totalHessian += hessian;
    }

    if (Math.abs(totalGradient) < 1e-6) {
      break;
    }

    let bestFeature = -1;
    let bestThreshold = 0;
    let bestLeftValue = 0;
    let bestRightValue = 0;
    let bestScore = -Infinity;

    for (let featureIndex = 0; featureIndex < cols; featureIndex++) {
      const order = featureOrder[featureIndex];
      let leftGradient = 0;
      let leftHessian = 0;

      for (let position = 0; position < rows - 1; position++) {
        const rowIndex = order[position];
        leftGradient += gradients[rowIndex];
        leftHessian += hessians[rowIndex];

        const nextIndex = order[position + 1];
        const currentValue = matrix[rowIndex][featureIndex];
        const nextValue = matrix[nextIndex][featureIndex];

        if (currentValue === nextValue) {
          continue;
        }

        const rightGradient = totalGradient - leftGradient;
        const rightHessian = totalHessian - leftHessian;

        if (leftHessian <= 1e-6 || rightHessian <= 1e-6) {
          continue;
        }

        const leftValue = leftGradient / (leftHessian + hyperparameters.lambda);
        const rightValue = rightGradient / (rightHessian + hyperparameters.lambda);
        const score =
          (leftGradient * leftGradient) / (leftHessian + hyperparameters.lambda) +
          (rightGradient * rightGradient) / (rightHessian + hyperparameters.lambda);

        if (score > bestScore) {
          bestFeature = featureIndex;
          bestThreshold = (currentValue + nextValue) / 2;
          bestLeftValue = leftValue;
          bestRightValue = rightValue;
          bestScore = score;
        }
      }
    }

    if (bestFeature === -1) {
      break;
    }

    stumps.push({
      featureIndex: bestFeature,
      threshold: bestThreshold,
      leftValue: bestLeftValue,
      rightValue: bestRightValue,
    });

    for (let i = 0; i < rows; i++) {
      const contribution =
        matrix[i][bestFeature] <= bestThreshold ? bestLeftValue : bestRightValue;
      logits[i] += hyperparameters.learningRate * contribution;
    }
  }

  return {
    type: "gbdt",
    bias: baseBias,
    shrinkage: hyperparameters.learningRate,
    stumps,
  };
}

function predictWithGradientBoosting(model: GradientBoostingModel, features: number[]): number {
  let logit = model.bias;
  for (const stump of model.stumps) {
    const contribution =
      features[stump.featureIndex] <= stump.threshold ? stump.leftValue : stump.rightValue;
    logit += model.shrinkage * contribution;
  }
  return sigmoid(logit);
}
function evaluateDataset(rows: TrainingRow[], probabilities: number[]): EvaluationMetrics {
  const sampleSize = rows.length;
  const labels = rows.map((row) => row.label);
  let accuracyHits = 0;
  let brierSum = 0;
  let logLossSum = 0;

  for (let index = 0; index < sampleSize; index++) {
    const label = labels[index];
    const prediction = clampProbability(probabilities[index]);
    if ((prediction >= 0.5 && label === 1) || (prediction < 0.5 && label === 0)) {
      accuracyHits += 1;
    }

    brierSum += (prediction - label) * (prediction - label);
    logLossSum -= label * Math.log(prediction) + (1 - label) * Math.log(1 - prediction);
  }

  const roiMetrics = computeRoiMetrics(rows, probabilities);

  return {
    accuracy: Number(((accuracyHits / Math.max(sampleSize, 1)) * 100).toFixed(2)),
    brierScore: Number((brierSum / Math.max(sampleSize, 1)).toFixed(4)),
    logLoss: Number((logLossSum / Math.max(sampleSize, 1)).toFixed(4)),
    roi: roiMetrics.roi,
    yield: roiMetrics.yield,
    hitRate: roiMetrics.hitRate,
    bets: roiMetrics.bets,
    sampleSize,
  };
}

function computeRoiMetrics(rows: TrainingRow[], probabilities: number[]) {
  let totalStake = 0;
  let totalReturn = 0;
  let winningBets = 0;
  let bets = 0;
  const betThreshold = 0.02;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const prediction = probabilities[index];
    const impliedProb = row.featureVector.homeImpliedProbability;
    const homeOdds = row.impliedOdds.home;

    if (!homeOdds || impliedProb === undefined) {
      continue;
    }

    const edge = prediction - impliedProb;
    if (edge <= betThreshold) {
      continue;
    }

    bets += 1;
    totalStake += 1;
    if (row.outcome === "home") {
      totalReturn += homeOdds;
      winningBets += 1;
    }
  }

  const roi = totalStake
    ? Number((((totalReturn - totalStake) / totalStake) * 100).toFixed(2))
    : 0;
  const yieldValue = totalStake ? Number((totalReturn / totalStake).toFixed(2)) : 0;
  const hitRate = bets ? Number(((winningBets / bets) * 100).toFixed(2)) : 0;

  return {
    roi,
    yield: yieldValue,
    hitRate,
    bets,
  };
}

function buildRoiSeries(rows: TrainingRow[], probabilities: number[]): RoiPoint[] {
  const monthly = new Map<string, { stake: number; returned: number }>();
  const betThreshold = 0.02;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const probability = probabilities[index];
    const impliedProb = row.featureVector.homeImpliedProbability;
    const homeOdds = row.impliedOdds.home;

    if (!homeOdds || impliedProb === undefined) {
      continue;
    }

    const edge = probability - impliedProb;
    if (edge <= betThreshold) {
      continue;
    }

    const kickoff = new Date(row.kickoffAt);
    const monthKey = `${kickoff.getUTCFullYear()}-${String(kickoff.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = monthly.get(monthKey) ?? { stake: 0, returned: 0 };
    bucket.stake += 1;
    if (row.outcome === "home") {
      bucket.returned += homeOdds;
    }
    monthly.set(monthKey, bucket);
  }

  const series = Array.from(monthly.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([period, totals]) => {
      const roi = totals.stake
        ? Number((((totals.returned - totals.stake) / totals.stake) * 100).toFixed(2))
        : 0;
      return { period, roi };
    });

  return series;
}

function fitPlattScaling(probabilities: number[], labels: number[]): CalibrationModel | null {
  if (probabilities.length < 5) {
    return null;
  }

  let slope = 1;
  let intercept = 0;

  for (let iteration = 0; iteration < 50; iteration++) {
    let gradSlope = 0;
    let gradIntercept = 0;
    let h11 = 0;
    let h12 = 0;
    let h22 = 0;

    for (let index = 0; index < probabilities.length; index++) {
      const prob = clampProbability(probabilities[index]);
      const logit = Math.log(prob / (1 - prob));
      const z = slope * logit + intercept;
      const calibrated = sigmoid(z);
      const error = calibrated - labels[index];

      gradSlope += error * logit;
      gradIntercept += error;

      const weight = Math.max(calibrated * (1 - calibrated), 1e-6);
      h11 += weight * logit * logit;
      h12 += weight * logit;
      h22 += weight;
    }

    const det = h11 * h22 - h12 * h12;
    if (Math.abs(det) < 1e-6) {
      break;
    }

    const deltaSlope = (gradSlope * h22 - gradIntercept * h12) / det;
    const deltaIntercept = (gradIntercept * h11 - gradSlope * h12) / det;

    slope -= deltaSlope;
    intercept -= deltaIntercept;

    if (Math.abs(deltaSlope) < 1e-6 && Math.abs(deltaIntercept) < 1e-6) {
      break;
    }
  }

  return { method: "platt", slope, intercept };
}

function fitIsotonicRegression(probabilities: number[], labels: number[]): CalibrationModel | null {
  if (probabilities.length === 0) {
    return null;
  }

  const pairs = probabilities
    .map((prob, index) => ({ prob, label: labels[index] }))
    .sort((a, b) => a.prob - b.prob);

  const blocks = pairs.map((pair) => ({
    start: pair.prob,
    end: pair.prob,
    weight: 1,
    sum: pair.label,
    value: pair.label,
  }));

  for (let i = 0; i < blocks.length - 1; ) {
    if (blocks[i].value <= blocks[i + 1].value) {
      i += 1;
      continue;
    }

    const mergedWeight = blocks[i].weight + blocks[i + 1].weight;
    const mergedSum = blocks[i].sum + blocks[i + 1].sum;
    const merged = {
      start: blocks[i].start,
      end: blocks[i + 1].end,
      weight: mergedWeight,
      sum: mergedSum,
      value: mergedSum / mergedWeight,
    };

    blocks.splice(i, 2, merged);
    if (i > 0) {
      i -= 1;
    }
  }

  const mapping = blocks.map((block) => ({ threshold: block.end, value: block.value }));
  return { method: "isotonic", mapping };
}

function applyCalibration(probability: number, calibration: CalibrationModel | null): number {
  if (!calibration || calibration.method === "none") {
    return clampProbability(probability);
  }

  if (calibration.method === "platt") {
    const slope = calibration.slope ?? 1;
    const intercept = calibration.intercept ?? 0;
    const prob = clampProbability(probability);
    const logit = Math.log(prob / (1 - prob));
    return clampProbability(sigmoid(slope * logit + intercept));
  }

  if (!calibration.mapping?.length) {
    return clampProbability(probability);
  }

  const prob = clampProbability(probability);
  for (const point of calibration.mapping) {
    if (prob <= point.threshold) {
      return clampProbability(point.value);
    }
  }

  const last = calibration.mapping[calibration.mapping.length - 1];
  return clampProbability(last.value);
}

function buildCalibrationBins(probabilities: number[], labels: number[], bins = 8): CalibrationBin[] {
  const binSize = 1 / bins;
  const results: CalibrationBin[] = [];

  for (let index = 0; index < bins; index++) {
    const start = index * binSize;
    const end = index === bins - 1 ? 1 : (index + 1) * binSize;
    let count = 0;
    let sumProb = 0;
    let sumLabel = 0;

    for (let i = 0; i < probabilities.length; i++) {
      const prob = probabilities[i];
      if (prob < start || prob > end + 1e-6) {
        continue;
      }

      count += 1;
      sumProb += prob;
      sumLabel += labels[i];
    }

    results.push({
      range: [Number(start.toFixed(2)), Number(end.toFixed(2))],
      count,
      averagePrediction: count ? Number((sumProb / count).toFixed(4)) : 0,
      actualRate: count ? Number((sumLabel / count).toFixed(4)) : 0,
    });
  }

  return results;
}

function computeFeatureImportance(
  algorithm: Algorithm,
  model: SerializedModel,
  featureOrder: FeatureName[],
): Array<{ feature: FeatureName; importance: number }> {
  if (algorithm === "logit" && model.type === "logit") {
    const magnitudes = model.weights.slice(1).map((weight, index) => {
      const scale = model.stds[index] || 1;
      return Math.abs(weight / scale);
    });
    const total = magnitudes.reduce((sum, value) => sum + value, 0) || 1;
    return featureOrder
      .map((feature, index) => ({ feature, importance: magnitudes[index] / total }))
      .sort((a, b) => b.importance - a.importance);
  }

  if (algorithm === "gbdt" && model.type === "gbdt") {
    const counts = new Array(featureOrder.length).fill(0);
    for (const stump of model.stumps) {
      counts[stump.featureIndex] += 1;
    }
    const total = counts.reduce((sum, value) => sum + value, 0) || 1;
    return featureOrder
      .map((feature, index) => ({ feature, importance: counts[index] / total }))
      .sort((a, b) => b.importance - a.importance);
  }

  return featureOrder.map((feature) => ({ feature, importance: 1 / featureOrder.length }));
}

function formatTrainingWindowLabel(window?: TrainingWindow): string {
  const start = window?.start ? formatISO9075(window.start, { representation: "date" }) : "full-history";
  const end = window?.end ? formatISO9075(window.end, { representation: "date" }) : "latest";
  return `${start} → ${end}`;
}
function applyCalibrationToArray(probabilities: number[], calibration: CalibrationModel | null): number[] {
  return probabilities.map((probability) => applyCalibration(probability, calibration));
}

function computeAverageScores(rows: TrainingRow[]): { home: number; away: number } {
  if (!rows.length) {
    return { home: 24, away: 22 };
  }

  const homeSum = rows.reduce((sum, row) => sum + (row.homeScore ?? 0), 0);
  const awaySum = rows.reduce((sum, row) => sum + (row.awayScore ?? 0), 0);
  return {
    home: homeSum / rows.length,
    away: awaySum / rows.length,
  };
}

function determineDrawAwaySplit(vector: FeatureVector): { drawShare: number; awayShare: number } {
  const drawImplied = vector.drawImpliedProbability;
  const awayImplied = vector.awayImpliedProbability;
  const total = drawImplied + awayImplied;
  if (!total) {
    return { drawShare: 0.25, awayShare: 0.75 };
  }

  return {
    drawShare: drawImplied / total,
    awayShare: awayImplied / total,
  };
}

function enrichExplanation(topFeatures: Array<{ feature: FeatureName; importance: number }>): Record<string, unknown> {
  return {
    topFeatures: topFeatures.slice(0, 6).map((item) => ({
      feature: item.feature,
      weight: Number((item.importance * 100).toFixed(2)),
    })),
  };
}

export async function trainModel(config: TrainingJobConfig): Promise<TrainingResult> {
  const trainingWindowLabel = formatTrainingWindowLabel(config.trainingWindow);
  const dataset = await buildTrainingDataset({
    startDate: config.trainingWindow?.start,
    endDate: config.trainingWindow?.end,
  });

  if (dataset.rows.length < 5) {
    throw new Error("Insufficient completed fixtures to train a model. Provide at least 5 matches.");
  }

  const holdoutRatio = config.holdoutRatio ?? 0.2;
  const holdoutSize = Math.max(1, Math.floor(dataset.rows.length * holdoutRatio));
  let splitIndex = dataset.rows.length - holdoutSize;
  if (splitIndex <= 0) {
    splitIndex = dataset.rows.length - 1;
  }

  const trainingRows = dataset.rows.slice(0, splitIndex);
  const backtestRows = dataset.rows.slice(splitIndex);

  const trainingMatrix = trainingRows.map((row) => vectorToArray(row.featureVector));
  const backtestMatrix = backtestRows.map((row) => vectorToArray(row.featureVector));
  const trainingLabels = trainingRows.map((row) => row.label);
  const backtestLabels = backtestRows.map((row) => row.label);

  let serializedModel: SerializedModel;
  let rawTrainingPredictions: number[];
  let rawBacktestPredictions: number[];

  if (config.algorithm === "logit") {
    const logisticConfig: LogisticHyperparameters = {
      learningRate: config.logistic?.learningRate ?? 0.15,
      iterations: config.logistic?.iterations ?? 600,
      l2: config.logistic?.l2 ?? 0.01,
    };

    const standardized = standardizeMatrix(trainingMatrix);
    const weights = trainLogisticRegression(standardized.normalized, trainingLabels, logisticConfig);
    serializedModel = createLogisticModel(weights, standardized.means, standardized.stds);

    rawTrainingPredictions = trainingMatrix.map((row) => predictWithLogistic(serializedModel as LogisticModel, row));
    rawBacktestPredictions = backtestMatrix.map((row) => predictWithLogistic(serializedModel as LogisticModel, row));
  } else {
    const gbdtConfig: GradientBoostingHyperparameters = {
      trees: config.gradientBoosting?.trees ?? 80,
      learningRate: config.gradientBoosting?.learningRate ?? 0.08,
      lambda: config.gradientBoosting?.lambda ?? 1,
    };

    serializedModel = trainGradientBoosting(trainingMatrix, trainingLabels, gbdtConfig);
    rawTrainingPredictions = trainingMatrix.map((row) => predictWithGradientBoosting(serializedModel as GradientBoostingModel, row));
    rawBacktestPredictions = backtestMatrix.map((row) => predictWithGradientBoosting(serializedModel as GradientBoostingModel, row));
  }

  const calibrationModel =
    config.calibration === "platt"
      ? fitPlattScaling(rawBacktestPredictions, backtestLabels)
      : config.calibration === "isotonic"
        ? fitIsotonicRegression(rawBacktestPredictions, backtestLabels)
        : { method: "none" as CalibrationMethod };

  const calibratedTraining = applyCalibrationToArray(rawTrainingPredictions, calibrationModel);
  const calibratedBacktest = applyCalibrationToArray(rawBacktestPredictions, calibrationModel);

  const trainingMetrics = evaluateDataset(trainingRows, calibratedTraining);
  const backtestMetrics = evaluateDataset(backtestRows, calibratedBacktest);
  const roiSeries = buildRoiSeries(backtestRows, calibratedBacktest);
  const calibrationBins = buildCalibrationBins(calibratedBacktest, backtestLabels);
  const calibrationCurve = calibrationBins
    .filter((bin) => bin.count > 0)
    .map((bin) => ({
      predicted: Number((bin.averagePrediction * 100).toFixed(1)),
      actual: Number((bin.actualRate * 100).toFixed(1)),
    }));

  const featureImportance = computeFeatureImportance(config.algorithm, serializedModel, dataset.featureOrder);

  const averages = computeAverageScores(trainingRows);

  const upcomingFixtures = await db.query.fixtures.findMany({
    where: (fixture, { or: orOp, gte: gteOp, eq: eqOp }) =>
      orOp(eqOp(fixture.status, "scheduled"), gteOp(fixture.kickoffAt, new Date())),
    with: {
      odds: true,
      weather: true,
    },
    orderBy: (fixture, { asc: ascOp }) => ascOp(fixture.kickoffAt),
  });

  const predictionsArtifacts: PredictionArtifact[] = [];

  for (const fixture of upcomingFixtures) {
    const vector = await computeFixtureFeatureVectorFromRecord(fixture);
    const features = vectorToArray(vector.featureVector);

    let probability = 0.5;
    if (serializedModel.type === "logit") {
      probability = predictWithLogistic(serializedModel as LogisticModel, features);
    } else {
      probability = predictWithGradientBoosting(serializedModel as GradientBoostingModel, features);
    }

    const calibratedProbability = applyCalibration(probability, calibrationModel);
    const split = determineDrawAwaySplit(vector.featureVector);
    const drawProbability = (1 - calibratedProbability) * split.drawShare;
    const awayProbability = 1 - calibratedProbability - drawProbability;

    const expectedHomeScore = Math.max(
      0,
      averages.home + (calibratedProbability - 0.5) * 6,
    );
    const expectedAwayScore = Math.max(
      0,
      averages.away - (calibratedProbability - 0.5) * 6,
    );

    const explanation = {
      ...enrichExplanation(featureImportance),
      calibration: calibrationModel?.method ?? "none",
    };

    predictionsArtifacts.push({
      fixtureId: vector.fixtureId,
      kickoffAt: vector.kickoffAt,
      homeTeamId: vector.homeTeamId,
      awayTeamId: vector.awayTeamId,
      modelVersion: config.version,
      probabilities: {
        home: Number(calibratedProbability.toFixed(4)),
        draw: Number(drawProbability.toFixed(4)),
        away: Number(awayProbability.toFixed(4)),
      },
      expectedScores: {
        home: Number(expectedHomeScore.toFixed(2)),
        away: Number(expectedAwayScore.toFixed(2)),
      },
      edge:
        vector.impliedOdds.home && vector.featureVector.homeImpliedProbability
          ? Number((calibratedProbability - vector.featureVector.homeImpliedProbability).toFixed(4))
          : null,
      explanation,
    });
  }

  const metrics = {
    training: trainingMetrics,
    backtest: backtestMetrics,
    calibration: {
      method: calibrationModel?.method ?? "none",
      slope: calibrationModel?.slope,
      intercept: calibrationModel?.intercept,
      mapping: calibrationModel?.mapping,
      bins: calibrationBins,
      curve: calibrationCurve,
    },
    roiSeries,
    trainedAt: new Date().toISOString(),
    sampleSizes: {
      training: trainingRows.length,
      backtest: backtestRows.length,
    },
  };

  return {
    config,
    trainingWindowLabel,
    featureImportance,
    modelParameters: serializedModel,
    metrics,
    predictions: predictionsArtifacts,
  };
}
