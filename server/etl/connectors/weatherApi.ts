import { weather } from "@shared/schema";
import type { ETLConnector, ConnectorLog, ConnectorError } from "../types";
import { toUtcDate } from "../utils";

interface WeatherPayload {
  fixtureId: string;
  recordedAt: string;
  temperatureC: number;
  humidity: number;
  windSpeedKph: number;
  condition: string;
}

const WEATHER_API_BASE_URL = (process.env.WEATHER_API_URL ?? "https://weather.example.com")
  .replace(/\/$/, "");

async function fetchWeatherPayload(): Promise<WeatherPayload[]> {
  const token = process.env.WEATHER_API_TOKEN;
  if (!token) {
    throw new Error("Missing WEATHER_API_TOKEN environment variable for weather_api connector");
  }

  const endpoint = `${WEATHER_API_BASE_URL}/snapshots`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Weather API responded with ${response.status} ${response.statusText}: ${body ?? ""}`.trim(),
    );
  }

  const data = (await response.json()) as WeatherPayload[] | { snapshots?: WeatherPayload[] };

  if (Array.isArray(data)) {
    return data;
  }

  if (data.snapshots) {
    return data.snapshots;
  }

  return [];
}

export const weatherApiConnector: ETLConnector = {
  id: "weather_api",
  label: "Weather Provider",
  description: "Captures forecast snapshots for venue conditions.",
  async execute({ db }) {
    const weatherPayload = await fetchWeatherPayload();
    const logs: ConnectorLog[] = [];
    const errors: ConnectorError[] = [];

    logs.push({
      timestamp: new Date().toISOString(),
      level: "INFO",
      message: `Fetched ${weatherPayload.length} weather snapshots`,
    });

    let processed = 0;

    for (const payload of weatherPayload) {
      try {
        const values: typeof weather.$inferInsert = {
          fixtureId: payload.fixtureId,
          recordedAt: toUtcDate(payload.recordedAt),
          temperatureC: payload.temperatureC.toFixed(2),
          humidity: payload.humidity,
          windSpeedKph: payload.windSpeedKph.toFixed(2),
          condition: payload.condition,
        };

        await db
          .insert(weather)
          .values(values)
          .onConflictDoUpdate({
            target: weather.fixtureId,
            set: {
              recordedAt: toUtcDate(payload.recordedAt),
              temperatureC: payload.temperatureC.toFixed(2),
              humidity: payload.humidity,
              windSpeedKph: payload.windSpeedKph.toFixed(2),
              condition: payload.condition,
            },
          });

        processed += 1;

        logs.push({
          timestamp: new Date().toISOString(),
          level: "INFO",
          message: `Weather snapshot stored for ${payload.fixtureId} :: ${payload.condition}`,
        });
      } catch (error) {
        errors.push({
          severity: "low",
          message: error instanceof Error ? error.message : "Failed to upsert weather snapshot",
          scope: payload.fixtureId,
          context: { payload },
        });
      }
    }

    const total = weatherPayload.length;
    const successRate = total === 0 ? 100 : (processed / total) * 100;

    return {
      recordsProcessed: processed,
      successRate,
      logs,
      errors,
      metrics: {
        fixturesCovered: new Set(weatherPayload.map((item) => item.fixtureId)).size,
      },
    };
  },
};
