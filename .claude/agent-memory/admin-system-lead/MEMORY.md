# Admin System Lead Memory - GnnDex

## Architecture

- Admin: Vite 6 + React 19 + react-router-dom 7 + TailwindCSS v4
- API client: @gnndex/api-client (openapi-fetch based, type-safe)
- Auth: JWT access/refresh tokens, localStorage persistence, auto-refresh on 401
- Dark theme admin UI with CSS custom properties + TailwindCSS v4

## Key File Locations

- Entry: `admin/src/main.tsx`
- Router: `admin/src/App.tsx` (10 authenticated routes + login)
- Layout: `admin/src/components/AdminLayout.tsx` (dark sidebar, permission-based nav)
- Auth guard: `admin/src/components/RequireAdminAuth.tsx`
- Permission gate: `admin/src/components/PermissionGate.tsx`
- API client: `admin/src/lib/api.ts` (fetchWithAuth with token refresh dedup)
- SSE stream: `admin/src/lib/sse-stream.ts` (backoff reconnection)
- Styles: `admin/src/styles.css` (TailwindCSS v4 @theme inline + custom CSS)

## Pages (11 total)

1. LoginPage, 2. DashboardPage (SSE+share links), 3. UsersPage
4. OrdersPage, 5. PermissionsPage, 6. WithdrawalsPage
7. WalletLedgerPage, 8. AuditLogsPage, 9. SupportTicketsPage
10. RiskPolicyPage, 11. CompliancePage (stub)

## Permission System

- 15 AdminPermissions defined in PermissionGate.tsx
- PermissionGate component: `require` (all), `requireAny` (any)
- Sidebar nav items filtered by permission via hasPermission()

## Design Tokens

- Dark theme: bg=#0b0f1a, surface=#111827, card=#1e293b, border=#334155
- Accent: #3b82f6 (blue-500)
- Status badges via .status-badge CSS classes

## API Pattern

- Paginated: { items: T[], pagination: { page, total, totalPages } }
- OpenAPI types from packages/api-client/src/gen/schema.ts
- Build: `npm --workspace admin run build` (tsc -b && vite build)
