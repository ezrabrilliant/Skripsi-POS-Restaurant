# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Web-based POS (Point of Sale) system for a restaurant. Skripsi/thesis project by Ezra Brilliant (C14220315). Backend uses Laravel 12 + MySQL, frontend uses React 18 + TypeScript + Vite + Tailwind. Login is PIN-based (6 digits); two roles: `owner` and `kasir`.

## Commands

Root (runs both backend and frontend concurrently):
- `npm run dev` — start backend (`php artisan serve` on :8000) + frontend (`vite` on :3000)
- `npm run dev:backend` / `npm run dev:frontend` — individually
- `npm run db:fresh` — `migrate:fresh --seed` (wipes DB)
- `npm run db:migrate` / `npm run db:seed`

Backend (`cd backend`):
- `php artisan serve --port=8000`
- `php artisan migrate --seed`
- `php artisan test` — run PHPUnit suite (`phpunit.xml`); single test: `php artisan test --filter=TestName`

Frontend (`cd frontend`):
- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` (type-check is part of build)
- `npm run lint` — ESLint

Note: frontend `.env` and `vite.config.ts` currently have uncommitted local changes (Supabase/remote DB experiments per recent commits). Confirm with user before committing them. `VITE_API_URL` points at the Laravel API base (default `http://localhost:8000/api`).

## Architecture

### Backend (Laravel 12, API-only)

All routes live in [backend/routes/api.php](backend/routes/api.php) — there is no web UI served by Laravel. Auth uses **Sanctum bearer tokens** issued by `POST /api/auth/login` (PIN-based). Public endpoints: login, health, menu reads. Everything else is behind `auth:sanctum`.

Domain models in [backend/app/Models/](backend/app/Models/):
- `User` — has `role` (`owner`|`kasir`) and 6-digit PIN.
- `Menu` — catalog items; categories are a derived list (`/menus/categories`).
- `DailyMenuStock` — per-day stock per menu. Separate from `Menu` because stock resets daily; endpoints `reset-today` and `copy-yesterday` manage it.
- `Transaction` + `TransactionItem` — an open transaction is tied to a table (`tableNumber`); the `/tables/{n}/transaction` endpoint returns the current open one. Items can be synced/added/updated/removed until payment. `pay` closes; `void` cancels.
- `Settlement` — end-of-day cash reconciliation with a `review` step (owner approves kasir's settlement).

Key business flows (span multiple controllers):
- **Table → Transaction lifecycle**: `TableController@getOpenTransaction` resolves/creates a transaction for a table; `TransactionController` mutates items; `pay` settles it. A table is "occupied" iff it has an open transaction.
- **Force order**: orders can be placed even when `DailyMenuStock` is depleted — the frontend `ForceOrderModal` confirms, and the backend allows it without decrementing below zero (check controllers before changing stock logic).
- **Settlement**: `preview` computes totals from transactions of the day; `store` persists; `review` (owner) finalizes. Don't bypass the review step.

### Frontend (React + TS + Vite)

Routing in [frontend/src/App.tsx](frontend/src/App.tsx):
- `ProtectedRoute` gates on auth; `OwnerRoute` additionally requires `role === 'owner'`.
- Owner-only pages: `/stock`, `/menu`, `/users`, `/reports`.
- Shared pages: `/pos`, `/pos/:tableNumber`, `/tables`, `/history`, `/settlement`.

State:
- **Zustand** stores in [frontend/src/stores/](frontend/src/stores/): `authStore` (user + token, persisted) and `cartStore` (in-progress order for the active table).
- **React Query** (`@tanstack/react-query`) for server state in pages; don't duplicate server state into Zustand.

API layer in [frontend/src/services/](frontend/src/services/) — one file per resource, all using a shared Axios instance that injects the Sanctum bearer token. When adding a new endpoint, extend the matching service rather than calling axios directly from components.

Cart → transaction sync: `CartPanel` drives POS flow; items sync to the backend via `transactionService` (`PUT /transactions/{id}/items` is the bulk sync endpoint). Payment flows through `PaymentModal` → `POST /transactions/{id}/pay`.

### Database

Schema lives both in [backend/database/migrations/](backend/database/migrations/) (authoritative) and [database/schema.sql](database/schema.sql) (reference dump). Prefer migrations; only update `schema.sql` if explicitly asked.

## Conventions

- API response shape: `{ success, message, data }` — preserve this when adding endpoints.
- PINs are 6 digits; never log them. Use `verify-pin` endpoint for elevation checks (e.g., void, owner actions).
- Indonesian language is used in some UI strings and the README — mirror existing language in surrounding code rather than translating.
- Backend port 8000, frontend port 3000 are assumed throughout; changing them requires updating `VITE_API_URL` and CORS config.
