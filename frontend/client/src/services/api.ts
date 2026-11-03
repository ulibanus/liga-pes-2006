import type {
  Team,
  Player,
  Match,
  Incident,
  Game,
  Tournament,
  TournamentFormat,
  TournamentParticipant,
} from "../domain/types";

export interface JuegoDto {
  id_juego: number;
  nombre: string;
  descripcion?: string | null;
  activo: number;
  creado_en?: string;
}

export interface TorneoDto {
  id_torneo: number;
  nombre: string;
  descripcion: string | null;
  codigo_invitacion?: string | null;
  id_juego?: number | null;
  juego: string;
  formato: TournamentFormat;
  estado: "borrador" | "en_curso" | "finalizado";
  id_organizador: number;
  organizador_username?: string;
  admin_ids?: number[];
  campeon_id: number | null;
  campeon_nombre?: string;
  participantes_count?: number;
  partidos_count?: number;
  configuracion_json?: string;
  creado_en: string;
}

export interface TorneoDetailDto extends TorneoDto {
  configuracion: Record<string, unknown>;
  participantes: Array<{
    id_persona: number;
    persona_nombre: string;
    id_usuario?: number | null;
    usuario_username?: string | null;
    usuario_avatar_url?: string | null;
    id_equipo: number;
    equipo_nombre: string;
    grupo: string | null;
    sembrado: number | null;
  }>;
}

export interface EquipoDto {
  id_equipo: number;
  nombre: string;
  id_juego?: number | null;
  juego_nombre?: string | null;
}

export interface PersonaDto {
  id_persona: number;
  nombre: string;
  id_equipo: number | null;
  id_usuario?: number | null;
  usuario_username?: string | null;
  usuario_avatar_url?: string | null;
  equipo_nombre?: string | null;
}

export interface PartidoDto {
  id_partido: number;
  goles_local: number;
  goles_visitante: number;
  numero_fecha: number | null;
  estado: string | null;
  id_local: number;
  id_visitante: number;
  id_torneo?: number | null;
  etapa?: string;
  penales_local?: number | null;
  penales_visitante?: number | null;
  siguiente_partido_id?: number | null;
}

export interface IncidenciaDto {
  id_incidencia: number;
  jugador_virtual: string;
  tipo: "G" | "R";
  id_persona: number;
  id_partido: number;
}

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function mapTorneoDtoToTournament(dto: TorneoDto): Tournament {
  return {
    id: dto.id_torneo,
    name: dto.nombre,
    description: dto.descripcion,
    inviteCode: dto.codigo_invitacion ?? null,
    gameId: dto.id_juego ?? null,
    game: dto.juego,
    format: dto.formato,
    status: dto.estado,
    organizerId: dto.id_organizador,
    organizerUsername: dto.organizador_username,
    adminIds: dto.admin_ids ?? [],
    championId: dto.campeon_id,
    championName: dto.campeon_nombre,
    participantsCount: Number(dto.participantes_count ?? 0),
    matchesCount: Number(dto.partidos_count ?? 0),
    createdAt: dto.creado_en,
  };
}

export function mapEquipoToTeam(dto: EquipoDto): Team {
  return {
    id: String(dto.id_equipo),
    name: dto.nombre,
  };
}

export function mapPersonaToPlayer(dto: PersonaDto): Player {
  return {
    id: String(dto.id_persona),
    name: dto.nombre,
    teamId: dto.id_equipo ? String(dto.id_equipo) : "",
    userId: dto.id_usuario ?? null,
    userUsername: dto.usuario_username ?? null,
    avatarUrl: dto.usuario_avatar_url ?? null,
    isRegistered: Boolean(dto.id_usuario),
  };
}

export function mapPartidoToMatch(dto: PartidoDto): Match {
  return {
    id: String(dto.id_partido),
    playerAId: String(dto.id_local),
    playerBId: String(dto.id_visitante),
    goalsA: dto.goles_local,
    goalsB: dto.goles_visitante,
    played: dto.estado !== "pendiente",
    round: dto.numero_fecha ?? undefined,
    tournamentId: dto.id_torneo ?? undefined,
    stage: dto.etapa,
    penaltiesA: dto.penales_local,
    penaltiesB: dto.penales_visitante,
    scorers: [],
    redCards: [],
  };
}

