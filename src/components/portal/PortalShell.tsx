/**
 * PortalShell — the student / parent / teacher / super / master admin chrome.
 *
 * It is now a thin adapter over AdminShell so every portal and the admin panel
 * share one design system. The exported API (PortalShell, PageTitle, StatCard,
 * Panel, DataTable, Badge) is unchanged, so the five portals that consume it
 * did not need to be touched.
 */
import { BrandedLoader } from "@/components/BrandedLoader";
import { useAuth, setAuth, audit, useDb, publishDbNow, saveDbNow, type Role } from "@/lib/store";
import { CheckCircle2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell, type NavGroup } from "./AdminShell";
import {
  Badge as KitBadge,
  Btn,
  DataTable as KitDataTable,
  EmptyState,
  Panel as KitPanel,
  StatCard as KitStatCard,
  type BadgeTone,
} from "./admin-kit";

export type { NavGroup };

const ROLE_LABEL: Partial<Record<Role, string>> = {
  student: "Student",
  parent: "Parent",
  teacher: "Teacher",
  website_admin: "Website Admin",
  superadmin: "Super Admin",
  masteradmin: "Master Admin",
  viewadmin: "View Admin",
};

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
  const [syncing, setSyncing] = useState<"idle" | "saving" | "publishing">("idle");

  const canDirectPublish = role === "masteradmin" || role === "superadmin";
  const canSave = canDirectPublish || role === "website_admin";

  if (auth.loading) {
    return (
      <BrandedLoader
        title="Checking your session"
        subtitle="Please wait while your portal session is checked"
      />
    );
  }

  if (!auth.user || auth.user.role !== role) {
    // Keep the original redirect behaviour rather than rendering a dead shell.
    if (typeof window !== "undefined") window.location.href = "/login";
    return <BrandedLoader title="Redirecting to login" subtitle="Your session was not found" />;
  }

  const user = auth.user;

  const signOut = async () => {
    audit(`${user.role} signed out`, user.email || "");
    await setAuth(null);
    window.location.href = "/login";
  };

  const saveDraft = async () => {
    setSyncing("saving");
    audit("Portal draft saved", user.email || "admin");
    const result = await saveDbNow();
    if (result.remote) {
      toast.success(
        result.contentVersion
          ? `Saved to cloud as version ${result.contentVersion}`
          : "Saved to cloud",
      );
    } else if (result.localOnly) {
      toast.success("Draft saved locally");
    } else {
      toast.error("Cloud save failed", {
        description: `${result.error || "The server did not respond."} Your local draft is safe.`,
      });
    }
    setSyncing("idle");
  };

  const publishChanges = async () => {
    setSyncing("publishing");
    audit("Portal changes published", user.email || "admin");
    const result = await publishDbNow();
    if (result.remote) {
      toast.success(
        result.contentVersion ? `Published version ${result.contentVersion}` : "Published to cloud",
      );
    } else {
      toast.error("Publish failed", {
        description: `${result.error || "The server did not respond."} The public site was not updated.`,
      });
    }
    setSyncing("idle");
  };

  return (
    <AdminShell
      brandTitle="Loyola Portal"
      brandSubtitle={title}
      groups={groups}
      active={active}
      onActiveChange={onActiveChange}
      user={{ name: user.name, email: user.email, role: user.role }}
      roleLabel={ROLE_LABEL[role] || title}
      onSignOut={() => void signOut()}
      actions={
        canSave ? (
          <>
            <Btn
              variant="outline"
              size="sm"
              icon={Save}
              loading={syncing === "saving"}
              disabled={syncing !== "idle"}
              onClick={() => void saveDraft()}
              className="hidden sm:inline-flex"
            >
              Save
            </Btn>
            {canDirectPublish && (
              <Btn
                variant="accent"
                size="sm"
                icon={CheckCircle2}
                loading={syncing === "publishing"}
                disabled={syncing !== "idle"}
                onClick={() => void publishChanges()}
              >
                Publish
              </Btn>
            )}
          </>
        ) : undefined
      }
    >
      {/* db is read here so the shell re-renders on store changes, as before */}
      <div data-content-version={db.contentVersion}>{children}</div>
    </AdminShell>
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
    <div className="a-enter mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--a-ink-faint)]">
          {kicker}
        </p>
        <h1 className="mt-1 text-[22px] font-bold tracking-tight text-[var(--a-ink)]">{title}</h1>
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
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <KitStatCard
      label={label}
      value={value}
      hint={hint}
      icon={icon}
      tone={accent ? "accent" : "brand"}
    />
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
    <KitPanel title={title} action={action}>
      {children}
    </KitPanel>
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
  return (
    <KitDataTable<T>
      columns={columns.map((column) => ({
        key: String(column.key),
        label: column.label,
        render: column.render,
      }))}
      rows={rows}
      empty={<EmptyState title={empty || "No records yet"} />}
    />
  );
}

const BADGE_TONE: Record<string, BadgeTone> = {
  neutral: "neutral",
  success: "ok",
  warning: "warn",
  danger: "danger",
  gold: "accent",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "gold";
}) {
  return <KitBadge tone={BADGE_TONE[tone] || "neutral"}>{children}</KitBadge>;
}
