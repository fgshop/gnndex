# Backend (NestJS + Prisma + MySQL)

## Environment

- Runtime env file: `backend/.env`
- Required key:
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `JWT_ACCESS_TTL` (default `15m`)
  - `JWT_REFRESH_TTL_DAYS` (default `14`)

## Prisma commands

- Generate client:
  - `npm --workspace backend run prisma:generate`
- Apply migrations (dev):
  - `npm --workspace backend run prisma:migrate:dev`
- Apply migrations (deploy):
  - `npm --workspace backend run prisma:migrate:deploy`
- Open Prisma Studio:
  - `npm --workspace backend run prisma:studio`

## Build and run

- Build:
  - `npm --workspace backend run build`
- Dev server:
  - `npm --workspace backend run start:dev`

## E2E validation

- Admin/Withdrawal/Permission/Audit end-to-end flow:
  - `npm --workspace backend run test:e2e:admin-flow`
  - scenario:
    - admin funding -> user withdrawal -> approve/broadcast/confirm
    - admin permission grant update
    - audit log verification for withdrawal + permission updates
- Permission guard flow:
  - `npm --workspace backend run test:e2e:permission-guard`
  - scenario:
    - missing-permission 403 검증
    - self `ADMIN_PERMISSION_WRITE` 제거 금지(400) 검증
- Public market API flow:
  - `npm --workspace backend run test:e2e:market-public`
  - scenario:
    - tickers/orderbook/candles 응답 스키마 검증
    - 캔들 interval 입력 검증(잘못된 값 400) 확인

## Auth API (v1)

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `POST /v1/auth/2fa/setup`
- `POST /v1/auth/2fa/enable`

## Market API (v1, Public)

- `GET /v1/market/tickers?symbols=BTC-USDT,ETH-USDT&limit=20`
- `GET /v1/market/stream/tickers?symbols=BTC-USDT,ETH-USDT&limit=20&intervalMs=5000` (SSE)
- `GET /v1/market/orderbook/BTC-USDT?limit=20`
- `GET /v1/market/candles?symbol=BTC-USDT&interval=1m&limit=120`

## Orders API (v1, Private)

- `POST /v1/orders`
- `DELETE /v1/orders/:orderId`
- `GET /v1/orders?page=1&limit=20&symbol=&status=&statuses=NEW&statuses=PARTIALLY_FILLED&side=&type=&fromCreatedAt=&toCreatedAt=&sortBy=&sortOrder=`
- `GET /v1/orders/stream?page=1&limit=20&symbol=&status=&statuses=NEW&statuses=PARTIALLY_FILLED&side=&type=&fromCreatedAt=&toCreatedAt=&sortBy=&sortOrder=&intervalMs=5000` (SSE, Auth)

## Admin Query API (v1)

- `GET /v1/admin/users?page=1&limit=20&email=&status=&fromCreatedAt=&toCreatedAt=`
- `GET /v1/admin/orders?page=1&limit=20&symbol=&status=&email=`
- `GET /v1/admin/permissions/users?page=1&limit=20&email=&fromCreatedAt=&toCreatedAt=`
- `PATCH /v1/admin/permissions/users/:userId`
- `GET /v1/admin/wallet-ledger?page=1&limit=20&email=&asset=&entryType=`
- `GET /v1/admin/withdrawals?page=1&limit=20&email=&asset=&network=&status=&fromRequestedAt=&toRequestedAt=`
- `POST /v1/admin/withdrawals/:withdrawalId/approve`
- `POST /v1/admin/withdrawals/:withdrawalId/reject`
- `POST /v1/admin/withdrawals/:withdrawalId/broadcast`
- `POST /v1/admin/withdrawals/:withdrawalId/confirm`
- `POST /v1/admin/withdrawals/:withdrawalId/fail`
- `GET /v1/admin/audit-logs?page=1&limit=20&actorEmail=&action=&targetType=&fromCreatedAt=&toCreatedAt=`

## Wallet API (v1)

- `GET /v1/wallet/balances`
- `GET /v1/wallet/stream/balances?intervalMs=5000` (SSE, Auth)
- `GET /v1/wallet/ledger?limit=100`
- `GET /v1/wallet/withdrawals?limit=50&status=`
- `POST /v1/wallet/withdrawals`

## Authorization Notes

- `orders/*`, `wallet/*` endpoints require `Authorization: Bearer <accessToken>`.
- `admin/*` endpoints require JWT and `ADMIN` role.
- `PATCH /v1/admin/permissions/users/:userId` safety rules:
  - caller cannot remove own `ADMIN_PERMISSION_WRITE`
  - at least one admin must keep `ADMIN_PERMISSION_WRITE`
- Promote existing user to admin:
  - `npm --workspace backend run admin:promote -- trader@gnndex.com`
