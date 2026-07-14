/**
 * Admin UI kit — the shared primitives every admin panel is built from.
 *
 * Presentation only. Nothing here reads, writes, migrates or clears stored
 * data; panels keep owning their own state and persistence.
 */
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Info, Loader2, Search, X } from "lucide-react";
import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

/* ══════════════════════════════════════════════════════════════════════════
 * Buttons
 * ══════════════════════════════════════════════════════════════════════════ */

type BtnVariant = "primary" | "accent" | "outline" | "ghost" | "danger" | "dangerGhost";

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: "a-btn-primary",
  accent: "a-btn-accent",
  outline: "a-btn-outline",
  ghost: "a-btn-ghost",
  danger: "a-btn-danger",
  dangerGhost: "a-btn-danger-ghost",
};

export function Btn({
  variant = "outline",
  size = "md",
  icon: Icon,
  loading = false,
  iconOnly = false,
  className,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: "sm" | "md";
  icon?: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "a-btn",
        BTN_VARIANT[variant],
        size === "sm" && "a-btn-sm",
        iconOnly && "a-btn-icon",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        Icon && <Icon className="h-4 w-4" />
      )}
      {!iconOnly && children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Surfaces
 * ══════════════════════════════════════════════════════════════════════════ */

/** Page-level heading that sits above a group of panels. */
export function SectionHead({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-[var(--a-ink)]">{title}</h2>
        {description && (
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--a-ink-soft)]">{description}</p>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** The standard bordered container. `flush` removes body padding (for tables). */
export function Panel({
  title,
  description,
  icon: Icon,
  action,
  flush = false,
  className,
  children,
}: {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("a-card a-enter overflow-hidden", className)}>
      {(title || action) && (
        <header className="flex flex-col gap-2 border-b border-[var(--a-line)] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--a-r-sm)] bg-[var(--a-brand-soft)] text-[var(--a-brand)]">
                <Icon className="h-[15px] w-[15px]" />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="truncate text-[13.5px] font-bold text-[var(--a-ink)]">{title}</h3>
              )}
              {description && (
                <p className="mt-0.5 text-[11.5px] text-[var(--a-ink-soft)]">{description}</p>
              )}
            </div>
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

type StatTone = "brand" | "accent" | "ok" | "warn" | "danger";

const STAT_TONE: Record<StatTone, { chip: string; bar: string }> = {
  brand: { chip: "bg-[var(--a-brand-soft)] text-[var(--a-brand)]", bar: "bg-[var(--a-brand)]" },
  accent: { chip: "bg-[var(--a-accent-soft)] text-[#7a6210]", bar: "bg-[var(--a-accent)]" },
  ok: { chip: "bg-[var(--a-ok-soft)] text-[var(--a-ok)]", bar: "bg-[var(--a-ok)]" },
  warn: { chip: "bg-[var(--a-warn-soft)] text-[var(--a-warn)]", bar: "bg-[var(--a-warn)]" },
  danger: { chip: "bg-[var(--a-danger-soft)] text-[var(--a-danger)]", bar: "bg-[var(--a-danger)]" },
};

/** Metric tile. `onClick` makes it a drill-down button. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: StatTone;
  onClick?: () => void;
}) {
  const tones = STAT_TONE[tone];
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "a-card relative w-full overflow-hidden p-3.5 text-left",
        onClick && "a-card-hover cursor-pointer",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", tones.bar)} />
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-[var(--a-ink-soft)]">{label}</p>
          <p className="mt-1 text-[20px] font-bold leading-none tracking-tight text-[var(--a-ink)]">
            {value}
          </p>
          {hint && <p className="mt-1 truncate text-[11px] text-[var(--a-ink-faint)]">{hint}</p>}
        </div>
        {Icon && (
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-[var(--a-r-sm)]",
              tones.chip,
            )}
          >
            <Icon className="h-[15px] w-[15px]" />
          </span>
        )}
      </div>
    </Tag>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Fields
 * ══════════════════════════════════════════════════════════════════════════ */

/** Label + control + hint/error wrapper. Wires htmlFor/id automatically. */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  // Give the wrapped control the label's id unless it already carries one.
  const control = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id: children.props.id || id })
    : children;

  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <label htmlFor={id} className="a-label">
          {label}
          {required && <span className="ml-0.5 text-[var(--a-danger)]">*</span>}
        </label>
      )}
      {control}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-[var(--a-danger)]">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-[12px] text-[var(--a-ink-faint)]">{hint}</p>
      )}
    </div>
  );
}

export function TextInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("a-field", className)} {...rest} />;
}

export function TextArea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("a-field", className)} {...rest} />;
}

