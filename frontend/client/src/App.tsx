import { useState, useEffect } from "react";
import { fetchTournamentData, iniciarTorneo, type TournamentData } from "./services/api";
import { useStandings } from "./hooks/useStandings";
import { useStats } from "./hooks/useStats";
import { useFixture } from "./hooks/useFixture";
import { StandingsTable } from "./components/StandingsTable";
import { TopScorersTable } from "./components/TopScorersTable";
import { RedCardsTable } from "./components/RedCardsTable";
import { FixtureView } from "./components/FixtureView";
import { BracketView } from "./components/BracketView";
import { ProdeView } from "./components/ProdeView";
import { ProposalForm } from "./components/ProposalForm";
import { LoginModal } from "./components/LoginModal";
import { ProfileModal } from "./components/ProfileModal";
import { AdminModerationPanel } from "./components/AdminModerationPanel";
import { SorteoView } from "./components/SorteoView";
import { TournamentLobby } from "./components/TournamentLobby";
import { TournamentHero } from "./components/TournamentHero";
import { CreateTournamentModal } from "./components/CreateTournamentModal";
import { JoinTournamentModal } from "./components/JoinTournamentModal";
import { PlayerDetailModal } from "./components/PlayerDetailModal";
import { Footer } from "./components/Footer";
import { UserAvatar } from "./components/UserAvatar";
import { useAuth } from "./context/useAuth";
import { useTournament } from "./context/useTournament";
import "./App.css";

type TabKey = "posiciones" | "llaves" | "goleadores" | "rojas" | "fechas" | "prode" | "cargar" | "sorteo" | "admin";

