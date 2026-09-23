import { useState, useEffect, useMemo, useCallback } from "react";
import type { Player, Team } from "../domain/types";
import {
  fetchPropuestas,
  aprobarPropuesta,
  rechazarPropuesta,
  editarPropuesta,
  fetchTorneoSolicitudes,
  aprobarTorneoSolicitud,
  rechazarTorneoSolicitud,
  quitarParticipanteTorneo,
  bloquearUsuarioTorneo,
  desbloquearUsuarioTorneo,
  fetchTorneoBloqueados,
  fetchTorneo,
  type ProposalDto,
  type TorneoSolicitudDto,
  type TorneoBloqueadoDto,
  type TorneoDetailDto,
} from "../services/api";
import { useAuth } from "../context/useAuth";
import { useTournament } from "../context/useTournament";
import { UserAvatar } from "./UserAvatar";
import { ProposalForm } from "./ProposalForm";
import type { CreateProposalPayload } from "../domain/proposals";

interface AdminModerationPanelProps {
  players: Player[];
  teams: Team[];
  tournamentId?: number;
  onMatchApproved?: () => void;
}

export function AdminModerationPanel({
  players,
  teams,
  tournamentId,
  onMatchApproved,
}: AdminModerationPanelProps) {
  const { token, logout } = useAuth();
  const { activeTournament, refreshTournaments } = useTournament();
  const [activeTab, setActiveTab] = useState<"propuestas" | "solicitudes" | "participantes">("propuestas");
  const [propuestas, setPropuestas] = useState<ProposalDto[]>([]);
  const [solicitudes, setSolicitudes] = useState<TorneoSolicitudDto[]>([]);
  const [bloqueados, setBloqueados] = useState<TorneoBloqueadoDto[]>([]);
  const [participantes, setParticipantes] = useState<TorneoDetailDto["participantes"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"aprobar" | "rechazar" | null>(null);
  const [editingPropuestaId, setEditingPropuestaId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);

  const loadData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [propsList, solsList, blockedList, detail] = await Promise.all([
        fetchPropuestas(token, "pendiente", tournamentId),
        tournamentId ? fetchTorneoSolicitudes(token, tournamentId).catch(() => [] as TorneoSolicitudDto[]) : Promise.resolve([] as TorneoSolicitudDto[]),
        tournamentId ? fetchTorneoBloqueados(token, tournamentId).catch(() => [] as TorneoBloqueadoDto[]) : Promise.resolve([] as TorneoBloqueadoDto[]),
        tournamentId ? fetchTorneo(tournamentId).catch(() => null) : Promise.resolve(null),
      ]);
      setPropuestas(propsList);
      setSolicitudes(solsList.filter((s: TorneoSolicitudDto) => s.estado === "pendiente"));
      setBloqueados(blockedList);
      if (detail) {
        setParticipantes(detail.participantes);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar datos de moderación";
      if (message.includes("401") || message.toLowerCase().includes("expirada")) {
        logout();
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [token, logout, tournamentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const handleManualRefresh = async () => {
    setLoading(true);
    await loadData();
  };

  const handleAprobar = async (propuesta: ProposalDto) => {
    if (!token) return;
    setActionId(propuesta.id_propuesta);
    setActionType("aprobar");
    setFeedback(null);

    try {
      await aprobarPropuesta(token, propuesta.id_propuesta);
      setPropuestas((prev) => prev.filter((p) => p.id_propuesta !== propuesta.id_propuesta));
      setFeedback({
        type: "success",
        text: `¡Propuesta #${propuesta.id_propuesta} aprobada! El partido y sus incidencias se consolidaron en las tablas.`,
      });
      onMatchApproved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al aprobar la propuesta";
      setFeedback({ type: "error", text: message });
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const handleEditSubmit = async (propuestaId: number, payload: CreateProposalPayload) => {
    if (!token) throw new Error("No token");
    const updated = await editarPropuesta(token, propuestaId, payload);
    setPropuestas((prev) => prev.map((p) => p.id_propuesta === propuestaId ? updated : p));
    setEditingPropuestaId(null);
    setFeedback({
      type: "success",
      text: `Propuesta #${propuestaId} actualizada con éxito.`
    });
    return updated;
  };

  const handleRechazar = async (propuesta: ProposalDto) => {
    if (!token) return;
    const confirmMsg = `¿Estás seguro de rechazar la propuesta #${propuesta.id_propuesta}? No se sumará a las tablas.`;
    if (!window.confirm(confirmMsg)) return;

    setActionId(propuesta.id_propuesta);
    setActionType("rechazar");
    setFeedback(null);

    try {
      await rechazarPropuesta(token, propuesta.id_propuesta);
      setPropuestas((prev) => prev.filter((p) => p.id_propuesta !== propuesta.id_propuesta));
      setFeedback({
        type: "success",
        text: `Propuesta #${propuesta.id_propuesta} rechazada.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al rechazar la propuesta";
      setFeedback({ type: "error", text: message });
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const handleAprobarSolicitud = async (sol: TorneoSolicitudDto, id_equipo?: number) => {
    if (!token || !tournamentId) return;
    setActionId(sol.id_solicitud);
    setActionType("aprobar");
    setFeedback(null);

    try {
      await aprobarTorneoSolicitud(token, tournamentId, sol.id_solicitud, id_equipo);
      setSolicitudes((prev) => prev.filter((s) => s.id_solicitud !== sol.id_solicitud));
      setFeedback({
        type: "success",
        text: `¡Solicitud de @${sol.username} aprobada! Se incorporó al torneo exitosamente.`,
      });
      onMatchApproved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al aprobar la solicitud";
      setFeedback({ type: "error", text: message });
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const handleRechazarSolicitud = async (sol: TorneoSolicitudDto) => {
    if (!token || !tournamentId) return;
    if (!window.confirm(`¿Estás seguro de rechazar la solicitud de @${sol.username}?`)) return;

    setActionId(sol.id_solicitud);
    setActionType("rechazar");
    setFeedback(null);

    try {
      await rechazarTorneoSolicitud(token, tournamentId, sol.id_solicitud);
      setSolicitudes((prev) => prev.filter((s) => s.id_solicitud !== sol.id_solicitud));
      setFeedback({
        type: "success",
        text: `Solicitud de @${sol.username} rechazada.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al rechazar la solicitud";
      setFeedback({ type: "error", text: message });
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const handleQuitarParticipante = async (p: TorneoDetailDto["participantes"][0]) => {
    if (!token || !tournamentId) return;
    if (!window.confirm(`¿Estás seguro de expulsar a ${p.persona_nombre} del torneo?`)) return;

    setActionId(p.id_persona);
    setActionType("rechazar");
    try {
      await quitarParticipanteTorneo(token, tournamentId, p.id_persona);
      setParticipantes((prev) => prev.filter((item) => item.id_persona !== p.id_persona));
      setFeedback({
        type: "success",
        text: `Participante ${p.persona_nombre} expulsado del torneo.`,
      });
      await refreshTournaments();
      onMatchApproved?.();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Error al quitar participante" });
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const handleBloquearUsuario = async (userId: number, username: string) => {
    if (!token || !tournamentId) return;
    const motivo = window.prompt(`Ingresá el motivo del bloqueo para @${username} (opcional):`);
    if (motivo === null) return;

    setActionId(userId);
    setActionType("rechazar");
    try {
      await bloquearUsuarioTorneo(token, tournamentId, userId, motivo || undefined);
      setFeedback({
        type: "success",
        text: `Usuario @${username} bloqueado del torneo.`,
      });
      await loadData();
      await refreshTournaments();
      onMatchApproved?.();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Error al bloquear usuario" });
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const handleDesbloquearUsuario = async (userId: number, username: string) => {
    if (!token || !tournamentId) return;
    setActionId(userId);
    setActionType("aprobar");
    try {
      await desbloquearUsuarioTorneo(token, tournamentId, userId);
      setBloqueados((prev) => prev.filter((b) => b.id_usuario !== userId));
      setFeedback({
        type: "success",
        text: `Usuario @${username} desbloqueado exitosamente.`,
      });
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Error al desbloquear usuario" });
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  return (
    <div className="moderation-panel">
      {tournamentId && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "propuestas" ? "btn-gold" : "btn-secondary"}`}
            onClick={() => setActiveTab("propuestas")}
          >
            📋 Propuestas ({propuestas.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "solicitudes" ? "btn-gold" : "btn-secondary"}`}
            onClick={() => setActiveTab("solicitudes")}
          >
            📨 Solicitudes ({solicitudes.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "participantes" ? "btn-gold" : "btn-secondary"}`}
            onClick={() => setActiveTab("participantes")}
          >
            👥 Participantes y Bloqueos ({participantes.length})
          </button>
        </div>
      )}

      <div className="panel-toolbar">
        <div className="toolbar-info">
          <h3>
            {activeTab === "propuestas"
              ? "Bandeja de Propuestas Comunitarias"
              : activeTab === "solicitudes"
              ? "Solicitudes de Participación"
              : "Gestión de Participantes y Lista de Bloqueados"}
          </h3>
          <span className="count-badge">
            {activeTab === "propuestas"
              ? `${propuestas.length} pendientes`
              : activeTab === "solicitudes"
              ? `${solicitudes.length} pendientes`
              : `${participantes.length} activos / ${bloqueados.length} bloqueados`}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void handleManualRefresh()}
          disabled={loading}
        >
          {loading ? "Actualizando..." : "🔄 Refrescar"}
        </button>
      </div>

      {feedback && (
        <div
          className={feedback.type === "success" ? "success-feedback-box" : "error-box"}
          role="alert"
          style={{ width: "100%", marginBottom: "16px" }}
        >
          {feedback.text}
        </div>
      )}

      {error && (
        <div className="error-box" role="alert" style={{ width: "100%", marginBottom: "16px" }}>
          <strong>Error de conexión:</strong> {error}
          <div style={{ marginTop: "8px" }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void handleManualRefresh()}
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {activeTab === "participantes" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Participantes Activos */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h4 style={{ margin: 0 }}>Participantes Inscritos ({participantes.length})</h4>
              {activeTournament?.status !== "borrador" && (
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  (El torneo ya inició: la lista no puede modificarse)
                </span>
              )}
            </div>

            {participantes.length === 0 ? (
              <div className="empty-state" style={{ padding: "20px" }}>
                <p>No hay participantes inscritos todavía.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
                {participantes.map((p) => {
                  const isProcessing = actionId === p.id_persona;
                  return (
                    <div
                      key={p.id_persona}
                      className="proposal-card"
                      style={{ padding: "12px 14px", margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <UserAvatar
                            name={p.persona_nombre}
                            avatarUrl={p.usuario_avatar_url}
                            isRegistered={Boolean(p.id_usuario)}
                            size="sm"
                          />
                          <div>
                            <strong style={{ fontSize: "0.95rem" }}>{p.persona_nombre}</strong>
                            {p.usuario_username && (
                              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginLeft: "6px" }}>
                                (@{p.usuario_username})
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="team-pill" style={{ fontSize: "0.75rem" }}>
                          {p.equipo_nombre}
                        </span>
                      </div>

                      {activeTournament?.status === "borrador" && (
                        <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                            onClick={() => void handleQuitarParticipante(p)}
                            disabled={isProcessing}
                            title="Quitar participante del torneo"
                          >
                            🚫 Expulsar
                          </button>
                          {p.id_usuario && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                              onClick={() => void handleBloquearUsuario(p.id_usuario!, p.usuario_username || p.persona_nombre)}
                              disabled={isProcessing}
                              title="Bloquear usuario e impedir que vuelva a entrar"
                            >
                              ⛔ Bloquear
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Usuarios Bloqueados */}
          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "18px" }}>
            <h4 style={{ margin: "0 0 12px 0", color: "#fca5a5" }}>
              ⛔ Usuarios Bloqueados ({bloqueados.length})
            </h4>

            {bloqueados.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                No hay usuarios bloqueados en este torneo.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {bloqueados.map((b) => {
                  const isProcessing = actionId === b.id_usuario;
                  return (
                    <div
                      key={b.id_usuario}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "rgba(239, 68, 68, 0.08)",
                        border: "1px solid rgba(239, 68, 68, 0.25)",
                        borderRadius: "6px",
                        padding: "10px 14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <UserAvatar
                          name={b.username}
                          avatarUrl={b.avatar_url}
                          isRegistered={true}
                          size="sm"
                        />
                        <div>
                          <strong>@{b.username}</strong>
                          {b.motivo && (
                            <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginLeft: "10px" }}>
                              Motivo: {b.motivo}
                            </span>
                          )}
                          <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", display: "block", marginTop: "2px" }}>
                            Bloqueado el: {b.bloqueado_en ? b.bloqueado_en.slice(0, 10) : "reciente"}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-gold btn-sm"
                        style={{ fontSize: "0.8rem" }}
                        onClick={() => void handleDesbloquearUsuario(b.id_usuario, b.username)}
                        disabled={isProcessing}
                      >
                        ✓ Desbloquear
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "solicitudes" ? (
        loading && solicitudes.length === 0 ? (
          <div className="state-container">
            <div className="spinner" />
            <p>Cargando solicitudes de ingreso...</p>
          </div>
        ) : solicitudes.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>👥</div>
            <h3>No hay solicitudes de ingreso pendientes</h3>
            <p>Compartí el código de invitación del torneo para que nuevos jugadores se unan.</p>
          </div>
        ) : (
          <div className="proposals-list">
            {solicitudes.map((s) => {
              const isProcessingThis = actionId === s.id_solicitud;
              return (
                <div key={s.id_solicitud} className="proposal-card">
                  <div className="proposal-card-header">
                    <div className="proposal-matchup" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <UserAvatar
                        name={s.username}
                        avatarUrl={s.avatar_url}
                        isRegistered={true}
                        size="sm"
                      />
                      <span className="player-title">
                        @{s.username}
                      </span>
                    </div>
                    {s.equipo_nombre && (
                      <span className="team-pill" style={{ fontSize: "0.85rem" }}>
                        Preferencia: <strong>{s.equipo_nombre}</strong>
                      </span>
                    )}
                  </div>

                  {s.mensaje && (
                    <div style={{ margin: "10px 0", fontStyle: "italic", color: "var(--text-dim)", fontSize: "0.85rem" }}>
                      "{s.mensaje}"
                    </div>
                  )}

                  <div className="proposal-meta-row">
                    <span className="meta-item meta-dim">
                      🕒 Solicitado: {s.creado_en ? s.creado_en.replace("T", " ").slice(0, 16) : "reciente"}
                    </span>
                  </div>

                  <div className="proposal-actions-row">
                    <button
                      type="button"
                      className="btn btn-gold btn-sm"
                      onClick={() => void handleAprobarSolicitud(s, s.id_equipo ?? undefined)}
                      disabled={isProcessingThis}
                    >
                      {isProcessingThis && actionType === "aprobar" ? "Incorporando..." : "✓ Aceptar e Incorporar"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => void handleRechazarSolicitud(s)}
                      disabled={isProcessingThis}
                    >
                      {isProcessingThis && actionType === "rechazar" ? "Rechazando..." : "✕ Rechazar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : loading && propuestas.length === 0 ? (
        <div className="state-container">
          <div className="spinner" />
          <p>Cargando propuestas pendientes...</p>
        </div>
      ) : propuestas.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>✅</div>
          <h3>No hay propuestas pendientes</h3>
          <p>Todas las solicitudes de partidos fueron revisadas y moderadas.</p>
        </div>
      ) : (
        <div className="proposals-list">
          {propuestas.map((p) => {
            const playerA = playerMap.get(String(p.id_local));
            const playerB = playerMap.get(String(p.id_visitante));
            const nameA = playerA?.name || `Participante #${p.id_local}`;
            const nameB = playerB?.name || `Participante #${p.id_visitante}`;
            const teamA = playerA ? teamMap.get(playerA.teamId) || "Sin Equipo" : "";
            const teamB = playerB ? teamMap.get(playerB.teamId) || "Sin Equipo" : "";

            const isProcessingThis = actionId === p.id_propuesta;

            return (
              <div key={p.id_propuesta} className="proposal-card">
                {editingPropuestaId === p.id_propuesta ? (
                  <div style={{ padding: "12px", background: "var(--bg-secondary)", borderRadius: "8px" }}>
                    <h4 style={{ marginBottom: "16px", marginTop: 0 }}>Editando Propuesta #{p.id_propuesta}</h4>
                    <ProposalForm
                      players={players}
                      teams={teams}
                      matches={[]}
                      tournamentId={tournamentId}
                      initialProposal={p}
                      onSubmitOverride={(payload) => handleEditSubmit(p.id_propuesta, payload)}
                      onCancel={() => setEditingPropuestaId(null)}
                    />
                  </div>
                ) : (
                  <>
                <div className="proposal-card-header">
                  <div className="proposal-matchup" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <UserAvatar
                        name={nameA}
                        avatarUrl={playerA?.avatarUrl}
                        isRegistered={playerA?.isRegistered}
                        size="xs"
                      />
                      <span className="player-title">
                        {nameA} <span className="team-pill">({teamA})</span>
                      </span>
                    </div>
                    <span className="vs-tag">vs</span>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <UserAvatar
                        name={nameB}
                        avatarUrl={playerB?.avatarUrl}
                        isRegistered={playerB?.isRegistered}
                        size="xs"
                      />
                      <span className="player-title">
                        {nameB} <span className="team-pill">({teamB})</span>
                      </span>
                    </div>
                  </div>

                  <div className="proposal-score-box">
                    <span>{p.goles_local}</span>
                    <span className="score-sep">-</span>
                    <span>{p.goles_visitante}</span>
                  </div>
                </div>

                <div className="proposal-meta-row">
                  <span className="meta-item">
                    📅 {p.numero_fecha ? `Fecha ${p.numero_fecha}` : "Fecha libre"}
                  </span>
                  <span className="meta-item">
                    👤 Enviado por: <strong>{p.nombre_solicitante || "Anónimo"}</strong>
                  </span>
                  {p.creado_en && (
                    <span className="meta-item meta-dim">
                      🕒 {p.creado_en.replace("T", " ").slice(0, 16)}
                    </span>
                  )}
                </div>

                {/* Incidencias cargadas */}
                {(p.goleadores.length > 0 || p.rojas.length > 0) && (
                  <div className="proposal-incidents-box">
                    {p.goleadores.length > 0 && (
                      <div className="incident-line">
                        <span className="incident-label">Goles:</span>
                        <span className="incident-tags">
                          {p.goleadores.map((g, i) => {
                            const scorerPlayer = playerMap.get(String(g.personaId))?.name || "";
                            return (
                              <span key={i} className="incident-pill">
                                ⚽ {g.jugador} ({scorerPlayer}) x{g.cantidad}
                              </span>
                            );
                          })}
                        </span>
                      </div>
                    )}

                    {p.rojas.length > 0 && (
                      <div className="incident-line">
                        <span className="incident-label">Rojas:</span>
                        <span className="incident-tags">
                          {p.rojas.map((r, i) => {
                            const cardPlayer = playerMap.get(String(r.personaId))?.name || "";
                            return (
                              <span key={i} className="incident-pill pill-red">
                                🟥 {r.jugador} ({cardPlayer})
                              </span>
                            );
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Acciones de Moderador */}
                <div className="proposal-actions-row">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditingPropuestaId(p.id_propuesta)}
                    disabled={isProcessingThis || editingPropuestaId === p.id_propuesta}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-gold btn-sm"
                    onClick={() => void handleAprobar(p)}
                    disabled={isProcessingThis}
                  >
                    {isProcessingThis && actionType === "aprobar"
                      ? "Aprobando..."
                      : "✓ Aprobar y Sumar"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => void handleRechazar(p)}
                    disabled={isProcessingThis}
                  >
                    {isProcessingThis && actionType === "rechazar"
                      ? "Rechazando..."
                      : "✕ Rechazar"}
                  </button>
                </div>
                </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
