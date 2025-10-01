import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { db } from "./db";
import { createUsersRepository } from "./services/users";
import { createNotificationDispatcher } from "./notifications";
import { startScheduler } from "./jobs/scheduler";
import { httpLog, logger } from "./logging";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  let capturedJsonResponse: Record<string, unknown> | undefined;

  const originalResJson = res.json.bind(res) as typeof res.json;
  res.json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson as Record<string, unknown>;
    return (originalResJson as unknown as (...params: any[]) => Response).call(res, bodyJson, ...args);
  } as typeof res.json;

  res.on("finish", () => {
    if (!req.path.startsWith("/api")) {
      return;
    }

    const duration = Date.now() - start;
    const preview = capturedJsonResponse ? JSON.stringify(capturedJsonResponse).slice(0, 200) : undefined;

    httpLog("info", "HTTP request completed", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      body: preview,
    });
  });

  next();
});

(async () => {
  const usersRepository = createUsersRepository(db);
  const notifier = createNotificationDispatcher();
  const scheduler = startScheduler({ db, notifier });
  const server = await registerRoutes(app, { usersRepository });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error({ err, status }, "Unhandled application error");
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      logger.info({ port }, "Server is listening");
    },
  );

  const handleShutdown = () => {
    logger.info("Graceful shutdown requested");
    scheduler.stop();
  };

  process.on("SIGTERM", handleShutdown);
  process.on("SIGINT", handleShutdown);
})();
