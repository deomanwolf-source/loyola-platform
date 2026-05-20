// Local drafts are kept in localStorage; published content is written to MySQL through the backend API.
import { useEffect, useState, useSyncExternalStore } from "react";
import { API_URL, authHeaders, loginUser } from "./api";

export const DEFAULT_ANTHEM_VIDEO_URL = "https://youtu.be/0X2iA064w9k";
export const DEFAULT_HERO_IMAGE = "/flag1.png";
export const DEFAULT_MAP_URL = "https://maps.app.goo.gl/SbvARKozMPQTve388";
export const DEFAULT_MAP_EMBED_URL =
  "https://www.google.com/maps?q=Loyola%20College%20Negombo%2C%20Sri%20Lanka&output=embed";
const BUNDLED_STATIC_ASSETS = new Set(["/flag1.png", "/loyola-crest.jpg"]);

export type Role =
  | "masteradmin"
  | "superadmin"
  | "website_admin"
  | "eduzync_admin"
  | "teacher"
  | "student"
  | "parent";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  password?: string;
}
export interface NavItem {
  id: string;
  label: string;
  order: number;
  visible: boolean;
  parentId?: string;
}
export interface NewsItem {
  id: string;
  title: string;
  date: string;
  body: string;
  audience: string;
  image?: string;
}
export interface EventItem {
  id: string;
  title: string;
  date: string;
  location: string;
  type: string;
}
export interface GalleryItem {
  id: string;
  label: string;
  image: string;
  images?: string[];
  videos?: GalleryVideo[];
  description?: string;
  link?: string;
  visible?: boolean;
}
export interface GalleryVideo {
  id: string;
  name: string;
  url: string;
  webmUrl?: string;
  size: number;
  durationSeconds?: number | null;
  uploadedAt: string;
  source?: "upload" | "youtube";
  mediaType?: "short_video_upload" | "youtube_video";
  thumbnail?: string;
}
export interface VideoGalleryItem {
  id: string;
  label: string;
  coverImage?: string;
  videos: GalleryVideo[];
  description?: string;
  link?: string;
  visible?: boolean;
}
export interface HomeStat {
  id: string;
  label: string;
  value: string;
}
export interface HomePillar {
  id: string;
  title: string;
  body: string;
  icon: string;
}
export interface AdmissionStep {
  id: string;
  number: string;
  title: string;
  body: string;
}
export interface AboutStat {
  id: string;
  label: string;
  value: string;
}
export interface DepartmentCard {
  id: string;
  name: string;
  body: string;
  count: string;
}
export interface LoginRoleContent {
  id: Role;
  label: string;
  desc: string;
}
export interface AutomationSettings {
  themeApplied?: boolean;
  autoSeo: boolean;
  autoSortNews: boolean;
  autoSortEvents: boolean;
  autoSyncNavigation: boolean;
  autoFillEmptyPageDescriptions: boolean;
  showMissingContentWarnings: boolean;
  lastRun?: string;
  lastReport?: string;
}
export interface Student {
  id: string;
  name: string;
  grade: string;
  section: string;
  attendance: number;
  guardian?: string;
}
export interface Teacher {
  id: string;
  name: string;
  subject: string;
  classes: string;
  status: string;
  image?: string;
  type?: string;
  category?: string;
  qualifications?: string;
  responsibilities?: string;
  section?: string;
  position?: string;
  accountEmail?: string;
  accountUserId?: string;
  accountStatus?: string;
}
export interface Parent {
  id: string;
  name: string;
  phone: string;
  children: string;
  status: string;
}
export interface ClassRow {
  id: string;
  className: string;
  section: string;
  teacher: string;
  students: number;
}
export interface Subject {
  id: string;
  name: string;
  grade: string;
  department: string;
}
export interface Fee {
  id: string;
  student: string;
  term: string;
  amount: number;
  status: string;
}
export interface Assignment {
  id: string;
  title: string;
  className: string;
  due: string;
  status: string;
}
export interface Book {
  id: string;
  title: string;
  author: string;
  status: string;
}
export interface TransportRow {
  id: string;
  route: string;
  bus: string;
  driver: string;
  stop: string;
}
export interface Message {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
}
export interface Admission {
  id: string;
  childName: string;
  grade: string;
  parentName: string;
  email: string;
  phone: string;
  status: string;
  createdAt: string;
}
export interface DownloadItem {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  fileUrl: string;
  date: string;
}
export interface AuditLog {
  id: string;
  user: string;
  action: string;
  createdAt: string;
  actorEmail?: string;
  actorName?: string;
  actorRole?: Role;
  area?: string;
}

export type PageBlockType = "text" | "hero" | "image-text" | "quote" | "gallery" | "spacer";
export interface PageBlock {
  id: string;
  type: PageBlockType;
  content: {
    kicker?: string;
    title?: string;
    body?: string;
    image?: string;
    quote?: string;
    author?: string;
    align?: "left" | "right" | "center";
  };
}

