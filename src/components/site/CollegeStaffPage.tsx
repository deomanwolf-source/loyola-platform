import { useEffect, useMemo, useState } from "react";
import { Briefcase, GraduationCap, Search, User, Users, X } from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { useDb, type Teacher } from "@/lib/store";
import { API_URL } from "@/lib/api";
import {
  STAFF_DISPLAY_GROUPS,
  parseStaffPosition,
  staffDisplayGroupFor,
  staffPositionCodeOrder,
  type StaffDisplayGroup,
} from "@/lib/staff-display-order";
import type { ParsedPositionCode } from "@/lib/staff-position-codes";

type StaffProfile = {
  id: string;
  slug: string;
  name: string;
  image: string;
  qualifications: string;
  bio: string;
  status: string;
  sortOrder: number;
  positions: ParsedPositionCode[];
};

type StaffAssignment = {
  profile: StaffProfile;
  position: ParsedPositionCode;
  group: StaffDisplayGroup;
};

type StaffTypeFilter = "Academic Staff" | "Non-Academic Staff" | "Supportive Staff";

const STAFF_TYPE_FILTERS: StaffTypeFilter[] = [
  "Academic Staff",
  "Non-Academic Staff",
  "Supportive Staff",
];

const filterIconMap = {
  "Academic Staff": GraduationCap,
  "Non-Academic Staff": Briefcase,
  "Supportive Staff": Users,
} as const;

