import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Code2,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  LayoutTemplate,
  Menu,
  MonitorSmartphone,
  Palette,
  Pencil,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import {
  audit,
  makeId,
  setDb,
  useDb,
  saveDbNow,
  useAuth,
  type DB,
  type PageBlockType,
  type PageBlock,
} from "@/lib/store";
import { isMediaUploadDisabledError, uploadFileToBackend } from "@/lib/backend-upload";
import { createPublishRequest } from "@/lib/publish-requests";
import { MediaUploadStatus } from "./MediaUploadStatus";
import { VisualEditor } from "./VisualEditor";

const IMAGE_TYPES = ["image/jpeg", "image/png"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getSortedNav(nav: DB["navigation"]) {
  const parents = nav.filter((n) => !n.parentId).sort((a, b) => a.order - b.order);
  const sorted: DB["navigation"] = [];
  for (const parent of parents) {
    sorted.push(parent);
    const children = nav.filter((n) => n.parentId === parent.id).sort((a, b) => a.order - b.order);
    sorted.push(...children);
  }
  const handledIds = new Set(sorted.map((n) => n.id));
  const orphans = nav.filter((n) => !handledIds.has(n.id)).sort((a, b) => a.order - b.order);
  sorted.push(...orphans);
  return sorted;
}

function pageTreeIds(nav: DB["navigation"], rootId: string) {
  const ids = new Set<string>([rootId]);
  const queue = [rootId];

  while (queue.length) {
    const current = queue.shift()!;
    nav
      .filter((item) => item.parentId === current)
      .forEach((item) => {
        if (ids.has(item.id)) return;
        ids.add(item.id);
        queue.push(item.id);
      });
  }

  return ids;
}

async function compressImage(
  file: File,
): Promise<{ url: string; original: string; optimized: string }> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Only JPG and PNG images are allowed.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is too large. Maximum size is 5 MB.");

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = objectUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not read image."));
  });

  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / image.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image optimizer is not available in this browser.");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(objectUrl);

  const url = canvas.toDataURL("image/png");
  return {
    url,
    original: formatBytes(file.size),
    optimized: formatBytes(Math.round((url.length * 3) / 4)),
  };
}

async function prepareBackgroundMedia(file: File): Promise<{
  url: string;
  type: "image" | "video";
  message: string;
}> {
  if (IMAGE_TYPES.includes(file.type)) {
    const optimized = await compressImage(file);
    try {
      const url = await uploadFileToBackend("site-background", file);
      return {
        url,
        type: "image",
        message: `Background image optimized and uploaded: ${optimized.original} to ${optimized.optimized}`,
      };
    } catch (error) {
      if (isMediaUploadDisabledError(error)) throw error;
      // Vite dev still needs local previews to work when cloud storage is unavailable.
    }

    return {
      url: optimized.url,
      type: "image",
      message: `Background image optimized for local preview: ${optimized.original} to ${optimized.optimized}`,
    };
  }

  if (!VIDEO_TYPES.includes(file.type)) {
    throw new Error("Only JPG, PNG, MP4, MOV, and WebM files are allowed.");
  }

  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Video is too large. Maximum video upload is 500 MB.");
  }

  try {
    const url = await uploadFileToBackend("site-background", file);
    return {
      url,
      type: "video",
      message: `Background video uploaded: ${formatBytes(file.size)}`,
    };
  } catch (error) {
    if (isMediaUploadDisabledError(error)) throw error;
    throw new Error(
      error instanceof Error
        ? error.message
        : "Video upload needs the Node.js backend. Keep the backend running, or use a YouTube link for large videos.",
    );
  }
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <div className="mt-2">{children}</div>
      {hint && <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span>}
    </label>
  );
}

function StudioButton({
  children,
  onClick,
  tone = "light",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "light" | "dark" | "gold";
  disabled?: boolean;
}) {
  const cls =
    tone === "gold"
      ? "relative overflow-hidden bg-gradient-to-r from-[#d4a017] to-[#f7c948] text-[#0a1628] shadow-[0_4px_20px_-4px_rgba(212,160,23,0.55)] hover:shadow-[0_6px_28px_-4px_rgba(212,160,23,0.7)] hover:scale-[1.03] active:scale-[0.97]"
      : tone === "dark"
        ? "bg-gradient-to-r from-[#0a1628] to-[#1e3560] text-white shadow-[0_4px_16px_-4px_rgba(10,22,40,0.4)] hover:shadow-[0_6px_22px_-4px_rgba(10,22,40,0.55)] hover:scale-[1.03] active:scale-[0.97]"
        : "border border-slate-200 bg-white/90 text-navy shadow-sm backdrop-blur-sm hover:bg-slate-50 hover:border-slate-300 hover:scale-[1.02] active:scale-[0.98]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100 ${cls}`}
    >
      {children}
    </button>
  );
}

function displayPageName(pageId: string) {
  return pageId.split("/").pop()!.replaceAll("-", " ");
}

function pagePath(pageId: string) {
  return pageId === "home" ? "/" : `/${pageId}`;
}

function escapeHtml(value?: string) {
  return String(value || "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] || char,
  );
}

