import { log } from "../vite";
import type { Database } from "../etl/types";
import { getConnector, runConnector } from "../etl";
import type { NotificationDispatcher } from "../notifications";

export type JobName = "daily_intake" | "pre_match" | "results_pull" | "weekly_review";

interface JobConfig {
  schedule: string;
  connectorIds: string[];
}

const jobDefinitions: Record<JobName, JobConfig> = {
  daily_intake: {
    schedule: "0 3 * * *",
    connectorIds: ["rugby_api", "weather_api", "scraping"],
  },
  pre_match: {
    schedule: "*/30 * * * *",
    connectorIds: ["odds_api", "weather_api"],
  },
  results_pull: {
    schedule: "15 23 * * *",
    connectorIds: ["scraping"],
  },
  weekly_review: {
    schedule: "0 6 * * 1",
    connectorIds: ["rugby_api", "odds_api", "weather_api", "scraping"],
  },
};

function cronFieldMatches(value: number, field: string, min: number) {
  return field.split(",").some((token) => {
    if (token === "*") return true;

    if (token.startsWith("*/")) {
      const step = Number.parseInt(token.slice(2), 10);
      if (Number.isNaN(step) || step <= 0) return false;
      return (value - min) % step === 0;
    }

    if (token.includes("-")) {
      const [startRaw, endRaw] = token.split("-");
      const start = Number.parseInt(startRaw, 10);
      const end = Number.parseInt(endRaw, 10);
      if (Number.isNaN(start) || Number.isNaN(end)) return false;
      return value >= start && value <= end;
    }

    const numeric = Number.parseInt(token, 10);
    if (Number.isNaN(numeric)) return false;
    return numeric === value;
  });
}

function cronMatches(date: Date, expression: string) {
  const [minute, hour, day, month, dayOfWeek] = expression.trim().split(/\s+/);
  if (!minute || !hour || !day || !month || !dayOfWeek) {
    throw new Error(`Invalid cron expression: ${expression}`);
  }

  const minuteMatch = cronFieldMatches(date.getUTCMinutes(), minute, 0);
  const hourMatch = cronFieldMatches(date.getUTCHours(), hour, 0);
  const dayMatch = cronFieldMatches(date.getUTCDate(), day, 1);
  const monthMatch = cronFieldMatches(date.getUTCMonth() + 1, month, 1);
  const weekdayMatch = cronFieldMatches(date.getUTCDay(), dayOfWeek, 0);

  return minuteMatch && hourMatch && dayMatch && monthMatch && weekdayMatch;
}

interface SchedulerOptions {
  db: Database;
  notifier: NotificationDispatcher;
}

export function startScheduler({ db, notifier }: SchedulerOptions) {
  const runningJobs = new Set<JobName>();
  const lastRuns = new Map<JobName, string>();
  const timers: NodeJS.Timeout[] = [];

  async function executeJob(jobName: JobName) {
    if (runningJobs.has(jobName)) {
      log(`Job ${jobName} skipped because a previous run is still active`, "scheduler");
      return;
    }

    runningJobs.add(jobName);
    log(`Starting job ${jobName}`, "scheduler");

    try {
      const config = jobDefinitions[jobName];
      for (const connectorId of config.connectorIds) {
        const connector = getConnector(connectorId);
        if (!connector) {
          log(`Unknown connector ${connectorId} requested by ${jobName}`, "scheduler");
          continue;
        }

        await runConnector({
          jobName,
          connector,
          db,
          notifier,
        });
      }

      log(`Job ${jobName} completed`, "scheduler");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Job ${jobName} failed: ${message}`, "scheduler");
      await notifier.notifyFailure({
        title: `Scheduler job ${jobName} failed`,
        body: message,
        severity: "critical",
      });
    } finally {
      runningJobs.delete(jobName);
    }
  }

  function scheduleJob(jobName: JobName, config: JobConfig) {
    const timer = setInterval(async () => {
      const now = new Date();
      const minuteKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`;

      if (!cronMatches(now, config.schedule)) {
        return;
      }

      if (lastRuns.get(jobName) === minuteKey) {
        return;
      }

      lastRuns.set(jobName, minuteKey);
      await executeJob(jobName);
    }, 60_000);

    timers.push(timer);
  }

  (Object.keys(jobDefinitions) as JobName[]).forEach((jobName) => {
    scheduleJob(jobName, jobDefinitions[jobName]);
  });

  // Trigger an initial load so dashboards have data when the app boots.
  void executeJob("daily_intake");

  return {
    stop() {
      timers.forEach((timer) => clearInterval(timer));
      runningJobs.clear();
      lastRuns.clear();
    },
    getJobs(): Array<{ name: JobName; schedule: string; connectors: string[] }> {
      return (Object.keys(jobDefinitions) as JobName[]).map((jobName) => ({
        name: jobName,
        schedule: jobDefinitions[jobName].schedule,
        connectors: jobDefinitions[jobName].connectorIds,
      }));
    },
  };
}
