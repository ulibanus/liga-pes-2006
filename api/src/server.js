import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import equiposRouter from './routes/equipos.js';
import personasRouter from './routes/personas.js';
import partidosRouter from './routes/partidos.js';
import incidenciasRouter from './routes/incidencias.js';

const app = express();

app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN }));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/auth', authRouter);
app.use('/equipos', equiposRouter);
app.use('/personas', personasRouter);
app.use('/partidos', partidosRouter);
app.use('/incidencias', incidenciasRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
