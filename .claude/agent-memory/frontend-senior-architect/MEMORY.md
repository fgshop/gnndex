# Frontend Architecture Memory - GnnDex

## Project Structure
- npm workspaces monorepo: frontend/, backend/, admin/, mobile/, packages/api-client/
- Frontend: Next.js 15 + React 19 + TailwindCSS + shadcn/ui, App Router (`src/app/`)
- Build: `npm --workspace frontend run build`
- Dev: `npm run dev:frontend` (port 3000)
- 19 routes total (static, SSG, dynamic)

## Dark/Light Theme System (Feb 2026)
- `theme-provider.tsx` — ThemeProvider context + `useTheme()` hook
- localStorage key: `gnndex.theme` (values: "light", "dark", "system")
- Default: dark mode (`className="dark"` on `<html>`, `suppressHydrationWarning`)
- CSS variables in `globals.css` using HSL format for shadcn/ui compatibility
- Exchange semantic colors: `--exchange-buy`, `--exchange-sell`, `--exchange-up`, `--exchange-down`

## Semantic Token Mapping
| Old Class | New Class |
|-----------|-----------|
| `text-slate-900/800` | `text-foreground` |
| `text-slate-400/500/600` | `text-muted-foreground` |
| `bg-white` | `bg-card` |
| `bg-slate-50/100` | `bg-muted` |
| `border-slate-100/200/300` | `border-border` |
| `shadow-slate-900/*` | `shadow-black/*` |
| `bg-slate-900 text-white` (active) | `bg-primary text-primary-foreground` |
| `hover:bg-slate-50/100` | `hover:bg-accent` |

## Status Badge Pattern (Dark-Mode-Friendly Opacity)
- Success: `border-emerald-500/30 bg-emerald-500/10 text-emerald-500`
- Error: `border-destructive/30 bg-destructive/10 text-destructive`
- Warning/Pending: `border-amber-500/30 bg-amber-500/10 text-amber-500`
- Default: `text-muted-foreground bg-muted border-border`

## Exchange Colors (Preserved, Korean Convention)
- Buy/positive: `text-rose-600` (red = buy in Korean exchanges)
- Sell/negative: `text-blue-600` / `text-blue-700`
- Ticker marquee: `bg-slate-950` always-dark section (intentional)

## API Integration
- `@gnndex/api-client` via `openapi-fetch` + `fetchWithAuth` wrapper (JWT auto-refresh on 401)
- SSE streaming with exponential backoff (`lib/sse-stream.ts`)
- TradingView iframe: passes `resolvedTheme` dynamically for matching theme

## Key Files
- `src/app/globals.css` — CSS variables (dark/light), component classes (.panel, .panel-glass, .btn-*, .badge-*, .gradient-text, .gradient-border, .glass, .hero-glow), animation keyframes
- `src/components/theme-provider.tsx` — ThemeProvider + useTheme
- `src/components/top-nav.tsx` — Navigation + theme toggle
- `src/components/coin-icon.tsx` — CoinIcon (branded circles for BTC/ETH/SOL/XRP/SBK/G99 etc), CoinPairIcon
- `src/app/page.tsx` — Landing (1000 lines, redesigned Feb 2026: hero, live ticker, featured markets, features, stats, security, CTA)
- `src/app/trade/page.tsx` — Trading (1325 lines, Binance-style 3-column grid layout, Feb 2026 redesign)
- `src/app/markets/page.tsx` — Markets (750 lines, Feb 2026 redesign: search, favorites, sort, tabs, top movers, CoinIcon)
- `src/features/wallet/wallet-panel.tsx` — Wallet (960 lines, Feb 2026 redesign: portfolio overview, balance table, withdraw form, history)

