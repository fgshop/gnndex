# Mobile Lead - Agent Memory (GnnDex)

## Project: GnnDex Mobile (React Native + Expo 52)

### Architecture (2026-02-13)
- Mobile at `mobile/` (npm workspace member)
- Expo SDK 52, React 18.2.0, React Native 0.76.3
- React Navigation v6 (v7 requires React 19 types — DO NOT UPGRADE)
- `@gnndex/api-client` for type-safe API via openapi-fetch
- expo-secure-store for token storage

### Key Gotchas
- **React Navigation v7 + React 18 BREAKS**: v7 requires React 19 types. Use v6 for React 18 projects
- **@types/react version conflict in monorepo**: Root node_modules has @types/react@19 (from frontend/admin), mobile needs @types/react@18. Fix with tsconfig `paths` and `typeRoots`
- **tsconfig fix**: `"paths": { "react": ["./node_modules/@types/react"] }` + `"typeRoots": ["./node_modules/@types", "../node_modules/@types"]`
- **Pin @types/react@18.2.x** (not 18.3.x) — 18.3 has JSX type changes that break React Navigation

### Navigation
- RootNavigator: Auth/Main conditional, NativeStack
- AuthStack: Login, Register
- MainTabs (BottomTabs): Markets, Trade, Wallet, MyPage
