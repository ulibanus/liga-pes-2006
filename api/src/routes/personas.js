import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { id_equipo } = req.query;
    const result = id_equipo
      ? await db.execute({
          sql: 'SELECT * FROM persona WHERE id_equipo = ?',
          args: [id_equipo],
        })
      : await db.execute('SELECT * FROM persona');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM persona WHERE id_persona = ?',
      args: [req.params.id],
    });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Persona not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { nombre, id_equipo } = req.body;
    if (typeof nombre !== 'string' || nombre.trim() === '') {
      return res.status(400).json({ error: 'nombre is required' });
    }

    const result = await db.execute({
      sql: 'INSERT INTO persona (nombre, id_equipo) VALUES (?, ?)',
      args: [nombre, id_equipo ?? null],
    });
    res.status(201).json({
      id_persona: Number(result.lastInsertRowid),
      nombre,
      id_equipo: id_equipo ?? null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { nombre, id_equipo } = req.body;
    if (typeof nombre !== 'string' || nombre.trim() === '') {
      return res.status(400).json({ error: 'nombre is required' });
    }

    const result = await db.execute({
      sql: 'UPDATE persona SET nombre = ?, id_equipo = ? WHERE id_persona = ?',
      args: [nombre, id_equipo ?? null, req.params.id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Persona not found' });
    }
    res.json({ id_persona: Number(req.params.id), nombre, id_equipo: id_equipo ?? null });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'DELETE FROM persona WHERE id_persona = ?',
      args: [req.params.id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Persona not found' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
