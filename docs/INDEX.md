# Global Coin Exchange - Documentation Index

본 디렉터리는 코인 거래소 개발의 단일 기준(Single Source of Truth)입니다.
요구사항, 아키텍처, 데이터 규약, API, 실행 프로세스는 아래 문서를 기준으로 관리합니다.

## 1. 문서 목록

1. `01_PROJECT_REQUIREMENTS.md`
   - 제품 목표, 범위, 핵심 기능, 비기능 요구사항
2. `02_SYSTEM_ARCHITECTURE.md`
   - 전체 시스템 구성, 앱별 책임, 인프라/보안 원칙
3. `03_DATA_FORMAT_AND_CONTRACTS.md`
   - 데이터 정밀도, 시간/통화/수량 포맷, 공통 계약
4. `04_API_ARCHITECTURE.md`
   - NestJS API 구조, 인증/권한, REST/WS 계약
5. `05_REPOSITORY_STRUCTURE.md`
   - 모노레포 디렉터리 규칙, 코딩/테스트/환경변수 정책
6. `06_AGENT_OPERATING_MODEL.md`
   - 에이전트(역할)별 업무 분장, 산출물, 핸드오프 규칙
7. `07_DEVELOPMENT_EXECUTION_PROCESS.md`
   - 스프린트, 품질 게이트, 릴리즈/운영/장애 대응 절차
8. `08_ROADMAP_AND_MILESTONES.md`
   - 단계별 개발 일정, 완료 기준, 리스크 관리
9. `09_EXECUTION_PLAN.md`
   - 전체 시스템 고도화 실행 계획, 워크스트림별 작업 범위, 실행 결과
10. `10_I18N_QA_CHECKLIST.md`
   - 다국어 품질 게이트, 원어민 톤/법률 문구 검수 체크리스트
11. `11_LEGAL_LOCALE_REVIEW_ISSUES.md`
   - 법률 번역 로케일별 우선 이슈 리스트 및 웨이브별 수정 순서
12. `12_FRONTEND_HERO_AND_2FA.md`
   - 히어로 Cosmic Background(지구·위성·유성·테마 전환) 및 2FA QR 코드 구현 상세

## 2. 우선순위 규칙

문서 간 충돌 시 우선순위는 아래 순서를 따릅니다.

1. `01_PROJECT_REQUIREMENTS.md`
2. `03_DATA_FORMAT_AND_CONTRACTS.md`
3. `04_API_ARCHITECTURE.md`
4. `02_SYSTEM_ARCHITECTURE.md`
5. `05_REPOSITORY_STRUCTURE.md`
6. `07_DEVELOPMENT_EXECUTION_PROCESS.md`
7. `06_AGENT_OPERATING_MODEL.md`
8. `08_ROADMAP_AND_MILESTONES.md`

## 3. 변경 관리 규칙

1. 요구사항 변경 시 반드시 `01`, `03`, `04`를 동시 검토한다.
2. API 변경 시 OpenAPI 스펙, DTO, 모바일/프론트 SDK 영향도를 함께 기록한다.
3. 브레이킹 변경은 릴리즈 노트와 마이그레이션 가이드를 필수 작성한다.
4. 문서 변경 PR에는 변경 사유, 영향 범위, 롤백 방법을 포함한다.
