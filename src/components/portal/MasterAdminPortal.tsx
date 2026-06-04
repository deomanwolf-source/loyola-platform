import { useState } from "react";
import {
  Activity,
  BookOpen,
  Bus,
  Calendar,
  ClipboardList,
  CreditCard,
  Database,
  FileText,
  Globe,
  GraduationCap,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Library,
  MessageSquare,
  Plus,
  Settings,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import { Badge, DataTable, PageTitle, Panel, PortalShell, StatCard } from "./PortalShell";
import { CrudPanel, DeferredWebsiteEditor, type CrudKey } from "./AdminPortal";
import { PublishApprovalsPanel } from "./PublishApprovalsPanel";
import { audit, makeId, resetDb, setDb, useDb, type Role } from "@/lib/store";

const groups = [
  {
    label: "Master",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "users", label: "Admins & Users", icon: Shield },
      { id: "audit", label: "Audit Logs", icon: FileText },
    ],
  },
  {
    label: "People",
    items: [
      { id: "students", label: "Students", icon: GraduationCap },
      { id: "teachers", label: "Teachers", icon: BookOpen },
      { id: "parents", label: "Parents", icon: Users },
    ],
  },
  {
    label: "Academics",
    items: [
      { id: "classes", label: "Classes", icon: BookOpen },
      { id: "subjects", label: "Subjects", icon: BookOpen },
      { id: "assignments", label: "Assignments", icon: ClipboardList },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "fees", label: "Fees", icon: CreditCard },
      { id: "events", label: "Events", icon: Calendar },
      { id: "library", label: "Library", icon: Library },
      { id: "transport", label: "Transport", icon: Bus },
    ],
  },
  {
    label: "Website",
    items: [
      { id: "website", label: "Website Editor", icon: Globe },
      { id: "publish-approvals", label: "Publish Approvals", icon: ClipboardList },
      { id: "admissions", label: "Admissions Inbox", icon: Inbox },
      { id: "messages", label: "Messages", icon: MessageSquare },
      { id: "news", label: "News & Blog", icon: FileText },
    ],
  },
  {
    label: "System",
    items: [
      { id: "health", label: "System Health", icon: Activity },
      { id: "keys", label: "API Keys", icon: KeyRound },
      { id: "backup", label: "Backup & Restore", icon: Database },
      { id: "settings", label: "School Settings", icon: Settings },
    ],
  },
];

const crudSections: Partial<
  Record<string, { collection: CrudKey; kicker: string; title: string }>
> = {
  students: { collection: "students", kicker: "People", title: "Students" },
  teachers: { collection: "teachers", kicker: "People", title: "Teachers" },
  parents: { collection: "parents", kicker: "People", title: "Parents" },
  classes: { collection: "classes", kicker: "Academics", title: "Classes" },
  subjects: { collection: "subjects", kicker: "Academics", title: "Subjects" },
  assignments: { collection: "assignments", kicker: "Academics", title: "Assignments" },
  fees: { collection: "fees", kicker: "Finance", title: "Fees" },
  events: { collection: "events", kicker: "Calendar", title: "Events" },
  library: { collection: "library", kicker: "Operations", title: "Library" },
  transport: { collection: "transport", kicker: "Operations", title: "Transport" },
  news: { collection: "news", kicker: "Content", title: "News & Blog" },
};

const adminRoles: Role[] = [
  "website_admin",
  "eduzync_admin",
  "staff_admin",
  "superadmin",
  "masteradmin",
];

