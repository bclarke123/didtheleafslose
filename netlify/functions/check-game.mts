import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const BUILD_HOOK_URL =
  "https://api.netlify.com/build_hooks/696d468b71a04ae195f79a56";

interface Game {
  id: number;
  gameDate: string;
  gameState: string;
}

interface ScheduleResponse {
  games: Game[];
}

async function getLatestCompletedGameId(): Promise<string | null> {
  const res = await fetch(
    "https://api-web.nhle.com/v1/club-schedule-season/TOR/now"
  );

  if (!res.ok) {
    console.error("Failed to fetch schedule:", res.status);
    return null;
  }

  const data: ScheduleResponse = await res.json();

  const completedGames = data.games.filter(
    (game) => game.gameState === "OFF" || game.gameState === "FINAL"
  );

  if (completedGames.length === 0) {
    return null;
  }

  const latestGame = completedGames[completedGames.length - 1];
  return `${latestGame.id}-${latestGame.gameDate}`;
}

async function triggerRebuild(): Promise<void> {
  const res = await fetch(BUILD_HOOK_URL, { method: "POST" });
  if (!res.ok) {
    console.error("Failed to trigger rebuild:", res.status);
  } else {
    console.log("Rebuild triggered successfully");
  }
}

export default async () => {
  console.log("Checking for new game results...");

  const store = getStore("game-state");
  const currentGameId = await getLatestCompletedGameId();

  if (!currentGameId) {
    console.log("No completed games found");
    return { statusCode: 200 };
  }

  const lastKnownGameId = await store.get("lastGameId");

  if (lastKnownGameId !== currentGameId) {
    console.log(`New game detected: ${lastKnownGameId} -> ${currentGameId}`);
    await store.set("lastGameId", currentGameId);
    await triggerRebuild();
  } else {
    console.log("No new games");
  }
};

export const config: Config = {
  schedule: "* * * * *"
};
