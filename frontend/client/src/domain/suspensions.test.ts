import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Match } from "./types";
import {
  getSuspensionsForPlayer,
  getMatchSuspensions,
  isVirtualPlayerSuspended,
  getWeekForRound,
} from "./suspensions.ts";

describe("domain/suspensions", () => {
  // Supongamos un fixture de 4 fechas (Semana 1 = Fecha 1 y 2; Semana 2 = Fecha 3 y 4)
  const baseMatches: Match[] = [
    {
      id: "m1",
      playerAId: "uli",
      playerBId: "esteban",
      goalsA: 0,
      goalsB: 0,
      played: true,
      round: 1, // Semana 1
      tournamentId: 1,
      scorers: [],
      redCards: [{ playerName: "Ronaldinho", playerId: "uli" }],
    },
    {
      id: "m2",
      playerAId: "uli",
      playerBId: "fede",
      goalsA: null,
      goalsB: null,
      played: false,
      round: 2, // Semana 1 (pendiente en la misma semana)
      tournamentId: 1,
      scorers: [],
      redCards: [],
    },
    {
      id: "m3",
      playerAId: "uli",
      playerBId: "rival3",
      goalsA: null,
      goalsB: null,
      played: false,
      round: 3, // Semana 2
      tournamentId: 1,
      scorers: [],
      redCards: [],
    },
    {
      id: "m4",
      playerAId: "uli",
      playerBId: "rival4",
      goalsA: null,
      goalsB: null,
      played: false,
      round: 4, // Semana 2
      tournamentId: 1,
      scorers: [],
      redCards: [],
    },
  ];

  it("calculates week correctly based on 2 rounds per week", () => {
    assert.equal(getWeekForRound(1), 1);
    assert.equal(getWeekForRound(2), 1);
    assert.equal(getWeekForRound(3), 2);
    assert.equal(getWeekForRound(4), 2);
  });

  it("Caso 1: si quedan partidos pendientes en la semana actual (fecha 2), la roja aplica al próximo partido de esa misma semana", () => {
    // Uli fue expulsado en fecha 1, y fecha 2 está pendiente
    const suspFecha2 = getSuspensionsForPlayer(baseMatches, "uli", 2);
    assert.equal(suspFecha2.length, 1);
    assert.equal(suspFecha2[0].virtualPlayer, "Ronaldinho");
    assert.equal(suspFecha2[0].targetWeek, 1);

    // No debe aparecer aún para la semana 2
    const suspFecha3 = getSuspensionsForPlayer(baseMatches, "uli", 3);
    assert.equal(suspFecha3.length, 0);
  });

  it("Caso 2: si NO quedan partidos pendientes en la semana actual, la roja pasa a la semana siguiente y aparece en TODOS los partidos de esa semana", () => {
    // Simulamos que fecha 2 también ya se jugó (o no había más partidos en la semana 1)
    const matchesWeek1Complete: Match[] = [
      baseMatches[0], // fecha 1 jugada con roja
      { ...baseMatches[1], played: true, goalsA: 1, goalsB: 1 }, // fecha 2 jugada (sin uli o jugada con uli)
      baseMatches[2], // fecha 3 (Semana 2) pendiente
      baseMatches[3], // fecha 4 (Semana 2) pendiente
    ];

    // Ahora la advertencia debe salir para AMBOS partidos de la semana 2 (fecha 3 y fecha 4)
    const suspFecha3 = getSuspensionsForPlayer(matchesWeek1Complete, "uli", 3);
    assert.equal(suspFecha3.length, 1);
    assert.equal(suspFecha3[0].virtualPlayer, "Ronaldinho");
    assert.equal(suspFecha3[0].targetWeek, 2);

    const suspFecha4 = getSuspensionsForPlayer(matchesWeek1Complete, "uli", 4);
    assert.equal(suspFecha4.length, 1);
    assert.equal(suspFecha4[0].virtualPlayer, "Ronaldinho");
    assert.equal(suspFecha4[0].targetWeek, 2);

    // En el validador, está inhabilitado para cualquiera de los dos que elija jugar
    assert.equal(isVirtualPlayerSuspended(matchesWeek1Complete, "uli", "ronaldinho", 3), true);
    assert.equal(isVirtualPlayerSuspended(matchesWeek1Complete, "uli", "Ronaldinho", 4), true);
  });

  it("Caso 2: una vez que Uli juegue 1 partido de la semana siguiente (ej. con Fede o Esteban), la sanción se cumple y desaparece de los demás", () => {
    // Uli elige jugar fecha 4 primero (o fecha 3) en semana 2
    const matchesWeek2OnePlayed: Match[] = [
      baseMatches[0], // fecha 1 jugada con roja
      { ...baseMatches[1], played: true, goalsA: 1, goalsB: 1 }, // fecha 2 jugada
      baseMatches[2], // fecha 3 pendiente
      { ...baseMatches[3], played: true, goalsA: 2, goalsB: 0 }, // fecha 4 YA SE JUGÓ
    ];

    // Como ya jugó 1 partido en la semana 2, para la fecha 3 pendiente YA NO debe aparecer suspendido
    const suspFecha3 = getSuspensionsForPlayer(matchesWeek2OnePlayed, "uli", 3);
    assert.equal(suspFecha3.length, 0);
    assert.equal(isVirtualPlayerSuspended(matchesWeek2OnePlayed, "uli", "ronaldinho", 3), false);
  });

  it("Torneo de 2 participantes (Fecha 1 jugada con roja, Fecha 2 pendiente): aparece suspendido en Fecha 2", () => {
    const twoPlayersMatches: Match[] = [
      {
        id: "1",
        playerAId: "8",
        playerBId: "7",
        goalsA: 0,
        goalsB: 0,
        played: true,
        round: 1,
        tournamentId: 1,
        scorers: [],
        redCards: [{ playerName: "lana rhoades", playerId: "8" }],
      },
      {
        id: "2",
        playerAId: "7",
        playerBId: "8",
        goalsA: null,
        goalsB: null,
        played: false,
        round: 2,
        tournamentId: 1,
        scorers: [],
        redCards: [],
      },
    ];

    const suspRound2 = getSuspensionsForPlayer(twoPlayersMatches, "8", 2);
    assert.equal(suspRound2.length, 1);
    assert.equal(suspRound2[0].virtualPlayer, "lana rhoades");
  });
});
