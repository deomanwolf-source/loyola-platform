import React, { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { BrandedLoader } from "@/components/BrandedLoader";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  Facebook,
  FileText,
  GalleryHorizontal,
  Globe,
  Image as ImageIcon,
  Instagram,
  LayoutDashboard,
  Linkedin,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  MonitorSmartphone,
  Newspaper,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  Users,
  Video,
  Youtube,
  Briefcase,
  GraduationCap,
  Phone,
  X,
} from "lucide-react";
import { WebsiteEditor } from "./WebsiteEditor";
import { PublishApprovalsPanel } from "./PublishApprovalsPanel";
import { MyPublishRequestsPanel } from "./MyPublishRequestsPanel";
import {
  audit,
  makeId,
  resetDb,
  publishDbNow,
  saveDbNow,
  setAuth,
  setDb,
  useAuth,
  useDb,
  type DB,
  type EventItem,
  type GalleryVideo,
  type Role,
  type Teacher,
} from "@/lib/store";
import {
  uploadDataUrlToBackend,
  uploadFileToBackend,
  uploadFileToBackendInfo,
} from "@/lib/backend-upload";
import { API_URL, authHeaders } from "@/lib/api";
import { createPublishRequest } from "@/lib/publish-requests";
import { MediaUploadStatus } from "./MediaUploadStatus";

const adminRoles: Role[] = ["website_admin", "superadmin", "masteradmin"];
const IMAGE_TYPES = ["image/jpeg", "image/png"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_SHORT_VIDEO_SECONDS = 120;

function rememberDeletedContentId(
  current: DB,
  key: "news" | "events",
  id: string,
): DB["deletedContentIds"] {
  const existing = current.deletedContentIds?.[key] || [];
  return {
    ...current.deletedContentIds,
    [key]: Array.from(new Set([...existing, id])),
  };
}

type PanelId =
  | "dashboard"
  | "studio"
  | "approvals"
  | "pages"
  | "content"
  | "media"
  | "storage"
  | "design"
  | "messages"
  | "users"
  | "security"
  | "activity"
  | "backup"
  | "settings";

const navGroups: {
  label: string;
  items: { id: PanelId; label: string; icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    label: "Website",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "studio", label: "Website Studio", icon: Globe },
      { id: "approvals", label: "Publish Approvals", icon: ClipboardList },
      { id: "pages", label: "Pages", icon: FileText },
      { id: "content", label: "News / Events", icon: Newspaper },
      { id: "media", label: "Media Library", icon: ImageIcon },
      { id: "storage", label: "Storage", icon: Database },
      { id: "design", label: "Design System", icon: Palette },
    ],
  },
  {
    label: "Management",
    items: [
      { id: "messages", label: "Messages", icon: MessageSquare },
      { id: "users", label: "Users & Roles", icon: Users },
      { id: "security", label: "Security", icon: ShieldCheck },
      { id: "activity", label: "Activity Logs", icon: ClipboardList },
      { id: "backup", label: "Backup", icon: Database },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

const fullAccessAdminRoles: Role[] = ["masteradmin"];
const ownerOnlyAdminPanels = new Set<PanelId>(["users", "activity", "settings"]);
const protectedAdminPanels = new Set<PanelId>(["users", "activity", "backup", "settings"]);

function canAccessAdminPanel(role: Role | undefined, panel: PanelId) {
  if (!role || !adminRoles.includes(role)) return false;
  if (fullAccessAdminRoles.includes(role)) return true;
  if (ownerOnlyAdminPanels.has(panel)) return false;
  if (role === "superadmin") return true;
  return !protectedAdminPanels.has(panel);
}

function navGroupsForRole(role?: Role) {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => canAccessAdminPanel(role, item.id))
        .map((item) =>
          role === "website_admin" && item.id === "approvals"
            ? { ...item, label: "Approval Status" }
            : item,
        ),
    }))
    .filter((group) => group.items.length > 0);
}

const allPanelIds = new Set<PanelId>(navGroups.flatMap((group) => group.items.map((item) => item.id)));

function getInitialAdminPanel(): PanelId {
  if (typeof window === "undefined") return "dashboard";
  const requestedPanel = new URLSearchParams(window.location.search).get("panel");
  if (requestedPanel === "staff") {
    window.location.href = "/staff";
    return "dashboard";
  }
  const panel = requestedPanel as PanelId | null;
  return panel && allPanelIds.has(panel) ? panel : "dashboard";
}

function replaceAdminPanelUrl(panel: PanelId) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.pathname = "/admin";
  url.searchParams.set("panel", panel);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes < 1024 * 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  return `${(bytes / 1024 / 1024 / 1024 / 1024).toFixed(2)} TB`;
}

type StorageCategory = "photos" | "videos" | "database" | "other";

type StorageStats = {
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  usagePercent: number;
  limitConfigured: boolean;
  totalCount: number;
  mediaBytes: number;
  mediaCount: number;
  categories: Record<StorageCategory, { bytes: number; count: number }>;
  recent: {
    pathname: string;
    url: string;
    size: number;
    uploadedAt: string;
    category: StorageCategory;
  }[];
};

