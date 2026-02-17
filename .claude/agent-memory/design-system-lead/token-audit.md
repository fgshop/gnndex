# iBODY24 Design Token Cross-Platform Audit

## Color Token Mapping (All Platforms)

| Token          | CSS Variable           | Flutter (AppColors) | Watch (Color.kt)  | Hex Value        |
| -------------- | ---------------------- | ------------------- | ----------------- | ---------------- |
| Primary        | --color-primary        | .primary (blue600)  | Primary (Blue600) | #2563EB          |
| Primary Dark   | --color-primary-dark   | .primaryDark        | PrimaryVariant    | #1D4ED8          |
| Primary Light  | --color-primary-light  | .primaryLight       | Blue500           | #3B82F6          |
| Secondary      | --color-secondary      | .secondary          | Secondary         | #10B981          |
| Secondary Dark | --color-secondary-dark | .secondaryDark      | SecondaryVariant  | #059669          |
| Accent         | --color-accent         | .accent             | Accent            | #F59E0B          |
| Success        | --color-success        | .success            | Secondary         | #10B981          |
| Warning        | --color-warning        | .warning            | Accent            | #F59E0B          |
| Error          | --color-error          | .error              | Danger            | #EF4444          |
| Info           | --color-info           | .info               | Blue500           | #3B82F6          |
| Muted          | --color-muted          | .textMuted          | OnSurfaceVariant  | #6B7280 / varies |

## Surface Tokens (Theme-dependent)

| Token            | Frontend (Dark) | Admin (Light) | Flutter (Dark)     |
| ---------------- | --------------- | ------------- | ------------------ |
| Background       | #030712         | #f9fafb       | gray950 (#030712)  |
| Surface          | #111827         | #f9fafb       | gray900 (#111827)  |
| Surface Alt      | #0f172a         | #f1f5f9       | slate900 (#0f172a) |
| Surface Elevated | #1f2937         | #ffffff       | gray800 (#1f2937)  |
| Border           | #e5e7eb         | #e5e7eb       | white/5            |

## Grade Colors (Identical across all platforms)

| Grade | Meaning       | Color   | Hex     |
| ----- | ------------- | ------- | ------- |
| 1     | Best fitness  | Emerald | #34D399 |
| 2     | Good          | Cyan    | #22D3EE |
| 3     | Average       | Blue    | #3B82F6 |
| 4     | Below average | Amber   | #FBBF24 |
| 5     | Lowest        | Red     | #F87171 |

## HR Zone Colors (Identical across all platforms)

| Zone     | HR%    | Color   | Hex     |
| -------- | ------ | ------- | ------- |
| Extreme  | >= 90% | Red     | #EF4444 |
| High     | 80-90% | Orange  | #F97316 |
| Moderate | 60-70% | Lime    | #84CC16 |
| Low      | 50-60% | Emerald | #10B981 |
| Rest     | < 50%  | Blue    | #2563EB |

## Typography Scale

| Level    | Size | Weight   | Line Height | Letter Spacing |
| -------- | ---- | -------- | ----------- | -------------- |
| Display  | 36px | Bold     | 1.11 (40px) | -0.5px         |
| H1       | 30px | Bold     | 1.2 (36px)  | -0.3px         |
| H2       | 24px | SemiBold | 1.33 (32px) | -0.2px         |
| H3       | 20px | SemiBold | 1.4 (28px)  | 0              |
| H4       | 18px | SemiBold | 1.33 (24px) | 0              |
| Body LG  | 16px | Normal   | 1.75 (28px) | 0 (Korean opt) |
| Body MD  | 14px | Normal   | 1.7 (24px)  | 0 (Korean opt) |
| Body SM  | 13px | Normal   | 1.54 (20px) | 0              |
| Caption  | 12px | Normal   | 1.33 (16px) | 0.2px          |
| Overline | 11px | SemiBold | 1.45 (16px) | 0.5px          |
| Button   | 15px | SemiBold | 1.33 (20px) | 0              |

## Border Radius Scale

| Token | Value  | CSS Class    | Flutter        |
| ----- | ------ | ------------ | -------------- |
| sm    | 6px    | rounded-sm   | AppRadius.sm   |
| md    | 8px    | rounded-md   | AppRadius.md   |
| lg    | 12px   | rounded-lg   | AppRadius.lg   |
| xl    | 16px   | rounded-xl   | AppRadius.xl   |
| 2xl   | 20px   | rounded-2xl  | AppRadius.xxl  |
| full  | 9999px | rounded-full | AppRadius.full |

## Spacing Scale (4px base)

| Token | Value | CSS       | Flutter         |
| ----- | ----- | --------- | --------------- |
| xs    | 4px   | p-1 / m-1 | AppSpacing.xs   |
| sm    | 8px   | p-2 / m-2 | AppSpacing.sm   |
| md    | 12px  | p-3 / m-3 | AppSpacing.md   |
| base  | 16px  | p-4 / m-4 | AppSpacing.base |
| lg    | 20px  | p-5 / m-5 | AppSpacing.lg   |
| xl    | 24px  | p-6 / m-6 | AppSpacing.xl   |
| 2xl   | 32px  | p-8 / m-8 | AppSpacing.xxl  |
| 3xl   | 40px  | p-10      | AppSpacing.xxxl |
