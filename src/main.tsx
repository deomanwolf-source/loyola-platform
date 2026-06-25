import { Component, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { BootCompleteMarker } from "./components/BootCompleteMarker";
import "./styles.css";

class PageErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    const msg = this.state.error?.message || "An unexpected error occurred.";
    return (
      <main
        style={{
          display: "grid",
          minHeight: "100vh",
          placeItems: "center",
          background: "linear-gradient(135deg, #eef3ff, #f8fafc)",
          color: "#172033",
          fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          padding: "24px",
        }}
      >
        <section
          style={{
            width: "min(100%, 480px)",
            border: "1px solid #d8e1f5",
            borderRadius: "12px",
            background: "white",
            boxShadow: "0 24px 70px -42px rgba(10,22,40,0.45)",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <img
            src="/loyola-crest.jpg"
            alt="Loyola College"
            style={{
              width: "72px",
              height: "72px",
              border: "3px solid #d4a017",
              borderRadius: "999px",
              objectFit: "contain",
              padding: "6px",
            }}
          />
          <h1 style={{ color: "#0a1628", fontSize: "22px", margin: "18px 0 8px" }}>
            This page could not be loaded
          </h1>
          <p style={{ color: "#5d6a7e", fontSize: "13px", lineHeight: "1.7", margin: 0 }}>
            {msg}
          </p>
          <div style={{ marginTop: "20px", display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => window.history.back()}
              style={{
                border: "1px solid #d8e1f5",
                borderRadius: "8px",
                background: "white",
                color: "#0a1628",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 700,
                padding: "10px 16px",
              }}
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: 0,
                borderRadius: "8px",
                background: "#0a1628",
                color: "white",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 700,
                padding: "10px 16px",
              }}
            >
              Reload Page
            </button>
          </div>
        </section>
      </main>
    );
  }
}

const root = document.getElementById("root");

if (typeof window !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  if (params.has("reset") || params.has("clearData")) {
    localStorage.removeItem("loyola.db.v4");
    localStorage.removeItem("loyola.db.v5");
    localStorage.removeItem("loyola.db.v6");
    sessionStorage.removeItem("loyola.portal.user");
    params.delete("reset");
    params.delete("clearData");
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
    );
  }
}

if (!root) {
  throw new Error("Root element #root was not found.");
}

ReactDOM.createRoot(root).render(
  <PageErrorBoundary>
    <BootCompleteMarker>
      <App />
    </BootCompleteMarker>
  </PageErrorBoundary>,
);
