import type { Express } from "express";
import { createServer, type Server } from "http";
import { desc, eq } from "drizzle-orm";
import { etlJobRuns, validationFlags } from "@shared/schema";
import { listConnectors } from "./etl";
import { db } from "./db";
import type { UsersRepository } from "./services/users";

export interface RouteDependencies {
  usersRepository: UsersRepository;
}

export async function registerRoutes(
  app: Express,
  deps: RouteDependencies,
): Promise<Server> {
  const { usersRepository } = deps;
  void usersRepository;

  // put application routes here
  // prefix all routes with /api

  app.get("/api/etl/connectors", async (_req, res, next) => {
    try {
      const connectors = listConnectors();
      const runs = await db
        .select()
        .from(etlJobRuns)
        .orderBy(desc(etlJobRuns.startedAt))
        .limit(100);

      const latestByConnector = new Map<string, (typeof runs)[number]>();
      for (const run of runs) {
        if (!latestByConnector.has(run.connectorName)) {
          latestByConnector.set(run.connectorName, run);
        }
      }

      const connectorPayload = connectors.map((connector) => {
        const latest = latestByConnector.get(connector.id);
        const lastRun = (latest?.finishedAt ?? latest?.startedAt) ?? null;
        const durationMs = latest?.durationMs ?? null;
        const successRateRaw = latest?.successRate ?? 0;
        const successRate = Number(successRateRaw ?? 0);
        let status: "success" | "error" | "running" = "running";

        if (latest) {
          if (latest.status === "error") {
            status = "error";
          } else if (latest.status === "running") {
            status = "running";
          } else {
            status = "success";
          }
        }

        const durationLabel =
          typeof durationMs === "number"
            ? durationMs >= 1000
              ? `${(durationMs / 1000).toFixed(1)}s`
              : `${durationMs}ms`
            : "—";

        return {
          id: connector.id,
          name: connector.label,
          status,
          lastRun: lastRun ? lastRun.toISOString() : null,
          duration: durationLabel,
          successRate: Number.isFinite(successRate) ? Number(successRate.toFixed(1)) : 0,
        };
      });

      const logs = runs
        .flatMap((run) => {
          const metadata = run.metadata as { logs?: Array<{ timestamp: string; level: string; message: string }> } | null;
          if (!metadata?.logs?.length) {
            return [] as const;
          }

          const connectorName = connectors.find((item) => item.id === run.connectorName)?.label ?? run.connectorName;

          return metadata.logs.map((entry) => ({
            time: entry.timestamp,
            level: entry.level,
            message: entry.message,
            connector: connectorName,
          }));
        })
        .sort((a, b) => (a.time > b.time ? -1 : 1))
        .slice(0, 25);

      res.json({ connectors: connectorPayload, logs });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/validation/issues", async (_req, res, next) => {
    try {
      const rows = await db
        .select()
        .from(validationFlags)
        .where(eq(validationFlags.resolved, false))
        .orderBy(desc(validationFlags.createdAt))
        .limit(50);

      const issues = rows.map((row) => {
        const details = (row.details as any) ?? {};
        const severity = ["high", "medium", "low"].includes(row.level)
          ? (row.level as "high" | "medium" | "low")
          : "medium";
        const sources = Array.isArray(details.sources)
          ? details.sources
          : [{ name: "Primary", value: row.reason }];
        return {
          id: row.id,
          fixture: typeof details.fixtureLabel === "string" ? details.fixtureLabel : row.reason,
          field: typeof details.field === "string" ? details.field : "General",
          severity,
          sources,
        };
      });

      res.json({ issues });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/validation/resolve", async (req, res, next) => {
    try {
      const { id, source } = req.body ?? {};
      if (!id || typeof id !== "string") {
        res.status(400).json({ message: "id is required" });
        return;
      }

      const existing = await db
        .select()
        .from(validationFlags)
        .where(eq(validationFlags.id, id))
        .limit(1);

      if (!existing.length) {
        res.status(404).json({ message: "Validation flag not found" });
        return;
      }

      const details = (existing[0].details as Record<string, unknown> | null) ?? {};

      const resolution = {
        resolvedAt: new Date().toISOString(),
        source: source ?? "manual",
      };

      await db
        .update(validationFlags)
        .set({
          resolved: true,
          resolvedAt: new Date(),
          details: { ...details, resolution },
        })
        .where(eq(validationFlags.id, id));

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
