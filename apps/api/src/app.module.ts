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
import { EnvVars, NodeEnv, validateEnv } from './config/env.validation';
import { HealthController } from './health.controller';
import { TYPEORM_EXECUTION_SAFETY } from './common/database/typeorm-execution-options';

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
          ...TYPEORM_EXECUTION_SAFETY,
          synchronize: !isProd || config.get('DB_SYNC') === 'true',
          ssl: isProd ? { rejectUnauthorized: false } : false,
          extra: isProd ? { ssl: { rejectUnauthorized: false } } : {},
        };
      },
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