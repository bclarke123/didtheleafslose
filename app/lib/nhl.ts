// NHL API types and data fetching

export interface Game {
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

export interface GoalAssist {
  playerId: number;
  firstName: { default: string };
  lastName: { default: string };
  sweaterNumber: number;
}

export interface Goal {
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

export interface ScoringPeriod {
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

export interface ThreeStar {
  star: number;
  firstName: { default: string };
  lastName: { default: string };
  teamAbbrev: string;
  position: string;
  goals?: number;
  assists?: number;
  savePctg?: number;
}

interface TeamBoxscore {
  abbrev: string;
  score: number;
  sog: number;
  pim: number;
  powerPlay: string;
  powerPlayPctg: number;
  faceoffWinningPctg: number;
}

interface PenaltyPeriod {
  periodDescriptor: { number: number };
  penalties: {
    timeInPeriod: string;
    type: string;
    duration: number;
    committedByPlayer: string;
    teamAbbrev: { default: string };
    descKey: string;
  }[];
}

export interface BoxscoreResponse {
  awayTeam: TeamBoxscore;
  homeTeam: TeamBoxscore;
  summary?: {
    threeStars?: ThreeStar[];
    penalties?: PenaltyPeriod[];
  };
}

export async function getLeafsGames() {
  const res = await fetch(
    "https://api-web.nhle.com/v1/club-schedule-season/TOR/now"
  );

  if (!res.ok) {
    throw new Error("Failed to fetch schedule");
  }

  const data: ScheduleResponse = await res.json();

  const completedGames = data.games.filter(
    (game) => game.gameState === "OFF" || game.gameState === "FINAL"
  );

  const upcomingGames = data.games.filter(
    (game) => game.gameState === "FUT"
  );

  const latestGame = completedGames.length > 0
    ? completedGames[completedGames.length - 1]
    : null;

  const nextGame = upcomingGames.length > 0
    ? upcomingGames[0]
    : null;

  return { latestGame, nextGame };
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

export function getPeriodLabel(period: ScoringPeriod): string {
  const { number, periodType } = period.periodDescriptor;
  if (periodType === "OT") return "OT";
  if (periodType === "SO") return "SO";
  return `P${number}`;
}

export function formatAssists(assists: GoalAssist[]): string {
  if (assists.length === 0) return "Unassisted";
  return assists.map((a) => `${a.firstName.default} ${a.lastName.default}`).join(", ");
}
