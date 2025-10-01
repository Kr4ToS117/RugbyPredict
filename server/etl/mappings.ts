export interface LeagueMapping {
  id: string;
  code: string;
  name: string;
  country: string;
  level?: string;
}

export interface SeasonMapping {
  id: string;
  competitionCode: string;
  name: string;
  startDate: string;
  endDate: string;
  year?: number;
}

export interface TeamMapping {
  id: string;
  competitionCode: string;
  name: string;
  shortName?: string;
  code?: string;
  city?: string;
  country?: string;
}

export const leagueMappings: Record<string, LeagueMapping> = {
  TOP14: {
    id: "00000000-0000-0000-0000-00000000c014",
    code: "TOP14",
    name: "Top 14",
    country: "France",
    level: "Tier 1",
  },
  PROD2: {
    id: "00000000-0000-0000-0000-00000000d002",
    code: "PROD2",
    name: "Pro D2",
    country: "France",
    level: "Tier 2",
  },
  URC: {
    id: "00000000-0000-0000-0000-00000000c0c2",
    code: "URC",
    name: "United Rugby Championship",
    country: "Multinational",
    level: "Tier 1",
  },
  PRL: {
    id: "00000000-0000-0000-0000-00000000c0f1",
    code: "PRL",
    name: "Gallagher Premiership",
    country: "England",
    level: "Tier 1",
  },
};

export const seasonMappings: SeasonMapping[] = [
  {
    id: "00000000-0000-0000-0000-0000000a0014",
    competitionCode: "TOP14",
    name: "2024/2025",
    startDate: "2024-08-01",
    endDate: "2025-06-30",
    year: 2024,
  },
  {
    id: "00000000-0000-0000-0000-0000000a0d02",
    competitionCode: "PROD2",
    name: "2024/2025",
    startDate: "2024-08-15",
    endDate: "2025-05-30",
    year: 2024,
  },
  {
    id: "00000000-0000-0000-0000-0000000a0c20",
    competitionCode: "URC",
    name: "2024/2025",
    startDate: "2024-09-20",
    endDate: "2025-06-15",
    year: 2024,
  },
  {
    id: "00000000-0000-0000-0000-0000000a0f10",
    competitionCode: "PRL",
    name: "2024/2025",
    startDate: "2024-10-01",
    endDate: "2025-06-10",
    year: 2024,
  },
];

export const teamMappings: TeamMapping[] = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    competitionCode: "TOP14",
    name: "Stade Toulousain",
    shortName: "Toulouse",
    code: "TOU",
    city: "Toulouse",
    country: "France",
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    competitionCode: "TOP14",
    name: "Stade Rochelais",
    shortName: "La Rochelle",
    code: "LAR",
    city: "La Rochelle",
    country: "France",
  },
  {
    id: "00000000-0000-0000-0000-000000000103",
    competitionCode: "URC",
    name: "Leinster Rugby",
    shortName: "Leinster",
    code: "LEI",
    city: "Dublin",
    country: "Ireland",
  },
  {
    id: "00000000-0000-0000-0000-000000000104",
    competitionCode: "URC",
    name: "Munster Rugby",
    shortName: "Munster",
    code: "MUN",
    city: "Limerick",
    country: "Ireland",
  },
  {
    id: "00000000-0000-0000-0000-000000000105",
    competitionCode: "PRL",
    name: "Saracens",
    shortName: "Saracens",
    code: "SAR",
    city: "London",
    country: "England",
  },
  {
    id: "00000000-0000-0000-0000-000000000106",
    competitionCode: "PRL",
    name: "Harlequins",
    shortName: "Harlequins",
    code: "HAR",
    city: "London",
    country: "England",
  },
  {
    id: "00000000-0000-0000-0000-000000000107",
    competitionCode: "TOP14",
    name: "Racing 92",
    shortName: "Racing 92",
    code: "R92",
    city: "Nanterre",
    country: "France",
  },
  {
    id: "00000000-0000-0000-0000-000000000108",
    competitionCode: "TOP14",
    name: "Stade Français Paris",
    shortName: "Stade Français",
    code: "SFP",
    city: "Paris",
    country: "France",
  },
];

export function getLeagueByCode(code: string): LeagueMapping | undefined {
  return leagueMappings[code.toUpperCase()];
}

export function getSeasonByCompetition(code: string): SeasonMapping | undefined {
  return seasonMappings.find((season) => season.competitionCode === code.toUpperCase());
}

export function getTeamByName(name: string): TeamMapping | undefined {
  const normalized = name.trim().toLowerCase();
  return teamMappings.find((team) =>
    team.name.toLowerCase() === normalized ||
    team.shortName?.toLowerCase() === normalized ||
    team.code?.toLowerCase() === normalized,
  );
}
