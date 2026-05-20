import { useCallback, useEffect, useState, type ComponentType } from "react";
import { CheckCircle2, CloudOff, Loader2, LogIn, RefreshCw } from "lucide-react";
import { API_URL, getAuthToken } from "@/lib/api";

type UploadStatus = "checking" | "ready" | "login-required" | "offline";

type StatusState = {
  status: UploadStatus;
  title: string;
  detail: string;
};

const statusStyles: Record<UploadStatus, string> = {
  checking: "border-sky-200 bg-sky-50 text-sky-900",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-900",
  "login-required": "border-amber-200 bg-amber-50 text-amber-900",
  offline: "border-red-200 bg-red-50 text-red-900",
};

const statusIcons: Record<UploadStatus, ComponentType<{ className?: string }>> = {
  checking: Loader2,
  ready: CheckCircle2,
  "login-required": LogIn,
  offline: CloudOff,
};

export function MediaUploadStatus() {
  const [state, setState] = useState<StatusState>({
    status: "checking",
    title: "Checking media uploads",
    detail: "Testing login and backend connection.",
  });

  const checkStatus = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setState({
        status: "login-required",
        title: "Login required for media uploads",
        detail: "Sign in to an admin account before uploading images, videos, or documents.",
      });
      return;
    }

    setState({
      status: "checking",
      title: "Checking media uploads",
      detail: "Testing the Node.js backend connection.",
    });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(`${API_URL}/api/health`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);

      if (response.ok && payload?.status === "ok") {
        setState({
          status: "ready",
          title: "Media uploads ready",
          detail: `Connected to ${API_URL}.`,
        });
        return;
      }

      setState({
        status: "offline",
        title: "Backend health check failed",
        detail: payload?.message || `The backend at ${API_URL} did not return a healthy response.`,
      });
    } catch {
      setState({
        status: "offline",
        title: "Backend is not reachable",
        detail: `Start the backend server and confirm VITE_API_URL points to ${API_URL}.`,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void checkStatus();

    const onFocus = () => void checkStatus();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [checkStatus]);

  const Icon = statusIcons[state.status];

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-xs leading-5 ${statusStyles[state.status]}`}
      aria-live="polite"
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${state.status === "checking" ? "animate-spin" : ""}`}
      />
      <div className="min-w-0 flex-1">
        <p className="font-black">{state.title}</p>
        <p className="mt-0.5 font-semibold opacity-85">{state.detail}</p>
      </div>
      {state.status !== "ready" && (
        <button
          type="button"
          onClick={() => void checkStatus()}
          className="rounded-lg p-1.5 opacity-80 hover:bg-white/70 hover:opacity-100"
          aria-label="Recheck media upload status"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
