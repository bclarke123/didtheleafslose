import { getStore } from "@netlify/blobs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Config } from "@netlify/functions";

const BATCH_SIZE = 2;
const STORE_NAME = "game-reviews";

interface Game {
  id: number;
  gameDate: string;
  gameState: string;
  awayTeam: {
    abbrev: string;
    placeName: { default: string };
    score?: number;
  };
  homeTeam: {
    abbrev: string;
    placeName: { default: string };
    score?: number;
  };
}

interface StoredGame {
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

interface ThreeStar {
  star: number;
  firstName: { default: string };
  lastName: { default: string };
  teamAbbrev: string;
  position: string;
  goals?: number;
  assists?: number;
  savePctg?: number;
}

interface ScoringPeriod {
  periodDescriptor: {
    number: number;
    periodType: string;
  };
  goals: {
    firstName: { default: string };
    lastName: { default: string };
    teamAbbrev: { default: string };
    timeInPeriod: string;
  }[];
}

async function getCompletedGames(): Promise<Game[]> {
  const res = await fetch(
    "https://api-web.nhle.com/v1/club-schedule-season/TOR/now"
  );
  if (!res.ok) return [];

  const data = await res.json();
  return data.games.filter(
    (game: Game) => game.gameState === "OFF" || game.gameState === "FINAL"
  );
}

async function getGameData(gameId: number) {
  const [landingRes, boxscoreRes] = await Promise.all([
    fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`),
    fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`),
  ]);

  const landing = landingRes.ok ? await landingRes.json() : null;
  const boxscore = boxscoreRes.ok ? await boxscoreRes.json() : null;

  return {
    scoring: landing?.summary?.scoring ?? [],
    threeStars: boxscore?.summary?.threeStars ?? [],
    homeTeam: boxscore?.homeTeam,
    awayTeam: boxscore?.awayTeam,
  };
}

async function generateReview(
  game: Game,
  scoring: ScoringPeriod[],
  threeStars: ThreeStar[],
  leafsStats: { sog: number; powerPlay: string; pim: number } | null,
  opponentStats: { sog: number; powerPlay: string; pim: number } | null
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const isLeafsHome = game.homeTeam.abbrev === "TOR";
  const leafsScore = isLeafsHome ? game.homeTeam.score ?? 0 : game.awayTeam.score ?? 0;
  const opponentScore = isLeafsHome ? game.awayTeam.score ?? 0 : game.homeTeam.score ?? 0;
  const opponent = isLeafsHome
    ? game.awayTeam.placeName.default
    : game.homeTeam.placeName.default;
  const didLose = leafsScore < opponentScore;
  const wasOT = scoring.some((p) => p.periodDescriptor.periodType === "OT");
  const wasSO = scoring.some((p) => p.periodDescriptor.periodType === "SO");

  const scoringSummary = scoring
    .flatMap((period) =>
      period.goals.map((g) => {
        const periodLabel =
          period.periodDescriptor.periodType === "OT"
            ? "OT"
            : period.periodDescriptor.periodType === "SO"
            ? "SO"
            : `P${period.periodDescriptor.number}`;
        return `${periodLabel} ${g.timeInPeriod}: ${g.firstName.default} ${g.lastName.default} (${g.teamAbbrev.default})`;
      })
    )
    .join("\n");

  const threeStarsSummary = threeStars
    .map((s) => {
      const name = `${s.firstName.default} ${s.lastName.default}`;
      const stats =
        s.position === "G"
          ? `${((s.savePctg ?? 0) * 100).toFixed(1)}% save pct`
          : `${s.goals ?? 0}G, ${s.assists ?? 0}A`;
      return `${s.star}. ${name} (${s.teamAbbrev}) - ${stats}`;
    })
    .join("\n");

  const prompt = `You are a snarky, self-deprecating Toronto Maple Leafs fan writing a brief game recap. You've seen it all - decades of playoff disappointments, blown leads, and yet you keep coming back.

STRICT RULE: Never mention days of the week, "tonight", "this evening", or any time references. Just talk about the game itself.

GAME DATA:
- Date: ${game.gameDate}
- Result: Leafs ${didLose ? "LOST" : "WON"} ${leafsScore}-${opponentScore} ${isLeafsHome ? "at home vs" : "on the road against"} ${opponent}
${wasOT ? "- Game went to overtime" : ""}${wasSO ? "- Decided in a shootout" : ""}

GOALS:
${scoringSummary || "No goals"}

THREE STARS:
${threeStarsSummary || "Not available"}

${leafsStats ? `LEAFS STATS: ${leafsStats.sog} shots, ${leafsStats.powerPlay} power play, ${leafsStats.pim} PIM` : ""}
${opponentStats ? `${opponent.toUpperCase()} STATS: ${opponentStats.sog} shots, ${opponentStats.powerPlay} power play, ${opponentStats.pim} PIM` : ""}

Write a 2-3 paragraph game recap. Be snarky and self-deprecating if they lost (classic Leafs fashion). If they won, be cautiously optimistic but remind everyone not to get too excited (it's the Leafs after all). Reference specific players and moments from the data. Keep it punchy and entertaining, avoid complete despair and keep it playful and light hearted. No headers or titles, just the recap text.`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini error:", error);
    return null;
  }
}

