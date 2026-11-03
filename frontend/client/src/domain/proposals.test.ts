import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateProposal,
  findPendingRoundsForPair,
  mapProposalInputToPayload,
  type ProposalFormState,
} from "./proposals.ts";
import type { Player, Match } from "./types.ts";

describe("domain/proposals - validateProposal", () => {
  const baseValidState: ProposalFormState = {
    applicantName: "Franco",
    playerAId: "1",
    playerBId: "2",
    goalsA: 2,
    goalsB: 1,
    roundNumber: 1,
    scorers: [
      { id: "s1", virtualPlayer: "Adriano", playerId: "1", amount: 2 },
      { id: "s2", virtualPlayer: "Henry", playerId: "2", amount: 1 },
    ],
    redCards: [
      { id: "r1", virtualPlayer: "Vieira", playerId: "2" },
    ],
  };

  it("passes when all inputs are completely coherent", () => {
    const result = validateProposal(baseValidState, { availableRounds: [1, 2] });
    assert.equal(result.isValid, true);
    assert.deepEqual(result.errors, {});
  });

  it("fails when applicantName is blank", () => {
    const state: ProposalFormState = { ...baseValidState, applicantName: "   " };
    const result = validateProposal(state);
    assert.equal(result.isValid, false);
    assert.match(result.errors.applicantName!, /nombre/i);
  });

  it("fails when participants are identical", () => {
    const state: ProposalFormState = { ...baseValidState, playerBId: "1" };
    const result = validateProposal(state);
    assert.equal(result.isValid, false);
    assert.match(result.errors.players!, /distintas/i);
  });

  it("fails when goals are negative or non-integer", () => {
    const state: ProposalFormState = { ...baseValidState, goalsA: -1 };
    const result = validateProposal(state);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.goalsA);
  });

  it("fails when goals are empty string", () => {
    const state: ProposalFormState = { ...baseValidState, goalsA: "" };
    const result = validateProposal(state);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.goalsA);
  });

  it("fails when roundNumber is not in availableRounds", () => {
    const result = validateProposal(baseValidState, { availableRounds: [2, 3] });
    assert.equal(result.isValid, false);
    assert.match(result.errors.roundNumber!, /no está pendiente/i);
  });

  it("fails goal coherence when scorers exceed match goals for a player", () => {
    const state: ProposalFormState = {
      ...baseValidState,
      goalsA: 2,
      scorers: [
        { id: "s1", virtualPlayer: "Adriano", playerId: "1", amount: 3 },
      ],
    };
    const result = validateProposal(state);
    assert.equal(result.isValid, false);
    assert.match(result.errors.scorers!, /coincidir/i);
  });

  it("fails goal coherence when player has 0 goals but has scorers assigned", () => {
    const state: ProposalFormState = {
      ...baseValidState,
      goalsA: 0,
      scorers: [
        { id: "s1", virtualPlayer: "Adriano", playerId: "1", amount: 1 },
      ],
    };
    const result = validateProposal(state);
    assert.equal(result.isValid, false);
    assert.match(result.errors.scorers!, /0 goles/i);
  });

  it("fails when a scorer has an empty virtual player name", () => {
    const state: ProposalFormState = {
      ...baseValidState,
      scorers: [
        { id: "s1", virtualPlayer: "  ", playerId: "1", amount: 2 },
      ],
    };
    const result = validateProposal(state);
    assert.equal(result.isValid, false);
    assert.match(result.errors.scorers!, /nombre del jugador virtual/i);
  });

  it("fails when a red card belongs to a player outside the match", () => {
    const state: ProposalFormState = {
      ...baseValidState,
      redCards: [
        { id: "r1", virtualPlayer: "Zidane", playerId: "99" },
      ],
    };
    const result = validateProposal(state);
    assert.equal(result.isValid, false);
    assert.match(result.errors.redCards!, /uno de los dos participantes/i);
  });

  it("allows empty scorers and red cards if none are provided", () => {
    const state: ProposalFormState = {
      ...baseValidState,
      scorers: [],
      redCards: [],
    };
    const result = validateProposal(state, { availableRounds: [1] });
    assert.equal(result.isValid, true);
  });

  it("fails when a scorer is suspended for the specified round", () => {
    const previousMatch: Match = {
      id: "prev1",
      playerAId: "1",
      playerBId: "3",
      goalsA: 1,
      goalsB: 0,
      played: true,
      round: 1,
      scorers: [],
      redCards: [{ playerName: "Verón", playerId: "1" }],
    };
    const pendingMatchRound2: Match = {
      id: "pend2",
      playerAId: "1",
      playerBId: "2",
      goalsA: null,
      goalsB: null,
      played: false,
      round: 2,
      scorers: [],
      redCards: [],
    };

    const state: ProposalFormState = {
      ...baseValidState,
      goalsA: 1,
      goalsB: 0,
      roundNumber: 2,
      scorers: [{ id: "s1", virtualPlayer: "Verón", playerId: "1", amount: 1 }],
      redCards: [],
    };

    const result = validateProposal(state, {
      availableRounds: [2],
      matches: [previousMatch, pendingMatchRound2],
    });

    assert.equal(result.isValid, false);
    assert.match(result.errors.scorers ?? "", /suspendido por expulsión/);
  });
});