export function mapIncidenciaToIncident(dto: IncidenciaDto): Incident {
  return {
    id: String(dto.id_incidencia),
    virtualPlayer: dto.jugador_virtual,
    type: dto.tipo,
    playerId: String(dto.id_persona),
    matchId: String(dto.id_partido),
  };
}

export async function fetchTorneos(estado?: string, token?: string): Promise<Tournament[]> {
  const url = estado ? `${API_BASE}/torneos?estado=${estado}` : `${API_BASE}/torneos`;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch tournaments: ${response.statusText}`);
  }
  const data: TorneoDto[] = await response.json();
  return data.map(mapTorneoDtoToTournament);
}

export async function fetchTorneo(id: number, token?: string): Promise<TorneoDetailDto> {
  const response = await fetch(`${API_BASE}/torneos/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch tournament ${id}: ${response.statusText}`);
  }
  return response.json();
}

export interface CreateTorneoPayload {
  nombre: string;
  descripcion?: string;
  id_juego?: number;
  juego?: string;
  formato: TournamentFormat;
  configuracion?: Record<string, unknown>;
}

export async function createTorneo(token: string, payload: CreateTorneoPayload): Promise<Tournament> {
  const response = await fetch(`${API_BASE}/torneos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `Error ${response.status}: ${response.statusText}`);
  }

  const dto: TorneoDto = await response.json();
  return mapTorneoDtoToTournament(dto);
}

export async function iniciarTorneo(token: string, id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/torneos/${id}/iniciar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `Error ${response.status}: ${response.statusText}`);
  }
}

export async function finalizarTorneo(token: string, id: number, campeonId?: number): Promise<void> {
  const response = await fetch(`${API_BASE}/torneos/${id}/finalizar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ campeon_id: campeonId }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `Error ${response.status}: ${response.statusText}`);
  }
}

export async function assignTorneoParticipantes(
  token: string,
  id: number,
  participantes: Array<{ id_persona: number; id_equipo: number; grupo?: string | null; sembrado?: number | null }>
): Promise<void> {
  const response = await fetch(`${API_BASE}/torneos/${id}/participantes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ participantes }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `Error ${response.status}: ${response.statusText}`);
  }
}

export async function fetchJuegos(): Promise<Game[]> {
  const response = await fetch(`${API_BASE}/juegos`);
  if (!response.ok) {
    throw new Error(`Failed to fetch juegos: ${response.statusText}`);
  }
  const data: JuegoDto[] = await response.json();
  return data.map((j) => ({
    id: j.id_juego,
    name: j.nombre,
    description: j.descripcion ?? undefined,
    active: j.activo === 1,
  }));
}

export async function fetchEquipos(gameId?: number): Promise<Team[]> {
  const url = gameId ? `${API_BASE}/equipos?id_juego=${gameId}` : `${API_BASE}/equipos`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch teams: ${response.statusText}`);
  }
  const data: EquipoDto[] = await response.json();
  return data.map(mapEquipoToTeam);
}

export async function fetchPersonas(): Promise<Player[]> {
  const response = await fetch(`${API_BASE}/personas`);
  if (!response.ok) {
    throw new Error(`Failed to fetch personas: ${response.statusText}`);
  }
  const data: PersonaDto[] = await response.json();
  return data.map(mapPersonaToPlayer);
}

export async function fetchPartidos(torneoId?: number): Promise<Match[]> {
  const url = torneoId ? `${API_BASE}/partidos?id_torneo=${torneoId}` : `${API_BASE}/partidos`;
  const [partidosRes, incidenciasRes] = await Promise.all([
    fetch(url),
    fetch(torneoId ? `${API_BASE}/incidencias?id_torneo=${torneoId}` : `${API_BASE}/incidencias`),
  ]);

  if (!partidosRes.ok) {
    throw new Error(`Failed to fetch partidos: ${partidosRes.statusText}`);
  }

  const partidosData: PartidoDto[] = await partidosRes.json();
  const incidenciasData: IncidenciaDto[] = incidenciasRes.ok ? await incidenciasRes.json() : [];

  return partidosData.map((dto) => {
    const matchIncidents = incidenciasData.filter((i) => i.id_partido === dto.id_partido);
    const scorers = matchIncidents
      .filter((i) => i.tipo === "G")
      .map((i) => ({
        scorerName: i.jugador_virtual,
        playerId: String(i.id_persona),
        amount: 1,
      }));
    const redCards = matchIncidents
      .filter((i) => i.tipo === "R")
      .map((i) => ({
        playerName: i.jugador_virtual,
        playerId: String(i.id_persona),
      }));

    return {
      ...mapPartidoToMatch(dto),
      scorers,
      redCards,
    };
  });
}

export async function fetchIncidencias(torneoId?: number): Promise<Incident[]> {
  const url = torneoId ? `${API_BASE}/incidencias?id_torneo=${torneoId}` : `${API_BASE}/incidencias`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch incidencias: ${response.statusText}`);
  }
  const data: IncidenciaDto[] = await response.json();
  return data.map(mapIncidenciaToIncident);
}