function normalize(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function slugify(value: string) {
  return (
    normalize(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "staff"
  );
}

function profileKey(staff: Teacher) {
  return staff.staffId || staff.id.split("__")[0] || staff.slug || staff.name;
}

function profileFromTeacher(staff: Teacher): StaffProfile {
  return {
    id: profileKey(staff),
    slug: staff.slug || slugify(staff.name || profileKey(staff)),
    name: staff.name || "",
    image: staff.image || "",
    qualifications: staff.qualifications || "",
    bio: staff.bio || staff.responsibilities || "",
    status: staff.status || "Active",
    sortOrder: Number(staff.sortOrder || 0),
    positions: [],
  };
}

function fallbackPosition(staff: Teacher) {
  const code = Array.isArray(staff.positionCodes) ? staff.positionCodes[0] : "";
  return parseStaffPosition({
    position_code: code,
    display_title: staff.position || staff.subject || staff.category || "Staff Member",
    main_category: staff.type || "",
    section: staff.websitePlace || staff.category || "",
    subsection: staff.section || "",
    sort_order: staffPositionCodeOrder(code || staff.position || ""),
  });
}

function isNonAcademicStaff(staff: Teacher) {
  return staff.type === "Non-Academic Staff";
}

function coerceUnknownNonAcademicPosition(position: ParsedPositionCode, staff: Teacher) {
  if (position.is_known || !isNonAcademicStaff(staff)) return position;
  return {
    ...position,
    main_category: "Non-Academic Staff",
    section: "Other Non-Academic Staff",
  };
}

function visiblePositions(staff: Teacher) {
  const positions = Array.isArray(staff.positions) ? staff.positions : [];
  if (!positions.length) return [coerceUnknownNonAcademicPosition(fallbackPosition(staff), staff)];
  return positions
    .filter((position) => position.visibleOnWebsite !== false && position.visible_on_website !== false)
    .map((position) => coerceUnknownNonAcademicPosition(parseStaffPosition(position), staff));
}

function positionAssignmentKey(position: ParsedPositionCode) {
  return [
    staffDisplayGroupFor(position).id,
    position.display_title,
    position.main_category,
    position.section,
    position.subsection,
    position.grade,
    position.stream,
    position.medium,
    position.class_or_stream,
  ]
    .map((value) => normalize(String(value || "")))
    .join("|");
}

function staffDirectoryProfiles(teachers: Teacher[]) {
  const profiles = new Map<string, StaffProfile>();

  teachers
    .filter(
      (staff) =>
        String(staff.status || "Active").toLowerCase() === "active" &&
        Boolean(staff.name?.trim()),
    )
    .forEach((staff) => {
      const key = profileKey(staff);
      const existing = profiles.get(key);
      const profile = existing || profileFromTeacher(staff);
      if (!profile.image && staff.image) profile.image = staff.image;
      if (!profile.qualifications && staff.qualifications) profile.qualifications = staff.qualifications;
      if (!profile.bio && (staff.bio || staff.responsibilities)) {
        profile.bio = staff.bio || staff.responsibilities || "";
      }

      const seen = new Set(profile.positions.map(positionAssignmentKey));
      visiblePositions(staff).forEach((position) => {
        const dedupKey = positionAssignmentKey(position);
        if (!dedupKey || seen.has(dedupKey)) return;
        seen.add(dedupKey);
        profile.positions.push(position);
      });

      profiles.set(key, profile);
    });

  return [...profiles.values()].map((profile) => ({
    ...profile,
    positions: profile.positions.sort(comparePositions),
  }));
}

function comparePositions(a: ParsedPositionCode, b: ParsedPositionCode) {
  return (
    Number(a.sort_order || staffPositionCodeOrder(a.position_code)) -
      Number(b.sort_order || staffPositionCodeOrder(b.position_code)) ||
    a.display_title.localeCompare(b.display_title)
  );
}

function compareAssignments(a: StaffAssignment, b: StaffAssignment) {
  return (
    comparePositions(a.position, b.position) ||
    a.profile.sortOrder - b.profile.sortOrder ||
    a.profile.name.localeCompare(b.profile.name)
  );
}

function makeAssignments(profiles: StaffProfile[]) {
  return profiles
    .flatMap((profile) =>
      profile.positions.map((position) => ({
        profile,
        position,
        group: staffDisplayGroupFor(position),
      })),
    )
    .sort(compareAssignments);
}

function assignmentMatchesSearch(assignment: StaffAssignment, query: string) {
  if (!query) return true;
  const haystack = [
    assignment.profile.name,
    assignment.profile.qualifications,
    assignment.profile.bio,
    assignment.position.position_code,
    assignment.position.display_title,
    assignment.position.main_category,
    assignment.position.section,
    assignment.position.subsection,
    assignment.position.stream,
    assignment.position.medium,
    assignment.position.class_or_stream,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function StaffPhoto({ profile, size = "large" }: { profile: StaffProfile; size?: "small" | "large" }) {
  const dimensions = size === "small" ? "h-28 w-28" : "h-36 w-36";
  return (
    <div className={`${dimensions} shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-50 shadow-inner`}>
      {profile.image ? (
        <img src={profile.image} alt={profile.name} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-slate-500">
          <User className={size === "small" ? "h-10 w-10" : "h-12 w-12"} />
        </div>
      )}
    </div>
  );
}

const GROUP_SECTION_TITLES: Record<string, string> = {
  "academic-1st": "College Administration",
  "vice-principals": "Vice Principals",
  "academic-coordinators": "Academic Co-ordinators",
  "assistant-sectional-heads": "Assistant Sectional Heads",
  "subject-heads": "Subject Heads",
  "grade-heads": "Grade Heads",
  "stream-heads": "A/L Stream Heads",
  "subject-coordinators-primary": "Subject Co-ordinators - Primary School",
  "subject-coordinators-middle": "Subject Co-ordinators - Middle School",
  "subject-coordinators-upper": "Subject Co-ordinators - Upper School",
  "subject-coordinators-aesthetic": "Aesthetic Subject Co-ordinators",
  "subject-coordinators-al": "Subject Co-ordinators - Advanced Level",
  "english-medium-coordinators": "English Medium Co-ordinators",
  "class-teachers-primary": "Class Teachers - Primary School",
  "class-teachers-middle": "Class Teachers - Middle School",
  "class-teachers-upper": "Class Teachers - Upper School",
  "class-teachers-al": "Class Teachers - Advanced Level Section",
  "subject-teachers-primary": "Subject Teachers - Primary School",
  "subject-teachers-middle": "Subject Teachers - Middle School",
  "subject-teachers-upper": "Subject Teachers - Upper School",
  "subject-teachers-al": "Subject Teachers - Advanced Level",
  "special-needs": "Special Need Resource Unit",
  "visiting-teachers": "Visiting Teachers",
  "counselling-members": "Counselling Members",
  "subject-teachers-other": "Other Subject Teachers",
  "non-academic-administrative": "Administrative Department",
  "non-academic-academic-office": "Academic Office",
  "non-academic-financial": "Financial Department",
  "non-academic-it": "IT Department",
  "non-academic-front-office": "Front Office",
  "non-academic-bookstore": "Bookstore",
  "non-academic-office-support": "Office Support",
  "non-academic-maintenance": "Maintenance Department",
  "non-academic-health": "Health Services",
  "non-academic-library": "Library",
  "non-academic-other": "Other Non-Academic Staff",
  "supportive": "Supportive Staff",
  "academic-council": "General Academic Council",
};

function sectionTitle(group: StaffDisplayGroup) {
  return (GROUP_SECTION_TITLES[group.id] || group.title).replace(/^\d+(?:\.\d+)?\s+/, "");
}

const STAFF_DIRECTORY_GROUPS = STAFF_DISPLAY_GROUPS.filter(
  (group) => group.id !== "uncategorized",
);

function isVisibleDirectoryAssignment(assignment: StaffAssignment) {
  return assignment.group.id !== "uncategorized";
}

function assignmentStaffType(assignment: StaffAssignment): StaffTypeFilter {
  if (
    assignment.group.id.startsWith("non-academic") ||
    assignment.position.main_category === "Non-Academic Staff"
  ) {
    return "Non-Academic Staff";
  }
  if (
    assignment.group.id === "supportive" ||
    assignment.position.main_category === "Supportive Staff"
  ) {
    return "Supportive Staff";
  }
  return "Academic Staff";
}

function positionMeta(position: ParsedPositionCode) {
  return [
    position.subsection,
    position.section,
    position.class_or_stream,
    position.medium,
    position.stream,
  ]
    .filter(Boolean)
    .filter((value, index, items) => items.indexOf(value) === index)
    .join(" / ");
}

function GroupBlock({
  group,
  assignments,
  onViewProfile,
}: {
  group: StaffDisplayGroup;
  assignments: StaffAssignment[];
  onViewProfile: (assignment: StaffAssignment) => void;
}) {
  if (!assignments.length) return null;
  const cards = new Map<
    string,
    {
      assignment: StaffAssignment;
      titles: string[];
    }
  >();
  assignments.forEach((assignment) => {
    const existing = cards.get(assignment.profile.id);
    if (!existing) {
      cards.set(assignment.profile.id, {
        assignment,
        titles: [assignment.position.display_title],
      });
      return;
    }
    if (!existing.titles.includes(assignment.position.display_title)) {
      existing.titles.push(assignment.position.display_title);
    }
  });

  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-bold text-slate-950 md:text-[1.65rem]">
        {sectionTitle(group)}
      </h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[...cards.values()].map(({ assignment, titles }) => (
          <article
            key={`${group.id}-${assignment.profile.id}`}
            className="flex min-h-[340px] flex-col items-center justify-between rounded-lg border border-slate-200 bg-white px-6 py-6 text-center shadow-[0_12px_26px_rgba(15,23,42,0.08)]"
          >
            <div className="flex flex-col items-center">
              <StaffPhoto profile={assignment.profile} size="small" />
              <h3 className="mt-5 max-w-[220px] text-base font-extrabold leading-snug text-slate-950">
                {assignment.profile.name}
              </h3>
              <div className="mt-2 grid gap-1 text-[0.72rem] font-black uppercase tracking-[0.16em] text-crimson">
                {titles.map((title) => (
                  <p key={title}>{title}</p>
                ))}
              </div>
              {assignment.profile.qualifications && (
                <p className="mt-3 line-clamp-3 max-w-[230px] text-xs font-semibold leading-5 text-slate-500">
                  {assignment.profile.qualifications}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onViewProfile(assignment)}
              className="mt-5 inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-5 text-xs font-extrabold text-slate-950 transition hover:border-crimson hover:text-crimson"
            >
              View Profile
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function StaffProfileModal({
  assignment,
  onClose,
}: {
  assignment: StaffAssignment;
  onClose: () => void;
}) {
  const { profile, position } = assignment;
  const allPositions = profile.positions
    .map((item) => item.display_title)
    .filter(Boolean)
    .filter((value, index, items) => items.indexOf(value) === index);

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <article
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 text-slate-950 shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close profile"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:border-crimson hover:text-crimson"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <StaffPhoto profile={profile} size="small" />
          <h2 className="mt-5 font-serif text-2xl font-bold leading-tight text-slate-950">
            {profile.name}
          </h2>
          <p className="mt-2 text-[0.72rem] font-black uppercase tracking-[0.16em] text-crimson">
            {position.display_title}
          </p>
          {positionMeta(position) && (
            <p className="mt-2 text-sm text-slate-500">{positionMeta(position)}</p>
          )}
        </div>

        <dl className="mt-6 grid gap-4 text-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-slate-500">
              Positions
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {(allPositions.length ? allPositions : [position.display_title]).map((title) => (
                <span
                  key={title}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-800"
                >
                  {title}
                </span>
              ))}
            </dd>
          </div>

          {profile.qualifications && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <dt className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-slate-500">
                Qualifications
              </dt>
              <dd className="mt-2 leading-6 text-slate-800">{profile.qualifications}</dd>
            </div>
          )}

          {profile.bio && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <dt className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-slate-500">
                Responsibilities
              </dt>
              <dd className="mt-2 leading-6 text-slate-800">{profile.bio}</dd>
            </div>
          )}
        </dl>
      </article>
    </div>
  );
}

function StaffProfileView({ profile }: { profile: StaffProfile }) {
  return (
    <PublicLayout>
      <section className="bg-white py-16 text-black">
        <div className="mx-auto max-w-5xl px-6">
          <a href="/about/college-staff" className="text-sm font-bold text-crimson">
            Back to Staff Directory
          </a>
          <div className="mt-8 grid gap-10 md:grid-cols-[220px_1fr]">
            <StaffPhoto profile={profile} />
            <div>
              <h1 className="font-serif text-4xl font-bold text-black">{profile.name}</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.positions.map((position) => (
                  <span key={position.position_code || position.display_title} className="rounded border border-black/20 px-3 py-1 text-sm text-black">
                    {position.display_title}
                  </span>
                ))}
              </div>
              <div className="mt-8 space-y-5">
                {profile.qualifications && (
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-black/60">
                      <GraduationCap className="h-4 w-4" /> Qualifications
                    </h2>
                    <p className="mt-2 text-black">{profile.qualifications}</p>
                  </div>
                )}
                {profile.bio && (
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-black/60">
                      <Briefcase className="h-4 w-4" /> Bio
                    </h2>
                    <p className="mt-2 leading-7 text-black">{profile.bio}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function CollegeStaffPage({
  pageId = "about/college-staff",
  profileSlug = "",
}: {
  pageId?: string;
  profileSlug?: string;
}) {
  const db = useDb();
  const [liveTeachers, setLiveTeachers] = useState<Teacher[] | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<StaffAssignment | null>(null);
  const [search, setSearch] = useState("");
  const [activeStaffType, setActiveStaffType] = useState<StaffTypeFilter>("Academic Staff");
  void pageId;

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/teachers?ts=${Date.now()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((rows) => {
        if (!cancelled && Array.isArray(rows)) setLiveTeachers(rows);
      })
      .catch(() => {
        if (!cancelled) setLiveTeachers(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedAssignment) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedAssignment(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedAssignment]);

  const directoryTeachers = liveTeachers || db.teachers || [];
  const profiles = useMemo(() => staffDirectoryProfiles(directoryTeachers), [directoryTeachers]);
  const directProfile = profileSlug
    ? profiles.find((profile) => profile.slug === profileSlug || profile.id === profileSlug)
    : null;

  const assignments = useMemo(() => makeAssignments(profiles), [profiles]);
  const visibleAssignments = useMemo(
    () => assignments.filter(isVisibleDirectoryAssignment),
    [assignments],
  );
  const query = normalize(search);
  const staffTypeCounts = useMemo(
    () =>
      STAFF_TYPE_FILTERS.reduce(
        (counts, type) => ({
          ...counts,
          [type]: new Set(
            visibleAssignments
              .filter((assignment) => assignmentStaffType(assignment) === type)
              .map((assignment) => assignment.profile.id),
          ).size,
        }),
        {} as Record<StaffTypeFilter, number>,
      ),
    [visibleAssignments],
  );
  const filteredAssignments = visibleAssignments.filter(
    (assignment) =>
      assignmentStaffType(assignment) === activeStaffType &&
      assignmentMatchesSearch(assignment, query),
  );
  const grouped = STAFF_DIRECTORY_GROUPS.map((group) => ({
    group,
    assignments: filteredAssignments
      .filter((assignment) => assignment.group.id === group.id)
      .sort(compareAssignments),
  })).filter((item) => item.assignments.length > 0);

  if (directProfile) return <StaffProfileView profile={directProfile} />;

  return (
    <PublicLayout>
      <section className="min-h-screen bg-slate-50 py-8 text-slate-950">
        <div className="mx-auto max-w-[1110px] px-6">
          <p className="text-[0.72rem] font-black uppercase tracking-[0.32em] text-crimson">
            Staff Directory
          </p>
          <h1 className="mt-2 font-serif text-4xl font-bold text-slate-950 md:text-[2.5rem]">
            {activeStaffType}
          </h1>
          <div className="mt-4 border-t border-slate-300" />
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,36rem)_1fr] lg:items-center">
            <div className="max-w-xl">
              <label className="relative block">
                <span className="sr-only">Search staff</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, position, qualification..."
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-12 pr-4 text-sm font-semibold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-crimson focus:ring-2 focus:ring-crimson/15"
                />
              </label>
            </div>
            <div
              className="flex flex-wrap gap-2 lg:justify-end"
              role="tablist"
              aria-label="Staff type"
            >
              {STAFF_TYPE_FILTERS.map((type) => {
                const Icon = filterIconMap[type];
                const active = activeStaffType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveStaffType(type)}
                    className={`inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-extrabold transition ${
                      active
                        ? "border-crimson bg-crimson text-white shadow-[0_10px_24px_rgba(191,10,48,0.18)]"
                        : "border-slate-200 bg-white text-slate-950 hover:border-crimson hover:text-crimson"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{type}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.68rem] font-black ${
                        active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {staffTypeCounts[type] || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {grouped.length > 0 ? (
            grouped.map(({ group, assignments }) => (
              <GroupBlock
                key={group.id}
                group={group}
                assignments={assignments}
                onViewProfile={setSelectedAssignment}
              />
            ))
          ) : (
            <div className="py-20 text-center">
              <Users className="mx-auto h-12 w-12 text-black/45" />
              <h3 className="mt-4 text-xl font-bold text-black">No staff found</h3>
              <p className="mt-2 text-black/60">
                {query ? "Try another name or position." : "No active staff profiles are available."}
              </p>
            </div>
          )}
        </div>
      </section>
      {selectedAssignment && (
        <StaffProfileModal
          assignment={selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
        />
      )}
    </PublicLayout>
  );
}