export interface DB {
  contentVersion: number;
  publishedAt: string;
  websiteContent: {
    schoolName: string;
    tagline: string;
    address: string;
    phone: string;
    email: string;
    heroTitle: string;
    heroEyebrow: string;
    heroText: string;
    heroImage: string;
    backgroundMediaUrl: string;
    backgroundMediaType: "image" | "video" | "";
    backgroundMediaOpacity: number;
    primaryColor: string;
    accentColor: string;
    logoText: string;
    logoImage: string;
    headerApplyLabel: string;
    headerSignInLabel: string;
    footerText: string;
    footerLegalLine: string;
    customCss: string;
    socials: {
      facebook: string;
      instagram: string;
      youtube: string;
      linkedin: string;
      whatsapp: string;
    };
    seo: { metaTitle: string; metaDescription: string; ogImage: string };
    anthemVideoUrl: string;
    anthemVideoCoverImage: string;
    officeHours: string;
    mapUrl: string;
    mapEmbedUrl: string;
  };
  navigation: NavItem[];
  pages: Record<
    string,
    {
      kicker?: string;
      eyebrow?: string;
      title?: string;
      welcomeTitle?: string;
      body?: string;
      image?: string;
      backgroundMediaUrl?: string;
      backgroundMediaType?: "image" | "video" | "";
      backgroundMediaOpacity?: number;
      anthemVideoCoverImage?: string;
      anthemVideoUrl?: string;
      anthemVideoTitle?: string;
      blocks?: PageBlock[];
      visualHtml?: string;
      visualCss?: string;
    }
  >;
  homeSections: {
    approachKicker: string;
    approachTitle: string;
    approachBody: string;
    campusKicker: string;
    campusTitle: string;
    campusBody: string;
    newsKicker: string;
    newsTitle: string;
    eventsKicker: string;
    eventsTitle: string;
    admissionsCtaKicker: string;
    admissionsCtaTitle: string;
    admissionsCtaButton: string;
    stats: HomeStat[];
    pillars: HomePillar[];
  };
  aboutSections: {
    storyKicker: string;
    storyTitle: string;
    storyBodyOne: string;
    storyBodyTwo: string;
    stats: AboutStat[];
    quote: string;
    quoteAuthor: string;
  };
  academicsSections: {
    departments: DepartmentCard[];
    subjectsTitle: string;
    subjectColumnLabel: string;
    gradeColumnLabel: string;
    departmentColumnLabel: string;
    subjectCountLabel: string;
  };
  eventsSections: { galleryKicker: string; galleryTitle: string };
  newsSections: { featuredLabel: string; readArticleLabel: string };
  loginContent: {
    kicker: string;
    title: string;
    body: string;
    backLabel: string;
    welcomeTitle: string;
    welcomeText: string;
    roleSelectLabel: string;
    emailLabel: string;
    emailHint: string;
    emailPlaceholder: string;
    submitLabel: string;
    demoText: string;
    roles: LoginRoleContent[];
  };
  automation: AutomationSettings;
  admissionsSteps: AdmissionStep[];
  forms: {
    admissionsTitle: string;
    admissionsSubmitLabel: string;
    admissionsSuccessTitle: string;
    admissionsSuccessText: string;
    contactTitle: string;
    contactSubmitLabel: string;
    contactSuccessTitle: string;
    contactSuccessText: string;
    contactMapLabel: string;
  };
  media: { campusImage: string; aboutImage: string; principalImage?: string };
  users: User[];
  students: Student[];
  teachers: Teacher[];
  parents: Parent[];
  classes: ClassRow[];
  subjects: Subject[];
  fees: Fee[];
  assignments: Assignment[];
  events: EventItem[];
  news: NewsItem[];
  gallery: GalleryItem[];
  videoGallery: VideoGalleryItem[];
  downloads: DownloadItem[];
  library: Book[];
  transport: TransportRow[];
  admissions: Admission[];
  messages: Message[];
  auditLogs: AuditLog[];
}

