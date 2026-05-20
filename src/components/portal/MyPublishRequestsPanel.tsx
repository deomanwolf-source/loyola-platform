import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  listMyPublishRequests,
  type PublishRequest,
  type PublishRequestStatus,
} from "@/lib/publish-requests";
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

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function MyPublishRequestsPanel() {
  const [requests, setRequests] = useState<PublishRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Ready");

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
      const next = await listMyPublishRequests();
      setRequests(next);
      setMessage("Approval status refreshed.");
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Could not load your approval requests.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <>
      <PageTitle kicker="Website publishing" title="Approval Status">
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

      <div className="mt-5 rounded-lg border border-[#d6e0f8] bg-white px-4 py-3 text-sm font-semibold text-[#536690]">
        {message}
      </div>

      <div className="mt-6">
        <Panel title="Submitted requests">
          <DataTable
            rows={requests}
            empty={loading ? "Loading approval requests..." : "No approval requests submitted yet."}
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
                key: "createdAt",
                label: "Submitted",
                render: (request) => formatDate(request.createdAt),
              },
              {
                key: "reviewedAt",
                label: "Reviewed",
                render: (request) => formatDate(request.reviewedAt),
              },
              {
                key: "publishedAt",
                label: "Published",
                render: (request) => formatDate(request.publishedAt),
              },
              {
                key: "reviewNote",
                label: "Review note",
                render: (request) => request.reviewNote || "-",
              },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
