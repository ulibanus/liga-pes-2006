import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { syncSingleTeam } from '../services/sync-rosters.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { id_juego } = req.query;
    let sql = `
      SELECT e.id_equipo, e.nombre, e.id_juego, j.nombre as juego_nombre
      FROM equipo e
      LEFT JOIN juego j ON e.id_juego = j.id_juego
    `;
    const args = [];
    if (id_juego) {
      sql += ' WHERE e.id_juego = ?';
      args.push(id_juego);
    }
    sql += ' ORDER BY e.nombre ASC';
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: `SELECT e.id_equipo, e.nombre, e.id_juego, j.nombre as juego_nombre
            FROM equipo e
            LEFT JOIN juego j ON e.id_juego = j.id_juego
            WHERE e.id_equipo = ?`,
      args: [req.params.id],
    });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /equipos/:id/plantel - Obtiene la lista de jugadores de este club
router.get('/:id/plantel', async (req, res, next) => {
  try {
    let result = await db.execute({
      sql: 'SELECT id_plantel_jugador, nombre, dorsal, posicion FROM plantel_jugador WHERE id_equipo = ? ORDER BY nombre ASC',
      args: [req.params.id],
    });
    if (result.rows.length === 0) {
      const synced = await syncSingleTeam(req.params.id);
      if (synced && synced.length > 0) {
        return res.json(synced);
      }
    }
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { nombre, id_juego } = req.body;
    if (typeof nombre !== 'string' || nombre.trim() === '') {
      return res.status(400).json({ error: 'nombre is required' });
    }

    const cleanName = nombre.trim();
    const cleanJuego = id_juego ? Number(id_juego) : 1;

    const result = await db.execute({
      sql: 'INSERT INTO equipo (nombre, id_juego) VALUES (?, ?)',
      args: [cleanName, cleanJuego],
    });
    res.status(201).json({ id_equipo: Number(result.lastInsertRowid), nombre: cleanName, id_juego: cleanJuego });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { nombre } = req.body;
    if (typeof nombre !== 'string' || nombre.trim() === '') {
      return res.status(400).json({ error: 'nombre is required' });
    }

    const result = await db.execute({
      sql: 'UPDATE equipo SET nombre = ? WHERE id_equipo = ?',
      args: [nombre, req.params.id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Equipo not found' });
    }
    res.json({ id_equipo: Number(req.params.id), nombre });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'DELETE FROM equipo WHERE id_equipo = ?',
      args: [req.params.id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Equipo not found' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
