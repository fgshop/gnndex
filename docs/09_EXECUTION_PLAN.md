# 09. Execution Plan - 전체 시스템 고도화

## 1. 개요

현재 프로젝트는 codex-cli로 초기 프로토타입이 구현된 상태이다.
본 실행 계획은 docs/ 폴더의 기준 문서(01~08)에 따라 전체 시스템을 전문가 수준의 프로덕션 품질로 재작업하고 고도화하는 것을 목표로 한다.

## 2. 현재 상태 평가

### 2.1 백엔드 (NestJS - 포트 4000)
- **상태**: 핵심 기능 구현됨 (8 모듈, 50+ 엔드포인트)
- **품질 이슈**: 단위 테스트 없음, 레이트 리밋 미구현, 글로벌 에러 필터 미비, 구조화된 로깅 없음
- **고도화 필요**: 에러 처리 표준화, 레이트 리밋, 구조화 로깅, 유닛 테스트, Request ID 추적

### 2.2 프론트엔드 (Next.js - 포트 3000)
- **상태**: 스캐폴드 수준 (라우트만 존재, UI 미구현)
- **품질 이슈**: 실질적인 화면 구현 없음, API 연동 미완성
- **고도화 필요**: 전체 UI/UX 재구현, API 연동, 상태관리, 반응형 디자인

### 2.3 관리자 (Vite - 포트 8080)
- **상태**: 기본 라우팅만 구현
- **품질 이슈**: 페이지 내용 없음, 데이터 테이블/폼 미구현
- **고도화 필요**: 전체 관리 UI 구현, 권한 기반 렌더링, 대시보드

### 2.4 모바일 (React Native/Expo)
- **상태**: App.tsx 단일 파일 모놀리스 (43KB)
- **품질 이슈**: 화면 분리 안됨, 아키텍처 부재
- **고도화 필요**: 클린 아키텍처 재구조화, 화면 분리, 네비게이션

### 2.5 데이터베이스
- **상태**: Prisma 스키마 12 모델 완성
- **품질 이슈**: 마이그레이션 없음 (db push만 사용)
- **고도화 필요**: 정식 마이그레이션 생성, 시드 데이터

## 3. 실행 전략

Agent Team 기반 병렬 개발을 통해 5개 워크스트림을 동시에 진행한다.

### 워크스트림 구성

| 워크스트림 | 담당 Agent | 우선순위 |
|-----------|-----------|---------|
| WS-1: 백엔드 고도화 | backend-agent | P0 |
| WS-2: 프론트엔드 재구현 | frontend-agent | P0 |
| WS-3: 관리자 재구현 | admin-agent | P0 |
| WS-4: 모바일 재구조화 | mobile-agent | P1 |
| WS-5: 통합/검증 | lead (Team Lead) | P0 |

## 4. WS-1: 백엔드 고도화 (NestJS, 포트 4000)

### 4.1 글로벌 에러 필터
- 표준 에러 응답 스키마 구현 (`03_DATA_FORMAT_AND_CONTRACTS.md` 6절 준수)
- `timestamp`, `requestId`, `code`, `message`, `details` 필드
- 도메인별 에러 코드 정의 (AUTH_, ORDER_, WALLET_, ADMIN_)

### 4.2 Request ID 추적
- 미들웨어로 요청별 UUID v7 상관관계 ID 생성
- 모든 로그/응답에 requestId 포함

### 4.3 레이트 리밋
- @nestjs/throttler 또는 커스텀 미들웨어
- IP/사용자 기준 제한

### 4.4 구조화된 로깅
- JSON 포맷 로그 출력
- 요청/응답 로깅 인터셉터

### 4.5 입력 검증 강화
- 모든 DTO에 class-validator 데코레이터 완비
- whitelist + forbidNonWhitelisted + transform 적용 확인

### 4.6 Swagger 문서 개선
- 모든 엔드포인트에 @ApiOperation, @ApiResponse 태그
- 에러 응답 스키마 문서화

## 5. WS-2: 프론트엔드 재구현 (Next.js, 포트 3000)

### 5.1 디자인 시스템
- TailwindCSS + shadcn/ui 기반 일관된 디자인 토큰
- 다크/라이트 모드 지원
- 거래소 전문 UI 컴포넌트 (호가창, 차트, 오더폼)

