import type { Express } from "express";
import { createServer, type Server } from "http";
import { desc, eq } from "drizzle-orm";
import { etlJobRuns, validationFlags } from "@shared/schema";
import { listConnectors } from "./etl";
import { db } from "./db";
import type { UsersRepository } from "./services/users";
import { listModels, updateModelLifecycle } from "./services/models";
import { listFixtures, getFixturePredictions } from "./services/fixtures";
import {
  getBankrollSummary,
  listBetViews,
  createBet,
  updateBet,
  deleteBet,
  importBets,
  generateBankrollExport,
} from "./services/bankroll";
import {
  computeReview,
  generateReviewExports,
  getWeeklyPerformanceReport,
  generateWeeklyReportExport,
  importResultsBatch,
  parseResultsCsv,
  type ResultPayload,
} from "./services/reports";
import { getFileStream } from "./storage";

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

  app.get("/api/storage/:key", async (req, res, next) => {
    try {
      const { key } = req.params;
      if (!key) {
        res.status(400).json({ message: "storage key is required" });
        return;
      }

      const resource = await getFileStream(key);
      if (!resource) {
        res.status(404).json({ message: "File not found" });
        return;
      }

      res.setHeader("Content-Type", resource.metadata.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${resource.metadata.filename}"`);
      resource.stream.on("error", (error) => next(error));
      resource.stream.pipe(res);
      return;
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/bankroll/summary", async (_req, res, next) => {
    try {
      const summary = await getBankrollSummary();
      res.json(summary);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/bankroll/export", async (_req, res, next) => {
    try {
      const file = await generateBankrollExport();
      res.json({ file });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/bets", async (_req, res, next) => {
    try {
      const payload = await listBetViews();
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/bets", async (req, res, next) => {
    try {
      const body = req.body ?? {};
      if (Array.isArray(body.bets)) {
        const normalized = body.bets.map((item: any) => ({
          userId: item.userId,
          fixtureId: item.fixtureId,
          predictionId: item.predictionId ?? null,
          betType: item.betType,
          selection: item.selection,
          oddsTaken: Number(item.oddsTaken),
          stake: Number(item.stake),
          potentialPayout: item.potentialPayout !== undefined ? Number(item.potentialPayout) : null,
          status: item.status ?? "pending",
          placedAt: item.placedAt,
          settledAt: item.settledAt,
          notes: item.notes ?? null,
        }));
        const result = await importBets(normalized);
        res.json(result);
        return;
      }

      const bet = await createBet({
        userId: body.userId,
        fixtureId: body.fixtureId,
        predictionId: body.predictionId ?? null,
        betType: body.betType,
        selection: body.selection,
        oddsTaken: Number(body.oddsTaken),
        stake: Number(body.stake),
        potentialPayout: body.potentialPayout !== undefined ? Number(body.potentialPayout) : null,
        status: body.status ?? "pending",
        placedAt: body.placedAt,
        settledAt: body.settledAt,
        notes: body.notes ?? null,
      });

      res.status(201).json(bet);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/bets/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const body = req.body ?? {};
      const bet = await updateBet({
        id,
        userId: body.userId,
        predictionId: body.predictionId ?? null,
        betType: body.betType,
        selection: body.selection,
        oddsTaken: body.oddsTaken !== undefined ? Number(body.oddsTaken) : undefined,
        stake: body.stake !== undefined ? Number(body.stake) : undefined,
        potentialPayout:
          body.potentialPayout !== undefined ? (body.potentialPayout !== null ? Number(body.potentialPayout) : null) : undefined,
        status: body.status,
        placedAt: body.placedAt,
        settledAt: body.settledAt,
        notes: body.notes,
      });
      res.json(bet);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/bets/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      await deleteBet(id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reports/weekly", async (_req, res, next) => {
    try {
      const report = await getWeeklyPerformanceReport();
      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/reports/weekly/export", async (_req, res, next) => {
    try {
      const report = await getWeeklyPerformanceReport();
      const files = await generateWeeklyReportExport(report);
      res.json({ files });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/review", async (_req, res, next) => {
    try {
      const review = await computeReview();
      res.json(review);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/review", async (_req, res, next) => {
    try {
      const review = await computeReview();
      const files = await generateReviewExports(review);
      res.json({ ...review, exports: files });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/review/import", async (req, res, next) => {
    try {
      const body = req.body ?? {};
      let payload: ResultPayload[] | null = null;

      if (typeof body.csv === "string") {
        payload = parseResultsCsv(body.csv);
      } else if (Array.isArray(body.results)) {
        payload = body.results.map((item: any) => ({
          fixtureId: item.fixtureId,
          homeScore: Number(item.homeScore ?? 0),
          awayScore: Number(item.awayScore ?? 0),
          status: item.status,
          homeStats: item.homeStats ?? undefined,
          awayStats: item.awayStats ?? undefined,
        }));
      }

      if (!payload || !payload.length) {
        res.status(400).json({ message: "Aucun résultat à importer" });
        return;
      }

      const result = await importResultsBatch(payload);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/overview", async (_req, res, next) => {
    try {
      const [modelsData, fixturesData, validationRows, bankroll] = await Promise.all([
        listModels(),
        listFixtures(12),
        db
          .select()
          .from(validationFlags)
          .where(eq(validationFlags.resolved, false))
          .orderBy(desc(validationFlags.createdAt))
          .limit(25),
        getBankrollSummary(),
      ]);

      const issues = validationRows.map((row) => {
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

      res.json({
        models: modelsData,
        fixtures: fixturesData,
        validation: { issues },
        risk: {
          exposures: bankroll.exposures,
          recommendations: bankroll.recommendations,
          bankroll: bankroll.bankroll,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/models", async (_req, res, next) => {
    try {
      const payload = await listModels();
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/models/:version/promote", async (req, res, next) => {
    try {
      const { version } = req.params;
      if (!version) {
        res.status(400).json({ message: "version parameter is required" });
        return;
      }

      const actionRaw = req.body?.action;
      const action = actionRaw === "rollback" ? "rollback" : "promote";
      const payload = await updateModelLifecycle(version, action);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/fixtures", async (req, res, next) => {
    try {
      const limitValue = Number.parseInt(String(req.query.limit ?? ""), 10);
      const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(100, limitValue)) : 25;
      const payload = await listFixtures(limit);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/fixtures/:id/predictions", async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: "fixture id is required" });
        return;
      }

      const payload = await getFixturePredictions(id);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

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
