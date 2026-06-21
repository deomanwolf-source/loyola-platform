const DEFAULT_EDUTRACK_PUBLIC_URL = "https://edutrack.loyolacollege.lk";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export const EDUTRACK_LOCAL_URL = "http://localhost:5002/portal/edutrack";

export function resolveEduTrackPublicUrl(configuredUrl = import.meta.env.VITE_EDUTRACK_PUBLIC_URL) {
  const configured = String(configuredUrl || "")
    .trim()
    .replace(/\/+$/, "");
  if (configured) return configured;

  if (typeof window !== "undefined" && LOCAL_HOSTS.has(window.location.hostname)) {
    return "";
  }

  return DEFAULT_EDUTRACK_PUBLIC_URL;
}

export const EDUTRACK_PUBLIC_URL = resolveEduTrackPublicUrl();

export const EDUTRACK_DIRECT_URL = EDUTRACK_PUBLIC_URL
  ? `${EDUTRACK_PUBLIC_URL}/portal/edutrack`
  : "/portal/edutrack";

export const EDUTRACK_LAUNCH_URL = "/portal/edutrack";

export function edutrackHref(suffix = "") {
  return `${EDUTRACK_LAUNCH_URL}${suffix}`;
}
