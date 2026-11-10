# syntax=docker/dockerfile:1
# Turborepo monorepo build for the Next.js web application.
# Build context MUST be the repository root.

ARG NODE_VERSION=24

# --- Stage 1: Prune the monorepo to only what @parle-tcf/web needs ---
FROM node:${NODE_VERSION}-alpine AS pruner

RUN npm install -g pnpm@10 turbo@^2
WORKDIR /app
COPY . .
RUN turbo prune @parle-tcf/web --docker

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
# Browser must know the public API URL at build time (inlined into the client bundle).
ARG NEXT_PUBLIC_EXAM_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_EXAM_API_URL=$NEXT_PUBLIC_EXAM_API_URL
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# Show the GitHub/Google buttons only when the API has the matching credentials.
ARG NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED=false
ENV NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED=$NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED
ARG NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED=false
ENV NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED=$NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED
RUN turbo run build --filter=@parle-tcf/web

# --- Stage 4: Production runner ---
FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./package.json

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
