// AI game review generation using Gemini

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ScoringPeriod, ThreeStar } from "./nhl";

export interface GameReviewData {
  leafsScore: number;
  opponentScore: number;
  opponent: string;
  isLeafsHome: boolean;
  didLose: boolean;
  wasOT: boolean;
  wasSO: boolean;
  gameDate: string; // ISO date string (YYYY-MM-DD)
  scoring: ScoringPeriod[];
  threeStars: ThreeStar[];
  leafsStats: { sog: number; powerPlay: string; pim: number } | null;
  opponentStats: { sog: number; powerPlay: string; pim: number } | null;
}

const SYSTEM_PROMPT = `You are a snarky, self-deprecating Toronto Maple Leafs fan writing a brief game recap. You've seen it all - decades of playoff disappointments, blown leads, and yet you keep coming back.

STRICT RULE: Never mention days of the week, "tonight", "this evening", or any time references. Just talk about the game itself.`;

const INSTRUCTIONS = `Write a 2-3 paragraph game recap. Be snarky and self-deprecating if they lost (classic Leafs fashion). If they won, be cautiously optimistic but remind everyone not to get too excited (it's the Leafs after all). Reference specific players and moments from the data. Keep it punchy and entertaining, avoid complete despair and keep it playful and light hearted. No headers or titles, just the recap text.`;

function buildPrompt(data: GameReviewData): string {
  const scoringSummary = data.scoring
    .flatMap((period) =>
      period.goals.map((g) => {
        const team = g.teamAbbrev.default;
        const scorer = `${g.firstName.default} ${g.lastName.default}`;
        const time = g.timeInPeriod;
        const periodLabel =
          period.periodDescriptor.periodType === "OT"
            ? "OT"
            : period.periodDescriptor.periodType === "SO"
            ? "SO"
            : `P${period.periodDescriptor.number}`;
        return `${periodLabel} ${time}: ${scorer} (${team})`;
      })
    )
    .join("\n");

  const threeStarsSummary = data.threeStars
    .map((s) => {
      const name = `${s.firstName.default} ${s.lastName.default}`;
      const stats =
        s.position === "G"
          ? `${((s.savePctg ?? 0) * 100).toFixed(1)}% save pct`
          : `${s.goals ?? 0}G, ${s.assists ?? 0}A`;
      return `${s.star}. ${name} (${s.teamAbbrev}) - ${stats}`;
    })
    .join("\n");

  return `${SYSTEM_PROMPT}

GAME DATA:
- Date: ${data.gameDate}
- Result: Leafs ${data.didLose ? "LOST" : "WON"} ${data.leafsScore}-${data.opponentScore} ${data.isLeafsHome ? "at home vs" : "on the road against"} ${data.opponent}
${data.wasOT ? "- Game went to overtime" : ""}${data.wasSO ? "- Decided in a shootout" : ""}

GOALS:
${scoringSummary || "No goals (0-0 game?)"}

THREE STARS:
${threeStarsSummary || "Not available"}

${data.leafsStats ? `LEAFS STATS: ${data.leafsStats.sog} shots, ${data.leafsStats.powerPlay} power play, ${data.leafsStats.pim} PIM` : ""}
${data.opponentStats ? `${data.opponent.toUpperCase()} STATS: ${data.opponentStats.sog} shots, ${data.opponentStats.powerPlay} power play, ${data.opponentStats.pim} PIM` : ""}

${INSTRUCTIONS}`;
}

export async function generateGameReview(data: GameReviewData): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const prompt = buildPrompt(data);

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini API error:", error);
    return null;
  }
}
