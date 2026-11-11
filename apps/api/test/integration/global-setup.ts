import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { StartedTestContainer } from 'testcontainers';
import type { TestProject } from 'vitest/node';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    smtpUrl: string;
    mailpitUrl: string;
  }
}

/** Same images as docker-compose.dev.yml. */
const POSTGRES_IMAGE = 'postgres:17-alpine';
const MAILPIT_IMAGE = 'axllent/mailpit:v1.33.0';

let postgres: StartedPostgreSqlContainer | undefined;
let mailpit: StartedTestContainer | undefined;

function commandOutput(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** Podman directly, or a `docker` CLI that is Podman underneath. */
function usesPodman(): boolean {
  const docker = commandOutput('docker', ['version']);
  if (docker !== null) return /podman/i.test(docker);
  return commandOutput('podman', ['--version']) !== null;
}

/**
 * Starts Postgres 17 and Mailpit once for the whole integration run, applies the
 * real migrations, then loads the sample exercise bank (the real one is private),
 * like a fresh install.
 */
export async function setup(project: TestProject): Promise<void> {
  // Rootless Podman cannot run the Ryuk reaper (teardown stops the containers anyway).
  // Testcontainers reads this when it loads, hence the dynamic imports below.
  if (usesPodman()) process.env.TESTCONTAINERS_RYUK_DISABLED ??= 'true';
  const { GenericContainer, Wait } = await import('testcontainers');
  const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
  const { SAMPLE_EXERCISE_BANK_PATH, createDb, loadExerciseBank, runMigrations } =
    await import('@parle-tcf/db');

  [postgres, mailpit] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).start(),
    new GenericContainer(MAILPIT_IMAGE)
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forHttp('/livez', 8025))
      .start(),
  ]);
  const databaseUrl = postgres.getConnectionUri();
  await runMigrations(databaseUrl);
  const handle = createDb({ url: databaseUrl, max: 1 });
  try {
    await loadExerciseBank(handle.db, readFileSync(SAMPLE_EXERCISE_BANK_PATH, 'utf8'));
  } finally {
    await handle.close();
  }

  project.provide('databaseUrl', databaseUrl);
  project.provide('smtpUrl', `smtp://${mailpit.getHost()}:${mailpit.getMappedPort(1025)}`);
  project.provide('mailpitUrl', `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}`);
}

export async function teardown(): Promise<void> {
  await Promise.all([postgres?.stop(), mailpit?.stop()]);
}