### 5.2 페이지 구현
1. **랜딩 페이지** - 소개, CTA, 시세 미리보기
2. **인증 (로그인/회원가입)** - 이메일 가입, 소셜 로그인 준비, 2FA 설정
3. **거래 화면** - 호가창, 차트(캔들), 주문폼, 미체결/체결 내역
4. **마켓 목록** - 전체 마켓 검색/필터, 24h 변동률, 즐겨찾기
5. **지갑** - 자산 총액, 개별 잔고, 입출금 내역, 출금 신청
6. **마이페이지** - 프로필, 보안설정(2FA), 로그인 기록
7. **고객지원** - 문의 작성/목록/상세

### 5.3 상태 관리 & API 연동
- @gnndex/api-client 활용한 API 호출
- fetchWithAuth 래퍼로 토큰 자동 갱신
- 서버 상태: React Query 또는 SWR
- 클라이언트 상태: Zustand 또는 Context

### 5.4 실시간 데이터
- SSE 스트림 연동 (시세, 잔고, 주문)
- 자동 재연결 로직

## 6. WS-3: 관리자 재구현 (Vite, 포트 8080)

### 6.1 페이지 구현
1. **로그인** - 관리자 전용 로그인
2. **대시보드** - 주문/출금/감사로그 개요, 필터, SSE 실시간 갱신
3. **사용자 관리** - 검색, 상태 변경, 상세 조회
4. **권한 관리** - 관리자별 권한 그리드, 토글 변경
5. **출금 관리** - 상태별 필터, 승인/거절/브로드캐스트/확인 액션
6. **주문 조회** - 전체 주문 검색, 필터, 상세
7. **지갑 원장** - 원장 내역 검색
8. **감사 로그** - 필터/검색, 시간순 조회
9. **리스크** - 리스크 정책 설정 (스텁)
10. **고객지원 관리** - 티켓 목록, 답변

### 6.2 공통 기능
- 권한 기반 메뉴/버튼 렌더링
- 데이터 테이블 (정렬, 페이지네이션, 필터)
- 대시보드 공유 링크 생성/복원
- Toast 알림

## 7. WS-4: 모바일 재구조화 (React Native/Expo)

### 7.1 아키텍처
- 화면 분리 (screens/, components/, features/, services/)
- React Navigation 네비게이터 구성
- 상태관리 (Zustand 또는 Context)

### 7.2 화면 구현
1. **로그인/회원가입** - 바이오메트릭 인증 대비
2. **마켓 목록** - 실시간 시세, 검색
3. **거래 화면** - 호가창, 주문폼
4. **지갑** - 잔고, 입출금 내역
5. **마이페이지** - 설정, 보안

### 7.3 핵심 기능
- expo-secure-store 토큰 저장
- SSE 스트림 연동
- 오프라인 상태 처리

## 8. WS-5: 통합 및 검증 (Team Lead)

### 8.1 빌드 검증
- 전체 워크스페이스 빌드 성공 확인
- TypeScript strict 모드 타입체크 통과

### 8.2 API 클라이언트 동기화
- OpenAPI 스펙 변경 시 api-client 재생성
- 모든 앱에서 최신 타입 사용 확인

### 8.3 E2E 테스트 통과
- 기존 5개 E2E 테스트 스위트 유지/통과

## 9. 의존성 및 실행 순서

```
Phase A (병렬 시작):
  WS-1 백엔드 고도화 ─────────────────────→ 완료
  WS-2 프론트엔드 재구현 ─────────────────→ 완료
  WS-3 관리자 재구현 ─────────────────────→ 완료
  WS-4 모바일 재구조화 ───────────────────→ 완료

Phase B (통합):
  WS-5 빌드 검증 + API 동기화 + E2E ─────→ 완료
```

## 10. 완료 기준

1. 모든 앱 빌드 성공 (npm workspace build)
2. TypeScript strict 타입체크 통과
3. 기존 E2E 테스트 통과
4. 프론트엔드: 모든 핵심 페이지 구현 및 API 연동
5. 관리자: 모든 관리 기능 구현 및 권한 기반 접근 제어
6. 모바일: 클린 아키텍처 화면 분리 완료
7. 백엔드: 글로벌 에러 필터, 레이트 리밋, Request ID 추적 구현

---

## 11. 실행 결과 (2026-02-13 완료)

