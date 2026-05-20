import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

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

ReactDOM.createRoot(root).render(<App />);
