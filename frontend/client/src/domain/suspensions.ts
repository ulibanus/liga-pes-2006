import type { Match, FixtureRound } from "./types";

export interface SuspendedVirtualPlayer {
  virtualPlayer: string;
  playerId: string;
  tournamentId?: number;
  redCardRound: number;
  matchId: string;
  targetWeek: number; // Semana en la que debe cumplir la sanción
}

export function normalizeVirtualPlayerName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Devuelve el número de semana correspondiente a una fecha/round (por defecto 2 fechas por semana).
 */
export function getWeekForRound(round: number, roundsPerWeek = 2): number {
  return Math.ceil(round / roundsPerWeek);
}

/**
 * Calcula las suspensiones activas para un participante.
 *
 * Toma en cuenta:
 * - `matches`: Partidos ya registrados en BD (jugados o pendientes).
 * - `fixtureRounds` (opcional): La estructura completa del fixture planificado (incluyendo fechas futuras).
 */
export function getSuspensionsForPlayer(
  matches: Match[],
  playerId: string,
  targetRound?: number,
  roundsPerWeek = 2,
  fixtureRounds?: FixtureRound[]
): SuspendedVirtualPlayer[] {
  // Construimos una vista unificada de todos los partidos del participante (tanto en BD como en fixture planificado)
  const playerMatchesMap = new Map<string, { round: number; played: boolean; id?: string }>();

  if (fixtureRounds) {
    for (const fr of fixtureRounds) {
      for (const fm of fr.matches) {
        if (fm.playerAId === playerId || fm.playerBId === playerId) {
          const key = `round-${fr.roundNumber}`;
          playerMatchesMap.set(key, {
            round: fr.roundNumber,
            played: fm.played,
          });
        }
      }
    }
  }

  // Sobrescribimos o incorporamos los partidos reales de la base de datos
  for (const m of matches) {
    if ((m.playerAId === playerId || m.playerBId === playerId) && typeof m.round === "number") {
      const key = `round-${m.round}`;
      playerMatchesMap.set(key, {
        round: m.round,
        played: m.played,
        id: m.id,
      });
    }
  }

  const allParticipantMatches = Array.from(playerMatchesMap.values()).sort(
    (a, b) => a.round - b.round
  );

  const activeSuspensions: SuspendedVirtualPlayer[] = [];

  // Recorremos los partidos ya jugados con tarjeta roja para este participante
  for (const match of matches) {
    if (
      !match.played ||
      !match.redCards ||
      match.redCards.length === 0 ||
      (match.playerAId !== playerId && match.playerBId !== playerId)
    ) {
      continue;
    }

    const cardRound = match.round ?? 1;
    const cardWeek = getWeekForRound(cardRound, roundsPerWeek);

    // Partidos del participante en la misma semana de la expulsión
    const weekMatches = allParticipantMatches.filter(
      (m) => getWeekForRound(m.round, roundsPerWeek) === cardWeek
    );
    // Partidos pendientes en la misma semana (que sean posteriores o distintos al partido de la roja)
    const pendingInSameWeek = weekMatches.filter(
      (m) => !m.played && m.round >= cardRound
    );

    let targetWeek: number;
    let isServed = false;

    if (pendingInSameWeek.length > 0) {
      // Caso 1: Quedan partidos pendientes en la semana actual.
      // La sanción aplica a la semana actual.
      targetWeek = cardWeek;

      // Se cumple si ya jugó otro partido en esa misma semana posterior a la expulsión
      const otherPlayedInWeek = weekMatches.filter(
        (m) => m.played && m.round > cardRound
      );
      if (otherPlayedInWeek.length > 0) {
        isServed = true;
      }
    } else {
      // Caso 2: Ya no quedan partidos pendientes en la semana actual.
      // La sanción pasa a la SEMANA SIGUIENTE.
      targetWeek = cardWeek + 1;

      // Partidos de la semana siguiente
      const nextWeekMatches = allParticipantMatches.filter(
        (m) => getWeekForRound(m.round, roundsPerWeek) === targetWeek
      );

      // Si ya disputó al menos 1 partido en la semana siguiente, la sanción ya fue cumplida
      const playedInNextWeek = nextWeekMatches.filter((m) => m.played);
      if (playedInNextWeek.length > 0) {
        isServed = true;
      }
    }

    if (isServed) {
      continue;
    }

    // Si se especificó targetRound, verificamos que pertenezca a la semana objetivo donde rige la sanción
    if (targetRound !== undefined) {
      const matchWeek = getWeekForRound(targetRound, roundsPerWeek);
      if (matchWeek !== targetWeek) {
        continue;
      }
    }

    for (const rc of match.redCards) {
      if (rc.playerId === playerId && rc.playerName && rc.playerName.trim()) {
        activeSuspensions.push({
          virtualPlayer: rc.playerName.trim(),
          playerId: rc.playerId,
          tournamentId: match.tournamentId,
          redCardRound: cardRound,
          matchId: match.id,
          targetWeek,
        });
      }
    }
  }

  return activeSuspensions;
}

export function getMatchSuspensions(
  matches: Match[],
  match: Match,
  roundsPerWeek = 2,
  fixtureRounds?: FixtureRound[]
): { playerA: SuspendedVirtualPlayer[]; playerB: SuspendedVirtualPlayer[] } {
  if (match.played || typeof match.round !== "number") {
    return { playerA: [], playerB: [] };
  }

  const suspensionsA = getSuspensionsForPlayer(matches, match.playerAId, match.round, roundsPerWeek, fixtureRounds);
  const suspensionsB = getSuspensionsForPlayer(matches, match.playerBId, match.round, roundsPerWeek, fixtureRounds);

  return {
    playerA: suspensionsA,
    playerB: suspensionsB,
  };
}

export function isVirtualPlayerSuspended(
  matches: Match[],
  playerId: string,
  virtualPlayer: string,
  roundNumber: number,
  roundsPerWeek = 2,
  fixtureRounds?: FixtureRound[]
): boolean {
  const normTarget = normalizeVirtualPlayerName(virtualPlayer);
  const suspensions = getSuspensionsForPlayer(matches, playerId, roundNumber, roundsPerWeek, fixtureRounds);
  return suspensions.some(
    (s) => normalizeVirtualPlayerName(s.virtualPlayer) === normTarget
  );
}
