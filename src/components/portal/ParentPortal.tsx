import { useState } from "react";
import { PortalShell, PageTitle, StatCard, Panel, DataTable, Badge } from "./PortalShell";
import { useDb, useAuth, setDb, makeId, audit } from "@/lib/store";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  MessageSquare,
  Calendar,
  FileText,
} from "lucide-react";

const groups = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "children", label: "My Children", icon: Users },
    ],
  },
  {
    label: "School life",
    items: [
      { id: "fees", label: "Fees", icon: CreditCard },
      { id: "events", label: "Events", icon: Calendar },
      { id: "reports", label: "Reports", icon: FileText },
    ],
  },
  { label: "Communication", items: [{ id: "messages", label: "Messages", icon: MessageSquare }] },
];

export function ParentPortal() {
  const auth = useAuth();
  const db = useDb();
  const [active, setActive] = useState("dashboard");
  const me = db.parents.find((p) => p.name === auth.user?.name) || db.parents[0];
  const myChildren = db.students.filter((s) => me && s.guardian === me.name);
  const myFees = db.fees.filter((f) => myChildren.some((c) => c.name === f.student));

  const sendMsg = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const subject = String(formData.get("subject") ?? "").trim();
    const body = String(formData.get("message") ?? "").trim();
    const user = auth.user;
    if (!subject || !body || !user) return;
    setDb((d) => ({
      ...d,
      messages: [
        {
          id: makeId("MSG"),
          name: user.name,
          email: user.email,
          subject,
          body,
          status: "Unread",
          createdAt: new Date().toISOString(),
        },
        ...d.messages,
      ],
    }));
    audit(`Parent message: ${subject}`, user.email);
    form.reset();
  };

  return (
    <PortalShell
      role="parent"
      title="Parent Portal"
      groups={groups}
      active={active}
      onActiveChange={setActive}
    >
      {active === "dashboard" && (
        <>
          <PageTitle
            kicker="Family overview"
            title={`Welcome, ${auth.user?.name?.split(" ")[0]}`}
          />
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Children enrolled" value={myChildren.length || 1} accent />
            <StatCard
              label="Outstanding fees"
              value={myFees.filter((f) => f.status === "Pending").length}
            />
            <StatCard label="Upcoming events" value={db.events.length} />
            <StatCard label="New messages" value={0} />
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Panel title="My children">
              <ul className="divide-y divide-border">
                {(myChildren.length ? myChildren : db.students.slice(0, 1)).map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-navy">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.grade} · Section {c.section}
                      </p>
                    </div>
                    <Badge tone="success">{c.attendance}% attendance</Badge>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Upcoming events">
              <ul className="space-y-4">
                {db.events.slice(0, 4).map((e) => (
                  <li key={e.id} className="border-l-2 border-gold pl-3">
                    <p className="font-medium text-navy">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.date} · {e.location}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}
      {active === "children" && (
        <>
          <PageTitle kicker="Family" title="My Children" />
          <Panel title="Enrolled students">
            <DataTable
              rows={myChildren.length ? myChildren : db.students}
              columns={[
                { key: "name", label: "Name" },
                { key: "grade", label: "Grade" },
                { key: "section", label: "Section" },
                { key: "attendance", label: "Attendance", render: (r) => `${r.attendance}%` },
              ]}
            />
          </Panel>
        </>
      )}
      {active === "fees" && (
        <>
          <PageTitle kicker="Finance" title="Fees" />
          <Panel title="Statements">
            <DataTable
              rows={db.fees}
              columns={[
                { key: "student", label: "Student" },
                { key: "term", label: "Term" },
                {
                  key: "amount",
                  label: "Amount",
                  render: (r) => `LKR ${r.amount.toLocaleString()}`,
                },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => (
                    <Badge tone={r.status === "Paid" ? "success" : "warning"}>{r.status}</Badge>
                  ),
                },
              ]}
            />
          </Panel>
        </>
      )}
      {active === "events" && (
        <>
          <PageTitle kicker="Calendar" title="Events" />
          <Panel title="Upcoming">
            <DataTable
              rows={db.events}
              columns={[
                { key: "title", label: "Title" },
                { key: "date", label: "Date" },
                { key: "location", label: "Location" },
                { key: "type", label: "Type" },
              ]}
            />
          </Panel>
        </>
      )}
      {active === "reports" && (
        <>
          <PageTitle kicker="Academics" title="Reports" />
          <Panel title="Term reports">
            <p className="text-sm text-muted-foreground">
              Term 2 report card will be available on June 14, 2026.
            </p>
          </Panel>
        </>
      )}
      {active === "messages" && (
        <>
          <PageTitle kicker="Communication" title="Messages" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Send a message to the school">
              <form onSubmit={sendMsg} className="space-y-3">
                <input
                  id="parent-message-subject"
                  name="subject"
                  required
                  placeholder="Subject"
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                />
                <textarea
                  id="parent-message-body"
                  name="message"
                  required
                  rows={5}
                  placeholder="Message"
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold resize-none"
                />
                <button type="submit" className="bg-navy px-5 py-2.5 text-sm text-navy-foreground">
                  Send
                </button>
              </form>
            </Panel>
            <Panel title="Conversation history">
              <DataTable
                empty="No messages yet."
                rows={db.messages.filter((m) => m.email === auth.user?.email)}
                columns={[
                  { key: "subject", label: "Subject" },
                  {
                    key: "createdAt",
                    label: "Sent",
                    render: (r) => new Date(r.createdAt).toLocaleDateString(),
                  },
                  { key: "status", label: "Status" },
                ]}
              />
            </Panel>
          </div>
        </>
      )}
    </PortalShell>
  );
}
