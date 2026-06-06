function defaultApiUrl() {
  if (typeof window === "undefined") return "http://localhost:5000";

  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:5000";
  }

  return window.location.origin;
}

function normalizeApiUrl(value: string | undefined) {
  return (value || "").trim().replace(/\/+$/, "");
}

export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL) || defaultApiUrl();

export function getAuthToken() {
  return localStorage.getItem("loyola_token") || "";
}

export function authHeaders(headers: HeadersInit = {}) {
  const token = getAuthToken();
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function loginUser(email: string, password: string) {
  let res: Response;

  try {
    res = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Portal server is offline. Start the backend and try again.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Login failed");
  }

  localStorage.setItem("loyola_token", data.token);
  localStorage.setItem("loyola_user", JSON.stringify(data.user));

  return data;
}

export async function logoutUser() {
  try {
    await fetch(`${API_URL}/api/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Local logout still clears browser storage if the API is unavailable.
  }
}

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  canViewSite: boolean;
}

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const response = await fetch(`${API_URL}/api/maintenance`, {
    credentials: "include",
    headers: authHeaders(),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not load maintenance status.");
  }
  return {
    enabled: Boolean(payload.enabled),
    message: String(payload.message || ""),
    canViewSite: Boolean(payload.canViewSite),
  };
}

export async function updateMaintenanceMode(
  enabled: boolean,
  message: string,
): Promise<MaintenanceStatus> {
  const response = await fetch(`${API_URL}/api/maintenance`, {
    method: "PATCH",
    credentials: "include",
    headers: authHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ enabled, message }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not update maintenance mode.");
  }
  return {
    enabled: Boolean(payload.enabled),
    message: String(payload.message || ""),
    canViewSite: Boolean(payload.canViewSite),
  };
}
