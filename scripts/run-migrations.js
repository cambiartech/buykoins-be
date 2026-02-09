#!/usr/bin/env node
/**
 * Run SQL migrations in order using the same env vars as the app (Railway/RDS).
 * Runs automatically on every Railway deploy (see railway.toml startCommand → npm run deploy).
 * Manual: railway run npm run db:migrate  or  DATABASE_URL=... node scripts/run-migrations.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } };
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

const MIGRATION_ORDER = [
  'create-notifications-table.sql',
  'add-admin-password-otp-fields.sql',
  'add-settings-columns.sql',
  'add-support-system-tables.sql',
  'add-widget-system-tables.sql',
  'add-widget-settings-to-platform-settings.sql',
  'add-sudo-cards-tables.sql',
  'add-sudo-onboarding-data-to-users.sql',
  'add-wallet-and-earnings-balance.sql',
  'add-transaction-finance-fields.sql',
  'add-last-activity-to-widget-sessions.sql',
  'add-bvn-nin-onboarding-requirements.sql',
  'fix-support-timestamps-timezone.sql',
];

async function main() {
  const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
  const config = getConfig();
  const client = new Client(config);

  try {
    await client.connect();
    console.log('Connected to database.');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }

  for (const name of MIGRATION_ORDER) {
    const filePath = path.join(migrationsDir, name);
    if (!fs.existsSync(filePath)) continue;
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await client.query(sql);
      console.log('Ran:', name);
    } catch (err) {
      if (err.code === '42P07' || err.message.includes('already exists')) {
        console.log('Skip (already applied):', name);
      } else {
        console.error('Migration failed:', name, err.message);
        await client.end();
        process.exit(1);
      }
    }
  }

  await client.end();
  console.log('Migrations finished.');
}

main();
