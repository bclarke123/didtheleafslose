import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import type { StoredGame, ScoringPeriod } from "../../lib/nhl-types";
import { getScheduleData, getGameData } from "../../lib/nhl-api";
import { generateReview } from "../../lib/review";

const BUILD_HOOK_URL =
  "https://api.netlify.com/build_hooks/696d468b71a04ae195f79a56";
const GAME_STATE_STORE = "game-state";
const REVIEWS_STORE = "game-reviews";

async function triggerRebuild(): Promise<void> {
  await fetch(BUILD_HOOK_URL, { method: "POST" });
}

export default async () => {
  const stateStore = getStore({ name: GAME_STATE_STORE, consistency: "strong" });
  const reviewsStore = getStore({ name: REVIEWS_STORE, consistency: "strong" });

  // Check if we should poll the API based on stored next game time
  const nextGameTime = await stateStore.get("nextGameTime", { type: "text" });

  if (nextGameTime) {
    const gameStart = new Date(nextGameTime).getTime();
    const now = Date.now();
    const msSinceStart = now - gameStart;

    // Game hasn't started yet - no need to poll
    if (msSinceStart < 0) {
      const msUntilGame = -msSinceStart;
      const hoursUntil = Math.floor(msUntilGame / (60 * 60 * 1000));
      const minsUntil = Math.floor((msUntilGame % (60 * 60 * 1000)) / (60 * 1000));
      console.log(`Game starts in ${hoursUntil}h ${minsUntil}m`);
      return new Response("Game not started", { status: 200 });
    }

    // Game started less than 90 minutes ago - unlikely to be over
    if (msSinceStart < 90 * 60 * 1000) {
      const minsSinceStart = Math.floor(msSinceStart / (60 * 1000));
      console.log(`Game started ${minsSinceStart}m ago, waiting`);
      return new Response("Game in progress", { status: 200 });
    }
  }

  // Either no nextGameTime (bootstrap) or game might be over - poll API
  const schedule = await getScheduleData();

  if (!schedule) {
    return new Response("Could not fetch schedule", { status: 200 });
  }

  // Game still in progress - wait for it to finish
  if (schedule.gameInProgress) {
    console.log(`Game in progress (state: ${schedule.gameInProgress.gameState}), waiting`);
    return new Response("Game in progress", { status: 200 });
  }

  if (!schedule.latestCompleted) {
    return new Response("No completed games", { status: 200 });
  }

  const latestGame = schedule.latestCompleted;
  const currentGameKey = `${latestGame.id}-${latestGame.gameDate}`;
  const lastKnownGameKey = await stateStore.get("lastGameId", { type: "text" });

  // No new game to process
  if (lastKnownGameKey === currentGameKey) {
    // Update nextGameTime in case it's stale or missing
    if (schedule.nextUpcoming) {
      await stateStore.set("nextGameTime", schedule.nextUpcoming.startTimeUTC);
    }
    console.log("No new games");
    return new Response("No new games", { status: 200 });
  }

  // New game to process - check if we already have a review
  const existingReview = await reviewsStore.get(String(latestGame.id), { type: "json" });

  if (!existingReview) {
    // Fetch game data
    const { scoring, penalties, threeStars, leafsStats, opponentStats, leafsSkaters, leafsGoalies, opponentSkaters, opponentGoalies, playByPlayNarrative } = await getGameData(latestGame.id);

    const isLeafsHome = latestGame.homeTeam.abbrev === "TOR";

    // Generate review
    const review = await generateReview(latestGame, scoring, penalties, threeStars, leafsStats, opponentStats, leafsSkaters, leafsGoalies, opponentSkaters, opponentGoalies, playByPlayNarrative);

    if (review) {
      const leafsScore = isLeafsHome ? latestGame.homeTeam.score ?? 0 : latestGame.awayTeam.score ?? 0;
      const opponentScore = isLeafsHome ? latestGame.awayTeam.score ?? 0 : latestGame.homeTeam.score ?? 0;
      const opponent = isLeafsHome
        ? latestGame.awayTeam.placeName.default
        : latestGame.homeTeam.placeName.default;

      const storedGame: StoredGame = {
        gameId: latestGame.id,
        gameDate: latestGame.gameDate,
        opponent,
        isLeafsHome,
        didLose: leafsScore < opponentScore,
        leafsScore,
        opponentScore,
        wasOT: (scoring as ScoringPeriod[]).some((p) => p.periodDescriptor.periodType === "OT"),
        wasSO: (scoring as ScoringPeriod[]).some((p) => p.periodDescriptor.periodType === "SO"),
        review,
      };

      await reviewsStore.setJSON(String(latestGame.id), storedGame);
    }
  }

  // Update state and trigger rebuild
  await stateStore.set("lastGameId", currentGameKey);
  if (schedule.nextUpcoming) {
    await stateStore.set("nextGameTime", schedule.nextUpcoming.startTimeUTC);
  }
  await triggerRebuild();

  console.log(`Game finished: ${latestGame.id}`);
  return new Response(`Processed game ${latestGame.id}`, { status: 200 });
};

export const config: Config = {
  schedule: "* * * * *",
};
