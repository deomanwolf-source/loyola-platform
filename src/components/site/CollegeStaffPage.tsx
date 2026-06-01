import { useMemo, useState } from "react";
import { BookOpen, Briefcase, GraduationCap, Search, User, Users, X } from "lucide-react";
import { PageHeader, PublicLayout } from "@/components/site/PublicLayout";
import { useDb, type Teacher } from "@/lib/store";

type StaffAssignment = Teacher & {
  directoryCategory: string;
  displayPosition: string;
  assignmentKey: string;
};

type DirectorySection = {
  id: string;
  title: string;
  categories: string[];
};

type DirectoryGroup = {
  id: string;
  title: string;
  sections: DirectorySection[];
};

const DIRECTORY_GROUPS: DirectoryGroup[] = [
  {
    id: "academic",
    title: "Academic Staff",
    sections: [
      {
        id: "college-administration",
        title: "1.1 College Administration",
        categories: ["College Administration"],
      },
      {
        id: "assistant-sectional-heads",
        title: "1.2 Assistant Sectional Heads",
        categories: ["Assistant Sectional Heads"],
      },
      { id: "subject-heads", title: "1.3 Subject Heads", categories: ["Subject Heads"] },
      { id: "grade-heads", title: "1.4 Grade Heads", categories: ["Grade Heads"] },
      {
        id: "advanced-level-stream-heads",
        title: "1.5 Advanced Level Stream Heads",
        categories: ["Advanced Level Stream Heads"],
      },
      {
        id: "subject-coordinators-primary",
        title: "2.1 Subject Coordinators - Primary School",
        categories: ["Subject Coordinators - Primary School"],
      },
      {
        id: "subject-coordinators-middle",
        title: "2.2 Subject Coordinators - Middle School",
        categories: ["Subject Coordinators - Middle School"],
      },
      {
        id: "subject-coordinators-upper",
        title: "2.3 Subject Coordinators - Upper School",
        categories: ["Subject Coordinators - Upper School"],
      },
      {
        id: "aesthetic-subject-coordinators",
        title: "2.4 Aesthetic Subject Coordinators - Grade 6 to 11",
        categories: ["Aesthetic Subject Coordinators"],
      },
      {
        id: "subject-coordinators-advanced",
        title: "2.5 Subject Coordinators - Advanced Level",
        categories: ["Subject Coordinators - Advanced Level"],
      },
      {
        id: "english-medium-coordinators",
        title: "2.6 English Medium Coordinators",
        categories: ["English Medium Coordinators"],
      },
      {
        id: "class-teachers-primary",
        title: "3.1 Primary School Class Teachers",
        categories: ["Class Teachers - Primary School"],
      },
      {
        id: "class-teachers-middle",
        title: "3.2 Middle School Class Teachers",
        categories: ["Class Teachers - Middle School"],
      },
      {
        id: "class-teachers-upper",
        title: "3.3 Upper School Class Teachers",
        categories: ["Class Teachers - Upper School"],
      },
      {
        id: "class-teachers-advanced",
        title: "3.4 Advanced Level Class Teachers",
        categories: ["Class Teachers - Advanced Level"],
      },
      {
        id: "subject-teachers-primary",
        title: "4.1 Subject Teachers - Primary School",
        categories: ["Subject Teachers - Primary School"],
      },
      {
        id: "subject-teachers-middle",
        title: "4.2 Subject Teachers - Middle School",
        categories: ["Subject Teachers - Middle School"],
      },
      {
        id: "subject-teachers-upper",
        title: "4.3 Subject Teachers - Upper School",
        categories: ["Subject Teachers - Upper School"],
      },
      {
        id: "subject-teachers-advanced",
        title: "4.4 Subject Teachers - Advanced Level",
        categories: ["Subject Teachers - Advanced Level"],
      },
      {
        id: "special-need-resource-unit",
        title: "4.5 Special Need Resource Unit",
        categories: ["Special Need Resource Unit"],
      },
      {
        id: "visiting-teachers",
        title: "4.6 Visiting Teachers",
        categories: ["Visiting Teachers"],
      },
      { id: "counsellor", title: "4.7 Counsellor", categories: ["Counsellor"] },
      {
        id: "all-teachers-directory",
        title: "All Teachers Directory",
        categories: ["All Teachers Directory"],
      },
    ],
  },
  {
    id: "non-academic",
    title: "Non-Academic Staff",
    sections: [
      {
        id: "administrative-department",
        title: "5.1 Administrative Department",
        categories: ["Administrative Department"],
      },
      {
        id: "academic-department",
        title: "5.2 Academic Department",
        categories: ["Academic Department"],
      },
      {
        id: "financial-department",
        title: "5.3 Financial Department",
        categories: ["Financial Department"],
      },
      { id: "it-department", title: "5.4 IT Department", categories: ["IT Department"] },
      {
        id: "front-office-bookstore-office-support",
        title: "5.5 Front Office / Bookstore / Office Support",
        categories: ["Front Office / Bookstore / Office Support"],
      },
      {
        id: "maintenance-department",
        title: "5.6 Maintenance Department",
        categories: ["Maintenance Department"],
      },
      {
        id: "health-library-services",
        title: "5.7 Health & Library Services",
        categories: ["Health & Library Services"],
      },
    ],
  },
  {
    id: "supportive",
    title: "Supportive Staff",
    sections: [
      {
        id: "supportive-staff",
        title: "6.1 Supportive Staff",
        categories: ["Supportive Staff"],
      },
    ],
  },
  {
    id: "general-academic-council",
    title: "General Academic Council",
    sections: [
      {
        id: "general-academic-council-advanced",
        title: "7.1 Advanced Level Section",
        categories: ["General Academic Council - Advanced Level Section"],
      },
      {
        id: "general-academic-council-upper",
        title: "7.2 Upper School",
        categories: ["General Academic Council - Upper School"],
      },
      {
        id: "general-academic-council-middle",
        title: "7.3 Middle School",
        categories: ["General Academic Council - Middle School"],
      },
      {
        id: "general-academic-council-primary",
        title: "7.4 Primary School",
        categories: ["General Academic Council - Primary School"],
      },
    ],
  },
];

