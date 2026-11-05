import type { Player, Match } from "./types";
import { generatePairings } from "./fixture.ts";
import { isVirtualPlayerSuspended } from "./suspensions.ts";

export interface ProposalScorerItem {
  id: string;
  virtualPlayer: string;
  playerId: string;
  amount: number;
}

export interface ProposalRedCardItem {
  id: string;
  virtualPlayer: string;
  playerId: string;
}

export interface ProposalFormState {
  applicantName: string;
  playerAId: string;
  playerBId: string;
  goalsA: number | "";
  goalsB: number | "";
  roundNumber: number | null;
  scorers: ProposalScorerItem[];
  redCards: ProposalRedCardItem[];
}

export interface ProposalValidationErrors {
  applicantName?: string;
  playerAId?: string;
  playerBId?: string;
  players?: string;
  goalsA?: string;
  goalsB?: string;
  roundNumber?: string;
  scorers?: string;
  redCards?: string;
  general?: string;
}

export interface ProposalValidationResult {
  isValid: boolean;
  errors: ProposalValidationErrors;
}

export interface CreateProposalPayload {
  id_local: number;
  id_visitante: number;
  goles_local: number;
  goles_visitante: number;
  numero_fecha: number | null;
  goleadores: Array<{
    jugador: string;
    personaId: number;
    cantidad: number;
  }>;
  rojas: Array<{
    jugador: string;
    personaId: number;
  }>;
  nombre_solicitante: string;
  id_torneo?: number | null;
}

/**
 * Finds all round numbers where the given pair has a pending match in the tournament schedule.
 */
export function findPendingRoundsForPair(
  players: Player[],
  matches: Match[],
  playerAId: string,
  playerBId: string,
  format: "ida" | "ida_vuelta" = "ida"
): number[] {
  if (!playerAId || !playerBId || playerAId === playerBId) {
    return [];
  }

  const rounds = generatePairings(
    players.map((p) => p.id),
    format
  );

  const pending: number[] = [];

  rounds.forEach((roundPairings, roundIndex) => {
    const roundNumber = roundIndex + 1;
    const hasPairing = roundPairings.some(
      ([a, b]) =>
        (a === playerAId && b === playerBId) || (a === playerBId && b === playerAId)
    );

    if (hasPairing) {
      const alreadyPlayed = matches.some(
        (m) =>
          Boolean(m.played) &&
          m.round === roundNumber &&
          ((m.playerAId === playerAId && m.playerBId === playerBId) ||
            (m.playerAId === playerBId && m.playerBId === playerAId))
      );

      if (!alreadyPlayed) {
        pending.push(roundNumber);
      }
    }
  });

  return pending;
}

/**
 * Validates proposal form data according to tournament domain rules.
 * Pure function: deterministic, zero side effects.
 */
