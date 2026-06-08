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
  Plus,
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
  publishDbNow,
  saveDbNow,
  useAuth,
  type DB,
  type PageBlockType,
  type PageBlock,
} from "@/lib/store";
import { uploadFileToBackend } from "@/lib/backend-upload";
import { createPublishRequest } from "@/lib/publish-requests";
import {
  VISUAL_BUILDER_CANVAS_STATIC_CSS,
  normalizeVisualBuilderHtml,
} from "@/lib/sanitize-visual-content";
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
    const url = await uploadFileToBackend("site-images/backgrounds", file);
    return {
      url,
      type: "image",
      message: `Background image optimized and uploaded: ${optimized.original} to ${optimized.optimized}`,
    };
  }

  if (!VIDEO_TYPES.includes(file.type)) {
    throw new Error("Only JPG, PNG, MP4, MOV, and WebM files are allowed.");
  }

  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Video is too large. Maximum video upload is 500 MB.");
  }

  const url = await uploadFileToBackend("site-videos/backgrounds", file);
  return {
    url,
    type: "video",
    message: `Background video uploaded: ${formatBytes(file.size)}`,
  };
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

const LCEA_PAGE_ID = "academics/loyolian-cambridge-english-academy";
const FACILITIES_PAGE_ID = "the-college/facilities-services";
const LIVE_RENDERED_EDITOR_PAGE_IDS = new Set([
  "home",
  "about",
  "academics",
  "admissions",
  "events",
  "news",
  "notices",
  "sports-clubs",
  "gallery",
  "downloads",
  "student-portal",
  "contact",
  "calendar",
  LCEA_PAGE_ID,
  "academics/cambridge",
  FACILITIES_PAGE_ID,
  "facilities",
  "facilities-services",
  "about/college-administration",
  "college-administration",
  "about/college-staff",
  "college-staff",
  "about/college-anthem-hymn",
  "college-anthem-hymn",
  "gallery/photo-gallery",
  "photo-gallery",
  "gallery/video-gallery",
  "video-gallery",
  "about/college-history",
  "about/past-rectors-vice-rectors",
  "college-history",
  "pastrectors",
  "past-rectors",
  "rectors-message",
  "rector-s-message",
  "rector-message",
  "rector-massage",
]);

function isLiveRenderedEditorPage(pageId: string) {
  return LIVE_RENDERED_EDITOR_PAGE_IDS.has(pageId);
}

type LivePreviewSnapshot = {
  html: string;
  baseCss: string;
};

function visualCanvasCss(baseCss: string) {
  return [baseCss.trim(), VISUAL_BUILDER_CANVAS_STATIC_CSS.trim()].filter(Boolean).join("\n\n");
}

const lceaProgrammes = [
  {
    level: "Pre Starters (Nursery)",
    students: "40 students",
    age: "5 years",
    teachers: ["Niroshini Perera", "Sarala Subasingha"],
  },
  {
    level: "Pre Starters",
    students: "140 students",
    age: "5-8 years",
    teachers: [
      "Mrs. Hasara Fernando",
      "Rev. Sr. Princy Croos Pulle",
      "Miss. Maleesha Nethmini",
      "Miss. Chrishani Fernando",
      "Miss. Hashini Perera",
      "Miss. Amasha Perera",
    ],
  },
  {
    level: "Starters",
    students: "200 students",
    age: "7-10 years",
    teachers: [
      "Mrs. Jayani Jethma",
      "Rev. Sr. Malrani Fernando",
      "Miss. Amindi Silva",
      "Mrs. Priyanthi Fernando",
      "Miss. Dhananjani Perera",
      "Miss. Vihangi Fernando",
      "Miss. Nisali Christina",
      "Mrs. Christina Sebastian",
      "Miss. Tharushika Fernando",
      "Mrs. Ronisha Devedas",
    ],
  },
  {
    level: "Movers",
    students: "100 students",
    age: "9-11 years",
    teachers: [
      "Mrs. Geethanchali Devedas",
      "Miss. Anuththara Sewmini",
      "Mrs. Sumedhie Fernando",
      "Mrs. M. K. Roshina",
      "Mrs. Dharshani Suraweera",
    ],
  },
  {
    level: "Flyers",
    students: "60 students",
    age: "10-12 years",
    teachers: [
      "Mrs. Harshani Fernandopulle",
      "Mrs. Cynthiya Karunapala",
      "Mrs. Shanika Marasinghe",
      "Mrs. Nirosha Perera",
    ],
  },
  {
    level: "KET",
    students: "60 students",
    age: "Above 12 years",
    teachers: ["Mrs. Shiromi Jude", "Mr. Sumith Senadheera", "Mr. Bernil Anuranga"],
  },
  {
    level: "PET",
    students: "60 students",
    age: "Above 12 years",
    teachers: ["Mrs. Ranlie Fernando", "Mrs. Sandamali", "Mr. Rasika Perera"],
  },
  {
    level: "FCE",
    students: "10 students",
    age: "Above 12 years",
    teachers: ["Mr. Amantha Fernando"],
  },
];

const facilitiesTemplateItems = [
  {
    title: "Audio Visual Room",
    category: "Learning & Media",
    image: "https://www.loyolacollege.lk/frontend/assets/img/facilities/AUDIO-VISUAL-ROOM-300x250.jpg",
    body: "A presentation-ready learning space for conferences, seminars, screenings, and media-assisted teaching.",
  },
  {
    title: "SV Fonseka Hall",
    category: "Assembly & Events",
    image: "https://www.loyolacollege.lk/frontend/assets/img/facilities/SV-FONSEKA-300x250.jpg",
    body: "A central college hall for assemblies, formal gatherings, celebrations, and student programmes.",
  },
  {
    title: "Library",
    category: "Study & Reading",
    image: "https://www.loyolacollege.lk/frontend/assets/img/facilities/LIBRARY-300x250.jpg",
    body: "A quiet academic resource space that supports reading habits, research, reference work, and independent study.",
  },
  {
    title: "Smart Class Room",
    category: "Digital Learning",
    image: "https://www.loyolacollege.lk/frontend/assets/img/facilities/SMART-CLASS-ROOM-300x250.jpg",
    body: "A technology-enabled classroom that helps teachers deliver clear, visual, and interactive lessons.",
  },
  {
    title: "Canteen",
    category: "Student Services",
    image: "https://www.loyolacollege.lk/frontend/assets/img/facilities/CANTEEN-300x250.jpg",
    body: "A daily service space for refreshments, meals, and student needs during school hours.",
  },
  {
    title: "St. Ignatius Chapel",
    category: "Faith & Prayer",
    image: "https://www.loyolacollege.lk/frontend/assets/img/facilities/ST-IGNATIUS-CHAPEL-300x250.jpg",
    body: "A sacred chapel for prayer, reflection, worship, and the Catholic identity of Loyola College.",
  },
  {
    title: "Cadet Billet",
    category: "Discipline & Leadership",
    image: "https://www.loyolacollege.lk/frontend/assets/img/facilities/CADET-BILLET-300x250.jpg",
    body: "A dedicated space for cadet activities, training preparation, teamwork, and discipline.",
  },
  {
    title: "Scout Den",
    category: "Clubs & Leadership",
    image: "https://www.loyolacollege.lk/frontend/assets/img/facilities/SCOUT-DEN-300x250.jpg",
    body: "A home base for scouts to organize equipment, plan activities, and build practical leadership skills.",
  },
  {
    title: "Auditorium",
    category: "Performance & Meetings",
    image: "https://www.loyolacollege.lk/frontend/assets/img/facilities/auditorium-300x250.jpg",
    body: "A refined venue for meetings, conferences, performances, presentations, and large school gatherings.",
  },
];

const PAST_RECTORS_PAGE_IDS = new Set([
  "about/college-history",
  "about/past-rectors-vice-rectors",
  "college-history",
  "pastrectors",
  "past-rectors",
]);

