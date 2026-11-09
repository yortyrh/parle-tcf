# 1. Drizzle for persistence

Status: accepted

## Context
The project needs PostgreSQL with typed queries, migrations, and an in-process test database. A sibling project already uses Drizzle with the same stack (NestJS, Better Auth).

## Decision
Use Drizzle ORM (`packages/db`) with SQL migrations and PGlite for unit tests.

## Consequences
- Schema is TypeScript; migrations are plain SQL committed to the repo.
- Tests run against a real Postgres engine (PGlite) without a container.
- Every query is written with an explicit `user_id` filter; there is no implicit tenancy layer.
