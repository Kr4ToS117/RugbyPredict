import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type * as schema from "@shared/schema";
import { db as defaultDb } from "../db";

export type DatabaseInstance = NeonDatabase<typeof schema>;

let currentDb: DatabaseInstance = defaultDb;

export function getDb(): DatabaseInstance {
  return currentDb;
}

export function setDb(instance: DatabaseInstance): void {
  currentDb = instance;
}

export function resetDb(): void {
  currentDb = defaultDb;
}