const pastRectorProfiles = [
  {
    name: "S. V. Goonesekera Mahatha",
    years: "1949 - 1987",
    image: "/assets/past-rectors/sv-sir.jpeg",
  },
  {
    name: "J. E. Noyel Dabare Mahatha",
    years: "1987 - 1994",
    image: "/assets/past-rectors/noyel-sir.jpeg",
  },
  {
    name: "Rev. Fr. Leo Perera",
    years: "1994 - 1999",
    image: "/assets/past-rectors/fr-leo.jpeg",
  },
  {
    name: "Rev. Fr. Thilakasiri Fernando",
    years: "1995 - 1999",
    image: "/assets/past-rectors/fr-thilakasiri.jpeg",
  },
  {
    name: "Rev. Fr. Trevor G. Martin",
    years: "2000 - 2014",
    image: "/assets/past-rectors/fr-trevor.jpeg",
  },
  {
    name: "Rev. Fr. Ranjith Andradi",
    years: "2014 - 2015",
    image: "/assets/past-rectors/fr-ranjith.jpeg",
  },
  {
    name: "Rev. Fr. Sudath Gunetilleke",
    years: "2015 - 2021",
    image: "/assets/past-rectors/fr-sudath.jpeg",
  },
];

function isPastRectorsPage(pageId: string) {
  return PAST_RECTORS_PAGE_IDS.has(pageId);
}

function shouldUsePastRectorsTemplate(pageId: string, savedVisualHtml?: string) {
  if (!isPastRectorsPage(pageId) || !savedVisualHtml) return false;
  if (savedVisualHtml.includes("past-rectors-collage.jpeg")) return false;
  return (
    savedVisualHtml.includes("Past Rectors & Vice Rectors overview") &&
    savedVisualHtml.includes("Key information") &&
    savedVisualHtml.includes("Next steps")
  );
}

function cleanBody(value: string | undefined, fallback = "") {
  const text = (value || "").trim();
  if (!text || text === "New page content goes here.") return fallback;
  return text;
}

