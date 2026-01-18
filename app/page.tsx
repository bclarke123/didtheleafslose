import type { Metadata } from "next";
import { AdBanner } from "./AdBanner";

interface Game {
  id: number;
  gameDate: string;
  gameType: number;
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

interface ScheduleResponse {
  games: Game[];
}

interface GoalAssist {
  playerId: number;
  firstName: { default: string };
  lastName: { default: string };
  sweaterNumber: number;
}

interface Goal {
  playerId: number;
  firstName: { default: string };
  lastName: { default: string };
  teamAbbrev: { default: string };
  timeInPeriod: string;
  shotType: string;
  strength: string;
  assists: GoalAssist[];
  awayScore: number;
  homeScore: number;
  headshot: string;
  highlightClipSharingUrl?: string;
}

interface ScoringPeriod {
  periodDescriptor: {
    number: number;
    periodType: string;
  };
  goals: Goal[];
}

interface GameLanding {
  summary: {
    scoring: ScoringPeriod[];
  };
}

// Force static generation - page rebuilds are triggered by scheduled function
export const dynamic = "force-static";

async function getLatestLeafsGame() {
  const res = await fetch(
    "https://api-web.nhle.com/v1/club-schedule-season/TOR/now"
  );

  if (!res.ok) {
    throw new Error("Failed to fetch schedule");
  }

  const data: ScheduleResponse = await res.json();

  // Find the most recent completed game (gameState "OFF" or "FINAL")
  const completedGames = data.games.filter(
    (game) => game.gameState === "OFF" || game.gameState === "FINAL"
  );

  if (completedGames.length === 0) {
    return null;
  }

  // Get the most recent completed game
  const latestGame = completedGames[completedGames.length - 1];
  return latestGame;
}

async function getGameScoring(gameId: number): Promise<ScoringPeriod[]> {
  const res = await fetch(
    `https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`
  );

  if (!res.ok) {
    return [];
  }

  const data: GameLanding = await res.json();
  return data.summary?.scoring ?? [];
}

function getPeriodLabel(period: ScoringPeriod): string {
  const { number, periodType } = period.periodDescriptor;
  if (periodType === "OT") return "OT";
  if (periodType === "SO") return "SO";
  return `P${number}`;
}

function formatAssists(assists: GoalAssist[]): string {
  if (assists.length === 0) return "Unassisted";
  return assists.map((a) => `${a.firstName.default} ${a.lastName.default}`).join(", ");
}

export async function generateMetadata(): Promise<Metadata> {
  const game = await getLatestLeafsGame();

  if (!game) {
    return {};
  }

  const isLeafsHome = game.homeTeam.abbrev === "TOR";
  const leafsScore = isLeafsHome ? game.homeTeam.score : game.awayTeam.score;
  const opponentScore = isLeafsHome ? game.awayTeam.score : game.homeTeam.score;
  const opponent = isLeafsHome
    ? game.awayTeam.placeName.default
    : game.homeTeam.placeName.default;
  const didLose = (leafsScore ?? 0) < (opponentScore ?? 0);

  const result = didLose ? "lost" : "won";
  const title = `${didLose ? "YES" : "NO"} - Leafs ${result} ${leafsScore}-${opponentScore} vs ${opponent}`;
  const description = `Toronto Maple Leafs ${result} their latest game against ${opponent} with a score of ${leafsScore}-${opponentScore}. Check the latest Leafs scores and results.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      title,
      description,
    },
  };
}

export default async function Home() {
  const game = await getLatestLeafsGame();

  if (!game) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-white">
        <h1 className="text-2xl text-gray-600">
          No recent Toronto Maple Leafs games found
        </h1>
      </main>
    );
  }

  const scoring = await getGameScoring(game.id);

  const isLeafsHome = game.homeTeam.abbrev === "TOR";
  const leafsScore = isLeafsHome ? game.homeTeam.score : game.awayTeam.score;
  const opponentScore = isLeafsHome ? game.awayTeam.score : game.homeTeam.score;
  const opponent = isLeafsHome
    ? game.awayTeam.placeName.default
    : game.homeTeam.placeName.default;

  const didLose = (leafsScore ?? 0) < (opponentScore ?? 0);

  const gameDate = new Date(game.gameDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `Toronto Maple Leafs vs ${opponent}`,
    description: `NHL game: Toronto Maple Leafs ${didLose ? "lost" : "won"} against ${opponent} with a final score of ${leafsScore}-${opponentScore}`,
    startDate: game.gameDate,
    location: {
      "@type": "Place",
      name: isLeafsHome ? "Scotiabank Arena" : `${opponent} Arena`,
    },
    homeTeam: {
      "@type": "SportsTeam",
      name: isLeafsHome ? "Toronto Maple Leafs" : opponent,
    },
    awayTeam: {
      "@type": "SportsTeam",
      name: isLeafsHome ? opponent : "Toronto Maple Leafs",
    },
    competitor: [
      {
        "@type": "SportsTeam",
        name: "Toronto Maple Leafs",
        result: didLose ? "loss" : "win",
      },
      {
        "@type": "SportsTeam",
        name: opponent,
        result: didLose ? "win" : "loss",
      },
    ],
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Did the Leafs Lose?",
    url: "https://didtheleafslose.com",
    description:
      "Check if the Toronto Maple Leafs won or lost their latest NHL game. Get instant Leafs scores and game results.",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen flex flex-col items-center bg-white px-4 pt-2.5">
        <header className="sr-only">
          <h1>Did the Toronto Maple Leafs Lose Their Latest Game?</h1>
        </header>

        {/* Ad Slot 1: Top of page */}
        <div className="mb-16 w-full max-w-3xl" aria-label="Advertisement">
          <AdBanner />
        </div>

        <article aria-label="Toronto Maple Leafs Game Result">
          <p
            className={`text-[6rem] sm:text-[12rem] md:text-[20rem] font-black leading-none text-center ${
              didLose ? "text-red-600" : "text-green-600"
            }`}
            aria-label={`${didLose ? "Yes, the Leafs lost" : "No, the Leafs won"}`}
          >
            {didLose ? "YES" : "NO"}
          </p>

          <div className="mt-8 text-center">
            <h2 className="text-2xl sm:text-3xl text-gray-700">
              {isLeafsHome ? "vs" : "@"} {opponent}
            </h2>
            <p className="text-4xl sm:text-5xl font-bold text-gray-900 mt-2">
              <span aria-label="Toronto Maple Leafs score">{leafsScore}</span>
              {" - "}
              <span aria-label={`${opponent} score`}>{opponentScore}</span>
            </p>
            <time dateTime={game.gameDate} className="text-lg text-gray-500 mt-4 block">
              {gameDate}
            </time>
          </div>
        </article>

        {scoring.length > 0 && (
          <details className="mt-12 w-full max-w-lg">
            <summary className="cursor-pointer text-center text-gray-500 hover:text-gray-700 font-medium py-2">
              Scoring Summary
            </summary>
            <div className="mt-4 space-y-4">
              {scoring.map((period) => {
                if (period.goals.length === 0) return null;
                return (
                  <div key={period.periodDescriptor.number} className="border-t border-gray-200 pt-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      {getPeriodLabel(period)}
                    </h3>
                    <ul className="space-y-3">
                      {period.goals.map((goal, idx) => {
                        const isLeafsGoal = goal.teamAbbrev.default === "TOR";
                        return (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="text-sm text-gray-400 font-mono w-12 shrink-0">
                              {goal.timeInPeriod}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                    isLeafsGoal
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {goal.teamAbbrev.default}
                                </span>
                                <span className="font-semibold text-gray-900">
                                  {goal.firstName.default} {goal.lastName.default}
                                </span>
                                <span className="text-xs text-gray-400">
                                  ({goal.awayScore}-{goal.homeScore})
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 mt-0.5">
                                {formatAssists(goal.assists)}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* Ad Slot 2: Bottom of page */}
        <div className="mt-12 w-full max-w-3xl" aria-label="Advertisement">
          <AdBanner size="large" />
        </div>

        <footer className="mt-8 text-center text-sm text-gray-400 max-w-md">
          <p>
            Latest Toronto Maple Leafs score and game results. Updated automatically
            after every Leafs game.
          </p>
        </footer>
      </main>
    </>
  );
}
