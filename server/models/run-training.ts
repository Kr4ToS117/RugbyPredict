import { trainAndRegisterModel } from "../services/models";

function parseAlgorithm(value: string | undefined): "logit" | "gbdt" {
  return value === "gbdt" ? "gbdt" : "logit";
}

function parseCalibration(value: string | undefined): "platt" | "isotonic" | "none" {
  if (value === "isotonic" || value === "none") {
    return value;
  }
  return "platt";
}

async function main() {
  const algorithm = parseAlgorithm(process.env.MODEL_ALGO);
  const calibration = parseCalibration(process.env.MODEL_CALIBRATION);
  const holdoutRatio = process.env.HOLDOUT_RATIO ? Number(process.env.HOLDOUT_RATIO) : 0.25;
  const modelName = process.env.MODEL_NAME ?? `weekly-${algorithm}`;

  try {
    const result = await trainAndRegisterModel({
      modelName,
      description: process.env.MODEL_DESCRIPTION ?? "Manual retraining run",
      algorithm,
      calibration,
      holdoutRatio: Number.isFinite(holdoutRatio) ? holdoutRatio : 0.25,
      trainingWindow: {
        start: process.env.TRAIN_START ? new Date(process.env.TRAIN_START) : undefined,
        end: process.env.TRAIN_END ? new Date(process.env.TRAIN_END) : undefined,
      },
    });

    const roi = result.training.metrics.backtest?.roi ?? result.training.metrics.training?.roi ?? 0;
    console.log(
      `Model ${result.summary.version} (${result.summary.algorithm}) trained – backtest ROI: ${roi.toFixed(2)}%`,
    );
  } catch (error) {
    console.error("Training failed", error);
    process.exit(1);
  }
}

void main();
