# 02. System Architecture

## 1. 아키텍처 목표

1. 도메인 분리: 사용자 웹, 관리자, 모바일, 백엔드를 독립적으로 배포
2. 안정성: 거래/입출금/인증을 분리하여 장애 전파 최소화
3. 확장성: API 게이트웨이와 이벤트 기반 통신으로 수평 확장
4. 감사가능성: 모든 상태 변화의 추적성 보장

## 2. 서비스 구성

## 2.1 애플리케이션 레이어

- `frontend`: Next.js + TailwindCSS + shadcn/ui
  - 사용자 거래 UI, 계정/자산, 시장 정보, 설정
- `admin`: Vite
  - 운영/준법/리스크 대시보드
- `mobile`: React Native (Android, iOS)
  - 사용자 앱 기능(인증/거래/자산/알림)
- `backend`: NestJS
  - 인증/사용자/지갑/주문/시장/알림/관리자 API

## 2.2 백엔드 모듈 경계

1. `auth`: 인증, 토큰, 2FA, 세션
2. `user`: 프로필, 보안설정, 권한
3. `wallet`: 잔고, 입출금, 네트워크 정책
4. `order`: 주문 접수/검증/상태 추적
5. `trade`: 체결, 거래내역, 수수료 정산
6. `market`: 시세, 캔들, 오더북 집계
7. `risk`: 제한 정책, 이상탐지 룰
8. `admin`: 관리자 API, 감사로그 조회
9. `notification`: 이메일/푸시/웹훅

## 2.3 데이터 계층

- Primary DB: MySQL (트랜잭션 데이터)
- Cache: Redis (세션, 레이트 리밋, 시세 캐시)
- Event Bus: Kafka or NATS (주문/체결/정산 이벤트)
- Object Storage: 문서/KYC 파일 저장

## 2.4 외부 연동

- 블록체인 노드/커스터디 서비스
- 가격 인덱스/마켓데이터 공급자
- 이메일/SMS/푸시 제공자
- KYC/AML 공급자

## 3. 요청 흐름

## 3.1 사용자 주문 생성

1. 클라이언트에서 API 요청 + 멱등성 키 전송
2. Auth 검증 + Risk 정책 검증
3. 주문 등록 + 이벤트 발행
4. 매칭 엔진 결과 이벤트 수신
5. 주문 상태/체결 반영 + 웹소켓 브로드캐스트

## 3.2 입금 반영

1. 체인 모니터가 입금 트랜잭션 감지
2. 컨펌 수 충족 확인
3. 지갑 원장 업데이트 + 알림 발송

## 4. 보안 설계 원칙

1. Zero Trust: 서비스 간 mTLS 또는 서명 기반 검증
2. Secret Management: 환경변수 직접 노출 금지, Vault/KMS 사용
3. Least Privilege: 운영자/서비스 계정 최소권한
4. Audit First: 관리자 변경/출금 승인/권한 변경 전부 감사로그 기록

## 5. 배포 구조

- 각 앱은 독립 CI/CD 파이프라인을 갖는다.
- `frontend`, `admin`: CDN + Edge 캐시
- `backend`: 컨테이너 오케스트레이션(Kubernetes 권장)
- `mobile`: Android/iOS 릴리즈 파이프라인 분리

## 6. 관측성 설계

1. 로그: JSON 구조화 로그 + 요청 상관관계 ID
2. 메트릭: API latency/error, 큐 지연, 잔고 불일치 감시
3. 트레이싱: OpenTelemetry 기반 분산 추적
4. 알림: Sev 등급별 Slack/PagerDuty 연동
