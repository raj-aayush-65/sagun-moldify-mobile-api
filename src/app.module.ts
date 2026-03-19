import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Config Module - loads .env file
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.beta', '.env.prod'],
    }),

    // TypeORM Configuration using DATABASE_URL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');

        return {
          type: 'postgres',
          url: databaseUrl,
          ssl: databaseUrl?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          synchronize: false,
          migrationsRun: true, // Auto-run migrations on startup
          // Enable migration and schema logging
          logging: ['migration', 'schema', 'warn', 'error', 'log'],
        };
      },
    }),

    // Feature Modules
    AuthModule,
    UsersModule,
    EmployeesModule,
    AttendanceModule,
    PayrollModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
