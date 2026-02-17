import type { Messages } from "../locale-context";

const en: Messages = {
  "compliance.title": "Compliance Center",
  "compliance.subtitle": "Manage sanctions screening, AML workflows, and review queues.",
  "compliance.amlQueue": "AML Queue",
  "compliance.sanctionHits": "Sanction Hits",
  "compliance.casesClosed7d": "Cases Closed (7d)",
};

const fr: Messages = {
  "compliance.title": "Centre de conformité",
  "compliance.subtitle": "Gérez le filtrage des sanctions, les workflows AML et les files de revue.",
  "compliance.amlQueue": "File AML",
  "compliance.sanctionHits": "Correspondances sanctions",
  "compliance.casesClosed7d": "Dossiers clôturés (7j)",
};

const es: Messages = {
  "compliance.title": "Centro de cumplimiento",
  "compliance.subtitle": "Gestione el control de sanciones, flujos AML y colas de revisión.",
  "compliance.amlQueue": "Cola AML",
  "compliance.sanctionHits": "Coincidencias de sanciones",
  "compliance.casesClosed7d": "Casos cerrados (7d)",
};

const it: Messages = {
  "compliance.title": "Centro compliance",
  "compliance.subtitle": "Gestisci screening sanzioni, workflow AML e code di revisione.",
  "compliance.amlQueue": "Coda AML",
  "compliance.sanctionHits": "Rilevazioni sanzioni",
  "compliance.casesClosed7d": "Casi chiusi (7g)",
};

const de: Messages = {
  "compliance.title": "Compliance-Zentrum",
  "compliance.subtitle": "Sanktionsprüfung, AML-Workflows und Prüfwarteschlangen verwalten.",
  "compliance.amlQueue": "AML-Warteschlange",
  "compliance.sanctionHits": "Sanktions-Treffer",
  "compliance.casesClosed7d": "Geschlossene Fälle (7T)",
};

const zh: Messages = {
  "compliance.title": "合规中心",
  "compliance.subtitle": "管理制裁筛查、AML 流程与审核队列。",
  "compliance.amlQueue": "AML 队列",
  "compliance.sanctionHits": "制裁命中",
  "compliance.casesClosed7d": "已结案（7天）",
};

const ja: Messages = {
  "compliance.title": "コンプライアンスセンター",
  "compliance.subtitle": "制裁スクリーニング、AMLワークフロー、レビューキューを管理します。",
  "compliance.amlQueue": "AMLキュー",
  "compliance.sanctionHits": "制裁ヒット",
  "compliance.casesClosed7d": "対応完了（7日）",
};

const ko: Messages = {
  "compliance.title": "컴플라이언스 센터",
  "compliance.subtitle": "제재 탐지, AML 워크플로우, 검토 큐를 관리합니다.",
  "compliance.amlQueue": "AML 대기열",
  "compliance.sanctionHits": "제재 탐지 건수",
  "compliance.casesClosed7d": "7일 내 처리 완료",
};

const th: Messages = {
  "compliance.title": "ศูนย์คอมพลายแอนซ์",
  "compliance.subtitle": "จัดการการคัดกรองคว่ำบาตร เวิร์กโฟลว์ AML และคิวตรวจสอบ",
  "compliance.amlQueue": "คิว AML",
  "compliance.sanctionHits": "รายการตรงกับคว่ำบาตร",
  "compliance.casesClosed7d": "เคสปิดแล้ว (7 วัน)",
};

const vi: Messages = {
  "compliance.title": "Trung tâm tuân thủ",
  "compliance.subtitle": "Quản lý sàng lọc trừng phạt, quy trình AML và hàng đợi rà soát.",
  "compliance.amlQueue": "Hàng đợi AML",
  "compliance.sanctionHits": "Lần khớp trừng phạt",
  "compliance.casesClosed7d": "Hồ sơ đã đóng (7 ngày)",
};

const id: Messages = {
  "compliance.title": "Pusat Kepatuhan",
  "compliance.subtitle": "Kelola penyaringan sanksi, alur AML, dan antrean review.",
  "compliance.amlQueue": "Antrian AML",
  "compliance.sanctionHits": "Temuan sanksi",
  "compliance.casesClosed7d": "Kasus ditutup (7h)",
};

const ru: Messages = {
  "compliance.title": "Центр комплаенса",
  "compliance.subtitle": "Управление санкционным скринингом, AML-процессами и очередями проверки.",
  "compliance.amlQueue": "Очередь AML",
  "compliance.sanctionHits": "Совпадения по санкциям",
  "compliance.casesClosed7d": "Закрыто дел (7д)",
};

const complianceMessages: Record<string, Messages> = {
  en,
  fr,
  es,
  it,
  de,
  zh,
  ja,
  ko,
  th,
  vi,
  id,
  ru,
};

export default complianceMessages;
