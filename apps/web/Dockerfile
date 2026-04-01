# syntax=docker/dockerfile:1
# Turborepo monorepo build for the Next.js web application.
# Build context must be the repository root.

ARG NODE_VERSION=22

# --- Stage 1: Prune the monorepo to only what @yorty-tcf/web needs ---
FROM node:${NODE_VERSION}-alpine AS pruner

RUN npm install -g pnpm@10 turbo@^2
WORKDIR /app
COPY . .
RUN turbo prune @yorty-tcf/web --docker

# --- Stage 2: Install dependencies ---
FROM node:${NODE_VERSION}-alpine AS installer

RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@10
WORKDIR /app

COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# --- Stage 3: Build ---
FROM node:${NODE_VERSION}-alpine AS builder

RUN npm install -g pnpm@10 turbo@^2
WORKDIR /app

COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .

ENV NEXT_TELEMETRY_DISABLED=1
RUN turbo run build --filter=@yorty-tcf/web

# --- Stage 4: Production runner ---
FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./package.json

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
