import React, { useMemo } from "react";
import type { FixtureRound, Player } from "../domain/types";
import { buildWeeklyFixture } from "../domain/fixture";
import { UserAvatar } from "./UserAvatar";

interface FixtureViewProps {
  rounds: FixtureRound[];
  players: Player[];
  selectedPlayerId: string;
  onSelectPlayer: (id: string) => void;
  onInspectPlayer?: (playerId: string) => void;
  format: "ida" | "ida_vuelta";
  onChangeFormat: (format: "ida" | "ida_vuelta") => void;
  canEditMatches?: boolean;
  onEditMatch?: (match: import("../domain/types").FixtureMatch, roundNumber: number) => void;
}

export const FixtureView: React.FC<FixtureViewProps> = ({
  rounds,
  players,
  selectedPlayerId,
  onSelectPlayer,
  onInspectPlayer,
  format,
  onChangeFormat,
  canEditMatches = false,
  onEditMatch,
}) => {
  const startDate = useMemo(() => {
    return localStorage.getItem("pes_torneo_inicio") || undefined;
  }, []);

  const weeklyGroups = useMemo(() => {
    return buildWeeklyFixture(rounds, 2, startDate);
  }, [rounds, startDate]);

  const currentWeek = useMemo(() => {
    const found = weeklyGroups.find((w) => w.isCurrentWeek);
    return found ? found.weekNumber : 1;
  }, [weeklyGroups]);

  if (players.length < 2) {
    return (
      <div className="empty-state">
        Se necesitan al menos 2 participantes para generar el fixture del torneo.
      </div>
    );
  }

  return (
    <div className="fixture-container">
      <div className="fixture-toolbar">
        <div className="form-group">
          <label htmlFor="playerFilter">Ver fixture de:</label>
          <select
            id="playerFilter"
            className="form-select"
            value={selectedPlayerId}
            onChange={(e) => onSelectPlayer(e.target.value)}
          >
            <option value="">Todos los participantes</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="formatSelect">Formato:</label>
          <select
            id="formatSelect"
            className="form-select"
            value={format}
            onChange={(e) => onChangeFormat(e.target.value as "ida" | "ida_vuelta")}
          >
            <option value="ida">Solo Ida</option>
            <option value="ida_vuelta">Ida y Vuelta</option>
          </select>
        </div>
      </div>

      {weeklyGroups.length > 0 && (
        <div className="week-info-banner">
          <span>
            Semana de competencia: <strong>{currentWeek}</strong> de{" "}
            {weeklyGroups.length}
          </span>
        </div>
      )}

      <div className="weeks-list">
        {weeklyGroups.map((week) => (
          <div
            key={week.weekNumber}
            className={`semana-block ${week.isCurrentWeek ? "actual" : ""}`}
          >
            <div className="semana-header">
              <h4>Semana {week.weekNumber}</h4>
              {week.isCurrentWeek && (
                <span className="semana-tag-actual">Semana Actual</span>
              )}
            </div>

            <div className="rounds-list">
              {week.rounds.map((round) => (
                <div key={round.roundNumber} className="round-card">
                  <div className="round-header">
                    <h3>Fecha {round.roundNumber}</h3>
                    <span className="round-count">{round.matches.length} partidos</span>
                  </div>

                  <div className="matches-list">
                    {round.matches.map((match, idx) => {
                      if (match.isBye) {
                        return (
                          <div key={idx} className="match-item match-bye">
                            <span className="match-player" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <UserAvatar
                                name={match.playerAName}
                                avatarUrl={match.playerAAvatarUrl}
                                isRegistered={match.playerAIsRegistered}
                                size="xs"
                              />
                              <span>
                                {match.playerAName}{" "}
                                {match.teamAName ? `(${match.teamAName})` : ""}
                              </span>
                            </span>
                            <span className="chip chip-bye">Fecha Libre</span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={idx}
                          className={`match-item ${
                            match.played ? "match-played" : "match-pending"
                          }`}
                        >
                          <div className="match-side home">
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                              <UserAvatar
                                name={match.playerAName}
                                avatarUrl={match.playerAAvatarUrl}
                                isRegistered={match.playerAIsRegistered}
                                size="xs"
                                onClick={onInspectPlayer && match.playerAId ? () => onInspectPlayer(match.playerAId!) : undefined}
                              />
                              <span
                                className={`player-name ${onInspectPlayer && match.playerAId ? "player-clickable-name" : ""}`}
                                onClick={onInspectPlayer && match.playerAId ? () => onInspectPlayer(match.playerAId!) : undefined}
                                title={onInspectPlayer && match.playerAId ? `Ver ficha de ${match.playerAName}` : undefined}
                              >
                                {match.playerAName}
                              </span>
                            </div>
                            <span className="team-name">{match.teamAName}</span>
                            {match.suspendedPlayersA && match.suspendedPlayersA.length > 0 && (
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.75rem",
                                  color: "#ef4444",
                                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  marginTop: "4px",
                                }}
                                title={`Jugadores suspendidos para esta fecha: ${match.suspendedPlayersA.join(", ")}`}
                              >
                                <span>🟥 Suspendido: {match.suspendedPlayersA.join(", ")}</span>
                              </div>
                            )}
                          </div>

                          <div className="match-center">
                            {match.played ? (
                              <div className="score-display">
                                <span className="score-box">{match.goalsA}</span>
                                <span className="score-divider">-</span>
                                <span className="score-box">{match.goalsB}</span>
                              </div>
                            ) : (
                              <span className="vs-badge">VS</span>
                            )}
                          </div>

                          <div className="match-side away">
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                              <UserAvatar
                                name={match.playerBName}
                                avatarUrl={match.playerBAvatarUrl}
                                isRegistered={match.playerBIsRegistered}
                                size="xs"
                                onClick={onInspectPlayer && match.playerBId ? () => onInspectPlayer(match.playerBId!) : undefined}
                              />
                              <span
                                className={`player-name ${onInspectPlayer && match.playerBId ? "player-clickable-name" : ""}`}
                                onClick={onInspectPlayer && match.playerBId ? () => onInspectPlayer(match.playerBId!) : undefined}
                                title={onInspectPlayer && match.playerBId ? `Ver ficha de ${match.playerBName}` : undefined}
                              >
                                {match.playerBName}
                              </span>
                            </div>
                            <span className="team-name">{match.teamBName}</span>
                            {match.suspendedPlayersB && match.suspendedPlayersB.length > 0 && (
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.75rem",
                                  color: "#ef4444",
                                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  marginTop: "4px",
                                }}
                                title={`Jugadores suspendidos para esta fecha: ${match.suspendedPlayersB.join(", ")}`}
                              >
                                <span>🟥 Suspendido: {match.suspendedPlayersB.join(", ")}</span>
                              </div>
                            )}
                          </div>

                          <div className="match-status" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {match.played ? (
                              <span className="chip chip-success">Jugado</span>
                            ) : (
                              <span className="chip chip-muted">Pendiente</span>
                            )}
                            {canEditMatches && match.played && onEditMatch && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                style={{ padding: "3px 8px", fontSize: "0.75rem" }}
                                onClick={() => onEditMatch(match, round.roundNumber)}
                                title="Editar resultado de este partido"
                              >
                                ✏️ Editar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
