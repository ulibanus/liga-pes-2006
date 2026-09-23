import { useState, useEffect } from "react";
import { useAuth } from "../context/useAuth";
import { useTournament } from "../context/useTournament";
import { createTorneo, fetchJuegos, type CreateTorneoPayload } from "../services/api";
import type { TournamentFormat, Game } from "../domain/types";

interface CreateTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (id: number) => void;
}

export function CreateTournamentModal({ isOpen, onClose, onCreated }: CreateTournamentModalProps) {
  const { token } = useAuth();
  const { refreshTournaments, setActiveTournamentId } = useTournament();

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [formato, setFormato] = useState<TournamentFormat>("liga_ida");
  const [loadingGames, setLoadingGames] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingGames(true);
      fetchJuegos()
        .then((data) => {
          setGames(data);
          if (data.length > 0) {
            setSelectedGameId((prev) =>
              prev && data.some((g) => String(g.id) === prev) ? prev : String(data[0].id)
            );
          }
        })
        .catch(() => {
          setError("No se pudieron cargar los juegos disponibles");
        })
        .finally(() => {
          setLoadingGames(false);
        });
    }
  }, [isOpen]);

  const handleClose = () => {
    setNombre("");
    setDescripcion("");
    setSelectedGameId(games.length > 0 ? String(games[0].id) : "");
    setFormato("liga_ida");
    setError(null);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Debés estar autenticado para crear un torneo");
      return;
    }

    if (!nombre.trim()) {
      setError("Ingresá un nombre para el torneo");
      return;
    }

    const selectedGameObj = games.find((g) => String(g.id) === selectedGameId);
    if (!selectedGameObj) {
      setError("Debés seleccionar un juego del catálogo oficial");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: CreateTorneoPayload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        id_juego: selectedGameObj.id,
        juego: selectedGameObj.name,
        formato,
      };

      const newTorneo = await createTorneo(token, payload);
      await refreshTournaments();
      setActiveTournamentId(newTorneo.id);
      onCreated?.(newTorneo.id);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el torneo");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-tournament-title"
    >
      <div className="modal-box" style={{ maxWidth: "520px" }}>
        <div className="modal-header-row">
          <div className="modal-title-wrap">
            <h2 id="create-tournament-title">🏆 Nuevo Torneo</h2>
            <p className="modal-sub">Configurá los datos iniciales de la competición</p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            aria-label="Cerrar ventana modal"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="error-box" role="alert" style={{ marginBottom: "16px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-field">
            <label htmlFor="tournament-name">
              Nombre del Torneo <span className="required-star">*</span>
            </label>
            <input
              id="tournament-name"
              type="text"
              className="form-input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Copa Apertura PES 6 - 2026"
              required
              autoFocus
            />
          </div>

          <div className="form-field">
            <label htmlFor="tournament-desc">Descripción (opcional)</label>
            <input
              id="tournament-desc"
              type="text"
              className="form-input"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Torneo oficial de fin de semana"
            />
          </div>

          <div className="form-grid-2">
            <div className="form-field">
              <label htmlFor="tournament-game">
                Juego / Parche <span className="required-star">*</span>
              </label>
              <select
                id="tournament-game"
                className="form-input"
                style={{ width: "100%" }}
                value={selectedGameId}
                onChange={(e) => setSelectedGameId(e.target.value)}
                disabled={loadingGames || games.length === 0}
                required
              >
                {games.length === 0 ? (
                  <option value="">{loadingGames ? "Cargando juegos..." : "No hay juegos disponibles"}</option>
                ) : (
                  games.map((g) => (
                    <option key={g.id} value={String(g.id)}>
                      {g.name}
                    </option>
                  ))
                )}
              </select>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                Catálogo oficial administrado
              </span>
            </div>

            <div className="form-field">
              <label htmlFor="tournament-format">
                Formato de Competición <span className="required-star">*</span>
              </label>
              <select
                id="tournament-format"
                className="form-input"
                style={{ width: "100%" }}
                value={formato}
                onChange={(e) => setFormato(e.target.value as TournamentFormat)}
              >
                <option value="liga_ida">Liga (Solo Ida)</option>
                <option value="liga_ida_vuelta">Liga (Ida y Vuelta)</option>
                <option value="eliminacion_directa">Eliminación Directa (Llaves)</option>
                <option value="grupos_eliminacion">Fase de Grupos + Eliminación</option>
              </select>
            </div>
          </div>

          <div className="form-actions" style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-gold"
              disabled={isSubmitting || games.length === 0}
            >
              {isSubmitting ? "Creando..." : "Crear Torneo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
