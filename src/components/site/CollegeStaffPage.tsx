import { useState } from "react";
import { Search, User, X, Briefcase, GraduationCap, Users, BookOpen } from "lucide-react";
import { PageHeader, PublicLayout } from "@/components/site/PublicLayout";
import { useDb, type Teacher } from "@/lib/store";

export function CollegeStaffPage({ pageId = "about/college-staff" }: { pageId?: string }) {
  const db = useDb();
  const page = db.pages[pageId] || db.pages["about/college-staff"];
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  const filters = [
    "All",
    "Academic Staff",
    "Non-Academic Staff",
    "Supportive Staff",
    "Administration",
    "Grade Heads",
    "Subject Coordinators",
  ];

  // Filtering Logic
  const seenStaff = new Set<string>();
  const allStaff = (db.teachers || []).filter((s) => {
    if (
      s.status !== "Active" ||
      s.position === "The Archbishop of Colombo" ||
      s.position === "General Manager of Catholic Private Schools"
    ) {
      return false;
    }

    const key = `${s.name}`.trim().toLowerCase().replace(/\s+/g, " ");
    if (!key) return false;
    if (seenStaff.has(key)) return false;
    seenStaff.add(key);
    return true;
  });
  const filteredStaff = allStaff.filter((staff) => {
    // 1. Search text matching
    const s = search.toLowerCase();
    const matchSearch =
      staff.name.toLowerCase().includes(s) ||
      (staff.subject && staff.subject.toLowerCase().includes(s)) ||
      (staff.classes && staff.classes.toLowerCase().includes(s)) ||
      (staff.position && staff.position.toLowerCase().includes(s));

    // 2. Filter matching
    let matchFilter = true;
    if (activeFilter !== "All") {
      if (activeFilter === "Administration") {
        matchFilter = staff.category === "Top Administration" || staff.section === "Administration";
      } else if (activeFilter === "Grade Heads") {
        matchFilter = staff.category === "Grade Heads";
      } else if (activeFilter === "Subject Coordinators") {
        matchFilter = staff.category === "Subject Coordinators";
      } else {
        matchFilter = staff.type === activeFilter;
      }
    }

    return matchSearch && matchFilter;
  });

  const getByCategory = (category: string) => filteredStaff.filter((s) => s.category === category);

  // Custom grouping based on user request:
  const orderedCategories = [
    "Top Administration",
    "Vice Principals",
    "Sectional Heads",
    "Subject Heads",
    "Grade Heads",
    "A/L Stream Heads",
    "Primary School Subject Coordinators",
    "Middle School Subject Coordinators",
    "Upper School Subject Coordinators",
    "Aesthetic Subject Coordinators",
    "Advanced Level Subject Coordinators",
    "English Medium Coordinators",
    "Class Teachers - Primary School",
    "Class Teachers - Middle School",
    "Class Teachers - Upper School",
    "Class Teachers - Advance Level Section",
    "Subject Teachers - Primary School",
    "Subject Teachers - Middle School",
    "Subject Teachers - Upper School",
    "Subject Teachers - Advanced Level",
    "Special Academic Positions",
    "Administrative Department",
    "Academic Department",
    "Financial Department",
    "IT Department",
    "Other Non-Academic Positions",
    "Supportive Staff",
    "All Teachers Directory",
  ];

  const sections = orderedCategories
    .map((category) => {
      let items = getByCategory(category);
      if (category === "All Teachers Directory") {
        items = filteredStaff.filter(
          (s) =>
            !orderedCategories.includes(s.category || "") ||
            s.category === "All Teachers Directory",
        );
      }
      return {
        id: category.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: category,
        items,
      };
    })
    .filter((section) => section.items.length > 0);

  return (
    <PublicLayout>
      <PageHeader
        pageId={pageId}
        kicker={page?.kicker || "About"}
        title={page?.title || "College Staff"}
        subtitle={page?.body || "Meet our dedicated staff, teachers, and administrators."}
        image={page?.image || db.media.campusImage || db.websiteContent.heroImage}
      />

      <section className="bg-secondary/20 py-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-3xl font-bold text-navy">Find a Staff Member</h2>
            <div className="relative mt-6">
              <input
                type="text"
                placeholder="Search teacher by name, subject, grade, or position..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-white py-4 pl-12 pr-4 text-navy shadow-soft outline-none transition-smooth focus:border-gold focus:shadow-elegant"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
            <div className="stagger-children mt-6 flex flex-wrap justify-center gap-2">
              {filters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full border px-4 py-2 text-xs font-bold transition-smooth ${
                    activeFilter === filter
                      ? "border-navy bg-navy text-white"
                      : "border-border bg-white text-navy hover:border-gold"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-16 px-6 py-16">
        {sections.length > 0 ? (
          sections.map((section) => (
            <div key={section.id}>
              <h3 className="mb-8 border-b border-border pb-4 font-serif text-3xl font-bold text-navy">
                {section.title}
              </h3>
              <div className="stagger-children grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {section.items.map((staff) => (
                  <article
                    key={staff.id}
                    className="group hover-lift flex flex-col items-center rounded-lg border border-border bg-white p-6 text-center shadow-soft transition-smooth hover:-translate-y-1 hover:border-gold"
                  >
                    <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-secondary shadow-inner">
                      {staff.image ? (
                        <img
                          src={staff.image}
                          alt={staff.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-secondary/50 text-muted-foreground">
                          <User className="h-12 w-12" />
                        </div>
                      )}
                    </div>
                    <h4 className="mt-4 font-bold text-navy">{staff.name}</h4>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-crimson">
                      {staff.position || staff.subject || staff.type}
                    </p>
                    {staff.classes && (
                      <p className="mt-2 text-sm text-muted-foreground">{staff.classes}</p>
                    )}
                    <button
                      onClick={() => setSelectedTeacher(staff)}
                      className="mt-5 rounded-lg border border-border px-4 py-2 text-xs font-bold text-navy transition-smooth group-hover:bg-navy group-hover:text-white group-hover:border-navy"
                    >
                      View Profile
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-bold text-navy">No staff found</h3>
            <p className="mt-2 text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        )}
      </section>

      {/* Teacher Profile Popup */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setSelectedTeacher(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/50 p-2 text-navy hover:bg-secondary transition-smooth backdrop-blur"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="grid md:grid-cols-[1fr_2fr]">
              <div className="flex flex-col items-center justify-center border-r border-border bg-secondary/30 p-8">
                <div className="h-40 w-40 overflow-hidden rounded-full border-4 border-white shadow-soft">
                  {selectedTeacher.image ? (
                    <img
                      src={selectedTeacher.image}
                      alt={selectedTeacher.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-secondary/50 text-muted-foreground">
                      <User className="h-16 w-16" />
                    </div>
                  )}
                </div>
                <p className="mt-6 text-center text-xs font-bold uppercase tracking-[0.1em] text-crimson">
                  {selectedTeacher.section || "General Staff"}
                </p>
              </div>
              <div className="p-8">
                <h2 className="font-serif text-3xl font-bold text-navy">{selectedTeacher.name}</h2>
                <p className="mt-1 text-lg font-medium text-navy/80">
                  {selectedTeacher.position || selectedTeacher.type}
                </p>

                <div className="mt-8 space-y-5">
                  {(selectedTeacher.subject || selectedTeacher.classes) && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        <BookOpen className="h-4 w-4" /> Academic Focus
                      </h4>
                      <p className="text-sm text-navy">
                        {selectedTeacher.subject}{" "}
                        {selectedTeacher.classes && `(${selectedTeacher.classes})`}
                      </p>
                    </div>
                  )}
                  {selectedTeacher.qualifications && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        <GraduationCap className="h-4 w-4" /> Qualifications
                      </h4>
                      <p className="text-sm text-navy">{selectedTeacher.qualifications}</p>
                    </div>
                  )}
                  {selectedTeacher.responsibilities && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        <Briefcase className="h-4 w-4" /> Responsibilities
                      </h4>
                      <p className="text-sm text-navy">{selectedTeacher.responsibilities}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}
