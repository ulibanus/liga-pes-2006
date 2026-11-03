-- juego: Catalogo maestro de juegos y parches soportados
CREATE TABLE IF NOT EXISTS juego (
  id_juego INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS equipo (
  id_equipo INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  id_juego INTEGER NULL REFERENCES juego(id_juego)
);

CREATE TABLE IF NOT EXISTS plantel_jugador (
  id_plantel_jugador INTEGER PRIMARY KEY AUTOINCREMENT,
  id_equipo INTEGER NOT NULL REFERENCES equipo(id_equipo) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  dorsal INTEGER NULL,
  posicion TEXT NULL,
  UNIQUE(id_equipo, nombre)
);

CREATE TABLE IF NOT EXISTS persona (
  id_persona INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  id_equipo INTEGER NULL REFERENCES equipo(id_equipo),
  id_usuario INTEGER NULL REFERENCES usuario(id_usuario)
);

-- usuario supports Role-Based Access Control (admin vs user) for public registration
CREATE TABLE IF NOT EXISTS usuario (
  id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'user' CHECK(rol IN ('admin', 'user')),
  avatar_url TEXT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- torneo: Aggregate root para la gestion de competiciones
CREATE TABLE IF NOT EXISTS torneo (
  id_torneo INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  codigo_invitacion TEXT NULL UNIQUE,
  id_juego INTEGER NULL REFERENCES juego(id_juego),
  juego TEXT NOT NULL DEFAULT 'PES 6 EuroAmericano Clásico 2',
  formato TEXT NOT NULL CHECK(formato IN ('liga_ida', 'liga_ida_vuelta', 'eliminacion_directa', 'grupos_eliminacion')),
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK(estado IN ('borrador', 'en_curso', 'finalizado')),
  id_organizador INTEGER NOT NULL REFERENCES usuario(id_usuario),
  campeon_id INTEGER NULL REFERENCES persona(id_persona),
  configuracion_json TEXT NOT NULL DEFAULT '{}',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- torneo_participante: Asociacion de personas y equipos en el contexto de un torneo
CREATE TABLE IF NOT EXISTS torneo_participante (
  id_torneo INTEGER NOT NULL REFERENCES torneo(id_torneo) ON DELETE CASCADE,
  id_persona INTEGER NOT NULL REFERENCES persona(id_persona),
  id_equipo INTEGER NOT NULL REFERENCES equipo(id_equipo),
  grupo TEXT NULL,
  sembrado INTEGER NULL,
  PRIMARY KEY (id_torneo, id_persona)
);

-- torneo_solicitud: Solicitudes de jugadores para unirse a un torneo
CREATE TABLE IF NOT EXISTS torneo_solicitud (
  id_solicitud INTEGER PRIMARY KEY AUTOINCREMENT,
  id_torneo INTEGER NOT NULL REFERENCES torneo(id_torneo) ON DELETE CASCADE,
  id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_equipo INTEGER NULL REFERENCES equipo(id_equipo),
  mensaje TEXT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'aprobada', 'rechazada')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(id_torneo, id_usuario)
);

-- torneo_bloqueado: Lista de usuarios bloqueados por torneo
CREATE TABLE IF NOT EXISTS torneo_bloqueado (
  id_torneo INTEGER NOT NULL REFERENCES torneo(id_torneo) ON DELETE CASCADE,
  id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  motivo TEXT NULL,
  bloqueado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (id_torneo, id_usuario)
);

-- torneo_administrador: Co-administradores y moderadores secundarios por torneo
CREATE TABLE IF NOT EXISTS torneo_administrador (
  id_torneo INTEGER NOT NULL REFERENCES torneo(id_torneo) ON DELETE CASCADE,
  id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  rol TEXT NOT NULL DEFAULT 'organizador' CHECK(rol IN ('organizador', 'moderador')),
  asignado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (id_torneo, id_usuario)
);

CREATE TABLE IF NOT EXISTS partido (
  id_partido INTEGER PRIMARY KEY AUTOINCREMENT,
  id_torneo INTEGER NULL REFERENCES torneo(id_torneo),
  etapa TEXT NOT NULL DEFAULT 'fecha',
  numero_fecha INTEGER,
  estado TEXT,
  id_local INTEGER NULL REFERENCES persona(id_persona),
  id_visitante INTEGER NULL REFERENCES persona(id_persona),
  goles_local INTEGER NOT NULL DEFAULT 0,
  goles_visitante INTEGER NOT NULL DEFAULT 0,
  penales_local INTEGER NULL,
  penales_visitante INTEGER NULL,
  siguiente_partido_id INTEGER NULL REFERENCES partido(id_partido)
);

CREATE TABLE IF NOT EXISTS incidencia (
  id_incidencia INTEGER PRIMARY KEY AUTOINCREMENT,
  jugador_virtual TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('G', 'R')),
  id_persona INTEGER NOT NULL REFERENCES persona(id_persona),
  id_partido INTEGER NOT NULL REFERENCES partido(id_partido)
);

-- admin is kept for backwards compatibility with legacy installations.
CREATE TABLE IF NOT EXISTS admin (
  id_admin INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

-- sesion_refresh stores active refresh tokens to support revocation and secure logout
CREATE TABLE IF NOT EXISTS sesion_refresh (
  id_sesion INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expira_en TEXT NOT NULL,
  revocado INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- propuesta_partido
CREATE TABLE IF NOT EXISTS propuesta_partido (
  id_propuesta INTEGER PRIMARY KEY AUTOINCREMENT,
  id_torneo INTEGER NULL REFERENCES torneo(id_torneo),
  id_local INTEGER NOT NULL REFERENCES persona(id_persona),
  id_visitante INTEGER NOT NULL REFERENCES persona(id_persona),
  goles_local INTEGER NOT NULL DEFAULT 0,
  goles_visitante INTEGER NOT NULL DEFAULT 0,
  numero_fecha INTEGER,
  goleadores_json TEXT NOT NULL DEFAULT '[]',
  rojas_json TEXT NOT NULL DEFAULT '[]',
  nombre_solicitante TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'aprobado', 'rechazado')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- prode_pronostico
CREATE TABLE IF NOT EXISTS prode_pronostico (
  id_pronostico INTEGER PRIMARY KEY AUTOINCREMENT,
  id_torneo INTEGER NOT NULL REFERENCES torneo(id_torneo) ON DELETE CASCADE,
  id_partido INTEGER NOT NULL REFERENCES partido(id_partido) ON DELETE CASCADE,
  id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  goles_local INTEGER NOT NULL,
  goles_visitante INTEGER NOT NULL,
  puntos_obtenidos INTEGER NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(id_partido, id_usuario)
);
