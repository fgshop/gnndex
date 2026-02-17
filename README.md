# GnnDEX

Global coin exchange monorepo.

## Apps

- `frontend`: Next.js + TailwindCSS + shadcn/ui
- `backend`: NestJS API
- `admin`: Vite admin console
- `mobile`: React Native (Expo) for Android/iOS
- `packages/api-client`: OpenAPI-based shared API client

## Quick Start

1. Install dependencies:
   - `npm install`
2. Sync Prisma schema:
   - `cd backend && npx prisma db push && cd ..`
3. Generate API client from OpenAPI:
   - `npm --workspace packages/api-client run generate`
   - `npm --workspace packages/api-client run build`
4. Build validation:
   - `npm --workspace backend run build`
   - `npm --workspace admin run build`
   - `npm --workspace frontend run build`
   - `npm --workspace mobile exec -- tsc --noEmit`
5. Run apps:
   - Frontend: `npm run dev:frontend` (`http://localhost:3000`)
   - Backend: `npm run dev:backend` (`http://localhost:4000`)
   - Admin: `npm run dev:admin` (`http://localhost:8080`)
   - Mobile: `npm run dev:mobile`
6. Bootstrap admin account (optional):
   - `npm --workspace backend run admin:bootstrap -- admin@gnndex.com GnnDEX!2345`

## Database

Backend reads `backend/.env`:

- `DATABASE_URL=mysql://gnndex:GnnDEX9545!@211.43.91.82:3306/gnndex?schema=public`

## CI

- GitHub Actions workflow: `.github/workflows/ci.yml`
- E2E matrix job(`backend-e2e`) requires repository secrets:
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
- Matrix scripts:
  - `test:e2e:admin-flow`
  - `test:e2e:permission-guard`
  - `test:e2e:market-public`
