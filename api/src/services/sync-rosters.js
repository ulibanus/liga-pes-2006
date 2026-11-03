import fs from 'node:fs';
import path from 'node:path';
import db from '../db.js';

const PES6_DIR = '/home/ulises/Games/PES6';
const FACES_MAP_PATH = path.join(PES6_DIR, 'kitserver/GDB/faces/map.txt');

/**
 * Normaliza nombres de clubes para matching flexible:
 * 'Real Madrid 2000-2002' -> 'real madrid'
 * 'Inter de Milán' -> 'inter'
 */
function normalizeName(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

export async function parsePES6Rosters() {
  if (!fs.existsSync(FACES_MAP_PATH)) {
    throw new Error(`No se encontró el archivo de rostros en: ${FACES_MAP_PATH}`);
  }

  const content = fs.readFileSync(FACES_MAP_PATH, { encoding: 'latin1' });
  const sections = content.split(/\n#\s+/);

  const rosters = new Map();

  for (const sec of sections.slice(1)) {
    const lines = sec.trim().split('\n');
    const header = lines[0].trim();
    if (!header || header.startsWith('Map generated') || header.startsWith('Last updated')) {
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

export async function syncUsedTeamRosters() {
  // Asegurar tabla plantel_jugador
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

  // Obtener únicamente los equipos que están siendo utilizados en algún torneo o asignados a una persona
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
    const targetNorm = normalizeName(team.nombre);
    if (!targetNorm || targetNorm.startsWith('sync team')) {
      continue;
    }

    // Priorizar versiones modernas o más completas (ej. 2005-06 / 2006 / 2000-2002)
    let matchedPlayers = null;
    let matchedHeader = '';
    const candidates = [];
    for (const [header, players] of gameRosters.entries()) {
      const headerNorm = normalizeName(header);
      // Evitar que 'Inter de Milán' matchee con 'Milan' solo
      if (targetNorm.includes('inter') && !headerNorm.includes('inter')) {
        continue;
      }
      if (!targetNorm.includes('inter') && targetNorm.includes('milan') && headerNorm.includes('inter')) {
        continue;
      }

      const keywords = targetNorm.split(/\s+/).filter((w) => w.length > 3 && w !== 'milan' && w !== 'real');
      const matchesWord = keywords.length > 0
        ? keywords.some((k) => headerNorm.includes(k))
        : headerNorm.includes(targetNorm);

      if (matchesWord || headerNorm.includes(targetNorm) || targetNorm.includes(headerNorm)) {
        candidates.push({ header, players });
      }
    }

    if (candidates.length > 0) {
      // Ordenamos para preferir planteles con 2005-06 o mayor cantidad de jugadores
      candidates.sort((a, b) => {
        const aHas2000 = /200[0-9]|201[0-9]/.test(a.header) ? 1 : 0;
        const bHas2000 = /200[0-9]|201[0-9]/.test(b.header) ? 1 : 0;
        if (aHas2000 !== bHas2000) return bHas2000 - aHas2000;
        return b.players.length - a.players.length;
      });

      matchedPlayers = candidates[0].players;
      matchedHeader = candidates[0].header;
    }

    if (matchedPlayers && matchedPlayers.length > 0) {
      console.log(`✓ Equipo [${team.nombre}] mapeado a PES6 "${matchedHeader}" (${matchedPlayers.length} jugadores)`);

      for (const p of matchedPlayers) {
        try {
          await db.execute({
            sql: `INSERT OR IGNORE INTO plantel_jugador (id_equipo, nombre) VALUES (?, ?)`,
            args: [team.id_equipo, p],
          });
          totalInserted++;
        } catch (err) {
          // Ignore duplicates
        }
      }
    } else {
      console.log(`⚠️ No se encontró coincidencia directa para el equipo [${team.nombre}]`);
    }
  }

  console.log(`Sincronización finalizada. Jugadores cargados: ${totalInserted}`);
}

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
    const targetNorm = normalizeName(team.nombre);
    if (!targetNorm) return [];

    const candidates = [];
    for (const [header, players] of gameRosters.entries()) {
      const headerNorm = normalizeName(header);
      if (targetNorm.includes('inter') && !headerNorm.includes('inter')) continue;
      if (!targetNorm.includes('inter') && targetNorm.includes('milan') && headerNorm.includes('inter')) continue;

      const keywords = targetNorm.split(/\s+/).filter((w) => w.length > 3 && w !== 'milan' && w !== 'real');
      const matchesWord = keywords.length > 0
        ? keywords.some((k) => headerNorm.includes(k))
        : headerNorm.includes(targetNorm);

      if (matchesWord || headerNorm.includes(targetNorm) || targetNorm.includes(headerNorm)) {
        candidates.push({ header, players });
      }
    }

    if (candidates.length === 0) return [];

    candidates.sort((a, b) => {
      const aHas2000 = /200[0-9]|201[0-9]/.test(a.header) ? 1 : 0;
      const bHas2000 = /200[0-9]|201[0-9]/.test(b.header) ? 1 : 0;
      if (aHas2000 !== bHas2000) return bHas2000 - aHas2000;
      return b.players.length - a.players.length;
    });

    const matchedPlayers = candidates[0].players;
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

// Ejecutar directamente si es llamado vía CLI
if (process.argv[1] && process.argv[1].endsWith('sync-rosters.js')) {
  syncUsedTeamRosters()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error al sincronizar planteles:', err);
      process.exit(1);
    });
}
