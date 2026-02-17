# Backend Architect Memory

## GnnDex Project (gnndex/)

### Backend Hardening (WS-1) - Implemented
- Global HttpExceptionFilter: `backend/src/common/filters/http-exception.filter.ts`
- RequestIdMiddleware: `backend/src/common/middleware/request-id.middleware.ts`
- LoggingInterceptor: `backend/src/common/interceptors/logging.interceptor.ts`
- ErrorCode enum: `backend/src/common/enums/error-code.enum.ts`
- Rate limiting: @nestjs/throttler (100/min global, 5/min login, 3/min register)
- ThrottlerGuard registered as APP_GUARD in AppModule
- @types/express needed for express type imports in middleware/filters
- Swagger: addBearerAuth("bearer") in main.ts, @ApiBearerAuth("bearer") in controllers
- E2E tests import AppModule directly (picks up ThrottlerGuard) but NOT global filters from main.ts
- Error response: `{ timestamp, requestId, code, message, details }`

## Architecture Patterns

- See [patterns.md](./patterns.md) for detailed code patterns
- See [type-safety.md](./type-safety.md) for TypeScript strict mode solutions

## Key Decisions

- JwtUser interface: `/backend/src/common/types/jwt-user.interface.ts` -- shared across all controllers
- Pagination: `buildPaginationMeta()` in `/backend/src/common/dto/pagination-query.dto.ts` -- all list endpoints use `meta` key
- Env validation: `/backend/src/common/config/env.validation.ts` -- fail-fast on missing DATABASE_URL/JWT_SECRET
- Auth response DTO: `/backend/src/auth/dto/auth-response.dto.ts` -- Swagger-documented
- RolesGuard throws ForbiddenException (not return false) for proper error messages
- CoachingGateway uses JWT auth from query.token/auth.token/Authorization header (not userId in query)
- Admin user queries use USER_SAFE_SELECT to exclude passwordHash
- Programs getRecommended takes userId (looks up fitnessGrade from DB)

## Critical Security Fixes Applied

1. WebSocket: JWT-based auth replaced insecure query.userId
2. Admin: passwordHash excluded from user list queries
3. CORS: Production whitelist (aiibody24.vercel.app, aiibody24-admin.vercel.app)
4. Env: Required vars validated at startup

## Module Structure

- `/backend/src/auth/` -- registration, login, JWT refresh
- `/backend/src/coaching/` -- WebSocket gateway + service (real-time HR coaching)
- `/backend/src/programs/` -- exercise program listing/recommendation
- `/backend/src/sessions/` -- exercise session CRUD
- `/backend/src/health/` -- dashboard, Samsung sync, Godin score, PEI
- `/backend/src/devices/` -- BLE device management
- `/backend/src/users/` -- user CRUD, profile
- `/backend/src/admin/` -- admin user management
- `/backend/src/admin-support/` -- admin notice/FAQ/inquiry mgmt
- `/backend/src/support/` -- public notice/FAQ/inquiry

## MultiWallet Project Notes

### @scure/btc-signer v1.8.1 API Gotchas

- `Address(NETWORK).decode(addr)` returns union type WITHOUT `.script` on all variants
- Must use `OutScript.encode(decodedAddr)` to get raw scriptPubKey bytes
- `selectUTXO` from library exists but custom impl provides simpler interface

### Build System

- Turborepo + pnpm, `pnpm --filter @mw/core build` runs `tsc --build`
- tsconfig: strict, noUncheckedIndexedAccess, composite, ES2022, ESNext module
- Pre-existing TRC20.ts build error (not related to Bitcoin work)
- API tsconfig: `composite: false` + `references` means `nest build` uses tsc --build internally
- If tsbuildinfo is stale, `nest build` succeeds silently but emits nothing; delete tsbuildinfo to fix
- Prisma client MUST be generated before build: `pnpm --filter @mw/api exec prisma generate`
- socket.io types come from direct dep (added to package.json), not transitively from @nestjs/platform-socket.io