export interface TournamentData {
  teams: Team[];
  players: Player[];
  matches: Match[];
  incidents: Incident[];
  participants: TournamentParticipant[];
  activeTournament?: Tournament;
}

export async function fetchTournamentData(torneoId?: number, token?: string): Promise<TournamentData> {
  if (torneoId) {
    const torneoRes = await fetchTorneo(torneoId, token);
    const [matches, incidents, allGameTeams] = await Promise.all([
      fetchPartidos(torneoId),
      fetchIncidencias(torneoId),
      fetchEquipos(torneoRes.id_juego ?? undefined),
    ]);

    const activeTournament = mapTorneoDtoToTournament(torneoRes);

    const players: Player[] = torneoRes.participantes.map((p) => ({
      id: String(p.id_persona),
      name: p.persona_nombre,
      teamId: String(p.id_equipo),
      userId: p.id_usuario ?? null,
      userUsername: p.usuario_username ?? null,
      avatarUrl: p.usuario_avatar_url ?? null,
      isRegistered: Boolean(p.id_usuario),
    }));

    const participants: TournamentParticipant[] = torneoRes.participantes.map((p) => ({
      playerId: String(p.id_persona),
      playerName: p.persona_nombre,
      userId: p.id_usuario ?? null,
      userUsername: p.usuario_username ?? null,
      avatarUrl: p.usuario_avatar_url ?? null,
      isRegistered: Boolean(p.id_usuario),
      teamId: String(p.id_equipo),
      teamName: p.equipo_nombre,
      group: p.grupo,
      seed: p.sembrado,
    }));

    const teamsMap = new Map<string, Team>(allGameTeams.map((t) => [t.id, t]));
    for (const p of torneoRes.participantes) {
      if (!teamsMap.has(String(p.id_equipo))) {
        teamsMap.set(String(p.id_equipo), {
          id: String(p.id_equipo),
          name: p.equipo_nombre,
        });
      }
    }
    const teams = Array.from(teamsMap.values());

    return {
      teams,
      players,
      matches,
      incidents,
      participants,
      activeTournament,
    };
  }

  const [teams, players, matches, incidents] = await Promise.all([
    fetchEquipos(),
    fetchPersonas(),
    fetchPartidos(),
    fetchIncidencias(),
  ]);

  const teamsLookup = new Map(teams.map((t) => [t.id, t.name]));
  const participants: TournamentParticipant[] = players.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    userId: p.userId ?? null,
    userUsername: p.userUsername ?? null,
    avatarUrl: p.avatarUrl ?? null,
    isRegistered: p.isRegistered ?? false,
    teamId: p.teamId,
    teamName: teamsLookup.get(p.teamId) || "Sin Equipo",
  }));

  return { teams, players, matches, incidents, participants };
}



export interface ProposalDto {
  id_propuesta: number;
  id_local: number;
  id_visitante: number;
  goles_local: number;
  goles_visitante: number;
  numero_fecha: number | null;
  goleadores: Array<{
    jugador: string;
    personaId: number;
    cantidad: number;
  }>;
  rojas: Array<{
    jugador: string;
    personaId: number;
  }>;
  nombre_solicitante: string;
  estado: "pendiente" | "aprobado" | "rechazado";
  creado_en?: string;
}