function homeVisualStarter() {
  return `<section class="home-hero-section" style="position:relative; background:#0a1628; color:#fff; overflow:hidden; padding:80px 40px; min-height:85vh; display:flex; align-items:center;">
  <div style="position:absolute; inset:0; opacity:0.3; background-image:radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px); background-size:24px 24px;"></div>
  <div class="container grid-2" style="position:relative; z-index:2; align-items:center; gap:40px;">
    <div>
      <span class="gold-divider" style="margin-bottom:20px;"></span>
      <p class="eyebrow" style="color:#f7d96b; font-size:12px; font-weight:800; letter-spacing:0.24em; text-transform:uppercase;">Loyola College Negombo</p>
      <h1 style="font-family:serif; font-size:clamp(2.5rem, 5vw, 4.5rem); line-height:1.1; font-weight:bold; margin-top:20px; color:#fff;">A Tradition of Excellence<br/>A Future of Innovation</h1>
      <p style="margin-top:20px; font-size:1.1rem; color:rgba(255,255,255,0.85); max-width:600px; line-height:1.6;">Veritate ad Lumen et Vitam, Providing Premium Education, Character Formation, and Holistic Development for Generations</p>
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
</section>

<section class="home-about-section">
  <div class="container home-about-grid">
    <div>
      <p class="eyebrow">About Our College</p>
      <h2 style="margin-top:12px;">Loyola College Negombo</h2>
      <p style="margin-top:18px; line-height:1.6; color:#546179;">Founded with a rich legacy of spiritual, intellectual, and physical excellence, Loyola College has stood as a beacon of education, preparing students to serve with leadership, integrity, and truth.</p>
      <a class="btn" href="/about" style="margin-top:24px; text-decoration:none;">More Details</a>
    </div>
    <div class="home-stat-grid">
      <article class="stat-tile"><strong>2,500+</strong><span>Active Students</span></article>
      <article class="stat-tile"><strong>110+</strong><span>Academic Staff</span></article>
      <article class="stat-tile"><strong>1993</strong><span>Established</span></article>
      <article class="stat-tile"><strong>25+</strong><span>Clubs &amp; Sports</span></article>
    </div>
  </div>
</section>

<section class="home-pillars-section" style="background:#f8fafc; padding:80px 40px; border-y:1px solid #dde4ed;">
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
</section>

<section class="home-rector-section">
  <div class="container home-rector-grid">
    <figure class="home-rector-photo">
      <img src="/loyola-crest.jpg" alt="Rector portrait placeholder" />
    </figure>
    <article class="home-rector-message">
      <p class="eyebrow">Rector's Message</p>
      <h2 style="margin-top:12px;">Welcome to Our Digital Space</h2>
      <p style="margin-top:18px; line-height:1.6; color:#546179;">Dear teachers, students, parents, and alumni, I welcome you warmly to Loyola College Negombo. Our mission is to raise children of truth, who discover light and life through learning, compassion, and spiritual strength.</p>
      <p style="margin-top:14px; line-height:1.6; color:#546179;">We aim to ensure that every student who leaves our gates is equipped with both academic excellence and a strong moral character to face the modern world's challenges.</p>
      <p class="home-signature">Rev. Fr. D.M.J. Kennedy Perera<br /><span>Rector, Loyola College</span></p>
    </article>
  </div>
</section>

<section class="home-leadership-section" style="background:#f8fafc; padding:80px 40px;">
  <div class="container">
    <div class="home-section-heading" style="text-align:center; max-width:800px; margin:0 auto 50px;">
      <p class="eyebrow">Administration Board</p>
      <h2 style="margin-top:12px; font-family:serif; font-size:2.5rem; color:#0a1628;">College Leadership</h2>
      <p style="margin-top:16px; color:#64748b; line-height:1.6;">The administration board steering Loyola College's legacy and future directions.</p>
    </div>
    <div class="leadership-grid" style="margin-top:32px;">
      <article class="leadership-card">
        <img src="/loyola-crest.jpg" alt="Rector" />
        <div style="padding:20px;">
          <h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Rev. Fr. Kennedy Perera</h3>
          <span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span>
          <p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Rector</p>
        </div>
      </article>
      <article class="leadership-card">
        <img src="/loyola-crest.jpg" alt="Vice Principal" />
        <div style="padding:20px;">
          <h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Rev. Fr. Suranga Niroshan</h3>
          <span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span>
          <p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Vice Principal</p>
        </div>
      </article>
      <article class="leadership-card">
        <img src="/loyola-crest.jpg" alt="Sectional Head" />
        <div style="padding:20px;">
          <h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Mrs. Nimali Fernando</h3>
          <span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span>
          <p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Primary Section Head</p>
        </div>
      </article>
      <article class="leadership-card">
        <img src="/loyola-crest.jpg" alt="Senior Master" />
        <div style="padding:20px;">
          <h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Mr. Samantha Silva</h3>
          <span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span>
          <p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Senior Section Head</p>
        </div>
      </article>
    </div>
  </div>
</section>

<section class="home-vision-mission-section" style="background:#082766; color:#fff; padding:80px 40px; position:relative; overflow:hidden;">
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
</section>

<section class="home-academics-section" style="padding:80px 40px;">
  <div class="container">
    <div style="display:flex; justify-content:between; align-items:end; flex-wrap:wrap; gap:20px; margin-bottom:40px;">
      <div>
        <p class="eyebrow" style="color:#b70f1b;">Academics</p>
        <h2 style="margin-top:12px; font-family:serif; font-size:2.5rem; color:#0a1628; margin:0;">Academic Pathways for Every Stage</h2>
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
</section>

<section class="home-sports-gallery-section" style="background:#fff; padding:80px 40px; border-t:1px solid #dde4ed;">
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
</section>

<section class="home-downloads-contact-section" style="padding:80px 40px; background:#f8fafc; border-t:1px solid #dde4ed;">
  <div class="container grid-[2fr_1fr]" style="gap:40px; display:grid; grid-template-columns: 2fr 1.2fr;">
    <div style="background:#0a1628; color:#fff; padding:40px; border-radius:12px; box-shadow:0 12px 30px rgba(10,22,40,0.15); display:flex; flex-direction:column; justify-content:center;">
      <p class="eyebrow" style="color:#f7d96b; font-size:12px; font-weight:800; letter-spacing:0.2em;">Downloads &amp; Notices</p>
      <h2 style="font-family:serif; font-size:2.5rem; font-weight:bold; margin-top:16px; color:#fff; line-height:1.2;">Important Files in One Place</h2>
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
</section>`;
}

