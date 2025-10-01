import type { Express } from "express";
import { createServer, type Server } from "http";
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

  const httpServer = createServer(app);

  return httpServer;
}
