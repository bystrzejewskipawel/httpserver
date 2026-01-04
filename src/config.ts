import type { MigrationConfig } from "drizzle-orm/migrator";

type Config = {
  api: APIConfig;
  db: DBConfig;
};

type APIConfig = {
  fileServerHits: number;
  port: number;
  platform: string;
  secret: string;
  polkaKey: string;
};

type DBConfig = {
  url: string;
  migrationConfig: MigrationConfig;
};

process.loadEnvFile();

function envOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Key: ${key} is missing`);
  }
  return value;
}

const migrationConfig: MigrationConfig = {
  migrationsFolder: "./src/db/migrations",
};

export const config: Config = { api: {fileServerHits: 0, port: Number(envOrThrow("PORT")), platform: envOrThrow("PLATFORM"), secret: envOrThrow("SECRET"), polkaKey: envOrThrow("POLKA_KEY")}, db: { url: envOrThrow("DB_URL"), migrationConfig: migrationConfig}};