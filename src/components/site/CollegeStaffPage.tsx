import { useEffect, useMemo, useState } from "react";
import { Briefcase, GraduationCap, Mail, Phone, User, Users, X } from "lucide-react";
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
  email: string;
  phone: string;
  image: string;
  qualifications: string;
  bio: string;
  status: string;
  sortOrder: number;
  positions: ParsedPositionCode[];
};

type StaffAssignment = {
  key: string;
  profile: StaffProfile;
  position: ParsedPositionCode;
  group: StaffDisplayGroup;
};

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
    email: staff.email || "",
    phone: staff.phone || "",
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

function visiblePositions(staff: Teacher) {
  const positions = Array.isArray(staff.positions) ? staff.positions : [];
  if (!positions.length) return [fallbackPosition(staff)];
  return positions
    .filter((position) => position.visibleOnWebsite !== false && position.visible_on_website !== false)
    .map((position) => parseStaffPosition(position));
}

function staffDirectoryProfiles(teachers: Teacher[]) {
  const profiles = new Map<string, StaffProfile>();

  teachers
    .filter((staff) => staff.status === "Active" && Boolean(staff.name?.trim()))
    .forEach((staff) => {
      const key = profileKey(staff);
      const existing = profiles.get(key);
      const profile = existing || profileFromTeacher(staff);
      if (!profile.image && staff.image) profile.image = staff.image;
      if (!profile.email && staff.email) profile.email = staff.email;
      if (!profile.phone && staff.phone) profile.phone = staff.phone;
      if (!profile.qualifications && staff.qualifications) profile.qualifications = staff.qualifications;
      if (!profile.bio && (staff.bio || staff.responsibilities)) {
        profile.bio = staff.bio || staff.responsibilities || "";
      }

      const seen = new Set(profile.positions.map((position) => position.position_code || position.display_title));
      visiblePositions(staff).forEach((position) => {
        const dedupKey = position.position_code || position.display_title;
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
        key: `${profile.id}-${position.position_code || position.display_title}`,
        profile,
        position,
        group: staffDisplayGroupFor(position),
      })),
    )
    .sort(compareAssignments);
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
  "academic-1st": "1.1 College Administration",
  "academic-2nd": "1.2 Assistant Sectional Heads and Subject Heads",
  "grade-heads": "1.4 Grade Heads",
  "stream-heads": "1.5 Advanced Level Stream Heads",
  "subject-coordinators-primary": "1.6 Subject Co-ordinators - Primary School",
  "subject-coordinators-middle": "1.7 Subject Co-ordinators - Middle School",
  "subject-coordinators-upper": "1.8 Subject Co-ordinators - Upper School",
  "subject-coordinators-aesthetic": "1.9 Aesthetic Subject Co-ordinators",
  "subject-coordinators-al": "1.10 Subject Co-ordinators - Advanced Level",
  "english-medium-coordinators": "1.11 English Medium Co-ordinators",
  "class-teachers-primary": "1.12 Class Teachers - Primary School",
  "class-teachers-middle": "1.13 Class Teachers - Middle School",
  "class-teachers-upper": "1.14 Class Teachers - Upper School",
  "class-teachers-al": "1.15 Class Teachers - Advanced Level Section",
  "subject-teachers": "1.16 Subject Teachers",
  "non-academic": "2.1 Non-Academic Staff",
  "supportive": "3.1 Supportive Staff",
  "academic-council": "4.1 General Academic Council",
  "uncategorized": "Other Staff",
};

function sectionTitle(group: StaffDisplayGroup) {
  return GROUP_SECTION_TITLES[group.id] || group.title;
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
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-bold text-slate-950 md:text-[1.65rem]">
        {sectionTitle(group)}
      </h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {assignments.map((assignment) => (
          <article
            key={assignment.key}
            className="flex min-h-[314px] flex-col items-center justify-between rounded-lg border border-slate-200 bg-white px-6 py-6 text-center shadow-[0_12px_26px_rgba(15,23,42,0.08)]"
          >
            <div className="flex flex-col items-center">
              <StaffPhoto profile={assignment.profile} size="small" />
              <h3 className="mt-5 max-w-[220px] text-base font-extrabold leading-snug text-slate-950">
                {assignment.profile.name}
              </h3>
              <p className="mt-2 text-[0.72rem] font-black uppercase tracking-[0.16em] text-crimson">
                {assignment.position.display_title}
              </p>
              <p className="mt-4 min-h-5 text-sm text-slate-500">
                {positionMeta(assignment.position)}
              </p>
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

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-slate-500">
              Qualifications
            </dt>
            <dd className="mt-2 leading-6 text-slate-800">
              {profile.qualifications || "Not added"}
            </dd>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-slate-500">
              Responsibilities
            </dt>
            <dd className="mt-2 leading-6 text-slate-800">{profile.bio || "Not added"}</dd>
          </div>
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
                {(profile.email || profile.phone) && (
                  <div className="flex flex-wrap gap-4 text-sm text-black">
                    {profile.email && <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" /> {profile.email}</span>}
                    {profile.phone && <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" /> {profile.phone}</span>}
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
  const grouped = STAFF_DISPLAY_GROUPS.map((group) => ({
    group,
    assignments: assignments
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
            Academic Staff
          </h1>
          <div className="mt-4 border-t border-slate-300" />

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
              <p className="mt-2 text-black/60">Try adjusting your search.</p>
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