### WS-1: 백엔드 고도화 — 완료
- 글로벌 에러 필터 (`HttpExceptionFilter`) — 표준 에러 응답 (timestamp, requestId, code, message, details)
- 도메인 에러 코드 enum (`ErrorCode`) — AUTH_*, ORDER_*, WALLET_*, ADMIN_*, MARKET_*, SUPPORT_*
- Request ID 미들웨어 — UUID 생성, X-Request-Id 헤더
- 레이트 리밋 (@nestjs/throttler) — 글로벌 100/min, 로그인 5/min, 가입 3/min
- 구조화 로깅 인터셉터 — JSON 포맷, 민감필드 마스킹 (password, token, secret)
- Swagger 문서 강화 — Bearer auth, 에러 응답 스키마, @ApiParam/@ApiOperation
- 신규 파일 6개, 수정 파일 8개
- `npm --workspace backend run build` 성공

### WS-2: 프론트엔드 재구현 — 완료
- 랜딩 페이지 — Hero, 실시간 마켓 티커 스트립, 종합지수, 마켓 보드, 보안 원칙
- 인증 (로그인/회원가입) — 폼 검증, 2FA 코드 입력
- 거래 화면 — 호가창(일반/누적), TradingView 차트, 주문폼(지정가/시장가/예약), 주문내역(필터/정렬/페이지네이션), SSE 스트림
- 마켓 목록 — 실시간 시세 테이블, SSE 스트림, Top Gainer/Loser
- 지갑 — 잔고 목록, SSE 잔고 스트림, 출금 신청
- 마이페이지 — 프로필, 2FA 설정
- 고객지원 — 문의 작성/목록/상세
- SSE 스트림 유틸 (streamSseWithBackoff), 자동 재연결
- JSON-LD 구조화 데이터 (SEO)
- `npm --workspace frontend run build` 성공
- 다국어 키 정합성 보강(2026-02-13 추가)
  - 랜딩 페이지 i18n 키 네이밍 불일치(`landing.featured.*`, `landing.why.*`, `landing.trust.*`, `landing.cta.*`, `landing.error.*`) 정리
  - `frontend/src/app/page.tsx`의 번역 키를 메시지 계약(`frontend/src/i18n/messages/landing.ts`)과 1:1로 맞춤

### WS-3: 관리자 재구현 — 완료
- TailwindCSS v4 + 전문 다크 테마
- PermissionGate 컴포넌트 (15개 권한 기반 조건부 렌더링)
- 11개 페이지: 로그인, 대시보드, 사용자, 권한, 출금, 주문, 원장, 감사로그, 리스크, 지원, 컴플라이언스
- 다크 사이드바 네비게이션 (4개 섹션 그룹, 권한 기반 메뉴 필터링)
- 색상 코딩된 상태 뱃지, 필터, 페이지네이션, 상세 모달
- `npm --workspace admin run build` 성공
- 다국어 영역 보강(2026-02-13 추가)
  - 관리자 로케일 런타임 연결: `LocaleProvider`를 `admin/src/main.tsx`에 적용
  - 사이드바/로그인 화면 다국어 전환: `admin/src/components/AdminLayout.tsx`, `admin/src/pages/AdminLoginPage.tsx`
  - 미존재 번역 모듈 추가: `permissions.ts`, `audit.ts`, `support.ts`, `risk.ts`, `compliance.ts`
  - 관리자 전체 페이지 다국어 키 연결: Dashboard/Users/Orders/Permissions/Withdrawals/Wallet Ledger/Audit/Support/Risk/Compliance

### WS-4: 모바일 재구조화 — 완료
- App.tsx 1,493줄 → 12줄 (27개 소스 파일로 분해)
- 디렉터리 구조: navigation/, screens/, components/, hooks/, utils/
- React Navigation v6 — AuthStack(Login, Register) + MainTabs(Markets, Trade, Wallet, MyPage)
- 6개 화면: LoginScreen, RegisterScreen, MarketListScreen, TradeScreen, WalletScreen, MyPageScreen
- 6개 재사용 컴포넌트: SegmentControl, TickerList, OrderbookDisplay, BalanceCard, OrderItem, FilterChips
- SSE 스트림 + 지수 백오프 재연결 로직
- `npm --workspace mobile exec -- tsc --noEmit` 성공

### WS-5: 통합 검증 — 완료
- 백엔드 빌드: 성공
- 프론트엔드 빌드: 성공
- 관리자 빌드: 성공 (313.83 kB JS, 15.89 kB CSS)
- 모바일 타입체크: 성공
- i18n 품질 게이트 추가: `npm run check:i18n` (로케일 누락/키 누락/placeholder 정합성 점검)
- 법률 번역 리뷰 이슈 문서 생성: `docs/11_LEGAL_LOCALE_REVIEW_ISSUES.md` (로케일별 우선순위/웨이브 실행 기준)
