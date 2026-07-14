/**
 * AdminShell — the single chrome shared by the admin panel and every portal.
 *
 * Owns layout only: sidebar, header, command palette, toast host, confirm host.
 * Save/publish behaviour stays with the caller and is passed in as `actions`.
 */
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/store";
import { ChevronsLeft, ChevronsRight, ExternalLink, LogOut, Menu, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { CommandPalette, ConfirmProvider, type CommandItem } from "./admin-kit";

export type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const COLLAPSE_KEY = "loyola.admin.sidebarCollapsed";

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function initials(value: string) {
  const parts = value
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "A"
  ).toUpperCase();
}

export function AdminShell({
  brandTitle = "Loyola Studio",
  brandSubtitle,
  groups,
  active,
  onActiveChange,
  user,
  roleLabel,
  onSignOut,
  actions,
  children,
}: {
  brandTitle?: string;
  brandSubtitle?: string;
  groups: NavGroup[];
  active: string;
  onActiveChange: (id: string) => void;
  user: { name: string; email: string; role: Role };
  roleLabel: string;
  onSignOut: () => void;
  /** Header buttons (save, publish, …). Rendered on the right of the top bar. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const allItems = useMemo(
    () => groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))),
    [groups],
  );
  const activeItem = allItems.find((item) => item.id === active);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* storage unavailable — collapse still works for this session */
      }
      return next;
    });
  }, []);

  // Ctrl/Cmd+K opens the palette from anywhere in the panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commandItems: CommandItem[] = useMemo(
    () =>
      allItems.map((item) => ({
        id: item.id,
        label: item.label,
        group: item.group,
        icon: item.icon,
        run: () => onActiveChange(item.id),
      })),
    [allItems, onActiveChange],
  );

  const selectNav = (id: string) => {
    onActiveChange(id);
    setMobileOpen(false);
  };

  // The rail (icon-only) look never applies while the mobile drawer is open.
  const railed = collapsed && !mobileOpen;

  return (
    <ConfirmProvider>
      <div
        data-admin-panel
        className="flex h-screen overflow-hidden bg-[var(--a-canvas)] text-[var(--a-ink)]"
      >
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside
          className={cn(
            "a-sidebar fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--a-brand-deep)] shadow-[4px_0_28px_-12px_rgba(7,28,72,0.5)] transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:static lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
          data-collapsed={railed}
          style={{ width: railed ? 72 : 252 }}
        >
          <div
            className={cn(
              "flex h-[60px] shrink-0 items-center gap-3 border-b border-white/10 px-4",
              railed && "justify-center px-0",
            )}
          >
            <a href="/" title="Open public website" className="flex min-w-0 items-center gap-3">
              <img
                src="/loyola-crest.jpg"
                alt=""
                className="h-9 w-9 shrink-0 rounded-full border border-[var(--a-accent)]/60 bg-white object-contain p-0.5"
              />
              <span className="a-collapse-hide min-w-0">
                <span className="block truncate text-[14.5px] font-bold leading-tight text-white">
                  {brandTitle}
                </span>
                <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  {brandSubtitle || roleLabel}
                </span>
              </span>
            </a>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="a-collapse-hide ml-auto rounded p-1 text-white/50 hover:text-white lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="a-scroll flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
            {groups.map((group) => (
              <div key={group.label} className="mb-4 last:mb-0">
                <p className="a-nav-group-label mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => selectNav(item.id)}
                        data-active={item.id === active}
                        className="a-nav-item"
                        title={railed ? item.label : undefined}
                      >
                        <item.icon className="a-nav-icon" />
                        <span className="a-nav-label truncate">{item.label}</span>
                        {railed && <span className="a-tip">{item.label}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="shrink-0 border-t border-white/10 p-3">
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-[var(--a-r-sm)] bg-white/[0.07] p-2",
                railed && "justify-center bg-transparent p-0",
              )}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--a-accent)] text-[11px] font-bold text-[#2a2100]">
                {initials(user.name || user.email)}
              </span>
              <span className="a-collapse-hide min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-white">
                  {user.name || user.email}
                </span>
                <span className="block truncate text-[10px] font-medium uppercase tracking-[0.1em] text-white/40">
                  {roleLabel}
                </span>
              </span>
              <button
                type="button"
                onClick={onSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="a-collapse-hide shrink-0 rounded p-1.5 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={toggleCollapsed}
              className={cn(
                "mt-2 hidden w-full items-center gap-2.5 rounded-[var(--a-r-sm)] px-3 py-2 text-[12px] font-semibold text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white/80 lg:flex",
                railed && "justify-center px-0",
              )}
            >
              {railed ? (
                <ChevronsRight className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronsLeft className="h-4 w-4 shrink-0" />
              )}
              <span className="a-collapse-hide">Collapse</span>
            </button>
          </div>
        </aside>

        {/* ── Main column ─────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-[var(--a-line)] bg-[var(--a-surface)] px-4 lg:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="a-btn a-btn-ghost a-btn-icon a-btn-sm lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--a-ink-faint)]">
                {roleLabel}
              </p>
              <h1 className="truncate text-[17px] font-bold leading-tight text-[var(--a-ink)]">
                {activeItem?.label || brandTitle}
              </h1>
            </div>

            {/* Palette trigger doubles as the search affordance */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-9 items-center gap-2 rounded-[var(--a-r-sm)] border border-[var(--a-line-strong)] bg-[var(--a-surface-2)] px-3 text-[13px] text-[var(--a-ink-faint)] transition-colors hover:border-[var(--a-brand)] hover:text-[var(--a-brand)] md:flex"
            >
              <Search className="h-[15px] w-[15px]" />
              <span className="pr-6">Search panels…</span>
              <kbd className="rounded border border-[var(--a-line-strong)] bg-[var(--a-surface)] px-1.5 py-0.5 text-[10px] font-semibold">
                Ctrl K
              </kbd>
            </button>

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              title="Open public website"
              className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
            >
              <ExternalLink className="h-4 w-4" />
            </a>

            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </header>

          <main className="a-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
            {children}
          </main>
        </div>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-[#0d1b2f]/50 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          items={commandItems}
        />
        <Toaster position="bottom-right" richColors closeButton />
      </div>
    </ConfirmProvider>
  );
}
