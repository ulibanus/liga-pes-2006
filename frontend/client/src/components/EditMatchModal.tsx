import { useState, useEffect, useMemo } from "react";
import type { Player, Team, FixtureMatch } from "../domain/types";
import { updatePartido, fetchPlantelEquipo } from "../services/api";

interface EditMatchModalProps {
  match: FixtureMatch;
  roundNumber: number;
  tournamentId?: number;
  token: string;
  players?: Player[];
  teams?: Team[];
  onClose: () => void;
  onSuccess: () => void;
}

export function EditMatchModal({
  match,
  roundNumber,
  tournamentId,
  token,
  players = [],
  onClose,
  onSuccess,
}: EditMatchModalProps) {
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [rostersByTeam, setRostersByTeam] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const playerA = match.playerAId ? playerMap.get(match.playerAId) : null;
    const playerB = match.playerBId ? playerMap.get(match.playerBId) : null;

    const teamIdsToLoad = [playerA?.teamId, playerB?.teamId].filter(
      (id): id is string => typeof id === "string" && !rostersByTeam[id]
    );

    for (const tId of teamIdsToLoad) {
      void fetchPlantelEquipo(tId).then((roster) => {
        if (roster.length > 0) {
          setRostersByTeam((prev) => ({ ...prev, [tId]: roster }));
        }
      });
    }
  }, [match.playerAId, match.playerBId, playerMap, rostersByTeam]);

  const getRosterForPlayer = (playerId: string): string[] => {
    const p = playerMap.get(playerId);
    return (p?.teamId && rostersByTeam[p.teamId]) || [];
  };

  const [goalsA, setGoalsA] = useState<number>(match.goalsA ?? 0);
  const [goalsB, setGoalsB] = useState<number>(match.goalsB ?? 0);

  // Scorer list state
  const [scorers, setScorers] = useState<
    Array<{ id: string; virtualPlayer: string; playerId: string; amount: number }>
  >(
    match.scorers && match.scorers.length > 0
      ? match.scorers.map((s) => ({
          id: crypto.randomUUID(),
          virtualPlayer: s.scorerName,
          playerId: s.playerId,
          amount: s.amount,
        }))
      : []
  );

  // Red cards state
  const [redCards, setRedCards] = useState<
    Array<{ id: string; virtualPlayer: string; playerId: string }>
  >(
    match.redCards && match.redCards.length > 0
      ? match.redCards.map((r) => ({
          id: crypto.randomUUID(),
          virtualPlayer: r.playerName,
          playerId: r.playerId,
        }))
      : []
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddScorer = () => {
    setScorers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        virtualPlayer: "",
        playerId: match.playerAId || "",
        amount: 1,
      },
    ]);
  };

  const handleRemoveScorer = (id: string) => {
    setScorers((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddRedCard = () => {
    setRedCards((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        virtualPlayer: "",
        playerId: match.playerAId || "",
      },
    ]);
  };

  const handleRemoveRedCard = (id: string) => {
    setRedCards((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match.matchId) {
      setError("No se encontró el identificador del partido en la base de datos.");
      return;
    }

    if (goalsA < 0 || goalsB < 0) {
      setError("Los goles deben ser mayores o iguales a 0.");
      return;
    }

    // Coherencia de goles
    const sumA = scorers
      .filter((s) => s.playerId === match.playerAId)
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const sumB = scorers
      .filter((s) => s.playerId === match.playerBId)
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    if (scorers.length > 0) {
      if (sumA !== goalsA) {
        setError(`Los goles de los autores de ${match.playerAName} (${sumA}) no coinciden con el resultado (${goalsA}).`);
        return;
      }
      if (sumB !== goalsB) {
        setError(`Los goles de los autores de ${match.playerBName} (${sumB}) no coinciden con el resultado (${goalsB}).`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updatePartido(token, match.matchId, {
        goles_local: goalsA,
        goles_visitante: goalsB,
        numero_fecha: roundNumber,
        estado: "jugado",
        id_local: Number(match.playerAId),
        id_visitante: Number(match.playerBId),
        id_torneo: tournamentId ?? null,
        goleadores: scorers.map((s) => ({
          jugador: s.virtualPlayer.trim(),
          personaId: Number(s.playerId),
          cantidad: Number(s.amount),
        })),
        rojas: redCards.map((r) => ({
          jugador: r.virtualPlayer.trim(),
          personaId: Number(r.playerId),
        })),
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el partido");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-box" style={{ maxWidth: "600px", width: "95%" }}>
        <div className="modal-header-row">
          <div className="modal-title-wrap">
            <h2>✏️ Editar Partido (Fecha {roundNumber})</h2>
            <p className="modal-sub">
              Modificá el resultado, los autores de los goles y las tarjetas rojas de este encuentro
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} style={{ marginTop: "16px" }}>
          {error && (
            <div className="error-box" style={{ marginBottom: "16px" }}>
              {error}
            </div>
          )}

          {/* Marcador */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: "12px",
              padding: "16px",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <strong>{match.playerAName}</strong>
              <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                {match.teamAName}
              </div>
              <input
                type="number"
                min="0"
                className="form-input"
                style={{ textAlign: "center", fontSize: "1.4rem", width: "80px", margin: "8px auto 0" }}
                value={goalsA}
                onChange={(e) => setGoalsA(Math.max(0, parseInt(e.target.value, 10) || 0))}
                required
              />
            </div>

            <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "var(--gold-primary)" }}>
              VS
            </div>

            <div style={{ textAlign: "center" }}>
              <strong>{match.playerBName}</strong>
              <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                {match.teamBName}
              </div>
              <input
                type="number"
                min="0"
                className="form-input"
                style={{ textAlign: "center", fontSize: "1.4rem", width: "80px", margin: "8px auto 0" }}
                value={goalsB}
                onChange={(e) => setGoalsB(Math.max(0, parseInt(e.target.value, 10) || 0))}
                required
              />
            </div>
          </div>

          {/* Goleadores */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontWeight: 600 }}>⚽ Goleadores</label>
              <button type="button" className="btn btn-sm" onClick={handleAddScorer}>
                + Agregar Goleador
              </button>
            </div>

            {scorers.map((s, idx) => {
              const roster = getRosterForPlayer(s.playerId);
              const datalistId = `edit-scorer-roster-${s.id}-${idx}`;
              return (
                <div key={s.id} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  <select
                    className="form-select"
                    style={{ width: "150px" }}
                    value={s.playerId}
                    onChange={(e) =>
                      setScorers((prev) =>
                        prev.map((item) => (item.id === s.id ? { ...item, playerId: e.target.value } : item))
                      )
                    }
                  >
                    <option value={match.playerAId || ""}>{match.playerAName}</option>
                    <option value={match.playerBId || ""}>{match.playerBName}</option>
                  </select>
                  <div style={{ flex: 1, position: "relative" }}>
                    <input
                      type="text"
                      list={datalistId}
                      placeholder={roster.length > 0 ? "Elegí o escribí un jugador..." : "Nombre de jugador virtual (ej. Crespo)"}
                      className="form-input"
                      style={{ width: "100%" }}
                      value={s.virtualPlayer}
                      onChange={(e) =>
                        setScorers((prev) =>
                          prev.map((item) => (item.id === s.id ? { ...item, virtualPlayer: e.target.value } : item))
                        )
                      }
                      required
                    />
                    {roster.length > 0 && (
                      <datalist id={datalistId}>
                        {roster.map((name, i) => (
                          <option key={i} value={name} />
                        ))}
                      </datalist>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    style={{ width: "65px", textAlign: "center" }}
                    value={s.amount}
                    onChange={(e) =>
                      setScorers((prev) =>
                        prev.map((item) =>
                          item.id === s.id ? { ...item, amount: Math.max(1, parseInt(e.target.value, 10) || 1) } : item
                        )
                      )
                    }
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleRemoveScorer(s.id)}
                    title="Eliminar goleador"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>

          {/* Tarjetas Rojas */}
          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontWeight: 600 }}>🟥 Tarjetas Rojas / Expulsados</label>
              <button type="button" className="btn btn-sm" onClick={handleAddRedCard}>
                + Agregar Expulsado
              </button>
            </div>

            {redCards.map((r, idx) => {
              const roster = getRosterForPlayer(r.playerId);
              const datalistId = `edit-red-roster-${r.id}-${idx}`;
              return (
                <div key={r.id} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  <select
                    className="form-select"
                    style={{ width: "150px" }}
                    value={r.playerId}
                    onChange={(e) =>
                      setRedCards((prev) =>
                        prev.map((item) => (item.id === r.id ? { ...item, playerId: e.target.value } : item))
                      )
                    }
                  >
                    <option value={match.playerAId || ""}>{match.playerAName}</option>
                    <option value={match.playerBId || ""}>{match.playerBName}</option>
                  </select>
                  <div style={{ flex: 1, position: "relative" }}>
                    <input
                      type="text"
                      list={datalistId}
                      placeholder={roster.length > 0 ? "Elegí o escribí un expulsado..." : "Nombre del expulsado (ej. Samuel)"}
                      className="form-input"
                      style={{ width: "100%" }}
                      value={r.virtualPlayer}
                      onChange={(e) =>
                        setRedCards((prev) =>
                          prev.map((item) => (item.id === r.id ? { ...item, virtualPlayer: e.target.value } : item))
                        )
                      }
                      required
                    />
                    {roster.length > 0 && (
                      <datalist id={datalistId}>
                        {roster.map((name, i) => (
                          <option key={i} value={name} />
                        ))}
                      </datalist>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleRemoveRedCard(r.id)}
                    title="Eliminar expulsión"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>

          <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-gold" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
