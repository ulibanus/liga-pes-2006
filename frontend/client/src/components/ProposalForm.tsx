import { useState, useMemo } from "react";
import type { Player, Team, Match } from "../domain/types";
import {
  type ProposalFormState,
  type ProposalScorerItem,
  type ProposalRedCardItem,
  type ProposalValidationErrors,
  findPendingRoundsForPair,
  validateProposal,
  mapProposalInputToPayload,
} from "../domain/proposals";
import { getSuspensionsForPlayer } from "../domain/suspensions";
import { submitProposal, type ProposalDto } from "../services/api";
import { UserAvatar } from "./UserAvatar";

interface ProposalFormProps {
  players: Player[];
  teams: Team[];
  matches: Match[];
  format?: "ida" | "ida_vuelta";
  tournamentId?: number;
  onSuccess?: () => void;
  initialProposal?: ProposalDto;
  onSubmitOverride?: (payload: import("../domain/proposals").CreateProposalPayload) => Promise<ProposalDto>;
  onCancel?: () => void;
}

export function ProposalForm({
  players,
  teams,
  matches,
  format = "ida",
  tournamentId,
  onSuccess,
  initialProposal,
  onSubmitOverride,
  onCancel,
}: ProposalFormProps) {
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const initialPlayerA = initialProposal ? String(initialProposal.id_local) : players[0]?.id ?? "";
  const initialPlayerB = initialProposal ? String(initialProposal.id_visitante) : players[1]?.id ?? (players[0]?.id ?? "");

  const [formState, setFormState] = useState<ProposalFormState>({
    applicantName: initialProposal ? initialProposal.nombre_solicitante : "",
    playerAId: initialPlayerA,
    playerBId: initialPlayerB,
    goalsA: initialProposal ? initialProposal.goles_local : 0,
    goalsB: initialProposal ? initialProposal.goles_visitante : 0,
    roundNumber: initialProposal ? initialProposal.numero_fecha : null,
    scorers: initialProposal ? initialProposal.goleadores.map(g => ({
      id: crypto.randomUUID(),
      virtualPlayer: g.jugador,
      playerId: String(g.personaId),
      amount: g.cantidad,
    })) : [],
    redCards: initialProposal ? initialProposal.rojas.map(r => ({
      id: crypto.randomUUID(),
      virtualPlayer: r.jugador,
      playerId: String(r.personaId),
    })) : [],
  });

  const [validationErrors, setValidationErrors] = useState<ProposalValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedProposal, setSubmittedProposal] = useState<ProposalDto | null>(null);

  // Derived pending rounds based on current matchup and played matches
  const pendingRounds = useMemo(() => {
    if (formState.playerAId && formState.playerBId && formState.playerAId !== formState.playerBId) {
      return findPendingRoundsForPair(
        players,
        matches,
        formState.playerAId,
        formState.playerBId,
        format
      );
    }
    return [];
  }, [formState.playerAId, formState.playerBId, players, matches, format]);

  // Derive active round number: current selection if valid, otherwise first pending round
  const activeRoundNumber = useMemo(() => {
    if (formState.roundNumber !== null && pendingRounds.includes(formState.roundNumber)) {
      return formState.roundNumber;
    }
    return pendingRounds.length > 0 ? pendingRounds[0] : null;
  }, [formState.roundNumber, pendingRounds]);

  const activeSuspensions = useMemo(() => {
    if (!activeRoundNumber) return [];
    const suspA = formState.playerAId
      ? getSuspensionsForPlayer(matches, formState.playerAId, activeRoundNumber)
      : [];
    const suspB = formState.playerBId
      ? getSuspensionsForPlayer(matches, formState.playerBId, activeRoundNumber)
      : [];
    return [...suspA, ...suspB];
  }, [matches, formState.playerAId, formState.playerBId, activeRoundNumber]);

  const handlePlayerAChange = (newId: string) => {
    setFormState((prev) => {
      // Re-assign any scorer or red card assigned to old playerAId
      const scorers = prev.scorers.map((s) =>
        s.playerId === prev.playerAId ? { ...s, playerId: newId } : s
      );
      const redCards = prev.redCards.map((r) =>
        r.playerId === prev.playerAId ? { ...r, playerId: newId } : r
      );
      return { ...prev, playerAId: newId, scorers, redCards };
    });
    setValidationErrors({});
    setSubmitError(null);
  };

  const handlePlayerBChange = (newId: string) => {
    setFormState((prev) => {
      // Re-assign any scorer or red card assigned to old playerBId
      const scorers = prev.scorers.map((s) =>
        s.playerId === prev.playerBId ? { ...s, playerId: newId } : s
      );
      const redCards = prev.redCards.map((r) =>
        r.playerId === prev.playerBId ? { ...r, playerId: newId } : r
      );
      return { ...prev, playerBId: newId, scorers, redCards };
    });
    setValidationErrors({});
    setSubmitError(null);
  };

  const handleAddScorer = () => {
    const newScorer: ProposalScorerItem = {
      id: crypto.randomUUID(),
      virtualPlayer: "",
      playerId: formState.playerAId,
      amount: 1,
    };
    setFormState((prev) => ({
      ...prev,
      scorers: [...prev.scorers, newScorer],
    }));
  };

  const handleRemoveScorer = (id: string) => {
    setFormState((prev) => ({
      ...prev,
      scorers: prev.scorers.filter((s) => s.id !== id),
    }));
  };

  const handleUpdateScorer = (
    id: string,
    field: keyof ProposalScorerItem,
    value: string | number
  ) => {
    setFormState((prev) => ({
      ...prev,
      scorers: prev.scorers.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
  };

  const handleAddRedCard = () => {
    const newRedCard: ProposalRedCardItem = {
      id: crypto.randomUUID(),
      virtualPlayer: "",
      playerId: formState.playerAId,
    };
    setFormState((prev) => ({
      ...prev,
      redCards: [...prev.redCards, newRedCard],
    }));
  };

  const handleRemoveRedCard = (id: string) => {
    setFormState((prev) => ({
      ...prev,
      redCards: prev.redCards.filter((r) => r.id !== id),
    }));
  };

  const handleUpdateRedCard = (
    id: string,
    field: keyof ProposalRedCardItem,
    value: string
  ) => {
    setFormState((prev) => ({
      ...prev,
      redCards: prev.redCards.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const stateToSubmit: ProposalFormState = {
      ...formState,
      roundNumber: activeRoundNumber,
    };

    const validation = validateProposal(stateToSubmit, {
      availableRounds: pendingRounds,
      matches,
    });

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors({});
    setIsSubmitting(true);

    try {
      const payload = {
        ...mapProposalInputToPayload(stateToSubmit),
        id_torneo: tournamentId ?? null,
      };
      const result = onSubmitOverride 
        ? await onSubmitOverride(payload)
        : await submitProposal(payload);
      setSubmittedProposal(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al enviar la propuesta";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setFormState({
      applicantName: "",
      playerAId: initialPlayerA,
      playerBId: initialPlayerB,
      goalsA: 0,
      goalsB: 0,
      roundNumber: null,
      scorers: [],
      redCards: [],
    });
    setValidationErrors({});
    setSubmitError(null);
    setSubmittedProposal(null);
  };

  const playerAName = playerMap.get(formState.playerAId)?.name ?? "Participante 1";
  const playerBName = playerMap.get(formState.playerBId)?.name ?? "Participante 2";

  if (submittedProposal) {
    return (
      <div className="proposal-success-container">
        <div className="proposal-success-card">
          <div className="success-icon" aria-hidden="true">🎉</div>
          <h3>¡Propuesta enviada con éxito!</h3>
          <p className="success-message">
            Gracias <strong>{submittedProposal.nombre_solicitante}</strong>. El resultado quedó registrado en la cola de revisión comunitaria. Un administrador lo evaluará para consolidar las tablas oficiales.
          </p>

          <div className="proposal-summary-box">
            <div className="summary-row">
              <span className="summary-label">Partido:</span>
              <span className="summary-value">
                {playerAName} <strong>{submittedProposal.goles_local}</strong> -{" "}
                <strong>{submittedProposal.goles_visitante}</strong> {playerBName}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Fecha:</span>
              <span className="summary-value">
                {submittedProposal.numero_fecha ? `Fecha ${submittedProposal.numero_fecha}` : "Sin fecha asignada"}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Estado:</span>
              <span className="chip chip-bye">Pendiente de revisión</span>
            </div>
            {submittedProposal.goleadores.length > 0 && (
              <div className="summary-row">
                <span className="summary-label">Goleadores:</span>
                <span className="summary-value">
                  {submittedProposal.goleadores
                    .map((g) => `${g.jugador} (${g.cantidad})`)
                    .join(", ")}
                </span>
              </div>
            )}
            {submittedProposal.rojas.length > 0 && (
              <div className="summary-row">
                <span className="summary-label">Tarjetas rojas:</span>
                <span className="summary-value">
                  {submittedProposal.rojas.map((r) => r.jugador).join(", ")}
                </span>
              </div>
            )}
          </div>

          <div className="success-actions">
            <button
              type="button"
              className="btn btn-gold"
              onClick={handleResetForm}
            >
              Cargar otro resultado
            </button>
            {onSuccess && (
              <button
                type="button"
                className="btn"
                onClick={onSuccess}
              >
                Ver Posiciones
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="proposal-form-container">
      <div className="proposal-intro">
        <p className="subtitle-block">
          ¿Jugaste un partido? Cargá el resultado acá con sus goles, autores y tarjetas. Un administrador lo revisará antes de que impacte en las tablas oficiales.
        </p>
      </div>

      {submitError && (
        <div className="error-box" role="alert">
          <strong>Error al enviar:</strong> {submitError}
        </div>
      )}

      {validationErrors.general && (
        <div className="error-box" role="alert">
          {validationErrors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="proposal-form">
        {/* Solicitante */}
        <div className="form-field">
          <label htmlFor="applicantName">
            Tu nombre <span className="required-star">*</span>
          </label>
          <input
            id="applicantName"
            type="text"
            className={`form-input ${validationErrors.applicantName ? "input-error" : ""}`}
            placeholder="Para que el admin sepa quién cargó el resultado"
            value={formState.applicantName}
            onChange={(e) => {
              setFormState((prev) => ({ ...prev, applicantName: e.target.value }));
              if (validationErrors.applicantName) {
                setValidationErrors((prev) => ({ ...prev, applicantName: undefined }));
              }
            }}
            disabled={isSubmitting}
            required
          />
          {validationErrors.applicantName && (
            <span className="field-error-text">{validationErrors.applicantName}</span>
          )}
        </div>

        {/* Participantes */}
        <div className="form-grid-2">
          <div className="form-field">
            <label htmlFor="playerA" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {playerMap.get(formState.playerAId) && (
                <UserAvatar
                  name={playerMap.get(formState.playerAId)!.name}
                  avatarUrl={playerMap.get(formState.playerAId)!.avatarUrl}
                  isRegistered={playerMap.get(formState.playerAId)!.isRegistered}
                  size="xs"
                />
              )}
              <span>Participante 1 (Local) <span className="required-star">*</span></span>
            </label>
            <select
              id="playerA"
              className={`form-select ${validationErrors.players ? "input-error" : ""}`}
              value={formState.playerAId}
              onChange={(e) => handlePlayerAChange(e.target.value)}
              disabled={isSubmitting}
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({teamMap.get(p.teamId) || "Sin Equipo"})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="playerB" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {playerMap.get(formState.playerBId) && (
                <UserAvatar
                  name={playerMap.get(formState.playerBId)!.name}
                  avatarUrl={playerMap.get(formState.playerBId)!.avatarUrl}
                  isRegistered={playerMap.get(formState.playerBId)!.isRegistered}
                  size="xs"
                />
              )}
              <span>Participante 2 (Visitante) <span className="required-star">*</span></span>
            </label>
            <select
              id="playerB"
              className={`form-select ${validationErrors.players ? "input-error" : ""}`}
              value={formState.playerBId}
              onChange={(e) => handlePlayerBChange(e.target.value)}
              disabled={isSubmitting}
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({teamMap.get(p.teamId) || "Sin Equipo"})
                </option>
              ))}
            </select>
          </div>
        </div>
        {validationErrors.players && (
          <span className="field-error-text" style={{ display: "block", marginTop: "-12px", marginBottom: "16px" }}>
            {validationErrors.players}
          </span>
        )}

        {activeSuspensions.length > 0 && (
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "6px",
              marginBottom: "16px",
              fontSize: "0.85rem",
              color: "#f87171",
            }}
          >
            <strong>🟥 Jugadores suspendidos para esta fecha:</strong>
            <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
              {activeSuspensions.map((s, idx) => {
                const owner = playerMap.get(s.playerId);
                return (
                  <li key={idx}>
                    <strong>{s.virtualPlayer}</strong> ({owner ? owner.name : "Participante"}): no puede ser alineado por expulsión en la fecha {s.redCardRound}.
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Fecha / Fixture */}
        <div className="form-field">
          <label htmlFor="roundNumber">
            Fecha del fixture <span className="required-star">*</span>
          </label>
          {pendingRounds.length === 0 ? (
            <div className="no-pending-warning">
              ⚠️ No se encontraron cruces pendientes en el fixture entre {playerAName} y {playerBName}.
            </div>
          ) : (
            <select
              id="roundNumber"
              className={`form-select ${validationErrors.roundNumber ? "input-error" : ""}`}
              value={activeRoundNumber ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setFormState((prev) => ({ ...prev, roundNumber: val }));
                if (validationErrors.roundNumber) {
                  setValidationErrors((prev) => ({ ...prev, roundNumber: undefined }));
                }
              }}
              disabled={isSubmitting}
            >
              {pendingRounds.map((r) => (
                <option key={r} value={r}>
                  Fecha {r} (Pendiente)
                </option>
              ))}
            </select>
          )}
          {validationErrors.roundNumber && (
            <span className="field-error-text">{validationErrors.roundNumber}</span>
          )}
        </div>

        {/* Marcador */}
        <div className="form-grid-2">
          <div className="form-field">
            <label htmlFor="goalsA">
              Goles de {playerAName} <span className="required-star">*</span>
            </label>
            <input
              id="goalsA"
              type="number"
              min="0"
              className={`form-input ${validationErrors.goalsA ? "input-error" : ""}`}
              value={formState.goalsA}
              onChange={(e) => {
                const raw = e.target.value;
                const val = raw === "" ? "" : parseInt(raw, 10);
                setFormState((prev) => ({
                  ...prev,
                  goalsA: Number.isNaN(val) ? "" : val,
                }));
                if (validationErrors.goalsA || validationErrors.scorers) {
                  setValidationErrors((prev) => ({ ...prev, goalsA: undefined, scorers: undefined }));
                }
              }}
              onFocus={(e) => e.target.select()}
              disabled={isSubmitting}
              required
            />
            {validationErrors.goalsA && (
              <span className="field-error-text">{validationErrors.goalsA}</span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="goalsB">
              Goles de {playerBName} <span className="required-star">*</span>
            </label>
            <input
              id="goalsB"
              type="number"
              min="0"
              className={`form-input ${validationErrors.goalsB ? "input-error" : ""}`}
              value={formState.goalsB}
              onChange={(e) => {
                const raw = e.target.value;
                const val = raw === "" ? "" : parseInt(raw, 10);
                setFormState((prev) => ({
                  ...prev,
                  goalsB: Number.isNaN(val) ? "" : val,
                }));
                if (validationErrors.goalsB || validationErrors.scorers) {
                  setValidationErrors((prev) => ({ ...prev, goalsB: undefined, scorers: undefined }));
                }
              }}
              onFocus={(e) => e.target.select()}
              disabled={isSubmitting}
              required
            />
            {validationErrors.goalsB && (
              <span className="field-error-text">{validationErrors.goalsB}</span>
            )}
          </div>
        </div>

        {/* Sección Goleadores */}
        <div className="form-section">
          <div className="section-header-compact">
            <h3>Goleadores del partido</h3>
            <span className="section-subtitle">
              (Opcional: detallá los jugadores virtuales de PES que anotaron)
            </span>
          </div>

          {validationErrors.scorers && (
            <div className="field-error-box" role="alert">
              ⚠️ {validationErrors.scorers}
            </div>
          )}

          <div className="subrows-container">
            {formState.scorers.map((scorer) => (
              <div key={scorer.id} className="subrow">
                <div className="subrow-field flex-2">
                  <label>Jugador Virtual</label>
                  <input
                    type="text"
                    className="form-input form-input-sm"
                    placeholder="Ej: Adriano"
                    value={scorer.virtualPlayer}
                    onChange={(e) =>
                      handleUpdateScorer(scorer.id, "virtualPlayer", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
                </div>

                <div className="subrow-field flex-2">
                  <label>Anotó para</label>
                  <select
                    className="form-select form-select-sm"
                    value={scorer.playerId}
                    onChange={(e) =>
                      handleUpdateScorer(scorer.id, "playerId", e.target.value)
                    }
                    disabled={isSubmitting}
                  >
                    <option value={formState.playerAId}>{playerAName}</option>
                    <option value={formState.playerBId}>{playerBName}</option>
                  </select>
                </div>

                <div className="subrow-field flex-1">
                  <label>Cant.</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input form-input-sm"
                    value={scorer.amount}
                    onChange={(e) =>
                      handleUpdateScorer(
                        scorer.id,
                        "amount",
                        Math.max(1, parseInt(e.target.value || "1", 10))
                      )
                    }
                    disabled={isSubmitting}
                  />
                </div>

                <button
                  type="button"
                  className="btn-remove-subrow"
                  onClick={() => handleRemoveScorer(scorer.id)}
                  title="Eliminar fila"
                  disabled={isSubmitting}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleAddScorer}
            disabled={isSubmitting}
          >
            + Agregar Goleador
          </button>
        </div>

        {/* Sección Tarjetas Rojas */}
        <div className="form-section">
          <div className="section-header-compact">
            <h3>Tarjetas rojas del partido</h3>
            <span className="section-subtitle">
              (Opcional: registrá los expulsados que cumplirán suspensión)
            </span>
          </div>

          {validationErrors.redCards && (
            <div className="field-error-box" role="alert">
              ⚠️ {validationErrors.redCards}
            </div>
          )}

          <div className="subrows-container">
            {formState.redCards.map((rc) => (
              <div key={rc.id} className="subrow">
                <div className="subrow-field flex-3">
                  <label>Jugador Virtual</label>
                  <input
                    type="text"
                    className="form-input form-input-sm"
                    placeholder="Ej: Zidane"
                    value={rc.virtualPlayer}
                    onChange={(e) =>
                      handleUpdateRedCard(rc.id, "virtualPlayer", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
                </div>

                <div className="subrow-field flex-3">
                  <label>Expulsado de</label>
                  <select
                    className="form-select form-select-sm"
                    value={rc.playerId}
                    onChange={(e) =>
                      handleUpdateRedCard(rc.id, "playerId", e.target.value)
                    }
                    disabled={isSubmitting}
                  >
                    <option value={formState.playerAId}>{playerAName}</option>
                    <option value={formState.playerBId}>{playerBName}</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn-remove-subrow"
                  onClick={() => handleRemoveRedCard(rc.id)}
                  title="Eliminar fila"
                  disabled={isSubmitting}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleAddRedCard}
            disabled={isSubmitting}
          >
            + Agregar Tarjeta Roja
          </button>
        </div>

        {/* Botón de Envío */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-gold btn-lg"
            disabled={isSubmitting || pendingRounds.length === 0}
          >
            {isSubmitting ? "Enviando..." : initialProposal ? "💾 Guardar Cambios" : "📨 Enviar para revisión"}
          </button>
          {onCancel && (
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={onCancel}
              disabled={isSubmitting}
              style={{ marginLeft: "12px" }}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
