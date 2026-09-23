import React, { useEffect } from "react";
import type { Player, Team, StandingRow, ScorerRow, RedCardRow, Match } from "../domain/types";
import { UserAvatar } from "./UserAvatar";

export interface PlayerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  team?: Team | null;
  standing?: StandingRow | null;
  scorers?: ScorerRow[];
  redCards?: RedCardRow[];
  matches?: Match[];
  allPlayers?: Player[];
  allTeams?: Team[];
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  isOpen,
  onClose,
  player,
  team,
  standing,
  scorers = [],
  redCards = [],
  matches = [],
  allPlayers = [],
  allTeams = [],
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !player) return null;

  // Filtrar partidos del jugador en esta competencia
  const playerMatches = matches.filter(
    (m) => m.playerAId === player.id || m.playerBId === player.id
  );

  // Total de goles virtuales registrados a favor
  const playerScorers = scorers.filter((s) => s.playerId === player.id);
  const totalVirtualGoals = playerScorers.reduce((acc, s) => acc + s.goals, 0);

  // Total de rojas registradas
  const playerRedCards = redCards.filter((r) => r.playerId === player.id);
  const totalReds = playerRedCards.reduce((acc, r) => acc + r.count, 0);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-box player-detail-modal" style={{ maxWidth: "620px" }}>
        <div className="player-modal-top-bar">
          <button
            type="button"
            className="modal-close modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar ficha de jugador"
          >
            ✕
          </button>
        </div>

        {/* Header con presentación del jugador */}
        <div className="player-hero-header">
          <UserAvatar
            name={player.name}
            avatarUrl={player.avatarUrl}
            isRegistered={player.isRegistered}
            size="2xl"
          />
          <div className="player-hero-info">
            <h2 id="player-modal-title" className="player-modal-name">
              {player.name}
            </h2>

            <div className="player-badges-wrap">
              {player.isRegistered ? (
                <span className="player-status-badge badge-registered">
                  ✓ Usuario Registrado
                  {player.userUsername && ` (@${player.userUsername})`}
                </span>
              ) : (
                <span className="player-status-badge badge-guest">
                  Jugador de la Comunidad (Sin cuenta)
                </span>
              )}
            </div>

            {team && (
              <div className="player-modal-team">
                <span style={{ fontSize: "1rem" }}>🛡️</span>
                <span>Equipo: <strong>{team.name}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Métricas Principales en el Torneo */}
        <div className="player-stats-section">
          <h4 className="player-section-heading">Rendimiento en el Torneo</h4>

          {standing ? (
            <div className="player-stats-grid">
              <div className="player-stat-card highlight">
                <span className="stat-card-label">Puntos</span>
                <span className="stat-card-value">{standing.points}</span>
              </div>
              <div className="player-stat-card">
                <span className="stat-card-label">PJ</span>
                <span className="stat-card-value">{standing.played}</span>
              </div>
              <div className="player-stat-card">
                <span className="stat-card-label">PG</span>
                <span className="stat-card-value" style={{ color: "#4ade80" }}>
                  {standing.won}
                </span>
              </div>
              <div className="player-stat-card">
                <span className="stat-card-label">PE</span>
                <span className="stat-card-value" style={{ color: "var(--gold-bright)" }}>
                  {standing.drawn}
                </span>
              </div>
              <div className="player-stat-card">
                <span className="stat-card-label">PP</span>
                <span className="stat-card-value" style={{ color: "#f87171" }}>
                  {standing.lost}
                </span>
              </div>
              <div className="player-stat-card">
                <span className="stat-card-label">GF / GC</span>
                <span className="stat-card-value" style={{ fontSize: "1.1rem" }}>
                  {standing.goalsFor} : {standing.goalsAgainst}
                </span>
              </div>
              <div className="player-stat-card">
                <span className="stat-card-label">Dif. Gol</span>
                <span
                  className="stat-card-value"
                  style={{
                    color: standing.goalDifference > 0 ? "#4ade80" : standing.goalDifference < 0 ? "#f87171" : "#fff",
                  }}
                >
                  {standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference}
                </span>
              </div>
              <div className="player-stat-card">
                <span className="stat-card-label">Rojas</span>
                <span className="stat-card-value" style={{ color: totalReds > 0 ? "#ef4444" : "#94a3b8" }}>
                  {totalReds}
                </span>
              </div>
            </div>
          ) : (
            <p className="player-empty-note">
              No hay estadísticas registradas para este participante en la competencia actual.
            </p>
          )}
        </div>

        {/* Desglose de Goleadores Individuales (PES) */}
        {playerScorers.length > 0 && (
          <div className="player-scorers-section">
            <h4 className="player-section-heading">
              Goleadores del Equipo ({totalVirtualGoals} goles en total)
            </h4>
            <div className="player-scorers-list">
              {playerScorers.map((s) => (
                <div key={s.virtualPlayer} className="player-scorer-pill">
                  <span className="scorer-name">⚽ {s.virtualPlayer}</span>
                  <span className="scorer-count">{s.goals} {s.goals === 1 ? "gol" : "goles"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Partidos del Jugador */}
        <div className="player-matches-section">
          <h4 className="player-section-heading">
            Partidos ({playerMatches.length})
          </h4>

          {playerMatches.length === 0 ? (
            <p className="player-empty-note">No hay partidos asignados todavía.</p>
          ) : (
            <div className="player-matches-list">
              {playerMatches.map((m) => {
                const isHome = m.playerAId === player.id;
                const myGoals = isHome ? m.goalsA : m.goalsB;
                const oppGoals = isHome ? m.goalsB : m.goalsA;
                const oppId = isHome ? m.playerBId : m.playerAId;

                const opponentPlayer = allPlayers.find((p) => p.id === oppId);
                const opponentTeam = opponentPlayer ? allTeams.find((t) => t.id === opponentPlayer.teamId) : null;

                let outcomeBadge: React.ReactNode;
                if (m.played && myGoals !== null && oppGoals !== null) {
                  if (myGoals > oppGoals) {
                    outcomeBadge = <span className="outcome-badge win">Victoria</span>;
                  } else if (myGoals === oppGoals) {
                    outcomeBadge = <span className="outcome-badge draw">Empate</span>;
                  } else {
                    outcomeBadge = <span className="outcome-badge loss">Derrota</span>;
                  }
                } else {
                  outcomeBadge = <span className="outcome-badge pending">Pendiente</span>;
                }

                return (
                  <div key={m.id} className="player-match-row">
                    <div className="match-opponent-info">
                      {m.round && <span className="match-round-tag">F{m.round}</span>}
                      <span className="vs-label">vs</span>
                      <UserAvatar
                        name={opponentPlayer?.name || "Rival"}
                        avatarUrl={opponentPlayer?.avatarUrl}
                        isRegistered={opponentPlayer?.isRegistered}
                        size="xs"
                      />
                      <span className="opponent-name">
                        {opponentPlayer?.name || "Rival por definir"}
                      </span>
                      {opponentTeam && (
                        <span className="opponent-team">({opponentTeam.name})</span>
                      )}
                    </div>

                    <div className="match-outcome-info">
                      {m.played && myGoals !== null && oppGoals !== null ? (
                        <span className="match-score-pill">
                          {myGoals} - {oppGoals}
                        </span>
                      ) : (
                        <span className="match-score-pill pending-score">Por jugar</span>
                      )}
                      {outcomeBadge}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer-row" style={{ marginTop: "20px" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};
