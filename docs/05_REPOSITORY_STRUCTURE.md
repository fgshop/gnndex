# 05. Repository Structure and Conventions

## 1. 디렉터리 구조

```txt
/
  docs/
  frontend/   # Next.js + TailwindCSS + shadcn/ui
  backend/    # NestJS API
  admin/      # Vite Admin Console
  mobile/     # React Native (Android, iOS)
  packages/
    api-client/ # OpenAPI 기반 공통 API 클라이언트
```

## 2. 앱별 권장 하위 구조

## 2.1 frontend

```txt
frontend/
  src/
    app/
    components/
    features/
    lib/
    hooks/
    styles/
  public/
```

## 2.2 backend

```txt
backend/
  src/
    modules/
    common/
    infrastructure/
  test/
```

## 2.3 admin

```txt
admin/
  src/
    pages/
    components/
    features/
    lib/
```

## 2.4 mobile

```txt
mobile/
  src/
    screens/
    components/
    features/
    services/
    store/
```

## 3. 브랜치 전략

1. `main`: 운영 기준
2. `develop`: 통합 개발 기준
3. `feature/*`: 기능 개발
4. `hotfix/*`: 긴급 수정

## 4. 커밋/PR 규칙

1. Conventional Commits 사용
   - `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`
2. PR 템플릿 필수 항목
   - 변경 요약, 영향 범위, 테스트 결과, 롤백 방법
3. 코드 리뷰 최소 1인 승인 + CI 통과

## 5. 환경변수 정책

1. 앱별 `.env.example` 유지
2. 비밀정보는 저장소 커밋 금지
3. 환경별 키 네이밍 통일
   - `APP_ENV`, `API_BASE_URL`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`

## 6. 품질 규칙

1. TypeScript strict 모드 권장
2. ESLint + Prettier 통일
3. 테스트 없는 핵심 로직 PR 금지
4. 공개 API 변경 시 문서 갱신 필수

## 7. 공통 패키지(확장 단계)

현재 도입된 공통 패키지:

1. `packages/api-client`: OpenAPI 기반 공통 클라이언트

향후 확장 권장 패키지:

1. `packages/types`: 공통 타입
2. `packages/ui`: 디자인 시스템 컴포넌트