export const seed: DB = {
  contentVersion: 1,
  publishedAt: "2026-01-01T00:00:00.000Z",
  websiteContent: {
    schoolName: "Loyola College Negombo",
    tagline: "Veritate Ad Lumen Et Vitam",
    address: "Loyola College, Negombo, Sri Lanka",
    phone: "0312 277 258",
    email: "loyolacollege.negombo@hotmail.com",
    heroEyebrow: "",
    heroTitle: "Loyola College Negombo",
    heroText: "",
    heroImage: "",
    backgroundMediaUrl: "",
    backgroundMediaType: "",
    backgroundMediaOpacity: 0.34,
    primaryColor: "#16085F",
    accentColor: "#A00008",
    logoText: "LC",
    logoImage: "/loyola-crest.jpg",
    headerApplyLabel: "Admissions",
    headerSignInLabel: "Portal Login",
    footerText: "",
    footerLegalLine: "",
    customCss: "",
    socials: { facebook: "", instagram: "", youtube: "", linkedin: "", whatsapp: "" },
    seo: {
      metaTitle: "Loyola College Negombo",
      metaDescription: "",
      ogImage: "",
    },
    anthemVideoUrl: "",
    anthemVideoCoverImage: "",
    officeHours: "",
    mapUrl: DEFAULT_MAP_URL,
    mapEmbedUrl: DEFAULT_MAP_EMBED_URL,
  },
  navigation: [
    { id: "home", label: "Home", order: 1, visible: true },
    { id: "about", label: "About", order: 2, visible: true },
    {
      id: "about/college-administration",
      label: "College Administration",
      order: 1,
      visible: true,
      parentId: "about",
    },
    {
      id: "about/college-staff",
      label: "College Staff",
      order: 2,
      visible: true,
      parentId: "about",
    },
    {
      id: "about/college-anthem-hymn",
      label: "College Anthem & Hymn",
      order: 3,
      visible: true,
      parentId: "about",
    },
    { id: "academics", label: "Academics", order: 3, visible: true },
    { id: "admissions", label: "Admissions", order: 4, visible: true },
    { id: "news", label: "News & Notices", order: 5, visible: true },
    { id: "events", label: "Events", order: 6, visible: true },
    { id: "sports-clubs", label: "Sports & Clubs", order: 7, visible: true },
    { id: "gallery", label: "Gallery", order: 8, visible: true },
    {
      id: "gallery/photo-gallery",
      label: "Photo Gallery",
      order: 1,
      visible: true,
      parentId: "gallery",
    },
    {
      id: "gallery/video-gallery",
      label: "Video Gallery",
      order: 2,
      visible: true,
      parentId: "gallery",
    },
    { id: "downloads", label: "Downloads", order: 9, visible: true },
    { id: "student-portal", label: "Student Portal", order: 10, visible: false },
    { id: "contact", label: "Contact", order: 11, visible: true },
  ],
  pages: {
    home: {
      eyebrow: "Loyola College Negombo",
      welcomeTitle: "",
    },
    about: {
      kicker: "About",
      title: "Faith, learning, discipline, and service.",
      body: "",
    },
    "about/college-staff": {
      kicker: "College Staff",
      title: "College Staff",
      body: "",
    },
    "about/college-administration": {
      kicker: "Governance",
      title: "College Administration",
      body: "",
    },
    "about/college-anthem-hymn": {
      kicker: "College Anthem & Hymn",
      title: "College Anthem & Hymn",
      body: "",
      anthemVideoCoverImage: "",
      anthemVideoUrl: "",
      anthemVideoTitle: "College Anthem & Hymn",
    },
    admissions: {
      kicker: "Admissions",
      title: "Admissions",
      body: "",
    },
    academics: {
      kicker: "Academics",
      title: "Academics",
      body: "",
    },
    events: {
      kicker: "Events",
      title: "Events",
      body: "",
    },
    news: {
      kicker: "News & Notices",
      title: "News & Notices",
      body: "",
    },
    "sports-clubs": {
      kicker: "Sports & Clubs",
      title: "Sports & Clubs",
      body: "",
    },
    gallery: {
      kicker: "Gallery",
      title: "Gallery",
      body: "",
    },
    "gallery/photo-gallery": {
      kicker: "Photo Gallery",
      title: "Photo Gallery",
      body: "",
    },
    "gallery/video-gallery": {
      kicker: "Video Gallery",
      title: "Video Gallery",
      body: "",
    },
    downloads: {
      kicker: "Downloads",
      title: "Downloads",
      body: "",
    },
    "student-portal": {
      kicker: "Student Portal",
      title: "Student Portal",
      body: "",
    },
    contact: { kicker: "Contact", title: "Visit, write, or call us.", body: "" },
  },
  homeSections: {
    approachKicker: "",
    approachTitle: "",
    approachBody: "",
    campusKicker: "",
    campusTitle: "",
    campusBody: "",
    newsKicker: "",
    newsTitle: "News & Notices",
    eventsKicker: "",
    eventsTitle: "Events",
    admissionsCtaKicker: "",
    admissionsCtaTitle: "",
    admissionsCtaButton: "Admissions",
    stats: [],
    pillars: [],
  },
  aboutSections: {
    storyKicker: "",
    storyTitle: "",
    storyBodyOne: "",
    storyBodyTwo: "",
    stats: [],
    quote: "",
    quoteAuthor: "",
  },
  academicsSections: {
    departments: [],
    subjectsTitle: "All subjects",
    subjectColumnLabel: "Subject",
    gradeColumnLabel: "Grade",
    departmentColumnLabel: "Department",
    subjectCountLabel: "subjects",
  },
  eventsSections: {
    galleryKicker: "Campus gallery",
    galleryTitle: "Moments from Loyola",
  },
  newsSections: {
    featuredLabel: "Featured",
    readArticleLabel: "Read article",
  },
  loginContent: {
    kicker: "Portal access",
    title: "Secure sign-in for Loyola College portals.",
    body: "Students, parents, teachers, and Master Admin sign in with assigned credentials.",
    backLabel: "Back to website",
    welcomeTitle: "Welcome back",
    welcomeText: "Enter your assigned username or email and password.",
    roleSelectLabel: "Select role",
    emailLabel: "Email",
    emailHint: "Use the account assigned by the school administrator.",
    emailPlaceholder: "you@school.test",
    submitLabel: "Sign in to portal",
    demoText: "Access is limited to active Loyola College portal accounts.",
    roles: [
      { id: "student", label: "Student", desc: "Schedule, assignments, results" },
      { id: "parent", label: "Parent", desc: "Attendance, fees, messages" },
      { id: "teacher", label: "Teacher", desc: "Classes, grading, planning" },
      { id: "website_admin", label: "Website Admin", desc: "Website, media, news" },
      { id: "eduzync_admin", label: "EduTrack Admin", desc: "EduTrack and school data management" },
      { id: "superadmin", label: "Super Admin", desc: "Full school system access" },
      { id: "masteradmin", label: "Master Admin", desc: "Full system access" },
    ],
  },
  automation: {
    themeApplied: true,
    autoSeo: true,
    autoSortNews: true,
    autoSortEvents: true,
    autoSyncNavigation: true,
    autoFillEmptyPageDescriptions: true,
    showMissingContentWarnings: true,
    lastReport: "Clean site shell ready.",
  },
  admissionsSteps: [],
  forms: {
    admissionsTitle: "Apply for the 2026 academic year",
    admissionsSubmitLabel: "Submit application",
    admissionsSuccessTitle: "Application received",
    admissionsSuccessText: "Our admissions office will contact you within three working days.",
    contactTitle: "Send us a message",
    contactSubmitLabel: "Send message",
    contactSuccessTitle: "Message sent",
    contactSuccessText: "We'll respond within two working days.",
    contactMapLabel: "Campus map",
  },
  media: {
    campusImage: "",
    aboutImage: "",
    principalImage: "",
  },
  users: [
    {
      id: "U004",
      name: "Master Admin",
      email: "deomanwolf@gmail.com",
      role: "masteradmin",
      status: "Active",
      password: "",
    },
  ],
  students: [],
  teachers: [],
  parents: [],
  classes: [],
  subjects: [],
  fees: [],
  assignments: [],
  events: [],
  news: [],
  gallery: [],
  videoGallery: [],
  downloads: [],
  library: [],
  transport: [],
  admissions: [],
  messages: [],
  auditLogs: [],
};

const KEY = "loyola.db.v6";
const LEGACY_KEYS = ["loyola.db.v5", "loyola.db.v4", "loyola.auth.v3"];
const MAX_LOCAL_DB_BYTES = 8_000_000;
const SERVER_SAVE_DELAY_MS = 1400;
const SITE_DB_API = `${API_URL}/api/site-db`;

