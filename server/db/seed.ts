import { eq } from "drizzle-orm";
import {
  bets,
  competitions,
  events,
  fixtures,
  lineupPlayers,
  lineups,
  modelRegistry,
  odds,
  predictions,
  seasons,
  teamSeasons,
  teams,
  users,
  validationFlags,
  weather,
} from "@shared/schema";
import { db, pool } from "../db";

async function seed() {
  await db.transaction(async (tx) => {
    await tx.delete(validationFlags);
    await tx.delete(bets);
    await tx.delete(predictions);
    await tx.delete(odds);
    await tx.delete(events);
    await tx.delete(lineupPlayers);
    await tx.delete(lineups);
    await tx.delete(weather);
    await tx.delete(fixtures);
    await tx.delete(teamSeasons);
    await tx.delete(seasons);
    await tx.delete(modelRegistry);
    await tx.delete(teams);
    await tx.delete(competitions);

    const [premiership] = await tx
      .insert(competitions)
      .values({
        name: "Gallagher Premiership",
        code: "ENG-PREM",
        country: "England",
        level: "Top Flight",
      })
      .returning();

    const [season2024] = await tx
      .insert(seasons)
      .values({
        competitionId: premiership.id,
        name: "2024/2025",
        startDate: "2024-09-07",
        endDate: "2025-06-07",
        year: 2024,
      })
      .returning();

    const teamRows = await tx
      .insert(teams)
      .values([
        {
          name: "Harlequins",
          shortName: "Quins",
          code: "HAR",
          foundedYear: 1866,
          city: "London",
          country: "England",
          primaryColor: "#651d32",
          secondaryColor: "#009a44",
        },
        {
          name: "Saracens",
          shortName: "Sarries",
          code: "SAR",
          foundedYear: 1876,
          city: "London",
          country: "England",
          primaryColor: "#000000",
          secondaryColor: "#ff0000",
        },
        {
          name: "Bath Rugby",
          shortName: "Bath",
          code: "BAT",
          foundedYear: 1865,
          city: "Bath",
          country: "England",
          primaryColor: "#0055a4",
          secondaryColor: "#ffffff",
        },
        {
          name: "Leicester Tigers",
          shortName: "Tigers",
          code: "LEI",
          foundedYear: 1880,
          city: "Leicester",
          country: "England",
          primaryColor: "#006a4e",
          secondaryColor: "#ffffff",
        },
      ])
      .returning();

    const teamsByCode = new Map(teamRows.map((team) => [team.code ?? team.name, team]));

    await tx.insert(teamSeasons).values(
      teamRows.map((team) => ({
        teamId: team.id,
        seasonId: season2024.id,
        competitionId: premiership.id,
        homeStadium:
          team.code === "HAR"
            ? "Twickenham Stoop"
            : team.code === "SAR"
              ? "StoneX Stadium"
              : team.code === "BAT"
                ? "Recreation Ground"
                : "Mattioli Woods Welford Road",
      })),
    );

    const [fixtureOne] = await tx
      .insert(fixtures)
      .values({
        seasonId: season2024.id,
        round: 1,
        matchDay: 1,
        stage: "Regular Season",
        homeTeamId: teamsByCode.get("HAR")!.id,
        awayTeamId: teamsByCode.get("SAR")!.id,
        venue: "Twickenham Stoop",
        referee: "Wayne Barnes",
        attendance: 14800,
        kickoffAt: new Date("2024-10-05T14:00:00Z"),
        status: "completed",
        homeScore: 28,
        awayScore: 24,
      })
      .returning();

    const [fixtureTwo] = await tx
      .insert(fixtures)
      .values({
        seasonId: season2024.id,
        round: 1,
        matchDay: 1,
        stage: "Regular Season",
        homeTeamId: teamsByCode.get("BAT")!.id,
        awayTeamId: teamsByCode.get("LEI")!.id,
        venue: "Recreation Ground",
        referee: "Luke Pearce",
        attendance: 16200,
        kickoffAt: new Date("2024-10-06T13:00:00Z"),
        status: "scheduled",
      })
      .returning();

    const [quinsLineup] = await tx
      .insert(lineups)
      .values({
        fixtureId: fixtureOne.id,
        teamId: teamsByCode.get("HAR")!.id,
        formation: "15-man",
        tactic: "High-tempo attacking",
        coach: "Tabai Matson",
      })
      .returning();

    const [saracensLineup] = await tx
      .insert(lineups)
      .values({
        fixtureId: fixtureOne.id,
        teamId: teamsByCode.get("SAR")!.id,
        formation: "15-man",
        tactic: "Territory control",
        coach: "Mark McCall",
      })
      .returning();

    await tx.insert(lineupPlayers).values([
      {
        lineupId: quinsLineup.id,
        playerName: "Marcus Smith",
        position: "Fly-half",
        shirtNumber: 10,
        isStarting: true,
      },
      {
        lineupId: quinsLineup.id,
        playerName: "Andre Esterhuizen",
        position: "Centre",
        shirtNumber: 12,
        isStarting: true,
      },
      {
        lineupId: quinsLineup.id,
        playerName: "Danny Care",
        position: "Scrum-half",
        shirtNumber: 9,
        isStarting: true,
      },
      {
        lineupId: saracensLineup.id,
        playerName: "Owen Farrell",
        position: "Fly-half",
        shirtNumber: 10,
        isStarting: true,
      },
      {
        lineupId: saracensLineup.id,
        playerName: "Maro Itoje",
        position: "Lock",
        shirtNumber: 5,
        isStarting: true,
      },
      {
        lineupId: saracensLineup.id,
        playerName: "Jamie George",
        position: "Hooker",
        shirtNumber: 2,
        isStarting: true,
      },
    ]);

    await tx.insert(events).values([
      {
        fixtureId: fixtureOne.id,
        teamId: teamsByCode.get("HAR")!.id,
        playerName: "Marcus Smith",
        eventType: "try",
        minute: 15,
        description: "Solo try after line break",
      },
      {
        fixtureId: fixtureOne.id,
        teamId: teamsByCode.get("SAR")!.id,
        playerName: "Jamie George",
        eventType: "try",
        minute: 52,
        description: "Driving maul over the line",
      },
    ]);

    await tx.insert(odds).values([
      {
        fixtureId: fixtureOne.id,
        bookmaker: "DemoBook",
        market: "1X2",
        home: "1.85",
        draw: "21.00",
        away: "2.10",
      },
      {
        fixtureId: fixtureTwo.id,
        bookmaker: "DemoBook",
        market: "1X2",
        home: "2.05",
        draw: "18.50",
        away: "1.95",
      },
    ]);

    await tx.insert(weather).values([
      {
        fixtureId: fixtureOne.id,
        temperatureC: "14.5",
        humidity: 72,
        windSpeedKph: "12.3",
        condition: "Partly cloudy",
        recordedAt: new Date("2024-10-05T12:30:00Z"),
      },
      {
        fixtureId: fixtureTwo.id,
        temperatureC: "16.1",
        humidity: 68,
        windSpeedKph: "8.6",
        condition: "Sunny",
        recordedAt: new Date("2024-10-06T11:15:00Z"),
      },
    ]);

    const [baselineModel] = await tx
      .insert(modelRegistry)
      .values({
        name: "baseline-xgboost",
        version: "1.0.0",
        description: "Gradient boosted baseline using match statistics",
        trainingWindow: "2015-2024",
        hyperparameters: {
          max_depth: 6,
          learning_rate: 0.05,
        },
        metrics: {
          log_loss: 0.6732,
          brier_score: 0.1821,
        },
      })
      .returning();

    const [fixtureOnePrediction] = await tx
      .insert(predictions)
      .values({
        fixtureId: fixtureOne.id,
        modelId: baselineModel.id,
        homeWinProbability: "0.55",
        drawProbability: "0.08",
        awayWinProbability: "0.37",
        expectedHomeScore: "27.6",
        expectedAwayScore: "23.4",
        explanation: {
          key_players: ["Marcus Smith", "Andre Esterhuizen"],
          notes: "Positive impact of home advantage and attacking form",
        },
      })
      .returning();

    await tx.insert(validationFlags).values({
      predictionId: fixtureOnePrediction.id,
      level: "info",
      reason: "Monitor late injuries to Harlequins backline",
      resolved: false,
    });

    const [seedUser] = await tx
      .insert(users)
      .values({
        username: "demo@rugbypredict.example",
        password: "password123",
      })
      .onConflictDoNothing()
      .returning();

    const demoUser =
      seedUser ??
      (await tx
        .select()
        .from(users)
        .where(eq(users.username, "demo@rugbypredict.example"))
        .limit(1))[0];

    if (demoUser) {
      await tx.insert(bets).values({
        userId: demoUser.id,
        fixtureId: fixtureOne.id,
        predictionId: fixtureOnePrediction.id,
        betType: "match_winner",
        selection: "Harlequins",
        oddsTaken: "1.90",
        stake: "25.00",
        potentialPayout: "47.50",
        status: "won",
        settledAt: new Date("2024-10-05T17:00:00Z"),
        notes: "Backed the home side after confirming starting lineup.",
      });
    }
  });
}

seed()
  .then(() => {
    console.log("Database seeded with demo Premiership season.");
  })
  .catch((error) => {
    console.error("Failed to seed database", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