export function validateProposal(
  state: ProposalFormState,
  options?: {
    availableRounds?: number[];
    matches?: Match[];
  }
): ProposalValidationResult {
  const errors: ProposalValidationErrors = {};

  if (!state.applicantName || !state.applicantName.trim()) {
    errors.applicantName = "Ingresá tu nombre.";
  }

  if (!state.playerAId || !state.playerBId) {
    errors.players = "Debés seleccionar a ambos participantes.";
  } else if (state.playerAId === state.playerBId) {
    errors.players = "Las dos personas deben ser distintas.";
  }

  if (
    state.goalsA === "" ||
    typeof state.goalsA !== "number" ||
    Number.isNaN(state.goalsA) ||
    state.goalsA < 0 ||
    !Number.isInteger(state.goalsA)
  ) {
    errors.goalsA = "Los goles deben ser un entero mayor o igual a 0.";
  }

  if (
    state.goalsB === "" ||
    typeof state.goalsB !== "number" ||
    Number.isNaN(state.goalsB) ||
    state.goalsB < 0 ||
    !Number.isInteger(state.goalsB)
  ) {
    errors.goalsB = "Los goles deben ser un entero mayor o igual a 0.";
  }

  if (state.roundNumber === null || state.roundNumber === undefined || state.roundNumber < 1) {
    errors.roundNumber = "Debés seleccionar la fecha correspondiente.";
  } else if (
    options?.availableRounds !== undefined &&
    options.availableRounds.length > 0 &&
    !options.availableRounds.includes(state.roundNumber)
  ) {
    errors.roundNumber = `La fecha ${state.roundNumber} no está pendiente entre estos rivales.`;
  }

  // Scorer validations
  let sumScorersA = 0;
  let sumScorersB = 0;
  let hasScorersA = false;
  let hasScorersB = false;

  for (const s of state.scorers) {
    if (!s.virtualPlayer || !s.virtualPlayer.trim()) {
      errors.scorers = "Cada goleador debe tener el nombre del jugador virtual.";
      break;
    }
    if (s.amount < 1 || !Number.isInteger(s.amount)) {
      errors.scorers = "La cantidad de goles por jugador debe ser al menos 1.";
      break;
    }
    if (s.playerId !== state.playerAId && s.playerId !== state.playerBId) {
      errors.scorers = "Los goleadores deben pertenecer a uno de los dos participantes.";
      break;
    }

    if (
      options?.matches &&
      state.roundNumber &&
      isVirtualPlayerSuspended(options.matches, s.playerId, s.virtualPlayer, state.roundNumber)
    ) {
      errors.scorers = `El jugador virtual "${s.virtualPlayer.trim()}" está suspendido por expulsión para esta fecha y no puede ser alineado.`;
      break;
    }

    if (s.playerId === state.playerAId) {
      sumScorersA += s.amount;
      hasScorersA = true;
    } else if (s.playerId === state.playerBId) {
      sumScorersB += s.amount;
      hasScorersB = true;
    }
  }

  // Goal coherence validations
  if (!errors.scorers && !errors.goalsA) {
    if (state.goalsA === 0 && hasScorersA) {
      errors.scorers = "No podés asignar goles a un participante con 0 goles.";
    } else if (hasScorersA && sumScorersA !== state.goalsA) {
      errors.scorers = `Los goles de los goleadores del Participante 1 (${sumScorersA}) deben coincidir con su resultado (${state.goalsA}).`;
    }
  }

  if (!errors.scorers && !errors.goalsB) {
    if (state.goalsB === 0 && hasScorersB) {
      errors.scorers = "No podés asignar goles a un participante con 0 goles.";
    } else if (hasScorersB && sumScorersB !== state.goalsB) {
      errors.scorers = `Los goles de los goleadores del Participante 2 (${sumScorersB}) deben coincidir con su resultado (${state.goalsB}).`;
    }
  }

  // Red card validations
  for (const r of state.redCards) {
    if (!r.virtualPlayer || !r.virtualPlayer.trim()) {
      errors.redCards = "Cada tarjeta roja debe tener el nombre del jugador virtual.";
      break;
    }
    if (r.playerId !== state.playerAId && r.playerId !== state.playerBId) {
      errors.redCards = "Las tarjetas rojas deben pertenecer a uno de los dos participantes.";
      break;
    }

    if (
      options?.matches &&
      state.roundNumber &&
      isVirtualPlayerSuspended(options.matches, r.playerId, r.virtualPlayer, state.roundNumber)
    ) {
      errors.redCards = `El jugador virtual "${r.virtualPlayer.trim()}" ya está suspendido para esta fecha y no pudo haber jugado.`;
      break;
    }
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

/**
 * Maps frontend proposal form state to API payload.
 */
export function mapProposalInputToPayload(state: ProposalFormState): CreateProposalPayload {
  return {
    id_local: Number(state.playerAId),
    id_visitante: Number(state.playerBId),
    goles_local: typeof state.goalsA === "number" ? state.goalsA : 0,
    goles_visitante: typeof state.goalsB === "number" ? state.goalsB : 0,
    numero_fecha: state.roundNumber,
    nombre_solicitante: state.applicantName.trim(),
    goleadores: state.scorers
      .filter((g) => g.virtualPlayer.trim().length > 0)
      .map((g) => ({
        jugador: g.virtualPlayer.trim(),
        personaId: Number(g.playerId),
        cantidad: g.amount,
      })),
    rojas: state.redCards
      .filter((r) => r.virtualPlayer.trim().length > 0)
      .map((r) => ({
        jugador: r.virtualPlayer.trim(),
        personaId: Number(r.playerId),
      })),
  };
}
