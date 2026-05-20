export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
