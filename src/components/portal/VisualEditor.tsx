import React, { useEffect, useRef, useState } from "react";
import grapesjs from "grapesjs";
import type { Editor, Plugin } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import {
  AlertCircle,
  Eye,
  LayoutTemplate,
  Loader2,
  Monitor,
  Redo2,
  Rows3,
  Save,
  Settings2,
  SlidersHorizontal,
  Smartphone,
  TabletSmartphone,
  Undo2,
  X,
} from "lucide-react";
import { deleteBackendFileByUrl, uploadFileToBackend } from "@/lib/backend-upload";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

interface VisualEditorProps {
  initialHtml: string;
  initialCss: string;
  canvasCss?: string;
  onSave: (html: string, css: string) => void;
  onClose: () => void;
}

type AssetUploadEvent = DragEvent | Event;

function getUploadFiles(event: AssetUploadEvent): FileList | null {
  if ("dataTransfer" in event && event.dataTransfer) return event.dataTransfer.files;
  const target = event.target;
  return target instanceof HTMLInputElement ? target.files : null;
}

const CANVAS_STYLES = `
  :root {
    --loyola-navy: #08286f;
    --loyola-gold: #d6ad19;
    --loyola-crimson: #b70f1b;
    --loyola-ink: #152033;
    --loyola-soft: #f4f7fb;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: #ffffff;
    color: var(--loyola-ink);
    font-family: Inter, Segoe UI, Arial, sans-serif;
    line-height: 1.65;
  }

  h1, h2, h3, h4 {
    margin: 0;
    color: var(--loyola-navy);
    font-family: Georgia, "Times New Roman", serif;
    line-height: 1.08;
  }

  h1 { font-size: clamp(2.4rem, 6vw, 4.8rem); }
  h2 { font-size: clamp(1.9rem, 4vw, 3rem); }
  h3 { font-size: 1.35rem; }

  p { margin: 0; color: #546179; }
  a { color: var(--loyola-crimson); text-decoration: none; font-weight: 700; }
  img { display: block; max-width: 100%; }

  section { padding: 72px 40px; }
  .container { width: min(1120px, calc(100% - 40px)); margin: 0 auto; }
  .eyebrow {
    color: var(--loyola-crimson);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    border: 0;
    border-radius: 8px;
    background: var(--loyola-navy);
    color: #fff;
    padding: 12px 22px;
    font-weight: 800;
    cursor: pointer;
  }
  .btn.gold { background: var(--loyola-gold); color: var(--loyola-navy); }
  .hero {
    position: relative;
    overflow: hidden;
    background: linear-gradient(120deg, rgba(8, 40, 111, 0.96), rgba(8, 40, 111, 0.78)),
      url("/loyola-crest.jpg") center/contain no-repeat;
    color: #fff;
  }
  .hero h1, .hero p { color: #fff; }
  .hero .eyebrow { color: #f7d96b; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
  .feature-card {
    border: 1px solid #dde4ed;
    border-radius: 8px;
    background: #fff;
    padding: 28px;
    box-shadow: 0 16px 38px -28px rgba(8, 40, 111, 0.45);
  }
  .band { background: var(--loyola-soft); }
  .quote {
    border-left: 4px solid var(--loyola-gold);
    padding-left: 24px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1.5rem, 3vw, 2.25rem);
    color: var(--loyola-navy);
  }
  .anthem-media-section {
    background: #fff;
  }
  .anthem-media-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 420px;
    gap: 56px;
    align-items: center;
  }
  .anthem-media-card {
    display: block;
    overflow: hidden;
    border: 1px solid #dde4ed;
    border-radius: 8px;
    background: #0a1628;
    box-shadow: 0 28px 70px -42px rgba(10, 22, 40, 0.68);
  }
  .anthem-media-cover {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: #101827;
  }
  .anthem-media-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.78;
    transition: transform 180ms ease;
  }
  .anthem-media-card:hover .anthem-media-cover img {
    transform: scale(1.04);
  }
  .anthem-play {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(10, 22, 40, 0.18);
  }
  .anthem-play span {
    display: grid;
    width: 78px;
    height: 78px;
    place-items: center;
    border: 2px solid rgba(255,255,255,.86);
    border-radius: 999px;
    background: var(--loyola-gold);
    color: var(--loyola-navy);
    font-size: 30px;
    font-weight: 900;
  }
  .anthem-media-caption {
    border-top: 1px solid rgba(255,255,255,.12);
    padding: 22px;
  }
  .anthem-media-caption .eyebrow {
    color: #f7d96b;
  }
  .anthem-media-caption h3 {
    margin-top: 10px;
    color: #fff;
  }

  @media (max-width: 760px) {
    section { padding: 52px 22px; }
    .container { width: 100%; }
    .grid-2, .grid-3, .anthem-media-layout { grid-template-columns: 1fr; }
  }
`;

