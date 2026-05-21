# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Web-based POS (Point of Sale) system for a restaurant ("Ayam Bakar Banjar Monosuko"). Skripsi/thesis project by Ezra Brilliant (C14220315). Backend uses **Express 4 + TypeScript + Prisma + MySQL**; frontend uses React 18 + TypeScript + Vite + Tailwind. Login is PIN-based (6 digits); three roles: `owner`, `cashier`, `kitchen`.

The backend is built per-phase to match the skripsi design diagrams (ERD, use case, activity). Diagram knowledge + Bab 3 draft live in [docs/knowledge/](docs/knowledge/); schema reference in [docs/DATA-DICTIONARY.md](docs/DATA-DICTIONARY.md).

## Commands

Root (runs both backend and frontend concurrently):
- `npm run dev` — start backend (`tsx watch` on :8000) + frontend (`vite` on :3000)
- `npm run dev:backend` / `npm run dev:frontend` — individually
- `npm run db:migrate` / `npm run db:seed` / `npm run db:fresh` (reset + seed)

Backend (`cd backend`):
- `npm run dev` — server with watch mode
- `npm run build` — `tsc` compile to `dist/`
- `npm run prisma:migrate` — apply schema changes; `npm run prisma:studio` — DB GUI
- `npm run db:seed` — seed 4 users + 47 menus
- `npm run test` — Vitest

Frontend (`cd frontend`):
- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build`
- `npm run lint` — ESLint

`VITE_API_URL` points at the API base (default `http://localhost:8000/api`).

## Architecture

### Backend (Express 4, TypeScript, API-only)

Entry: [backend/src/server.ts](backend/src/server.ts) builds the app from [backend/src/app.ts](backend/src/app.ts). Auth uses **JWT bearer tokens** issued by `POST /api/auth/login` (PIN lookup). Public endpoints: login, health, menu reads. Everything else needs `authenticate` middleware; role gates via `requireRole`.

**Modular per-resource** structure under [backend/src/modules/](backend/src/modules/) — each module has `*.schema.ts` (Zod), `*.service.ts` (business logic), `*.controller.ts` (thin handlers), `*.routes.ts`. Modules: `auth`, `menus`, `stocks`, `shifts`, `tables`, `transactions`, `settlements`, `users`, `expenses`, `dashboard`.

Schema in [backend/prisma/schema.prisma](backend/prisma/schema.prisma) — 8 entities matching the ERD: `User`, `Menu`, `DailyMenuStock`, `Shift`, `Transaction`, `TransactionItem`, `Settlement`, `Expense`. Primary keys are auto-increment integers.

Key business flows:
- **Shift**: a cashier must "buka kasir" (`POST /shifts/open`) before creating transactions — transactions require an open shift.
- **Table → Transaction**: a table is "occupied" iff it has an `open` transaction. `tables` is virtual (1..`TABLE_COUNT` from env), derived from transactions.
- **Force order**: when adding an item with qty exceeding today's stock, the request is rejected `409` unless `forceOrder: true` — the item is flagged `isForceOrder`. Stock is decremented at **payment** time (not order time), clamped at 0.
- **Settlement (blind count)**: `preview` checks for unpaid transactions without revealing system totals; `POST /settlements` submits the cashier's physical count, computes variance, and closes the shift; `review` (owner) finalizes.

### Frontend (React + TS + Vite)

Routing in [frontend/src/App.tsx](frontend/src/App.tsx): `ProtectedRoute` gates on auth; `OwnerRoute` requires `role === 'owner'`.

State: **Zustand** (`authStore`, `cartStore`) + **React Query** for server state. API layer in [frontend/src/services/](frontend/src/services/) — one file per resource using a shared Axios instance that injects the JWT bearer token.

> Note: the frontend was written against the old Laravel API; it may need updates to match the new Express endpoints (roles `cashier`/`kitchen`, shift flow). Verify before relying on it.

### Database

Schema is defined in [backend/prisma/schema.prisma](backend/prisma/schema.prisma) (authoritative). Apply changes with `npm run prisma:migrate`. Seed data in [backend/prisma/seed.ts](backend/prisma/seed.ts).

## Conventions

- API response shape: `{ success, message, data }` — preserve this when adding endpoints (`sendSuccess`/`sendError` in `utils/response.ts`).
- Errors: throw `AppError(message, statusCode)`; the central `errorHandler` formats them. Zod validation errors become `422`.
- PINs are 6 digits, plaintext (documented trade-off); never log or return them — `toPublicUser` strips the field.
- Code in English (variables, columns, enums). User-facing messages in Indonesian.
- Backend port 8000, frontend port 3000; changing them requires updating `VITE_API_URL` and `CORS_ORIGIN`.
- Per-phase build, incremental — explain each phase and wait for review.
