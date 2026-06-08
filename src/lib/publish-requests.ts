import { API_URL, authHeaders } from "@/lib/api";
import type { DB } from "@/lib/store";

export type PublishRequestStatus = "pending" | "approved" | "rejected" | "published";

export type PublishRequest = {
  id: string;
  requestedBy: string;
  requestedByEmail: string;
  requestedByName: string;
  status: PublishRequestStatus;
  reviewNote: string;
  reviewedBy: string;
  reviewedByEmail: string;
  reviewedByName: string;
  reviewedAt: string | null;
  publishedBy: string;
  publishedByEmail: string;
  publishedByName: string;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  data?: DB;
};

type ApiPublishRequest = {
  id: number | string;
  requested_by?: string | null;
  requested_by_email?: string | null;
  requested_by_name?: string | null;
  status?: string | null;
  review_note?: string | null;
  reviewed_by?: string | null;
  reviewed_by_email?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  published_by?: string | null;
  published_by_email?: string | null;
  published_by_name?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  data?: DB;
};

function normalizeStatus(value: unknown): PublishRequestStatus {
  if (value === "approved" || value === "rejected" || value === "published") return value;
  return "pending";
}

function mapPublishRequest(request: ApiPublishRequest): PublishRequest {
  return {
    id: String(request.id),
    requestedBy: request.requested_by || "",
    requestedByEmail: request.requested_by_email || "",
    requestedByName: request.requested_by_name || "",
    status: normalizeStatus(request.status),
    reviewNote: request.review_note || "",
    reviewedBy: request.reviewed_by || "",
    reviewedByEmail: request.reviewed_by_email || "",
    reviewedByName: request.reviewed_by_name || "",
    reviewedAt: request.reviewed_at || null,
    publishedBy: request.published_by || "",
    publishedByEmail: request.published_by_email || "",
    publishedByName: request.published_by_name || "",
    publishedAt: request.published_at || null,
    createdAt: request.created_at || null,
    updatedAt: request.updated_at || null,
    data: request.data,
  };
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: authHeaders({
      "Content-Type": "application/json",
      ...(init.headers || {}),
    }),
    cache: "no-store",
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}.`);
  }
  return payload as T;
}

export async function createPublishRequest(db: DB) {
  const payload = await requestJson<{ request: ApiPublishRequest }>("/api/publish-requests", {
    method: "POST",
    body: JSON.stringify({ db }),
  });
  return mapPublishRequest(payload.request);
}

export async function listPublishRequests(status?: PublishRequestStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const payload = await requestJson<{ requests: ApiPublishRequest[] }>(
    `/api/publish-requests${query}`,
  );
  return payload.requests.map(mapPublishRequest);
}

export async function listMyPublishRequests() {
  const payload = await requestJson<{ requests: ApiPublishRequest[] }>(
    "/api/publish-requests/mine",
  );
  return payload.requests.map(mapPublishRequest);
}

export async function getPublishRequest(id: string) {
  const payload = await requestJson<{ request: ApiPublishRequest }>(`/api/publish-requests/${id}`);
  return mapPublishRequest(payload.request);
}

export async function approvePublishRequest(id: string, reviewNote = "") {
  const payload = await requestJson<{ request: ApiPublishRequest }>(
    `/api/publish-requests/${id}/approve`,
    {
      method: "POST",
      body: JSON.stringify({ reviewNote }),
    },
  );
  return mapPublishRequest(payload.request);
}

export async function rejectPublishRequest(id: string, reviewNote: string) {
  const payload = await requestJson<{ request: ApiPublishRequest }>(
    `/api/publish-requests/${id}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reviewNote }),
    },
  );
  return mapPublishRequest(payload.request);
}

export async function publishApprovedRequest(id: string) {
  const payload = await requestJson<{ request: ApiPublishRequest }>(
    `/api/publish-requests/${id}/publish`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
  return mapPublishRequest(payload.request);
}
