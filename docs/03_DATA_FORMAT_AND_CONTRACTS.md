# 03. Data Format and Contracts

## 1. 목적

모든 앱(`frontend`, `admin`, `mobile`, `backend`)에서 동일한 데이터 규약을 사용하여
정밀도 오류, 시간대 오류, 금액 계산 오류를 방지한다.

## 2. 공통 데이터 원칙

1. 금액/수량/가격은 부동소수점(float) 금지
   - 문자열(decimal string) 또는 정수 최소단위로 전송
2. 시간은 UTC ISO-8601 (`YYYY-MM-DDTHH:mm:ss.SSSZ`)
3. 식별자는 UUID v7 권장
4. 상태값은 enum으로 명시하고 미정값 금지

## 3. 자산 및 시장 식별 규칙

1. 자산 코드: `BTC`, `ETH`, `USDT`
2. 마켓 심볼: `BTC-USDT` 형식
3. 네트워크: `BTC`, `ETH-ERC20`, `TRX-TRC20` 등

## 4. 정밀도 규칙

## 4.1 기본 단위

- `price`: 문자열 decimal, 마켓별 최대 소수점 자리수 준수
- `quantity`: 문자열 decimal, 자산별 최소 주문 단위 준수
- `amount`: `price * quantity`, 서버에서 재검증

## 4.2 반올림 정책

- 표시값: 반올림(HALF_UP)
- 정산값: 내림(TRUNCATE) 우선, 수수료 정책에 따라 별도 규칙 적용
- 정책 변경 시 버전 필드로 구분

## 5. 예시 DTO

```json
{
  "orderId": "018f5e3c-9a54-7a2d-bb10-a2d5f61f9f20",
  "symbol": "BTC-USDT",
  "side": "BUY",
  "type": "LIMIT",
  "price": "51234.12",
  "quantity": "0.015",
  "filledQuantity": "0.010",
  "status": "PARTIALLY_FILLED",
  "createdAt": "2026-02-12T07:21:31.120Z"
}
```

시장 데이터 예시:

```json
{
  "symbol": "BTC-USDT",
  "lastPrice": "51234.12",
  "openPrice24h": "50000.00",
  "highPrice24h": "51640.00",
  "lowPrice24h": "49880.10",
  "volume24h": "1234.5678",
  "changePercent24h": "2.4682",
  "updatedAt": "2026-02-12T10:20:00.000Z"
}
```

## 6. 에러 응답 계약

```json
{
  "timestamp": "2026-02-12T07:21:31.120Z",
  "requestId": "018f5e3c-9a54-7a2d-bb10-a2d5f61f9f20",
  "code": "ORDER_INSUFFICIENT_BALANCE",
  "message": "Available balance is insufficient",
  "details": {
    "symbol": "BTC-USDT",
    "required": "120.50",
    "available": "118.40"
  }
}
```

## 7. 상태 머신 규약

## 7.1 주문 상태

`NEW -> PARTIALLY_FILLED -> FILLED`

예외 흐름:

- `NEW -> CANCELED`
- `NEW/PARTIALLY_FILLED -> REJECTED` (정책/시스템 사유)

## 7.2 출금 상태

`REQUESTED -> REVIEW_PENDING -> APPROVED -> BROADCASTED -> CONFIRMED`

예외 흐름:

- `REQUESTED/REVIEW_PENDING -> REJECTED`
- `APPROVED/BROADCASTED -> FAILED`

운영 액션 기준 상태 전이:

1. `approve`: `REQUESTED|REVIEW_PENDING -> APPROVED`
2. `reject`: `REQUESTED|REVIEW_PENDING -> REJECTED` (잠금 잔고 반환)
3. `broadcast`: `APPROVED -> BROADCASTED` (`txHash` 기록)
4. `confirm`: `APPROVED|BROADCASTED -> CONFIRMED` (잠금 잔고 최종 차감)
5. `fail`: `APPROVED|BROADCASTED -> FAILED` (`failureReason` 기록 + 잠금 잔고 반환)

## 7.3 지갑 원장 엔트리 타입

- `DEPOSIT`
- `WITHDRAWAL`
- `ORDER_LOCK`
- `ORDER_UNLOCK`
- `TRADE_SETTLEMENT`
- `ADJUSTMENT`

## 7.4 관리자 권한(enum)

- `USER_READ`
- `ORDER_READ`
- `WALLET_LEDGER_READ`
- `WITHDRAWAL_READ`
- `WITHDRAWAL_APPROVE`
- `WITHDRAWAL_REJECT`
- `WITHDRAWAL_BROADCAST`
- `WITHDRAWAL_CONFIRM`
- `WITHDRAWAL_FAIL`
- `BALANCE_ADJUST`
- `AUDIT_LOG_READ`
- `ADMIN_PERMISSION_READ`
- `ADMIN_PERMISSION_WRITE`

## 7.5 감사로그 계약

```json
{
  "id": "clyxxxxxxxxxxxx",
  "actorUserId": "clyyyyyyyyyyyyy",
  "actorEmail": "ops@gnndex.com",
  "action": "WITHDRAWAL_APPROVED",
  "targetType": "WITHDRAWAL",
  "targetId": "clzzzzzzzzzzzzz",
  "metadata": {
    "previousStatus": "REVIEW_PENDING",
    "nextStatus": "APPROVED"
  },
  "createdAt": "2026-02-12T08:15:20.120Z"
}
```

## 8. 버전 관리

1. API 버전: `/v1`, `/v2`
2. 이벤트 버전: `eventType` + `eventVersion`
3. 브레이킹 변경 시 최소 1개 릴리즈 동안 구버전 병행 제공

## 9. 관리자 대시보드 URL 쿼리 계약

공유 가능한 운영 화면 상태를 위해 `admin` 대시보드는 다음 쿼리를 사용한다.

1. `orderStatus`
2. `orderSymbol`
3. `withdrawalStatus`
4. `auditAction`
5. `presetSlot` (`default|risk-watch|compliance`)
6. `shareTtlPreset` (`30|120|360|1440|10080`, 공유 링크 만료 프리셋 분 단위)
7. `share` (만료형 단축 링크 코드, `GET /v1/admin/dashboard/share-links/:shareCode`로 payload 복원)
