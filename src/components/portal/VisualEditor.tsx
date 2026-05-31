import React, { useCallback, useEffect, useRef, useState } from "react";
import grapesjs from "grapesjs";
import type { Editor, Plugin } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  ImagePlus,
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
  Upload,
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
type UploadedAssetNotice = {
  name: string;
  url: string;
  kind: "image" | "video" | "file";
};

function getUploadFiles(event: AssetUploadEvent): FileList | null {
  if ("dataTransfer" in event && event.dataTransfer) return event.dataTransfer.files;
  const target = event.target;
  return target instanceof HTMLInputElement ? target.files : null;
}

function isFileDrag(event: React.DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes("Files");
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
  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }
  .stat-tile {
    border: 1px solid #dde4ed;
    border-radius: 8px;
    background: #fff;
    padding: 24px;
    text-align: center;
    box-shadow: 0 14px 34px -28px rgba(8, 40, 111, 0.42);
  }
  .stat-tile strong {
    display: block;
    color: var(--loyola-navy);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 2.1rem;
    line-height: 1;
  }
  .stat-tile span {
    display: block;
    margin-top: 8px;
    color: #64748b;
    font-size: .8rem;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .home-about-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 390px;
    gap: 44px;
    align-items: start;
  }
  .home-stat-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .home-rector-section {
    background: #fff;
  }
  .home-rector-grid {
    display: grid;
    grid-template-columns: 360px minmax(0, 1fr);
    gap: 36px;
    align-items: center;
  }
  .home-rector-photo {
    margin: 0;
    overflow: hidden;
    border-radius: 8px;
    background: #eef2f6;
    box-shadow: 0 16px 38px -28px rgba(8, 40, 111, 0.45);
  }
  .home-rector-photo img {
    width: 100%;
    aspect-ratio: 4 / 5;
    object-fit: cover;
  }
  .home-rector-message {
    border-left: 8px solid var(--loyola-navy);
    background: #fff;
    padding: 30px;
    box-shadow: 0 16px 38px -28px rgba(8, 40, 111, 0.45);
  }
  .home-signature {
    margin-top: 24px;
    color: var(--loyola-navy);
    font-weight: 800;
  }
  .home-signature span {
    color: #64748b;
    font-size: .82rem;
  }
  .home-section-heading {
    max-width: 760px;
  }
  .leadership-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 18px;
  }
  .leadership-card {
    overflow: hidden;
    border: 1px solid #dde4ed;
    border-radius: 8px;
    background: #fff;
    text-align: center;
    box-shadow: 0 16px 38px -28px rgba(8, 40, 111, 0.45);
  }
  .leadership-card img {
    width: 100%;
    aspect-ratio: 4 / 5;
    object-fit: cover;
    background: #dfe5ef;
  }
  .leadership-card div {
    padding: 20px 16px 24px;
  }
  .leadership-card span {
    display: block;
    width: 40px;
    height: 2px;
    margin: 12px auto 0;
    background: var(--loyola-gold);
  }
  .leadership-card p {
    margin-top: 12px;
    font-weight: 700;
    color: #64748b;
  }
  .team-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }
  .team-card {
    overflow: hidden;
    border: 1px solid #dde4ed;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 16px 38px -28px rgba(8, 40, 111, 0.45);
  }
  .team-card img {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }
  .team-card div {
    padding: 20px;
  }
  .team-card p {
    margin-top: 6px;
  }
  .cta-banner {
    position: relative;
    overflow: hidden;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--loyola-navy), #1e3560);
    color: #fff;
  }
  .cta-banner::after {
    position: absolute;
    inset: -30% -12% auto auto;
    width: 260px;
    aspect-ratio: 1;
    border-radius: 999px;
    background: rgba(214, 173, 25, .22);
    content: "";
  }
  .cta-banner h2,
  .cta-banner p {
    color: #fff;
  }
  .cta-banner .eyebrow {
    color: #f7d96b;
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
    .grid-2, .grid-3, .stats-row, .team-grid, .anthem-media-layout, .home-about-grid, .home-stat-grid, .home-rector-grid, .leadership-grid { grid-template-columns: 1fr; }
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
  const [uploadNotice, setUploadNotice] = useState<UploadedAssetNotice | null>(null);
  const [saveConfirmation, setSaveConfirmation] = useState("");
  const [uploadedAssetCount, setUploadedAssetCount] = useState(0);
  const [fileDragging, setFileDragging] = useState(false);

  const gjsRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef<HTMLDivElement>(null);
  const stylesRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const traitsRef = useRef<HTMLDivElement>(null);

  const uploadAssetFiles = useCallback(async (filesLike: FileList | File[]) => {
    const editor = editorRef.current;
    if (!editor) return;

    const files = Array.from(filesLike);
    for (const file of files) {
      try {
        let kind: UploadedAssetNotice["kind"] = "file";
        if (file.type.startsWith("image/")) {
          kind = "image";
          if (!IMAGE_TYPES.includes(file.type)) {
            alert(`Image "${file.name}" must be a JPG or PNG file.`);
            continue;
          }
          if (file.size > MAX_IMAGE_BYTES) {
            alert(`Image "${file.name}" is larger than 5MB and cannot be uploaded.`);
            continue;
          }
        } else if (file.type.startsWith("video/")) {
          kind = "video";
          if (!VIDEO_TYPES.includes(file.type)) {
            alert(`Video "${file.name}" must be MP4, MOV, or WebM.`);
            continue;
          }
          if (file.size > MAX_VIDEO_BYTES) {
            alert(`Video "${file.name}" is larger than 500MB and cannot be uploaded.`);
            continue;
          }
        }

        const url = await uploadFileToBackend("site-images", file);
        editor.AssetManager.add({ src: url, name: file.name });
        setUploadNotice({ name: file.name, url, kind });
        setUploadedAssetCount((count) => count + 1);
        setSaveConfirmation("");
      } catch (err) {
        console.error("Failed to upload asset", err);
        alert(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  }, []);

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
              await uploadAssetFiles(files);
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
        blocks.add("loyola-stats-row", {
          label: "Stats Row",
          category: "Loyola Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M4 18V9M10 18V5M16 18v-7M22 18V8"/></svg>`,
          content: `<section class="band"><div class="container"><p class="eyebrow">At a glance</p><h2 style="margin-top:12px;">Loyola by the numbers</h2><div class="stats-row" style="margin-top:28px;"><article class="stat-tile"><strong>100+</strong><span>Years of service</span></article><article class="stat-tile"><strong>2,000+</strong><span>Students</span></article><article class="stat-tile"><strong>90+</strong><span>Teachers</span></article><article class="stat-tile"><strong>25+</strong><span>Clubs and sports</span></article></div></div></section>`,
        });
        blocks.add("loyola-home-hero", {
          label: "Home Hero",
          category: "Home Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="M7 10h8M7 14h5"/></svg>`,
          content: `<section class="home-hero-section" style="position:relative; background:#0a1628; color:#fff; overflow:hidden; padding:80px 40px; min-height:85vh; display:flex; align-items:center;">
  <div style="position:absolute; inset:0; opacity:0.3; background-image:radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px); background-size:24px 24px;"></div>
  <div class="container grid-2" style="position:relative; z-index:2; align-items:center; gap:40px;">
    <div>
      <span class="gold-divider" style="margin-bottom:20px;"></span>
      <p class="eyebrow" style="color:#f7d96b; font-size:12px; font-weight:800; letter-spacing:0.24em; text-transform:uppercase;">Loyola College Negombo</p>
      <h1 style="font-family:serif; font-size:clamp(2.5rem, 5vw, 4.5rem); line-height:1.1; font-weight:bold; margin-top:20px; color:#fff;">A Tradition of Excellence.<br/>A Future of Innovation.</h1>
      <p style="margin-top:20px; font-size:1.1rem; color:rgba(255,255,255,0.85); max-width:600px; line-height:1.6;">Veritate ad Lumen et Vitam. Providing premium education, character formation, and holistic development for generations.</p>
      <div style="margin-top:30px; display:flex; flex-wrap:wrap; gap:16px;">
        <a class="btn gold" href="/about" style="background:#d4a017; color:#0a1628; padding:12px 28px; border-radius:8px; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:8px;">Explore College &rarr;</a>
        <a class="btn" href="/news" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:12px 28px; border-radius:8px; font-weight:800; text-decoration:none;">View Notices</a>
      </div>
    </div>
    <aside style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:12px; padding:30px; backdrop-filter:blur(10px);">
      <h3 style="font-family:serif; font-size:1.35rem; font-weight:bold; color:#fff; margin-bottom:20px;">Loyola Quick Access</h3>
      <div style="display:grid; gap:12px;">
        <a href="/portal" style="display:flex; align-items:center; gap:16px; padding:14px; background:rgba(255,255,255,0.08); border-radius:8px; text-decoration:none; color:#fff; transition: background 0.2s;">
          <span style="font-size:24px; color:#f7d96b;">🔐</span>
          <div>
            <strong style="display:block; font-size:14px;">Portal Login</strong>
            <span style="font-size:11px; color:rgba(255,255,255,0.6);">Secure sign-in for school portals</span>
          </div>
        </a>
        <a href="/downloads" style="display:flex; align-items:center; gap:16px; padding:14px; background:rgba(255,255,255,0.08); border-radius:8px; text-decoration:none; color:#fff; transition: background 0.2s;">
          <span style="font-size:24px; color:#f7d96b;">📁</span>
          <div>
            <strong style="display:block; font-size:14px;">Downloads &amp; Forms</strong>
            <span style="font-size:11px; color:rgba(255,255,255,0.6);">Circulars, syllabuses, and files</span>
          </div>
        </a>
        <a href="/about/college-staff" style="display:flex; align-items:center; gap:16px; padding:14px; background:rgba(255,255,255,0.08); border-radius:8px; text-decoration:none; color:#fff; transition: background 0.2s;">
          <span style="font-size:24px; color:#f7d96b;">🎓</span>
          <div>
            <strong style="display:block; font-size:14px;">Academic Staff</strong>
            <span style="font-size:11px; color:rgba(255,255,255,0.6);">Our rector, administration, and faculty</span>
          </div>
        </a>
      </div>
    </aside>
  </div>
</section>`,
        });
        blocks.add("loyola-home-about", {
          label: "Home About",
          category: "Home Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M4 5h9v14H4zM16 6h4M16 11h4M16 16h4"/></svg>`,
          content: `<section class="home-about-section"><div class="container home-about-grid"><div><p class="eyebrow">About Our College</p><h2 style="margin-top:12px;">Loyola College Negombo.</h2><p style="margin-top:18px; line-height:1.6; color:#546179;">Founded with a rich legacy of spiritual, intellectual, and physical excellence, Loyola College has stood as a beacon of education, preparing students to serve with leadership, integrity, and truth.</p><a class="btn" href="/about" style="margin-top:24px; text-decoration:none;">More Details</a></div><div class="home-stat-grid"><article class="stat-tile"><strong>2,500+</strong><span>Active Students</span></article><article class="stat-tile"><strong>110+</strong><span>Academic Staff</span></article><article class="stat-tile"><strong>1993</strong><span>Established</span></article><article class="stat-tile"><strong>25+</strong><span>Clubs &amp; Sports</span></article></div></div></section>`,
        });
        blocks.add("loyola-home-pillars", {
          label: "Home Pillars",
          category: "Home Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z"/></svg>`,
          content: `<section class="home-pillars-section" style="background:#f8fafc; padding:80px 40px; border-y:1px solid #dde4ed;">
  <div class="container">
    <div style="text-align:center; max-width:800px; margin:0 auto 50px;">
      <p class="eyebrow" style="color:#b70f1b;">Our Core Approach</p>
      <h2 style="margin-top:12px; font-family:serif; font-size:2.5rem; color:#0a1628;">A Foundation of Excellence</h2>
      <p style="margin-top:16px; color:#64748b; line-height:1.6;">We nurture our students through balanced education systems designed to foster deep technical expertise, robust physical capabilities, and strong moral values.</p>
    </div>
    <div class="grid-3" style="gap:24px;">
      <article class="feature-card" style="background:#fff; border:1px solid #dde4ed; padding:30px; border-radius:8px;">
        <span style="font-size:32px;">🧠</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.35rem; color:#0a1628;">Academic Rigor</h3>
        <p style="margin-top:12px; font-size:0.9rem; color:#64748b; line-height:1.6;">Modern curricula focusing on science, technology, mathematics, commerce, and humanities to prepare students for international pathways.</p>
      </article>
      <article class="feature-card" style="background:#fff; border:1px solid #dde4ed; padding:30px; border-radius:8px;">
        <span style="font-size:32px;">⛪</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.35rem; color:#0a1628;">Character Formation</h3>
        <p style="margin-top:12px; font-size:0.9rem; color:#64748b; line-height:1.6;">Character guidance built upon Christian principles, respect, self-discipline, and compassion to raise upright citizens.</p>
      </article>
      <article class="feature-card" style="background:#fff; border:1px solid #dde4ed; padding:30px; border-radius:8px;">
        <span style="font-size:32px;">🏆</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.35rem; color:#0a1628;">Co-Curricular Growth</h3>
        <p style="margin-top:12px; font-size:0.9rem; color:#64748b; line-height:1.6;">Vibrant athletics, clubs, and societies, offering sports, music, drama, coding, and environmental exploration.</p>
      </article>
    </div>
  </div>
</section>`,
        });
        blocks.add("loyola-rector-message", {
          label: "Rector Message",
          category: "Home Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M5 4h6v16H5zM14 6h6M14 10h6M14 14h4"/></svg>`,
          content: `<section class="home-rector-section"><div class="container home-rector-grid"><figure class="home-rector-photo"><img src="/loyola-crest.jpg" alt="Rector portrait placeholder" /></figure><article class="home-rector-message"><p class="eyebrow">Rector's Message</p><h2 style="margin-top:12px;">Welcome to Our Digital Space.</h2><p style="margin-top:18px; line-height:1.6; color:#546179;">Dear teachers, students, parents, and alumni, I welcome you warmly to Loyola College Negombo. Our mission is to raise children of truth, who discover light and life through learning, compassion, and spiritual strength.</p><p style="margin-top:14px; line-height:1.6; color:#546179;">We aim to ensure that every student who leaves our gates is equipped with both academic excellence and a strong moral character to face the modern world's challenges.</p><p class="home-signature">Rev. Fr. D.M.J. Kennedy Perera<br /><span>Rector, Loyola College</span></p></article></div></section>`,
        });
        blocks.add("loyola-leadership-grid", {
          label: "Leadership Grid",
          category: "Home Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M5 6h4v5H5zM10 6h4v5h-4zM15 6h4v5h-4zM5 13h4v5H5zM10 13h4v5h-4zM15 13h4v5h-4z"/></svg>`,
          content: `<section class="home-leadership-section" style="background:#f8fafc; padding:80px 40px;"><div class="container"><div class="home-section-heading" style="text-align:center; max-width:800px; margin:0 auto 50px;"><p class="eyebrow">Administration Board</p><h2 style="margin-top:12px; font-family:serif; font-size:2.5rem; color:#0a1628;">College Leadership</h2><p style="margin-top:16px; color:#64748b; line-height:1.6;">The administration board steering Loyola College's legacy and future directions.</p></div><div class="leadership-grid" style="margin-top:32px;"><article class="leadership-card"><img src="/loyola-crest.jpg" alt="Rector" /><div style="padding:20px;"><h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Rev. Fr. Kennedy Perera</h3><span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span><p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Rector</p></div></article><article class="leadership-card"><img src="/loyola-crest.jpg" alt="Vice Principal" /><div style="padding:20px;"><h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Rev. Fr. Suranga Niroshan</h3><span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span><p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Vice Principal</p></div></article><article class="leadership-card"><img src="/loyola-crest.jpg" alt="Sectional Head" /><div style="padding:20px;"><h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Mrs. Nimali Fernando</h3><span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span><p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Primary Section Head</p></div></article><article class="leadership-card"><img src="/loyola-crest.jpg" alt="Senior Master" /><div style="padding:20px;"><h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Mr. Samantha Silva</h3><span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span><p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Senior Section Head</p></div></article></div></div></section>`,
        });
        blocks.add("loyola-home-vision", {
          label: "Home Vision",
          category: "Home Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
          content: `<section class="home-vision-mission-section" style="background:#082766; color:#fff; padding:80px 40px; position:relative; overflow:hidden;">
  <div style="position:absolute; inset:0; opacity:0.08; background-image:linear-gradient(135deg,transparent 0,transparent 24px,#fff 25px,transparent 26px),linear-gradient(45deg,transparent 0,transparent 28px,#fff 29px,transparent 30px); background-size:120px_120px;"></div>
  <div class="container grid-2" style="position:relative; z-index:2; align-items:center; gap:48px;">
    <div>
      <p class="eyebrow" style="color:#fff1a8; font-size:12px; font-weight:800; letter-spacing:0.24em;">Loyola Identity</p>
      <h2 style="font-family:serif; font-size:2.8rem; font-weight:bold; margin-top:16px; color:#fff; line-height:1.2;">Welcome to Loyola College</h2>
      <div style="margin-top:40px; display:grid; gap:30px;">
        <div>
          <h3 style="font-size:1.5rem; font-weight:bold; color:#fff1a8;">Our Vision</h3>
          <p style="margin-top:10px; color:rgba(255,255,255,0.8); line-height:1.6; font-size:0.95rem;">To announce God's Kingdom through Christian values, offering integral education and human guidelines.</p>
        </div>
        <div>
          <h3 style="font-size:1.5rem; font-weight:bold; color:#fff1a8;">Mission Statement</h3>
          <div style="margin-top:16px; display:grid; gap:12px;">
            <p style="display:flex; gap:12px; align-items:start; margin:0; color:rgba(255,255,255,0.8); font-size:0.95rem;">
              <span style="color:#fff1a8; font-weight:bold;">&check;</span>
              <span>To aim at integral education of body, mind, and spirit through service and leadership.</span>
            </p>
            <p style="display:flex; gap:12px; align-items:start; margin:0; color:rgba(255,255,255,0.8); font-size:0.95rem;">
              <span style="color:#fff1a8; font-weight:bold;">&check;</span>
              <span>To strive to form citizens of upright character who pursue excellence in every sphere.</span>
            </p>
            <p style="display:flex; gap:12px; align-items:start; margin:0; color:rgba(255,255,255,0.8); font-size:0.95rem;">
              <span style="color:#fff1a8; font-weight:bold;">&check;</span>
              <span>To promote character formation based on human and religious values.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
    <aside style="background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); max-width:480px; margin:0 auto;">
      <div style="aspect-ratio:1.6; background:#000;">
        <img src="/flag1.png" alt="Loyola Flag" style="width:100%; height:100%; object-fit:contain; background:#fff;" />
      </div>
      <div style="padding:30px; text-align:center; background:#fff;">
        <p style="font-family:serif; font-size:1.5rem; font-weight:bold; color:#0a1628; margin:0;">Veritate Ad Lumen Et Vitam</p>
        <p style="margin:8px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold;">In Truth to Light and Life</p>
      </div>
    </aside>
  </div>
</section>`,
        });
        blocks.add("loyola-home-academics", {
          label: "Home Academics",
          category: "Home Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/><path d="M17 12v5c0 1.66-2.24 3-5 3s-5-1.34-5-3v-5l5 3 5-3z"/></svg>`,
          content: `<section class="home-academics-section" style="padding:80px 40px;">
  <div class="container">
    <div style="display:flex; justify-content:between; align-items:end; flex-wrap:wrap; gap:20px; margin-bottom:40px;">
      <div>
        <p class="eyebrow" style="color:#b70f1b;">Academics</p>
        <h2 style="margin-top:12px; font-family:serif; font-size:2.5rem; color:#0a1628; margin:0;">Academic pathways for every stage.</h2>
      </div>
      <a href="/academics" style="color:#b70f1b; font-weight:bold; text-decoration:none; font-size:0.95rem;">Academics Overview &rarr;</a>
    </div>
    <div class="grid-4" style="gap:20px;">
      <article class="feature-card" style="border:1px solid #dde4ed; padding:24px; border-radius:8px; background:#fff;">
        <span style="font-size:24px; color:#d4a017;">🎓</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.2rem; color:#0a1628;">Primary Section</h3>
        <p style="margin-top:10px; font-size:0.85rem; color:#64748b; line-height:1.6;">Foundational learning, basic language development, religious values, and classroom confidence.</p>
      </article>
      <article class="feature-card" style="border:1px solid #dde4ed; padding:24px; border-radius:8px; background:#fff;">
        <span style="font-size:24px; color:#d4a017;">🎓</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.2rem; color:#0a1628;">Middle School</h3>
        <p style="margin-top:10px; font-size:0.85rem; color:#64748b; line-height:1.6;">Structured study habits, co-curricular exploration, personal character formation, and initial subject grids.</p>
      </article>
      <article class="feature-card" style="border:1px solid #dde4ed; padding:24px; border-radius:8px; background:#fff;">
        <span style="font-size:24px; color:#d4a017;">🎓</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.2rem; color:#0a1628;">Upper School</h3>
        <p style="margin-top:10px; font-size:0.85rem; color:#64748b; line-height:1.6;">Exam preparation, leadership, advanced clubs, competitive sports, and highly disciplined academic focus.</p>
      </article>
      <article class="feature-card" style="border:1px solid #dde4ed; padding:24px; border-radius:8px; background:#fff;">
        <span style="font-size:24px; color:#d4a017;">🎓</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.2rem; color:#0a1628;">Advanced Level</h3>
        <p style="margin-top:10px; font-size:0.85rem; color:#64748b; line-height:1.6;">Dedicated learning pathways in Science, Technology, Commerce, and Arts for senior students preparing for university.</p>
      </article>
    </div>
  </div>
</section>`,
        });
        blocks.add("loyola-home-sports-gallery", {
          label: "Sports & Gallery",
          category: "Home Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M22 16V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2zm-11-4l2.03 2.71L16 11l4 5H4l7-9zM2 20h20v2H2z"/></svg>`,
          content: `<section class="home-sports-gallery-section" style="background:#fff; padding:80px 40px; border-t:1px solid #dde4ed;">
  <div class="container grid-2" style="gap:48px;">
    <div>
      <div style="display:flex; justify-content:between; align-items:center; margin-bottom:24px;">
        <h2 style="font-family:serif; font-size:2.2rem; color:#0a1628; margin:0;">Sports &amp; Clubs</h2>
        <a href="/sports-clubs" style="color:#b70f1b; font-weight:bold; text-decoration:none; font-size:0.9rem;">View All</a>
      </div>
      <div style="display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px;">
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">Media Unit</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">Science Society</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">ICT Society</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">Prefects Board</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">English Literary</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">Religious Society</a>
      </div>
    </div>
    <div>
      <div style="display:flex; justify-content:between; align-items:center; margin-bottom:24px;">
        <h2 style="font-family:serif; font-size:2.2rem; color:#0a1628; margin:0;">Gallery Preview</h2>
        <a href="/gallery" style="color:#b70f1b; font-weight:bold; text-decoration:none; font-size:0.9rem;">Open Gallery</a>
      </div>
      <div style="display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px;">
        <img src="/loyola-crest.jpg" alt="Gallery photo" style="width:100%; aspect-ratio:1.33; object-fit:cover; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.08);" />
        <img src="/loyola-crest.jpg" alt="Gallery photo" style="width:100%; aspect-ratio:1.33; object-fit:cover; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.08);" />
        <img src="/loyola-crest.jpg" alt="Gallery photo" style="width:100%; aspect-ratio:1.33; object-fit:cover; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.08);" />
        <img src="/loyola-crest.jpg" alt="Gallery photo" style="width:100%; aspect-ratio:1.33; object-fit:cover; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.08);" />
      </div>
    </div>
  </div>
</section>`,
        });
        blocks.add("loyola-home-downloads-contact", {
          label: "Home Downloads",
          category: "Home Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>`,
          content: `<section class="home-downloads-contact-section" style="padding:80px 40px; background:#f8fafc; border-t:1px solid #dde4ed;">
  <div class="container grid-[2fr_1fr]" style="gap:40px; display:grid; grid-template-columns: 2fr 1.2fr;">
    <div style="background:#0a1628; color:#fff; padding:40px; border-radius:12px; box-shadow:0 12px 30px rgba(10,22,40,0.15); display:flex; flex-direction:column; justify-content:center;">
      <p class="eyebrow" style="color:#f7d96b; font-size:12px; font-weight:800; letter-spacing:0.2em;">Downloads &amp; Notices</p>
      <h2 style="font-family:serif; font-size:2.5rem; font-weight:bold; margin-top:16px; color:#fff; line-height:1.2;">Important files in one place.</h2>
      <p style="margin-top:16px; color:rgba(255,255,255,0.75); font-size:0.95rem; line-height:1.6; max-width:600px;">Access official circulars, student timetables, application forms, academic calendars, notices, and essential school resources directly without navigating complex menus.</p>
      <a href="/downloads" style="align-self:start; margin-top:24px; background:#d4a017; color:#0a1628; font-weight:800; padding:12px 28px; border-radius:8px; text-decoration:none; display:inline-flex; align-items:center; gap:8px;">Open Downloads &rarr;</a>
    </div>
    <aside style="background:#fff; border:1px solid #dde4ed; padding:35px; border-radius:12px; box-shadow:0 4px 14px rgba(0,0,0,0.05); display:flex; flex-direction:column; justify-content:center;">
      <h2 style="font-family:serif; font-size:1.8rem; color:#0a1628; margin:0 0 20px;">Contact Office</h2>
      <div style="display:grid; gap:16px; font-size:0.9rem; color:#64748b;">
        <p style="margin:0; display:flex; gap:12px; align-items:start;"><span style="font-size:18px;">📍</span> <span>Loyola College, Negombo, Sri Lanka</span></p>
        <p style="margin:0; display:flex; gap:12px; align-items:start;"><span style="font-size:18px;">📞</span> <span>+94 31 222 2844</span></p>
        <p style="margin:0; display:flex; gap:12px; align-items:start;"><span style="font-size:18px;">✉️</span> <span>info@loyalacollegenegombo.com</span></p>
      </div>
      <a href="/contact" style="align-self:start; margin-top:28px; background:#0a1628; color:#fff; font-weight:800; padding:12px 24px; border-radius:8px; text-decoration:none; text-align:center;">Contact Office</a>
    </aside>
  </div>
</section>`,
        });
        blocks.add("loyola-team-cards", {
          label: "Team Cards",
          category: "Loyola Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c.7-3.2 2.4-5 5-5s4.3 1.8 5 5M11 20c.7-3.2 2.4-5 5-5s4.3 1.8 5 5"/></svg>`,
          content: `<section><div class="container"><p class="eyebrow">Leadership</p><h2 style="margin-top:12px;">Meet the team</h2><div class="team-grid" style="margin-top:28px;"><article class="team-card"><img src="/loyola-crest.jpg" alt="" /><div><h3>Staff name</h3><p>Role or department</p></div></article><article class="team-card"><img src="/loyola-crest.jpg" alt="" /><div><h3>Staff name</h3><p>Role or department</p></div></article><article class="team-card"><img src="/loyola-crest.jpg" alt="" /><div><h3>Staff name</h3><p>Role or department</p></div></article></div></div></section>`,
        });
        blocks.add("loyola-cta-banner", {
          label: "Call to Action",
          category: "Loyola Sections",
          media: `<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/><path d="M4 5h16v14H4z"/></svg>`,
          content: `<section><div class="container cta-banner"><div style="position:relative;z-index:1;padding:42px;"><p class="eyebrow">Next step</p><h2 style="max-width:720px;margin-top:12px;">Invite families to connect with Loyola.</h2><p style="max-width:620px;margin-top:16px;">Use this banner for admissions, contact, events, or important announcements.</p><a class="btn gold" href="#" style="margin-top:24px;">Get started</a></div></div></section>`,
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
    setSaveConfirmation(
      uploadedAssetCount > 0 ? "Saved page with uploaded media URLs." : "Saved page content.",
    );
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

  const openAssets = () => {
    editorRef.current?.runCommand("open-assets");
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    setFileDragging(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setFileDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    setFileDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    setFileDragging(false);
    void uploadAssetFiles(event.dataTransfer.files);
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
    <div
      className="visual-builder fixed inset-0 z-[200] flex flex-col bg-[#0b1020] text-slate-100"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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

        <div className="hidden min-w-0 flex-1 justify-center px-3 xl:flex">
          {uploadNotice ? (
            <div className="flex min-w-0 max-w-md items-center gap-3 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-emerald-100">
              {uploadNotice.kind === "image" ? (
                <img
                  src={uploadNotice.url}
                  alt=""
                  className="h-8 w-10 rounded object-cover ring-1 ring-white/10"
                />
              ) : (
                <span className="grid h-8 w-10 place-items-center rounded bg-white/10">
                  <Upload className="h-4 w-4" />
                </span>
              )}
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
              <div className="min-w-0">
                <p className="truncate text-xs font-black">Uploaded {uploadNotice.name}</p>
                <p className="truncate text-[10px] text-emerald-100/70">
                  {saveConfirmation || "Save Page to keep this media in the page HTML."}
                </p>
              </div>
            </div>
          ) : saveConfirmation ? (
            <div className="inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">
              <CheckCircle2 className="h-4 w-4 text-amber-300" />
              {saveConfirmation}
            </div>
          ) : null}
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
            onClick={openAssets}
            title="Upload image or asset"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <ImagePlus className="h-4 w-4" />
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

        <main className="relative min-h-0 bg-[#090d18]">
          {fileDragging && (
            <div className="pointer-events-none absolute inset-4 z-20 grid place-items-center rounded-xl border-2 border-dashed border-amber-300 bg-[#0b1020]/72 text-center shadow-[0_24px_70px_-40px_rgba(0,0,0,.9)] backdrop-blur-sm">
              <div>
                <Upload className="mx-auto h-9 w-9 text-amber-300" />
                <p className="mt-3 text-sm font-black text-white">Drop files to upload</p>
                <p className="mt-1 text-xs text-slate-300">
                  JPG, PNG, MP4, MOV, and WebM are added to the Asset Manager.
                </p>
              </div>
            </div>
          )}
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

      .visual-builder .gjs-mdl-dialog {
        overflow: hidden;
        border: 1px solid rgba(148,163,184,.2);
        border-radius: 10px;
        background: #111827;
        color: #e2e8f0;
        box-shadow: 0 34px 90px -42px rgba(0,0,0,.95);
      }

      .visual-builder .gjs-mdl-header {
        border-bottom: 1px solid rgba(255,255,255,.08);
        background: rgba(15,23,42,.82);
        color: #fff;
        font-weight: 900;
      }

      .visual-builder .gjs-mdl-content {
        background: #111827;
      }

      .visual-builder .gjs-am-file-uploader {
        border: 1px dashed rgba(252,211,77,.48);
        border-radius: 10px;
        background: rgba(252,211,77,.08);
        color: #e2e8f0;
      }

      .visual-builder .gjs-am-assets {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
        gap: 10px;
      }

      .visual-builder .gjs-am-asset {
        width: auto;
        margin: 0;
        overflow: hidden;
        border: 1px solid rgba(148,163,184,.18);
        border-radius: 8px;
        background: rgba(255,255,255,.045);
        box-shadow: none;
        transition: transform .16s ease, border-color .16s ease, background-color .16s ease;
      }

      .visual-builder .gjs-am-asset:hover {
        border-color: rgba(252,211,77,.72);
        background: rgba(252,211,77,.11);
        transform: translateY(-2px);
      }

      .visual-builder .gjs-am-preview-cont {
        background: rgba(15,23,42,.8);
      }

      .visual-builder .gjs-am-name {
        color: rgba(226,232,240,.82);
        font-size: 11px;
        font-weight: 800;
      }

      .visual-builder .gjs-btn-prim,
      .visual-builder .gjs-am-add-asset button {
        border: 0 !important;
        border-radius: 7px;
        background: #fcd34d !important;
        color: #08286f !important;
        font-weight: 900;
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
