import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from './modules/identity/identity.module';
import { ContractModule } from './modules/contract/contract-module';
import { CrossCuttingModule } from './modules/cross-cutting/cross-cutting.module';
import { AdminModule } from './modules/admin/admin.module';
import { ComplianceModule } from './modules/compliance/compliance-module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { FinancialModule } from './modules/financial/financial.module';
import { HseModule } from './modules/hse/hse.module';
import { SiteOperationsModule } from './modules/site-operations/site-operations.module';
import { validateEnv } from './config/env.validation';
import { HealthController } from './health.controller';
import { createRuntimeDatabaseOptions } from './common/database/runtime-database-options';

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
      useFactory: (config: ConfigService) =>
        createRuntimeDatabaseOptions({
          nodeEnv: config.get<string>('NODE_ENV') ?? 'development',
          databaseUrl: config.getOrThrow<string>('DATABASE_URL'),
        }),
    }),
    IdentityModule,
    ContractModule,
    CrossCuttingModule,
    AdminModule,
    ComplianceModule,
    DeliveryModule,
    FinancialModule,
    HseModule,
    SiteOperationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}