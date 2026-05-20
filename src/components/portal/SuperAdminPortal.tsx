import { useState } from "react";
import { PortalShell, PageTitle, StatCard, Panel, DataTable, Badge } from "./PortalShell";
import { PublishApprovalsPanel } from "./PublishApprovalsPanel";
import { useDb, setDb, audit, resetDb } from "@/lib/store";
import {
  Shield,
  FileText,
  ClipboardList,
  Settings,
  Database,
  KeyRound,
  Activity,
  Building2,
  LayoutDashboard,
  Mail,
  CreditCard,
} from "lucide-react";

type BranchRow = {
  id: string;
  name: string;
  students: number;
  status: string;
};

const groups = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", label: "System Dashboard", icon: LayoutDashboard },
      { id: "health", label: "System Health", icon: Activity },
    ],
  },
  {
    label: "Security",
    items: [
      { id: "roles", label: "Roles & Permissions", icon: Shield },
      { id: "audit", label: "Audit Logs", icon: FileText },
      { id: "keys", label: "API Keys", icon: KeyRound },
    ],
  },
  {
    label: "Configuration",
    items: [
      { id: "publish-approvals", label: "Publish Approvals", icon: ClipboardList },
      { id: "settings", label: "School Settings", icon: Settings },
      { id: "branches", label: "Multi-branch", icon: Building2 },
      { id: "email", label: "Email & SMS", icon: Mail },
      { id: "payments", label: "Payment Gateways", icon: CreditCard },
    ],
  },
  { label: "Data", items: [{ id: "backup", label: "Backup & Restore", icon: Database }] },
];

const permMatrix = [
  {
    module: "Students",
    student: "View own",
    parent: "View own",
    teacher: "View class",
    website_admin: "No access",
    eduzync_admin: "Full",
    superadmin: "Full",
  },
  {
    module: "Fees",
    student: "No access",
    parent: "View / Pay",
    teacher: "No access",
    website_admin: "No access",
    eduzync_admin: "Full",
    superadmin: "Full",
  },
  {
    module: "Website",
    student: "No access",
    parent: "No access",
    teacher: "No access",
    website_admin: "Full",
    eduzync_admin: "No access",
    superadmin: "Full",
  },
  {
    module: "Audit logs",
    student: "No access",
    parent: "No access",
    teacher: "No access",
    website_admin: "No access",
    eduzync_admin: "View",
    superadmin: "Full",
  },
  {
    module: "User accounts",
    student: "No access",
    parent: "No access",
    teacher: "No access",
    website_admin: "No access",
    eduzync_admin: "Limited",
    superadmin: "Full",
  },
];

