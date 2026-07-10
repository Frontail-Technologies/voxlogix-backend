# VoxLogiX Backend Foundation

Scalable backend foundation for VoxLogiX using Bun, Express, TypeScript, PostgreSQL, Drizzle ORM, and Zod.

## Setup

```bash
cd backend
cp .env.example .env
bun install
```

## Development

```bash
bun run dev
```

## Build and start

```bash
bun run build
bun run start
```

## Typecheck

```bash
bun run typecheck
```

## Health route

```text
GET http://localhost:5000/api/health
```

## Drizzle commands

```bash
bun run db:generate
bun run db:migrate
bun run db:push
bun run db:studio
```

## Structure

```text
src/
  app.ts
  server.ts
  config/
  db/
  middlewares/
  modules/
    health/
  shared/
  seed/
```

## Notes

- The codebase is module-oriented instead of route-version oriented.
- Only shared infrastructure and the `health` module exist right now.
- Business modules, auth flows, uploads, AI, and reports will be added later.
