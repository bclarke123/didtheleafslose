import { getStore } from "@netlify/blobs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Config } from "@netlify/functions";

const BUILD_HOOK_URL =
  "https://api.netlify.com/build_hooks/696d468b71a04ae195f79a56";
const GAME_STATE_STORE = "game-state";
const REVIEWS_STORE = "game-reviews";

interface Game {
  id: number;
  gameDate: string;
  gameState: string;
  startTimeUTC: string;
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

interface ScheduleResponse {
  games: Game[];
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
    shotType: string;
    strength: string;
    goalModifier: string;
    goalsToDate: number;
    assists: {
      firstName: { default: string };
      lastName: { default: string };
    }[];
  }[];
}

interface PenaltyPeriod {
  periodDescriptor: { number: number; periodType: string };
  penalties: {
    timeInPeriod: string;
    type: string;
    duration: number;
    committedByPlayer: string;
    teamAbbrev: { default: string };
    drawnBy: string;
    descKey: string;
  }[];
}

interface PlayerStats {
  playerId: number;
  name: { default: string };
  position: string;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  sog: number;
  blockedShots: number;
  giveaways: number;
  takeaways: number;
  toi: string;
  faceoffWinningPctg: number;
}

interface GoalieStats {
  playerId: number;
  name: { default: string };
  position: string;
  saveShotsAgainst: string;
  savePctg: number;
  goalsAgainst: number;
  toi: string;
  starter: boolean;
  decision: string;
}

interface ScheduleData {
  latestCompleted: Game | null;
  nextUpcoming: Game | null;
  gameInProgress: Game | null;
}

async function getScheduleData(): Promise<ScheduleData | null> {
  const res = await fetch(
    "https://api-web.nhle.com/v1/club-schedule-season/TOR/now"
  );

  if (!res.ok) {
    return null;
  }

  const data: ScheduleResponse = await res.json();

  const completedGames = data.games.filter(
    (game) => game.gameState === "OFF" || game.gameState === "FINAL"
  );

  const upcomingGames = data.games.filter(
    (game) => game.gameState === "FUT"
  );

  // Games in progress have states like LIVE, CRIT, etc.
  const liveGames = data.games.filter(
    (game) => game.gameState !== "OFF" && game.gameState !== "FINAL" && game.gameState !== "FUT"
  );

  return {
    latestCompleted: completedGames.length > 0 ? completedGames[completedGames.length - 1] : null,
    nextUpcoming: upcomingGames.length > 0 ? upcomingGames[0] : null,
    gameInProgress: liveGames.length > 0 ? liveGames[0] : null,
  };
}

async function getGameData(gameId: number) {
  const [landingRes, boxscoreRes] = await Promise.all([
    fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`),
    fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`),
  ]);

  const landing = landingRes.ok ? await landingRes.json() : null;
  const boxscore = boxscoreRes.ok ? await boxscoreRes.json() : null;

  const playerByGameStats = boxscore?.playerByGameStats;
  const leafsIsHome = boxscore?.homeTeam?.abbrev === "TOR";
  const leafsPlayerStats = playerByGameStats
    ? leafsIsHome ? playerByGameStats.homeTeam : playerByGameStats.awayTeam
    : null;
  const opponentPlayerStats = playerByGameStats
    ? leafsIsHome ? playerByGameStats.awayTeam : playerByGameStats.homeTeam
    : null;

  return {
    scoring: (landing?.summary?.scoring ?? []) as ScoringPeriod[],
    penalties: (landing?.summary?.penalties ?? []) as PenaltyPeriod[],
    threeStars: (boxscore?.summary?.threeStars ?? []) as ThreeStar[],
    homeTeam: boxscore?.homeTeam,
    awayTeam: boxscore?.awayTeam,
    leafsSkaters: [
      ...((leafsPlayerStats?.forwards ?? []) as PlayerStats[]),
      ...((leafsPlayerStats?.defense ?? []) as PlayerStats[]),
    ],
    leafsGoalies: (leafsPlayerStats?.goalies ?? []) as GoalieStats[],
    opponentSkaters: [
      ...((opponentPlayerStats?.forwards ?? []) as PlayerStats[]),
      ...((opponentPlayerStats?.defense ?? []) as PlayerStats[]),
    ],
    opponentGoalies: (opponentPlayerStats?.goalies ?? []) as GoalieStats[],
  };
}

