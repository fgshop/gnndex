# 04. API Architecture (NestJS)

## 1. 목표

NestJS 기반 API를 도메인 모듈화하고, REST + WebSocket을 분리 설계하여
거래소 핵심 흐름(인증, 주문, 체결, 잔고, 관리자)을 안정적으로 제공한다.

## 2. 기본 원칙

1. Controller는 I/O 검증과 응답 직렬화만 담당
2. 비즈니스 로직은 Service/UseCase로 분리
3. 외부 연동은 Adapter 계층으로 분리
4. DTO와 Domain 모델 분리
5. OpenAPI 스키마를 코드와 동기화

## 3. 모듈 구조

```txt
backend/src
  /modules
    /auth
    /user
    /wallet
    /order
    /trade
    /market
    /risk
    /admin
    /notification
  /common
    /guards
    /interceptors
    /filters
    /decorators
  /infrastructure
    /db
    /cache
    /event-bus
    /external
```

## 4. 인증/인가

1. 사용자 API
   - JWT Access(짧은 만료) + Refresh(회전 토큰)
   - Refresh Token은 DB 해시 저장 + Rotation + Revoke 정책 적용
   - 401 응답 시 `/v1/auth/refresh` 1회 재시도 후 원요청 재실행
2. 관리자 API
   - `ADMIN` Role + `AdminPermission` 조합으로 접근 제어
3. 권한 모델
   - Role + Permission 세분화(RBAC)
4. 민감 작업 보호
   - Step-up 인증(2FA, 재인증)

## 5. REST API 설계

## 5.1 Public API

- `GET /v1/market/tickers`
- `GET /v1/market/stream/tickers` (SSE)
- `GET /v1/market/orderbook/:symbol`
- `GET /v1/market/candles`

시장 데이터 조회 규약:

1. `GET /v1/market/tickers`
   - query: `symbols`(선택, CSV), `limit`(선택, 기본 20)
2. `GET /v1/market/stream/tickers` (SSE)
   - query: `symbols`(선택, CSV), `limit`(선택), `intervalMs`(선택, 기본 5000, 범위 1000~60000)
   - payload: `eventType`, `eventVersion`, `occurredAt`, `data[]`
3. `GET /v1/market/orderbook/:symbol`
   - path: `symbol` (`BTC-USDT` 형식)
   - query: `limit`(선택, 기본 20, 최대 100)
4. `GET /v1/market/candles`
   - query: `symbol`(필수), `interval`(선택: `1m|5m|15m|1h|4h|1d`, 기본 `1m`), `limit`(선택, 기본 120, 최대 500)

## 5.2 Private API

- `POST /v1/orders`
- `DELETE /v1/orders/:orderId`
- `GET /v1/orders`
- `GET /v1/orders/stream` (SSE, Auth)
- `GET /v1/wallet/balances`
- `GET /v1/wallet/stream/balances` (SSE, Auth)
- `GET /v1/wallet/ledger`
- `GET /v1/wallet/withdrawals`
- `POST /v1/wallet/withdrawals`
- `POST /v1/wallet/admin-adjust` (개발/운영 제한)

사용자 주문 조회 필터:

1. `symbol`, `status`, `statuses[]`, `side`, `type`
2. `fromCreatedAt`, `toCreatedAt` (UTC ISO-8601)
3. `sortBy` (`CREATED_AT|PRICE|QUANTITY`), `sortOrder` (`ASC|DESC`)
4. `page`, `limit`
5. `status`와 `statuses[]`를 동시에 보낼 경우 교집합 기준으로 적용
6. `GET /v1/orders/stream`는 동일 필터 + `intervalMs`(기본 5000, 1000~60000) 지원
7. `GET /v1/wallet/stream/balances`는 `intervalMs`(기본 5000, 1000~60000) 지원

인증 확장 API:

- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `POST /v1/auth/2fa/setup`
- `POST /v1/auth/2fa/enable`

## 5.3 Admin API

- `GET /v1/admin/dashboard/overview`
- `GET /v1/admin/dashboard/stream` (SSE)
- `POST /v1/admin/dashboard/share-links`
- `GET /v1/admin/dashboard/share-links/:shareCode`
- `GET /v1/admin/users`
- `GET /v1/admin/orders`
- `GET /v1/admin/permissions/users`
- `PATCH /v1/admin/permissions/users/:userId`
- `GET /v1/admin/wallet-ledger`
- `GET /v1/admin/withdrawals`
- `POST /v1/admin/withdrawals/:withdrawalId/approve`
- `POST /v1/admin/withdrawals/:withdrawalId/reject`
- `POST /v1/admin/withdrawals/:withdrawalId/broadcast`
- `POST /v1/admin/withdrawals/:withdrawalId/confirm`
- `POST /v1/admin/withdrawals/:withdrawalId/fail`
- `GET /v1/admin/audit-logs`

출금 조회 필터:

1. `email`, `asset`, `network`, `status`
2. `fromRequestedAt`, `toRequestedAt` (UTC ISO-8601)
3. `page`, `limit`

감사로그 조회 필터:

1. `actorEmail`, `action`, `targetType`
2. `fromCreatedAt`, `toCreatedAt` (UTC ISO-8601)
3. `page`, `limit`

사용자 조회 필터:

1. `email`, `status`
2. `fromCreatedAt`, `toCreatedAt` (UTC ISO-8601)
3. `page`, `limit`

