// Unified NHL API types

export interface Game {
  id: number;
  gameDate: string;
  gameType: number;
  gameState: string;
  startTimeUTC: string;
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

export interface ScheduleResponse {
  games: Game[];
}

export interface ScheduleData {
  latestCompleted: Game | null;
  nextUpcoming: Game | null;
  gameInProgress: Game | null;
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
  goalModifier: string;
  goalsToDate: number;
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

export interface GameLanding {
  summary: {
    scoring: ScoringPeriod[];
  };
}

export interface ThreeStar {
  star: number;
  name: { default: string };
  teamAbbrev: string;
  position: string;
  goals?: number;
  assists?: number;
  savePctg?: number;
}

export interface PenaltyPeriod {
  periodDescriptor: { number: number; periodType: string };
  penalties: {
    timeInPeriod: string;
    type: string;
    duration: number;
    committedByPlayer?: { firstName: { default: string }; lastName: { default: string } };
    teamAbbrev: { default: string };
    drawnBy?: { firstName: { default: string }; lastName: { default: string } };
    descKey: string;
  }[];
}

export interface PlayerStats {
  playerId: number;
  name: { default: string };
  position: string;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  sog: number;
  blockedShots: number;
  giveaways: number;
  takeaways: number;
  toi: string;
  faceoffWinningPctg: number;
}

export interface GoalieStats {
  playerId: number;
  name: { default: string };
  position: string;
  saveShotsAgainst: string;
  savePctg: number;
  goalsAgainst: number;
  toi: string;
  starter: boolean;
  decision: string;
}

export interface PlayByPlayEvent {
  eventId: number;
  periodDescriptor: { number: number; periodType: string };
  timeInPeriod: string;
  timeRemaining: string;
  situationCode: string;
  typeDescKey: string;
  details?: {
    xCoord?: number;
    yCoord?: number;
    zoneCode?: string;
    shotType?: string;
    reason?: string;
    eventOwnerTeamId?: number;
    shootingPlayerId?: number;
    goalieInNetId?: number;
    blockingPlayerId?: number;
    hittingPlayerId?: number;
    hitteePlayerId?: number;
    playerId?: number;
    scoringPlayerId?: number;
    assist1PlayerId?: number;
    assist2PlayerId?: number;
    winningPlayerId?: number;
    losingPlayerId?: number;
    committedByPlayerId?: number;
    drawnByPlayerId?: number;
    descKey?: string;
    duration?: number;
    typeCode?: string;
    awayScore?: number;
    homeScore?: number;
    awaySOG?: number;
    homeSOG?: number;
  };
}

export interface RosterSpot {
  teamId: number;
  playerId: number;
  firstName: { default: string };
  lastName: { default: string };
  sweaterNumber: number;
  positionCode: string;
}

export interface PlayByPlayResponse {
  plays: PlayByPlayEvent[];
  rosterSpots: RosterSpot[];
  homeTeam: { id: number; abbrev: string };
  awayTeam: { id: number; abbrev: string };
}

export interface TeamBoxscore {
  abbrev: string;
  score: number;
  sog: number;
  pim: number;
  powerPlay: string;
  powerPlayPctg: number;
  faceoffWinningPctg: number;
}

export interface BoxscoreResponse {
  awayTeam: TeamBoxscore;
  homeTeam: TeamBoxscore;
  summary?: {
    threeStars?: ThreeStar[];
    penalties?: PenaltyPeriod[];
  };
}

export interface StoredGame {
  gameId: number;
  gameDate: string;
  opponent: string;
  isLeafsHome: boolean;
  didLose: boolean;
  leafsScore: number;
  opponentScore: number;
  wasOT: boolean;
  wasSO: boolean;
  review: string;
}
