// Game review storage using Netlify Blobs (read-only from Next.js)
// Writes are handled by the cron function and backfill function

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

function getStoreOptions() {
  const options: { name: string; consistency: "strong"; siteID?: string; token?: string } = {
    name: STORE_NAME,
    consistency: "strong",
  };

  // For build-time access, we need explicit credentials
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_API_TOKEN) {
    options.siteID = process.env.NETLIFY_SITE_ID;
    options.token = process.env.NETLIFY_API_TOKEN;
  }

  return options;
}

export async function getGameReview(gameId: number): Promise<StoredGame | null> {
  if (!isNetlifyEnvironment()) {
    return null;
  }

  try {
    const store = getStore(getStoreOptions());
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
    const store = getStore(getStoreOptions());
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
    const store = getStore(getStoreOptions());
    const { blobs } = await store.list();
    return blobs.map((blob) => blob.key);
  } catch (error) {
    console.error("Failed to get game IDs:", error);
    return [];
  }
}