let publishedCache: DB | null = null;
let draftCache: DB | null = null;
let previewCache: DB | null = null;
const listeners = new Set<() => void>();
let draftPersistTimer: number | null = null;
let serverPersistTimer: number | null = null;
let pendingServerDb: DB | null = null;
let remoteHydrationStarted = false;
let draftWriteVersion = 0;
let publishedWriteVersion = 0;

function persistDraftNow() {
  if (typeof window === "undefined" || !draftCache) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(draftCache));
    return true;
  } catch {
    localStorage.removeItem(KEY);
    return false;
  }
}

function scheduleDraftPersist() {
  if (typeof window === "undefined" || !draftCache) return;
  if (draftPersistTimer) window.clearTimeout(draftPersistTimer);
  draftPersistTimer = window.setTimeout(() => {
    draftPersistTimer = null;
    persistDraftNow();
  }, 120);
}

async function hydrateFromRemoteDb(adoptDraftIfClean = false, force = false) {
  if (typeof window === "undefined" || (!force && remoteHydrationStarted)) return;
  remoteHydrationStarted = true;
  const startVersion = draftWriteVersion;
  const startPublishedVersion = publishedWriteVersion;

  try {
    const sessionUser = readSessionUser();
    const isAdmin =
      sessionUser && ["website_admin", "superadmin", "masteradmin"].includes(sessionUser.role);

    const response = await fetch(`${SITE_DB_API}?ts=${Date.now()}`, {
      headers: {
        Accept: "application/json",
        ...authHeaders(),
        ...(isAdmin ? { "x-loyola-admin": "true" } : {}),
      },
      cache: "no-store",
    });
    if (!response.ok) return;

    const payload = (await response.json()) as { db?: Partial<DB> };
    if (!payload.db) return;

    const remoteDb = mergeStoredDb(payload.db);
    if (publishedWriteVersion !== startPublishedVersion) return;
    publishedCache = remoteDb;
    if (
      adoptDraftIfClean &&
      draftWriteVersion === startVersion &&
      (!draftCache || draftCache.contentVersion < remoteDb.contentVersion)
    ) {
      draftCache = remoteDb;
      scheduleDraftPersist();
    }
    listeners.forEach((l) => l());
  } catch {
    // Local development without Hostinger-ready backend functions still works from the local draft cache.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    persistDraftNow();
    if (pendingServerDb) void flushServerPersist();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY || !event.newValue) return;
    try {
      draftCache = prepareDb(JSON.parse(event.newValue) as DB);
      listeners.forEach((l) => l());
    } catch {
      // Ignore invalid external writes.
    }
  });
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as { type?: string; db?: DB } | null;
    if (data?.type !== "loyola.website-preview.db" || !data.db) return;
    previewCache = normalizeImageFields(data.db);
    listeners.forEach((l) => l());
  });
  window.addEventListener("focus", () => {
    if (!shouldUseLocalDrafts()) void hydrateFromRemoteDb(false, true);
  });
}

