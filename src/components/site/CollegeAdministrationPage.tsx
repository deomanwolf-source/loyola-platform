import { DEFAULT_HERO_IMAGE, useDb } from "@/lib/store";
import type { Teacher } from "@/lib/store";
import { PageHeader, PublicLayout } from "@/components/site/PublicLayout";
import { User, ShieldCheck, GraduationCap } from "lucide-react";
import { parseStaffPosition, staffPositionCodeOrder } from "@/lib/staff-display-order";
import type { ParsedPositionCode } from "@/lib/staff-position-codes";

type AdministrationPositionGroup = {
  id: string;
  title: string;
  order: number;
  codes: string[];
  aliases: string[];
};

type AdministrationMember = {
  id: string;
  staff: Teacher;
  positionLabel: string;
  order: number;
};

const FIRST_ADMIN_POSITIONS: AdministrationPositionGroup[] = [
  {
    id: "rector-principal",
    title: "Rector/Principal",
    order: 1,
    codes: ["rector-principal"],
    aliases: ["rector principal"],
  },
  {
    id: "vice-rector-prefect-games",
    title: "Vice Rector, Prefect of Games",
    order: 2,
    codes: ["vice-rector"],
    aliases: ["vice rector", "prefect of games"],
  },
  {
    id: "principal-primary",
    title: "Principal of Primary School",
    order: 3,
    codes: ["principal-primary"],
    aliases: [
      "principal of primary school",
      "principal of the primary school",
      "principal primary school",
    ],
  },
  {
    id: "priest-in-charge-middle-upper",
    title: "Priest in Charge - Middle and Upper School",
    order: 4,
    codes: ["priest-in-charge-middle-upper"],
    aliases: [
      "priest in charge",
      "priest in charge middle school and upper school",
      "priest in charge and sectional head of upper school",
    ],
  },
];

const VICE_PRINCIPAL_POSITIONS: AdministrationPositionGroup[] = [
  {
    id: "vice-principal-advanced-level",
    title: "Vice Principal - Advanced Level",
    order: 1,
    codes: ["vice-principal-advanced-level"],
    aliases: ["vice principal advanced level", "vice principal advanced level section"],
  },
  {
    id: "vice-principal-primary",
    title: "Vice Principal - Primary School",
    order: 2,
    codes: ["vice-principal-primary"],
    aliases: ["vice principal primary school", "vice principal primary section"],
  },
  {
    id: "vice-principal-middle",
    title: "Vice Principal - Middle School",
    order: 3,
    codes: ["vice-principal-middle"],
    aliases: ["vice principal middle school"],
  },
  {
    id: "vice-principal-upper",
    title: "Vice Principal - Upper School",
    order: 4,
    codes: ["vice-principal-upper"],
    aliases: ["vice principal upper school"],
  },
];

const SECTIONAL_HEAD_POSITIONS: AdministrationPositionGroup[] = [
  {
    id: "sectional-head-primary",
    title: "Sectional Head - Primary School",
    order: 1,
    codes: ["sectional-head-primary"],
    aliases: [
      "sectional head primary school",
      "sectional head primary section",
      "sectional head of primary school",
    ],
  },
  {
    id: "sectional-head-middle",
    title: "Sectional Head - Middle School",
    order: 2,
    codes: ["sectional-head-middle"],
    aliases: [
      "sectional head middle school",
      "sectional head middle section",
      "sectional head of middle school",
    ],
  },
  {
    id: "sectional-head-upper",
    title: "Sectional Head - Upper School",
    order: 3,
    codes: ["sectional-head-upper"],
    aliases: [
      "sectional head upper school",
      "sectional head upper section",
      "sectional head of upper school",
    ],
  },
  {
    id: "sectional-head-advanced-level",
    title: "Sectional Head - Advanced Level",
    order: 4,
    codes: ["sectional-head-advanced-level"],
    aliases: [
      "sectional head advanced level",
      "sectional head advanced level section",
      "sectional head of advanced level",
    ],
  },
];

