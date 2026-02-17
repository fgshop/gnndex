# 11. Legal Locale Review Issues

- Generated: 2026-02-13
- Source: `frontend/src/i18n/messages/legal.ts`
- Goal: 현재 디자인/톤앤매너 유지 전제에서 법률 문구 번역 품질 고도화

## Summary

| Locale | Terms Ratio | Privacy Ratio | Fees Ratio | Risk Ratio | P0 | P1 | P2 | Total | Priority |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| fr | 0.86 | 0.79 | 0.71 | 0.89 | 0 | 0 | 0 | 0 | Low |
| es | 0.74 | 0.68 | 0.91 | 0.74 | 0 | 0 | 6 | 6 | Low |
| it | 0.73 | 0.65 | 0.67 | 0.67 | 0 | 0 | 17 | 17 | Low |
| de | 0.85 | 0.65 | 0.62 | 0.51 | 0 | 0 | 17 | 17 | Low |
| zh | 0.39 | 0.38 | 0.46 | 0.39 | 0 | 0 | 26 | 26 | Medium |
| ja | 0.47 | 0.43 | 0.54 | 0.44 | 0 | 0 | 21 | 21 | Medium |
| ko | 0.52 | 0.48 | 0.63 | 0.49 | 0 | 0 | 22 | 22 | Low |
| th | 0.88 | 0.87 | 0.91 | 0.90 | 0 | 0 | 2 | 2 | Low |
| vi | 1.07 | 1.03 | 0.98 | 1.01 | 0 | 0 | 2 | 2 | Low |
| id | 1.13 | 1.07 | 1.01 | 1.08 | 0 | 0 | 2 | 2 | Low |
| ru | 1.18 | 1.07 | 1.09 | 1.10 | 0 | 0 | 1 | 1 | Low |

## Actionable Backlog (Top Issues Per Locale)

### es

- [P2] `legal.risk.s4.content` - semantic_compression_medium: Length ratio 0.49 (< 0.55)
- [P2] `legal.terms.s3.content` - semantic_compression_medium: Length ratio 0.49 (< 0.55)
- [P2] `legal.risk.s3.content` - semantic_compression_medium: Length ratio 0.51 (< 0.55)
- [P2] `legal.terms.s5.content` - semantic_compression_medium: Length ratio 0.54 (< 0.55)
- [P2] `legal.privacy.s6.content` - semantic_compression_medium: Length ratio 0.54 (< 0.55)
- [P2] `legal.fees.s3.content` - semantic_compression_medium: Length ratio 0.55 (< 0.55)

### it

- [P2] `legal.privacy.s7.content` - semantic_compression_medium: Length ratio 0.38 (< 0.55)
- [P2] `legal.terms.s1.content` - semantic_compression_medium: Length ratio 0.40 (< 0.55)
- [P2] `legal.terms.s2.content` - semantic_compression_medium: Length ratio 0.40 (< 0.55)
- [P2] `legal.risk.s4.content` - semantic_compression_medium: Length ratio 0.40 (< 0.55)
- [P2] `legal.terms.s5.content` - semantic_compression_medium: Length ratio 0.40 (< 0.55)
- [P2] `legal.fees.s1.content` - semantic_compression_medium: Length ratio 0.41 (< 0.55)
- [P2] `legal.privacy.s1.content` - semantic_compression_medium: Length ratio 0.43 (< 0.55)
- [P2] `legal.privacy.s5.content` - semantic_compression_medium: Length ratio 0.43 (< 0.55)

### de

- [P2] `legal.risk.s3.content` - semantic_compression_medium: Length ratio 0.36 (< 0.55)
- [P2] `legal.terms.s7.content` - semantic_compression_medium: Length ratio 0.38 (< 0.55)
- [P2] `legal.terms.s5.content` - semantic_compression_medium: Length ratio 0.39 (< 0.55)
- [P2] `legal.risk.s5.content` - semantic_compression_medium: Length ratio 0.39 (< 0.55)
- [P2] `legal.privacy.s3.content` - semantic_compression_medium: Length ratio 0.39 (< 0.55)
- [P2] `legal.privacy.s1.content` - semantic_compression_medium: Length ratio 0.40 (< 0.55)
- [P2] `legal.risk.s2.content` - semantic_compression_medium: Length ratio 0.40 (< 0.55)
- [P2] `legal.risk.s4.content` - semantic_compression_medium: Length ratio 0.41 (< 0.55)

