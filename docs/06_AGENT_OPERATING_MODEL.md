# 06. Agent Operating Model

## 1. 목적

개발을 병렬로 진행하더라도 일관성을 유지하기 위해 역할과 책임을 명확히 정의한다.

## 2. 에이전트 역할

1. Product Agent
   - 요구사항 관리, 우선순위 조정, 수용 기준 확정
2. Architecture Agent
   - 시스템/도메인/데이터 아키텍처 검토
3. Backend Agent
   - NestJS API, 도메인 로직, 데이터 계층 구현
4. Frontend Agent
   - Next.js 사용자 웹 UI 구현
5. Admin Agent
   - Vite 기반 운영자 도구 UI 구현
6. Mobile Agent
   - React Native Android/iOS 기능 구현
7. QA Agent
   - 테스트 전략, 자동화, 회귀 검증
8. Security Agent
   - 위협 모델링, 보안 점검, 릴리즈 보안 게이트
9. DevOps Agent
   - CI/CD, 인프라, 모니터링, 릴리즈 자동화

## 3. RACI (핵심 영역)

| 영역 | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| 요구사항 확정 | Product | Product Lead | Architecture, Backend, Frontend | All |
| API 설계 | Backend | Tech Lead | Frontend, Mobile, QA | All |
| 데이터 계약 | Architecture | Tech Lead | Backend, Frontend, Mobile | All |
| UI/UX 구현 | Frontend/Admin/Mobile | Product Lead | QA | All |
| 보안 검토 | Security | Security Lead | Backend, DevOps | All |
| 릴리즈 | DevOps | Tech Lead | QA, Security | All |

## 4. 핸드오프 규칙

1. API 변경
   - OpenAPI 변경 PR + 변경 로그 + 영향 리스트
2. 데이터 포맷 변경
   - `03_DATA_FORMAT_AND_CONTRACTS.md` 동시 업데이트
3. UI 기능 전달
   - 화면 체크리스트 + API 의존성 + 예외 시나리오
4. 운영 기능 전달
   - 감사로그 이벤트 정의 + 권한 매트릭스

## 5. 의사결정 규칙

1. 제품 방향 충돌: Product Lead 최종 결정
2. 아키텍처 충돌: Tech Lead 최종 결정
3. 보안 이슈: Security Lead 거부권 보유
4. 일정 충돌: 범위 축소 원칙으로 조정

## 6. 에이전트별 산출물

1. Product Agent: PRD, 우선순위 백로그, 릴리즈 범위
2. Architecture Agent: 아키텍처 결정 기록(ADR), 데이터 계약
3. Backend Agent: API 코드, OpenAPI, 테스트
4. Frontend/Admin/Mobile Agent: 화면 구현, 상태관리, E2E 시나리오
5. QA Agent: 테스트 리포트, 회귀 결과
6. Security Agent: 보안 점검표, 취약점 리포트
7. DevOps Agent: 파이프라인, 모니터링 대시보드, 런북

