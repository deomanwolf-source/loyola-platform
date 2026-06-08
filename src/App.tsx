import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Download,
  Eye,
  Film,
  FileText,
  GraduationCap,
  Images,
  Landmark,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Phone,
  PlayCircle,
  ShieldCheck,
  Trophy,
  Users,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { BrandedLoader } from "@/components/BrandedLoader";
import { HeroBackgroundLayer, PageHeader, PublicLayout } from "@/components/site/PublicLayout";
import { CollegeStaffPage } from "@/components/site/CollegeStaffPage";
import { CollegeAdministrationPage } from "@/components/site/CollegeAdministrationPage";
import {
  DEFAULT_ANTHEM_VIDEO_URL,
  DEFAULT_HERO_IMAGE,
  DEFAULT_MAP_EMBED_URL,
  DEFAULT_MAP_URL,
  authenticateTwoFactor,
  authenticateUser,
  audit,
  getDb,
  makeId,
  setAuth,
  setDb,
  useAuth,
  useDb,
  type GalleryItem,
  type GalleryVideo,
  type Role,
} from "@/lib/store";
import {
  API_URL,
  TwoFactorRequiredError,
  authHeaders,
  getMaintenanceStatus,
  type MaintenanceStatus,
} from "@/lib/api";
import { sanitizeVisualCss, sanitizeVisualHtml } from "@/lib/sanitize-visual-content";

const StudentPortal = lazy(() =>
  import("@/components/portal/StudentPortal").then((module) => ({ default: module.StudentPortal })),
);
const ParentPortal = lazy(() =>
  import("@/components/portal/ParentPortal").then((module) => ({ default: module.ParentPortal })),
);
const TeacherPortal = lazy(() =>
  import("@/components/portal/TeacherPortal").then((module) => ({ default: module.TeacherPortal })),
);
const AdminPortal = lazy(() =>
  import("@/components/portal/AdminPortal").then((module) => ({ default: module.AdminPortal })),
);

const MASTER_ROLES: Role[] = ["masteradmin"];
const WEBSITE_ADMIN_ROLES: Role[] = ["masteradmin", "superadmin", "website_admin"];
const EDUZYNC_ADMIN_ROLES: Role[] = [
  "masteradmin",
  "superadmin",
  "master_edutrack_admin",
  "eduzync_admin",
];
const STAFF_ADMIN_ROLES: Role[] = ["masteradmin", "superadmin", "staff_admin"];
const EDUTRACK_ROLES: Role[] = [
  "masteradmin",
  "superadmin",
  "master_edutrack_admin",
  "eduzync_admin",
  "teacher",
];
const ELMS_ROLES: Role[] = ["masteradmin", "superadmin", "teacher", "student"];
const REPORT_CARD_ROLES: Role[] = [
  "masteradmin",
  "superadmin",
  "master_edutrack_admin",
  "eduzync_admin",
  "teacher",
  "student",
  "parent",
];
const MAINTENANCE_BYPASS_ROLES: Role[] = [
  "masteradmin",
  "superadmin",
  "website_admin",
  "eduzync_admin",
  "master_edutrack_admin",
  "staff_admin",
];
const REPORT_CARDS_SYSTEM_URL = "https://intranet.loyolacollege.lk/login";
const LCEA_PAGE_ID = "academics/loyolian-cambridge-english-academy";
const FACILITIES_PAGE_ID = "the-college/facilities-services";

const LOYOLA_CALENDAR_ID = "loyolacollegeng.official@gmail.com";
const LOYOLA_CALENDAR_TIME_ZONE = "Asia/Colombo";
const LIVE_RENDERED_PAGE_IDS = new Set([
  "home",
  "about",
  "academics",
  "admissions",
  "events",
  "news",
  "notices",
  "sports-clubs",
  "gallery",
  "downloads",
  "student-portal",
  "contact",
  "calendar",
  LCEA_PAGE_ID,
  "academics/cambridge",
  FACILITIES_PAGE_ID,
  "facilities",
  "facilities-services",
  "about/college-administration",
  "college-administration",
  "about/college-staff",
  "college-staff",
  "about/college-anthem-hymn",
  "college-anthem-hymn",
  "gallery/photo-gallery",
  "photo-gallery",
  "gallery/video-gallery",
  "video-gallery",
  "about/college-history",
  "about/past-rectors-vice-rectors",
  "college-history",
  "pastrectors",
  "past-rectors",
  "rectors-message",
  "rector-s-message",
  "rector-message",
  "rector-massage",
]);

function isLiveRenderedPage(pageId: string) {
  return LIVE_RENDERED_PAGE_IDS.has(pageId);
}

function googleCalendarEmbedUrl(mode: "MONTH" | "AGENDA") {
  const params = new URLSearchParams({
    src: LOYOLA_CALENDAR_ID,
    ctz: LOYOLA_CALENDAR_TIME_ZONE,
    mode,
    showTitle: "0",
    showNav: "1",
    showDate: "1",
    showPrint: "0",
    showTabs: mode === "MONTH" ? "1" : "0",
    showCalendars: "0",
    showTz: "1",
    wkst: "1",
    bgcolor: "#ffffff",
    color: "#7986cb",
  });

  return `https://calendar.google.com/calendar/embed?${params.toString()}`;
}

function canonicalVisualPageId(path: string, db: ReturnType<typeof getDb>) {
  const requestedPageId = path === "/" || path === "" ? "home" : path.replace(/^\/+/, "");
  const aliases: Record<string, string> = {
    notices: "news",
    "academics/cambridge": LCEA_PAGE_ID,
    facilities: FACILITIES_PAGE_ID,
    "facilities-services": FACILITIES_PAGE_ID,
    "college-administration": "about/college-administration",
    "college-staff": "about/college-staff",
    "college-anthem-hymn": "about/college-anthem-hymn",
    "photo-gallery": "gallery/photo-gallery",
    "video-gallery": "gallery/video-gallery",
  };
  const canonicalId = aliases[requestedPageId] || requestedPageId;
  return db.pages[canonicalId] ? canonicalId : requestedPageId;
}

function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    masteradmin: "Master Admin",
    superadmin: "Super Admin",
    website_admin: "Website Admin",
    master_edutrack_admin: "Master EduTrack Admin",
    eduzync_admin: "EduTrack Admin",
    staff_admin: "Staff Admin",
    teacher: "Teacher",
    student: "Student",
    parent: "Parent",
  };
  return labels[role];
}

function AccessDeniedPage({
  title = "Access Denied",
  message = "Your account does not have permission to open this area.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#eef3ff] px-6 text-[#172033]">
      <section className="w-full max-w-lg rounded-lg border border-[#d8e1f5] bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-crimson/10 text-crimson">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="mt-5 font-serif text-4xl font-bold text-navy">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        <a
          href="/portal"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-navy px-5 py-3 text-sm font-bold text-white"
        >
          Back to portal
        </a>
      </section>
    </main>
  );
}

function MaintenanceModePage({ message }: { message?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#eef3ff] px-6 text-[#172033]">
      <section className="w-full max-w-xl text-center">
        <img
          src="/loyola-crest.jpg"
          alt=""
          className="mx-auto h-20 w-20 rounded-full border border-[#d8e1f5] bg-white object-contain p-2 shadow-sm"
        />
        <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-crimson">
          Scheduled maintenance
        </p>
        <h1 className="mt-3 font-serif text-5xl font-bold leading-tight text-navy">
          We will be back soon.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-muted-foreground">
          {message ||
            "The public website is temporarily offline while Loyola College completes maintenance."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="/login?next=%2F"
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-5 py-3 text-sm font-bold text-white"
          >
            <ShieldCheck className="h-4 w-4" />
            Admin login
          </a>
          <a
            href="/portal"
            className="inline-flex items-center gap-2 rounded-lg border border-[#c8d4ec] bg-white px-5 py-3 text-sm font-bold text-navy"
          >
            <Lock className="h-4 w-4" />
            Open portal
          </a>
        </div>
      </section>
    </main>
  );
}
export function App() {
  const rawPath = typeof window === "undefined" ? "/" : window.location.pathname;
  const path = rawPath !== "/" ? rawPath.replace(/\/$/, "") : "/";
  const db = useDb();
  const auth = useAuth();
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.05,
        rootMargin: "0px 0px -45px 0px",
      },
    );

    const elements = document.querySelectorAll(
      ".reveal-on-scroll, .reveal-stagger, .public-site main > section, .visual-page section",
    );
    elements.forEach((el) => {
      if (!el.classList.contains("is-revealed")) {
        el.classList.add("reveal-on-scroll");
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [path, db]);

  const pageIsLive = (id: string) =>
    Boolean(db.pages[id]) && (db.navigation.find((item) => item.id === id)?.visible ?? true);
  const visualPageId = canonicalVisualPageId(path, db);
  const isSystemPath =
    path === "/login" || path === "/portal" || path === "/admin" || path.startsWith("/portal/");
  const canViewDuringMaintenance =
    maintenanceStatus?.canViewSite ||
    Boolean(auth.user && MAINTENANCE_BYPASS_ROLES.includes(auth.user.role));

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSystemPath) {
      setMaintenanceStatus(null);
      return;
    }

    let cancelled = false;
    getMaintenanceStatus()
      .then((status) => {
        if (!cancelled) setMaintenanceStatus(status);
      })
      .catch(() => {
        if (!cancelled) setMaintenanceStatus(null);
      });

    return () => {
      cancelled = true;
    };
  }, [auth.user, isSystemPath, path]);

  if (!isSystemPath && maintenanceStatus?.enabled && !canViewDuringMaintenance) {
    return <MaintenanceModePage message={maintenanceStatus.message} />;
  }

  if (
    !isSystemPath &&
    !isLiveRenderedPage(visualPageId) &&
    pageIsLive(visualPageId) &&
    db.pages[visualPageId]?.visualHtml?.trim()
  ) {
    return <VisualBuilderPage pageId={visualPageId} />;
  }

  if (path === "/portal/edutrack") return <EduTrackRuntimePage />;

  if (path === "/photo-gallery") {
    return (
      <PhotoGalleryPage
        pageId={pageIsLive("gallery/photo-gallery") ? "gallery/photo-gallery" : "photo-gallery"}
      />
    );
  }
  if (path === "/video-gallery") {
    return (
      <VideoGalleryPage
        pageId={pageIsLive("gallery/video-gallery") ? "gallery/video-gallery" : "video-gallery"}
      />
    );
  }

  if (
    path !== "/login" &&
    !path.startsWith("/portal/") &&
    (path === "/about/college-anthem-hymn" || path === "/college-anthem-hymn") &&
    (pageIsLive("about/college-anthem-hymn") || pageIsLive("college-anthem-hymn"))
  ) {
    return (
      <CollegeAnthemHymnPage
        pageId={
          pageIsLive(path.replace(/^\/+/, ""))
            ? path.replace(/^\/+/, "")
            : "about/college-anthem-hymn"
        }
      />
    );
  }

  if (path === "/calendar" && pageIsLive("calendar")) return <CalendarPage />;
  if ([`/${LCEA_PAGE_ID}`, "/academics/cambridge"].includes(path) && pageIsLive(LCEA_PAGE_ID)) {
    return <LoyolianCambridgeEnglishAcademyPage />;
  }
  if (
    [`/${FACILITIES_PAGE_ID}`, "/facilities", "/facilities-services"].includes(path) &&
    pageIsLive(FACILITIES_PAGE_ID)
  ) {
    return <FacilitiesServicesPage />;
  }

  if (path === "/" || path === "") return <HomePage />;
  if (
    [
      "/about/college-history",
      "/about/past-rectors-vice-rectors",
      "/college-history",
      "/pastrectors",
      "/past-rectors",
    ].includes(path)
  ) {
    return (
      <PastRectorsPage
        pageId={path.startsWith("/about/") ? path.replace(/^\/+/, "") : "about/college-history"}
      />
    );
  }
  if (
    (path === "/about/college-administration" && pageIsLive("about/college-administration")) ||
    (path === "/college-administration" && pageIsLive("college-administration"))
  ) {
    return <CollegeAdministrationPage pageId={path.replace(/^\/+/, "")} />;
  }
  if (
    (path === "/about/college-staff" && pageIsLive("about/college-staff")) ||
    (path === "/college-staff" && pageIsLive("college-staff"))
  ) {
    return <CollegeStaffPage pageId={path.replace(/^\/+/, "")} />;
  }
  if (path.startsWith("/staff/")) {
    return (
      <CollegeStaffPage
        pageId="about/college-staff"
        profileSlug={path.split("/").filter(Boolean)[1] || ""}
      />
    );
  }
  if (
    (path === "/about/college-anthem-hymn" && pageIsLive("about/college-anthem-hymn")) ||
    (path === "/college-anthem-hymn" &&
      (pageIsLive("college-anthem-hymn") || pageIsLive("about/college-anthem-hymn")))
  ) {
    return (
      <CollegeAnthemHymnPage
        pageId={
          pageIsLive(path.replace(/^\/+/, ""))
            ? path.replace(/^\/+/, "")
            : "about/college-anthem-hymn"
        }
      />
    );
  }
  if (path === "/about" && pageIsLive("about")) return <AboutPage />;
  if (path === "/academics" && pageIsLive("academics")) return <AcademicsPage />;
  if (path === "/admissions" && pageIsLive("admissions")) return <AdmissionsPage />;
  if (path === "/events" && pageIsLive("events")) return <EventsPage />;
  if ((path === "/news" || path === "/notices") && pageIsLive("news")) return <NewsPage />;
  if (path === "/sports-clubs" && pageIsLive("sports-clubs")) return <SportsClubsPage />;
  if (path === "/gallery" && pageIsLive("gallery")) return <GalleryPage />;
  if (path.startsWith("/gallery/photo-gallery/") && pageIsLive("gallery/photo-gallery")) {
    return <PhotoAlbumPage albumKey={decodeURIComponent(path.split("/").pop() || "")} />;
  }
  if (
    (path === "/gallery/photo-gallery" && pageIsLive("gallery/photo-gallery")) ||
    (path === "/photo-gallery" && pageIsLive("photo-gallery"))
  ) {
    return (
      <PhotoGalleryPage
        pageId={pageIsLive("gallery/photo-gallery") ? "gallery/photo-gallery" : "photo-gallery"}
      />
    );
  }
  if (
    (path === "/gallery/video-gallery" && pageIsLive("gallery/video-gallery")) ||
    (path === "/video-gallery" && pageIsLive("video-gallery"))
  ) {
    return (
      <VideoGalleryPage
        pageId={pageIsLive("gallery/video-gallery") ? "gallery/video-gallery" : "video-gallery"}
      />
    );
  }
  if (path === "/downloads" && pageIsLive("downloads")) return <DownloadsPage />;
  if (path === "/student-portal" && pageIsLive("student-portal"))
    return <StudentPortalLandingPage />;
  if (path === "/contact" && pageIsLive("contact")) return <ContactPage />;
  if (path === "/login") return <LoginPage />;
  if (path === "/portal") return <CentralPortal />;
  if (path === "/admin") {
    return (
      <Suspense fallback={<BrandedLoader title="Opening admin" subtitle="Loading dashboard" />}>
        <AdminPortal />
      </Suspense>
    );
  }
  if (["/portal/edutrack", "/portal/eduzync", "/portal/elms", "/portal/reports"].includes(path)) {
    return <ModulePage moduleId={path.split("/").pop() || ""} />;
  }
  if (path.startsWith("/portal/")) return <PortalRouter role={path.split("/")[2] as Role} />;

  const dynamicPageId = path.replace(/^\/+/, "");

  if (
    ["rectors-message", "rector-s-message", "rector-message", "rector-massage"].includes(
      dynamicPageId,
    ) &&
    pageIsLive(dynamicPageId)
  ) {
    return <RectorsMessagePage pageId={dynamicPageId} />;
  }

  if (pageIsLive(dynamicPageId)) return <GenericPage pageId={dynamicPageId} />;
  return <NotFoundPage />;
}

function pageIsLiveInDb(db: ReturnType<typeof getDb>, id: string) {
  return Boolean(db.pages[id]) && (db.navigation.find((item) => item.id === id)?.visible ?? true);
}

function visibleSubpages(db: ReturnType<typeof getDb>, parentId: string) {
  return [...db.navigation]
    .filter(
      (item) => item.parentId === parentId && item.visible !== false && Boolean(db.pages[item.id]),
    )
    .sort((a, b) => a.order - b.order);
}

function VisualBuilderPage({ pageId }: { pageId: string }) {
  const db = useDb();
  const page = db.pages[pageId];

  if (!page?.visualHtml) return <GenericPage pageId={pageId} />;

  const sanitizedHtml = sanitizeVisualHtml(page.visualHtml);
  const sanitizedCss = sanitizeVisualCss(page.visualCss);
  const title = page.title || pageId.split("/").pop()?.replaceAll("-", " ") || "";
  const body = page.body && page.body.trim() !== "New page content goes here." ? page.body : "";

  return (
    <PublicLayout>
      {sanitizedCss && <style>{sanitizedCss}</style>}
      {sanitizedHtml ? (
        <div className="visual-page" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
      ) : (
        <PageHeader
          pageId={pageId}
          kicker={page.kicker || page.eyebrow || "Page"}
          title={title}
          subtitle={body}
          image={page.image || db.media.campusImage || db.websiteContent.heroImage}
        />
      )}
    </PublicLayout>
  );
}

const pastRectorProfiles = [
  {
    name: "S. V. Goonesekera Mahatha",
    years: "1949 - 1987",
    image: "/assets/past-rectors/sv-sir.jpeg",
  },
  {
    name: "J. E. Noyel Dabare Mahatha",
    years: "1987 - 1994",
    image: "/assets/past-rectors/noyel-sir.jpeg",
  },
  {
    name: "Rev. Fr. Leo Perera",
    years: "1994 - 1999",
    image: "/assets/past-rectors/fr-leo.jpeg",
  },
  {
    name: "Rev. Fr. Thilakasiri Fernando",
    years: "1995 - 1999",
    image: "/assets/past-rectors/fr-thilakasiri.jpeg",
  },
  {
    name: "Rev. Fr. Trevor G. Martin",
    years: "2000 - 2014",
    image: "/assets/past-rectors/fr-trevor.jpeg",
  },
  {
    name: "Rev. Fr. Ranjith Andradi",
    years: "2014 - 2015",
    image: "/assets/past-rectors/fr-ranjith.jpeg",
  },
  {
    name: "Rev. Fr. Sudath Gunetilleke",
    years: "2015 - 2021",
    image: "/assets/past-rectors/fr-sudath.jpeg",
  },
];

function isGenericPastRectorsVisualHtml(html?: string) {
  if (!html || html.includes("past-rectors-collage.jpeg")) return false;
  return (
    html.includes("Past Rectors & Vice Rectors overview") &&
    html.includes("Key information") &&
    html.includes("Next steps")
  );
}