## Markets Page Architecture (Feb 2026 Redesign)
- Header with search bar (input-field + SearchIcon), stream status badge
- Top Movers section: panel-glass cards split into Gainers/Losers, horizontal scroll, CoinIcon + price + change%
- Category tabs: All / Favorites (star, localStorage) / Gainers / Losers, primary underline indicator
- Sortable data table: clickable headers with SortArrow SVG, default sort by volume desc
- Star favorites toggle per row (localStorage key: `gnndex.market.favorites`)
- Skeleton loading state (6 rows with animate-pulse)
- Empty states: contextual messages for favorites vs search vs no data
- COIN_NAMES lookup: BTC->Bitcoin, ETH->Ethereum, etc.
- formatPrice: adaptive decimal places (2 for >$1000, 4 for >$1, 6 otherwise)
- formatVolume: human-readable (K/M/B suffixes)

## Wallet Panel Architecture (Feb 2026 Redesign)
- Auth gate: spinner for loading, centered card with icon for unauthenticated
- Portfolio overview card: gradient overlay, estimated total value, 3-col stats (Available/InOrders/Pending)
- Portfolio allocation bar: horizontal stacked bar with color legend, CoinIcon per asset, percentage labels
- Segmented tab navigation: icons + labels, primary bg for active, 4 tabs (Overview/Balances/Withdraw/History)
- Overview tab: 2-col grid of asset cards (CoinIcon xl + name + amount + USD value + pct)
- Balances tab: search + hide-zero toggle, 5-column table (Asset/Available/InOrders/Total/USDValue)
- Withdraw tab: CoinIcon in currency selector, network dropdown, address (mono font), amount w/ MAX button, fee summary card, validation
- History tab: 6-col table with Date/Asset(CoinIcon)/Amount/Address(truncated+copy)/Status(badge)/TxHash(truncated+copy)
- Message banner: typed (success/error/info) with dismiss button, color-coded borders
- CopyButton component: clipboard API with checkmark feedback (2s timeout)

## Landing Page Architecture (Feb 2026 Redesign)
- 7 sections: Hero, LiveTickerStrip, FeaturedMarketsGrid, WhyGnnDexSection, PlatformStatsSection, TrustSecuritySection, GetStartedCTA
- Uses LISTED_MARKET_SYMBOLS (6 coins) for featured markets, not top20
- SSE streaming for live ticker (3s interval) with fallback polling (15s)
- Sparkline data from /market/candles (15m interval, 24 points)
- IntersectionObserver-based scroll animations (useInView hook)
- All content in English, premium/institutional tone
- JSON-LD structured data preserved (Organization + WebSite schema)
- Uses design system classes: .panel, .panel-glass, .btn-primary, .btn-secondary, .gradient-text, .ticker-marquee, .animate-fade-up, .animate-count-up

## Trade Page Architecture (Feb 2026 Redesign)
- Binance/Bybit-style 3-column grid: Orderbook | Chart+OrderForm | MarketInfo+MarketList
- Top bar: market selector dropdown (w/ search + CoinIcon), live price, 24h stats, spread, stream status
- Orderbook: asks reversed (highest at top), center price indicator w/ arrow, bids below, depth % bars with exchange-buy/sell HSL vars, clickable rows set price
- Order form: Buy/Sell tabs colored with exchange-buy/sell vars, Limit/Market/Stop type selector, 25/50/75/100% presets, estimated total
- Right panel: large price display, 24h stats grid, market list with active indicator (border-l-primary)
- Bottom: tabbed order history (Open/Completed/All), status badges, cancel button, filters, pagination
- Uses exchange semantic colors: `.text-up`, `.text-down`, `hsl(var(--exchange-buy))`, `hsl(var(--exchange-sell))`
- Changed from Korean-convention (red=buy/blue=sell) to international (green=buy/red=sell) using CSS vars
- Responsive: lg breakpoint for 3-col grid, stacks vertically on mobile
- Viewport-filling layout: `height: calc(100vh - 130px)` for main grid
- Fragment wrapper (<></>) instead of <main> to eliminate outer padding for edge-to-edge panels