권한 대상 조회 필터:

1. `email`
2. `fromCreatedAt`, `toCreatedAt` (UTC ISO-8601)
3. `page`, `limit`

대시보드 개요/스트림 필터:

1. `limit` (섹션당 최신 로우 개수)
2. `orderStatus`, `orderSymbol`
3. `withdrawalStatus`
4. `auditAction`
5. `stream`의 경우 `intervalMs`(1000~60000)

대시보드 섹션 오류 모델:

1. 각 섹션(`orders`, `withdrawals`, `auditLogs`)은 `permissionDenied`와 `partialError`를 함께 반환
2. `partialError.code`는 `PERMISSION_DENIED` 또는 `SECTION_LOAD_FAILED`
3. 섹션 단위 실패가 있어도 전체 API는 가능한 데이터와 함께 200 응답을 반환

대시보드 스트림 이벤트 모델:

1. `eventVersion`은 `2`로 고정
2. `eventType`은 `admin.dashboard.overview.full`, `admin.dashboard.overview.partial`, `admin.dashboard.error`
3. `diff`는 직전 스냅샷 대비 변경 여부(`changed`), 섹션 변경 플래그(`sectionChanges`), 집계 증감(`summaryDelta`)을 포함
4. `overview.partial`은 섹션 단위 `partialError`가 존재함을 의미하며, 클라이언트는 `full`/`partial`/`error`를 명시적으로 구분해 표시

대시보드 공유 링크 모델:

1. `POST /admin/dashboard/share-links`는 필터 payload + `expiresInMinutes`로 만료형 링크를 발급
2. `GET /admin/dashboard/share-links/:shareCode`는 만료 전 payload를 복원하며 만료 시 `410 Gone` 반환
3. payload 필드: `orderStatus`, `orderSymbol`, `withdrawalStatus`, `auditAction`, `presetSlot`
4. `expiresInMinutes` 허용 범위는 `5~10080`(최대 7일)

권한 매핑:

1. `GET /admin/dashboard/overview` / `GET /admin/dashboard/stream` -> `ORDER_READ`, `WITHDRAWAL_READ`, `AUDIT_LOG_READ`를 섹션별로 독립 체크
2. `GET /admin/users` -> `USER_READ`
3. `GET /admin/orders` -> `ORDER_READ`
4. `GET /admin/permissions/users` -> `ADMIN_PERMISSION_READ`
5. `PATCH /admin/permissions/users/:userId` -> `ADMIN_PERMISSION_WRITE`
6. `GET /admin/wallet-ledger` -> `WALLET_LEDGER_READ`
7. `GET /admin/withdrawals` -> `WITHDRAWAL_READ`
8. `POST /admin/withdrawals/:withdrawalId/approve` -> `WITHDRAWAL_APPROVE`
9. `POST /admin/withdrawals/:withdrawalId/reject` -> `WITHDRAWAL_REJECT`
10. `POST /admin/withdrawals/:withdrawalId/broadcast` -> `WITHDRAWAL_BROADCAST`
11. `POST /admin/withdrawals/:withdrawalId/confirm` -> `WITHDRAWAL_CONFIRM`
12. `POST /admin/withdrawals/:withdrawalId/fail` -> `WITHDRAWAL_FAIL`
13. `POST /wallet/admin-adjust` -> `BALANCE_ADJUST`
14. `GET /admin/audit-logs` -> `AUDIT_LOG_READ`

권한 변경 보호 규칙:

1. 자기 계정에서 `ADMIN_PERMISSION_WRITE` 제거 금지
2. 시스템 전체에서 `ADMIN_PERMISSION_WRITE` 보유 관리자가 최소 1명 이상 유지되어야 함

## 6. WebSocket 이벤트 설계

채널 예시:

1. `market:ticker:{symbol}`
2. `market:orderbook:{symbol}`
3. `user:orders:{userId}`
4. `user:balances:{userId}`

이벤트 페이로드 원칙:

- `eventId`, `eventType`, `eventVersion`, `occurredAt` 포함
- 재전송/복구를 위한 시퀀스 번호 포함
- 초기 구현은 `GET /v1/market/stream/tickers` SSE로 제공하고, 추후 WebSocket 채널로 확장

## 7. 멱등성과 일관성

1. 주문/출금/민감 상태변경 API는 `Idempotency-Key` 필수
2. 중복 요청은 동일 결과 또는 최신 상태 반환
3. Eventual consistency 구간은 상태 조회 API로 보강
4. 출금 운영 API(`approve/reject/broadcast/confirm/fail`)는 상태 전이 가드로 잘못된 순서를 차단

## 8. 오류 처리와 레이트 리밋

1. 글로벌 예외 필터로 표준 에러 스키마 반환
2. 인증 실패/권한 실패/도메인 검증 실패 분리 코드
3. 사용자/IP/API 키 기준 레이트 리밋 적용

## 9. 테스트 전략

1. Unit: 도메인 로직/정책 검증
2. Integration: DB/Cache/Event Bus 포함
3. Contract: OpenAPI 기반 클라이언트 호환성 검증
4. E2E: 핵심 사용자 시나리오(주문, 체결, 출금)

## 10. 보안 점검 항목

1. 입력 검증/직렬화 화이트리스트
2. SQL Injection/XSS/SSRF 방어
3. 민감 로그 마스킹
4. 관리자 엔드포인트 접근 통제
