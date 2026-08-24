import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { numero_fecha } = req.query;
    const result = numero_fecha
      ? await db.execute({
          sql: 'SELECT * FROM partido WHERE numero_fecha = ?',
          args: [numero_fecha],
        })
      : await db.execute('SELECT * FROM partido');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM partido WHERE id_partido = ?',
      args: [req.params.id],
    });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partido not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { goles_local, goles_visitante, numero_fecha, estado, id_local, id_visitante } =
      req.body;

    if (!id_local || !id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante are required' });
    }
    if (id_local === id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante must differ' });
    }

    const result = await db.execute({
      sql: `INSERT INTO partido (goles_local, goles_visitante, numero_fecha, estado, id_local, id_visitante)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        goles_local ?? 0,
        goles_visitante ?? 0,
        numero_fecha ?? null,
        estado ?? null,
        id_local,
        id_visitante,
      ],
    });
    res.status(201).json({
      id_partido: Number(result.lastInsertRowid),
      goles_local: goles_local ?? 0,
      goles_visitante: goles_visitante ?? 0,
      numero_fecha: numero_fecha ?? null,
      estado: estado ?? null,
      id_local,
      id_visitante,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { goles_local, goles_visitante, numero_fecha, estado, id_local, id_visitante } =
      req.body;

    if (!id_local || !id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante are required' });
    }
    if (id_local === id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante must differ' });
    }

    const result = await db.execute({
      sql: `UPDATE partido
            SET goles_local = ?, goles_visitante = ?, numero_fecha = ?, estado = ?, id_local = ?, id_visitante = ?
            WHERE id_partido = ?`,
      args: [
        goles_local ?? 0,
        goles_visitante ?? 0,
        numero_fecha ?? null,
        estado ?? null,
        id_local,
        id_visitante,
        req.params.id,
      ],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Partido not found' });
    }
    res.json({
      id_partido: Number(req.params.id),
      goles_local: goles_local ?? 0,
      goles_visitante: goles_visitante ?? 0,
      numero_fecha: numero_fecha ?? null,
      estado: estado ?? null,
      id_local,
      id_visitante,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'DELETE FROM partido WHERE id_partido = ?',
      args: [req.params.id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Partido not found' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
