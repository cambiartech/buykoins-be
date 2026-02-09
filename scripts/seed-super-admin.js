#!/usr/bin/env node
/**
 * Create the super admin in Postgres (run once per environment).
 * Uses same DB config as run-migrations.js (DATABASE_URL or PostgreSQLEndpoint + PostgresPassword).
 *
 * Usage:
 *   SUPER_ADMIN_PASSWORD='YourSecurePassword' node scripts/seed-super-admin.js
 *   Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in env (e.g. Railway Variables), then run the script.
 *
 * On Railway (one-off): add SUPER_ADMIN_PASSWORD to Variables, then:
 *   railway run node scripts/seed-super-admin.js
 */
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

function getConfig() {
  const databaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();
  if (databaseUrl) {
    return { connectionString: databaseUrl, ssl: { rejectUnauthorized: false } };
  }
  const host = process.env.PostgreSQLEndpoint || process.env.DB_HOST;
  const port = parseInt(process.env.DB_PORT || process.env.PostgresPort || '5432', 10);
  const user = process.env.DB_USERNAME || process.env.PostgresUser || 'postgres';
  const password = process.env.PostgresPassword || process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || process.env.PostgresDatabase || 'buytiktokcoins';
  if (!host || !password) {
    console.error('Set DATABASE_URL or (PostgreSQLEndpoint or DB_HOST) and (PostgresPassword or DB_PASSWORD).');
    process.exit(1);
  }
  return {
    host: host.trim(),
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
  };
}

async function main() {
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();

  if (!email || !password || password.length < 8) {
    console.log('SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set or invalid — skipping seed.');
    process.exit(0);
  }

  const client = new Client(getConfig());
  try {
    await client.connect();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }

  try {
    const existing = await client.query(
      'SELECT id FROM admins WHERE LOWER(email) = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      console.log('Super admin already exists for', email);
      await client.end();
      return;
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await client.query(
      `INSERT INTO admins (email, password, first_name, last_name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [email, hashedPassword, 'Super', 'Admin', 'admin', 'active']
    );
    console.log('Super admin created:', email);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
