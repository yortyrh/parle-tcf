#!/usr/bin/env node
/**
 * `pnpm storage:cors`: applies the audio bucket CORS rules (GET and POST from
 * every origin in CORS_ORIGINS) to the bucket in S3_*, then reads them back.
 * Production: `railway run --service api --environment production -- pnpm storage:cors`.
 * Re-run it whenever the web URL changes. Local buckets get their rules from `pnpm infra:up`.
 */
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';
import { corsMatches, corsRulesFor, storageTargetFromEnv } from './lib/storage-cors.mjs';

let target;
try {
  target = storageTargetFromEnv(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: target.endpoint,
  region: target.region,
  forcePathStyle: target.forcePathStyle,
  credentials: { accessKeyId: target.accessKeyId, secretAccessKey: target.secretAccessKey },
});
const rules = corsRulesFor(target.origins);

try {
  await s3.send(
    new PutBucketCorsCommand({ Bucket: target.bucket, CORSConfiguration: { CORSRules: rules } })
  );
  const applied = await s3.send(new GetBucketCorsCommand({ Bucket: target.bucket }));
  if (!corsMatches(applied.CORSRules, rules)) {
    console.error('storage:cors: the bucket returned different rules:', applied.CORSRules);
    process.exit(1);
  }
} catch (error) {
  console.error(
    `storage:cors: ${target.bucket} failed:`,
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}
console.log(`storage:cors: ${target.bucket} allows GET and POST from ${target.origins.join(', ')}`);