### zh

- [P2] `legal.terms.s5.content` - semantic_compression_medium: Length ratio 0.35 (< 0.55)
- [P2] `legal.terms.s3.content` - semantic_compression_medium: Length ratio 0.36 (< 0.55)
- [P2] `legal.risk.s2.content` - semantic_compression_medium: Length ratio 0.36 (< 0.55)
- [P2] `legal.privacy.s4.content` - semantic_compression_medium: Length ratio 0.36 (< 0.55)
- [P2] `legal.fees.s3.content` - semantic_compression_medium: Length ratio 0.36 (< 0.55)
- [P2] `legal.privacy.s3.content` - semantic_compression_medium: Length ratio 0.36 (< 0.55)
- [P2] `legal.terms.s1.content` - semantic_compression_medium: Length ratio 0.36 (< 0.55)
- [P2] `legal.terms.s6.content` - semantic_compression_medium: Length ratio 0.36 (< 0.55)

### ja

- [P2] `legal.privacy.s3.content` - semantic_compression_medium: Length ratio 0.35 (< 0.55)
- [P2] `legal.risk.s4.content` - semantic_compression_medium: Length ratio 0.37 (< 0.55)
- [P2] `legal.privacy.s2.content` - semantic_compression_medium: Length ratio 0.39 (< 0.55)
- [P2] `legal.privacy.s1.content` - semantic_compression_medium: Length ratio 0.40 (< 0.55)
- [P2] `legal.risk.s6.content` - semantic_compression_medium: Length ratio 0.40 (< 0.55)
- [P2] `legal.privacy.s7.content` - semantic_compression_medium: Length ratio 0.40 (< 0.55)
- [P2] `legal.risk.s1.content` - semantic_compression_medium: Length ratio 0.40 (< 0.55)
- [P2] `legal.risk.s2.content` - semantic_compression_medium: Length ratio 0.41 (< 0.55)

### ko

- [P2] `legal.privacy.intro` - semantic_compression_medium: Length ratio 0.36 (< 0.55)
- [P2] `legal.risk.intro` - semantic_compression_medium: Length ratio 0.38 (< 0.55)
- [P2] `legal.privacy.s2.content` - semantic_compression_medium: Length ratio 0.41 (< 0.55)
- [P2] `legal.privacy.s3.content` - semantic_compression_medium: Length ratio 0.42 (< 0.55)
- [P2] `legal.privacy.s1.content` - semantic_compression_medium: Length ratio 0.44 (< 0.55)
- [P2] `legal.terms.s1.content` - semantic_compression_medium: Length ratio 0.45 (< 0.55)
- [P2] `legal.risk.s4.content` - semantic_compression_medium: Length ratio 0.47 (< 0.55)
- [P2] `legal.terms.s3.content` - semantic_compression_medium: Length ratio 0.48 (< 0.55)

### th

- [P2] `legal.risk.intro` - semantic_compression_medium: Length ratio 0.42 (< 0.55)
- [P2] `legal.terms.intro` - semantic_compression_medium: Length ratio 0.43 (< 0.55)

### vi

- [P2] `legal.risk.intro` - semantic_compression_medium: Length ratio 0.39 (< 0.55)
- [P2] `legal.terms.intro` - semantic_compression_medium: Length ratio 0.49 (< 0.55)

### id

- [P2] `legal.fees.intro` - semantic_compression_medium: Length ratio 0.48 (< 0.55)
- [P2] `legal.terms.intro` - semantic_compression_medium: Length ratio 0.54 (< 0.55)

### ru

- [P2] `legal.risk.intro` - semantic_compression_medium: Length ratio 0.44 (< 0.55)

## Review Order

1. Wave 1: zh, ja, ko, th, vi, id, ru (High)
2. Wave 2: it, de (Medium)
3. Wave 3: es, fr (Low/Medium polish)
4. 각 Wave 완료 후 `npm run check:i18n` + 전체 빌드 재검증
