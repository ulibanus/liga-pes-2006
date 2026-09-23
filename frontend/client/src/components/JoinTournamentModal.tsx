import { useState, useEffect } from "react";
import type { Team } from "../domain/types";
import { useAuth } from "../context/useAuth";
import { useTournament } from "../context/useTournament";
import {
  unirseTorneoCodigo,
  solicitarUnirseTorneo,
  fetchMiSolicitud,
  fetchEquipos,
} from "../services/api";

interface JoinTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoined?: () => void;
}

export function JoinTournamentModal({ isOpen, onClose, onJoined }: JoinTournamentModalProps) {
  const { token, isAuthenticated } = useAuth();
  const { activeTournament, refreshTournaments, setActiveTournamentId } = useTournament();

  const [mode, setMode] = useState<"codigo" | "solicitud">("codigo");
  const [codigo, setCodigo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<number | undefined>();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Status of user's request for active tournament
  const [miSolicitud, setMiSolicitud] = useState<{
    es_participante: boolean;
    solicitud: { estado: string } | null;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCodigo("");
      setMensaje("");
      setError(null);
      setSuccess(null);
      setSelectedTeamId(undefined);
      return;
    }

    if (token && activeTournament) {
      void fetchMiSolicitud(token, activeTournament.id)
        .then((res) => {
          setMiSolicitud({
            es_participante: res.es_participante,
            solicitud: res.solicitud ? { estado: res.solicitud.estado } : null,
          });
        })
        .catch(() => {
          // ignore
        });

      if (activeTournament.gameId) {
        void fetchEquipos(activeTournament.gameId)
          .then((eqs) => setTeams(eqs))
          .catch(() => setTeams([]));
      }
    }
  }, [isOpen, token, activeTournament]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!codigo.trim()) {
      setError("Por favor ingresá el código de invitación.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await unirseTorneoCodigo(token, codigo.trim(), selectedTeamId);
      setSuccess(res.message);
      await refreshTournaments();
      setActiveTournamentId(res.id_torneo);
      onJoined?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al unirse al torneo");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTournament) return;

    setError(null);
    setLoading(true);
    try {
      await solicitarUnirseTorneo(token, activeTournament.id, selectedTeamId, mensaje);
      setSuccess("¡Solicitud enviada con éxito! El organizador revisará tu ingreso.");
      setMiSolicitud((prev) => ({
        es_participante: prev?.es_participante ?? false,
        solicitud: { estado: "pendiente" },
      }));
      await refreshTournaments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar solicitud");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-tournament-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-box" style={{ maxWidth: "500px" }}>
        <div className="modal-header-row">
          <div className="modal-title-wrap">
            <h2 id="join-tournament-title">⚽ Unirme a un Torneo</h2>
            <p className="modal-sub">
              Ingresá mediante código de invitación o enviá una solicitud
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar ventana modal"
          >
            ✕
          </button>
        </div>

        {!isAuthenticated ? (
          <div className="state-container" style={{ padding: "24px 0", textAlign: "center" }}>
            <p style={{ color: "var(--text-dim)", marginBottom: "16px" }}>
              Debés iniciar sesión en tu cuenta para unirte a un torneo.
            </p>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <div>
            {/* Mode Switcher */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "20px",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "12px",
              }}
            >
              <button
                type="button"
                className={`btn btn-sm ${mode === "codigo" ? "btn-gold" : "btn-secondary"}`}
                onClick={() => {
                  setMode("codigo");
                  setError(null);
                  setSuccess(null);
                }}
              >
                🔑 Con Código de Invitación
              </button>
              {activeTournament && activeTournament.status === "borrador" && (
                <button
                  type="button"
                  className={`btn btn-sm ${mode === "solicitud" ? "btn-gold" : "btn-secondary"}`}
                  onClick={() => {
                    setMode("solicitud");
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  📨 Solicitar al Torneo Activo
                </button>
              )}
            </div>

            {error && (
              <div className="error-box" role="alert" style={{ width: "100%", marginBottom: "16px" }}>
                {error}
              </div>
            )}

            {success && (
              <div
                role="status"
                style={{
                  background: "rgba(34, 197, 94, 0.15)",
                  border: "1px solid var(--green-bright, #22c55e)",
                  color: "#86efac",
                  padding: "12px 14px",
                  borderRadius: "6px",
                  marginBottom: "16px",
                  fontSize: "0.9rem",
                }}
              >
                {success}
              </div>
            )}

            {mode === "codigo" ? (
              <form onSubmit={handleJoinByCode} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-field">
                  <label htmlFor="invite-code-input">
                    Código de Invitación <span className="required-star">*</span>
                  </label>
                  <input
                    id="invite-code-input"
                    type="text"
                    className="form-input"
                    placeholder="Ej: TRN-A8F1"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                    required
                    style={{ textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "2px" }}>
                    Pedile el código al organizador del torneo para ingresar de inmediato.
                  </span>
                </div>

                <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                  <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-gold" disabled={loading || !codigo.trim()}>
                    {loading ? "Uniendo..." : "Unirme al Torneo 🚀"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRequestJoin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ fontSize: "0.9rem", color: "var(--text-dim)" }}>
                  Torneo: <strong style={{ color: "var(--white)" }}>{activeTournament?.name}</strong> ({activeTournament?.game})
                </div>

                {miSolicitud?.es_participante ? (
                  <div style={{ padding: "16px", background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.25)", borderRadius: "8px", textAlign: "center", color: "#86efac" }}>
                    ✅ ¡Ya formás parte de este torneo!
                  </div>
                ) : miSolicitud?.solicitud?.estado === "pendiente" ? (
                  <div style={{ padding: "16px", background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.25)", borderRadius: "8px", textAlign: "center", color: "#fde047" }}>
                    ⏳ Ya tenés una solicitud pendiente para este torneo. El organizador la revisará en breve.
                  </div>
                ) : (
                  <>
                    {teams.length > 0 && (
                      <div className="form-field">
                        <label htmlFor="request-team-select">
                          Preferencia de Equipo (Opcional)
                        </label>
                        <select
                          id="request-team-select"
                          className="form-input"
                          style={{ width: "100%" }}
                          value={selectedTeamId ?? ""}
                          onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : undefined)}
                        >
                          <option value="">-- Sin preferencia (Asignación automática o sorteo) --</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="form-field">
                      <label htmlFor="request-message-input">
                        Mensaje para el Organizador (Opcional)
                      </label>
                      <textarea
                        id="request-message-input"
                        className="form-textarea"
                        rows={3}
                        placeholder="Ej: Hola! Me gustaría participar en la liga..."
                        value={mensaje}
                        onChange={(e) => setMensaje(e.target.value)}
                      />
                    </div>

                    <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                      <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Cancelar
                      </button>
                      <button type="submit" className="btn btn-gold" disabled={loading}>
                        {loading ? "Enviando..." : "Enviar Solicitud 📨"}
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
