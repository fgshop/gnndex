# 07. Development Execution Process

## 1. 개발 원칙

1. 문서 우선: 구현 전 요구사항/계약/테스트 기준을 먼저 확정
2. 작은 단위 배포: 기능 플래그 기반 점진 배포
3. 관측 가능한 시스템: 로그/메트릭/트레이싱 기본 탑재
4. 보안 내재화: 설계 단계부터 보안 검토 수행

## 2. 스프린트 운영

1. 주기: 2주 스프린트
2. 이벤트
   - Sprint Planning
   - Daily Sync
   - Mid-Sprint Risk Check
   - Sprint Review
   - Retrospective
3. 산출물
   - Sprint Goal
   - 구현 범위(스토리 + 수용 기준)
   - 테스트 계획

## 3. 개발 플로우

1. 요구사항 확정
   - PRD 업데이트 + 수용 기준 정의
2. 설계 확정
   - API/데이터 계약 + ADR 작성
3. 구현
   - 기능 단위 브랜치 + 테스트 동시 작성
4. 검증
   - Unit/Integration/E2E + 보안 체크
5. 릴리즈
   - Staging 검증 후 Production 승격

## 4. 품질 게이트 (Merge 기준)

1. CI 빌드 성공
2. 린트/타입체크 통과
3. 테스트 통과
4. 보안 스캔(의존성, 시크릿 누출) 통과
5. API/문서 변경 동기화 확인
6. 백엔드 운영 E2E(`test:e2e:admin-flow`, `test:e2e:admin-dashboard-overview`, `test:e2e:admin-dashboard-share-link`, `test:e2e:permission-guard`, `test:e2e:market-public`) 통과
7. 다국어 품질 점검(`npm run check:i18n`) 통과

## 5. 환경 전략

1. Local: 개발자 환경
2. Dev: 통합 개발 환경
3. Staging: 사전 검증 환경
4. Production: 실서비스

환경별 공통 원칙:

- 구성은 코드로 관리(IaC 권장)
- 시크릿은 환경별 분리
- 운영 데이터 접근은 최소권한

## 6. 테스트 전략

1. Unit
   - 도메인 규칙, 계산 로직, 정책 로직
2. Integration
   - DB/캐시/이벤트 연동
3. E2E
   - 회원가입 -> 입금 -> 주문 -> 체결 -> 출금
   - 백엔드 운영 플로우 스모크: `npm --workspace backend run test:e2e:admin-flow`
   - 백엔드 운영 대시보드 스모크: `npm --workspace backend run test:e2e:admin-dashboard-overview`
   - 백엔드 운영 대시보드 공유링크 스모크: `npm --workspace backend run test:e2e:admin-dashboard-share-link`
   - 백엔드 권한 가드 스모크: `npm --workspace backend run test:e2e:permission-guard`
   - 백엔드 공개 시세 API 스모크: `npm --workspace backend run test:e2e:market-public`
4. 성능/부하
   - 주문 API, 시세 API, WS fan-out
5. 보안
   - 인증 우회, 권한 상승, 입력 검증 우회

## 7. 릴리즈 프로세스

1. 릴리즈 후보 태깅
2. 변경점 검토(브레이킹 여부 포함)
3. Staging 승인(Tech + QA + Security)
4. 점진 배포(Canary/Blue-Green)
5. 운영 모니터링 강화(초기 24시간)

## 8. 장애 대응

1. 장애 등급 정의 (SEV1~SEV3)
2. 탐지 -> 완화 -> 복구 -> RCA 문서화
3. 재발방지 액션 아이템 추적

## 9. 문서 유지보수 정책

1. 구현 변경 PR에 문서 변경 포함이 기본값
2. 월 1회 문서 정합성 리뷰
3. 신규 기능은 문서 없이 개발 시작 금지

## 10. 로컬 실행 순서 (필수)

Step 1. DB/Prisma 동기화

1. `cd backend`
2. `npx prisma db push`

Step 2. OpenAPI SDK 동기화

1. `cd ..`
2. `npm --workspace packages/api-client run generate`
3. `npm --workspace packages/api-client run build`
4. `generate`와 `build`는 순차 실행(병렬 실행 금지)

Step 3. 전체 빌드 검증

1. `npm --workspace backend run build`
2. `npm --workspace admin run build`
3. `npm --workspace frontend run build`
4. `npm --workspace mobile exec -- tsc --noEmit`
5. `npm run check:i18n`

Step 4. 로컬 서비스 실행(고정 포트)

1. `npm run dev:frontend` -> `http://localhost:3000`
2. `npm run dev:backend` -> `http://localhost:4000`
3. `npm run dev:admin` -> `http://localhost:8080`

운영자 계정 준비(선택):

1. `npm --workspace backend run admin:bootstrap -- <email> <password>`
