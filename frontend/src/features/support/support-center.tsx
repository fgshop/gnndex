"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { useTranslation } from "@/i18n/locale-context";
import { getStoredAccessToken } from "@/features/auth/auth-storage";
import { SUPPORT_NOTICE_ROWS } from "@/features/support/support-notices";
import { apiBaseUrl } from "@/lib/api";
import { getSiteUrl } from "@/lib/site-url";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

type SupportTicket = {
  ticketId: string;
  category: string;
  subject: string;
  content: string;
  contactEmail: string;
  status: "RECEIVED" | "IN_REVIEW" | "ANSWERED" | "CLOSED";
  adminReply?: string | null;
  createdAt: string;
  updatedAt?: string;
  repliedAt?: string | null;
};

type SupportTab = "NOTICE" | "FAQ" | "INQUIRY" | "MY_TICKETS";

/* ═══════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════ */

const TAB_QUERY_MAP: Record<SupportTab, string> = {
  NOTICE: "notice",
  FAQ: "faq",
  INQUIRY: "inquiry",
  MY_TICKETS: "tickets",
};

const STATUS_BADGE_MAP: Record<string, string> = {
  RECEIVED: "badge-info",
  IN_REVIEW: "badge-warning",
  ANSWERED: "badge-success",
  CLOSED: "badge-muted",
};

/* ═══════════════════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════════════════ */

function resolveTab(raw: string | null): SupportTab {
  if (!raw) return "NOTICE";
  const n = raw.trim().toLowerCase();
  if (n === "faq") return "FAQ";
  if (n === "inquiry") return "INQUIRY";
  if (n === "tickets" || n === "my-tickets") return "MY_TICKETS";
  return "NOTICE";
}

function extractErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const candidate = (payload as { message?: unknown }).message;
  return typeof candidate === "string" ? candidate : undefined;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ═══════════════════════════════════════════════════════
   Icons
   ═══════════════════════════════════════════════════════ */

