import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

function toPropuestaResponse(row) {
  return {
    id_propuesta: row.id_propuesta,
    id_local: row.id_local,
    id_visitante: row.id_visitante,
    goles_local: row.goles_local,
    goles_visitante: row.goles_visitante,
    numero_fecha: row.numero_fecha,
    goleadores: JSON.parse(row.goleadores_json),
    rojas: JSON.parse(row.rojas_json),
    nombre_solicitante: row.nombre_solicitante,
    estado: row.estado,
    creado_en: row.creado_en,
  };
}

router.post('/', async (req, res, next) => {
  try {
    const {
      id_local,
      id_visitante,
      goles_local,
      goles_visitante,
      numero_fecha,
      goleadores,
      rojas,
      nombre_solicitante,
    } = req.body;

    if (!id_local || !id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante are required' });
    }
    if (id_local === id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante must differ' });
    }
    if (!nombre_solicitante || !nombre_solicitante.trim()) {
      return res.status(400).json({ error: 'nombre_solicitante is required' });
    }

    const goleadoresArr = goleadores ?? [];
    const rojasArr = rojas ?? [];

    const result = await db.execute({
      sql: `INSERT INTO propuesta_partido
              (id_local, id_visitante, goles_local, goles_visitante, numero_fecha, goleadores_json, rojas_json, nombre_solicitante, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      args: [
        id_local,
        id_visitante,
        goles_local ?? 0,
        goles_visitante ?? 0,
        numero_fecha ?? null,
        JSON.stringify(goleadoresArr),
        JSON.stringify(rojasArr),
        nombre_solicitante ?? null,
      ],
    });

    res.status(201).json({
      id_propuesta: Number(result.lastInsertRowid),
      id_local,
      id_visitante,
      goles_local: goles_local ?? 0,
      goles_visitante: goles_visitante ?? 0,
      numero_fecha: numero_fecha ?? null,
      goleadores: goleadoresArr,
      rojas: rojasArr,
      nombre_solicitante: nombre_solicitante ?? null,
      estado: 'pendiente',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { estado } = req.query;
    const result = estado
      ? await db.execute({
          sql: 'SELECT * FROM propuesta_partido WHERE estado = ?',
          args: [estado],
        })
      : await db.execute('SELECT * FROM propuesta_partido');
    res.json(result.rows.map(toPropuestaResponse));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/aprobar', requireAdmin, async (req, res, next) => {
  try {
    const propuestaResult = await db.execute({
      sql: 'SELECT * FROM propuesta_partido WHERE id_propuesta = ?',
      args: [req.params.id],
    });
    if (propuestaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Propuesta not found' });
    }
    const propuesta = propuestaResult.rows[0];
    if (propuesta.estado !== 'pendiente') {
      return res.status(409).json({ error: 'Esta propuesta ya fue procesada' });
    }

    const conflicto = await db.execute({
      sql: `SELECT * FROM partido
            WHERE numero_fecha = ?
              AND ((id_local = ? AND id_visitante = ?) OR (id_local = ? AND id_visitante = ?))`,
      args: [
        propuesta.numero_fecha,
        propuesta.id_local,
        propuesta.id_visitante,
        propuesta.id_visitante,
        propuesta.id_local,
      ],
    });
    if (conflicto.rows.length > 0) {
      return res
        .status(409)
        .json({ error: 'Ya existe un resultado cargado para esa fecha entre estos rivales' });
    }

    const partidoResult = await db.execute({
      sql: `INSERT INTO partido (goles_local, goles_visitante, numero_fecha, estado, id_local, id_visitante)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        propuesta.goles_local,
        propuesta.goles_visitante,
        propuesta.numero_fecha,
        null,
        propuesta.id_local,
        propuesta.id_visitante,
      ],
    });
    const id_partido = Number(partidoResult.lastInsertRowid);

    const goleadores = JSON.parse(propuesta.goleadores_json);
    const rojas = JSON.parse(propuesta.rojas_json);

    for (const g of goleadores) {
      for (let n = 0; n < g.cantidad; n++) {
        await db.execute({
          sql: `INSERT INTO incidencia (jugador_virtual, tipo, id_persona, id_partido)
                VALUES (?, 'G', ?, ?)`,
          args: [g.jugador, g.personaId, id_partido],
        });
      }
    }
    for (const r of rojas) {
      await db.execute({
        sql: `INSERT INTO incidencia (jugador_virtual, tipo, id_persona, id_partido)
              VALUES (?, 'R', ?, ?)`,
        args: [r.jugador, r.personaId, id_partido],
      });
    }

    await db.execute({
      sql: `UPDATE propuesta_partido SET estado = 'aprobado' WHERE id_propuesta = ?`,
      args: [req.params.id],
    });

    res.status(201).json({
      id_partido,
      goles_local: propuesta.goles_local,
      goles_visitante: propuesta.goles_visitante,
      numero_fecha: propuesta.numero_fecha,
      estado: null,
      id_local: propuesta.id_local,
      id_visitante: propuesta.id_visitante,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/rechazar', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: `UPDATE propuesta_partido SET estado = 'rechazado' WHERE id_propuesta = ?`,
      args: [req.params.id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Propuesta not found' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'DELETE FROM propuesta_partido WHERE id_propuesta = ?',
      args: [req.params.id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Propuesta not found' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
