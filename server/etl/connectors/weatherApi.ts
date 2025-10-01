import { weather } from "@shared/schema";
import type { ETLConnector, ConnectorLog } from "../types";
import { toUtcDate } from "../utils";

interface WeatherPayload {
  fixtureId: string;
  recordedAt: string;
  temperatureC: number;
  humidity: number;
  windSpeedKph: number;
  condition: string;
}

const weatherPayload: WeatherPayload[] = [
  {
    fixtureId: "00000000-0000-0000-0000-00000000f101",
    recordedAt: "2024-10-12T18:00:00Z",
    temperatureC: 14.5,
    humidity: 72,
    windSpeedKph: 9.2,
    condition: "Light Rain",
  },
  {
    fixtureId: "00000000-0000-0000-0000-00000000f102",
    recordedAt: "2024-10-13T14:00:00Z",
    temperatureC: 16.8,
    humidity: 65,
    windSpeedKph: 11.4,
    condition: "Cloudy",
  },
  {
    fixtureId: "00000000-0000-0000-0000-00000000f201",
    recordedAt: "2024-10-20T16:30:00Z",
    temperatureC: 12.1,
    humidity: 80,
    windSpeedKph: 15.0,
    condition: "Showers",
  },
];

export const weatherApiConnector: ETLConnector = {
  id: "weather_api",
  label: "Weather Provider",
  description: "Captures forecast snapshots for venue conditions.",
  async execute({ db }) {
    const logs: ConnectorLog[] = [];

    for (const payload of weatherPayload) {
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

      logs.push({
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: `Weather snapshot stored for ${payload.fixtureId} :: ${payload.condition}`,
      });
    }

    return {
      recordsProcessed: weatherPayload.length,
      successRate: 100,
      logs,
    };
  },
};
