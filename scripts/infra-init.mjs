#!/usr/bin/env node
/**
 * Runs after `docker compose up --wait` (`pnpm infra:up`): applies the Drizzle
 * migrations to the local database, fills an empty exercise bank (the private bank when
 * EXERCISE_DATA_TOKEN is set, otherwise the public sample bank) and creates the audio
 * bucket with its CORS rules, retrying while Postgres and the object storage finish
 * starting. Idempotent; safe to re-run.
 */
import { readFileSync } from 'node:fs';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  SAMPLE_EXERCISE_BANK_PATH,
  createDb,
  fetchExerciseBankSql,
  loadExerciseBank,
  runMigrations,
} from '@parle-tcf/db';
import { devInfra, devStorage, storageCorsRules } from './lib/local-env.mjs';

const infra = devInfra(process.env);
const storage = devStorage(infra);
const url =
  process.env.DATABASE_URL?.trim() ||
  `postgresql://parle:parle@127.0.0.1:${infra.postgresPort}/parle`;

async function retry(label, fn, attempts = 30) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  console.error(`infra:init: ${label} failed:`, lastError);
  process.exit(1);
}

async function ensureBucket() {
  const s3 = new S3Client({
    endpoint: storage.endpoint,
    region: storage.region,
    forcePathStyle: storage.forcePathStyle,
    credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
  });
  const Bucket = storage.bucket;
  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== 'NotFound') throw error;
    await s3.send(new CreateBucketCommand({ Bucket }));
  }
  // The browser uploads with a presigned POST from the web origin and plays back with GET.
  await s3.send(
    new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: { CORSRules: storageCorsRules(infra) },
    })
  );
}

await retry('migrations', () => runMigrations(url));
console.log(`infra:init: migrations applied (${url.replace(/:[^:@/]+@/, ':***@')})`);
/** Fills an empty bank; a bank that already has subjects is left alone. */
async function loadBank() {
  const token = process.env.EXERCISE_DATA_TOKEN?.trim();
  const handle = createDb({ url, max: 1 });
  try {
    const text = token
      ? await fetchExerciseBankSql({ token })
      : readFileSync(SAMPLE_EXERCISE_BANK_PATH, 'utf8');
    const result = await loadExerciseBank(handle.db, text);
    return `${result} (${token ? 'private bank' : 'sample bank'})`;
  } finally {
    await handle.close();
  }
}

try {
  console.log(`infra:init: exercise bank ${await loadBank()}`);
} catch (error) {
  console.error(
    'infra:init: exercise bank failed:',
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}
await retry(`bucket setup on ${storage.endpoint}`, ensureBucket);
console.log(`infra:init: bucket ${storage.bucket} ready on ${storage.endpoint}`);
console.log(`infra:init: Mailpit inbox on http://localhost:${infra.mailpitUiPort}`);
console.log(`infra:init: storage console on http://localhost:${infra.storageConsolePort}`);
process.exit(0);
