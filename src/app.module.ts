import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    // Config Module - loads .env file
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.beta", ".env.prod"],
    }),

    // TypeORM Configuration using DATABASE_URL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>("DATABASE_URL");

        return {
          type: "postgres",
          url: databaseUrl,
          ssl: databaseUrl?.includes("sslmode=require")
            ? { rejectUnauthorized: false }
            : false,
          entities: [__dirname + "/**/*.entity{.ts,.js}"],
          synchronize: false, // Use migrations instead
          logging: configService.get<string>("NODE_ENV") === "development",
        };
      },
    }),

    // Feature Modules
    AuthModule,
    UsersModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