function paragraphsHtml(value: string) {
  return value
    .split(/\n{2,}|\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin-top:14px;">${escapeHtml(line)}</p>`)
    .join("");
}

function pageHeroHtml({
  kicker,
  title,
  body,
  image,
}: {
  kicker: string;
  title: string;
  body: string;
  image: string;
}) {
  const heroImage = escapeHtml(image || "/loyola-crest.jpg");
  return `<section class="hero" style="position:relative;display:flex;min-height:420px;align-items:center;overflow:hidden;background:#0a1628;">
  <img src="${heroImage}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.3;" />
  <div style="position:absolute;inset:0;background:linear-gradient(105deg, rgba(10,22,40,.98), rgba(10,22,40,.84), rgba(183,15,27,.42));"></div>
  <div class="container" style="position:relative;z-index:1;">
    <p class="eyebrow">${escapeHtml(kicker)}</p>
    <h1 style="max-width:860px;margin-top:18px;color:#fff;">${escapeHtml(title)}</h1>
    <p style="max-width:720px;margin-top:20px;color:rgba(255,255,255,.82);font-size:1.12rem;">${escapeHtml(body)}</p>
  </div>
</section>`;
}

function featureCardsHtml(
  cards: Array<{ title: string; body: string; kicker?: string; image?: string }>,
  className = "grid-3",
) {
  return `<div class="${className}" style="margin-top:30px;">
    ${cards
      .map(
        (card) => `<article class="feature-card">
      ${card.image ? `<img src="${escapeHtml(card.image)}" alt="" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:8px;margin-bottom:18px;" />` : ""}
      ${card.kicker ? `<p class="eyebrow">${escapeHtml(card.kicker)}</p>` : ""}
      <h3 style="margin-top:${card.kicker ? "12px" : "0"};">${escapeHtml(card.title)}</h3>
      <p style="margin-top:10px;">${escapeHtml(card.body)}</p>
    </article>`,
      )
      .join("")}
  </div>`;
}

function blockSectionsHtml(blocks: PageBlock[] | undefined) {
  if (!blocks?.length) return "";

  return blocks
    .map((block) => {
      const title = block.content.title || "";
      const body = block.content.body || block.content.quote || "";
      if (block.type === "quote") {
        return `<section><div class="container"><blockquote class="quote">${escapeHtml(body)}</blockquote>${block.content.author ? `<p class="eyebrow" style="margin-top:18px;">${escapeHtml(block.content.author)}</p>` : ""}</div></section>`;
      }
      if (block.type === "image-text") {
        return `<section class="band"><div class="container grid-2" style="align-items:center;">
  <img src="${escapeHtml(block.content.image || "/loyola-crest.jpg")}" alt="" style="width:100%;border-radius:8px;background:#fff;padding:24px;box-shadow:0 16px 38px -28px rgba(8,40,111,.45);" />
  <div><p class="eyebrow">Page block</p><h2 style="margin-top:12px;">${escapeHtml(title || "Content section")}</h2>${paragraphsHtml(body)}</div>
</div></section>`;
      }
      return `<section><div class="container"><p class="eyebrow">Page block</p><h2 style="margin-top:12px;">${escapeHtml(title || "Content section")}</h2>${paragraphsHtml(body || "Edit this content.")}</div></section>`;
    })
    .join("\n\n");
}

function homeVisualStarter(db: DB) {
  const content = db.websiteContent;
  const page = db.pages.home || {};
  const home = db.homeSections;
  const heroImage =
    page.backgroundMediaUrl ||
    page.image ||
    content.heroImage ||
    db.media.campusImage ||
    "/flag1.png";
  const heroTitle =
    content.heroTitle?.trim() || page.title || "A Tradition of Excellence. A Future of Innovation.";
  const heroText = content.heroText?.trim() || "Veritate ad Lumen et Vitam";
  const stats = home.stats.length ? home.stats : [];
  const leadershipCards =
    home.leadershipCards.filter((card) => card.visible !== false).length > 0
      ? home.leadershipCards.filter((card) => card.visible !== false)
      : [
          {
            id: "lead-1",
            name: "His Eminence Malcolm Cardinal Ranjith",
            title: "The Archbishop of Colombo",
            description: "",
            image: "/loyola-crest.jpg",
            order: 1,
            visible: true,
          },
          {
            id: "lead-2",
            name: "Very Rev. Fr. Gemunu Dias",
            title: "General Manager of Catholic Private Schools",
            description: "",
            image: "/loyola-crest.jpg",
            order: 2,
            visible: true,
          },
          {
            id: "lead-3",
            name: "Rev. Fr. D.M.J. Kennedy Perera",
            title: "Rector / Principal",
            description: "",
            image: db.media.principalImage || "/loyola-crest.jpg",
            order: 3,
            visible: true,
          },
        ];

  const newsCards = (db.news.length ? db.news : [{ title: "News & Notices", body: "Important updates and school notices will appear here.", date: "" }])
    .slice(0, 3)
    .map((item) => ({ title: item.title, body: item.body || item.date || "School update." }));
  const eventCards = (db.events.length ? db.events : [{ title: "Upcoming Events", location: "Campus", date: "School calendar", type: "Event" }])
    .slice(0, 3)
    .map((item) => ({
      title: item.title,
      body: `${item.date || "Date"} | ${item.location || "Campus"} | ${item.type || "Event"}`,
    }));

  return `${pageHeroHtml({
    kicker: content.schoolName || "Loyola College Negombo",
    title: heroTitle,
    body: heroText,
    image: heroImage,
  })}

<section class="home-about-section">
  <div class="container home-about-grid">
    <div>
      <p class="eyebrow">${escapeHtml(home.aboutHeading || "About Our College")}</p>
      <h2 style="margin-top:12px;">Loyola College at a glance.</h2>
      ${paragraphsHtml(home.aboutBody || "Add the main college introduction here.")}
      <a class="btn" href="${escapeHtml(home.aboutButtonHref || "/about")}" style="margin-top:24px;">${escapeHtml(home.aboutButtonLabel || "More Details")}</a>
    </div>
    <div class="home-stat-grid">
      ${stats
        .map(
          (stat) =>
            `<article class="stat-tile"><strong>${escapeHtml(stat.value)}</strong><span>${escapeHtml(stat.label)}</span></article>`,
        )
        .join("")}
    </div>
  </div>
</section>

<section class="home-rector-section">
  <div class="container home-rector-grid">
    <figure class="home-rector-photo">
      <img src="${escapeHtml(home.rectorImage || db.media.principalImage || "/loyola-crest.jpg")}" alt="" />
    </figure>
    <article class="home-rector-message">
      <p class="eyebrow">${escapeHtml(home.rectorHeading || "Rector's Message")}</p>
      <h2 style="margin-top:12px;">${escapeHtml(home.rectorTitle || "Dear Students, Parents, and Alumni of Loyola College,")}</h2>
      ${paragraphsHtml(home.rectorBody || "Add the rector message here.")}
      <p class="home-signature">${escapeHtml(home.rectorName || "Rev. Fr. D.M.J. Kennedy Perera")}<br /><span>${escapeHtml(home.rectorDesignation || "Rector / Principal")}</span></p>
    </article>
  </div>
</section>

<section class="home-leadership-section">
  <div class="container">
    <div class="home-section-heading">
      <p class="eyebrow">${escapeHtml(home.leadershipKicker || "Administration Board")}</p>
      <h2 style="margin-top:12px;">${escapeHtml(home.leadershipTitle || "Leadership guiding Loyola College.")}</h2>
      <p style="margin-top:16px;">${escapeHtml(home.leadershipBody || "Meet the leadership team serving the Loyola College community.")}</p>
    </div>
    <div class="leadership-grid" style="margin-top:32px;">
      ${leadershipCards
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .slice(0, 4)
        .map(
          (card) => `<article class="leadership-card">
        <img src="${escapeHtml(card.image || "/loyola-crest.jpg")}" alt="" />
        <div><h3>${escapeHtml(card.name)}</h3><span></span><p>${escapeHtml(card.title)}</p></div>
      </article>`,
        )
        .join("")}
    </div>
  </div>
</section>

<section class="band">
  <div class="container">
    <p class="eyebrow">Academics</p>
    <h2 style="margin-top:12px;">Academic pathways for every stage.</h2>
    ${featureCardsHtml([
      { title: "Primary Section", body: "Foundational learning, values, and classroom confidence." },
      { title: "Middle School", body: "Structured study habits and co-curricular discovery." },
      { title: "Advanced Level", body: "Technology, Science, Commerce, and Arts pathways." },
    ])}
  </div>
</section>

<section>
  <div class="container">
    <p class="eyebrow">News and Events</p>
    <h2 style="margin-top:12px;">Latest school updates.</h2>
    ${featureCardsHtml([...newsCards, ...eventCards].slice(0, 6))}
  </div>
</section>`;
}

function lceaVisualStarter(db: DB) {
  const page = db.pages[LCEA_PAGE_ID] || {};
  const image = page.image || db.media.campusImage || db.websiteContent.heroImage || "/loyola-crest.jpg";
  const body = cleanBody(
    page.body,
    "Cambridge-standard English learning for Loyolian students and learners from other schools.",
  );

  return `${pageHeroHtml({
    kicker: page.kicker || "Academics",
    title: page.title || "Loyolian Cambridge English Academy",
    body,
    image,
  })}

<section class="band">
  <div class="container grid-2" style="align-items:start;">
    <article class="feature-card">
      <p class="eyebrow">English Academy</p>
      <h2 style="margin-top:12px;">English learning with Cambridge international standards.</h2>
      ${paragraphsHtml(
        "Loyola College launched Loyolian Cambridge English Academy on May 1, 2024. The academy is a brain-child of Rev. Fr. Kennedy Perera, the present Rector of Loyola College Negombo, who has held the vision of enhancing the English linguistic capacity of Loyolian students from the day of his installation.\n\nLCEA has opened its doors to students from other schools as well, giving them the opportunity to learn English according to Cambridge international standards.\n\nMore than 700 students are being equipped with standard English at LCEA by a well-qualified staff of 36 teachers.",
      )}
    </article>
    <article class="feature-card" style="background:#0a1628;color:#fff;">
      <p class="eyebrow" style="color:#f7d96b;">Academy Vision</p>
      <h2 style="margin-top:12px;color:#fff;">A stronger English foundation for young learners.</h2>
      <p style="margin-top:18px;color:rgba(255,255,255,.72);">LCEA offers an upgraded English academy experience in the Negombo region, with regular monthly learning time and guided support for each Cambridge level.</p>
    </article>
  </div>
</section>

<section>
  <div class="container">
    <p class="eyebrow">Academy Team</p>
    <h2 style="margin-top:12px;">Leadership and administration</h2>
    ${featureCardsHtml([
      { kicker: "Rector", title: "Rev. Fr. Kennedy Perera", body: "Rector of Loyola College Negombo" },
      { kicker: "Priest in charge", title: "Fr. Mahima Gunawardena", body: "Loyolian Cambridge English Academy" },
      { kicker: "Manager", title: "Mr. Deepal Fonseka", body: "Academy management" },
      { kicker: "Accountant", title: "Mrs. Reshika Crishelni", body: "Accounts and administration" },
      { kicker: "Vice Principal", title: "Mrs. Priyanthi Fernando", body: "Academy support" },
      { kicker: "Vice Principal", title: "Mrs. Geethanchali Devedas", body: "Academy support" },
    ])}
  </div>
</section>

<section class="band">
  <div class="container">
    <p class="eyebrow">Weekly Classes</p>
    <h2 style="margin-top:12px;">Class schedule</h2>
    ${featureCardsHtml([
      { title: "Wednesday", body: "2.15 P.M. to 5.15 P.M. for Pre Starters, Starters, Movers" },
      { title: "Friday", body: "2.15 P.M. to 5.15 P.M. for Flyers, KET, PET, FCE" },
      { title: "Monthly English", body: "Students are guided with 12 hours of English every month." },
    ])}
  </div>
</section>

<section>
  <div class="container">
    <p class="eyebrow">Cambridge Levels</p>
    <h2 style="margin-top:12px;">Programme groups and teaching staff</h2>
    ${featureCardsHtml(
      lceaProgrammes.map((programme) => ({
        kicker: `${programme.students} | Age: ${programme.age}`,
        title: programme.level,
        body: programme.teachers.join(", "),
      })),
      "grid-2",
    )}
  </div>
</section>`;
}

function facilitiesVisualStarter(db: DB) {
  const page = db.pages[FACILITIES_PAGE_ID] || {};
  const image =
    page.image ||
    facilitiesTemplateItems[8]?.image ||
    db.media.campusImage ||
    db.websiteContent.heroImage ||
    "/loyola-crest.jpg";
  const body = cleanBody(
    page.body,
    "Campus spaces that support learning, worship, leadership, performance, wellbeing, and daily student life.",
  );

  return `${pageHeroHtml({
    kicker: page.kicker || "The College",
    title: page.title || "Facilities & Services",
    body,
    image,
  })}

<section class="band">
  <div class="container grid-2" style="align-items:start;">
    <article class="feature-card">
      <p class="eyebrow">Campus Facilities</p>
      <h2 style="margin-top:12px;">Purpose-built spaces for study, service, worship, and school life.</h2>
      <p style="margin-top:18px;">Loyola College Negombo provides facilities that support classroom learning, co-curricular formation, spiritual life, leadership development, student service, and major school gatherings.</p>
      <div class="stats-row" style="margin-top:28px;grid-template-columns:repeat(3,minmax(0,1fr));">
        <article class="stat-tile"><strong>9</strong><span>Featured facilities</span></article>
        <article class="stat-tile"><strong>3</strong><span>Learning zones</span></article>
        <article class="stat-tile"><strong>4</strong><span>Formation spaces</span></article>
      </div>
    </article>
    <article class="feature-card" style="background:#0a1628;color:#fff;">
      <div class="grid-2" style="gap:6px;">
        ${facilitiesTemplateItems
          .slice(0, 4)
          .map(
            (facility) =>
              `<img src="${escapeHtml(facility.image)}" alt="" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;" />`,
          )
          .join("")}
      </div>
      <p class="eyebrow" style="margin-top:24px;color:#f7d96b;">Facilities Network</p>
      <h2 style="margin-top:12px;color:#fff;">Every space has a clear role in student life.</h2>
      <p style="margin-top:14px;color:rgba(255,255,255,.72);">This page brings each facility into a clear, image-led presentation for parents, students, staff, and visitors.</p>
    </article>
  </div>
