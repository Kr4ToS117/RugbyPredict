import { describe, test, expect } from "../../test-shim";
import { __testing, FEATURE_KEYS } from "./features";

const {
  computeFormRating,
  computeRestDays,
  computeFatigueIndex,
  computeImpliedProbability,
  computeWeatherSeverity,
  computeResult,
  vectorToArray,
} = __testing as any;

describe("feature engineering", () => {
  test("computes form rating from fixtures", () => {
    const fixtures = [
      { homeTeamId: "A", awayTeamId: "B", homeScore: 20, awayScore: 10 },
      { homeTeamId: "B", awayTeamId: "A", homeScore: 12, awayScore: 15 },
    ];

    const rating = computeFormRating(fixtures as any, "A");
    expect(rating.rating).toBeGreaterThan(50);
    expect(rating.winRate).toBeGreaterThan(0.5);
  });

  test("computes rest days", () => {
    const fixture = { kickoffAt: new Date("2024-01-10T12:00:00.000Z"), homeTeamId: "A" };
    const recent = [
      { kickoffAt: new Date("2024-01-01T12:00:00.000Z"), homeTeamId: "A", awayTeamId: "B" },
    ];
    const rest = computeRestDays(fixture as any, recent as any);
    expect(rest).toBeGreaterThan(8);
  });

  test("calculates fatigue index", () => {
    expect(computeFatigueIndex(7)).toBeCloseTo(0.14, 2);
    expect(computeFatigueIndex(1)).toBe(1);
  });

  test("handles implied probability", () => {
    expect(computeImpliedProbability(2)).toBe(0.5);
    expect(computeImpliedProbability(null)).toBe(0);
  });

  test("assesses weather severity", () => {
    const severity = computeWeatherSeverity({ temperatureC: 5, windSpeedKph: 40, humidity: 90 });
    expect(severity).toBeGreaterThan(0);
  });

  test("converts vectors to arrays", () => {
    const vector = Object.fromEntries(FEATURE_KEYS.map((key) => [key, 1])) as any;
    const arr = vectorToArray(vector);
    expect(arr.length).toBe(FEATURE_KEYS.length);
  });

  test("derives match result", () => {
    expect(computeResult(20, 10)).toBe(1);
    expect(computeResult(10, 20)).toBe(0);
    expect(computeResult(10, 10)).toBe(0.5);
  });
});
