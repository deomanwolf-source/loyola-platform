import { useState } from "react";
import { PortalShell, PageTitle, StatCard, Panel, DataTable, Badge } from "./PortalShell";
import { useDb, useAuth, setDb, makeId, audit } from "@/lib/store";
import { LayoutDashboard, Users, ClipboardCheck, BookOpen, Calendar, FileText } from "lucide-react";

const groups = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "classes", label: "My Classes", icon: BookOpen },
    ],
  },
  {
    label: "Teaching",
    items: [
      { id: "students", label: "Students", icon: Users },
      { id: "attendance", label: "Attendance", icon: ClipboardCheck },
      { id: "assignments", label: "Assignments", icon: FileText },
    ],
  },
  { label: "Schedule", items: [{ id: "timetable", label: "Timetable", icon: Calendar }] },
];

export function TeacherPortal() {
  const auth = useAuth();
  const db = useDb();
  const [active, setActive] = useState("dashboard");

  const addAssignment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const assignment = {
      title: String(formData.get("title") ?? "").trim(),
      className: String(formData.get("className") ?? "Grade 8A"),
      due: String(formData.get("due") ?? ""),
    };
    if (!assignment.title) return;
    setDb((d) => ({
      ...d,
      assignments: [{ id: makeId("A"), ...assignment, status: "Open" }, ...d.assignments],
    }));
    audit(`Assignment created: ${assignment.title}`, auth.user?.email || "teacher");
    form.reset();
  };

  return (
    <PortalShell
      role="teacher"
      title="Teacher Portal"
      groups={groups}
      active={active}
      onActiveChange={setActive}
    >
      {active === "dashboard" && (
        <>
          <PageTitle kicker="Today" title={`Welcome, ${auth.user?.name?.split(" ")[0]}`} />
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Classes today" value={3} accent />
            <StatCard label="Students" value={db.students.length} />
            <StatCard
              label="Open assignments"
              value={db.assignments.filter((a) => a.status === "Open").length}
            />
            <StatCard
              label="Avg. attendance"
              value={`${Math.round(db.students.reduce((s, x) => s + x.attendance, 0) / Math.max(db.students.length, 1))}%`}
            />
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Panel title="Today's lessons">
                <ul className="divide-y divide-border">
                  {[
                    { t: "08:00", c: "Grade 8A · Algebra", r: "Room 204" },
                    { t: "10:00", c: "Grade 10B · Geometry", r: "Room 211" },
                    { t: "13:00", c: "Grade 12A · Calculus prep", r: "Room 301" },
                  ].map((p) => (
                    <li key={p.t} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-4">
                        <span className="font-serif text-xl text-gold w-16">{p.t}</span>
                        <div>
                          <p className="font-medium text-navy">{p.c}</p>
                          <p className="text-xs text-muted-foreground">{p.r}</p>
                        </div>
                      </div>
                      <Badge tone="gold">Upcoming</Badge>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
            <Panel title="Quick actions">
              <div className="space-y-3">
                <button
                  onClick={() => setActive("attendance")}
                  className="w-full border border-border px-4 py-3 text-left text-sm hover:border-gold"
                >
                  Mark today's attendance →
                </button>
                <button
                  onClick={() => setActive("assignments")}
                  className="w-full border border-border px-4 py-3 text-left text-sm hover:border-gold"
                >
                  Create assignment →
                </button>
                <button
                  onClick={() => setActive("students")}
                  className="w-full border border-border px-4 py-3 text-left text-sm hover:border-gold"
                >
                  View student roster →
                </button>
              </div>
            </Panel>
          </div>
        </>
      )}
      {active === "classes" && (
        <>
          <PageTitle kicker="Teaching" title="My Classes" />
          <Panel title="Assigned classes">
            <DataTable
              rows={db.classes}
              columns={[
                { key: "className", label: "Class" },
                { key: "section", label: "Section" },
                { key: "teacher", label: "Lead teacher" },
                { key: "students", label: "Students" },
              ]}
            />
          </Panel>
        </>
      )}
      {active === "students" && (
        <>
          <PageTitle kicker="Roster" title="Students" />
          <Panel title="All students">
            <DataTable
              rows={db.students}
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
      {active === "attendance" && (
        <>
          <PageTitle kicker="Today" title="Attendance" />
          <Panel title="Grade 8A — Period 1">
            <ul className="divide-y divide-border">
              {db.students.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <p className="font-medium text-navy">{s.name}</p>
                  <div className="flex gap-2">
                    <button className="border border-success px-3 py-1 text-xs text-success">
                      Present
                    </button>
                    <button className="border border-warning px-3 py-1 text-xs text-warning">
                      Late
                    </button>
                    <button className="border border-destructive px-3 py-1 text-xs text-destructive">
                      Absent
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
      {active === "assignments" && (
        <>
          <PageTitle kicker="Coursework" title="Assignments" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Create assignment">
              <form onSubmit={addAssignment} className="space-y-3">
                <input
                  id="assignment-title"
                  name="title"
                  required
                  placeholder="Title"
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                />
                <select
                  id="assignment-class"
                  name="className"
                  defaultValue="Grade 8A"
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                >
                  {db.classes.map((c) => (
                    <option key={c.id}>
                      {c.className}
                      {c.section}
                    </option>
                  ))}
                </select>
                <input
                  id="assignment-due"
                  name="due"
                  type="date"
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                />
                <button type="submit" className="bg-navy px-5 py-2.5 text-sm text-navy-foreground">
                  Create
                </button>
              </form>
            </Panel>
            <Panel title="Open assignments">
              <DataTable
                rows={db.assignments}
                columns={[
                  { key: "title", label: "Title" },
                  { key: "className", label: "Class" },
                  { key: "due", label: "Due" },
                  {
                    key: "status",
                    label: "Status",
                    render: (r) => (
                      <Badge tone={r.status === "Open" ? "warning" : "success"}>{r.status}</Badge>
                    ),
                  },
                ]}
              />
            </Panel>
          </div>
        </>
      )}
      {active === "timetable" && (
        <>
          <PageTitle kicker="Schedule" title="Timetable" />
          <Panel title="This week">
            <p className="text-sm text-muted-foreground">Week view of teaching commitments.</p>
          </Panel>
        </>
      )}
    </PortalShell>
  );
}
