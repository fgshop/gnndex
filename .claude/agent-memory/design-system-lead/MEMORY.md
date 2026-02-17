# iBODY24 Design System Lead — Memory

## Design System Files (canonical locations)

- Web (frontend): `frontend/src/app/globals.css` — dark theme, @theme inline block
- Web (admin): `admin/src/app/globals.css` — light theme, mirrored token names
- Mobile (Flutter): `mobile/lib/config/theme.dart` — AppColors, AppTypography, AppSpacing, AppRadius, AppTheme
- Watch (Wear OS): `watch/app/src/main/kotlin/.../presentation/theme/Color.kt`, `Type.kt`, `Theme.kt`
- See [token-audit.md](token-audit.md) for full cross-platform mapping

## Key Decisions

- **Primary color**: #2563EB (blue-600) across ALL platforms. Not cyan.
- **Frontend theme**: Dark by default (background #030712). Admin: Light (background #f9fafb).
- **Flutter primary changed** from cyan to blue600 to match web. Cyan remains as `neonCyan`/accent.
- **Grade colors**: Grade 1=emerald (best fitness), Grade 5=red (lowest). Consistent across all platforms.
- **HR Zone colors**: Separate from grade colors. Extreme=red, High=orange, Moderate=lime, Low=emerald, Rest=blue.
- **Watch grade colors were INVERTED** (Grade1=Red) — fixed to match mobile/web (Grade1=Emerald).
- **Typography**: Korean body text requires line-height >= 1.6. Flutter uses Noto Sans KR via GoogleFonts.
- **Border radius scale**: sm=6, md=8, lg=12, xl=16, 2xl=20, full=9999

## Tokens Added (2026-02-09)

- `--color-success/warning/error/info` — semantic status colors (both platforms)
- `--color-grade-{1-5}` — fitness grade colors
- `--color-hr-zone-{extreme|high|moderate|low|rest}` — HR zone colors
- `--color-surface-alt`, `--color-surface-elevated` — additional surface tokens
- `--color-error-dark`, `--color-border-dark` — unified across frontend/admin
- `--radius-{sm|md|lg|xl|2xl|full}` — border radius scale
- Flutter: `AppTypography`, `AppSpacing`, `AppRadius` classes (new)
- Flutter: `AppColors.hrZoneColor()` method (new)
- prefers-reduced-motion media query (frontend + admin)
- focus-visible global style (frontend + admin)

## Backwards Compatibility

- Flutter has ~20 deprecated aliases (darkBackground, darkSurface, cyan, blue, etc.)
- No consumer code changes needed for existing screens
- Admin skeleton class updated to use `var(--color-border)` tokens instead of hardcoded hex

## Known Issues / TODO

- Recharts in admin/frontend use inline hex strings (unavoidable — JS objects, not CSS)
- No shared `packages/ui` package yet — components are duplicated between frontend/admin
- Admin has no reusable UI components (Button, Card, Input) — uses inline Tailwind classes
- Watch Theme.kt still uses default Typography(), should adopt IBody24Typography
- Dark mode toggle not yet implemented for either web platform