async function compressImage(file: File, maxWidth = 1600, quality = 0.82) {
  if (!IMAGE_TYPES.includes(file.type))
    throw new Error("Only JPG and PNG image files are allowed.");
  if (file.size > MAX_IMAGE_BYTES)
    throw new Error("Image is too large. Maximum image upload is 5 MB.");
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = objectUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not read image."));
  });
  const scale = Math.min(1, maxWidth / image.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image optimizer is not available.");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(objectUrl);
  const dataUrl = canvas.toDataURL("image/png");
  return {
    dataUrl,
    original: formatBytes(file.size),
    optimized: formatBytes(Math.round((dataUrl.length * 3) / 4)),
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`hover-lift rounded-[1.4rem] border p-5 shadow-soft transition-smooth ${accent ? "stat-card-shimmer border-gold/40 bg-gold/10" : "border-border bg-white"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-muted-foreground">{label}</p>
          <p className="mt-2 font-serif text-3xl font-bold text-navy">{value}</p>
          {hint && <p className="mt-1 text-xs font-semibold text-muted-foreground">{hint}</p>}
        </div>
        <span
          className={`grid h-12 w-12 place-items-center rounded-2xl ${accent ? "bg-gold text-navy" : "bg-navy text-gold"}`}
        >
          <Icon className="h-6 w-6" />
        </span>
      </div>
    </div>
  );
}

function PanelShell({
  title,
  kicker,
  children,
  action,
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="animate-panel-entry rounded-[1.6rem] border border-border bg-white p-6 shadow-soft">
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          {kicker && (
            <p className="text-xs font-black uppercase tracking-[0.2em] text-crimson">{kicker}</p>
          )}
          <h2 className="mt-1 font-serif text-3xl font-bold text-navy">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input-line ${props.className || ""}`} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input-line resize-none ${props.className || ""}`} />;
}

const corePageIds = new Set([
  "home",
  "about",
  "academics",
  "admissions",
  "news",
  "events",
  "sports-clubs",
  "gallery",
  "downloads",
  "student-portal",
  "contact",
]);

function pageHref(id: string) {
  return id === "home" ? "/" : `/${id}`;
}

function pageLabel(id: string) {
  return id
    .split("/")
    .pop()!
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugifyPage(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function uniquePageId(baseId: string, pages: DB["pages"]) {
  let id = baseId;
  let index = 2;
  while (pages[id]) {
    id = `${baseId}-${index}`;
    index += 1;
  }
  return id;
}

function collectPageTreeIds(nav: DB["navigation"], id: string): Set<string> {
  const ids = new Set<string>([id]);
  const queue = [id];
  while (queue.length) {
    const next = queue.shift()!;
    nav
      .filter((item) => item.parentId === next)
      .forEach((item) => {
        if (ids.has(item.id)) return;
        ids.add(item.id);
        queue.push(item.id);
      });
  }
  return ids;
}

function DashboardPanel({
  db,
  setActive,
  availablePanels,
}: {
  db: DB;
  setActive: (id: PanelId) => void;
  availablePanels: PanelId[];
}) {
  const mediaCount =
    db.gallery.length +
    db.videoGallery.length +
    db.downloads.length +
    (db.websiteContent.logoImage ? 1 : 0) +
    (db.websiteContent.heroImage ? 1 : 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 stagger-children">
        <StatCard
          icon={FileText}
          label="Pages"
          value={Object.keys(db.pages).length}
          hint="Main website pages"
          accent
        />
        <StatCard
          icon={Bell}
          label="News & Notices"
          value={db.news.length}
          hint="Published records"
        />
        <StatCard
          icon={CalendarDays}
          label="Events"
          value={db.events.length}
          hint="Calendar items"
        />
        <StatCard icon={ImageIcon} label="Media" value={mediaCount} hint="Images / downloads" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <PanelShell title="Quick actions" kicker="User friendly">
          <div className="grid gap-3 md:grid-cols-3 stagger-children">
            {[
              ["Edit website", "studio", Globe],
              ["Add news", "content", Newspaper],
              ["Upload image", "media", Upload],
              ["Storage status", "storage", Database],
              ["Edit pages", "pages", FileText],
              ["Design system", "design", Palette],
              ["Create backup", "backup", Database],
            ]
              .filter(([, id]) => availablePanels.includes(id as PanelId))
              .map(([label, id, Icon]) => (
              <button
                key={String(label)}
                type="button"
                onClick={() => setActive(id as PanelId)}
                className="rounded-2xl border border-border bg-secondary/45 p-5 text-left transition-smooth hover:-translate-y-1 hover:border-gold hover:bg-white hover:shadow-soft"
              >
                <Icon className="h-7 w-7 text-gold" />
                <p className="mt-3 font-bold text-navy">{String(label)}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Open this working management panel.
                </p>
              </button>
            ))}
          </div>
        </PanelShell>

        <PanelShell title="System health" kicker="Clean build">
          <div className="space-y-4">
            {[
              ["Duplicate portal buttons", "Fixed"],
              ["Image upload limit", "5 MB"],
              ["Video upload limit", "500 MB"],
              ["Admin UI", "Simplified"],
              ["Website editor", "Connected"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-2xl bg-secondary/50 px-4 py-3"
              >
                <span className="text-sm font-semibold text-muted-foreground">{label}</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </PanelShell>
      </div>
    </div>
  );
}

function PagesPanel({ db }: { db: DB }) {
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageParent, setNewPageParent] = useState("");

  // ── helpers ────────────────────────────────────────────────────────────────

  /** All nav items that are direct children of `parentId` (or roots if null). */
  const childrenOf = (parentId: string | null) =>
    [...db.navigation]
      .filter((item) => (parentId === null ? !item.parentId : item.parentId === parentId))
      .sort((a, b) => a.order - b.order);

  /** Returns the set of all descendant IDs of `id` (including itself). */
  const descendantIds = (id: string): Set<string> => collectPageTreeIds(db.navigation, id);

  /**
   * Flat list of all pages in depth-first order, with their depth and label
   * path, for use in dropdowns.
   */
  const allPagesFlat = (() => {
    const result: { id: string; label: string; depth: number }[] = [];
    const visit = (parentId: string | null, depth: number) => {
      const items = childrenOf(parentId);
      items.forEach((item) => {
        if (!db.pages[item.id]) return;
        result.push({ id: item.id, label: item.label, depth });
        visit(item.id, depth + 1);
      });
    };
    visit(null, 0);
    // Also add orphaned pages (in pages but not in navigation)
    Object.keys(db.pages).forEach((id) => {
      if (!db.navigation.some((item) => item.id === id)) {
        result.push({ id, label: pageLabel(id), depth: 0 });
      }
    });
    return result;
  })();

  // ── mutations ───────────────────────────────────────────────────────────────

  const updatePage = (id: string, patch: Record<string, string>) => {
    setDb((current) => ({
      ...current,
      pages: { ...current.pages, [id]: { ...(current.pages[id] || {}), ...patch } },
    }));
  };

  const updateNav = (
    id: string,
    patch: { label?: string; visible?: boolean; parentId?: string | null },
  ) => {
    setDb((current) => ({
      ...current,
      navigation: current.navigation.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              parentId:
                patch.parentId === null
                  ? undefined
                  : patch.parentId !== undefined
                    ? patch.parentId
                    : item.parentId,
            }
          : item,
      ),
    }));
  };

  const addPage = () => {
    const title = newPageTitle.trim();
    const slug = slugifyPage(title);
    if (!title || !slug) return;
    const baseId = newPageParent ? `${newPageParent}/${slug}` : slug;
    setDb((current) => {
      const id = uniquePageId(baseId, current.pages);
      const order = Math.max(0, ...current.navigation.map((item) => item.order)) + 1;
      return {
        ...current,
        pages: {
          ...current.pages,
          [id]: {
            kicker: newPageParent ? pageLabel(newPageParent) : "Page",
            title,
            body: "",
          },
        },
        navigation: [
          ...current.navigation,
          {
            id,
            label: title,
            order,
            visible: true,
            parentId: newPageParent || undefined,
          },
        ],
      };
    });
    audit(`Page created: ${title}`, "Admin");
    setNewPageTitle("");
    setNewPageParent("");
  };

  const deletePage = (id: string) => {
    if (id === "home") return;
    if (!window.confirm(`Delete "${pageLabel(id)}" and any subpages under it?`)) return;
    setDb((current) => {
      const toDelete = collectPageTreeIds(current.navigation, id);
      const pages = { ...current.pages };
      toDelete.forEach((pageId) => {
        delete pages[pageId];
      });
      return {
        ...current,
        pages,
        navigation: current.navigation.filter((item) => !toDelete.has(item.id)),
      };
    });
    audit(`Page deleted: ${id}`, "Admin");
  };

  const uploadPageImage = async (id: string, file?: File) => {
    if (!file) return;
    try {
      await compressImage(file);
      const imageUrl = await uploadFileToBackend("site-images/pages", file);
      updatePage(id, { image: imageUrl });
      audit(`Page photo uploaded: ${id}`, "Admin");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Page photo upload failed.");
    }
  };

  const removePageImage = (id: string) => {
    updatePage(id, { image: "" });
    audit(`Page photo removed: ${id}`, "Admin");
  };

  // ── level colours ───────────────────────────────────────────────────────────

  const levelBorderColor = ["border-l-gold/60", "border-l-crimson/50", "border-l-navy/30"];
  const levelBg = ["bg-white", "bg-amber-50/60", "bg-slate-50"];

  // ── render one page card ────────────────────────────────────────────────────

  const renderPageCard = (id: string, depth = 0): React.ReactNode => {
    const page = db.pages[id];
    if (!page) return null;
    const navItem = db.navigation.find((item) => item.id === id);
    const isCustom = !corePageIds.has(id);
    const canDelete = id !== "home";
    const parentNavItem = navItem?.parentId
      ? db.navigation.find((item) => item.id === navItem.parentId)
      : null;

    // Options for the "Move under" dropdown — exclude self and own descendants
    const excluded = descendantIds(id);
    const parentOptions = allPagesFlat.filter((p) => p.id !== id && !excluded.has(p.id));

    const childItems = childrenOf(id).filter((child) => db.pages[child.id]);
    const levelBorderClass = levelBorderColor[Math.min(depth, levelBorderColor.length - 1)];
    const levelBgClass = levelBg[Math.min(depth, levelBg.length - 1)];

    return (
      <div key={id}>
        {/* Page card */}
        <div
          className={`rounded-2xl border border-border p-5 ${levelBgClass} ${depth > 0 ? `border-l-4 ${levelBorderClass}` : ""}`}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-serif text-xl font-bold capitalize text-navy">
                {navItem?.label || pageLabel(id)}
              </p>
              <p className="text-xs font-semibold text-muted-foreground">{pageHref(id)}</p>
              {parentNavItem && (
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-crimson">
                  {"↳ ".repeat(depth)}Under {parentNavItem.label}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <a
                href={pageHref(id)}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy"
              >
                Preview
              </a>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => deletePage(id)}
                  className="rounded-xl border border-border bg-white p-2 text-crimson"
                  title="Delete page"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <span className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-muted-foreground">
                  Home
                </span>
              )}
            </div>
          </div>

          {/* Menu label + parent picker */}
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <TextInput
              value={navItem?.label || pageLabel(id)}
              placeholder="Menu label"
              onChange={(event) => updateNav(id, { label: event.target.value })}
            />
            <select
              value={navItem?.parentId || ""}
              disabled={!isCustom}
              onChange={(event) => updateNav(id, { parentId: event.target.value || null })}
              className="h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold disabled:bg-secondary disabled:text-muted-foreground"
            >
              <option value="">Main page</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {"– ".repeat(p.depth)}Under {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Page title, body, image */}
          <div className="mt-3 space-y-3">
            <TextInput
              value={page.title || ""}
              placeholder="Page title"
              onChange={(e) => updatePage(id, { title: e.target.value })}
            />
            <TextArea
              rows={3}
              value={page.body || ""}
              placeholder="Page description"
              onChange={(e) => updatePage(id, { body: e.target.value })}
            />
            <div className="rounded-2xl border border-border bg-white p-3">
              {page.image ? (
                <img
                  src={page.image}
                  alt=""
                  className="mb-3 aspect-[16/7] w-full rounded-xl object-cover"
                />
              ) : (
                <div className="mb-3 grid aspect-[16/7] place-items-center rounded-xl bg-secondary text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  No page photo
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy">
                  <Upload className="h-4 w-4" /> Upload photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(event) => void uploadPageImage(id, event.target.files?.[0])}
                  />
                </label>
                {page.image && (
                  <button
                    type="button"
                    onClick={() => removePageImage(id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-crimson"
                  >
                    <Trash2 className="h-4 w-4" /> Remove photo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => updateNav(id, { visible: !(navItem?.visible ?? true) })}
                  className={`inline-flex items-center rounded-xl px-3 py-2 text-xs font-black ${
                    (navItem?.visible ?? true)
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {(navItem?.visible ?? true) ? "Visible in menu" : "Hidden from menu"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recursive children */}
        {childItems.length > 0 && (
          <div
            className={`mt-3 space-y-3 border-l-2 pl-5 ${levelBorderColor[Math.min(depth, levelBorderColor.length - 1)]}`}
          >
            <p className="pt-1 text-[10px] font-black uppercase tracking-[0.2em] text-crimson">
              Subpages under {navItem?.label || pageLabel(id)}
            </p>
            {childItems.map((child) => renderPageCard(child.id, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // ── root page ids ───────────────────────────────────────────────────────────
  const rootPageIds = [
    ...childrenOf(null)
      .filter((item) => db.pages[item.id] && item.id !== "student-portal")
      .map((item) => item.id),
    ...Object.keys(db.pages).filter((id) => !db.navigation.some((item) => item.id === id)),
  ];

  return (
    <PanelShell
      title="Pages"
      kicker="Page builder"
      action={
        <button
          type="button"
          onClick={addPage}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-black text-navy"
        >
          <Plus className="h-4 w-4" /> Add page
        </button>
      }
    >
      {/* Add new page bar */}
      <div className="mb-6 grid gap-3 rounded-2xl border border-border bg-secondary/30 p-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <TextInput
          value={newPageTitle}
          placeholder="New page title"
          onChange={(event) => setNewPageTitle(event.target.value)}
        />
        <select
          value={newPageParent}
          onChange={(event) => setNewPageParent(event.target.value)}
          className="h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold"
        >
          <option value="">Main page (top level)</option>
          {allPagesFlat.map((p) => (
            <option key={p.id} value={p.id}>
              {"– ".repeat(p.depth)}Subpage under {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Page tree */}
      <div className="space-y-5">
        {rootPageIds.map((id) => (
          <div key={id} className="rounded-[1.4rem] border border-border bg-white p-4 shadow-soft">
            {renderPageCard(id, 0)}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function ContentPanel({ db }: { db: DB }) {
  const [newsTitle, setNewsTitle] = useState("");
  const [newsBody, setNewsBody] = useState("");
  const [newsImage, setNewsImage] = useState("");
  const [newsAudience, setNewsAudience] = useState("Public");
  const [newsImageUploading, setNewsImageUploading] = useState(false);

  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventType, setEventType] = useState("School Event");
  const [eventDescription, setEventDescription] = useState("");
  const [eventImage, setEventImage] = useState("");
  const [eventImageUploading, setEventImageUploading] = useState(false);

  const newsImageInputRef = useRef<HTMLInputElement>(null);
  const eventImageInputRef = useRef<HTMLInputElement>(null);

  const handleNewsImageUpload = async (file?: File) => {
    if (!file) return;
    setNewsImageUploading(true);
    try {
      await compressImage(file);
      const imageUrl = await uploadFileToBackend("news-images", file);
      setNewsImage(imageUrl);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setNewsImageUploading(false);
    }
  };

  const handleEventImageUpload = async (file?: File) => {
    if (!file) return;
    setEventImageUploading(true);
    try {
      await compressImage(file);
      const imageUrl = await uploadFileToBackend("event-images", file);
      setEventImage(imageUrl);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setEventImageUploading(false);
    }
  };

  const addNews = () => {
    if (!newsTitle.trim()) return;
    setDb((current) => ({
      ...current,
      news: [
        {
          id: makeId("NEWS"),
          title: newsTitle.trim(),
          date: new Date().toISOString().slice(0, 10),
          body: newsBody.trim() || "Updated by website admin.",
          audience: newsAudience,
          image: newsImage || undefined,
        },
        ...current.news,
      ],
    }));
    audit(`News added: ${newsTitle}`, "Admin");
    setNewsTitle("");
    setNewsBody("");
    setNewsImage("");
    setNewsAudience("Public");
    if (newsImageInputRef.current) newsImageInputRef.current.value = "";
  };

  const addEvent = () => {
    if (!eventTitle.trim()) return;
    setDb((current) => ({
      ...current,
      events: [
        {
          id: makeId("EVT"),
          title: eventTitle.trim(),
          date: eventDate || new Date().toISOString().slice(0, 10),
          location: eventLocation.trim() || "Loyola College",
          type: eventType || "School Event",
          description: eventDescription.trim() || undefined,
          image: eventImage || undefined,
          posterUrl: eventImage || undefined,
        } as EventItem,
        ...current.events,
      ],
    }));
    audit(`Event added: ${eventTitle}`, "Admin");
    setEventTitle("");
    setEventDate("");
    setEventLocation("");
    setEventType("School Event");
    setEventDescription("");
    setEventImage("");
    if (eventImageInputRef.current) eventImageInputRef.current.value = "";
  };

  const removeNews = (id: string) => {
    setDb((current) => {
      if (!current.news.some((item) => item.id === id)) return current;
      return {
        ...current,
        news: current.news.filter((item) => item.id !== id),
        deletedContentIds: rememberDeletedContentId(current, "news", id),
      };
    });
    audit(`News deleted: ${id}`, "Admin");
  };

  const removeEvent = (id: string) => {
    setDb((current) => {
      if (!current.events.some((item) => item.id === id)) return current;
      return {
        ...current,
        events: current.events.filter((item) => item.id !== id),
        deletedContentIds: rememberDeletedContentId(current, "events", id),
      };
    });
    audit(`Event deleted: ${id}`, "Admin");
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <PanelShell
        title="News & notices"
        kicker="Content manager"
        action={
          <button
            type="button"
            onClick={addNews}
            className="rounded-xl bg-gold px-4 py-2 text-sm font-black text-navy"
          >
            <Plus className="mr-2 inline h-4 w-4" />
            Add News
          </button>
        }
      >
        <div className="space-y-3">
          <TextInput
            placeholder="News / notice title"
            value={newsTitle}
            onChange={(e) => setNewsTitle(e.target.value)}
          />
          <TextArea
            rows={3}
            placeholder="Short description"
            value={newsBody}
            onChange={(e) => setNewsBody(e.target.value)}
          />
          <select
            value={newsAudience}
            onChange={(e) => setNewsAudience(e.target.value)}
            className="h-12 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold"
          >
            <option value="Public">Public</option>
            <option value="Students">Students</option>
            <option value="Parents">Parents</option>
            <option value="Staff">Staff</option>
          </select>

          {/* Photo upload for news */}
          <div className="rounded-2xl border border-border bg-white p-3">
            {newsImage ? (
              <div className="mb-3 relative">
                <img
                  src={newsImage}
                  alt="News preview"
                  className="aspect-[16/7] w-full rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setNewsImage("");
                    if (newsImageInputRef.current) newsImageInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 rounded-lg bg-white/90 p-1.5 text-crimson shadow"
                  title="Remove photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="mb-3 grid aspect-[16/7] place-items-center rounded-xl bg-secondary text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {newsImageUploading ? "Uploading…" : "No photo attached"}
              </div>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy">
              <Upload className="h-4 w-4" />
              {newsImageUploading ? "Uploading…" : "Upload photo"}
              <input
                ref={newsImageInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                disabled={newsImageUploading}
                onChange={(e) => void handleNewsImageUpload(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {db.news.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3"
            >
              {item.image && (
                <img
                  src={item.image}
                  alt=""
                  className="h-12 w-16 shrink-0 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-navy">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.date} · {item.audience}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeNews(item.id)}
                className="shrink-0 rounded-xl border border-border bg-white p-2 text-crimson"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </PanelShell>

      <PanelShell
        title="Events"
        kicker="Calendar manager"
        action={
          <button
            type="button"
            onClick={addEvent}
            className="rounded-xl bg-gold px-4 py-2 text-sm font-black text-navy"
          >
            <Plus className="mr-2 inline h-4 w-4" />
            Add Event
          </button>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_160px]">
            <TextInput
              placeholder="Event title"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
            />
            <TextInput
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              placeholder="Location (e.g. Main Hall)"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
            />
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold"
            >
              <option value="School Event">School Event</option>
              <option value="Sports">Sports</option>
              <option value="Academic">Academic</option>
              <option value="Cultural">Cultural</option>
              <option value="Religious">Religious</option>
              <option value="Community">Community</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <TextArea
            rows={2}
            placeholder="Event description (optional)"
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
          />

          {/* Photo upload for events */}
          <div className="rounded-2xl border border-border bg-white p-3">
            {eventImage ? (
              <div className="mb-3 relative">
                <img
                  src={eventImage}
                  alt="Event preview"
                  className="aspect-[16/7] w-full rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setEventImage("");
                    if (eventImageInputRef.current) eventImageInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 rounded-lg bg-white/90 p-1.5 text-crimson shadow"
                  title="Remove photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="mb-3 grid aspect-[16/7] place-items-center rounded-xl bg-secondary text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {eventImageUploading ? "Uploading…" : "No event photo"}
              </div>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy">
              <Upload className="h-4 w-4" />
              {eventImageUploading ? "Uploading…" : "Upload event photo"}
              <input
                ref={eventImageInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                disabled={eventImageUploading}
                onChange={(e) => void handleEventImageUpload(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {db.events.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3"
            >
              {(item as EventItem & { image?: string }).image && (
                <img
                  src={(item as EventItem & { image?: string }).image}
                  alt=""
                  className="h-12 w-16 shrink-0 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-navy">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.date} · {item.location} · {item.type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeEvent(item.id)}
                className="shrink-0 rounded-xl border border-border bg-white p-2 text-crimson"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </PanelShell>
    </div>
  );
}

function StorageOverview({ refreshKey = 0 }: { refreshKey?: number }) {
  const db = useDb();
  const [refreshCount, setRefreshCount] = useState(refreshKey);
  const [mediaRows, setMediaRows] = useState<
    {
      id: number;
      file_name?: string;
      file_url?: string;
      file_type?: string;
      folder?: string;
      category?: string;
      uploaded_at?: string;
    }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/media?ts=${Date.now()}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((payload) => {
        if (!cancelled) setMediaRows(Array.isArray(payload) ? payload : []);
      })
      .catch(() => {
        if (!cancelled) setMediaRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshCount]);

  const backendUrls = (() => {
    const values = new Set<string>();
    const bundledStaticAssets = new Set(["/flag1.png", "/loyola-crest.jpg"]);
    const isBundledStaticAsset = (url: string) => {
      const clean = url.split("?")[0];
      try {
        return bundledStaticAssets.has(new URL(clean).pathname);
      } catch {
        return bundledStaticAssets.has(clean);
      }
    };
    const add = (value?: string) => {
      const url = value?.trim();
      if (!url) return;
      if (isBundledStaticAsset(url)) return;
      if (!url.startsWith("data:")) {
        values.add(url);
      }
    };

    add(db.websiteContent.heroImage);
    add(db.websiteContent.backgroundMediaUrl);
    add(db.websiteContent.logoImage);
    add(db.websiteContent.seo.ogImage);
    add(db.media.campusImage);
    add(db.media.aboutImage);
    add(db.media.principalImage);
    Object.values(db.pages).forEach((page) => {
      add(page.image);
      add(page.backgroundMediaUrl);
      add(page.anthemVideoCoverImage);
    });
    db.news.forEach((item) => add(item.image));
    db.gallery.forEach((item) => {
      add(item.image);
      item.images?.forEach(add);
    });
    db.videoGallery.forEach((album) => {
      add(album.coverImage);
      album.videos.forEach((video) => {
        add(video.url);
        add(video.webmUrl);
        add(video.thumbnail);
      });
    });
    db.teachers.forEach((teacher) => add(teacher.image));
    db.downloads.forEach((item) => add(item.fileUrl));

    return [...values];
  })();

  const categoryRows = Array.from(
    mediaRows.reduce((map, row) => {
      const category = row.category || "Uncategorized";
      map.set(category, (map.get(category) || 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).sort(([a], [b]) => a.localeCompare(b));

  const counts = backendUrls.reduce(
    (acc, url) => {
      const clean = url.toLowerCase().split("?")[0];
      if (/\.(mp4|webm|mov|m4v)$/.test(clean) || clean.includes("gallery-videos")) acc.videos += 1;
      else if (/\.(pdf|doc|docx|xls|xlsx|zip)$/.test(clean)) acc.documents += 1;
      else if (/\.(jpg|jpeg|png|webp|gif)$/.test(clean) || clean.includes("images")) {
        acc.photos += 1;
      } else acc.other += 1;
      return acc;
    },
    { photos: 0, videos: 0, documents: 0, other: 0 },
  );

  const storageRows = [
    { label: "Photos", count: counts.photos },
    { label: "Videos", count: counts.videos },
    { label: "Documents", count: counts.documents },
    { label: "Other files", count: counts.other },
  ];

  const displayPath = (url: string) => {
    try {
      if (url.startsWith("gs://")) return url.replace(/^gs:\/\/[^/]+\//, "");
      const parsed = new URL(url);
      const encodedPath = parsed.pathname.split("/o/")[1]?.split("?")[0];
      return decodeURIComponent(encodedPath || parsed.pathname.split("/").pop() || url);
    } catch {
      return url;
    }
  };

  return (
    <PanelShell
      title="Backend storage"
      kicker="MySQL + uploads"
      action={
        <button
          type="button"
          onClick={() => setRefreshCount((count) => count + 1)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-xs font-black text-navy"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-secondary/35 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                Database
              </p>
              <p className="mt-2 text-2xl font-black text-navy">MySQL</p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/35 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                Media
              </p>
              <p className="mt-2 text-2xl font-black text-navy">{backendUrls.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/35 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                Hosting
              </p>
              <p className="mt-2 text-2xl font-black text-navy">Hostinger-ready backend</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-navy">
              <span>MySQL is the active database and backend/uploads is the media storage.</span>
              <span>
                {backendUrls.length} stored media reference{backendUrls.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gold transition-all"
                style={{ width: "100%" }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              Site content is saved in MySQL. Media uploads are saved to the protected
              backend/uploads folder.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {storageRows.map((row) => {
            return (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-black text-navy">{row.label}</p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {row.count} file{row.count === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="text-sm font-black text-navy">{row.count}</p>
              </div>
            );
          })}
          {categoryRows.length ? (
            <div className="rounded-2xl border border-border bg-white px-4 py-3">
              <p className="text-sm font-black text-navy">Saved categories</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {categoryRows.map(([category, count]) => (
                  <span
                    key={category}
                    className="rounded-full bg-secondary px-3 py-1 text-[11px] font-black text-navy"
                  >
                    {category}: {count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {backendUrls.length ? (
        <div className="mt-5 border-t border-border pt-5">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
            Stored media references
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {backendUrls.slice(0, 6).map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-sm"
              >
                <span className="min-w-0 truncate font-bold text-navy">{displayPath(url)}</span>
                <span className="shrink-0 font-black text-muted-foreground">Open</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </PanelShell>
  );
}

function youtubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v") || "";
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] || "";
    }
  } catch {
    return "";
  }
  return "";
}

function youtubeEmbedUrl(url: string) {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}` : "";
}

function GalleryVideoPreview({
  video,
  cover,
  className = "aspect-video w-full rounded-lg bg-black",
}: {
  video: GalleryVideo;
  cover?: string;
  className?: string;
}) {
  const embedUrl = youtubeEmbedUrl(video.url);
  if (embedUrl) {
    return (
      <iframe
        src={embedUrl}
        title={video.name}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className={className}
      />
    );
  }

  return (
    <video controls poster={cover} className={className}>
      {video.webmUrl && <source src={video.webmUrl} type="video/webm" />}
      <source src={video.url} type="video/mp4" />
    </video>
  );
}

function MediaPanel({ db }: { db: DB }) {
  const [message, setMessage] = useState("Create an album, then upload up to 10 JPG/PNG images.");
  const [videoPreview, setVideoPreview] = useState<{
    name: string;
    url: string;
    webmUrl?: string;
    size: string;
    source?: "upload" | "youtube";
  } | null>(null);
  const [albumTitle, setAlbumTitle] = useState("");
  const [albumLink, setAlbumLink] = useState("");
  const [videoAlbumTitle, setVideoAlbumTitle] = useState("");
  const [videoAlbumLink, setVideoAlbumLink] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [selectedAlbumId, setSelectedAlbumId] = useState(db.gallery[0]?.id || "");
  const [selectedVideoAlbumId, setSelectedVideoAlbumId] = useState(db.videoGallery[0]?.id || "");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoCoverInputRef = useRef<HTMLInputElement>(null);

  const createAlbum = () => {
    const title = albumTitle.trim() || "New Gallery Album";
    const id = makeId("ALBUM");
    setDb((current) => ({
      ...current,
      gallery: [
        {
          id,
          label: title,
          image: "",
          images: [],
          description: "",
          link: albumLink.trim(),
          visible: true,
        },
        ...current.gallery,
      ],
    }));
    audit(`Album created: ${title}`, "Admin");
    setSelectedAlbumId(id);
    setAlbumTitle("");
    setAlbumLink("");
    setMessage(`Album created: ${title}`);
  };

  const createVideoAlbum = () => {
    const title = videoAlbumTitle.trim() || "New Video Album";
    const id = makeId("VIDEOALBUM");
    setDb((current) => ({
      ...current,
      videoGallery: [
        {
          id,
          label: title,
          coverImage: "",
          videos: [],
          description: "",
          link: videoAlbumLink.trim(),
          visible: true,
        },
        ...current.videoGallery,
      ],
    }));
    audit(`Video album created: ${title}`, "Admin");
    setSelectedVideoAlbumId(id);
    setVideoAlbumTitle("");
    setVideoAlbumLink("");
    setMessage(`Video album created: ${title}`);
  };

  const updateAlbum = (id: string, patch: Partial<DB["gallery"][number]>) => {
    setDb((current) => ({
      ...current,
      gallery: current.gallery.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const updateVideoAlbum = (id: string, patch: Partial<DB["videoGallery"][number]>) => {
    setDb((current) => ({
      ...current,
      videoGallery: current.videoGallery.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  };

  const deleteAlbum = (id: string) => {
    if (!window.confirm("Delete this album and its media?")) return;
    setDb((current) => ({ ...current, gallery: current.gallery.filter((item) => item.id !== id) }));
    if (selectedAlbumId === id) setSelectedAlbumId("");
    audit(`Album deleted: ${id}`, "Admin");
  };

  const deleteVideoAlbum = (id: string) => {
    if (!window.confirm("Delete this video album and its videos?")) return;
    setDb((current) => ({
      ...current,
      videoGallery: current.videoGallery.filter((item) => item.id !== id),
    }));
    if (selectedVideoAlbumId === id) setSelectedVideoAlbumId("");
    audit(`Video album deleted: ${id}`, "Admin");
  };

  const removeAlbumImage = (albumId: string, image: string) => {
    setDb((current) => ({
      ...current,
      gallery: current.gallery.map((album) => {
        if (album.id !== albumId) return album;
        const images = (album.images || [album.image])
          .filter(Boolean)
          .filter((item) => item !== image);
        return { ...album, images, image: images[0] || "" };
      }),
    }));
  };

  const removeAlbumVideo = (albumId: string, videoId: string) => {
    setDb((current) => ({
      ...current,
      videoGallery: current.videoGallery.map((album) =>
        album.id === albumId
          ? { ...album, videos: (album.videos || []).filter((video) => video.id !== videoId) }
          : album,
      ),
    }));
  };

  const uploadImages = async (files?: FileList | null) => {
    const albumId = selectedAlbumId || db.gallery[0]?.id;
    if (!files?.length || !albumId) {
      setMessage("Create or select an album before uploading images.");
      return;
    }
    const album = db.gallery.find((item) => item.id === albumId);
    const currentImages = (album?.images || (album?.image ? [album.image] : [])).filter(Boolean);
    const remaining = Math.max(0, 10 - currentImages.length);
    const selectedFiles = Array.from(files).slice(0, remaining);
    if (selectedFiles.length === 0) {
      setMessage("This album already has the maximum 10 images.");
      return;
    }
    try {
      setMessage(
        `Optimizing ${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"}...`,
      );
      await Promise.all(selectedFiles.map((file) => compressImage(file, 900, 0.72)));
      setMessage(
        `Uploading ${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"}...`,
      );
      const uploadedImages = await Promise.all(
        selectedFiles.map((file) => uploadFileToBackend("gallery-images/albums", file)),
      );
      const nextImages = [...currentImages, ...uploadedImages].slice(0, 10);
      setDb((current) => ({
        ...current,
        gallery: current.gallery.map((item) =>
          item.id === albumId
            ? { ...item, images: nextImages, image: nextImages[0] || item.image }
            : item,
        ),
      }));
      audit(`Album images uploaded: ${selectedFiles.length}`, "Admin");
      const cloudCount = uploadedImages.filter((url) => !url.startsWith("data:")).length;
      setMessage(
        cloudCount === uploadedImages.length
          ? `Uploaded ${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"} to backend storage. Album limit is 10.`
          : `Saved ${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"}; ${cloudCount} uploaded to backend storage. Album limit is 10.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  const uploadAlbumCover = async (file?: File) => {
    const albumId = selectedAlbumId || db.gallery[0]?.id;
    if (!file || !albumId) {
      setMessage("Create or select an album before uploading a cover photo.");
      return;
    }
    try {
      setMessage("Uploading album cover photo...");
      await compressImage(file, 1200, 0.78);
      const coverUrl = await uploadFileToBackend("gallery-images/covers", file);
      setDb((current) => ({
        ...current,
        gallery: current.gallery.map((item) => {
          if (item.id !== albumId) return item;
          const existingImages = (item.images || (item.image ? [item.image] : [])).filter(Boolean);
          const images = [coverUrl, ...existingImages.filter((image) => image !== coverUrl)].slice(
            0,
            10,
          );
          return { ...item, image: coverUrl, images };
        }),
      }));
      audit(`Album cover uploaded: ${albumId}`, "Admin");
      setMessage("Album cover photo updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cover photo upload failed.");
    }
  };

  const uploadVideoAlbumCover = async (file?: File) => {
    const albumId = selectedVideoAlbumId || db.videoGallery[0]?.id;
    if (!file || !albumId) {
      setMessage("Create or select a video album before uploading a cover photo.");
      return;
    }
    try {
      setMessage("Uploading video album cover photo...");
      await compressImage(file, 1200, 0.78);
      const coverUrl = await uploadFileToBackend("video-gallery/covers", file);
      setDb((current) => ({
        ...current,
        videoGallery: current.videoGallery.map((item) =>
          item.id === albumId ? { ...item, coverImage: coverUrl } : item,
        ),
      }));
      audit(`Video album cover uploaded: ${albumId}`, "Admin");
      setMessage("Video album cover photo updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Video cover photo upload failed.");
    }
  };

  const uploadVideo = async (file?: File) => {
    if (!file) return;
    const albumId = selectedVideoAlbumId || db.videoGallery[0]?.id;
    if (!albumId) {
      setMessage("Create or select a video album before uploading videos.");
      return;
    }
    if (!VIDEO_TYPES.includes(file.type)) {
      setMessage("Only MP4, MOV, and WebM videos are allowed.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setMessage("Video is too large. Maximum video upload is 500 MB.");
      return;
    }

    try {
      setMessage(
        `Uploading and optimizing short video: ${formatBytes(file.size)}. Maximum duration is 2 minutes.`,
      );
      const uploaded = await uploadFileToBackendInfo("gallery-videos", file);
      const url = uploaded.fileUrl || uploaded.url;
      const webmUrl = uploaded.webmUrl || "";
      const video: GalleryVideo = {
        id: makeId("VID"),
        name: uploaded.file?.name || file.name,
        url,
        webmUrl,
        size: uploaded.file?.size || file.size,
        durationSeconds: uploaded.file?.durationSeconds || null,
        uploadedAt: new Date().toISOString(),
        source: "upload",
        mediaType: "short_video_upload",
      };
      setDb((current) => ({
        ...current,
        videoGallery: current.videoGallery.map((item) =>
          item.id === albumId ? { ...item, videos: [video, ...(item.videos || [])] } : item,
        ),
      }));
      setVideoPreview({
        name: video.name,
        url,
        webmUrl,
        size: formatBytes(video.size),
        source: "upload",
      });
      audit(`Short video uploaded and optimized: ${file.name}`, "Admin");
      setMessage(
        `Short video optimized as WebM and MP4: ${formatBytes(video.size)}. For long videos, please use a YouTube link to save hosting storage and bandwidth.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Short video upload failed. For long videos, please use a YouTube link to save hosting storage and bandwidth.",
      );
    }
  };

  const addYoutubeVideo = () => {
    const albumId = selectedVideoAlbumId || db.videoGallery[0]?.id;
    const url = youtubeUrl.trim();
    const videoId = youtubeVideoId(url);
    if (!albumId) {
      setMessage("Create or select a video album before adding a YouTube video.");
      return;
    }
    if (!videoId) {
      setMessage("Paste a valid YouTube video link.");
      return;
    }
    const title = youtubeTitle.trim() || "YouTube video";
    const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const video: GalleryVideo = {
      id: makeId("YT"),
      name: title,
      url,
      size: 0,
      uploadedAt: new Date().toISOString(),
      source: "youtube",
      mediaType: "youtube_video",
      thumbnail,
    };
    setDb((current) => ({
      ...current,
      videoGallery: current.videoGallery.map((item) =>
        item.id === albumId ? { ...item, videos: [video, ...(item.videos || [])] } : item,
      ),
    }));
    setVideoPreview({ name: title, url, size: "YouTube", source: "youtube" });
    setYoutubeUrl("");
    setYoutubeTitle("");
    audit(`YouTube video added: ${title}`, "Admin");
    setMessage("YouTube video added to the album.");
  };

  const selectedAlbum = db.gallery.find((item) => item.id === selectedAlbumId) || db.gallery[0];
  const selectedVideoAlbum =
    db.videoGallery.find((item) => item.id === selectedVideoAlbumId) || db.videoGallery[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <PanelShell title="Albums & photos" kicker="Media library">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              className="hidden"
              onChange={(e) => {
                void uploadImages(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                void uploadAlbumCover(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              className="hidden"
              onChange={(e) => {
                void uploadVideo(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            <input
              ref={videoCoverInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                void uploadVideoAlbumCover(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            <div className="space-y-4">
              <MediaUploadStatus />
              <TextInput
                value={albumTitle}
                placeholder="Album name"
                onChange={(e) => setAlbumTitle(e.target.value)}
              />
              <TextInput
                value={albumLink}
                placeholder="Show more link, e.g. https://example.com"
                onChange={(e) => setAlbumLink(e.target.value)}
              />
              <button
                type="button"
                onClick={createAlbum}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gold px-5 py-4 text-sm font-black text-navy"
              >
                <Plus className="h-5 w-5" /> Create album
              </button>
              <select
                value={selectedAlbum?.id || ""}
                onChange={(e) => setSelectedAlbumId(e.target.value)}
                className="h-12 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold"
              >
                <option value="">Select album</option>
                {db.gallery.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gold/50 bg-gold/10 px-5 py-10 text-sm font-black text-navy"
              >
                <Upload className="h-6 w-6" /> Upload JPG / PNG images
              </button>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-white px-5 py-4 text-sm font-black text-navy"
              >
                <ImageIcon className="h-5 w-5" /> Upload album cover photo
              </button>
            </div>
          </PanelShell>

          <PanelShell title="Video uploads" kicker="Short videos & YouTube">
            <div className="space-y-4">
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                For long videos, please use a YouTube link to save hosting storage and bandwidth.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs font-black text-navy">
                <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
                  <Video className="h-3.5 w-3.5" /> Short video upload
                </span>
                <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
                  <Globe className="h-3.5 w-3.5" /> YouTube video
                </span>
              </div>
              <TextInput
                value={videoAlbumTitle}
                placeholder="Video album name"
                onChange={(e) => setVideoAlbumTitle(e.target.value)}
              />
              <TextInput
                value={videoAlbumLink}
                placeholder="Video show more link, e.g. https://youtube.com/@channel"
                onChange={(e) => setVideoAlbumLink(e.target.value)}
              />
              <button
                type="button"
                onClick={createVideoAlbum}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-navy px-5 py-4 text-sm font-black text-white"
              >
                <Plus className="h-5 w-5" /> Create video album
              </button>
              <select
                value={selectedVideoAlbum?.id || ""}
                onChange={(e) => setSelectedVideoAlbumId(e.target.value)}
                className="h-12 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold"
              >
                <option value="">Select video album</option>
                {db.videoGallery.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => videoCoverInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-white px-5 py-4 text-sm font-black text-navy"
              >
                <ImageIcon className="h-5 w-5" /> Upload video album cover
              </button>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-navy/30 bg-secondary px-5 py-8 text-sm font-black text-navy"
              >
                <Video className="h-6 w-6" /> Upload short MP4 / MOV / WebM video
              </button>
              <p className="text-xs font-semibold leading-5 text-muted-foreground">
                Short uploads are converted to compressed WebM and MP4 files. Maximum duration:{" "}
                {MAX_SHORT_VIDEO_SECONDS / 60} minutes.
              </p>
              <div className="rounded-2xl border border-border bg-white p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Add YouTube video
                </p>
                <div className="space-y-3">
                  <TextInput
                    value={youtubeUrl}
                    placeholder="YouTube link"
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                  />
                  <TextInput
                    value={youtubeTitle}
                    placeholder="Video title"
                    onChange={(e) => setYoutubeTitle(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={addYoutubeVideo}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-sm font-black text-white"
                  >
                    <Plus className="h-4 w-4" /> Add YouTube preview
                  </button>
                </div>
              </div>
            </div>
          </PanelShell>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {message}
          </div>
        </div>
        <div className="space-y-6">
          <PanelShell title="Photo albums" kicker="Images">
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {db.gallery.map((item) => {
                const images = (item.images || (item.image ? [item.image] : []))
                  .filter(Boolean)
                  .slice(0, 10);
                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-border bg-white shadow-soft"
                  >
                    <div className="group relative overflow-hidden">
                      <img
                        src={images[0] || "/loyola-crest.jpg"}
                        alt={item.label}
                        className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAlbumId(item.id);
                          coverInputRef.current?.click();
                        }}
                        className="absolute inset-0 flex items-center justify-center gap-2 bg-navy/72 text-sm font-black text-white opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100"
                      >
                        <Upload className="h-4 w-4" /> Change cover
                      </button>
                    </div>
                    <div className="p-3">
                      <div className="grid gap-2">
                        <TextInput
                          value={item.label}
                          placeholder="Album title"
                          onChange={(e) => updateAlbum(item.id, { label: e.target.value })}
                        />
                        <TextArea
                          rows={2}
                          value={item.description || ""}
                          placeholder="Album description"
                          onChange={(e) => updateAlbum(item.id, { description: e.target.value })}
                        />
                        <TextInput
                          value={item.link || ""}
                          placeholder="Show more website link"
                          onChange={(e) => updateAlbum(item.id, { link: e.target.value })}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-5 gap-1.5">
                        {images.map((image) => (
                          <button
                            key={image}
                            type="button"
                            onClick={() => removeAlbumImage(item.id, image)}
                            title="Remove image"
                            className="group relative overflow-hidden rounded-md border border-border bg-secondary"
                          >
                            <img src={image} alt="" className="aspect-square w-full object-cover" />
                            <span className="absolute inset-0 grid place-items-center bg-crimson/72 text-white opacity-0 transition-opacity group-hover:opacity-100">
                              <Trash2 className="h-3.5 w-3.5" />
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAlbumId(item.id);
                            imageInputRef.current?.click();
                          }}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-black text-navy"
                        >
                          Add images
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAlbumId(item.id);
                            coverInputRef.current?.click();
                          }}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-black text-navy"
                        >
                          Cover photo
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAlbum(item.id, { visible: item.visible === false })}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-black ${item.visible === false ? "bg-slate-200 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}
                        >
                          {item.visible === false ? "Hidden" : "Visible"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAlbum(item.id)}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-black text-crimson"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </PanelShell>

          <PanelShell title="Video albums" kicker="Videos">
            {videoPreview && (
              <div className="mb-5 grid gap-4 rounded-xl border border-border bg-secondary/40 p-4 md:grid-cols-[220px_1fr]">
                <GalleryVideoPreview
                  video={{
                    id: "preview",
                    name: videoPreview.name,
                    url: videoPreview.url,
                    webmUrl: videoPreview.webmUrl,
                    size: 0,
                    uploadedAt: new Date().toISOString(),
                    source: videoPreview.source,
                  }}
                  className="aspect-video w-full rounded-lg bg-black"
                />
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Session preview
                  </p>
                  <p className="mt-2 truncate font-bold text-navy">{videoPreview.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{videoPreview.size}</p>
                </div>
              </div>
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              {db.videoGallery.map((item) => {
                const videos = item.videos || [];
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border bg-white p-3 shadow-soft"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-navy">{item.label}</p>
                        <p className="text-xs font-semibold text-muted-foreground">
                          {videos.length} video{videos.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVideoAlbumId(item.id);
                          videoInputRef.current?.click();
                        }}
                        className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-black text-navy"
                      >
                        Add video
                      </button>
                    </div>
                    <div className="mb-3 grid gap-2">
                      <TextInput
                        value={item.label}
                        placeholder="Video album title"
                        onChange={(e) => updateVideoAlbum(item.id, { label: e.target.value })}
                      />
                      <TextArea
                        rows={2}
                        value={item.description || ""}
                        placeholder="Video album description"
                        onChange={(e) => updateVideoAlbum(item.id, { description: e.target.value })}
                      />
                      <TextInput
                        value={item.link || ""}
                        placeholder="Show more website link"
                        onChange={(e) => updateVideoAlbum(item.id, { link: e.target.value })}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVideoAlbumId(item.id);
                            videoCoverInputRef.current?.click();
                          }}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-black text-navy"
                        >
                          Cover photo
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateVideoAlbum(item.id, { visible: item.visible === false })
                          }
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-black ${item.visible === false ? "bg-slate-200 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}
                        >
                          {item.visible === false ? "Hidden" : "Visible"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteVideoAlbum(item.id)}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-black text-crimson"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {videos.map((video) => (
                        <div
                          key={video.id}
                          className="grid gap-3 rounded-lg border border-border bg-secondary/35 p-2 sm:grid-cols-[150px_1fr]"
                        >
                          <GalleryVideoPreview
                            video={video}
                            cover={item.coverImage || video.thumbnail}
                            className="aspect-video w-full rounded-md bg-black"
                          />
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-black text-navy">{video.name}</p>
                              <p className="text-xs font-semibold text-muted-foreground">
                                {video.size > 0 ? formatBytes(video.size) : "YouTube"}
                                {video.durationSeconds
                                  ? ` - ${Math.round(video.durationSeconds)}s`
                                  : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAlbumVideo(item.id, video.id)}
                              className="shrink-0 rounded-md border border-border bg-white px-2 py-1 text-xs font-black text-crimson"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {db.videoGallery.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-secondary/35 p-6 text-sm font-semibold text-muted-foreground">
                  No video albums added yet.
                </div>
              )}
            </div>
          </PanelShell>
        </div>
      </div>
    </div>
  );
}

function DesignPanel({ db }: { db: DB }) {
  const updateContent = (patch: Partial<DB["websiteContent"]>) =>
    setDb((current) => ({ ...current, websiteContent: { ...current.websiteContent, ...patch } }));
  return (
    <PanelShell title="Design system" kicker="Professional UI">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              Primary color
            </span>
            <input
              type="color"
              value={db.websiteContent.primaryColor}
              onChange={(e) => updateContent({ primaryColor: e.target.value })}
              className="mt-2 h-14 w-full rounded-2xl border border-border bg-white p-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              Accent color
            </span>
            <input
              type="color"
              value={db.websiteContent.accentColor}
              onChange={(e) => updateContent({ accentColor: e.target.value })}
              className="mt-2 h-14 w-full rounded-2xl border border-border bg-white p-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              Custom CSS
            </span>
            <TextArea
              rows={7}
              value={db.websiteContent.customCss}
              onChange={(e) => updateContent({ customCss: e.target.value })}
            />
          </label>
        </div>
        <div className="rounded-[1.4rem] bg-navy p-6 text-white">
          <SparklesPreview />
        </div>
      </div>
    </PanelShell>
  );
}

function SparklesPreview() {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-gold-light">
        Animation presets
      </p>
      <h3 className="mt-3 font-serif text-4xl font-bold">Cinematic school identity</h3>
      <div className="mt-6 grid gap-3">
        {[
          "Fade-in sections",
          "Card hover lift",
          "Button glow",
          "Hero overlay",
          "Mobile optimized spacing",
        ].map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-sm font-semibold text-white/80"
          >
            <CheckCircle2 className="h-4 w-4 text-gold-light" /> {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesPanel({ db }: { db: DB }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openMessage = (id: string) => {
    setSelectedId(id);
    // Mark as Read when opened
    setDb((current) => ({
      ...current,
      messages: current.messages.map((m) => (m.id === id ? { ...m, status: "Read" } : m)),
    }));
  };

  const selected = db.messages.find((m) => m.id === selectedId);

  if (selected) {
    return (
      <PanelShell title={selected.subject} kicker="Message detail">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-black text-navy transition-smooth hover:border-gold hover:bg-gold/10"
        >
          ← Back to inbox
        </button>
        <div className="rounded-2xl border border-border bg-secondary/30 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                From
              </p>
              <p className="mt-1 font-bold text-navy">{selected.name}</p>
              <p className="text-sm text-muted-foreground">{selected.email}</p>
              {selected.phone && (
                <div className="mt-2 flex items-center gap-2 text-sm font-bold text-crimson">
                  <Phone className="h-3.5 w-3.5" />
                  {selected.phone}
                </div>
              )}
            </div>
            <span className="rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-black text-emerald-700">
              Read
            </span>
          </div>
          <hr className="border-border" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground mb-2">
              Subject
            </p>
            <p className="font-bold text-navy text-lg">{selected.subject}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground mb-2">
              Message
            </p>
            <p className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">{selected.body}</p>
          </div>
          {selected.createdAt && (
            <p className="text-xs font-semibold text-muted-foreground">
              Received: {new Date(selected.createdAt).toLocaleString()}
            </p>
          )}
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell title="Contact messages" kicker="Inbox">
      <div className="space-y-3">
        {db.messages.map((msg) => (
          <button
            key={msg.id}
            type="button"
            onClick={() => openMessage(msg.id)}
            className="w-full rounded-2xl border border-border bg-secondary/40 p-4 text-left transition-smooth hover:-translate-y-0.5 hover:border-gold hover:bg-white hover:shadow-soft cursor-pointer"
          >
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div className="min-w-0">
                <p className={`font-bold text-navy ${msg.status !== "Read" ? "font-black" : ""}`}>
                  {msg.subject}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {msg.name} · {msg.email} {msg.phone ? `· ${msg.phone}` : ""}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500 line-clamp-1">{msg.body}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                  msg.status === "Read"
                    ? "bg-secondary text-muted-foreground"
                    : "bg-gold/25 text-navy"
                }`}
              >
                {msg.status}
              </span>
            </div>
          </button>
        ))}
        {db.messages.length === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        )}
      </div>
    </PanelShell>
  );
}

type ManagedUser = {
  id: string;
  external_staff_id?: string | null;
  name: string;
  email: string;
  role: Role;
  status: string;
  created_at?: string | null;
};

type UserFormState = {
  name: string;
  email: string;
  password: string;
  role: Role;
  status: "Active" | "Disabled";
};

const userRoleOptions: Role[] = [
  "masteradmin",
  "superadmin",
  "website_admin",
  "eduzync_admin",
  "staff_admin",
  "teacher",
  "student",
  "parent",
];

const rolePermissionRows: { role: Role; access: string; scope: string }[] = [
  { role: "masteradmin", access: "Full control", scope: "All portals, users, publishing" },
  { role: "superadmin", access: "Admin tools", scope: "Website tools, publishing, backup" },
  { role: "website_admin", access: "Website", scope: "Pages, media, news, notices, events" },
  { role: "eduzync_admin", access: "School data", scope: "Students, classes, teachers, EduTrack" },
  { role: "staff_admin", access: "Staff", scope: "Staff profiles, documents, leave, notices" },
  { role: "teacher", access: "Teacher", scope: "EduTrack, classes, report cards" },
  { role: "student", access: "Student", scope: "ELMS, profile, reports" },
  { role: "parent", access: "Parent", scope: "Child profile and reports" },
];

function emptyUserForm(): UserFormState {
  return {
    name: "",
    email: "",
    password: "",
    role: "website_admin",
    status: "Active",
  };
}

function normalizeManagedUser(row: Partial<ManagedUser> & Record<string, unknown>): ManagedUser {
  const role = userRoleOptions.includes(row.role as Role) ? (row.role as Role) : "website_admin";
  return {
    id: String(row.id || ""),
    external_staff_id:
      typeof row.external_staff_id === "string" ? row.external_staff_id : row.external_staff_id || null,
    name: String(row.name || ""),
    email: String(row.email || ""),
    role,
    status: String(row.status || "Active"),
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  };
}

async function readUserApiError(response: Response) {
  const payload = await response.json().catch(() => null);
  return payload?.error || `User request failed with status ${response.status}.`;
}

function userStatusTone(status: string) {
  return String(status).toLowerCase() === "active"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-slate-100 text-slate-600";
}

function UsersPanel({ db }: { db: DB }) {
  const auth = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>(() =>
    db.users.map((user) => normalizeManagedUser(user as ManagedUser & Record<string, unknown>)),
  );
  const [form, setForm] = useState<UserFormState>(() => emptyUserForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canManageUsers = auth.user?.role === "masteradmin";

  const loadUsers = useCallback(async () => {
    if (!canManageUsers) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readUserApiError(response));
      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : payload?.users || [];
      setUsers(rows.map((row: ManagedUser & Record<string, unknown>) => normalizeManagedUser(row)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [canManageUsers]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const resetForm = () => {
    setForm(emptyUserForm());
    setEditingId(null);
  };

  const editUser = (user: ManagedUser) => {
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      status: user.status === "Active" ? "Active" : "Disabled",
    });
    setEditingId(user.id);
  };

  const submitUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageUsers) return;
    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      setError("Name and email are required.");
      return;
    }
    if (!editingId && form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (editingId && form.password && form.password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload: Record<string, string> = {
        name: trimmedName,
        email: trimmedEmail,
        role: form.role,
        status: form.status,
      };
      if (form.password) payload.password = form.password;

      const response = await fetch(
        `${API_URL}/api/users${editingId ? `/${encodeURIComponent(editingId)}` : ""}`,
        {
          method: editingId ? "PUT" : "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error(await readUserApiError(response));
      const savedPayload = await response.json().catch(() => null);
      const savedUser = savedPayload?.user
        ? normalizeManagedUser(savedPayload.user)
        : normalizeManagedUser({ id: editingId || "", ...payload });

      setUsers((current) =>
        editingId
          ? current.map((user) => (user.id === editingId ? savedUser : user))
          : [savedUser, ...current],
      );
      audit(
        `${editingId ? "Updated" : "Created"} user account: ${trimmedEmail}`,
        auth.user?.email || "Admin",
      );
      resetForm();
      void loadUsers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save user.");
    } finally {
      setSaving(false);
    }
  };

  const setUserStatus = async (user: ManagedUser, status: "Active" | "Disabled") => {
    if (!canManageUsers) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(user.id)}`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          role: user.role,
          status,
        }),
      });
      if (!response.ok) throw new Error(await readUserApiError(response));
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, status } : item)),
      );
      audit(
        `${status === "Active" ? "Activated" : "Disabled"} user account: ${user.email}`,
        auth.user?.email || "Admin",
      );
      void loadUsers();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Could not update status.");
    } finally {
      setSaving(false);
    }
  };

  const disableUser = async (user: ManagedUser) => {
    if (!canManageUsers) return;
    if (!confirm(`Disable ${user.email}?`)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(await readUserApiError(response));
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, status: "Disabled" } : item)),
      );
      audit(`Disabled user account: ${user.email}`, auth.user?.email || "Admin");
      void loadUsers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not disable user.");
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const haystack = `${user.name} ${user.email} ${user.role} ${user.status}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const activeUsers = users.filter((user) => user.status === "Active").length;
  const adminUsers = users.filter((user) =>
    ["masteradmin", "superadmin", "website_admin", "eduzync_admin", "staff_admin"].includes(
      user.role,
    ),
  ).length;

  if (!canManageUsers) {
    return (
      <PanelShell title="Users & Roles" kicker="Access control">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800">
          User management is available only for Master Admin accounts.
        </div>
      </PanelShell>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Users} label="Total accounts" value={users.length} />
        <StatCard icon={CheckCircle2} label="Active accounts" value={activeUsers} accent />
        <StatCard icon={ShieldCheck} label="Admin roles" value={adminUsers} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <PanelShell
          title={editingId ? "Edit account" : "Create account"}
          kicker="Users & Roles"
          action={
            editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            ) : null
          }
        >
          <form onSubmit={submitUser} className="space-y-3">
            <TextInput
              placeholder="Full name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <TextInput
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
            />
            <TextInput
              placeholder={editingId ? "New password optional" : "Temporary password"}
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
            />
            <select
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({ ...current, role: event.target.value as Role }))
              }
              className="input-line"
            >
              {userRoleOptions.map((option) => (
                <option key={option} value={option}>
                  {formatRole(option)}
                </option>
              ))}
            </select>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as UserFormState["status"],
                }))
              }
              className="input-line"
            >
              <option value="Active">Active</option>
              <option value="Disabled">Disabled</option>
            </select>
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-black text-navy disabled:opacity-60"
            >
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "Saving" : editingId ? "Save Account" : "Create Account"}
            </button>
          </form>
        </PanelShell>

        <PanelShell
          title="Portal accounts"
          kicker="Access control"
          action={
            <button
              type="button"
              onClick={() => void loadUsers()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          }
        >
          <label className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search accounts"
              className="w-full bg-transparent text-sm font-semibold outline-none"
            />
          </label>
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="hidden grid-cols-[1.5fr_1fr_0.8fr_0.8fr] gap-3 border-b border-border bg-secondary/50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground lg:grid">
              <span>Account</span>
              <span>Role</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-border">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="grid gap-3 px-4 py-4 lg:grid-cols-[1.5fr_1fr_0.8fr_0.8fr] lg:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-navy">{user.name}</p>
                    <p className="truncate text-xs font-semibold text-muted-foreground">
                      {user.email}
                    </p>
                    {user.external_staff_id && (
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Staff ID: {user.external_staff_id}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-700">{formatRole(user.role)}</span>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-black ${userStatusTone(
                      user.status,
                    )}`}
                  >
                    {user.status}
                  </span>
                  <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => editUser(user)}
                      className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-black text-navy"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void setUserStatus(user, user.status === "Active" ? "Disabled" : "Active")
                      }
                      disabled={saving || auth.user?.id === user.id}
                      className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-black text-navy disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {user.status === "Active" ? "Disable" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void disableUser(user)}
                      disabled={saving || user.status !== "Active" || auth.user?.id === user.id}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-crimson disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <p className="px-4 py-6 text-sm font-semibold text-muted-foreground">
                  {loading ? "Loading accounts..." : "No accounts found."}
                </p>
              )}
            </div>
          </div>
        </PanelShell>
      </div>

      <PanelShell title="Role permissions" kicker="Access model">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rolePermissionRows.map((row) => (
            <div key={row.role} className="rounded-2xl border border-border bg-secondary/35 p-4">
              <p className="text-sm font-black text-navy">{formatRole(row.role)}</p>
              <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-crimson">
                {row.access}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{row.scope}</p>
            </div>
          ))}
        </div>
      </PanelShell>
    </div>
  );
}

function LocalUsersPanel({ db }: { db: DB }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("website_admin");
  const addUser = () => {
    if (!name.trim() || !email.trim()) return;
    setDb((current) => ({
      ...current,
      users: [
        { id: makeId("USER"), name, email, password, role, status: "Active" },
        ...current.users,
      ],
    }));
    audit(`Admin user added: ${email}`, "Admin");
    setName("");
    setEmail("");
    setPassword("");
    setRole("website_admin");
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <PanelShell title="Add user" kicker="Roles">
        <div className="space-y-3">
          <TextInput
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextInput
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextInput
            placeholder="Temporary password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="input-line"
          >
            <option value="website_admin">Website Admin</option>
            <option value="eduzync_admin">EduTrack Admin</option>
            <option value="staff_admin">Staff Admin</option>
            <option value="superadmin">Super Admin</option>
            <option value="masteradmin">Master Admin</option>
          </select>
          <button
            type="button"
            onClick={addUser}
            className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-black text-navy"
          >
            Add User
          </button>
        </div>
      </PanelShell>
      <PanelShell title="Admin accounts" kicker="Access control">
        <div className="space-y-3">
          {db.users
            .filter((u) =>
              ["website_admin", "eduzync_admin", "staff_admin", "superadmin", "masteradmin"].includes(
                u.role,
              ),
            )
            .map((user) => (
              <div
                key={user.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-secondary/40 p-4 md:flex-row md:items-center"
              >
                <div>
                  <p className="font-bold text-navy">{user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {user.email} · {user.role}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDb((current) => ({
                        ...current,
                        users: current.users.map((u) =>
                          u.id === user.id
                            ? { ...u, status: u.status === "Active" ? "Blocked" : "Active" }
                            : u,
                        ),
                      }))
                    }
                    className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy"
                  >
                    {user.status}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDb((current) => ({
                        ...current,
                        users: current.users.filter((u) => u.id !== user.id),
                      }))
                    }
                    className="rounded-xl border border-border bg-white p-2 text-crimson"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </PanelShell>
    </div>
  );
}

function BackupPanel({ db }: { db: DB }) {
  const importRef = useRef<HTMLInputElement>(null);
  const exportBackup = () => {
    const backupFile = new File([JSON.stringify(db, null, 2)], "loyola-backup.json", {
      type: "application/json",
    });
    const url = URL.createObjectURL(backupFile);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loyola-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    audit("Backup exported", "Admin");
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as DB;
      setDb(() => parsed);
      audit("Backup imported", "Admin");
    } catch {
      alert("Invalid backup file.");
    }
  };
  return (
    <PanelShell title="Backup & restore" kicker="Safety">
      <input
        ref={importRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => void importBackup(e.target.files?.[0])}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={exportBackup}
          className="rounded-2xl border border-border bg-secondary/40 p-6 text-left transition-smooth hover:border-gold hover:bg-white"
        >
          <Download className="h-8 w-8 text-gold" />
          <p className="mt-4 font-bold text-navy">Download backup</p>
          <p className="mt-1 text-sm text-muted-foreground">Export full local database.</p>
        </button>
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          className="rounded-2xl border border-border bg-secondary/40 p-6 text-left transition-smooth hover:border-gold hover:bg-white"
        >
          <Upload className="h-8 w-8 text-gold" />
          <p className="mt-4 font-bold text-navy">Restore backup</p>
          <p className="mt-1 text-sm text-muted-foreground">Import JSON backup file.</p>
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Reset the local demo database?")) resetDb();
          }}
          className="rounded-2xl border border-red-200 bg-red-50 p-6 text-left text-red-700 transition-smooth hover:bg-red-100"
        >
          <Trash2 className="h-8 w-8" />
          <p className="mt-4 font-bold">Reset local data</p>
          <p className="mt-1 text-sm">Use only if the demo data is broken.</p>
        </button>
      </div>
    </PanelShell>
  );
}

function SettingsPanel({ db }: { db: DB }) {
  const socials = db.websiteContent.socials || {};
  const update = (patch: Partial<DB["websiteContent"]>) =>
    setDb((current) => ({ ...current, websiteContent: { ...current.websiteContent, ...patch } }));
  const updateSocial = (key: keyof DB["websiteContent"]["socials"], value: string) =>
    setDb((current) => ({
      ...current,
      websiteContent: {
        ...current.websiteContent,
        socials: {
          ...(current.websiteContent.socials || {}),
          [key]: value,
        },
      },
    }));

  const anthemCoverRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const socialFields: {
    key: keyof DB["websiteContent"]["socials"];
    label: string;
    placeholder: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      key: "facebook",
      label: "Facebook",
      placeholder: "https://www.facebook.com/your-page",
      Icon: Facebook,
    },
    {
      key: "instagram",
      label: "Instagram",
      placeholder: "https://www.instagram.com/your-profile",
      Icon: Instagram,
    },
    {
      key: "youtube",
      label: "YouTube",
      placeholder: "https://www.youtube.com/@your-channel",
      Icon: Youtube,
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      placeholder: "https://www.linkedin.com/school/your-page",
      Icon: Linkedin,
    },
    {
      key: "whatsapp",
      label: "WhatsApp channel",
      placeholder: "https://whatsapp.com/channel/...",
      Icon: MessageCircle,
    },
  ];

  const handleAnthemCoverUpload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const optimized = await compressImage(file, 1200, 0.78);
      const url = await uploadFileToBackend("site-images/settings", file);
      update({ anthemVideoCoverImage: url });
      audit("Anthem cover photo updated", "Admin");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PanelShell title="System settings" kicker="School information">
        <div className="grid gap-4 lg:grid-cols-2">
          <TextInput
            value={db.websiteContent.schoolName}
            onChange={(e) => update({ schoolName: e.target.value })}
            placeholder="School name"
          />
          <TextInput
            value={db.websiteContent.tagline}
            onChange={(e) => update({ tagline: e.target.value })}
            placeholder="Tagline"
          />
          <TextInput
            value={db.websiteContent.phone}
            onChange={(e) => update({ phone: e.target.value })}
            placeholder="Phone"
          />
          <TextInput
            value={db.websiteContent.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="Email"
          />
          <TextInput
            value={db.websiteContent.address}
            onChange={(e) => update({ address: e.target.value })}
            placeholder="Address"
          />
          <TextInput
            value={db.websiteContent.officeHours}
            onChange={(e) => update({ officeHours: e.target.value })}
            placeholder="Office Hours (e.g. Mon-Fri, 8AM - 3PM)"
          />
          <TextInput
            value={db.websiteContent.mapUrl}
            onChange={(e) => update({ mapUrl: e.target.value })}
            placeholder="Google Maps share URL"
          />
          <TextInput
            value={db.websiteContent.mapEmbedUrl}
            onChange={(e) => update({ mapEmbedUrl: e.target.value })}
            placeholder="Google Maps embed URL"
          />
          <TextInput
            value={db.websiteContent.seo.metaTitle}
            onChange={(e) =>
              setDb((current) => ({
                ...current,
                websiteContent: {
                  ...current.websiteContent,
                  seo: { ...current.websiteContent.seo, metaTitle: e.target.value },
                },
              }))
            }
            placeholder="SEO title"
          />
        </div>
      </PanelShell>

      <PanelShell title="Footer text" kicker="Public website">
        <div className="grid gap-4 lg:grid-cols-2">
          <TextInput
            value={db.websiteContent.footerCopyrightLine}
            onChange={(e) => update({ footerCopyrightLine: e.target.value })}
            placeholder="Copyright line"
          />
          <TextInput
            value={db.websiteContent.developerCredit}
            onChange={(e) => update({ developerCredit: e.target.value })}
            placeholder="Developer credit"
          />
          <TextInput
            value={db.websiteContent.footerLegalLine}
            onChange={(e) => update({ footerLegalLine: e.target.value })}
            placeholder="Optional legal line"
          />
          <TextInput
            value={db.websiteContent.footerText}
            onChange={(e) => update({ footerText: e.target.value })}
            placeholder="Footer description"
          />
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          These lines appear in the public website footer below the existing links and contact
          details.
        </p>
      </PanelShell>

      <PanelShell title="Social media links" kicker="Footer icons">
        <div className="grid gap-4 lg:grid-cols-2">
          {socialFields.map(({ key, label, placeholder, Icon }) => (
            <label key={key} className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                <Icon className="h-4 w-4 text-gold" />
                {label}
              </span>
              <TextInput
                value={socials[key] || ""}
                onChange={(e) => updateSocial(key, e.target.value)}
                placeholder={placeholder}
              />
            </label>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Add full links here, then publish. Icons with empty links stay hidden on the public
          website.
        </p>
      </PanelShell>

      <PanelShell title="College Anthem" kicker="Identity">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <TextInput
              value={db.websiteContent.anthemVideoUrl}
              onChange={(e) => update({ anthemVideoUrl: e.target.value })}
              placeholder="YouTube link (e.g. https://www.youtube.com/watch?v=...)"
            />
            <div className="rounded-2xl border border-border bg-white p-3">
              {db.websiteContent.anthemVideoCoverImage ? (
                <div className="relative mb-3">
                  <img
                    src={db.websiteContent.anthemVideoCoverImage}
                    alt="Anthem cover"
                    className="aspect-video w-full rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => update({ anthemVideoCoverImage: "" })}
                    className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-crimson shadow"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="mb-3 grid aspect-video place-items-center rounded-xl bg-secondary text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {uploading ? "Uploading…" : "No anthem cover photo"}
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload cover photo"}
                <input
                  ref={anthemCoverRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => void handleAnthemCoverUpload(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>
          <div className="flex items-center justify-center rounded-3xl bg-navy p-6 text-center text-white">
            <div>
              <Video className="mx-auto h-12 w-12 text-gold" />
              <h4 className="mt-4 font-serif text-2xl font-bold">Official Anthem Media</h4>
              <p className="mt-2 text-sm text-white/70">
                Manage the ceremonial video link and its cover photo used on the College Anthem &
                Hymn page.
              </p>
            </div>
          </div>
        </div>
      </PanelShell>
    </div>
  );
}

function SecurityPanel({ db }: { db: DB }) {
  return (
    <PanelShell title="Security center" kicker="Protection">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [
            "Role-based admin access",
            "Website admins can manage website tools. Master Admin controls owner-only management panels.",
          ],
          [
            "Upload validation",
            "Images are JPG/PNG up to 5 MB. Videos are MP4/MOV/WebM up to 500 MB.",
          ],
          [
            "Protected controls",
            "Users & Roles, Activity Logs, and Settings are locked to Master Admin only. Backup stays limited to Super Admin and Master Admin.",
          ],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-border bg-secondary/40 p-5">
            <ShieldCheck className="h-7 w-7 text-gold" />
            <p className="mt-4 font-bold text-navy">{title}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {db.auditLogs.slice(0, 0).map((log) => (
          <div key={log.id} className="rounded-2xl bg-white px-4 py-3 text-sm shadow-soft">
            <b>{log.action}</b>
            <span className="text-muted-foreground">
              {" "}
              · {log.user} · {new Date(log.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function StoragePanel() {
  return <StorageOverview />;
}

function formatActor(log: DB["auditLogs"][number]) {
  const name = log.actorName || "";
  const email = log.actorEmail || (log.user.includes("@") ? log.user : "");
  if (name && email && name !== email) return `${name} (${email})`;
  return email || name || log.user || "System";
}

function formatRole(role?: Role) {
  if (!role) return "System";
  const labels: Record<Role, string> = {
    masteradmin: "Master Admin",
    superadmin: "Super Admin",
    website_admin: "Website Admin",
    master_edutrack_admin: "Master EduTrack Admin",
    eduzync_admin: "EduTrack Admin",
    staff_admin: "Staff Admin",
    teacher: "Teacher",
    student: "Student",
    parent: "Parent",
  };
  return labels[role] || role;
}

function auditSeverity(log: DB["auditLogs"][number]) {
  const text = `${log.area || ""} ${log.action}`.toLowerCase();
  if (
    text.includes("delete") ||
    text.includes("reset") ||
    text.includes("backup") ||
    text.includes("setting") ||
    text.includes("user") ||
    text.includes("role")
  ) {
    return "Protected";
  }
  if (text.includes("publish") || text.includes("approval") || text.includes("saved")) {
    return "Change";
  }
  if (text.includes("sign") || text.includes("login")) return "Auth";
  return "Info";
}

function auditTarget(action: string) {
  const [, target] = action.split(/:(.+)/);
  return target?.trim() || "";
}

function shortUserAgent(value?: string) {
  if (!value) return "Not captured";
  return value.length > 160 ? `${value.slice(0, 160)}...` : value;
}

function ActivityPanel({ db }: { db: DB }) {
  const [query, setQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const logs = db.auditLogs;
  const areas = [...new Set(logs.map((log) => log.area || "General"))].sort();
  const roles = [...new Set(logs.map((log) => log.actorRole || "system"))].sort();
  const normalizedQuery = query.trim().toLowerCase();
  const filteredLogs = logs.filter((log) => {
    const area = log.area || "General";
    const role = log.actorRole || "system";
    const haystack = [
      log.id,
      log.user,
      log.action,
      log.actorEmail,
      log.actorName,
      log.actorRole,
      log.area,
      log.requestPath,
      log.source,
      log.timeZone,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      (areaFilter === "all" || area === areaFilter) &&
      (roleFilter === "all" || role === roleFilter) &&
      (!normalizedQuery || haystack.includes(normalizedQuery))
    );
  });
  const loginCount = logs.filter(
    (log) =>
      (log.area || log.action).toLowerCase().includes("login") ||
      log.action.toLowerCase().includes("signed"),
  ).length;
  const protectedCount = logs.filter((log) => auditSeverity(log) === "Protected").length;
  const uniqueActors = new Set(logs.map((log) => log.actorEmail || log.user)).size;
  const areaCounts = areas.map((area) => ({
    area,
    count: logs.filter((log) => (log.area || "General") === area).length,
  }));
  const actorCounts = [...new Set(logs.map((log) => log.actorEmail || log.user || "System"))]
    .map((actor) => ({
      actor,
      count: logs.filter((log) => (log.actorEmail || log.user || "System") === actor).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <PanelShell title="Activity logs" kicker="Full user history">
      <div className="mb-5 grid gap-3 md:grid-cols-5">
        <div className="rounded-2xl border border-border bg-secondary/35 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            Total records
          </p>
          <p className="mt-2 text-2xl font-black text-navy">{db.auditLogs.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/35 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            Login records
          </p>
          <p className="mt-2 text-2xl font-black text-navy">{loginCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/35 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            Protected events
          </p>
          <p className="mt-2 text-2xl font-black text-navy">{protectedCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/35 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            Unique actors
          </p>
          <p className="mt-2 text-2xl font-black text-navy">{uniqueActors}</p>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/35 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            Latest activity
          </p>
          <p className="mt-2 text-sm font-black text-navy">
            {db.auditLogs[0] ? new Date(db.auditLogs[0].createdAt).toLocaleString() : "No activity"}
          </p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 rounded-2xl border border-border bg-white p-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            Search logs
          </span>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-xl border border-border bg-secondary/40 py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:border-gold"
              placeholder="Search actor, action, path, role..."
            />
          </div>
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            Area
          </span>
          <select
            value={areaFilter}
            onChange={(event) => setAreaFilter(event.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm font-bold text-navy outline-none focus:border-gold"
          >
            <option value="all">All areas</option>
            {areas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            Role
          </span>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm font-bold text-navy outline-none focus:border-gold"
          >
            <option value="all">All roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role === "system" ? "System" : formatRole(role as Role)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-crimson">
            Activity by area
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {areaCounts.map((item) => (
              <div key={item.area} className="rounded-xl bg-secondary/40 px-3 py-2">
                <p className="text-xs font-black text-navy">{item.area}</p>
                <p className="mt-1 text-sm font-bold text-muted-foreground">{item.count} events</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-crimson">
            Top actors
          </p>
          <div className="mt-4 space-y-2">
            {actorCounts.map((item) => (
              <div
                key={item.actor}
                className="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-3 py-2"
              >
                <span className="min-w-0 truncate text-xs font-black text-navy">{item.actor}</span>
                <span className="shrink-0 text-sm font-bold text-muted-foreground">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredLogs.map((log) => {
          const severity = auditSeverity(log);
          const target = auditTarget(log.action);
          return (
            <div key={log.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gold/20 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-navy">
                    {log.area || "General"}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                    {formatRole(log.actorRole)}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${
                      severity === "Protected"
                        ? "bg-crimson/10 text-crimson"
                        : severity === "Change"
                          ? "bg-gold/25 text-navy"
                          : severity === "Auth"
                            ? "bg-blue-100 text-blue-900"
                            : "bg-emerald-100 text-emerald-900"
                    }`}
                  >
                    {severity}
                  </span>
                </div>
                <p className="mt-3 text-sm font-black text-navy">{formatActor(log)}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {formatActor(log)} {log.action.charAt(0).toLowerCase()}
                  {log.action.slice(1)}.
                </p>
                <div className="mt-4 grid gap-3 text-xs md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Event ID
                    </p>
                    <p className="mt-1 break-all font-semibold text-navy">{log.id}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Actor email
                    </p>
                    <p className="mt-1 break-all font-semibold text-navy">
                      {log.actorEmail || log.user || "System"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Path
                    </p>
                    <p className="mt-1 break-all font-semibold text-navy">
                      {log.requestPath || "Not captured"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Target
                    </p>
                    <p className="mt-1 break-all font-semibold text-navy">
                      {target || "No target"}
                    </p>
                  </div>
                </div>
                <details className="mt-3 rounded-xl border border-border bg-white px-3 py-2 text-xs">
                  <summary className="cursor-pointer font-black uppercase tracking-[0.14em] text-navy">
                    Advanced event details
                  </summary>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <p>
                      <b>Raw action:</b> {log.action}
                    </p>
                    <p>
                      <b>Source:</b> {log.source || "legacy"}
                    </p>
                    <p>
                      <b>Timezone:</b> {log.timeZone || "Not captured"}
                    </p>
                    <p>
                      <b>ISO time:</b> {log.createdAt}
                    </p>
                  </div>
                  <p className="mt-2 break-all">
                    <b>User agent:</b> {shortUserAgent(log.userAgent)}
                  </p>
                  <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-[#081324] p-3 text-[11px] leading-5 text-white">
                    {JSON.stringify(log, null, 2)}
                  </pre>
                </details>
              </div>
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
          );
        })}
        {filteredLogs.length === 0 && (
          <p className="rounded-2xl border border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
            No activity matches the current filters.
          </p>
        )}
      </div>
    </PanelShell>
  );
}

export function AdminPortal() {
  const db = useDb();
  const auth = useAuth();
  const [active, setActive] = useState<PanelId>(() => getInitialAdminPanel());
  const lastLoggedPanel = useRef<PanelId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "publishing" | "submitting">(
    "idle",
  );
  const [saveMessage, setSaveMessage] = useState("Ready");
  const [saveMessageTone, setSaveMessageTone] = useState<"info" | "error">("info");
  const visibleNavGroups = navGroupsForRole(auth.user?.role);
  const visiblePanelIds = visibleNavGroups.flatMap((group) => group.items.map((item) => item.id));
  const fallbackPanel = visiblePanelIds[0] || "dashboard";
  const activePanel = visiblePanelIds.includes(active) ? active : fallbackPanel;
  const needsApproval = auth.user?.role === "website_admin";

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      window.location.href = "/login";
    }
  }, [auth.loading, auth.user]);

  useEffect(() => {
    if (!auth.user || !adminRoles.includes(auth.user.role)) return;
    if (window.location.pathname !== "/admin") {
      window.history.replaceState(null, "", `/admin${window.location.search}${window.location.hash}`);
    }
  }, [auth.user]);

  useEffect(() => {
    if (auth.user && !visiblePanelIds.includes(active)) {
      setActive(fallbackPanel);
      replaceAdminPanelUrl(fallbackPanel);
    }
  }, [active, auth.user, fallbackPanel, visiblePanelIds]);

  useEffect(() => {
    if (!auth.user || lastLoggedPanel.current === activePanel) return;
    const label = visibleNavGroups
      .flatMap((group) => group.items)
      .find((item) => item.id === activePanel)?.label;
    if (label) audit(`Opened ${label} panel`, auth.user.email);
    lastLoggedPanel.current = activePanel;
  }, [activePanel, auth.user, visibleNavGroups]);

  if (auth.loading || !auth.user) {
    return (
      <BrandedLoader
        title="Opening Loyola Digital Studio"
        subtitle="Loading website tools and admin panels"
      />
    );
  }

  if (!adminRoles.includes(auth.user.role)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3ff] px-6">
        <section className="max-w-lg rounded-2xl border border-border bg-white p-8 text-center shadow-soft">
          <ShieldCheck className="mx-auto h-10 w-10 text-crimson" />
          <h1 className="mt-4 font-serif text-4xl font-bold text-navy">Access Denied</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Website Studio is available only for Website Admin, Super Admin, and Master Admin
            accounts.
          </p>
          <a
            href="/portal"
            className="mt-6 inline-flex rounded-xl bg-navy px-5 py-3 text-sm font-black text-white"
          >
            Back to portal
          </a>
        </section>
      </main>
    );
  }

  const logout = async () => {
    audit("Admin signed out", auth.user?.email || "admin");
    await setAuth(null);
    window.location.href = "/login";
  };

  const saveDraft = async () => {
    setSavingState("saving");
    audit("Admin draft saved", auth.user?.email || "admin");
    const result = await saveDbNow();
    if (result.remote) {
      setSaveMessageTone("info");
      setSaveMessage(
        result.contentVersion
          ? `Saved to cloud as version ${result.contentVersion}`
          : "Saved to cloud",
      );
    } else if (result.localOnly) {
      setSaveMessageTone("info");
      setSaveMessage("Draft saved locally. Submit for approval when ready.");
    } else {
      setSaveMessageTone("error");
      setSaveMessage(
        `Cloud save failed${result.error ? `: ${result.error}` : "."} Local draft kept on this device.`,
      );
    }
    setSavingState("idle");
  };

  const publish = async () => {
    if (needsApproval) {
      setSavingState("submitting");
      audit("Admin submitted website changes for approval", auth.user?.email || "admin");
      await saveDbNow();
      try {
        const request = await createPublishRequest(db);
        setSaveMessageTone("info");
        setSaveMessage(`Submitted for approval as request #${request.id}`);
      } catch (caught) {
        setSaveMessageTone("error");
        setSaveMessage(
          `Approval submit failed: ${
            caught instanceof Error ? caught.message : "Request could not be created."
          }`,
        );
      }
      setSavingState("idle");
      return;
    }

    setSavingState("publishing");
    audit("Admin published changes", auth.user?.email || "admin");
    const result = await publishDbNow();
    if (result.remote) {
      setSaveMessageTone("info");
      setSaveMessage(
        result.contentVersion
          ? `Published to cloud as version ${result.contentVersion}`
          : "Published to cloud",
      );
    } else {
      setSaveMessageTone("error");
      setSaveMessage(
        `Server publish failed${result.error ? `: ${result.error}` : "."} Public website was not updated.`,
      );
    }
    setSavingState("idle");
  };

  return (
    <div data-admin-panel className="flex min-h-screen bg-[#eef3f8] text-slate-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-navy text-white shadow-2xl transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="border-b border-white/10 p-6">
          <a
            href="/"
            aria-label="Open public website"
            title="Open public website"
            className="flex items-center gap-3 rounded-2xl outline-none transition-smooth hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-gold"
          >
            <img
              src="/loyola-crest.jpg"
              alt="Loyola crest"
              className="h-12 w-12 rounded-full border-2 border-gold bg-white object-contain p-1"
            />
            <div>
              <p className="font-serif text-2xl font-bold text-gold-light">Loyola Studio</p>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
                Professional CMS
              </p>
            </div>
          </a>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {visibleNavGroups.map((group) => (
            <div key={group.label} className="py-2">
              <p className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActive(item.id);
                      replaceAdminPanelUrl(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition-smooth ${activePanel === item.id ? "bg-gold text-navy shadow-gold" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
                  >
                    <item.icon className="h-5 w-5" /> {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-border bg-white/90 px-4 py-4 shadow-soft backdrop-blur md:px-8">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl border border-border bg-white p-2 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-crimson">
                  {formatRole(auth.user.role)} access
                </p>
                <h1 className="font-serif text-3xl font-bold text-navy">
                  {visibleNavGroups.flatMap((g) => g.items).find((i) => i.id === activePanel)?.label ||
                    "Dashboard"}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.open("/", "_blank", "noopener,noreferrer")}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-black text-navy"
              >
                <MonitorSmartphone className="h-4 w-4" /> Preview
              </button>
              <button
                type="button"
                disabled={savingState !== "idle"}
                onClick={() => void saveDraft()}
                className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> {savingState === "saving" ? "Saving" : "Save"}
              </button>
              <button
                type="button"
                disabled={savingState !== "idle"}
                onClick={() => void publish()}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-black text-navy disabled:opacity-60"
              >
                {needsApproval ? (
                  <Send className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}{" "}
                {savingState === "publishing"
                  ? "Publishing"
                  : savingState === "submitting"
                    ? "Submitting"
                    : needsApproval
                      ? "Submit for Approval"
                      : "Publish"}
              </button>
              <span
                className={`inline-flex max-w-full items-center rounded-xl border px-3 py-2.5 text-xs font-black ${
                  saveMessageTone === "error"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-border bg-white text-muted-foreground"
                }`}
              >
                {saveMessage}
              </span>
            </div>
          </div>
        </header>
        <main className="p-4 md:p-8">
          {activePanel === "dashboard" && (
            <DashboardPanel db={db} setActive={setActive} availablePanels={visiblePanelIds} />
          )}
          {activePanel === "studio" && <WebsiteEditor />}
          {activePanel === "approvals" &&
            (auth.user.role === "website_admin" ? (
              <MyPublishRequestsPanel />
            ) : (
              <PublishApprovalsPanel />
            ))}
          {activePanel === "pages" && <PagesPanel db={db} />}
          {activePanel === "content" && <ContentPanel db={db} />}
          {activePanel === "media" && <MediaPanel db={db} />}
          {activePanel === "storage" && <StoragePanel />}
          {activePanel === "design" && <DesignPanel db={db} />}
          {activePanel === "messages" && <MessagesPanel db={db} />}
          {activePanel === "users" && <UsersPanel db={db} />}
          {activePanel === "security" && <SecurityPanel db={db} />}
          {activePanel === "activity" && <ActivityPanel db={db} />}
          {activePanel === "backup" && <BackupPanel db={db} />}
          {activePanel === "settings" && <SettingsPanel db={db} />}
        </main>
      </div>
    </div>
  );
}

export function DeferredWebsiteEditor() {
  return <WebsiteEditor />;
}

export type CrudKey =
  | "news"
  | "events"
  | "students"
  | "teachers"
  | "parents"
  | "users"
  | "classes"
  | "subjects"
  | "fees"
  | "assignments"
  | "library"
  | "transport";

export function CrudPanel(_props?: { collection?: CrudKey; kicker?: string; title?: string }) {
  return <WebsiteEditor />;
}

function PhotoCropper({
  file,
  onCancel,
  onCrop,
}: {
  file: File;
  onCancel: () => void;
  onCrop: (dataUrl: string) => void;
}) {
  const [imageSrc, setImageSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setImageSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setSaving(true);
    const image = await loadImage(imageSrc);
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 600;
    exportCanvas.height = 600;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      600,
      600,
    );
    onCrop(exportCanvas.toDataURL("image/png"));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h3 className="font-serif text-2xl font-bold text-navy">Adjust Profile Photo</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag the photo into the square and zoom for a clean crop.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-navy"
            aria-label="Close cropper"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative h-[62vh] min-h-[420px] bg-black sm:h-[68vh]">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              minZoom={1}
              maxZoom={4}
              aspect={1}
              cropShape="rect"
              showGrid
              objectFit="contain"
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              classes={{
                containerClassName: "staff-photo-cropper",
                cropAreaClassName: "staff-photo-crop-area",
              }}
            />
          )}
        </div>

        <div className="grid gap-4 border-t border-border px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
          <label className="flex items-center gap-4">
            <span className="w-12 text-xs font-black uppercase text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-2 flex-1 accent-gold"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="min-w-32 rounded-xl border border-border bg-white px-5 py-3 text-sm font-bold text-navy hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="min-w-40 rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white shadow-soft hover:bg-navy/90 disabled:opacity-60"
            >
              {saving ? "Uploading..." : "Crop & Upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function StaffPanel({ db }: { db: DB }) {
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "profiles"
    | "add"
    | "attendance"
    | "leave"
    | "documents"
    | "notices"
    | "roles"
    | "audit"
  >("dashboard");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  const [formNameTitle, setFormNameTitle] = useState("Mr.");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("Academic Staff");
  const [formSection, setFormSection] = useState("Middle");
  const [formStatus, setFormStatus] = useState("Active");
  const [formPosition, setFormPosition] = useState("Normal Teacher");
  const [formClasses, setFormClasses] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formQuals, setFormQuals] = useState("");
  const [formResp, setFormResp] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formAccountEnabled, setFormAccountEnabled] = useState(true);
  const [formAccountEmail, setFormAccountEmail] = useState("");
  const [formAccountPassword, setFormAccountPassword] = useState("");
  const [savingStaff, setSavingStaff] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [attendanceForm, setAttendanceForm] = useState({
    staffId: "",
    date: new Date().toISOString().slice(0, 10),
    status: "Present" as "Present" | "Absent" | "Late" | "Excused",
    note: "",
  });
  const [leaveForm, setLeaveForm] = useState({
    staffId: "",
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    type: "Casual Leave",
    status: "Pending" as const,
    note: "",
  });
  const [documentForm, setDocumentForm] = useState({
    staffId: "",
    title: "",
    category: "Certificate",
  });
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    body: "",
    audience: "All Staff",
    status: "Draft" as "Draft" | "Published",
  });
  const [roleForm, setRoleForm] = useState({
    staffId: "",
    role: "",
    websitePlace: "All Teachers Directory",
    displayOrder: 1,
    visible: true,
  });
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  // Auto-switch type/section for top-level exclusive positions
  useEffect(() => {
    if (
      formPosition === "The Archbishop of Colombo" ||
      formPosition === "General Manager of Catholic Private Schools"
    ) {
      setFormType("Non-Academic Staff");
      setFormSection("Administration");
    }
  }, [formPosition]);

  const autoPlacementMap: Record<string, string> = {
    "The Archbishop of Colombo": "Top Administration",
    "General Manager of Catholic Private Schools": "Top Administration",
    "Rector / Principal": "Top Administration",
    "Vice Rector": "Top Administration",
    "Vice Rector / Prefect of Games": "Top Administration",
    "Principal of Primary School": "Top Administration",
    "Priest in Charge": "Top Administration",
    "Priest in Charge & Sectional Head of Upper School": "Top Administration",
    "Vice Principal - Primary School": "Vice Principals",
    "Vice Principal - Middle School": "Vice Principals",
    "Vice Principal - Upper School": "Vice Principals",
    "Vice Principal - Advanced Level": "Vice Principals",
    "Sectional Head - Primary School": "Sectional Heads",
    "Sectional Head - Middle School": "Sectional Heads",
    "Sectional Head - Upper School": "Sectional Heads",
    "Sectional Head - Advanced Level": "Sectional Heads",
    "Assistant Sectional Head - Primary School": "Sectional Heads",
    "Assistant Sectional Head - Middle School": "Sectional Heads",
    "Assistant Sectional Head - Upper School": "Sectional Heads",
    "Assistant Sectional Head - Advanced Level": "Sectional Heads",
    "Subjects Head - Primary School": "Subject Heads",
    "Subjects Head - Middle School": "Subject Heads",
    "Subjects Head - Upper School": "Subject Heads",
    "Subjects Head - Advanced Level": "Subject Heads",
    "Grade 1 Head": "Grade Heads",
    "Grade 2 Head": "Grade Heads",
    "Grade 3 Head": "Grade Heads",
    "Grade 4 Head": "Grade Heads",
    "Grade 5 Head": "Grade Heads",
    "Grade 6 Head": "Grade Heads",
    "Grade 7 Head": "Grade Heads",
    "Grade 8 Head": "Grade Heads",
    "Grade 9 Head": "Grade Heads",
    "Grade 10 Head": "Grade Heads",
    "Grade 11 Head": "Grade Heads",
    "Science / Maths Stream Head": "A/L Stream Heads",
    "Commerce Stream Head": "A/L Stream Heads",
    "Arts Stream Head": "A/L Stream Heads",
    "Technology Stream Head": "A/L Stream Heads",
    "Sinhala Coordinator - Primary School": "Primary School Subject Coordinators",
    "Mathematics Coordinator - Primary School": "Primary School Subject Coordinators",
    "Environmental Studies Coordinator - Primary School": "Primary School Subject Coordinators",
    "English Coordinator - Primary School": "Primary School Subject Coordinators",
    "Roman Catholicism Coordinator - Primary School": "Primary School Subject Coordinators",
    "Sinhala Coordinator - Middle School": "Middle School Subject Coordinators",
    "Mathematics Coordinator - Middle School": "Middle School Subject Coordinators",
    "Science Coordinator - Middle School": "Middle School Subject Coordinators",
    "English Coordinator - Middle School": "Middle School Subject Coordinators",
    "History / Geography / Civics Coordinator - Middle School":
      "Middle School Subject Coordinators",
    "Roman Catholicism Coordinator - Middle School": "Middle School Subject Coordinators",
    "Health Science & Physical Education Coordinator - Middle School":
      "Middle School Subject Coordinators",
    "Practical & Technical Skills Coordinator - Middle School":
      "Middle School Subject Coordinators",
    "Sinhala Coordinator - Upper School": "Upper School Subject Coordinators",
    "Mathematics Coordinator - Upper School": "Upper School Subject Coordinators",
    "Science Coordinator - Upper School": "Upper School Subject Coordinators",
    "English Coordinator - Upper School": "Upper School Subject Coordinators",
    "Roman Catholicism Coordinator - Upper School": "Upper School Subject Coordinators",
    "Health Science & Physical Education Coordinator - Upper School":
      "Upper School Subject Coordinators",
    "Practical & Technical Skills Coordinator - Upper School": "Upper School Subject Coordinators",
    "Arts Coordinator": "Aesthetic Subject Coordinators",
    "Dancing Coordinator": "Aesthetic Subject Coordinators",
    "Eastern Music Coordinator": "Aesthetic Subject Coordinators",
    "Western Music Coordinator": "Aesthetic Subject Coordinators",
    "Science / Maths Coordinator - Advanced Level": "Advanced Level Subject Coordinators",
    "Commerce Coordinator - Advanced Level": "Advanced Level Subject Coordinators",
    "Arts Coordinator - Advanced Level": "Advanced Level Subject Coordinators",
    "English Medium Coordinator - Primary School": "English Medium Coordinators",
    "English Medium Coordinator - Middle School": "English Medium Coordinators",
    "English Medium Coordinator - Upper School": "English Medium Coordinators",
    "English Medium Coordinator - Advanced Level": "English Medium Coordinators",
    "Class Teacher 1 - A": "Class Teachers - Primary School",
    "Class Teacher 1 - B": "Class Teachers - Primary School",
    "Class Teacher 1 - C": "Class Teachers - Primary School",
    "Class Teacher 1 - E": "Class Teachers - Primary School",
    "Class Teacher 2 - A": "Class Teachers - Primary School",
    "Class Teacher 2 - B": "Class Teachers - Primary School",
    "Class Teacher 2 - C": "Class Teachers - Primary School",
    "Class Teacher 2 - D": "Class Teachers - Primary School",
    "Class Teacher 2 - E": "Class Teachers - Primary School",
    "Class Teacher 2 - F": "Class Teachers - Primary School",
    "Class Teacher 3 - A": "Class Teachers - Primary School",
    "Class Teacher 3 - B": "Class Teachers - Primary School",
    "Class Teacher 3 - C": "Class Teachers - Primary School",
    "Class Teacher 3 - D": "Class Teachers - Primary School",
    "Class Teacher 4 - A": "Class Teachers - Primary School",
    "Class Teacher 4 - B": "Class Teachers - Primary School",
    "Class Teacher 4 - C": "Class Teachers - Primary School",
    "Class Teacher 4 - D": "Class Teachers - Primary School",
    "Class Teacher 5 - A": "Class Teachers - Primary School",
    "Class Teacher 5 - B": "Class Teachers - Primary School",
    "Class Teacher 5 - C": "Class Teachers - Primary School",
    "Class Teacher 5 - D": "Class Teachers - Primary School",
    "Class Teacher 6 - A": "Class Teachers - Middle School",
    "Class Teacher 6 - B": "Class Teachers - Middle School",
    "Class Teacher 6 - C": "Class Teachers - Middle School",
    "Class Teacher 6 - D": "Class Teachers - Middle School",
    "Class Teacher 7 - A": "Class Teachers - Middle School",
    "Class Teacher 7 - B": "Class Teachers - Middle School",
    "Class Teacher 7 - C": "Class Teachers - Middle School",
    "Class Teacher 7 - D": "Class Teachers - Middle School",
    "Class Teacher 7 - E": "Class Teachers - Middle School",
    "Class Teacher 8 - B": "Class Teachers - Middle School",
    "Class Teacher 8 - C": "Class Teachers - Middle School",
    "Class Teacher 8 - D": "Class Teachers - Middle School",
    "Class Teacher 8 - E": "Class Teachers - Middle School",
    "Class Teacher 9 - A": "Class Teachers - Upper School",
    "Class Teacher 9 - C": "Class Teachers - Upper School",
    "Class Teacher 9 - D": "Class Teachers - Upper School",
    "Class Teacher 9 - E": "Class Teachers - Upper School",
    "Class Teacher 10 - A": "Class Teachers - Upper School",
    "Class Teacher 10 - B": "Class Teachers - Upper School",
    "Class Teacher 10 - C": "Class Teachers - Upper School",
    "Class Teacher 10 - D": "Class Teachers - Upper School",
    "Class Teacher 10 - E": "Class Teachers - Upper School",
    "Class Teacher 11 - A": "Class Teachers - Upper School",
    "Class Teacher 11 - B": "Class Teachers - Upper School",
    "Class Teacher 11 - C": "Class Teachers - Upper School",
    "Class Teacher 11 - D": "Class Teachers - Upper School",
    "Class Teacher 11 - E": "Class Teachers - Upper School",
    "12 Maths (SM)": "Class Teachers - Advance Level Section",
    "12 Bio (SM)": "Class Teachers - Advance Level Section",
    "12 Maths / Bio (EM)": "Class Teachers - Advance Level Section",
    "12 Commerce - A (SM)": "Class Teachers - Advance Level Section",
    "12 Commerce - B (SM)": "Class Teachers - Advance Level Section",
    "12 Commerce (EM)": "Class Teachers - Advance Level Section",
    "12 Arts": "Class Teachers - Advance Level Section",
    "13 Maths (SM)": "Class Teachers - Advance Level Section",
    "13 Bio (SM)": "Class Teachers - Advance Level Section",
    "13 Maths / Bio (EM)": "Class Teachers - Advance Level Section",
    "13 Commerce - A (SM)": "Class Teachers - Advance Level Section",
    "13 Commerce - B (SM)": "Class Teachers - Advance Level Section",
    "13 Arts - A (SM)": "Class Teachers - Advance Level Section",
    "13 Arts - B (SM)": "Class Teachers - Advance Level Section",
    "13 Arts (EM)": "Class Teachers - Advance Level Section",
    "13 Technology": "Class Teachers - Advance Level Section",
    "Subject Teacher - Primary School": "Subject Teachers - Primary School",
    "Subject Teacher - Middle School": "Subject Teachers - Middle School",
    "Subject Teacher - Upper School": "Subject Teachers - Upper School",
    "Subject Teacher - Advanced Level": "Subject Teachers - Advanced Level",
    "Special Need Resource Unit Teacher": "Special Academic Positions",
    "Visiting Teacher": "Special Academic Positions",
    Counsellor: "Special Academic Positions",
    "Administrative Secretary": "Administrative Department",
    Secretary: "Administrative Department",
    "Head - Academic Office": "Academic Department",
    "Academic Officer": "Academic Department",
    Accountant: "Financial Department",
    "Accounts Assistant": "Financial Department",
    "Manager - IT": "IT Department",
    "Assistant IT": "IT Department",
    Receptionist: "Other Non-Academic Positions",
    "Bookstore Clerk": "Other Non-Academic Positions",
    "Bookstore Assistant": "Other Non-Academic Positions",
    "Office Assistant": "Other Non-Academic Positions",
    "Maintenance Supervisor": "Other Non-Academic Positions",
    "Nursing Officer": "Other Non-Academic Positions",
    Librarian: "Other Non-Academic Positions",
    "Supportive Staff Member": "Supportive Staff",
    "Normal Teacher": "All Teachers Directory",
  };

  const getAutoCategory = (pos: string) => autoPlacementMap[pos] || "All Teachers Directory";

  const handlePhotoUpload = async (dataUrl: string, file: File) => {
    try {
      const imageUrl = await uploadDataUrlToBackend("staff-profiles", dataUrl, file.name);
      setFormImage(imageUrl);
      setCropFile(null);
    } catch (err) {
      window.alert("Upload failed.");
    }
  };

  const generateStaffId = (teachers: Teacher[]) => {
    // Filter for IDs matching our pattern LCS-XXXX
    const pattern = /^LCS-\d{4}$/;
    const ids = teachers
      .map((t) => t.id)
      .filter((id) => pattern.test(id))
      .map((id) => parseInt(id.split("-")[1]));

    const nextNum = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    return `LCS-${nextNum.toString().padStart(4, "0")}`;
  };

  const saveTeacherAccount = async (teacherId: string, fullName: string) => {
    if (!formAccountEnabled) return null;
    const email = formAccountEmail.trim().toLowerCase();
    const password = formAccountPassword;

    if (!email) throw new Error("Teacher portal email is required.");
    if (!editingId && !password)
      throw new Error("Temporary password is required for a new account.");

    const response = await fetch(`${API_URL}/api/staff-accounts`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        teacherId,
        name: fullName,
        email,
        password,
        status: "Active",
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not create teacher account.");
    return payload.user as { id: string; email: string; status: string };
  };

  const saveStaff = async () => {
    if (!formName) return window.alert("Name is required");
    const category = getAutoCategory(formPosition);
    const fullName = `${formNameTitle ? formNameTitle + " " : ""}${formName}`.trim();
    const staffId = editingId || generateStaffId(db.teachers);

    setSavingStaff(true);
    try {
      if (!formAccountEnabled && editingId) {
        await fetch(`${API_URL}/api/staff-accounts/${encodeURIComponent(editingId)}`, {
          method: "DELETE",
          headers: authHeaders(),
        }).catch(() => null);
      }
      const account = await saveTeacherAccount(staffId, fullName);

      setDb((current) => {
        let newTeachers = [...current.teachers];

        // If an exclusive visible position is Active, hide existing staff with that same position.
        const isUniqueRole =
          formPosition === "The Archbishop of Colombo" ||
          formPosition === "General Manager of Catholic Private Schools" ||
          formPosition === "Rector / Principal" ||
          formPosition.includes("Rector") ||
          formPosition.includes("Principal") ||
          formPosition.includes("Head") ||
          formPosition.includes("Coordinator") ||
          formPosition === "Accountant" ||
          formPosition === "Librarian" ||
          formPosition === "Counsellor";

        if (formStatus === "Active" && isUniqueRole) {
          newTeachers = newTeachers.map((t) => {
            if (t.id !== staffId && t.position === formPosition && t.status === "Active") {
              return { ...t, status: "Hidden" };
            }
            return t;
          });
        }

        const accountPatch = formAccountEnabled
          ? {
              accountEmail: account?.email || formAccountEmail.trim().toLowerCase(),
              accountUserId: account?.id || staffId,
              accountStatus: account?.status || "Active",
            }
          : {
              accountEmail: "",
              accountUserId: "",
              accountStatus: "Disabled",
            };

        if (editingId) {
          newTeachers = newTeachers.map((t) =>
            t.id === editingId
              ? {
                  ...t,
                  name: fullName,
                  type: formType,
                  section: formSection,
                  status: formStatus,
                  position: formPosition,
                  classes: formClasses,
                  subject: formSubject,
                  qualifications: formQuals,
                  responsibilities: formResp,
                  image: formImage,
                  category,
                  ...accountPatch,
                }
              : t,
          );
          audit(`Staff member updated: ${fullName}`, "Admin");
        } else {
          newTeachers.push({
            id: staffId,
            name: fullName,
            type: formType,
            section: formSection,
            status: formStatus,
            position: formPosition,
            classes: formClasses,
            subject: formSubject,
            qualifications: formQuals,
            responsibilities: formResp,
            image: formImage,
            category,
            ...accountPatch,
          });
          audit(`Staff member added: ${fullName} (${staffId})`, "Admin");
        }
        return { ...current, teachers: newTeachers };
      });

      setFormAccountPassword("");
      resetForm();
      setActiveTab("profiles");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not save staff member.");
    } finally {
      setSavingStaff(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormNameTitle("Mr.");
    setFormName("");
    setFormType("Academic Staff");
    setFormSection("Middle");
    setFormStatus("Active");
    setFormPosition("Normal Teacher");
    setFormClasses("");
    setFormSubject("");
    setFormQuals("");
    setFormResp("");
    setFormImage("");
    setFormAccountEnabled(true);
    setFormAccountEmail("");
    setFormAccountPassword("");
  };

  const editStaff = (t: Teacher) => {
    setEditingId(t.id);
    const titleMatch = t.name.match(/^(Mr\.|Mrs\.|Ms\.|Dr\.|Rev\.\sFr\.|Bro\.)\s(.*)/);
    if (titleMatch) {
      setFormNameTitle(titleMatch[1]);
      setFormName(titleMatch[2]);
    } else {
      setFormNameTitle("");
      setFormName(t.name);
    }
    setFormType(t.type || "Academic Staff");
    setFormSection(t.section || "Middle");
    setFormStatus(t.status || "Active");
    setFormPosition(t.position || "Normal Teacher");
    setFormClasses(t.classes || "");
    setFormSubject(t.subject || "");
    setFormQuals(t.qualifications || "");
    setFormResp(t.responsibilities || "");
    setFormImage(t.image || "");
    setFormAccountEnabled(Boolean(t.accountEmail || t.accountUserId));
    setFormAccountEmail(t.accountEmail || "");
    setFormAccountPassword("");
    setActiveTab("add");
  };

  const deleteStaff = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this staff member?")) return;
    try {
      await fetch(`${API_URL}/api/staff-accounts/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
    } catch (error) {
      console.error("Could not disable linked teacher account", error);
    }
    setDb((current) => ({
      ...current,
      teachers: current.teachers.filter((t) => t.id !== id),
    }));
    audit(`Staff member deleted: ${id}`, "Admin");
  };

  const filteredTeachers = db.teachers.filter((t) => {
    if (typeFilter !== "All" && t.type !== typeFilter) return false;
    if (
      search &&
      !t.name.toLowerCase().includes(search.toLowerCase()) &&
      !(t.position || "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const allTypes = ["All", "Academic Staff", "Non-Academic Staff", "Supportive Staff"];
  const staffName = (id: string) => db.teachers.find((teacher) => teacher.id === id)?.name || id;
  const staffOptions = db.teachers.filter((teacher) => teacher.status !== "Inactive");

  const saveAttendance = () => {
    if (!attendanceForm.staffId) return window.alert("Select a staff member.");
    setDb((current) => ({
      ...current,
      staffAttendance: [
        {
          id: makeId("STA"),
          ...attendanceForm,
        },
        ...(current.staffAttendance || []),
      ],
    }));
    audit(`Staff attendance recorded: ${staffName(attendanceForm.staffId)}`, "Admin");
    setAttendanceForm({ ...attendanceForm, note: "" });
  };

  const saveLeaveRequest = () => {
    if (!leaveForm.staffId) return window.alert("Select a staff member.");
    setDb((current) => ({
      ...current,
      staffLeaveRequests: [
        {
          id: makeId("SLR"),
          ...leaveForm,
        },
        ...(current.staffLeaveRequests || []),
      ],
    }));
    audit(`Staff leave request recorded: ${staffName(leaveForm.staffId)}`, "Admin");
    setLeaveForm({ ...leaveForm, note: "" });
  };

  const updateLeaveStatus = (id: string, status: "Pending" | "Approved" | "Rejected") => {
    setDb((current) => ({
      ...current,
      staffLeaveRequests: (current.staffLeaveRequests || []).map((request) =>
        request.id === id ? { ...request, status } : request,
      ),
    }));
    audit(`Staff leave request ${status.toLowerCase()}: ${id}`, "Admin");
  };

  const uploadStaffDocument = async (file?: File) => {
    if (!documentForm.staffId) return window.alert("Select a staff member.");
    if (!documentForm.title.trim()) return window.alert("Document title is required.");
    if (!file) return window.alert("Choose a document or image file.");

    setUploadingDocument(true);
    try {
      const fileUrl = await uploadFileToBackend("staff-documents", file);
      setDb((current) => ({
        ...current,
        staffDocuments: [
          {
            id: makeId("SDOC"),
            staffId: documentForm.staffId,
            title: documentForm.title.trim(),
            category: documentForm.category,
            fileUrl,
            uploadedAt: new Date().toISOString(),
          },
          ...(current.staffDocuments || []),
        ],
      }));
      audit(`Staff document uploaded: ${documentForm.title}`, "Admin");
      setDocumentForm({ ...documentForm, title: "" });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Document upload failed.");
    } finally {
      setUploadingDocument(false);
    }
  };

  const saveStaffNotice = () => {
    if (!noticeForm.title.trim()) return window.alert("Notice title is required.");
    setDb((current) => ({
      ...current,
      staffNotices: [
        {
          id: makeId("SNO"),
          title: noticeForm.title.trim(),
          body: noticeForm.body.trim(),
          audience: noticeForm.audience,
          status: noticeForm.status,
          createdAt: new Date().toISOString(),
        },
        ...(current.staffNotices || []),
      ],
    }));
    audit(`Staff notice saved: ${noticeForm.title}`, "Admin");
    setNoticeForm({ ...noticeForm, title: "", body: "" });
  };

  const saveRoleAssignment = () => {
    if (!roleForm.staffId) return window.alert("Select a staff member.");
    if (!roleForm.role.trim()) return window.alert("Role title is required.");
    setDb((current) => ({
      ...current,
      staffRoles: [
        {
          id: makeId("SROLE"),
          staffId: roleForm.staffId,
          role: roleForm.role.trim(),
          websitePlace: roleForm.websitePlace,
          displayOrder: roleForm.displayOrder,
          visible: roleForm.visible,
        },
        ...(current.staffRoles || []),
      ],
    }));
    audit(`Staff role assigned: ${roleForm.role}`, "Admin");
    setRoleForm({ ...roleForm, role: "", displayOrder: roleForm.displayOrder + 1 });
  };

  const exportStaffCsv = () => {
    const headers = [
      "id",
      "name",
      "position",
      "type",
      "category",
      "section",
      "subject",
      "classes",
      "status",
      "image",
    ];
    const escapeCsv = (value?: string) => `"${String(value || "").replace(/"/g, '""')}"`;
    const rows = db.teachers.map((teacher) =>
      headers.map((key) => escapeCsv(String(teacher[key as keyof Teacher] || ""))).join(","),
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `loyola-staff-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importStaffCsv = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const [headerLine, ...rowLines] = text.split(/\r?\n/).filter(Boolean);
      const headers = headerLine.split(",").map((header) => header.trim());
      const parseRow = (line: string) =>
        line
          .match(/("([^"]|"")*"|[^,]*)(,|$)/g)
          ?.map((cell) =>
            cell
              .replace(/,$/, "")
              .replace(/^"|"$/g, "")
              .replace(/""/g, '"')
              .trim(),
          )
          .filter((_, index, cells) => index < cells.length - 1 || line.endsWith(",")) || [];

      const imported = rowLines
        .map((line) => {
          const cells = parseRow(line);
          const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
          if (!row.name) return null;
          return {
            id: row.id || generateStaffId(db.teachers),
            name: row.name,
            position: row.position || "",
            type: row.type || "Academic Staff",
            category: row.category || getAutoCategory(row.position || "Normal Teacher"),
            section: row.section || "",
            subject: row.subject || "",
            classes: row.classes || "",
            status: row.status || "Active",
            image: row.image || "",
            qualifications: "",
            responsibilities: "",
          } as Teacher;
        })
        .filter(Boolean) as Teacher[];

      if (imported.length === 0) return window.alert("No staff rows found in the CSV file.");
      setDb((current) => {
        const byId = new Map(current.teachers.map((teacher) => [teacher.id, teacher]));
        imported.forEach((teacher) => byId.set(teacher.id, { ...byId.get(teacher.id), ...teacher }));
        return { ...current, teachers: Array.from(byId.values()) };
      });
      audit(`Imported ${imported.length} staff CSV row${imported.length === 1 ? "" : "s"}`, "Admin");
      window.alert(`Imported ${imported.length} staff row${imported.length === 1 ? "" : "s"}.`);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {cropFile && (
        <PhotoCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onCrop={(url) => void handlePhotoUpload(url, cropFile)}
        />
      )}
      <PanelShell
        title="Staff Management"
        kicker="Team"
        action={
          <div className="flex gap-2">
            <a
              href="/staff"
              target="_blank"
              className="rounded-xl bg-navy px-4 py-2 text-sm font-black text-white inline-flex items-center gap-2"
            >
              <Briefcase className="h-4 w-4" /> Full Staff System
            </a>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setActiveTab("add");
              }}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-black text-navy inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add Staff Member
            </button>
            <a
              href="/college-staff"
              target="_blank"
              className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-black text-navy inline-flex items-center gap-2"
            >
              Preview Staff Page
            </a>
          </div>
        }
      >
        <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4">
          {(
            [
              { id: "dashboard", label: "Staff Dashboard" },
              { id: "profiles", label: "Staff Profiles" },
              { id: "add", label: editingId ? "Edit Staff Member" : "Add Staff Member" },
              { id: "attendance", label: "Attendance" },
              { id: "leave", label: "Leave Requests" },
              { id: "documents", label: "Documents" },
              { id: "notices", label: "Notices" },
              { id: "roles", label: "Roles" },
              { id: "audit", label: "Audit History" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${activeTab === tab.id ? "bg-navy text-white" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4 stagger-children">
              <StatCard icon={Users} label="Total Staff" value={db.teachers.length} />
              <StatCard
                icon={GraduationCap}
                label="Academic Staff"
                value={db.teachers.filter((t) => t.type === "Academic Staff" || !t.type).length}
              />
              <StatCard
                icon={Briefcase}
                label="Non-Academic"
                value={db.teachers.filter((t) => t.type === "Non-Academic Staff").length}
              />
              <StatCard
                icon={User}
                label="Supportive"
                value={db.teachers.filter((t) => t.type === "Supportive Staff").length}
              />
            </div>
            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <h3 className="font-bold text-navy mb-4">Recently Added Staff</h3>
              <div className="space-y-2">
                {[...db.teachers]
                  .reverse()
                  .slice(0, 5)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="hover-lift flex items-center justify-between rounded-xl bg-secondary/50 p-3 transition-smooth"
                    >
                      <div className="flex items-center gap-3">
                        {t.image ? (
                          <img
                            src={t.image}
                            className="h-10 w-10 rounded-full object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-navy text-white">
                            <User className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-navy text-sm">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.position || t.type}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => editStaff(t)}
                        className="text-xs font-bold text-crimson hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "profiles" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <TextInput
                placeholder="Search by name or position..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold"
              >
                {allTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={exportStaffCsv}
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-bold text-navy hover:border-gold"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <label className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-white hover:bg-navy/90">
                <Upload className="h-4 w-4" /> Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    importStaffCsv(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-4">Staff ID</th>
                    <th className="p-4">Staff Member</th>
                    <th className="p-4">Position</th>
                    <th className="p-4">Display Place</th>
                    <th className="p-4">Section</th>
                    <th className="p-4">Portal Account</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTeachers.map((t) => (
                    <tr key={t.id} className="transition-smooth hover:bg-secondary/30">
                      <td className="p-4 font-mono text-xs font-bold text-slate-500">{t.id}</td>
                      <td className="p-4 flex items-center gap-3">
                        {t.image ? (
                          <img
                            src={t.image}
                            className="h-10 w-10 rounded-full object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-navy text-white">
                            <User className="h-5 w-5" />
                          </div>
                        )}
                        <span className="font-bold text-navy">{t.name}</span>
                      </td>
                      <td className="p-4 text-muted-foreground">{t.position || "-"}</td>
                      <td className="p-4 text-xs font-bold text-crimson">
                        {t.category || "All Teachers Directory"}
                      </td>
                      <td className="p-4 text-muted-foreground">{t.section || "-"}</td>
                      <td className="p-4 text-xs">
                        {t.accountEmail ? (
                          <div>
                            <p className="font-bold text-navy">{t.accountEmail}</p>
                            <p className="text-muted-foreground">
                              {t.accountStatus || "Active"} · {t.accountUserId || t.id}
                            </p>
                          </div>
                        ) : (
                          <span className="font-bold text-muted-foreground">Not created</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-black ${t.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                        >
                          {t.status || "Active"}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => editStaff(t)}
                          className="text-navy hover:text-gold mr-2 font-bold text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteStaff(t.id)}
                          className="text-crimson hover:text-red-700 font-bold text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredTeachers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No staff found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "attendance" && (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <h3 className="font-serif text-xl font-bold text-navy">Record Attendance</h3>
              <div className="mt-4 grid gap-3">
                <select
                  value={attendanceForm.staffId}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, staffId: e.target.value })}
                  className="h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy"
                >
                  <option value="">Select staff member</option>
                  {staffOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
                <TextInput
                  type="date"
                  value={attendanceForm.date}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                />
                <select
                  value={attendanceForm.status}
                  onChange={(e) =>
                    setAttendanceForm({
                      ...attendanceForm,
                      status: e.target.value as "Present" | "Absent" | "Late" | "Excused",
                    })
                  }
                  className="h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy"
                >
                  <option>Present</option>
                  <option>Absent</option>
                  <option>Late</option>
                  <option>Excused</option>
                </select>
                <TextArea
                  rows={3}
                  placeholder="Note"
                  value={attendanceForm.note}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, note: e.target.value })}
                />
                <button
                  type="button"
                  onClick={saveAttendance}
                  className="rounded-xl bg-navy px-4 py-3 text-sm font-bold text-white"
                >
                  Save Attendance
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Staff</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(db.staffAttendance || []).slice(0, 100).map((row) => (
                    <tr key={row.id}>
                      <td className="p-4 font-semibold text-navy">{row.date}</td>
                      <td className="p-4">{staffName(row.staffId)}</td>
                      <td className="p-4 text-xs font-black text-crimson">{row.status}</td>
                      <td className="p-4 text-muted-foreground">{row.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "leave" && (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <h3 className="font-serif text-xl font-bold text-navy">Leave Request</h3>
              <div className="mt-4 grid gap-3">
                <select
                  value={leaveForm.staffId}
                  onChange={(e) => setLeaveForm({ ...leaveForm, staffId: e.target.value })}
                  className="h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy"
                >
                  <option value="">Select staff member</option>
                  {staffOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <TextInput
                    type="date"
                    value={leaveForm.fromDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })}
                  />
                  <TextInput
                    type="date"
                    value={leaveForm.toDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })}
                  />
                </div>
                <TextInput
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                />
                <TextArea
                  rows={3}
                  placeholder="Reason or note"
                  value={leaveForm.note}
                  onChange={(e) => setLeaveForm({ ...leaveForm, note: e.target.value })}
                />
                <button
                  type="button"
                  onClick={saveLeaveRequest}
                  className="rounded-xl bg-navy px-4 py-3 text-sm font-bold text-white"
                >
                  Save Leave Request
                </button>
              </div>
            </div>
            <div className="grid gap-3">
              {(db.staffLeaveRequests || []).map((request) => (
                <div key={request.id} className="rounded-2xl border border-border bg-white p-5 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-navy">{staffName(request.staffId)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {request.type} | {request.fromDate} to {request.toDate}
                      </p>
                      {request.note && <p className="mt-2 text-sm text-muted-foreground">{request.note}</p>}
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-black text-navy">
                      {request.status}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {(["Pending", "Approved", "Rejected"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateLeaveStatus(request.id, status)}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-navy hover:border-gold"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <h3 className="font-serif text-xl font-bold text-navy">Staff Documents</h3>
              <div className="mt-4 grid gap-3">
                <select
                  value={documentForm.staffId}
                  onChange={(e) => setDocumentForm({ ...documentForm, staffId: e.target.value })}
                  className="h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy"
                >
                  <option value="">Select staff member</option>
                  {staffOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
                <TextInput
                  placeholder="Document title"
                  value={documentForm.title}
                  onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
                />
                <TextInput
                  placeholder="Category"
                  value={documentForm.category}
                  onChange={(e) => setDocumentForm({ ...documentForm, category: e.target.value })}
                />
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-sm font-bold text-white">
                  <Upload className="h-4 w-4" /> {uploadingDocument ? "Uploading..." : "Upload File"}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadingDocument}
                    onChange={(event) => {
                      void uploadStaffDocument(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="grid gap-3">
              {(db.staffDocuments || []).map((doc) => (
                <a
                  key={doc.id}
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-border bg-white p-5 shadow-soft hover:border-gold"
                >
                  <p className="font-bold text-navy">{doc.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {staffName(doc.staffId)} | {doc.category}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}

        {activeTab === "notices" && (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <h3 className="font-serif text-xl font-bold text-navy">Staff Notice</h3>
              <div className="mt-4 grid gap-3">
                <TextInput
                  placeholder="Notice title"
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                />
                <TextArea
                  rows={4}
                  placeholder="Notice body"
                  value={noticeForm.body}
                  onChange={(e) => setNoticeForm({ ...noticeForm, body: e.target.value })}
                />
                <TextInput
                  value={noticeForm.audience}
                  onChange={(e) => setNoticeForm({ ...noticeForm, audience: e.target.value })}
                />
                <select
                  value={noticeForm.status}
                  onChange={(e) =>
                    setNoticeForm({ ...noticeForm, status: e.target.value as "Draft" | "Published" })
                  }
                  className="h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy"
                >
                  <option>Draft</option>
                  <option>Published</option>
                </select>
                <button
                  type="button"
                  onClick={saveStaffNotice}
                  className="rounded-xl bg-navy px-4 py-3 text-sm font-bold text-white"
                >
                  Save Notice
                </button>
              </div>
            </div>
            <div className="grid gap-3">
              {(db.staffNotices || []).map((notice) => (
                <div key={notice.id} className="rounded-2xl border border-border bg-white p-5 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-navy">{notice.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{notice.audience}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-black text-navy">
                      {notice.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{notice.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "roles" && (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <h3 className="font-serif text-xl font-bold text-navy">Role Assignment</h3>
              <div className="mt-4 grid gap-3">
                <select
                  value={roleForm.staffId}
                  onChange={(e) => setRoleForm({ ...roleForm, staffId: e.target.value })}
                  className="h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy"
                >
                  <option value="">Select staff member</option>
                  {staffOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
                <TextInput
                  placeholder="Role or position"
                  value={roleForm.role}
                  onChange={(e) => setRoleForm({ ...roleForm, role: e.target.value })}
                />
                <TextInput
                  placeholder="Website place"
                  value={roleForm.websitePlace}
                  onChange={(e) => setRoleForm({ ...roleForm, websitePlace: e.target.value })}
                />
                <TextInput
                  type="number"
                  min={1}
                  value={roleForm.displayOrder}
                  onChange={(e) =>
                    setRoleForm({ ...roleForm, displayOrder: Number(e.target.value || 1) })
                  }
                />
                <label className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-bold text-navy">
                  <input
                    type="checkbox"
                    checked={roleForm.visible}
                    onChange={(e) => setRoleForm({ ...roleForm, visible: e.target.checked })}
                  />
                  Visible on website
                </label>
                <button
                  type="button"
                  onClick={saveRoleAssignment}
                  className="rounded-xl bg-navy px-4 py-3 text-sm font-bold text-white"
                >
                  Save Role
                </button>
              </div>
            </div>
            <div className="grid gap-3">
              {(db.staffRoles || [])
                .slice()
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((role) => (
                  <div key={role.id} className="rounded-2xl border border-border bg-white p-5 shadow-soft">
                    <p className="font-bold text-navy">{staffName(role.staffId)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {role.role} | {role.websitePlace}
                    </p>
                    <p className="mt-2 text-xs font-black uppercase tracking-wider text-crimson">
                      Order {role.displayOrder} | {role.visible ? "Visible" : "Hidden"}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="grid gap-3">
            {db.auditLogs
              .filter((log) => /staff|teacher|attendance|leave|document|role/i.test(log.action))
              .slice(0, 100)
              .map((log) => (
                <div key={log.id} className="rounded-2xl border border-border bg-white p-5 shadow-soft">
                  <p className="font-bold text-navy">{log.action}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {log.actorName || log.actorEmail || log.user} |{" "}
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
          </div>
        )}

        {activeTab === "add" && (
          <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Profile Photo
              </p>
              <div className="rounded-2xl border border-border bg-white p-5 text-center text-sm shadow-soft">
                {formImage ? (
                  <>
                    <img
                      src={formImage}
                      className="mx-auto mb-4 h-40 w-40 rounded-full object-cover shadow-inner"
                      alt=""
                    />
                    <button
                      type="button"
                      onClick={() => setFormImage("")}
                      className="text-crimson font-bold hover:underline"
                    >
                      Remove Photo
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mx-auto mb-4 grid h-40 w-40 place-items-center rounded-full bg-secondary/50 border-2 border-dashed border-border text-muted-foreground">
                      <User className="h-16 w-16" />
                    </div>
                    <label className="cursor-pointer rounded-xl bg-secondary px-4 py-2 font-bold text-navy hover:bg-gold inline-block w-full">
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setCropFile(f);
                          e.target.value = "";
                        }}
                      />
                      Choose File
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-white p-6 shadow-soft">
                <h3 className="mb-4 font-serif text-xl font-bold text-navy border-b border-border pb-3">
                  Basic Details
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Name Title
                    </label>
                    <select
                      value={formNameTitle}
                      onChange={(e) => setFormNameTitle(e.target.value)}
                      className="w-full h-12 rounded-xl border border-border px-3 text-sm font-semibold text-navy outline-none focus:border-gold"
                    >
                      <option>Mr.</option>
                      <option>Mrs.</option>
                      <option>Ms.</option>
                      <option>Dr.</option>
                      <option>Rev. Fr.</option>
                      <option>Bro.</option>
                      <option value="">None</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Full Name
                    </label>
                    <TextInput
                      placeholder="E.g. Full name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Staff Type
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className="w-full h-12 rounded-xl border border-border px-3 text-sm font-semibold text-navy outline-none focus:border-gold"
                    >
                      <option>Academic Staff</option>
                      <option>Non-Academic Staff</option>
                      <option>Supportive Staff</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Section
                    </label>
                    <select
                      value={formSection}
                      onChange={(e) => setFormSection(e.target.value)}
                      className="w-full h-12 rounded-xl border border-border px-3 text-sm font-semibold text-navy outline-none focus:border-gold"
                    >
                      <option>Administration</option>
                      <option>Primary School</option>
                      <option>Middle School</option>
                      <option>Upper School</option>
                      <option>Advanced Level</option>
                      <option>Non-Academic Department</option>
                      <option>Supportive Staff</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white p-6 shadow-soft">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-navy">
                      Teacher Portal Account
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      Creates a separate login in the backend users table. Password is hashed and
                      never saved on the public staff profile.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-bold text-navy">
                    <input
                      type="checkbox"
                      checked={formAccountEnabled}
                      onChange={(e) => setFormAccountEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-navy"
                    />
                    Create login
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Login Email
                    </label>
                    <TextInput
                      type="email"
                      placeholder="teacher@loyola.local"
                      value={formAccountEmail}
                      disabled={!formAccountEnabled}
                      onChange={(e) => setFormAccountEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {editingId ? "New Password" : "Temporary Password"}
                    </label>
                    <TextInput
                      type="password"
                      placeholder={
                        editingId ? "Leave blank to keep old password" : "Minimum 6 characters"
                      }
                      value={formAccountPassword}
                      disabled={!formAccountEnabled}
                      onChange={(e) => setFormAccountPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white p-6 shadow-soft">
                <h3 className="mb-4 font-serif text-xl font-bold text-navy border-b border-border pb-3">
                  Position Details
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Position
                    </label>
                    <select
                      value={formPosition}
                      onChange={(e) => setFormPosition(e.target.value)}
                      className="w-full h-12 rounded-xl border border-border px-3 text-sm font-semibold text-navy outline-none focus:border-gold"
                    >
                      {Object.keys(autoPlacementMap).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Auto Display Place
                    </label>
                    <div className="flex h-12 w-full items-center rounded-xl border border-border bg-emerald-50 px-3 text-sm font-black text-emerald-700">
                      {getAutoCategory(formPosition)}
                    </div>
                    <p className="mt-1 text-[10px] uppercase font-bold text-muted-foreground">
                      Automatically chosen based on Position
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Grade/Classes
                    </label>
                    <TextInput
                      placeholder="E.g. Grade 1-5"
                      value={formClasses}
                      onChange={(e) => setFormClasses(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Subject
                    </label>
                    <select
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value)}
                      className="w-full h-12 rounded-xl border border-border px-3 text-sm font-semibold text-navy outline-none focus:border-gold"
                    >
                      <option value="">None / N/A</option>
                      <option>Sinhala</option>
                      <option>Mathematics</option>
                      <option>Science</option>
                      <option>English</option>
                      <option>Roman Catholicism</option>
                      <option>Commerce</option>
                      <option>Arts</option>
                      <option>Technology</option>
                      <option>Dancing</option>
                      <option>Eastern Music</option>
                      <option>Western Music</option>
                      <option>Health Science & Physical Education</option>
                      <option>Practical & Technical Skills</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white p-6 shadow-soft">
                <h3 className="mb-4 font-serif text-xl font-bold text-navy border-b border-border pb-3">
                  Professional Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Qualifications
                    </label>
                    <TextArea
                      rows={3}
                      placeholder="Type qualifications here..."
                      value={formQuals}
                      onChange={(e) => setFormQuals(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Other Responsibilities
                    </label>
                    <TextArea
                      rows={3}
                      placeholder="Type responsibilities here..."
                      value={formResp}
                      onChange={(e) => setFormResp(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-6">
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formStatus === "Active"}
                      onChange={(e) => setFormStatus(e.target.checked ? "Active" : "Hidden")}
                      className="h-4 w-4 rounded border-border text-navy"
                    />
                    <span className="text-sm font-bold text-navy">Publish Profile to Website</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border border-border bg-white px-6 py-3 text-sm font-bold text-navy hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingStaff}
                    onClick={() => void saveStaff()}
                    className="rounded-xl bg-navy px-6 py-3 text-sm font-bold text-white shadow-soft hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingStaff ? "Saving..." : editingId ? "Update Profile" : "Publish Staff"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </PanelShell>
    </div>
  );
}