function normalizeImageUrl(value?: string) {
  const trimmed = value?.trim() || "";
  if (!trimmed) return trimmed;
  if (/^photo-[a-z0-9_-]+/i.test(trimmed)) return `https://images.unsplash.com/${trimmed}`;
  if (/^images\.unsplash\.com\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function normalizeImageFields(db: DB): DB {
  const legacyVideoAlbums = db.gallery.flatMap((item) => {
    const videos = ((item as GalleryItem & { videos?: GalleryVideo[] }).videos || []).filter(
      (video) => video.url,
    );
    if (videos.length === 0) return [];
    return [
      {
        id: `video-${item.id}`,
        label: item.label,
        coverImage: item.image,
        videos,
        description: item.description,
        link: item.link,
        visible: item.visible ?? true,
      },
    ];
  });
  const existingVideoAlbums = (
    (db as DB & { videoGallery?: VideoGalleryItem[] }).videoGallery || []
  ).filter(Boolean);
  const existingVideoAlbumIds = new Set(existingVideoAlbums.map((item) => item.id));
  const videoGallery = [
    ...existingVideoAlbums,
    ...legacyVideoAlbums.filter((item) => !existingVideoAlbumIds.has(item.id)),
  ];

  return {
    ...db,
    websiteContent: {
      ...db.websiteContent,
      heroImage: normalizeImageUrl(db.websiteContent.heroImage),
      backgroundMediaUrl: normalizeImageUrl(db.websiteContent.backgroundMediaUrl),
      logoImage: normalizeImageUrl(db.websiteContent.logoImage),
      seo: {
        ...db.websiteContent.seo,
        ogImage: normalizeImageUrl(db.websiteContent.seo.ogImage),
      },
    },
    pages: Object.fromEntries(
      Object.entries(db.pages).map(([id, page]) => [
        id,
        {
          ...page,
          image: normalizeImageUrl(page.image),
          backgroundMediaUrl: normalizeImageUrl(page.backgroundMediaUrl),
          anthemVideoCoverImage: normalizeImageUrl(page.anthemVideoCoverImage),
        },
      ]),
    ),
    media: {
      ...db.media,
      campusImage: normalizeImageUrl(db.media.campusImage),
      aboutImage: normalizeImageUrl(db.media.aboutImage),
      principalImage: normalizeImageUrl(db.media.principalImage),
    },
    news: db.news.map((item) => ({ ...item, image: normalizeImageUrl(item.image) })),
    gallery: db.gallery.map((item) => ({
      ...item,
      image: normalizeImageUrl(item.image),
      images: (item.images || [item.image])
        .filter(Boolean)
        .slice(0, 10)
        .map((image) => normalizeImageUrl(image)),
      videos: [],
      visible: item.visible ?? true,
    })),
    videoGallery: videoGallery.map((item) => ({
      ...item,
      coverImage: normalizeImageUrl(item.coverImage),
      videos: (item.videos || [])
        .filter((video) => video.url)
        .map((video) => ({
          ...video,
          webmUrl: normalizeImageUrl(video.webmUrl),
          thumbnail: normalizeImageUrl(video.thumbnail),
        })),
      visible: item.visible ?? true,
    })),
  };
}

function stripDemoContent(db: DB): DB {
  const oldDemoEmails = new Set([
    "admin@loyola.edu.lk",
    "student@school.test",
    "parent@school.test",
    "teacher@school.test",
  ]);
  const bundledStaffIds = new Set(["T-REC-1", "T-VP-1", "T-SEC-1", "T-GH-1", "T-AL-1"]);
  const bundledStaffNames = new Set([
    "rev. fr. d.m.j. kennedy perera",
    "rev. fr. suranga niroshan",
    "mrs. nimali fernando",
    "mr. samantha silva",
    "mrs. deepika perera",
  ]);
  const bundledHomeStatIds = new Set(["HS001", "HS002", "HS003", "HS004"]);
  const bundledHomePillarIds = new Set(["HP001", "HP002", "HP003", "HP004"]);
  const bundledAboutStatIds = new Set(["AB001", "AB002", "AB003"]);
  const bundledDepartmentIds = new Set(["DP001", "DP002", "DP003", "DP004"]);
  const bundledAdmissionStepIds = new Set(["AS001", "AS002", "AS003", "AS004"]);
  const hasUnsplashImage = (value?: string) => /images\.unsplash\.com/i.test(value || "");
  const isBundledStaticAsset = (value?: string) => {
    const clean = value?.trim().split("?")[0] || "";
    if (!clean) return false;
    try {
      const parsed = new URL(clean);
      return BUNDLED_STATIC_ASSETS.has(parsed.pathname);
    } catch {
      return BUNDLED_STATIC_ASSETS.has(clean);
    }
  };
  const clearDemoMedia = (value?: string) =>
    hasUnsplashImage(value) || isBundledStaticAsset(value) ? "" : value || "";

  return {
    ...db,
    homeSections: {
      ...db.homeSections,
      stats: db.homeSections.stats.filter((row) => !bundledHomeStatIds.has(row.id)),
      pillars: db.homeSections.pillars.filter((row) => !bundledHomePillarIds.has(row.id)),
    },
    aboutSections: {
      ...db.aboutSections,
      stats: db.aboutSections.stats.filter((row) => !bundledAboutStatIds.has(row.id)),
    },
    academicsSections: {
      ...db.academicsSections,
      departments: db.academicsSections.departments.filter(
        (row) => !bundledDepartmentIds.has(row.id),
      ),
    },
    admissionsSteps: db.admissionsSteps.filter((row) => !bundledAdmissionStepIds.has(row.id)),
    websiteContent: {
      ...db.websiteContent,
      heroImage: clearDemoMedia(db.websiteContent.heroImage),
      backgroundMediaUrl: clearDemoMedia(db.websiteContent.backgroundMediaUrl),
      anthemVideoCoverImage: clearDemoMedia(db.websiteContent.anthemVideoCoverImage),
      seo: {
        ...db.websiteContent.seo,
        ogImage: clearDemoMedia(db.websiteContent.seo.ogImage),
      },
    },
    media: {
      campusImage: clearDemoMedia(db.media.campusImage),
      aboutImage: clearDemoMedia(db.media.aboutImage),
      principalImage: clearDemoMedia(db.media.principalImage),
    },
    pages: Object.fromEntries(
      Object.entries(db.pages).map(([id, page]) => [
        id,
        {
          ...page,
          image: clearDemoMedia(page.image),
          backgroundMediaUrl: clearDemoMedia(page.backgroundMediaUrl),
          anthemVideoCoverImage: clearDemoMedia(page.anthemVideoCoverImage),
        },
      ]),
    ),
    users: db.users.filter((user) => !oldDemoEmails.has(user.email.toLowerCase())),
    students: db.students.filter((row) => !["S001", "S002", "S003", "S004"].includes(row.id)),
    teachers: db.teachers.filter(
      (row) =>
        !["T001", "T002", "T003"].includes(row.id) &&
        !bundledStaffIds.has(row.id) &&
        !bundledStaffNames.has(row.name.toLowerCase()),
    ),
    parents: db.parents.filter((row) => !["P001", "P002"].includes(row.id)),
    classes: db.classes.filter((row) => !["C001", "C002", "C003"].includes(row.id)),
    subjects: db.subjects.filter((row) => !["SUB01", "SUB02", "SUB03", "SUB04"].includes(row.id)),
    fees: db.fees.filter((row) => !["F001", "F002"].includes(row.id)),
    assignments: db.assignments.filter((row) => !["A001", "A002"].includes(row.id)),
    events: db.events.filter((row) => !["E001", "E002", "E003"].includes(row.id)),
    news: db.news.filter((row) => !["N001", "N002", "N003"].includes(row.id)),
    gallery: db.gallery.filter((row) => !["G001", "G002", "G003", "G004"].includes(row.id)),
    videoGallery: ((db as DB & { videoGallery?: VideoGalleryItem[] }).videoGallery || []).filter(
      (row) => !["VG001", "VG002", "VG003", "VG004"].includes(row.id),
    ),
    downloads: db.downloads.filter((row) => !["D001", "D002", "D003", "D004"].includes(row.id)),
    library: db.library.filter((row) => !["B001", "B002"].includes(row.id)),
    transport: db.transport.filter((row) => !["TR01", "TR02"].includes(row.id)),
    auditLogs: db.auditLogs.filter((row) => row.action !== "Demo data initialized"),
  };
}

function applyLoyolaThemeDefaults(db: DB): DB {
  const alreadyLoyola = db.automation.themeApplied === true;
  if (alreadyLoyola) return db;

  return {
    ...db,
    automation: {
      ...db.automation,
      themeApplied: true,
      lastReport: "Clean site shell ready.",
    },
  };
}

function migratePublicWebsiteCopy(db: DB): DB {
  const currentSocials = db.websiteContent.socials || seed.websiteContent.socials;
  const nextSocials = {
    facebook: currentSocials.facebook === "#" ? "" : currentSocials.facebook || "",
    instagram: currentSocials.instagram === "#" ? "" : currentSocials.instagram || "",
    youtube: currentSocials.youtube === "#" ? "" : currentSocials.youtube || "",
    linkedin: currentSocials.linkedin === "#" ? "" : currentSocials.linkedin || "",
    whatsapp: currentSocials.whatsapp === "#" ? "" : currentSocials.whatsapp || "",
  };
  const nextHeroText = db.websiteContent.heroText.includes("role-based portals")
    ? "A modern digital home for Loyola College Negombo, bringing admissions, academics, notices, events, galleries, and parent communication into one clear school website."
    : db.websiteContent.heroText;
  const nextHeroImage = db.websiteContent.heroImage?.trim() || "";
  const nextOgImage = db.websiteContent.seo.ogImage?.trim() || "";
  const nextFooterLegalLine = db.websiteContent.footerLegalLine.replace("·", "|");

  if (
    nextHeroText === db.websiteContent.heroText &&
    nextFooterLegalLine === db.websiteContent.footerLegalLine &&
    nextHeroImage === db.websiteContent.heroImage &&
    nextOgImage === db.websiteContent.seo.ogImage &&
    nextSocials.facebook === currentSocials.facebook &&
    nextSocials.instagram === currentSocials.instagram &&
    nextSocials.youtube === currentSocials.youtube &&
    nextSocials.linkedin === currentSocials.linkedin &&
    nextSocials.whatsapp === currentSocials.whatsapp
  ) {
    return db;
  }

  return {
    ...db,
    websiteContent: {
      ...db.websiteContent,
      heroText: nextHeroText,
      heroImage: nextHeroImage,
      footerLegalLine: nextFooterLegalLine,
      socials: nextSocials,
      seo: {
        ...db.websiteContent.seo,
        ogImage: nextOgImage,
      },
    },
  };
}

function ensureGallerySubpages(db: DB): DB {
  const subpages: {
    id: string;
    label: string;
    order: number;
    page: DB["pages"][string];
  }[] = [
    {
      id: "gallery/photo-gallery",
      label: "Photo Gallery",
      order: 1,
      page: {
        kicker: "Photo Gallery",
        title: "Photo Gallery",
        body: "",
      },
    },
    {
      id: "gallery/video-gallery",
      label: "Video Gallery",
      order: 2,
      page: {
        kicker: "Video Gallery",
        title: "Video Gallery",
        body: "",
      },
    },
  ];

  const pages = { ...db.pages };
  const navigation = [...db.navigation];
  let changed = false;

  subpages.forEach((subpage) => {
    const hasPage = Boolean(pages[subpage.id]);
    const hasNav = navigation.some((item) => item.id === subpage.id);

    if (!hasPage && !hasNav) return;

    if (!hasPage) {
      pages[subpage.id] = subpage.page;
      changed = true;
    }

    if (!hasNav) {
      navigation.push({
        id: subpage.id,
        label: subpage.label,
        order: subpage.order,
        visible: true,
        parentId: "gallery",
      });
      changed = true;
    }
  });

  return changed ? { ...db, pages, navigation } : db;
}

function ensureCollegeAnthemPage(db: DB): DB {
  const pageId = "about/college-anthem-hymn";
  const label = "College Anthem & Hymn";
  const pages = { ...db.pages };
  const navigation = [...db.navigation];
  let changed = false;
  const hasPage = Boolean(pages[pageId]);
  const hasNav = navigation.some((item) => item.id === pageId);

  if (!hasPage && !hasNav) return db;

  if (!hasPage) {
    pages[pageId] = {
      kicker: label,
      title: label,
      body: "",
      anthemVideoCoverImage: "",
      anthemVideoUrl: "",
      anthemVideoTitle: label,
    };
    changed = true;
  } else if (
    pages[pageId].anthemVideoTitle === undefined ||
    !pages[pageId].anthemVideoUrl?.trim()
  ) {
    pages[pageId] = {
      ...pages[pageId],
      anthemVideoCoverImage: pages[pageId].anthemVideoCoverImage || "",
      anthemVideoUrl: pages[pageId].anthemVideoUrl?.trim() || "",
      anthemVideoTitle: label,
    };
    changed = true;
  }

  if (!hasNav) {
    navigation.push({
      id: pageId,
      label,
      order: 2,
      visible: true,
      parentId: "about",
    });
    changed = true;
  }

  return changed ? { ...db, pages, navigation } : db;
}

function migrateLoginAccounts(db: DB): DB {
  const users = db.users
    .filter(
      (user) =>
        !["admin@school.test", "super@school.test", "admin@loyola.edu.lk"].includes(
          user.email.toLowerCase(),
        ),
    )
    .map((user) => ({
      ...user,
      password: "",
    }));

  const hasMasterAdmin = users.some((user) => user.email.toLowerCase() === "deomanwolf@gmail.com");

  if (!hasMasterAdmin) {
    users.unshift({
      id: "U-MASTER",
      name: "Master Admin",
      email: "deomanwolf@gmail.com",
      role: "masteradmin",
      status: "Active",
      password: "",
    });
  }

  return { ...db, users };
}

function cleanUnwantedPages(db: DB): DB {
  if (typeof window === "undefined") return db;

  const protectedIds = new Set(["home"]);
  const unwantedIds = ["011", "photo-gallery", "video-gallery"];
  const purgeIds = new Set<string>();

  const addTree = (id: string) => {
    if (protectedIds.has(id) || purgeIds.has(id)) return;
    purgeIds.add(id);
    db.navigation.filter((item) => item.parentId === id).forEach((item) => addTree(item.id));
  };

  unwantedIds.forEach(addTree);
  if (purgeIds.size === 0) return db;

  const nextNav = db.navigation.filter((n) => !purgeIds.has(n.id));
  const nextPages = { ...db.pages };
  purgeIds.forEach((id) => {
    delete nextPages[id];
  });

  return { ...db, navigation: nextNav, pages: nextPages };
}

function prepareDb(db: DB): DB {
  const prepared = cleanUnwantedPages(
    normalizeImageFields(
      migrateLoginAccounts(
        stripDemoContent(
          ensureCollegeAnthemPage(
            ensureGallerySubpages(migratePublicWebsiteCopy(applyLoyolaThemeDefaults(db))),
          ),
        ),
      ),
    ),
  );
  return {
    ...prepared,
    contentVersion:
      typeof prepared.contentVersion === "number" && prepared.contentVersion > 0
        ? prepared.contentVersion
        : 1,
    publishedAt:
      typeof prepared.publishedAt === "string" && prepared.publishedAt
        ? prepared.publishedAt
        : seed.publishedAt,
  };
}

function shouldUseLocalDrafts() {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  return path.startsWith("/portal/") || params.has("websiteEditorPreview");
}

function mergeStoredDb(parsed: Partial<DB>): DB {
  const parsedWebsite = (parsed.websiteContent || {}) as Partial<DB["websiteContent"]>;
  return prepareDb({
    ...seed,
    ...parsed,
    websiteContent: {
      ...seed.websiteContent,
      ...parsedWebsite,
      socials: { ...seed.websiteContent.socials, ...(parsedWebsite.socials || {}) },
      seo: { ...seed.websiteContent.seo, ...(parsedWebsite.seo || {}) },
    },
    homeSections: { ...seed.homeSections, ...(parsed.homeSections || {}) },
    aboutSections: { ...seed.aboutSections, ...(parsed.aboutSections || {}) },
    academicsSections: { ...seed.academicsSections, ...(parsed.academicsSections || {}) },
    eventsSections: { ...seed.eventsSections, ...(parsed.eventsSections || {}) },
    newsSections: { ...seed.newsSections, ...(parsed.newsSections || {}) },
    loginContent: { ...seed.loginContent, ...(parsed.loginContent || {}) },
    automation: { ...seed.automation, ...(parsed.automation || {}) },
    admissionsSteps: parsed.admissionsSteps || seed.admissionsSteps,
    forms: { ...seed.forms, ...(parsed.forms || {}) },
    media: { ...seed.media, ...(parsed.media || {}) },
  });
}

function readLocalDraftDb() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  if (raw.length > MAX_LOCAL_DB_BYTES) {
    localStorage.removeItem(KEY);
    return null;
  }
  return mergeStoredDb(JSON.parse(raw) as Partial<DB>);
}

function readPublishedDb(): DB {
  if (publishedCache) return publishedCache;
  if (typeof window !== "undefined") void hydrateFromRemoteDb();
  publishedCache = prepareDb(seed);
  return publishedCache;
}

function readDraftDb(): DB {
  if (draftCache) return draftCache;
  if (typeof window !== "undefined") {
    void hydrateFromRemoteDb(true);
    try {
      const localDraft = readLocalDraftDb();
      if (localDraft) {
        draftCache = localDraft;
        return draftCache;
      }
    } catch {
      localStorage.removeItem(KEY);
    }
  }
  draftCache = publishedCache || prepareDb(seed);
  return draftCache;
}

function read(): DB {
  if (typeof window === "undefined") return seed;
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  return shouldUseLocalDrafts() ? readDraftDb() : readPublishedDb();
}

function write(next: DB) {
  const nextDb = normalizeImageFields(next);
  if (shouldUseLocalDrafts()) {
    draftWriteVersion += 1;
    draftCache = nextDb;
    scheduleDraftPersist();
  } else {
    publishedWriteVersion += 1;
    publishedCache = nextDb;
  }
  scheduleServerPersist(nextDb);
  listeners.forEach((l) => l());
}

export function getDb(): DB {
  return read();
}
export function setDb(updater: (db: DB) => DB) {
  write(updater(read()));
}

export type SaveDbResult = {
  local: boolean;
  remote: boolean;
  localOnly?: boolean;
  error?: string;
  contentVersion?: number;
};

function canDirectPublishSiteDb() {
  const role = readSessionUser()?.role;
  return role === "masteradmin" || role === "superadmin";
}

async function publishDbToServer(
  db: DB,
  options: { updateDraft?: boolean; sourceDb?: DB } = {},
): Promise<SaveDbResult> {
  const local = persistDraftNow();

  if (!canDirectPublishSiteDb()) {
    return {
      local,
      remote: false,
      localOnly: true,
      error: "Website Admin changes must be submitted for approval.",
    };
  }

  if (typeof window !== "undefined") {
    try {
      const response = await fetch(SITE_DB_API, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ db }),
        cache: "no-store",
      });
      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        let payload: { error?: string } | null = null;
        try {
          payload = responseText ? (JSON.parse(responseText) as { error?: string }) : null;
        } catch {
          payload = null;
        }
        // Local dev (Vite only) returns HTML 404 — give a helpful message instead of raw HTML
        const isHtml =
          responseText.trim().startsWith("<!") || responseText.trim().startsWith("<html");
        const isLocalDev =
          typeof window !== "undefined" &&
          (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
        let error: string;
        if (isHtml && isLocalDev) {
          error =
            "Server sync needs the Node.js backend to be running. Local draft saved to your browser.";
        } else {
          const plainError = responseText.trim().split("\n")[0].slice(0, 200);
          error =
            payload?.error ||
            (isHtml ? `Server error (status ${response.status})` : plainError) ||
            `Server publish failed with status ${response.status}.`;
        }
        return { local, remote: false, error };
      }

      const payload = (await response.json().catch(() => null)) as {
        db?: Partial<DB>;
        contentVersion?: number;
      } | null;
      const savedDb = payload?.db ? mergeStoredDb(payload.db) : normalizeImageFields(db);
      publishedWriteVersion += 1;
      publishedCache = savedDb;
      if (options.updateDraft || draftCache === db || draftCache === options.sourceDb) {
        draftCache = savedDb;
        scheduleDraftPersist();
      }
      listeners.forEach((l) => l());
      return { local, remote: true, contentVersion: payload?.contentVersion };
    } catch (caught) {
      return {
        local,
        remote: false,
        error: caught instanceof Error ? caught.message : "Server publish request failed.",
      };
    }
  }

  return { local, remote: false, error: "Server publish is only available in the browser." };
}