export default async () => {
  console.log(`Using store: ${STORE_NAME}`);
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  // Get all completed games
  const games = await getCompletedGames();
  console.log(`Found ${games.length} completed games this season`);

  // Check which games are already stored
  const { blobs } = await store.list();
  console.log(`store.list() returned ${blobs.length} blobs:`, blobs.map(b => b.key));
  const storedIds = new Set(blobs.map((b) => b.key));

  const missingGames = games.filter((g) => !storedIds.has(String(g.id)));
  console.log(`${missingGames.length} games need reviews`);

  if (missingGames.length === 0) {
    return new Response(
      JSON.stringify({
        message: "All games already have reviews!",
        total: games.length,
        stored: storedIds.size
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Process a batch
  const batch = missingGames.slice(0, BATCH_SIZE);
  const results: { gameId: number; success: boolean; error?: string }[] = [];

  // Fetch all game data in parallel first
  console.log(`Fetching data for ${batch.length} games in parallel...`);
  const gameDataMap = new Map<number, Awaited<ReturnType<typeof getGameData>>>();
  await Promise.all(
    batch.map(async (game) => {
      const data = await getGameData(game.id);
      gameDataMap.set(game.id, data);
    })
  );

  // Process reviews sequentially (to avoid Gemini rate limits)
  for (const game of batch) {
    try {
      console.log(`Processing game ${game.id} (${game.gameDate})`);

      const { scoring, threeStars, homeTeam, awayTeam } = gameDataMap.get(game.id)!;

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

      const review = await generateReview(game, scoring, threeStars, leafsStats, opponentStats);

      if (!review) {
        results.push({ gameId: game.id, success: false, error: "Failed to generate review" });
        continue;
      }

      const leafsScore = isLeafsHome ? game.homeTeam.score ?? 0 : game.awayTeam.score ?? 0;
      const opponentScore = isLeafsHome ? game.awayTeam.score ?? 0 : game.homeTeam.score ?? 0;
      const opponent = isLeafsHome
        ? game.awayTeam.placeName.default
        : game.homeTeam.placeName.default;

      const storedGame: StoredGame = {
        gameId: game.id,
        gameDate: game.gameDate,
        opponent,
        isLeafsHome,
        didLose: leafsScore < opponentScore,
        leafsScore,
        opponentScore,
        wasOT: scoring.some((p: ScoringPeriod) => p.periodDescriptor.periodType === "OT"),
        wasSO: scoring.some((p: ScoringPeriod) => p.periodDescriptor.periodType === "SO"),
        review,
      };

      await store.setJSON(String(game.id), storedGame);

      // Verify the save worked
      const verification = await store.get(String(game.id), { type: "json" });
      if (verification) {
        results.push({ gameId: game.id, success: true });
        console.log(`Saved and verified game ${game.id}`);
      } else {
        results.push({ gameId: game.id, success: false, error: "Save did not persist" });
        console.log(`WARNING: Save did not persist for game ${game.id}`);
      }
    } catch (error) {
      console.error(`Error processing game ${game.id}:`, error);
      results.push({ gameId: game.id, success: false, error: String(error) });
    }
  }

  // Re-fetch stored IDs to see actual state
  const { blobs: updatedBlobs } = await store.list();
  const updatedStoredIds = updatedBlobs.map((b) => b.key);

  const remaining = missingGames.length - batch.length;

  return new Response(
    JSON.stringify({
      processed: results,
      remaining,
      storedGameIds: updatedStoredIds,
      totalStored: updatedStoredIds.length,
      message: remaining > 0
        ? `Processed ${batch.length} games. ${remaining} remaining - call again to continue.`
        : "Backfill complete!",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const config: Config = {
  path: "/api/backfill",
};
