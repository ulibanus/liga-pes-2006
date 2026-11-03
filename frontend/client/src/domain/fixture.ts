import type { Player, Team, Match, FixtureRound, FixtureMatch } from "./types";
import { getSuspensionsForPlayer } from "./suspensions.ts";

/**
 * Generates round-robin pairings for a list of player IDs using the Berger/Polygon method.
 * Pure function: deterministic, zero side effects.
 */
export function generatePairings(
  playerIds: string[],
  format: "ida" | "ida_vuelta" = "ida"
): Array<Array<[string | null, string | null]>> {
  if (playerIds.length < 2) return [];

  const ids: Array<string | null> = [...playerIds];
  if (ids.length % 2 !== 0) {
    ids.push(null);
  }

  const n = ids.length;
  let current = [...ids];
  const rounds: Array<Array<[string | null, string | null]>> = [];

  for (let r = 0; r < n - 1; r++) {
    const round: Array<[string | null, string | null]> = [];
    for (let i = 0; i < n / 2; i++) {
      round.push([current[i], current[n - 1 - i]]);
    }
    rounds.push(round);

    const fixed = current[0];
    const rest = current.slice(1);
    const last = rest.pop();
    if (last !== undefined) {
      rest.unshift(last);
    }
    current = [fixed, ...rest];
  }

  if (format === "ida_vuelta") {
    const returnRounds = rounds.map((round) =>
      round.map(([a, b]) => [b, a] as [string | null, string | null])
    );
    rounds.push(...returnRounds);
  }

  return rounds;
}

/**
 * Builds the complete tournament fixture, cross-referencing pairings with recorded matches.
 */
export function buildFixture(
  players: Player[],
  teams: Team[],
  matches: Match[],
  filterPlayerId?: string,
  format: "ida" | "ida_vuelta" = "ida"
): FixtureRound[] {
  const playerMap = new Map<string, Player>(players.map((p) => [p.id, p]));
  const teamMap = new Map<string, string>(teams.map((t) => [t.id, t.name]));

  const roundsPairings = generatePairings(
    players.map((p) => p.id),
    format
  );

  const fixtureRounds: FixtureRound[] = [];

  roundsPairings.forEach((pairings, roundIndex) => {
    const roundNumber = roundIndex + 1;
    const roundMatches: FixtureMatch[] = [];

    for (const [idA, idB] of pairings) {
      if (filterPlayerId && idA !== filterPlayerId && idB !== filterPlayerId) {
        continue;
      }

      if (idA === null || idB === null) {
        const byeId = idA ?? idB;
        const player = byeId ? playerMap.get(byeId) : undefined;
        roundMatches.push({
          playerAId: byeId,
          playerAName: player ? player.name : "Participante",
          teamAName: player ? teamMap.get(player.teamId) || "Sin Equipo" : "",
          playerAAvatarUrl: player?.avatarUrl ?? null,
          playerAIsRegistered: player?.isRegistered ?? false,
          playerBId: null,
          playerBName: "",
          teamBName: "",
          playerBAvatarUrl: null,
          playerBIsRegistered: false,
          isBye: true,
          played: true,
          goalsA: null,
          goalsB: null,
        });
        continue;
      }

      const playerA = playerMap.get(idA);
      const playerB = playerMap.get(idB);

      const playedMatch = matches.find(
        (m) =>
          m.round === roundNumber &&
          ((m.playerAId === idA && m.playerBId === idB) ||
            (m.playerAId === idB && m.playerBId === idA))
      );

      if (playedMatch && playedMatch.played) {
        const isAHome = playedMatch.playerAId === idA;
        roundMatches.push({
          playerAId: idA,
          playerAName: playerA ? playerA.name : "Desconocido",
          teamAName: playerA ? teamMap.get(playerA.teamId) || "Sin Equipo" : "",
          playerAAvatarUrl: playerA?.avatarUrl ?? null,
          playerAIsRegistered: playerA?.isRegistered ?? false,
          playerBId: idB,
          playerBName: playerB ? playerB.name : "Desconocido",
          teamBName: playerB ? teamMap.get(playerB.teamId) || "Sin Equipo" : "",
          playerBAvatarUrl: playerB?.avatarUrl ?? null,
          playerBIsRegistered: playerB?.isRegistered ?? false,
          isBye: false,
          played: true,
          goalsA: isAHome ? playedMatch.goalsA : playedMatch.goalsB,
          goalsB: isAHome ? playedMatch.goalsB : playedMatch.goalsA,
        });
      } else {
        const suspendedA = idA ? getSuspensionsForPlayer(matches, idA, roundNumber).map((s) => s.virtualPlayer) : [];
        const suspendedB = idB ? getSuspensionsForPlayer(matches, idB, roundNumber).map((s) => s.virtualPlayer) : [];

        roundMatches.push({
          playerAId: idA,
          playerAName: playerA ? playerA.name : "Desconocido",
          teamAName: playerA ? teamMap.get(playerA.teamId) || "Sin Equipo" : "",
          playerAAvatarUrl: playerA?.avatarUrl ?? null,
          playerAIsRegistered: playerA?.isRegistered ?? false,
          playerBId: idB,
          playerBName: playerB ? playerB.name : "Desconocido",
          teamBName: playerB ? teamMap.get(playerB.teamId) || "Sin Equipo" : "",
          playerBAvatarUrl: playerB?.avatarUrl ?? null,
          playerBIsRegistered: playerB?.isRegistered ?? false,
          isBye: false,
          played: false,
          goalsA: null,
          goalsB: null,
          suspendedPlayersA: suspendedA,
          suspendedPlayersB: suspendedB,
        });
      }
    }

    if (roundMatches.length > 0) {
      fixtureRounds.push({
        roundNumber,
        matches: roundMatches,
      });
    }
  });

  return fixtureRounds;
}

export interface WeeklyFixtureGroup {
  weekNumber: number;
  isCurrentWeek: boolean;
  rounds: FixtureRound[];
}

/**
 * Groups fixture rounds into weekly blocks (default 2 rounds per week)
 * and determines the active week relative to a start date.
 */
export function buildWeeklyFixture(
  rounds: FixtureRound[],
  roundsPerWeek = 2,
  tournamentStartDate?: string
): WeeklyFixtureGroup[] {
  if (rounds.length === 0) return [];

  const totalWeeks = Math.ceil(rounds.length / roundsPerWeek);
  let currentWeekIndex = 0;

  if (tournamentStartDate) {
    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + diff);
      date.setHours(0, 0, 0, 0);
      return date;
    };

    const startMonday = getMonday(new Date(tournamentStartDate));
    const currentMonday = getMonday(new Date());
    const diffWeeks = Math.round(
      (currentMonday.getTime() - startMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    currentWeekIndex = Math.min(Math.max(0, diffWeeks), Math.max(0, totalWeeks - 1));
  }

  const weeklyGroups: WeeklyFixtureGroup[] = [];
  for (let w = 0; w < totalWeeks; w++) {
    const start = w * roundsPerWeek;
    const weekRounds = rounds.slice(start, start + roundsPerWeek);
    weeklyGroups.push({
      weekNumber: w + 1,
      isCurrentWeek: w === currentWeekIndex,
      rounds: weekRounds,
    });
  }

  return weeklyGroups;
}

