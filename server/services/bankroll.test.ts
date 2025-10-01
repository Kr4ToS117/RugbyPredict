import { test, expect } from "../../test-shim";
import type { Bet } from "@shared/schema";
import { __testing } from "./bankroll";

const { toNumber, computeProfit, computeKellyStake, getOutcomeProbability, buildBetView } = __testing;

test("coerces values to numbers", () => {
  expect(toNumber("12.5")).toBe(12.5);
  expect(toNumber(new Date(0))).toBe(0);
  expect(toNumber(undefined)).toBe(0);
});

test("computes profit based on status", () => {
  const base = { stake: 100, oddsTaken: 2 } as Bet;
  expect(computeProfit({ ...base, status: "won", potentialPayout: 250 } as any)).toBe(150);
  expect(computeProfit({ ...base, status: "lost" } as any)).toBe(-100);
  expect(computeProfit({ ...base, status: "void" } as any)).toBe(0);
});

test("derives kelly stakes", () => {
  expect(computeKellyStake(0.6, 2)).toBeGreaterThan(0);
  expect(computeKellyStake(0.5, 1)).toBe(0);
});

test("reads prediction outcome probability", () => {
  const bet = {
    fixtureId: "f1",
    selection: "Home Win",
    stake: 10,
    oddsTaken: 2,
    status: "pending",
    fixture: {
      id: "f1",
      homeTeam: { id: "h", name: "Tigers" },
      awayTeam: { id: "a", name: "Sharks" },
    },
    prediction: {
      homeWinProbability: "0.7",
      drawProbability: "0.1",
      awayWinProbability: "0.2",
    },
  } as any;

  expect(getOutcomeProbability(bet)).toBe(0.7);
});

test("builds bet view with normalized fields", () => {
  const bet = {
    id: "bet-1",
    fixtureId: "f1",
    fixture: {
      id: "f1",
      kickoffAt: new Date("2024-01-01T12:00:00.000Z"),
      season: { competition: { name: "League" } },
      homeTeam: { id: "h", name: "Tigers" },
      awayTeam: { id: "a", name: "Sharks" },
    },
    prediction: null,
    betType: "1X2",
    selection: "Tigers",
    oddsTaken: "2.1",
    stake: "25",
    potentialPayout: "52.5",
    status: "pending",
    placedAt: new Date("2024-01-01T10:00:00.000Z"),
    settledAt: null,
    notes: null,
  } as any;

  const view = buildBetView(bet);
  expect(view.fixtureLabel).toContain("Tigers");
  expect(view.oddsTaken).toBe(2.1);
});
