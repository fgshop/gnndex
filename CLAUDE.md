# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GnnDEX is a global coin exchange platform built as an npm workspaces monorepo. It consists of four apps and one shared package, all sharing a single `node_modules` at the root.

## Commands

### Setup
```bash
npm install
cd backend && npx prisma db push && cd ..
npm --workspace packages/api-client run generate
npm --workspace packages/api-client run build
```

### Dev Servers
```bash
npm run dev:frontend    # Next.js on http://localhost:3000
npm run dev:backend     # NestJS on http://localhost:4000
npm run dev:admin       # Vite on http://localhost:8080
npm run dev:mobile      # Expo
```

### Build
```bash
npm --workspace backend run build
npm --workspace admin run build
npm --workspace frontend run build
npm --workspace mobile exec -- tsc --noEmit   # mobile typecheck only
```

### API Client Regeneration
When backend OpenAPI spec (`backend/openapi/openapi.v1.yaml`) changes:
```bash
npm --workspace packages/api-client run generate
npm --workspace packages/api-client run build
```

### Database
```bash
cd backend
npx prisma db push              # sync schema to DB
npx prisma migrate dev           # create migration
npx prisma migrate deploy        # apply migrations
npx prisma studio                # visual DB browser
```

### E2E Tests (backend)
```bash
npm --workspace backend run test:e2e:admin-flow
npm --workspace backend run test:e2e:permission-guard
npm --workspace backend run test:e2e:market-public
npm --workspace backend run test:e2e:admin-dashboard-overview
npm --workspace backend run test:e2e:admin-dashboard-share-link
```
E2E scripts require `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` env vars.

### Admin Bootstrap
```bash
npm --workspace backend run admin:bootstrap -- admin@gnndex.com GnnDEX!2345
```

## Architecture

### Monorepo Layout
- **`frontend/`** — Next.js 15 + React 19 + TailwindCSS + shadcn/ui. Uses App Router (`src/app/`).
- **`backend/`** — NestJS 11 + Prisma (MySQL). All routes prefixed with `/v1`. Swagger at `/api/docs`.
- **`admin/`** — Vite + React 19 + react-router-dom. Admin console with role/permission-gated pages.
- **`mobile/`** — React Native (Expo 52). Android/iOS app.
- **`packages/api-client/`** — OpenAPI-generated type-safe client using `openapi-fetch`. Consumed by all apps via `@gnndex/api-client`.

### Backend Module Structure (`backend/src/modules/`)
| Module | Purpose |
|--------|---------|
| `auth` | JWT access/refresh tokens, 2FA (TOTP via otplib), login/register/logout |
| `admin` | Admin dashboard, user mgmt, permissions, withdrawal ops, audit logs |
| `audit` | Audit log recording and querying |
| `database` | Prisma client provider module |
| `market` | Tickers, orderbook, candles, SSE streaming |
| `order` | Order CRUD, SSE streaming for user orders |
| `wallet` | Balances, ledger, withdrawals, SSE streaming, admin balance adjustments |
| `support` | Support ticket submission and admin replies |

### Backend Common (`backend/src/common/`)
- `guards/` — `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`
- `decorators/` — `@CurrentUser()`, `@Roles()`, `@Permissions()`
- `enums/` — Order enums
- `interfaces/` — `AuthenticatedUser`

### Auth Flow
- JWT Access (short TTL) + Refresh (DB-hashed, rotated). Refresh token rotation with revocation.
- Admin access requires `UserRole.ADMIN` + specific `AdminPermission` grants (RBAC).
- Both frontend and admin apps wrap `openapi-fetch` with a `fetchWithAuth` that auto-refreshes on 401.

### API Client Pipeline
`backend/openapi/openapi.v1.yaml` → `openapi-typescript` generates `packages/api-client/src/gen/schema.ts` → `createGnndexClient()` factory consumed by frontend/admin/mobile.

### Database
- MySQL via Prisma. Schema at `backend/prisma/schema.prisma`.
- All monetary values use `Decimal(36,18)`.
- Prisma model names use PascalCase; DB table names use snake_case via `@@map()`.
- Backend reads `DATABASE_URL` from `backend/.env`.

### Conventions
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`
- TypeScript strict mode across all apps. Base config at `tsconfig.base.json` (ES2022, Bundler resolution).
- Backend: Controller handles I/O validation only; business logic in Services. DTOs validated via `class-validator` with `whitelist`, `forbidNonWhitelisted`, `transform` pipes.
- Backend global prefix: `/v1`. All API endpoints start with `/v1/`.
- SSE streaming endpoints follow pattern: `GET /v1/.../stream/...` with `intervalMs` query param (1000-60000ms).
- Node.js >= 20 required.

### Documentation
Design docs live in `docs/` (Korean). Key references:
- `docs/01_PROJECT_REQUIREMENTS.md` — Product scope and requirements
- `docs/04_API_ARCHITECTURE.md` — Full API contract with endpoint details, filters, and permission mappings
- `docs/03_DATA_FORMAT_AND_CONTRACTS.md` — Data precision and format rules