export async function editarPropuesta(
  token: string,
  id: number,
  payload: import("../domain/proposals").CreateProposalPayload
): Promise<ProposalDto> {
  const response = await fetch(`${API_BASE}/propuestas/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return response.json();
}

export async function submitProposal(
  payload: import("../domain/proposals").CreateProposalPayload
): Promise<ProposalDto> {
  const response = await fetch(`${API_BASE}/propuestas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return response.json();
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthUser {
  id: number;
  username: string;
  role: "admin" | "user";
  avatar_url?: string | null;
}

export async function uploadUserAvatar(
  token: string,
  file: File
): Promise<{ message: string; avatar_url: string; user: AuthUser }> {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await fetch(`${API_BASE}/auth/avatar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return response.json();
}

export async function deleteUserAvatar(
  token: string
): Promise<{ message: string; avatar_url: null; user: AuthUser }> {
  const response = await fetch(`${API_BASE}/auth/avatar`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return response.json();
}

export interface AuthResponse {
  accessToken: string;
  token: string;
  user: AuthUser;
}

export type LoginResponse = AuthResponse;

export async function loginUser(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return response.json();
}

export const loginAdmin = loginUser;

export async function registerUser(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return response.json();
}

export async function refreshAuthSession(): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return response.json();
}

export async function logoutUser(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

export async function fetchPropuestas(
  token: string,
  estado = "pendiente",
  torneoId?: number
): Promise<ProposalDto[]> {
  const params = new URLSearchParams();
  if (estado) params.append("estado", estado);
  if (torneoId) params.append("id_torneo", String(torneoId));
  const qs = params.toString() ? `?${params.toString()}` : "";
  const url = `${API_BASE}/propuestas${qs}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return response.json();
}

export async function aprobarPropuesta(token: string, id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/propuestas/${id}/aprobar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }
}

export async function rechazarPropuesta(token: string, id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/propuestas/${id}/rechazar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }
}

export async function executeResetAndSorteo(
  token: string,
  assignments: Array<{ person: string; team: string }>
): Promise<void> {
  const [incidenciasRes, partidosRes, personasRes, equiposRes] = await Promise.all([
    fetch(`${API_BASE}/incidencias`),
    fetch(`${API_BASE}/partidos`),
    fetch(`${API_BASE}/personas`),
    fetch(`${API_BASE}/equipos`),
  ]);

  const incidencias: IncidenciaDto[] = await incidenciasRes.json();
  const partidos: PartidoDto[] = await partidosRes.json();
  const personas: PersonaDto[] = await personasRes.json();
  const equipos: EquipoDto[] = await equiposRes.json();

  for (const i of incidencias) {
    await fetch(`${API_BASE}/incidencias/${i.id_incidencia}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  for (const p of partidos) {
    await fetch(`${API_BASE}/partidos/${p.id_partido}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  for (const p of personas) {
    await fetch(`${API_BASE}/personas/${p.id_persona}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  for (const assignment of assignments) {
    let equipo = equipos.find(
      (e) => e.nombre.trim().toLowerCase() === assignment.team.trim().toLowerCase()
    );

    if (!equipo) {
      const createTeamRes = await fetch(`${API_BASE}/equipos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nombre: assignment.team.trim() }),
      });
      if (createTeamRes.ok) {
        equipo = await createTeamRes.json();
        equipos.push(equipo!);
      }
    }

    await fetch(`${API_BASE}/personas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nombre: assignment.person.trim(),
        id_equipo: equipo ? equipo.id_equipo : null,
      }),
    });
  }
}

export async function executeTournamentSorteo(
  token: string,
  torneoId: number,
  assignments: Array<{ person: string; team: string }>
): Promise<void> {
  const [personasRes, equiposRes] = await Promise.all([
    fetch(`${API_BASE}/personas`),
    fetch(`${API_BASE}/equipos`),
  ]);

  const personas: PersonaDto[] = await personasRes.json();
  const equipos: EquipoDto[] = await equiposRes.json();

  const participantesPayload: Array<{ id_persona: number; id_equipo: number }> = [];

  for (const assignment of assignments) {
    let equipo = equipos.find(
      (e) => e.nombre.trim().toLowerCase() === assignment.team.trim().toLowerCase()
    );

    if (!equipo) {
      const createTeamRes = await fetch(`${API_BASE}/equipos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nombre: assignment.team.trim() }),
      });
      if (createTeamRes.ok) {
        equipo = await createTeamRes.json();
        equipos.push(equipo!);
      }
    }

    let persona = personas.find(
      (p) => p.nombre.trim().toLowerCase() === assignment.person.trim().toLowerCase()
    );

    if (!persona) {
      const createPersonaRes = await fetch(`${API_BASE}/personas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre: assignment.person.trim(),
          id_equipo: equipo ? equipo.id_equipo : null,
        }),
      });
      if (createPersonaRes.ok) {
        persona = await createPersonaRes.json();
        personas.push(persona!);
      }
    }

    if (persona && equipo) {
      participantesPayload.push({
        id_persona: persona.id_persona,
        id_equipo: equipo.id_equipo,
      });
    }
  }

  await assignTorneoParticipantes(token, torneoId, participantesPayload);
}

// -------------------------------------------------------------
// Prode (Predictions) API
// -------------------------------------------------------------

export interface ProdePredictionItem {
  id_pronostico: number;
  id_partido: number;
  goles_local: number;
  goles_visitante: number;
  puntos_obtenidos: number | null;
  creado_en?: string;
}

export interface ProdeCommunityPrediction {
  id_pronostico: number;
  id_partido: number;
  id_usuario: number;
  username: string;
  goles_local: number;
  goles_visitante: number;
  puntos_obtenidos: number | null;
}

export interface ProdeMatchItem {
  id_partido: number;
  id_torneo: number;
  etapa: string;
  numero_fecha: number | null;
  estado: string | null;
  id_local: number;
  id_visitante: number;
  goles_local: number;
  goles_visitante: number;
  penales_local: number | null;
  penales_visitante: number | null;
  local_nombre: string;
  visitante_nombre: string;
  local_equipo: string;
  visitante_equipo: string;
  isPlayed: boolean;
  mi_pronostico: ProdePredictionItem | null;
  pronosticos_comunidad: ProdeCommunityPrediction[];
}

export interface ProdeStanding {
  id_usuario: number;
  username: string;
  avatar_url?: string | null;
  puntos_totales: number;
  aciertos_exactos: number;
  aciertos_resultado: number;
  desaciertos: number;
  total_pronosticos: number;
}

export async function fetchTournamentProde(
  torneoId: number,
  token?: string | null
): Promise<{ torneo: { id_torneo: number; nombre: string; estado: string }; partidos: ProdeMatchItem[] }> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/torneos/${torneoId}/prode`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al cargar prode" }));
    throw new Error(err.error || "Error al cargar prode");
  }
  return res.json();
}

