"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { getStoredAccessToken } from "@/features/auth/auth-storage";
import { apiBaseUrl } from "@/lib/api";

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

function extractErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const candidate = (payload as { message?: unknown }).message;
  return typeof candidate === "string" ? candidate : undefined;
}

export default function SupportTicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const decodedTicketId = useMemo(() => decodeURIComponent(ticketId ?? ""), [ticketId]);
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState<SupportTicket | null>(null);

  useEffect(() => {
    if (!decodedTicketId) {
      setError("유효하지 않은 문의 번호입니다.");
      return;
    }

    if (!isAuthenticated) {
      setTicket(null);
      setError("로그인 후 문의 상세를 확인할 수 있습니다.");
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      setTicket(null);
      setError("세션 토큰이 없습니다. 다시 로그인하세요.");
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError("");

    void (async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/support/tickets/mine/${encodeURIComponent(decodedTicketId)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
        const payload = (await response
          .json()
          .catch(() => null)) as SupportTicket | { message?: string } | null;

        if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) {
          if (isMounted) {
            setTicket(null);
            setError(extractErrorMessage(payload) || `문의 상세 조회 실패 (HTTP ${response.status})`);
          }
          return;
        }

        if (isMounted) {
          setTicket(payload as SupportTicket);
        }
      } catch {
        if (isMounted) {
          setTicket(null);
          setError("문의 상세 조회 중 네트워크 오류가 발생했습니다.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [decodedTicketId, isAuthenticated]);

  return (
    <main className="mx-auto w-full max-w-[1360px] px-6 py-10">
      <section className="rounded-3xl border border-border bg-card shadow-lg shadow-black/8">
        <header className="border-b border-border bg-muted px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Support Ticket</p>
          <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold text-foreground">
            1:1 문의 상세
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">접수번호: {decodedTicketId || "-"}</p>
        </header>

        {loading ? (
          <div className="px-6 py-6 text-sm text-muted-foreground">문의 상세를 불러오는 중입니다...</div>
        ) : null}

        {!loading && error ? (
          <div className="px-6 py-6">
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            {!isAuthenticated ? (
              <Link className="btn-primary mt-4" href="/auth/login">
                로그인
              </Link>
            ) : null}
          </div>
        ) : null}

        {!loading && ticket ? (
          <div className="space-y-4 px-6 py-6">
            <div className="grid gap-2 md:grid-cols-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">제목</span>: {ticket.subject}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">상태</span>: {ticket.status}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">카테고리</span>: {ticket.category}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">접수일시</span>: {new Date(ticket.createdAt).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground md:col-span-2">
                <span className="font-semibold text-foreground">회신 이메일</span>: {ticket.contactEmail}
              </p>
            </div>

            <section className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground">문의 내용</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{ticket.content}</p>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground">관리자 답변</p>
              {ticket.adminReply ? (
                <>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{ticket.adminReply}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    답변일시: {ticket.repliedAt ? new Date(ticket.repliedAt).toLocaleString() : "-"}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">아직 등록된 답변이 없습니다.</p>
              )}
            </section>
          </div>
        ) : null}

        <footer className="border-t border-border bg-muted px-6 py-4">
          <Link className="btn-muted !px-3 !py-2 text-sm" href="/support?tab=tickets">
            내 문의 내역으로
          </Link>
        </footer>
      </section>
    </main>
  );
}
