import { eq } from "drizzle-orm";
import { etlJobRuns } from "@shared/schema";
import type { NotificationDispatcher } from "../notifications";
import type { Database, ETLConnector } from "./types";
import { countHighSeverity, recordAnomalies } from "./utils";
import { rugbyApiConnector } from "./connectors/rugbyApi";
import { oddsApiConnector } from "./connectors/oddsApi";
import { weatherApiConnector } from "./connectors/weatherApi";
import { scrapingConnector } from "./connectors/scraping";

export const connectorRegistry: Record<string, ETLConnector> = {
  [rugbyApiConnector.id]: rugbyApiConnector,
  [oddsApiConnector.id]: oddsApiConnector,
  [weatherApiConnector.id]: weatherApiConnector,
  [scrapingConnector.id]: scrapingConnector,
};

export function listConnectors(): ETLConnector[] {
  return Object.values(connectorRegistry);
}

export function getConnector(connectorId: string): ETLConnector | undefined {
  return connectorRegistry[connectorId];
}

interface RunConnectorOptions {
  jobName: string;
  connector: ETLConnector;
  db: Database;
  notifier: NotificationDispatcher;
}

export async function runConnector({ jobName, connector, db, notifier }: RunConnectorOptions) {
  const startTime = Date.now();
  const [run] = await db
    .insert(etlJobRuns)
    .values({
      jobName,
      connectorName: connector.id,
      status: "running",
      startedAt: new Date(),
    })
    .returning({ id: etlJobRuns.id });

  try {
    const result = await connector.execute({ db, notify: notifier });
    const duration = Date.now() - startTime;

    await recordAnomalies(db, result.anomalies);

    if (countHighSeverity(result.anomalies) > 0) {
      await notifier.notifyEscalation({
        title: `${connector.label} detected critical anomalies`,
        body: `${result.anomalies?.length ?? 0} anomaly(ies) recorded during ${jobName}.`,
        severity: "critical",
        context: {
          connectorId: connector.id,
          jobName,
        },
      });
    }

    await db
      .update(etlJobRuns)
      .set({
        status: "success",
        finishedAt: new Date(),
        durationMs: duration,
        recordsProcessed: result.recordsProcessed,
        successRate: result.successRate.toFixed(2),
        issues: result.anomalies?.length ?? 0,
        metadata: {
          logs: result.logs ?? [],
        },
      })
      .where(eq(etlJobRuns.id, run.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connector error";

    await db
      .update(etlJobRuns)
      .set({
        status: "error",
        finishedAt: new Date(),
        durationMs: Date.now() - startTime,
        error: message,
        metadata: {
          logs: [],
        },
      })
      .where(eq(etlJobRuns.id, run.id));

    await notifier.notifyFailure({
      title: `${connector.label} failed`,
      body: message,
      severity: "critical",
      context: {
        connectorId: connector.id,
        jobName,
      },
    });
  }
}