async function flushServerPersist() {
  if (serverPersistTimer && typeof window !== "undefined") {
    window.clearTimeout(serverPersistTimer);
    serverPersistTimer = null;
  }
  const db = pendingServerDb;
  pendingServerDb = null;
  if (!db) return { local: persistDraftNow(), remote: false };
  return publishDbToServer(db, { sourceDb: db });
}

function scheduleServerPersist(db: DB) {
  if (typeof window === "undefined") return;
  if (!canDirectPublishSiteDb()) {
    persistDraftNow();
    return;
  }
  pendingServerDb = db;
  if (serverPersistTimer) window.clearTimeout(serverPersistTimer);
  serverPersistTimer = window.setTimeout(() => {
    serverPersistTimer = null;
    void flushServerPersist();
  }, SERVER_SAVE_DELAY_MS);
}

export async function saveDbNow(): Promise<SaveDbResult> {
  const sourceDb = shouldUseLocalDrafts()
    ? draftCache || readDraftDb()
    : draftCache || publishedCache || read();
  const db = normalizeImageFields(sourceDb);
  if (shouldUseLocalDrafts()) {
    draftCache = db;
    persistDraftNow();
  }
  pendingServerDb = null;
  if (serverPersistTimer && typeof window !== "undefined") {
    window.clearTimeout(serverPersistTimer);
    serverPersistTimer = null;
  }
  return publishDbToServer(db, { updateDraft: true, sourceDb });
}

