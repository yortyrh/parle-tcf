import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "reflect-metadata";
import { Logger } from "nestjs-pino";
import { NestFactory } from "@nestjs/core";
import { toNodeHandler } from "better-auth/node";
import dotenv from "dotenv";
import helmet from "helmet";

const _dir = dirname(fileURLToPath(import.meta.url));
const localEnv = resolve(_dir, "..", ".env");
const rootEnv = resolve(_dir, "..", "..", "..", ".env");
dotenv.config({ path: existsSync(localEnv) ? localEnv : rootEnv });

async function bootstrap(): Promise<void> {
  // Imported after dotenv so module-level env reads see the loaded values.
  const { AppModule } = await import("./app.module.js");
  const { AUTH_BASE_PATH, BETTER_AUTH } = await import("./auth/better-auth.js");
  const { getEnv, parseCorsOrigins } = await import("./config/env.js");

  const env = getEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  // JSON API only: helmet's defaults (no sniffing, no framing, strict CSP) are safe here.
  app.use(helmet());

  app.enableCors({
    origin: parseCorsOrigins(env),
    credentials: true,
    exposedHeaders: ["set-auth-token"],
  });

  // Better Auth parses its own body, so it is mounted before Nest's parsers.
  app
    .getHttpAdapter()
    .getInstance()
    .all(`${AUTH_BASE_PATH}/*splat`, toNodeHandler(app.get(BETTER_AUTH)));

  await app.listen(env.PORT);
  app.get(Logger).log(`listening on http://localhost:${env.PORT}`, "Bootstrap");
}

void bootstrap();