export function SuperAdminPortal() {
  const db = useDb();
  const [active, setActive] = useState("dashboard");

  const exportData = () => {
    const exportFile = new File([JSON.stringify(db, null, 2)], "westbrook-export.json", {
      type: "application/json",
    });
    const url = URL.createObjectURL(exportFile);
    const a = document.createElement("a");
    a.href = url;
    a.download = `westbrook-export-${Date.now()}.json`;
    a.click();
    audit("System data exported", "superadmin");
  };

  return (
    <PortalShell
      role="superadmin"
      title="Super Admin"
      groups={groups}
      active={active}
      onActiveChange={setActive}
    >
      {active === "dashboard" && (
        <>
          <PageTitle kicker="System overview" title="Loyola command center" />
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              label="Active users"
              value={db.users.filter((u) => u.status === "Active").length}
              accent
            />
            <StatCard label="Audit events" value={db.auditLogs.length} />
            <StatCard label="Storage" value="42 MB" hint="Local prototype" />
            <StatCard label="Uptime" value="99.99%" />
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Panel title="System status">
              <ul className="space-y-3 text-sm">
                {[
                  { n: "Web server", s: "Operational" },
                  { n: "Database (local)", s: "Operational" },
                  { n: "Mail relay", s: "Degraded" },
                  { n: "Payment gateway", s: "Operational" },
                ].map((r) => (
                  <li
                    key={r.n}
                    className="flex items-center justify-between border-b border-border pb-2 last:border-0"
                  >
                    <span>{r.n}</span>
                    <Badge tone={r.s === "Operational" ? "success" : "warning"}>{r.s}</Badge>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Latest audit events">
              <ul className="space-y-3">
                {db.auditLogs.slice(0, 6).map((l) => (
                  <li key={l.id} className="border-l-2 border-gold pl-3">
                    <p className="text-sm text-navy">{l.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.user} · {new Date(l.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}
      {active === "health" && (
        <>
          <PageTitle kicker="Diagnostics" title="System Health" />
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="API latency (p95)" value="124ms" />
            <StatCard label="Error rate (24h)" value="0.02%" />
            <StatCard label="Active sessions" value="38" />
          </div>
        </>
      )}
      {active === "roles" && (
        <>
          <PageTitle kicker="Security" title="Roles & Permissions" />
          <Panel title="Permission matrix">
            <DataTable
              rows={permMatrix.map((m, i) => ({ id: String(i), ...m }))}
              columns={[
                { key: "module", label: "Module" },
                { key: "student", label: "Student" },
                { key: "parent", label: "Parent" },
                { key: "teacher", label: "Teacher" },
                { key: "website_admin", label: "Website Admin" },
                { key: "eduzync_admin", label: "EduZync Admin" },
                { key: "superadmin", label: "Super Admin" },
              ]}
            />
          </Panel>
        </>
      )}
      {active === "publish-approvals" && <PublishApprovalsPanel />}
      {active === "audit" && (
        <>
          <PageTitle kicker="Security" title="Audit Logs" />
          <Panel title="Activity stream">
            <DataTable
              rows={db.auditLogs}
              columns={[
                {
                  key: "createdAt",
                  label: "When",
                  render: (r) => new Date(r.createdAt).toLocaleString(),
                },
                { key: "user", label: "User" },
                { key: "action", label: "Action" },
              ]}
            />
          </Panel>
        </>
      )}
      {active === "keys" && (
        <>
          <PageTitle kicker="Security" title="API Keys" />
          <Panel title="Active keys">
            <ul className="divide-y divide-border">
              {[
                { n: "Public website API", k: "pk_live_••••a7c1" },
                { n: "Mobile app key", k: "pk_live_••••32fd" },
                { n: "SIS sync", k: "sk_live_••••ee21" },
              ].map((k) => (
                <li key={k.n} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-navy">{k.n}</p>
                    <p className="font-mono text-xs text-muted-foreground">{k.k}</p>
                  </div>
                  <Badge tone="success">Active</Badge>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
      {active === "settings" && (
        <>
          <PageTitle kicker="Configuration" title="School Settings" />
          <SettingsPanel />
        </>
      )}
      {active === "branches" && (
        <>
          <PageTitle kicker="Configuration" title="Multi-branch" />
          <Panel title="Branches">
            <DataTable
              rows={[
                {
                  id: "BR1",
                  name: "Loyola College Negombo — Colombo",
                  students: 1840,
                  status: "Active",
                },
                {
                  id: "BR2",
                  name: "Loyola College Negombo — Kandy (planned)",
                  students: 0,
                  status: "Setup",
                },
              ]}
              columns={[
                { key: "name", label: "Branch" },
                { key: "students", label: "Students" },
                {
                  key: "status",
                  label: "Status",
                  render: (r: BranchRow) => (
                    <Badge tone={r.status === "Active" ? "success" : "warning"}>{r.status}</Badge>
                  ),
                },
              ]}
            />
          </Panel>
        </>
      )}
      {active === "email" && (
        <>
          <PageTitle kicker="Configuration" title="Email & SMS" />
          <Panel title="Providers">
            <ul className="divide-y divide-border">
              {[
                { n: "SMTP relay", d: "mail.westbrookacademy.lk:587", s: "Connected" },
                { n: "SMS gateway", d: "Dialog Bulk SMS", s: "Connected" },
                { n: "Push notifications", d: "Mobile app", s: "Disabled" },
              ].map((r) => (
                <li key={r.n} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-navy">{r.n}</p>
                    <p className="text-xs text-muted-foreground">{r.d}</p>
                  </div>
                  <Badge tone={r.s === "Connected" ? "success" : "neutral"}>{r.s}</Badge>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
      {active === "payments" && (
        <>
          <PageTitle kicker="Configuration" title="Payment Gateways" />
          <Panel title="Connected gateways">
            <ul className="divide-y divide-border">
              {[
                { n: "PayHere", s: "Live" },
                { n: "Bank transfer", s: "Active" },
                { n: "Stripe", s: "Disabled" },
              ].map((r) => (
                <li key={r.n} className="flex items-center justify-between py-3">
                  <p className="font-medium text-navy">{r.n}</p>
                  <Badge tone={r.s === "Disabled" ? "neutral" : "success"}>{r.s}</Badge>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
      {active === "backup" && (
        <>
          <PageTitle kicker="Data" title="Backup & Restore">
            <button onClick={exportData} className="bg-navy px-4 py-2 text-sm text-navy-foreground">
              Export JSON
            </button>
            <button
              onClick={() => {
                if (confirm("This will reset ALL demo data to seed. Continue?")) {
                  resetDb();
                  audit("System reset", "superadmin");
                }
              }}
              className="border border-destructive px-4 py-2 text-sm text-destructive"
            >
              Reset to seed
            </button>
          </PageTitle>
          <Panel title="Snapshots">
            <ul className="divide-y divide-border">
              {[
                { d: "Today 03:00", s: "42 MB", ok: true },
                { d: "Yesterday 03:00", s: "41.8 MB", ok: true },
                { d: "2 days ago", s: "41.2 MB", ok: true },
              ].map((b) => (
                <li key={b.d} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-navy">{b.d}</p>
                    <p className="text-xs text-muted-foreground">{b.s}</p>
                  </div>
                  <Badge tone="success">Healthy</Badge>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </PortalShell>
  );
}

function SettingsPanel() {
  const db = useDb();
  const c = db.websiteContent;
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setDb((d) => ({
      ...d,
      websiteContent: {
        ...d.websiteContent,
        schoolName: String(formData.get("schoolName") ?? ""),
        tagline: String(formData.get("tagline") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        address: String(formData.get("address") ?? ""),
      },
    }));
    audit("School settings updated", "superadmin");
  };
  return (
    <Panel title="Institution settings">
      <form onSubmit={save}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="School name">
            <input
              id="super-school-name"
              name="schoolName"
              className="input-line"
              defaultValue={c.schoolName}
            />
          </Field>
          <Field label="Tagline">
            <input
              id="super-school-tagline"
              name="tagline"
              className="input-line"
              defaultValue={c.tagline}
            />
          </Field>
          <Field label="Phone">
            <input
              id="super-school-phone"
              name="phone"
              className="input-line"
              defaultValue={c.phone}
            />
          </Field>
          <Field label="Email">
            <input
              id="super-school-email"
              name="email"
              className="input-line"
              defaultValue={c.email}
            />
          </Field>
          <Field label="Address">
            <input
              id="super-school-address"
              name="address"
              className="input-line"
              defaultValue={c.address}
            />
          </Field>
        </div>
        <button type="submit" className="mt-6 bg-navy px-5 py-2.5 text-sm text-navy-foreground">
          Save settings
        </button>
      </form>
      <style>{`.input-line{width:100%;border:1px solid var(--border);background:transparent;padding:0.5rem 0.75rem;outline:none;font-size:0.9rem;} .input-line:focus{border-color:var(--gold);}`}</style>
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