export function SelectInput({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("a-field cursor-pointer pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

/** Debounce-free filter box used at the top of list panels. */
export function SearchInput({
  value,
  onValueChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onValueChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[var(--a-ink-faint)]" />
      <input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className="a-field pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-[var(--a-ink-faint)] transition-colors hover:bg-[var(--a-surface-2)] hover:text-[var(--a-ink)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Badge / Empty / Skeleton
 * ══════════════════════════════════════════════════════════════════════════ */

export type BadgeTone = "neutral" | "brand" | "accent" | "ok" | "warn" | "danger";

export function Badge({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("a-badge", `a-badge-${tone}`, className)}>
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

/** Shown instead of an empty list — explains what to do, not just "no data". */
export function EmptyState({
  icon: Icon = Info,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-9 text-center", className)}>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--a-surface-2)] text-[var(--a-ink-faint)]">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-3 text-[13.5px] font-bold text-[var(--a-ink)]">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-[var(--a-ink-soft)]">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("a-skeleton", className)} />;
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-5">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Table
 * ══════════════════════════════════════════════════════════════════════════ */

export type Column<T> = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
  render?: (row: T) => React.ReactNode;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading = false,
  empty,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
}) {
  if (loading) return <SkeletonTable />;
  if (!rows.length) {
    return (
      <>
        {empty ?? (
          <EmptyState
            title="Nothing here yet"
            description="Records will appear here once they are added."
          />
        )}
      </>
    );
  }

  return (
    <div className="a-scroll overflow-x-auto">
      <table className="a-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  column.align === "right" && "text-right",
                  column.align === "center" && "text-center",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "cursor-pointer" : undefined}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center",
                  )}
                >
                  {column.render
                    ? column.render(row)
                    : String((row as Record<string, unknown>)[column.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Modal + confirm
 * ══════════════════════════════════════════════════════════════════════════ */

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-[#0d1b2f]/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "a-enter relative w-full rounded-[var(--a-r-lg)] bg-[var(--a-surface)] shadow-[var(--a-shadow-3)]",
          width,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--a-line)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-[var(--a-ink)]">{title}</h2>
            {description && (
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--a-ink-soft)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="a-btn a-btn-ghost a-btn-icon a-btn-sm shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {children && (
          <div className="a-scroll max-h-[65vh] overflow-y-auto px-5 py-5">{children}</div>
        )}
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--a-line)] bg-[var(--a-surface-2)] px-5 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "brand";
};

type ConfirmRequest = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

/**
 * Replaces `window.confirm`. Same contract — resolves true/false — so the
 * calling code's logic (including what it deletes) is unchanged.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setRequest({ ...options, resolve })),
    [],
  );

  const settle = useCallback((ok: boolean) => {
    setRequest((current) => {
      current?.resolve(ok);
      return null;
    });
  }, []);

  const isDanger = request?.tone !== "brand";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(request)}
        onClose={() => settle(false)}
        title={request?.title || ""}
        size="sm"
        footer={
          <>
            <Btn variant="ghost" onClick={() => settle(false)}>
              {request?.cancelLabel || "Cancel"}
            </Btn>
            <Btn variant={isDanger ? "danger" : "primary"} onClick={() => settle(true)}>
              {request?.confirmLabel || (isDanger ? "Delete" : "Confirm")}
            </Btn>
          </>
        }
      >
        <div className="flex gap-4">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full",
              isDanger
                ? "bg-[var(--a-danger-soft)] text-[var(--a-danger)]"
                : "bg-[var(--a-brand-soft)] text-[var(--a-brand)]",
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <p className="pt-1.5 text-[13.5px] leading-relaxed text-[var(--a-ink-soft)]">
            {request?.description || "This action cannot be undone."}
          </p>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

/** `const ok = await confirm({ title, description })` — throws if no provider. */
export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return context;
}

/* ══════════════════════════════════════════════════════════════════════════
 * Command palette (Ctrl/Cmd + K)
 * ══════════════════════════════════════════════════════════════════════════ */

export type CommandItem = {
  id: string;
  label: string;
  group: string;
  icon?: React.ComponentType<{ className?: string }>;
  run: () => void;
};

export function CommandPalette({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.group} ${item.label}`.toLowerCase().includes(needle));
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  if (!open) return null;

  const runAt = (index: number) => {
    const item = results[index];
    if (!item) return;
    item.run();
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runAt(cursor);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  let flatIndex = -1;
  const groups = results.reduce<Record<string, CommandItem[]>>((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="fixed inset-0 bg-[#0d1b2f]/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="a-enter relative w-full max-w-lg overflow-hidden rounded-[var(--a-r-lg)] bg-[var(--a-surface)] shadow-[var(--a-shadow-3)]"
      >
        <div className="flex items-center gap-3 border-b border-[var(--a-line)] px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-[var(--a-ink-faint)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a panel or action…"
            className="w-full border-0 bg-transparent py-4 text-[14px] text-[var(--a-ink)] outline-none placeholder:text-[var(--a-ink-faint)]"
          />
          <kbd className="hidden shrink-0 rounded border border-[var(--a-line-strong)] bg-[var(--a-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--a-ink-faint)] sm:block">
            ESC
          </kbd>
        </div>

        <div className="a-scroll max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-[var(--a-ink-faint)]">
              No matches for “{query}”
            </p>
          ) : (
            Object.entries(groups).map(([group, groupItems]) => (
              <div key={group} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--a-ink-faint)]">
                  {group}
                </p>
                {groupItems.map((item) => {
                  flatIndex += 1;
                  const index = flatIndex;
                  const isActive = index === cursor;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => runAt(index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[var(--a-r-sm)] px-3 py-2.5 text-left text-[13.5px] font-medium transition-colors",
                        isActive
                          ? "bg-[var(--a-brand-soft)] text-[var(--a-brand)]"
                          : "text-[var(--a-ink)]",
                      )}
                    >
                      {item.icon && <item.icon className="h-4 w-4 shrink-0 opacity-70" />}
                      <span className="truncate">{item.label}</span>
                      {isActive && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
