import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import dotenv from "dotenv";
import { AppModule } from "./app.module.js";

const _dir = dirname(fileURLToPath(import.meta.url));
const localEnv = resolve(_dir, "..", ".env");
const rootEnv = resolve(_dir, "..", "..", "..", ".env");
dotenv.config({ path: existsSync(localEnv) ? localEnv : rootEnv });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const origins = process.env.CORS_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins && origins.length > 0 ? origins : true,
    credentials: true,
  });

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);
  Logger.log(`listening on http://localhost:${port}`, "Bootstrap");
}

void bootstrap();
