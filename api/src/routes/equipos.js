import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await db.execute('SELECT * FROM equipo');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM equipo WHERE id_equipo = ?',
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

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { nombre } = req.body;
    if (typeof nombre !== 'string' || nombre.trim() === '') {
      return res.status(400).json({ error: 'nombre is required' });
    }

    const result = await db.execute({
      sql: 'INSERT INTO equipo (nombre) VALUES (?)',
      args: [nombre],
    });
    res.status(201).json({ id_equipo: Number(result.lastInsertRowid), nombre });
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
