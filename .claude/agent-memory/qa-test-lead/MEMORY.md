# QA & Test Lead Memory - MultiWallet

## Project Overview

- Non-custodial multi-chain crypto wallet (BTC, ETH, TRON, BNB, SOL, Polygon)
- Turborepo + pnpm workspaces monorepo
- Packages: `@mw/core`, `@mw/utils`, `@mw/types`, `@mw/ui`
- Apps: `api` (NestJS + Prisma/PostgreSQL), `web`, `admin`, `desktop`, `mobile`

## Test Infrastructure

- All packages use Vitest v3.2.4 with `globals: true`
- `@mw/core`: tests in `tests/**/*.test.ts`, config at `packages/core/vitest.config.ts`
- `@mw/utils`: tests in `tests/**/*.test.ts`, config at `packages/utils/vitest.config.ts`
- Run: `pnpm --filter @mw/core test`, `pnpm --filter @mw/utils test`
- Types package must be built before core/utils tests can resolve `@mw/types` imports

## Test Coverage Status (2026-02-10)

### @mw/core (8 test files, 98 tests)

- `tests/wallet/Mnemonic.test.ts` -- generate (128/256), validate, toSeed, BIP-39 test vector
- `tests/wallet/HDWallet.test.ts` -- fromSeed, deriveKey (all 6 chains), deriveAllChains, destroy
- `tests/wallet/KeyManager.test.ts` -- encrypt/decrypt roundtrip, wrong password, tampered data, wipe
- `tests/crypto/AESEncryptor.test.ts` -- encrypt/decrypt, random IV, wrong key/IV, tampered, empty msg
- `tests/chains/ChainAdapterFactory.test.ts` -- register/get, has, getSupportedChains, getAll, error
- `tests/chains/ethereum/EthereumAdapter.test.ts` -- constructor, validateAddress (10 cases)
- `tests/chains/bitcoin/BitcoinAdapter.test.ts` -- constructor, validateAddress (legacy/segwit/P2SH)
- `tests/chains/tron/TronAdapter.test.ts` -- constructor, validateAddress (T-prefix, base58)

### @mw/utils (3 test files, 93 tests)

- `tests/format.test.ts` -- shortenAddress, formatTokenAmount, formatUsd, formatPercent
- `tests/convert.test.ts` -- toSmallestUnit, fromSmallestUnit, wei/ether, sat/btc, sun/trx, lamport/sol
- `tests/validate.test.ts` -- isValidAddress (all 6 chains), isValidMnemonic, isValidPassword

### Seed Data

- `apps/api/prisma/seed.ts` -- 6 chains, 15 tokens, 1 admin user (SUPER_ADMIN)

## Key Findings

1. **ethers v6 isAddress()** accepts hex without 0x prefix -- differs from regex-based @mw/utils
2. **Bitcoin Taproot gap**: BitcoinAdapter regex `{25,62}` too short for Taproot (bc1p) addresses
3. **HDWallet.destroy()**: zeroes masterKey.privateKey via fill(0), but HDKey.derive doesn't throw -- produces different (corrupted) keys instead
4. **ChainAdapterFactory**: uses static Map -- must clear between tests via bracket notation for test isolation
5. **KeyManager**: 100,000 SHA-256 iterations makes tests slow (~1.6s). Argon2id planned for Phase 2.
6. **isValidMnemonic** in @mw/utils only checks word count (12 or 24), NOT BIP-39 wordlist validity
7. **shortenAddress**: uses `chars + 2` for prefix (accounts for "0x"), and `chars` for suffix

## Still Untested

- Frontend (Next.js web/admin): no test files yet
- Mobile (Flutter): no test files yet
- Desktop (Electron): no test files yet
- API (NestJS): no test files yet
- E2E: nothing yet
- EthereumAdapter async methods (getBalance, buildTransaction, etc.) -- need RPC mocking
- ERC20, EthTxBuilder, SolanaAdapter, BNBAdapter async methods
- Transaction/FeeEstimator modules
