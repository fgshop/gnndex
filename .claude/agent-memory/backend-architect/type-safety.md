# TypeScript Strict Mode Solutions

## @nestjs/jwt v11 + jsonwebtoken StringValue Issue

- `expiresIn` in `jwt.SignOptions` requires `StringValue` (branded type from `ms` package), not plain `string`
- **Solution for auth.module.ts**: Cast entire signOptions object: `as SignOptions` (from `jsonwebtoken`)
- **Solution for auth.service.ts**: Cast options param: `{ expiresIn: this.refreshExpiresIn } as JwtSignOptions`
- JwtService.sign() overload 3 accepts `T extends object` -- no need to cast payload to Record<string, unknown>
- Import: `import type { JwtSignOptions } from '@nestjs/jwt'`

## Vitest TestContext Issue

- `it('name', (done) => { ... done() })` pattern causes `TestContext not callable` error in newer Vitest
- **Solution**: Use `async/await` with `lastValueFrom()` from rxjs instead of done callback
- Import: `import { lastValueFrom, of } from 'rxjs'`

## Mock Typing in Vitest

- When mocking `@prisma/client`, must include `PrismaClient` export if any imported module extends it
- Use `importOriginal` pattern: `vi.mock('@prisma/client', async (importOriginal) => { const actual = await importOriginal(); return { ...actual, CustomEnum: {...} }; })`
- Socket mock `data` property: type as `Record<string, unknown>` to allow dynamic property assignment

## Guards That Throw vs Return False

- When a guard throws ForbiddenException, tests must use `expect(() => ...).toThrow(ForbiddenException)` not `expect(result).toBe(false)`
