import { randomUUID } from "node:crypto";

export interface TeamSeedData {
  id: string;
  name: string;
  shortName: string;
  code: string;
  city: string;
  country: string;
  foundedYear?: number;
  primaryColor?: string;
  secondaryColor?: string;
  homeStadium?: string;
}

export interface FixtureResultSeed {
  homeScore: number;
  awayScore: number;
  status?: string;
  source: string;
  recordedAt: string;
  homeStats: Record<string, number>;
  awayStats: Record<string, number>;
}

export interface FixtureSeedData {
  id: string;
  round?: number;
  matchDay?: number;
  stage?: string;
  kickoffAt: string;
  venue?: string;
  referee?: string;
  attendance?: number;
  status: "scheduled" | "completed" | "in_progress";
  homeTeam: string;
  awayTeam: string;
  odds?: {
    bookmaker: string;
    market: string;
    home: string;
    draw: string;
    away: string;
    updatedAt: string;
  }[];
  weather?: {
    temperatureC: string;
    humidity: number;
    windSpeedKph: string;
    condition: string;
    recordedAt: string;
  };
  result?: FixtureResultSeed;
}

export interface SeasonSeedData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  year: number;
  teamCodes: string[];
  fixtures: FixtureSeedData[];
}

export interface CompetitionSeedData {
  id: string;
  code: string;
  name: string;
  country: string;
  level: string;
  seasons: SeasonSeedData[];
}

export const TEAM_DATA: Record<string, TeamSeedData> = {
  BATH: {
    id: "00000000-0000-0000-0000-00000000t001",
    name: "Bath Rugby",
    shortName: "Bath",
    code: "BAT",
    city: "Bath",
    country: "England",
    foundedYear: 1865,
    primaryColor: "#0f4c81",
    secondaryColor: "#ffffff",
    homeStadium: "The Recreation Ground",
  },
  NTS: {
    id: "00000000-0000-0000-0000-00000000t002",
    name: "Northampton Saints",
    shortName: "Northampton",
    code: "NTS",
    city: "Northampton",
    country: "England",
    foundedYear: 1880,
    primaryColor: "#006341",
    secondaryColor: "#ffd700",
    homeStadium: "cinch Stadium at Franklin's Gardens",
  },
  SAR: {
    id: "00000000-0000-0000-0000-00000000t003",
    name: "Saracens",
    shortName: "Saracens",
    code: "SAR",
    city: "London",
    country: "England",
    foundedYear: 1876,
    primaryColor: "#000000",
    secondaryColor: "#ff0000",
    homeStadium: "StoneX Stadium",
  },
  SAL: {
    id: "00000000-0000-0000-0000-00000000t004",
    name: "Sale Sharks",
    shortName: "Sale",
    code: "SAL",
    city: "Salford",
    country: "England",
    foundedYear: 1861,
    primaryColor: "#1c3f94",
    secondaryColor: "#ffffff",
    homeStadium: "AJ Bell Stadium",
  },
  GLA: {
    id: "00000000-0000-0000-0000-00000000t005",
    name: "Glasgow Warriors",
    shortName: "Glasgow",
    code: "GLA",
    city: "Glasgow",
    country: "Scotland",
    foundedYear: 1872,
    primaryColor: "#00a0e0",
    secondaryColor: "#1b1b1b",
    homeStadium: "Scotstoun Stadium",
  },
  BLS: {
    id: "00000000-0000-0000-0000-00000000t006",
    name: "Vodacom Bulls",
    shortName: "Bulls",
    code: "BUL",
    city: "Pretoria",
    country: "South Africa",
    foundedYear: 1938,
    primaryColor: "#1f98d3",
    secondaryColor: "#ffffff",
    homeStadium: "Loftus Versfeld",
  },
  LEI: {
    id: "00000000-0000-0000-0000-00000000t007",
    name: "Leinster Rugby",
    shortName: "Leinster",
    code: "LEI",
    city: "Dublin",
    country: "Ireland",
    foundedYear: 1879,
    primaryColor: "#0055a4",
    secondaryColor: "#ffffff",
    homeStadium: "Aviva Stadium",
  },
  MUN: {
    id: "00000000-0000-0000-0000-00000000t008",
    name: "Munster Rugby",
    shortName: "Munster",
    code: "MUN",
    city: "Limerick",
    country: "Ireland",
    foundedYear: 1879,
    primaryColor: "#c70039",
    secondaryColor: "#0f4c81",
    homeStadium: "Thomond Park",
  },
  OSP: {
    id: "00000000-0000-0000-0000-00000000t009",
    name: "Ospreys",
    shortName: "Ospreys",
    code: "OSP",
    city: "Swansea",
    country: "Wales",
    foundedYear: 2003,
    primaryColor: "#000000",
    secondaryColor: "#ffffff",
    homeStadium: "Liberty Stadium",
  },
};

