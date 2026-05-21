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
