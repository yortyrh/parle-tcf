#!/usr/bin/env bash
# Runs `docker compose` (or `podman compose` when Docker is not installed)
# against docker-compose.dev.yml. Extra arguments are passed through.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.dev.yml"
API_ENV="$REPO_ROOT/apps/api/.env"

# Port overrides saved in apps/api/.env (see `pnpm setup:env`); the shell environment wins.
if [[ -f "$API_ENV" ]]; then
  for key in POSTGRES_PORT MAILPIT_SMTP_PORT MAILPIT_UI_PORT STORAGE_PORT STORAGE_CONSOLE_PORT; do
    if [[ -z "${!key:-}" ]]; then
      value="$(grep -E "^${key}=" "$API_ENV" | tail -n1 | cut -d= -f2- || true)"
      [[ -n "$value" ]] && export "$key=$value"
    fi
  done
fi

if command -v docker >/dev/null 2>&1; then
  exec docker compose -f "$COMPOSE_FILE" "$@"
elif command -v podman >/dev/null 2>&1; then
  exec podman compose -f "$COMPOSE_FILE" "$@"
else
  echo "error: neither docker nor podman is installed" >&2
  exit 1
fi
