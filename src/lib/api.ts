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

const CSRF_COOKIE_NAME = "loyola_csrf_token";

function cookieValue(name: string) {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  const entry = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : "";
}

export function getAuthToken() {
  return "";
}

export function authHeaders(headers: HeadersInit = {}) {
  const csrfToken = cookieValue(CSRF_COOKIE_NAME);
  return {
    ...headers,
    ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
  };
}

export class TwoFactorRequiredError extends Error {
  requiresTwoFactor = true;
  twoFactorToken: string;
  email: string;

  constructor(twoFactorToken: string, email: string) {
    super("Enter the 6-digit authentication code from your authenticator app.");
    this.name = "TwoFactorRequiredError";
    this.twoFactorToken = twoFactorToken;
    this.email = email;
  }
}

function persistLoggedInUser(user: unknown) {
  if (!user) return;
  localStorage.removeItem("loyola_token");
  localStorage.setItem("loyola_user", JSON.stringify(user));
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

  if (data.requiresTwoFactor) {
    localStorage.removeItem("loyola_token");
    throw new TwoFactorRequiredError(
      String(data.twoFactorToken || ""),
      String(data.user?.email || email),
    );
  }

  persistLoggedInUser(data.user);

  return data;
}

export async function completeTwoFactorLogin(twoFactorToken: string, code: string) {
  let res: Response;

  try {
    res = await fetch(`${API_URL}/api/login/2fa`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ twoFactorToken, code }),
    });
  } catch {
    throw new Error("Portal server is offline. Start the backend and try again.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Two-factor login failed");
  }

  persistLoggedInUser(data.user);
  return data;
}

export async function getCurrentUser() {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/me`, {
      method: "GET",
      credentials: "include",
      headers: authHeaders(),
    });
  } catch {
    throw new Error("Portal server is offline. Start the backend and try again.");
  }

  if (response.status === 401 || response.status === 404) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not validate the portal session.");
  }

  persistLoggedInUser(payload);
  return payload;
}

export async function requestPasswordReset(email: string) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/password-reset/request`, {
      method: "POST",
      credentials: "include",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ email }),
    });
  } catch {
    throw new Error("Portal server is offline. Start the backend and try again.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not request a password reset.");
  }
  return payload as { success: boolean; message: string };
}

export async function resetPassword(token: string, password: string) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/password-reset/confirm`, {
      method: "POST",
      credentials: "include",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ token, password }),
    });
  } catch {
    throw new Error("Portal server is offline. Start the backend and try again.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not reset the password.");
  }
  return payload as { success: boolean; message: string };
}

export async function logoutUser() {
  try {
    await fetch(`${API_URL}/api/logout`, {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
    });
  } catch {
    // Local logout still clears browser storage if the API is unavailable.
  }
  localStorage.removeItem("loyola_token");
  localStorage.removeItem("loyola_user");
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
