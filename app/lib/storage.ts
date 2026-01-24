// Game review storage using Netlify Blobs

import { getStore } from "@netlify/blobs";

export interface StoredGame {
  gameId: number;
  gameDate: string;
  opponent: string;
  isLeafsHome: boolean;
  didLose: boolean;
  leafsScore: number;
  opponentScore: number;
  wasOT: boolean;
  wasSO: boolean;
  review: string;
}

const STORE_NAME = "game-reviews";

function isNetlifyEnvironment(): boolean {
  return !!(process.env.NETLIFY || process.env.NETLIFY_LOCAL);
}

export async function saveGameReview(game: StoredGame): Promise<void> {
  if (!isNetlifyEnvironment()) {
    console.log("Skipping save: not in Netlify environment");
    return;
  }

  try {
    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    await store.setJSON(String(game.gameId), game);
  } catch (error) {
    console.error("Failed to save game review:", error);
  }
}

export async function getGameReview(gameId: number): Promise<StoredGame | null> {
  if (!isNetlifyEnvironment()) {
    return null;
  }

  try {
    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const game = await store.get(String(gameId), { type: "json" });
    return game as StoredGame | null;
  } catch (error) {
    console.error("Failed to get game review:", error);
    return null;
  }
}

export async function getAllGameReviews(): Promise<StoredGame[]> {
  if (!isNetlifyEnvironment()) {
    return [];
  }

  try {
    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const { blobs } = await store.list();

    const games = await Promise.all(
      blobs.map(async (blob) => {
        const game = await store.get(blob.key, { type: "json" });
        return game as StoredGame;
      })
    );

    // Sort by date descending (most recent first)
    return games
      .filter((g): g is StoredGame => g !== null)
      .sort((a, b) => b.gameDate.localeCompare(a.gameDate));
  } catch (error) {
    console.error("Failed to get all game reviews:", error);
    return [];
  }
}

export async function getAllGameIds(): Promise<string[]> {
  if (!isNetlifyEnvironment()) {
    return [];
  }

  try {
    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const { blobs } = await store.list();
    return blobs.map((blob) => blob.key);
  } catch (error) {
    console.error("Failed to get game IDs:", error);
    return [];
  }
}
