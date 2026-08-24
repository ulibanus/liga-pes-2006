CREATE TABLE IF NOT EXISTS equipo (
  id_equipo INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS persona (
  id_persona INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  id_equipo INTEGER NULL REFERENCES equipo(id_equipo)
);

CREATE TABLE IF NOT EXISTS partido (
  id_partido INTEGER PRIMARY KEY AUTOINCREMENT,
  goles_local INTEGER NOT NULL DEFAULT 0,
  goles_visitante INTEGER NOT NULL DEFAULT 0,
  numero_fecha INTEGER,
  estado TEXT,
  id_local INTEGER NOT NULL REFERENCES persona(id_persona),
  id_visitante INTEGER NOT NULL REFERENCES persona(id_persona)
);

CREATE TABLE IF NOT EXISTS incidencia (
  id_incidencia INTEGER PRIMARY KEY AUTOINCREMENT,
  jugador_virtual TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('G', 'R')),
  id_persona INTEGER NOT NULL REFERENCES persona(id_persona),
  id_partido INTEGER NOT NULL REFERENCES partido(id_partido)
);

-- admin is not part of the original ER diagram; the diagram models the
-- tournament domain only, and this table exists purely to support JWT login.
CREATE TABLE IF NOT EXISTS admin (
  id_admin INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

-- goleadores_json/rojas_json store draft data in the same in-memory shape the
-- frontend already uses; they only become real incidencia rows on approval.
CREATE TABLE IF NOT EXISTS propuesta_partido (
  id_propuesta INTEGER PRIMARY KEY AUTOINCREMENT,
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