function PastRectorsPage({ pageId = "about/college-history" }: { pageId?: string }) {
  const db = useDb();
  const defaultPage = {
    kicker: "Faith, learning, discipline, and service.",
    title: "Past Rectors & Vice Rectors",
    body: "Remembering the leaders who shaped Loyola College Negombo.",
    image: "",
  };
  const page = db.pages[pageId] || defaultPage;
  const visualHtml = page.visualHtml?.trim();
  if (visualHtml && !isGenericPastRectorsVisualHtml(visualHtml)) {
    return <VisualBuilderPage pageId={pageId} />;
  }

  const body =
    page.body && page.body.trim() !== "New page content goes here." ? page.body : defaultPage.body;

  return (
    <PublicLayout>
      <PageHeader
        pageId={pageId}
        kicker={page.kicker || defaultPage.kicker}
        title={page.title || defaultPage.title}
        subtitle={body}
        image={page.image || db.media.campusImage || db.websiteContent.heroImage}
      />

      <section className="bg-slate-50 py-16 text-navy">
        <div className="mx-auto max-w-7xl px-6">
          <div className="rounded-xl border border-border bg-white p-4 shadow-elegant md:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
              Legacy Wall
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-navy">
              Past Rectors & Vice Rectors
            </h2>
            <div className="mt-6 overflow-hidden rounded-lg border border-border bg-white">
              <img
                src="/assets/past-rectors/past-rectors-collage.jpeg"
                alt="Past Rectors and Vice Rectors collage"
                className="w-full object-contain"
              />
            </div>
          </div>

          <div className="mt-14">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
              Profile Records
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-navy">Rector Profiles</h2>
            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              {pastRectorProfiles.map((profile) => (
                <article
                  key={profile.image}
                  className="overflow-hidden rounded-xl border border-border bg-white shadow-soft"
                >
                  <div className="border-b border-border px-5 py-4">
                    <h3 className="font-serif text-2xl font-bold text-navy">{profile.name}</h3>
                    <p className="mt-1 text-sm font-bold uppercase tracking-[0.16em] text-crimson">
                      Service Period: {profile.years}
                    </p>
                  </div>
                  <img
                    src={profile.image}
                    alt={`${profile.name} profile`}
                    loading="lazy"
                    className="mx-auto w-full max-w-[560px] bg-white object-contain"
                  />
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function SubpagesSection({ parentId }: { parentId: string }) {
  const db = useDb();
  const children = visibleSubpages(db, parentId);
  if (children.length === 0) return null;

  return (
    <section className="border-t border-border bg-white py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-crimson">Sub pages</p>
            <h2 className="mt-3 font-serif text-4xl font-bold capitalize text-navy">
              {parentId === "home"
                ? "Explore more"
                : `${parentId.split("/").pop()?.replaceAll("-", " ")} pages`}
            </h2>
          </div>
        </div>
        <div className="stagger-children mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {children.map((item) => {
            const page = db.pages[item.id];
            const title = page.title || item.label;
            const image =
              page.image ||
              db.media.campusImage ||
              db.websiteContent.heroImage ||
              DEFAULT_HERO_IMAGE;
            return (
              <a
                key={item.id}
                href={item.id === "home" ? "/" : `/${item.id}`}
                className="hover-lift overflow-hidden rounded-lg border border-border bg-background shadow-soft transition-smooth hover:-translate-y-1 hover:border-gold hover:bg-white"
              >
                <img src={image} alt="" className="aspect-[16/9] w-full object-cover" />
                <div className="p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-crimson">
                    {item.label}
                  </p>
                  <h3 className="mt-2 font-serif text-2xl font-bold text-navy">{title}</h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {page.body || "Open this page for more information."}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-crimson">
                    Open page <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HomeRequiredSections() {
  const db = useDb();
  const home = db.homeSections;
  const leadershipCards = [...(home.leadershipCards || [])]
    .filter((card) => card.visible !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const quickActions = [
    {
      title: "Explore College",
      body: "Discover our campus and facilities.",
      href: "/the-college/facilities-services",
      icon: Landmark,
    },
    {
      title: "View Upcoming Events",
      body: "Stay updated on college activities.",
      href: "/events",
      icon: Calendar,
    },
    {
      title: "News",
      body: "Latest announcements and updates.",
      href: "/news",
      icon: FileText,
    },
  ];
  const missionPoints = [
    "To aim at integral education of body, mind and spirit through service and leadership.",
    "To strive to form a citizen of upright character to achieve excellence in social, religious, academic and industrial spheres.",
    "To promote character formation based on human and religious values.",
  ];
  const clubs = [
    { title: "Media Unit", icon: Camera },
    { title: "Science Society", icon: Award },
    { title: "ICT Society", icon: Film },
    { title: "Prefects Board", icon: ShieldCheck },
    { title: "English Literary Association", icon: GraduationCap },
    { title: "Religious Society", icon: Landmark },
  ];
  const academicPreviews = [
    {
      title: "Primary Section",
      body: "Foundational learning, language growth, values, and classroom confidence.",
      icon: Users,
    },
    {
      title: "Middle School",
      body: "Structured study habits, co-curricular discovery, and personal formation.",
      icon: BookOpen,
    },
    {
      title: "Upper School",
      body: "Exam preparation, leadership, clubs, sports, and disciplined academic focus.",
      icon: Award,
    },
    {
      title: "Advanced Level",
      body: "Technology, Science, Commerce, and Arts pathways for senior students.",
      icon: GraduationCap,
    },
  ];
  const facilities = [
    { title: "Administration", body: "Central management and governance", icon: Briefcase },
    { title: "Academic", body: "Curriculum and educational standards", icon: BookOpen },
    { title: "Finance", body: "Bursary and financial operations", icon: Landmark },
    { title: "IT Department", body: "Digital infrastructure and support", icon: Film },
    { title: "Gym", body: "Modern fitness and training center", icon: Trophy },
    { title: "Swimming Pool", body: "Olympic-standard aquatic facility", icon: Award },
    { title: "Sports Department", body: "Athletic development and coaching", icon: Trophy },
  ];
  const fallbackCalendar = [
    {
      title: "Poya Day - Public Holiday",
      date: "2026-05-01",
      description: "Religious observance",
    },
    {
      title: "Vesak Festival - School Holiday",
      date: "2026-05-07",
      description: "National festival",
    },
    {
      title: "Mid-Term Examinations Begin",
      date: "2026-05-15",
      description: "Academic assessment period",
    },
  ];
  const calendarItems =
    db.events.length > 0
      ? db.events
          .slice()
          .sort((a, b) => String(a.date || a.event_date).localeCompare(String(b.date || b.event_date)))
          .slice(0, 3)
          .map((event) => ({
            title: event.title,
            date: event.event_date || event.date,
            description: event.description || event.location || event.type || "College event",
          }))
      : fallbackCalendar;
  const pageIsLive = (href: string) => {
    const id = href.replace(/^\/+/, "") || "home";
    return Boolean(db.pages[id]) && (db.navigation.find((item) => item.id === id)?.visible ?? true);
  };
  const eventDateParts = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { month: "MAY", day: "01" };
    return {
      month: date.toLocaleString("en", { month: "short" }).toUpperCase(),
      day: String(date.getDate()).padStart(2, "0"),
    };
  };

  return (
    <>
      <section className="bg-[#f6f7f9] py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.title}
                  href={item.href}
                  className="rounded-lg border border-[#e6e9ef] bg-white px-6 py-8 text-center shadow-[0_12px_36px_-30px_rgba(10,22,40,0.55)] transition hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-soft"
                >
                  <Icon className="mx-auto h-6 w-6 text-gold" />
                  <h2 className="mt-4 font-serif text-lg font-bold text-navy">{item.title}</h2>
                  <p className="mt-2 text-xs font-medium text-slate-500">{item.body}</p>
                </a>
              );
            })}
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <article className="grid min-h-[210px] place-items-center rounded-lg border border-[#e6e9ef] bg-white p-8 text-center shadow-sm">
              <div>
                <h2 className="font-serif text-2xl font-bold text-navy">Our Vision</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  To announce God&apos;s Kingdom through Christian values.
                </p>
              </div>
            </article>
            <article className="rounded-lg border border-[#e6e9ef] bg-white p-8 shadow-sm">
              <h2 className="text-center font-serif text-3xl font-bold text-navy">Our Mission</h2>
              <div className="mt-5 space-y-3">
                {missionPoints.map((point) => (
                  <p key={point} className="flex gap-2 text-sm leading-6 text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    <span>{point}</span>
                  </p>
                ))}
              </div>
            </article>
            <article className="grid min-h-[210px] place-items-center rounded-lg border border-[#e6e9ef] bg-white p-8 text-center shadow-sm">
              <div>
                <h2 className="font-serif text-2xl font-bold text-navy">Motto</h2>
                <p className="mt-3 font-serif text-xl font-bold text-navy">
                  Veritate ad Lumen et Vitam
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  In Truth to Light and Life
                </p>
              </div>
            </article>
          </div>

          <div className="mt-14 text-center">
            <h2 className="font-serif text-3xl font-bold text-navy">Extra Curriculars</h2>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((club) => {
              const Icon = club.icon;
              return (
                <a
                  key={club.title}
                  href="/sports-clubs"
                  className="rounded border border-[#e6e9ef] bg-white px-5 py-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-gold/60"
                >
                  <Icon className="mx-auto h-5 w-5 text-gold" />
                  <p className="mt-3 text-sm font-black text-navy">{club.title}</p>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl font-bold text-navy">Academic Composition</h2>
              <p className="mt-2 text-sm text-slate-500">
                Guiding students from foundation to advanced studies.
              </p>
            </div>
            {pageIsLive("/academics") && (
              <a
                href="/academics"
                className="inline-flex items-center gap-2 text-xs font-black text-crimson"
              >
                Academics overview <ArrowRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-4">
            {academicPreviews.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-lg border border-[#e6e9ef] bg-white p-6 shadow-sm"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-gold">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-serif text-xl font-bold text-navy">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-14 rounded-xl border border-[#e6e9ef] bg-[#fafbfc] px-5 py-10 md:px-12 md:py-14">
            <h2 className="text-center font-serif text-4xl font-bold text-navy md:text-5xl">
              Office Structure & Facilities
            </h2>
            <div className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-3">
              {facilities.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="grid grid-cols-[44px_1fr] items-center gap-4 rounded border border-[#e6e9ef] bg-white p-4 shadow-sm"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-gold">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-black text-navy">{item.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {item.body}
                      </span>
                    </span>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f6f7f9] py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="relative overflow-hidden rounded-lg bg-[#071224] p-5 text-white shadow-[0_28px_80px_-42px_rgba(7,18,36,0.95)] ring-1 ring-white/10 md:p-8 lg:p-9">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0)_42%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gold/60" />

            <div className="relative">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-gold">Annual school schedule</p>
                  <h2 className="mt-2 font-serif text-4xl font-bold leading-tight md:text-5xl">
                    Academic Calendar &amp; Year Plan
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
                    Key academic dates, college activities, notices, and the live Google Calendar
                    for the school year.
                  </p>
                </div>
                {pageIsLive("/calendar") && (
                  <a
                    href="/calendar"
                    className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:border-gold/60 hover:bg-gold/15 hover:text-gold-light"
                  >
                    All events
                    <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(430px,1.22fr)]">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-black text-white/80">
                    <Calendar className="h-4 w-4 text-gold" />
                    Year highlights
                  </div>

                  {calendarItems.slice(0, 1).map((event) => {
                    const parts = eventDateParts(event.date);
                    return (
                      <article
                        key={`${event.title}-${event.date}`}
                        className="rounded-lg border border-white/10 bg-white/[0.09] p-5 shadow-[0_18px_44px_-32px_rgba(0,0,0,0.9)]"
                      >
                        <div className="grid gap-4 sm:grid-cols-[72px_1fr] sm:items-center">
                          <time className="grid h-16 w-16 place-items-center rounded bg-gold text-center text-navy shadow-[0_12px_24px_-18px_rgba(232,180,35,0.9)]">
                            <span>
                              <span className="block text-[10px] font-black uppercase leading-none">
                                {parts.month}
                              </span>
                              <span className="mt-1 block text-2xl font-black leading-none">
                                {parts.day}
                              </span>
                            </span>
                          </time>
                          <div>
                            <h3 className="text-lg font-black leading-tight text-white">
                              {event.title}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-white/70">
                              {event.description}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {calendarItems.slice(1).map((event) => {
                      const parts = eventDateParts(event.date);
                      return (
                        <article
                          key={`${event.title}-${event.date}`}
                          className="grid grid-cols-[54px_1fr] items-center gap-4 rounded border border-white/10 bg-white/[0.06] p-4 transition hover:border-gold/40 hover:bg-white/[0.1]"
                        >
                          <time className="grid h-12 w-12 place-items-center rounded bg-white/10 text-center text-gold">
                            <span>
                              <span className="block text-[9px] font-black uppercase leading-none">
                                {parts.month}
                              </span>
                              <span className="mt-1 block text-lg font-black leading-none">
                                {parts.day}
                              </span>
                            </span>
                          </time>
                          <span>
                            <span className="block text-sm font-black leading-tight">
                              {event.title}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-white/60">
                              {event.description}
                            </span>
                          </span>
                        </article>
                      );
                    })}
                  </div>

                  <article className="rounded-lg border border-gold/35 bg-gold/10 p-5 text-gold-light shadow-[0_18px_44px_-34px_rgba(232,180,35,0.75)]">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-gold/20 text-gold">
                        <Bell className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xs font-black uppercase text-gold-light">
                          Special Notice
                        </p>
                        <h3 className="mt-2 text-base font-black text-white">
                          Annual Prize Giving Ceremony
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-white/70">
                          Schedule details will be published on the student portal.
                        </p>
                      </div>
                    </div>
                  </article>
                </div>

                <div className="overflow-hidden rounded-lg bg-white shadow-[0_24px_70px_-38px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
                  <div className="flex flex-col gap-2 border-b border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-crimson">Google Calendar</p>
                      <p className="mt-1 text-sm font-bold text-navy">Live Loyola schedule</p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Live
                    </span>
                  </div>
                  <GoogleCalendarFrame
                    title="Loyola College Google Calendar"
                    mode="AGENDA"
                    className="h-[460px] bg-white md:h-[500px]"
                  />
                </div>
              </div>

              <p className="mt-6 text-center text-xs font-bold italic text-white/70">
                Annual academic events and religious observances.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f6f7f9] py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 text-center sm:px-6">
          <h2 className="font-serif text-4xl font-bold text-navy md:text-5xl">
            {home.leadershipTitle || "Leadership guiding Loyola College"}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-500">
            {home.leadershipBody ||
              "The dedicated administration board steering our institution towards academic and spiritual excellence."}
          </p>
          <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {leadershipCards.map((card) => (
              <article key={card.id} className="text-center">
                <div className="overflow-hidden rounded-lg bg-[#909090] shadow-soft">
                  {card.image ? (
                    <img
                      src={card.image}
                      alt={card.name}
                      className="aspect-[4/5] w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-[4/5] place-items-center bg-[#909090] p-8">
                      <img
                        src="/loyola-crest.jpg"
                        alt=""
                        className="h-24 w-24 object-contain opacity-70"
                      />
                    </div>
                  )}
                </div>
                <h3 className="mt-4 text-sm font-black leading-tight text-navy">{card.name}</h3>
                <p className="mt-2 text-[11px] font-black uppercase tracking-[0.08em] text-gold">
                  {card.title}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function HomeVisionMissionIdentity() {
  const missionPoints = [
    "To aim at integral education of body, mind and spirit through service and leadership.",
    "To strive to form citizens of upright character who pursue excellence in every sphere.",
    "To promote character formation based on human and religious values.",
  ];

  return (
    <section className="relative overflow-hidden bg-[#082766] py-20 text-white">
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(135deg,transparent_0,transparent_24px,#fff_25px,transparent_26px),linear-gradient(45deg,transparent_0,transparent_28px,#fff_29px,transparent_30px)] [background-size:120px_120px]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-[minmax(0,1fr)_560px]">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold-light">
            Loyola identity
          </p>
          <h2 className="mt-4 text-balance font-serif text-4xl font-bold leading-tight md:text-6xl">
            Welcome to Loyola College, Negombo
          </h2>

          <div className="stagger-children mt-10 grid gap-6">
            <div>
              <h3 className="text-2xl font-black">Our Vision</h3>
              <p className="mt-3 max-w-2xl leading-relaxed text-white/74">
                To announce God&apos;s Kingdom through Christian values.
              </p>
            </div>
            <div>
              <h3 className="text-2xl font-black">Mission Statement</h3>
              <div className="mt-4 space-y-4">
                {missionPoints.map((point) => (
                  <p key={point} className="flex gap-3 leading-relaxed text-white/74">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-gold-light" />
                    <span>{point}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="overflow-hidden rounded-lg border border-white/14 bg-white shadow-elegant">
          <div className="aspect-[16/10] bg-black">
            <img
              src={DEFAULT_HERO_IMAGE}
              alt="Loyola College flag"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="border-t border-border bg-white p-6 text-center">
            <p className="font-serif text-2xl font-bold text-navy">Veritate Ad Lumen Et Vitam</p>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              In Truth to Light and Life
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function HomePage() {
  const db = useDb();
  const content = db.websiteContent;
  const page = db.pages.home || {};
  const heroTitle =
    content.heroTitle?.trim() || "A Tradition of Excellence. A Future of Innovation.";
  const heroText = content.heroText?.trim() || "Veritate ad Lumen et Vitam";
  const heroImage = page.image || content.heroImage || db.media.campusImage || DEFAULT_HERO_IMAGE;
  const logoImage = content.logoImage || "/loyola-crest.jpg";

  return (
    <PublicLayout>
      <section className="relative isolate overflow-hidden bg-navy text-white">
        <HeroBackgroundLayer
          fallbackImage={heroImage}
          fallbackOpacity={0.38}
          mediaUrl={page.backgroundMediaUrl}
          mediaType={page.backgroundMediaType}
          mediaOpacity={page.backgroundMediaOpacity}
          gradientClassName="bg-[linear-gradient(180deg,rgb(7_18_36_/0.96),rgb(10_22_40_/0.86)),linear-gradient(105deg,rgb(10_22_40_/0.92),rgb(10_22_40_/0.7))]"
          gridOpacityClassName="opacity-20"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gold/85" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgb(255_255_255_/0.08),transparent_44%),linear-gradient(180deg,rgb(10_22_40_/0),rgb(10_22_40_/0.32))]" />
        <div className="relative mx-auto grid min-h-[520px] max-w-7xl place-items-center px-5 py-16 text-center sm:px-6 md:min-h-[620px] md:py-24 lg:py-32">
          <div className="home-hero-content home-hero-classic mx-auto max-w-5xl">
            <img
              src={logoImage}
              alt="Loyola College crest"
              className="home-hero-crest mx-auto h-24 w-24 rounded-full border-[3px] border-gold/80 bg-white object-contain p-2 shadow-[0_22px_60px_-34px_rgba(247,217,107,0.85)] md:h-28 md:w-28"
            />
            <span className="gold-divider mx-auto mb-5 mt-7" />
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold-light">
              {content.schoolName}
            </p>
            <h1 className="home-hero-title mx-auto mt-5 max-w-5xl text-balance font-serif text-5xl font-bold leading-[1.03] sm:text-6xl md:text-7xl lg:mt-7 lg:text-8xl">
              {heroTitle}
            </h1>
            <p className="home-hero-motto mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/82 sm:text-lg md:text-xl lg:mt-7">
              {heroText}
            </p>
          </div>
        </div>
      </section>

      <HomeRequiredSections />
      <SubpagesSection parentId="home" />
    </PublicLayout>
  );
}

const collegeHistoryParagraphs = [
  "On 2nd February, 1949, Late Mr. Sebastian Vincent Laus Fonseka with the noble aim of creating generations of virtuous Christians, teamed up with his brother Mr. J. Anthony Fonseka and built an institution in two cadjan sheds 30 x 20 and 20 x 40, on a land obtained on lease at Periyamulla, consisting of 32 students and 7 teachers.",
  "On a visit to Periyamulla, the late His Eminence Thomas Cardinal Cooray noticed this school and invited the Fonseka brothers to establish the institution as a school in the Periyamulla Church premises. Accordingly classes began in the building erected in the Periyamulla Church premises and Mr. S. V. Fonseka served as the 1st Principal of this school for 38 years. He was indeed a brave and courageous man who always endeavored for the betterment of children's education, yet remained a simple man himself.",
  "In the year 1979, Rev. Bro. Clifford of the Marist congregation offered his services in the capacity of Principal for a period of one year by way of taking over the administration of the College.",
  "In 1987 the All Ceylon Teachers' Union in Sri Lanka took over the administration of this school by way of a three member board of Trustees under Mr. J. E. Noel Dabarera, the 2nd Principal. In 1994 the All Ceylon Teachers' Union and Mr. J. E. Noel Dabarera handed over the school administration to the Archdiocese of Colombo.",
  "In July 1994 Rev. Fr. Leo Perera, the parish priest of Our Lady of Snows Church, Periyamulla was appointed by the then Archbishop Dr. Nicholas Marcus Fernando as the first Rector of this College.",
  "Rev. Fr. Leo Perera teamed up with Rev. Bro. Thilakasiri Fernando T.O.R to fulfill the onerous task of re-establishing the College on 27th September 1995, at the present premises, which was formerly an oil mill.",
  "In January 2000 with the appointment of Rev. Fr. Trevor Martin as the 2nd Rector, the College made a steady progress with new buildings coming up and introduction of sweeping changes aimed at higher standards of education and discipline in the College.",
  "On 12th January, 2003, Grade 1 English Medium class was formed for the first time in the Loyolian History paving the way to English Medium education for the students.",
  "Loyola College Branch school at Bopitiya was declared open by His Grace the Archbishop Most Rev. Dr. Oswald Gomis on 15th January, 2003 expanding the services giving privilege for the students in that area.",
  "On 10th February 2014, Rev. Fr. Trevor Martin left Loyola College and on the following day, Rev. Fr. Ranjith Andradi became the 3rd Rector of the College. After a brief period he handed over the Rectorship to Rev. Fr. Sudath Gunetileke, the present Rector, who assumed duties on the 26th May 2015 as the 4th Rector.",
  "In the crack of dawn Rev. Fr. Sudath Gunetileke made things happen by purchasing three portions of adjoining land with the intention of expanding the terrestrial area. The chapel which was in the Advanced Level Section was shifted to a spacious place near the entrance making it more convenient and easily accessible. The child friendly play area for the primary students to enjoy physical activities adds beauty to the primary compound. The main entrance to the college was given an appealing and inviting appearance. Loyola Sports Complex was named after Rev. Fr. Trevor Martin as a result of his noble thoughts about the past Rector.",
  "Today with a generous investment, the College shines in her new looks with alluring colours on its walls. Rev. Fr. Sudath is responsible for renovations and refurbishing to the various buildings in the College.",
  "Father Sudath built a Scouts Den in order that the Scouts could keep all their belongings in one place in order. The College office was refurbished during this period and it has a very pleasant atmosphere. The College Auditorium looks great in its present form after being refurbished. The Audio Visual Room is very comfortable and can accommodate 130 persons where conferences and meetings can be conducted. The Medical Unit was refurbished with a great new look and a new Dental chair was installed in the unit for the benefit of the students.",
  "S. V. Fonseka Hall was refurbished with a great new modern look to the old building. Upper School Staff Room was refurbished with a view to provide the staff members with a quiet relaxed environment to concentrate on whatever work during their free time. The College chapel was completely given a new face lift with very picturesque paintings. The canteen was completely turned into a modern unit with all the necessary facilities. The Upper School washrooms for the students were completely given a facelift with new fittings and accessories.",
  "Rev. Fr. Sudath Gunetileke served as the 4th Rector of the College from 2015 to 2022. He was succeeded by Rev. Fr. Kennedy Perera, who is currently serving as the Rector. Rev. Fr. Kennedy Perera, the current Rector of the college, has undertaken various renovation and development projects in the college. One of the achievements is the renovation of the basketball court, providing the students with a modern and well-maintained facility to engage in sports and physical activity. He has also redesigned the school entrance with new statues, which enhances the aesthetic appeal of the college which add to the overall beauty of the college. A Sports Pavilion, Cadet Billet and a Technical Unit were also constructed and declared opened for the benefit of the students. Fr. Kennedy was also responsible in converting the Badminton Court in the Sports complex into a new chapel for the Primary Section, dedicated to our Patron Saint St. Ignatius of Loyola. Expansion of the Primary Section was done by constructing a new building. A special unit was newly opened in the New Building and named 'Pope Francis Differently Abled Unit'.",
  "These efforts of Rev. Fr. Kennedy Perera reflect his commitment to uplifting the standard of the education and infrastructure at the college.",
  "Under Rev. Fr. Kennedy's leadership, the college has continued to strive towards excellence in education and discipline. With current student body of 2,688 and a faculty of 150 teachers, the college has come a long way in its 77 years history and is a source of pride for all those associated with it.",
];

function AboutPage() {
  const db = useDb();
  const page = db.pages.about;
  const about = db.aboutSections;
  const historyKicker = about.storyKicker || "College History";
  const historyTitle = about.storyTitle || "College History";
  const quote = about.quote || "Faith, learning, discipline, and service.";
  const quoteAuthor = about.quoteAuthor || "Loyola College Negombo";
  return (
    <PublicLayout>
      <PageHeader
        pageId="about"
        kicker={page.kicker || "About"}
        title={page.title || ""}
        subtitle={page.body}
        image={page.image || db.media.aboutImage}
      />
      <section
        id="history"
        className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[minmax(0,1fr)_420px]"
      >
        <article>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-crimson">
            {historyKicker}
          </p>
          <h2 className="mt-3 font-serif text-4xl font-bold text-navy">{historyTitle}</h2>
          <div className="mt-7 space-y-5 text-base leading-8 text-muted-foreground">
            {collegeHistoryParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </article>
        <aside className="h-fit rounded-lg bg-navy p-8 text-white shadow-soft lg:sticky lg:top-28">
          <p className="font-serif text-3xl leading-snug">{quote}</p>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-gold-light">
            {quoteAuthor}
          </p>
        </aside>
      </section>
    </PublicLayout>
  );
}

function isDirectVideoUrl(url: string) {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url);
}

function getYouTubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    let videoId = "";

    if (host === "youtu.be") {
      videoId = parsed.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (parsed.pathname.startsWith("/watch")) videoId = parsed.searchParams.get("v") || "";
      if (parsed.pathname.startsWith("/shorts/")) videoId = parsed.pathname.split("/")[2] || "";
      if (parsed.pathname.startsWith("/embed/")) videoId = parsed.pathname.split("/")[2] || "";
    }

    if (!videoId) return "";
    const start = parsed.searchParams.get("t") || parsed.searchParams.get("start") || "";
    const startSeconds = start.endsWith("s") ? start.slice(0, -1) : start;
    const params = new URLSearchParams({
      autoplay: "1",
      rel: "0",
      modestbranding: "1",
    });
    if (/^\d+$/.test(startSeconds)) params.set("start", startSeconds);
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  } catch {
    return "";
  }
}

function CollegeAnthemHymnPage({ pageId = "about/college-anthem-hymn" }: { pageId?: string }) {
  const db = useDb();
  const page = db.pages[pageId] || db.pages["about/college-anthem-hymn"];
  const [mediaOpen, setMediaOpen] = useState(false);

  const heroImage =
    page?.image || db.media.campusImage || db.websiteContent.heroImage || DEFAULT_HERO_IMAGE;
  const anthemVideoUrl = (
    db.websiteContent.anthemVideoUrl ||
    page?.anthemVideoUrl ||
    DEFAULT_ANTHEM_VIDEO_URL
  ).trim();
  const anthemVideoTitle = page?.anthemVideoTitle || "College Anthem & Hymn";
  const anthemVideoCover =
    db.websiteContent.anthemVideoCoverImage || page?.anthemVideoCoverImage || heroImage;
  const youtubeEmbedUrl = getYouTubeEmbedUrl(anthemVideoUrl);
  const canPlayInModal = Boolean(
    anthemVideoUrl && (youtubeEmbedUrl || isDirectVideoUrl(anthemVideoUrl)),
  );
  const customBody = (page?.body || "").trim();
  const hasCustomText =
    Boolean(customBody) &&
    customBody !== "New page content goes here." &&
    customBody !== "A ceremonial page for the school anthem, hymn, and Loyola identity.";
  const customTextBlocks = hasCustomText ? customBody.split(/\n{2,}/).filter(Boolean) : [];

  useEffect(() => {
    if (!mediaOpen) return;
    const originalOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMediaOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mediaOpen]);

  const anthemVerses = [
    [
      "සමරමු බැතිනි සදා",
      "මීපුර ලොයොලා විදුහල් මැණී //",
      "ඔබගෙන් අප ලද යශෝ ප්‍රවාහය",
      "සදා දෙරණ මත පැතිරී සිටී //",
    ],
    [
      "පුදා පුදා අප භක්ති ප්‍රණාමය",
      "සදා රකිමු විදුහල් මෑණී",
      "දේශ දේශ ගත කීර්ති රාවයට",
      "නිවාස වූ රස නිධාන වූ //",
    ],
    [
      "ඔබේ උදාර වූ නුවන් යොමා",
      "රැකගනු මැන අප සදා සදා",
      "සිසු සිත් විදුණැන බලයෙන් සතපා",
      "සත්‍ය මැදින් ආලෝකෙ කරා //",
    ],
    ["පහන් ටැඹක් සේ මඟ එළි කළ ඔබ", "සදා අපගේ ආලෝකය වුව මැන", "සැරදේ වොරැඳේ සැරදේ !!!!!"],
  ];

  const anthemTextBlocks = hasCustomText
    ? customTextBlocks
    : anthemVerses.map((verse) => verse.join("\n"));

  const hymnVerses = [
    [
      "Sons and daughters of Negombo we sing",
      "From Lanka's little Rome our praises we bring",
      "O Saint of Loyola whose name we bear",
      "Guide us keep us in your care",
    ],
    [
      "We pledge our love to our school this day",
      "To walk steadfastly along the long way",
      "Knowledge and wisdom to gain we will strive",
      "With endless quest and relentless drive",
    ],
    [
      "We learn from books, we learn through play",
      "To build our soul we need to pray",
      "In love and sacrifice let us grow",
      "Virtues through character may we show",
    ],
    [
      "Our alma mater will ever grow in fame",
      "Through our efforts it will gain a great name",
      "In all we do we will reach new heights",
      "In truth we'll shine as a beacon of light",
    ],
  ];

  return (
    <PublicLayout>
      <section className="relative isolate overflow-hidden bg-navy text-white">
        <HeroBackgroundLayer
          fallbackImage={heroImage}
          fallbackOpacity={0.34}
          mediaUrl={page?.backgroundMediaUrl}
          mediaType={page?.backgroundMediaType}
          mediaOpacity={page?.backgroundMediaOpacity}
          gradientClassName="bg-[linear-gradient(110deg,rgb(10_22_40_/0.98),rgb(10_22_40_/0.9)_48%,rgb(183_15_27_/0.72))]"
          gridOpacityClassName="opacity-25"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_360px] lg:py-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold-light">
              Faith, learning, discipline, and service
            </p>
            <span className="gold-divider mt-5" />
            <h1 className="mt-6 max-w-5xl font-serif text-5xl font-bold leading-tight md:text-7xl">
              {page?.title || "College Anthem & Hymn"}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/78">
              A dignified home for Loyola College Negombo's ceremonial songs, school values, and
              shared identity.
            </p>
          </div>
          <aside className="rounded-lg border border-white/14 bg-white/10 p-6 text-center shadow-elegant backdrop-blur">
            <img
              src={db.websiteContent.logoImage || "/loyola-crest.jpg"}
              alt=""
              className="mx-auto h-24 w-24 rounded-full border-4 border-gold bg-white object-contain p-2"
            />
            <p className="mt-5 font-serif text-3xl font-bold">Loyola College</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-gold-light">
              {db.websiteContent.tagline}
            </p>
          </aside>
        </div>
      </section>

      <section className="border-b border-border bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-8 md:grid-cols-3">
          {[
            ["Motto", db.websiteContent.tagline],
            ["Language", "Sinhala anthem and English hymn"],
            ["Purpose", "Prayer, gratitude, loyalty, and formation"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-background p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson">{label}</p>
              <p className="mt-2 font-serif text-2xl font-bold text-navy">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-secondary/35 py-12 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <article className="rounded-lg border border-border bg-white p-7 shadow-soft">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-crimson">
                    Official Text
                  </p>
                  <h2 className="mt-3 font-serif text-4xl font-bold text-navy">College Anthem</h2>
                </div>
                <Trophy className="h-10 w-10 text-gold" />
              </div>
              {anthemTextBlocks.length > 0 ? (
                <div className="mt-7 space-y-6">
                  {anthemTextBlocks.map((block, index) => (
                    <p
                      key={index}
                      className="whitespace-pre-line rounded-lg bg-background p-5 text-center text-lg font-semibold leading-9 text-muted-foreground"
                    >
                      {block}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="mt-7 rounded-lg bg-background p-6 text-center">
                  <p className="font-serif text-2xl font-bold text-navy">සිංහල ගීතය</p>
                </div>
              )}
            </article>

            <article className="rounded-lg border border-border bg-white p-7 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-crimson">
                College Hymn
              </p>
              <h2 className="mt-3 font-serif text-4xl font-bold text-navy">College Hymn</h2>
              <div className="mt-7 space-y-6">
                {hymnVerses.map((verse, index) => (
                  <div key={index} className="rounded-lg bg-background p-5 text-center">
                    {verse.map((line) => (
                      <p key={line} className="leading-8 text-muted-foreground">
                        {line}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1fr_420px]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-crimson">
              Watch and Listen
            </p>
            <h2 className="mt-3 font-serif text-4xl font-bold text-navy">Anthem and hymn media.</h2>

            {anthemVideoUrl && (
              <button
                type="button"
                onClick={() => setMediaOpen(true)}
                className="mt-7 inline-flex items-center gap-2 rounded-lg bg-navy px-5 py-3 text-sm font-bold text-white shadow-soft transition-smooth hover:-translate-y-0.5 hover:bg-navy-mid"
              >
                Play in popup <Film className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-navy shadow-elegant">
            {anthemVideoUrl && isDirectVideoUrl(anthemVideoUrl) ? (
              <button
                type="button"
                onClick={() => setMediaOpen(true)}
                className="group relative block w-full"
              >
                <img
                  src={anthemVideoCover}
                  alt=""
                  className="aspect-video w-full object-cover opacity-80 transition-smooth group-hover:scale-105"
                />
                <span className="absolute inset-0 grid place-items-center bg-navy/25">
                  <span className="anthem-play-button grid h-20 w-20 place-items-center rounded-full border-2 border-white/80 bg-gold text-navy shadow-elegant">
                    <PlayCircle className="h-11 w-11" />
                  </span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMediaOpen(true)}
                className="group relative block w-full"
              >
                <img
                  src={anthemVideoCover}
                  alt=""
                  className="aspect-video w-full object-cover opacity-80 transition-smooth group-hover:scale-105"
                />
                <span className="absolute inset-0 grid place-items-center bg-navy/25">
                  <span className="anthem-play-button grid h-20 w-20 place-items-center rounded-full border-2 border-white/80 bg-gold text-navy shadow-elegant">
                    <PlayCircle className="h-11 w-11" />
                  </span>
                </span>
              </button>
            )}
            <div className="border-t border-white/10 p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-light">
                Featured media
              </p>
              <h3 className="mt-2 font-serif text-2xl font-bold">{anthemVideoTitle}</h3>
            </div>
          </div>
        </div>
      </section>
      {mediaOpen && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-navy/78 px-4 py-8 backdrop-blur-md animate-fade-in"
          onClick={() => setMediaOpen(false)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-lg border border-white/15 bg-white shadow-elegant animate-scale-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson">
                  Featured media
                </p>
                <h3 className="mt-1 font-serif text-2xl font-bold text-navy">{anthemVideoTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setMediaOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-secondary text-navy transition-smooth hover:bg-navy hover:text-white"
                aria-label="Close media popup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-black">
              {youtubeEmbedUrl ? (
                <iframe
                  key={youtubeEmbedUrl}
                  src={youtubeEmbedUrl}
                  title={anthemVideoTitle}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="aspect-video w-full"
                />
              ) : isDirectVideoUrl(anthemVideoUrl) ? (
                <video
                  key={anthemVideoUrl}
                  src={anthemVideoUrl}
                  controls
                  autoPlay
                  poster={anthemVideoCover}
                  className="aspect-video w-full bg-black object-contain"
                />
              ) : (
                <div className="grid aspect-video place-items-center bg-navy px-8 text-center text-white">
                  <div>
                    <Film className="mx-auto h-12 w-12 text-gold" />
                    <p className="mt-4 font-serif text-2xl font-bold">
                      This media link cannot be embedded.
                    </p>
                    <a
                      href={anthemVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy"
                    >
                      Open media
                    </a>
                  </div>
                </div>
              )}
            </div>
            {canPlayInModal && (
              <p className="px-5 py-3 text-xs text-muted-foreground">
                Playing inside the Loyola website. Close this window to stop playback.
              </p>
            )}
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

const lceaStats = [
  {
    label: "Students Equipped",
    value: "700+",
    body: "Learners are being equipped with standard English at LCEA.",
    icon: Users,
  },
  {
    label: "Teaching Staff",
    value: "36",
    body: "Loyolian teachers and qualified teachers from other schools guide the students.",
    icon: GraduationCap,
  },
  {
    label: "Monthly English",
    value: "12 hrs",
    body: "Young learners receive structured English learning every month.",
    icon: BookOpen,
  },
  {
    label: "Launched",
    value: "May 1, 2024",
    body: "The academy was launched under the vision of Rev. Fr. Kennedy Perera.",
    icon: Award,
  },
];

const lceaLeadership = [
  { role: "Rector", names: ["Rev. Fr. Kennedy Perera"] },
  { role: "Priest in Charge", names: ["Fr. Mahima Gunawardena"] },
  { role: "Manager", names: ["Mr. Deepal Fonseka"] },
  { role: "Accountant", names: ["Mrs. Reshika Crishelni"] },
  { role: "Vice Principals", names: ["Mrs. Priyanthi Fernando", "Mrs. Geethanchali Devedas"] },
];

const lceaProgrammes = [
  {
    level: "Pre Starters (Nursery)",
    students: "40 students",
    age: "5 years",
    teachers: ["Niroshini Perera", "Sarala Subasingha"],
  },
  {
    level: "Pre Starters",
    students: "140 students",
    age: "5-8 years",
    teachers: [
      "Mrs. Hasara Fernando",
      "Rev. Sr. Princy Croos Pulle",
      "Miss. Maleesha Nethmini",
      "Miss. Chrishani Fernando",
      "Miss. Hashini Perera",
      "Miss. Amasha Perera",
    ],
  },
  {
    level: "Starters",
    students: "200 students",
    age: "7-10 years",
    teachers: [
      "Mrs. Jayani Jethma",
      "Rev. Sr. Malrani Fernando",
      "Miss. Amindi Silva",
      "Mrs. Priyanthi Fernando",
      "Miss. Dhananjani Perera",
      "Miss. Vihangi Fernando",
      "Miss. Nisali Christina",
      "Mrs. Christina Sebastian",
      "Miss. Tharushika Fernando",
      "Mrs. Ronisha Devedas",
    ],
  },
  {
    level: "Movers",
    students: "100 students",
    age: "9-11 years",
    teachers: [
      "Mrs. Geethanchali Devedas",
      "Miss. Anuththara Sewmini",
      "Mrs. Sumedhie Fernando",
      "Mrs. M. K. Roshina",
      "Mrs. Dharshani Suraweera",
    ],
  },
  {
    level: "Flyers",
    students: "60 students",
    age: "10-12 years",
    teachers: [
      "Mrs. Harshani Fernandopulle",
      "Mrs. Cynthiya Karunapala",
      "Mrs. Shanika Marasinghe",
      "Mrs. Nirosha Perera",
    ],
  },
  {
    level: "KET",
    students: "60 students",
    age: "Above 12 years",
    teachers: ["Mrs. Shiromi Jude", "Mr. Sumith Senadheera", "Mr. Bernil Anuranga"],
  },
  {
    level: "PET",
    students: "60 students",
    age: "Above 12 years",
    teachers: ["Mrs. Ranlie Fernando", "Mrs. Sandamali", "Mr. Rasika Perera"],
  },
  {
    level: "FCE",
    students: "10 students",
    age: "Above 12 years",
    teachers: ["Mr. Amantha Fernando"],
  },
];

const lceaSchedule = [
  {
    day: "Wednesday",
    time: "2.15 P.M. to 5.15 P.M.",
    levels: "Pre Starters, Starters, Movers",
  },
  {
    day: "Friday",
    time: "2.15 P.M. to 5.15 P.M.",
    levels: "Flyers, KET, PET, FCE",
  },
];

function LoyolianCambridgeEnglishAcademyPage() {
  const db = useDb();
  const page = db.pages[LCEA_PAGE_ID];
  const pageBody =
    page?.body && page.body.trim() !== "New page content goes here." ? page.body : "";

  return (
    <PublicLayout>
      <PageHeader
        pageId={LCEA_PAGE_ID}
        kicker={page?.kicker || "Academics"}
        title={page?.title || "Loyolian Cambridge English Academy"}
        subtitle={
          pageBody ||
          "Cambridge-standard English learning for Loyolian students and learners from other schools."
        }
        image={page?.image || db.media.campusImage || db.websiteContent.heroImage}
      />

      <section className="bg-page-soft py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_390px]">
            <article className="min-w-0 rounded-lg border border-border bg-white p-7 shadow-soft md:p-9">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
                English Academy
              </p>
              <h2 className="mt-4 max-w-3xl break-words font-serif text-2xl font-bold leading-tight text-navy sm:text-3xl md:text-4xl">
                English learning with Cambridge international standards.
              </h2>
              <div className="mt-6 space-y-4 break-words text-sm leading-7 text-muted-foreground md:text-base">
                <p>
                  Loyola College launched Loyolian Cambridge English Academy on May 1, 2024. The
                  academy is a brain-child of Rev. Fr. Kennedy Perera, the present Rector of Loyola
                  College Negombo, who has held the vision of enhancing the English linguistic
                  capacity of Loyolian students from the day of his installation.
                </p>
                <p>
                  LCEA has opened its doors to students from other schools as well, giving them the
                  opportunity to learn English according to Cambridge international standards.
                </p>
                <p>
                  More than 700 students are being equipped with standard English at LCEA by a
                  well-qualified staff of 36 teachers.
                </p>
              </div>
            </article>

            <aside className="min-w-0 rounded-lg bg-navy p-7 text-white shadow-elegant md:p-8">
              <ShieldCheck className="h-9 w-9 text-gold-light" />
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-gold-light">
                Academy Vision
              </p>
              <h3 className="mt-3 break-words font-serif text-3xl font-bold leading-tight">
                A stronger English foundation for young learners.
              </h3>
              <p className="mt-4 text-sm leading-7 text-white/72">
                LCEA offers an upgraded English academy experience in the Negombo region, with
                regular monthly learning time and guided support for each Cambridge level.
              </p>
            </aside>
          </div>

          <div className="stagger-children mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {lceaStats.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.label}
                  className="min-w-0 rounded-lg border border-border bg-white p-6 shadow-soft"
                >
                  <Icon className="h-7 w-7 text-gold" />
                  <p className="mt-5 font-serif text-3xl font-bold text-navy">{item.value}</p>
                  <h3 className="mt-2 text-sm font-bold uppercase tracking-[0.14em] text-crimson">
                    {item.label}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
              Academy Team
            </p>
            <h2 className="mt-3 font-serif text-4xl font-bold text-navy">
              Leadership and administration
            </h2>
            <div className="stagger-children mt-8 grid gap-4 md:grid-cols-2">
              {lceaLeadership.map((item) => (
                <article
                  key={item.role}
                  className="min-w-0 rounded-lg border border-border bg-background p-5 shadow-soft"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-crimson">
                    {item.role}
                  </p>
                  <div className="mt-3 space-y-1">
                    {item.names.map((name) => (
                      <p key={name} className="break-words font-serif text-xl font-bold text-navy">
                        {name}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="min-w-0 rounded-lg border border-border bg-white p-6 shadow-elegant">
            <Calendar className="h-8 w-8 text-gold" />
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-crimson">
              Weekly Classes
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-navy">Class schedule</h2>
            <div className="mt-6 space-y-4">
              {lceaSchedule.map((slot) => (
                <div key={slot.day} className="rounded-lg bg-background p-5">
                  <p className="text-sm font-bold uppercase tracking-[0.14em] text-navy">
                    {slot.day}
                  </p>
                  <p className="mt-2 text-lg font-bold text-crimson">{slot.time}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{slot.levels}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-page-soft py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
              Cambridge Levels
            </p>
            <h2 className="mt-3 font-serif text-4xl font-bold text-navy">
              Programme groups and teaching staff
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
              Students are guided through age-appropriate Cambridge English levels by the following
              staff members.
            </p>
          </div>

          <div className="stagger-children mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {lceaProgrammes.map((programme) => (
              <article
                key={programme.level}
                className="flex h-full min-w-0 flex-col rounded-lg border border-border bg-white p-6 shadow-soft"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="break-words font-serif text-2xl font-bold text-navy">
                      {programme.level}
                    </h3>
                    <p className="mt-2 text-sm font-bold text-crimson">{programme.students}</p>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
                    <BookOpen className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-4 rounded-lg bg-background px-3 py-2 text-sm font-semibold text-navy">
                  Age: {programme.age}
                </p>
                <ul className="mt-5 space-y-2 text-sm leading-6 text-muted-foreground">
                  {programme.teachers.map((teacher) => (
                    <li key={teacher} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                      <span>{teacher}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

const facilityImageBase = "https://www.loyolacollege.lk/frontend/assets/img/facilities";

const facilitiesServices = [
  {
    title: "Audio Visual Room",
    category: "Learning & Media",
    image: `${facilityImageBase}/AUDIO-VISUAL-ROOM-300x250.jpg`,
    body: "A presentation-ready learning space for conferences, seminars, screenings, and media-assisted teaching.",
    highlights: ["Presentations", "Workshops", "Media learning"],
    icon: Film,
  },
  {
    title: "SV Fonseka Hall",
    category: "Assembly & Events",
    image: `${facilityImageBase}/SV-FONSEKA-300x250.jpg`,
    body: "A central college hall for assemblies, formal gatherings, celebrations, and student programmes.",
    highlights: ["Assemblies", "Ceremonies", "College events"],
    icon: Landmark,
  },
  {
    title: "Library",
    category: "Study & Reading",
    image: `${facilityImageBase}/LIBRARY-300x250.jpg`,
    body: "A quiet academic resource space that supports reading habits, research, reference work, and independent study.",
    highlights: ["Reading", "Reference", "Research"],
    icon: BookOpen,
  },
  {
    title: "Smart Class Room",
    category: "Digital Learning",
    image: `${facilityImageBase}/SMART-CLASS-ROOM-300x250.jpg`,
    body: "A technology-enabled classroom that helps teachers deliver clear, visual, and interactive lessons.",
    highlights: ["Smart lessons", "Digital tools", "Interactive teaching"],
    icon: GraduationCap,
  },
  {
    title: "Canteen",
    category: "Student Service",
    image: `${facilityImageBase}/CANTEEN-300x250.jpg`,
    body: "A daily service point for students, supporting refreshment, routine, and practical campus life.",
    highlights: ["Refreshments", "Daily service", "Student care"],
    icon: Users,
  },
  {
    title: "St. Ignatius Chapel",
    category: "Faith Formation",
    image: `${facilityImageBase}/ST-IGNATIUS-CHAPEL-300x250.jpg`,
    body: "A sacred space for prayer, reflection, Catholic formation, and the spiritual life of the college community.",
    highlights: ["Prayer", "Reflection", "Faith life"],
    icon: ShieldCheck,
  },
  {
    title: "Cadet Billet",
    category: "Discipline & Leadership",
    image: `${facilityImageBase}/CADET-BILLET-300x250.jpg`,
    body: "A dedicated space that supports cadet activities, discipline, leadership training, and student responsibility.",
    highlights: ["Cadets", "Leadership", "Discipline"],
    icon: Award,
  },
  {
    title: "Scout Den",
    category: "Clubs & Leadership",
    image: `${facilityImageBase}/SCOUT-DEN-300x250.jpg`,
    body: "A home base for scouts to organize equipment, plan activities, and build practical leadership skills.",
    highlights: ["Scouts", "Planning", "Teamwork"],
    icon: Trophy,
  },
  {
    title: "Auditorium",
    category: "Performance & Meetings",
    image: `${facilityImageBase}/auditorium-300x250.jpg`,
    body: "A refined venue for meetings, conferences, performances, presentations, and large school gatherings.",
    highlights: ["Performances", "Meetings", "Conferences"],
    icon: Camera,
  },
];

const facilityGroups = [
  {
    title: "Learning & Technology",
    body: "Spaces that support digital teaching, reading, presentations, and focused academic work.",
    items: ["Audio Visual Room", "Library", "Smart Class Room"],
    icon: BookOpen,
  },
  {
    title: "Gathering & Performance",
    body: "Venues for assemblies, stage work, ceremonies, conferences, and shared college occasions.",
    items: ["SV Fonseka Hall", "Auditorium"],
    icon: Landmark,
  },
  {
    title: "Service, Faith & Leadership",
    body: "Daily services and formation spaces that support wellbeing, discipline, faith, and student leadership.",
    items: ["Canteen", "St. Ignatius Chapel", "Cadet Billet", "Scout Den"],
    icon: ShieldCheck,
  },
];

function FacilitiesServicesPage() {
  const db = useDb();
  const page = db.pages[FACILITIES_PAGE_ID];
  const pageBody =
    page?.body && page.body.trim() !== "New page content goes here." ? page.body : "";
  const heroImage =
    page?.image ||
    facilitiesServices[8]?.image ||
    db.media.campusImage ||
    db.websiteContent.heroImage;
  const imageFallback = db.media.campusImage || db.websiteContent.heroImage || DEFAULT_HERO_IMAGE;

  const handleFacilityImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.src = imageFallback;
  };

  return (
    <PublicLayout>
      <PageHeader
        pageId={FACILITIES_PAGE_ID}
        kicker={page?.kicker || "The College"}
        title={page?.title || "Facilities & Services"}
        subtitle={
          pageBody ||
          "Campus spaces that support learning, worship, leadership, performance, wellbeing, and daily student life."
        }
        image={heroImage}
      />

      <section className="bg-page-soft py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_410px]">
            <article className="min-w-0 rounded-lg border border-border bg-white p-7 shadow-soft md:p-9">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
                Campus Facilities
              </p>
              <h2 className="mt-4 max-w-3xl break-words font-serif text-2xl font-bold leading-tight text-navy sm:text-3xl md:text-4xl">
                Purpose-built spaces for study, service, worship, and school life.
              </h2>
              <p className="mt-6 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
                Loyola College Negombo provides facilities that support classroom learning,
                co-curricular formation, spiritual life, leadership development, student service,
                and major school gatherings.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  ["9", "Featured facilities"],
                  ["3", "Learning zones"],
                  ["4", "Formation spaces"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-lg bg-background p-4">
                    <p className="font-serif text-3xl font-bold text-navy">{value}</p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-crimson">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <aside className="min-w-0 overflow-hidden rounded-lg border border-border bg-navy text-white shadow-elegant">
              <div className="grid grid-cols-2 gap-1 p-1">
                {facilitiesServices.slice(0, 4).map((facility) => (
                  <img
                    key={facility.title}
                    src={facility.image}
                    alt=""
                    onError={handleFacilityImageError}
                    className="aspect-[4/3] w-full object-cover"
                  />
                ))}
              </div>
              <div className="p-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-light">
                  Facilities Network
                </p>
                <h3 className="mt-3 font-serif text-3xl font-bold leading-tight">
                  Every space has a clear role in student life.
                </h3>
                <p className="mt-4 text-sm leading-7 text-white/72">
                  The page below brings each facility into a clearer, image-led presentation for
                  parents, students, staff, and visitors.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
                Explore Facilities
              </p>
              <h2 className="mt-3 font-serif text-4xl font-bold text-navy">
                Campus facilities and student services
              </h2>
            </div>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg bg-navy px-5 py-3 text-sm font-bold text-white"
            >
              Contact office <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="stagger-children mt-9 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {facilitiesServices.map((facility) => {
              const Icon = facility.icon;
              return (
                <article
                  key={facility.title}
                  className="group min-w-0 overflow-hidden rounded-lg border border-border bg-white shadow-soft"
                >
                  <div className="relative overflow-hidden bg-navy">
                    <img
                      src={facility.image}
                      alt={`${facility.title} facility`}
                      onError={handleFacilityImageError}
                      className="aspect-[16/10] w-full object-cover transition-smooth group-hover:scale-105"
                    />
                    <span className="absolute left-4 top-4 inline-flex rounded-full bg-white/92 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-navy shadow-soft">
                      {facility.category}
                    </span>
                  </div>
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="break-words font-serif text-2xl font-bold text-navy">
                          {facility.title}
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">
                          {facility.body}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {facility.highlights.map((highlight) => (
                        <span
                          key={highlight}
                          className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-navy"
                        >
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-page-soft py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
              Service Areas
            </p>
            <h2 className="mt-3 font-serif text-4xl font-bold text-navy">
              Organized around how students use the campus.
            </h2>
          </div>
          <div className="stagger-children mt-9 grid gap-5 lg:grid-cols-3">
            {facilityGroups.map((group) => {
              const Icon = group.icon;
              return (
                <article
                  key={group.title}
                  className="min-w-0 rounded-lg border border-border bg-white p-6 shadow-soft"
                >
                  <Icon className="h-8 w-8 text-gold" />
                  <h3 className="mt-5 break-words font-serif text-3xl font-bold text-navy">
                    {group.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{group.body}</p>
                  <ul className="mt-6 space-y-2">
                    {group.items.map((item) => (
                      <li key={item} className="flex gap-2 text-sm font-semibold text-navy">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function AcademicsPage() {
  const db = useDb();
  const page = db.pages.academics;
  const sections = [
    [
      "Primary Section",
      "primary",
      "Foundational literacy, numeracy, faith formation, creativity, and school readiness.",
    ],
    [
      "Middle School",
      "middle",
      "Balanced academic growth with clubs, sports, language learning, and personal responsibility.",
    ],
    [
      "Upper School",
      "upper",
      "Examination focus, subject depth, leadership, discipline, and career preparation.",
    ],
    [
      "Advanced Level",
      "advanced-level",
      "Technology, Science, Commerce, and Arts streams with senior academic guidance.",
    ],
  ];
  const quickLinks = [
    {
      title: "Academic Calendar",
      href: "/calendar",
      body: "Open school events, holidays, celebrations, meetings, and academic dates.",
      icon: Calendar,
    },
    {
      title: "Cambridge English Academy",
      href: `/${LCEA_PAGE_ID}`,
      body: "View LCEA levels, schedules, leadership, student numbers, and teaching staff.",
      icon: BookOpen,
    },
  ];
  return (
    <PublicLayout>
      <PageHeader
        pageId="academics"
        kicker={page.kicker || "Academics"}
        title={page.title || ""}
        subtitle={page.body}
        image={page.image}
      />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="stagger-children grid gap-5 md:grid-cols-2">
          {db.academicsSections.departments.map((department) => (
            <article
              key={department.id}
              className="hover-lift rounded-lg border border-border bg-white p-6 shadow-soft"
            >
              <p className="font-serif text-4xl font-bold text-gold">{department.count}</p>
              <h2 className="mt-3 text-xl font-bold text-navy">{department.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {department.body}
              </p>
            </article>
          ))}
        </div>
        <div
          id="exam-timetable"
          className="mt-10 overflow-x-auto rounded-lg border border-border bg-white shadow-soft"
        >
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="p-4">Subject</th>
                <th className="p-4">Grade</th>
                <th className="p-4">Department</th>
              </tr>
            </thead>
            <tbody>
              {db.subjects.map((subject) => (
                <tr key={subject.id} className="border-t border-border">
                  <td className="p-4 font-medium text-navy">{subject.name}</td>
                  <td className="p-4">{subject.grade}</td>
                  <td className="p-4">{subject.department}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div id="calendar" className="stagger-children mt-8 grid gap-5 md:grid-cols-2">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.title}
                href={item.href}
                className="hover-lift rounded-lg border border-border bg-white p-6 shadow-soft"
              >
                <Icon className="h-7 w-7 text-gold" />
                <h2 className="mt-3 font-serif text-2xl text-navy">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </a>
            );
          })}
        </div>
      </section>
      <SubpagesSection parentId="academics" />
    </PublicLayout>
  );
}

function AdmissionsPage() {
  const db = useDb();
  const [submitted, setSubmitted] = useState(false);
  const page = db.pages.admissions;
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const childName = String(formData.get("childName") || "").trim();
    const record = {
      id: makeId("APP"),
      childName,
      grade: String(formData.get("grade") || "Grade 1"),
      parentName: String(formData.get("parentName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      status: "Submitted",
      createdAt: new Date().toISOString(),
    };
    if (!record.childName || !record.parentName || !record.email || !record.phone) return;
    setDb((current) => ({ ...current, admissions: [record, ...current.admissions] }));
    audit(`Admission submitted: ${childName}`, "Public");
    setSubmitted(true);
    event.currentTarget.reset();
  };
  return (
    <PublicLayout>
      <PageHeader
        pageId="admissions"
        kicker={page.kicker || "Admissions"}
        title={page.title || ""}
        subtitle={page.body}
        image={page.image}
      />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="stagger-children mb-10 grid gap-5 md:grid-cols-3">
          {["Admission Requirements", "Required Documents", "Important Dates"].map((item) => (
            <article
              key={item}
              className="hover-lift rounded-lg border border-border bg-white p-6 shadow-soft"
            >
              <FileText className="h-7 w-7 text-gold" />
              <h2 className="mt-3 font-serif text-2xl text-navy">{item}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Families can review this information before submitting an online inquiry.
              </p>
            </article>
          ))}
        </div>
        <div className="stagger-children grid gap-4 md:grid-cols-4">
          {db.admissionsSteps.map((step) => (
            <div
              key={step.id}
              className="hover-lift rounded-lg border border-border border-l-gold bg-white p-5 shadow-soft"
            >
              <p className="font-serif text-3xl text-gold">{step.number}</p>
              <h2 className="mt-2 font-bold text-navy">{step.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-12 max-w-3xl rounded-lg border border-border bg-white p-8 shadow-elegant">
          {submitted ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
              <h2 className="mt-4 font-serif text-3xl text-navy">
                {db.forms.admissionsSuccessTitle}
              </h2>
              <p className="mt-2 text-muted-foreground">{db.forms.admissionsSuccessText}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <h2 className="font-serif text-3xl text-navy">{db.forms.admissionsTitle}</h2>
              <Field label="Child's full name">
                <input required name="childName" className="input-line" />
              </Field>
              <Field label="Grade applying for">
                <select name="grade" defaultValue="Grade 1" className="input-line">
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index}>Grade {index + 1}</option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Parent / guardian name">
                  <input required name="parentName" className="input-line" />
                </Field>
                <Field label="Phone">
                  <input required name="phone" className="input-line" />
                </Field>
              </div>
              <Field label="Email">
                <input required type="email" name="email" className="input-line" />
              </Field>
              <button
                type="submit"
                className="w-full rounded-lg bg-navy py-4 text-sm font-bold text-white"
              >
                {db.forms.admissionsSubmitLabel}
              </button>
            </form>
          )}
        </div>
        <div className="stagger-children mt-10 grid gap-5 md:grid-cols-2">
          <a
            href="/downloads"
            className="hover-lift rounded-lg border border-border bg-white p-6 shadow-soft"
          >
            <Download className="h-7 w-7 text-gold" />
            <h2 className="mt-3 font-serif text-2xl text-navy">Download Application Forms</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Admission forms, circulars, requirements, and parent documents.
            </p>
          </a>
          <a
            href="/contact"
            className="hover-lift rounded-lg border border-border bg-white p-6 shadow-soft"
          >
            <Mail className="h-7 w-7 text-gold" />
            <h2 className="mt-3 font-serif text-2xl text-navy">Contact Admission Office</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask questions about process, dates, documents, and available grades.
            </p>
          </a>
        </div>
      </section>
      <SubpagesSection parentId="admissions" />
    </PublicLayout>
  );
}

function EventsPage() {
  const db = useDb();
  const page = db.pages.events;
  const categories = [
    "Upcoming Events",
    "Past Events",
    "Annual Events",
    "Academic Events",
    "Sports Events",
    "Religious Events",
    "Club Events",
    "Media Events",
  ];
  return (
    <PublicLayout>
      <PageHeader
        pageId="events"
        kicker={page.kicker || "Events"}
        title={page.title || ""}
        subtitle={page.body}
        image={page.image}
      />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="stagger-children mb-8 flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category}
              className="hover-lift rounded-full border border-border bg-white px-4 py-2 text-xs font-bold text-navy shadow-soft"
            >
              {category}
            </span>
          ))}
        </div>
        <div className="stagger-children grid gap-5 md:grid-cols-3">
          {db.events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
      <SubpagesSection parentId="events" />
    </PublicLayout>
  );
}

function CalendarPage() {
  const db = useDb();
  const page = db.pages.calendar;

  return (
    <PublicLayout>
      <PageHeader
        pageId="calendar"
        kicker={page?.kicker || "Calendar"}
        title={page?.title || "Calendar"}
        subtitle={
          page?.body && page.body.trim() !== "New page content goes here."
            ? page.body
            : "School events, holidays, celebrations, meetings, and important academic dates."
        }
        image={page?.image || db.media.campusImage || db.websiteContent.heroImage}
      />
      <section className="bg-secondary/35 px-4 py-12 sm:px-6 md:py-16">
        <div className="mx-auto max-w-[82rem]">
          <div className="overflow-hidden rounded-lg border border-border bg-white shadow-elegant">
            <GoogleCalendarFrame
              title="Loyola College calendar"
              mode="MONTH"
              className="h-[680px] md:h-[760px]"
            />
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function NewsPage() {
  const db = useDb();
  const page = db.pages.news;
  const filters = [
    "Latest News",
    "Important Notices",
    "Exam Notices",
    "Event Notices",
    "Student Notices",
    "Parent Notices",
    "Admission Notices",
    "PDF Circulars",
  ];
  return (
    <PublicLayout>
      <PageHeader
        pageId="news"
        kicker={page.kicker || "News & Notices"}
        title={page.title || "News, notices, circulars, and school updates."}
        subtitle={
          page.body ||
          "Search important college updates, pinned notices, exam circulars, parent notices, student notices, and downloadable PDFs."
        }
        image={page.image}
      />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-8 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            className="rounded-lg border border-border bg-white px-4 py-3 text-sm outline-none focus:border-gold"
            placeholder="Search news, notices, circulars..."
          />
          <select className="rounded-lg border border-border bg-white px-4 py-3 text-sm">
            <option>Category filter</option>
            {filters.map((filter) => (
              <option key={filter}>{filter}</option>
            ))}
          </select>
        </div>
        <div className="stagger-children mb-8 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <span
              key={filter}
              id={
                filter === "Latest News"
                  ? "latest-news"
                  : filter === "Important Notices"
                    ? "important-notices"
                    : undefined
              }
              className="hover-lift rounded-full border border-border bg-white px-4 py-2 text-xs font-bold text-navy shadow-soft"
            >
              {filter}
            </span>
          ))}
        </div>
        <div className="stagger-children grid gap-5 md:grid-cols-3">
          {db.news.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
        <div className="stagger-children mt-10 grid gap-4 md:grid-cols-3">
          {["Pinned notices", "Urgent notice badge", "PDF download button"].map((feature) => (
            <div
              key={feature}
              className="hover-lift rounded-lg border border-border bg-white p-5 text-sm font-medium text-navy shadow-soft"
            >
              <Bell className="mb-3 h-6 w-6 text-gold" />
              {feature}
            </div>
          ))}
        </div>
      </section>
      <SubpagesSection parentId="news" />
    </PublicLayout>
  );
}

function SportsClubsPage() {
  const db = useDb();
  const page = db.pages["sports-clubs"];
  const sports = ["Athletics", "Cricket", "Football", "Basketball", "Swimming", "Badminton"];
  const clubs = [
    "Media Unit",
    "Science Society",
    "ICT Society",
    "Prefects Board",
    "English Literary Association",
    "Religious Society",
    "Environmental Society",
  ];
  return (
    <PublicLayout>
      <PageHeader
        pageId="sports-clubs"
        kicker={page.kicker || "Sports & Clubs"}
        title={page.title || "Student leadership, clubs, societies, sports, and achievements."}
        subtitle={
          page.body ||
          "A dedicated space for sports teams, clubs, student leadership, schedules, achievements, galleries, and society updates."
        }
        image={page.image}
      />
      <section id="sports" className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-crimson">
              Sports Overview
            </p>
            <h2 className="mt-3 font-serif text-4xl font-bold text-navy">
              Sports clubs and event schedules.
            </h2>
            <div className="stagger-children mt-6 grid gap-3 sm:grid-cols-2">
              {sports.map((sport) => (
                <article
                  key={sport}
                  className="hover-lift rounded-lg border border-border bg-white p-5 shadow-soft"
                >
                  <Trophy className="h-7 w-7 text-gold" />
                  <h3 className="mt-3 font-bold text-navy">{sport}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Team updates, fixtures, teacher-in-charge, achievements, and gallery.
                  </p>
                </article>
              ))}
            </div>
          </div>
          <div id="clubs">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-crimson">
              Clubs & Societies
            </p>
            <h2 className="mt-3 font-serif text-4xl font-bold text-navy">
              Student communities across campus.
            </h2>
            <div className="stagger-children mt-6 grid gap-3">
              {clubs.map((club) => (
                <article
                  key={club}
                  className="hover-lift rounded-lg border border-border bg-white p-5 shadow-soft"
                >
                  <h3 className="font-bold text-navy">{club}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Club logo, description, teacher-in-charge, president, secretary, members,
                    events, news, and gallery.
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
        <div id="achievements" className="stagger-children mt-12 grid gap-5 md:grid-cols-3">
          {["Sports Achievements", "Student Leadership", "Club Gallery"].map((item) => (
            <article
              key={item}
              className="hover-lift rounded-lg bg-navy p-6 text-white shadow-elegant"
            >
              <Award className="h-7 w-7 text-gold-light" />
              <h2 className="mt-3 font-serif text-2xl">{item}</h2>
              <p className="mt-2 text-sm text-white/70">
                A publishable section for records, leaders, events, and media coverage.
              </p>
            </article>
          ))}
        </div>
      </section>
      <SubpagesSection parentId="sports-clubs" />
    </PublicLayout>
  );
}

function GalleryPage() {
  const db = useDb();
  const page = db.pages.gallery;
  const albums = db.gallery.filter((item) => item.visible !== false);
  const videoAlbums = db.videoGallery.filter(
    (item) => item.visible !== false && item.videos.length > 0,
  );
  const categories = [
    "Photo Gallery",
    "Video Gallery",
    "Event Albums",
    "Sports Albums",
    "Religious Events",
    "Academic Events",
    "Media Unit Coverage",
    "Old Memories",
  ];
  return (
    <PublicLayout>
      <PageHeader
        pageId="gallery"
        kicker={page.kicker || "Gallery"}
        title={page.title || "Photo, video, event, sports, academic, and old memories albums."}
        subtitle={
          page.body ||
          "Browse Loyola College moments with album covers, captions, categories, dates, lightbox previews, and video embeds."
        }
        image={page.image || db.media.campusImage}
      />
      <section id="photos" className="mx-auto max-w-7xl px-6 py-20">
        <div className="stagger-children mb-8 flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category}
              id={category === "Video Gallery" ? "videos" : undefined}
              className="hover-lift rounded-full border border-border bg-white px-4 py-2 text-xs font-bold text-navy shadow-soft"
            >
              {category}
            </span>
          ))}
        </div>
        <div className="stagger-children grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {albums.map((item) => {
            const images = (item.images || (item.image ? [item.image] : []))
              .filter(Boolean)
              .slice(0, 10);
            const cover = images[0] || "/loyola-crest.jpg";
            return (
              <article
                key={item.id}
                className="hover-lift overflow-hidden rounded-lg border border-border bg-white shadow-soft"
              >
                <img src={cover} alt={item.label} className="aspect-[4/3] w-full object-cover" />
                <div className="p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-crimson">
                    Photo album | {images.length} photo{images.length === 1 ? "" : "s"}
                  </p>
                  <h2 className="mt-2 font-serif text-2xl text-navy">{item.label}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.description ||
                      "Browse this Loyola College album and open the full collection link."}
                  </p>
                  {images.length > 1 && (
                    <div className="mt-4 grid grid-cols-5 gap-2">
                      {images.slice(0, 5).map((image) => (
                        <img
                          key={image}
                          src={image}
                          alt=""
                          className="aspect-square rounded-md object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white"
                    >
                      Show more
                    </a>
                  ) : (
                    <span className="mt-5 inline-flex rounded-lg bg-muted-foreground/35 px-4 py-2 text-sm font-bold text-white">
                      Show more
                    </span>
                  )}
                </div>
              </article>
            );
          })}
          {albums.length === 0 && (
            <p className="rounded-lg border border-border bg-white p-6 text-sm text-muted-foreground shadow-soft">
              No visible albums yet.
            </p>
          )}
        </div>
        {videoAlbums.length > 0 && (
          <div className="hover-lift mt-12 rounded-lg border border-border bg-white p-6 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-crimson">
              Video gallery
            </p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-navy">
              Videos are managed separately
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Open the dedicated video gallery to view school videos and YouTube previews.
            </p>
            <a
              href="/gallery/video-gallery"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white"
            >
              Open Video Gallery <Film className="h-4 w-4" />
            </a>
          </div>
        )}
      </section>
      <SubpagesSection parentId="gallery" />
    </PublicLayout>
  );
}

function albumImages(item: GalleryItem) {
  return (item.images || (item.image ? [item.image] : [])).filter(Boolean);
}

function albumHref(item: GalleryItem) {
  return `/gallery/photo-gallery/${encodeURIComponent(item.id)}`;
}

function PhotoAlbumPage({ albumKey }: { albumKey: string }) {
  const db = useDb();
  const album = db.gallery.find((item) => item.id === albumKey && item.visible !== false);
  const images = album ? albumImages(album) : [];
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedImage = selectedIndex === null ? null : images[selectedIndex];

  const moveLightbox = (direction: -1 | 1) => {
    setSelectedIndex((current) => {
      if (current === null || images.length === 0) return current;
      return (current + direction + images.length) % images.length;
    });
  };

  if (!album) {
    return (
      <PublicLayout>
        <PageHeader
          pageId="gallery/photo-gallery"
          kicker="Photo Gallery"
          title="Album not found"
          subtitle="This album is unavailable or hidden."
          image={db.media.campusImage}
        />
        <section className="mx-auto max-w-4xl px-6 py-16">
          <a
            href="/gallery/photo-gallery"
            className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-bold text-white"
          >
            <ChevronLeft className="h-4 w-4" /> Back to photo albums
          </a>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="bg-page-soft py-14">
        <div className="mx-auto max-w-7xl px-6">
          <a
            href="/gallery/photo-gallery"
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-navy shadow-soft transition-smooth hover:border-gold"
          >
            <ChevronLeft className="h-4 w-4" /> Back to albums
          </a>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
                All photos
              </p>
              <h2 className="mt-3 font-serif text-4xl font-bold text-navy">
                {album.label} gallery
              </h2>
            </div>
            {album.link && (
              <a
                href={album.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-bold text-white shadow-soft transition-smooth hover:-translate-y-0.5 hover:bg-navy-mid"
              >
                Show more <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>

          <div className="stagger-children grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {images.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className="group relative overflow-hidden rounded-lg border border-border bg-white text-left shadow-soft transition-smooth hover:-translate-y-1 hover:border-gold hover:shadow-elegant"
              >
                <img
                  src={image}
                  alt={`${album.label} photo ${index + 1}`}
                  className="aspect-[4/3] w-full object-cover transition-smooth group-hover:scale-105"
                />
              </button>
            ))}
            {images.length === 0 && (
              <p className="rounded-lg border border-border bg-white p-6 text-sm text-muted-foreground shadow-soft">
                No photos have been added to this album yet.
              </p>
            )}
          </div>
        </div>
      </section>

      {selectedImage && selectedIndex !== null && (
        <div className="fixed inset-0 z-[100] bg-navy/95 p-4 text-white md:p-8">
          <div className="mx-auto flex h-full max-w-7xl flex-col">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-light">
                  {album.label}
                </p>
                <p className="mt-1 text-sm text-white/70">
                  {selectedIndex + 1} of {images.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="grid h-11 w-11 place-items-center rounded-full bg-white text-navy"
                aria-label="Close photo preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3">
              <button
                type="button"
                onClick={() => moveLightbox(-1)}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/10"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <img
                src={selectedImage}
                alt={`${album.label} photo ${selectedIndex + 1}`}
                className="mx-auto max-h-full min-h-0 max-w-full rounded-lg object-contain shadow-elegant"
              />
              <button
                type="button"
                onClick={() => moveLightbox(1)}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/10"
                aria-label="Next photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

function youtubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v") || "";
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] || "";
    }
  } catch {
    return "";
  }
  return "";
}

function youtubeEmbedUrl(url: string) {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}` : "";
}

function videoPoster(video: GalleryVideo, images: string[]) {
  const youtubeId = youtubeVideoId(video.url);
  return (
    video.thumbnail ||
    images[0] ||
    (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : "")
  );
}

function GalleryVideoFrame({
  video,
  images,
  className = "aspect-video w-full bg-black object-contain",
}: {
  video: GalleryVideo;
  images: string[];
  className?: string;
}) {
  const embedUrl = youtubeEmbedUrl(video.url);
  if (embedUrl) {
    return (
      <iframe
        src={embedUrl}
        title={video.name}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className={className}
      />
    );
  }

  return (
    <video controls poster={videoPoster(video, images)} className={className}>
      {video.webmUrl && <source src={video.webmUrl} type="video/webm" />}
      <source src={video.url} type="video/mp4" />
    </video>
  );
}

function PhotoGalleryPage({ pageId }: { pageId: string }) {
  const db = useDb();
  const page = db.pages[pageId] || db.pages.gallery;
  const albums = db.gallery
    .filter((item) => item.visible !== false)
    .map((item) => ({ item, images: albumImages(item) }))
    .filter(({ images }) => images.length > 0);

  return (
    <PublicLayout>
      <PageHeader
        pageId={pageId}
        kicker={page?.kicker || "Photo Gallery"}
        title={page?.title || "Photo Gallery"}
        subtitle={
          page?.body ||
          "Browse campus life, celebrations, sports, academic moments, and old memories from Loyola College."
        }
        image={page?.image || albums[0]?.images[0] || db.media.campusImage}
      />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
              Photo albums
            </p>
            <h2 className="mt-3 font-serif text-4xl font-bold text-navy">Browse by album</h2>
          </div>
          <a
            href="/gallery/video-gallery"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-3 text-sm font-bold text-navy shadow-soft transition-smooth hover:border-gold"
          >
            Video Gallery <Film className="h-4 w-4" />
          </a>
        </div>
        <div className="stagger-children grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {albums.map(({ item, images }) => (
            <article
              key={item.id}
              className="group hover-lift overflow-hidden rounded-lg border border-border bg-white shadow-soft transition-smooth hover:-translate-y-1 hover:border-gold hover:shadow-elegant"
            >
              <a href={albumHref(item)} className="block overflow-hidden">
                <img
                  src={images[0]}
                  alt={item.label}
                  className="aspect-[4/3] w-full object-cover transition-smooth group-hover:scale-105"
                />
              </a>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-crimson">
                    <Images className="h-4 w-4" /> {images.length} photo
                    {images.length === 1 ? "" : "s"}
                  </p>
                </div>
                <a href={albumHref(item)} className="block">
                  <h3 className="mt-3 font-serif text-2xl font-bold text-navy transition-smooth hover:text-crimson">
                    {item.label}
                  </h3>
                </a>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {item.description || "A curated Loyola College photo collection."}
                </p>
                <div className="mt-4 grid grid-cols-5 gap-2">
                  {images.slice(0, 5).map((image) => (
                    <a key={image} href={albumHref(item)}>
                      <img src={image} alt="" className="aspect-square rounded-md object-cover" />
                    </a>
                  ))}
                </div>
                <a
                  href={albumHref(item)}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white"
                >
                  Open album <ArrowRight className="h-4 w-4" />
                </a>
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 mt-5 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold text-navy"
                  >
                    Show more <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </article>
          ))}
          {albums.length === 0 && (
            <p className="rounded-lg border border-border bg-white p-6 text-sm text-muted-foreground shadow-soft">
              No visible photo albums yet.
            </p>
          )}
        </div>
      </section>
      <SubpagesSection parentId={pageId} />
    </PublicLayout>
  );
}

function VideoGalleryPage({ pageId }: { pageId: string }) {
  const db = useDb();
  const page = db.pages[pageId] || db.pages.gallery;
  const albums = db.videoGallery
    .filter((item) => item.visible !== false && item.videos.length > 0)
    .map((item) => ({ item, videos: item.videos, cover: item.coverImage || "" }));
  const featured = albums[0];
  const videoCount = albums.reduce((total, album) => total + album.videos.length, 0);
  const featuredPoster = featured?.videos[0]
    ? videoPoster(featured.videos[0], [featured.cover])
    : "";

  return (
    <PublicLayout>
      <PageHeader
        pageId={pageId}
        kicker={page?.kicker || "Video Gallery"}
        title={page?.title || "Video Gallery"}
        subtitle={
          page?.body ||
          "Watch school events, celebrations, performances, sports coverage, and media unit highlights."
        }
        image={page?.image || featuredPoster || db.media.campusImage}
      />
      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="hover-lift overflow-hidden rounded-lg border border-border bg-navy shadow-elegant">
            {featured?.videos[0] ? (
              <GalleryVideoFrame
                video={featured.videos[0]}
                images={[featured.cover]}
                className="aspect-video w-full bg-black object-contain"
              />
            ) : (
              <div className="grid aspect-video place-items-center bg-secondary text-muted-foreground">
                <PlayCircle className="h-12 w-12" />
              </div>
            )}
            <div className="border-t border-white/10 p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-light">
                Featured video
              </p>
              <h2 className="mt-2 font-serif text-3xl font-bold">
                {featured?.item.label || "Video highlights"}
              </h2>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
              Watch archive
            </p>
            <h2 className="mt-4 font-serif text-4xl font-bold leading-tight text-navy md:text-5xl">
              A focused video page for school coverage.
            </h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              Videos are grouped by album so visitors can scan the event context first, then play
              the clips directly on the page.
            </p>
            <div className="stagger-children mt-8 grid grid-cols-2 gap-3">
              {[
                ["Video albums", albums.length],
                ["Videos", videoCount],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="hover-lift rounded-lg border border-border bg-secondary/45 p-4"
                >
                  <p className="text-2xl font-black text-navy">{value}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>
            <a
              href="/gallery/photo-gallery"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-3 text-sm font-bold text-navy shadow-soft transition-smooth hover:border-gold"
            >
              Photo Gallery <Camera className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="stagger-children grid gap-6 lg:grid-cols-2">
          {albums.map(({ item, videos, cover }) => (
            <article
              key={item.id}
              className="hover-lift overflow-hidden rounded-lg border border-border bg-white shadow-soft"
            >
              <div className="border-b border-border bg-secondary/45 p-5">
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-crimson">
                  <Film className="h-4 w-4" /> {videos.length} video
                  {videos.length === 1 ? "" : "s"}
                </p>
                <h3 className="mt-2 font-serif text-2xl font-bold text-navy">{item.label}</h3>
                {item.description && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="space-y-4 p-5">
                {videos.map((video) => (
                  <div key={video.id} className="overflow-hidden rounded-lg border border-border">
                    <GalleryVideoFrame
                      video={video}
                      images={[cover]}
                      className="aspect-video w-full bg-black object-contain"
                    />
                    <div className="flex items-center justify-between gap-3 bg-white px-4 py-3">
                      <p className="min-w-0 truncate text-sm font-bold text-navy">{video.name}</p>
                      <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                        {new Date(video.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
          {albums.length === 0 && (
            <p className="rounded-lg border border-border bg-white p-6 text-sm text-muted-foreground shadow-soft">
              No visible videos yet.
            </p>
          )}
        </div>
      </section>
      <SubpagesSection parentId={pageId} />
    </PublicLayout>
  );
}

function DownloadsPage() {
  const db = useDb();
  const page = db.pages.downloads;
  return (
    <PublicLayout>
      <PageHeader
        pageId="downloads"
        kicker={page.kicker || "Downloads"}
        title={
          page.title || "Forms, timetables, circulars, school policies, notices, and past papers."
        }
        subtitle={
          page.body ||
          "A searchable download area for students, parents, teachers, and admissions applicants."
        }
        image={page.image}
      />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="stagger-children grid gap-5 md:grid-cols-4">
          {db.downloads.map((item) => (
            <article
              key={item.id}
              className="hover-lift rounded-lg border border-border bg-white p-6 shadow-soft"
            >
              <Download className="h-7 w-7 text-gold" />
              <h2 className="mt-4 font-serif text-2xl text-navy">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-crimson">
                {item.type}
              </p>
              <a
                href={item.fileUrl || "#"}
                download
                className={`mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-bold text-white ${
                  item.fileUrl ? "bg-navy" : "pointer-events-none bg-muted-foreground/45"
                }`}
              >
                Download
              </a>
            </article>
          ))}
        </div>
      </section>
      <SubpagesSection parentId="downloads" />
    </PublicLayout>
  );
}

function StudentPortalLandingPage() {
  const db = useDb();
  const page = db.pages["student-portal"];
  const links = [
    "LMS Login",
    "Exam Results",
    "Timetables",
    "Assignments",
    "Online Resources",
    "School Calendar",
    "Notices",
    "Help / Support",
  ];
  return (
    <PublicLayout>
      <PageHeader
        pageId="student-portal"
        kicker={page.kicker || "Student Portal"}
        title={
          page.title || "LMS, results, timetables, assignments, resources, calendar, and notices."
        }
        subtitle={
          page.body ||
          "A clear gateway for students and parents before entering the secure role-based portal."
        }
        image={page.image}
      />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="stagger-children grid gap-5 md:grid-cols-4">
          {links.map((link) => (
            <a
              key={link}
              href="/login"
              className="hover-lift rounded-lg border border-border bg-white p-6 shadow-soft transition-smooth hover:-translate-y-1 hover:border-gold"
            >
              <ShieldCheck className="h-7 w-7 text-gold" />
              <h2 className="mt-4 font-serif text-2xl text-navy">{link}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Open secure portal access.</p>
            </a>
          ))}
        </div>
      </section>
      <SubpagesSection parentId="student-portal" />
    </PublicLayout>
  );
}

function ContactPage() {
  const db = useDb();
  const page = db.pages.contact;
  const mapUrl = db.websiteContent.mapUrl || DEFAULT_MAP_URL;
  const mapEmbedUrl = db.websiteContent.mapEmbedUrl || DEFAULT_MAP_EMBED_URL;
  const [sent, setSent] = useState(false);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const subject = String(formData.get("subject") || "").trim();
    const record = {
      id: makeId("MSG"),
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      subject,
      body: String(formData.get("message") || "").trim(),
      status: "Unread",
      createdAt: new Date().toISOString(),
    };
    if (!record.name || !record.email || !record.subject || !record.body) return;
    setDb((current) => ({ ...current, messages: [record, ...current.messages] }));
    audit(`Contact message: ${subject}`, "Public");
    setSent(true);
    event.currentTarget.reset();
  };
  return (
    <PublicLayout>
      <PageHeader
        pageId="contact"
        kicker={page.kicker || "Contact"}
        title={page.title || ""}
        subtitle={page.body}
        image={page.image}
      />
      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-20 lg:grid-cols-[380px_1fr]">
        <aside className="hover-lift rounded-lg bg-navy p-7 text-white">
          <h2 className="font-serif text-3xl">College office</h2>
          <div className="mt-6 space-y-4 text-sm text-white/75">
            <p className="flex gap-3">
              <MapPin className="h-5 w-5 text-gold" /> {db.websiteContent.address}
            </p>
            <p className="flex gap-3">
              <Phone className="h-5 w-5 text-gold" /> {db.websiteContent.phone}
            </p>
            <p className="flex gap-3">
              <Mail className="h-5 w-5 text-gold" /> {db.websiteContent.email}
            </p>
            <p className="flex gap-3">
              <Calendar className="h-5 w-5 text-gold" /> Office Hours:{" "}
              {db.websiteContent.officeHours}
            </p>
          </div>
          <div className="mt-7 overflow-hidden rounded-lg border border-white/12 bg-white">
            <div className="relative aspect-[4/3] min-h-[260px]">
              <iframe
                title="Loyola College Negombo location"
                src={mapEmbedUrl}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute left-3 top-3 rounded-md bg-white px-3 py-2 text-sm font-bold text-blue-700 shadow-soft"
              >
                Open in Maps
              </a>
            </div>
          </div>
        </aside>
        <form
          onSubmit={submit}
          className="rounded-lg border border-border bg-white p-8 shadow-soft focus-gold"
        >
          <h2 className="font-serif text-3xl text-navy">{db.forms.contactTitle}</h2>
          {sent && (
            <p className="mt-4 rounded-lg bg-success/10 p-3 text-sm text-success">
              {db.forms.contactSuccessText}
            </p>
          )}
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <Field label="Name">
              <input required name="name" className="input-line" />
            </Field>
            <Field label="Email">
              <input required type="email" name="email" className="input-line" />
            </Field>
            <Field label="Phone">
              <input name="phone" className="input-line" placeholder="Optional" />
            </Field>
          </div>
          <Field label="Subject">
            <input required name="subject" className="input-line" />
          </Field>
          <Field label="Message">
            <textarea required name="message" rows={5} className="input-line resize-none" />
          </Field>
          <button
            type="submit"
            className="mt-5 rounded-lg bg-navy px-6 py-3 text-sm font-bold text-white"
          >
            {db.forms.contactSubmitLabel}
          </button>
          <div className="stagger-children mt-8 grid gap-3 md:grid-cols-3">
            {[
              { label: "Google Map", href: mapUrl },
              { label: "Social Media Links", href: "/contact" },
              { label: "Vacancies", href: "/contact" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                target={item.label === "Google Map" ? "_blank" : undefined}
                rel={item.label === "Google Map" ? "noreferrer" : undefined}
                className="hover-lift rounded-lg border border-border bg-secondary/60 px-4 py-3 text-sm font-medium text-navy"
              >
                {item.label}
              </a>
            ))}
          </div>
        </form>
      </section>
      <SubpagesSection parentId="contact" />
    </PublicLayout>
  );
}

function GenericPage({ pageId }: { pageId: string }) {
  const db = useDb();
  const page = db.pages[pageId];
  if (page?.visualHtml) return <VisualBuilderPage pageId={pageId} />;

  const title = page?.title || pageId.split("/").pop()?.replaceAll("-", " ") || "Page";

  return (
    <PublicLayout>
      <PageHeader
        pageId={pageId}
        kicker={page?.kicker || "Page"}
        title={title}
        subtitle={page?.visualHtml ? undefined : page?.body}
        image={page?.image || db.media.campusImage || db.websiteContent.heroImage}
      />

      {page?.blocks && page.blocks.length > 0 ? (
        <div className="mx-auto max-w-5xl px-6 py-20 space-y-16">
          {page.blocks.map((block) => (
            <section key={block.id} className="w-full">
              {block.type === "text" && (
                <article className="prose prose-slate max-w-none">
                  {block.content.title && (
                    <h2 className="font-serif text-3xl font-bold text-navy">
                      {block.content.title}
                    </h2>
                  )}
                  {block.content.body && (
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {block.content.body}
                    </p>
                  )}
                </article>
              )}
              {block.type === "hero" && (
                <div className="rounded-2xl bg-navy p-10 text-center text-white shadow-elegant">
                  {block.content.title && (
                    <h2 className="font-serif text-4xl font-bold">{block.content.title}</h2>
                  )}
                  {block.content.body && <p className="mt-4 text-white/80">{block.content.body}</p>}
                </div>
              )}
              {block.type === "quote" && (
                <blockquote className="border-l-4 border-gold pl-6 py-2">
                  <p className="font-serif text-2xl italic text-navy">{block.content.quote}</p>
                  {block.content.author && (
                    <footer className="mt-3 text-sm font-bold uppercase tracking-wider text-crimson">
                      — {block.content.author}
                    </footer>
                  )}
                </blockquote>
              )}
              {block.type === "gallery" && (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <div className="col-span-full mb-2">
                    {block.content.title && (
                      <h3 className="font-serif text-2xl font-bold text-navy">
                        {block.content.title}
                      </h3>
                    )}
                  </div>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200"
                    >
                      <ImageIcon className="h-8 w-8 text-slate-300" />
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <section className="mx-auto max-w-4xl px-6 py-20">
          <article className="rounded-lg border border-border bg-white p-8 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson">
              {pageId === "home" ? "/" : `/${pageId}`}
            </p>
            <h2 className="mt-4 font-serif text-4xl font-bold capitalize text-navy">{title}</h2>
            <p className="mt-5 leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {page?.body || "Add page content from the Page Builder."}
            </p>
          </article>
        </section>
      )}
      <SubpagesSection parentId={pageId} />
    </PublicLayout>
  );
}

function RectorsMessagePage({ pageId = "rectors-message" }: { pageId?: string }) {
  const db = useDb();
  const page = db.pages[pageId] || db.pages["rectors-message"];
  const title = page?.title || "Rector's Message";
  const defaultBody = "";
  const bodyText =
    page?.body && page.body.trim() !== "New page content goes here." ? page.body : defaultBody;
  const paragraphs = bodyText.split("\n").filter((p) => p.trim() !== "");

  return (
    <PublicLayout>
      <PageHeader
        pageId={pageId}
        kicker={page?.kicker || "About"}
        title={title}
        subtitle="A message from the Principal of Loyola College Negombo"
        image={page?.image || db.media.campusImage || db.websiteContent.heroImage}
      />
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-[400px_1fr] lg:gap-20">
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border-4 border-white shadow-elegant">
              <img
                src={db.media.principalImage || "/loyola-crest.jpg"}
                alt="Rector of Loyola College"
                className="w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -right-6 -z-10 h-full w-full rounded-2xl bg-gold/20" />
          </div>
          <article className="prose prose-lg prose-slate max-w-none">
            {paragraphs.map((p, i) => {
              if (i === 0 && (p.startsWith("Dear") || p.startsWith("Welcome"))) {
                return (
                  <h2 key={i} className="font-serif text-3xl font-bold text-navy mb-8">
                    {p}
                  </h2>
                );
              }
              if (i === paragraphs.length - 2 && (p.startsWith("Rev.") || p.startsWith("Fr."))) {
                return (
                  <div key={i} className="mt-12 border-l-4 border-gold pl-6">
                    <p className="font-bold text-navy text-lg">{p}</p>
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-crimson mt-1">
                      {paragraphs[i + 1]}
                    </p>
                  </div>
                );
              }
              if (
                i === paragraphs.length - 1 &&
                (paragraphs[i - 1]?.startsWith("Rev.") || paragraphs[i - 1]?.startsWith("Fr."))
              ) {
                return null;
              }
              return (
                <p key={i} className="mb-6 text-muted-foreground leading-relaxed">
                  {p}
                </p>
              );
            })}
          </article>
        </div>
      </section>
      <SubpagesSection parentId="rectors-message" />
    </PublicLayout>
  );
}

function LoginPage() {
  const db = useDb();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<{
    token: string;
    email: string;
  } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  const redirectAfterLogin = () => {
    const nextPath = new URLSearchParams(window.location.search).get("next") || "";
    window.location.href =
      nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/portal";
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (twoFactorChallenge) {
        await authenticateTwoFactor(twoFactorChallenge.token, twoFactorCode);
        redirectAfterLogin();
        return;
      }

      const formData = new FormData(event.currentTarget);
      await authenticateUser(
        String(formData.get("email") || ""),
        String(formData.get("password") || ""),
      );
      redirectAfterLogin();
    } catch (err) {
      if (err instanceof TwoFactorRequiredError && err.twoFactorToken) {
        setTwoFactorChallenge({ token: err.twoFactorToken, email: err.email });
        setTwoFactorCode("");
        setError("");
        setSubmitting(false);
        return;
      }
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setSubmitting(false);
    }
  };

  const roleChips = [
    { label: "Student", color: "bg-sky-100 text-sky-800" },
    { label: "Parent", color: "bg-violet-100 text-violet-800" },
    { label: "Teacher", color: "bg-emerald-100 text-emerald-800" },
    { label: "Admin", color: "bg-amber-100 text-amber-800" },
  ];

  return (
    <main className="login-page grid min-h-screen bg-[#f0f4ff] lg:grid-cols-[1.1fr_1fr]">
      {/* ── Left brand panel ────────────────────────────────── */}
      <section
        className="login-brand-panel relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between"
        style={{
          background: "linear-gradient(135deg, #071430 0%, #0a1e4a 40%, #14286e 70%, #0a1628 100%)",
        }}
      >
        {/* Animated gradient blobs */}
        <div
          className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-25"
          style={{
            background: "radial-gradient(circle, #d4a017 0%, transparent 70%)",
            animation: "morphBg 8s ease-in-out infinite",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, #b70f1b 0%, transparent 70%)",
            animation: "morphBg 11s ease-in-out infinite reverse",
          }}
        />
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #ffffff 0%, transparent 70%)",
            animation: "float 6s ease-in-out infinite",
          }}
        />
        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Top: Logo + school name */}
        <a
          href="/"
          className="relative z-10 flex items-center gap-4 p-10 animate-fade-in-up"
          aria-label="Back to Loyola College home page"
        >
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full opacity-60"
              style={{
                background: "conic-gradient(from 0deg, #d4a017, #f7d96b, #d4a017)",
                animation: "brandRingSpin 3s linear infinite",
                padding: "3px",
                borderRadius: "999px",
              }}
            />
            <img
              className="relative h-16 w-16 rounded-full border-2 border-gold bg-white object-contain p-1.5 shadow-lg"
              src="/loyola-crest.jpg"
              alt=""
              style={{ animation: "brandLogoPulse 3s ease-in-out infinite" }}
            />
          </div>
          <div>
            <p className="font-serif text-2xl font-bold text-white leading-tight">
              {db.websiteContent.schoolName}
            </p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.22em] text-amber-300">
              {db.websiteContent.tagline}
            </p>
          </div>
        </a>

        {/* Centre: Headline */}
        <div className="relative z-10 px-10 animate-fade-in-up animation-delay-2">
          <div
            className="mb-6 h-0.5 w-12 rounded"
            style={{ background: "#d4a017", animation: "dividerGrow 0.8s ease both 0.3s" }}
          />
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300/80">
            Secure portal access
          </p>
          <h1 className="mt-4 font-serif text-5xl font-bold leading-[1.1] text-white">
            Your Loyola
            <br />
            <span className="text-amber-300">digital home.</span>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-white/65">
            A unified workspace connecting students, parents, teachers, and administration through
            one secure sign-in.
          </p>

          {/* Feature pills */}
          <div className="stagger-fast mt-8 flex flex-wrap gap-2">
            {["Student Portal", "Parent Access", "Staff Dashboard", "Website Studio"].map(
              (item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                  {item}
                </span>
              ),
            )}
          </div>
        </div>

        {/* Bottom: Copyright */}
        <div className="relative z-10 px-10 pb-10">
          <p className="text-xs text-white/45">
            &copy; {new Date().getFullYear()} {db.websiteContent.schoolName}. All rights reserved.
          </p>
        </div>
      </section>

      {/* ── Right form panel ────────────────────────────────── */}
      <section className="flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-10">
        <a
          href="/"
          className="mb-8 flex items-center gap-3 lg:hidden animate-fade-in"
          aria-label="Back to Loyola College home page"
        >
          <img
            className="h-12 w-12 rounded-full border-2 border-[#d4a017] bg-white object-contain p-1"
            src="/loyola-crest.jpg"
            alt=""
          />
          <div>
            <p className="font-serif text-xl font-bold text-navy">{db.websiteContent.schoolName}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d4a017]">
              {db.websiteContent.tagline}
            </p>
          </div>
        </a>

        <form
          onSubmit={submit}
          className="login-card w-full max-w-[420px] animate-fade-in-up"
          style={{ animationDelay: "80ms" }}
        >
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground transition-all hover:text-crimson hover:gap-2.5"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to website
          </a>

          <div className="mt-7">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#b70f1b]">
              Portal sign in
            </p>
            <h2 className="mt-2 font-serif text-4xl font-bold text-navy leading-tight">
              {twoFactorChallenge ? "Verify sign in" : "Welcome back"}
            </h2>
          <p className="mt-2 text-sm text-muted-foreground">
              {twoFactorChallenge
                ? `Enter the authentication code for ${twoFactorChallenge.email}.`
                : "Enter your assigned email and password to continue."}
            </p>
          </div>

          {twoFactorChallenge ? (
            <div className="mt-7 space-y-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-bold text-emerald-900">Two-factor authentication</p>
                <p className="mt-1 text-xs leading-5 text-emerald-800">
                  Open your authenticator app and enter the current 6-digit code.
                </p>
              </div>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Authentication code
                </span>
                <div className="relative mt-2">
                  <ShieldCheck className="absolute top-1/2 left-0 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-two-factor-code"
                    name="twoFactorCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9 ]*"
                    required
                    autoComplete="one-time-code"
                    value={twoFactorCode}
                    onChange={(event) =>
                      setTwoFactorCode(event.target.value.replace(/[^\d ]/g, "").slice(0, 8))
                    }
                    placeholder="123456"
                    className="input-line pl-7"
                  />
                </div>
              </label>
              <button
                type="button"
                onClick={() => {
                  setTwoFactorChallenge(null);
                  setTwoFactorCode("");
                  setError("");
                }}
                className="text-xs font-bold text-slate-500 transition hover:text-navy"
              >
                Use a different account
              </button>
            </div>
          ) : (
            <>
          <div className="mt-7">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Email address
              </span>
              <div className="relative mt-2">
                <Mail className="absolute top-1/2 left-0 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="you@school.test"
                  className="input-line pl-7"
                />
              </div>
            </label>
          </div>

          <div className="mt-5">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Password
              </span>
              <div className="relative mt-2">
                <Lock className="absolute top-1/2 left-0 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="input-line pl-7 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-0 -translate-y-1/2 text-slate-400 transition hover:text-navy"
                  tabIndex={-1}
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </label>
          </div>
            </>
          )}

          {error && (
            <div className="animate-bounce-in mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          <button
            id="login-submit"
            disabled={
              submitting ||
              Boolean(twoFactorChallenge && twoFactorCode.replace(/\s+/g, "").length < 6)
            }
            type="submit"
            className="login-submit mt-7 w-full rounded-xl bg-[#0a1628] px-5 py-4 text-sm font-bold text-white shadow-[0_12px_32px_-16px_rgba(10,22,40,0.6)] transition-all hover:-translate-y-0.5 hover:bg-[#122040] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                  style={{ animation: "spin 0.7s linear infinite" }}
                />
                {twoFactorChallenge ? "Verifying..." : "Signing in..."}
              </span>
            ) : (
              twoFactorChallenge ? "Verify and continue ->" : "Sign in to portal ->"
            )}
          </button>

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Available for
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {roleChips.map((chip) => (
                <span
                  key={chip.label}
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${chip.color}`}
                >
                  {chip.label}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Access is limited to active Loyola College portal accounts.
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}

function CentralPortal() {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.user) window.location.href = "/login";
  }, [auth.loading, auth.user]);

  if (auth.loading || !auth.user) {
    return <BrandedLoader title="Opening portal" subtitle="Checking your session" />;
  }

  const modules: {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    roles: Role[];
    meta: string;
    lockedMeta: string;
  }[] = [
    {
      title: "Website Admin",
      href: "/admin",
      icon: ShieldCheck,
      roles: WEBSITE_ADMIN_ROLES,
      meta: "Website, media, news, notices, events",
      lockedMeta: "Only website admins and top admins",
    },
    {
      title: "Staff Management",
      href: "/staff",
      icon: Briefcase,
      roles: STAFF_ADMIN_ROLES,
      meta: "Legacy staff profiles, photos, attendance, leave",
      lockedMeta: "Only staff admins and top admins",
    },
    {
      title: "EduTrack",
      href: "/portal/edutrack",
      icon: BookOpen,
      roles: EDUTRACK_ROLES,
      meta: "Full syllabus tracking workspace",
      lockedMeta: "Teachers and EduTrack admins",
    },
    {
      title: "ELMS",
      href: "/portal/elms",
      icon: GraduationCap,
      roles: ELMS_ROLES,
      meta: "Learning workspace",
      lockedMeta: "Students and teachers",
    },
    {
      title: "Report Cards",
      href: REPORT_CARDS_SYSTEM_URL,
      icon: FileText,
      roles: REPORT_CARD_ROLES,
      meta: "Marks and reports",
      lockedMeta: "Available by profile relationship",
    },
    {
      title: "User Management",
      href: "/admin?panel=users",
      icon: Users,
      roles: MASTER_ROLES,
      meta: "Accounts, roles, and permissions",
      lockedMeta: "Only Master Admin",
    },
  ];

  const logout = async () => {
    audit(`${auth.user?.role} signed out`, auth.user?.email || "");
    await setAuth(null);
    window.location.href = "/login";
  };

  return (
    <main className="portal-landing min-h-screen bg-[#eef3ff] text-[#172033]">
      <header className="border-b border-[#d8e1f5] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <a href="/" className="flex items-center gap-3">
            <img
              className="h-11 w-11 rounded-full border border-[#d8e1f5] object-contain p-1"
              src="/loyola-crest.jpg"
              alt=""
            />
            <span>
              <span className="block font-serif text-xl font-bold text-navy">Loyola Portal</span>
              <span className="block text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Digital Platform
              </span>
            </span>
          </a>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold">{auth.user.name}</p>
              <p className="text-xs uppercase text-muted-foreground">{roleLabel(auth.user.role)}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="grid h-10 w-10 place-items-center rounded border border-[#d8e1f5] text-navy"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-2 animate-fade-in-up">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-crimson">
            Welcome, {auth.user.name}
          </p>
          <h1 className="font-serif text-4xl font-bold text-navy">Available Apps</h1>
          <span className="mt-3 inline-flex w-fit rounded-full border border-[#d8e1f5] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-navy">
            {roleLabel(auth.user.role)}
          </span>
        </div>

        <div className="stagger-children mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;
            const allowed = module.roles.includes(auth.user!.role);
            return allowed ? (
              <a
                key={module.href}
                href={module.href}
                className="group hover-lift rounded-lg border border-[#d8e1f5] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#a9bce7] hover:shadow-md"
              >
                <span className="grid h-11 w-11 place-items-center rounded bg-[#08286f] text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-5 block font-serif text-2xl font-bold text-navy">
                  {module.title}
                </span>
                <span className="mt-2 block text-sm text-muted-foreground">{module.meta}</span>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-crimson">
                  Open <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </a>
            ) : (
              <div
                key={module.href}
                className="rounded-lg border border-[#d8e1f5] bg-white/70 p-5 opacity-75 shadow-sm animate-fade-in-up"
              >
                <span className="grid h-11 w-11 place-items-center rounded bg-slate-200 text-slate-500">
                  <Lock className="h-5 w-5" />
                </span>
                <span className="mt-5 block font-serif text-2xl font-bold text-slate-500">
                  {module.title}
                </span>
                <span className="mt-2 block text-sm text-muted-foreground">
                  {module.lockedMeta}
                </span>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-400">
                  Locked
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

type EduTrackRow = Record<string, any>;

type EduTrackDashboard = {
  totalItems: number;
  completedItems: number;
  completionPercent: number;
  bySubject: EduTrackRow[];
  byTeacher?: EduTrackRow[];
};

function EduTrackIntegratedPage() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "terms" | "syllabus" | "progress" | "warnings"
  >("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [terms, setTerms] = useState<EduTrackRow[]>([]);
  const [subjects, setSubjects] = useState<EduTrackRow[]>([]);
  const [teachers, setTeachers] = useState<EduTrackRow[]>([]);
  const [syllabus, setSyllabus] = useState<EduTrackRow[]>([]);
  const [progress, setProgress] = useState<EduTrackRow[]>([]);
  const [warnings, setWarnings] = useState<EduTrackRow[]>([]);
  const [dashboard, setDashboard] = useState<EduTrackDashboard>({
    totalItems: 0,
    completedItems: 0,
    completionPercent: 0,
    bySubject: [],
  });
  const [termForm, setTermForm] = useState({
    level: "Upper",
    term_name: "Term 1",
    start_date: "",
    end_date: "",
    warning_threshold: 80,
    status: "Active",
  });
  const [subjectForm, setSubjectForm] = useState({
    name: "",
    grade: "10",
    section: "A",
    teacher_id: "",
  });
  const [syllabusForm, setSyllabusForm] = useState({
    subject_id: "",
    grade: "10",
    title: "",
    description: "",
    term_id: "",
  });
  const [progressForm, setProgressForm] = useState({
    teacher_id: "",
    subject_id: "",
    syllabus_item_id: "",
    status: "completed",
    note: "",
  });

  useEffect(() => {
    if (!auth.loading && !auth.user) window.location.href = "/login";
  }, [auth.loading, auth.user]);

  const allowed: Role[] = EDUTRACK_ROLES;

  const apiJson = async (path: string, options: RequestInit = {}) => {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: authHeaders({ "Content-Type": "application/json", ...(options.headers || {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed: ${path}`);
    return data;
  };

  const loadEduTrack = async () => {
    if (!auth.user) return;
    setLoading(true);
    setError("");
    try {
      const [
        termsData,
        subjectsData,
        teachersData,
        syllabusData,
        progressData,
        warningsData,
        dashData,
      ] = await Promise.all([
        apiJson("/api/edutrack/terms"),
        apiJson("/api/subjects").catch(() => []),
        apiJson("/api/teachers"),
        apiJson("/api/edutrack/syllabus"),
        apiJson("/api/edutrack/progress"),
        apiJson("/api/edutrack/warnings"),
        apiJson("/api/edutrack/dashboard"),
      ]);
      setTerms(Array.isArray(termsData) ? termsData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      setTeachers(Array.isArray(teachersData) ? teachersData : []);
      setSyllabus(Array.isArray(syllabusData) ? syllabusData : []);
      setProgress(Array.isArray(progressData) ? progressData : []);
      setWarnings(Array.isArray(warningsData) ? warningsData : []);
      setDashboard(
        dashData || { totalItems: 0, completedItems: 0, completionPercent: 0, bySubject: [] },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load EduTrack data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth.loading && auth.user && allowed.includes(auth.user.role)) void loadEduTrack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.user?.id]);

  useEffect(() => {
    const currentUser = auth.user;
    if (!auth.loading && currentUser?.role === "teacher") {
      setProgressForm((current) =>
        current.teacher_id === currentUser.id ? current : { ...current, teacher_id: currentUser.id },
      );
    }
  }, [auth.loading, auth.user?.id, auth.user?.role]);

  if (auth.loading || !auth.user) {
    return <BrandedLoader title="Opening EduTrack" subtitle="Checking your session" />;
  }

  if (!allowed.includes(auth.user.role)) {
    window.location.href = "/portal";
    return (
      <BrandedLoader title="Returning to portal" subtitle="EduTrack is not enabled for this role" />
    );
  }

  const currentUser = auth.user;
  const isAdmin = EDUZYNC_ADMIN_ROLES.includes(currentUser.role);

  const submitTerm = async (event: React.FormEvent) => {
    event.preventDefault();
    await apiJson("/api/edutrack/terms", { method: "POST", body: JSON.stringify(termForm) });
    setTermForm({
      level: "Upper",
      term_name: "Term 1",
      start_date: "",
      end_date: "",
      warning_threshold: 80,
      status: "Active",
    });
    await loadEduTrack();
  };

  const submitSubject = async (event: React.FormEvent) => {
    event.preventDefault();
    await apiJson("/api/subjects", { method: "POST", body: JSON.stringify(subjectForm) });
    setSubjectForm({ name: "", grade: "10", section: "A", teacher_id: "" });
    await loadEduTrack();
  };

  const submitSyllabus = async (event: React.FormEvent) => {
    event.preventDefault();
    await apiJson("/api/edutrack/syllabus", { method: "POST", body: JSON.stringify(syllabusForm) });
    setSyllabusForm({ subject_id: "", grade: "10", title: "", description: "", term_id: "" });
    await loadEduTrack();
  };

  const submitProgress = async (event: React.FormEvent) => {
    event.preventDefault();
    const teacherId = currentUser.role === "teacher" ? currentUser.id : progressForm.teacher_id;
    await apiJson("/api/edutrack/progress", {
      method: "POST",
      body: JSON.stringify({ ...progressForm, teacher_id: teacherId }),
    });
    setProgressForm({
      teacher_id: currentUser.role === "teacher" ? currentUser.id : "",
      subject_id: "",
      syllabus_item_id: "",
      status: "completed",
      note: "",
    });
    await loadEduTrack();
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: Award },
    { id: "terms", label: "Terms", icon: Calendar },
    { id: "syllabus", label: "Syllabus", icon: BookOpen },
    { id: "progress", label: "Progress", icon: CheckCircle2 },
    { id: "warnings", label: "Warnings", icon: Bell },
  ] as const;

  const completionPercent = Math.min(100, Math.max(0, Number(dashboard.completionPercent || 0)));
  const completedItems = Number(dashboard.completedItems || 0);
  const totalItems = Number(dashboard.totalItems || 0);
  const selectedTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const selectedSyllabus = progressForm.subject_id
    ? syllabus.filter((item) => String(item.subject_id || "") === String(progressForm.subject_id))
    : syllabus;
  const teacherDisplayName =
    teachers.find((teacher) => String(teacher.id) === String(progressForm.teacher_id || currentUser.id))
      ?.name || currentUser.name;
  const workspaceMode = isAdmin ? "Admin workspace" : "Teacher workspace";

  const inputClass =
    "w-full rounded-md border border-[#cfd8e7] bg-white px-3 py-2.5 text-sm text-[#172033] outline-none placeholder:text-slate-400 focus:border-[#08286f] focus:ring-2 focus:ring-[#08286f]/15";
  const labelClass = "text-xs font-bold uppercase text-slate-500";
  const primaryButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-md bg-[#08286f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0a347f]";
  const secondaryButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-md border border-[#cfd8e7] bg-white px-4 py-2.5 text-sm font-bold text-[#172033] transition hover:border-[#a9bce7] hover:bg-[#f8fbff]";

  return (
    <main className="min-h-screen bg-[#f3f6fb] text-[#172033]">
      <header className="border-b border-[#d8e1f5] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <a
              href="/portal"
              className="inline-flex h-10 items-center gap-1 rounded-md border border-[#d8e1f5] bg-white px-3 text-sm font-bold text-navy hover:bg-[#f7faff]"
            >
              <ChevronLeft className="h-4 w-4" />
              Portal
            </a>
            <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-md bg-[#08286f] text-white sm:grid">
              <BookOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-crimson">EduTrack</p>
              <h1 className="truncate font-serif text-2xl font-bold text-navy">
                Academic Tracking
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a href="/portal/edutrack" className={secondaryButtonClass}>
              Full workspace
              <ArrowRight className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => void loadEduTrack()}
              className={secondaryButtonClass}
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.5fr)]">
          <div className="rounded-lg border border-[#d8e1f5] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-crimson">{workspaceMode}</p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-navy">
              Simple tracking for daily school work
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Teachers update covered topics. Admins manage terms, subjects, syllabus, and warnings.
            </p>
          </div>
          <div className="rounded-lg border border-[#d8e1f5] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Signed in</p>
            <p className="mt-2 truncate text-lg font-bold text-navy">{auth.user.name}</p>
            <p className="mt-1 text-sm text-slate-600">{roleLabel(auth.user.role)}</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <EduMetricCard
            icon={Award}
            label="Coverage"
            value={`${completionPercent}%`}
            helper="Overall"
            tone="blue"
          />
          <EduMetricCard
            icon={Calendar}
            label="Terms"
            value={String(terms.length)}
            helper="Active records"
            tone="navy"
          />
          <EduMetricCard
            icon={CheckCircle2}
            label="Completed"
            value={`${completedItems}/${totalItems}`}
            helper="Topics"
            tone="green"
          />
          <EduMetricCard
            icon={Bell}
            label="Warnings"
            value={String(warnings.length)}
            helper="Below threshold"
            tone="amber"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2 rounded-lg border border-[#d8e1f5] bg-white p-2 shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold transition ${activeTab === tab.id ? "bg-[#08286f] text-white" : "text-slate-700 hover:bg-[#eef3ff] hover:text-navy"}`}
              >
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => void loadEduTrack()}
            className="ml-auto rounded-md border border-[#cfd8e7] px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-[#f8fbff]"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-5 rounded-lg border border-[#d8e1f5] bg-white p-10 text-center text-sm font-semibold text-slate-500 shadow-sm">
            Loading EduTrack data...
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-lg border border-[#d8e1f5] bg-white p-5 shadow-sm">
              {activeTab === "dashboard" && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-crimson">Overview</p>
                      <h2 className="mt-1 font-serif text-2xl font-bold text-navy">
                        Subject coverage
                      </h2>
                    </div>
                    <span className="rounded-md bg-[#eef3ff] px-3 py-1 text-xs font-bold text-navy">
                      {completionPercent}% complete
                    </span>
                  </div>
                  <div className="mt-6 grid gap-3">
                    {(dashboard.bySubject || []).length === 0 && (
                      <EmptyState
                        title="No subject progress yet"
                        description="Progress appears here after syllabus items are updated."
                      />
                    )}
                    {(dashboard.bySubject || []).map((row: EduTrackRow) => (
                      <ProgressSubjectRow key={row.subject_id || row.subject_name} row={row} />
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "terms" && (
                <DataList
                  title="Academic terms"
                  empty="No academic terms yet."
                >
                  {terms.map((term) => (
                    <InfoRow
                      key={term.id}
                      title={`${term.level || "Level"} - ${term.term_name || "Term"}`}
                      meta={`${term.start_date || "No start"} to ${term.end_date || "No end"}`}
                      badge={`${term.warning_threshold || 80}% threshold`}
                    />
                  ))}
                </DataList>
              )}

              {activeTab === "syllabus" && (
                <DataList
                  title="Syllabus items"
                  empty="No syllabus items yet."
                >
                  {syllabus.map((item) => (
                    <InfoRow
                      key={item.id}
                      title={item.title || "Syllabus item"}
                      meta={`${item.subject_name || "No subject"} - Grade ${item.grade || "-"}`}
                      badge={item.term_name || "No term"}
                    />
                  ))}
                </DataList>
              )}

              {activeTab === "progress" && (
                <DataList
                  title="Progress log"
                  empty="No progress records yet."
                >
                  {progress.map((item) => (
                    <InfoRow
                      key={item.id}
                      title={item.syllabus_title || "Progress record"}
                      meta={`${item.subject_name || "Subject"} - ${item.teacher_name || item.teacher_id || "Teacher"}`}
                      badge={item.status || "Updated"}
                    />
                  ))}
                </DataList>
              )}

              {activeTab === "warnings" && (
                <DataList
                  title="Warning log"
                  empty="No warnings right now."
                >
                  {warnings.map((item) => (
                    <InfoRow
                      key={`${item.term_id}-${item.subject_id}`}
                      title={item.subject_name || "Subject"}
                      meta={`${item.term_name || "Term"} is at ${item.completionPercent || 0}%`}
                      badge={`Below ${item.warning_threshold || 80}%`}
                      warning
                    />
                  ))}
                </DataList>
              )}
            </div>

            <aside className="rounded-lg border border-[#d8e1f5] bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-crimson">Action</p>
              <h3 className="mt-1 font-serif text-xl font-bold text-navy">
                {activeTab === "dashboard" ? "Choose work" : selectedTab.label}
              </h3>
              {!isAdmin && (
                <p className="mt-4 rounded-md border border-[#d8e1f5] bg-[#f7faff] p-3 text-sm text-slate-600">
                  Teachers can update progress. Admin can create terms and syllabus.
                </p>
              )}

              {isAdmin && activeTab === "terms" && (
                <form onSubmit={submitTerm} className="mt-5 grid gap-3">
                  <label className={labelClass}>Level</label>
                  <select
                    className={inputClass}
                    value={termForm.level}
                    onChange={(e) => setTermForm({ ...termForm, level: e.target.value })}
                  >
                    {["Primary", "Middle", "Upper", "A/L"].map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                  <label className={labelClass}>Term name</label>
                  <input
                    className={inputClass}
                    value={termForm.term_name}
                    onChange={(e) => setTermForm({ ...termForm, term_name: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      className={inputClass}
                      value={termForm.start_date}
                      onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
                    />
                    <input
                      type="date"
                      className={inputClass}
                      value={termForm.end_date}
                      onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
                    />
                  </div>
                  <label className={labelClass}>Warning threshold</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className={inputClass}
                    value={termForm.warning_threshold}
                    onChange={(e) =>
                      setTermForm({
                        ...termForm,
                        warning_threshold: Number(e.target.value),
                      })
                    }
                  />
                  <button className={primaryButtonClass}>Save term</button>
                </form>
              )}
              {!isAdmin && activeTab === "terms" && (
                <ReadOnlyPanel title="Terms are managed by EduTrack admins." />
              )}

              {isAdmin && activeTab === "syllabus" && (
                <div className="mt-5 space-y-5">
                  <form
                    onSubmit={submitSubject}
                    className="grid gap-3"
                  >
                    <p className="font-bold text-navy">Add subject</p>
                    <input
                      className={inputClass}
                      placeholder="Subject name"
                      value={subjectForm.name}
                      onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                      required
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        className={inputClass}
                        placeholder="Grade"
                        value={subjectForm.grade}
                        onChange={(e) => setSubjectForm({ ...subjectForm, grade: e.target.value })}
                      />
                      <input
                        className={inputClass}
                        placeholder="Section"
                        value={subjectForm.section}
                        onChange={(e) =>
                          setSubjectForm({ ...subjectForm, section: e.target.value })
                        }
                      />
                    </div>
                    <select
                      className={inputClass}
                      value={subjectForm.teacher_id}
                      onChange={(e) =>
                        setSubjectForm({ ...subjectForm, teacher_id: e.target.value })
                      }
                    >
                      <option value="">Assign teacher later</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </option>
                      ))}
                    </select>
                    <button className={secondaryButtonClass}>Add subject</button>
                  </form>
                  <div className="h-px bg-[#d8e1f5]" />
                  <form
                    onSubmit={submitSyllabus}
                    className="grid gap-3"
                  >
                    <p className="font-bold text-navy">Add syllabus item</p>
                    <select
                      className={inputClass}
                      value={syllabusForm.subject_id}
                      onChange={(e) =>
                        setSyllabusForm({ ...syllabusForm, subject_id: e.target.value })
                      }
                      required
                    >
                      <option value="">Select subject</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className={inputClass}
                      value={syllabusForm.term_id}
                      onChange={(e) =>
                        setSyllabusForm({ ...syllabusForm, term_id: e.target.value })
                      }
                    >
                      <option value="">Select term</option>
                      {terms.map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.level} - {term.term_name}
                        </option>
                      ))}
                    </select>
                    <input
                      className={inputClass}
                      placeholder="Grade"
                      value={syllabusForm.grade}
                      onChange={(e) => setSyllabusForm({ ...syllabusForm, grade: e.target.value })}
                    />
                    <input
                      className={inputClass}
                      placeholder="Topic title"
                      value={syllabusForm.title}
                      onChange={(e) => setSyllabusForm({ ...syllabusForm, title: e.target.value })}
                      required
                    />
                    <textarea
                      className={inputClass}
                      placeholder="Description"
                      value={syllabusForm.description}
                      onChange={(e) =>
                        setSyllabusForm({ ...syllabusForm, description: e.target.value })
                      }
                    />
                    <button className={primaryButtonClass}>Save syllabus</button>
                  </form>
                </div>
              )}
              {!isAdmin && activeTab === "syllabus" && (
                <ReadOnlyPanel title="Syllabus is managed by EduTrack admins." />
              )}

              {activeTab === "progress" && (
                <form onSubmit={submitProgress} className="mt-5 grid gap-3">
                  {isAdmin ? (
                    <select
                      className={inputClass}
                      value={progressForm.teacher_id}
                      onChange={(e) =>
                        setProgressForm({ ...progressForm, teacher_id: e.target.value })
                      }
                      required
                    >
                      <option value="">Select teacher</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-md border border-[#d8e1f5] bg-[#f7faff] px-3 py-2 text-sm text-slate-700">
                      <span className="block text-xs font-bold uppercase text-slate-500">
                        Teacher
                      </span>
                      <strong className="text-navy">{teacherDisplayName}</strong>
                    </div>
                  )}
                  <select
                    className={inputClass}
                    value={progressForm.subject_id}
                    onChange={(e) =>
                      setProgressForm({
                        ...progressForm,
                        subject_id: e.target.value,
                        syllabus_item_id: "",
                      })
                    }
                    required
                  >
                    <option value="">Select subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputClass}
                    value={progressForm.syllabus_item_id}
                    onChange={(e) =>
                      setProgressForm({ ...progressForm, syllabus_item_id: e.target.value })
                    }
                    required
                  >
                    <option value="">Select syllabus item</option>
                    {selectedSyllabus.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputClass}
                    value={progressForm.status}
                    onChange={(e) => setProgressForm({ ...progressForm, status: e.target.value })}
                  >
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                  </select>
                  <textarea
                    className={inputClass}
                    placeholder="Note"
                    value={progressForm.note}
                    onChange={(e) => setProgressForm({ ...progressForm, note: e.target.value })}
                  />
                  <button className={primaryButtonClass}>Save progress</button>
                </form>
              )}

              {activeTab === "dashboard" && (
                <div className="mt-5 grid gap-3">
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveTab("terms")}
                        className={primaryButtonClass}
                      >
                        Manage terms
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("syllabus")}
                        className={secondaryButtonClass}
                      >
                        Manage syllabus
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab("progress")}
                    className={isAdmin ? secondaryButtonClass : primaryButtonClass}
                  >
                    Update progress
                  </button>
                </div>
              )}
              {activeTab === "warnings" && (
                <div className="mt-5 grid gap-3">
                  <ReadOnlyPanel title="Warnings show subjects below the term threshold." />
                  <a href="/portal/edutrack" className={secondaryButtonClass}>
                    Open reports
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              )}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

function EmptyState({
  title,
  description = "No records available yet.",
  action,
  onAction,
}: {
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#cfd8e7] bg-[#f7faff] p-8 text-center">
      <p className="font-serif text-2xl font-bold text-navy">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-md bg-[#08286f] px-4 py-2.5 text-sm font-bold text-white"
        >
          {action}
        </button>
      )}
    </div>
  );
}

function DataList({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div>
      <h2 className="font-serif text-2xl font-bold text-navy">{title}</h2>
      <div className="mt-5 grid gap-3">{hasItems ? children : <EmptyState title={empty} />}</div>
    </div>
  );
}

function InfoRow({
  title,
  meta,
  badge,
  warning = false,
}: {
  title: string;
  meta: string;
  badge?: string;
  warning?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d8e1f5] bg-white p-4 shadow-sm">
      <div>
        <p className="font-bold text-navy">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{meta}</p>
      </div>
      {badge && (
        <span
          className={`rounded-md px-3 py-1 text-xs font-bold ${warning ? "bg-amber-100 text-amber-800" : "bg-[#eef3ff] text-navy"}`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function EduMetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper: string;
  tone: "blue" | "navy" | "green" | "amber";
}) {
  const toneClass = {
    blue: "bg-[#e8f3ff] text-[#075985]",
    navy: "bg-[#eef3ff] text-navy",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone];

  return (
    <div className="rounded-lg border border-[#d8e1f5] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-md ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold text-navy">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>
    </div>
  );
}

function ProgressSubjectRow({ row }: { row: EduTrackRow }) {
  const percent = Math.min(100, Math.max(0, Number(row.completionPercent || 0)));

  return (
    <div className="rounded-lg border border-[#d8e1f5] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-navy">{row.subject_name || "Subject"}</p>
        <p className="text-sm font-bold text-[#075985]">{percent}%</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5edf7]">
        <div className="h-full rounded-full bg-[#0ea5e9]" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {row.completed_items || 0} of {row.total_items || 0} items completed
      </p>
    </div>
  );
}

function ReadOnlyPanel({ title }: { title: string }) {
  return (
    <div className="mt-5 rounded-md border border-[#d8e1f5] bg-[#f7faff] p-3 text-sm font-semibold text-slate-600">
      {title}
    </div>
  );
}

function EduTrackRuntimePage() {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.user) window.location.href = "/login";
  }, [auth.loading, auth.user]);

  if (auth.loading || !auth.user) {
    return <BrandedLoader title="Opening EduTrack" subtitle="Checking your session" />;
  }

  if (!EDUTRACK_ROLES.includes(auth.user.role)) {
    return (
      <AccessDeniedPage message="EduTrack is available for Master Admin, Super Admin, EduTrack Admin, and Teacher accounts." />
    );
  }

  return (
    <main className="h-screen min-h-[100dvh] w-full overflow-hidden bg-[#081324]">
      <iframe
        title="EduTrack"
        src="/edutrack/"
        className="h-full w-full border-0"
        allow="clipboard-read; clipboard-write"
      />
    </main>
  );
}

function ModulePage({ moduleId }: { moduleId: string }) {
  const auth = useAuth();

  useEffect(() => {
    if (moduleId === "edutrack") return;
    if (!auth.loading && !auth.user) window.location.href = "/login";
  }, [auth.loading, auth.user, moduleId]);

  if (moduleId === "edutrack") return <EduTrackRuntimePage />;

  if (auth.loading || !auth.user) {
    return <BrandedLoader title="Opening module" subtitle="Checking your session" />;
  }

  const modules: Record<
    string,
    {
      title: string;
      icon: React.ComponentType<{ className?: string }>;
      roles: Role[];
      actions: { label: string; href: string }[];
    }
  > = {
    eduzync: {
      title: "EduZync",
      icon: Users,
      roles: EDUZYNC_ADMIN_ROLES,
      actions: [
        { label: "Students", href: "/portal/eduzync?tab=students" },
        { label: "Teachers", href: "/portal/eduzync?tab=teachers" },
        { label: "Classes", href: "/portal/eduzync?tab=classes" },
        { label: "Subjects", href: "/portal/eduzync?tab=subjects" },
      ],
    },
    edutrack: {
      title: "EduTrack",
      icon: BookOpen,
      roles: EDUTRACK_ROLES,
      actions: [
        { label: "Terms", href: "/portal/edutrack?tab=terms" },
        { label: "Syllabus", href: "/portal/edutrack?tab=syllabus" },
        { label: "Progress", href: "/portal/edutrack?tab=progress" },
        { label: "Warnings", href: "/portal/edutrack?tab=warnings" },
      ],
    },
    elms: {
      title: "ELMS",
      icon: GraduationCap,
      roles: ELMS_ROLES,
      actions: [
        { label: "Courses", href: "/portal/elms?tab=courses" },
        { label: "Lessons", href: "/portal/elms?tab=lessons" },
        { label: "Assignments", href: "/portal/elms?tab=assignments" },
      ],
    },
    reports: {
      title: "Report Cards",
      icon: FileText,
      roles: REPORT_CARD_ROLES,
      actions: [
        { label: "Open Report Card System", href: REPORT_CARDS_SYSTEM_URL },
      ],
    },
  };
  const module = modules[moduleId] || modules.eduzync;
  if (!module.roles.includes(auth.user.role)) {
    return (
      <AccessDeniedPage
        message={`${module.title} is not enabled for ${roleLabel(auth.user.role)} accounts.`}
      />
    );
  }
  const Icon = module.icon;

  return (
    <main className="min-h-screen bg-[#eef3ff] text-[#172033]">
      <header className="border-b border-[#d8e1f5] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/portal" className="inline-flex items-center gap-2 text-sm font-bold text-navy">
            <ChevronLeft className="h-4 w-4" /> Portal
          </a>
          <p className="text-sm font-bold text-muted-foreground">{auth.user.name}</p>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded bg-[#08286f] text-white">
            <Icon className="h-7 w-7" />
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-crimson">
              Loyola Digital Platform
            </p>
            <h1 className="font-serif text-4xl font-bold text-navy">{module.title}</h1>
          </div>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {module.actions.map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="rounded-lg border border-[#d8e1f5] bg-white px-5 py-4 text-sm font-bold text-navy shadow-sm hover:border-[#a9bce7]"
            >
              {action.label}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

function StaffPortalRedirect() {
  useEffect(() => {
    window.location.href = "/staff";
  }, []);
  return <BrandedLoader title="Opening staff system" subtitle="Loading staff management" />;
}

function PortalRouter({ role }: { role: Role }) {
  const loading = <BrandedLoader title="Opening portal" subtitle="Loading your Loyola workspace" />;
  const portals: Partial<Record<Role, React.ReactNode>> = {
    student: <StudentPortal />,
    parent: <ParentPortal />,
    teacher: <TeacherPortal />,
    website_admin: <AdminPortal />,
    eduzync_admin: <ModulePage moduleId="eduzync" />,
    master_edutrack_admin: <ModulePage moduleId="edutrack" />,
    staff_admin: <StaffPortalRedirect />,
    superadmin: <AdminPortal />,
    masteradmin: <AdminPortal />,
  };
  return <Suspense fallback={loading}>{portals[role] || <LoginPage />}</Suspense>;
}

function NewsAndEventsPreview() {
  const db = useDb();
  return (
    <section className="border-y border-border bg-white py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-4xl font-bold text-navy">News & notices</h2>
            <a href="/news" className="text-sm font-bold text-crimson">
              All news
            </a>
          </div>
          <div className="mt-6 grid gap-4">
            {db.news.slice(0, 2).map((item) => (
              <NewsCard key={item.id} item={item} compact />
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-4xl font-bold text-navy">Upcoming events</h2>
            <a href="/events" className="text-sm font-bold text-crimson">
              All events
            </a>
          </div>
          <div className="mt-6 grid gap-4">
            {db.events.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function GoogleCalendarFrame({
  title,
  mode,
  className,
}: {
  title: string;
  mode: "MONTH" | "AGENDA";
  className: string;
}) {
  return (
    <iframe
      title={title}
      src={googleCalendarEmbedUrl(mode)}
      loading="lazy"
      className={`w-full border-0 ${className}`}
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

function NewsCard({
  item,
  compact = false,
}: {
  item: { title: string; date: string; body: string; audience: string; image?: string };
  compact?: boolean;
}) {
  return (
    <article
      className={`rounded-lg border border-border bg-white shadow-soft ${compact ? "grid grid-cols-[120px_1fr]" : ""}`}
    >
      {item.image && (
        <img
          src={item.image}
          alt=""
          className={`${compact ? "h-full min-h-32 rounded-l-lg" : "aspect-[16/10] rounded-t-lg"} w-full object-cover`}
        />
      )}
      <div className="p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-crimson">
          {item.audience} | {item.date}
        </p>
        <h3 className="mt-3 text-lg font-bold leading-snug text-ink">{item.title}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {item.body}
        </p>
      </div>
    </article>
  );
}

function EventCard({
  event,
  compact = false,
}: {
  event: { title: string; date: string; location: string; type: string };
  compact?: boolean;
}) {
  const date = new Date(event.date);
  return (
    <article
      className={`rounded-lg border border-border bg-white p-5 shadow-soft ${compact ? "grid grid-cols-[70px_1fr] gap-4" : ""}`}
    >
      <div>
        <p className="font-serif text-3xl font-bold text-navy">{date.getDate()}</p>
        <p className="mt-1 inline-block rounded bg-crimson px-2 py-1 text-xs font-bold uppercase text-white">
          {date.toLocaleString("en", { month: "short" })}
        </p>
      </div>
      <div>
        <h3 className="font-bold text-ink">{event.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {event.location} | {event.type}
        </p>
      </div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-5 block">
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function NotFoundPage() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-5xl font-bold text-navy">Page not found</h1>
        <p className="mt-4 text-muted-foreground">The page you opened does not exist.</p>
        <a
          href="/"
          className="mt-8 inline-flex rounded-lg bg-navy px-6 py-3 text-sm font-bold text-white"
        >
          Go home
        </a>
      </section>
    </PublicLayout>
  );
}
