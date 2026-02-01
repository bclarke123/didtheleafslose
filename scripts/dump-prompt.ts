import type { Game } from "../lib/nhl-types";
import { getScheduleData, getGameData } from "../lib/nhl-api";
import { buildReviewPrompt } from "../lib/review";

async function main() {
  const gameId = parseInt(process.argv[2], 10);
  if (!gameId) {
    console.error("Usage: npx tsx scripts/dump-prompt.ts <gameId>");
    process.exit(1);
  }

  console.error(`Fetching data for game ${gameId}...`);

  // Try to find game in the current season schedule
  const schedule = await getScheduleData();
  let game: Game | undefined;

  if (schedule) {
    const allCandidates = [schedule.latestCompleted, schedule.nextUpcoming, schedule.gameInProgress];
    game = allCandidates.find((g) => g?.id === gameId) ?? undefined;
  }

  // If not found in schedule, construct a minimal Game from the landing endpoint
  if (!game) {
    console.error("Game not in current schedule, fetching from landing endpoint...");
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

  const { scoring, penalties, threeStars, homeTeam, awayTeam, leafsSkaters, leafsGoalies, opponentSkaters, opponentGoalies, playByPlayNarrative } = await getGameData(gameId);

  const isLeafsHome = game.homeTeam.abbrev === "TOR";
  const leafsStats = isLeafsHome && homeTeam
    ? { sog: homeTeam.sog, powerPlay: homeTeam.powerPlay, pim: homeTeam.pim }
    : !isLeafsHome && awayTeam
    ? { sog: awayTeam.sog, powerPlay: awayTeam.powerPlay, pim: awayTeam.pim }
    : null;
  const opponentStats = isLeafsHome && awayTeam
    ? { sog: awayTeam.sog, powerPlay: awayTeam.powerPlay, pim: awayTeam.pim }
    : !isLeafsHome && homeTeam
    ? { sog: homeTeam.sog, powerPlay: homeTeam.powerPlay, pim: homeTeam.pim }
    : null;

  const { systemInstruction, prompt } = buildReviewPrompt(
    game, scoring, penalties, threeStars, leafsStats, opponentStats,
    leafsSkaters, leafsGoalies, opponentSkaters, opponentGoalies,
    playByPlayNarrative
  );

  console.log("=== SYSTEM INSTRUCTION ===");
  console.log(systemInstruction);
  console.log("\n=== PROMPT ===");
  console.log(prompt);
}

main();
