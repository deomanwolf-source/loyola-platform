import { BrandedLoader } from "@/components/BrandedLoader";
import { useAuth, setAuth, audit, useDb, saveDbNow, type Role, resetDb } from "@/lib/store";
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
    const result = await saveDbNow();
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

  return (
    <div data-admin-panel className="flex h-screen overflow-hidden bg-[#eef3ff] text-[#172033]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#08286f] py-8 text-white shadow-xl transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${openMobile ? "translate-x-0 animate-slide-in-left" : "-translate-x-full"}`}
      >
        <div className="mb-8 flex items-center justify-between px-6">
          <a href="/" className="flex items-center gap-4">
            <span className="grid h-10 w-10 place-items-center rounded bg-[#ffe06d] text-[#08286f]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-serif text-2xl font-bold leading-none text-[#ffe06d]">
                Loyola Studio
              </span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-[#9eb4ef]">
                Admin Panel
              </span>
            </span>
          </a>
          <button
            type="button"
            onClick={() => setOpenMobile(false)}
            className="text-white/70 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-1 px-2">
          {groups.map((g) => (
            <div key={g.label} className="py-1">
              <p className="px-4 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9eb4ef]/55">
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
                        className={`group relative mx-0 flex w-full items-center gap-4 overflow-hidden rounded-lg px-4 py-3 text-sm font-semibold transition-smooth ${isActive ? "translate-x-1 bg-[#806900] text-white shadow-[0_14px_28px_-20px_rgb(0_0_0_/0.65)]" : "text-[#9eb4ef] hover:translate-x-1 hover:bg-[#123b8f] hover:text-white"}`}
                      >
                        {isActive ? (
                          <span className="portal-nav-active-bar" />
                        ) : (
                          <span className="absolute left-0 top-1/2 h-0 w-[3px] -translate-y-1/2 rounded-r bg-[#ffe06d]/0 transition-all duration-200 group-hover:h-1/2 group-hover:bg-[#ffe06d]/70" />
                        )}
                        <i.icon className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                        <span className="relative z-10">{i.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-auto space-y-2 border-t border-[#9eb4ef]/15 px-2 pt-4">
          <button
            type="button"
            onClick={createBackup}
            className="mx-2 flex h-11 w-[calc(100%-1rem)] items-center justify-center gap-2 rounded-lg bg-[#ffe06d] px-3 text-xs font-bold text-[#241a00] shadow-[0_12px_28px_-20px_rgb(0_0_0_/0.7)]"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Create Backup
          </button>
          <button
            type="button"
            onClick={openHelp}
            className="flex w-full items-center gap-4 rounded-lg px-4 py-3 text-sm font-semibold text-[#9eb4ef] hover:bg-[#123b8f] hover:text-white"
          >
            <HelpCircle className="h-4 w-4" /> Help Center
          </button>
          <div className="mx-2 flex items-center gap-3 rounded-lg bg-[#123b8f] px-3 py-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#ffe06d] font-serif text-sm text-[#241a00]">
              {auth.user.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{auth.user.name}</p>
              <p className="truncate text-[10px] uppercase tracking-[0.15em] text-[#9eb4ef]">
                {auth.user.role}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sign out"
              className="text-white/60 hover:text-gold"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={`flex h-16 items-center justify-between border-b bg-[#eef3ff]/88 px-6 backdrop-blur-xl transition-all duration-300 ${
            headerScrolled
              ? "border-[#aebfe8] shadow-[0_16px_40px_-32px_rgba(8,40,111,.55)]"
              : "border-[#c8d5f4] shadow-sm"
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <button
              type="button"
              onClick={() => setOpenMobile(true)}
              className="text-[#08286f] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative hidden w-full max-w-xl md:block">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#536690]" />
              <input
                id="portal-search"
                name="portalSearch"
                placeholder="Search pages, posts, or assets..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  const first = filteredItems[0];
                  if (first) {
                    activateNav(first.id);
                    setQuery("");
                  }
                }}
                className="w-full rounded-lg border border-[#c8d5f4] bg-white py-2 pr-4 pl-10 text-sm outline-none focus:border-[#806900] focus:ring-1 focus:ring-[#806900]"
              />
              {filteredItems.length > 0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-lg border border-[#c8d5f4] bg-white shadow-xl">
                  {filteredItems.map((item) => (
                    <button
                      key={`${item.group}-${item.id}`}
                      type="button"
                      onClick={() => {
                        activateNav(item.id);
                        setQuery("");
                      }}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-[#08286f] hover:bg-[#eef3ff]"
                    >
                      <span>{item.label}</span>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-[#5f72a3]">
                        {item.group}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openPreview}
              className="hidden rounded-full p-2 text-[#536690] transition-smooth hover:bg-white md:grid"
              title="Open public website"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={syncing !== "idle"}
              className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-[#08286f] transition-smooth hover:bg-white disabled:opacity-60 lg:inline-flex"
            >
              <Save className="mr-2 h-4 w-4" /> {syncing === "saving" ? "Saving" : "Save Draft"}
            </button>
            {(["website_admin", "eduzync_admin", "superadmin", "masteradmin"] as Role[]).includes(
              role,
            ) && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Reset local portal data?")) resetDb();
                }}
                title="Reset local portal data"
                className="hidden h-9 items-center gap-2 rounded-lg border border-[#c8d5f4] px-3 text-xs text-[#536690] hover:text-[#08286f] md:flex"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset data
              </button>
            )}
            {canDirectPublish && (
              <button
                type="button"
                onClick={() => void publishChanges()}
                disabled={syncing !== "idle"}
                className="rounded-lg bg-[#806900] px-5 py-2 text-sm font-bold text-white shadow-sm transition-smooth hover:bg-[#6f5b00] hover:shadow-md disabled:opacity-60"
              >
                {syncing === "publishing" ? "Publishing" : "Publish"}
              </button>
            )}
            <span
              className={`hidden max-w-[18rem] truncate rounded-lg border px-3 py-2 text-xs font-bold lg:inline-flex ${
                syncTone === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-[#c8d5f4] bg-white text-[#536690]"
              }`}
              title={syncMessage}
            >
              {syncMessage}
            </span>
            <button
              type="button"
              onClick={openNotifications}
              className="portal-notification-button relative grid h-9 w-9 place-items-center rounded-full text-[#536690] transition-smooth hover:bg-white hover:text-[#08286f]"
              title="Open messages"
            >
              <Bell className="portal-notification-icon h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[#ffe06d] shadow-[0_0_0_3px_rgba(255,224,109,.22)] animate-pulse-badge" />
            </button>
            <div className="hidden items-center gap-3 border-l border-[#c8d5f4] pl-4 xl:flex">
              <div className="text-right">
                <p className="text-sm font-bold leading-none">{auth.user.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#536690]">
                  {title}
                </p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#08286f]/10 bg-white font-serif text-sm text-[#08286f]">
                {auth.user.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>
            </div>
          </div>
        </header>

        <main
          onScroll={handleMainScroll}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#e7eefc] p-6 md:p-8 xl:p-10"
        >
          {children}
        </main>
      </div>

      {openMobile && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
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
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border ${accent ? "border-[#ffe06d]/80 bg-gradient-to-br from-[#ffe06d]/22 to-white" : "border-[#d6e0f8] bg-white"} p-6 shadow-[0_18px_44px_-34px_rgb(8_39_102_/0.38)]`}
    >
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl font-semibold text-navy">{value}</p>
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
