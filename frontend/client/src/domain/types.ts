export type TournamentFormat = 'liga_ida' | 'liga_ida_vuelta' | 'eliminacion_directa' | 'grupos_eliminacion';
export type TournamentStatus = 'borrador' | 'en_curso' | 'finalizado';

export interface Game {
  id: number;
  name: string;
  description?: string;
  active: boolean;
}

export interface Tournament {
  id: number;
  name: string;
  description: string | null;
  inviteCode?: string | null;
  gameId?: number | null;
  game: string;
  format: TournamentFormat;
  status: TournamentStatus;
  organizerId: number;
  organizerUsername?: string;
  adminIds?: number[];
  championId: number | null;
  championName?: string;
  participantsCount?: number;
  matchesCount?: number;
  createdAt: string;
}

export interface TournamentJoinRequest {
  id: number;
  tournamentId: number;
  userId: number;
  username: string;
  teamId?: number | null;
  teamName?: string | null;
  message?: string | null;
  status: 'pendiente' | 'aprobada' | 'rechazada';
  createdAt: string;
}

export interface TournamentParticipant {
  playerId: string;
  playerName: string;
  userId?: number | null;
  userUsername?: string | null;
  avatarUrl?: string | null;
  isRegistered?: boolean;
  teamId: string;
  teamName: string;
  group?: string | null;
  seed?: number | null;
}

export interface Team {
  id: string;
  name: string;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  userId?: number | null;
  userUsername?: string | null;
  avatarUrl?: string | null;
  isRegistered?: boolean;
}

export interface GoalEvent {
  scorerName: string;
  playerId: string;
  amount: number;
}

export interface RedCardEvent {
  playerName: string;
  playerId: string;
}

export interface Match {
  id: string;
  playerAId: string;
  playerBId: string;
  goalsA: number | null;
  goalsB: number | null;
  played: boolean;
  round?: number;
  tournamentId?: number;
  stage?: string;
  penaltiesA?: number | null;
  penaltiesB?: number | null;
  scorers: GoalEvent[];
  redCards: RedCardEvent[];
}

export interface StandingRow {
  playerId: string;
  playerName: string;
  teamName: string;
  avatarUrl?: string | null;
  isRegistered?: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface Incident {
  id: string;
  virtualPlayer: string;
  type: 'G' | 'R';
  playerId: string;
  matchId: string;
}

export interface ScorerRow {
  virtualPlayer: string;
  playerId: string;
  playerName: string;
  teamName: string;
  goals: number;
  avatarUrl?: string | null;
  isRegistered?: boolean;
}

export interface RedCardRow {
  virtualPlayer: string;
  playerId: string;
  playerName: string;
  teamName: string;
  count: number;
  avatarUrl?: string | null;
  isRegistered?: boolean;
}

export interface FixtureMatch {
  playerAId: string | null;
  playerAName: string;
  teamAName: string;
  playerAAvatarUrl?: string | null;
  playerAIsRegistered?: boolean;
  playerBId: string | null;
  playerBName: string;
  teamBName: string;
  playerBAvatarUrl?: string | null;
  playerBIsRegistered?: boolean;
  isBye: boolean;
  played: boolean;
  goalsA: number | null;
  goalsB: number | null;
  suspendedPlayersA?: string[];
  suspendedPlayersB?: string[];
}

export interface FixtureRound {
  roundNumber: number;
  matches: FixtureMatch[];
}
