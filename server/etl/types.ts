import type { db } from "../db";
import type { NotificationDispatcher } from "../notifications";

export type Database = typeof db;

export type ConnectorStatus = "success" | "error" | "running";

export interface ConnectorLog {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
}

export interface ConnectorAnomalySource {
  name: string;
  value: string;
}

export interface ConnectorAnomaly {
  connectorId: string;
  fixtureId?: string;
  fixtureLabel?: string;
  field: string;
  severity: "high" | "medium" | "low";
  sources: ConnectorAnomalySource[];
  reason: string;
}

export interface ConnectorError {
  message: string;
  severity: "high" | "medium" | "low";
  scope?: string;
  context?: Record<string, unknown>;
}

export type ConnectorMetrics = Record<string, string | number | boolean>;

export interface ConnectorResult {
  recordsProcessed: number;
  successRate: number;
  logs?: ConnectorLog[];
  anomalies?: ConnectorAnomaly[];
  errors?: ConnectorError[];
  metrics?: ConnectorMetrics;
}

export interface ConnectorContext {
  db: Database;
  notify: NotificationDispatcher;
}

export interface ETLConnector {
  id: string;
  label: string;
  description?: string;
  execute(context: ConnectorContext): Promise<ConnectorResult>;
}

export interface JobDefinition {
  name: string;
  schedule: string;
  connectorIds: string[];
}