</section>

<section>
  <div class="container">
    <p class="eyebrow">Explore Facilities</p>
    <h2 style="margin-top:12px;">Campus facilities and student services</h2>
    ${featureCardsHtml(
      facilitiesTemplateItems.map((facility) => ({
        kicker: facility.category,
        title: facility.title,
        body: facility.body,
        image: facility.image,
      })),
      "grid-3",
    )}
  </div>
</section>

<section class="band">
  <div class="container">
    <p class="eyebrow">Service Areas</p>
    <h2 style="margin-top:12px;">Organized around how students use the campus.</h2>
    ${featureCardsHtml([
      {
        title: "Learning & Technology",
        body: "Audio Visual Room, Library, and Smart Class Room support digital teaching, reading, presentations, and focused academic work.",
      },
      {
        title: "Gathering & Performance",
        body: "SV Fonseka Hall and Auditorium support assemblies, stage work, ceremonies, conferences, and shared college occasions.",
      },
      {
        title: "Service, Faith & Leadership",
        body: "Canteen, St. Ignatius Chapel, Cadet Billet, and Scout Den support wellbeing, faith, discipline, and student leadership.",
      },
    ])}
  </div>
</section>`;
}

function pastRectorsVisualStarter(db: DB, pageId: string) {
  const page = db.pages[pageId] || db.pages["about/college-history"] || {};
  const body = cleanBody(
    page.body,
    "Remembering the leaders who shaped Loyola College Negombo.",
  );
  const image =
    page.image || db.media.campusImage || db.websiteContent.heroImage || "/loyola-crest.jpg";

  return `${pageHeroHtml({
    kicker: page.kicker || "Faith, learning, discipline, and service.",
    title: page.title || "Past Rectors & Vice Rectors",
    body,
    image,
  })}

<section class="band">
  <div class="container">
    <article class="feature-card">
      <p class="eyebrow">Legacy Wall</p>
      <h2 style="margin-top:12px;">Past Rectors & Vice Rectors</h2>
      <div style="margin-top:28px;overflow:hidden;border:1px solid #dde4ed;border-radius:8px;background:#fff;">
        <img src="/assets/past-rectors/past-rectors-collage.jpeg" alt="Past Rectors and Vice Rectors collage" style="width:100%;height:auto;object-fit:contain;" />
      </div>
    </article>
  </div>
</section>

<section>
  <div class="container">
    <p class="eyebrow">Profile Records</p>
    <h2 style="margin-top:12px;">Rector Profiles</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px;margin-top:32px;">
      ${pastRectorProfiles
        .map(
          (profile) => `<article class="feature-card" style="overflow:hidden;padding:0;">
        <div style="border-bottom:1px solid #dde4ed;padding:22px 24px;">
          <h3>${escapeHtml(profile.name)}</h3>
          <p class="eyebrow" style="margin-top:10px;">Service Period: ${escapeHtml(profile.years)}</p>
        </div>
        <img src="${escapeHtml(profile.image)}" alt="${escapeHtml(profile.name)} profile" loading="lazy" style="width:100%;max-height:720px;object-fit:contain;background:#fff;" />
      </article>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function supplementalVisualSections(db: DB, pageId: string) {
  if (pageId === "about") {
    return `<section class="band"><div class="container"><p class="eyebrow">About Loyola</p><h2 style="margin-top:12px;">College story and identity</h2>${paragraphsHtml(`${db.aboutSections.storyBodyOne || ""}\n${db.aboutSections.storyBodyTwo || ""}` || "Add the college story here.")}${featureCardsHtml(db.aboutSections.stats.map((stat) => ({ title: stat.value, body: stat.label })))}</div></section>`;
  }
  if (pageId === "academics") {
    const departments = db.academicsSections.departments.length
      ? db.academicsSections.departments
      : [
          { id: "primary", name: "Primary Section", body: "Foundational learning and values.", count: "" },
          { id: "middle", name: "Middle School", body: "Balanced academic growth.", count: "" },
          { id: "advanced", name: "Advanced Level", body: "Senior academic pathways.", count: "" },
        ];
    return `<section class="band"><div class="container"><p class="eyebrow">Academic Pathways</p><h2 style="margin-top:12px;">Departments and subjects</h2>${featureCardsHtml(departments.map((dept) => ({ title: dept.name, body: `${dept.body} ${dept.count || ""}`.trim() })))}</div></section>`;
  }
  if (pageId === "admissions") {
    return `<section class="band"><div class="container"><p class="eyebrow">Admissions</p><h2 style="margin-top:12px;">Application steps</h2>${featureCardsHtml(db.admissionsSteps.map((step) => ({ kicker: step.number, title: step.title, body: step.body })))}</div></section>`;
  }
  if (pageId === "news") {
    return `<section class="band"><div class="container"><p class="eyebrow">News & Notices</p><h2 style="margin-top:12px;">Latest updates</h2>${featureCardsHtml((db.news.length ? db.news : [{ title: "News item", body: "Add news from the portal.", date: "" }]).slice(0, 6).map((item) => ({ kicker: item.date, title: item.title, body: item.body })))}</div></section>`;
  }
  if (pageId === "events") {
    return `<section class="band"><div class="container"><p class="eyebrow">Events</p><h2 style="margin-top:12px;">Upcoming school dates</h2>${featureCardsHtml((db.events.length ? db.events : [{ title: "School event", date: "Date", location: "Campus", type: "Event" }]).slice(0, 6).map((item) => ({ kicker: item.type, title: item.title, body: `${item.date} | ${item.location}` })))}</div></section>`;
  }
  if (pageId === "gallery" || pageId === "gallery/photo-gallery") {
    return `<section class="band"><div class="container"><p class="eyebrow">Gallery</p><h2 style="margin-top:12px;">Photo albums</h2>${featureCardsHtml((db.gallery.length ? db.gallery : [{ label: "Gallery album", description: "Add photo albums from the portal.", image: "/loyola-crest.jpg" }]).slice(0, 6).map((item) => ({ title: item.label, body: item.description || "Album preview.", image: item.image })))}</div></section>`;
  }
  if (pageId === "gallery/video-gallery") {
    return `<section class="band"><div class="container"><p class="eyebrow">Video Gallery</p><h2 style="margin-top:12px;">School video coverage</h2>${featureCardsHtml((db.videoGallery.length ? db.videoGallery : [{ label: "Video album", description: "Add videos from the portal.", coverImage: "/loyola-crest.jpg", videos: [] }]).slice(0, 6).map((item) => ({ title: item.label, body: item.description || "Video album preview.", image: item.coverImage || "/loyola-crest.jpg" })))}</div></section>`;
  }
  if (pageId === "downloads") {
    return `<section class="band"><div class="container"><p class="eyebrow">Downloads</p><h2 style="margin-top:12px;">Forms, circulars, and files</h2>${featureCardsHtml((db.downloads.length ? db.downloads : [{ title: "Download item", description: "Add files from the portal.", category: "School file" }]).slice(0, 6).map((item) => ({ kicker: item.category, title: item.title, body: item.description })))}</div></section>`;
  }
  if (pageId === "contact") {
    return `<section class="band"><div class="container"><p class="eyebrow">Contact</p><h2 style="margin-top:12px;">Visit, write, or call us.</h2>${featureCardsHtml([
      { title: "Address", body: db.websiteContent.address },
      { title: "Phone", body: db.websiteContent.phone },
      { title: "Email", body: db.websiteContent.email },
    ])}</div></section>`;
  }
  if (pageId === "calendar") {
    return `<section class="band"><div class="container"><p class="eyebrow">Calendar</p><h2 style="margin-top:12px;">School events and important dates</h2><article class="feature-card" style="margin-top:28px;"><h3>Calendar area</h3><p style="margin-top:10px;">Use this visual section for calendar notes, event instructions, holidays, meetings, celebrations, and academic reminders.</p></article></div></section>`;
  }
  return "";
}

function visualStarterForPage(db: DB, pageId: string) {
  const page = db.pages[pageId] || db.pages.home || {};
  if (pageId === "home") return homeVisualStarter(db);
  if (pageId === LCEA_PAGE_ID) return lceaVisualStarter(db);
  if (pageId === FACILITIES_PAGE_ID) return facilitiesVisualStarter(db);
  if (isPastRectorsPage(pageId)) return pastRectorsVisualStarter(db, pageId);

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
      <h2 style="margin-top:12px;">Anthem and hymn media.</h2>
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
</section>
${blockSectionsHtml(page.blocks)}
${supplementalVisualSections(db, pageId)}`;
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
    { title: "Copyright", body: db.websiteContent.footerCopyrightLine },
    { title: "Developer credit", body: db.websiteContent.developerCredit },
    { title: "Legal line", body: db.websiteContent.footerLegalLine },
  ];
}