export const COMPETITIONS: CompetitionSeedData[] = [
  {
    id: "00000000-0000-0000-0000-00000000c0f1",
    code: "ENG-PREM",
    name: "Gallagher Premiership",
    country: "England",
    level: "Top Flight",
    seasons: [
      {
        id: "00000000-0000-0000-0000-00000000s241",
        name: "2023/2024",
        startDate: "2023-10-13",
        endDate: "2024-06-08",
        year: 2023,
        teamCodes: ["BATH", "NTS", "SAR", "SAL"],
        fixtures: [
          {
            id: "00000000-0000-0000-0000-00000000f241",
            round: 24,
            matchDay: 24,
            stage: "Final",
            kickoffAt: "2024-06-08T14:00:00Z",
            venue: "Twickenham Stadium",
            referee: "Luke Pearce",
            attendance: 82000,
            status: "completed",
            homeTeam: "NTS",
            awayTeam: "BATH",
            odds: [
              {
                bookmaker: "UKSports",
                market: "1X2",
                home: "1.80",
                draw: "21.00",
                away: "2.05",
                updatedAt: "2024-06-07T18:00:00Z",
              },
            ],
            weather: {
              temperatureC: "18.0",
              humidity: 55,
              windSpeedKph: "7.5",
              condition: "Sunny intervals",
              recordedAt: "2024-06-08T12:30:00Z",
            },
            result: {
              homeScore: 25,
              awayScore: 21,
              status: "completed",
              source: "Premiership Rugby",
              recordedAt: "2024-06-08T16:10:00Z",
              homeStats: {
                possession: 54,
                meters: 415,
                tackles: 148,
                cleanBreaks: 6,
                penaltiesConceded: 8,
              },
              awayStats: {
                possession: 46,
                meters: 395,
                tackles: 152,
                cleanBreaks: 5,
                penaltiesConceded: 9,
              },
            },
          },
          {
            id: "00000000-0000-0000-0000-00000000f242",
            round: 23,
            matchDay: 23,
            stage: "Semi-final",
            kickoffAt: "2024-05-31T18:00:00Z",
            venue: "cinch Stadium at Franklin's Gardens",
            referee: "Karl Dickson",
            attendance: 15900,
            status: "completed",
            homeTeam: "NTS",
            awayTeam: "SAR",
            odds: [
              {
                bookmaker: "UKSports",
                market: "1X2",
                home: "1.90",
                draw: "20.00",
                away: "1.95",
                updatedAt: "2024-05-30T20:00:00Z",
              },
            ],
            weather: {
              temperatureC: "13.5",
              humidity: 68,
              windSpeedKph: "9.3",
              condition: "Overcast",
              recordedAt: "2024-05-31T16:00:00Z",
            },
            result: {
              homeScore: 22,
              awayScore: 20,
              status: "completed",
              source: "Premiership Rugby",
              recordedAt: "2024-05-31T20:05:00Z",
              homeStats: {
                possession: 51,
                meters: 352,
                tackles: 167,
                turnoversWon: 6,
                penaltiesConceded: 10,
              },
              awayStats: {
                possession: 49,
                meters: 338,
                tackles: 158,
                turnoversWon: 5,
                penaltiesConceded: 11,
              },
            },
          },
          {
            id: "00000000-0000-0000-0000-00000000f243",
            round: 23,
            matchDay: 23,
            stage: "Semi-final",
            kickoffAt: "2024-06-01T14:00:00Z",
            venue: "The Recreation Ground",
            referee: "Karl Dickson",
            attendance: 14050,
            status: "completed",
            homeTeam: "BATH",
            awayTeam: "SAL",
            odds: [
              {
                bookmaker: "UKSports",
                market: "1X2",
                home: "1.72",
                draw: "23.00",
                away: "2.20",
                updatedAt: "2024-05-31T21:00:00Z",
              },
            ],
            weather: {
              temperatureC: "17.2",
              humidity: 60,
              windSpeedKph: "12.0",
              condition: "Partly cloudy",
              recordedAt: "2024-06-01T12:30:00Z",
            },
            result: {
              homeScore: 31,
              awayScore: 23,
              status: "completed",
              source: "Premiership Rugby",
              recordedAt: "2024-06-01T16:05:00Z",
              homeStats: {
                possession: 56,
                meters: 486,
                tackles: 135,
                lineoutsWon: 14,
                penaltiesConceded: 7,
              },
              awayStats: {
                possession: 44,
                meters: 322,
                tackles: 172,
                lineoutsWon: 11,
                penaltiesConceded: 12,
              },
            },
          },
        ],
      },
    ],
  },
  {
    id: "00000000-0000-0000-0000-00000000c0c2",
    code: "URC",
    name: "United Rugby Championship",
    country: "Multinational",
    level: "Tier 1",
    seasons: [
      {
        id: "00000000-0000-0000-0000-00000000s2uc",
        name: "2023/2024",
        startDate: "2023-10-21",
        endDate: "2024-06-22",
        year: 2023,
        teamCodes: ["GLA", "BLS", "LEI", "MUN", "OSP"],
        fixtures: [
          {
            id: "00000000-0000-0000-0000-00000000f251",
            round: 23,
            matchDay: 23,
            stage: "Final",
            kickoffAt: "2024-06-22T16:00:00Z",
            venue: "Loftus Versfeld",
            referee: "Andrea Piardi",
            attendance: 51500,
            status: "completed",
            homeTeam: "GLA",
            awayTeam: "BLS",
            odds: [
              {
                bookmaker: "URC Exchange",
                market: "1X2",
                home: "2.60",
                draw: "19.00",
                away: "1.55",
                updatedAt: "2024-06-21T19:30:00Z",
              },
            ],
            weather: {
              temperatureC: "19.5",
              humidity: 48,
              windSpeedKph: "5.0",
              condition: "Clear",
              recordedAt: "2024-06-22T14:45:00Z",
            },
            result: {
              homeScore: 21,
              awayScore: 16,
              status: "completed",
              source: "URC",
              recordedAt: "2024-06-22T18:10:00Z",
              homeStats: {
                possession: 47,
                meters: 402,
                tackles: 189,
                turnoversWon: 8,
                penaltiesConceded: 9,
              },
              awayStats: {
                possession: 53,
                meters: 389,
                tackles: 178,
                turnoversWon: 5,
                penaltiesConceded: 12,
              },
            },
          },
          {
            id: "00000000-0000-0000-0000-00000000f252",
            round: 22,
            matchDay: 22,
            stage: "Quarter-final",
            kickoffAt: "2024-06-08T16:00:00Z",
            venue: "Thomond Park",
            referee: "Nika Amashukeli",
            attendance: 26500,
            status: "completed",
            homeTeam: "MUN",
            awayTeam: "OSP",
            odds: [
              {
                bookmaker: "URC Exchange",
                market: "1X2",
                home: "1.35",
                draw: "26.00",
                away: "3.20",
                updatedAt: "2024-06-07T20:15:00Z",
              },
            ],
            weather: {
              temperatureC: "14.0",
              humidity: 72,
              windSpeedKph: "18.0",
              condition: "Light rain",
              recordedAt: "2024-06-08T14:30:00Z",
            },
            result: {
              homeScore: 27,
              awayScore: 10,
              status: "completed",
              source: "URC",
              recordedAt: "2024-06-08T17:55:00Z",
              homeStats: {
                possession: 58,
                meters: 498,
                tackles: 128,
                maulsWon: 11,
                penaltiesConceded: 8,
              },
              awayStats: {
                possession: 42,
                meters: 265,
                tackles: 176,
                maulsWon: 6,
                penaltiesConceded: 13,
              },
            },
          },
          {
            id: "00000000-0000-0000-0000-00000000f253",
            round: 22,
            matchDay: 22,
            stage: "Semi-final",
            kickoffAt: "2024-06-15T14:00:00Z",
            venue: "Loftus Versfeld",
            referee: "Andrew Brace",
            attendance: 48000,
            status: "scheduled",
            homeTeam: "BLS",
            awayTeam: "LEI",
            odds: [
              {
                bookmaker: "URC Exchange",
                market: "1X2",
                home: "1.95",
                draw: "22.00",
                away: "1.85",
                updatedAt: "2024-06-14T19:45:00Z",
              },
            ],
            weather: {
              temperatureC: "17.8",
              humidity: 50,
              windSpeedKph: "11.0",
              condition: "Clear",
              recordedAt: "2024-06-15T12:00:00Z",
            },
            result: {
              homeScore: 25,
              awayScore: 20,
              status: "completed",
              source: "URC",
              recordedAt: "2024-06-15T16:15:00Z",
              homeStats: {
                possession: 52,
                meters: 410,
                tackles: 174,
                turnoversWon: 7,
                penaltiesConceded: 10,
              },
              awayStats: {
                possession: 48,
                meters: 378,
                tackles: 165,
                turnoversWon: 6,
                penaltiesConceded: 11,
              },
            },
          },
        ],
      },
    ],
  },
];

export interface SeedFixtureRecord {
  fixtureId: string;
  result: FixtureResultSeed;
}

export const OFFICIAL_RESULTS: Record<string, FixtureResultSeed> = Object.fromEntries(
  COMPETITIONS.flatMap((competition) =>
    competition.seasons.flatMap((season) =>
      season.fixtures
        .filter((fixture) => fixture.result)
        .map((fixture) => [fixture.id, fixture.result as FixtureResultSeed]),
    ),
  ),
);

export function buildFixtureId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