const STARTER_HTML = `<section class="hero">
  <div class="container">
    <p class="eyebrow">Loyola College Negombo</p>
    <h1 style="max-width: 780px; margin-top: 18px;">Welcome to Loyola</h1>
    <p style="max-width: 640px; margin-top: 20px; font-size: 1.15rem;">Build a polished school page by dragging sections, cards, text, images, and buttons into this canvas.</p>
    <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px;">
      <a class="btn gold" href="#">Explore</a>
      <a class="btn" href="#">Contact Office</a>
    </div>
  </div>
</section>
<section>
  <div class="container grid-3">
    <article class="feature-card">
      <p class="eyebrow">Academics</p>
      <h3 style="margin-top: 12px;">Learning Pathways</h3>
      <p style="margin-top: 10px;">Add concise content for your school section.</p>
    </article>
    <article class="feature-card">
      <p class="eyebrow">Campus</p>
      <h3 style="margin-top: 12px;">Facilities</h3>
      <p style="margin-top: 10px;">Use drag and drop blocks to shape the layout.</p>
    </article>
    <article class="feature-card">
      <p class="eyebrow">Notices</p>
      <h3 style="margin-top: 12px;">Updates</h3>
      <p style="margin-top: 10px;">Keep important page information easy to scan.</p>
    </article>
  </div>
</section>`;

type EditorDevice = {
  id: string;
  label: string;
  deviceName: string;
  icon: React.ComponentType<{ className?: string }>;
};

