import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameReview, getAllGameIds } from "../../lib/storage";
import { AdBanner } from "../../AdBanner";

export const dynamic = "force-static";

export async function generateStaticParams() {
  const gameIds = await getAllGameIds();
  return gameIds.map((gameId) => ({ gameId }));
}

export async function generateMetadata({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const game = await getGameReview(Number(gameId));

  if (!game) {
    return { title: "Game Not Found" };
  }

  const dateStr = new Date(game.gameDate + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const result = game.didLose ? "Lost" : "Won";
  const ogImage = game.didLose ? "/dtll-lose.png" : "/dtll-win.png";
  return {
    title: `Did the Leafs Lose? ${dateStr} - ${result} ${game.leafsScore}-${game.opponentScore} vs ${game.opponent}`,
    description: game.review.slice(0, 160),
    alternates: {
      canonical: `https://www.didtheleafslose.com/archive/${gameId}`,
    },
    openGraph: {
      url: `https://www.didtheleafslose.com/archive/${gameId}`,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogImage],
    },
  };
}

export default async function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const game = await getGameReview(Number(gameId));

  if (!game) {
    notFound();
  }

  const gameDate = new Date(game.gameDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="min-h-screen flex flex-col items-center bg-white px-4 pt-2.5">
      {/* Ad Slot 1: Top of page */}
      <div className="mb-8 w-full max-w-3xl" aria-label="Advertisement">
        <AdBanner />
      </div>

      <div className="w-full max-w-xl">
        <Link href="/archive" className="text-blue-600 hover:underline text-sm">
          ← Back to archive
        </Link>
      </div>

      <article className="mt-6">
          <p
            className={`text-6xl sm:text-8xl font-black leading-none text-center ${
              game.didLose ? "text-red-600" : "text-green-600"
            }`}
          >
            {game.didLose ? "YES" : "NO"}
          </p>

          <p className="text-lg text-gray-500 text-center mt-4">
            {game.didLose
              ? "They lost. Classic."
              : "They won this one."}
          </p>

          <div className="mt-8 text-center">
            <h1 className="text-2xl sm:text-3xl text-gray-700">
              {game.isLeafsHome ? "vs" : "@"} {game.opponent}
            </h1>
            <p className="text-4xl sm:text-5xl font-bold text-gray-900 mt-2">
              {game.leafsScore} - {game.opponentScore}
              {(game.wasOT || game.wasSO) && (
                <span className="text-lg font-normal text-gray-500 ml-2">
                  ({game.wasSO ? "SO" : "OT"})
                </span>
              )}
            </p>
            <time className="text-lg text-gray-500 mt-4 block">
              {gameDate}
            </time>
          </div>
        </article>

        <section className="mt-10 w-full max-w-xl" aria-label="Game Review">
          <div className="text-gray-600 text-base sm:text-lg leading-relaxed space-y-4 text-justify">
            {game.review.split("\n\n").map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>
        </section>

        <div className="mt-12 pt-6 border-t border-gray-200 text-center">
          <Link href="/" className="text-blue-600 hover:underline">
            See the latest game →
          </Link>
        </div>

        {/* Ad Slot 2: Bottom of page */}
        <div className="mt-12 w-full max-w-3xl" aria-label="Advertisement">
          <AdBanner size="large" />
        </div>
    </main>
  );
}
