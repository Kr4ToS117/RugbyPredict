import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import {
  insertFixtureSchema,
  insertPredictionSchema,
  insertBetSchema,
  insertValidationFlagSchema,
  insertModelRegistrySchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Competitions
  app.get("/api/competitions", async (req, res) => {
    try {
      const competitions = await storage.getCompetitions();
      res.json(competitions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch competitions" });
    }
  });

  // Teams
  app.get("/api/teams/:competitionId", async (req, res) => {
    try {
      const competitionId = parseInt(req.params.competitionId);
      const teams = await storage.getTeamsByCompetition(competitionId);
      res.json(teams);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  // Fixtures
  app.get("/api/fixtures", async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.competitionId) {
        filters.competitionId = parseInt(req.query.competitionId as string);
      }
      if (req.query.status) {
        filters.status = req.query.status as string;
      }
      if (req.query.fromDate) {
        filters.fromDate = new Date(req.query.fromDate as string);
      }
      if (req.query.toDate) {
        filters.toDate = new Date(req.query.toDate as string);
      }

      const fixtures = await storage.getFixtures(filters);
      res.json(fixtures);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fixtures" });
    }
  });

  app.get("/api/fixtures/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const fixture = await storage.getFixtureById(id);
      if (!fixture) {
        return res.status(404).json({ error: "Fixture not found" });
      }
      res.json(fixture);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fixture" });
    }
  });

  // Predictions
  app.get("/api/predictions/:fixtureId", async (req, res) => {
    try {
      const fixtureId = parseInt(req.params.fixtureId);
      const prediction = await storage.getPredictionsByFixture(fixtureId);
      if (!prediction) {
        return res.status(404).json({ error: "No prediction found" });
      }
      res.json(prediction);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch prediction" });
    }
  });

  app.post("/api/predictions", async (req, res) => {
    try {
      const data = insertPredictionSchema.parse(req.body);
      const prediction = await storage.createPrediction(data);
      res.status(201).json(prediction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create prediction" });
    }
  });

  // Bets
  app.get("/api/bets", async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.fromDate) {
        filters.fromDate = new Date(req.query.fromDate as string);
      }
      if (req.query.toDate) {
        filters.toDate = new Date(req.query.toDate as string);
      }

      const bets = await storage.getBets(filters);
      res.json(bets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bets" });
    }
  });

  app.post("/api/bets", async (req, res) => {
    try {
      const data = insertBetSchema.parse(req.body);
      const bet = await storage.createBet(data);
      res.status(201).json(bet);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create bet" });
    }
  });

  app.patch("/api/bets/:id/result", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { result, pnl } = req.body;
      await storage.updateBetResult(id, result, parseFloat(pnl));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update bet result" });
    }
  });

  // Validation Flags
  app.get("/api/validation/issues", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const flags = await storage.getValidationFlags(status);
      res.json(flags);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch validation issues" });
    }
  });

  app.post("/api/validation/issues", async (req, res) => {
    try {
      const data = insertValidationFlagSchema.parse(req.body);
      const flag = await storage.createValidationFlag(data);
      res.status(201).json(flag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create validation flag" });
    }
  });

  app.post("/api/validation/resolve/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { resolver, comment } = req.body;
      await storage.resolveValidationFlag(id, resolver, comment);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve validation flag" });
    }
  });

  // Models
  app.get("/api/models", async (req, res) => {
    try {
      const models = await storage.getModels();
      res.json(models);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch models" });
    }
  });

  app.get("/api/models/deployed", async (req, res) => {
    try {
      const model = await storage.getDeployedModel();
      if (!model) {
        return res.status(404).json({ error: "No deployed model found" });
      }
      res.json(model);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deployed model" });
    }
  });

  app.post("/api/models", async (req, res) => {
    try {
      const data = insertModelRegistrySchema.parse(req.body);
      const model = await storage.createModel(data);
      res.status(201).json(model);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create model" });
    }
  });

  app.post("/api/models/:version/deploy", async (req, res) => {
    try {
      const version = req.params.version;
      await storage.deployModel(version);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to deploy model" });
    }
  });

  // ETL & Data Intake
  app.get("/api/etl/status", async (req, res) => {
    try {
      // Mock data for now - would integrate with actual ETL system
      res.json({
        connectors: [
          { name: "Top14 API", status: "success", lastRun: "2 min ago", duration: "1.2s", successRate: 98.5 },
          { name: "ProD2 API", status: "success", lastRun: "3 min ago", duration: "0.9s", successRate: 97.8 },
          { name: "URC API", status: "success", lastRun: "2 min ago", duration: "1.5s", successRate: 99.2 },
          { name: "Premiership API", status: "running", lastRun: "Just now", duration: "0.8s", successRate: 100 },
          { name: "Weather API", status: "success", lastRun: "1 min ago", duration: "0.5s", successRate: 100 },
          { name: "Odds Provider", status: "error", lastRun: "5 min ago", duration: "timeout", successRate: 85.2 },
        ],
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ETL status" });
    }
  });

  // Analytics & KPIs
  app.get("/api/analytics/kpis", async (req, res) => {
    try {
      // Calculate KPIs from bets
      const bets = await storage.getBets();
      const completedBets = bets.filter(b => b.result);
      
      const totalStake = completedBets.reduce((sum, b) => sum + parseFloat(b.stake.toString()), 0);
      const totalPnl = completedBets.reduce((sum, b) => sum + parseFloat((b.pnl || 0).toString()), 0);
      const roi = totalStake > 0 ? (totalPnl / totalStake) * 100 : 0;
      const winCount = completedBets.filter(b => b.result === 'won').length;
      const hitRate = completedBets.length > 0 ? (winCount / completedBets.length) * 100 : 0;

      res.json({
        roi: roi.toFixed(1),
        yield: (roi * 0.66).toFixed(1), // Simplified yield calculation
        hitRate: hitRate.toFixed(1),
        brierScore: "0.184", // Would calculate from predictions vs actuals
        totalBets: bets.length,
        activeBets: bets.filter(b => !b.result).length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate KPIs" });
    }
  });

  // Risk Management
  app.get("/api/risk/exposure", async (req, res) => {
    try {
      const activeBets = (await storage.getBets()).filter(b => !b.result);
      
      const dailyExposure = activeBets.reduce((sum, b) => sum + parseFloat(b.stake.toString()), 0);
      
      res.json({
        daily: { current: dailyExposure, limit: 500 },
        weekly: { current: dailyExposure * 1.8, limit: 2000 },
        perLeague: [
          { league: "Top14", current: dailyExposure * 0.6, limit: 500 },
          { league: "URC", current: dailyExposure * 0.3, limit: 500 },
          { league: "Premiership", current: dailyExposure * 0.1, limit: 500 },
        ],
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate risk exposure" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
