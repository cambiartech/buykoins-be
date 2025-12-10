import { Sequelize } from 'sequelize-typescript';
import { ConfigService } from '@nestjs/config';

export const createSequelizeOptions = (configService: ConfigService) => {
  return {
    dialect: 'postgres' as const,
    host: configService.get<string>('database.host'),
    port: configService.get<number>('database.port'),
    username: configService.get<string>('database.username'),
    password: configService.get<string>('database.password'),
    database: configService.get<string>('database.database'),
    ssl: configService.get<boolean>('database.ssl'),
    logging: configService.get<boolean>('database.logging'),
    pool: configService.get('database.pool'),
    models: [], // Will be populated by entities
  };
};

