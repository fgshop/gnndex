# Database Architect Memory — iBODY24

## Project Context

- **DB**: MySQL 8.0+
- **ORM**: Prisma 6.9
- **Backend**: NestJS 11
- **Primary data types**: 운동 세션, 심박수 로그 (시계열), 건강 데이터, 사용자, 기기

## Schema Design Patterns Established

### 1. Cascade Rules

- `User` → `ExerciseSession`: onDelete Cascade (사용자 삭제 시 운동 기록도 삭제)
- `ExerciseSession` → `HeartRateLog`: onDelete Cascade (세션 삭제 시 HR 로그도 삭제)
- `User` → `Organization`: onDelete SetNull (기관 삭제 시 사용자는 유지, FK만 null)
- `ExerciseSession` → `ExerciseProgram`: onDelete SetNull (프로그램 삭제 시 세션은 유지)

### 2. Soft Delete Strategy

- 모든 주요 엔티티에 `deletedAt` 필드 추가
- Hard delete 대상: `HeartRateLog` (시계열 데이터, 세션 삭제 시 자동 삭제)
- Soft delete 대상: User, Organization, ExerciseSession, Device, Notice, Faq, CoachingMessage
- 모든 deletedAt 필드에 인덱스 추가 (`@@index([deletedAt])`)

### 3. Index Strategy

#### High-Frequency Query Patterns

1. **ExerciseSession**
   - `[userId, startedAt(sort: Desc)]` — 사용자별 최신 세션 조회 (getUserSessions)
   - `[userId, createdAt(sort: Desc)]` — 대시보드 날짜 필터링 (getDashboard, getActivity)
   - `[exerciseType, startedAt]` — 운동 종류별 통계

2. **HeartRateLog**
   - `[sessionId, timestamp(sort: Asc)]` — Covering Index (세션별 시간 순서 조회)
   - `[timestamp]` — 파티션 키 (월별 아카이빙 작업)

3. **HealthRecord**
   - `[userId, recordedDate(sort: Desc)]` — 최신 건강 기록 조회 (upsert 패턴)
   - Unique constraint: `[userId, recordedDate]` — 일 단위 중복 방지

4. **Notice / Faq**
   - `[locale, isPinned(sort: Desc), createdAt(sort: Desc)]` — 고정 우선 + 최신순
   - `[locale, category, sortOrder(sort: Asc), isActive]` — 카테고리별 정렬

#### Covering Index Rationale

- `HeartRateLog`: sessionId + timestamp는 endSession() 시 모든 로그를 읽을 때 사용
- WHERE sessionId AND ORDER BY timestamp 쿼리가 인덱스만으로 해결됨

### 4. Data Integrity Rules

- **필수 필드**: email (unique), passwordHash, name, exerciseType, startedAt, recordedDate
- **기본값**: role (USER), isActive (true), grade1-5Minutes (0), fitnessGrade (nullable)
- **제약 조건**:
  - User.email: unique
  - HealthRecord: unique([userId, recordedDate])
  - Device: unique([userId, macAddress])
  - Notice/Faq/ExerciseProgram: unique([groupId, locale])

### 5. Time-Series Data — HeartRateLog

- **예상 볼륨**: 50-100 data points/sec/device → 100M+ rows in 6 months
- **파티셔닝 전략**: 월별 파티션 권장 (`PARTITION BY RANGE (MONTH(timestamp))`)
- **아카이빙 전략**: 3개월 후 콜드 스토리지 이관, 집계 데이터만 유지
- **인덱스**: sessionId + timestamp (Covering Index), timestamp (파티션 키)
- **데이터 타입**: BigInt @id (auto-increment), Timestamp(3) (밀리초 정밀도)

### 6. Multi-Language Content Pattern

- `groupId` + `locale` unique constraint
- 한국어(ko)가 원본, 7개 언어(en, zh, ja, th, vi, id, ru) 번역본
- ExerciseProgram, Notice, Faq, CoachingMessage에 적용
- 인덱스: `[locale, <primary_filter_field>]` 패턴

## Query Performance Notes

### Session Service Queries

1. `getUserSessions()`: userId + startedAt DESC → 인덱스 최적화 완료
2. `getSessionSummary()`: include heartRateLogs → N+1 없음 (relation)
3. `endSession()`: heartRateLogs 전체 로드 → avgHeartRate 계산

### Health Service Queries

1. `getDashboard()`: createdAt 범위 쿼리 (오늘) → 인덱스 추가
2. `getActivity()`: createdAt 범위 쿼리 (일/주/월) → 동일 인덱스 활용
3. `getTrends()`: 5주치 데이터 → 메모리 집계 (DB 집계 함수 미사용)
4. `syncSamsungHealth()`: upsert 패턴 → unique constraint 기반

### Dashboard 최적화 기회

- `getDashboard()`의 집계 쿼리는 현재 app-level 집계 → DB 집계 함수 사용 가능
- 예: `SELECT SUM(caloriesBurned), SUM(steps), COUNT(*) FROM exercise_sessions WHERE ...`
- 트레이드오프: Prisma aggregation API vs raw SQL vs 현재 방식

## Migration History

- Initial schema 완료 (2026-02-09)
- 개선 사항 적용 대기:
  - Soft delete 필드 추가
  - Cascade rule 명시
  - 인덱스 최적화 (sort 방향, covering index)
  - 필드 주석 보강

## Risk Assessment

### High Risk

- **HeartRateLog 파티셔닝 누락**: 6개월 후 100M+ rows 시 성능 저하 예상
- **세션 삭제 정책 미정의**: Hard delete vs Soft delete 명확화 필요

### Medium Risk

- **Organization 삭제 시 사용자 처리**: onDelete SetNull로 고아 사용자 발생 가능
- **트랜잭션 누락**: endSession()에서 avgHeartRate 계산 시 race condition 가능성

### Low Risk

- **JSON 필드 쿼리 불가**: bodyComposition, routines, incentiveCriteria는 JSON → 필터링 어려움
- **이메일 인덱스 중복**: email은 unique이므로 별도 index 불필요 (unique constraint가 인덱스 역할)

## Recommendations for Next Steps

1. 마이그레이션 실행 후 실제 데이터로 인덱스 성능 검증
2. HeartRateLog 파티셔닝 전략 구현 (MySQL 8.0 PARTITION BY RANGE)
3. 집계 쿼리 성능 테스트 (app-level vs DB aggregation)
4. Soft delete middleware 구현 (Prisma client extension)
5. 트랜잭션 정책 수립 (endSession, syncSamsungHealth 등)
