# Dockerfile for Next.js Web Application
# syntax=docker/dockerfile:1

# Use the official Node.js v22 base image
ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-slim AS base

# Configure pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install system dependencies
RUN apt-get update -qq && apt-get install --no-install-recommends -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@10

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application files
COPY . .

# Build the Next.js application
RUN pnpm build

# Create non-privileged user
ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/app" \
    --shell "/sbin/nologin" \
    --uid "${UID}" \
    appuser

# Set proper permissions
RUN chown -R appuser:appuser /app

# Note: We don't run pnpm prune --prod for Next.js because TypeScript
# is needed at runtime to load next.config.ts

USER appuser

# Set Node.js to production mode
ENV NODE_ENV=production

# Expose the default Next.js port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]

