#!/usr/bin/env node
/**
 * Runs after `docker compose up --wait` (`pnpm infra:up`): applies the Drizzle
 * migrations to the local database and creates the audio bucket with its CORS
 * rules, retrying while Postgres and the object storage finish starting.
 * Idempotent; safe to re-run.
 */
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { runMigrations } from '@parle-tcf/db';
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
await retry(`bucket setup on ${storage.endpoint}`, ensureBucket);
console.log(`infra:init: bucket ${storage.bucket} ready on ${storage.endpoint}`);
console.log(`infra:init: Mailpit inbox on http://localhost:${infra.mailpitUiPort}`);
console.log(`infra:init: storage console on http://localhost:${infra.storageConsolePort}`);
process.exit(0);
