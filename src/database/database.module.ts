import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { env } from '../config/env';

/**
 * Runtime DB connection (Neon Postgres in staging/prod).
 * Fintech-grade rules (§03 of the program doc):
 *  - synchronize is ALWAYS false — schema changes ship as migrations only.
 *  - money columns are numeric(18,6), never float.
 *  - ledger rows are append-only; balance changes happen inside DB
 *    transactions with row locks (enforced in the ledger service, Squad C).
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres' as const,
      url: env.database.url,
      ssl: env.database.ssl ? { rejectUnauthorized: false } : false,
      autoLoadEntities: true,
      synchronize: false,
      logging: env.database.logging,
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      migrationsRun: false,
    }),
  ],
})
export class DatabaseModule {}