const ASSISTANT_SECTIONAL_HEAD_POSITIONS: AdministrationPositionGroup[] = [
  {
    id: "assistant-sectional-head-primary",
    title: "Assistant Sectional Head - Primary School",
    order: 1,
    codes: ["assistant-sectional-head-primary"],
    aliases: [
      "assistant sectional head primary school",
      "assistant sectional head primary section",
    ],
  },
  {
    id: "assistant-sectional-head-middle",
    title: "Assistant Sectional Head - Middle School",
    order: 2,
    codes: ["assistant-sectional-head-middle"],
    aliases: ["assistant sectional head middle school"],
  },
  {
    id: "assistant-sectional-head-upper",
    title: "Assistant Sectional Head - Upper School",
    order: 3,
    codes: ["assistant-sectional-head-upper"],
    aliases: ["assistant sectional head upper school"],
  },
  {
    id: "assistant-sectional-head-advanced-level",
    title: "Assistant Sectional Head - Advanced Level",
    order: 4,
    codes: ["assistant-sectional-head-advanced-level"],
    aliases: [
      "assistant sectional head advanced level",
      "assistant sectional head advanced level section",
    ],
  },
];

const SUBJECT_HEAD_POSITIONS: AdministrationPositionGroup[] = [
  {
    id: "subjects-head-primary",
    title: "Subjects Head - Primary School",
    order: 1,
    codes: ["subject-head-primary"],
    aliases: [
      "subject head primary school",
      "subjects head primary school",
      "subject head primary section",
    ],
  },
  {
    id: "subjects-head-middle",
    title: "Subjects Head - Middle School",
    order: 2,
    codes: ["subject-head-middle"],
    aliases: ["subject head middle school", "subjects head middle school"],
  },
  {
    id: "subjects-head-upper",
    title: "Subjects Head - Upper School",
    order: 3,
    codes: ["subject-head-upper"],
    aliases: ["subject head upper school", "subjects head upper school"],
  },
  {
    id: "subjects-head-advanced-level",
    title: "Subjects Head - Advanced Level",
    order: 4,
    codes: ["subject-head-advanced-level"],
    aliases: [
      "subject head advanced level",
      "subjects head advanced level",
      "subject head advanced level section",
    ],
  },
];

