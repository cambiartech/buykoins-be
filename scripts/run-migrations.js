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
  const databaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();
  const isLocal = (urlOrHost) => {
    const s = (urlOrHost || '').toString();
    return s.includes('localhost') || s === '127.0.0.1';
  };
  if (databaseUrl) {
    const ssl = isLocal(databaseUrl) ? false : { rejectUnauthorized: false };
    return { connectionString: databaseUrl, ssl };
  }
  // On Railway we only use DATABASE_URL (never PostgreSQLEndpoint/DB_HOST — remove those in Variables)
  if (process.env.RAILWAY_ENVIRONMENT) {
    console.error(
      'On Railway, DATABASE_URL must be set (e.g. your Postgres service URL). ' +
        'Remove PostgreSQLEndpoint, PostgresPassword, and DB_HOST from this service Variables so only DATABASE_URL is used.',
    );
    process.exit(1);
  }
  const host = (process.env.PostgreSQLEndpoint || process.env.DB_HOST || '').trim();
  const port = parseInt(process.env.DB_PORT || process.env.PostgresPort || '5432', 10);
  const user = process.env.DB_USERNAME || process.env.PostgresUser || 'postgres';
  const password = process.env.PostgresPassword || process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || process.env.PostgresDatabase || 'buytiktokcoins';
  if (!host) {
    console.error('Set DATABASE_URL or (PostgreSQLEndpoint or DB_HOST).');
    process.exit(1);
  }
  if (!isLocal(host) && (password === undefined || password === null)) {
    console.error('PostgresPassword or DB_PASSWORD required for non-local host.');
    process.exit(1);
  }
  return {
    host,
    port,
    user,
    password: password || undefined,
    database,
    ssl: isLocal(host) ? false : { rejectUnauthorized: false },
  };
}

// Order for existing migrations (dependency order). New files not listed here run last, sorted by name.
const KNOWN_ORDER = [
  'create-users-and-admins-tables.sql',
  'create-platform-settings-table.sql',
  'create-remaining-core-tables.sql',
  'add-credit-request-admin-proof-url.sql',
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
  'add-notifications-related-user-id.sql',
  'add-tiktok-fields-to-users.sql',
];

const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

function getOrderedMigrations(migrationsDir) {
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
  const known = KNOWN_ORDER.filter((f) => files.includes(f));
  const extra = files.filter((f) => !KNOWN_ORDER.includes(f)).sort();
  return [...known, ...extra];
}

function isAlreadyAppliedError(err) {
  return (
    err.code === '42P07' ||
    (err.message && err.message.includes('already exists'))
  );
}

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

  try {
    await client.query(MIGRATIONS_TABLE);
  } catch (err) {
    console.error('Failed to create schema_migrations table:', err.message);
    await client.end();
    process.exit(1);
  }

  if (!fs.existsSync(migrationsDir)) {
    console.error('Migrations directory not found:', migrationsDir);
    await client.end();
    process.exit(1);
  }
  const ordered = getOrderedMigrations(migrationsDir);
  let ran = 0;
  let skipped = 0;

  for (const name of ordered) {
    const filePath = path.join(migrationsDir, name);
    const sql = fs.readFileSync(filePath, 'utf8');

    const row = await client.query(
      'SELECT 1 FROM schema_migrations WHERE name = $1',
      [name]
    );
    if (row.rows.length > 0) {
      skipped++;
      continue;
    }

    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      console.log('Ran:', name);
      ran++;
    } catch (err) {
      if (isAlreadyAppliedError(err)) {
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]).catch(() => {});
        console.log('Skip (already applied):', name);
        skipped++;
      } else {
        console.error('Migration failed:', name, err.message);
        await client.end();
        process.exit(1);
      }
    }
  }

  await client.end();
  console.log('Migrations finished. Ran:', ran, 'Skipped (already applied):', skipped);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


// railway run npm run db:seed-super-admin