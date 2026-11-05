import fs from 'node:fs';
import path from 'node:path';
import db from '../db.js';

const PES6_DIR = '/home/ulises/Games/PES6';
const FACES_MAP_PATH = path.join(PES6_DIR, 'kitserver/GDB/faces/map.txt');

/**
 * Normaliza nombres para matching sin tildes ni mayúsculas.
 */
function normalizeName(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Extrae rango de años desde un encabezado o nombre de equipo:
 * 'Barcelona 2014-15' -> { start: 2014, end: 2015 }
 * 'Real Madrid 1956-1960' -> { start: 1956, end: 1960 }
 * 'Milan 1962-63' -> { start: 1962, end: 1963 }
 * 'Argentina 2022' -> { start: 2022, end: 2022 }
 */
export function parseHeaderYears(header) {
  const rangeMatch = header.match(/\b(19\d{2}|20\d{2})-(\d{2})\b/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const century = Math.floor(start / 100) * 100;
    const end = century + Number(rangeMatch[2]);
    return { start, end };
  }
  const fullYears = header.match(/\b(19\d{2}|20\d{2})\b/g) || [];
  if (fullYears.length >= 2) {
    return { start: Number(fullYears[0]), end: Number(fullYears[1]) };
  }
  if (fullYears.length === 1) {
    return { start: Number(fullYears[0]), end: Number(fullYears[0]) };
  }
  return null;
}

/**
 * Encuentra el encabezado exacto en PES6 respetando el AÑO del equipo.
 * Si el equipo es 'Barcelona 2014', devuelve 'Barcelona 2014-15'.
 * Si el equipo es 'Barcelona 2009', devuelve 'Barcelona 2008-09'.
 */
export function findBestHeader(teamName, availableHeaders) {
  const normTeam = normalizeName(teamName);
  const teamYears = (normTeam.match(/\b(19\d{2}|20\d{2})\b/g) || []).map(Number);

  // 1. Coincidencia exacta (sin tildes/case)
  for (const h of availableHeaders) {
    if (normalizeName(h) === normTeam) return h;
  }

  // 2. Extraer palabras base clave (sin números/años)
  const teamBaseWords = normTeam
    .replace(/\b(19\d{2}|20\d{2}(-\d{2})?)\b/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 && w !== 'club');

  const candidates = availableHeaders.filter((h) => {
    const normH = normalizeName(h);
    // Reglas estrictas para evitar cruces comunes
    if (normTeam.includes('inter') && !normH.includes('inter')) return false;
    if (!normTeam.includes('inter') && normH.includes('inter')) return false;
    if (normTeam.includes('arsenal') && !normH.includes('arsenal')) return false;

    if (teamBaseWords.length > 0) {
      return teamBaseWords.some((w) => normH.includes(w));
    }
    return normH.includes(normTeam) || normTeam.includes(normH);
  });

  if (candidates.length === 0) return null;

  // 3. Si el equipo especifica un año, encontrar el candidato cuyo rango lo contenga
  if (teamYears.length > 0) {
    const ty = teamYears[0];
    const yearMatch = candidates.find((c) => {
      const hy = parseHeaderYears(c);
      if (!hy) return false;
      return ty >= hy.start && ty <= hy.end;
    });
    if (yearMatch) return yearMatch;
  }

  // 4. Si no se especificó año o no hubo coincidencia directa, ordenar por año más moderno
  candidates.sort((a, b) => {
    const ya = parseHeaderYears(a)?.start || 0;
    const yb = parseHeaderYears(b)?.start || 0;
    return yb - ya;
  });

  return candidates[0];
}

/**
 * Lee map.txt de kitserver con codificación windows-1252 para respetar acentos y caracteres especiales.
 */
export async function parsePES6Rosters() {
  if (!fs.existsSync(FACES_MAP_PATH)) {
    throw new Error(`No se encontró el archivo de rostros en: ${FACES_MAP_PATH}`);
  }

  const raw = fs.readFileSync(FACES_MAP_PATH);
  const decoder = new TextDecoder('windows-1252');
  const content = decoder.decode(raw);
  const sections = content.split(/\n#\s+/);

  const rosters = new Map();

  for (const sec of sections.slice(1)) {
    const lines = sec.trim().split('\n');
    const header = lines[0].trim();
    if (!header || header.startsWith('Map generated') || header.startsWith('Last updated') || header.startsWith('Not Affiliated')) {
      continue;
    }

    const players = [];
    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      let playerName = '';
      if (trimmed.includes('#')) {
        playerName = trimmed.split('#').pop().trim();
      } else if (trimmed.includes('"')) {
        const binPart = trimmed.split('"')[1];
        if (binPart) {
          const file = binPart.split('\\').pop() || '';
          playerName = file.replace('.bin', '').trim();
        }
      }

      if (playerName && !players.includes(playerName)) {
        players.push(playerName);
      }
    }

    if (players.length > 0) {
      rosters.set(header, players);
    }
  }

  return rosters;
}

/**
 * Sincroniza el plantel para un único equipo en SQLite.
 * ELIMINA el plantel previo para evitar mezclar jugadores de distintos años/ediciones.
 */
export async function syncSingleTeam(teamId) {
  try {
    const teamRes = await db.execute({
      sql: 'SELECT id_equipo, nombre FROM equipo WHERE id_equipo = ?',
      args: [teamId],
    });
    if (teamRes.rows.length === 0) return [];
    const team = teamRes.rows[0];
    if (!fs.existsSync(FACES_MAP_PATH)) return [];

    const gameRosters = await parsePES6Rosters();
    const matchedHeader = findBestHeader(team.nombre, Array.from(gameRosters.keys()));
    if (!matchedHeader) return [];

    const matchedPlayers = gameRosters.get(matchedHeader) || [];
    if (matchedPlayers.length === 0) return [];

    // Limpiar plantel anterior para que NUNCA se mezclen jugadores de otros años
    await db.execute({
      sql: 'DELETE FROM plantel_jugador WHERE id_equipo = ?',
      args: [team.id_equipo],
    });

    for (const p of matchedPlayers) {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO plantel_jugador (id_equipo, nombre) VALUES (?, ?)',
        args: [team.id_equipo, p],
      });
    }

    const updated = await db.execute({
      sql: 'SELECT id_plantel_jugador, nombre, dorsal, posicion FROM plantel_jugador WHERE id_equipo = ? ORDER BY nombre ASC',
      args: [teamId],
    });
    return updated.rows;
  } catch (err) {
    console.error('Error sincronizando plantel para equipo', teamId, err);
    return [];
  }
}

