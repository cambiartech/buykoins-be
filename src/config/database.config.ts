import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  // Railway: prefer DATABASE_URL (from Postgres plugin) or explicit DB_* / RDS-style vars
  let host = process.env.DB_HOST || 'localhost';
  let port = parseInt(process.env.DB_PORT || '5432', 10);
  let username = process.env.DB_USERNAME || 'postgres';
  let password = process.env.DB_PASSWORD;
  let database = process.env.DB_NAME || 'buytiktokcoins';
  let ssl = process.env.DB_SSL === 'true';

  // 1) DATABASE_URL (Railway Postgres plugin or standard)
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      host = url.hostname;
      port = parseInt(url.port || '5432', 10);
      username = url.username;
      password = url.password;
      database = url.pathname.slice(1).replace(/^\//, '') || database;
      ssl = true;
    } catch (error) {
      console.error('Failed to parse DATABASE_URL:', error);
    }
  }
  // 2) Railway/RDS: PostgreSQLEndpoint + PostgresPassword (no DATABASE_URL)
  const pgEndpoint = process.env.PostgreSQLEndpoint || process.env.POSTGRESQLENDPOINT;
  const pgPassword = process.env.PostgresPassword || process.env.POSTGRESPASSWORD;
  if (pgEndpoint) {
    host = String(pgEndpoint).trim();
    port = parseInt(process.env.DB_PORT || process.env.PostgresPort || process.env.POSTGRESPORT || '5432', 10);
    username = process.env.DB_USERNAME || process.env.PostgresUser || process.env.POSTGRESUSER || 'postgres';
    password = pgPassword || process.env.DB_PASSWORD;
    database = process.env.DB_NAME || process.env.PostgresDatabase || process.env.POSTGRESDATABASE || 'buytiktokcoins';
    ssl = true;
  }
  // 3) Explicit DB_* in production: require password and use SSL for remote hosts
  else if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
    if (!password) {
      console.error('DB_PASSWORD (or DATABASE_URL / PostgresPassword) must be set in production.');
    }
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      ssl = ssl || true;
    }
  }

  return {
    host,
    port,
    username,
    password,
    database,
    ssl,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  };
});