function normalizePositionText(value?: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function profileKey(staff: Teacher) {
  return staff.staffId || staff.id.split("__")[0] || staff.slug || staff.name;
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
    .filter((position) => {
      const candidate = position as typeof position & {
        visibleOnWebsite?: boolean;
        visible_on_website?: boolean;
      };
      return candidate.visibleOnWebsite !== false && candidate.visible_on_website !== false;
    })
    .map((position) => parseStaffPosition(position));
}

function matchesGroup(position: ParsedPositionCode, group: AdministrationPositionGroup) {
  const code = normalizePositionText(position.position_code).replace(/\s+/g, "-");
  if (group.codes.includes(code)) return true;

  const title = normalizePositionText(position.display_title);
  const section = normalizePositionText(position.section);
  const subsection = normalizePositionText(position.subsection);
  const candidates = new Set(
    [title, `${title} ${section}`, `${title} ${subsection}`, `${title} ${section} ${subsection}`]
      .map(normalizePositionText)
      .filter(Boolean),
  );
  return group.aliases.some((alias) => candidates.has(normalizePositionText(alias)));
}

function administrationMembers(
  staff: Teacher[],
  groups: AdministrationPositionGroup[],
): AdministrationMember[] {
  const byMember = new Map<string, AdministrationMember>();

  staff
    .filter((member) => member.status === "Active" && Boolean(member.name?.trim()))
    .forEach((member) => {
      visiblePositions(member).forEach((position) => {
        const group = groups.find((candidate) => matchesGroup(position, candidate));
        if (!group) return;

        const key = `${group.id}:${profileKey(member)}`;
        if (byMember.has(key)) return;
        byMember.set(key, {
          id: key,
          staff: member,
          positionLabel: group.title,
          order: group.order,
        });
      });
    });

  return [...byMember.values()].sort(
    (a, b) =>
      a.order - b.order ||
      Number(a.staff.sortOrder || 0) - Number(b.staff.sortOrder || 0) ||
      a.staff.name.localeCompare(b.staff.name),
  );
}

export function CollegeAdministrationPage({
  pageId = "college-administration",
}: {
  pageId?: string;
}) {
  const db = useDb();
  const page = db.pages[pageId] ||
    db.pages["about/college-administration"] || {
      title: "College Administration",
      kicker: "Governance",
      body: "Meet the leadership team guiding Loyola College towards excellence in education and character formation.",
    };

  const allStaff = (db.teachers || []).filter((s) => s.status === "Active");
  const topAdmin = administrationMembers(allStaff, FIRST_ADMIN_POSITIONS);
  const vicePrincipals = administrationMembers(allStaff, VICE_PRINCIPAL_POSITIONS);
  const sectionalHeads = administrationMembers(allStaff, SECTIONAL_HEAD_POSITIONS);
  const assistantSectionalHeads = administrationMembers(
    allStaff,
    ASSISTANT_SECTIONAL_HEAD_POSITIONS,
  );
  const subjectHeads = administrationMembers(allStaff, SUBJECT_HEAD_POSITIONS);

  return (
    <PublicLayout>
      <PageHeader
        pageId={pageId}
        kicker={page.kicker || "Leadership"}
        title={page.title || "College Administration"}
        subtitle={page.body || "Meet the leadership team guiding Loyola College."}
        image={
          page.image || db.media.campusImage || db.websiteContent.heroImage || DEFAULT_HERO_IMAGE
        }
      />

      <div className="paper-texture relative overflow-hidden bg-slate-50 py-24">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-navy/20 to-transparent" />

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          {topAdmin.length > 0 && (
            <AdminSection
              title="Top Administration"
              kicker="The Management"
              icon={<ShieldCheck className="h-6 w-6 text-gold" />}
              staff={topAdmin}
            />
          )}

          {vicePrincipals.length > 0 && (
            <AdminSection
              title="Vice Principals"
              kicker="Academic Leadership"
              icon={<GraduationCap className="h-6 w-6 text-gold" />}
              staff={vicePrincipals}
              className="mt-32"
            />
          )}

          {sectionalHeads.length > 0 && (
            <AdminSection
              title="Sectional Heads"
              kicker="Section Leadership"
              icon={<GraduationCap className="h-6 w-6 text-gold" />}
              staff={sectionalHeads}
              className="mt-32"
            />
          )}

          {assistantSectionalHeads.length > 0 && (
            <AdminSection
              title="Assistant Sectional Heads"
              kicker="Section Leadership"
              icon={<GraduationCap className="h-6 w-6 text-gold" />}
              staff={assistantSectionalHeads}
              className="mt-32"
            />
          )}

          {subjectHeads.length > 0 && (
            <AdminSection
              title="Subject Heads"
              kicker="Academic Leadership"
              icon={<GraduationCap className="h-6 w-6 text-gold" />}
              staff={subjectHeads}
              className="mt-32"
            />
          )}
        </div>
      </div>
    </PublicLayout>
  );
}

function AdminSection({
  title,
  kicker,
  icon,
  staff,
  className = "",
}: {
  title: string;
  kicker: string;
  icon: React.ReactNode;
  staff: AdministrationMember[];
  className?: string;
}) {
  return (
    <div className={`animate-fade-in-up ${className}`}>
      <div className="mb-16 flex flex-col items-center text-center">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px w-12 bg-gold/50"></div>
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-crimson">
            {kicker}
          </span>
          <div className="h-px w-12 bg-gold/50"></div>
        </div>
        <div className="flex items-center gap-4 mb-4">
          {icon}
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-navy tracking-tight">
            {title}
          </h2>
        </div>
        <div className="h-1.5 w-24 rounded-full bg-gradient-to-r from-gold via-navy to-gold"></div>
      </div>

      <div className="stagger-children grid gap-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {staff.map((member) => (
          <AdminCard key={member.id} member={member} />
        ))}
      </div>
    </div>
  );
}

function AdminCard({ member }: { member: AdministrationMember }) {
  const { staff } = member;

  return (
    <article className="group hover-lift relative flex flex-col items-center">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-white p-2 shadow-elegant transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-2xl">
        <div className="relative h-full w-full overflow-hidden rounded-lg bg-slate-100">
          {staff.image ? (
            <img
              src={staff.image}
              alt={staff.name}
              className="h-full w-full object-cover transition-all duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-300">
              <User className="h-24 w-24 opacity-50" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-navy/60 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>

          <div className="absolute top-0 right-0 h-16 w-16 -translate-y-full translate-x-full rotate-45 bg-gold/30 transition-transform duration-500 group-hover:translate-x-1/2 group-hover:-translate-y-1/2"></div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center text-center px-4">
        <h3 className="font-serif text-2xl font-bold text-navy transition-colors duration-300 group-hover:text-crimson leading-tight">
          {staff.name}
        </h3>
        <div className="mt-3 flex flex-col items-center gap-1">
          <span className="h-0.5 w-8 bg-gold transition-all duration-500 group-hover:w-16"></span>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500 transition-colors duration-300 group-hover:text-navy">
            {member.positionLabel}
          </p>
        </div>
        <div className="mt-6 scale-90 opacity-0 transition-all duration-500 group-hover:scale-100 group-hover:opacity-100">
          <span className="rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-gold">
            View Leadership Profile
          </span>
        </div>
      </div>
    </article>
  );
}