describe("domain/proposals - findPendingRoundsForPair", () => {
  const mockPlayers: Player[] = [
    { id: "1", name: "Franco", teamId: "10" },
    { id: "2", name: "Nico", teamId: "20" },
    { id: "3", name: "Male", teamId: "30" },
    { id: "4", name: "Tobi", teamId: "40" },
  ];

  it("returns round 1 for player 1 vs 4 when no match was played yet", () => {
    const matches: Match[] = [];
    const pending = findPendingRoundsForPair(mockPlayers, matches, "1", "4", "ida");
    assert.deepEqual(pending, [1]);
  });

  it("returns empty array if match between pair was already played", () => {
    const matches: Match[] = [
      {
        id: "m1",
        playerAId: "1",
        playerBId: "4",
        goalsA: 2,
        goalsB: 1,
        played: true,
        round: 1,
        scorers: [],
        redCards: [],
      },
    ];
    const pending = findPendingRoundsForPair(mockPlayers, matches, "1", "4", "ida");
    assert.deepEqual(pending, []);
  });

  it("returns both ida and vuelta rounds when format is ida_vuelta", () => {
    const matches: Match[] = [];
    const pending = findPendingRoundsForPair(mockPlayers, matches, "1", "4", "ida_vuelta");
    assert.deepEqual(pending, [1, 4]);
  });

  it("returns round as pending if scheduled match exists in fixture with played false", () => {
    const matches: Match[] = [
      {
        id: "m1",
        playerAId: "1",
        playerBId: "4",
        goalsA: 0,
        goalsB: 0,
        played: false,
        round: 1,
        scorers: [],
        redCards: [],
      },
    ];
    const pending = findPendingRoundsForPair(mockPlayers, matches, "1", "4", "ida");
    assert.deepEqual(pending, [1]);
  });

  it("returns only pending round when ida is played but vuelta is pending in ida_vuelta", () => {
    const matches: Match[] = [
      {
        id: "m1",
        playerAId: "1",
        playerBId: "4",
        goalsA: 2,
        goalsB: 1,
        played: true,
        round: 1,
        scorers: [],
        redCards: [],
      },
      {
        id: "m2",
        playerAId: "4",
        playerBId: "1",
        goalsA: 0,
        goalsB: 0,
        played: false,
        round: 4,
        scorers: [],
        redCards: [],
      },
    ];
    const pending = findPendingRoundsForPair(mockPlayers, matches, "1", "4", "ida_vuelta");
    assert.deepEqual(pending, [4]);
  });
});

describe("domain/proposals - mapProposalInputToPayload", () => {
  it("converts strings to numbers and trims inputs", () => {
    const state: ProposalFormState = {
      applicantName: "  Franco  ",
      playerAId: "10",
      playerBId: "20",
      goalsA: 3,
      goalsB: 0,
      roundNumber: 2,
      scorers: [
        { id: "s1", virtualPlayer: "  Adriano ", playerId: "10", amount: 3 },
      ],
      redCards: [
        { id: "r1", virtualPlayer: " Materazzi ", playerId: "10" },
      ],
    };

    const payload = mapProposalInputToPayload(state);

    assert.equal(payload.nombre_solicitante, "Franco");
    assert.equal(payload.id_local, 10);
    assert.equal(payload.id_visitante, 20);
    assert.equal(payload.goles_local, 3);
    assert.equal(payload.goles_visitante, 0);
    assert.equal(payload.numero_fecha, 2);
    assert.deepEqual(payload.goleadores, [
      { jugador: "Adriano", personaId: 10, cantidad: 3 },
    ]);
    assert.deepEqual(payload.rojas, [
      { jugador: "Materazzi", personaId: 10 },
    ]);
  });
});