const devices: EditorDevice[] = [
  { id: "desktop", label: "Desktop", deviceName: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", deviceName: "Tablet", icon: TabletSmartphone },
  { id: "mobile", label: "Mobile", deviceName: "Mobile", icon: Smartphone },
];

export function VisualEditor({
  initialHtml,
  initialCss,
  canvasCss,
  onSave,
  onClose,
}: VisualEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDevice, setActiveDevice] = useState("desktop");
  const [isDirty, setIsDirty] = useState(false);

  const gjsRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef<HTMLDivElement>(null);
  const stylesRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const traitsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gjsRef.current) return;
    let cancelled = false;

    void Promise.all([import("grapesjs-preset-webpage"), import("grapesjs-blocks-basic")])
      .catch((err) => {
        if (!cancelled) {
          setLoading(false);
          setLoadError(
            err instanceof Error ? err.message : "Failed to load Visual Builder plugins.",
          );
        }
      })
      .then((result) => {
        if (!result) return;
        const [{ default: presetWebpage }, { default: blocksBasic }] = result as [
          { default: Plugin },
          { default: Plugin },
        ];
        if (!gjsRef.current || cancelled) return;
        setLoading(false);

        const editor = grapesjs.init({
          container: gjsRef.current,
          fromElement: false,
          height: "100%",
          width: "100%",
          storageManager: false,
          plugins: [presetWebpage, blocksBasic],
          pluginsOpts: {
            "grapesjs-preset-webpage": {
              modalImportTitle: "Import HTML",
            },
            "grapesjs-blocks-basic": {
              flexGrid: true,
              blocks: ["column1", "column2", "column3", "text", "link", "image", "video", "map"],
            },
          },
          canvas: {
            styles: [
              "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap",
            ],
          },
          deviceManager: {
            devices: [
              { name: "Desktop", width: "" },
              { name: "Tablet", width: "768px", widthMedia: "992px" },
              { name: "Mobile", width: "375px", widthMedia: "480px" },
            ],
          },
          assetManager: {
            uploadFile: async (event: AssetUploadEvent) => {
              const files = getUploadFiles(event);
              if (!files || files.length === 0) return;
              try {
                for (let i = 0; i < files.length; i++) {
                  const file = files[i];

                  if (file.type.startsWith("image/")) {
                    if (!IMAGE_TYPES.includes(file.type)) {
                      alert(`Image "${file.name}" must be a JPG or PNG file.`);
                      continue;
                    }
                    if (file.size > MAX_IMAGE_BYTES) {
                      alert(`Image "${file.name}" is larger than 5MB and cannot be uploaded.`);
                      continue;
                    }
                    const url = await uploadFileToBackend("site-images", file);
                    editor.AssetManager.add({ src: url, name: file.name });
                  } else if (file.type.startsWith("video/")) {
                    if (!VIDEO_TYPES.includes(file.type)) {
                      alert(`Video "${file.name}" must be MP4, MOV, or WebM.`);
                      continue;
                    }
                    if (file.size > MAX_VIDEO_BYTES) {
                      alert(`Video "${file.name}" is larger than 500MB and cannot be uploaded.`);
                      continue;
                    }
                    const url = await uploadFileToBackend("site-images", file);
                    editor.AssetManager.add({ src: url, name: file.name });
                  } else {
                    const url = await uploadFileToBackend("site-images", file);
                    editor.AssetManager.add({ src: url, name: file.name });
                  }
                }
              } catch (err) {
                console.error("Failed to upload image", err);
                alert(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
              }
            },
          },
          panels: { defaults: [] },
          blockManager: { appendTo: blocksRef.current! },
          styleManager: { appendTo: stylesRef.current! },
          layerManager: { appendTo: layersRef.current! },
          traitManager: { appendTo: traitsRef.current! },
          selectorManager: { componentFirst: true },
        });

        editor.on("asset:remove", (asset) => {
          const src = asset.get("src");
          if (src) {
            deleteBackendFileByUrl(src).catch((err) =>
              console.error("Failed to delete asset from backend storage", err),
            );
          }
        });

        editor.on("component:update:src", (component) => {
          const oldSrc = component.previous("src");
          const newSrc = component.get("src");
          if (oldSrc && oldSrc !== newSrc) {
            deleteBackendFileByUrl(oldSrc).catch((err) =>
              console.error("Failed to auto-delete old backend image", err),
            );
            editor.AssetManager.remove(oldSrc);
          }
        });

        editor.on("change:changesCount", () => {
          setIsDirty(true);
        });

        editor.on("load", () => {
          const iframe = editor.Canvas.getFrameEl() as HTMLIFrameElement | null;
          if (iframe?.contentDocument) {
            const style = iframe.contentDocument.createElement("style");
            style.textContent = CANVAS_STYLES;
            iframe.contentDocument.head.appendChild(style);
            if (canvasCss) {
              const pageStyle = iframe.contentDocument.createElement("style");
              pageStyle.textContent = canvasCss;
              iframe.contentDocument.head.appendChild(pageStyle);
            }
          }
        });

        editor.DomComponents.addType("anthem-media-card", {
          isComponent: (el: HTMLElement) =>
            el.classList?.contains("anthem-media-card") ? { type: "anthem-media-card" } : false,
          model: {
            defaults: {
              tagName: "a",
              attributes: {
                class: "anthem-media-card",
                href: "#",
                "data-cover": "/loyola-crest.jpg",
                "data-title": "College Anthem & Hymn",
              },
              traits: [
                {
                  type: "text",
                  name: "href",
                  label: "Video link",
                  placeholder: "YouTube or video URL",
                },
                {
                  type: "text",
                  name: "data-cover",
                  label: "Cover photo URL",
                  placeholder: "Paste image URL",
                },
                {
                  type: "text",
                  name: "data-title",
                  label: "Media title",
                  placeholder: "College Anthem & Hymn",
                },
                {
                  type: "select",
                  name: "target",
                  label: "Open",
                  options: [
                    { id: "", label: "Same tab" },
                    { id: "_blank", label: "New tab" },
                  ],
                },
              ],
            },
            init() {
              this.on("change:attributes:data-cover", this.updateCover);
              this.on("change:attributes:data-title", this.updateTitle);
            },
            updateCover() {
              const cover = this.getAttributes()["data-cover"] || "/loyola-crest.jpg";
              const image = this.find("img")[0];
              if (image) image.addAttributes({ src: cover });
            },
            updateTitle() {
              const title = this.getAttributes()["data-title"] || "College Anthem & Hymn";
              const heading = this.find(".anthem-media-title")[0];
              if (heading) heading.components(title);
            },
          },
        });

        const blocks = editor.BlockManager;
        blocks.add("loyola-hero", {
          label: "Hero",
          category: "Loyola Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="M7 10h8M7 14h5"/></svg>`,
          content: `<section class="hero"><div class="container"><p class="eyebrow">Loyola College</p><h1 style="max-width:760px;margin-top:18px;">A Tradition of Excellence</h1><p style="max-width:620px;margin-top:20px;font-size:1.1rem;">Replace this text with a strong page introduction.</p><a class="btn gold" href="#" style="margin-top:28px;">Learn More</a></div></section>`,
        });
        blocks.add("loyola-feature-grid", {
          label: "Feature Grid",
          category: "Loyola Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z"/></svg>`,
          content: `<section><div class="container grid-3"><article class="feature-card"><p class="eyebrow">One</p><h3 style="margin-top:12px;">Feature title</h3><p style="margin-top:10px;">Short supporting text.</p></article><article class="feature-card"><p class="eyebrow">Two</p><h3 style="margin-top:12px;">Feature title</h3><p style="margin-top:10px;">Short supporting text.</p></article><article class="feature-card"><p class="eyebrow">Three</p><h3 style="margin-top:12px;">Feature title</h3><p style="margin-top:10px;">Short supporting text.</p></article></div></section>`,
        });
        blocks.add("loyola-split", {
          label: "Image + Text",
          category: "Loyola Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M4 5h7v14H4zM14 7h6M14 11h6M14 15h4"/></svg>`,
          content: `<section class="band"><div class="container grid-2" style="align-items:center;"><img src="/loyola-crest.jpg" alt="" style="width:100%;border-radius:8px;background:#fff;padding:30px;box-shadow:0 16px 38px -28px rgba(8,40,111,.45);"/><div><p class="eyebrow">Section</p><h2 style="margin-top:12px;">Build a clean content section</h2><p style="margin-top:18px;">Use this area for page copy, admissions details, school life, or programme descriptions.</p><a class="btn" href="#" style="margin-top:24px;">Call to Action</a></div></div></section>`,
        });
        blocks.add("loyola-quote", {
          label: "Quote",
          category: "Loyola Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M7 7h6v6H9v4H5v-6c0-2.2.8-3.6 2-4zM17 7h4v6h-4v4h-4v-6c0-2.2.8-3.6 4-4z"/></svg>`,
          content: `<section><div class="container"><blockquote class="quote">Veritate ad Lumen et Vitam</blockquote><p class="eyebrow" style="margin-top:18px;">Loyola College</p></div></section>`,
        });
        blocks.add("loyola-anthem-media", {
          label: "Anthem Media",
          category: "Loyola Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="m10 9 5 3-5 3z"/></svg>`,
          content: `<section class="anthem-media-section">
  <div class="container anthem-media-layout">
    <div>
      <p class="eyebrow">Watch and Listen</p>
      <h2 style="margin-top:12px;">Anthem and hymn media.</h2>
      <p style="max-width:620px;margin-top:18px;"></p>
      <a class="btn" href="#" style="margin-top:26px;">Open video</a>
    </div>
    <a class="anthem-media-card" data-gjs-type="anthem-media-card" href="#" data-cover="/loyola-crest.jpg" data-title="College Anthem & Hymn">
      <div class="anthem-media-cover">
        <img src="/loyola-crest.jpg" alt="" />
        <div class="anthem-play"><span>&#9658;</span></div>
      </div>
      <div class="anthem-media-caption">
        <p class="eyebrow">Featured media</p>
        <h3 class="anthem-media-title">College Anthem & Hymn</h3>
      </div>
    </a>
  </div>
</section>`,
        });

        editor.setComponents(initialHtml || STARTER_HTML);
        editor.setStyle(initialCss || "");
        editorRef.current = editor;
        // Reset dirty state after initial load
        setTimeout(() => setIsDirty(false), 200);
      });

    return () => {
      cancelled = true;
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // Run once for the modal lifecycle; saves load through props at open time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    if (!editorRef.current) return;
    onSave(editorRef.current.getHtml(), editorRef.current.getCss() ?? "");
    setIsDirty(false);
  };

  const handleClose = () => {
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Close without saving?")) return;
    }
    onClose();
  };

  const runCmd = (cmd: string, deviceId?: string) => {
    editorRef.current?.runCommand(cmd);
    if (deviceId) setActiveDevice(deviceId);
  };

  const selectDevice = (device: EditorDevice) => {
    editorRef.current?.setDevice(device.deviceName);
    setActiveDevice(device.id);
  };

  if (loadError) {
    return (
      <div className="visual-builder fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-[#0b1020] text-slate-100">
        <AlertCircle className="h-16 w-16 text-red-400" />
        <div className="text-center">
          <p className="text-lg font-bold text-white">Visual Builder failed to load</p>
          <p className="mt-2 max-w-md text-sm text-slate-400">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20"
        >
          <X className="h-4 w-4" /> Close
        </button>
      </div>
    );
  }

  return (
    <div className="visual-builder fixed inset-0 z-[200] flex flex-col bg-[#0b1020] text-slate-100">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0b1020]">
          <Loader2 className="h-10 w-10 animate-spin text-amber-300" />
          <div className="text-center">
            <p className="text-sm font-bold text-white">Loading Visual Builder</p>
            <p className="mt-1 text-xs text-slate-400">Initializing GrapesJS editor...</p>
          </div>
        </div>
      )}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#10172a] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            title="Close builder"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">
              Loyola Digital Studio
            </p>
            <h2 className="truncate text-sm font-extrabold text-white">
              Visual Website Builder
              {isDirty && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-normal text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  unsaved
                </span>
              )}
            </h2>
          </div>
        </div>

        <div className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/5 p-1 md:flex">
          {devices.map((device) => {
            const Icon = device.icon;
            const isActive = activeDevice === device.id;
            return (
              <button
                key={device.id}
                type="button"
                title={device.label}
                onClick={() => selectDevice(device)}
                className={`inline-flex h-8 w-9 items-center justify-center rounded text-slate-300 transition hover:bg-white/10 hover:text-white ${
                  isActive ? "bg-amber-300/20 text-amber-300 ring-1 ring-amber-300/50" : ""
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runCmd("preview")}
            title="Preview"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => runCmd("core:undo")}
            title="Undo"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => runCmd("core:redo")}
            title="Redo"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-amber-300 px-4 text-xs font-black text-[#08286f] shadow-[0_12px_28px_-18px_rgba(252,211,77,.9)] transition hover:bg-amber-200"
          >
            <Save className="h-4 w-4" />
            Save Page
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_300px]">
        <aside className="flex min-h-0 flex-col border-r border-white/10 bg-[#111827]">
          <PanelHeading icon={LayoutTemplate} title="Elements" />
          <div ref={blocksRef} className="visual-builder-blocks min-h-0 flex-1 overflow-y-auto" />
        </aside>

        <main className="min-h-0 bg-[#090d18]">
          <div ref={gjsRef} className="h-full w-full" />
        </main>

        <RightPanel stylesRef={stylesRef} traitsRef={traitsRef} layersRef={layersRef} />
      </div>

      <GjsStyles />
    </div>
  );
}

function PanelHeading({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-4">
      <Icon className="h-4 w-4 text-amber-300" />
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
        {title}
      </span>
    </div>
  );
}

function RightPanel({
  stylesRef,
  traitsRef,
  layersRef,
}: {
  stylesRef: React.RefObject<HTMLDivElement | null>;
  traitsRef: React.RefObject<HTMLDivElement | null>;
  layersRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [tab, setTab] = React.useState<"style" | "traits" | "layers">("style");
  const tabs = [
    { id: "style" as const, label: "Style", icon: SlidersHorizontal },
    { id: "traits" as const, label: "Settings", icon: Settings2 },
    { id: "layers" as const, label: "Layers", icon: Rows3 },
  ];

  return (
    <aside className="flex min-h-0 flex-col border-l border-white/10 bg-[#111827]">
      <div className="grid h-12 shrink-0 grid-cols-3 border-b border-white/10 p-1">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center justify-center gap-1.5 rounded text-[11px] font-bold transition ${
                active
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div ref={stylesRef} style={{ display: tab === "style" ? "block" : "none" }} />
        <div ref={traitsRef} style={{ display: tab === "traits" ? "block" : "none" }} />
        <div ref={layersRef} style={{ display: tab === "layers" ? "block" : "none" }} />
      </div>
    </aside>
  );
}

function GjsStyles() {
  return (
    <style>{`
      .visual-builder .gjs-one-bg,
      .visual-builder .gjs-two-color,
      .visual-builder .gjs-three-bg,
      .visual-builder .gjs-four-color {
        color: inherit;
      }

      .visual-builder .gjs-editor {
        background: #090d18;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }

      .visual-builder .gjs-cv-canvas {
        inset: 0;
        width: 100%;
        height: 100%;
        background:
          linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px),
          #090d18 !important;
        background-size: 28px 28px;
        overflow: auto;
      }

      .visual-builder .gjs-frame-wrapper {
        margin: 34px auto;
        border-radius: 10px;
        box-shadow: 0 30px 80px -42px rgba(0,0,0,.95);
      }

      .visual-builder .gjs-frame {
        border-radius: 10px;
        background: #fff;
      }

      .visual-builder .gjs-cv-canvas__frames {
        padding: 0 34px 34px;
      }

      .visual-builder .gjs-block-categories {
        padding: 10px;
      }

      .visual-builder .gjs-blocks-c {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        padding: 8px 0 12px;
      }

      .visual-builder .gjs-block {
        min-height: 78px;
        width: auto;
        margin: 0;
        padding: 10px 8px;
        border: 1px solid rgba(148,163,184,.2);
        border-radius: 8px;
        background: rgba(255,255,255,.045);
        color: rgba(226,232,240,.86);
        box-shadow: none;
        cursor: grab;
        font-size: 11px;
        font-weight: 800;
        transition: background-color .16s ease, border-color .16s ease, transform .16s ease;
      }

      .visual-builder .gjs-block:hover {
        border-color: rgba(252,211,77,.72);
        background: rgba(252,211,77,.13);
        color: #fff;
        transform: translateY(-1px);
      }

      .visual-builder .gjs-block:active {
        cursor: grabbing;
      }

      .visual-builder .gjs-block__media {
        display: flex;
        height: 28px;
        align-items: center;
        justify-content: center;
        margin: 0 0 6px;
        color: #fcd34d;
        overflow: hidden;
      }

      .visual-builder .gjs-block__media svg,
      .visual-builder .gjs-block svg {
        width: 24px !important;
        height: 24px !important;
        max-width: 24px !important;
        max-height: 24px !important;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
      }

      .visual-builder .gjs-block-label {
        padding: 0;
        line-height: 1.25;
      }

      .visual-builder .gjs-block-category {
        border: 0;
      }

      .visual-builder .gjs-block-category .gjs-title,
      .visual-builder .gjs-sm-sector-title {
        display: flex;
        align-items: center;
        min-height: 34px;
        border: 0;
        background: transparent;
        color: rgba(203,213,225,.58);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .18em;
        text-transform: uppercase;
      }

      .visual-builder .gjs-block-category .gjs-title:hover,
      .visual-builder .gjs-sm-sector-title:hover {
        color: #fff;
        background: rgba(255,255,255,.04);
      }

      .visual-builder .gjs-sm-sector {
        border: 0;
        border-bottom: 1px solid rgba(255,255,255,.08);
        background: transparent;
      }

      .visual-builder .gjs-sm-properties,
      .visual-builder .gjs-trt-traits {
        padding: 10px 12px 14px;
      }

      .visual-builder .gjs-sm-property {
        margin-bottom: 8px;
      }

      .visual-builder .gjs-sm-label,
      .visual-builder .gjs-label,
      .visual-builder .gjs-clm-tags #gjs-clm-label {
        color: rgba(203,213,225,.7);
        font-size: 11px;
        font-weight: 700;
      }

      .visual-builder .gjs-field,
      .visual-builder .gjs-sm-field,
      .visual-builder .gjs-clm-tags,
      .visual-builder .gjs-trt-trait input,
      .visual-builder .gjs-trt-trait select,
      .visual-builder .gjs-sm-field input,
      .visual-builder .gjs-sm-field select {
        border: 1px solid rgba(148,163,184,.22) !important;
        border-radius: 7px;
        background: rgba(15,23,42,.72) !important;
        color: #f8fafc !important;
        box-shadow: none;
      }

      .visual-builder .gjs-field input,
      .visual-builder .gjs-field select,
      .visual-builder .gjs-sm-field input,
      .visual-builder .gjs-sm-field select {
        min-height: 30px;
        color: #f8fafc !important;
        font-size: 12px;
      }

      .visual-builder .gjs-field:focus-within,
      .visual-builder .gjs-sm-field:focus-within {
        border-color: rgba(252,211,77,.75) !important;
      }

      .visual-builder .gjs-layer {
        border-bottom: 1px solid rgba(255,255,255,.06);
        background: transparent;
      }

      .visual-builder .gjs-layer__item {
        padding: 8px 12px;
        color: rgba(226,232,240,.8);
      }

      .visual-builder .gjs-layer__item:hover {
        background: rgba(255,255,255,.06);
      }

      .visual-builder .gjs-layer.gjs-selected > .gjs-layer__item {
        background: rgba(252,211,77,.14);
        color: #fff;
      }

      .visual-builder .gjs-selected {
        outline: 2px solid #f59e0b !important;
        outline-offset: -2px;
      }

      .visual-builder .gjs-hovered {
        outline: 1px dashed rgba(245,158,11,.7) !important;
        outline-offset: -1px;
      }

      .visual-builder .gjs-toolbar {
        gap: 2px;
        border-radius: 7px;
        background: #08286f;
        padding: 3px;
        box-shadow: 0 14px 28px -18px rgba(8,40,111,.9);
      }

      .visual-builder .gjs-toolbar-item {
        display: inline-flex;
        width: 26px;
        height: 26px;
        align-items: center;
        justify-content: center;
        border-radius: 5px;
        color: #fff !important;
        font-size: 14px;
        line-height: 1;
      }

      .visual-builder .gjs-toolbar-item:hover {
        background: rgba(255,255,255,.14);
      }

      .visual-builder .gjs-rte-toolbar {
        border-radius: 8px;
        background: #111827;
        box-shadow: 0 20px 44px -26px rgba(0,0,0,.9);
      }

      .visual-builder .gjs-rte-action {
        color: #e2e8f0;
      }

      .visual-builder .gjs-badge,
      .visual-builder .gjs-placeholder,
      .visual-builder .gjs-com-badge {
        background: #f59e0b;
        color: #08286f;
      }

      .visual-builder ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      .visual-builder ::-webkit-scrollbar-track {
        background: transparent;
      }

      .visual-builder ::-webkit-scrollbar-thumb {
        border-radius: 8px;
        background: rgba(148,163,184,.26);
      }

      .visual-builder ::-webkit-scrollbar-thumb:hover {
        background: rgba(148,163,184,.42);
      }

      @media (max-width: 980px) {
        .visual-builder {
          min-width: 980px;
        }
      }
    `}</style>
  );
}
