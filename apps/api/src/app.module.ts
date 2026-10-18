import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from './modules/identity/identity.module';
import { ContractModule } from './modules/contract/contract-module';
import { CrossCuttingModule } from './modules/cross-cutting/cross-cutting.module';
import { EnvVars, NodeEnv, validateEnv } from './config/env.validation';
import { HealthController } from './health.controller';

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
      useFactory: (config: ConfigService) => {
        const isProd = config.get('NODE_ENV') === 'production';
        return {
          type: 'postgres' as const,
          url: config.getOrThrow<string>('DATABASE_URL'),
          autoLoadEntities: true,
          synchronize: !isProd,
          ssl: isProd ? { rejectUnauthorized: false } : false,
          extra: isProd ? { ssl: { rejectUnauthorized: false } } : {},
        };
      },
    }),
    IdentityModule,
    ContractModule,
    CrossCuttingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}