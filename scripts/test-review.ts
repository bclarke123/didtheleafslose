import "dotenv/config";
import type { Game } from "../lib/nhl-types";
import { getScheduleData, getGameData } from "../lib/nhl-api";
import { generateReview } from "../lib/review";

async function main() {
  const gameId = parseInt(process.argv[2], 10);
  if (!gameId) {
    console.error("Usage: npx tsx scripts/test-review.ts <gameId>");
    process.exit(1);
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not found. Add it to a .env file.");
    process.exit(1);
  }

  console.log(`Fetching data for game ${gameId}...`);

  // Try to find game in the current season schedule
  const schedule = await getScheduleData();
  let game: Game | undefined;

  if (schedule) {
    const allCandidates = [schedule.latestCompleted, schedule.nextUpcoming, schedule.gameInProgress];
    game = allCandidates.find((g) => g?.id === gameId) ?? undefined;
  }

  // If not found in schedule, construct a minimal Game from the landing endpoint
  if (!game) {
    console.log("Game not in current schedule, fetching from landing endpoint...");
    const landingRes = await fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`);
    if (!landingRes.ok) {
      console.error(`Could not fetch game ${gameId} from landing endpoint`);
      process.exit(1);
    }
    const landing = await landingRes.json();
    game = {
      id: landing.id,
      gameDate: landing.gameDate,
      gameType: landing.gameType,
      gameState: landing.gameState,
      startTimeUTC: landing.startTimeUTC,
      awayTeam: {
        abbrev: landing.awayTeam.abbrev,
        placeName: landing.awayTeam.placeName,
        score: landing.awayTeam.score,
      },
      homeTeam: {
        abbrev: landing.homeTeam.abbrev,
        placeName: landing.homeTeam.placeName,
        score: landing.homeTeam.score,
      },
    };
  }

  const { scoring, penalties, threeStars, leafsStats, opponentStats, leafsSkaters, leafsGoalies, opponentSkaters, opponentGoalies, playByPlayNarrative } = await getGameData(gameId);

  console.log("Generating review...\n");

  const review = await generateReview(game, scoring, penalties, threeStars, leafsStats, opponentStats, leafsSkaters, leafsGoalies, opponentSkaters, opponentGoalies, playByPlayNarrative);

  if (review) {
    console.log("=".repeat(60));
    console.log(review);
    console.log("=".repeat(60));
  } else {
    console.error("Failed to generate review");
    process.exit(1);
  }
}

main();
