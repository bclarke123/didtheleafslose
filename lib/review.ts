import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  Game,
  ScoringPeriod,
  PenaltyPeriod,
  ThreeStar,
  PlayerStats,
  GoalieStats,
} from "./nhl-types";

export interface ReviewPrompt {
  systemInstruction: string;
  prompt: string;
}

export function buildReviewPrompt(
  game: Game,
  scoring: ScoringPeriod[],
  penalties: PenaltyPeriod[],
  threeStars: ThreeStar[],
  leafsStats: { sog: number; powerPlay: string; pim: number } | null,
  opponentStats: { sog: number; powerPlay: string; pim: number } | null,
  leafsSkaters: PlayerStats[],
  leafsGoalies: GoalieStats[],
  opponentSkaters: PlayerStats[],
  opponentGoalies: GoalieStats[],
  playByPlayNarrative: string
): ReviewPrompt {
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

You will be given detailed game data including player stats, penalties, and a full play-by-play log from the Leafs' most recent game. Write a 2-3 paragraph game recap. Be snarky and self-deprecating if they lost (classic Leafs fashion). If they won, be cautiously optimistic but remind everyone not to get too excited (it's the Leafs after all). Reference specific players, moments, and stats from the data. You have a complete play-by-play log so use it to identify momentum shifts, dominant stretches, key sequences (like a flurry of shots or hits), and turning points. You have detailed player stats so use them to highlight standout performances, rough nights, and interesting details. Keep it punchy and entertaining, avoid complete despair and keep it playful and light hearted. No headers or titles, just the recap text.`;

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
${opponentSkatersStr || "Not available"}

${playByPlayNarrative}`;

  return { systemInstruction, prompt };
}

export async function generateReview(
  game: Game,
  scoring: ScoringPeriod[],
  penalties: PenaltyPeriod[],
  threeStars: ThreeStar[],
  leafsStats: { sog: number; powerPlay: string; pim: number } | null,
  opponentStats: { sog: number; powerPlay: string; pim: number } | null,
  leafsSkaters: PlayerStats[],
  leafsGoalies: GoalieStats[],
  opponentSkaters: PlayerStats[],
  opponentGoalies: GoalieStats[],
  playByPlayNarrative: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set");
    return null;
  }

  const { systemInstruction, prompt } = buildReviewPrompt(
    game, scoring, penalties, threeStars, leafsStats, opponentStats,
    leafsSkaters, leafsGoalies, opponentSkaters, opponentGoalies,
    playByPlayNarrative
  );

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
