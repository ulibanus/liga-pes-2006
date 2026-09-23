import React, { useState, useEffect, useMemo } from "react";
import type { Tournament } from "../domain/types";
import { UserAvatar } from "./UserAvatar";
import {
  fetchTournamentProde,
  submitProdePrediction,
  fetchTournamentProdeLeaderboard,
  generateTorneoFixture,
  type ProdeMatchItem,
  type ProdeStanding,
} from "../services/api";

interface ProdeViewProps {
  activeTournament: Tournament | null;
  currentUser: { id: number; username: string; role: string } | null;
  token: string | null;
  onOpenLogin: () => void;
  canManageTournament: boolean;
}

export const ProdeView: React.FC<ProdeViewProps> = ({
  activeTournament,
  currentUser,
  token,
  onOpenLogin,
  canManageTournament,
}) => {
  const [subTab, setSubTab] = useState<"matches" | "leaderboard">("matches");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<ProdeMatchItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<ProdeStanding[]>([]);

  // Draft predictions state: { [id_partido]: { home: string, away: string } }
  const [draftPreds, setDraftPreds] = useState<Record<number, { home: string; away: string }>>({});
  const [savingMatchId, setSavingMatchId] = useState<number | null>(null);
  const [saveSuccessMatchId, setSaveSuccessMatchId] = useState<number | null>(null);
  const [generatingFixture, setGeneratingFixture] = useState(false);

  // Expanded community predictions toggle
  const [expandedCommunityMatchId, setExpandedCommunityMatchId] = useState<number | null>(null);

  const loadProdeData = async () => {
    if (!activeTournament) return;
    try {
      setLoading(true);
      setError(null);
      const [prodeRes, boardRes] = await Promise.all([
        fetchTournamentProde(activeTournament.id, token),
        fetchTournamentProdeLeaderboard(activeTournament.id),
      ]);

      setMatches(prodeRes.partidos);
      setLeaderboard(boardRes);

      // Initialize draft predictions with user's saved predictions
      const initialDrafts: Record<number, { home: string; away: string }> = {};
      for (const m of prodeRes.partidos) {
        if (m.mi_pronostico) {
          initialDrafts[m.id_partido] = {
            home: String(m.mi_pronostico.goles_local),
            away: String(m.mi_pronostico.goles_visitante),
          };
        }
      }
      setDraftPreds(initialDrafts);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || "Error al cargar la información del Prode");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProdeData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournament?.id, token]);

  // Round filter state: "auto" selects active round with pending matches, or specific round key, or "all"
  const [selectedRoundKey, setSelectedRoundKey] = useState<string>("auto");
  const [filterPendingOnly, setFilterPendingOnly] = useState<boolean>(false);

  const [prevTournamentId, setPrevTournamentId] = useState<number | undefined>(undefined);
  if (activeTournament?.id !== prevTournamentId) {
    setPrevTournamentId(activeTournament?.id);
    setSelectedRoundKey("auto");
  }

  // Group matches by round / fecha or stage
  const groupedMatches = useMemo(() => {
    const groups: {
      key: string;
      title: string;
      items: ProdeMatchItem[];
      pendingCount: number;
      playedCount: number;
    }[] = [];
    const map = new Map<string, ProdeMatchItem[]>();

    for (const m of matches) {
      const key = m.etapa && m.etapa !== "fecha" ? `Fase: ${m.etapa.toUpperCase()}` : `Fecha ${m.numero_fecha ?? 1}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(m);
    }

    for (const [title, items] of map.entries()) {
      const pendingCount = items.filter((m) => !m.isPlayed).length;
      const playedCount = items.filter((m) => m.isPlayed).length;
      groups.push({ key: title, title, items, pendingCount, playedCount });
    }
    return groups;
  }, [matches]);

  const activeRoundKey = useMemo(() => {
    if (groupedMatches.length === 0) return null;
    const firstPending = groupedMatches.find((g) => g.pendingCount > 0);
    if (firstPending) return firstPending.key;
    return groupedMatches[groupedMatches.length - 1].key;
  }, [groupedMatches]);

  const effectiveRoundKey = selectedRoundKey === "auto" ? (activeRoundKey ?? "all") : selectedRoundKey;

  const currentRoundIndex = useMemo(() => {
    return groupedMatches.findIndex((g) => g.key === effectiveRoundKey);
  }, [groupedMatches, effectiveRoundKey]);

  const handlePrevRound = () => {
    if (currentRoundIndex > 0) {
      setSelectedRoundKey(groupedMatches[currentRoundIndex - 1].key);
    }
  };

  const handleNextRound = () => {
    if (currentRoundIndex >= 0 && currentRoundIndex < groupedMatches.length - 1) {
      setSelectedRoundKey(groupedMatches[currentRoundIndex + 1].key);
    }
  };

  const displayedGroups = useMemo(() => {
    let list = groupedMatches;
    if (effectiveRoundKey !== "all") {
      list = list.filter((g) => g.key === effectiveRoundKey);
    }
    if (filterPendingOnly) {
      list = list
        .map((g) => ({
          ...g,
          items: g.items.filter((m) => !m.isPlayed),
        }))
        .filter((g) => g.items.length > 0);
    }
    return list;
  }, [groupedMatches, effectiveRoundKey, filterPendingOnly]);

  const handlePredictionChange = (matchId: number, side: "home" | "away", val: string) => {
    setDraftPreds((prev) => ({
      ...prev,
      [matchId]: {
        home: side === "home" ? val : prev[matchId]?.home ?? "",
        away: side === "away" ? val : prev[matchId]?.away ?? "",
      },
    }));
  };

  const handleSavePrediction = async (matchId: number) => {
    if (!token || !activeTournament) {
      onOpenLogin();
      return;
    }

    if (activeTournament.status !== "en_curso") {
      alert("Solo se pueden cargar pronósticos en torneos que estén en curso.");
      return;
    }

    const draft = draftPreds[matchId];
    if (!draft || draft.home.trim() === "" || draft.away.trim() === "") {
      alert("Por favor ingresa los goles para ambos equipos.");
      return;
    }

    const gl = parseInt(draft.home, 10);
    const gv = parseInt(draft.away, 10);

    if (isNaN(gl) || isNaN(gv) || gl < 0 || gv < 0) {
      alert("Los goles deben ser números enteros válidos mayores o iguales a 0.");
      return;
    }

    try {
      setSavingMatchId(matchId);
      await submitProdePrediction(token, activeTournament.id, matchId, gl, gv);
      setSaveSuccessMatchId(matchId);
      setTimeout(() => setSaveSuccessMatchId(null), 3000);
      await loadProdeData();
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : String(err)) || "Error al guardar el pronóstico");
    } finally {
      setSavingMatchId(null);
    }
  };

  const hasPendingMatches = useMemo(() => matches.some((m) => !m.isPlayed), [matches]);
  const canGenerate = canManageTournament && activeTournament?.status !== "finalizado";
  const isTournamentOpen = activeTournament?.status === "en_curso";

  const handleGenerateFixture = async () => {
    if (!token || !activeTournament) return;
    if (!confirm("¿Deseas generar o sincronizar el fixture oficial para este torneo? Se crearán los partidos pendientes en base a los participantes asignados.")) {
      return;
    }

    try {
      setGeneratingFixture(true);
      const res = await generateTorneoFixture(token, activeTournament.id);
      alert(res.message || "Fixture generado exitosamente.");
      await loadProdeData();
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : String(err)) || "Error al generar fixture");
    } finally {
      setGeneratingFixture(false);
    }
  };

  if (!activeTournament) {
    return (
      <div className="prode-container empty-state">
        <p>Selecciona un torneo para participar en el Prode.</p>
      </div>
    );
  }

  return (
    <div className="prode-container" style={{ maxWidth: "1000px", margin: "0 auto", padding: "1rem" }}>
      {/* Header & Subtabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>🎯</span> Prode de la Comunidad: {activeTournament.name}
          </h2>
          <p style={{ margin: "0.25rem 0 0 0", color: "#94a3b8", fontSize: "0.9rem" }}>
            Acierta los resultados: <strong>3 puntos</strong> por marcador exacto, <strong>1 punto</strong> por ganador o empate.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {canGenerate && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleGenerateFixture}
              disabled={generatingFixture}
              title="Generar o sincronizar partidos pendientes del torneo"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}
            >
              <span>📅</span> {generatingFixture ? "Sincronizando..." : "Sincronizar Fixture"}
            </button>
          )}
          <button
            type="button"
            className={`btn ${subTab === "matches" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setSubTab("matches")}
          >
            ⚽ Pronósticos
          </button>
          <button
            type="button"
            className={`btn ${subTab === "leaderboard" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setSubTab("leaderboard")}
          >
            🏆 Posiciones Prode
          </button>
        </div>
      </div>

      {/* Tournament state alert if not en_curso */}
      {activeTournament.status === "borrador" ? (
        <div style={{
          background: "rgba(234, 179, 8, 0.15)",
          border: "1px solid #eab308",
          borderRadius: "8px",
          padding: "0.75rem 1.25rem",
          marginBottom: "1.5rem",
          color: "#fef08a",
          fontSize: "0.9rem"
        }}>
          ⚠️ <strong>Torneo en borrador:</strong> Los pronósticos se habilitarán una vez que el torneo pase a estado &quot;En curso&quot;.
        </div>
      ) : activeTournament.status === "finalizado" ? (
        <div style={{
          background: "rgba(100, 116, 139, 0.2)",
          border: "1px solid #64748b",
          borderRadius: "8px",
          padding: "0.75rem 1.25rem",
          marginBottom: "1.5rem",
          color: "#cbd5e1",
          fontSize: "0.9rem"
        }}>
          🏁 <strong>Torneo finalizado:</strong> La competición concluyó y los pronósticos del Prode se encuentran cerrados.
        </div>
      ) : null}

      {/* Guest login banner */}
      {!currentUser && (
        <div style={{
          background: "linear-gradient(135deg, rgba(30, 58, 138, 0.4), rgba(59, 130, 246, 0.2))",
          border: "1px solid #3b82f6",
          borderRadius: "8px",
          padding: "1rem 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}>
          <div>
            <strong style={{ color: "#93c5fd" }}>¿Quieres participar en el Prode?</strong>
            <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.88rem", color: "#e2e8f0" }}>
              Inicia sesión o regístrate para cargar tus resultados y subir en la tabla de la comunidad.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={onOpenLogin}>
            Iniciar Sesión
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <p>Cargando información del Prode...</p>
        </div>
      ) : error ? (
        <div className="empty-state" style={{ color: "#f87171" }}>
          <p>{error}</p>
        </div>
      ) : subTab === "leaderboard" ? (
        /* ================= LEADERBOARD TAB ================= */
        <div style={{ background: "#1e293b", borderRadius: "8px", padding: "1.25rem", border: "1px solid #334155" }}>
          <h3 style={{ marginTop: 0, marginBottom: "1rem", borderBottom: "1px solid #334155", paddingBottom: "0.5rem" }}>
            🏆 Clasificación del Prode - {activeTournament.name}
          </h3>

          {leaderboard.length === 0 ? (
            <div className="empty-state">
              <p>Aún no hay pronósticos computados en este torneo. ¡Sé el primero en acertar!</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.95rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #475569", color: "#94a3b8" }}>
                    <th style={{ padding: "0.75rem 0.5rem", width: "50px", textAlign: "center" }}>#</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Participante</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>Puntos</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>🎯 Exactos (3p)</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>⚽ Aciertos (1p)</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>❌ Fallados</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, idx) => {
                    const isMe = currentUser && row.id_usuario === currentUser.id;
                    const rankMedal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`;
                    return (
                      <tr
                        key={row.id_usuario}
                        style={{
                          borderBottom: "1px solid #334155",
                          background: isMe ? "rgba(59, 130, 246, 0.15)" : "transparent",
                          fontWeight: isMe ? "bold" : "normal",
                        }}
                      >
                        <td style={{ padding: "0.75rem 0.5rem", textAlign: "center", fontSize: "1.1rem" }}>
                          {rankMedal}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <UserAvatar
                              name={row.username}
                              avatarUrl={row.avatar_url}
                              isRegistered={true}
                              size="sm"
                            />
                            <span style={{ color: isMe ? "#60a5fa" : "#f8fafc" }}>{row.username}</span>
                            {isMe && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  background: "#2563eb",
                                  color: "#fff",
                                  padding: "0.1rem 0.4rem",
                                  borderRadius: "4px",
                                }}
                              >
                                Tú
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", textAlign: "center", fontSize: "1.15rem", color: "#fbbf24", fontWeight: "bold" }}>
                          {row.puntos_totales}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", textAlign: "center", color: "#34d399" }}>
                          {row.aciertos_exactos}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", textAlign: "center", color: "#38bdf8" }}>
                          {row.aciertos_resultado}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", textAlign: "center", color: "#94a3b8" }}>
                          {row.desaciertos}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", textAlign: "center", color: "#cbd5e1" }}>
                          {row.total_pronosticos}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ================= MATCHES & PREDICTIONS TAB ================= */
        <div>
          {matches.length === 0 ? (
            <div className="empty-state" style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <p style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
                Aún no hay partidos programados en este torneo para pronosticar.
              </p>
              {canGenerate && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleGenerateFixture}
                  disabled={generatingFixture}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                >
                  <span>📅</span> {generatingFixture ? "Generando Fixture..." : "Generar Fixture Oficial"}
                </button>
              )}
            </div>
          ) : (
            <>
              {!hasPendingMatches && (
                <div style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  padding: "1rem 1.25rem",
                  marginBottom: "1.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1rem"
                }}>
                  <div>
                    <strong style={{ color: "#f8fafc" }}>No hay partidos pendientes para pronosticar</strong>
                    <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
                      Todos los partidos registrados actualmente ya fueron disputados.
                      {canGenerate ? " Puedes sincronizar las fechas restantes del fixture para habilitar nuevos pronósticos." : ""}
                    </p>
                  </div>
                  {canGenerate && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleGenerateFixture}
                      disabled={generatingFixture}
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                    >
                      <span>📅</span> {generatingFixture ? "Sincronizando..." : "Sincronizar Fixture Oficial"}
                    </button>
                  )}
                </div>
              )}

              {/* Round Selector & Quick Filter Toolbar */}
              <div style={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                marginBottom: "1.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem"
              }}>
                {/* Stepper + Dropdown */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handlePrevRound}
                    disabled={currentRoundIndex <= 0 || effectiveRoundKey === "all"}
                    style={{ padding: "0.35rem 0.65rem", fontSize: "0.85rem" }}
                    title="Fecha anterior"
                  >
                    ◀ Anterior
                  </button>

                  <select
                    className="form-select"
                    value={effectiveRoundKey}
                    onChange={(e) => setSelectedRoundKey(e.target.value)}
                    style={{
                      background: "#0f172a",
                      color: "#f8fafc",
                      border: "1px solid #475569",
                      borderRadius: "6px",
                      padding: "0.4rem 0.75rem",
                      fontSize: "0.9rem",
                      fontWeight: "bold",
                      cursor: "pointer",
                      maxWidth: "320px"
                    }}
                  >
                    <option value="all">Ver todas las fechas ({matches.length} partidos)</option>
                    {groupedMatches.map((g) => {
                      const isCurrent = g.key === activeRoundKey;
                      const tag = g.pendingCount > 0 ? `${g.pendingCount} por jugar` : "finalizada";
                      return (
                        <option key={g.key} value={g.key}>
                          {g.title} {isCurrent ? "⚡ ACTUAL" : ""} ({tag})
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleNextRound}
                    disabled={currentRoundIndex < 0 || currentRoundIndex >= groupedMatches.length - 1 || effectiveRoundKey === "all"}
                    style={{ padding: "0.35rem 0.65rem", fontSize: "0.85rem" }}
                    title="Fecha siguiente"
                  >
                    Siguiente ▶
                  </button>
                </div>

                {/* Filter Pending Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <label style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    fontSize: "0.85rem",
                    color: filterPendingOnly ? "#60a5fa" : "#cbd5e1",
                    fontWeight: filterPendingOnly ? "bold" : "normal",
                    cursor: "pointer",
                    userSelect: "none"
                  }}>
                    <input
                      type="checkbox"
                      checked={filterPendingOnly}
                      onChange={(e) => setFilterPendingOnly(e.target.checked)}
                      style={{ accentColor: "#3b82f6", cursor: "pointer", width: "16px", height: "16px" }}
                    />
                    <span>Solo partidos por pronosticar</span>
                  </label>
                </div>
              </div>

              {displayedGroups.length === 0 ? (
                <div className="empty-state" style={{ textAlign: "center", padding: "2.5rem 1rem", background: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b", marginBottom: "2rem" }}>
                  <p style={{ color: "#94a3b8", fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                    {filterPendingOnly
                      ? "No hay partidos pendientes por pronosticar en esta fecha."
                      : "No hay partidos disponibles para mostrar."}
                  </p>
                  {filterPendingOnly && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setFilterPendingOnly(false)}
                      style={{ fontSize: "0.85rem" }}
                    >
                      Mostrar todos los partidos de la fecha
                    </button>
                  )}
                </div>
              ) : (
                displayedGroups.map((group) => (
                  <div key={group.title} style={{ marginBottom: "2rem" }}>
                <h3 style={{
                  background: "#1e293b",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  fontSize: "1rem",
                  color: "#94a3b8",
                  borderLeft: "4px solid #3b82f6",
                  marginBottom: "1rem",
                }}>
                  {group.title}
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
                  {group.items.map((m) => {
                    const draft = draftPreds[m.id_partido] || { home: "", away: "" };
                    const isSaving = savingMatchId === m.id_partido;
                    const isSuccess = saveSuccessMatchId === m.id_partido;
                    const hasMyPred = Boolean(m.mi_pronostico);
                    const isExpanded = expandedCommunityMatchId === m.id_partido;

                    let pillBadge = null;
                    if (m.isPlayed && m.mi_pronostico) {
                      const pts = m.mi_pronostico.puntos_obtenidos;
                      if (pts === 3) {
                        pillBadge = (
                          <span style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", color: "#34d399", padding: "0.2rem 0.5rem", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold" }}>
                            🎯 +3 pts ¡Exacto!
                          </span>
                        );
                      } else if (pts === 1) {
                        pillBadge = (
                          <span style={{ background: "rgba(59, 130, 246, 0.2)", border: "1px solid #3b82f6", color: "#60a5fa", padding: "0.2rem 0.5rem", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold" }}>
                            ⚽ +1 pt ¡Ganador!
                          </span>
                        );
                      } else if (pts === 0) {
                        pillBadge = (
                          <span style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#f87171", padding: "0.2rem 0.5rem", borderRadius: "12px", fontSize: "0.75rem" }}>
                            ❌ 0 pts
                          </span>
                        );
                      }
                    } else if (m.isPlayed && !m.mi_pronostico) {
                      pillBadge = (
                        <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Sin pronóstico</span>
                      );
                    } else if (!m.isPlayed && hasMyPred) {
                      pillBadge = (
                        <span style={{ background: "rgba(99, 102, 241, 0.2)", border: "1px solid #6366f1", color: "#a5b4fc", padding: "0.2rem 0.5rem", borderRadius: "12px", fontSize: "0.75rem" }}>
                          ✅ Pronosticado
                        </span>
                      );
                    }

                    return (
                      <div
                        key={m.id_partido}
                        style={{
                          background: "#0f172a",
                          border: m.isPlayed ? "1px solid #1e293b" : hasMyPred ? "1px solid #3b82f6" : "1px solid #334155",
                          borderRadius: "8px",
                          padding: "1rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                          position: "relative",
                        }}
                      >
                        {/* Match header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "#64748b" }}>
                          <span>Partido #{m.id_partido}</span>
                          <div>{pillBadge}</div>
                        </div>

                        {/* Teams & Players */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          {/* Local */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: "bold", color: "#f8fafc", fontSize: "0.95rem" }}>
                                {m.local_equipo || "Equipo Local"}
                              </span>
                              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                                {m.local_nombre || "Jugador"}
                              </span>
                            </div>
                            {m.isPlayed ? (
                              <span style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#f8fafc", minWidth: "30px", textAlign: "right" }}>
                                {m.goles_local}
                              </span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max="99"
                                disabled={!currentUser || isSaving || !isTournamentOpen}
                                value={draft.home}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handlePredictionChange(m.id_partido, "home", e.target.value)}
                                placeholder="-"
                                style={{
                                  width: "50px",
                                  height: "36px",
                                  textAlign: "center",
                                  background: "#1e293b",
                                  border: "1px solid #475569",
                                  borderRadius: "4px",
                                  color: "#f8fafc",
                                  fontSize: "1.1rem",
                                  fontWeight: "bold",
                                }}
                              />
                            )}
                          </div>

                          {/* Visitante */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: "bold", color: "#f8fafc", fontSize: "0.95rem" }}>
                                {m.visitante_equipo || "Equipo Visitante"}
                              </span>
                              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                                {m.visitante_nombre || "Jugador"}
                              </span>
                            </div>
                            {m.isPlayed ? (
                              <span style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#f8fafc", minWidth: "30px", textAlign: "right" }}>
                                {m.goles_visitante}
                              </span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max="99"
                                disabled={!currentUser || isSaving || !isTournamentOpen}
                                value={draft.away}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handlePredictionChange(m.id_partido, "away", e.target.value)}
                                placeholder="-"
                                style={{
                                  width: "50px",
                                  height: "36px",
                                  textAlign: "center",
                                  background: "#1e293b",
                                  border: "1px solid #475569",
                                  borderRadius: "4px",
                                  color: "#f8fafc",
                                  fontSize: "1.1rem",
                                  fontWeight: "bold",
                                }}
                              />
                            )}
                          </div>
                        </div>

                        {/* Penalties if any */}
                        {m.penales_local !== null && m.penales_visitante !== null && (
                          <div style={{ fontSize: "0.75rem", color: "#fbbf24", textAlign: "center" }}>
                            (Penales: {m.penales_local} - {m.penales_visitante})
                          </div>
                        )}

                        {/* Prediction action bar */}
                        {!m.isPlayed ? (
                          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                            {isSuccess && <span style={{ color: "#34d399", fontSize: "0.8rem" }}>¡Guardado!</span>}
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={isSaving || !isTournamentOpen}
                              onClick={() => handleSavePrediction(m.id_partido)}
                              style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
                            >
                              {isSaving ? "Guardando..." : hasMyPred ? "Actualizar" : "Pronosticar"}
                            </button>
                          </div>
                        ) : (
                          /* Played match: show user's prediction and community accordion */
                          <div style={{ borderTop: "1px solid #1e293b", paddingTop: "0.5rem", fontSize: "0.85rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ color: "#94a3b8" }}>
                                Tu pronóstico:{" "}
                                {m.mi_pronostico ? (
                                  <strong style={{ color: "#f8fafc" }}>
                                    {m.mi_pronostico.goles_local} - {m.mi_pronostico.goles_visitante}
                                  </strong>
                                ) : (
                                  <em style={{ color: "#64748b" }}>Ninguno</em>
                                )}
                              </span>

                              {m.pronosticos_comunidad.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedCommunityMatchId(isExpanded ? null : m.id_partido)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#60a5fa",
                                    fontSize: "0.8rem",
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  {isExpanded ? "Ocultar votos ▲" : `Ver comunidad (${m.pronosticos_comunidad.length}) ▼`}
                                </button>
                              )}
                            </div>

                            {/* Community predictions drawer */}
                            {isExpanded && m.pronosticos_comunidad.length > 0 && (
                              <div style={{ marginTop: "0.5rem", background: "#1e293b", borderRadius: "4px", padding: "0.5rem", maxHeight: "150px", overflowY: "auto" }}>
                                {m.pronosticos_comunidad.map((cp) => (
                                  <div
                                    key={cp.id_pronostico}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      fontSize: "0.75rem",
                                      padding: "0.2rem 0",
                                      borderBottom: "1px solid #334155",
                                    }}
                                  >
                                    <span style={{ color: cp.id_usuario === currentUser?.id ? "#60a5fa" : "#e2e8f0" }}>
                                      {cp.username}
                                    </span>
                                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                      <span>{cp.goles_local} - {cp.goles_visitante}</span>
                                      <span style={{ color: cp.puntos_obtenidos === 3 ? "#34d399" : cp.puntos_obtenidos === 1 ? "#60a5fa" : "#94a3b8", fontWeight: "bold" }}>
                                        +{cp.puntos_obtenidos ?? 0}p
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )))}
          </>
        )}
        </div>
      )}
    </div>
  );
};
export default ProdeView;
