---
name: deploy
description: Use when the user asks to deploy, release or publish the app to Railway (api and web services). Never run `railway up` by hand; use `pnpm deploy:railway`.
---

# Deploy

All the logic lives in `scripts/deploy.mjs` (rules in `scripts/lib/deploy.mjs`). Run the script and report its output; do not re-derive the steps.

```bash
pnpm deploy:railway --check   # guards + Railway config only, deploys nothing
pnpm deploy:railway           # api, then web
pnpm deploy:railway api       # one service (or: web)
```

Use `timeout: 600000` or run in the background: builds take minutes. Never pipe the output (`| tail`, `| grep`): the pipe hides the script's exit code and a failed deploy looks like a success. Read the full output.

No watch paths: neither `apps/*/railway.json` (`build.watchPatterns`) nor the Railway service settings may define them. With watch paths Railway skips `railway up` builds it thinks are unchanged, and nothing gets deployed (the script reports `skipped`).

## What the script does

1. Refuses unless the tree is clean and HEAD was verified and pushed with `pnpm push`.
2. Checks Railway: CLI, login, link to `parle-tcf/production`, both services, public domains, required variables, and that `BETTER_AUTH_URL`, `WEB_URL`, `CORS_ORIGINS` and `NEXT_PUBLIC_EXAM_API_URL` match the real URLs.
3. Runs `railway up` for api (pre-deploy applies the migrations), then web; waits for `SUCCESS` and probes `/health` and `/`.

## Steps

1. Run `pnpm deploy:railway --check` first when unsure about the Railway state.
2. If it fails on git guards: use the `commit` / `push` skills, never bypass.
3. If it fails on Railway configuration, it prints each problem with its fix. Variables are set by the user or with `railway variables set KEY=value -s <service>`; secrets are generated with `openssl rand -base64 32`. Ask the user for values you cannot know (mail provider, domains) and never print secret values back.
4. If it says not logged in, tell the user to run `! railway login`.
5. Run the deploy and report the real outcome (which service, commit, URL). On failure show `railway logs -s <service>` output.

## Red flags, stop

- `railway up` typed by hand, or editing variables to make `--check` pass without telling the user.
- Deploying an unverified or unpushed commit.
- Setting `VOICE_PROVIDER=fake` in production.
