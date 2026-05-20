import { DEFAULT_HERO_IMAGE, useDb } from "@/lib/store";
import type { Teacher } from "@/lib/store";
import { PageHeader, PublicLayout } from "@/components/site/PublicLayout";
import { User, ShieldCheck, GraduationCap, Award } from "lucide-react";

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

  const topAdmin = allStaff.filter((s) => s.category === "Top Administration");
  const vicePrincipals = allStaff.filter((s) => s.category === "Vice Principals");
  const sectionalHeads = allStaff.filter((s) => s.category === "Sectional Heads");

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
              kicker="Operational Heads"
              icon={<Award className="h-6 w-6 text-gold" />}
              staff={sectionalHeads}
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
  staff: Teacher[];
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
          <AdminCard key={member.id} staff={member} />
        ))}
      </div>
    </div>
  );
}

function AdminCard({ staff }: { staff: Teacher }) {
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
            {staff.position || staff.type}
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