const exactCategoryAliases: Record<string, string> = {
  "top administration": "College Administration",
  administration: "College Administration",
  "college administration": "College Administration",
  "vice principals": "College Administration",
  "sectional heads": "College Administration",
  "assistant sectional heads": "Assistant Sectional Heads",
  "subject heads": "Subject Heads",
  "grade heads": "Grade Heads",
  "stream heads": "Advanced Level Stream Heads",
  "a/l stream heads": "Advanced Level Stream Heads",
  "al stream heads": "Advanced Level Stream Heads",
  "advanced level stream heads": "Advanced Level Stream Heads",
  "primary school subject coordinators": "Subject Coordinators - Primary School",
  "subject coordinators - primary school": "Subject Coordinators - Primary School",
  "middle school subject coordinators": "Subject Coordinators - Middle School",
  "subject coordinators - middle school": "Subject Coordinators - Middle School",
  "upper school subject coordinators": "Subject Coordinators - Upper School",
  "subject coordinators - upper school": "Subject Coordinators - Upper School",
  "aesthetic subject coordinators": "Aesthetic Subject Coordinators",
  "advanced level subject coordinators": "Subject Coordinators - Advanced Level",
  "subject coordinators - advanced level": "Subject Coordinators - Advanced Level",
  "english medium coordinators": "English Medium Coordinators",
  "class teachers - primary school": "Class Teachers - Primary School",
  "class teachers - middle school": "Class Teachers - Middle School",
  "class teachers - upper school": "Class Teachers - Upper School",
  "class teachers - advance level section": "Class Teachers - Advanced Level",
  "class teachers - advanced level": "Class Teachers - Advanced Level",
  "class teachers": "Class Teachers",
  "subject teachers - primary school": "Subject Teachers - Primary School",
  "subject teachers - middle school": "Subject Teachers - Middle School",
  "subject teachers - upper school": "Subject Teachers - Upper School",
  "subject teachers - advanced level": "Subject Teachers - Advanced Level",
  "subject teachers": "Subject Teachers",
  "special academic positions": "Special Need Resource Unit",
  "special need resource unit": "Special Need Resource Unit",
  "visiting teachers": "Visiting Teachers",
  counsellor: "Counsellor",
  counselor: "Counsellor",
  "non-academic staff": "Non-Academic Staff",
  "administrative department": "Administrative Department",
  "academic department": "Academic Department",
  "financial department": "Financial Department",
  "it department": "IT Department",
  "front office / bookstore / office support": "Front Office / Bookstore / Office Support",
  "maintenance department": "Maintenance Department",
  "health & library services": "Health & Library Services",
  "other non-academic positions": "Administrative Department",
  "supportive staff": "Supportive Staff",
  "general academic council": "General Academic Council - Advanced Level Section",
  "general academic council - advanced level section":
    "General Academic Council - Advanced Level Section",
  "general academic council - upper school": "General Academic Council - Upper School",
  "general academic council - middle school": "General Academic Council - Middle School",
  "general academic council - primary school": "General Academic Council - Primary School",
  "all teachers directory": "All Teachers Directory",
  "all teachers directory only": "All Teachers Directory",
};

