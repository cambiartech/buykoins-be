import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  // Railway provides DATABASE_URL, parse it if available
  let host = process.env.DB_HOST || 'localhost';
  let port = parseInt(process.env.DB_PORT || '5432', 10);
  let username = process.env.DB_USERNAME || 'postgres';
  let password = process.env.DB_PASSWORD;
  let database = process.env.DB_NAME || 'buytiktokcoins';
  let ssl = process.env.DB_SSL === 'true';

  // Parse Railway's DATABASE_URL if provided
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      host = url.hostname;
      port = parseInt(url.port || '5432', 10);
      username = url.username;
      password = url.password;
      database = url.pathname.slice(1); // Remove leading '/'
      ssl = true; // Railway always uses SSL
    } catch (error) {
      console.error('Failed to parse DATABASE_URL:', error);
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

