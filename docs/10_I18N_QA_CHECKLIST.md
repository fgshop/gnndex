# 10. I18N QA Checklist

## 1. 목적

다국어 번역의 기능적 완성(키/로케일/placeholder)과 표현 품질(원어민 톤, 법률 문구 정확성)을 함께 검증한다.

## 2. 자동 품질 게이트

1. 키/로케일/placeholder 정합성:
   - `npm run check:i18n`
2. 앱 빌드 검증:
   - `npm --workspace frontend run build`
   - `npm --workspace admin run build`
   - `npm --workspace mobile exec -- tsc --noEmit`

## 3. 수동 QA 체크리스트 (공통)

1. 언어 전환 즉시 반영(localStorage/SecureStore persisted)
2. 번역 미적용 키(raw key) 노출 없음
3. 변수 치환(`{{count}}`, `{{ticketId}}` 등) 문장 자연성 확인
4. 복수형 표현(특히 FR/ES/IT/DE/RU) 문맥 자연성 확인
5. 날짜/시간/수치 표기 현지화 일관성 확인
6. UI 길이 이슈(줄바꿈/오버플로우/버튼 잘림) 확인

## 4. 법률 문구 QA (Legal)

1. 약관/개인정보/수수료/리스크 고지의 의미 일치 여부
2. 규제/면책 문구가 원문 대비 완화/과장되지 않았는지 검토
3. 오해를 부르는 확정적 표현(예: 수익 보장) 제거
4. 법률 페이지 제목/섹션 헤더의 용어 통일
5. 국가별 민감 용어(개인정보, 쿠키, 데이터 보관, 책임 제한) 검토

## 5. 원어민 톤 QA (Locale Reviewer)

1. 직역투/기계번역 어투 제거
2. 제품 톤(신뢰/보안/거래 서비스) 일관성
3. 금융 도메인 용어 정확성(주문, 체결, 출금, 수수료, 리스크)
4. CTA 문구의 자연스러움 및 행동 유도력

## 6. 병렬 리뷰 운영안

1. Agent A (frontend/web):
   - `frontend/src/i18n/messages/*`
2. Agent B (admin/ops):
   - `admin/src/i18n/messages/*`
3. Agent C (mobile/app):
   - `mobile/src/i18n/messages/*`
4. Lead Agent:
   - 공통 용어집 승인
   - 충돌 해결 및 최종 merge

## 7. 완료 기준

1. `npm run check:i18n` 통과 (0 error, 0 warning)
2. 3개 앱 빌드 성공
3. 수동 QA 체크리스트 100% 완료
4. 법률 문구 리뷰 승인(최소 1명 이상)
