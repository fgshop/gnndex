import { FormEvent, useEffect, useState } from "react";
import { getApiErrorMessage } from "../lib/api-error";
import { api } from "../lib/api";
import { useTranslation } from "../i18n/locale-context";

type NoticeRow = {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string;
  translations: Record<string, { title: string; summary: string; content: string }> | null;
  isPinned: boolean;
  isPublished: boolean;
  displayOrder: number;
  createdByUserId: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type NoticeCategoryFilter = "" | "NOTICE" | "EVENT" | "MAINTENANCE" | "UPDATE";

const NOTICE_CATEGORIES: NoticeCategoryFilter[] = ["NOTICE", "EVENT", "MAINTENANCE", "UPDATE"];
const TRANSLATION_LOCALES = ["en", "fr", "es", "it", "de", "zh", "ja", "th", "vi", "id", "ru"];

function toUtcIso(localDateTime: string): string | undefined {
  if (!localDateTime) return undefined;
  const date = new Date(localDateTime);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function NoticesPage() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<NoticeCategoryFilter>("");
  const [publishFilter, setPublishFilter] = useState<"" | "true" | "false">("");
  const [fromCreatedAt, setFromCreatedAt] = useState("");
  const [toCreatedAt, setToCreatedAt] = useState("");
  const [limit, setLimit] = useState(30);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  // Modal state
  const [editModal, setEditModal] = useState<NoticeRow | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [deleteModal, setDeleteModal] = useState<NoticeRow | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [translationTab, setTranslationTab] = useState<string>("ko");

  // Form fields
  const [formCategory, setFormCategory] = useState<NoticeCategoryFilter>("NOTICE");
  const [formTitle, setFormTitle] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formIsPublished, setFormIsPublished] = useState(false);
  const [formDisplayOrder, setFormDisplayOrder] = useState(0);

  const loadRows = async (nextPage = page) => {
    setLoading(true);

    const { data, error } = await api.GET("/admin/notices", {
      params: {
        query: {
          page: nextPage,
          limit,
          category: category || undefined,
          isPublished: publishFilter === "" ? undefined : publishFilter === "true",
          fromCreatedAt: toUtcIso(fromCreatedAt),
          toCreatedAt: toUtcIso(toCreatedAt)
        }
      }
    });

    setLoading(false);

    if (error || !data) {
      setRows([]);
      setFeedbackTone("error");
      setFeedbackMessage(getApiErrorMessage(error, t("notices.loadFailed")));
      return;
    }

    const payload = data as {
      items?: NoticeRow[];
      pagination?: { page?: number; total?: number; totalPages?: number };
    };

    setRows(payload.items ?? []);
    setPage(payload.pagination?.page ?? nextPage);
    setTotal(payload.pagination?.total ?? 0);
    setTotalPages(payload.pagination?.totalPages ?? 1);
  };

  useEffect(() => {
    loadRows(1).catch(() => {
      setRows([]);
      setFeedbackTone("error");
      setFeedbackMessage(t("notices.loadFailed"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilter = async (event: FormEvent) => {
    event.preventDefault();
    setFeedbackMessage(null);
    await loadRows(1);
  };

  const openCreateModal = () => {
    setIsCreateMode(true);
    setEditModal(null);
    setFormCategory("NOTICE");
    setFormTitle("");
    setFormSummary("");
    setFormContent("");
    setFormIsPinned(false);
    setFormIsPublished(false);
    setFormDisplayOrder(0);
    setTranslationTab("ko");
    setModalError(null);
  };

  const openEditModal = (notice: NoticeRow) => {
    setIsCreateMode(false);
    setEditModal(notice);
    setFormCategory(notice.category as NoticeCategoryFilter);
    setFormTitle(notice.title);
    setFormSummary(notice.summary);
    setFormContent(notice.content);
    setFormIsPinned(notice.isPinned);
    setFormIsPublished(notice.isPublished);
    setFormDisplayOrder(notice.displayOrder);
    setTranslationTab("ko");
    setModalError(null);
  };

  const closeEditModal = () => {
    if (modalLoading) return;
    setEditModal(null);
    setIsCreateMode(false);
    setModalError(null);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formSummary.trim() || !formContent.trim()) {
      setModalError("Title, summary, and content are required");
      return;
    }

    setModalLoading(true);
    setModalError(null);

    if (isCreateMode) {
      const { error } = await api.POST("/admin/notices", {
        body: {
          category: formCategory || "NOTICE",
          title: formTitle.trim(),
          summary: formSummary.trim(),
          content: formContent.trim(),
          isPinned: formIsPinned,
          isPublished: formIsPublished,
          displayOrder: formDisplayOrder
        }
      });

      setModalLoading(false);

      if (error) {
        setModalError(getApiErrorMessage(error, t("notices.createFailed")));
        return;
      }

      setFeedbackTone("success");
      setFeedbackMessage(t("notices.createSuccess"));
    } else if (editModal) {
      const { error } = await api.PATCH("/admin/notices/{noticeId}", {
        params: { path: { noticeId: editModal.id } },
        body: {
          category: formCategory || undefined,
          title: formTitle.trim(),
          summary: formSummary.trim(),
          content: formContent.trim(),
          isPinned: formIsPinned,
          isPublished: formIsPublished,
          displayOrder: formDisplayOrder
        }
      });

      setModalLoading(false);

      if (error) {
        setModalError(getApiErrorMessage(error, t("notices.updateFailed")));
        return;
      }

      setFeedbackTone("success");
      setFeedbackMessage(t("notices.updateSuccess"));
    }

    closeEditModal();
    await loadRows(page);
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setModalLoading(true);
    setModalError(null);

    const { error } = await api.DELETE("/admin/notices/{noticeId}", {
      params: { path: { noticeId: deleteModal.id } }
    });

    setModalLoading(false);

    if (error) {
      setModalError(getApiErrorMessage(error, t("notices.deleteFailed")));
      return;
    }

    setDeleteModal(null);
    setFeedbackTone("success");
    setFeedbackMessage(t("notices.deleteSuccess"));
    await loadRows(page);
  };

  const handleTranslate = async (noticeId: string) => {
    setFeedbackMessage(null);

    const { error } = await api.POST("/admin/notices/{noticeId}/translate", {
      params: { path: { noticeId } }
    });

    if (error) {
      setFeedbackTone("error");
      setFeedbackMessage(getApiErrorMessage(error, t("notices.translateFailed")));
      return;
    }

    setFeedbackTone("success");
    setFeedbackMessage(t("notices.translateSuccess"));
    await loadRows(page);
  };

  const handleTogglePublish = async (notice: NoticeRow) => {
    const { error } = await api.PATCH("/admin/notices/{noticeId}", {
      params: { path: { noticeId: notice.id } },
      body: { isPublished: !notice.isPublished }
    });

    if (error) {
      setFeedbackTone("error");
      setFeedbackMessage(getApiErrorMessage(error, t("notices.updateFailed")));
      return;
    }

    await loadRows(page);
  };

  const handleTogglePin = async (notice: NoticeRow) => {
    const { error } = await api.PATCH("/admin/notices/{noticeId}", {
      params: { path: { noticeId: notice.id } },
      body: { isPinned: !notice.isPinned }
    });

    if (error) {
      setFeedbackTone("error");
      setFeedbackMessage(getApiErrorMessage(error, t("notices.updateFailed")));
      return;
    }

    await loadRows(page);
  };

  return (
    <main>
      <h2>{t("notices.title")}</h2>
      <p className="muted">{t("notices.subtitle")}</p>

      {feedbackMessage && (
        <div className={`admin-feedback ${feedbackTone}`}>{feedbackMessage}</div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
        <button className="admin-btn" type="button" onClick={openCreateModal}>
          {t("notices.create")}
        </button>
      </div>

      <form className="table-card" style={{ marginTop: 16, padding: 14 }} onSubmit={handleFilter}>
        <h3>{t("notices.filters")}</h3>
        <div className="admin-form-grid">
          <select value={category} onChange={(e) => setCategory(e.target.value as NoticeCategoryFilter)}>
            <option value="">{t("notices.allCategories")}</option>
            {NOTICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={publishFilter} onChange={(e) => setPublishFilter(e.target.value as "" | "true" | "false")}>
            <option value="">{t("notices.allStatus")}</option>
            <option value="true">{t("notices.published")}</option>
            <option value="false">{t("notices.draft")}</option>
          </select>
          <input type="datetime-local" value={fromCreatedAt} onChange={(e) => setFromCreatedAt(e.target.value)} />
          <input type="datetime-local" value={toCreatedAt} onChange={(e) => setToCreatedAt(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <label htmlFor="notice-limit">Limit</label>
          <select id="notice-limit" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
          <button className="admin-btn" disabled={loading || modalLoading} type="submit">
            {loading ? "Loading..." : t("notices.loadNotices")}
          </button>
        </div>
      </form>

      <div className="table-card" style={{ marginTop: 16 }}>
        <div className="table-row table-head">
          <span>{t("notices.tableTitle")}</span>
          <span>{t("notices.tableCategory")}</span>
          <span>{t("notices.tableStatus")}</span>
          <span>{t("notices.tablePinned")}</span>
          <span>{t("notices.tableOrder")}</span>
          <span>{t("notices.tableCreatedAt")}</span>
          <span>{t("notices.tableActions")}</span>
        </div>
        {rows.length === 0 ? (
          <div className="table-row">
            <span>-</span><span>-</span><span>{t("notices.noData")}</span><span>-</span><span>-</span><span>-</span><span>-</span>
          </div>
        ) : (
          rows.map((row) => (
            <div className="table-row" key={row.id}>
              <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</span>
              <span>{row.category}</span>
              <span>
                <button
                  className="admin-btn secondary"
                  style={{ fontSize: 11, padding: "2px 8px" }}
                  onClick={() => void handleTogglePublish(row)}
                  type="button"
                >
                  {row.isPublished ? t("notices.published") : t("notices.draft")}
                </button>
              </span>
              <span>
                <button
                  className="admin-btn secondary"
                  style={{ fontSize: 11, padding: "2px 8px" }}
                  onClick={() => void handleTogglePin(row)}
                  type="button"
                >
                  {row.isPinned ? t("notices.pinned") : t("notices.unpinned")}
                </button>
              </span>
              <span>{row.displayOrder}</span>
              <span>{row.createdAt}</span>
              <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button className="admin-btn" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => openEditModal(row)} type="button">{t("notices.edit")}</button>
                <button className="admin-btn" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => void handleTranslate(row.id)} type="button">{t("notices.translate")}</button>
                <button className="admin-btn" style={{ fontSize: 11, padding: "2px 8px", backgroundColor: "#b91c1c" }} onClick={() => setDeleteModal(row)} type="button">{t("notices.delete")}</button>
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button className="admin-btn" disabled={loading || page <= 1} onClick={() => void loadRows(page - 1)} type="button">Prev</button>
        <button className="admin-btn" disabled={loading || page >= totalPages} onClick={() => void loadRows(page + 1)} type="button">Next</button>
        <span>Page {page} / {totalPages} (Total: {total})</span>
      </div>

      {/* Create / Edit Modal */}
      {(isCreateMode || editModal) && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-card" style={{ maxWidth: 700 }}>
            <h3>{isCreateMode ? t("notices.createTitle") : t("notices.editTitle")}</h3>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                className={`admin-btn ${translationTab === "ko" ? "" : "secondary"}`}
                style={{ fontSize: 11, padding: "2px 8px" }}
                onClick={() => setTranslationTab("ko")}
                type="button"
              >
                KO (original)
              </button>
              {!isCreateMode && editModal?.translations && TRANSLATION_LOCALES.map((loc) => (
                <button
                  key={loc}
                  className={`admin-btn ${translationTab === loc ? "" : "secondary"}`}
                  style={{ fontSize: 11, padding: "2px 8px" }}
                  onClick={() => setTranslationTab(loc)}
                  type="button"
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>

            {translationTab === "ko" ? (
              <>
                <div className="admin-modal-field">
                  <label>{t("notices.category")}</label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value as NoticeCategoryFilter)}>
                    {NOTICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="admin-modal-field">
                  <label>{t("notices.titleField")}</label>
                  <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
                </div>
                <div className="admin-modal-field">
                  <label>{t("notices.summary")}</label>
                  <input value={formSummary} onChange={(e) => setFormSummary(e.target.value)} />
                </div>
                <div className="admin-modal-field">
                  <label>{t("notices.content")}</label>
                  <textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} rows={6} style={{ width: "100%", resize: "vertical" }} />
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input type="checkbox" checked={formIsPinned} onChange={(e) => setFormIsPinned(e.target.checked)} />
                    {t("notices.isPinned")}
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input type="checkbox" checked={formIsPublished} onChange={(e) => setFormIsPublished(e.target.checked)} />
                    {t("notices.isPublished")}
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {t("notices.displayOrder")}:
                    <input type="number" value={formDisplayOrder} onChange={(e) => setFormDisplayOrder(Number(e.target.value))} style={{ width: 60 }} min={0} />
                  </label>
                </div>
              </>
            ) : (
              <div>
                <p className="muted" style={{ marginBottom: 8 }}>{t("notices.translationTab")}: {translationTab.toUpperCase()}</p>
                {editModal?.translations && (editModal.translations as Record<string, { title: string; summary: string; content: string }>)[translationTab] ? (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ marginBottom: 8 }}>
                      <strong>{t("notices.titleField")}:</strong>
                      <p>{(editModal.translations as Record<string, { title: string; summary: string; content: string }>)[translationTab].title}</p>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <strong>{t("notices.summary")}:</strong>
                      <p>{(editModal.translations as Record<string, { title: string; summary: string; content: string }>)[translationTab].summary}</p>
                    </div>
                    <div>
                      <strong>{t("notices.content")}:</strong>
                      <p style={{ whiteSpace: "pre-wrap" }}>{(editModal.translations as Record<string, { title: string; summary: string; content: string }>)[translationTab].content}</p>
                    </div>
                  </div>
                ) : (
                  <p className="muted">No translation available for {translationTab.toUpperCase()}</p>
                )}
              </div>
            )}

            {modalError && <div className="admin-feedback error">{modalError}</div>}

            <div className="admin-modal-actions">
              <button className="admin-btn secondary" disabled={modalLoading} onClick={closeEditModal} type="button">{t("notices.cancel")}</button>
              {translationTab === "ko" && (
                <button className="admin-btn" disabled={modalLoading} onClick={() => void handleSave()} type="button">
                  {modalLoading ? "Processing..." : t("notices.save")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <h3>{t("notices.deleteTitle")}</h3>
            <p className="muted">{t("notices.deleteConfirm")}</p>
            <p><strong>{deleteModal.title}</strong></p>
            {modalError && <div className="admin-feedback error">{modalError}</div>}
            <div className="admin-modal-actions">
              <button className="admin-btn secondary" disabled={modalLoading} onClick={() => { setDeleteModal(null); setModalError(null); }} type="button">{t("notices.cancel")}</button>
              <button className="admin-btn" style={{ backgroundColor: "#b91c1c" }} disabled={modalLoading} onClick={() => void handleDelete()} type="button">
                {modalLoading ? "Processing..." : t("notices.confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
