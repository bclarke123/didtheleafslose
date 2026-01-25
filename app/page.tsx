import type { Metadata } from "next";
import Link from "next/link";
import { AdBanner } from "./AdBanner";
import {
  type Game,
  getLeafsGames,
  getGameScoring,
  getPeriodLabel,
  formatAssists,
} from "./lib/nhl";
import { getGameReview } from "./lib/storage";

// Force static generation - page rebuilds are triggered by scheduled function
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { latestGame: game } = await getLeafsGames();

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
  const title = `Did the Leafs Lose? ${didLose ? "YES" : "NO"} - ${leafsScore}-${opponentScore} vs ${opponent}`;
  const description = didLose
    ? `Why did the Leafs lose? Toronto Maple Leafs ${result} ${leafsScore}-${opponentScore} against ${opponent}. Get the latest Leafs scores, results, and game recaps.`
    : `Toronto Maple Leafs ${result} their latest game ${leafsScore}-${opponentScore} against ${opponent}. Get the latest Leafs scores, results, and game recaps.`;

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

function buildJsonLd(game: Game, opponent: string, isLeafsHome: boolean, didLose: boolean, leafsScore: number, opponentScore: number) {
  const startDateTime = new Date(game.gameDate + "T12:00:00");
  const endDateTime = new Date(startDateTime.getTime() + 3 * 60 * 60 * 1000);

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `Toronto Maple Leafs vs ${opponent}`,
    description: `NHL game: Toronto Maple Leafs ${didLose ? "lost" : "won"} against ${opponent} with a final score of ${leafsScore}-${opponentScore}`,
    startDate: game.gameDate,
    endDate: endDateTime.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    image: "https://assets.nhle.com/logos/nhl/svg/TOR_light.svg",
    location: {
      "@type": "Place",
      name: isLeafsHome ? "Scotiabank Arena" : `${opponent} Arena`,
      ...(isLeafsHome && {
        address: {
          "@type": "PostalAddress",
          streetAddress: "40 Bay Street",
          addressLocality: "Toronto",
          addressRegion: "ON",
          postalCode: "M5J 2X2",
          addressCountry: "CA",
        },
      }),
    },
    organizer: {
      "@type": "Organization",
      name: "National Hockey League",
      url: "https://www.nhl.com",
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
}

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Did the Leafs Lose?",
  url: "https://www.didtheleafslose.com",
  description:
    "Check if the Toronto Maple Leafs won or lost their latest NHL game. Get instant Leafs scores and game results.",
};

export default async function Home() {
  const { latestGame: game, nextGame } = await getLeafsGames();

  if (!game) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-white">
        <h1 className="text-2xl text-gray-600">
          No recent Toronto Maple Leafs games found
        </h1>
      </main>
    );
  }

  // Fetch scoring data and stored review in parallel
  const [scoring, storedGame] = await Promise.all([
    getGameScoring(game.id),
    getGameReview(game.id),
  ]);

  const isLeafsHome = game.homeTeam.abbrev === "TOR";
  const leafsScore = isLeafsHome ? game.homeTeam.score : game.awayTeam.score;
  const opponentScore = isLeafsHome ? game.awayTeam.score : game.homeTeam.score;
  const opponent = isLeafsHome
    ? game.awayTeam.placeName.default
    : game.homeTeam.placeName.default;

  const didLose = (leafsScore ?? 0) < (opponentScore ?? 0);

  // Review comes from Blobs (created by cron job or backfill)
  const review = storedGame?.review ?? null;

  const gameDate = new Date(game.gameDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const jsonLd = buildJsonLd(game, opponent, isLeafsHome, didLose, leafsScore ?? 0, opponentScore ?? 0);

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

          <p className="text-lg sm:text-xl text-gray-500 text-center mt-4">
            {didLose
              ? "They lost. Do you feel better about yourself?"
              : "They won, you hater"}
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

        {review && (
          <section className="mt-10 w-full max-w-xl" aria-label="Game Review">
            <div className="text-gray-600 text-base sm:text-lg leading-relaxed space-y-4 text-justify">
              {review.split("\n\n").map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          </section>
        )}

        {scoring.length > 0 && (
          <details className="mt-12 w-full max-w-xl">
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

        {nextGame && (() => {
          const nextIsHome = nextGame.homeTeam.abbrev === "TOR";
          const nextOpponent = nextIsHome
            ? nextGame.awayTeam.placeName.default
            : nextGame.homeTeam.placeName.default;
          const nextGameDate = new Date(nextGame.gameDate + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          });
          return (
            <section className="mt-12 text-center" aria-label="Next Game">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Next Game
              </h2>
              <p className="text-xl sm:text-2xl text-gray-700">
                {nextIsHome ? "vs" : "@"} {nextOpponent}
              </p>
              <time dateTime={nextGame.gameDate} className="text-gray-500 mt-1 block">
                {nextGameDate}
              </time>
            </section>
          );
        })()}

        {/* Ad Slot 2: Bottom of page */}
        <div className="mt-12 w-full max-w-3xl" aria-label="Advertisement">
          <AdBanner size="large" />
        </div>

        <footer className="mt-8 pb-16 text-center text-sm text-gray-500 max-w-md">
          <p>
            Latest Toronto Maple Leafs score and game results. Updated automatically
            after every Leafs game.
          </p>
          <Link href="/archive" className="mt-4 block hover:text-gray-600">
            Archive
          </Link>
        </footer>
      </main>
    </>
  );
}