export function resetDb() {
  publishedCache = null;
  draftCache = null;
  pendingServerDb = null;
  if (serverPersistTimer && typeof window !== "undefined") {
    window.clearTimeout(serverPersistTimer);
    serverPersistTimer = null;
  }
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDb(): DB {
  return useSyncExternalStore(
    subscribe,
    () => previewCache || read(),
    () => seed,
  );
}

function currentAuditActor(user: string) {
  const sessionUser = authCache?.user;
  if (sessionUser && ["Admin", "Website editor", "System"].includes(user)) {
    return {
      user: sessionUser.email,
      actorEmail: sessionUser.email,
      actorName: sessionUser.name,
      actorRole: sessionUser.role,
    };
  }

  return {
    user,
    actorEmail: user.includes("@") ? user : undefined,
    actorName: undefined,
    actorRole: undefined,
  };
}

function auditArea(action: string) {
  const text = action.toLowerCase();
  if (text.includes("sign")) return "Login";
  if (text.includes("opened")) return "Navigation";
  if (text.includes("image") || text.includes("video") || text.includes("album")) return "Media";
  if (text.includes("page") || text.includes("website") || text.includes("visual"))
    return "Website";
  if (text.includes("news") || text.includes("event")) return "Content";
  if (text.includes("backup") || text.includes("published") || text.includes("saved"))
    return "System";
  return "General";
}

export function audit(action: string, user = "System") {
  const actor = currentAuditActor(user);
  setDb((db) => ({
    ...db,
    auditLogs: [
      {
        id: `LOG-${Date.now()}`,
        user: actor.user,
        action,
        createdAt: new Date().toISOString(),
        actorEmail: actor.actorEmail,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        area: auditArea(action),
      },
      ...db.auditLogs,
    ].slice(0, 200),
  }));
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// Auth (localStorage)
const AUTH_KEY = "loyola.auth.v3";
export interface AuthState {
  user: User | null;
  loading: boolean;
}

const SESSION_AUTH_KEY = "loyola.portal.user";

function normalizeRole(role: unknown): Role {
  return role === "admin" ? "website_admin" : (role as Role);
}

function readSessionUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<User>;
    if (!parsed.id || !parsed.email || !parsed.role) return null;
    return {
      id: parsed.id,
      name: parsed.name || parsed.email,
      email: parsed.email,
      role: normalizeRole(parsed.role),
      status: parsed.status || "Active",
    };
  } catch {
    sessionStorage.removeItem(SESSION_AUTH_KEY);
    return null;
  }
}

