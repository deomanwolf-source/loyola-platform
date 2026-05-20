import { useState } from "react";
import { PortalShell, PageTitle, StatCard, Panel, DataTable, Badge } from "./PortalShell";
import { useDb, useAuth } from "@/lib/store";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Calendar,
  Bus,
  Award,
  FileText,
} from "lucide-react";

const groups = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "schedule", label: "Class Schedule", icon: Calendar },
    ],
  },
  {
    label: "Academics",
    items: [
      { id: "subjects", label: "My Subjects", icon: BookOpen },
      { id: "assignments", label: "Assignments", icon: ClipboardCheck },
      { id: "results", label: "Exam Results", icon: Award },
      { id: "library", label: "Library", icon: FileText },
    ],
  },
  { label: "Campus", items: [{ id: "transport", label: "Transport", icon: Bus }] },
];

export function StudentPortal() {
  const auth = useAuth();
  const db = useDb();
  const [active, setActive] = useState("dashboard");
  const me = db.students.find((s) => s.name === auth.user?.name) || db.students[0];

  return (
    <PortalShell
      role="student"
      title="Student Portal"
      groups={groups}
      active={active}
      onActiveChange={setActive}
    >
      {active === "dashboard" && (
        <>
          <PageTitle kicker="Welcome back" title={`Hello, ${auth.user?.name?.split(" ")[0]}`} />
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Attendance" value={`${me?.attendance ?? 0}%`} accent />
            <StatCard
              label="Open assignments"
              value={db.assignments.filter((a) => a.status === "Open").length}
            />
            <StatCard label="Subjects this term" value={db.subjects.length} />
            <StatCard label="Class" value={`${me?.grade} ${me?.section}`} />
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Panel title="Today's schedule">
                <ul className="divide-y divide-border">
                  {[
                    { t: "08:00", s: "Mathematics", r: "Room 204" },
                    { t: "09:30", s: "English Literature", r: "Library" },
                    { t: "11:00", s: "Science (Lab)", r: "STEM Lab 1" },
                    { t: "13:00", s: "Art & Design", r: "Studio 2" },
                  ].map((p) => (
                    <li key={p.t} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-4">
                        <span className="font-serif text-xl text-gold w-16">{p.t}</span>
                        <div>
                          <p className="font-medium text-navy">{p.s}</p>
                          <p className="text-xs text-muted-foreground">{p.r}</p>
                        </div>
                      </div>
                      <Badge tone="gold">Today</Badge>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
            <Panel title="Upcoming">
              <ul className="space-y-4">
                {db.assignments.map((a) => (
                  <li key={a.id} className="border-l-2 border-gold pl-3">
                    <p className="font-medium text-navy">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {a.due} · {a.className}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}
      {active === "schedule" && (
        <>
          <PageTitle kicker="Academic week" title="Class Schedule" />
          <Panel title="Week of May 04 – May 10">
            <DataTable
              rows={[
                { id: "1", day: "Monday", a: "Maths", b: "English", c: "Science" },
                { id: "2", day: "Tuesday", a: "Art", b: "Maths", c: "History" },
                { id: "3", day: "Wednesday", a: "Science", b: "PE", c: "Maths" },
              ]}
              columns={[
                { key: "day", label: "Day" },
                { key: "a", label: "Period 1" },
                { key: "b", label: "Period 2" },
                { key: "c", label: "Period 3" },
              ]}
            />
          </Panel>
        </>
      )}
      {active === "subjects" && (
        <>
          <PageTitle kicker="Academics" title="My Subjects" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {db.subjects.map((s) => (
              <div key={s.id} className="border border-border bg-card p-6 shadow-soft">
                <Badge tone="gold">{s.department}</Badge>
                <h3 className="mt-3 font-serif text-xl text-navy">{s.name}</h3>
                <p className="text-xs text-muted-foreground">{s.grade}</p>
              </div>
            ))}
          </div>
        </>
      )}
      {active === "assignments" && (
        <>
          <PageTitle kicker="Coursework" title="Assignments" />
          <Panel title="Open and recent">
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
        </>
      )}
      {active === "results" && (
        <>
          <PageTitle kicker="Performance" title="Exam Results" />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { s: "Mathematics", g: "A" },
              { s: "English", g: "A-" },
              { s: "Science", g: "A" },
              { s: "History", g: "B+" },
              { s: "Art", g: "A" },
              { s: "PE", g: "A" },
            ].map((r) => (
              <div
                key={r.s}
                className="border border-border bg-card p-6 flex items-center justify-between"
              >
                <p className="font-medium text-navy">{r.s}</p>
                <span className="font-serif text-3xl text-gold">{r.g}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {active === "library" && (
        <>
          <PageTitle kicker="Library" title="Catalogue" />
          <Panel title="Books">
            <DataTable
              rows={db.library}
              columns={[
                { key: "title", label: "Title" },
                { key: "author", label: "Author" },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => (
                    <Badge tone={r.status === "Available" ? "success" : "warning"}>
                      {r.status}
                    </Badge>
                  ),
                },
              ]}
            />
          </Panel>
        </>
      )}
      {active === "transport" && (
        <>
          <PageTitle kicker="Campus" title="Transport" />
          <Panel title="Routes">
            <DataTable
              rows={db.transport}
              columns={[
                { key: "route", label: "Route" },
                { key: "bus", label: "Bus" },
                { key: "driver", label: "Driver" },
                { key: "stop", label: "Stop" },
              ]}
            />
          </Panel>
        </>
      )}
    </PortalShell>
  );
}
