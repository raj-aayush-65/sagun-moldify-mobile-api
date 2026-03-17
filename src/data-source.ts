import { DataSource, DataSourceOptions } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config({
  path:
    process.env.NODE_ENV === "production"
      ? ".env.prod"
      : process.env.NODE_ENV === "beta"
        ? ".env.beta"
        : ".env",
});

const options: DataSourceOptions = {
  type: "postgres",
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
  entities: [__dirname + "/**/*.entity{.ts,.js}"],
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
  logging: process.env.NODE_ENV === "development",
};

export const AppDataSource = new DataSource(options);
