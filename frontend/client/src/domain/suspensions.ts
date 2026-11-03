import type { Match } from "./types";

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
 * Reglas de la liga:
 * 1. Los partidos no necesariamente se juegan en estricto orden cronológico/secuencial.
 * 2. Si un jugador virtual es expulsado en un partido:
 *    - La sanción es de EXACTAMENTE 1 PARTIDO DE SUSPENSIÓN.
 *    - ¿Cuándo aplica?:
 *      a) Si al participante todavía le quedan partidos pendientes en la SEMANA ACTUAL (en la que fue expulsado):
 *         La sanción debe cumplirse en el próximo partido que juegue (dentro de la misma semana).
 *         Se muestra la advertencia en todos sus partidos pendientes de esa semana actual.
 *         En cuanto juegue 1 de esos partidos pendientes, la sanción queda purgada.
 *      b) Si NO le quedan partidos pendientes en la semana actual (ya los jugó todos):
 *         La sanción pasa a la SEMANA SIGUIENTE (semana S + 1).
 *         Aparece la advertencia en TODOS sus partidos de la semana siguiente.
 *         En cuanto dispute el primero de los partidos de esa semana siguiente, la sanción se cumple y desaparece.
 */
export function getSuspensionsForPlayer(
  matches: Match[],
  playerId: string,
  targetRound?: number,
  roundsPerWeek = 2
): SuspendedVirtualPlayer[] {
  // Partidos del participante que tienen número de fecha
  const playerMatches = matches.filter(
    (m) =>
      (m.playerAId === playerId || m.playerBId === playerId) &&
      typeof m.round === "number"
  );

  const activeSuspensions: SuspendedVirtualPlayer[] = [];

  // Recorremos los partidos ya jugados con tarjeta roja para este participante
  for (const match of playerMatches) {
    if (!match.played || !match.redCards || match.redCards.length === 0) {
      continue;
    }

    const cardRound = match.round ?? 1;
    const cardWeek = getWeekForRound(cardRound, roundsPerWeek);

    // Partidos del jugador en la misma semana de la expulsión
    const weekMatches = playerMatches.filter(
      (m) => getWeekForRound(m.round ?? 1, roundsPerWeek) === cardWeek
    );
    const pendingInSameWeek = weekMatches.filter((m) => !m.played);

    let targetWeek: number;
    let isServed = false;

    if (pendingInSameWeek.length > 0) {
      // Caso 1: Quedan partidos pendientes en la semana actual.
      // La sanción aplica a la semana actual.
      targetWeek = cardWeek;

      // Se considera cumplida si posterior a este partido con roja, el jugador ya disputó algún otro partido en la misma semana
      // (Por ejemplo, si jugó otro partido cuyo id != match.id y played = true después de la expulsión)
      // Para saber si ya jugó un partido posterior dentro de la misma semana:
      // Comprobamos si la cantidad de partidos jugados en esta semana supera los que tenían roja o si ya se jugó otro
      const otherPlayedInWeek = weekMatches.filter(
        (m) => m.played && m.id !== match.id && (m.round ?? 0) >= cardRound
      );
      if (otherPlayedInWeek.length > 0) {
        isServed = true;
      }
    } else {
      // Caso 2: Ya no quedan partidos pendientes en la semana actual.
      // La sanción pasa a la SEMANA SIGUIENTE.
      targetWeek = cardWeek + 1;

      // Partidos de la semana siguiente
      const nextWeekMatches = playerMatches.filter(
        (m) => getWeekForRound(m.round ?? 1, roundsPerWeek) === targetWeek
      );

      // Si ya jugó al menos 1 partido en la semana siguiente, la sanción ya fue cumplida!
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
  roundsPerWeek = 2
): { playerA: SuspendedVirtualPlayer[]; playerB: SuspendedVirtualPlayer[] } {
  if (match.played || typeof match.round !== "number") {
    return { playerA: [], playerB: [] };
  }

  const suspensionsA = getSuspensionsForPlayer(matches, match.playerAId, match.round, roundsPerWeek);
  const suspensionsB = getSuspensionsForPlayer(matches, match.playerBId, match.round, roundsPerWeek);

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
  roundsPerWeek = 2
): boolean {
  const normTarget = normalizeVirtualPlayerName(virtualPlayer);
  const suspensions = getSuspensionsForPlayer(matches, playerId, roundNumber, roundsPerWeek);
  return suspensions.some(
    (s) => normalizeVirtualPlayerName(s.virtualPlayer) === normTarget
  );
}
