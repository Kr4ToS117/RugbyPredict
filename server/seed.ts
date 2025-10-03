import { db } from "./db";
import * as schema from "@shared/schema";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create competitions
  const [top14] = await db
    .insert(schema.competitions)
    .values({ name: "Top14", country: "France" })
    .returning();

  const [urc] = await db
    .insert(schema.competitions)
    .values({ name: "United Rugby Championship", country: "Multi" })
    .returning();

  const [premiership] = await db
    .insert(schema.competitions)
    .values({ name: "Gallagher Premiership", country: "England" })
    .returning();

  console.log("✓ Created competitions");

  // Create teams
  const teams = await db
    .insert(schema.teams)
    .values([
      { competitionId: top14.id, name: "Toulouse", aliases: ["Stade Toulousain"] },
      { competitionId: top14.id, name: "La Rochelle", aliases: ["Stade Rochelais"] },
      { competitionId: top14.id, name: "Racing 92", aliases: ["Racing"] },
      { competitionId: top14.id, name: "Stade Français", aliases: ["SF Paris"] },
      { competitionId: urc.id, name: "Leinster", aliases: ["Leinster Rugby"] },
      { competitionId: urc.id, name: "Munster", aliases: ["Munster Rugby"] },
      { competitionId: urc.id, name: "Ulster", aliases: ["Ulster Rugby"] },
      { competitionId: premiership.id, name: "Saracens", aliases: ["Sarries"] },
      { competitionId: premiership.id, name: "Leicester Tigers", aliases: ["Tigers"] },
    ])
    .returning();

  console.log("✓ Created teams");

  // Create fixtures
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const fixtures = await db
    .insert(schema.fixtures)
    .values([
      {
        competitionId: top14.id,
        season: "2024-25",
        round: "Round 14",
        dateUtc: tomorrow,
        homeId: teams[0].id,
        awayId: teams[1].id,
        venue: "Stadium de Toulouse",
        status: "scheduled",
      },
      {
        competitionId: urc.id,
        season: "2024-25",
        round: "Round 10",
        dateUtc: nextWeek,
        homeId: teams[4].id,
        awayId: teams[5].id,
        venue: "Aviva Stadium",
        status: "scheduled",
      },
      {
        competitionId: top14.id,
        season: "2024-25",
        round: "Round 14",
        dateUtc: nextWeek,
        homeId: teams[2].id,
        awayId: teams[3].id,
        venue: "Paris La Défense Arena",
        status: "scheduled",
      },
      {
        competitionId: top14.id,
        season: "2024-25",
        round: "Round 13",
        dateUtc: lastWeek,
        homeId: teams[0].id,
        awayId: teams[2].id,
        venue: "Stadium de Toulouse",
        status: "completed",
        scoreHome: 28,
        scoreAway: 21,
      },
    ])
    .returning();

  console.log("✓ Created fixtures");

  // Create predictions for upcoming fixtures
  await db.insert(schema.predictions).values([
    {
      fixtureId: fixtures[0].id,
      modelVersion: "v2.3.1",
      pHome: "0.5230",
      pDraw: "0.2210",
      pAway: "0.2560",
      fairHome: "1.91",
      fairDraw: "4.52",
      fairAway: "3.91",
      edgeHome: "5.80",
      edgeDraw: "0.00",
      edgeAway: "0.00",
      stake: "52.00",
    },
    {
      fixtureId: fixtures[1].id,
      modelVersion: "v2.3.1",
      pHome: "0.6820",
      pDraw: "0.1530",
      pAway: "0.1650",
      fairHome: "1.47",
      fairDraw: "6.54",
      fairAway: "6.06",
      edgeHome: "3.20",
      edgeDraw: "0.00",
      edgeAway: "0.00",
      stake: "38.00",
    },
    {
      fixtureId: fixtures[2].id,
      modelVersion: "v2.3.1",
      pHome: "0.4580",
      pDraw: "0.2620",
      pAway: "0.2800",
      fairHome: "2.18",
      fairDraw: "3.82",
      fairAway: "3.57",
      edgeHome: "1.80",
      edgeDraw: "0.00",
      edgeAway: "0.00",
      stake: "25.00",
    },
  ]);

  console.log("✓ Created predictions");

  // Create odds
  await db.insert(schema.odds).values([
    {
      fixtureId: fixtures[0].id,
      source: "Odds Provider",
      home: "1.85",
      draw: "4.20",
      away: "3.80",
    },
    {
      fixtureId: fixtures[1].id,
      source: "Odds Provider",
      home: "1.50",
      draw: "6.00",
      away: "5.50",
    },
    {
      fixtureId: fixtures[2].id,
      source: "Odds Provider",
      home: "2.10",
      draw: "3.60",
      away: "3.40",
    },
  ]);

  console.log("✓ Created odds");

  // Create bets
  await db.insert(schema.bets).values([
    {
      fixtureId: fixtures[0].id,
      market: "Home Win",
      selection: "Toulouse",
      stake: "52.00",
      odds: "1.85",
      result: null,
      pnl: null,
    },
    {
      fixtureId: fixtures[1].id,
      market: "Home Win",
      selection: "Leinster",
      stake: "38.00",
      odds: "1.50",
      result: null,
      pnl: null,
    },
    {
      fixtureId: fixtures[3].id,
      market: "Home Win",
      selection: "Toulouse",
      stake: "45.00",
      odds: "1.75",
      result: "won",
      pnl: "33.75",
    },
  ]);

  console.log("✓ Created bets");

  // Create validation flags
  await db.insert(schema.validationFlags).values([
    {
      fixtureId: fixtures[0].id,
      field: "Kick-off Time",
      severity: "high",
      status: "pending",
      sources: [
        { name: "Official API", value: "21:05 CET" },
        { name: "Team Website", value: "21:00 CET" },
      ],
    },
    {
      fixtureId: fixtures[1].id,
      field: "Venue Capacity",
      severity: "medium",
      status: "pending",
      sources: [
        { name: "Stadium DB", value: "51,700" },
        { name: "Team Records", value: "51,900" },
      ],
    },
  ]);

  console.log("✓ Created validation flags");

  // Create model registry
  await db.insert(schema.modelRegistry).values([
    {
      version: "v2.3.1",
      algo: "LightGBM",
      featuresHash: "a1b2c3d4",
      trainSpan: "2023-01 to 2024-11",
      metrics: {
        brierScore: 0.184,
        accuracy: 54.2,
        calibration: 0.92,
      },
      deployed: true,
      deployedAt: new Date(),
    },
    {
      version: "v2.3.0",
      algo: "XGBoost",
      featuresHash: "e5f6g7h8",
      trainSpan: "2023-01 to 2024-10",
      metrics: {
        brierScore: 0.192,
        accuracy: 52.8,
        calibration: 0.89,
      },
      deployed: false,
    },
    {
      version: "v2.2.5",
      algo: "Logistic Regression",
      featuresHash: "i9j0k1l2",
      trainSpan: "2023-01 to 2024-09",
      metrics: {
        brierScore: 0.218,
        accuracy: 51.3,
        calibration: 0.85,
      },
      deployed: false,
    },
  ]);

  console.log("✓ Created model registry");

  console.log("✅ Seeding complete!");
}

seed()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
