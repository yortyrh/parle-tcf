# syntax=docker/dockerfile:1
# Turborepo monorepo build for the NestJS exam API.
# Build context MUST be the repository root.
# Node 26 (LTS) is pinned in every FROM (not a build ARG): Railway overrode the ARG with 22.

# --- Stage 1: Prune ---
FROM node:26-slim AS pruner

RUN npm install -g pnpm@12.18.0 turbo@^2.11.10
WORKDIR /app
COPY . .
RUN turbo prune @parle-tcf/api --docker

# --- Stage 2: Install ---
FROM node:26-slim AS installer

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y ca-certificates python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@12.18.0
WORKDIR /app

COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# --- Stage 3: Build ---
FROM node:26-slim AS builder

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y ca-certificates python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@12.18.0 turbo@^2.11.10
WORKDIR /app

COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN turbo run build --filter=@parle-tcf/api

# --- Stage 4: Runner ---
FROM node:26-slim AS runner

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV CI=true
RUN npm install -g pnpm@12.18.0
WORKDIR /app

ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/app" \
    --shell "/sbin/nologin" \
    --uid "${UID}" \
    appuser

COPY --from=builder /app/ .

RUN chown -R appuser:appuser /app
USER appuser

USER root
RUN pnpm prune --prod
RUN chown -R appuser:appuser /app
USER appuser

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
