import { BrandedLoader } from "@/components/BrandedLoader";
import {
  useAuth,
  setAuth,
  audit,
  useDb,
  publishDbNow,
  saveDbNow,
  type Role,
  resetDb,
} from "@/lib/store";
import {
  Bell,
  Eye,
  HelpCircle,
  LogOut,
  Menu,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";

export interface NavGroup {
  label: string;
  items: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

export function PortalShell({
  role,
  title,
  groups,
  active,
  onActiveChange,
  children,
}: {
  role: Role;
  title: string;
  groups: NavGroup[];
  active: string;
  onActiveChange: (id: string) => void;
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const db = useDb();
  const [openMobile, setOpenMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const activeRef = useRef(active);
  const navFrame = useRef<number | null>(null);
  const pendingNav = useRef<string | null>(null);
  const [syncing, setSyncing] = useState<"idle" | "saving" | "publishing">("idle");
  const [syncMessage, setSyncMessage] = useState("Ready");
  const [syncTone, setSyncTone] = useState<"info" | "error">("info");
  const canDirectPublish = role === "masteradmin" || role === "superadmin";

  const searchableItems = groups.flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.label })),
  );
  const filteredItems =
    query.trim().length === 0
      ? []
      : searchableItems
          .filter((item) =>
            `${item.group} ${item.label}`.toLowerCase().includes(query.trim().toLowerCase()),
          )
          .slice(0, 6);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!auth.loading && (!auth.user || auth.user.role !== role)) {
      window.location.href = "/login";
    }
  }, [auth.loading, auth.user, role]);

  useEffect(() => {
    return () => {
      if (navFrame.current !== null) window.cancelAnimationFrame(navFrame.current);
    };
  }, []);

  const activateNav = useCallback(
    (id: string) => {
      if (id === activeRef.current) {
        if (openMobile) setOpenMobile(false);
        return;
      }

      pendingNav.current = id;
      if (navFrame.current !== null) return;

      navFrame.current = window.requestAnimationFrame(() => {
        const next = pendingNav.current;
        pendingNav.current = null;
        navFrame.current = null;

        if (next && next !== activeRef.current) {
          startTransition(() => onActiveChange(next));
        }
        setOpenMobile(false);
      });
    },
    [onActiveChange, openMobile],
  );

  const logout = async () => {
    audit(`${auth.user?.role} signed out`, auth.user?.email || "");
    await setAuth(null);
    window.location.href = "/login";
  };

  const saveDraft = async () => {
    setSyncing("saving");
    audit("Admin draft saved", auth.user?.email || "admin");
    const result = await saveDbNow();
    if (result.remote) {
      setSyncTone("info");
      setSyncMessage(
        result.contentVersion ? `Saved to cloud v${result.contentVersion}` : "Saved to cloud",
      );
    } else if (result.localOnly) {
      setSyncTone("info");
      setSyncMessage("Draft saved locally");
    } else {
      setSyncTone("error");
      setSyncMessage(
        `Cloud save failed${result.error ? `: ${result.error}` : "."} Local draft kept.`,
      );
    }
    setSyncing("idle");
  };

  const publishChanges = async () => {
    if (!canDirectPublish) {
      setSyncTone("error");
      setSyncMessage("Direct publish requires master or super admin access");
      return;
    }

    setSyncing("publishing");
    audit("Admin changes published", auth.user?.email || "admin");
    const result = await publishDbNow();
    if (result.remote) {
      setSyncTone("info");
      setSyncMessage(
        result.contentVersion ? `Published v${result.contentVersion}` : "Published to cloud",
      );
    } else {
      setSyncTone("error");
      setSyncMessage(
        `Server publish failed${result.error ? `: ${result.error}` : "."} Public site was not updated.`,
      );
    }
    setSyncing("idle");
  };

  const openPreview = () => {
    window.open("/", "_blank", "noopener,noreferrer");
  };

  const createBackup = () => {
    const payload = JSON.stringify(db, null, 2);
    const backupFile = new File([payload], "loyola-backup.json", { type: "application/json" });
    const url = URL.createObjectURL(backupFile);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `loyola-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    audit("Local backup exported", auth.user?.email || "admin");
  };

  const openHelp = () => {
    window.open("/contact", "_blank", "noopener,noreferrer");
  };

  const openNotifications = () => {
    const target = searchableItems.find((item) => item.id === "messages") ?? searchableItems[0];
    if (target) activateNav(target.id);
  };

  const handleMainScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    setHeaderScrolled(event.currentTarget.scrollTop > 8);
  }, []);

  if (auth.loading) {
    return (
      <BrandedLoader
        title="Checking your session"
        subtitle="Please wait while your portal session is checked"
      />
    );
  }

  if (!auth.user) {
    return <BrandedLoader title="Redirecting to login" subtitle="Your session was not found" />;
  }

  const logoImage = db.websiteContent.logoImage || "/loyola-crest.jpg";

  return (
    <div data-admin-panel className="flex h-screen overflow-hidden bg-[#edf2fb] text-[#172033]">

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#07215a] text-white shadow-[4px_0_32px_-8px_rgba(7,33,90,0.55)] transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${openMobile ? "translate-x-0 animate-slide-in-left" : "-translate-x-full"}`}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-5">
          <a href="/" className="group flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full bg-[#ffe06d]/30 blur-md transition-smooth group-hover:bg-[#ffe06d]/50" />
              <img
                src={logoImage}
                alt="Loyola"
                className="relative h-9 w-9 rounded-full border-2 border-[#ffe06d]/70 bg-white object-contain p-0.5 transition-smooth group-hover:border-[#ffe06d]"
              />
            </div>
            <div className="min-w-0">
              <span className="block truncate font-serif text-[17px] font-bold leading-none text-[#ffe06d]">
                Loyola Studio
              </span>
              <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.2em] text-[#7ca3d8]/70">
                {title}
              </span>
            </div>
          </a>
          <button
            type="button"
            onClick={() => setOpenMobile(false)}
            className="shrink-0 rounded p-1 text-white/50 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          {groups.map((g) => (
            <div key={g.label} className="mb-1">
              <p className="mb-1 mt-3 px-3 text-[9.5px] font-black uppercase tracking-[0.22em] text-[#7ca3d8]/45 first:mt-0">
                {g.label}
              </p>
              <ul className="space-y-0.5">
                {g.items.map((i) => {
                  const isActive = i.id === active;
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => activateNav(i.id)}
                        className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-smooth ${
                          isActive
                            ? "bg-[#ffe06d]/15 text-[#ffe06d]"
                            : "text-[#7ca3d8] hover:bg-white/6 hover:text-white"
                        }`}
                      >
                        {/* Active left accent */}
                        {isActive && (
                          <span className="portal-nav-active-bar" />
                        )}
                        <i.icon
                          className={`relative z-10 h-4 w-4 shrink-0 transition-smooth ${isActive ? "text-[#ffe06d]" : "group-hover:text-white"}`}
                        />
                        <span className="relative z-10 truncate">{i.label}</span>
                        {isActive && (
                          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffe06d]" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-white/8 px-3 pb-5 pt-4 space-y-1">
          <button
            type="button"
            onClick={openHelp}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-[#7ca3d8] transition-smooth hover:bg-white/6 hover:text-white"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            Help & Support
          </button>

          {/* User card */}
          <div className="mt-1 flex items-center gap-3 rounded-xl bg-white/6 px-3 py-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ffe06d] font-serif text-sm font-bold text-[#241a00]">
              {auth.user.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white leading-tight">
                {auth.user.name}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[#7ca3d8]/70">
                {auth.user.role}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sign out"
              className="shrink-0 rounded p-1.5 text-[#7ca3d8] transition-smooth hover:bg-white/8 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Top bar */}
        <header
          className={`flex h-[60px] shrink-0 items-center justify-between gap-3 border-b px-5 transition-all duration-200 lg:px-6 ${
            headerScrolled
              ? "border-[#b8ccf0] bg-[#edf2fb]/95 shadow-[0_8px_32px_-16px_rgba(7,33,90,0.25)] backdrop-blur-xl"
              : "border-[#d0dcf5] bg-[#edf2fb]"
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setOpenMobile(true)}
              className="shrink-0 rounded-lg p-2 text-[#3a5898] hover:bg-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Search */}
            <div className="relative hidden w-full max-w-sm md:block lg:max-w-md">
              <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#6b87c0]" />
              <input
                id="portal-search"
                name="portalSearch"
                placeholder="Search panels…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const first = filteredItems[0];
                  if (first) { activateNav(first.id); setQuery(""); }
                }}
                className="w-full rounded-lg border border-[#c8d8f5] bg-white/80 py-2 pr-3 pl-9 text-[13px] text-[#172033] placeholder-[#8ba5d4] outline-none transition-smooth focus:border-[#806900] focus:bg-white focus:ring-2 focus:ring-[#806900]/20"
              />
              {filteredItems.length > 0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-[#c8d8f5] bg-white shadow-[0_16px_48px_-16px_rgba(7,33,90,0.3)]">
                  {filteredItems.map((item) => (
                    <button
                      key={`${item.group}-${item.id}`}
                      type="button"
                      onClick={() => { activateNav(item.id); setQuery(""); }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] font-medium text-[#07215a] transition-smooth hover:bg-[#edf2fb]"
                    >
                      <span>{item.label}</span>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-[#6b87c0]">
                        {item.group}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right controls */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openPreview}
              title="Open public website"
              className="hidden h-8 w-8 place-items-center rounded-lg text-[#3a5898] transition-smooth hover:bg-white hover:text-[#07215a] md:grid"
            >
              <Eye className="h-4 w-4" />
            </button>

            {(["website_admin", "eduzync_admin", "superadmin", "masteradmin"] as Role[]).includes(role) && (
              <button
                type="button"
                onClick={() => { if (confirm("Reset local portal data?")) resetDb(); }}
                title="Reset local data"
                className="hidden h-8 items-center gap-1.5 rounded-lg border border-[#c8d8f5] bg-white px-3 text-[12px] text-[#6b87c0] transition-smooth hover:text-[#07215a] md:flex"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            )}

            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={syncing !== "idle"}
              className="hidden h-8 items-center gap-1.5 rounded-lg border border-[#c8d8f5] bg-white px-3 text-[12px] font-semibold text-[#07215a] transition-smooth hover:border-[#07215a]/30 hover:shadow-sm disabled:opacity-50 lg:flex"
            >
              <Save className="h-3.5 w-3.5" />
              {syncing === "saving" ? "Saving…" : "Save"}
            </button>

            {canDirectPublish && (
              <button
                type="button"
                onClick={() => void publishChanges()}
                disabled={syncing !== "idle"}
                className="h-8 items-center gap-1.5 rounded-lg bg-[#806900] px-4 text-[12px] font-bold text-white shadow-[0_4px_16px_-4px_rgba(128,105,0,0.6)] transition-smooth hover:bg-[#6f5b00] hover:shadow-md disabled:opacity-50 flex"
              >
                {syncing === "publishing" ? "Publishing…" : "Publish"}
              </button>
            )}

            {/* Sync status */}
            <span
              className={`hidden max-w-[160px] truncate rounded-lg border px-2.5 py-1.5 text-[11px] font-medium xl:inline-flex ${
                syncTone === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-[#c8d8f5] bg-white text-[#6b87c0]"
              }`}
              title={syncMessage}
            >
              {syncMessage}
            </span>

            {/* Notifications */}
            <button
              type="button"
              onClick={openNotifications}
              className="portal-notification-button relative grid h-8 w-8 place-items-center rounded-lg text-[#3a5898] transition-smooth hover:bg-white hover:text-[#07215a]"
              title="Messages"
            >
              <Bell className="portal-notification-icon h-4 w-4" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#ffe06d] ring-2 ring-[#edf2fb]" />
            </button>

            {/* User chip */}
            <div className="hidden items-center gap-2.5 border-l border-[#d0dcf5] pl-3 xl:flex">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#07215a] font-serif text-[12px] font-bold text-[#ffe06d]">
                {auth.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div className="text-right">
                <p className="text-[13px] font-semibold leading-none text-[#172033]">{auth.user.name}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-[#6b87c0]">{title}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          onScroll={handleMainScroll}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#e8f0fe] p-5 md:p-7 xl:p-8"
        >
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {openMobile && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpenMobile(false)}
        />
      )}
    </div>
  );
}

export function PageTitle({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {kicker}
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-normal text-navy md:text-5xl">
          {title}
        </h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={`rounded-lg border ${accent ? "border-[#ffe06d]/80 bg-gradient-to-br from-[#ffe06d]/22 to-white" : "border-[#d6e0f8] bg-white"} p-5 shadow-[0_18px_44px_-34px_rgb(8_39_102_/0.38)]`}
    >
      {Icon && (
        <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${accent ? "bg-[#ffe06d]/25" : "bg-[#eef2ff]"}`}>
          <Icon className={`h-[18px] w-[18px] ${accent ? "text-[#806900]" : "text-[#07215a]"}`} />
        </div>
      )}
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-serif text-3xl font-semibold text-navy">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#d6e0f8] bg-white shadow-[0_18px_44px_-34px_rgb(8_39_102_/0.38)]">
      <header className="flex items-center justify-between border-b border-[#e6edfb] px-6 py-4">
        <h2 className="font-serif text-lg font-semibold text-navy">{title}</h2>
        {action}
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  empty,
}: {
  columns: { key: keyof T | string; label: string; render?: (row: T) => React.ReactNode }[];
  rows: T[];
  empty?: string;
}) {
  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{empty || "No records yet."}</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e6edfb] text-left text-xs uppercase tracking-wider text-muted-foreground">
            {columns.map((c) => (
              <th key={String(c.key)} className="px-3 py-3 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[#e6edfb] last:border-0 hover:bg-[#f3f7ff]">
              {columns.map((c) => (
                <td key={String(c.key)} className="px-3 py-3 align-middle">
                  {c.render ? c.render(r) : String(c.key in r ? (r[c.key as keyof T] ?? "") : "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "gold";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[#eef3ff] text-[#355174]",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-navy",
    danger: "bg-destructive/15 text-destructive",
    gold: "bg-gold/15 text-navy border border-gold/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