/**
 * Sincroniza los planteles de todos los equipos que estén siendo utilizados en algún torneo o persona.
 */
export async function syncUsedTeamRosters() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS plantel_jugador (
      id_plantel_jugador INTEGER PRIMARY KEY AUTOINCREMENT,
      id_equipo INTEGER NOT NULL REFERENCES equipo(id_equipo) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      dorsal INTEGER NULL,
      posicion TEXT NULL,
      UNIQUE(id_equipo, nombre)
    );
  `);

  const usedTeamsRes = await db.execute(`
    SELECT DISTINCT e.id_equipo, e.nombre
    FROM equipo e
    WHERE e.id_equipo IN (
      SELECT DISTINCT id_equipo FROM torneo_participante
      UNION
      SELECT DISTINCT id_equipo FROM persona WHERE id_equipo IS NOT NULL
    )
  `);

  const usedTeams = usedTeamsRes.rows;
  console.log(`Equipos en uso a sincronizar: ${usedTeams.length}`);

  const gameRosters = await parsePES6Rosters();
  console.log(`Total de planteles analizados del juego PES6: ${gameRosters.size}`);

  let totalInserted = 0;

  for (const team of usedTeams) {
    const matchedHeader = findBestHeader(team.nombre, Array.from(gameRosters.keys()));
    if (!matchedHeader) {
      console.log(`⚠️ No se encontró coincidencia directa para el equipo [${team.nombre}]`);
      continue;
    }

    const matchedPlayers = gameRosters.get(matchedHeader);
    console.log(`✓ Equipo [${team.nombre}] mapeado exactamente a "${matchedHeader}" (${matchedPlayers.length} jugadores)`);

    // Limpiar previo para no mezclar años
    await db.execute({
      sql: 'DELETE FROM plantel_jugador WHERE id_equipo = ?',
      args: [team.id_equipo],
    });

    for (const p of matchedPlayers) {
      try {
        await db.execute({
          sql: 'INSERT OR IGNORE INTO plantel_jugador (id_equipo, nombre) VALUES (?, ?)',
          args: [team.id_equipo, p],
        });
        totalInserted++;
      } catch {
        // Ignorar duplicados
      }
    }
  }

  console.log(`Sincronización finalizada. Jugadores cargados: ${totalInserted}`);
}

/**
 * Carga todos los 203 equipos reales del parche PES 6 en la tabla 'equipo'
 * para que cada uno sea un club distinto con su año específico.
 */
export async function populateAllPES6Teams(idJuego = 1) {
  if (!fs.existsSync(FACES_MAP_PATH)) return 0;
  const gameRosters = await parsePES6Rosters();
  let createdCount = 0;

  for (const header of gameRosters.keys()) {
    const res = await db.execute({
      sql: 'SELECT id_equipo FROM equipo WHERE nombre = ? AND (id_juego = ? OR id_juego IS NULL)',
      args: [header, idJuego],
    });
    if (res.rows.length === 0) {
      await db.execute({
        sql: 'INSERT INTO equipo (nombre, id_juego) VALUES (?, ?)',
        args: [header, idJuego],
      });
      createdCount++;
    }
  }

  console.log(`Equipos cargados/creados desde PES6: ${createdCount}`);
  return createdCount;
}

// Ejecutar directamente si es llamado vía CLI
if (process.argv[1] && process.argv[1].endsWith('sync-rosters.js')) {
  populateAllPES6Teams(1)
    .then(() => syncUsedTeamRosters())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error al sincronizar:', err);
      process.exit(1);
    });
}
