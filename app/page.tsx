import type { Metadata } from "next";

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

async function getLatestLeafsGame() {
  const res = await fetch(
    "https://api-web.nhle.com/v1/club-schedule-season/TOR/now",
    { next: { revalidate: 300 } } // Revalidate every 5 minutes
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
      <main className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
        <header className="sr-only">
          <h1>Did the Toronto Maple Leafs Lose Their Latest Game?</h1>
        </header>

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

        <footer className="mt-16 text-center text-sm text-gray-400 max-w-md">
          <p>
            Latest Toronto Maple Leafs score and game results. Updated automatically
            after every Leafs game.
          </p>
        </footer>
      </main>
    </>
  );
}
