import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Match } from "./types";
import {
  getSuspensionsForPlayer,
  getMatchSuspensions,
  isVirtualPlayerSuspended,
} from "./suspensions.ts";

describe("domain/suspensions", () => {
  const matchesFixture: Match[] = [
    {
      id: "m1",
      playerAId: "1", // Ulises
      playerBId: "2", // Rival 1
      goalsA: 2,
      goalsB: 1,
      played: true,
      round: 1,
      tournamentId: 10,
      scorers: [],
      redCards: [
        { playerName: "Crespo", playerId: "1" },
        { playerName: "Ayala", playerId: "2" },
      ],
    },
    {
      id: "m2",
      playerAId: "1", // Ulises
      playerBId: "3", // Rival 2
      goalsA: null,
      goalsB: null,
      played: false,
      round: 2,
      tournamentId: 10,
      scorers: [],
      redCards: [],
    },
    {
      id: "m3",
      playerAId: "1", // Ulises
      playerBId: "4", // Rival 3
      goalsA: null,
      goalsB: null,
      played: false,
      round: 3,
      tournamentId: 10,
      scorers: [],
      redCards: [],
    },
  ];

  it("detects suspension for next unplayed match (round 2) after red card in round 1", () => {
    const suspensions = getSuspensionsForPlayer(matchesFixture, "1", 2);
    assert.equal(suspensions.length, 1);
    assert.equal(suspensions[0].virtualPlayer, "Crespo");
    assert.equal(suspensions[0].suspendedUntilRound, 2);
    assert.equal(suspensions[0].redCardRound, 1);
  });

  it("returns true for isVirtualPlayerSuspended on target round (case-insensitive)", () => {
    assert.equal(isVirtualPlayerSuspended(matchesFixture, "1", "crespo", 2), true);
    assert.equal(isVirtualPlayerSuspended(matchesFixture, "1", "CRESPO", 2), true);
    assert.equal(isVirtualPlayerSuspended(matchesFixture, "1", "Messi", 2), false);
  });

  it("does not report suspension for round 3 if round 2 is where suspension applies", () => {
    const suspensionsR3 = getSuspensionsForPlayer(matchesFixture, "1", 3);
    assert.equal(suspensionsR3.length, 0);
    assert.equal(isVirtualPlayerSuspended(matchesFixture, "1", "Crespo", 3), false);
  });

  it("clears suspension once the suspended match (round 2) has been played", () => {
    const playedRound2Matches: Match[] = matchesFixture.map((m) =>
      m.id === "m2" ? { ...m, played: true, goalsA: 1, goalsB: 0 } : m
    );

    const suspensionsAfterPlaying = getSuspensionsForPlayer(playedRound2Matches, "1", 2);
    assert.equal(suspensionsAfterPlaying.length, 0);

    const suspensionsNext = getSuspensionsForPlayer(playedRound2Matches, "1", 3);
    assert.equal(suspensionsNext.length, 0);
  });

  it("detects suspensions for both opponents in an upcoming match", () => {
    // En la fecha 2: jugador 1 vs jugador 3.
    // Jugador 1 tiene a Crespo suspendido.
    // Jugador 3 no tiene rojas.
    const match2 = matchesFixture[1];
    const matchSuspensions = getMatchSuspensions(matchesFixture, match2);

    assert.equal(matchSuspensions.playerA.length, 1);
    assert.equal(matchSuspensions.playerA[0].virtualPlayer, "Crespo");
    assert.equal(matchSuspensions.playerB.length, 0);
  });
});
