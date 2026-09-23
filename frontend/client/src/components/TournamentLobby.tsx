import React, { useState, useMemo } from "react";
import type { Tournament } from "../domain/types";
import { useAuth } from "../context/useAuth";
import { UserAvatar } from "./UserAvatar";

interface TournamentLobbyProps {
  tournaments: Tournament[];
  onSelectTournament: (id: number) => void;
  onOpenCreateModal: () => void;
  onOpenJoinModal: () => void;
  loading?: boolean;
}

type FilterStatus = "todos" | "en_curso" | "borrador" | "finalizado";

const ITEMS_PER_PAGE = 6;

export const TournamentLobby: React.FC<TournamentLobbyProps> = ({
  tournaments,
  onSelectTournament,
  onOpenCreateModal,
  onOpenJoinModal,
  loading = false,
}) => {
  const { isAuthenticated, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("todos");
  const [currentPage, setCurrentPage] = useState(1);

  const counts = useMemo(() => {
    return {
      todos: tournaments.length,
      en_curso: tournaments.filter((t) => t.status === "en_curso").length,
      borrador: tournaments.filter((t) => t.status === "borrador").length,
      finalizado: tournaments.filter((t) => t.status === "finalizado").length,
    };
  }, [tournaments]);

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      if (statusFilter !== "todos" && t.status !== statusFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(query);
        const matchesGame = t.game.toLowerCase().includes(query);
        const matchesOrg = (t.organizerUsername || "").toLowerCase().includes(query);
        if (!matchesName && !matchesGame && !matchesOrg) {
          return false;
        }
      }
      return true;
    });
  }, [tournaments, statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredTournaments.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedTournaments = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredTournaments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTournaments, safePage]);

  const getFormatLabel = (format: string) => {
    switch (format) {
      case "liga_ida":
        return "Liga (Ida)";
      case "liga_ida_vuelta":
        return "Liga (Ida y Vuelta)";
      case "eliminacion_directa":
        return "Eliminación Directa";
      case "grupos_eliminacion":
        return "Grupos + Playoff";
      default:
        return format;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "borrador":
        return <span className="lobby-badge badge-draft">📝 En Preparación</span>;
      case "en_curso":
        return <span className="lobby-badge badge-active">⚽ En Curso</span>;
      case "finalizado":
        return <span className="lobby-badge badge-finished">🏆 Finalizado</span>;
      default:
        return null;
    }
  };

  return (
    <div className="tournament-lobby">
      {/* Lobby Hero Welcome */}
      <section className="lobby-hero">
        <div className="lobby-hero-content">
          <span className="lobby-eyebrow">Plataforma Oficial de Competición</span>
          <h1 className="lobby-title">Torneos de la Comunidad</h1>
          <p className="lobby-subtitle">
            Explorá campeonatos de videojuegos de fútbol, seguí las posiciones en vivo, postulate para competir o creá y gestioná tu propio torneo.
          </p>

          <div className="lobby-hero-actions">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  className="btn btn-gold btn-lobby-cta"
                  onClick={onOpenCreateModal}
                >
                  + Crear Nuevo Torneo
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-lobby-cta"
                  onClick={onOpenJoinModal}
                >
                  🔑 Unirme con Código
                </button>
              </>
            ) : (
              <span className="lobby-login-hint">
                💡 Iniciá sesión para crear tus propios torneos o unirte a los existentes.
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="lobby-toolbar">
        <div className="lobby-filters">
          <button
            type="button"
            className={`filter-btn ${statusFilter === "todos" ? "active" : ""}`}
            onClick={() => { setCurrentPage(1); setStatusFilter("todos"); }}
          >
            Todos ({counts.todos})
          </button>
          <button
            type="button"
            className={`filter-btn ${statusFilter === "en_curso" ? "active" : ""}`}
            onClick={() => { setCurrentPage(1); setStatusFilter("en_curso"); }}
          >
            ⚽ En Curso ({counts.en_curso})
          </button>
          <button
            type="button"
            className={`filter-btn ${statusFilter === "borrador" ? "active" : ""}`}
            onClick={() => { setCurrentPage(1); setStatusFilter("borrador"); }}
          >
            📝 En Preparación ({counts.borrador})
          </button>
          <button
            type="button"
            className={`filter-btn ${statusFilter === "finalizado" ? "active" : ""}`}
            onClick={() => { setCurrentPage(1); setStatusFilter("finalizado"); }}
          >
            🏆 Finalizados ({counts.finalizado})
          </button>
        </div>

        <div className="lobby-search">
          <input
            type="text"
            className="lobby-search-input"
            placeholder="Buscar por nombre, juego u organizador..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
          {searchTerm && (
            <button
              type="button"
              className="lobby-search-clear"
              onClick={() => { setSearchTerm(""); setCurrentPage(1); }}
              title="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tournaments Grid */}
      {loading && tournaments.length === 0 ? (
        <div className="state-container">
          <div className="spinner" />
          <p>Cargando torneos disponibles...</p>
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="empty-state" style={{ margin: "40px auto", maxWidth: "480px" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔍</div>
          <h3>No se encontraron torneos</h3>
          <p>
            {searchTerm || statusFilter !== "todos"
              ? "Probá cambiando los filtros o el término de búsqueda."
              : "Aún no hay torneos creados en la plataforma. ¡Sé el primero en organizar uno!"}
          </p>
          {isAuthenticated && (
            <button
              type="button"
              className="btn btn-gold"
              style={{ marginTop: "16px" }}
              onClick={onOpenCreateModal}
            >
              + Crear Torneo Ahora
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="lobby-grid">
            {paginatedTournaments.map((t) => {
              const isMine = user && user.id === t.organizerId;

              return (
                <article
                  key={t.id}
                  className={`tournament-card card-${t.status}`}
                  onClick={() => onSelectTournament(t.id)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => e.key === "Enter" && onSelectTournament(t.id)}
                  title={`Ver detalles de ${t.name}`}
                >
                  {/* Card Artwork Top Banner */}
                  <div className={`card-artwork artwork-${t.status}`}>
                    <div className="artwork-overlay" />
                    <div className="artwork-badges">
                      {getStatusBadge(t.status)}
                      {isMine && <span className="card-owner-badge">👑 Mi Torneo</span>}
                    </div>
                    <div className="card-game-icon">⚽</div>
                  </div>

                  {/* Card Main Body */}
                  <div className="card-body">
                    <h3 className="card-title">{t.name}</h3>
                    <div className="card-game-name">🎮 {t.game}</div>

                    {t.description ? (
                      <p className="card-desc">{t.description}</p>
                    ) : (
                      <p className="card-desc card-desc-empty">Sin descripción adicional</p>
                    )}

                    {t.status === "finalizado" && t.championName && (
                      <div className="card-champion-highlight">
                        <span>🥇</span>
                        <span>Campeón: <strong>{t.championName}</strong></span>
                      </div>
                    )}

                    <div className="card-details-grid">
                      <div className="card-detail-item">
                        <span className="detail-label">Formato</span>
                        <span className="detail-value">{getFormatLabel(t.format)}</span>
                      </div>
                      <div className="card-detail-item">
                        <span className="detail-label">Inscriptos</span>
                        <span className="detail-value">👥 {t.participantsCount || 0}</span>
                      </div>
                      <div className="card-detail-item">
                        <span className="detail-label">Partidos</span>
                        <span className="detail-value">⚽ {t.matchesCount || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="card-footer">
                    <div className="card-organizer">
                      <UserAvatar
                        name={t.organizerUsername || "Organizador"}
                        isRegistered={true}
                        size="xs"
                      />
                      <span className="organizer-name">
                        {t.organizerUsername || "Admin"}
                      </span>
                    </div>

                    <span className="card-cta">
                      Ver Torneo →
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="lobby-pagination">
              <div className="pagination-info">
                Mostrando <strong>{(safePage - 1) * ITEMS_PER_PAGE + 1}</strong> - <strong>{Math.min(safePage * ITEMS_PER_PAGE, filteredTournaments.length)}</strong> de <strong>{filteredTournaments.length}</strong> torneos
              </div>

              <div className="pagination-controls">
                <button
                  type="button"
                  className="pagination-btn pagination-nav"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  title="Página anterior"
                >
                  ← Anterior
                </button>

                <div className="pagination-pages">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      className={`pagination-btn pagination-num ${pageNum === safePage ? "active" : ""}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="pagination-btn pagination-nav"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  title="Página siguiente"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