## Design System Component Classes (globals.css)
- Cards: `.panel` (border+bg+shadow), `.panel-glass` (backdrop-blur translucent), `.panel-hover` (hover shadow)
- Buttons: `.btn-primary`, `.btn-secondary`, `.btn-muted`, `.btn-ghost`, `.btn-buy`, `.btn-sell`
- Badges: `.badge-success`, `.badge-danger`, `.badge-warning`, `.badge-info`, `.badge-muted`
- Effects: `.gradient-text` (primary->accent), `.gradient-border` (pseudo-element gradient), `.glass`, `.hero-glow`
- Animations: `.animate-fade-up`, `.animate-fade-in`, `.animate-shimmer`, `.animate-float`, `.animate-count-up`, `.animate-glow-pulse`, `.ticker-marquee`
- Exchange: `.text-up`, `.text-down`, `.bg-surface-2`, `.bg-surface-3`, `.text-gold`

## MyPage Panel Architecture (Feb 2026 Redesign)
- Auth gate: spinner for loading, centered card with user icon for unauthenticated
- Header card: avatar circle (user initial), email, role badge, member since, refresh button
- Underline-style tab navigation (border-b-2): Overview | Security | Assets | Activity
- Overview: 3 stat cards (Total Balance / Open Orders / Completed Trades), account summary key-value list, recent activity cards with CoinIcon+SideBadge+OrderStatusBadge
- Security: 2FA setup flow (password -> generate secret -> copy to auth app -> enter code -> activate), password change & login sessions as future placeholders
- Assets: 3 summary cards (Available/Locked/Portfolio Size), portfolio table with CoinIcon, right-aligned monospaced numbers
- Activity: orders table with CoinIcon+SideBadge+OrderStatusBadge, ledger table with CoinIcon+signed amounts (green/red)
- Uses direct fetch() with Bearer token (not api client) for consistency with original implementation

## Support Center Architecture (Feb 2026 Redesign)
- Header: Help Center title, auth status indicator (green/gray dot), 3 summary cards (hours/response time/active tickets)
- Underline-style tab navigation: Announcements | FAQ | Submit Ticket | My Tickets
- Announcements: expandable notice cards from support-notices.ts, chevron toggle, detail bullets, link to full announcement
- FAQ: accordion pattern (FaqItem component with max-h transition), 4 categories (Account/Trading/Security/Fees & Limits), 12 Q&A pairs
- Submit Ticket: category dropdown, subject input, large textarea, loading spinner, success confirmation with "View my tickets" link
- My Tickets: table with status badges (Open=blue, In Progress=yellow, Resolved=green, Closed=gray), click-to-view detail panel with back navigation
- TicketDetail sub-component: user message card + admin reply card with primary color accent
- Ticket status mapping: RECEIVED=Open(badge-info), IN_REVIEW=In Progress(badge-warning), ANSWERED=Resolved(badge-success), CLOSED=Closed(badge-muted)

## Auth Forms Architecture (Feb 2026 Redesign)
- Centered card (max-w-440px), `.panel` with generous padding (p-8 sm:p-10), `.animate-fade-up`
- LogoMark: 56px rounded-2xl square with primary bg, "C" character
- Input pattern: label above, `.input-field` class, left icon (pointer-events-none absolute), right icon for show/hide password
- Login: email+password, conditional 2FA input (animate-fade-up when triggered by 428 status or requiresTwoFactor), remember-me checkbox, forgot-password link, divider with "New to GnnDex?", register link
- Register: email, password with strength indicator (weak/medium/strong bar + colored label), confirm password with match/mismatch feedback (green checkmark / red text), terms checkbox in bordered card, divider with "Already registered?", login link
- Error display: rounded border with "!" circle icon + destructive color scheme
- Success display: checkmark icon + emerald color scheme
- NO demo credentials displayed (removed from login form)
