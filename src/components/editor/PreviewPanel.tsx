import { ExternalLink, Globe, RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DB } from "@/lib/store";
import type { StudioDevice } from "./TopBar";

const widths: Record<StudioDevice, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

function pagePath(page: string) {
  return page === "home" ? "/" : `/${page}`;
}

export function PreviewPanel({ device, page, db }: { device: StudioDevice; page: string; db: DB }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const path = pagePath(page);
  const src = `${path}?websiteEditorPreview=1&refresh=${refreshKey}`;

  const postDb = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: "loyola.website-preview.db", db },
      window.location.origin,
    );
  }, [db]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(postDb);
    return () => window.cancelAnimationFrame(frame);
  }, [postDb, src]);

  return (
    <aside className="flex w-[520px] shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex h-12 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <Globe className="size-3.5" />
          live preview<span className="text-foreground">{path}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRefreshKey((current) => current + 1)}
            className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Refresh preview"
          >
            <RotateCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => window.open(path, "_blank", "noopener,noreferrer")}
            className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Open page"
          >
            <ExternalLink className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid flex-1 place-items-start justify-center overflow-auto bg-background bg-grain p-6">
        <div
          className="mx-auto overflow-hidden rounded-xl border border-border bg-white text-zinc-900 shadow-2xl transition-all duration-300"
          style={{ width: widths[device], maxWidth: "100%", minHeight: "640px" }}
        >
          <iframe
            key={src}
            ref={frameRef}
            src={src}
            title="Live website preview"
            onLoad={postDb}
            className="h-[720px] w-full border-0 bg-white"
          />
        </div>
      </div>

      <div className="flex h-9 items-center justify-between border-t border-border px-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>
          {device} · {widths[device]}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-success" /> Live
        </span>
      </div>
    </aside>
  );
}
