import { useMemo, useState } from "react";
import { Briefcase, GraduationCap, Mail, Phone, Search, User, Users } from "lucide-react";
import { PageHeader, PublicLayout } from "@/components/site/PublicLayout";
import { useDb, type Teacher } from "@/lib/store";
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
  const dimensions = size === "small" ? "h-14 w-14" : "h-24 w-24";
  return (
    <div className={`${dimensions} shrink-0 overflow-hidden rounded-full border border-black/20 bg-white`}>
      {profile.image ? (
        <img src={profile.image} alt={profile.name} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-black/45">
          <User className={size === "small" ? "h-6 w-6" : "h-10 w-10"} />
        </div>
      )}
    </div>
  );
}

function GroupBlock({ group, assignments }: { group: StaffDisplayGroup; assignments: StaffAssignment[] }) {
  if (!assignments.length) return null;
  return (
    <section className="staff-pdf-group">
      <div className="staff-pdf-list">
        {assignments.map((assignment) => (
          <a
            key={assignment.key}
            href={`/staff/${assignment.profile.slug}`}
            className="staff-pdf-row"
          >
            <StaffPhoto profile={assignment.profile} size="small" />
            <div>
              <p className="staff-pdf-role">{assignment.position.display_title}</p>
              <p className="staff-pdf-name">{assignment.profile.name}</p>
            </div>
          </a>
        ))}
      </div>
      <div className="staff-pdf-brace" aria-hidden="true" />
      <div className="staff-pdf-title">
        <span>{group.sideTitle || group.title}</span>
      </div>
    </section>
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
  const page = db.pages[pageId] || db.pages["about/college-staff"];
  const [search, setSearch] = useState("");

  const profiles = useMemo(() => staffDirectoryProfiles(db.teachers || []), [db.teachers]);
  const directProfile = profileSlug
    ? profiles.find((profile) => profile.slug === profileSlug || profile.id === profileSlug)
    : null;

  const assignments = useMemo(() => makeAssignments(profiles), [profiles]);
  const query = normalize(search);
  const filteredAssignments = assignments.filter((assignment) => assignmentMatchesSearch(assignment, query));
  const grouped = STAFF_DISPLAY_GROUPS.map((group) => ({
    group,
    assignments: filteredAssignments
      .filter((assignment) => assignment.group.id === group.id)
      .sort(compareAssignments),
  })).filter((item) => item.assignments.length > 0);

  if (directProfile) return <StaffProfileView profile={directProfile} />;

  return (
    <PublicLayout>
      <PageHeader
        pageId={pageId}
        kicker={page?.kicker || "About"}
        title={page?.title || "Staff Directory"}
        subtitle={page?.body || "Meet our dedicated staff, teachers, and administrators."}
        image={page?.image || db.media.campusImage || db.websiteContent.heroImage}
      />

      <section className="bg-white py-10 text-black">
        <div className="mx-auto max-w-5xl px-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, qualification, position code, title, or section..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded border border-black/20 bg-white py-4 pl-12 pr-4 text-black outline-none focus:border-crimson"
            />
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/45" />
          </div>
        </div>
      </section>

      <section className="bg-white pb-20 text-black">
        <div className="mx-auto max-w-6xl px-6">
          {grouped.length > 0 ? (
            grouped.map(({ group, assignments }) => (
              <GroupBlock key={group.id} group={group} assignments={assignments} />
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

    </PublicLayout>
  );
}