export function App() {
  const { isAuthenticated, username, isAdmin, token, user, logout } = useAuth();
  const {
    tournaments,
    activeTournament,
    activeTournamentId,
    setActiveTournamentId,
    loadingTournaments,
    canManageActiveTournament,
    refreshTournaments,
  } = useTournament();

  const [currentView, setCurrentView] = useState<"lobby" | "tournament">("tournament");
  const [activeTab, setActiveTab] = useState<TabKey>("posiciones");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [data, setData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [fixtureFormat, setFixtureFormat] = useState<"ida" | "ida_vuelta">("ida");
  const [actionLoading, setActionLoading] = useState(false);
  const [inspectingPlayerId, setInspectingPlayerId] = useState<string | null>(null);

  const [prevTournamentId, setPrevTournamentId] = useState<number | undefined>(undefined);

  // Sincronizar formato de fixture y pestaña inicial si el torneo es de eliminación directa
  if (activeTournament?.id !== prevTournamentId) {
    setPrevTournamentId(activeTournament?.id);
    if (activeTournament?.format === "liga_ida_vuelta") {
      setFixtureFormat("ida_vuelta");
    } else if (activeTournament?.format === "liga_ida") {
      setFixtureFormat("ida");
    }

    if (activeTournament?.format === "eliminacion_directa") {
      setActiveTab((prev) => (prev === "posiciones" ? "llaves" : prev));
    } else {
      setActiveTab((prev) => (prev === "llaves" ? "posiciones" : prev));
    }
  }


  // Carga reactiva de datos al cambiar el torneo activo
  useEffect(() => {
    let ignore = false;

    async function execute() {
      setLoading(true);
      try {
        const result = await fetchTournamentData(activeTournamentId || undefined, token ?? undefined);
        if (!ignore) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          const message =
            err instanceof Error ? err.message : "Error al cargar los datos del torneo";
          setError(message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void execute();

    return () => {
      ignore = true;
    };
  }, [activeTournamentId, token]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [result] = await Promise.all([
        fetchTournamentData(activeTournamentId || undefined, token ?? undefined),
        refreshTournaments(),
      ]);
      setData(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al cargar los datos del torneo";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleIniciarTorneo = async () => {
    if (!token || !activeTournamentId) return;
    if ((data?.players.length ?? 0) < 2) {
      alert("Necesitás al menos 2 participantes cargados en el torneo para iniciarlo. Usá la pestaña 'Sorteo / Equipos'.");
      return;
    }
    setActionLoading(true);
    try {
      await iniciarTorneo(token, activeTournamentId);
      await refreshTournaments();
      await handleRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al iniciar el torneo");
    } finally {
      setActionLoading(false);
    }
  };

  const standings = useStandings(
    data?.players ?? [],
    data?.teams ?? [],
    data?.matches ?? []
  );

  const { topScorers, redCards } = useStats(
    data?.incidents ?? [],
    data?.players ?? [],
    data?.teams ?? []
  );

  const fixtureRounds = useFixture(
    data?.players ?? [],
    data?.teams ?? [],
    data?.matches ?? [],
    selectedPlayerId || undefined,
    fixtureFormat
  );

  const inspectingPlayer = inspectingPlayerId && data?.players
    ? data.players.find((p) => p.id === inspectingPlayerId) ?? null
    : null;

  const inspectingPlayerTeam = inspectingPlayer?.teamId && data?.teams
    ? data.teams.find((t) => t.id === inspectingPlayer.teamId) ?? null
    : null;

  const inspectingPlayerStanding = inspectingPlayerId
    ? standings.find((s) => s.playerId === inspectingPlayerId) ?? null
    : null;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div
            className="brand"
            onClick={() => setCurrentView("lobby")}
            style={{ cursor: "pointer" }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setCurrentView("lobby")}
            title="Ir al lobby de torneos"
          >
            <img src="/logo.png" alt="Regional T Logo" className="brand-logo-img" />
            <div>
              <h1>
                REGIONAL <span style={{ color: "var(--gold-bright)" }}>T</span>
              </h1>
              <div className="header-subtitle">Gestión de Torneos de Juegos de Fútbol</div>
            </div>
          </div>

          <nav className="header-nav" aria-label="Navegación principal">
            {currentView === "tournament" && (
              <button
                type="button"
                className="header-nav-btn"
                onClick={() => setCurrentView("lobby")}
                title="Volver al lobby de torneos"
              >
                ← Explorar Torneos
              </button>
            )}
          </nav>

          <div className="header-actions">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  className="profile-trigger-btn"
                  onClick={() => setIsProfileModalOpen(true)}
                  title="Ver y editar perfil"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(255, 255, 255, 0.07)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "9999px",
                    padding: "3px 10px 3px 4px",
                    color: "#f8fafc",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  <UserAvatar
                    name={username || "Usuario"}
                    avatarUrl={user?.avatar_url}
                    isRegistered={true}
                    size="sm"
                  />
                  <span style={{ fontWeight: 600 }}>{username || "activo"}</span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      backgroundColor: isAdmin ? "rgba(234, 179, 8, 0.2)" : "rgba(255, 255, 255, 0.1)",
                      color: isAdmin ? "var(--gold-bright)" : "#cbd5e1",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {isAdmin ? "Admin" : "User"}
                  </span>
                </button>
                <button
                  type="button"
                  className="logout-btn"
                  onClick={async () => {
                    await logout();
                    if (activeTab === "admin" || activeTab === "sorteo") {
                      setActiveTab("posiciones");
                    }
                  }}
                >
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <button
                type="button"
                className="admin-toggle"
                onClick={() => setIsLoginModalOpen(true)}
              >
                Iniciar Sesión
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {currentView === "lobby" || (!activeTournament && !loadingTournaments) ? (
          <TournamentLobby
            tournaments={tournaments}
            onSelectTournament={(id) => {
              setActiveTournamentId(id);
              setCurrentView("tournament");
            }}
            onOpenCreateModal={() => {
              if (!isAuthenticated) {
                setIsLoginModalOpen(true);
              } else {
                setIsCreateModalOpen(true);
              }
            }}
            onOpenJoinModal={() => {
              if (!isAuthenticated) {
                setIsLoginModalOpen(true);
              } else {
                setIsJoinModalOpen(true);
              }
            }}
            loading={loadingTournaments}
          />
        ) : (
          <>
            {activeTournament && (
              <TournamentHero
                tournament={activeTournament}
                canManage={canManageActiveTournament}
                onBackToLobby={() => setCurrentView("lobby")}
                onIniciarTorneo={handleIniciarTorneo}
                iniciando={actionLoading}
                onOpenJoinModal={() => {
                  if (!isAuthenticated) {
                    setIsLoginModalOpen(true);
                  } else {
                    setIsJoinModalOpen(true);
                  }
                }}
                tournaments={tournaments}
                onSelectTournament={(id) => setActiveTournamentId(id)}
              />
            )}

        <nav className="nav-tabs" aria-label="Navegación de secciones">
          {activeTournament?.format !== "eliminacion_directa" && (
            <button
              type="button"
              className={`tab-btn ${activeTab === "posiciones" ? "active" : ""}`}
              onClick={() => setActiveTab("posiciones")}
            >
              <span>
                Posiciones
                <span className="tab-badge">{standings.length}</span>
              </span>
            </button>
          )}
          {(activeTournament?.format === "eliminacion_directa" ||
            activeTournament?.format === "grupos_eliminacion") && (
            <button
              type="button"
              className={`tab-btn ${activeTab === "llaves" ? "active" : ""}`}
              onClick={() => setActiveTab("llaves")}
            >
              <span>
                Cuadro de Llaves
                <span className="tab-badge">🏆</span>
              </span>
            </button>
          )}
          <button
            type="button"
            className={`tab-btn ${activeTab === "goleadores" ? "active" : ""}`}
            onClick={() => setActiveTab("goleadores")}
          >
            <span>
              Goleadores
              <span className="tab-badge">{topScorers.length}</span>
            </span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "rojas" ? "active" : ""}`}
            onClick={() => setActiveTab("rojas")}
          >
            <span>
              Tarjetas Rojas
              <span className="tab-badge">{redCards.length}</span>
            </span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "fechas" ? "active" : ""}`}
            onClick={() => setActiveTab("fechas")}
          >
            <span>
              Fechas / Fixture
              <span className="tab-badge">{fixtureRounds.length}</span>
            </span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "prode" ? "active" : ""}`}
            onClick={() => setActiveTab("prode")}
          >
            <span>
              Prode
              <span className="tab-badge">🎯</span>
            </span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "cargar" ? "active" : ""}`}
            onClick={() => setActiveTab("cargar")}
          >
            <span>
              Cargar Resultado
              <span className="tab-badge">✍️</span>
            </span>
          </button>
          {(isAdmin || canManageActiveTournament) && (
            <button
              type="button"
              className={`tab-btn ${activeTab === "sorteo" ? "active" : ""}`}
              onClick={() => setActiveTab("sorteo")}
            >
              <span>
                Sorteo / Equipos
                <span className="tab-badge">🎲</span>
              </span>
            </button>
          )}
          {(isAdmin || canManageActiveTournament) && (
            <button
              type="button"
              className={`tab-btn ${activeTab === "admin" ? "active" : ""}`}
              onClick={() => setActiveTab("admin")}
            >
              <span>
                {isAdmin ? "Moderación Admin" : "Moderación"}
                <span className="tab-badge">🛡️</span>
              </span>
            </button>
          )}
        </nav>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">
              {activeTab === "posiciones" && "Tabla de Posiciones"}
              {activeTab === "llaves" && "Cuadro de Llaves Eliminatorias"}
              {activeTab === "goleadores" && "Tabla de Goleadores"}
              {activeTab === "rojas" && "Ranking de Expulsiones"}
              {activeTab === "fechas" && "Calendario y Fixture de Fechas"}
              {activeTab === "prode" && "Prode Comunitario de Pronósticos"}
              {activeTab === "cargar" && "Cargar Resultado de Partido"}
              {activeTab === "sorteo" && "Sorteador y Asignación de Equipos"}
              {activeTab === "admin" && "Panel de Moderación y Aprobaciones"}
            </h2>
            <button
              type="button"
              className="btn"
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          {loading && !data ? (
            <div className="state-container">
              <div className="spinner" />
              <p>Cargando datos del torneo...</p>
            </div>
          ) : error ? (
            <div className="state-container">
              <div className="error-box">
                <p><strong>Error de conexión:</strong> {error}</p>
              </div>
              <div>
                <button type="button" className="btn" onClick={handleRefresh}>
                  Reintentar
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === "posiciones" && (
                <StandingsTable
                  standings={standings}
                  onSelectPlayer={setInspectingPlayerId}
                />
              )}
              {activeTab === "llaves" && (
                <BracketView
                  participants={data?.participants ?? []}
                  matches={data?.matches ?? []}
                  onSelectPlayer={setInspectingPlayerId}
                />
              )}
              {activeTab === "goleadores" && (
                <TopScorersTable
                  scorers={topScorers}
                  onSelectPlayer={setInspectingPlayerId}
                />
              )}
              {activeTab === "rojas" && (
                <RedCardsTable
                  redCards={redCards}
                  onSelectPlayer={setInspectingPlayerId}
                />
              )}
              {activeTab === "fechas" && (
                <FixtureView
                  rounds={fixtureRounds}
                  players={data?.players ?? []}
                  selectedPlayerId={selectedPlayerId}
                  onSelectPlayer={setSelectedPlayerId}
                  onInspectPlayer={setInspectingPlayerId}
                  format={fixtureFormat}
                  onChangeFormat={setFixtureFormat}
                />
              )}

              {activeTab === "prode" && (
                <ProdeView
                  activeTournament={activeTournament}
                  currentUser={user}
                  token={token}
                  onOpenLogin={() => setIsLoginModalOpen(true)}
                  canManageTournament={canManageActiveTournament}
                />
              )}

              {activeTab === "cargar" && (
                activeTournament?.status === "en_curso" ? (
                  <ProposalForm
                    players={data?.players ?? []}
                    teams={data?.teams ?? []}
                    matches={data?.matches ?? []}
                    format={fixtureFormat}
                    tournamentId={activeTournamentId ?? undefined}
                    onSuccess={() => {
                      void handleRefresh();
                      setActiveTab("posiciones");
                    }}
                  />
                ) : (
                  <div className="empty-state">
                    <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>⚠️</div>
                    <h3>No se pueden cargar resultados</h3>
                    <p>
                      {activeTournament?.status === "borrador"
                        ? "El torneo todavía no inició. Esperá a que el organizador haga el sorteo y dé comienzo al torneo."
                        : "El torneo ya ha finalizado. No se pueden cargar más resultados."}
                    </p>
                  </div>
                )
              )}
              {activeTab === "sorteo" && (
                <SorteoView
                  currentPlayers={data?.players ?? []}
                  currentTeams={data?.teams ?? []}
                  format={fixtureFormat}
                  onChangeFormat={setFixtureFormat}
                  onSorteoComplete={() => {
                    void handleRefresh();
                    setActiveTab("posiciones");
                  }}
                />
              )}
              {activeTab === "admin" && (
                (isAdmin || canManageActiveTournament) ? (
                  <AdminModerationPanel
                    players={data?.players ?? []}
                    teams={data?.teams ?? []}
                    tournamentId={activeTournamentId ?? undefined}
                    onMatchApproved={() => {
                      void handleRefresh();
                    }}
                  />
                ) : (
                  <div className="state-container">
                    <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔒</div>
                    <h3>Acceso Restringido</h3>
                    <p style={{ color: "var(--text-dim)", marginBottom: "20px" }}>
                      Debés iniciar sesión con tus credenciales de administrador u organizador de este torneo para moderar las propuestas.
                    </p>
                    <button
                      type="button"
                      className="btn btn-gold"
                      onClick={() => setIsLoginModalOpen(true)}
                    >
                      Iniciar Sesión
                    </button>
                  </div>
                )
              )}
            </>
          )}
        </section>
          </>
        )}
      </main>

      <Footer
        onNavigateLobby={() => setCurrentView("lobby")}
        onOpenCreateModal={() => {
          if (!isAuthenticated) {
            setIsLoginModalOpen(true);
          } else {
            setIsCreateModalOpen(true);
          }
        }}
        onOpenJoinModal={() => {
          if (!isAuthenticated) {
            setIsLoginModalOpen(true);
          } else {
            setIsJoinModalOpen(true);
          }
        }}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => setActiveTab("admin")}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      <CreateTournamentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(id) => {
          setActiveTournamentId(id);
          setCurrentView("tournament");
        }}
      />

      <JoinTournamentModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onJoined={async () => {
          await refreshTournaments();
          await handleRefresh();
          setCurrentView("tournament");
        }}
      />

      <PlayerDetailModal
        isOpen={Boolean(inspectingPlayerId)}
        onClose={() => setInspectingPlayerId(null)}
        player={inspectingPlayer}
        team={inspectingPlayerTeam}
        standing={inspectingPlayerStanding}
        scorers={topScorers}
        redCards={redCards}
        matches={data?.matches ?? []}
        allPlayers={data?.players ?? []}
        allTeams={data?.teams ?? []}
      />
    </div>
  );
}

export default App;