function visualStarterForPage(db: DB, pageId: string) {
  const page = db.pages[pageId] || db.pages.home || {};
  if (pageId === "home") return homeVisualStarter();

  const navItem = db.navigation.find((item) => item.id === pageId);
  const pageName = navItem?.label || page.title || displayPageName(pageId);
  const title =
    pageId === "home"
      ? db.websiteContent.heroTitle || page.title || pageName
      : page.title || pageName;
  const body =
    pageId === "home"
      ? db.websiteContent.heroText || page.body || "Add a strong page introduction."
      : page.body || "Add page content here.";
  const image =
    page.image ||
    (pageId === "home" ? db.websiteContent.heroImage : db.media.campusImage) ||
    db.websiteContent.heroImage ||
    "/loyola-crest.jpg";
  const hasPageMedia = Boolean(page.backgroundMediaUrl);
  const backgroundMediaUrl = hasPageMedia ? page.backgroundMediaUrl || "" : image;
  const backgroundMediaType = hasPageMedia ? page.backgroundMediaType || "image" : "image";
  const backgroundMediaOpacity = hasPageMedia
    ? Math.min(0.75, Math.max(0.08, page.backgroundMediaOpacity || 0.34))
    : 0.28;
  const backgroundMedia =
    backgroundMediaType === "video"
      ? `<video src="${escapeHtml(backgroundMediaUrl)}" autoplay muted loop playsinline style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:${backgroundMediaOpacity};"></video>`
      : `<img src="${escapeHtml(backgroundMediaUrl)}" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:${backgroundMediaOpacity};" />`;
  const blocks = page.blocks || [];
  const cards = blocks.length
    ? blocks.slice(0, 3).map((block) => ({
        title: block.content.title || block.type,
        body: block.content.body || block.content.quote || "Edit this block.",
      }))
    : pageId === "home"
      ? db.homeSections.pillars.slice(0, 3)
      : [
          { title: `${pageName} overview`, body },
          { title: "Key information", body: "Drag text, images, and sections into this page." },
          { title: "Next steps", body: "Save this page to publish your visual design." },
        ];

  if (pageId === "about/college-administration" || pageId === "college-administration") {
    const adminStaff = db.teachers.filter((s) => s.category === "Top Administration").slice(0, 4);
    const adminCards = adminStaff
      .map(
        (s) => `
      <article class="admin-card" style="text-align:center;">
        <div style="aspect-ratio:4/5; overflow:hidden; background:#f1f5f9; border-radius:8px;">
          ${s.image ? `<img src="${escapeHtml(s.image)}" style="width:100%; height:100%; object-fit:cover;" />` : `<div style="height:100%; display:grid; place-items:center; color:#cbd5e1;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>`}
        </div>
        <h3 style="margin-top:1.5rem; font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628;">${escapeHtml(s.name)}</h3>
        <p style="margin-top:0.5rem; font-size:0.875rem; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">${escapeHtml(s.position || "")}</p>
      </article>
    `,
      )
      .join("");

    return `<section class="hero" style="position:relative; overflow:hidden; background:#0a1628;">
  ${backgroundMedia}
  <div style="position:absolute; inset:0; background:linear-gradient(105deg, rgba(10, 22, 40, 0.98), rgba(10, 22, 40, 0.86), rgba(183, 15, 27, 0.42));"></div>
  <div class="container" style="position:relative; z-index:1;">
    <p class="eyebrow">Governance</p>
    <h1 style="max-width: 860px; margin-top: 18px;">${escapeHtml(title)}</h1>
    <p style="max-width: 680px; margin-top: 20px; font-size: 1.15rem;">The leadership team guiding Loyola College towards excellence in education and character formation.</p>
  </div>
</section>

<section style="padding:80px 0; background:#ffffff;">
  <div class="container">
    <div style="text-align:center; margin-bottom:60px;">
      <p class="eyebrow">Management</p>
      <h2 style="margin-top:12px; font-family:serif; font-size:2.5rem; font-weight:bold; color:#0a1628;">Top Administration</h2>
      <div style="width:80px; height:4px; background:#d4a017; margin:24px auto 0;"></div>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:40px;">
      ${adminCards || '<p style="grid-column:1/-1; text-align:center; color:#64748b;">Add staff with "Top Administration" category in the Staff Management section to see them here.</p>'}
    </div>
    <div style="margin-top:60px; text-align:center; padding:30px; border-radius:16px; background:#f8fafc; border:1px dashed #cbd5e1;">
      <p style="font-weight:bold; color:#0a1628;">Dynamic Administration List</p>
      <p style="margin-top:8px; font-size:0.875rem; color:#64748b;">This page is automatically linked to the Staff Management system. Any staff member categorized under "Top Administration", "Vice Principals", or "Sectional Heads" will automatically appear on the live website with a professional layout.</p>
    </div>
  </div>
</section>`;
  }

  if (pageId === "about/college-anthem-hymn") {
    const anthemVideoTitle = page.anthemVideoTitle || "College Anthem & Hymn";
    const anthemVideoUrl = db.websiteContent.anthemVideoUrl || page.anthemVideoUrl || "#";
    const anthemVideoCover =
      db.websiteContent.anthemVideoCoverImage || page.anthemVideoCoverImage || image;

    return `<section class="hero" style="position:relative; overflow:hidden; background:#0a1628;">
  ${backgroundMedia}
  <div style="position:absolute; inset:0; background:linear-gradient(105deg, rgba(10, 22, 40, 0.98), rgba(10, 22, 40, 0.86), rgba(183, 15, 27, 0.42));"></div>
  <div class="container" style="position:relative; z-index:1;">
    <p class="eyebrow">Faith, learning, discipline, and service</p>
    <h1 style="max-width: 860px; margin-top: 18px;">${escapeHtml(title)}</h1>
    <p style="max-width: 680px; margin-top: 20px; font-size: 1.15rem;">A dignified home for Loyola College Negombo's ceremonial songs, school values, and shared identity.</p>
  </div>
</section>

<section class="anthem-media-section">
  <div class="container anthem-media-layout">
    <div>
      <p class="eyebrow">Watch and Listen</p>
      <h2 style="margin-top:12px;">Anthem and Hymn Media</h2>
      <p style="max-width:620px;margin-top:18px;"></p>
      <a class="btn" href="${escapeHtml(anthemVideoUrl)}" style="margin-top:26px;">Open video</a>
    </div>
    <a class="anthem-media-card" data-gjs-type="anthem-media-card" href="${escapeHtml(anthemVideoUrl)}" data-cover="${escapeHtml(anthemVideoCover)}" data-title="${escapeHtml(anthemVideoTitle)}">
      <div class="anthem-media-cover">
        <img src="${escapeHtml(anthemVideoCover)}" alt="" />
        <div class="anthem-play"><span>&#9658;</span></div>
      </div>
      <div class="anthem-media-caption">
        <p class="eyebrow">Featured media</p>
        <h3 class="anthem-media-title">${escapeHtml(anthemVideoTitle)}</h3>
      </div>
    </a>
  </div>
</section>`;
  }

  return `<section class="hero" style="position:relative; overflow:hidden; background:#0a1628;">
  ${backgroundMedia}
  <div style="position:absolute; inset:0; background:linear-gradient(105deg, rgba(10, 22, 40, 0.98), rgba(10, 22, 40, 0.86), rgba(183, 15, 27, 0.42));"></div>
  <div class="container" style="position:relative; z-index:1;">
    <p class="eyebrow">${escapeHtml(page.kicker || page.eyebrow || pageName)}</p>
    <h1 style="max-width: 780px; margin-top: 18px;">${escapeHtml(title)}</h1>
    <p style="max-width: 680px; margin-top: 20px; font-size: 1.15rem;">${escapeHtml(body)}</p>
  </div>
</section>
<section>
  <div class="container grid-3">
    ${cards
      .map(
        (card) => `<article class="feature-card">
      <h3>${escapeHtml(card.title)}</h3>
      <p style="margin-top: 10px;">${escapeHtml(card.body)}</p>
    </article>`,
      )
      .join("")}
  </div>
</section>`;
}

function capturePageCss(doc: Document) {
  return Array.from(doc.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

function capturePreviewContent(frame: HTMLIFrameElement | null) {
  const doc = frame?.contentDocument;
  if (!doc) return null;

  const main = doc.querySelector("main");
  const html = main?.innerHTML.trim();
  if (!html) return null;

  return {
    html,
    css: capturePageCss(doc),
  };
}

function previewItems(db: DB, pageId: string, section: string) {
  if (section === "Header") {
    return db.navigation
      .filter((item) => item.visible !== false)
      .sort((a, b) => a.order - b.order)
      .slice(0, 6)
      .map((item) => ({
        title: item.label,
        body: pagePath(item.id),
      }));
  }

  if (section === "Hero") {
    const page = db.pages[pageId] || db.pages.home;
    return [
      {
        title:
          pageId === "home" ? db.websiteContent.heroTitle : page.title || displayPageName(pageId),
        body:
          pageId === "home"
            ? db.websiteContent.heroText
            : page.body || "This page is ready for content.",
      },
    ];
  }

  if (section === "Welcome") {
    if (pageId === "home") {
      return db.homeSections.pillars.slice(0, 3).map((pillar) => ({
        title: pillar.title,
        body: pillar.body,
      }));
    }
    const page = db.pages[pageId] || db.pages.home;
    return [
      {
        title: page.welcomeTitle || page.title || `${displayPageName(pageId)} welcome`,
        body: page.body || db.homeSections.approachBody,
      },
    ];
  }

  if (section === "Vision & Mission") {
    return [
      { title: db.aboutSections.storyTitle, body: db.aboutSections.storyBodyOne },
      { title: "College motto", body: db.aboutSections.quote },
      { title: "Formation", body: db.aboutSections.storyBodyTwo },
    ];
  }

  if (section === "News & Notices") {
    const news = db.news.slice(0, 3).map((item) => ({ title: item.title, body: item.body }));
    return news.length
      ? news
      : [
          {
            title: db.homeSections.newsTitle,
            body: "Published news and notices will appear here.",
          },
        ];
  }

  if (section === "Events") {
    const events = db.events.slice(0, 3).map((event) => ({
      title: event.title,
      body: `${event.date} | ${event.location || "Campus"} | ${event.type}`,
    }));
    return events.length
      ? events
      : [{ title: db.homeSections.eventsTitle, body: "Upcoming events will appear here." }];
  }

  if (section === "Gallery") {
    const gallery = db.gallery
      .filter((item) => item.visible !== false)
      .slice(0, 3)
      .map((item) => ({
        title: item.label,
        body: item.description || "Album cover and media preview.",
      }));
    return gallery.length
      ? gallery
      : [{ title: db.eventsSections.galleryTitle, body: "Gallery albums will appear here." }];
  }

  return [
    { title: db.websiteContent.schoolName, body: db.websiteContent.footerText },
    { title: "Contact", body: `${db.websiteContent.phone} | ${db.websiteContent.email}` },
    { title: "Legal line", body: db.websiteContent.footerLegalLine },
  ];
}

function PreviewWebsite({
  db,
  selectedPage,
  selectedSection,
  frameRef,
}: {
  db: DB;
  selectedPage: string;
  selectedSection: string;
  frameRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const path = pagePath(selectedPage);
  const src = `${path}?websiteEditorPreview=1&refresh=${refreshKey}`;

  const postDb = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: "loyola.website-preview.db", db },
      window.location.origin,
    );
  }, [db, frameRef]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(postDb);
    return () => window.cancelAnimationFrame(frame);
  }, [postDb, src]);

  return (
    <div className="flex h-[78vh] min-h-[640px] flex-col overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-elegant">
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <a
            href={path}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-navy shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-badge" />
              Live
            </span>
            <Eye className="h-3.5 w-3.5" />
            Preview {path} | {selectedSection}
          </a>
        </div>
      </div>
      <iframe
        key={src}
        ref={frameRef}
        src={src}
        title="Full website live preview"
        onLoad={postDb}
        className="min-h-0 flex-1 border-0 bg-white"
      />
      <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        <span>{displayPageName(selectedPage)}</span>
        <button
          type="button"
          onClick={() => setRefreshKey((current) => current + 1)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-navy"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>
    </div>
  );
}

const studioSections = [
  "Header",
  "Hero",
  "Welcome",
  "Vision & Mission",
  "News & Notices",
  "Events",
  "Gallery",
  "Footer",
];

function PageBlockEditor({ pageId }: { pageId: string }) {
  const db = useDb();
  const page = db.pages[pageId] || {};
  const blocks = page.blocks || [];

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const setBlocks = (newBlocks: PageBlock[]) => {
    setDb((current) => ({
      ...current,
      pages: {
        ...current.pages,
        [pageId]: { ...(current.pages[pageId] || {}), blocks: newBlocks },
      },
    }));
  };

  const updateBlock = (index: number, content: Partial<PageBlock["content"]>) => {
    const newBlocks = [...blocks];
    newBlocks[index] = {
      ...newBlocks[index],
      content: { ...newBlocks[index].content, ...content },
    };
    setBlocks(newBlocks);
  };

  const removeBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const newBlocks = [...blocks];
    const item = newBlocks.splice(draggedIdx, 1)[0];
    newBlocks.splice(index, 0, item);
    setDraggedIdx(index);
    setBlocks(newBlocks);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 mb-4">
        {(["text", "hero", "quote", "gallery"] as PageBlockType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              const id = makeId("BLK");
              setBlocks([
                ...blocks,
                { id, type, content: { title: `New ${type}`, body: "Edit this content." } },
              ]);
            }}
            className="rounded-lg bg-secondary px-3 py-1 text-xs font-bold text-navy hover:bg-gold/20 hover:text-gold-dark"
          >
            + Add {type}
          </button>
        ))}
      </div>

      {blocks.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No blocks on this page. Add a block above to start building.
        </div>
      )}

      {blocks.map((block, i) => (
        <div
          key={block.id}
          draggable
          onDragStart={(e) => handleDragStart(e, i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDragEnd={() => setDraggedIdx(null)}
          className={`overflow-hidden rounded-xl border border-slate-200 bg-white transition-opacity ${draggedIdx === i ? "opacity-50" : ""}`}
        >
          <div className="flex cursor-grab items-center justify-between bg-slate-50 px-3 py-2 border-b border-slate-200 active:cursor-grabbing">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <GripVertical className="h-4 w-4" /> {block.type} Block
            </div>
            <button
              type="button"
              onClick={() => removeBlock(i)}
              className="text-slate-400 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <input
              value={block.content.title || ""}
              onChange={(e) => updateBlock(i, { title: e.target.value })}
              placeholder="Block Title"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-gold"
            />
            {block.type !== "gallery" && (
              <textarea
                value={block.content.body || block.content.quote || ""}
                onChange={(e) =>
                  updateBlock(
                    i,
                    block.type === "quote" ? { quote: e.target.value } : { body: e.target.value },
                  )
                }
                placeholder={block.type === "quote" ? "Quote text" : "Block content"}
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
              />
            )}
            {block.type === "quote" && (
              <input
                value={block.content.author || ""}
                onChange={(e) => updateBlock(i, { author: e.target.value })}
                placeholder="Author name"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function WebsiteEditor() {
  const db = useDb();
  const auth = useAuth();
  const heroInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const campusInputRef = useRef<HTMLInputElement>(null);
  const principalInputRef = useRef<HTMLInputElement>(null);
  const pageImageInputRef = useRef<HTMLInputElement>(null);
  const anthemVideoCoverInputRef = useRef<HTMLInputElement>(null);
  const backgroundMediaInputRef = useRef<HTMLInputElement>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [selectedPage, setSelectedPage] = useState("home");
  const [selectedSection, setSelectedSection] = useState("Hero");
  const [message, setMessage] = useState("Ready to edit.");
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");
  const [savingState, setSavingState] = useState<"idle" | "saving" | "publishing" | "submitting">(
    "idle",
  );
  const [visualEditorOpen, setVisualEditorOpen] = useState(false);
  const [visualEditorInitial, setVisualEditorInitial] = useState<{
    html: string;
    css: string;
    canvasCss: string;
  } | null>(null);

  const page = db.pages[selectedPage] || db.pages.home;
  const needsApproval = auth.user?.role === "website_admin";

  const pageIds = useMemo(() => {
    const sortedNav = getSortedNav(db.navigation).filter((item) => item.id !== "student-portal");
    const navIds = sortedNav.map((item) => item.id).filter((id) => db.pages[id]);
    return [
      ...navIds,
      ...Object.keys(db.pages).filter((id) => !navIds.includes(id) && id !== "student-portal"),
    ];
  }, [db.navigation, db.pages]);
  const visibleNav = useMemo(() => getSortedNav(db.navigation), [db.navigation]);

  useEffect(() => {
    if (!db.pages[selectedPage]) setSelectedPage("home");
  }, [db.pages, selectedPage]);

  const updateContent = (patch: Partial<DB["websiteContent"]>) => {
    setDb((current) => ({ ...current, websiteContent: { ...current.websiteContent, ...patch } }));
  };

  const updatePage = (key: string, value: string | number) => {
    setDb((current) => ({
      ...current,
      pages: {
        ...current.pages,
        [selectedPage]: { ...(current.pages[selectedPage] || {}), [key]: value },
      },
    }));
  };

  const uploadTo = async (
    target: "hero" | "logo" | "campus" | "page" | "principal" | "anthemVideoCover",
    file?: File,
  ) => {
    if (!file) return;
    try {
      setMessage("Optimizing image...");
      const optimized = await compressImage(file);
      let imageUrl = optimized.url;
      let uploaded = false;

      try {
        setMessage("Uploading optimized image...");
        imageUrl = await uploadFileToBackend(`site-images/${target}`, file);
        uploaded = true;
      } catch (error) {
        if (isMediaUploadDisabledError(error)) throw error;
        // Keep local editing functional when backend storage is unavailable.
      }

      setDb((current) => {
        if (target === "hero")
          return {
            ...current,
            websiteContent: { ...current.websiteContent, heroImage: imageUrl },
          };
        if (target === "logo")
          return {
            ...current,
            websiteContent: { ...current.websiteContent, logoImage: imageUrl },
          };
        if (target === "principal")
          return { ...current, media: { ...current.media, principalImage: imageUrl } };
        if (target === "page") {
          return {
            ...current,
            pages: {
              ...current.pages,
              [selectedPage]: { ...(current.pages[selectedPage] || {}), image: imageUrl },
            },
          };
        }
        if (target === "anthemVideoCover") {
          return {
            ...current,
            pages: {
              ...current.pages,
              [selectedPage]: {
                ...(current.pages[selectedPage] || {}),
                anthemVideoCoverImage: imageUrl,
              },
            },
          };
        }
        return { ...current, media: { ...current.media, campusImage: imageUrl } };
      });
      audit(`Image uploaded to ${target}`, "Website editor");
      setMessage(
        uploaded
          ? `Image optimized and uploaded: ${optimized.original} to ${optimized.optimized}`
          : `Image optimized for local storage: ${optimized.original} to ${optimized.optimized}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image upload failed.");
    }
  };

  const uploadBackgroundMedia = async (file?: File) => {
    if (!file) return;
    try {
      setMessage(
        file.type.startsWith("video/")
          ? `Uploading background video for ${displayPageName(selectedPage)}...`
          : `Optimizing background image for ${displayPageName(selectedPage)}...`,
      );
      const prepared = await prepareBackgroundMedia(file);
      setDb((current) => ({
        ...current,
        pages: {
          ...current.pages,
          [selectedPage]: {
            ...(current.pages[selectedPage] || {}),
            backgroundMediaUrl: prepared.url,
            backgroundMediaType: prepared.type,
            backgroundMediaOpacity: current.pages[selectedPage]?.backgroundMediaOpacity || 0.34,
          },
        },
      }));
      audit(`Page background ${prepared.type} uploaded: ${selectedPage}`, "Website editor");
      setMessage(
        `${prepared.message}. It now appears behind the ${displayPageName(selectedPage)} page hero.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Page background upload failed.");
    }
  };

  const clearBackgroundMedia = () => {
    setDb((current) => ({
      ...current,
      pages: {
        ...current.pages,
        [selectedPage]: {
          ...(current.pages[selectedPage] || {}),
          backgroundMediaUrl: "",
          backgroundMediaType: "",
          backgroundMediaOpacity: 0.34,
        },
      },
    }));
    audit(`Page background media removed: ${selectedPage}`, "Website editor");
    setMessage(`${displayPageName(selectedPage)} background media removed.`);
  };

  const toggleNav = (id: string) => {
    setDb((current) => ({
      ...current,
      navigation: current.navigation.map((item) =>
        item.id === id ? { ...item, visible: !(item.visible ?? true) } : item,
      ),
    }));
  };

  const renameNav = (id: string, label: string) => {
    setDb((current) => ({
      ...current,
      navigation: current.navigation.map((item) => (item.id === id ? { ...item, label } : item)),
    }));
  };

  const moveNav = (id: string, direction: -1 | 1) => {
    setDb((current) => {
      const itemToMove = current.navigation.find((n) => n.id === id);
      if (!itemToMove) return current;

      const siblings = current.navigation
        .filter((n) => n.parentId === itemToMove.parentId)
        .sort((a, b) => a.order - b.order);

      const index = siblings.findIndex((item) => item.id === id);
      const swap = index + direction;
      if (index < 0 || swap < 0 || swap >= siblings.length) return current;

      const a = siblings[index];
      const b = siblings[swap];

      return {
        ...current,
        navigation: current.navigation.map((item) => {
          if (item.id === a.id) return { ...item, order: b.order };
          if (item.id === b.id) return { ...item, order: a.order };
          return item;
        }),
      };
    });
  };

  const removeDuplicatePortalButtons = () => {
    setDb((current) => ({
      ...current,
      navigation: current.navigation.map((item) =>
        item.id === "student-portal" ? { ...item, visible: false } : item,
      ),
      websiteContent: {
        ...current.websiteContent,
        headerSignInLabel: "Portal Login",
        headerApplyLabel: "Admissions",
      },
    }));
    audit("Duplicate portal menu item hidden", "Website editor");
    setMessage(
      "Duplicate portal menu item removed. One Portal Login button remains in the header.",
    );
  };

  const addGalleryPlaceholder = () => {
    setDb((current) => ({
      ...current,
      gallery: [
        {
          id: makeId("GALLERY"),
          label: "New Gallery Album",
          image:
            current.media.campusImage || current.websiteContent.heroImage || "/loyola-crest.jpg",
          images: [
            current.media.campusImage || current.websiteContent.heroImage || "/loyola-crest.jpg",
          ],
          description: "Album description",
          link: "",
          visible: true,
        },
        ...current.gallery,
      ],
    }));
    setMessage("New gallery album created.");
  };

  const addPage = (parentId?: string) => {
      const name = window.prompt(
        parentId
          ? "Enter subpage name (e.g. 'Primary Section'):"
          : "Enter new page name (e.g. 'School Facilities'):",
      );
    if (!name) return;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const baseId = parentId ? `${parentId}/${slug}` : slug;
    if (!slug || !baseId) {
      alert("Invalid or duplicate page name.");
      return;
    }

    let createdId = "";
    setDb((current) => {
      const usedIds = new Set([
        ...Object.keys(current.pages),
        ...current.navigation.map((item) => item.id),
      ]);
      let id = baseId;
      let index = 2;
      while (usedIds.has(id)) {
        id = `${baseId}-${index}`;
        index += 1;
      }
      createdId = id;
      const order = parentId
        ? Math.max(
            0,
            ...current.navigation.filter((n) => n.parentId === parentId).map((n) => n.order),
          ) + 1
        : Math.max(0, ...current.navigation.map((n) => n.order)) + 1;

      return {
        ...current,
        pages: {
          ...current.pages,
          [id]: {
            title: name,
            body: "New page content goes here.",
            kicker: parentId ? current.pages[parentId]?.title : name,
          },
        },
        navigation: [...current.navigation, { id, label: name, order, visible: true, parentId }],
      };
    });
    if (createdId) setSelectedPage(createdId);
    setMessage(`${parentId ? "Subpage" : "Page"} '${name}' created.`);
    audit(`Created ${parentId ? "subpage" : "page"} ${createdId || baseId}`, "Website editor");
  };

  const deletePage = (id: string) => {
    if (id === "home") {
      alert("Home page cannot be deleted.");
      return;
    }
    if (
      confirm(
        `Are you sure you want to delete '${db.pages[id]?.title || id}' and any subpages under it? This cannot be undone.`,
      )
    ) {
      const selectedDeleted = pageTreeIds(db.navigation, id).has(selectedPage);
      setDb((current) => {
        const idsToDelete = pageTreeIds(current.navigation, id);
        const newPages = { ...current.pages };
        idsToDelete.forEach((pageId) => {
          delete newPages[pageId];
        });
        return {
          ...current,
          pages: newPages,
          navigation: current.navigation.filter((n) => !idsToDelete.has(n.id)),
        };
      });
      if (selectedDeleted) setSelectedPage("home");
      setMessage(`Page deleted.`);
      audit(`Deleted page ${id}`, "Website editor");
    }
  };

  const editPageName = (id: string) => {
    const currentName = db.navigation.find((n) => n.id === id)?.label || db.pages[id]?.title || id;
    const newName = window.prompt("Enter new page name:", currentName);
    if (!newName || newName === currentName) return;

    setDb((current) => ({
      ...current,
      pages: {
        ...current.pages,
        [id]: { ...(current.pages[id] || {}), title: newName },
      },
      navigation: current.navigation.map((n) => (n.id === id ? { ...n, label: newName } : n)),
    }));
    setMessage(`Page renamed to '${newName}'.`);
  };

  const openVisualBuilder = () => {
    const savedPage = db.pages[selectedPage];
    const captured =
      selectedPage === "home" ? null : capturePreviewContent(previewFrameRef.current);

    const isOldHomeStarter =
      selectedPage === "home" &&
      savedPage?.visualHtml &&
      !savedPage.visualHtml.includes("home-academics-section");

    const htmlToLoad = isOldHomeStarter
      ? homeVisualStarter()
      : (captured?.html || savedPage?.visualHtml || visualStarterForPage(db, selectedPage));

    setVisualEditorInitial({
      html: htmlToLoad,
      css: savedPage?.visualCss || "",
      canvasCss: selectedPage === "home" ? "" : captured?.css || "",
    });
    setVisualEditorOpen(true);
    setMessage(`Visual Builder opened for '${savedPage?.title || selectedPage}'.`);
  };

  const showSyncResult = (
    successText: string,
    result: Awaited<ReturnType<typeof saveDbNow>>,
    mode: "save" | "publish",
  ) => {
    if (result.remote) {
      setMessageTone("info");
      setMessage(
        `${successText} to cloud${
          result.contentVersion ? ` as version ${result.contentVersion}` : ""
        }. Refresh other devices to see the same site.`,
      );
      return;
    }

    if (result.localOnly) {
      setMessageTone("info");
      setMessage("Draft saved locally. Submit for approval when the website changes are ready.");
      return;
    }

    setMessageTone("error");
    const detail = result.error ? `: ${result.error}` : ".";
    setMessage(
      mode === "publish"
        ? `Server publish failed${detail} Local draft was kept on this device; the public website was not updated.`
        : `Cloud save failed${detail} Local draft was kept on this device.`,
    );
  };

  const save = async () => {
    setSavingState("saving");
    audit(`Saved ${selectedPage} / ${selectedSection}`, "Website editor");
    const result = await saveDbNow();
    showSyncResult("Draft saved", result, "save");
    setSavingState("idle");
  };

  const publish = async () => {
    if (needsApproval) {
      setSavingState("submitting");
      audit(`Submitted website changes for approval: ${selectedPage}`, "Website editor");
      await saveDbNow();
      try {
        const request = await createPublishRequest(db);
        setMessageTone("info");
        setMessage(`Submitted for approval as request #${request.id}.`);
      } catch (caught) {
        setMessageTone("error");
        setMessage(
          `Approval submit failed: ${
            caught instanceof Error ? caught.message : "Request could not be created."
          }`,
        );
      }
      setSavingState("idle");
      return;
    }

    setSavingState("publishing");
    audit(`Published website changes for ${selectedPage}`, "Website editor");
    const result = await saveDbNow();
    showSyncResult("Website changes published", result, "publish");
    setSavingState("idle");
  };

  const saveVisualContent = async (html: string, css: string) => {
    const pageTitle = db.pages[selectedPage]?.title || selectedPage;
    setSavingState("saving");
    setMessageTone("info");
    setMessage("Saving visual content and uploaded media...");
    setDb((current) => ({
      ...current,
      pages: {
        ...current.pages,
        [selectedPage]: {
          ...(current.pages[selectedPage] || {}),
          visualHtml: html,
          visualCss: css,
        },
      },
    }));
    setVisualEditorOpen(false);
    setVisualEditorInitial(null);
    audit(`Visual builder saved ${selectedPage}`, "Website editor");

    const result = await saveDbNow();
    if (result.remote) {
      setMessageTone("info");
      setMessage(
        `Changes live on website for '${pageTitle}'${
          result.contentVersion ? ` as version ${result.contentVersion}` : ""
        }. Uploaded photos are saved with this page.`,
      );
    } else {
      showSyncResult(`Visual content saved for '${pageTitle}'`, result, "save");
    }
    setSavingState("idle");
  };

  const isLocalOnly = messageTone === "error" && message.includes("Local draft");

  return (
    <div className="space-y-5 animate-fade-in-up">
      {visualEditorOpen && visualEditorInitial && (
        <VisualEditor
          initialHtml={visualEditorInitial.html}
          initialCss={visualEditorInitial.css}
          canvasCss={visualEditorInitial.canvasCss}
          onSave={(html, css) => void saveVisualContent(html, css)}
          onClose={() => {
            setVisualEditorOpen(false);
            setVisualEditorInitial(null);
          }}
        />
      )}

      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_32px_-8px_rgba(10,22,40,0.15)]">
        {/* Gradient accent bar */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0a1628] via-[#b70f1b] to-[#d4a017]" />
        <div className="px-6 pt-5 pb-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-crimson">
                Loyola Digital Studio
              </p>
              <h2 className="mt-1 font-serif text-3xl font-bold text-navy">
                Professional Website Editor
              </h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Live preview, page content, menu control, theme and server publishing.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <StudioButton onClick={() => void save()} disabled={savingState !== "idle"}>
                <Save className="h-4 w-4" />
                {savingState === "saving" ? "Saving…" : "Save Draft"}
              </StudioButton>
              <StudioButton onClick={() => window.open("/", "_blank", "noopener,noreferrer")}>
                <Eye className="h-4 w-4" /> Preview
              </StudioButton>
              <StudioButton
                onClick={() => {
                  const pageMap: Record<string, string> = {
                    home: "src/App.tsx",
                    "about/college-administration":
                      "src/components/site/CollegeAdministrationPage.tsx",
                    "about/college-staff": "src/components/site/CollegeStaffPage.tsx",
                  };
                  const file = pageMap[selectedPage] || "src/App.tsx";
                  fetch(`/__-loyola-open-editor?file=${encodeURIComponent(file)}`).catch(() => {
                    window.alert("VS Code integration only works in local dev mode.");
                  });
                }}
              >
                <Code2 className="h-4 w-4" /> Open in VS Code
              </StudioButton>
              <StudioButton
                tone="gold"
                onClick={() => void publish()}
                disabled={savingState !== "idle"}
              >
                {savingState === "publishing" || savingState === "submitting" ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-navy/30 border-t-navy" />{" "}
                    {savingState === "submitting" ? "Submitting…" : "Publishing…"}
                  </>
                ) : (
                  <>
                    {needsApproval ? (
                      <>
                        <Send className="h-4 w-4" /> Submit for Approval
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Publish
                      </>
                    )}
                  </>
                )}
              </StudioButton>
            </div>
          </div>
        </div>

        {/* ── Status message bar ── */}
        <div
          className={`flex items-start gap-3 border-t px-6 py-3 text-sm font-medium transition-all duration-300 ${
            messageTone === "error" && !isLocalOnly
              ? "border-red-100 bg-red-50 text-red-800"
              : isLocalOnly
                ? "border-amber-100 bg-amber-50 text-amber-800"
                : "border-emerald-100 bg-emerald-50 text-emerald-800"
          }`}
        >
          <span className="mt-0.5 shrink-0 text-base">
            {messageTone === "error" && !isLocalOnly ? "⚠️" : isLocalOnly ? "💾" : "✅"}
          </span>
          <span className="leading-5">{message}</span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[268px_minmax(0,1fr)_352px]">
        <aside className="space-y-4">
          {/* Pages Panel */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_-4px_rgba(10,22,40,0.10)]">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
              <LayoutTemplate className="h-4 w-4 text-[#d4a017]" />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-navy">
                Pages
              </span>
            </div>
            <div className="p-3 space-y-1">
              {pageIds.map((id) => {
                const navItem = db.navigation.find((n) => n.id === id);
                const isSubpage = !!navItem?.parentId;
                const canDelete = id !== "home";
                const isActive = selectedPage === id;
                return (
                  <div key={id} className={`flex items-center gap-1 ${isSubpage ? "ml-3" : ""}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedPage(id)}
                      className={`group flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? "bg-gradient-to-r from-[#0a1628] to-[#1e3560] text-white shadow-[0_2px_12px_-2px_rgba(10,22,40,0.35)]"
                          : "text-slate-600 hover:bg-slate-50 hover:text-navy"
                      }`}
                    >
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#d4a017] shrink-0" />
                      )}
                      <span className="truncate">
                        {navItem?.label || db.pages[id]?.title || id.replace("-", " ")}
                      </span>
                    </button>
                    <div className="flex shrink-0">
                      <button
                        type="button"
                        onClick={() => editPageName(id)}
                        title="Rename"
                        className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deletePage(id)}
                          title="Delete"
                          className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {!isSubpage && (
                        <button
                          type="button"
                          onClick={() => addPage(id)}
                          title="Add subpage"
                          className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        >
                          <span className="text-sm font-black leading-none">+</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => addPage()}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-bold text-slate-400 transition-all duration-200 hover:border-[#d4a017] hover:bg-[#d4a017]/5 hover:text-navy"
              >
                + Add new page
              </button>
            </div>
          </div>

          {/* Sections Panel */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_-4px_rgba(10,22,40,0.10)]">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
              <Menu className="h-4 w-4 text-[#d4a017]" />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-navy">
                Sections
              </span>
            </div>
            <div className="p-3 space-y-1">
              {studioSections.map((section) => {
                const isActive = selectedSection === section;
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setSelectedSection(section)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? "bg-[#d4a017]/12 text-navy shadow-[0_0_0_1.5px_#d4a017] font-bold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-navy"
                    }`}
                  >
                    <span>{section}</span>
                    {isActive && (
                      <span className="h-2 w-2 rounded-full bg-[#d4a017] animate-pulse-badge" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="space-y-4">
          <PreviewWebsite
            db={db}
            selectedPage={selectedPage}
            selectedSection={selectedSection}
            frameRef={previewFrameRef}
          />
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_-4px_rgba(10,22,40,0.10)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Menu className="h-4 w-4 text-[#d4a017]" />
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-navy">
                  Header &amp; Navigation
                </h3>
              </div>
              <StudioButton tone="dark" onClick={removeDuplicatePortalButtons}>
                <RefreshCw className="h-3.5 w-3.5" /> Fix duplicates
              </StudioButton>
            </div>
            <div className="p-4 space-y-2">
              {visibleNav.map((item) => {
                const isSubpage = !!item.parentId;
                return (
                  <div
                    key={item.id}
                    className={`grid gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 md:grid-cols-[1fr_auto_auto_auto] md:items-center transition-all duration-200 hover:border-slate-200 hover:bg-white hover:shadow-sm ${isSubpage ? "ml-6" : ""}`}
                  >
                    <input
                      value={item.label}
                      onChange={(e) => renameNav(item.id, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none transition-colors focus:border-[#d4a017] focus:shadow-[0_0_0_3px_rgba(212,160,23,0.15)]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleNav(item.id)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all duration-200 ${
                        item.visible
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {item.visible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                      {item.visible ? "Visible" : "Hidden"}
                    </button>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveNav(item.id, -1)}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveNav(item.id, 1)}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      /{item.id === "home" ? "" : item.id}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <aside className="space-y-4">
          {/* Content Inspector */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_-4px_rgba(10,22,40,0.10)]">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
              <Sparkles className="h-4 w-4 text-[#d4a017]" />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-navy">
                Content Inspector
              </span>
            </div>
            <div className="p-4 space-y-4">
              {selectedPage === "home" ? (
                <>
                  <Field label="School name">
                    <input
                      value={db.websiteContent.schoolName}
                      onChange={(e) => updateContent({ schoolName: e.target.value })}
                      className="input-line"
                    />
                  </Field>
                  <Field label="Motto / tagline">
                    <input
                      value={db.websiteContent.tagline}
                      onChange={(e) => updateContent({ tagline: e.target.value })}
                      className="input-line"
                    />
                  </Field>
                  <Field label="Hero title">
                    <textarea
                      value={db.websiteContent.heroTitle}
                      onChange={(e) => updateContent({ heroTitle: e.target.value })}
                      rows={3}
                      className="input-line resize-none"
                    />
                  </Field>
                  <Field label="Hero text">
                    <textarea
                      value={db.websiteContent.heroText}
                      onChange={(e) => updateContent({ heroText: e.target.value })}
                      rows={4}
                      className="input-line resize-none"
                    />
                  </Field>
                </>
              ) : (
                <>
                  <PageBlockEditor pageId={selectedPage} />
                  {selectedPage === "about/college-anthem-hymn" && (
                    <div className="rounded-xl border border-[#d4a017]/30 bg-[#d4a017]/5 p-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-crimson">
                        Anthem media
                      </p>
                      <Field label="Media title">
                        <input
                          value={page.anthemVideoTitle || ""}
                          onChange={(e) => updatePage("anthemVideoTitle", e.target.value)}
                          placeholder="College Anthem &amp; Hymn"
                          className="input-line"
                        />
                      </Field>
                      <Field label="Video link">
                        <input
                          value={page.anthemVideoUrl || ""}
                          onChange={(e) => updatePage("anthemVideoUrl", e.target.value)}
                          placeholder="YouTube or MP4 URL"
                          className="input-line"
                        />
                      </Field>
                      <Field label="Cover photo link">
                        <input
                          value={page.anthemVideoCoverImage || ""}
                          onChange={(e) => updatePage("anthemVideoCoverImage", e.target.value)}
                          placeholder="Paste image URL"
                          className="input-line"
                        />
                      </Field>
                      {page.anthemVideoCoverImage && (
                        <img
                          src={page.anthemVideoCoverImage}
                          alt=""
                          className="mt-3 aspect-video w-full rounded-xl object-cover"
                        />
                      )}
                      <div className="mt-3 grid gap-2">
                        <StudioButton
                          tone="gold"
                          onClick={() => anthemVideoCoverInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4" /> Upload video cover
                        </StudioButton>
                        {page.anthemVideoCoverImage && (
                          <StudioButton onClick={() => updatePage("anthemVideoCoverImage", "")}>
                            <Trash2 className="h-4 w-4" /> Remove cover
                          </StudioButton>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={openVisualBuilder}
                className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4a017] to-[#f7d96b] px-4 py-4 text-sm font-black text-[#0a1628] shadow-[0_8px_28px_-8px_rgba(212,160,23,0.62)] transition-all duration-200 hover:shadow-[0_12px_34px_-8px_rgba(212,160,23,0.75)] hover:scale-[1.02] active:scale-[0.98]"
              >
                <Wand2 className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />{" "}
                Open Visual Builder
              </button>
            </div>
          </div>

          {/* Media Tools */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_-4px_rgba(10,22,40,0.10)]">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
              <ImageIcon className="h-4 w-4 text-[#d4a017]" />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-navy">
                Media Tools
              </span>
            </div>
            <div className="p-4 space-y-3">
              <MediaUploadStatus />
              {/* Hidden file inputs */}
              <input
                ref={heroInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => void uploadTo("hero", e.target.files?.[0])}
              />
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => void uploadTo("logo", e.target.files?.[0])}
              />
              <input
                ref={campusInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => void uploadTo("campus", e.target.files?.[0])}
              />
              <input
                ref={principalInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => void uploadTo("principal", e.target.files?.[0])}
              />
              <input
                ref={pageImageInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => void uploadTo("page", e.target.files?.[0])}
              />
              <input
                ref={anthemVideoCoverInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => void uploadTo("anthemVideoCover", e.target.files?.[0])}
              />
              <input
                ref={backgroundMediaInputRef}
                type="file"
                accept="image/jpeg,image/png,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                className="hidden"
                onChange={(e) => void uploadBackgroundMedia(e.target.files?.[0])}
              />
              <div className="grid gap-2">
                <StudioButton onClick={() => backgroundMediaInputRef.current?.click()} tone="gold">
                  <Upload className="h-4 w-4" /> Upload page background
                </StudioButton>
                {page.backgroundMediaUrl && (
                  <StudioButton onClick={clearBackgroundMedia}>
                    <Trash2 className="h-4 w-4" /> Remove background
                  </StudioButton>
                )}
                {selectedPage === "home" ? (
                  <StudioButton onClick={() => heroInputRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Upload hero image
                  </StudioButton>
                ) : (
                  <StudioButton onClick={() => pageImageInputRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Upload page image
                  </StudioButton>
                )}
                <StudioButton onClick={() => logoInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Upload logo
                </StudioButton>
                <StudioButton onClick={() => campusInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Upload campus image
                </StudioButton>
                <StudioButton onClick={() => principalInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Upload principal image
                </StudioButton>
                <Field
                  label="Page background opacity"
                  hint={`${Math.round((page.backgroundMediaOpacity || 0.34) * 100)}% — behind the hero gradient.`}
                >
                  <input
                    type="range"
                    min="0.08"
                    max="0.75"
                    step="0.01"
                    value={page.backgroundMediaOpacity || 0.34}
                    onChange={(e) => updatePage("backgroundMediaOpacity", Number(e.target.value))}
                    className="w-full accent-[#d4a017]"
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Design & Animation */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_-4px_rgba(10,22,40,0.10)]">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
              <Palette className="h-4 w-4 text-[#d4a017]" />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-navy">
                Design &amp; Animation
              </span>
            </div>
            <div className="p-4 space-y-4">
              <Field label="Primary color">
                <input
                  type="color"
                  value={db.websiteContent.primaryColor}
                  onChange={(e) => updateContent({ primaryColor: e.target.value })}
                  className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1 transition-all hover:border-[#d4a017]"
                />
              </Field>
              <Field label="Accent color">
                <input
                  type="color"
                  value={db.websiteContent.accentColor}
                  onChange={(e) => updateContent({ accentColor: e.target.value })}
                  className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1 transition-all hover:border-[#d4a017]"
                />
              </Field>
              <Field label="Custom CSS" hint="Advanced: add extra CSS overrides.">
                <textarea
                  value={db.websiteContent.customCss}
                  onChange={(e) => updateContent({ customCss: e.target.value })}
                  rows={4}
                  className="input-line resize-none font-mono text-xs"
                />
              </Field>
              <div className="grid gap-2 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 p-3 text-xs leading-5 text-slate-500">
                <div className="flex items-center gap-2 font-bold text-navy text-[11px] uppercase tracking-wider">
                  <Wand2 className="h-3.5 w-3.5 text-[#d4a017]" /> Animation system active
                </div>
                <p>
                  Fade-in, card lift, button glow, and smooth section transitions are enabled
                  globally.
                </p>
              </div>
              <div className="grid gap-2 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 p-3 text-xs leading-5 text-slate-500">
                <div className="flex items-center gap-2 font-bold text-navy text-[11px] uppercase tracking-wider">
                  <MonitorSmartphone className="h-3.5 w-3.5 text-[#d4a017]" /> Responsive layout
                </div>
                <p>Mobile menu, responsive grids, and flexible cards built into every page.</p>
              </div>
              <StudioButton tone="gold" onClick={addGalleryPlaceholder}>
                <ImageIcon className="h-4 w-4" /> Add gallery album
              </StudioButton>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
