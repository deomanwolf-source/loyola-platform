import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, RefreshCw, Send, XCircle } from "lucide-react";
import {
  approvePublishRequest,
  getPublishRequest,
  listPublishRequests,
  publishApprovedRequest,
  rejectPublishRequest,
  type PublishRequest,
  type PublishRequestStatus,
} from "@/lib/publish-requests";
import type { DB } from "@/lib/store";
import { Badge, DataTable, PageTitle, Panel, StatCard } from "./PortalShell";

function statusTone(
  status: PublishRequestStatus,
): "neutral" | "success" | "warning" | "danger" | "gold" {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "published") return "gold";
  return "warning";
}

function statusLabel(status: PublishRequestStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function requesterName(request: PublishRequest) {
  return request.requestedByName || request.requestedByEmail || request.requestedBy || "Unknown";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function siteSummary(data?: DB) {
  return {
    pages: data?.pages ? Object.keys(data.pages).length : 0,
    navigation: Array.isArray(data?.navigation) ? data.navigation.length : 0,
    news: Array.isArray(data?.news) ? data.news.length : 0,
    notices: Array.isArray(data?.notices) ? data.notices.length : 0,
    events: Array.isArray(data?.events) ? data.events.length : 0,
    teachers: Array.isArray(data?.teachers) ? data.teachers.length : 0,
    students: Array.isArray(data?.students) ? data.students.length : 0,
    parents: Array.isArray(data?.parents) ? data.parents.length : 0,
    media: Array.isArray(data?.media) ? data.media.length : 0,
  };
}

export function PublishApprovalsPanel() {
  const [requests, setRequests] = useState<PublishRequest[]>([]);
  const [selected, setSelected] = useState<PublishRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState({ tone: "info" as "info" | "error", text: "Ready" });

  const counts = useMemo(
    () => ({
      pending: requests.filter((request) => request.status === "pending").length,
      approved: requests.filter((request) => request.status === "approved").length,
      rejected: requests.filter((request) => request.status === "rejected").length,
      published: requests.filter((request) => request.status === "published").length,
    }),
    [requests],
  );

  const refresh = async () => {
    setLoading(true);
    try {
      const next = await listPublishRequests();
      setRequests(next);
      setSelected((current) => {
        if (!current) return null;
        return next.find((request) => request.id === current.id) || current;
      });
      setNotice({ tone: "info", text: "Publish approvals refreshed." });
    } catch (caught) {
      setNotice({
        tone: "error",
        text: caught instanceof Error ? caught.message : "Could not load publish approvals.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const replaceRequest = (request: PublishRequest) => {
    setRequests((current) => current.map((item) => (item.id === request.id ? request : item)));
    setSelected(request);
    setReviewNote(request.reviewNote || "");
  };

  const loadDetail = async (request: PublishRequest) => {
    setBusyId(request.id);
    try {
      const detail = request.data ? request : await getPublishRequest(request.id);
      replaceRequest(detail);
      setNotice({ tone: "info", text: `Preview loaded for request #${detail.id}.` });
    } catch (caught) {
      setNotice({
        tone: "error",
        text: caught instanceof Error ? caught.message : "Could not load request preview.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const openPreviewWindow = async (request: PublishRequest) => {
    const detail = request.data ? request : await getPublishRequest(request.id);
    replaceRequest(detail);
    const preview = window.open("/", "_blank");
    if (!preview || !detail.data) {
      setNotice({ tone: "error", text: "Preview window could not be opened." });
      return;
    }

    const message = { type: "loyola.website-preview.db", db: detail.data };
    const sendPreview = () => preview.postMessage(message, window.location.origin);
    window.setTimeout(sendPreview, 600);
    window.setTimeout(sendPreview, 1300);
    window.setTimeout(sendPreview, 2200);
    setNotice({ tone: "info", text: `Opened preview for request #${detail.id}.` });
  };

  const runAction = async (request: PublishRequest, action: "approve" | "reject" | "publish") => {
    if (action === "reject" && !reviewNote.trim()) {
      setNotice({ tone: "error", text: "Add a review note before rejecting." });
      return;
    }

    setBusyId(request.id);
    try {
      const updated =
        action === "approve"
          ? await approvePublishRequest(request.id, reviewNote)
          : action === "reject"
            ? await rejectPublishRequest(request.id, reviewNote)
            : await publishApprovedRequest(request.id);
      replaceRequest(updated);

      const verb =
        action === "approve" ? "approved" : action === "reject" ? "rejected" : "published";
      setNotice({ tone: "info", text: `Request #${updated.id} ${verb}.` });
    } catch (caught) {
      setNotice({
        tone: "error",
        text: caught instanceof Error ? caught.message : `Could not ${action} request.`,
      });
    } finally {
      setBusyId(null);
    }
  };

  const summary = siteSummary(selected?.data);

  return (
    <>
      <PageTitle kicker="Website governance" title="Publish Approvals">
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#c8d5f4] bg-white px-4 py-2 text-sm font-bold text-navy"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </PageTitle>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Pending" value={counts.pending} accent />
        <StatCard label="Approved" value={counts.approved} />
        <StatCard label="Rejected" value={counts.rejected} />
        <StatCard label="Published" value={counts.published} />
      </div>

      <div
        className={`mt-5 rounded-lg border px-4 py-3 text-sm font-semibold ${
          notice.tone === "error"
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}
      >
        {notice.text}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
        <Panel title="Requests">
          <DataTable
            rows={requests}
            empty={loading ? "Loading publish requests..." : "No publish requests yet."}
            columns={[
              {
                key: "id",
                label: "Request",
                render: (request) => <span className="font-bold text-navy">#{request.id}</span>,
              },
              {
                key: "status",
                label: "Status",
                render: (request) => (
                  <Badge tone={statusTone(request.status)}>{statusLabel(request.status)}</Badge>
                ),
              },
              {
                key: "requestedBy",
                label: "Submitted by",
                render: (request) => (
                  <div>
                    <p className="font-semibold text-navy">{requesterName(request)}</p>
                    <p className="text-xs text-muted-foreground">{request.requestedByEmail}</p>
                  </div>
                ),
              },
              {
                key: "createdAt",
                label: "Created",
                render: (request) => formatDate(request.createdAt),
              },
              {
                key: "actions",
                label: "Actions",
                render: (request) => (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void loadDetail(request)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#c8d5f4] px-3 py-1.5 text-xs font-bold text-navy"
                    >
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAction(request, "approve")}
                      disabled={request.status !== "pending" || busyId === request.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-45"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAction(request, "reject")}
                      disabled={request.status === "published" || busyId === request.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-45"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAction(request, "publish")}
                      disabled={request.status !== "approved" || busyId === request.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-navy disabled:opacity-45"
                    >
                      <Send className="h-3.5 w-3.5" /> Publish
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </Panel>

        <Panel
          title={selected ? `Request #${selected.id}` : "Preview"}
          action={
            selected ? (
              <Badge tone={statusTone(selected.status)}>{statusLabel(selected.status)}</Badge>
            ) : null
          }
        >
          {selected ? (
            <div className="space-y-5">
              <div className="space-y-1 text-sm">
                <p className="font-bold text-navy">{requesterName(selected)}</p>
                <p className="text-muted-foreground">Submitted {formatDate(selected.createdAt)}</p>
                {selected.reviewNote && (
                  <p className="rounded-lg bg-[#f3f7ff] p-3 text-slate-700">
                    {selected.reviewNote}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(summary).map(([label, value]) => (
                  <div key={label} className="border border-[#e1e9fb] px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1 text-lg font-bold text-navy">{value}</p>
                  </div>
                ))}
              </div>

              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Review note for approval or rejection"
                className="min-h-24 w-full rounded-lg border border-[#c8d5f4] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-gold"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void openPreviewWindow(selected)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#c8d5f4] bg-white px-4 py-2 text-sm font-bold text-navy"
                >
                  <Eye className="h-4 w-4" /> Open Preview
                </button>
                <button
                  type="button"
                  onClick={() => void runAction(selected, "approve")}
                  disabled={selected.status !== "pending" || busyId === selected.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-45"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => void runAction(selected, "reject")}
                  disabled={selected.status === "published" || busyId === selected.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-45"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => void runAction(selected, "publish")}
                  disabled={selected.status !== "approved" || busyId === selected.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy disabled:opacity-45"
                >
                  <Send className="h-4 w-4" /> Publish
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a publish request to inspect the site snapshot before approval.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
