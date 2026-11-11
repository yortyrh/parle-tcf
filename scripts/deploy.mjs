#!/usr/bin/env node
/**
 * `pnpm deploy:railway [all|api|web] [--check]`: deploy to Railway.
 *
 * 1. Guards: clean tree, HEAD verified by `pnpm push` and pushed to origin.
 * 2. Railway: CLI installed and logged in, project linked, both services have
 *    a public domain and the variables the API/web need (scripts/lib/deploy.mjs).
 * 3. Deploys api, then web (the web build inlines the API URL), waits for each
 *    deployment to turn healthy and probes the public URLs.
 *
 * `--check` stops after step 2. Exit code 0 = ok, 1 = problem (printed with the fix).
 */
import { spawnSync } from 'node:child_process';
import {
  RAILWAY_ENVIRONMENT,
  RAILWAY_PROJECT,
  SERVICES,
  checkApiVariables,
  checkConsistency,
  checkWebVariables,
  deploymentOutcome,
  formatProblems,
  parseKv,
  pickPublicUrl,
  servicesFor,
} from './lib/deploy.mjs';
import { git, isWorkingTreeClean, readStamp } from './lib/push-stamp.mjs';

const POLL_MS = 10_000;
const DEPLOY_TIMEOUT_MS = 15 * 60_000;

function fail(message) {
  console.error(`\npnpm deploy:railway: ${message}`);
  process.exit(1);
}

function railway(args, { inherit = false } = {}) {
  const result = spawnSync('railway', args, {
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) fail(`could not run \`railway\`: ${result.error.message}`);
  return {
    ok: result.status === 0,
    out: (result.stdout ?? '').trim(),
    err: (result.stderr ?? '').trim(),
  };
}

function railwayJson(args) {
  const { ok, out, err } = railway([...args, '--json']);
  if (!ok) fail(`railway ${args.join(' ')} failed: ${err || out}`);
  return JSON.parse(out);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
let services;
try {
  services = servicesFor(argv.find((a) => !a.startsWith('--')));
} catch (error) {
  fail(error.message);
}

// --- 1. Git guards -----------------------------------------------------------
const head = git(['rev-parse', 'HEAD']);
const gitProblems = [];
if (!isWorkingTreeClean())
  gitProblems.push('the working tree has uncommitted changes (commit them first)');
if (readStamp() !== head)
  gitProblems.push('HEAD was not verified: run `pnpm push` (runs `pnpm verify`) first');
else if (git(['branch', '-r', '--contains', head]) === '') {
  gitProblems.push('HEAD is not on origin: run `pnpm push` first');
}
if (gitProblems.length > 0) fail(`refusing to deploy:\n  - ${gitProblems.join('\n  - ')}`);

// --- 2. Railway preflight ----------------------------------------------------
if (!railway(['--version']).ok) fail('Railway CLI not found. Install it: brew install railway');
if (!railway(['whoami']).ok) fail('not logged in to Railway. Run: ! railway login');

let status = railway(['status', '--json']);
const linkedTo = () => {
  try {
    const parsed = JSON.parse(status.out);
    return parsed.name === RAILWAY_PROJECT || parsed.projectName === RAILWAY_PROJECT;
  } catch {
    return false;
  }
};
if (!status.ok || !linkedTo()) {
  console.log(`Linking this directory to ${RAILWAY_PROJECT}/${RAILWAY_ENVIRONMENT}...`);
  railway(['link', '-p', RAILWAY_PROJECT, '-e', RAILWAY_ENVIRONMENT]);
  status = railway(['status', '--json']);
  if (!status.ok || !linkedTo())
    fail(`could not link project "${RAILWAY_PROJECT}". Run: ! railway link`);
}

const existing = railway(['service', 'list']).out;
const missingServices = SERVICES.filter((name) => !new RegExp(`^${name}\\b`, 'm').test(existing));
if (missingServices.length > 0) {
  fail(
    `services missing in ${RAILWAY_PROJECT}/${RAILWAY_ENVIRONMENT}: ${missingServices.join(', ')}`
  );
}

const vars = Object.fromEntries(
  SERVICES.map((name) => [name, parseKv(railway(['variables', '-s', name, '--kv']).out)])
);
const urls = Object.fromEntries(
  SERVICES.map((name) => [name, pickPublicUrl(railwayJson(['domain', 'list', '-s', name]))])
);
const problems = [
  ...checkApiVariables(vars.api),
  ...checkWebVariables(vars.web),
  ...checkConsistency({ apiVars: vars.api, webVars: vars.web, apiUrl: urls.api, webUrl: urls.web }),
];
if (problems.length > 0) {
  fail(`Railway configuration is incomplete:\n${formatProblems(problems)}`);
}
console.log(`Config ok. api: ${urls.api}  web: ${urls.web}  commit: ${head.slice(0, 7)}`);
if (checkOnly) process.exit(0);

// --- 3. Deploy ---------------------------------------------------------------
async function latestDeployment(service) {
  const [latest] = railwayJson(['deployment', 'list', '-s', service]);
  return latest ?? null;
}

async function probe(url, path) {
  try {
    const response = await fetch(`${url}${path}`, { signal: AbortSignal.timeout(15_000) });
    return response.ok;
  } catch {
    return false;
  }
}

for (const service of services) {
  const before = (await latestDeployment(service))?.id ?? null;
  console.log(`\n=== Deploying ${service} ===`);
  const up = railway(['up', '-s', service, '-e', RAILWAY_ENVIRONMENT, '--ci'], { inherit: true });
  if (!up.ok) fail(`railway up failed for ${service}. See the build log above.`);

  const deadline = Date.now() + DEPLOY_TIMEOUT_MS;
  let outcome = 'pending';
  while (outcome === 'pending' && Date.now() < deadline) {
    const latest = await latestDeployment(service);
    if (latest && latest.id !== before) outcome = deploymentOutcome(latest.status);
    if (outcome === 'pending') await sleep(POLL_MS);
  }
  if (outcome !== 'ok') {
    fail(
      `${service} deployment ${outcome === 'failed' ? 'failed' : 'timed out'}. ` +
        `Logs: railway logs -s ${service}`
    );
  }
  const healthPath = service === 'api' ? '/health' : '/';
  if (!(await probe(urls[service], healthPath))) {
    fail(`${service} deployed but ${urls[service]}${healthPath} did not answer 2xx.`);
  }
  console.log(`${service} healthy: ${urls[service]}${healthPath}`);
}

console.log(`\nDeployed ${services.join(' + ')} at ${head.slice(0, 7)}.`);