export function MasterAdminPortal() {
  const db = useDb();
  const [active, setActive] = useState("dashboard");
  const crud = crudSections[active];

  return (
    <PortalShell
      role="masteradmin"
      title="Master Admin"
      groups={groups}
      active={active}
      onActiveChange={setActive}
    >
      {active === "dashboard" && (
        <>
          <PageTitle kicker="Full access" title="Master Admin Dashboard" />
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Users" value={db.users.length} accent />
            <StatCard label="Students" value={db.students.length} />
            <StatCard label="Admissions" value={db.admissions.length} />
            <StatCard label="Audit events" value={db.auditLogs.length} />
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Panel title="Master permissions">
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    "Manage admins and super admins",
                    "Edit website content and school records",
                    "Access system settings, audit logs, and backup tools",
                  ].map((item) => (
                    <div
                      key={item}
                      className="border border-border bg-secondary/45 p-4 text-sm text-navy"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
            <Panel title="Recent activity">
              <ul className="space-y-3">
                {db.auditLogs.slice(0, 7).map((log) => (
                  <li key={log.id} className="border-l-2 border-gold pl-3">
                    <p className="text-sm text-navy">{log.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.user} | {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}

      {active === "users" && <AdminUsersPanel />}
      {active === "website" && <DeferredWebsiteEditor />}
      {active === "publish-approvals" && <PublishApprovalsPanel />}
      {crud && <CrudPanel {...crud} />}
      {active === "admissions" && <AdmissionsInbox />}
      {active === "messages" && <MessagesInbox />}
      {active === "audit" && <AuditLogs />}
      {active === "health" && <SystemHealth />}
      {active === "keys" && <ApiKeys />}
      {active === "backup" && <BackupRestore />}
      {active === "settings" && <SchoolSettings />}
    </PortalShell>
  );
}

function AdminUsersPanel() {
  const db = useDb();

  const addUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const draft = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      role: String(formData.get("role") ?? "website_admin") as Role,
      password: String(formData.get("password") ?? ""),
      status: "Active",
    };

    if (!draft.name || !draft.email || !draft.password) return;
    const email = draft.email.trim().toLowerCase();
    if (db.users.some((user) => user.email.toLowerCase() === email)) {
      alert("A user with this email already exists.");
      return;
    }
    const uid = makeId("USR");
    setDb((current) => ({
      ...current,
      users: [{ id: uid, ...draft, email }, ...current.users],
    }));
    audit(`Created ${draft.role} account: ${email}`, "masteradmin");
    form.reset();
  };

  const removeUser = (id: string) => {
    const user = db.users.find((item) => item.id === id);
    if (!user) return;
    if (user.email.toLowerCase() === "deomanwolf@gmail.com") {
      alert("The default Master Admin account cannot be deleted.");
      return;
    }
    setDb((current) => ({ ...current, users: current.users.filter((item) => item.id !== id) }));
    audit(`Deleted user account: ${user.email}`, "masteradmin");
  };

  return (
    <>
      <PageTitle kicker="Master security" title="Admins & Users">
        <span className="text-xs text-muted-foreground">
          Add administrators, super admins, and Master Admin accounts.
        </span>
      </PageTitle>
      <Panel title="Create account">
        <form onSubmit={addUser} className="grid gap-3 md:grid-cols-5">
          <input
            id="master-user-name"
            name="name"
            placeholder="Full name"
            className="border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <input
            id="master-user-email"
            name="email"
            placeholder="Email / username"
            type="email"
            className="border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <select
            id="master-user-role"
            name="role"
            defaultValue="website_admin"
            className="border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
          >
            <option value="website_admin">Website Admin</option>
            <option value="eduzync_admin">EduTrack Admin</option>
            <option value="staff_admin">Staff Admin</option>
            <option value="superadmin">Super Admin</option>
            <option value="masteradmin">Master Admin</option>
            <option value="teacher">Teacher</option>
            <option value="parent">Parent</option>
            <option value="student">Student</option>
          </select>
          <input
            id="master-user-password"
            name="password"
            placeholder="Password"
            type="password"
            className="border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 bg-navy px-4 py-2 text-sm text-white"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </form>
      </Panel>
      <div className="mt-6">
        <Panel title="All portal accounts">
          <DataTable
            rows={db.users}
            columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Username / Email" },
              {
                key: "role",
                label: "Role",
                render: (row) => (
                  <Badge tone={adminRoles.includes(row.role) ? "gold" : "neutral"}>
                    {roleLabel(row.role)}
                  </Badge>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <Badge tone={row.status === "Active" ? "success" : "warning"}>{row.status}</Badge>
                ),
              },
              { key: "password", label: "Password", render: () => "********" },
              {
                key: "_actions",
                label: "",
                render: (row) => (
                  <button
                    onClick={() => removeUser(row.id)}
                    className="text-destructive hover:underline"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ),
              },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

function AdmissionsInbox() {
  const db = useDb();
  return (
    <>
      <PageTitle kicker="Front office" title="Admissions Inbox" />
      <Panel title="Submitted applications">
        <DataTable
          empty="No applications yet."
          rows={db.admissions}
          columns={[
            { key: "childName", label: "Child" },
            { key: "grade", label: "Grade" },
            { key: "parentName", label: "Parent" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            {
              key: "createdAt",
              label: "Submitted",
              render: (row) => new Date(row.createdAt).toLocaleDateString(),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => <Badge tone="warning">{row.status}</Badge>,
            },
          ]}
        />
      </Panel>
    </>
  );
}

function MessagesInbox() {
  const db = useDb();
  return (
    <>
      <PageTitle kicker="Front office" title="Messages" />
      <Panel title="Inbox">
        <DataTable
          empty="No messages yet."
          rows={db.messages}
          columns={[
            { key: "name", label: "From" },
            { key: "email", label: "Email" },
            { key: "subject", label: "Subject" },
            {
              key: "createdAt",
              label: "Received",
              render: (row) => new Date(row.createdAt).toLocaleDateString(),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <Badge tone={row.status === "Unread" ? "warning" : "success"}>{row.status}</Badge>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}

function AuditLogs() {
  const db = useDb();
  return (
    <>
      <PageTitle kicker="Security" title="Audit Logs" />
      <Panel title="Activity stream">
        <DataTable
          rows={db.auditLogs}
          columns={[
            {
              key: "createdAt",
              label: "When",
              render: (row) => new Date(row.createdAt).toLocaleString(),
            },
            { key: "user", label: "User" },
            { key: "action", label: "Action" },
          ]}
        />
      </Panel>
    </>
  );
}

function SystemHealth() {
  return (
    <>
      <PageTitle kicker="Diagnostics" title="System Health" />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Web server" value="OK" accent />
        <StatCard label="Database" value="Local" />
        <StatCard label="Error rate" value="0.02%" />
        <StatCard label="Sessions" value="38" />
      </div>
    </>
  );
}

function ApiKeys() {
  return (
    <>
      <PageTitle kicker="Security" title="API Keys" />
      <Panel title="Active keys">
        <ul className="divide-y divide-border">
          {["Public website API", "Portal sync key", "Admissions integration"].map((name) => (
            <li key={name} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-navy">{name}</p>
                <p className="font-mono text-xs text-muted-foreground">key_************</p>
              </div>
              <Badge tone="success">Active</Badge>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function BackupRestore() {
  const db = useDb();
  const exportData = () => {
    const exportFile = new File([JSON.stringify(db, null, 2)], "loyola-export.json", {
      type: "application/json",
    });
    const url = URL.createObjectURL(exportFile);
    const link = document.createElement("a");
    link.href = url;
    link.download = `loyola-export-${Date.now()}.json`;
    link.click();
    audit("System data exported", "masteradmin");
  };

  return (
    <>
      <PageTitle kicker="Data" title="Backup & Restore">
        <button onClick={exportData} className="bg-navy px-4 py-2 text-sm text-white">
          Export JSON
        </button>
        <button
          onClick={() => {
            if (confirm("This will reset all demo data. Continue?")) {
              resetDb();
              audit("System reset", "masteradmin");
            }
          }}
          className="border border-destructive px-4 py-2 text-sm text-destructive"
        >
          Reset to seed
        </button>
      </PageTitle>
      <Panel title="Snapshots">
        <p className="text-sm text-muted-foreground">
          Draft snapshots are stored locally; published website content is written to backend.
        </p>
      </Panel>
    </>
  );
}

function SchoolSettings() {
  const db = useDb();
  const content = db.websiteContent;
  const fields: Array<[keyof typeof content, string]> = [
    ["schoolName", "School name"],
    ["tagline", "Tagline"],
    ["phone", "Phone"],
    ["email", "Email"],
    ["address", "Address"],
    ["mapUrl", "Google Maps URL"],
  ];
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const updates = Object.fromEntries(
      fields.map(([key]) => [key, String(formData.get(String(key)) ?? "")]),
    );
    setDb((current) => ({ ...current, websiteContent: { ...current.websiteContent, ...updates } }));
    audit("School settings updated", "masteradmin");
  };

  return (
    <>
      <PageTitle kicker="Configuration" title="School Settings" />
      <Panel title="Institution settings">
        <form onSubmit={save}>
          <div className="grid gap-5 md:grid-cols-2">
            {fields.map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {label}
                </span>
                <input
                  id={`master-setting-${key}`}
                  name={key}
                  className="mt-1.5 w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                  defaultValue={String(content[key] || "")}
                />
              </label>
            ))}
          </div>
          <button type="submit" className="mt-6 bg-navy px-5 py-2.5 text-sm text-white">
            Save settings
          </button>
        </form>
      </Panel>
    </>
  );
}

function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    masteradmin: "Master Admin",
    superadmin: "Super Admin",
    website_admin: "Website Admin",
    master_edutrack_admin: "Master EduTrack Admin",
    eduzync_admin: "EduTrack Admin",
    staff_admin: "Staff Admin",
    student: "Student",
    parent: "Parent",
    teacher: "Teacher",
  };
  return labels[role];
}
