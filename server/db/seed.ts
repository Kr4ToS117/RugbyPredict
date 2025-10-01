import { eq, sql } from "drizzle-orm";
import {
  bets,
  competitions,
  fixtures,
  modelRegistry,
  odds,
  predictions,
  seasons,
  teamSeasons,
  teams,
  users,
  validationFlags,
  weather,
  boxscores,
} from "@shared/schema";
import { db, pool } from "../db";
import { COMPETITIONS, TEAM_DATA } from "../data/sampleSeasons";

async function seed() {
  await db.transaction(async (tx) => {
    await tx.delete(validationFlags);
    await tx.delete(bets);
    await tx.delete(predictions);
    await tx.delete(odds);
    await tx.delete(weather);
    await tx.delete(boxscores);
    await tx.delete(fixtures);
    await tx.delete(teamSeasons);
    await tx.delete(seasons);
    await tx.delete(modelRegistry);
    await tx.delete(teams);
    await tx.delete(competitions);

    const teamsByCode = new Map<string, typeof teams.$inferSelect>();

    for (const team of Object.values(TEAM_DATA)) {
      const [row] = await tx
        .insert(teams)
        .values({
          id: team.id,
          name: team.name,
          shortName: team.shortName,
          code: team.code,
          foundedYear: team.foundedYear,
          city: team.city,
          country: team.country,
          primaryColor: team.primaryColor,
          secondaryColor: team.secondaryColor,
        })
        .onConflictDoUpdate({
          target: teams.id,
          set: {
            name: team.name,
            shortName: team.shortName,
            code: team.code,
            foundedYear: team.foundedYear,
            city: team.city,
            country: team.country,
            primaryColor: team.primaryColor,
            secondaryColor: team.secondaryColor,
          },
        })
        .returning();

      teamsByCode.set(team.code, row);
    }

    const seededFixtures: typeof fixtures.$inferSelect[] = [];
    let highlightPredictionId: string | null = null;

    for (const competition of COMPETITIONS) {
      const [competitionRow] = await tx
        .insert(competitions)
        .values({
          id: competition.id,
          code: competition.code,
          name: competition.name,
          country: competition.country,
          level: competition.level,
        })
        .onConflictDoUpdate({
          target: competitions.id,
          set: {
            name: competition.name,
            code: competition.code,
            country: competition.country,
            level: competition.level,
          },
        })
        .returning();

      for (const season of competition.seasons) {
        const [seasonRow] = await tx
          .insert(seasons)
          .values({
            id: season.id,
            competitionId: competitionRow.id,
            name: season.name,
            startDate: season.startDate,
            endDate: season.endDate,
            year: season.year,
          })
          .onConflictDoUpdate({
            target: seasons.id,
            set: {
              competitionId: competitionRow.id,
              name: season.name,
              startDate: season.startDate,
              endDate: season.endDate,
              year: season.year,
            },
          })
          .returning();

        for (const teamCode of season.teamCodes) {
          const teamSeed = TEAM_DATA[teamCode];
          if (!teamSeed) continue;
          const teamRecord = teamsByCode.get(teamSeed.code);
          if (!teamRecord) continue;

          await tx
            .insert(teamSeasons)
            .values({
              teamId: teamRecord.id,
              seasonId: seasonRow.id,
              competitionId: competitionRow.id,
              homeStadium: teamSeed.homeStadium,
            })
            .onConflictDoUpdate({
              target: [teamSeasons.teamId, teamSeasons.seasonId],
              set: {
                competitionId: competitionRow.id,
                homeStadium: teamSeed.homeStadium,
              },
            });
        }

        for (const fixture of season.fixtures) {
          const homeTeamSeed = TEAM_DATA[fixture.homeTeam];
          const awayTeamSeed = TEAM_DATA[fixture.awayTeam];
          const homeTeam = homeTeamSeed ? teamsByCode.get(homeTeamSeed.code) : null;
          const awayTeam = awayTeamSeed ? teamsByCode.get(awayTeamSeed.code) : null;
          if (!homeTeam || !awayTeam) {
            continue;
          }

          const [fixtureRow] = await tx
            .insert(fixtures)
            .values({
              id: fixture.id,
              seasonId: seasonRow.id,
              round: fixture.round,
              matchDay: fixture.matchDay,
              stage: fixture.stage,
              homeTeamId: homeTeam.id,
              awayTeamId: awayTeam.id,
              venue: fixture.venue,
              referee: fixture.referee,
              attendance: fixture.attendance,
              kickoffAt: new Date(fixture.kickoffAt),
              status: fixture.status,
              homeScore: fixture.status === "completed" ? fixture.result?.homeScore ?? null : null,
              awayScore: fixture.status === "completed" ? fixture.result?.awayScore ?? null : null,
            })
            .onConflictDoUpdate({
              target: fixtures.id,
              set: {
                seasonId: seasonRow.id,
                round: fixture.round,
                matchDay: fixture.matchDay,
                stage: fixture.stage,
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
                venue: fixture.venue,
                referee: fixture.referee,
                attendance: fixture.attendance,
                kickoffAt: new Date(fixture.kickoffAt),
                status: fixture.status,
                homeScore: fixture.status === "completed" ? fixture.result?.homeScore ?? null : null,
                awayScore: fixture.status === "completed" ? fixture.result?.awayScore ?? null : null,
                updatedAt: new Date(),
              },
            })
            .returning();

          seededFixtures.push(fixtureRow);

          if (fixture.odds?.length) {
            await tx
              .insert(odds)
              .values(
                fixture.odds.map((entry) => ({
                  fixtureId: fixtureRow.id,
                  bookmaker: entry.bookmaker,
                  market: entry.market,
                  home: entry.home,
                  draw: entry.draw,
                  away: entry.away,
                  updatedAt: new Date(entry.updatedAt),
                })),
              )
              .onConflictDoNothing();
          }

          if (fixture.weather) {
            await tx
              .insert(weather)
              .values({
                fixtureId: fixtureRow.id,
                temperatureC: fixture.weather.temperatureC,
                humidity: fixture.weather.humidity,
                windSpeedKph: fixture.weather.windSpeedKph,
                condition: fixture.weather.condition,
                recordedAt: new Date(fixture.weather.recordedAt),
              })
              .onConflictDoUpdate({
                target: [weather.fixtureId],
                set: {
                  temperatureC: fixture.weather.temperatureC,
                  humidity: fixture.weather.humidity,
                  windSpeedKph: fixture.weather.windSpeedKph,
                  condition: fixture.weather.condition,
                  recordedAt: new Date(fixture.weather.recordedAt),
                },
              });
          }

          if (fixture.status === "completed" && fixture.result) {
            await tx
              .insert(boxscores)
              .values([
                {
                  fixtureId: fixtureRow.id,
                  teamId: homeTeam.id,
                  stats: fixture.result.homeStats,
                },
                {
                  fixtureId: fixtureRow.id,
                  teamId: awayTeam.id,
                  stats: fixture.result.awayStats,
                },
              ])
              .onConflictDoUpdate({
                target: [boxscores.fixtureId, boxscores.teamId],
                set: {
                  stats: sql`excluded.stats`,
                  updatedAt: new Date(),
                },
              });
          }
        }
      }
    }

    const highlightFixture = seededFixtures.find((fixture) => fixture.status === "completed");

    const [baselineModel] = await tx
      .insert(modelRegistry)
      .values({
        name: "baseline-xgboost",
        version: "1.0.0",
        description: "Gradient boosted baseline using match statistics",
        trainingWindow: "2019-2024",
        hyperparameters: {
          algorithm: "gbdt",
          trees: 200,
          learningRate: 0.05,
          lambda: 1.0,
        },
        metrics: {
          training: {
            accuracy: 0.71,
            brierScore: 0.176,
            logLoss: 0.638,
            roi: 6.2,
            yield: 0.12,
            hitRate: 64.5,
            bets: 220,
            sampleSize: 380,
          },
          backtest: {
            accuracy: 0.67,
            brierScore: 0.182,
            logLoss: 0.654,
            roi: 4.8,
            yield: 0.08,
            hitRate: 61.0,
            bets: 90,
            sampleSize: 120,
          },
          status: "staging",
          trainedAt: "2024-06-20T12:00:00Z",
        },
      })
      .onConflictDoUpdate({
        target: [modelRegistry.name, modelRegistry.version],
        set: {
          description: "Gradient boosted baseline using match statistics",
          trainingWindow: "2019-2024",
        },
      })
      .returning();

    if (highlightFixture) {
      const [predictionRow] = await tx
        .insert(predictions)
        .values({
          fixtureId: highlightFixture.id,
          modelId: baselineModel.id,
          homeWinProbability: "0.56",
          drawProbability: "0.08",
          awayWinProbability: "0.36",
          expectedHomeScore: "27.4",
          expectedAwayScore: "23.1",
          explanation: {
            top_features: ["form_diff", "weather_severity", "implied_edge"],
            notes: "Favorable momentum for the home side with superior phase play",
          },
        })
        .onConflictDoUpdate({
          target: [predictions.fixtureId, predictions.modelId],
          set: {
            homeWinProbability: "0.56",
            drawProbability: "0.08",
            awayWinProbability: "0.36",
            expectedHomeScore: "27.4",
            expectedAwayScore: "23.1",
            explanation: {
              top_features: ["form_diff", "weather_severity", "implied_edge"],
              notes: "Favorable momentum for the home side with superior phase play",
            },
          },
        })
        .returning();

      highlightPredictionId = predictionRow.id;

      await tx.insert(validationFlags).values({
        predictionId: predictionRow.id,
        level: "info",
        reason: "Monitor late injuries reported on matchday",
        resolved: false,
        source: "seed",
        details: {
          fixtureId: highlightFixture.id,
          check: "lineup-integrity",
        },
      });
    }

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

    if (demoUser && highlightFixture) {
      await tx.insert(bets).values({
        userId: demoUser.id,
        fixtureId: highlightFixture.id,
        predictionId: highlightPredictionId ?? null,
        betType: "match_winner",
        selection: "Home",
        oddsTaken: "1.85",
        stake: "30.00",
        potentialPayout: "55.50",
        status: "won",
        settledAt: highlightFixture.kickoffAt
          ? new Date(highlightFixture.kickoffAt.getTime() + 2 * 60 * 60 * 1000)
          : new Date(),
        notes: "Backed the Saints following confirmation of Ludlam starting at flanker.",
      });
    }
  });
}

seed()
  .then(() => {
    console.log("Database seeded with historical Premiership and URC data.");
  })
  .catch((error) => {
    console.error("Failed to seed database", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
