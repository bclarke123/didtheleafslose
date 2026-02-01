import type {
  Game,
  ScheduleResponse,
  ScheduleData,
  ScoringPeriod,
  PenaltyPeriod,
  ThreeStar,
  PlayerStats,
  GoalieStats,
  GameLanding,
  BoxscoreResponse,
  PlayByPlayResponse,
} from "./nhl-types";
import { distillPlayByPlay } from "./play-by-play";

export async function getScheduleData(): Promise<ScheduleData | null> {
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

export async function getLeafsGames(): Promise<{ latestGame: Game | null; nextGame: Game | null }> {
  const schedule = await getScheduleData();
  if (!schedule) {
    throw new Error("Failed to fetch schedule");
  }
  return {
    latestGame: schedule.latestCompleted,
    nextGame: schedule.nextUpcoming,
  };
}

export async function getGameScoring(gameId: number): Promise<ScoringPeriod[]> {
  const res = await fetch(
    `https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`
  );

  if (!res.ok) {
    return [];
  }

  const data: GameLanding = await res.json();
  return data.summary?.scoring ?? [];
}

export async function getGameBoxscore(gameId: number): Promise<BoxscoreResponse | null> {
  const res = await fetch(
    `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`
  );

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export async function getGameData(gameId: number) {
  const [landingRes, boxscoreRes, pbpRes] = await Promise.all([
    fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`),
    fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`),
    fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`),
  ]);

  const landing = landingRes.ok ? await landingRes.json() : null;
  const boxscore = boxscoreRes.ok ? await boxscoreRes.json() : null;
  const pbp: PlayByPlayResponse | null = pbpRes.ok ? await pbpRes.json() : null;

  const playByPlayNarrative = pbp ? distillPlayByPlay(pbp) : "";

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
    playByPlayNarrative,
  };
}
