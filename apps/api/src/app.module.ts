import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from './modules/identity/identity.module';
import { ContractModule } from './modules/contract/contract-module';
import { CrossCuttingModule } from './modules/cross-cutting/cross-cutting.module';
import { EnvVars, NodeEnv, validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvVars, true>) => ({
        type: 'postgres' as const,
        url: config.get('DATABASE_URL', { infer: true }),
        ssl: config.get('DB_SSL', { infer: true })
          ? { rejectUnauthorized: false }
          : false,
        autoLoadEntities: true,
        synchronize:
          config.get('DB_SYNC', { infer: true }) ??
          config.get('NODE_ENV', { infer: true }) !== NodeEnv.Production,
      }),
    }),
    IdentityModule,
    ContractModule,
    CrossCuttingModule,
  ],
  controllers: [],
})
export class AppModule {}