const filters = [
  "All",
  "Academic Staff",
  "Non-Academic Staff",
  "Supportive Staff",
  "General Academic Council",
  "Administration",
  "Grade Heads",
  "Subject Coordinators",
  "Class Teachers",
  "Subject Teachers",
];

function normalize(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function personKey(staff: Teacher) {
  return normalize(staff.staffId || staff.id.split("__")[0] || staff.name);
}

function schoolSection(staff: Teacher) {
  const text = normalize(
    [
      staff.section,
      staff.classes,
      staff.position,
      staff.subject,
      staff.category,
      staff.websitePlace,
    ].join(" "),
  );
  if (/primary|grade [1-5]\b/.test(text)) return "Primary School";
  if (/middle|grade [6-8]\b/.test(text)) return "Middle School";
  if (/upper|grade (9|10|11)\b/.test(text)) return "Upper School";
  if (/advanced|advance|a\/l|grade (12|13)\b|commerce|arts|biology|technology/.test(text)) {
    return "Advanced Level";
  }
  return "";
}

function sectionedCategory(prefix: string, staff: Teacher) {
  const section = schoolSection(staff);
  if (section) return `${prefix} - ${section}`;
  return `${prefix} - Primary School`;
}

function nonAcademicCategory(staff: Teacher) {
  const text = normalize([staff.section, staff.position, staff.subject, staff.classes].join(" "));
  if (/finance|account/.test(text)) return "Financial Department";
  if (/\bit\b|technology|computer/.test(text)) return "IT Department";
  if (/maintenance|supervisor|electric|repair|ground/.test(text)) return "Maintenance Department";
  if (/library|librarian|nursing|health/.test(text)) return "Health & Library Services";
  if (/front|bookstore|office assistant|reception|clerk/.test(text)) {
    return "Front Office / Bookstore / Office Support";
  }
  if (/academic office|academic officer/.test(text)) return "Academic Department";
  return "Administrative Department";
}

function councilCategory(staff: Teacher) {
  const section = schoolSection(staff);
  if (section === "Primary School") return "General Academic Council - Primary School";
  if (section === "Middle School") return "General Academic Council - Middle School";
  if (section === "Upper School") return "General Academic Council - Upper School";
  return "General Academic Council - Advanced Level Section";
}

function directoryCategory(staff: Teacher) {
  const raw = normalize(staff.websitePlace || staff.category);
  const exact = exactCategoryAliases[raw];
  const text = normalize(
    [
      staff.websitePlace,
      staff.category,
      staff.section,
      staff.position,
      staff.subject,
      staff.classes,
      staff.type,
    ].join(" "),
  );

  if (exact && exact !== "Class Teachers" && exact !== "Subject Teachers") return exact;
  if (/general academic council|council member|president|vice president/.test(text)) {
    return councilCategory(staff);
  }
  if (/assistant sectional head/.test(text)) return "Assistant Sectional Heads";
  if (
    /rector|principal|vice rector|vice principal|prefect of games|priest in charge|sectional head/.test(
      text,
    )
  ) {
    return "College Administration";
  }
  if (/subject head/.test(text)) return "Subject Heads";
  if (/grade\s*\d*\s*head|grade head/.test(text)) return "Grade Heads";
  if (/stream head|a\/l stream|advanced level stream/.test(text)) {
    return "Advanced Level Stream Heads";
  }
  if (/english medium/.test(text)) return "English Medium Coordinators";
  if (/coordinator/.test(text)) return sectionedCategory("Subject Coordinators", staff);
  if (/class teacher/.test(text) || exact === "Class Teachers") {
    return sectionedCategory("Class Teachers", staff);
  }
  if (/special need|resource unit/.test(text)) return "Special Need Resource Unit";
  if (/visiting/.test(text)) return "Visiting Teachers";
  if (/counsellor|counselor/.test(text)) return "Counsellor";
  if (/subject teacher/.test(text) || exact === "Subject Teachers") {
    return sectionedCategory("Subject Teachers", staff);
  }
  if (staff.type === "Supportive Staff") return "Supportive Staff";
  if (staff.type === "Non-Academic Staff" || exact === "Non-Academic Staff") {
    return nonAcademicCategory(staff);
  }
  return exact || "All Teachers Directory";
}

function displayPosition(staff: Teacher) {
  if (staff.position) return staff.position;
  if (staff.subject && staff.classes) return `${staff.subject} - ${staff.classes}`;
  return staff.subject || staff.type || "Staff Member";
}

function matchesFilter(staff: StaffAssignment, activeFilter: string) {
  if (activeFilter === "All") return true;
  if (activeFilter === "Academic Staff") {
    return (
      staff.type === "Academic Staff" ||
      DIRECTORY_GROUPS[0].sections.some((section) =>
        section.categories.includes(staff.directoryCategory),
      )
    );
  }
  if (activeFilter === "Non-Academic Staff") {
    return (
      staff.type === "Non-Academic Staff" ||
      DIRECTORY_GROUPS[1].sections.some((section) =>
        section.categories.includes(staff.directoryCategory),
      )
    );
  }
  if (activeFilter === "Supportive Staff") {
    return staff.type === "Supportive Staff" || staff.directoryCategory === "Supportive Staff";
  }
  if (activeFilter === "General Academic Council") {
    return staff.directoryCategory.startsWith("General Academic Council");
  }
  if (activeFilter === "Administration")
    return staff.directoryCategory === "College Administration";
  if (activeFilter === "Grade Heads") return staff.directoryCategory === "Grade Heads";
  if (activeFilter === "Subject Coordinators") {
    return (
      staff.directoryCategory.includes("Subject Coordinators") ||
      staff.directoryCategory === "Aesthetic Subject Coordinators" ||
      staff.directoryCategory === "English Medium Coordinators"
    );
  }
  if (activeFilter === "Class Teachers")
    return staff.directoryCategory.startsWith("Class Teachers");
  if (activeFilter === "Subject Teachers") {
    return (
      staff.directoryCategory.startsWith("Subject Teachers") ||
      ["Special Need Resource Unit", "Visiting Teachers", "Counsellor"].includes(
        staff.directoryCategory,
      )
    );
  }
  return staff.type === activeFilter;
}

export function CollegeStaffPage({ pageId = "about/college-staff" }: { pageId?: string }) {
  const db = useDb();
  const page = db.pages[pageId] || db.pages["about/college-staff"];
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedTeacher, setSelectedTeacher] = useState<StaffAssignment | null>(null);

  const assignments = useMemo(() => {
    const visibleRows = (db.teachers || [])
      .filter((staff) => {
        if (
          staff.status !== "Active" ||
          staff.position === "The Archbishop of Colombo" ||
          staff.position === "General Manager of Catholic Private Schools"
        ) {
          return false;
        }
        return Boolean(staff.name?.trim());
      })
      .map((staff, index) => ({
        ...staff,
        directoryCategory: directoryCategory(staff),
        displayPosition: displayPosition(staff),
        assignmentKey: `${staff.id || staff.name}-${index}`,
      }));

    const peopleWithSpecificRows = new Set(
      visibleRows
        .filter((staff) => staff.directoryCategory !== "All Teachers Directory")
        .map((staff) => personKey(staff)),
    );

    return visibleRows.filter(
      (staff) =>
        staff.directoryCategory !== "All Teachers Directory" ||
        !peopleWithSpecificRows.has(personKey(staff)),
    );
  }, [db.teachers]);

  const filteredAssignments = assignments.filter((staff) => {
    const query = normalize(search);
    const matchesSearch =
      !query ||
      normalize(staff.name).includes(query) ||
      normalize(staff.subject).includes(query) ||
      normalize(staff.classes).includes(query) ||
      normalize(staff.position).includes(query) ||
      normalize(staff.section).includes(query) ||
      normalize(staff.directoryCategory).includes(query);

    return matchesSearch && matchesFilter(staff, activeFilter);
  });

  const groups = DIRECTORY_GROUPS.map((group) => ({
    ...group,
    sections: group.sections
      .map((section) => ({
        ...section,
        items: filteredAssignments.filter((staff) =>
          section.categories.includes(staff.directoryCategory),
        ),
      }))
      .filter((section) => section.items.length > 0),
  })).filter((group) => group.sections.length > 0);

  return (
    <PublicLayout>
      <PageHeader
        pageId={pageId}
        kicker={page?.kicker || "About"}
        title={page?.title || "Staff Directory"}
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
                placeholder="Search by name, subject, grade, position, or section..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-lg border border-border bg-white py-4 pl-12 pr-4 text-navy shadow-soft outline-none transition-smooth focus:border-gold focus:shadow-elegant"
              />
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
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

      <section className="mx-auto max-w-7xl space-y-14 px-6 py-16">
        {groups.length > 0 ? (
          groups.map((group) => (
            <div key={group.id} className="space-y-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-crimson">
                  Staff Directory
                </p>
                <h3 className="mt-2 border-b border-border pb-4 font-serif text-4xl font-bold text-navy">
                  {group.title}
                </h3>
              </div>

              {group.sections.map((section) => (
                <div key={section.id}>
                  <h4 className="mb-6 font-serif text-2xl font-bold text-navy">{section.title}</h4>
                  <div className="stagger-children grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {section.items.map((staff) => (
                      <article
                        key={staff.assignmentKey}
                        className="group flex flex-col items-center rounded-lg border border-border bg-white p-6 text-center shadow-soft transition-smooth hover:-translate-y-1 hover:border-gold"
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
                        <h5 className="mt-4 font-bold text-navy">{staff.name}</h5>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-crimson">
                          {staff.displayPosition}
                        </p>
                        {(staff.subject || staff.classes || staff.section) && (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {[staff.subject, staff.classes || staff.section]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedTeacher(staff)}
                          className="mt-5 rounded-lg border border-border px-4 py-2 text-xs font-bold text-navy transition-smooth group-hover:border-navy group-hover:bg-navy group-hover:text-white"
                        >
                          View Profile
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
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

      {selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <button
              type="button"
              onClick={() => setSelectedTeacher(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/50 p-2 text-navy backdrop-blur transition-smooth hover:bg-secondary"
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
                  {selectedTeacher.directoryCategory}
                </p>
              </div>
              <div className="p-8">
                <h2 className="font-serif text-3xl font-bold text-navy">{selectedTeacher.name}</h2>
                <p className="mt-1 text-lg font-medium text-navy/80">
                  {selectedTeacher.displayPosition}
                </p>

                <div className="mt-8 space-y-5">
                  {(selectedTeacher.subject || selectedTeacher.classes) && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        <BookOpen className="h-4 w-4" /> Academic Focus
                      </h4>
                      <p className="text-sm text-navy">
                        {[selectedTeacher.subject, selectedTeacher.classes]
                          .filter(Boolean)
                          .join(" / ")}
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
