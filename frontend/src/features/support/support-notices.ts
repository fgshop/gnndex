export type SupportNotice = {
  id: string;
  title: string;
  date: string;
  summary: string;
  details: string[];
};

export const SUPPORT_NOTICE_ROWS: SupportNotice[] = [
  {
    id: "N-20260212-001",
    title: "시스템 안정화 점검 일정 안내",
    date: "2026-02-12",
    summary: "거래 엔진 안정화 작업으로 일부 API 응답이 지연될 수 있습니다.",
    details: [
      "점검 시간: 2026-02-14 01:30 ~ 03:00 (KST)",
      "영향 범위: 시세 API/주문 조회 API 일시 지연 가능",
      "주문 접수 및 체결은 정상 동작하며, 지연 구간은 즉시 공지 업데이트됩니다."
    ]
  },
  {
    id: "N-20260210-002",
    title: "입출금 네트워크 점검 안내",
    date: "2026-02-10",
    summary: "일부 체인 지갑 점검으로 입출금 처리 시간이 지연될 수 있습니다.",
    details: [
      "점검 대상: ETH-ERC20, TRON-TRC20 지갑 인프라",
      "점검 시간: 2026-02-13 02:00 ~ 04:00 (KST)",
      "점검 중에는 출금 요청이 REVIEW_PENDING 상태로 유지될 수 있습니다.",
      "점검 완료 후 순차적으로 자동 재처리됩니다."
    ]
  },
  {
    id: "N-20260208-003",
    title: "신규 상장 마켓 공지",
    date: "2026-02-08",
    summary: "XRP-USDT, SBK-USDT, G99-USDT 마켓이 추가되었습니다.",
    details: [
      "신규 마켓: XRP-USDT, SBK-USDT, G99-USDT",
      "지원 기능: 지정가/시장가 주문, 실시간 티커, TradingView 차트",
      "초기에는 변동성이 높을 수 있으므로 주문 수량과 슬리피지를 주의하세요."
    ]
  },
  {
    id: "N-20260206-004",
    title: "거래 수수료 정책 업데이트",
    date: "2026-02-06",
    summary: "일부 마켓에 대해 메이커 우대 수수료 정책이 적용됩니다.",
    details: [
      "적용 일자: 2026-02-15 00:00 (KST)",
      "메이커/테이커 수수료는 등급 정책에 따라 차등 적용됩니다.",
      "상세 수수료 표는 마이페이지 > 수수료 안내에서 확인 가능합니다."
    ]
  },
  {
    id: "N-20260205-005",
    title: "보안 권고: 2FA 활성화 안내",
    date: "2026-02-05",
    summary: "계정 보안을 위해 OTP 기반 2단계 인증 활성화를 권장합니다.",
    details: [
      "마이페이지에서 2FA 시크릿 발급 후 인증 앱(Google Authenticator 등)에 등록하세요.",
      "2FA 활성화 시 로그인 및 주요 보안 동작에 추가 인증이 적용됩니다.",
      "코드 분실 시 고객센터 본인확인 절차가 필요할 수 있습니다."
    ]
  }
];

export function getSupportNoticeById(id: string): SupportNotice | null {
  return SUPPORT_NOTICE_ROWS.find((notice) => notice.id === id) ?? null;
}
