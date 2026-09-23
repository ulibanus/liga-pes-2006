import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { fetchTorneos } from "../services/api";
import { useAuth } from "./useAuth";
import { TournamentContext, type TournamentContextType } from "./useTournament";
import type { Tournament } from "../domain/types";

const STORAGE_KEY = "rt_active_tournament_id";

export function TournamentProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin, token } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournamentId, setActiveTournamentIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  });
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  const refreshTournaments = useCallback(async () => {
    try {
      const list = await fetchTorneos(undefined, token ?? undefined);
      setTournaments(list);

      setActiveTournamentIdState((prev) => {
        // If previous is valid in list, keep it
        if (prev && list.some((t) => t.id === prev)) {
          return prev;
        }
        // Prefer the first "en_curso" tournament, otherwise first in list
        const enCurso = list.find((t) => t.status === "en_curso");
        const nextId = enCurso ? enCurso.id : list[0]?.id ?? null;
        if (nextId) {
          localStorage.setItem(STORAGE_KEY, String(nextId));
        }
        return nextId;
      });
    } catch (err) {
      console.error("Error cargando torneos:", err);
    } finally {
      setLoadingTournaments(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshTournaments();
  }, [refreshTournaments]);

  const setActiveTournamentId = useCallback((id: number) => {
    setActiveTournamentIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  const activeTournament = useMemo(() => {
    return tournaments.find((t) => t.id === activeTournamentId) ?? null;
  }, [tournaments, activeTournamentId]);

  const canManageActiveTournament = useMemo(() => {
    if (!activeTournament || !user) return false;
    return (
      isAdmin ||
      user.id === activeTournament.organizerId ||
      (Array.isArray(activeTournament.adminIds) && activeTournament.adminIds.includes(user.id))
    );
  }, [activeTournament, user, isAdmin]);

  const value = useMemo<TournamentContextType>(
    () => ({
      tournaments,
      activeTournament,
      activeTournamentId,
      setActiveTournamentId,
      refreshTournaments,
      loadingTournaments,
      canManageActiveTournament,
    }),
    [
      tournaments,
      activeTournament,
      activeTournamentId,
      setActiveTournamentId,
      refreshTournaments,
      loadingTournaments,
      canManageActiveTournament,
    ]
  );

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
}
