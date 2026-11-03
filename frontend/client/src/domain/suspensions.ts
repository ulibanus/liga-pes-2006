import type { Match } from "./types";

export interface SuspendedVirtualPlayer {
  virtualPlayer: string;
  playerId: string;
  tournamentId?: number;
  suspendedUntilRound: number; // La fecha en la que no puede jugar (N + 1)
  redCardRound: number;        // Fecha en la que recibió la roja
  matchId: string;
}

/**
 * Normaliza nombres de jugadores virtuales para comparaciones insensibles a mayúsculas/espacios.
 */
export function normalizeVirtualPlayerName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Calcula qué jugadores virtuales se encuentran suspendidos para un participante en una fecha dada.
 *
 * Regla de negocio:
 * Si en la fecha R (partido ya jugado) un jugador virtual de playerId recibió tarjeta roja ('R'):
 * - Queda suspendido para la siguiente fecha (R + 1) que juegue ese participante.
 * - Una vez que el participante juega la fecha R + 1, la sanción queda cumplida y ya no se considera suspendido.
 */
export function getSuspensionsForPlayer(
  matches: Match[],
  playerId: string,
  targetRound?: number
): SuspendedVirtualPlayer[] {
  // Filtramos todos los partidos de este participante (ordenados cronológicamente por ronda)
  const playerMatches = matches
    .filter(
      (m) =>
        (m.playerAId === playerId || m.playerBId === playerId) &&
        typeof m.round === "number"
    )
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0));

  const activeSuspensions: SuspendedVirtualPlayer[] = [];

  for (let i = 0; i < playerMatches.length; i++) {
    const match = playerMatches[i];
    if (!match.played || !match.redCards || match.redCards.length === 0) {
      continue;
    }

    const currentRound = match.round ?? 0;
    const nextMatch = playerMatches.find(
      (m) => (m.round ?? 0) > currentRound
    );

    // Si no hay siguiente partido aún programado, la fecha suspendida es la consecutiva (currentRound + 1)
    const suspendedRound = nextMatch ? (nextMatch.round ?? (currentRound + 1)) : (currentRound + 1);

    // Comprobamos si el siguiente partido ya fue jugado
    const isServed = nextMatch ? nextMatch.played : false;

    // Si ya se jugó el partido de suspensión, la penalización se cumplió
    if (isServed) {
      continue;
    }

    // Si el usuario especificó targetRound y no coincide con la fecha de suspensión, continuamos
    if (targetRound !== undefined && targetRound !== suspendedRound) {
      continue;
    }

    for (const rc of match.redCards) {
      if (rc.playerId === playerId && rc.playerName && rc.playerName.trim()) {
        activeSuspensions.push({
          virtualPlayer: rc.playerName.trim(),
          playerId: rc.playerId,
          tournamentId: match.tournamentId,
          suspendedUntilRound: suspendedRound,
          redCardRound: currentRound,
          matchId: match.id,
        });
      }
    }
  }

  return activeSuspensions;
}

/**
 * Determina todos los jugadores virtuales suspendidos en un partido determinado (para ambos rivales).
 */
export function getMatchSuspensions(
  matches: Match[],
  match: Match
): { playerA: SuspendedVirtualPlayer[]; playerB: SuspendedVirtualPlayer[] } {
  if (match.played || typeof match.round !== "number") {
    return { playerA: [], playerB: [] };
  }

  const suspensionsA = getSuspensionsForPlayer(matches, match.playerAId, match.round);
  const suspensionsB = getSuspensionsForPlayer(matches, match.playerBId, match.round);

  return {
    playerA: suspensionsA,
    playerB: suspensionsB,
  };
}

/**
 * Valida si un jugador virtual está suspendido para un participante en una ronda específica.
 */
export function isVirtualPlayerSuspended(
  matches: Match[],
  playerId: string,
  virtualPlayer: string,
  roundNumber: number
): boolean {
  const normTarget = normalizeVirtualPlayerName(virtualPlayer);
  const suspensions = getSuspensionsForPlayer(matches, playerId, roundNumber);
  return suspensions.some(
    (s) => normalizeVirtualPlayerName(s.virtualPlayer) === normTarget
  );
}
