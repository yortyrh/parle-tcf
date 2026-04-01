# syntax=docker/dockerfile:1
# Turborepo monorepo build for the LiveKit agent service.
# Build context must be the repository root.

ARG NODE_VERSION=22

# --- Stage 1: Prune the monorepo to only what @yorty-tcf/agent needs ---
FROM node:${NODE_VERSION}-slim AS pruner

RUN npm install -g pnpm@10 turbo@^2
WORKDIR /app
COPY . .
RUN turbo prune @yorty-tcf/agent --docker

# --- Stage 2: Install dependencies from the pruned lockfile ---
FROM node:${NODE_VERSION}-slim AS installer

# Native build dependencies for better-sqlite3
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y ca-certificates python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10
WORKDIR /app

COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# --- Stage 3: Build ---
FROM node:${NODE_VERSION}-slim AS builder

RUN npm install -g pnpm@10 turbo@^2
WORKDIR /app

COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN turbo run build --filter=@yorty-tcf/agent

# --- Stage 4: Production runner ---
FROM node:${NODE_VERSION}-slim AS runner

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10
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

# Pre-download ML model files
RUN cd apps/agent && pnpm download-files

USER root
RUN cd apps/agent && pnpm prune --prod
RUN chown -R appuser:appuser /app
USER appuser

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "apps/agent/dist/agent.js", "start"]
