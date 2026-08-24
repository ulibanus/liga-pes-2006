import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { id_partido } = req.query;
    const result = id_partido
      ? await db.execute({
          sql: 'SELECT * FROM incidencia WHERE id_partido = ?',
          args: [id_partido],
        })
      : await db.execute('SELECT * FROM incidencia');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { jugador_virtual, tipo, id_persona, id_partido } = req.body;

    if (typeof jugador_virtual !== 'string' || jugador_virtual.trim() === '') {
      return res.status(400).json({ error: 'jugador_virtual is required' });
    }
    if (tipo !== 'G' && tipo !== 'R') {
      return res.status(400).json({ error: "tipo must be 'G' or 'R'" });
    }
    if (!id_persona || !id_partido) {
      return res.status(400).json({ error: 'id_persona and id_partido are required' });
    }

    const result = await db.execute({
      sql: `INSERT INTO incidencia (jugador_virtual, tipo, id_persona, id_partido)
            VALUES (?, ?, ?, ?)`,
      args: [jugador_virtual, tipo, id_persona, id_partido],
    });
    res.status(201).json({
      id_incidencia: Number(result.lastInsertRowid),
      jugador_virtual,
      tipo,
      id_persona,
      id_partido,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'DELETE FROM incidencia WHERE id_incidencia = ?',
      args: [req.params.id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Incidencia not found' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
