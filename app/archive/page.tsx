import Link from "next/link";
import { getAllGameReviews } from "../lib/storage";

export const dynamic = "force-static";

export const metadata = {
  title: "Game Archive - Did the Leafs Lose?",
  description: "Archive of Toronto Maple Leafs game recaps and results.",
};

export default async function ArchivePage() {
  const games = await getAllGameReviews();

  if (games.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
        <h1 className="text-2xl text-gray-600 mb-4">Game Archive</h1>
        <p className="text-gray-500">No archived games yet. Check back after the next game!</p>
        <Link href="/" className="mt-6 text-blue-600 hover:underline">
          ← Back to latest
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Game Archive</h1>
          <Link href="/" className="text-blue-600 hover:underline text-sm">
            ← Latest game
          </Link>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Opponent
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  H/A
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Result
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {games.map((game) => {
                const gameDate = new Date(game.gameDate + "T12:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                return (
                  <tr key={game.gameId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/archive/${game.gameId}`}
                        className="text-gray-900 hover:text-blue-600"
                      >
                        {gameDate}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/archive/${game.gameId}`}
                        className="text-gray-900 hover:text-blue-600"
                      >
                        {game.opponent}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {game.isLeafsHome ? "Home" : "Away"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/archive/${game.gameId}`}>
                        <span
                          className={`inline-block px-2 py-1 text-xs font-bold rounded ${
                            game.didLose
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {game.didLose ? "L" : "W"} {game.leafsScore}-{game.opponentScore}
                        </span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
