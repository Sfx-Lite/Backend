import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

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
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('database.url'),
        ssl: config.get<boolean>('database.ssl') ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
        synchronize: false,
        logging: config.get<boolean>('database.logging'),
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
