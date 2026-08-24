import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'schema.sql');

async function run() {
  const schema = readFileSync(schemaPath, 'utf-8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await db.execute(statement);
  }
  console.log(`Applied schema.sql (${statements.length} statements).`);

  const adminUser = process.env.ADMIN_USER;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPassword) {
    console.log('ADMIN_USER/ADMIN_PASSWORD not set, skipping admin seed.');
    return;
  }

  const existing = await db.execute({
    sql: 'SELECT id_admin FROM admin WHERE username = ?',
    args: [adminUser],
  });

  if (existing.rows.length > 0) {
    console.log(`Admin "${adminUser}" already exists, skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await db.execute({
    sql: 'INSERT INTO admin (username, password_hash) VALUES (?, ?)',
    args: [adminUser, passwordHash],
  });
  console.log(`Created admin "${adminUser}".`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
