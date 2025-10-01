import { randomUUID } from "node:crypto";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

class StructuredLogger {
  constructor(private readonly bindings: LogContext = {}) {}

  private emit(level: LogLevel, context: LogContext, message?: string) {
    const entry = {
      level,
      time: new Date().toISOString(),
      ...this.bindings,
      ...context,
      message: message ?? context.message ?? "",
    };

    const serialized = JSON.stringify(entry);
    if (level === "error") {
      console.error(serialized);
    } else if (level === "warn") {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  child(bindings: LogContext): StructuredLogger {
    return new StructuredLogger({ ...this.bindings, ...bindings });
  }

  debug(context: LogContext | string, message?: string) {
    this.emit("debug", typeof context === "string" ? { message: context } : context, message);
  }

  info(context: LogContext | string, message?: string) {
    this.emit("info", typeof context === "string" ? { message: context } : context, message);
  }

  warn(context: LogContext | string, message?: string) {
    this.emit("warn", typeof context === "string" ? { message: context } : context, message);
  }

  error(context: LogContext | string, message?: string) {
    this.emit("error", typeof context === "string" ? { message: context } : context, message);
  }
}

export const logger = new StructuredLogger({ service: "rugby-predict" });

export interface TraceEvent {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  span?: string;
  fixtureId?: string;
  data?: Record<string, unknown>;
}

const traceBuffer: TraceEvent[] = [];
const TRACE_LIMIT = Number(process.env.LOG_TRACE_LIMIT ?? 500);

function recordTrace(event: TraceEvent) {
  traceBuffer.push(event);
  if (traceBuffer.length > TRACE_LIMIT) {
    traceBuffer.splice(0, traceBuffer.length - TRACE_LIMIT);
  }
}

interface EmitOptions {
  span?: string;
  fixtureId?: string;
  data?: Record<string, unknown>;
}

function emit(level: LogLevel, message: string, options: EmitOptions = {}) {
  const { span, fixtureId, data } = options;
  const event: TraceEvent = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    message,
    span,
    fixtureId,
    data,
  };

  recordTrace(event);
  const child = logger.child({ span, fixtureId });
  child[level](data ?? {}, message);
}

export interface TraceLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export function createTraceLogger(span: string, context: { fixtureId?: string } = {}): TraceLogger {
  return {
    debug(message, data) {
      emit("debug", message, { span, fixtureId: context.fixtureId, data });
    },
    info(message, data) {
      emit("info", message, { span, fixtureId: context.fixtureId, data });
    },
    warn(message, data) {
      emit("warn", message, { span, fixtureId: context.fixtureId, data });
    },
    error(message, data) {
      emit("error", message, { span, fixtureId: context.fixtureId, data });
    },
  };
}

export function fixtureLogger(fixtureId: string, span = "fixture"): TraceLogger {
  return createTraceLogger(span, { fixtureId });
}

export function getRecentTraces(limit = 50): TraceEvent[] {
  if (limit <= 0) {
    return [];
  }
  return traceBuffer.slice(-limit).reverse();
}

export function getFixtureTraces(fixtureId: string, limit = 100): TraceEvent[] {
  return traceBuffer
    .filter((event) => event.fixtureId === fixtureId)
    .slice(-limit)
    .reverse();
}

export function clearTraces() {
  traceBuffer.splice(0, traceBuffer.length);
}

export function httpLog(
  level: LogLevel,
  message: string,
  details: { method: string; path: string; status: number; durationMs: number; body?: unknown },
) {
  emit(level, message, {
    span: "http",
    data: {
      method: details.method,
      path: details.path,
      status: details.status,
      durationMs: details.durationMs,
      body: details.body,
    },
  });
}