export async function submitProdePrediction(
  token: string,
  torneoId: number,
  matchId: number,
  golesLocal: number,
  golesVisitante: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/torneos/${torneoId}/prode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      id_partido: matchId,
      goles_local: golesLocal,
      goles_visitante: golesVisitante,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al guardar pronóstico" }));
    throw new Error(err.error || "Error al guardar pronóstico");
  }
}

export async function fetchTournamentProdeLeaderboard(torneoId: number): Promise<ProdeStanding[]> {
  const res = await fetch(`${API_BASE}/torneos/${torneoId}/prode/posiciones`);
  if (!res.ok) {
    throw new Error("Error al obtener posiciones del prode");
  }
  return res.json();
}

export async function fetchGlobalProdeLeaderboard(): Promise<ProdeStanding[]> {
  const res = await fetch(`${API_BASE}/prode/posiciones`);
  if (!res.ok) {
    throw new Error("Error al obtener posiciones globales del prode");
  }
  return res.json();
}

export async function generateTorneoFixture(token: string, torneoId: number): Promise<{ message: string; partidos_creados: number }> {
  const res = await fetch(`${API_BASE}/torneos/${torneoId}/generar-fixture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al generar fixture" }));
    throw new Error(err.error || "Error al generar fixture");
  }
  return res.json();
}

export async function unirseTorneoCodigo(
  token: string,
  codigo: string,
  id_equipo?: number
): Promise<{ message: string; id_torneo: number; id_persona: number; id_equipo: number }> {
  const res = await fetch(`${API_BASE}/torneos/unirse-codigo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ codigo, id_equipo }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al unirse al torneo con código" }));
    throw new Error(err.error || "Error al unirse al torneo con código");
  }
  return res.json();
}