function SupportTabIcon({ name }: { name: string }) {
  switch (name) {
    case "bell":
      return (
        <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "help":
      return (
        <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
          <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
      );
    case "send":
      return (
        <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
          <line x1="22" x2="11" y1="2" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      );
    case "inbox":
      return (
        <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    default:
      return null;
  }
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   FAQ Accordion Item
   ═══════════════════════════════════════════════════════ */

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        className="flex w-full items-center justify-between gap-3 py-4 text-left transition-colors hover:text-primary"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className="text-sm font-medium text-foreground">{question}</span>
        <ChevronDownIcon
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "max-h-48 pb-4" : "max-h-0"
        }`}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">{answer}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Ticket Detail Modal
   ═══════════════════════════════════════════════════════ */

function TicketDetail({ ticket, onClose, statusLabelMap, labels }: {
  ticket: SupportTicket;
  onClose: () => void;
  statusLabelMap: Record<string, string>;
  labels: {
    backToTickets: string;
    ticketNumber: string;
    yourMessage: string;
    supportReply: string;
    awaitingReply: string;
  };
}) {
  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
          onClick={onClose}
          type="button"
        >
          <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {labels.backToTickets}
        </button>
        <span className={STATUS_BADGE_MAP[ticket.status] ?? "badge-muted"}>
          {statusLabelMap[ticket.status] ?? ticket.status}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="badge-muted">{ticket.category}</span>
          <span>{labels.ticketNumber}</span>
          <span>{formatDateTime(ticket.createdAt)}</span>
        </div>
        <h3 className="mt-3 text-base font-semibold text-foreground">{ticket.subject}</h3>

        {/* User message */}
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{labels.yourMessage}</p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.content}</p>
        </div>

        {/* Admin reply */}
        {ticket.adminReply ? (
          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="mb-1.5 text-xs font-medium text-primary">{labels.supportReply}</p>
            <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.adminReply}</p>
            {ticket.repliedAt ? (
              <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(ticket.repliedAt)}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {labels.awaitingReply}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════ */

const siteUrl = getSiteUrl();

export function SupportCenter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, session } = useAuth();
  const { t } = useTranslation();

  const SUPPORT_TABS: Array<{ key: SupportTab; labelKey: string; icon: string }> = [
    { key: "NOTICE", labelKey: "support.tab.announcements", icon: "bell" },
    { key: "FAQ", labelKey: "support.tab.faq", icon: "help" },
    { key: "INQUIRY", labelKey: "support.tab.submitTicket", icon: "send" },
    { key: "MY_TICKETS", labelKey: "support.tab.myTickets", icon: "inbox" },
  ];

  const TICKET_CATEGORIES = [
    { value: "ACCOUNT", label: t("support.ticket.category.account") },
    { value: "TRADING", label: t("support.ticket.category.trading") },
    { value: "DEPOSIT_WITHDRAWAL", label: t("support.ticket.category.depositWithdrawal") },
    { value: "SECURITY", label: t("support.ticket.category.security") },
    { value: "ETC", label: t("support.ticket.category.other") },
  ];

  const FAQ_SECTIONS = [
    {
      category: t("support.faq.category.account"),
      items: [
        { question: t("support.faq.q.createAccount"), answer: t("support.faq.a.createAccount") },
        { question: t("support.faq.q.resetPassword"), answer: t("support.faq.a.resetPassword") },
        { question: t("support.faq.q.accountLocked"), answer: t("support.faq.a.accountLocked") },
      ],
    },
    {
      category: t("support.faq.category.trading"),
      items: [
        { question: t("support.faq.q.orderTypes"), answer: t("support.faq.a.orderTypes") },
        { question: t("support.faq.q.orderNotFilled"), answer: t("support.faq.a.orderNotFilled") },
        { question: t("support.faq.q.tradingFees"), answer: t("support.faq.a.tradingFees") },
      ],
    },
    {
      category: t("support.faq.category.security"),
      items: [
        { question: t("support.faq.q.what2fa"), answer: t("support.faq.a.what2fa") },
        { question: t("support.faq.q.lost2fa"), answer: t("support.faq.a.lost2fa") },
        { question: t("support.faq.q.fundsProtection"), answer: t("support.faq.a.fundsProtection") },
      ],
    },
    {
      category: t("support.faq.category.feesLimits"),
      items: [
        { question: t("support.faq.q.depositFees"), answer: t("support.faq.a.depositFees") },
        { question: t("support.faq.q.withdrawalLimits"), answer: t("support.faq.a.withdrawalLimits") },
        { question: t("support.faq.q.withdrawalTime"), answer: t("support.faq.a.withdrawalTime") },
      ],
    },
  ];

  const STATUS_LABEL_MAP: Record<string, string> = {
    RECEIVED: t("support.status.open"),
    IN_REVIEW: t("support.status.inProgress"),
    ANSWERED: t("support.status.resolved"),
    CLOSED: t("support.status.closed"),
  };

  const activeTab = useMemo(() => resolveTab(searchParams.get("tab")), [searchParams]);

  /* ── Ticket state ── */
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  /* ── Form state ── */
  const [category, setCategory] = useState("ACCOUNT");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  /* ── Notice expansion ── */
  const [expandedNotice, setExpandedNotice] = useState<string | null>(null);

  /* ── Load tickets ── */
  useEffect(() => {
    if (!isAuthenticated) {
      setTickets([]);
      setErrorMsg("");
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) return;

    let mounted = true;

    async function loadTickets() {
      setLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/support/tickets/mine?limit=30`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = (await res.json().catch(() => null)) as SupportTicket[] | { message?: string } | null;

        if (!res.ok) {
          if (mounted) setErrorMsg(extractErrorMessage(data) ?? t("support.tickets.loadFailed", { status: String(res.status) }));
          return;
        }

        if (mounted) setTickets(Array.isArray(data) ? data : []);
      } catch {
        if (mounted) setErrorMsg(t("support.tickets.loadNetworkError"));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadTickets();
    return () => { mounted = false; };
  }, [isAuthenticated]);

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tickets]
  );

  /* ── Structured data ── */
  const jsonLd = useMemo(() => ({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/support#webpage`,
        url: `${siteUrl}/support`,
        name: "Help Center | GnnDEX",
        description: "Get help with your GnnDEX account, trading, deposits, withdrawals, and security.",
        inLanguage: "en",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_SECTIONS.flatMap((s) =>
          s.items.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          }))
        ),
      },
    ],
  }), [FAQ_SECTIONS]);

  /* ── Submit ticket ── */
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMsg("");

    if (!isAuthenticated) {
      setErrorMsg(t("support.ticket.signInRequired"));
      return;
    }

    const trimSubject = subject.trim();
    const trimContent = content.trim();
    if (!trimSubject || !trimContent) {
      setErrorMsg(t("support.ticket.subjectRequired"));
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      setErrorMsg(t("support.ticket.sessionExpired"));
      return;
    }

    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/support/tickets`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            category,
            subject: trimSubject,
            content: trimContent,
            contactEmail: session?.user?.email ?? "",
          }),
        });

        const data = (await res.json().catch(() => null)) as SupportTicket | { message?: string } | null;

        if (!res.ok || !data || typeof data !== "object" || Array.isArray(data)) {
          setErrorMsg(extractErrorMessage(data) ?? t("support.ticket.submitFailed", { status: String(res.status) }));
          return;
        }

        const created = data as SupportTicket;
        setTickets((prev) => [created, ...prev]);
        setSubject("");
        setContent("");
        setCategory("ACCOUNT");
        setSuccessMessage(t("support.ticket.success", { ticketId: created.ticketId }));
      } catch {
        setErrorMsg(t("support.ticket.networkError"));
      } finally {
        setLoading(false);
      }
    })();
  };

  /* ── Navigation ── */
  const navigateToTab = (tab: SupportTab) => {
    setSelectedTicket(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", TAB_QUERY_MAP[tab]);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  /* ═══════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6 animate-fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Header ── */}
      <section className="panel p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-[var(--font-display)] text-2xl font-bold text-foreground">
              {t("support.title")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("support.description")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <div className={`h-2 w-2 rounded-full ${isAuthenticated ? "bg-emerald-500" : "bg-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground">
                {isAuthenticated ? session?.user?.email : t("support.notSignedIn")}
              </span>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("support.card.supportHours")}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{t("support.card.available247")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("support.card.priorityOrder")}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("support.card.responseTime")}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{t("support.card.responseTimeValue")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("support.card.avgResponseTime")}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("support.card.activeTickets")}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {isAuthenticated ? tickets.filter((tk) => tk.status !== "CLOSED").length : "--"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isAuthenticated ? t("support.card.yourOpenInquiries") : t("support.card.signInToView")}
            </p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="mt-5 flex gap-1 overflow-x-auto border-b border-border pb-px">
          {SUPPORT_TABS.map((tab) => (
            <button
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
              key={tab.key}
              onClick={() => navigateToTab(tab.key)}
              type="button"
            >
              <SupportTabIcon name={tab.icon} />
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════
         Announcements Tab
         ══════════════════════════════════ */}
      {activeTab === "NOTICE" ? (
        <section className="space-y-3 animate-fade-up">
          {SUPPORT_NOTICE_ROWS.map((notice) => {
            const isExpanded = expandedNotice === notice.id;
            return (
              <article className="panel overflow-hidden p-0" key={notice.id}>
                <button
                  className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-muted/30"
                  onClick={() => setExpandedNotice(isExpanded ? null : notice.id)}
                  type="button"
                >
                  <div className="shrink-0 pt-0.5">
                    <span className="badge-muted text-[10px]">{formatDate(notice.date)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground">{notice.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{notice.summary}</p>
                  </div>
                  <ChevronDownIcon
                    className={`mt-1 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>
                {isExpanded ? (
                  <div className="animate-fade-in border-t border-border bg-muted/20 px-5 py-4">
                    <ul className="space-y-1.5">
                      {notice.details.map((detail, i) => (
                        <li className="flex items-start gap-2 text-sm text-muted-foreground" key={i}>
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      <Link
                        className="text-xs font-medium text-primary hover:text-primary/80"
                        href={`/notice/${encodeURIComponent(notice.id)}`}
                      >
                        {t("support.viewFullAnnouncement")}
                      </Link>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      {/* ══════════════════════════════════
         FAQ Tab
         ══════════════════════════════════ */}
      {activeTab === "FAQ" ? (
        <div className="space-y-4 animate-fade-up">
          {FAQ_SECTIONS.map((section) => (
            <section className="panel p-5" key={section.category}>
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {section.category}
              </h2>
              <div className="divide-y-0">
                {section.items.map((item) => (
                  <FaqItem answer={item.answer} key={item.question} question={item.question} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {/* ══════════════════════════════════
         Submit Ticket Tab
         ══════════════════════════════════ */}
      {activeTab === "INQUIRY" ? (
        <section className="panel animate-fade-up p-6">
          <h2 className="font-[var(--font-display)] text-lg font-semibold text-foreground">
            {t("support.ticket.submitTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("support.ticket.submitDesc")}
          </p>

          {!isAuthenticated ? (
            <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="text-sm text-foreground">
                {(() => {
                  const raw = t("support.ticket.signInPrompt", { linkOpen: "\x00", linkClose: "\x01" });
                  const parts = raw.split(/\x00|\x01/);
                  return <>{parts[0]}<Link className="font-semibold text-primary hover:text-primary/80" href="/auth/login">{parts[1]}</Link>{parts[2]}</>;
                })()}
              </p>
            </div>
          ) : null}

          {/* Success */}
          {successMessage ? (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <CheckCircleIcon />
              <div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{successMessage}</p>
                <button
                  className="mt-1 text-xs font-medium text-primary hover:text-primary/80"
                  onClick={() => navigateToTab("MY_TICKETS")}
                  type="button"
                >
                  {t("support.ticket.viewMyTickets")}
                </button>
              </div>
            </div>
          ) : null}

          {/* Error */}
          {errorMsg ? (
            <div className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
              {errorMsg}
            </div>
          ) : null}

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            {/* Category */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="ticket-category">
                {t("support.ticket.category")}
              </label>
              <select
                className="input-field"
                disabled={!isAuthenticated}
                id="ticket-category"
                onChange={(e) => setCategory(e.target.value)}
                value={category}
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="ticket-subject">
                {t("support.ticket.subject")}
              </label>
              <input
                className="input-field"
                disabled={!isAuthenticated}
                id="ticket-subject"
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("support.ticket.subjectPlaceholder")}
                required
                value={subject}
              />
            </div>

            {/* Message */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="ticket-message">
                {t("support.ticket.message")}
              </label>
              <textarea
                className="input-field min-h-[160px] resize-y"
                disabled={!isAuthenticated}
                id="ticket-message"
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("support.ticket.messagePlaceholder")}
                required
                value={content}
              />
            </div>

            <button
              className="btn-primary w-full py-3 sm:w-auto"
              disabled={loading || !isAuthenticated}
              type="submit"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <SpinnerIcon className="animate-spin" /> {t("support.ticket.submitting")}
                </span>
              ) : (
                t("support.ticket.submit")
              )}
            </button>
          </form>
        </section>
      ) : null}

      {/* ══════════════════════════════════
         My Tickets Tab
         ══════════════════════════════════ */}
      {activeTab === "MY_TICKETS" ? (
        <section className="panel animate-fade-up overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("support.tickets.title")}
            </h2>
          </div>

          {!isAuthenticated ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">{t("support.tickets.signInPrompt")}</p>
              <Link className="btn-primary mt-4 inline-block" href="/auth/login">
                {t("support.tickets.signIn")}
              </Link>
            </div>
          ) : selectedTicket ? (
            <div className="p-5">
              <TicketDetail
                onClose={() => setSelectedTicket(null)}
                ticket={selectedTicket}
                statusLabelMap={STATUS_LABEL_MAP}
                labels={{
                  backToTickets: t("support.tickets.backToTickets"),
                  ticketNumber: t("support.tickets.ticketNumber", { ticketId: selectedTicket.ticketId }),
                  yourMessage: t("support.tickets.yourMessage"),
                  supportReply: t("support.tickets.supportReply"),
                  awaitingReply: t("support.tickets.awaitingReply"),
                }}
              />
            </div>
          ) : (
            <>
              {sortedTickets.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm text-muted-foreground">{t("support.tickets.empty")}</p>
                  <button
                    className="mt-3 text-xs font-medium text-primary hover:text-primary/80"
                    onClick={() => navigateToTab("INQUIRY")}
                    type="button"
                  >
                    {t("support.tickets.submitFirst")}
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <th className="px-5 py-3">{t("support.tickets.colTicketId")}</th>
                        <th className="px-5 py-3">{t("support.tickets.colSubject")}</th>
                        <th className="px-5 py-3">{t("support.tickets.colCategory")}</th>
                        <th className="px-5 py-3">{t("support.tickets.colStatus")}</th>
                        <th className="px-5 py-3">{t("support.tickets.colCreated")}</th>
                        <th className="px-5 py-3 text-right">{t("support.tickets.colAction")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTickets.map((ticket) => (
                        <tr
                          className="border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors"
                          key={ticket.ticketId}
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-muted-foreground">
                            {ticket.ticketId}
                          </td>
                          <td className="max-w-[200px] truncate px-5 py-3 font-medium text-foreground">
                            {ticket.subject}
                          </td>
                          <td className="px-5 py-3">
                            <span className="badge-muted">{ticket.category}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={STATUS_BADGE_MAP[ticket.status] ?? "badge-muted"}>
                              {STATUS_LABEL_MAP[ticket.status] ?? ticket.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">
                            {formatDate(ticket.createdAt)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              className="text-xs font-medium text-primary hover:text-primary/80"
                              onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); }}
                              type="button"
                            >
                              {t("support.tickets.view")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