### API Module Architecture (apps/api/)

- **Global modules**: PrismaModule, RedisModule (registered in AppModule, available everywhere)
- PrismaService: extends PrismaClient, implements OnModuleInit/OnModuleDestroy
- RedisService: wraps ioredis with get/set/del/getJson/setJson + graceful degradation
- All feature modules consume PrismaService/RedisService via DI (no imports needed, they're global)
- DTOs in `dto/` subdirectories with `index.ts` barrel exports
- Swagger decorators on all controllers: @ApiTags, @ApiOperation, @ApiResponse, @ApiParam, @ApiQuery
- Prisma schema uses PostgreSQL (not MySQL as initially described)
- SupportedChain.chainId (Int, unique) maps to numeric chain IDs (1=Ethereum, 56=BSC, etc.)
- SupportedToken.chainId is the cuid FK to SupportedChain.id (not the numeric chainId)

### Bitcoin Adapter (`packages/core/src/chains/bitcoin/`)

- Files: `types.ts`, `BitcoinTxBuilder.ts`, `BitcoinAdapter.ts`, `index.ts`
- Blockstream API (free, no key) for chain queries; mempool.space for fee estimation
- P2WPKH native SegWit; PSBT (BIP-174) for unsigned tx interchange
- Coin selection: largest-first greedy; dust threshold 546 sats

### Ethereum Adapter (`packages/core/src/chains/ethereum/`)

- Files: `EthereumAdapter.ts`, `ERC20.ts`, `EthTxBuilder.ts`, `index.ts`
- ethers.js v6 (`^6.16.0`): JsonRpcProvider, Wallet, Contract, Interface
- UnsignedTx.raw = JSON-serialized TransactionRequest (bigint as hex strings)
- SignedTx.raw = raw signed tx bytes; hash = keccak256 tx hash
- EIP-1559 fee model: type=2, maxFeePerGas + maxPriorityFeePerGas
- Gas buffer: 20% (multiply by 120n / 100n) to prevent out-of-gas
- Gas price tiers: slow=80%, standard=100%, fast=120% of maxFeePerGas
- ERC-20: Use `contract.getFunction("name")` NOT `contract.name()` (noUncheckedIndexedAccess)
- Token list returns [] (needs indexer, not chain adapter responsibility)
- Address validation: `isAddress()` from ethers (handles EIP-55 checksum)
- Address derivation: `computeAddress(hexlify(publicKey))` from ethers

### TRON Adapter (`packages/core/src/chains/tron/`)

- Files: `TronAdapter.ts`, `TRC20.ts`, `TronResources.ts`, `TronVoting.ts`, `index.ts`
- TronWeb v6.2: import `{ TronWeb, Types }` from "tronweb"
- Deep subpath imports (`tronweb/lib/esm/types/...`) DON'T work with bundler moduleResolution
- Use `Types.Transaction`, `Types.SignedTransaction` for type assertions
- Address derivation: `tronUtils.crypto.computeAddress()` + `getBase58CheckAddress()`
- TRC-20 reads: `tronWeb.contract(abi, addr)` + cast to local interface for `.methods`
- TRC-20 writes: `triggerSmartContract(addr, selector, opts, params, from)`
- Token info: `triggerConstantContract` returns `constant_result` as hex[] needing ABI decode
- Resources: `trx.getAccountResources(addr)` -> AccountResourceMessage with camelCase fields
- Staking: Stake 2.0 API via `freezeBalanceV2`/`unfreezeBalanceV2` (not legacy freeze)
- Voting: `transactionBuilder.vote(voteInfo, addr)` where voteInfo is `{[srAddr]: count}`
- Rewards: `trx.getReward(addr)` returns unwithdrawn SUN amount
- SR list: `trx.listSuperRepresentatives()` + `trx.getBrokerage(addr)` for commission
- Gas: bandwidth/energy price via `trx.getBandwidthPrices()`/`trx.getEnergyPrices()` (csv format)
- Token list returns [] (needs TronGrid indexer API, not fullnode RPC)
