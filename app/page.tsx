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

export default async function Home() {
  const game = await getLatestLeafsGame();

  if (!game) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-white">
        <p className="text-2xl text-gray-600">No recent games found</p>
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <h1
        className={`text-[6rem] sm:text-[12rem] md:text-[20rem] font-black leading-none ${
          didLose ? "text-red-600" : "text-green-600"
        }`}
      >
        {didLose ? "YES" : "NO"}
      </h1>

      <div className="mt-8 text-center">
        <p className="text-2xl sm:text-3xl text-gray-700">
          {isLeafsHome ? "vs" : "@"} {opponent}
        </p>
        <p className="text-4xl sm:text-5xl font-bold text-gray-900 mt-2">
          {leafsScore} - {opponentScore}
        </p>
        <p className="text-lg text-gray-500 mt-4">{gameDate}</p>
      </div>
    </main>
  );
}