const SAFE_VISUAL_SECTION_SELECTOR = "[data-website-section]";

type SafeVisualEditorDocument = Document & {
  __loyolaSafeVisualClickHandler?: EventListener;
};

function PreviewWebsite({
  db,
  selectedPage,
  selectedSection,
  frameRef,
  visualEditing,
  onSelectSection,
  onCloseVisualEditing,
}: {
  db: DB;
  selectedPage: string;
  selectedSection: string;
  frameRef: React.RefObject<HTMLIFrameElement | null>;
  visualEditing: boolean;
  onSelectSection: (section: string) => void;
  onCloseVisualEditing: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const path = pagePath(selectedPage);
  const previewParams = new URLSearchParams({
    websiteEditorPreview: "1",
    refresh: String(refreshKey),
  });
  if (isLiveRenderedEditorPage(selectedPage)) previewParams.set("codedPreview", "1");
  const src = `${path}?${previewParams.toString()}`;

  const postDb = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: "loyola.website-preview.db", db },
      window.location.origin,
    );
  }, [db, frameRef]);

  const syncVisualEditingState = useCallback(() => {
    const doc = frameRef.current?.contentDocument as SafeVisualEditorDocument | undefined;
    if (!doc) return;

    if (doc.__loyolaSafeVisualClickHandler) {
      doc.removeEventListener("click", doc.__loyolaSafeVisualClickHandler, true);
      doc.__loyolaSafeVisualClickHandler = undefined;
    }

    let style = doc.getElementById("loyola-safe-visual-editor-style") as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement("style");
      style.id = "loyola-safe-visual-editor-style";
      doc.head.appendChild(style);
    }

    if (!visualEditing) {
      doc.body?.removeAttribute("data-loyola-safe-visual-editor");
      style.textContent = "";
      doc.querySelectorAll<HTMLElement>(SAFE_VISUAL_SECTION_SELECTOR).forEach((element) => {
        element.removeAttribute("data-website-section-active");
        element.removeAttribute("data-website-editor-enabled");
      });
      return;
    }

    const handlePreviewClick: EventListener = (event) => {
      const target = event.target as Element | null;
      const sectionElement =
        typeof target?.closest === "function"
          ? (target.closest(SAFE_VISUAL_SECTION_SELECTOR) as HTMLElement | null)
          : null;
      const section = sectionElement?.dataset.websiteSection;
      if (!section) return;

      event.preventDefault();
      event.stopPropagation();
      onSelectSection(section);
    };

    doc.__loyolaSafeVisualClickHandler = handlePreviewClick;
    doc.addEventListener("click", handlePreviewClick, true);
    doc.body?.setAttribute("data-loyola-safe-visual-editor", "true");
    style.textContent = `
      body[data-loyola-safe-visual-editor="true"] ${SAFE_VISUAL_SECTION_SELECTOR} {
        cursor: pointer !important;
      }
      body[data-loyola-safe-visual-editor="true"] ${SAFE_VISUAL_SECTION_SELECTOR}:hover {
        outline: 3px solid rgba(212, 160, 23, 0.72) !important;
        outline-offset: -3px !important;
        box-shadow: inset 0 0 0 9999px rgba(212, 160, 23, 0.035) !important;
      }
      body[data-loyola-safe-visual-editor="true"] ${SAFE_VISUAL_SECTION_SELECTOR}[data-website-section-active="true"] {
        outline: 3px solid #d4a017 !important;
        outline-offset: -3px !important;
        box-shadow: inset 0 0 0 9999px rgba(212, 160, 23, 0.055) !important;
      }
    `;
    doc.querySelectorAll<HTMLElement>(SAFE_VISUAL_SECTION_SELECTOR).forEach((element) => {
      element.setAttribute("data-website-editor-enabled", "true");
      if (element.dataset.websiteSection === selectedSection) {
        element.setAttribute("data-website-section-active", "true");
      } else {
        element.removeAttribute("data-website-section-active");
      }
    });
  }, [frameRef, onSelectSection, selectedSection, visualEditing]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      postDb();
      syncVisualEditingState();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [postDb, src, syncVisualEditingState]);

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
        {visualEditing && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d4a017]/35 bg-[#fff7d6] px-4 py-3 text-xs font-bold text-[#6d4b00]">
            <span>
              Safe Visual Editor is open. Click highlighted live sections, edit the Content
              Inspector, then Save Draft and Publish.
            </span>
            <button
              type="button"
              onClick={onCloseVisualEditing}
              className="rounded-lg border border-[#d4a017]/45 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-navy"
            >
              Close
            </button>
          </div>
        )}
      </div>
      <iframe
        key={src}
        ref={frameRef}
        src={src}
        title="Full website live preview"
        onLoad={() => {
          postDb();
          syncVisualEditingState();
        }}
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
  "About College",
  "Rector Message",
  "Leadership",
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
  const rectorInputRef = useRef<HTMLInputElement>(null);
  const leadershipImageInputRef = useRef<HTMLInputElement>(null);
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
  const [widePreview, setWidePreview] = useState(false);
  const [leadershipUploadTarget, setLeadershipUploadTarget] = useState<string | null>(null);
  const [safeVisualEditorOpen, setSafeVisualEditorOpen] = useState(false);
  const [visualEditorOpen, setVisualEditorOpen] = useState(false);
  const [visualEditorInitial, setVisualEditorInitial] = useState<{
    html: string;
    css: string;
    baseCss: string;
    canvasCss: string;
    templateHtml: string;
  } | null>(null);

  const page = db.pages[selectedPage] || db.pages.home;
  const needsApproval = auth.user?.role === "website_admin";
  const selectedPageUsesLiveRenderer = isLiveRenderedEditorPage(selectedPage);
  const selectedPageUsesVisualOverride =
    selectedPageUsesLiveRenderer &&
    page?.visualMode === "visual" &&
    Boolean(page?.visualHtml?.trim());
  const safeVisualEditorActive = selectedPageUsesLiveRenderer && safeVisualEditorOpen;

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

  useEffect(() => {
    setSafeVisualEditorOpen(false);
  }, [selectedPage]);

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

  const updateHomeSection = (patch: Partial<DB["homeSections"]>) => {
    setDb((current) => ({
      ...current,
      homeSections: { ...current.homeSections, ...patch },
    }));
  };

  const updateLeadershipCard = (
    id: string,
    patch: Partial<DB["homeSections"]["leadershipCards"][number]>,
  ) => {
    setDb((current) => ({
      ...current,
      homeSections: {
        ...current.homeSections,
        leadershipCards: current.homeSections.leadershipCards.map((card) =>
          card.id === id ? { ...card, ...patch } : card,
        ),
      },
    }));
  };

  const updateHomeStat = (id: string, patch: Partial<DB["homeSections"]["stats"][number]>) => {
    setDb((current) => ({
      ...current,
      homeSections: {
        ...current.homeSections,
        stats: current.homeSections.stats.map((stat) =>
          stat.id === id ? { ...stat, ...patch } : stat,
        ),
      },
    }));
  };

  const addHomeStat = () => {
    setDb((current) => ({
      ...current,
      homeSections: {
        ...current.homeSections,
        stats: [
          ...current.homeSections.stats,
          { id: makeId("HOME-STAT"), label: "New statistic", value: "0" },
        ],
      },
    }));
  };

  const removeHomeStat = (id: string) => {
    setDb((current) => ({
      ...current,
      homeSections: {
        ...current.homeSections,
        stats: current.homeSections.stats.filter((stat) => stat.id !== id),
      },
    }));
  };

  const addLeadershipCard = () => {
    setDb((current) => ({
      ...current,
      homeSections: {
        ...current.homeSections,
        leadershipCards: [
          ...current.homeSections.leadershipCards,
          {
            id: makeId("LEAD"),
            name: "New leader",
            title: "Leadership role",
            description: "",
            image: "",
            order: current.homeSections.leadershipCards.length + 1,
            visible: true,
          },
        ],
      },
    }));
  };

  const removeLeadershipCard = (id: string) => {
    setDb((current) => ({
      ...current,
      homeSections: {
        ...current.homeSections,
        leadershipCards: current.homeSections.leadershipCards.filter((card) => card.id !== id),
      },
    }));
  };

  const uploadTo = async (
    target: "hero" | "logo" | "campus" | "page" | "principal" | "rector" | "anthemVideoCover",
    file?: File,
  ) => {
    if (!file) return;
    try {
      setMessage("Optimizing image...");
      const optimized = await compressImage(file);
      setMessage("Uploading optimized image...");
      const imageUrl = await uploadFileToBackend(`site-images/${target}`, file);

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
        if (target === "rector")
          return {
            ...current,
            homeSections: { ...current.homeSections, rectorImage: imageUrl },
          };
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
        `Image optimized and uploaded: ${optimized.original} to ${optimized.optimized}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image upload failed.");
    }
  };

  const uploadLeadershipCardImage = async (cardId: string, file?: File) => {
    if (!file) return;
    try {
      setMessage("Optimizing leadership photo...");
      const optimized = await compressImage(file);
      setMessage("Uploading leadership photo...");
      const imageUrl = await uploadFileToBackend(`site-images/leadership/${cardId}`, file);

      updateLeadershipCard(cardId, { image: imageUrl });
      setMessage(
        `Leadership photo uploaded: ${optimized.original} to ${optimized.optimized}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Leadership photo upload failed.");
    } finally {
      setLeadershipUploadTarget(null);
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
        : "Enter new page name (e.g. 'Facilities'):",
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

  const selectPreviewSection = useCallback((section: string) => {
    setSelectedSection(section);
    setWidePreview(false);
    setSafeVisualEditorOpen(true);
    setMessageTone("info");
    setMessage(
      `Safe Visual Editor selected '${section}'. Edit the matching fields in Content Inspector, then Save Draft and Publish.`,
    );
  }, []);

  const closeSafeVisualEditor = useCallback(() => {
    setSafeVisualEditorOpen(false);
    setMessageTone("info");
    setMessage("Safe Visual Editor closed. Use the button again to visually select live sections.");
  }, []);

  const getLivePreviewSnapshot = useCallback((): LivePreviewSnapshot | null => {
    const doc = previewFrameRef.current?.contentDocument;
    const main = doc?.querySelector("main");
    if (!doc || !main) return null;

    const mainClone = main.cloneNode(true) as HTMLElement;
    mainClone
      .querySelectorAll<HTMLElement>("[data-website-editor-enabled], [data-website-section-active]")
      .forEach((element) => {
        element.removeAttribute("data-website-editor-enabled");
        element.removeAttribute("data-website-section-active");
      });
    mainClone.querySelectorAll("script").forEach((element) => element.remove());

    const html = mainClone.innerHTML.trim();
    if (!html) return null;

    const cssParts = new Set<string>();
    doc.querySelectorAll<HTMLStyleElement>("style").forEach((style) => {
      if (style.id === "loyola-safe-visual-editor-style") return;
      const css = style.textContent?.trim();
      if (css) cssParts.add(css);
    });

    Array.from(doc.styleSheets).forEach((styleSheet) => {
      const owner = (styleSheet as CSSStyleSheet & { ownerNode?: Node }).ownerNode;
      if (owner instanceof HTMLElement && owner.id === "loyola-safe-visual-editor-style") return;

      try {
        const rules = Array.from(styleSheet.cssRules || [])
          .map((rule) => rule.cssText)
          .join("\n");
        if (rules.trim()) cssParts.add(rules);
      } catch {
        // Cross-origin stylesheets such as Google Fonts cannot be inspected by the browser.
      }
    });

    const baseCss = Array.from(cssParts).join("\n\n");
    return { html, baseCss };
  }, []);

  const openSafeVisualEditor = () => {
    const savedPage = db.pages[selectedPage];
    if (!isLiveRenderedEditorPage(selectedPage)) {
      setMessageTone("info");
      setMessage(
        "Safe Visual Editor is only for live coded pages. Opening Full Visual Builder instead.",
      );
      openFullVisualBuilder();
      return;
    }

    setVisualEditorOpen(false);
    setVisualEditorInitial(null);
    setSafeVisualEditorOpen(true);
    setWidePreview(false);
    setMessageTone("info");
    setMessage(
      `Safe Visual Editor is active for '${savedPage?.title || selectedPage}'. Click highlighted live sections in the preview and edit the Content Inspector fields. The coded design stays protected.`,
    );
    window.setTimeout(() => {
      previewFrameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const openFullVisualBuilder = () => {
    const savedPage = db.pages[selectedPage];
    const savedVisualHtml = savedPage?.visualHtml?.trim();
    const isLivePage = isLiveRenderedEditorPage(selectedPage);
    const useSavedVisualHtml =
      Boolean(savedVisualHtml) && (!isLivePage || savedPage?.visualMode === "visual");
    const templateHtml = visualStarterForPage(db, selectedPage);
    const shouldLoadTemplate =
      useSavedVisualHtml && shouldUsePastRectorsTemplate(selectedPage, savedVisualHtml);
    const liveSnapshot = isLivePage ? getLivePreviewSnapshot() : null;
    const savedBaseCss = savedPage?.visualBaseCss?.trim() || "";
    const baseCss = useSavedVisualHtml
      ? savedBaseCss || liveSnapshot?.baseCss || ""
      : liveSnapshot?.baseCss || "";
    const initialHtml = shouldLoadTemplate
      ? templateHtml
      : useSavedVisualHtml
        ? savedVisualHtml || templateHtml
        : liveSnapshot?.html || templateHtml;

    setVisualEditorInitial({
      html: initialHtml,
      css: useSavedVisualHtml && !shouldLoadTemplate ? savedPage?.visualCss || "" : "",
      baseCss,
      canvasCss: visualCanvasCss(baseCss),
      templateHtml: liveSnapshot?.html || templateHtml,
    });
    setSafeVisualEditorOpen(false);
    setVisualEditorOpen(true);
    setMessageTone("info");
    setMessage(
      isLivePage
        ? `Full Visual Builder opened for '${savedPage?.title || selectedPage}'. Saving will make this page use a visual override; the coded design is kept and can be restored.`
        : `Visual Builder opened for '${savedPage?.title || selectedPage}'.`,
    );
  };

  const openVisualBuilder = () => {
    if (isLiveRenderedEditorPage(selectedPage)) {
      openSafeVisualEditor();
      return;
    }
    openFullVisualBuilder();
  };

  const useCodedDesign = () => {
    const pageTitle = db.pages[selectedPage]?.title || selectedPage;
    setDb((current) => ({
      ...current,
      pages: {
        ...current.pages,
        [selectedPage]: {
          ...(current.pages[selectedPage] || {}),
          visualMode: "coded",
        },
      },
    }));
    setMessageTone("info");
    setMessage(
      `'${pageTitle}' will use the coded live design again. The saved visual-builder content was kept and can be re-enabled later.`,
    );
    audit(`Restored coded design mode for ${selectedPage}`, "Website editor");
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
    const result = await publishDbNow();
    showSyncResult("Website changes published", result, "publish");
    setSavingState("idle");
  };

  const saveVisualContent = async (html: string, css: string) => {
    const pageTitle = db.pages[selectedPage]?.title || selectedPage;
    const stableHtml = normalizeVisualBuilderHtml(html);
    const stableBaseCss = visualEditorInitial?.baseCss?.trim() || "";
    setSavingState("saving");
    setMessageTone("info");
    setMessage("Saving visual content and uploaded media...");
    setDb((current) => ({
      ...current,
      pages: {
        ...current.pages,
        [selectedPage]: {
          ...(current.pages[selectedPage] || {}),
          ...(isLiveRenderedEditorPage(selectedPage) ? { visualMode: "visual" as const } : {}),
          visualHtml: stableHtml,
          visualCss: css,
          visualBaseCss: stableBaseCss,
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
        `Visual content saved as a cloud draft for '${pageTitle}'${
          result.contentVersion ? ` as version ${result.contentVersion}` : ""
        }. ${
          isLiveRenderedEditorPage(selectedPage)
            ? "This page now uses the visual override after publishing; coded design is still kept."
            : "Publish when this page is ready for the public website."
        }`,
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
          templateHtml={visualEditorInitial.templateHtml}
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
              <StudioButton onClick={() => setWidePreview((current) => !current)}>
                <MonitorSmartphone className="h-4 w-4" />
                {widePreview ? "Show Panels" : "Wide Editor"}
              </StudioButton>
              <StudioButton
                tone="dark"
                onClick={selectedPageUsesLiveRenderer ? openSafeVisualEditor : openFullVisualBuilder}
              >
                {selectedPageUsesLiveRenderer ? (
                  <>
                    <Wand2 className="h-4 w-4" />{" "}
                    {safeVisualEditorActive ? "Safe Editor Active" : "Open Safe Editor"}
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" /> Visual Builder
                  </>
                )}
              </StudioButton>
              {selectedPageUsesLiveRenderer && (
                <StudioButton onClick={openFullVisualBuilder}>
                  <LayoutTemplate className="h-4 w-4" /> Full Visual Builder
                </StudioButton>
              )}
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
        {selectedPageUsesLiveRenderer && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3 text-xs font-bold text-slate-600">
            <span>
              {selectedPageUsesVisualOverride
                ? `'${page.title || selectedPage}' is using Full Visual Builder mode.`
                : `'${page.title || selectedPage}' is using the coded live design.`}
            </span>
            {selectedPageUsesVisualOverride ? (
              <button
                type="button"
                onClick={useCodedDesign}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-navy transition hover:bg-slate-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Use coded design
              </button>
            ) : (
              <button
                type="button"
                onClick={openFullVisualBuilder}
                className="inline-flex items-center gap-2 rounded-lg border border-[#d4a017]/55 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-navy transition hover:bg-[#fff7d6]"
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                Edit everything
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className={
          widePreview ? "grid gap-5" : "grid gap-5 xl:grid-cols-[268px_minmax(0,1fr)_352px]"
        }
      >
        {!widePreview && (
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
        )}

        <main className="space-y-4">
          <PreviewWebsite
            db={db}
            selectedPage={selectedPage}
            selectedSection={selectedSection}
            frameRef={previewFrameRef}
            visualEditing={safeVisualEditorActive}
            onSelectSection={selectPreviewSection}
            onCloseVisualEditing={closeSafeVisualEditor}
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

        {!widePreview && (
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
                    {["Header", "Hero"].includes(selectedSection) && (
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
                    )}

                    {selectedSection === "About College" && (
                      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson">
                          Homepage about
                        </p>
                        <Field label="Heading">
                          <input
                            value={db.homeSections.aboutHeading}
                            onChange={(e) => updateHomeSection({ aboutHeading: e.target.value })}
                            className="input-line"
                          />
                        </Field>
                        <Field label="Body">
                          <textarea
                            value={db.homeSections.aboutBody}
                            onChange={(e) => updateHomeSection({ aboutBody: e.target.value })}
                            rows={5}
                            className="input-line resize-none"
                          />
                        </Field>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Button text">
                            <input
                              value={db.homeSections.aboutButtonLabel}
                              onChange={(e) =>
                                updateHomeSection({ aboutButtonLabel: e.target.value })
                              }
                              className="input-line"
                            />
                          </Field>
                          <Field label="Button link">
                            <input
                              value={db.homeSections.aboutButtonHref}
                              onChange={(e) =>
                                updateHomeSection({ aboutButtonHref: e.target.value })
                              }
                              className="input-line"
                            />
                          </Field>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                              Stats
                            </p>
                            <button
                              type="button"
                              onClick={addHomeStat}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-navy"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add
                            </button>
                          </div>
                          {db.homeSections.stats.map((stat) => (
                            <div
                              key={stat.id}
                              className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3"
                            >
                              <input
                                value={stat.value}
                                onChange={(e) => updateHomeStat(stat.id, { value: e.target.value })}
                                placeholder="Value"
                                className="input-line"
                              />
                              <input
                                value={stat.label}
                                onChange={(e) => updateHomeStat(stat.id, { label: e.target.value })}
                                placeholder="Label"
                                className="input-line"
                              />
                              <button
                                type="button"
                                onClick={() => removeHomeStat(stat.id)}
                                className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedSection === "Rector Message" && (
                      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson">
                          Rector message
                        </p>
                        <Field label="Label">
                          <input
                            value={db.homeSections.rectorHeading}
                            onChange={(e) => updateHomeSection({ rectorHeading: e.target.value })}
                            className="input-line"
                          />
                        </Field>
                        <Field label="Title">
                          <textarea
                            value={db.homeSections.rectorTitle}
                            onChange={(e) => updateHomeSection({ rectorTitle: e.target.value })}
                            rows={2}
                            className="input-line resize-none"
                          />
                        </Field>
                        <Field label="Message">
                          <textarea
                            value={db.homeSections.rectorBody}
                            onChange={(e) => updateHomeSection({ rectorBody: e.target.value })}
                            rows={6}
                            className="input-line resize-none"
                          />
                        </Field>
                        <Field label="Rector name">
                          <input
                            value={db.homeSections.rectorName}
                            onChange={(e) => updateHomeSection({ rectorName: e.target.value })}
                            className="input-line"
                          />
                        </Field>
                        <Field label="Designation">
                          <input
                            value={db.homeSections.rectorDesignation}
                            onChange={(e) =>
                              updateHomeSection({ rectorDesignation: e.target.value })
                            }
                            className="input-line"
                          />
                        </Field>
                        <Field label="Photo URL">
                          <input
                            value={db.homeSections.rectorImage}
                            onChange={(e) => updateHomeSection({ rectorImage: e.target.value })}
                            placeholder="Paste image URL or upload below"
                            className="input-line"
                          />
                        </Field>
                        {db.homeSections.rectorImage && (
                          <img
                            src={db.homeSections.rectorImage}
                            alt=""
                            className="aspect-[4/5] w-full rounded-xl object-cover"
                          />
                        )}
                        <div className="grid gap-2">
                          <StudioButton tone="gold" onClick={() => rectorInputRef.current?.click()}>
                            <Upload className="h-4 w-4" /> Upload rector photo
                          </StudioButton>
                          {db.homeSections.rectorImage && (
                            <StudioButton onClick={() => updateHomeSection({ rectorImage: "" })}>
                              <Trash2 className="h-4 w-4" /> Remove photo
                            </StudioButton>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedSection === "Leadership" && (
                      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson">
                            Leadership cards
                          </p>
                          <button
                            type="button"
                            onClick={addLeadershipCard}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-navy"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add
                          </button>
                        </div>
                        <Field label="Kicker">
                          <input
                            value={db.homeSections.leadershipKicker}
                            onChange={(e) =>
                              updateHomeSection({ leadershipKicker: e.target.value })
                            }
                            className="input-line"
                          />
                        </Field>
                        <Field label="Title">
                          <textarea
                            value={db.homeSections.leadershipTitle}
                            onChange={(e) => updateHomeSection({ leadershipTitle: e.target.value })}
                            rows={2}
                            className="input-line resize-none"
                          />
                        </Field>
                        <Field label="Body">
                          <textarea
                            value={db.homeSections.leadershipBody}
                            onChange={(e) => updateHomeSection({ leadershipBody: e.target.value })}
                            rows={4}
                            className="input-line resize-none"
                          />
                        </Field>
                        {db.homeSections.leadershipCards
                          .slice()
                          .sort((a, b) => (a.order || 0) - (b.order || 0))
                          .map((card) => (
                            <div
                              key={card.id}
                              className="space-y-3 rounded-xl border border-slate-200 bg-white p-3"
                            >
                              {card.image && (
                                <img
                                  src={card.image}
                                  alt=""
                                  className="aspect-[4/5] w-full rounded-lg object-cover"
                                />
                              )}
                              <Field label="Name">
                                <input
                                  value={card.name}
                                  onChange={(e) =>
                                    updateLeadershipCard(card.id, { name: e.target.value })
                                  }
                                  className="input-line"
                                />
                              </Field>
                              <Field label="Role">
                                <input
                                  value={card.title}
                                  onChange={(e) =>
                                    updateLeadershipCard(card.id, { title: e.target.value })
                                  }
                                  className="input-line"
                                />
                              </Field>
                              <Field label="Description">
                                <textarea
                                  value={card.description}
                                  onChange={(e) =>
                                    updateLeadershipCard(card.id, { description: e.target.value })
                                  }
                                  rows={3}
                                  className="input-line resize-none"
                                />
                              </Field>
                              <Field label="Image URL">
                                <input
                                  value={card.image}
                                  onChange={(e) =>
                                    updateLeadershipCard(card.id, { image: e.target.value })
                                  }
                                  className="input-line"
                                />
                              </Field>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <Field label="Order">
                                  <input
                                    type="number"
                                    value={card.order || 0}
                                    onChange={(e) =>
                                      updateLeadershipCard(card.id, {
                                        order: Number(e.target.value) || 0,
                                      })
                                    }
                                    className="input-line"
                                  />
                                </Field>
                                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-navy">
                                  <input
                                    type="checkbox"
                                    checked={card.visible !== false}
                                    onChange={(e) =>
                                      updateLeadershipCard(card.id, { visible: e.target.checked })
                                    }
                                    className="accent-[#d4a017]"
                                  />
                                  Show
                                </label>
                              </div>
                              <div className="grid gap-2">
                                <StudioButton
                                  tone="gold"
                                  onClick={() => {
                                    setLeadershipUploadTarget(card.id);
                                    leadershipImageInputRef.current?.click();
                                  }}
                                >
                                  <Upload className="h-4 w-4" /> Upload photo
                                </StudioButton>
                                <StudioButton onClick={() => removeLeadershipCard(card.id)}>
                                  <Trash2 className="h-4 w-4" /> Remove card
                                </StudioButton>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
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
                {selectedSection === "Footer" && (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson">
                      Footer details
                    </p>
                    <Field label="Footer description">
                      <textarea
                        value={db.websiteContent.footerText}
                        onChange={(e) => updateContent({ footerText: e.target.value })}
                        rows={4}
                        className="input-line resize-none"
                      />
                    </Field>
                    <Field label="Copyright line">
                      <input
                        value={db.websiteContent.footerCopyrightLine}
                        onChange={(e) => updateContent({ footerCopyrightLine: e.target.value })}
                        className="input-line"
                      />
                    </Field>
                    <Field label="Developer credit">
                      <input
                        value={db.websiteContent.developerCredit}
                        onChange={(e) => updateContent({ developerCredit: e.target.value })}
                        className="input-line"
                      />
                    </Field>
                    <Field label="Legal line">
                      <input
                        value={db.websiteContent.footerLegalLine}
                        onChange={(e) => updateContent({ footerLegalLine: e.target.value })}
                        className="input-line"
                      />
                    </Field>
                  </div>
                )}
                <button
                  type="button"
                  onClick={selectedPageUsesLiveRenderer ? openFullVisualBuilder : openVisualBuilder}
                  className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4a017] to-[#f7d96b] px-4 py-4 text-sm font-black text-[#0a1628] shadow-[0_8px_28px_-8px_rgba(212,160,23,0.62)] transition-all duration-200 hover:shadow-[0_12px_34px_-8px_rgba(212,160,23,0.75)] hover:scale-[1.02] active:scale-[0.98]"
                >
                  {selectedPageUsesLiveRenderer ? (
                    <>
                      <Wand2 className="h-4 w-4" />{" "}
                      {selectedPageUsesVisualOverride
                        ? "Edit Full Visual Page"
                        : "Open Full Visual Builder"}
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />{" "}
                      Open Visual Builder
                    </>
                  )}
                </button>
                {selectedPageUsesLiveRenderer && (
                  <button
                    type="button"
                    onClick={openSafeVisualEditor}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-navy transition hover:bg-slate-50"
                  >
                    <Wand2 className="h-4 w-4" />
                    {safeVisualEditorActive ? "Safe editor active" : "Open safe field editor"}
                  </button>
                )}
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
                  onChange={(e) => {
                    void uploadTo("principal", e.target.files?.[0]);
                    e.currentTarget.value = "";
                  }}
                />
                <input
                  ref={rectorInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    void uploadTo("rector", e.target.files?.[0]);
                    e.currentTarget.value = "";
                  }}
                />
                <input
                  ref={leadershipImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    if (leadershipUploadTarget) {
                      void uploadLeadershipCardImage(leadershipUploadTarget, e.target.files?.[0]);
                    }
                    e.currentTarget.value = "";
                  }}
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
                  <StudioButton
                    onClick={() => backgroundMediaInputRef.current?.click()}
                    tone="gold"
                  >
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
                  {selectedPage === "home" && (
                    <StudioButton onClick={() => rectorInputRef.current?.click()}>
                      <Upload className="h-4 w-4" /> Upload rector photo
                    </StudioButton>
                  )}
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
        )}
      </div>
    </div>
  );
}