async function generateReview(
  game: Game,
  scoring: ScoringPeriod[],
  penalties: PenaltyPeriod[],
  threeStars: ThreeStar[],
  leafsStats: { sog: number; powerPlay: string; pim: number } | null,
  opponentStats: { sog: number; powerPlay: string; pim: number } | null,
  leafsSkaters: PlayerStats[],
  leafsGoalies: GoalieStats[],
  opponentSkaters: PlayerStats[],
  opponentGoalies: GoalieStats[]
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set");
    return null;
  }

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
        const assists = g.assists.length === 0
          ? "unassisted"
          : g.assists.map((a) => `${a.firstName.default} ${a.lastName.default}`).join(", ");
        const modifiers = [
          g.strength !== "ev" ? g.strength.toUpperCase() : "",
          g.goalModifier === "empty-net" ? "EN" : "",
        ].filter(Boolean).join(", ");
        const modStr = modifiers ? ` [${modifiers}]` : "";
        return `${periodLabel} ${g.timeInPeriod}: ${g.firstName.default} ${g.lastName.default} (${g.teamAbbrev.default}, ${g.shotType})${modStr} - season goal #${g.goalsToDate}. Assists: ${assists}`;
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

  const penaltySummary = penalties
    .flatMap((period) =>
      period.penalties.map((p) => {
        const periodLabel =
          period.periodDescriptor.periodType === "OT"
            ? "OT"
            : `P${period.periodDescriptor.number}`;
        const drawnByStr = p.drawnBy ? ` drawn by ${p.drawnBy}` : "";
        return `${periodLabel} ${p.timeInPeriod}: ${p.committedByPlayer} (${p.teamAbbrev.default}) - ${p.descKey} ${p.duration}min${drawnByStr}`;
      })
    )
    .join("\n");

  const formatSkaterLine = (s: PlayerStats) =>
    `${s.name.default} (${s.position}): ${s.goals}G ${s.assists}A ${s.points}P, ${s.plusMinus >= 0 ? "+" : ""}${s.plusMinus}, ${s.sog} SOG, ${s.hits} hits, ${s.toi} TOI${s.faceoffWinningPctg > 0 ? `, ${(s.faceoffWinningPctg * 100).toFixed(0)}% FO` : ""}`;

  const formatGoalieLine = (g: GoalieStats) =>
    `${g.name.default}: ${g.saveShotsAgainst} saves (${(g.savePctg * 100).toFixed(1)}%), ${g.toi} TOI${g.decision ? `, ${g.decision}` : ""}`;

  const leafsSkatersStr = leafsSkaters
    .sort((a, b) => b.points - a.points || b.goals - a.goals || b.sog - a.sog)
    .map(formatSkaterLine)
    .join("\n");

  const leafsGoaliesStr = leafsGoalies.map(formatGoalieLine).join("\n");

  const opponentSkatersStr = opponentSkaters
    .sort((a, b) => b.points - a.points || b.goals - a.goals || b.sog - a.sog)
    .map(formatSkaterLine)
    .join("\n");

  const opponentGoaliesStr = opponentGoalies.map(formatGoalieLine).join("\n");

  const systemInstruction = `You are a snarky, self-deprecating Toronto Maple Leafs fan writing a brief game recap. You've seen it all - decades of playoff disappointments, blown leads, and yet you keep coming back. Your main goal is to be funny, witty, and entertaining.

STRICT RULE: Never mention days of the week, "tonight", "this evening", or any time references. Just talk about the game itself. Never mention the Raptors or Blue Jays. Never use emoji, em dashes, or semicolons.

You will be given detailed game data, player stats, and penalties from the Leafs' most recent game. Write a 2-3 paragraph game recap. Be snarky and self-deprecating if they lost (classic Leafs fashion). If they won, be cautiously optimistic but remind everyone not to get too excited (it's the Leafs after all). Reference specific players, moments, and stats from the data. You have detailed player stats so use them to highlight standout performances, rough nights, and interesting details. Keep it punchy and entertaining, avoid complete despair and keep it playful and light hearted. No headers or titles, just the recap text.`;

  const prompt = `GAME DATA:
- Date: ${game.gameDate}
- Result: Leafs ${didLose ? "LOST" : "WON"} ${leafsScore}-${opponentScore} ${isLeafsHome ? "at home vs" : "on the road against"} ${opponent}
${wasOT ? "- Game went to overtime" : ""}${wasSO ? "- Decided in a shootout" : ""}

GOALS:
${scoringSummary || "No goals"}

PENALTIES:
${penaltySummary || "None"}

THREE STARS:
${threeStarsSummary || "Not available"}

${leafsStats ? `LEAFS TEAM STATS: ${leafsStats.sog} shots, ${leafsStats.powerPlay} power play, ${leafsStats.pim} PIM` : ""}
${opponentStats ? `${opponent.toUpperCase()} TEAM STATS: ${opponentStats.sog} shots, ${opponentStats.powerPlay} power play, ${opponentStats.pim} PIM` : ""}

LEAFS PLAYER STATS:
${leafsGoaliesStr || "Not available"}
${leafsSkatersStr || "Not available"}

${opponent.toUpperCase()} PLAYER STATS:
${opponentGoaliesStr || "Not available"}
${opponentSkatersStr || "Not available"}`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    systemInstruction,
  });

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini error:", error);
    return null;
  }
}

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
    const { scoring, penalties, threeStars, homeTeam, awayTeam, leafsSkaters, leafsGoalies, opponentSkaters, opponentGoalies } = await getGameData(latestGame.id);

    const isLeafsHome = latestGame.homeTeam.abbrev === "TOR";
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

    // Generate review
    const review = await generateReview(latestGame, scoring, penalties, threeStars, leafsStats, opponentStats, leafsSkaters, leafsGoalies, opponentSkaters, opponentGoalies);

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
        wasOT: scoring.some((p) => p.periodDescriptor.periodType === "OT"),
        wasSO: scoring.some((p) => p.periodDescriptor.periodType === "SO"),
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