function writeSessionUser(user: User | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    sessionStorage.removeItem(SESSION_AUTH_KEY);
    return;
  }
  sessionStorage.setItem(
    SESSION_AUTH_KEY,
    JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    }),
  );
}

const initialSessionUser = readSessionUser();
let authCache: AuthState = { user: initialSessionUser, loading: false };
const authListeners = new Set<() => void>();

function emitAuth() {
  authListeners.forEach((listener) => listener());
}

export function setResolvedAuthUser(user: User | null, loading = false) {
  authCache = { user, loading };
  writeSessionUser(user);
  emitAuth();
}

export function getAuth(): AuthState {
  return authCache;
}

export async function setAuth(user: User | null) {
  if (user) {
    const normalizedUser = { ...user, role: normalizeRole(user.role) };
    authCache = { user: normalizedUser, loading: false };
    writeSessionUser(normalizedUser);
    emitAuth();
    return;
  }
  if (typeof window !== "undefined") {
    localStorage.removeItem("loyola_token");
    localStorage.removeItem("loyola_user");
  }
  writeSessionUser(null);
  authCache = { user: null, loading: false };
  emitAuth();
}

export async function authenticateUser(email: string, password: string): Promise<User> {
  const { user } = await loginUser(email, password);
  await setAuth(user);
  audit(`Signed in to ${user.role} portal`, user.email);
  return user;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => getAuth());
  useEffect(() => {
    const l = () => setState(getAuth());
    authListeners.add(l);
    return () => {
      authListeners.delete(l);
    };
  }, []);
  return state;
}