export async function solicitarUnirseTorneo(
  token: string,
  torneoId: number,
  id_equipo?: number,
  mensaje?: string
): Promise<{ id_solicitud: number; estado: string; message?: string }> {
  const res = await fetch(`${API_BASE}/torneos/${torneoId}/solicitar-unirse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id_equipo, mensaje }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al solicitar unión al torneo" }));
    throw new Error(err.error || "Error al solicitar unión al torneo");
  }
  return res.json();
}

export interface TorneoSolicitudDto {
  id_solicitud: number;
  id_torneo: number;
  id_usuario: number;
  username: string;
  avatar_url?: string | null;
  id_equipo?: number | null;
  equipo_nombre?: string | null;
  mensaje?: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  creado_en: string;
}

export async function fetchTorneoSolicitudes(token: string, torneoId: number): Promise<TorneoSolicitudDto[]> {
  const res = await fetch(`${API_BASE}/torneos/${torneoId}/solicitudes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al obtener solicitudes" }));
    throw new Error(err.error || "Error al obtener solicitudes");
  }
  return res.json();
}

export async function aprobarTorneoSolicitud(
  token: string,
  torneoId: number,
  solicitudId: number,
  id_equipo?: number
): Promise<{ message: string; id_persona: number; id_equipo: number }> {
  const res = await fetch(`${API_BASE}/torneos/${torneoId}/solicitudes/${solicitudId}/aprobar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id_equipo }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al aprobar solicitud" }));
    throw new Error(err.error || "Error al aprobar solicitud");
  }
  return res.json();
}

export async function rechazarTorneoSolicitud(
  token: string,
  torneoId: number,
  solicitudId: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/torneos/${torneoId}/solicitudes/${solicitudId}/rechazar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al rechazar solicitud" }));
    throw new Error(err.error || "Error al rechazar solicitud");
  }
}

export async function fetchMiSolicitud(
  token: string,
  torneoId: number
): Promise<{ es_participante: boolean; participante: unknown; solicitud: TorneoSolicitudDto | null }> {
  const res = await fetch(`${API_BASE}/torneos/${torneoId}/mi-solicitud`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al consultar estado de solicitud" }));
    throw new Error(err.error || "Error al consultar estado de solicitud");
  }
  return res.json();
}

export async function quitarParticipanteTorneo(
  token: string,
  torneoId: number,
  personaId: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/torneos/${torneoId}/participantes/${personaId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al quitar participante" }));
    throw new Error(err.error || "Error al quitar participante");
  }
}

export interface TorneoBloqueadoDto {
  id_torneo: number;
  id_usuario: number;
  username: string;
  avatar_url?: string | null;
  motivo?: string | null;
  bloqueado_en: string;
}

export async function fetchTorneoBloqueados(
  token: string,
  torneoId: number
): Promise<TorneoBloqueadoDto[]> {
  const res = await fetch(`${API_BASE}/torneos/${torneoId}/bloqueados`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al obtener bloqueados" }));
    throw new Error(err.error || "Error al obtener bloqueados");
  }
  return res.json();
}

export async function bloquearUsuarioTorneo(
  token: string,
  torneoId: number,
  usuarioId: number,
  motivo?: string
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/torneos/${torneoId}/bloquear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id_usuario: usuarioId, motivo }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al bloquear usuario" }));
    throw new Error(err.error || "Error al bloquear usuario");
  }
  return res.json();
}

export async function desbloquearUsuarioTorneo(
  token: string,
  torneoId: number,
  usuarioId: number
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/torneos/${torneoId}/bloquear/${usuarioId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al desbloquear usuario" }));
    throw new Error(err.error || "Error al desbloquear usuario");
  }
  return res.json();
}


