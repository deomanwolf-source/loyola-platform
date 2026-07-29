import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  ChevronDown,
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
  Search,
  Heart,
  ShieldCheck,
  Trophy,
  Users,
  Waves,
  X,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { BrandedLoader } from "@/components/BrandedLoader";
import { HeroBackgroundLayer, PageHeader, PublicLayout } from "@/components/site/PublicLayout";
import { CollegeStaffPage } from "@/components/site/CollegeStaffPage";
import { CollegeAdministrationPage } from "@/components/site/CollegeAdministrationPage";
import {
  EXTRA_CURRICULAR_GROUPS,
  extraCurricularActivitiesByGroup,
  extraCurricularActivityById,
  type ExtraCurricularActivity,
} from "@/lib/extracurricular-activities";
import { normalizePositionCode } from "@/lib/staff-position-codes";
import { formatDisplayHeading, normalizeHeadingHtml } from "@/lib/utils";
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
  type EventItem,
  type GalleryItem,
  type GalleryVideo,
  type FacilityItem,
  type HomeContentCard,
  type HomeLeadershipCard,
  type PastRectorProfile,
  type Role,
  type Teacher,
} from "@/lib/store";
import { resolveContentIcon } from "@/lib/content-icons";
import {
  API_URL,
  TwoFactorRequiredError,
  authHeaders,
  getMaintenanceStatus,
  type MaintenanceStatus,
} from "@/lib/api";
import {
  EDUTRACK_DIRECT_URL,
  EDUTRACK_LAUNCH_URL,
  EDUTRACK_LOCAL_URL,
  EDUTRACK_PUBLIC_URL,
  edutrackHref,
} from "@/lib/edutrack-url";
import {
  VISUAL_BUILDER_STATIC_CSS,
  normalizeVisualBuilderHtml,
  sanitizeVisualCss,
  sanitizeVisualHtml,
} from "@/lib/sanitize-visual-content";

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
const WEBSITE_ADMIN_ROLES: Role[] = ["masteradmin", "superadmin", "website_admin", "viewadmin"];
const EDUZYNC_ADMIN_ROLES: Role[] = [
  "masteradmin",
  "superadmin",
  "master_edutrack_admin",
  "eduzync_admin",
];
const STAFF_ADMIN_ROLES: Role[] = ["masteradmin", "superadmin", "staff_admin", "viewadmin"];
const EDUTRACK_ROLES: Role[] = [
  "masteradmin",
  "superadmin",
  "master_edutrack_admin",
  "eduzync_admin",
  "academic_coordinator",
  "viewadmin",
  "teacher",
];
const ELMS_ROLES: Role[] = ["masteradmin", "superadmin", "student"];
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
  "viewadmin",
];
const REPORT_CARDS_SYSTEM_URL = "https://intranet.loyolacollege.lk/login";
const LCEA_PAGE_ID = "academics/loyolian-cambridge-english-academy";
const FACILITIES_PAGE_ID = "the-college/facilities-services";
const COLLEGE_DEPARTMENT_BASE_ID = "the-college/departments";

const REQUIRED_HOME_LEADERSHIP_CARDS: HomeLeadershipCard[] = [
  {
    id: "LC-LEAD-1",
    name: "His Eminence Malcolm Cardinal Ranjith",
    title: "The Archbishop of Colombo",
    description: "Spiritual leadership and guidance for Catholic education.",
    image: "",
    order: 1,
    visible: true,
  },
  {
    id: "LC-LEAD-2",
    name: "Very Rev. Fr. Gemunu Dias",
    title: "General Manager of Catholic Private Schools",
    description: "Administration and school network leadership.",
    image: "",
    order: 2,
    visible: true,
  },
  {
    id: "LC-LEAD-3",
    name: "Rev. Dr. D.M.J. Kennedy Perera",
    title: "Rector / Principal",
    description: "Rector and Principal of Loyola College.",
    image: "",
    order: 3,
    visible: true,
  },
  {
    id: "LC-LEAD-4",
    name: "Rev. Fr. W.G. Thilina Pathum",
    title: "Vice Rector, Prefect of Games",
    description: "Discipline, student formation, and games leadership.",
    image: "",
    order: 4,
    visible: true,
  },
];

function normalizeKennedyTitle(value: string) {
  return value
    .replace(
      /\bRev\.\s*Fr\.\s*D\.?\s*M\.?\s*J\.?\s*Kennedy Perera\b/gi,
      "Rev. Dr. D.M.J. Kennedy Perera",
    )
    .replace(/\bRev\.\s*Fr\.\s*Kennedy Perera\b/gi, "Rev. Dr. Kennedy Perera");
}

function leadershipCardKey(name: string) {
  return normalizeKennedyTitle(name)
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .replace(/\b(his|eminence|very|rev|fr|dr|mr|mrs|ms)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLeadershipCard(card: HomeLeadershipCard): HomeLeadershipCard {
  return {
    ...card,
    name: normalizeKennedyTitle(card.name),
  };
}

function mergedHomeLeadershipCards(cards: HomeLeadershipCard[] = []) {
  const normalizedCards = cards.map(normalizeLeadershipCard);
  const existingByKey = new Map(
    normalizedCards.map((card) => [leadershipCardKey(card.name), card] as const),
  );
  const requiredKeys = new Set(
    REQUIRED_HOME_LEADERSHIP_CARDS.map((card) => leadershipCardKey(card.name)),
  );

  const requiredCards = REQUIRED_HOME_LEADERSHIP_CARDS.map((required) => {
    const existing = existingByKey.get(leadershipCardKey(required.name));
    if (!existing) return required;
    return {
      ...required,
      ...existing,
      name: normalizeKennedyTitle(existing.name || required.name),
      title: existing.title || required.title,
      description: existing.description || required.description,
      image: existing.image || required.image,
      order: required.order,
      visible: true,
    };
  });

  const extraCards = normalizedCards.filter(
    (card) => card.visible !== false && !requiredKeys.has(leadershipCardKey(card.name)),
  );

  return [...requiredCards, ...extraCards].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function escapeHtmlAttribute(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] || char,
  );
}

function normalizeLeadershipVisualHtml(html: string, homeLeadershipCards: HomeLeadershipCard[]) {
  let next = normalizeKennedyTitle(html);

  if (/Malcolm Cardinal Ranjith/i.test(next)) return next;
  if (!/\bleadership-grid\b/i.test(next)) return next;

  const cardinalCard =
    mergedHomeLeadershipCards(homeLeadershipCards).find((card) =>
      /Malcolm Cardinal Ranjith/i.test(card.name),
    ) || REQUIRED_HOME_LEADERSHIP_CARDS[0];
  const image = escapeHtmlAttribute(cardinalCard.image || "/loyola-crest.jpg");
  const name = escapeHtmlAttribute(cardinalCard.name);
  const title = escapeHtmlAttribute(cardinalCard.title);
  const cardHtml = `<article class="leadership-card"><img src="${image}" alt="" /><div><h3>${name}</h3><span></span><p>${title}</p></div></article>`;

  return next.replace(
    /(<div\b[^>]*class\s*=\s*["'][^"']*\bleadership-grid\b[^"']*["'][^>]*>)/i,
    `$1${cardHtml}`,
  );
}

function removeHomeVisualCalendarHighlights(html: string) {
  if (!/Year highlights|Annual Prize Giving Ceremony/i.test(html)) return html;
  if (typeof DOMParser === "undefined") return html;

  const doc = new DOMParser().parseFromString(
    `<div data-home-visual-root>${html}</div>`,
    "text/html",
  );
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let highlightNode = walker.nextNode();
  let highlightColumn: Element | null = null;

  while (highlightNode) {
    if (/Year highlights/i.test(highlightNode.textContent || "")) {
      let current = highlightNode.parentElement;
      while (current && current !== doc.body) {
        if (
          current.className.includes("space-y-4") &&
          /Annual Prize Giving Ceremony|Poya Day|Vesak Festival/i.test(current.textContent || "")
        ) {
          highlightColumn = current;
          break;
        }
        current = current.parentElement;
      }
      break;
    }
    highlightNode = walker.nextNode();
  }

  if (!highlightColumn?.parentElement) return html;

  const calendarWrapper = highlightColumn.parentElement;
  highlightColumn.remove();
  calendarWrapper.setAttribute("class", "mx-auto mt-8 max-w-5xl");

  return doc.querySelector("[data-home-visual-root]")?.innerHTML || html;
}

type DepartmentPosition = {
  title: string;
  body: string;
};

type DepartmentMember = {
  name: string;
  role: string;
  note?: string;
  image?: string;
};

type DepartmentGalleryItem = {
  title: string;
  body: string;
  image?: string;
};

type DepartmentDocument = {
  title: string;
  body: string;
};

type JobVacancy = {
  id: number;
  title: string;
  description: string;
  requirements?: string;
  deadline?: string | null;
  status: "Open" | "Closed" | "Expired";
  attachment_url?: string;
  attachment_type?: string;
  application_email?: string;
};

type CollegeDepartment = {
  id: string;
  title: string;
  cardBody: string;
  kicker: string;
  icon: LucideIcon;
  summary: string;
  responsibilities: string[];
  systemWork: string[];
  serviceAreas: string[];
  permissionLevel: string;
  positions?: DepartmentPosition[];
  members?: DepartmentMember[];
  gallery?: DepartmentGalleryItem[];
  documents?: DepartmentDocument[];
  contact?: {
    location: string;
    hours: string;
    email: string;
  };
  staffDepartments?: string[];
  staffTypes?: string[];
  memberPositionCodes?: string[];
  skipDepartmentPage?: boolean;
};

const collegeDepartments: CollegeDepartment[] = [
  {
    id: `${COLLEGE_DEPARTMENT_BASE_ID}/administration`,
    title: "Administration",
    cardBody: "Central management and governance",
    kicker: "The College",
    icon: Briefcase,
    summary:
      "The Administration Department manages overall governance, coordination, official communication, policies, approvals, institutional records, and daily administrative operations of the college.",
    responsibilities: [
      "Coordinate the work of all departments and sections.",
      "Implement decisions made by the Rector and Principal.",
      "Manage official letters, circulars, notices, and administrative documents.",
      "Maintain institutional records, policies, procedures, and official files.",
      "Coordinate meetings, appointments, ceremonies, and official programmes.",
      "Supervise staff responsibilities and departmental performance.",
      "Approve important requests submitted by departments.",
      "Coordinate with government offices, education authorities, parents, and external institutions.",
      "Manage student and staff documentation.",
      "Monitor the implementation of college policies.",
      "Handle complaints, inquiries, and official correspondence.",
      "Prepare institutional reports and annual plans.",
      "Support emergency and crisis-management procedures.",
    ],
    systemWork: [
      "Manage official notices, circulars, and announcements.",
      "Approve content submitted by other departments.",
      "Review administrative reports and requests.",
      "Maintain staff and institutional records.",
      "Manage meetings, calendars, and official events.",
      "Monitor departmental system activities.",
      "Approve major website and system updates.",
      "Generate administrative and management reports.",
      "Manage document approval workflows.",
      "Control high-level user permissions.",
    ],
    serviceAreas: [
      "Governance",
      "Official Records",
      "Policies",
      "Approvals",
      "Meetings",
      "Communication",
      "Institutional Reporting",
      "Department Coordination",
    ],
    permissionLevel:
      "Administration may review, approve, reject, and publish official institutional content. Major system changes should require approval from the Rector, Principal, Master Administrator, or System Creator.",
    positions: [
      {
        title: "Rector / Principal",
        body: "Provides final institutional leadership, approvals, direction, and public representation.",
      },
      {
        title: "Administrative Secretary",
        body: "Coordinates official communication, appointments, files, letters, and office workflow.",
      },
      {
        title: "Head - Academic Office",
        body: "Links administration with class sections, academic planning, and reporting.",
      },
      {
        title: "Reception and Front Office",
        body: "Supports visitors, parents, calls, inquiries, and daily office routing.",
      },
    ],
    members: [
      {
        name: "Rector / Principal",
        role: "Department Head",
        note: "Overall leadership and final approval",
      },
      {
        name: "Administrative Secretary",
        role: "Office Coordination",
        note: "Letters, records, and official schedules",
      },
      {
        name: "Reception Office",
        role: "Front Office",
        note: "Visitor and parent assistance",
      },
    ],
    gallery: [
      {
        title: "College Office",
        body: "Administration workspace for official communication, records, and parent service.",
      },
      {
        title: "Meeting and Approval Work",
        body: "Daily coordination between leadership, sections, staff, students, and families.",
      },
      {
        title: "Official Records",
        body: "Administrative files, policy records, correspondence, and institutional reports.",
      },
    ],
    documents: [
      {
        title: "Office Circulars",
        body: "Official letters, circulars, and administrative notices.",
      },
      {
        title: "Meeting Records",
        body: "Meeting schedules, minutes, action lists, and approvals.",
      },
      {
        title: "Policy Files",
        body: "Institutional policies, guidelines, and procedure documents.",
      },
    ],
    contact: {
      location: "College Office",
      hours: "School office hours",
      email: "loyolacollege.negombo@hotmail.com",
    },
    staffDepartments: [
      "administration",
      "college administration",
      "administrative department",
      "front office",
      "primary office",
      "cambridge office",
    ],
    memberPositionCodes: [
      "rector-principal",
      "administrative-secretary",
      "secretary",
      "receptionist",
      "office-assistant",
      "primary-secretary",
      "assistant-primary-secretary",
      "cambridge-office",
    ],
  },
  {
    id: `${COLLEGE_DEPARTMENT_BASE_ID}/academic`,
    title: "Academic",
    cardBody: "Curriculum and educational standards",
    kicker: "The College",
    icon: BookOpen,
    summary:
      "The Academic Department manages curriculum implementation, teaching arrangements, subjects, classes, lesson planning, examinations, academic progress, and educational standards.",
    responsibilities: [
      "Add and update subjects.",
      "Assign teachers to subjects, classes, grades, and sections.",
      "Prepare academic timetables.",
      "Manage class lists and academic sections.",
      "Coordinate syllabus coverage and lesson planning.",
      "Monitor teacher academic progress.",
      "Manage term plans, unit plans, and lesson plans.",
      "Organize assessments and examinations.",
      "Review student academic performance.",
      "Coordinate academic meetings and teacher training.",
      "Maintain subject and curriculum records.",
      "Prepare academic notices and calendars.",
      "Review academic reports before publication.",
      "Coordinate with section heads, subject heads, and class teachers.",
    ],
    systemWork: [
      "Create and update subjects.",
      "Assign teachers to subjects and classes.",
      "Manage grades, classes, and sections.",
      "Upload syllabuses and academic resources.",
      "Enter term plans, units, topics, and subtopics.",
      "Monitor syllabus-completion progress.",
      "Add examination and assessment schedules.",
      "Review student marks and reports.",
      "Publish approved academic notices.",
      "Generate teacher, subject, and class-progress reports.",
      "Maintain academic calendars.",
      "Submit academic content for approval.",
    ],
    serviceAreas: [
      "Curriculum",
      "Teacher Assignments",
      "Subjects",
      "Timetables",
      "Lesson Planning",
      "Assessments",
      "Academic Progress",
      "Educational Standards",
    ],
    permissionLevel:
      "The Academic Department may create and edit academic content. Final publication of major academic information should require authorized approval.",
    positions: [
      {
        title: "Head of Academics",
        body: "Leads curriculum planning, subject coordination, and academic standards.",
      },
      {
        title: "Sectional Heads",
        body: "Coordinate Primary, Middle, Upper School, and Advanced Level academic work.",
      },
      {
        title: "Subject Heads",
        body: "Guide subject planning, resources, assessment quality, and syllabus progress.",
      },
      {
        title: "Class Teachers",
        body: "Manage class-level academic records, communication, and student progress.",
      },
    ],
    members: [
      {
        name: "Head - Academic Office",
        role: "Academic Office Lead",
        note: "Academic planning, coordination, and reporting",
      },
      {
        name: "Academic Officer",
        role: "Academic Office Support",
        note: "Records, coordination, and office workflow",
      },
    ],
    gallery: [
      {
        title: "Classroom Learning",
        body: "Teaching, assessment, lesson planning, and student academic progress.",
      },
      {
        title: "Academic Coordination",
        body: "Subject meetings, section planning, teacher collaboration, and reporting.",
      },
      {
        title: "Exam Preparation",
        body: "Term plans, academic notices, exam schedules, and student support work.",
      },
    ],
    documents: [
      {
        title: "Timetables",
        body: "Class timetables, examination timetables, and section schedules.",
      },
      {
        title: "Syllabus Plans",
        body: "Term plans, unit plans, topics, and syllabus tracking files.",
      },
      {
        title: "Academic Notices",
        body: "Approved academic notices, circulars, and parent updates.",
      },
    ],
    contact: {
      location: "Academic Office",
      hours: "School academic hours",
      email: "loyolacollege.negombo@hotmail.com",
    },
    staffDepartments: [
      "academic",
      "academic department",
      "academic office",
      "primary office",
      "cambridge office",
      "primary school",
      "middle school",
      "upper school",
      "advanced level",
      "a/l section",
    ],
    memberPositionCodes: ["head-academic-office", "academic-officer-head", "academic-officer"],
  },
  {
    id: `${COLLEGE_DEPARTMENT_BASE_ID}/finance`,
    title: "Finance",
    cardBody: "Bursary and financial operations",
    kicker: "The College",
    icon: Landmark,
    summary:
      "The Finance Department manages college income, expenses, budgets, payments, salaries, purchasing, financial records, audits, and financial reporting.",
    responsibilities: [
      "Prepare annual and departmental budgets.",
      "Record income and expenditure.",
      "Manage school fees and other payments.",
      "Issue receipts and payment confirmations.",
      "Process salaries and staff payments.",
      "Manage supplier and service-provider payments.",
      "Review purchase and expense requests.",
      "Maintain financial ledgers and supporting documents.",
      "Prepare monthly and annual financial reports.",
      "Coordinate audits and financial reviews.",
      "Monitor outstanding payments.",
      "Manage scholarships, concessions, and refunds.",
      "Maintain bank and transaction records.",
      "Protect confidential financial information.",
    ],
    systemWork: [
      "Create fee structures and payment categories.",
      "Record student and institutional payments.",
      "Issue digital receipts.",
      "Monitor outstanding balances.",
      "Process approved financial requests.",
      "Manage budgets and departmental allocations.",
      "Record supplier invoices and payments.",
      "Track purchases and expenses.",
      "Generate income, expense, and balance reports.",
      "Maintain salary and allowance records.",
      "Upload financial documents.",
      "Submit major payments for authorization.",
    ],
    serviceAreas: [
      "Fees",
      "Payments",
      "Budgets",
      "Salaries",
      "Purchases",
      "Receipts",
      "Audits",
      "Financial Reports",
    ],
    permissionLevel:
      "Finance staff may manage financial records according to assigned roles. Major payments, budget changes, refunds, and sensitive financial reports should require senior approval.",
    positions: [
      {
        title: "Accountant",
        body: "Leads accounts, reports, audit preparation, budgets, and financial controls.",
      },
      {
        title: "Accounts Assistant",
        body: "Supports receipts, payments, fee records, invoices, and day-to-day finance work.",
      },
      {
        title: "Fees Officer",
        body: "Handles student fee records, payment follow-up, receipts, and parent inquiries.",
      },
      {
        title: "Procurement Support",
        body: "Tracks purchase requests, supplier records, quotations, and approved payments.",
      },
    ],
    members: [
      {
        name: "Accountant",
        role: "Finance Lead",
        note: "Accounts, reports, and financial controls",
      },
      {
        name: "Accounts Assistant",
        role: "Finance Operations",
        note: "Receipts, payments, and daily finance records",
      },
      {
        name: "Fees Officer",
        role: "Fee Records",
        note: "Student fee support and parent inquiries",
      },
    ],
    gallery: [
      {
        title: "Finance Office",
        body: "Daily payment records, receipts, fee support, and parent finance service.",
      },
      {
        title: "Financial Records",
        body: "Budgets, ledgers, approvals, audit files, and institutional financial reports.",
      },
      {
        title: "Payment Support",
        body: "Fee handling, purchase requests, supplier payments, and receipt management.",
      },
    ],
    documents: [
      {
        title: "Fee Notices",
        body: "Approved fee notices, payment instructions, and due-date updates.",
      },
      {
        title: "Receipts and Ledgers",
        body: "Receipt records, ledger extracts, and payment summaries.",
      },
      {
        title: "Budget Reports",
        body: "Department budgets, purchase approvals, and audit-support files.",
      },
    ],
    contact: {
      location: "Finance Office",
      hours: "School finance office hours",
      email: "loyolacollege.negombo@hotmail.com",
    },
    staffDepartments: ["finance", "finance department", "financial department", "accounts"],
    memberPositionCodes: [
      "accountant",
      "accounts-assistant",
      "assistant-accountant",
      "assistant-account-clerk",
    ],
  },
  {
    id: `${COLLEGE_DEPARTMENT_BASE_ID}/it-department`,
    title: "IT Department",
    cardBody: "Digital infrastructure and support",
    kicker: "The College",
    icon: ShieldCheck,
    summary:
      "The IT Department manages the college's digital infrastructure, systems, websites, networks, user accounts, devices, software, backups, and technical support.",
    responsibilities: [
      "Maintain the college website and portals.",
      "Manage servers, networks, internet access, and Wi-Fi.",
      "Create and manage system accounts.",
      "Assign approved roles and access permissions.",
      "Maintain computers, printers, projectors, and digital devices.",
      "Install and update software.",
      "Maintain backups and recovery procedures.",
      "Monitor system performance and availability.",
      "Provide technical support to staff and departments.",
      "Maintain IT asset and licence records.",
      "Manage domains, hosting, SSL certificates, and email services.",
      "Train users in safe system usage.",
      "Coordinate with developers and service providers.",
    ],
    systemWork: [
      "Create, activate, suspend, and manage user accounts.",
      "Reset passwords and support account recovery.",
      "Assign approved permissions.",
      "Maintain websites, portals, and integrations.",
      "Monitor login records and system activity.",
      "Maintain backups and system logs.",
      "Manage technical-support requests.",
      "Record devices, repairs, warranties, and licences.",
      "Publish maintenance and technical notices.",
      "Generate IT asset and incident reports.",
      "Assist departments with technical publishing.",
    ],
    serviceAreas: [
      "User Access",
      "Website Support",
      "Network Services",
      "Backups",
      "Technical Support",
      "Devices",
      "Software and Licences",
    ],
    permissionLevel:
      "The IT Department may perform normal technical maintenance. Major database, source-code, permission-structure, hosting, or system-architecture changes must be controlled by the System Creator or Master Administrator.",
    positions: [
      {
        title: "Manager - IT",
        body: "Leads technical operations, systems, support planning, and infrastructure control.",
      },
      {
        title: "Assistant IT",
        body: "Supports devices, troubleshooting, user accounts, and classroom technology.",
      },
      {
        title: "Website and Portal Support",
        body: "Maintains content support, portal access, publishing help, and user workflows.",
      },
      {
        title: "Network and Device Support",
        body: "Handles Wi-Fi, computers, projectors, printers, backups, and technical incidents.",
      },
    ],
    members: [
      {
        name: "Manager - IT",
        role: "Technical Lead",
        note: "Systems, hosting, and support planning",
      },
      {
        name: "Assistant IT",
        role: "Technical Support",
        note: "Devices, accounts, and classroom technology",
      },
      {
        name: "Portal Support",
        role: "Website and Systems",
        note: "Publishing workflows and user access support",
      },
    ],
    gallery: [
      {
        title: "IT Support Desk",
        body: "Technical assistance for staff, students, devices, accounts, and daily system issues.",
      },
      {
        title: "Digital Infrastructure",
        body: "Website, portals, backups, networks, computers, and secure access management.",
      },
      {
        title: "Classroom Technology",
        body: "Digital teaching devices, projectors, software, and technical classroom support.",
      },
    ],
    documents: [
      {
        title: "Support Requests",
        body: "Technical-support requests, maintenance notes, and issue records.",
      },
      {
        title: "Account Records",
        body: "Approved account access, role assignments, and recovery logs.",
      },
      {
        title: "Asset Lists",
        body: "Device inventories, warranty records, software, and repair records.",
      },
    ],
    contact: {
      location: "IT Office",
      hours: "School technical-support hours",
      email: "loyolacollege.negombo@hotmail.com",
    },
    staffDepartments: ["it department", "information technology", "ict department"],
    staffTypes: ["non-academic staff"],
    memberPositionCodes: ["manager-it", "it-manager", "assistant-it", "it-assistant"],
  },
  {
    id: `${COLLEGE_DEPARTMENT_BASE_ID}/gym`,
    title: "Gym",
    cardBody: "Modern fitness and training center",
    kicker: "The College",
    icon: Trophy,
    summary:
      "The Gym Unit manages fitness programmes, athlete conditioning, exercise facilities, equipment, trainers, bookings, safety, and maintenance.",
    responsibilities: [
      "Plan student and staff fitness programmes.",
      "Coordinate strength and conditioning sessions.",
      "Support sports teams and student athletes.",
      "Maintain gym equipment and facilities.",
      "Prepare training schedules.",
      "Monitor participant attendance.",
      "Enforce gym safety rules.",
      "Inspect equipment condition.",
      "Report damaged or unsafe equipment.",
      "Manage trainers and authorized supervisors.",
      "Organize fitness assessments.",
      "Coordinate facility cleaning and maintenance.",
      "Manage bookings and approved access.",
      "Maintain emergency and first-aid procedures.",
    ],
    systemWork: [
      "Publish gym schedules and fitness programmes.",
      "Manage facility bookings.",
      "Record athlete and participant attendance.",
      "Maintain equipment inventory.",
      "Report equipment damage and maintenance needs.",
      "Assign trainers and supervisors.",
      "Record fitness assessments.",
      "Track training programmes.",
      "Submit purchase and repair requests.",
      "Publish approved notices and rules.",
      "Generate facility-usage reports.",
    ],
    serviceAreas: [
      "Fitness Training",
      "Athlete Conditioning",
      "Equipment",
      "Facility Bookings",
      "Safety",
      "Maintenance",
      "Fitness Assessments",
      "Supervision",
    ],
    permissionLevel:
      "The Gym Unit may manage schedules, attendance, equipment, and internal notices. Major purchases, public announcements, and structural facility changes require approval.",
    skipDepartmentPage: true,
  },
  {
    id: `${COLLEGE_DEPARTMENT_BASE_ID}/swimming-pool`,
    title: "Swimming Pool",
    cardBody: "Olympic-standard aquatic facility",
    kicker: "The College",
    icon: Award,
    summary:
      "The Swimming Pool Unit manages aquatic training, swimming programmes, pool safety, lifeguards, coaches, facility bookings, equipment, water-quality monitoring, and maintenance.",
    responsibilities: [
      "Organize swimming lessons and training programmes.",
      "Coordinate swimming coaches and lifeguards.",
      "Support college swimming teams.",
      "Prepare training and competition schedules.",
      "Manage pool access and bookings.",
      "Enforce aquatic safety rules.",
      "Monitor water quality and sanitation.",
      "Maintain rescue and safety equipment.",
      "Record participant attendance.",
      "Manage changing rooms and pool facilities.",
      "Coordinate pool cleaning and maintenance.",
      "Organize swimming trials and competitions.",
      "Maintain emergency-response procedures.",
      "Report accidents, incidents, and hazards.",
    ],
    systemWork: [
      "Publish swimming schedules.",
      "Manage pool bookings.",
      "Register swimmers and participants.",
      "Assign coaches and lifeguards.",
      "Record attendance and training progress.",
      "Maintain equipment records.",
      "Record water-quality and maintenance checks.",
      "Report incidents and safety issues.",
      "Track competition results and achievements.",
      "Submit repair and purchase requests.",
      "Generate facility-usage reports.",
      "Publish approved safety notices.",
    ],
    serviceAreas: [
      "Swimming Training",
      "Aquatic Safety",
      "Lifeguards",
      "Pool Bookings",
      "Water Quality",
      "Equipment",
      "Competitions",
      "Facility Maintenance",
    ],
    permissionLevel:
      "The Swimming Pool Unit may manage schedules, participants, safety records, and facility operations. Major purchases, public announcements, and facility changes require approval.",
    skipDepartmentPage: true,
  },
  {
    id: `${COLLEGE_DEPARTMENT_BASE_ID}/sports-department`,
    title: "Sports Department",
    cardBody: "Athletic development and coaching",
    kicker: "The College",
    icon: Trophy,
    summary:
      "The Sports Department manages college sports, team development, coaching, competitions, fixtures, sports facilities, athletes, equipment, and achievement records.",
    responsibilities: [
      "Prepare the annual sports programme.",
      "Organize team selections and trials.",
      "Coordinate coaches and teachers-in-charge.",
      "Manage team captains and student athletes.",
      "Arrange practices and training sessions.",
      "Organize inter-house and inter-school competitions.",
      "Manage fixtures, venues, transport, and logistics.",
      "Register students for competitions.",
      "Maintain player and team records.",
      "Record results, awards, medals, and achievements.",
      "Manage sports equipment and uniforms.",
      "Coordinate sports grounds and facilities.",
      "Promote teamwork, fitness, discipline, and leadership.",
      "Prepare sports reports and budgets.",
      "Coordinate with parents, associations, sponsors, and alumni.",
    ],
    systemWork: [
      "Create and manage sports teams.",
      "Add players to teams and age groups.",
      "Assign coaches and teachers-in-charge.",
      "Publish trials, practices, and fixtures.",
      "Record attendance and participation.",
      "Manage competition registrations.",
      "Record results, awards, and achievements.",
      "Maintain student-athlete profiles.",
      "Manage equipment inventories.",
      "Submit transport and facility requests.",
      "Upload sports news, photos, and reports.",
      "Generate player and team-performance reports.",
    ],
    serviceAreas: [
      "Teams",
      "Coaching",
      "Fixtures",
      "Competitions",
      "Student Athletes",
      "Equipment",
      "Achievements",
      "Sports Calendar",
    ],
    permissionLevel:
      "The Sports Department may manage internal sports records and schedules. Official team lists, public results, financial requests, and major announcements should require approval.",
    positions: [
      {
        title: "Sports Coordinator",
        body: "Leads annual sports planning, fixtures, teams, coaches, and department reporting.",
      },
      {
        title: "Teachers-in-Charge",
        body: "Manage assigned sports, teams, student records, practices, and event preparation.",
      },
      {
        title: "Coaches",
        body: "Train athletes, prepare teams, guide performance, and support discipline.",
      },
      {
        title: "Team Captains",
        body: "Support student leadership, attendance, team discipline, and match-day coordination.",
      },
    ],
    members: [
      {
        name: "Sports Coordinator",
        role: "Department Lead",
        note: "Annual programme, teams, fixtures, and reports",
      },
      {
        name: "Teachers-in-Charge",
        role: "Team Management",
        note: "Sports teams, practices, and competition records",
      },
      {
        name: "Coaches and Captains",
        role: "Training and Leadership",
        note: "Athlete development, discipline, and performance",
      },
    ],
    gallery: [
      {
        title: "Team Training",
        body: "Practice sessions, athlete conditioning, team discipline, and student leadership.",
      },
      {
        title: "Sports Events",
        body: "Inter-house events, college fixtures, competitions, and achievement moments.",
      },
      {
        title: "Sports Records",
        body: "Team lists, results, awards, equipment, fixtures, and event reports.",
      },
    ],
    documents: [
      {
        title: "Fixtures and Practices",
        body: "Training schedules, match fixtures, venues, and transport notes.",
      },
      {
        title: "Team Lists",
        body: "Approved team lists, age groups, captains, and player records.",
      },
      {
        title: "Results and Awards",
        body: "Competition results, achievements, certificates, and sports reports.",
      },
    ],
    contact: {
      location: "Sports Office",
      hours: "School sports hours and practice times",
      email: "loyolacollege.negombo@hotmail.com",
    },
    staffDepartments: ["sports", "sports department", "physical education department"],
  },
  {
    id: `${COLLEGE_DEPARTMENT_BASE_ID}/counselling`,
    title: "Counselling",
    cardBody: "Student wellbeing and pastoral care",
    kicker: "The College",
    icon: Users,
    summary:
      "The Counselling Department supports student wellbeing through confidential guidance, pastoral care, referrals, family communication, and coordinated student support.",
    responsibilities: [
      "Provide confidential student counselling and guidance.",
      "Coordinate referrals and specialist support where required.",
      "Support students with social, emotional, and academic concerns.",
      "Maintain secure and confidential support records.",
      "Work with parents, section heads, and teachers when appropriate.",
      "Coordinate wellbeing and awareness programmes.",
    ],
    systemWork: [
      "Maintain authorized counselling referrals and appointments.",
      "Publish approved wellbeing information.",
      "Coordinate student support with authorized staff.",
      "Protect confidential records and access permissions.",
    ],
    serviceAreas: [
      "Student Wellbeing",
      "Guidance",
      "Pastoral Care",
      "Referrals",
      "Family Support",
      "Awareness Programmes",
    ],
    permissionLevel:
      "Counselling records are confidential and may only be accessed by specifically authorized staff. Public content must not expose private student information.",
    positions: [
      {
        title: "Counsellor",
        body: "Provides confidential guidance, referrals, wellbeing support, and coordinated pastoral care.",
      },
      {
        title: "Counselling Team Member",
        body: "Supports approved wellbeing programmes and student-support coordination.",
      },
    ],
    gallery: [],
    documents: [],
    contact: {
      location: "Counselling Unit",
      hours: "School office hours and scheduled appointments",
      email: "loyolacollege.negombo@hotmail.com",
    },
    staffDepartments: ["counselling", "counselling department", "counsellor"],
  },
];

const visibleCollegeDepartments = collegeDepartments.filter(
  (department) => !department.skipDepartmentPage,
);

const SKIPPED_COLLEGE_DEPARTMENT_PAGE_IDS = new Set(
  collegeDepartments
    .filter((department) => department.skipDepartmentPage)
    .map((department) => department.id),
);

const COLLEGE_DEPARTMENT_PAGE_IDS = new Set(
  visibleCollegeDepartments.map((department) => department.id),
);

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
  "job-vacancies",
  LCEA_PAGE_ID,
  "academics/cambridge",
  FACILITIES_PAGE_ID,
  ...COLLEGE_DEPARTMENT_PAGE_IDS,
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

function hasCompleteLiveVisualCapture(html?: string) {
  if (!html?.trim()) return false;
  return /data-website-section\s*=\s*["']Hero["']|<section\b[^>]*class\s*=\s*["'][^"']*\bhero\b/i.test(
    html,
  );
}

function shouldRenderVisualBuilder(
  pageId: string,
  page?: {
    visualMode?: "coded" | "visual";
    visualHtml?: string;
    visualCss?: string;
    visualBaseCss?: string;
  },
) {
  // Home always renders as the coded React component — the full visual builder
  // can set visualMode:"visual" for home but must never replace <HomePage />.
  if (pageId === "home") return false;
  if (!page?.visualHtml?.trim()) return false;
  if (!page.visualBaseCss?.trim() || !page.visualCss?.trim()) return false;
  if (!isLiveRenderedPage(pageId)) return true;
  return page.visualMode === "visual" && hasCompleteLiveVisualCapture(page.visualHtml);
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
    viewadmin: "View Admin",
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
  const searchParams =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  const forceCodedPreview =
    searchParams.has("websiteEditorPreview") && searchParams.get("codedPreview") === "1";

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
      ".reveal-on-scroll, .reveal-stagger, .public-site main > section",
    );
    elements.forEach((el) => {
      if (el.closest(".visual-page")) {
        el.classList.add("is-revealed");
        return;
      }
      const rect = el.getBoundingClientRect();
      const alreadyVisible = rect.top < window.innerHeight && rect.bottom > 0;
      if (!el.classList.contains("is-revealed")) {
        el.classList.add("reveal-on-scroll");
        if (alreadyVisible) {
          el.classList.add("is-revealed");
          return;
        }
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [path, db]);

  const pageIsLive = (id: string) =>
    !SKIPPED_COLLEGE_DEPARTMENT_PAGE_IDS.has(id) &&
    Boolean(db.pages[id]) &&
    (db.navigation.find((item) => item.id === id)?.visible ?? true);
  const visualPageId = canonicalVisualPageId(path, db);
  const requestedPageId = path.replace(/^\/+/, "");
  const staffPageIsLive = pageIsLive("about/college-staff") || pageIsLive("college-staff");
  const preferCodedRenderer =
    (path === "/calendar" && pageIsLive("calendar")) ||
    (path === "/job-vacancies" && pageIsLive("job-vacancies")) ||
    ([`/${LCEA_PAGE_ID}`, "/academics/cambridge"].includes(path) && pageIsLive(LCEA_PAGE_ID)) ||
    ([`/${FACILITIES_PAGE_ID}`, "/facilities", "/facilities-services"].includes(path) &&
      pageIsLive(FACILITIES_PAGE_ID)) ||
    (COLLEGE_DEPARTMENT_PAGE_IDS.has(requestedPageId) && pageIsLive(requestedPageId));
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
    (path === "/about/college-staff" || path === "/college-staff") &&
    staffPageIsLive
  ) {
    const requestedStaffPageId = path.replace(/^\/+/, "");
    return (
      <CollegeStaffPage
        pageId={pageIsLive(requestedStaffPageId) ? requestedStaffPageId : "about/college-staff"}
      />
    );
  }

  if (!isSystemPath && path.startsWith("/staff/")) {
    return (
      <CollegeStaffPage
        pageId="about/college-staff"
        profileSlug={path.split("/").filter(Boolean)[1] || ""}
      />
    );
  }

  if (
    !isSystemPath &&
    !preferCodedRenderer &&
    !forceCodedPreview &&
    pageIsLive(visualPageId) &&
    shouldRenderVisualBuilder(visualPageId, db.pages[visualPageId])
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
  if (path === "/job-vacancies" && pageIsLive("job-vacancies")) {
    return <JobVacanciesPage />;
  }
  if ([`/${LCEA_PAGE_ID}`, "/academics/cambridge"].includes(path) && pageIsLive(LCEA_PAGE_ID)) {
    return <LoyolianCambridgeEnglishAcademyPage />;
  }
  if (
    [`/${FACILITIES_PAGE_ID}`, "/facilities", "/facilities-services"].includes(path) &&
    pageIsLive(FACILITIES_PAGE_ID)
  ) {
    return <FacilitiesServicesPage />;
  }

  if (COLLEGE_DEPARTMENT_PAGE_IDS.has(requestedPageId) && pageIsLive(requestedPageId)) {
    return <CollegeDepartmentPage pageId={requestedPageId} />;
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
        pageId={
          path === "/about/college-history" || path === "/college-history"
            ? "about/college-history"
            : "about/past-rectors-vice-rectors"
        }
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
  if (path.startsWith("/sports-clubs/") && pageIsLive("sports-clubs")) {
    return <SportsClubsActivityPage activityId={decodeURIComponent(path.split("/").pop() || "")} />;
  }
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
  return (
    !SKIPPED_COLLEGE_DEPARTMENT_PAGE_IDS.has(id) &&
    Boolean(db.pages[id]) &&
    (db.navigation.find((item) => item.id === id)?.visible ?? true)
  );
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

  const cleanedVisualHtml = normalizeVisualBuilderHtml(sanitizeVisualHtml(page.visualHtml));
  const sanitizedHtml =
    pageId === "home"
      ? removeHomeVisualCalendarHighlights(
          normalizeLeadershipVisualHtml(cleanedVisualHtml, db.homeSections.leadershipCards),
        )
      : normalizeKennedyTitle(cleanedVisualHtml);
  const sanitizedBaseCss = sanitizeVisualCss(page.visualBaseCss);
  const sanitizedCss = sanitizeVisualCss(page.visualCss);
  const title = page.title || pageId.split("/").pop()?.replaceAll("-", " ") || "";
  const body = page.body && page.body.trim() !== "New page content goes here." ? page.body : "";

  return (
    <PublicLayout>
      <style>{VISUAL_BUILDER_STATIC_CSS}</style>
      {sanitizedBaseCss && <style>{sanitizedBaseCss}</style>}
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
    image:
      "https://loyolacollege.lk/uploads/site-images/visual-builder/1780529888865-cc345cce1545-1.sv_sir.jpg.webp",
  },
  {
    name: "J. E. Noyel Dabare Mahatha",
    years: "1987 - 1994",
    image:
      "https://loyolacollege.lk/uploads/site-images/visual-builder/1780529994959-d4403ab35329-2.noyel_sir.jpg.webp",
  },
  {
    name: "Rev. Fr. Leo Perera",
    years: "1994 - 1999",
    image:
      "https://loyolacollege.lk/uploads/site-images/visual-builder/1780640955756-81e9c2a637dd-3.fr_leo.webp",
  },
  {
    name: "Rev. Fr. Thilakasiri Fernando",
    years: "1995 - 1999",
    image:
      "https://loyolacollege.lk/uploads/site-images/visual-builder/1780641273682-e369bfe8b68e-4.fr_thilakasiri.webp",
  },
  {
    name: "Rev. Fr. Trevor G. Martin",
    years: "2000 - 2014",
    image:
      "https://loyolacollege.lk/uploads/site-images/visual-builder/1780641299221-918b6921337c-5.fr_trevo.webp",
  },
  {
    name: "Rev. Fr. Ranjith Andradi",
    years: "2014 - 2015",
    image:
      "https://loyolacollege.lk/uploads/site-images/visual-builder/1780641540736-0bbcf8bc1858-6.fr_ranjith.webp",
  },
  {
    name: "Rev. Fr. Sudath Gunetilleke",
    years: "2015 - 2021",
    image:
      "https://loyolacollege.lk/uploads/site-images/visual-builder/1780641675326-d4565d67bd2d-7.fr_sudath.webp",
  },
];

function editablePastRectorProfiles(page?: { pastRectorProfiles?: PastRectorProfile[] }) {
  const saved = page?.pastRectorProfiles;
  const source = Array.isArray(saved) && saved.length ? saved : pastRectorProfiles;
  return source.map((profile) => ({
    name: profile.name || "Past rector",
    years: profile.years || "",
    image: profile.image || "",
  }));
}

function isGenericPastRectorsVisualHtml(html?: string) {
  if (!html || html.includes("past-rectors-collage.jpeg")) return false;
  return (
    (html.includes("Past Rectors & Vice Rectors overview") ||
      html.includes("Former Leadership overview")) &&
    html.includes("Key information") &&
    html.includes("Next steps")
  );
}

function PastRectorsPage({ pageId = "about/college-history" }: { pageId?: string }) {
  const db = useDb();
  const defaultPage = {
    kicker: "Faith, Learning, Discipline, and Service",
    title: "Former Leadership",
    body: "Honouring the former rectors, vice rectors, and leadership who shaped Loyola College Negombo.",
    image: "",
  };
  const page = db.pages[pageId] || defaultPage;
  const visualHtml = page.visualHtml?.trim();
  const hasManagedProfiles =
    Array.isArray(page.pastRectorProfiles) && page.pastRectorProfiles.length > 0;
  if (
    !hasManagedProfiles &&
    shouldRenderVisualBuilder(pageId, page) &&
    !isGenericPastRectorsVisualHtml(visualHtml)
  ) {
    return <VisualBuilderPage pageId={pageId} />;
  }

  const body =
    page.body && page.body.trim() !== "New page content goes here." ? page.body : defaultPage.body;
  const profiles = editablePastRectorProfiles(page);

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
            <h2 className="mt-3 font-serif text-3xl font-bold text-navy">Former Leadership</h2>
            <div className="mt-6 overflow-hidden rounded-lg border border-border bg-white">
              <img
                src="/assets/past-rectors/past-rectors-collage.jpeg"
                alt="Former leadership collage"
                className="w-full object-contain"
              />
            </div>
          </div>

          <div className="mt-14">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
              Leadership Records
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-navy">
              Former Leadership Profiles
            </h2>
            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              {profiles.map((profile, index) => (
                <article
                  key={`${profile.name}-${index}`}
                  className="overflow-hidden rounded-xl border border-border bg-white shadow-soft"
                >
                  <div className="border-b border-border px-5 py-4">
                    <h3 className="font-serif text-2xl font-bold text-navy">{profile.name}</h3>
                    <p className="mt-1 text-sm font-bold uppercase tracking-[0.16em] text-crimson">
                      Service Period: {profile.years}
                    </p>
                  </div>
                  <img
                    src={profile.image || "/loyola-crest.jpg"}
                    alt={`${profile.name} leadership profile`}
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
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-crimson">Subpages</p>
            <h2 className="mt-3 font-serif text-4xl font-bold capitalize text-navy">
              {parentId === "home"
                ? "Explore More"
                : formatDisplayHeading(`${parentId.split("/").pop()?.replaceAll("-", " ")} pages`)}
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
                    {formatDisplayHeading(item.label)}
                  </p>
                  <h3 className="mt-2 font-serif text-2xl font-bold text-navy">
                    {formatDisplayHeading(title)}
                  </h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {page.body || "Open This Page for More Information"}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-crimson">
                    Open Page <ArrowRight className="h-4 w-4" />
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

type HomePhotoTone = "gold" | "crimson" | "blue" | "emerald";

const HOME_PHOTO_TONE_STYLES: Record<
  HomePhotoTone,
  { accent: string; overlay: string; border: string }
> = {
  gold: {
    accent: "text-gold-light",
    overlay:
      "bg-[linear-gradient(180deg,rgba(7,18,36,0)_18%,rgba(7,18,36,0.58)_74%,rgba(212,160,23,0.24)_100%)]",
    border: "from-gold/60 via-white/12 to-transparent",
  },
  crimson: {
    accent: "text-[#ffd2db]",
    overlay:
      "bg-[linear-gradient(180deg,rgba(7,18,36,0)_18%,rgba(7,18,36,0.56)_74%,rgba(183,15,27,0.24)_100%)]",
    border: "from-crimson/60 via-white/12 to-transparent",
  },
  blue: {
    accent: "text-[#d7e9ff]",
    overlay:
      "bg-[linear-gradient(180deg,rgba(7,18,36,0)_18%,rgba(7,18,36,0.56)_74%,rgba(37,99,235,0.24)_100%)]",
    border: "from-sky-500/60 via-white/12 to-transparent",
  },
  emerald: {
    accent: "text-[#dbfde9]",
    overlay:
      "bg-[linear-gradient(180deg,rgba(7,18,36,0)_18%,rgba(7,18,36,0.56)_74%,rgba(16,185,129,0.24)_100%)]",
    border: "from-emerald-500/60 via-white/12 to-transparent",
  },
};

const HOME_HERO_PANELS = [
  {
    src: "/flag1.png",
    alt: "Loyola College flag",
    title: "Identity",
    caption: "Veritate ad Lumen et Vitam",
    tone: "gold" as const,
  },
  {
    src: "/assets/past-rectors/sv-sir.jpeg",
    alt: "S. V. Fonseka",
    title: "Founding spirit",
    caption: "1949 - 1987",
    tone: "crimson" as const,
  },
  {
    src: "/assets/past-rectors/fr-leo.jpeg",
    alt: "Rev. Fr. Leo Perera",
    title: "Re-establishment",
    caption: "1994 - 1999",
    tone: "blue" as const,
  },
  {
    src: "/assets/past-rectors/fr-trevor.jpeg",
    alt: "Rev. Fr. Trevor Martin",
    title: "Growth years",
    caption: "2000 - 2014",
    tone: "emerald" as const,
  },
];

const HOME_LEGACY_PANELS = [
  {
    src: "/assets/past-rectors/sv-sir.jpeg",
    alt: "S. V. Fonseka",
    title: "S. V. Fonseka",
    caption: "The founding principal",
    tone: "gold" as const,
  },
  {
    src: "/assets/past-rectors/fr-leo.jpeg",
    alt: "Rev. Fr. Leo Perera",
    title: "Rev. Fr. Leo Perera",
    caption: "Re-established the college",
    tone: "crimson" as const,
  },
  {
    src: "/assets/past-rectors/fr-ranjith.jpeg",
    alt: "Rev. Fr. Ranjith Andradi",
    title: "Rev. Fr. Ranjith Andradi",
    caption: "Transition and direction",
    tone: "blue" as const,
  },
  {
    src: "/assets/past-rectors/fr-trevor.jpeg",
    alt: "Rev. Fr. Trevor Martin",
    title: "Rev. Fr. Trevor Martin",
    caption: "Expanded the campus",
    tone: "emerald" as const,
  },
  {
    src: "/assets/past-rectors/fr-sudath.jpeg",
    alt: "Rev. Fr. Sudath Gunetileke",
    title: "Rev. Fr. Sudath Gunetileke",
    caption: "Renewal and modern spaces",
    tone: "gold" as const,
  },
];

function HomePhotoTile({
  src,
  alt,
  title,
  caption,
  tone,
  className = "",
}: {
  src: string;
  alt: string;
  title: string;
  caption?: string;
  tone: HomePhotoTone;
  className?: string;
}) {
  const toneStyles = HOME_PHOTO_TONE_STYLES[tone];

  return (
    <article
      className={`group relative overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-br ${toneStyles.border} p-[1px] shadow-[0_24px_70px_-40px_rgba(10,22,40,0.72)] transition-smooth hover:-translate-y-1 hover:shadow-elegant ${className}`}
    >
      <div className="relative h-full overflow-hidden rounded-[27px] bg-navy">
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
        <div className={`absolute inset-0 ${toneStyles.overlay}`} />
        <div className="absolute inset-x-0 bottom-0 p-4">
          {caption && (
            <p
              className={`text-[10px] font-black uppercase italic tracking-[0.28em] ${toneStyles.accent}`}
            >
              {caption}
            </p>
          )}
          <h3 className="mt-2 text-lg font-bold leading-snug text-white">{title}</h3>
        </div>
      </div>
    </article>
  );
}

function parseStatNumber(value: string): { prefix: string; target: number; suffix: string } | null {
  const match = /^([^0-9]*)(\d[\d,]*)(.*)$/.exec(value.trim());
  if (!match) return null;
  const target = parseInt(match[2].replace(/,/g, ""), 10);
  if (isNaN(target) || target === 0) return null;
  return { prefix: match[1], target, suffix: match[3] };
}

function HomeMetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: HomePhotoTone;
}) {
  const toneClasses: Record<HomePhotoTone, string> = {
    gold: "from-[#10223f] via-[#0e1a30] to-[#7d5c0d]",
    crimson: "from-[#10223f] via-[#21122c] to-[#82131f]",
    blue: "from-[#112746] via-[#0f1d35] to-[#1d4ed8]",
    emerald: "from-[#0d2d2a] via-[#0f1d35] to-[#047857]",
  };
  const labelClasses: Record<HomePhotoTone, string> = {
    gold: "text-gold-light",
    crimson: "text-[#ffd2db]",
    blue: "text-[#d7e9ff]",
    emerald: "text-[#d5fae6]",
  };

  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parsed = parseStatNumber(value);
    if (!parsed) {
      setDisplay(value);
      return;
    }
    const { prefix, target, suffix } = parsed;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || animated.current) return;
        animated.current = true;
        const duration = 1600;
        const startTime = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - startTime) / duration, 1);
          const eased = 1 - (1 - progress) ** 3;
          const count = Math.round(eased * target);
          setDisplay(prefix + count.toLocaleString() + suffix);
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div
      ref={ref}
      className={`rounded-[24px] border border-white/14 bg-gradient-to-br ${toneClasses[tone]} p-4 shadow-[0_18px_48px_-32px_rgba(0,0,0,0.55)] backdrop-blur-xl`}
    >
      <p className={`text-[10px] font-black uppercase tracking-[0.28em] ${labelClasses[tone]}`}>
        {label}
      </p>
      <p className="mt-3 font-serif text-3xl font-bold leading-none text-white tabular-nums">
        {display}
      </p>
    </div>
  );
}

function HomeRequiredSections() {
  const db = useDb();
  const home = db.homeSections;
  const leadershipCards = mergedHomeLeadershipCards(home.leadershipCards || []);
  const sortByOrder = (a: { order?: number }, b: { order?: number }) =>
    (a.order ?? 0) - (b.order ?? 0);
  const visibleHomeCards = (cards: HomeContentCard[] = []) =>
    cards.filter((card) => card.visible !== false).slice().sort(sortByOrder);
  const quickActions = visibleHomeCards(home.quickActions).map((card) => ({
    id: card.id,
    title: card.title,
    body: card.body || "",
    href: card.href || "#",
    icon: resolveContentIcon(card.icon),
  }));
  const clubs = visibleHomeCards(home.extraCurricularCards).map((card) => ({
    id: card.id,
    title: card.title,
    href: card.href || "#",
    icon: resolveContentIcon(card.icon),
  }));
  const academicPreviews = visibleHomeCards(home.academicCards).map((card) => ({
    id: card.id,
    title: card.title,
    body: card.body || "",
    icon: resolveContentIcon(card.icon),
  }));
  const facilities = visibleCollegeDepartments.map((department) => ({
    title: department.title,
    body: department.cardBody,
    icon: department.icon,
    href: `/${department.id}`,
  }));
  const pageIsLive = (href: string) => {
    const id = href.replace(/^\/+/, "") || "home";
    return Boolean(db.pages[id]) && (db.navigation.find((item) => item.id === id)?.visible ?? true);
  };
  const quickActionStyles = [
    {
      card: "bg-[linear-gradient(135deg,#fff8e7_0%,#ffffff_52%,#f5efe1_100%)]",
      icon: "bg-gold/15 text-gold",
      bar: "from-gold via-[#f3ce78] to-[#b7791f]",
    },
    {
      card: "bg-[linear-gradient(135deg,#fff2f4_0%,#ffffff_52%,#ffe5ea_100%)]",
      icon: "bg-crimson/10 text-crimson",
      bar: "from-crimson via-[#f49cab] to-[#8f1220]",
    },
    {
      card: "bg-[linear-gradient(135deg,#eef6ff_0%,#ffffff_52%,#e2f0ff_100%)]",
      icon: "bg-sky-100 text-sky-700",
      bar: "from-sky-500 via-[#60a5fa] to-[#1d4ed8]",
    },
    {
      card: "bg-[linear-gradient(135deg,#ecfbf5_0%,#ffffff_52%,#daf7e8_100%)]",
      icon: "bg-emerald-100 text-emerald-700",
      bar: "from-emerald-500 via-[#34d399] to-[#047857]",
    },
  ] as const;
  const clubStyles = [
    {
      card: "bg-[linear-gradient(135deg,#fff8e7_0%,#ffffff_54%,#f5efe1_100%)]",
      icon: "bg-gold/15 text-gold",
      bar: "from-gold via-[#f3ce78] to-[#b7791f]",
    },
    {
      card: "bg-[linear-gradient(135deg,#fff2f4_0%,#ffffff_54%,#ffe5ea_100%)]",
      icon: "bg-crimson/10 text-crimson",
      bar: "from-crimson via-[#f49cab] to-[#8f1220]",
    },
    {
      card: "bg-[linear-gradient(135deg,#eef6ff_0%,#ffffff_54%,#e2f0ff_100%)]",
      icon: "bg-sky-100 text-sky-700",
      bar: "from-sky-500 via-[#60a5fa] to-[#1d4ed8]",
    },
    {
      card: "bg-[linear-gradient(135deg,#ecfbf5_0%,#ffffff_54%,#daf7e8_100%)]",
      icon: "bg-emerald-100 text-emerald-700",
      bar: "from-emerald-500 via-[#34d399] to-[#047857]",
    },
    {
      card: "bg-[linear-gradient(135deg,#f1f5ff_0%,#ffffff_54%,#e3e9ff_100%)]",
      icon: "bg-indigo-100 text-indigo-700",
      bar: "from-indigo-500 via-[#818cf8] to-[#4338ca]",
    },
    {
      card: "bg-[linear-gradient(135deg,#fff6f5_0%,#ffffff_54%,#ffe4e1_100%)]",
      icon: "bg-rose-100 text-rose-700",
      bar: "from-rose-500 via-[#fb7185] to-[#be123c]",
    },
  ] as const;
  const academicStyles = [
    {
      card: "bg-[linear-gradient(135deg,#fffdf4_0%,#ffffff_58%,#f8efd9_100%)]",
      icon: "bg-gold/15 text-gold",
    },
    {
      card: "bg-[linear-gradient(135deg,#fff7f8_0%,#ffffff_58%,#fbe1e5_100%)]",
      icon: "bg-crimson/10 text-crimson",
    },
    {
      card: "bg-[linear-gradient(135deg,#eef6ff_0%,#ffffff_58%,#deebff_100%)]",
      icon: "bg-sky-100 text-sky-700",
    },
    {
      card: "bg-[linear-gradient(135deg,#ecfbf5_0%,#ffffff_58%,#d4f7e5_100%)]",
      icon: "bg-emerald-100 text-emerald-700",
    },
  ] as const;
  const facilityStyles = [
    "bg-gold/15 text-gold",
    "bg-crimson/10 text-crimson",
    "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700",
    "bg-indigo-100 text-indigo-700",
    "bg-rose-100 text-rose-700",
  ] as const;

  return (
    <>
      <section
        data-home-reveal
        className="reveal-on-scroll bg-[radial-gradient(circle_at_top_right,rgba(212,160,23,0.12),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(183,15,27,0.08),transparent_38%),linear-gradient(180deg,#f0f6ff_0%,#e8f0fe_100%)] py-10 md:py-14"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="stagger-fast grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((item, index) => {
              const Icon = item.icon;
              const style = quickActionStyles[index % quickActionStyles.length];
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className={`group relative overflow-hidden rounded-[28px] border border-white/70 px-6 py-7 shadow-[0_18px_48px_-34px_rgba(10,22,40,0.48)] transition-smooth hover:-translate-y-1 hover:shadow-elegant ${style.card}`}
                >
                  <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.bar}`} />
                  <span className={`grid h-12 w-12 place-items-center rounded-2xl ${style.icon}`}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <h2 className="mt-5 font-serif text-2xl font-bold text-navy">{item.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-crimson">
                    Open <ArrowRight className="h-4 w-4" />
                  </span>
                </a>
              );
            })}
          </div>

        </div>
      </section>

      <section
        data-home-reveal
        className="reveal-on-scroll bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.07),transparent_38%),linear-gradient(180deg,#fafcff_0%,#f2f7ff_100%)] py-12 md:py-16"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="reveal-from-left text-xs font-bold uppercase tracking-[0.22em] text-crimson">
                {home.academicEyebrow}
              </p>
              <h2 className="reveal-from-left mt-3 font-serif text-4xl font-bold text-navy" style={{ transitionDelay: "0.1s" }}>
                {home.academicTitle}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {home.academicSubtitle}
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
          <div className="stagger-fast mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {academicPreviews.map((item, index) => {
              const Icon = item.icon;
              const style = academicStyles[index % academicStyles.length];
              return (
                <article
                  key={item.id}
                  className={`group card-glow rounded-[28px] border border-white/70 p-6 shadow-[0_18px_48px_-34px_rgba(10,22,40,0.45)] transition-smooth hover:-translate-y-1 hover:shadow-elegant ${style.card}`}
                >
                  <span className={`grid h-11 w-11 place-items-center rounded-2xl ${style.icon}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-serif text-xl font-bold text-navy">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-14 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="reveal-from-left text-xs font-bold uppercase tracking-[0.22em] text-crimson">
                {home.extraCurricularEyebrow}
              </p>
              <h2 className="reveal-from-left mt-3 font-serif text-4xl font-bold text-navy" style={{ transitionDelay: "0.1s" }}>{home.extraCurricularTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {home.extraCurricularSubtitle}
              </p>
            </div>
          </div>
          <div className="stagger-fast mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {clubs.map((club, index) => {
              const Icon = club.icon;
              const style = clubStyles[index % clubStyles.length];
              return (
                <a
                  key={club.id}
                  href={club.href}
                  className={`group relative overflow-hidden rounded-[28px] border border-white/70 p-5 text-left shadow-[0_18px_48px_-34px_rgba(10,22,40,0.45)] transition-smooth hover:-translate-y-1 hover:shadow-elegant ${style.card}`}
                >
                  <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.bar}`} />
                  <span className={`grid h-12 w-12 place-items-center rounded-2xl ${style.icon}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                    {club.title}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    A creative and active space for Loyola students.
                  </p>
                </a>
              );
            })}
          </div>

          <div className="mt-14 rounded-[32px] border border-white/12 bg-[linear-gradient(135deg,#071224_0%,#0b1d34_42%,#102a4f_68%,#1d4ed8_100%)] px-5 py-8 text-white shadow-[0_28px_80px_-42px_rgba(7,18,36,0.95)] md:px-8 md:py-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-light">
                  {home.officeEyebrow}
                </p>
                <h2 className="mt-3 font-serif text-4xl font-bold md:text-5xl">
                  {home.officeTitle}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
                  {home.officeDescription}
                </p>
              </div>
            </div>
            <div className="mx-auto mt-8 grid max-w-6xl gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {facilities.map((item, index) => {
                const Icon = item.icon;
                const style = facilityStyles[index % facilityStyles.length];
                return (
                  <a
                    key={item.title}
                    href={item.href}
                    className="group relative overflow-hidden rounded-[26px] border border-white/12 bg-white/95 p-5 text-navy shadow-[0_22px_50px_-36px_rgba(10,22,40,0.45)] transition-smooth hover:-translate-y-1 hover:shadow-elegant"
                  >
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-crimson to-navy opacity-0 transition group-hover:opacity-100" />
                    <span className="grid grid-cols-[48px_1fr_auto] items-start gap-4">
                      <span className={`grid h-12 w-12 place-items-center rounded-2xl ${style}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-serif text-lg font-bold leading-tight text-navy">
                          {item.title}
                        </span>
                        <span className="mt-1 block text-sm leading-6 text-slate-500">
                          {item.body}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-crimson" />
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section
        data-home-reveal
        className="reveal-on-scroll bg-[radial-gradient(circle_at_top_left,rgba(255,214,102,0.12),transparent_26%),linear-gradient(135deg,#071224_0%,#102a4f_52%,#8f111d_100%)] py-12 md:py-16"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/8 p-5 text-white shadow-[0_28px_80px_-42px_rgba(7,18,36,0.95)] ring-1 ring-white/10 md:p-8 lg:p-9">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0)_42%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gold/60" />

            <div className="relative">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="reveal-from-left text-xs font-black uppercase text-gold">Annual school schedule</p>
                  <h2 className="reveal-from-left mt-2 font-serif text-4xl font-bold leading-tight md:text-5xl" style={{ transitionDelay: "0.1s" }}>
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

              <div className="mx-auto mt-8 max-w-5xl">
                <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_24px_70px_-38px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
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
                    className="h-[520px] bg-white md:h-[580px]"
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

      <section
        data-home-reveal
        data-website-section="Leadership"
        className="reveal-on-scroll bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] py-14 md:py-20"
      >
        <div className="mx-auto max-w-7xl px-5 text-center sm:px-6">
          <p className="reveal-from-left text-xs font-bold uppercase tracking-[0.22em] text-crimson">
            Administration board
          </p>
          <h2 className="reveal-from-left mt-3 font-serif text-4xl font-bold text-navy md:text-5xl" style={{ transitionDelay: "0.1s" }}>
            {home.leadershipTitle || "Leadership guiding Loyola College"}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-500">
            {home.leadershipBody ||
              "The dedicated administration board steering our institution towards academic and spiritual excellence."}
          </p>
          <div className="stagger-fast mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {leadershipCards.map((card) => (
              <article key={card.id} className="text-center">
                <div className="card-img-zoom overflow-hidden rounded-[28px] bg-[#909090] shadow-soft">
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
  const db = useDb();
  const home = db.homeSections;
  const content = db.websiteContent;
  const heroImage = db.media.campusImage || content.heroImage || DEFAULT_HERO_IMAGE;
  const logoImage = content.logoImage || "/loyola-crest.jpg";

  const panels = [
    {
      key: "vision",
      icon: Eye,
      num: "01",
      title: "Our Vision",
      body: "To announce God's Kingdom through Christian values, nurturing every student to reach their fullest human and spiritual potential.",
      bullets: null as string[] | null,
      image: home.visionImage || heroImage,
      accent: "#d4a017",
      glowBg: "rgba(212,160,23,0.35)",
      barGrad: "linear-gradient(90deg,#d4a017,#f3ce78,transparent)",
    },
    {
      key: "mission",
      icon: CheckCircle2,
      num: "02",
      title: "Our Mission",
      body: "",
      bullets: [
        "Provide a holistic education that nurtures the intellectual, physical, moral, and spiritual development of every student.",
        "Cultivate men and women of integrity, compassion, and leadership.",
        "Encourage a commitment to excellence, lifelong learning, and service to society.",
        "Guide students through Christian values and principles.",
        "Empower students to become responsible global citizens.",
        "Inspire students to contribute meaningfully to the advancement of their communities and the world.",
      ],
      image: home.missionImage || db.gallery[0]?.image || HOME_LEGACY_PANELS[3]?.src || heroImage,
      accent: "#b70f1b",
      glowBg: "rgba(183,15,27,0.35)",
      barGrad: "linear-gradient(90deg,#b70f1b,#f49cab,transparent)",
    },
    {
      key: "motto",
      icon: Trophy,
      num: "03",
      title: "Our Motto",
      body: '"Veritate ad Lumen et Vitam"\n\'In truth to light and life\'',
      bullets: null as string[] | null,
      image: home.mottoImage || HOME_LEGACY_PANELS[0]?.src || heroImage,
      accent: "#3b82f6",
      glowBg: "rgba(59,130,246,0.35)",
      barGrad: "linear-gradient(90deg,#3b82f6,#93c5fd,transparent)",
    },
  ];

  return (
    <section
      data-home-reveal
      data-website-section="About College"
      className="reveal-on-scroll relative overflow-hidden bg-[#030b16] py-20 md:py-32"
    >
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 select-none">
        <div className="absolute -left-48 top-0 h-[700px] w-[700px] rounded-full bg-[#d4a017]/6 blur-[140px]" />
        <div className="absolute -right-48 bottom-0 h-[700px] w-[700px] rounded-full bg-[#b70f1b]/6 blur-[140px]" />
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-blue-900/5 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.022]"
          style={{ backgroundImage: "radial-gradient(circle,rgba(255,255,255,0.8) 1px,transparent 1px)", backgroundSize: "36px 36px" }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6">

        {/* ── Section heading ── */}
        <div className="mb-14 text-center">
          <p className="reveal-from-left inline-block text-[10px] font-black uppercase tracking-[0.44em] text-gold">
            Est. 1949 · Negombo, Sri Lanka
          </p>
          <h2 className="reveal-from-left mt-4 font-serif text-4xl font-bold text-white md:text-5xl" style={{ transitionDelay: "0.1s" }}>
            Our Identity &amp; Purpose
          </h2>
          <div className="mx-auto mt-5 h-px w-16 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/45">
            Rooted in Jesuit tradition, we form students of faith, intellect, and compassion — ready to serve God and society.
          </p>
        </div>

        {/* ── Expanding cards ── */}
        <div className="expand-cards">
          {panels.map((p) => {
            const Icon = p.icon;
            return (
              <article
                key={p.key}
                className="expand-card group relative overflow-hidden rounded-[28px] bg-[#030b16]"
              >
                {/* Image layer */}
                <div className="relative h-[220px] w-full overflow-hidden md:h-[560px]">
                  <img
                    src={p.image}
                    alt={p.title}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                  />

                  {/* Two-layer gradient: subtle color at top, dark at bottom */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(to top, #030b16 0%, rgba(3,11,22,0.52) 45%, transparent 72%), linear-gradient(to bottom, ${p.accent}20 0%, transparent 40%)`,
                    }}
                  />

                  {/* Watermark number — editorial premium feel */}
                  <span className="pointer-events-none absolute -right-3 top-2 select-none font-serif text-[128px] font-black leading-none text-white opacity-[0.06]">
                    {p.num}
                  </span>

                  {/* Top accent strip */}
                  <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-[28px]"
                    style={{ background: p.barGrad }} />

                  {/* Bottom ambient glow on hover */}
                  <div
                    className="pointer-events-none absolute -bottom-8 left-1/2 h-28 w-4/5 -translate-x-1/2 rounded-full blur-3xl opacity-0 transition-opacity duration-700 group-hover:opacity-55"
                    style={{ backgroundColor: p.glowBg }}
                  />
                </div>

                {/* Content panel */}
                <div className="relative p-5 md:absolute md:inset-x-0 md:bottom-0 md:p-8">

                  {/* Colored icon badge */}
                  <div
                    className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border backdrop-blur-md transition-all duration-300"
                    style={{
                      backgroundColor: `${p.accent}20`,
                      borderColor: `${p.accent}35`,
                    }}
                  >
                    <Icon className="h-4 w-4" style={{ color: p.accent }} />
                  </div>

                  {/* Title */}
                  <h3 className="font-serif text-[1.85rem] font-bold leading-tight tracking-[-0.01em] text-white md:text-[2.1rem]">
                    {p.title}
                  </h3>

                  {/* Accent underline — grows on hover */}
                  <div className="expand-card-bar mt-3" style={{ background: p.barGrad }} />

                  {/* Body text — revealed on hover */}
                  <div className="expand-card-body mt-4">
                    {p.key === "motto" ? (
                      <p className="font-serif italic leading-relaxed text-white/90">
                        {p.body.split("\n").map((line, idx) => (
                          <span key={idx} className={`block ${idx === 0 ? "text-lg font-semibold not-italic text-white" : "mt-2 text-sm text-white/65"}`}>
                            {line}
                          </span>
                        ))}
                      </p>
                    ) : p.bullets ? (
                      <ul className="space-y-2">
                        {p.bullets.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-sm leading-snug text-white/75">
                            <span
                              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: p.accent }}
                            />
                            {point}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p
                        className={`text-sm leading-[1.9] text-white/72 ${p.key === "motto" ? "italic" : ""}`}
                      >
                        {p.body}
                      </p>
                    )}
                  </div>
                </div>

                {/* Hover border glow matching accent */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 transition-all duration-500"
                  style={{
                    boxShadow: "none",
                  }}
                />
                <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/8 transition-all duration-500 group-hover:ring-white/20" />
              </article>
            );
          })}
        </div>

        {/* ── Pillar badges ── */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
          {[
            { label: "Faith",       color: "#d4a017", bg: "rgba(212,160,23,0.08)" },
            { label: "Learning",    color: "#b70f1b", bg: "rgba(183,15,27,0.08)" },
            { label: "Discipline",  color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
            { label: "Service",     color: "#10b981", bg: "rgba(16,185,129,0.08)" },
          ].map(({ label, color, bg }) => (
            <span
              key={label}
              className="inline-flex cursor-default items-center gap-2.5 rounded-full border px-7 py-3 text-[10px] font-black uppercase tracking-[0.32em] backdrop-blur-sm transition-all duration-300"
              style={{
                borderColor: `${color}25`,
                backgroundColor: bg,
                color: `${color}80`,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = color;
                (e.currentTarget as HTMLElement).style.borderColor = `${color}55`;
                (e.currentTarget as HTMLElement).style.backgroundColor = `${color}15`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = `${color}80`;
                (e.currentTarget as HTMLElement).style.borderColor = `${color}25`;
                (e.currentTarget as HTMLElement).style.backgroundColor = bg;
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>

      </div>
    </section>
  );
}

const MOSAIC_FALLBACK_IMGS = [
  { src: "/assets/past-rectors/fr-trevor.jpeg", label: "Sports & Activities" },
  { src: "/assets/past-rectors/fr-sudath.jpeg", label: "Arts & Culture" },
  { src: "/flag1.png", label: "Faith & Values" },
  { src: "/assets/past-rectors/sv-sir.jpeg", label: "Heritage" },
  { src: "/assets/past-rectors/fr-leo.jpeg", label: "Community" },
];

const MOSAIC_TONES: HomePhotoTone[] = ["crimson", "blue", "emerald", "gold", "crimson"];

function HomeCampusMosaic() {
  const db = useDb();
  const heroImage = db.media.campusImage || db.websiteContent.heroImage || DEFAULT_HERO_IMAGE;
  const galleryImages = (db.gallery || [])
    .filter((g) => g.visible !== false && g.image)
    .slice(0, 5)
    .map((g, i) => ({ src: g.image, label: g.label || MOSAIC_FALLBACK_IMGS[i]?.label || "Campus Life" }));

  const smallTiles = MOSAIC_FALLBACK_IMGS.map((fallback, i) => ({
    src: galleryImages[i]?.src || fallback.src,
    label: galleryImages[i]?.label || fallback.label,
    tone: MOSAIC_TONES[i],
  }));

  return (
    <section
      data-home-reveal
      className="reveal-on-scroll bg-[radial-gradient(circle_at_top_right,rgba(183,15,27,0.22),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(255,214,102,0.18),transparent_36%),linear-gradient(160deg,#071020_0%,#0d1f3c_55%,#0a1628_100%)] py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="reveal-from-left text-xs font-black uppercase tracking-[0.28em] text-gold-light">
              Campus Life
            </p>
            <h2 className="reveal-from-left mt-4 font-serif text-4xl font-bold text-white md:text-5xl" style={{ transitionDelay: "0.1s" }}>
              Life at Loyola
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/68">
              A campus alive with learning, faith, sport, and discovery — every single day.
            </p>
          </div>
          <a
            href="/gallery/photo-gallery"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur transition-smooth hover:-translate-y-0.5 hover:bg-white/15"
          >
            Full Gallery
            <Images className="h-4 w-4" />
          </a>
        </div>

        <div className="stagger-fast grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Large main tile */}
          <article className="mosaic-tile group relative overflow-hidden rounded-[28px] border border-white/15 shadow-[0_24px_70px_-38px_rgba(10,22,40,0.9)] lg:col-span-2 lg:row-span-2">
            <div className="relative h-72 lg:h-full lg:min-h-[28rem] overflow-hidden bg-navy">
              <img
                src={heroImage}
                alt="Loyola College campus"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,18,36,0)_22%,rgba(7,18,36,0.72)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <span className="inline-block rounded-full bg-gold/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.26em] text-gold-light backdrop-blur">
                  Our Campus
                </span>
                <h3 className="mt-3 font-serif text-2xl font-bold text-white md:text-3xl">
                  Where Every Story Begins
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/72">
                  75+ years of faith, learning, and transformation.
                </p>
              </div>
            </div>
          </article>

          {/* Small tiles */}
          {smallTiles.slice(0, 4).map((tile) => (
            <article
              key={tile.label}
              className="mosaic-tile group relative overflow-hidden rounded-[28px] border border-white/15 shadow-[0_18px_50px_-32px_rgba(10,22,40,0.75)]"
            >
              <div className="relative h-48 overflow-hidden bg-navy">
                <img
                  src={tile.src}
                  alt={tile.label}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-108"
                />
                <div
                  className={`absolute inset-0 ${
                    tile.tone === "gold"
                      ? "bg-[linear-gradient(180deg,rgba(7,18,36,0)_20%,rgba(7,18,36,0.65)_78%,rgba(212,160,23,0.22)_100%)]"
                      : tile.tone === "crimson"
                        ? "bg-[linear-gradient(180deg,rgba(7,18,36,0)_20%,rgba(7,18,36,0.65)_78%,rgba(183,15,27,0.22)_100%)]"
                        : tile.tone === "blue"
                          ? "bg-[linear-gradient(180deg,rgba(7,18,36,0)_20%,rgba(7,18,36,0.65)_78%,rgba(37,99,235,0.22)_100%)]"
                          : "bg-[linear-gradient(180deg,rgba(7,18,36,0)_20%,rgba(7,18,36,0.65)_78%,rgba(16,185,129,0.22)_100%)]"
                  }`}
                />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p
                    className={`text-[10px] font-black uppercase tracking-[0.26em] ${
                      tile.tone === "gold"
                        ? "text-gold-light"
                        : tile.tone === "crimson"
                          ? "text-[#ffd2db]"
                          : tile.tone === "blue"
                            ? "text-[#d7e9ff]"
                            : "text-[#d5fae6]"
                    }`}
                  >
                    {tile.label}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Bottom colour-strip stats row */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { value: "75+", label: "Years of Excellence", color: "from-gold/30 to-gold/10 border-gold/30" },
            { value: "2,688", label: "Students Enrolled", color: "from-crimson/30 to-crimson/10 border-crimson/30" },
            { value: "150+", label: "Teaching Staff", color: "from-sky-500/30 to-sky-500/10 border-sky-400/30" },
            { value: "30+", label: "Active Clubs", color: "from-emerald-500/30 to-emerald-500/10 border-emerald-400/30" },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-[20px] border bg-gradient-to-br ${s.color} p-4 text-center backdrop-blur`}
            >
              <p className="font-serif text-2xl font-bold text-white">{s.value}</p>
              <p className="mt-1 text-[11px] font-semibold text-white/65">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeNewsTicker() {
  const db = useDb();
  const items = db.news.slice(0, 8);
  if (items.length === 0) return null;
  const doubled = [...items, ...items];
  return (
    <div data-website-section="News Ticker" className="relative overflow-hidden border-b border-navy/15 bg-navy">
      <div className="flex items-stretch">
        <div className="z-10 flex flex-shrink-0 items-center gap-2.5 border-r border-white/15 bg-crimson px-5 py-3">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.28em] text-white">
            Latest
          </span>
        </div>
        <div className="news-ticker-overflow flex-1">
          <div className="news-ticker-track">
            {doubled.map((item, i) => (
              <a
                key={i}
                href="/news"
                className="inline-flex items-center gap-3 px-8 py-3 text-sm text-white/75 transition-colors hover:text-gold-light"
              >
                <span className="text-gold/50">◆</span>
                {item.title}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeRectorsMessage() {
  const db = useDb();
  const home = db.homeSections;
  const rectorImage =
    home.rectorImage || db.media.principalImage || "/loyola-crest.jpg";
  const rectorName = home.rectorName || "Rev. Dr. D.M.J. Kennedy Perera";
  const rectorDesig = home.rectorDesignation || "Rector / Principal";
  const rectorBody =
    home.rectorBody ||
    "Loyola College stands as a beacon of faith, learning, discipline, and service — an institution that has shaped generations of young minds over 75 years. We are committed to excellence in every dimension of school life, nurturing students to become upright citizens who serve God and country.";
  const previewBody =
    rectorBody.length > 240 ? rectorBody.substring(0, 240).trim() + "…" : rectorBody;

  return (
    <section
      data-home-reveal
      className="reveal-on-scroll bg-[radial-gradient(ellipse_at_top_left,rgba(212,160,23,0.10),transparent_44%),linear-gradient(180deg,#fdfaf4_0%,#fffef9_50%,#f8f4e8_100%)] py-20 md:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="grid gap-14 lg:grid-cols-[400px_1fr] lg:items-center">
          {/* Photo */}
          <div className="reveal-scale relative mx-auto max-w-sm lg:mx-0">
            <div className="absolute -inset-6 rounded-[44px] bg-gradient-to-br from-gold/20 to-transparent" />
            <div className="relative overflow-hidden rounded-[32px] border-4 border-white shadow-[0_32px_80px_-24px_rgba(10,22,40,0.30)]">
              <img
                src={rectorImage}
                alt={rectorName}
                className="aspect-[3/4] w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(10,22,40,0.88)_100%)] px-6 py-5">
                <p className="font-serif text-lg font-bold text-white">{rectorName}</p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.20em] text-gold-light">
                  {rectorDesig}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div>
            <p className="reveal-from-left text-xs font-black uppercase tracking-[0.30em] text-crimson">
              Rector's Welcome
            </p>
            <h2 className="reveal-from-left mt-5 font-serif text-4xl font-bold text-navy md:text-5xl" style={{ transitionDelay: "0.1s" }}>
              {home.rectorHeading || "A Message from Our Rector"}
            </h2>
            <div className="mt-6 h-0.5 w-16 bg-gradient-to-r from-gold to-gold/20" />
            <div className="relative mt-7 border-l-4 border-gold/60 pl-8">
              <span className="absolute -top-4 -left-1 font-serif text-6xl leading-none text-gold/25 font-bold select-none">
                "
              </span>
              <p className="font-display text-xl italic leading-8 text-navy/78">{previewBody}</p>
            </div>
            <div className="mt-8 flex items-center gap-4">
              <div className="h-px w-12 bg-gold/40" />
              <span className="font-serif text-base font-bold text-navy">{rectorName}</span>
            </div>
            <p className="mt-1.5 text-[11px] font-black uppercase tracking-[0.20em] text-crimson ml-16">
              {rectorDesig}
            </p>
            <div className="mt-8">
              <a
                href="/about"
                className="btn-shimmer inline-flex items-center gap-2 rounded-full bg-navy px-7 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(10,22,40,0.30)] transition-smooth hover:-translate-y-0.5 hover:bg-navy-mid"
              >
                Read Full Message
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeAdmissionsCTA() {
  const db = useDb();
  const home = db.homeSections;
  const pageIsLive = (href: string) => {
    const id = href.replace(/^\/+/, "") || "home";
    return Boolean(db.pages[id]) && (db.navigation.find((item) => item.id === id)?.visible ?? true);
  };

  return (
    <section
      data-home-reveal
      data-website-section="Admissions CTA"
      className="reveal-on-scroll relative overflow-hidden bg-[linear-gradient(135deg,#071224_0%,#0d1e3d_42%,#8a0a13_100%)] py-20 md:py-28"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold/20 blur-[72px]" />
        <div className="absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-crimson/25 blur-[60px]" />
        <div className="absolute top-1/2 left-1/2 h-64 w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/4 blur-[48px]" />
      </div>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />

      <div className="relative mx-auto max-w-5xl px-5 text-center sm:px-6">
        <p className="reveal-from-left text-[11px] font-black uppercase tracking-[0.36em] text-gold-light">
          {home.admissionsCtaKicker || "Admissions Open"}
        </p>
        <h2 className="reveal-from-left mt-5 font-serif text-4xl font-bold leading-tight text-white md:text-6xl" style={{ transitionDelay: "0.12s" }}>
          {home.admissionsCtaTitle || "Join the Loyola Family"}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/65">
          Be part of a 75-year legacy of faith, learning, discipline, and service. Applications are
          now open for the new academic year.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {pageIsLive("/admissions") && (
            <a
              href="/admissions"
              className="btn-shimmer inline-flex items-center gap-2 rounded-full bg-gold px-9 py-4 text-sm font-bold text-navy shadow-[0_14px_40px_rgba(212,160,23,0.55)] transition-smooth hover:-translate-y-1 hover:shadow-[0_22px_54px_rgba(212,160,23,0.65)]"
            >
              {home.admissionsCtaButton || "Apply Now"}
              <ArrowRight className="h-4 w-4" />
            </a>
          )}
          {pageIsLive("/contact") && (
            <a
              href="/contact"
              className="btn-shimmer inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-9 py-4 text-sm font-bold text-white backdrop-blur-sm transition-smooth hover:-translate-y-1 hover:bg-white/18"
            >
              Contact Admissions
              <Mail className="h-4 w-4" />
            </a>
          )}
        </div>

        <div className="stagger-fast mt-12 sm:mt-16 flex flex-col sm:flex-row border-t border-white/15 pt-8 sm:pt-12">
          {[
            { value: "75+", label: "Years of Excellence" },
            { value: "2,688", label: "Students Enrolled" },
            { value: "150+", label: "Qualified Teachers" },
          ].map((s, i) => (
            <div key={s.label} className={`flex-1 py-6 px-4 text-center sm:py-0 sm:px-6 ${i > 0 ? "border-t sm:border-t-0 sm:border-l border-white/15" : ""}`}>
              <p className="font-serif text-3xl font-bold text-gold md:text-4xl">{s.value}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomePage() {
  const db = useDb();
  const content = db.websiteContent;
  const page = db.pages.home || {};
  const home = db.homeSections;
  const heroMotto = content.heroText?.trim() || content.tagline?.trim() || "Veritate ad Lumen et Vitam";
  const heroImage = page.image || content.heroImage || db.media.campusImage || DEFAULT_HERO_IMAGE;
  const logoImage = content.logoImage || "/loyola-crest.jpg";
  const parallaxRef = useRef<HTMLDivElement>(null);

  // Scroll-triggered reveals for all data-home-reveal sections
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-home-reveal]");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.07 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Parallax on hero blobs
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (parallaxRef.current) {
          parallaxRef.current.style.transform = `translateY(${window.scrollY * 0.14}px)`;
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <PublicLayout>
      {/* ── FULL-SCREEN CINEMATIC HERO ── */}
      <section
        data-website-section="Hero"
        className="relative flex min-h-screen flex-col overflow-hidden text-white"
      >
        {/* Background video / image */}
        <HeroBackgroundLayer
          fallbackImage={heroImage}
          fallbackOpacity={0.55}
          mediaUrl={page.backgroundMediaUrl || undefined}
          mediaWebmUrl={page.backgroundMediaWebmUrl || undefined}
          mediaType={(page.backgroundMediaType as "image" | "video" | "") || undefined}
          mediaOpacity={page.backgroundMediaOpacity ?? (page.backgroundMediaType === "video" ? 0.65 : 0.55)}
          gradientClassName="bg-[linear-gradient(180deg,rgba(7,18,36,0.55)_0%,rgba(7,18,36,0.38)_38%,rgba(7,18,36,0.72)_100%)]"
          gridOpacityClassName="opacity-[0.04]"
        />

        {/* Parallax ambient blobs */}
        <div ref={parallaxRef} className="hero-blobs-parallax absolute inset-0 pointer-events-none">
          <div className="absolute -left-32 top-16 h-80 w-80 rounded-full bg-gold/18 blur-[80px] animate-float" />
          <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-crimson/15 blur-[80px] animate-float animation-delay-2" />
          <div className="absolute bottom-20 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-navy/30 blur-[60px]" />
        </div>

        {/* Centred brand content — my-auto centers without clipping top on short viewports */}
        <div className="relative z-10 my-auto flex w-full flex-col items-center px-5 py-16 text-center sm:px-8">
          {/* Glowing crest — drops in first */}
          <div className="relative hero-crest-reveal">
            <div className="absolute inset-0 scale-150 rounded-full bg-gold/25 blur-3xl" />
            <div className="relative rounded-full border-4 border-gold/55 bg-white/10 p-2 shadow-[0_0_72px_rgba(212,160,23,0.45)] backdrop-blur-sm">
              <img
                src={logoImage}
                alt="Loyola College crest"
                className="h-28 w-28 rounded-full bg-white object-contain p-2 sm:h-36 sm:w-36"
              />
            </div>
          </div>

          {/* Eyebrow */}
          <p className="mt-8 text-[11px] font-black uppercase tracking-[0.42em] text-gold hero-eyebrow-reveal drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            Est. 1949 · Negombo, Sri Lanka
          </p>

          {/* School name */}
          <h1 className="mt-5 max-w-4xl text-balance text-4xl font-black uppercase leading-[1.18] tracking-[0.18em] drop-shadow-[0_4px_28px_rgba(0,0,0,0.75)] sm:text-5xl md:text-6xl lg:text-7xl hero-title-reveal" style={{ fontFamily: "var(--font-hero)" }}>
            {content.schoolName || "Loyola College Negombo"}
          </h1>

          {/* Motto with gold rule lines */}
          <div className="mt-7 flex items-center gap-5 hero-motto-reveal">
            <span className="h-px w-14 bg-gradient-to-r from-transparent to-gold/80" />
            <p className="font-display text-lg font-medium italic text-gold drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] sm:text-xl">
              {heroMotto}
            </p>
            <span className="h-px w-14 bg-gradient-to-l from-transparent to-gold/80" />
          </div>

          {/* Pillars row */}
          <div className="mt-8 flex flex-wrap justify-center gap-2.5 hero-pillars-reveal">
            {["Faith", "Learning", "Discipline", "Service"].map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/40 bg-white/12 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-white shadow-[0_2px_12px_rgba(0,0,0,0.35)] backdrop-blur-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Scroll-down nudge */}
        <a
          href="#below-hero"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/40 transition-smooth hover:text-white/70 animate-bounce"
        >
          <span className="text-[9px] font-black uppercase tracking-[0.26em]">Scroll</span>
          <ChevronDown className="h-5 w-5" />
        </a>
      </section>

      <div id="below-hero" />
      <HomeNewsTicker />
      <HomeVisionMissionIdentity />
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
  "Rev. Fr. Sudath Gunetileke served as the 4th Rector of the College from 2015 to 2022. He was succeeded by Rev. Dr. Kennedy Perera, who is currently serving as the Rector. Rev. Dr. Kennedy Perera, the current Rector of the college, has undertaken various renovation and development projects in the college. One of the achievements is the renovation of the basketball court, providing the students with a modern and well-maintained facility to engage in sports and physical activity. He has also redesigned the school entrance with new statues, which enhances the aesthetic appeal of the college which add to the overall beauty of the college. A Sports Pavilion, Cadet Billet and a Technical Unit were also constructed and declared opened for the benefit of the students. Rev. Dr. Kennedy was also responsible in converting the Badminton Court in the Sports complex into a new chapel for the Primary Section, dedicated to our Patron Saint St. Ignatius of Loyola. Expansion of the Primary Section was done by constructing a new building. A special unit was newly opened in the New Building and named 'Pope Francis Differently Abled Unit'.",
  "These efforts of Rev. Dr. Kennedy Perera reflect his commitment to uplifting the standard of the education and infrastructure at the college.",
  "Under Rev. Dr. Kennedy's leadership, the college has continued to strive towards excellence in education and discipline. With current student body of 2,688 and a faculty of 150 teachers, the college has come a long way in its 77 years history and is a source of pride for all those associated with it.",
];

function AboutPage() {
  const db = useDb();
  const page = db.pages.about;
  const about = db.aboutSections;
  const historyKicker = about.storyKicker || "College History";
  const historyTitle = about.storyTitle || "College History";
  const quote = about.quote || "Faith, Learning, Discipline, and Service";
  const quoteAuthor = about.quoteAuthor || "Loyola College Negombo";

  const milestones = [
    { year: "1949", label: "Founded" },
    { year: "1979", label: "Marist Era" },
    { year: "1994", label: "Archdiocesan" },
    { year: "1995", label: "New Campus" },
    { year: "2003", label: "English Medium" },
    { year: "2024", label: "77 Years Strong" },
  ];

  return (
    <PublicLayout>
      <PageHeader
        pageId="about"
        kicker={page.kicker || "About"}
        title={page.title || ""}
        subtitle={page.body}
        image={page.image || db.media.aboutImage}
      />

      {/* Milestone strip */}
      <div className="border-b border-border bg-white">
        <div
          className="mx-auto max-w-7xl px-6 py-5"
          data-scroll-reveal
          data-reveal-dir="scale"
        >
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {milestones.map((m, i) => (
              <div key={m.year} className="flex items-center gap-3">
                <div className="text-center">
                  <span className="block font-serif text-2xl font-bold text-gradient-gold">{m.year}</span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{m.label}</span>
                </div>
                {i < milestones.length - 1 && (
                  <span className="hidden h-px w-10 bg-gradient-to-r from-gold/50 to-transparent sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main history section */}
      <section
        id="history"
        className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[minmax(0,1fr)_400px]"
      >
        <article data-scroll-reveal>
          <p className="section-kicker text-crimson">{historyKicker}</p>
          <h2 className="mt-4 font-serif text-4xl font-bold text-navy">{historyTitle}</h2>
          <div className="history-timeline mt-8 space-y-5">
            {collegeHistoryParagraphs.map((paragraph) => (
              <div key={paragraph} className="history-milestone text-base leading-8 text-muted-foreground">
                {paragraph}
              </div>
            ))}
          </div>
        </article>

        <aside className="h-fit lg:sticky lg:top-28 space-y-6" data-scroll-reveal data-reveal-dir="right">
          {/* Quote card */}
          <div className="relative overflow-hidden rounded-2xl bg-navy p-8 text-white shadow-elegant">
            {/* Gold corner accent */}
            <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[80px] bg-gold/10" />
            <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-crimson/12 blur-2xl" />
            <span className="quote-open">"</span>
            <p className="relative font-serif text-2xl leading-snug">{quote}</p>
            <div className="mt-6 flex items-center gap-3">
              <span className="h-px w-8 bg-gold" />
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-gold-light">
                {quoteAuthor}
              </p>
            </div>
          </div>

          {/* Core values */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-soft">
            <p className="section-kicker text-crimson">Core Values</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {["Faith", "Learning", "Discipline", "Service"].map((value) => (
                <div
                  key={value}
                  className="card-shine hover-lift flex flex-col items-center rounded-xl border border-border bg-page-soft p-4 text-center transition-smooth"
                >
                  <span className="font-serif text-base font-bold text-navy">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-soft">
            <p className="section-kicker text-crimson">College Today</p>
            <div className="mt-4 space-y-3">
              {[
                { label: "Students", value: "2,688+" },
                { label: "Faculty", value: "150+" },
                { label: "Years of Excellence", value: "77" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <span className="font-serif text-2xl font-bold text-gradient-gold">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
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
          mediaWebmUrl={page?.backgroundMediaWebmUrl}
          mediaType={page?.backgroundMediaType}
          mediaOpacity={page?.backgroundMediaOpacity}
          gradientClassName="bg-[linear-gradient(110deg,rgb(10_22_40_/0.98),rgb(10_22_40_/0.9)_48%,rgb(183_15_27_/0.72))]"
          gridOpacityClassName="opacity-25"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_360px] lg:py-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold-light">
              Faith, Learning, Discipline, and Service
            </p>
            <span className="gold-divider mt-5" />
            <h1 className="mt-6 max-w-5xl font-serif text-5xl font-bold leading-tight md:text-7xl">
              {formatDisplayHeading(page?.title || "College Anthem & Hymn")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/78">
              A Dignified Home for Loyola College Negombo's Ceremonial Songs, School Values, and
              Shared Identity
            </p>
          </div>
          <aside className="rounded-lg border border-white/14 bg-white/10 p-6 text-center shadow-elegant backdrop-blur">
            <img
              src={db.websiteContent.logoImage || "/loyola-crest.jpg"}
              alt=""
              className="mx-auto h-24 w-24 rounded-full border-4 border-gold bg-white object-contain p-2"
            />
            <p className="mt-5 font-serif text-3xl font-bold">Loyola College</p>
            <p className="mt-2 text-xs font-bold uppercase italic tracking-[0.2em] text-gold-light">
              {db.websiteContent.tagline}
            </p>
          </aside>
        </div>
      </section>

      <section className="border-b border-border bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-8 md:grid-cols-3">
          {[
            ["Motto", db.websiteContent.tagline],
            ["Language", "Sinhala Anthem and English Hymn"],
            ["Purpose", "Prayer, Gratitude, Loyalty, and Formation"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-background p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson">{label}</p>
              <p
                className={`mt-2 font-serif text-2xl font-bold text-navy ${label === "Motto" ? "italic" : ""}`}
              >
                {value}
              </p>
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
            <h2 className="mt-3 font-serif text-4xl font-bold text-navy">Anthem and Hymn Media</h2>

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
                Featured Media
              </p>
              <h3 className="mt-2 font-serif text-2xl font-bold">
                {formatDisplayHeading(anthemVideoTitle)}
              </h3>
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
                  Featured Media
                </p>
                <h3 className="mt-1 font-serif text-2xl font-bold text-navy">
                  {formatDisplayHeading(anthemVideoTitle)}
                </h3>
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
                      This Media Link Cannot Be Embedded
                    </p>
                    <a
                      href={anthemVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy"
                    >
                      Open Media
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
    body: "The academy was launched under the vision of Rev. Dr. Kennedy Perera.",
    icon: Award,
  },
];

const lceaLeadership = [
  { role: "Rector", names: ["Rev. Dr. D.M.J. Kennedy Perera"] },
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
                  academy is a brain-child of Rev. Dr. Kennedy Perera, the present Rector of Loyola
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

const defaultFacilitiesServices: FacilityItem[] = [
  {
    title: "Audio Visual Room",
    category: "Learning & Media",
    image: `${facilityImageBase}/AUDIO-VISUAL-ROOM-300x250.jpg`,
    body: "A presentation-ready learning space for conferences, seminars, screenings, and media-assisted teaching.",
    highlights: ["Presentations", "Workshops", "Media learning"],
  },
  {
    title: "SV Fonseka Hall",
    category: "Assembly & Events",
    image: `${facilityImageBase}/SV-FONSEKA-300x250.jpg`,
    body: "A central college hall for assemblies, formal gatherings, celebrations, and student programmes.",
    highlights: ["Assemblies", "Ceremonies", "College events"],
  },
  {
    title: "Library",
    category: "Study & Reading",
    image: `${facilityImageBase}/LIBRARY-300x250.jpg`,
    body: "A quiet academic resource space that supports reading habits, research, reference work, and independent study.",
    highlights: ["Reading", "Reference", "Research"],
  },
  {
    title: "Smart Class Room",
    category: "Digital Learning",
    image: `${facilityImageBase}/SMART-CLASS-ROOM-300x250.jpg`,
    body: "A technology-enabled classroom that helps teachers deliver clear, visual, and interactive lessons.",
    highlights: ["Smart lessons", "Digital tools", "Interactive teaching"],
  },
  {
    title: "Canteen",
    category: "Student Service",
    image: `${facilityImageBase}/CANTEEN-300x250.jpg`,
    body: "A daily service point for students, supporting refreshment, routine, and practical campus life.",
    highlights: ["Refreshments", "Daily service", "Student care"],
  },
  {
    title: "Main Chapel",
    category: "Faith Formation",
    image: "",
    body: "The main chapel supports school Masses, prayer services, retreats, confession, and the Catholic spiritual life of the college.",
    highlights: ["Holy Mass", "Prayer", "Retreats"],
  },
  {
    title: "St. Ignatius Chapel",
    category: "Faith Formation",
    image: `${facilityImageBase}/ST-IGNATIUS-CHAPEL-300x250.jpg`,
    body: "A sacred space for prayer, reflection, Catholic formation, and the spiritual life of the college community.",
    highlights: ["Prayer", "Reflection", "Faith life"],
  },
  {
    title: "Cadet Billet",
    category: "Discipline & Leadership",
    image: `${facilityImageBase}/CADET-BILLET-300x250.jpg`,
    body: "A dedicated space that supports cadet activities, discipline, leadership training, and student responsibility.",
    highlights: ["Cadets", "Leadership", "Discipline"],
  },
  {
    title: "Scout Den",
    category: "Clubs & Leadership",
    image: `${facilityImageBase}/SCOUT-DEN-300x250.jpg`,
    body: "A home base for scouts to organize equipment, plan activities, and build practical leadership skills.",
    highlights: ["Scouts", "Planning", "Teamwork"],
  },
  {
    title: "Auditorium",
    category: "Performance & Meetings",
    image: `${facilityImageBase}/auditorium-300x250.jpg`,
    body: "A refined venue for meetings, conferences, performances, presentations, and large school gatherings.",
    highlights: ["Performances", "Meetings", "Conferences"],
  },
  {
    title: "Gym",
    category: "Sports & Fitness",
    image: "",
    body: "A training space for student fitness, athletic conditioning, indoor practice, equipment use, and guided physical development.",
    highlights: ["Fitness", "Training", "Conditioning"],
  },
  {
    title: "Swimming Pool",
    category: "Aquatics",
    image: "",
    body: "An aquatic facility for swimming training, water safety, school practices, competitions, and student wellbeing.",
    highlights: ["Swimming", "Water safety", "Training"],
  },
  {
    title: "Medical Unit",
    category: "Health & Wellness",
    image: "",
    body: "A dedicated on-campus health centre providing first aid, routine medical care, wellness support, and emergency response for students and staff.",
    highlights: ["First Aid", "Student Health", "Wellness"],
  },
];

const facilityIconByTitle: Record<string, LucideIcon> = {
  "Audio Visual Room": Film,
  "SV Fonseka Hall": Landmark,
  Library: BookOpen,
  "Smart Class Room": GraduationCap,
  Canteen: Users,
  "Main Chapel": ShieldCheck,
  "St. Ignatius Chapel": ShieldCheck,
  "Cadet Billet": Award,
  "Scout Den": Trophy,
  Auditorium: Camera,
  Gym: Trophy,
  "Swimming Pool": Waves,
  "Medical Unit": Heart,
};

type FacilityDisplayItem = FacilityItem & { icon: LucideIcon };

function isLegacyFacilityImage(image?: string) {
  return Boolean(image?.includes("www.loyolacollege.lk/frontend/assets/img/facilities"));
}

function editableFacilityItems(page?: { facilityItems?: FacilityItem[] }): FacilityItem[] {
  const savedItems = Array.isArray(page?.facilityItems) ? page.facilityItems : [];

  // No saved state yet — show all defaults
  if (savedItems.length === 0) {
    return defaultFacilitiesServices.map((f) => ({
      ...f,
      highlights: Array.isArray(f.highlights) ? f.highlights.filter(Boolean) : [],
    }));
  }

  // Saved state exists — use it as authoritative so removed items stay removed
  const templateByTitle = new Map(defaultFacilitiesServices.map((f) => [f.title, f]));
  return savedItems.map((facility) => ({
    ...(templateByTitle.get(facility.title) ?? {}),
    ...facility,
    title: facility.title || "Campus facility",
    category: facility.category || "Facility",
    image: facility.image || "",
    body: facility.body || "Add facility details.",
    highlights: Array.isArray(facility.highlights) ? facility.highlights.filter(Boolean) : [],
  }));
}

function facilityDisplayItems(page?: { facilityItems?: FacilityItem[] }): FacilityDisplayItem[] {
  return editableFacilityItems(page).map((facility) => ({
    ...facility,
    icon: facilityIconByTitle[facility.title] || Landmark,
  }));
}

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
    items: ["Canteen", "Main Chapel", "St. Ignatius Chapel", "Cadet Billet", "Scout Den"],
    icon: ShieldCheck,
  },
  {
    title: "Sports, Aquatics & Health",
    body: "Training, wellness, and medical spaces for fitness, swimming, sports practice, student physical development, and on-campus healthcare.",
    items: ["Gym", "Swimming Pool", "Medical Unit"],
    icon: Trophy,
  },
];

function FacilityMedia({
  facility,
  className,
}: {
  facility: FacilityDisplayItem;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  const Icon = facility.icon;

  if (facility.image && !failed && !isLegacyFacilityImage(facility.image)) {
    return (
      <img
        src={facility.image}
        alt={`${facility.title} facility`}
        onError={() => setFailed(true)}
        className={className}
      />
    );
  }

  return (
    <div
      className={`${className} grid place-items-center bg-[linear-gradient(135deg,#071224,#12233b)] text-center text-white`}
    >
      <div className="grid gap-3 px-4">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-gold/15 text-gold ring-1 ring-gold/25">
          <Icon className="h-7 w-7" />
        </span>
        <span className="text-xs font-black uppercase tracking-[0.18em] text-white/75">
          {facility.title}
        </span>
      </div>
    </div>
  );
}

function FacilitiesServicesPage() {
  const db = useDb();
  const page = db.pages[FACILITIES_PAGE_ID];
  const facilities = facilityDisplayItems(page);
  const pageBody =
    page?.body && page.body.trim() !== "New page content goes here." ? page.body : "";
  const heroImage =
    page?.image || db.media.campusImage || db.websiteContent.heroImage || DEFAULT_HERO_IMAGE;
  const formationSpaces = facilities.filter((facility) =>
    /faith|formation|leadership|discipline/i.test(`${facility.category} ${facility.title}`),
  ).length;

  return (
    <PublicLayout>
      <PageHeader
        pageId={FACILITIES_PAGE_ID}
        kicker={page?.kicker || "The College"}
        title={page?.title || "School Facilities and Student Services"}
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
                  [String(facilities.length), "Featured facilities"],
                  [String(facilityGroups.length), "Service areas"],
                  [String(formationSpaces || 4), "Formation spaces"],
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
                {facilities.slice(0, 4).map((facility) => (
                  <FacilityMedia
                    key={facility.title}
                    facility={facility}
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
                School Facilities and Student Services
              </h2>
            </div>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg bg-navy px-5 py-3 text-sm font-bold text-white"
            >
              Contact Office <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="stagger-children mt-9 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {facilities.map((facility) => {
              const Icon = facility.icon;
              return (
                <article
                  key={facility.title}
                  className="group min-w-0 overflow-hidden rounded-lg border border-border bg-white shadow-soft"
                >
                  <div className="relative overflow-hidden bg-navy">
                    <FacilityMedia
                      facility={facility}
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

function normalizeStaffTaxonomy(value?: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function taxonomyValueMatches(value: string, aliases: string[]) {
  return aliases.some(
    (alias) => value === alias || value.startsWith(`${alias} `) || value.endsWith(` ${alias}`),
  );
}

function visibleStaffPositions(staff: Teacher) {
  return (staff.positions || []).filter(
    (position) => position.visibleOnWebsite !== false && position.visible_on_website !== false,
  );
}

function positionMatchesDepartment(
  position: NonNullable<Teacher["positions"]>[number],
  departmentAliases: string[],
) {
  return [
    position.section,
    position.subsection,
    position.websitePlace,
    position.website_place,
    position.department,
  ]
    .map(normalizeStaffTaxonomy)
    .filter(Boolean)
    .some((value) => taxonomyValueMatches(value, departmentAliases));
}

function positionMatchesStaffType(
  position: NonNullable<Teacher["positions"]>[number],
  staffTypeAliases: string[],
) {
  if (!staffTypeAliases.length) return true;
  return [position.main_category, position.mainCategory]
    .map(normalizeStaffTaxonomy)
    .filter(Boolean)
    .some((value) => taxonomyValueMatches(value, staffTypeAliases));
}

function departmentPositionForStaff(staff: Teacher, department: CollegeDepartment) {
  const departmentAliases = (department.staffDepartments || [department.title])
    .map(normalizeStaffTaxonomy)
    .filter(Boolean);
  const staffTypeAliases = (department.staffTypes || [])
    .map(normalizeStaffTaxonomy)
    .filter(Boolean);

  return visibleStaffPositions(staff).find(
    (position) =>
      positionMatchesDepartment(position, departmentAliases) &&
      positionMatchesStaffType(position, staffTypeAliases),
  );
}

function departmentMemberPositionForStaff(staff: Teacher, department: CollegeDepartment) {
  const memberPositionCodes = new Set(
    (department.memberPositionCodes || []).map(normalizePositionCode).filter(Boolean),
  );
  if (!memberPositionCodes.size) return departmentPositionForStaff(staff, department);

  const departmentAliases = (department.staffDepartments || [department.title])
    .map(normalizeStaffTaxonomy)
    .filter(Boolean);
  const staffTypeAliases = (department.staffTypes || [])
    .map(normalizeStaffTaxonomy)
    .filter(Boolean);

  return visibleStaffPositions(staff).find((position) => {
    const positionCode = normalizePositionCode(
      position.position_code ||
        position.positionCode ||
        position.display_title ||
        position.displayTitle ||
        position.position ||
        "",
    );
    return (
      Boolean(positionCode) &&
      memberPositionCodes.has(positionCode) &&
      positionMatchesDepartment(position, departmentAliases) &&
      positionMatchesStaffType(position, staffTypeAliases)
    );
  });
}

function staffMatchesDepartment(staff: Teacher, department: CollegeDepartment) {
  const positions = visibleStaffPositions(staff);
  if (positions.length) return Boolean(departmentPositionForStaff(staff, department));

  const departmentAliases = (department.staffDepartments || [department.title])
    .map(normalizeStaffTaxonomy)
    .filter(Boolean);
  const staffTypeAliases = (department.staffTypes || [])
    .map(normalizeStaffTaxonomy)
    .filter(Boolean);
  const staffType = normalizeStaffTaxonomy(staff.type);
  if (staffTypeAliases.length && !taxonomyValueMatches(staffType, staffTypeAliases)) {
    return false;
  }

  return [...(staff.departments || []), staff.category, staff.section, staff.websitePlace]
    .map(normalizeStaffTaxonomy)
    .filter(Boolean)
    .some((value) => taxonomyValueMatches(value, departmentAliases));
}

function staffRoleLabel(staff: Teacher, position?: NonNullable<Teacher["positions"]>[number]) {
  return (
    position?.display_title ||
    position?.displayTitle ||
    position?.position ||
    staff.position ||
    staff.subject ||
    staff.category ||
    staff.type ||
    "Department Member"
  );
}

function initialsForName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function departmentGalleryAlbums(departmentId: string, gallery: GalleryItem[]) {
  return gallery.filter(
    (album) =>
      album.visible !== false &&
      normalizeStaffTaxonomy(album.departmentId || "") === normalizeStaffTaxonomy(departmentId),
  );
}

function departmentMembersFromStaff(teachers: Teacher[], department: CollegeDepartment) {
  const members = new Map<
    string,
    {
      name: string;
      role: string;
      note?: string;
      email?: string;
      image?: string;
    }
  >();

  teachers
    .filter((staff) => (staff.status || "Active").toLowerCase() === "active")
    .forEach((staff) => {
      const position = departmentMemberPositionForStaff(staff, department);
      if (
        !position &&
        (department.memberPositionCodes?.length || !staffMatchesDepartment(staff, department))
      ) {
        return;
      }
      const profileId = staff.staffId || staff.id.split("__")[0] || staff.email || staff.name;
      if (members.has(profileId)) return;
      members.set(profileId, {
        name: staff.name,
        role: staffRoleLabel(staff, position),
        note: staff.responsibilities || staff.qualifications || staff.classes || staff.subject,
        image: staff.image,
      });
    });

  return [...members.values()].slice(0, 8);
}

function CollegeDepartmentPage({ pageId }: { pageId: string }) {
  const db = useDb();
  const department =
    visibleCollegeDepartments.find((item) => item.id === pageId) ||
    visibleCollegeDepartments[0] ||
    collegeDepartments[0];
  const page = db.pages[pageId];
  const Icon = department.icon;
  const relatedDepartments = visibleCollegeDepartments.filter((item) => item.id !== department.id);
  const positions = department.positions || [];
  const liveMembers = departmentMembersFromStaff(db.teachers, department);
  const members = liveMembers;
  const linkedGalleryAlbums = departmentGalleryAlbums(department.id, db.gallery);
  const gallery =
    linkedGalleryAlbums.length > 0
      ? linkedGalleryAlbums.map((album) => {
          const images = albumImages(album);
          return {
            title: album.label,
            body: album.description || `Photos from the ${department.title} department.`,
            image: album.image || images[0] || "",
          };
        })
      : department.gallery || [];
  const documents = department.documents || [];
  const contact = department.contact || {
    location: "College Office",
    hours: "School office hours",
    email: db.websiteContent.email,
  };
  const departmentCoverImage =
    linkedGalleryAlbums.find((album) => album.image)?.image ||
    linkedGalleryAlbums.flatMap((album) => albumImages(album))[0] ||
    "";
  const galleryFallback =
    departmentCoverImage ||
    page?.image ||
    db.media.campusImage ||
    db.websiteContent.heroImage ||
    DEFAULT_HERO_IMAGE;
  const title = page?.title || department.title;
  const body =
    page?.body && page.body.trim() !== "New page content goes here."
      ? page.body
      : department.summary;

  return (
    <PublicLayout>
      <PageHeader
        pageId={pageId}
        kicker={page?.kicker || department.kicker}
        title={title}
        subtitle={body}
        image={
          departmentCoverImage || page?.image || db.media.campusImage || db.websiteContent.heroImage
        }
      />

      <section className="bg-page-soft py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <article className="rounded-lg border border-border bg-white p-7 shadow-soft md:p-9">
            <div className="flex flex-wrap items-start gap-5">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
                <Icon className="h-8 w-8" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
                  Department Profile
                </p>
                <h2 className="mt-3 font-serif text-4xl font-bold text-navy">
                  What the {department.title} does
                </h2>
                <p className="mt-5 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
                  {department.summary}
                </p>
              </div>
            </div>

            <div className="mt-10 border-t border-border pt-8">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
                Main Responsibilities
              </p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {department.responsibilities.map((item) => (
                <div key={item} className="flex gap-3 rounded-lg bg-background p-4">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-gold" />
                  <p className="text-sm leading-7 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </article>

          <aside className="rounded-lg border border-border bg-navy p-7 text-white shadow-elegant">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-light">
              Service Areas
            </p>
            <div className="mt-6 grid gap-3">
              {department.serviceAreas.map((area) => (
                <div key={area} className="rounded-lg border border-white/10 bg-white/10 p-4">
                  <p className="font-serif text-2xl font-bold">{area}</p>
                </div>
              ))}
            </div>
            <div className="mt-7 rounded-lg border border-gold/30 bg-gold/10 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-light">
                Permission Level
              </p>
              <p className="mt-3 text-sm leading-7 text-white/82">{department.permissionLevel}</p>
            </div>
            <a
              href="/contact"
              className="mt-7 inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy"
            >
              Contact Office <ArrowRight className="h-4 w-4" />
            </a>
          </aside>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
                Positions
              </p>
              <h2 className="mt-3 font-serif text-4xl font-bold text-navy">
                Department Positions and Duties
              </h2>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {positions.map((position) => (
                  <article
                    key={position.title}
                    className="rounded-lg border border-border bg-background p-5"
                  >
                    <Briefcase className="h-5 w-5 text-gold" />
                    <h3 className="mt-4 font-serif text-2xl font-bold text-navy">
                      {position.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{position.body}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-lg border border-border bg-white p-6 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
                Department Members
              </p>
              <div className="mt-6 grid gap-4">
                {members.length === 0 && (
                  <p className="rounded-lg border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
                    No active staff profiles are currently assigned to this department.
                  </p>
                )}
                {members.map((member) => (
                  <article
                    key={`${member.name}-${member.role}`}
                    className="flex gap-4 rounded-lg border border-border bg-background p-4"
                  >
                    {member.image ? (
                      <img
                        src={member.image}
                        alt={member.name}
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-navy font-serif text-lg font-bold text-white">
                        {initialsForName(member.name)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <h3 className="break-words font-bold text-navy">{member.name}</h3>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-crimson">
                        {member.role}
                      </p>
                      {member.note && (
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {member.note}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-page-soft py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
                Department Gallery
              </p>
              <h2 className="mt-3 font-serif text-4xl font-bold text-navy">
                Photos and Department Work
              </h2>
            </div>
            <a
              href="/gallery"
              className="inline-flex items-center gap-2 text-sm font-bold text-crimson"
            >
              Open Gallery <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {gallery.map((item) => (
              <article
                key={item.title}
                className="overflow-hidden rounded-lg border border-border bg-white shadow-soft"
              >
                <div className="relative bg-navy">
                  <img
                    src={item.image || galleryFallback}
                    alt={item.title}
                    className="aspect-[4/3] w-full object-cover opacity-90"
                  />
                  <span className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-lg bg-white/92 text-navy shadow-soft">
                    <Camera className="h-5 w-5" />
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-serif text-2xl font-bold text-navy">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
                System Responsibilities
              </p>
              <h2 className="mt-3 font-serif text-4xl font-bold text-navy">
                How {department.title} uses the college systems
              </h2>
              <p className="mt-5 text-sm leading-7 text-muted-foreground">
                This connects the department&apos;s daily work to website publishing, EduTrack,
                staff management, calendars, notices, documents, reports, and approval workflows.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {department.systemWork.map((item) => (
                <article key={item} className="rounded-lg border border-border bg-background p-5">
                  <CheckCircle2 className="h-5 w-5 text-gold" />
                  <p className="mt-4 text-sm font-medium leading-7 text-navy">{item}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
              Files and Notices
            </p>
            <h2 className="mt-3 font-serif text-4xl font-bold text-navy">Department Documents</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {documents.map((document) => (
                <article
                  key={document.title}
                  className="rounded-lg border border-border bg-background p-5"
                >
                  <FileText className="h-6 w-6 text-gold" />
                  <h3 className="mt-4 font-serif text-2xl font-bold text-navy">{document.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{document.body}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-lg border border-border bg-navy p-7 text-white shadow-elegant">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-light">
              Contact and Location
            </p>
            <div className="mt-6 space-y-4 text-sm leading-7 text-white/82">
              <p className="flex gap-3">
                <MapPin className="mt-1 h-5 w-5 shrink-0 text-gold" />
                <span>{contact.location}</span>
              </p>
              <p className="flex gap-3">
                <Calendar className="mt-1 h-5 w-5 shrink-0 text-gold" />
                <span>{contact.hours}</span>
              </p>
              <p className="flex gap-3">
                <Mail className="mt-1 h-5 w-5 shrink-0 text-gold" />
                <span>{contact.email}</span>
              </p>
            </div>
            <a
              href="/downloads"
              className="mt-7 inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy"
            >
              Department Files <ArrowRight className="h-4 w-4" />
            </a>
          </aside>
        </div>
      </section>

      <section className="bg-page-soft py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-crimson">
                The College
              </p>
              <h2 className="mt-3 font-serif text-4xl font-bold text-navy">Other departments</h2>
            </div>
            <a
              href={`/${FACILITIES_PAGE_ID}`}
              className="inline-flex items-center gap-2 text-sm font-bold text-crimson"
            >
              Facilities overview <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedDepartments.map((item) => {
              const RelatedIcon = item.icon;
              return (
                <a
                  key={item.id}
                  href={`/${item.id}`}
                  className="group rounded-lg border border-border bg-white p-5 shadow-soft transition-smooth hover:-translate-y-1 hover:border-gold"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-gold/15 text-gold">
                    <RelatedIcon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-serif text-2xl font-bold text-navy">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.cardBody}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-crimson">
                    Open department <ArrowRight className="h-4 w-4" />
                  </span>
                </a>
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
  const deptColors = [
    { bar: "bg-gold", text: "text-gold" },
    { bar: "bg-crimson", text: "text-crimson" },
    { bar: "bg-[#1e6cbf]", text: "text-[#1e6cbf]" },
    { bar: "bg-[#0e7f5a]", text: "text-[#0e7f5a]" },
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
        {/* Section heading */}
        <div className="mb-10" data-scroll-reveal>
          <p className="section-kicker text-crimson">Academic Departments</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-navy">
            Sections & Departments
          </h2>
        </div>

        {/* Department cards */}
        <div
          className="grid gap-6 md:grid-cols-2"
          data-scroll-reveal
          data-reveal-dir="scale"
          style={{ "--sr-delay": "0.1s" } as React.CSSProperties}
        >
          {db.academicsSections.departments.map((department, i) => {
            const color = deptColors[i % deptColors.length];
            return (
              <article
                key={department.id}
                className="card-shine hover-lift group relative overflow-hidden rounded-2xl border border-border bg-white p-7 shadow-soft"
              >
                {/* Top accent gradient */}
                <div className={`absolute inset-x-0 top-0 h-1 ${color.bar}`} />
                <p className={`font-serif text-5xl font-bold ${color.text}`}>{department.count}</p>
                <h2 className="mt-3 text-xl font-bold text-navy">{department.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{department.body}</p>
                <div className={`dept-bar ${color.bar} mt-4`} />
              </article>
            );
          })}
        </div>

        {/* Subjects table */}
        {db.subjects.length > 0 && (
          <div
            id="exam-timetable"
            className="mt-14 overflow-hidden rounded-2xl border border-border bg-white shadow-elegant"
            data-scroll-reveal
          >
            <div className="border-b border-border bg-navy px-6 py-4">
              <p className="section-kicker text-gold/80">Curriculum</p>
              <h3 className="mt-1 font-serif text-2xl font-bold text-white">Subjects & Departments</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3">Subject</th>
                    <th className="px-6 py-3">Grade</th>
                    <th className="px-6 py-3">Department</th>
                  </tr>
                </thead>
                <tbody>
                  {db.subjects.map((subject, i) => (
                    <tr
                      key={subject.id}
                      className={`border-t border-border transition-colors hover:bg-gold/5 ${i % 2 === 0 ? "bg-white" : "bg-page-soft/40"}`}
                    >
                      <td className="px-6 py-3.5 font-semibold text-navy">{subject.name}</td>
                      <td className="px-6 py-3.5 text-muted-foreground">{subject.grade}</td>
                      <td className="px-6 py-3.5 text-muted-foreground">{subject.department}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick links */}
        <div
          id="calendar"
          className="mt-10 grid gap-5 md:grid-cols-2"
          data-scroll-reveal
          data-reveal-dir="scale"
        >
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.title}
                href={item.href}
                className="card-shine hover-lift group flex gap-5 rounded-2xl border border-border bg-white p-6 shadow-soft transition-smooth hover:border-gold/50"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold transition-smooth group-hover:bg-gold/20">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-navy">{item.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
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
        {/* Info cards */}
        <div
          className="mb-14 grid gap-6 md:grid-cols-3"
          data-scroll-reveal
          data-reveal-dir="scale"
        >
          {[
            { title: "Admission Requirements", body: "Learn the eligibility criteria and entry standards for each grade level.", icon: FileText, color: "bg-gold/10 text-gold" },
            { title: "Required Documents", body: "Birth certificate, school report, baptismal certificate, and parent ID.", icon: Award, color: "bg-crimson/10 text-crimson" },
            { title: "Important Dates", body: "Applications open annually — check the events calendar for this year's timeline.", icon: Calendar, color: "bg-[#1e6cbf]/10 text-[#1e6cbf]" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="card-shine hover-lift group relative overflow-hidden rounded-2xl border border-border bg-white p-7 shadow-soft"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-serif text-xl font-bold text-navy">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            );
          })}
        </div>

        {/* Steps */}
        {db.admissionsSteps.length > 0 && (
          <div className="mb-14" data-scroll-reveal>
            <p className="section-kicker text-crimson mb-6">How to Apply</p>
            <div className="grid gap-4 md:grid-cols-4">
              {db.admissionsSteps.map((step, i) => (
                <div
                  key={step.id}
                  className="card-shine hover-lift relative rounded-2xl border border-border bg-white p-6 shadow-soft"
                >
                  <div className="step-pill">{step.number || i + 1}</div>
                  <h2 className="mt-4 font-bold text-navy">{step.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  {/* Connecting dot */}
                  {i < db.admissionsSteps.length - 1 && (
                    <span className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-gold md:flex">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Application form */}
        <div
          className="mx-auto mt-4 max-w-3xl overflow-hidden rounded-2xl border border-border bg-white shadow-elegant"
          data-scroll-reveal
        >
          {/* Form header */}
          <div className="border-b border-border bg-navy px-8 py-5">
            <p className="section-kicker text-gold/80">Online Inquiry</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-white">{db.forms.admissionsTitle}</h2>
          </div>
          <div className="p-8">
            {submitted ? (
              <div className="py-10 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="h-9 w-9 text-success" />
                </div>
                <h2 className="mt-5 font-serif text-3xl text-navy">{db.forms.admissionsSuccessTitle}</h2>
                <p className="mt-3 text-muted-foreground">{db.forms.admissionsSuccessText}</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
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
                  className="login-submit btn-shimmer w-full rounded-xl bg-navy py-4 text-sm font-bold text-white shadow-[0_4px_20px_-4px_rgba(10,22,40,0.5)] transition-smooth hover:bg-navy-mid hover:-translate-y-px"
                >
                  {db.forms.admissionsSubmitLabel}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom CTAs */}
        <div className="mt-10 grid gap-5 md:grid-cols-2" data-scroll-reveal data-reveal-dir="scale">
          <a
            href="/downloads"
            className="card-shine hover-lift group flex items-start gap-5 rounded-2xl border border-border bg-white p-6 shadow-soft transition-smooth hover:border-gold/50"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold transition-smooth group-hover:bg-gold/20">
              <Download className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-navy">Download Application Forms</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Admission forms, circulars, requirements, and parent documents.
              </p>
            </div>
          </a>
          <a
            href="/contact"
            className="card-shine hover-lift group flex items-start gap-5 rounded-2xl border border-border bg-white p-6 shadow-soft transition-smooth hover:border-gold/50"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold transition-smooth group-hover:bg-gold/20">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-navy">Contact Admission Office</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask questions about process, dates, documents, and available grades.
              </p>
            </div>
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
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f8faff_0%,#ffffff_42%,#fff8f0_100%)] py-20">
        <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-gold/15 blur-[100px]" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-crimson/12 blur-[110px]" />
        <div className="mx-auto max-w-7xl px-6">
          {/* Section heading */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" data-scroll-reveal>
            <div>
              <p className="section-kicker text-crimson">Browse Events</p>
              <h2 className="mt-2 font-serif text-3xl font-bold text-navy">College Events</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {db.events.length} event{db.events.length === 1 ? "" : "s"}
            </p>
          </div>

          {/* Category chips */}
          <div className="mb-8 flex flex-wrap gap-2" data-scroll-reveal data-reveal-dir="left">
            {categories.map((category) => (
              <span
                key={category}
                className="chip-filter transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
              >
                {category}
              </span>
            ))}
          </div>

          {/* Events grid */}
          <div
            className="grid gap-6 md:grid-cols-3"
            data-scroll-reveal
            data-reveal-dir="scale"
          >
            {db.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          {db.events.length === 0 && (
            <div
              className="rounded-2xl border border-border bg-white p-12 text-center shadow-soft"
              data-scroll-reveal
            >
              <Calendar className="mx-auto h-10 w-10 text-gold/60" />
              <p className="mt-4 font-serif text-xl text-navy">No events scheduled yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Check back soon for upcoming college events.
              </p>
            </div>
          )}
        </div>
      </section>
      <SubpagesSection parentId="events" />
    </PublicLayout>
  );
}

function JobVacanciesPage() {
  const db = useDb();
  const page = db.pages["job-vacancies"];
  const [vacancies, setVacancies] = useState<JobVacancy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/job-vacancies`, { credentials: "include" })
      .then(async (response) => {
        const payload = await response.json().catch(() => []);
        if (!response.ok) throw new Error(payload?.error || "Could not load job vacancies.");
        if (!cancelled) setVacancies(Array.isArray(payload) ? payload : []);
      })
      .catch(() => {
        if (!cancelled) setVacancies([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PublicLayout>
      <PageHeader
        pageId="job-vacancies"
        kicker={page?.kicker || "Careers"}
        title={page?.title || "Job Vacancies"}
        subtitle={page?.body || "Current employment opportunities at Loyola College Negombo."}
        image={page?.image || db.media.campusImage || db.websiteContent.heroImage}
      />
      <section className="bg-page-soft py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          {loading ? (
            <BrandedLoader
              fullScreen={false}
              title="Loading vacancies"
              subtitle="Checking current opportunities"
            />
          ) : vacancies.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white p-12 text-center shadow-soft" data-scroll-reveal>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
                <Briefcase className="h-7 w-7 text-gold" />
              </div>
              <h2 className="mt-5 font-serif text-2xl font-bold text-navy">
                No vacancies currently published
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Please check back for future employment opportunities.
              </p>
            </div>
          ) : (
            <div className="grid gap-6" data-scroll-reveal>
              {vacancies.map((vacancy) => {
                const isOpen = vacancy.status === "Open";
                const email = vacancy.application_email || db.websiteContent.email;
                const subject = isOpen
                  ? `Application - ${vacancy.title}`
                  : `Job Vacancy Inquiry - ${vacancy.title}`;
                const emailHref = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
                return (
                  <article
                    key={vacancy.id}
                    className="vacancy-card overflow-hidden rounded-2xl border border-border bg-white shadow-soft"
                  >
                    {/* Card header */}
                    <div className="border-b border-border bg-navy/3 px-6 py-5 md:px-8">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="section-kicker text-crimson">Employment Opportunity</p>
                          <h2 className="mt-2 break-words font-serif text-2xl font-bold text-navy md:text-3xl">
                            {vacancy.title}
                          </h2>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold ${
                            isOpen ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {vacancy.status}
                        </span>
                      </div>
                    </div>

                    <div className="p-6 md:p-8">
                      <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
                        {vacancy.description}
                      </p>
                      {vacancy.requirements && (
                        <div className="mt-6 rounded-xl border border-border bg-page-soft p-5">
                          <h3 className="font-bold text-navy">Requirements</h3>
                          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                            {vacancy.requirements}
                          </p>
                        </div>
                      )}
                      <div className="mt-6 flex flex-wrap items-center gap-4">
                        {vacancy.deadline && (
                          <span className="inline-flex items-center gap-2 rounded-lg bg-gold/8 px-3 py-1.5 text-sm font-semibold text-navy">
                            <Calendar className="h-4 w-4 text-gold" />
                            Deadline:{" "}
                            {new Date(`${vacancy.deadline}T00:00:00`).toLocaleDateString("en-LK", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        )}
                        {vacancy.attachment_url && (
                          <a
                            href={vacancy.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-bold text-crimson transition-smooth hover:text-crimson-dark"
                          >
                            <FileText className="h-4 w-4" />
                            View attachment
                          </a>
                        )}
                      </div>
                      <a
                        href={emailHref}
                        className="btn-shimmer mt-6 inline-flex items-center gap-2 rounded-xl bg-navy px-6 py-3 text-sm font-bold text-white transition-smooth hover:bg-navy-mid hover:-translate-y-px"
                      >
                        <Mail className="h-4 w-4" />
                        {isOpen ? "Apply Now" : "Email Us"}
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
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
      <section className="bg-page-soft px-4 py-12 sm:px-6 md:py-16">
        <div className="mx-auto max-w-[82rem]">
          {/* Section heading */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 px-2" data-scroll-reveal>
            <div>
              <p className="section-kicker text-crimson">Academic Schedule</p>
              <h2 className="mt-2 font-serif text-3xl font-bold text-navy">College Calendar</h2>
            </div>
            <div className="flex gap-3">
              {["Events", "Holidays", "Academic Dates"].map((label) => (
                <span key={label} className="chip-filter">{label}</span>
              ))}
            </div>
          </div>

          {/* Calendar embed */}
          <div
            className="overflow-hidden rounded-2xl border border-border bg-white shadow-elegant"
            data-scroll-reveal
            data-reveal-dir="scale"
          >
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
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Latest News");
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
        {/* Search bar */}
        <div
          className="mb-8 flex flex-col gap-3 sm:flex-row"
          data-scroll-reveal
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-xl border border-border bg-white py-3 pl-11 pr-4 text-sm shadow-soft outline-none transition-smooth focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,160,23,0.15)]"
              placeholder="Search news, notices, circulars..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="rounded-xl border border-border bg-white px-4 py-3 text-sm shadow-soft outline-none transition-smooth focus:border-gold">
            <option>Category filter</option>
            {filters.map((filter) => (
              <option key={filter}>{filter}</option>
            ))}
          </select>
        </div>

        {/* Filter chips */}
        <div className="mb-8 flex flex-wrap gap-2" data-scroll-reveal data-reveal-dir="left">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              id={
                filter === "Latest News"
                  ? "latest-news"
                  : filter === "Important Notices"
                    ? "important-notices"
                    : undefined
              }
              onClick={() => setActiveFilter(filter)}
              className={`chip-filter ${activeFilter === filter ? "border-gold bg-gold/10 text-navy shadow-[0_2px_12px_rgba(212,160,23,0.25)]" : ""}`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* News grid */}
        <div
          className="grid gap-6 md:grid-cols-3"
          data-scroll-reveal
          data-reveal-dir="scale"
        >
          {db.news.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>

        {db.news.length === 0 && (
          <div className="rounded-2xl border border-border bg-white p-12 text-center shadow-soft" data-scroll-reveal>
            <Bell className="mx-auto h-10 w-10 text-gold/60" />
            <p className="mt-4 font-serif text-xl text-navy">No news published yet</p>
            <p className="mt-2 text-sm text-muted-foreground">College updates will appear here.</p>
          </div>
        )}
      </section>
      <SubpagesSection parentId="news" />
    </PublicLayout>
  );
}

const EXTRA_CURRICULAR_NAME_TITLES = new Set([
  "rev",
  "fr",
  "sr",
  "mr",
  "mrs",
  "ms",
  "miss",
  "dr",
  "prof",
]);

const EXTRA_CURRICULAR_EVENT_STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "into",
  "this",
  "that",
  "school",
  "secondary",
  "primary",
  "middle",
  "upper",
  "senior",
  "girls",
  "boys",
  "section",
  "college",
  "teachers",
  "charge",
]);

function extraCurricularActivityHref(activityId: string) {
  return `/sports-clubs/${encodeURIComponent(activityId)}`;
}

function publicStaffSlug(value: string) {
  return normalizeStaffTaxonomy(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeTeacherLookupName(value: string) {
  return normalizeStaffTaxonomy(value)
    .split(" ")
    .filter(Boolean)
    .filter((part) => !EXTRA_CURRICULAR_NAME_TITLES.has(part))
    .filter((part) => part.length > 1)
    .join(" ");
}

type ActivityTeacherMatch = {
  teacherName: string;
  staff: Teacher | null;
  source: "document" | "position-code";
};

function activityTeacherNameKey(value: string) {
  return normalizeTeacherLookupName(value) || normalizeStaffTaxonomy(value);
}

function activityTeacherProfileKey(teacher: Teacher) {
  return teacher.staffId || teacher.id.split("__")[0] || teacher.slug || teacher.name;
}

type ActivityStaffLookupEntry = {
  staff: Teacher;
  tokens: Set<string>;
};

function uniqueActivityStaffMatch(matches: Teacher[]) {
  const byProfile = new Map<string, Teacher>();
  matches.forEach((staff) => {
    const key = activityTeacherProfileKey(staff);
    if (key) byProfile.set(key, staff);
  });
  return byProfile.size === 1 ? [...byProfile.values()][0] : null;
}

function findActivityStaffByTeacherName(
  teacherName: string,
  staffIndex: Map<string, Teacher>,
  staffLookupEntries: ActivityStaffLookupEntry[],
) {
  const lookupKeys = [
    normalizeTeacherLookupName(teacherName),
    normalizeStaffTaxonomy(teacherName),
  ].filter(Boolean);

  for (const key of lookupKeys) {
    const match = staffIndex.get(key);
    if (match) return match;
  }

  const tokens = normalizeTeacherLookupName(teacherName)
    .split(" ")
    .filter((token) => token.length >= 3);
  if (!tokens.length) return null;

  const fullTokenMatch = uniqueActivityStaffMatch(
    staffLookupEntries
      .filter((entry) => tokens.every((token) => entry.tokens.has(token)))
      .map((entry) => entry.staff),
  );
  if (fullTokenMatch) return fullTokenMatch;

  const leadingToken = tokens[0];
  if (leadingToken.length < 5) return null;
  return uniqueActivityStaffMatch(
    staffLookupEntries
      .filter((entry) => entry.tokens.has(leadingToken))
      .map((entry) => entry.staff),
  );
}

function activityStaffPositionCodes(teacher: Teacher) {
  const codes: string[] = [];
  const positions = Array.isArray(teacher.positions) ? teacher.positions : [];

  if (Array.isArray(teacher.positionCodes)) {
    codes.push(...teacher.positionCodes);
  }

  positions
    .filter(
      (position) => position.visibleOnWebsite !== false && position.visible_on_website !== false,
    )
    .forEach((position) => {
      codes.push(position.position_code || "", position.positionCode || "");
    });

  return [...new Set(codes.map(normalizePositionCode).filter(Boolean))];
}

function activityPositionCodeCandidates(activity: ExtraCurricularActivity) {
  const codes = new Set<string>();
  const add = (value: unknown) => {
    const code = normalizePositionCode(value);
    if (code) codes.add(code);
  };

  (activity.positionCodes || []).forEach(add);
  add(activity.id);
  add(`extra-${activity.id}`);
  add(`sport-${activity.id}`);
  add(`sports-${activity.id}`);

  const titleCode = normalizePositionCode(activity.title);
  const noteCodes = [
    normalizePositionCode(activity.note),
    normalizePositionCode(String(activity.note || "").replace(/\bschool\b/gi, "")),
  ].filter(Boolean);
  if (titleCode) {
    add(titleCode);
    add(`extra-${titleCode}`);
    add(`sport-${titleCode}`);
    add(`sports-${titleCode}`);
    noteCodes.forEach((noteCode) => {
      add(`${titleCode}-${noteCode}`);
      add(`extra-${titleCode}-${noteCode}`);
      add(`sport-${titleCode}-${noteCode}`);
      add(`sports-${titleCode}-${noteCode}`);
    });
  }

  const houseName = normalizePositionCode(activity.title.replace(/\bhouse\b/gi, ""));
  if (activity.groupId === "houses-coaches-and-trainers" && houseName) {
    add(`house-${houseName}`);
    add(`extra-house-${houseName}`);
    noteCodes.forEach((noteCode) => {
      add(`house-${houseName}-${noteCode}`);
      add(`extra-house-${houseName}-${noteCode}`);
    });
  }

  return codes;
}

function teacherHasActivityPositionCode(activity: ExtraCurricularActivity, teacher: Teacher) {
  const activityCodes = activityPositionCodeCandidates(activity);
  if (!activityCodes.size) return false;
  return activityStaffPositionCodes(teacher).some((code) => activityCodes.has(code));
}

function matchedActivityTeacherProfiles(matches: ActivityTeacherMatch[]) {
  return matches.filter((match): match is ActivityTeacherMatch & { staff: Teacher } =>
    Boolean(match.staff),
  );
}

function activityTeacherMatches(activity: ExtraCurricularActivity, teachers: Teacher[]) {
  const staffIndex = new Map<string, Teacher>();
  const staffLookupEntries: ActivityStaffLookupEntry[] = [];
  teachers.forEach((teacher) => {
    const keys = [
      normalizeTeacherLookupName(teacher.name || ""),
      normalizeStaffTaxonomy(teacher.name || ""),
    ].filter(Boolean);
    keys.forEach((key) => {
      if (!staffIndex.has(key)) staffIndex.set(key, teacher);
    });
    staffLookupEntries.push({
      staff: teacher,
      tokens: new Set(keys.flatMap((key) => key.split(" ")).filter((token) => token.length >= 3)),
    });
  });

  const matches: ActivityTeacherMatch[] = [...new Set(activity.teachers)]
    .filter(Boolean)
    .map((teacherName) => {
      const match = findActivityStaffByTeacherName(
        teacherName,
        staffIndex,
        staffLookupEntries,
      );
      return { teacherName, staff: match, source: "document" };
    });

  const matchesByName = new Map(
    matches
      .map((match) => [activityTeacherNameKey(match.teacherName), match] as const)
      .filter(([key]) => Boolean(key)),
  );
  const matchedStaffKeys = new Set(
    matches
      .map((match) => (match.staff ? activityTeacherProfileKey(match.staff) : ""))
      .filter(Boolean),
  );

  teachers.forEach((teacher) => {
    if (!teacherHasActivityPositionCode(activity, teacher)) return;
    const staffKey = activityTeacherProfileKey(teacher);
    const nameKey = activityTeacherNameKey(teacher.name || "");
    const existingNameMatch = nameKey ? matchesByName.get(nameKey) : undefined;

    if (existingNameMatch) {
      if (!existingNameMatch.staff) existingNameMatch.staff = teacher;
      matchedStaffKeys.add(staffKey);
      return;
    }

    if (matchedStaffKeys.has(staffKey)) return;

    const teacherName = teacher.name || staffKey;
    const match: ActivityTeacherMatch = {
      teacherName,
      staff: teacher,
      source: "position-code",
    };
    matches.push(match);
    matchedStaffKeys.add(staffKey);
    const newNameKey = activityTeacherNameKey(teacherName);
    if (newNameKey) matchesByName.set(newNameKey, match);
  });

  return matches;
}

function activityEventKeywords(activity: ExtraCurricularActivity) {
  const manualKeywords: Record<string, string[]> = {
    "photography-and-media-unit": ["photography", "media", "broadcasting"],
    "teachers-in-charge-of-prefects-senior": ["prefects", "prefect", "leadership"],
    "teachers-in-charge-of-prefects-primary": ["prefects", "prefect", "leadership"],
    "teachers-in-charge-of-stewards": ["steward", "stewards"],
    "discipline-and-prefects-advisory-committee": ["discipline", "prefects", "prefect"],
    "english-literary-union-secondary": ["english literary", "literary", "debate"],
    "english-literary-union-primary": ["english literary", "literary", "debate"],
    "sinhala-literary-association": ["sinhala literary", "literary"],
    "bible-association": ["bible", "religious", "faith"],
    "liturgical-committee": ["liturgical", "liturgy", "altar"],
    "altar-servers-association": ["altar", "servers", "liturgy"],
    scouts: ["scout", "scouts", "camp"],
    "cub-scouts": ["cub scout", "cub scouts", "scout"],
    "singithi-scouts": ["singithi scout", "singithi scouts", "scout"],
    athletics: ["athletic", "athletics", "sports meet"],
    cricket: ["cricket"],
    "cricket-academy": ["cricket academy", "cricket"],
    volleyball: ["volleyball"],
    basketball: ["basketball"],
    karate: ["karate"],
    swimming: ["swimming", "swim"],
    chess: ["chess"],
  };

  const phraseKeywords = [activity.title, activity.note]
    .map((value) => normalizeStaffTaxonomy(value || ""))
    .filter(Boolean);
  const wordKeywords = phraseKeywords.flatMap((phrase) =>
    phrase
      .split(" ")
      .filter((word) => word.length >= 4)
      .filter((word) => !EXTRA_CURRICULAR_EVENT_STOPWORDS.has(word)),
  );
  const allKeywords = [...phraseKeywords, ...wordKeywords, ...(manualKeywords[activity.id] || [])]
    .map((value) => normalizeStaffTaxonomy(value))
    .filter(Boolean);

  return [...new Set(allKeywords)];
}

function activityEvents(activity: ExtraCurricularActivity, events: EventItem[]) {
  const keywords = activityEventKeywords(activity);
  return events.filter((event) => {
    const haystack = normalizeStaffTaxonomy(
      [
        event.title,
        event.type,
        event.location,
        event.description,
        event.venue,
        event.posterUrl,
        event.poster_url,
      ]
        .filter(Boolean)
        .join(" "),
    );
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function activityGalleryAlbums(activity: ExtraCurricularActivity, gallery: GalleryItem[]) {
  const directMatches = gallery.filter(
    (album) =>
      album.visible !== false &&
      normalizeStaffTaxonomy(album.activityId || "") === normalizeStaffTaxonomy(activity.id),
  );
  if (directMatches.length) return directMatches;

  const keywords = activityEventKeywords(activity);
  return gallery.filter((album) => {
    if (album.visible === false) return false;
    const haystack = normalizeStaffTaxonomy(
      [album.id, album.label, album.description, album.link].filter(Boolean).join(" "),
    );
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function activityGalleryImages(albums: GalleryItem[]) {
  return [...new Set(albums.flatMap((album) => albumImages(album)).filter(Boolean))];
}

function activityGalleryLogo(albums: GalleryItem[]) {
  return albums.find((album) => album.logoImage)?.logoImage || "";
}

function activitySummary(
  activity: ExtraCurricularActivity,
  teacherMatches?: ActivityTeacherMatch[],
) {
  const teacherCount = teacherMatches?.length ?? activity.teachers.length;
  if (activity.note && teacherCount) {
    return `${activity.note} | ${teacherCount} teacher${teacherCount === 1 ? "" : "s"} in charge`;
  }
  if (activity.note) return activity.note;
  return `${teacherCount} teacher${teacherCount === 1 ? "" : "s"} in charge`;
}

function extraCurricularGroupIcon(groupId: string): LucideIcon {
  const iconMap: Record<string, LucideIcon> = {
    "clubs-and-societies": BookOpen,
    "leadership-and-service": ShieldCheck,
    "faith-and-performing-arts": Bell,
    "sports-and-outdoor": Trophy,
    "houses-coaches-and-trainers": Award,
  };
  return iconMap[groupId] || Award;
}

function extraCurricularGroupTheme(groupId: string) {
  const themes: Record<
    string,
    {
      panelClass: string;
      iconClass: string;
      pillClass: string;
      softCardClass: string;
      glowClass: string;
    }
  > = {
    "clubs-and-societies": {
      panelClass: "from-[#f7fbff] via-white to-[#eef5ff]",
      iconClass: "bg-[#edf4ff] text-[#234b93]",
      pillClass: "border border-[#d8e6ff] bg-[#eef4ff] text-[#234b93]",
      softCardClass: "border-[#dce7f8] bg-[#f7fbff]",
      glowClass: "bg-[#dbeafe]",
    },
    "leadership-and-service": {
      panelClass: "from-[#fffaf0] via-white to-[#fff3dc]",
      iconClass: "bg-[#fff1cf] text-[#9a6700]",
      pillClass: "border border-[#f2dfad] bg-[#fff6df] text-[#8a5b00]",
      softCardClass: "border-[#f0e1bc] bg-[#fffaf0]",
      glowClass: "bg-[#fde68a]",
    },
    "faith-and-performing-arts": {
      panelClass: "from-[#fff7f9] via-white to-[#ffeef3]",
      iconClass: "bg-[#ffe7ef] text-[#a4285d]",
      pillClass: "border border-[#f3d6e2] bg-[#fff0f5] text-[#9d2957]",
      softCardClass: "border-[#f2dde6] bg-[#fff8fb]",
      glowClass: "bg-[#fbcfe8]",
    },
    "sports-and-outdoor": {
      panelClass: "from-[#f4fff8] via-white to-[#ebf7ff]",
      iconClass: "bg-[#e7fbef] text-[#0d6b4d]",
      pillClass: "border border-[#ccefd9] bg-[#eefbf3] text-[#0d6b4d]",
      softCardClass: "border-[#d8eee1] bg-[#f5fff9]",
      glowClass: "bg-[#bbf7d0]",
    },
    "houses-coaches-and-trainers": {
      panelClass: "from-[#faf7ff] via-white to-[#f2efff]",
      iconClass: "bg-[#f0ebff] text-[#5e4bb6]",
      pillClass: "border border-[#ddd6fe] bg-[#f4f0ff] text-[#5a48b2]",
      softCardClass: "border-[#e2dcfb] bg-[#faf8ff]",
      glowClass: "bg-[#ddd6fe]",
    },
  };

  return (
    themes[groupId] || {
      panelClass: "from-[#f8fafc] via-white to-[#eef2f7]",
      iconClass: "bg-slate-100 text-slate-700",
      pillClass: "border border-slate-200 bg-slate-50 text-slate-700",
      softCardClass: "border-slate-200 bg-slate-50",
      glowClass: "bg-slate-200",
    }
  );
}

function extraCurricularActivityIcon(activity: ExtraCurricularActivity): LucideIcon {
  const label = normalizeStaffTaxonomy(`${activity.title} ${activity.note || ""} ${activity.id}`);

  if (label.includes("photography") || label.includes("media") || label.includes("broadcasting")) {
    return Camera;
  }
  if (
    label.includes("literary") ||
    label.includes("debate") ||
    label.includes("speech") ||
    label.includes("wall mag") ||
    label.includes("articles")
  ) {
    return BookOpen;
  }
  if (
    label.includes("prefect") ||
    label.includes("discipline") ||
    label.includes("steward") ||
    label.includes("leadership")
  ) {
    return ShieldCheck;
  }
  if (
    label.includes("choir") ||
    label.includes("band") ||
    label.includes("orchestra") ||
    label.includes("drama") ||
    label.includes("dance")
  ) {
    return PlayCircle;
  }
  if (
    label.includes("bible") ||
    label.includes("liturgical") ||
    label.includes("altar") ||
    label.includes("vocation") ||
    label.includes("religious")
  ) {
    return Landmark;
  }
  if (label.includes("scout") || label.includes("cadet")) {
    return Users;
  }
  if (label.includes("swimming")) {
    return Waves;
  }
  if (
    label.includes("cricket") ||
    label.includes("volleyball") ||
    label.includes("basketball") ||
    label.includes("athletics") ||
    label.includes("karate") ||
    label.includes("chess") ||
    label.includes("sports")
  ) {
    return Trophy;
  }
  if (label.includes("coach") || label.includes("trainer") || label.includes("house")) {
    return Award;
  }
  return extraCurricularGroupIcon(activity.groupId);
}

function activityTeacherPreview(
  activity: ExtraCurricularActivity,
  limit = 3,
  teacherMatches?: ActivityTeacherMatch[],
) {
  const names = teacherMatches
    ? teacherMatches.map((match) => match.teacherName)
    : activity.teachers;
  return [...new Set(names)].filter(Boolean).slice(0, limit);
}

const EXTRA_CURRICULAR_ACTIVITY_DESCRIPTIONS: Record<string, string> = {
  basketball:
    "Basketball builds teamwork, court awareness, stamina, and sportsmanship through regular practice, skills development, and competitive play.",
  "defence-cadet-girls":
    "The girls' Defence Cadet programme develops discipline, confidence, teamwork, and ceremonial readiness through structured cadet training.",
  "sports-committee-leadership":
    "Sports Committee Leadership coordinates student participation, inter-house events, fixtures, and the values of fair play across college sports.",
};

function activityLeadText(activity: ExtraCurricularActivity) {
  const customDescription = EXTRA_CURRICULAR_ACTIVITY_DESCRIPTIONS[activity.id];
  if (customDescription) return customDescription;

  const notePrefix = activity.note && activity.note !== "Team Sport" ? `${activity.note} ` : "";
  const title = activity.title;

  if (activity.groupId === "sports-and-outdoor") {
    return `${notePrefix}${title} helps students develop discipline, fitness, teamwork, resilience, and sportsmanship through guided training and active participation.`;
  }

  if (activity.groupId === "faith-and-performing-arts") {
    return `${notePrefix}${title} nurtures faith, confidence, creativity, cultural expression, and performance skills through guided practice and school events.`;
  }

  if (activity.groupId === "houses-coaches-and-trainers") {
    if (normalizeStaffTaxonomy(title).includes("house")) {
      return `${notePrefix}${title} strengthens house spirit, student leadership, teamwork, and inter-house participation across college activities.`;
    }
    return `${notePrefix}${title} supports student development through specialist coaching, structured practice, mentoring, and preparation for school events or competitions.`;
  }

  if (activity.groupId === "leadership-and-service") {
    return `${notePrefix}${title} forms students in responsibility, discipline, service, coordination, and practical leadership within the school community.`;
  }

  return `${notePrefix}${title} gives students a structured space to develop communication, creativity, teamwork, service, and leadership through regular school activities.`;
}

function SportsClubsPage() {
  const db = useDb();
  const page = db.pages["sports-clubs"];
  const [searchTerm, setSearchTerm] = useState("");
  const searchKey = normalizeStaffTaxonomy(searchTerm);
  const groups = EXTRA_CURRICULAR_GROUPS.map((group) => ({
    ...group,
    icon: extraCurricularGroupIcon(group.id),
    theme: extraCurricularGroupTheme(group.id),
    items: extraCurricularActivitiesByGroup(group.id, db.customActivities)
      .map((activity) => {
        const teacherMatches = activityTeacherMatches(activity, db.teachers);
        const matchedTeacherProfiles = matchedActivityTeacherProfiles(teacherMatches);
        const galleryAlbums = activityGalleryAlbums(activity, db.gallery);
        return {
          activity,
          icon: extraCurricularActivityIcon(activity),
          matchedTeacherProfiles,
          galleryAlbums,
          galleryPhotoCount: activityGalleryImages(galleryAlbums).length,
          matchedProfileCount: matchedTeacherProfiles.length,
        };
      })
      .filter(({ activity, matchedTeacherProfiles }) => {
        if (!searchKey) return true;
        return normalizeStaffTaxonomy(
          [
            activity.title,
            activity.note,
            group.title,
            group.description,
            ...(activity.teachers || []),
            ...matchedTeacherProfiles.map((match) => match.teacherName),
          ]
            .filter(Boolean)
            .join(" "),
        ).includes(searchKey);
      }),
  })).filter((group) => group.items.length > 0);
  const visibleActivityCount = groups.reduce((count, group) => count + group.items.length, 0);
  return (
    <PublicLayout>
      <PageHeader
        pageId="sports-clubs"
        kicker={page.kicker || "Sports & Clubs"}
        title={page.title || "Student leadership, clubs, societies, sports, and achievements."}
        subtitle={
          page.body ||
          "A complete co-curricular directory for student leadership, service, faith formation, performing arts, sports, houses, coaching, and outdoor programmes."
        }
        image={page.image}
      />
      <section id="sports" className="mx-auto max-w-7xl px-6 py-20">
        {/* Directory intro card */}
        <div className="overflow-hidden rounded-2xl border border-[#dbe5f1] bg-white shadow-[0_8px_40px_-16px_rgba(10,22,40,0.18)]">
          {/* navy top accent band */}
          <div className="h-1.5 w-full bg-gradient-to-r from-navy via-[#1e3a6e] to-crimson" />
          <div className="p-8 md:p-12">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-crimson">
                  <Award className="h-3.5 w-3.5" />
                  Co-Curricular Directory
                </p>
                <h2 className="mt-4 font-serif text-3xl font-bold leading-snug text-navy md:text-4xl">
                  Activities, clubs, societies,<br className="hidden md:block" /> sports &amp; student leadership.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">
                  Explore the programmes that shape confidence, discipline, creativity, teamwork,
                  service, and school spirit beyond the classroom.
                </p>
                <div className="relative mt-6 max-w-lg">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search clubs, societies, sports, or teachers…"
                    className="h-12 w-full rounded-xl border border-[#d9e4f2] bg-[#f8fafd] pl-11 pr-4 text-sm text-navy outline-none transition-smooth placeholder:text-slate-400 focus:border-navy/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(35,75,147,0.08)]"
                  />
                </div>
                {searchKey && (
                  <p className="mt-2.5 text-xs font-medium text-slate-400">
                    {visibleActivityCount} result{visibleActivityCount === 1 ? "" : "s"} for &ldquo;{searchTerm.trim()}&rdquo;
                  </p>
                )}
              </div>
              {/* Stats column */}
              <div className="flex shrink-0 gap-6 lg:flex-col lg:gap-4 lg:text-right">
                <div>
                  <p className="text-2xl font-bold text-navy">{groups.reduce((n, g) => n + g.items.length, 0)}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Activities</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-navy">{groups.length}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Categories</p>
                </div>
              </div>
            </div>
            {/* Category jump links */}
            <div className="mt-8 border-t border-[#edf1f8] pt-6">
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => {
                  const Icon = group.icon;
                  return (
                    <a
                      key={group.id}
                      href={`#${group.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#dbe5f1] bg-[#f7f9fd] px-3.5 py-2 text-xs font-semibold text-navy transition-smooth hover:border-navy/30 hover:bg-navy hover:text-white"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {group.title}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {groups.length === 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-[#dbe5f1] bg-white px-8 py-10 text-center text-sm text-slate-400">
            No club, society, sport, or activity matches this search.
          </div>
        )}

        {groups.map((group) => {
          const GroupIcon = group.icon;
          return (
            <section key={group.id} id={group.id} className="mt-16">
              {/* Section header */}
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#e8edf6] pb-5">
                <div className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${group.theme.iconClass}`}>
                    <GroupIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Activity Collection</p>
                    <h2 className="mt-0.5 font-serif text-2xl font-bold text-navy">{group.title}</h2>
                  </div>
                </div>
                <span className="rounded-lg border border-[#dbe5f1] bg-white px-3 py-1.5 text-xs font-bold text-slate-500">
                  {group.items.length} {group.items.length === 1 ? "activity" : "activities"}
                </span>
              </div>
              <p className="mb-8 -mt-4 max-w-2xl text-sm leading-7 text-slate-500">{group.description}</p>

              <div className="stagger-children grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map(
                  ({
                    activity,
                    icon: Icon,
                    matchedTeacherProfiles,
                    galleryPhotoCount,
                    matchedProfileCount,
                  }) => {
                    const teacherPreview = activityTeacherPreview(
                      activity,
                      3,
                      matchedTeacherProfiles,
                    );
                    const teacherCount = matchedTeacherProfiles.length;
                    return (
                      <article
                        key={activity.id}
                        id={activity.id}
                        className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#dbe4f0] bg-white shadow-[0_2px_16px_-6px_rgba(10,22,40,0.12)] transition-smooth hover:-translate-y-0.5 hover:border-[#b8c8e8] hover:shadow-[0_8px_32px_-12px_rgba(10,22,40,0.2)]"
                      >
                        {/* Colored top strip */}
                        <div className={`h-1 w-full ${group.theme.glowClass}`} />
                        <div className="flex flex-1 flex-col p-6">
                          {/* Icon + badges row */}
                          <div className="flex items-start justify-between gap-3">
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${group.theme.iconClass}`}>
                              <Icon className="h-4.5 w-4.5" />
                            </span>
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {activity.note && (
                                <span className="rounded-md bg-crimson/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-crimson">
                                  {activity.note}
                                </span>
                              )}
                              <span className="rounded-md border border-[#e2e8f2] bg-[#f7f9fd] px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                                {teacherCount} {teacherCount === 1 ? "Teacher" : "Teachers"}
                              </span>
                            </div>
                          </div>
                          {/* Title + description */}
                          <h3 className="mt-4 font-serif text-xl font-bold leading-snug text-navy">
                            {activity.title}
                          </h3>
                          <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">
                            {activityLeadText(activity)}
                          </p>
                          {/* Teacher chips */}
                          {teacherPreview.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-1.5">
                              {teacherPreview.map((teacherName) => (
                                <span
                                  key={`${activity.id}-${teacherName}`}
                                  className="rounded-full border border-[#e2e8f2] bg-[#f7f9fd] px-2.5 py-1 text-[11px] font-medium text-slate-600"
                                >
                                  {teacherName}
                                </span>
                              ))}
                              {teacherCount > teacherPreview.length && (
                                <span className="rounded-full border border-[#e2e8f2] bg-[#f7f9fd] px-2.5 py-1 text-[11px] font-medium text-slate-400">
                                  +{teacherCount - teacherPreview.length} more
                                </span>
                              )}
                            </div>
                          )}
                          {/* Stats row */}
                          <div className="mt-5 flex items-center gap-4 border-t border-[#edf1f8] pt-4">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                              <Images className="h-3.5 w-3.5 text-gold" />
                              {galleryPhotoCount} Photos
                            </span>
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                              <Eye className="h-3.5 w-3.5 text-gold" />
                              {matchedProfileCount} Profiles
                            </span>
                            <a
                              href={extraCurricularActivityHref(activity.id)}
                              className="ml-auto flex items-center gap-1 text-xs font-bold text-navy transition-smooth hover:text-crimson"
                            >
                              View page <ArrowRight className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </section>
          );
        })}
      </section>
      <SubpagesSection parentId="sports-clubs" />
    </PublicLayout>
  );
}

function SportsClubsActivityPage({ activityId }: { activityId: string }) {
  const db = useDb();
  const page = db.pages["sports-clubs"];
  const activity = extraCurricularActivityById(activityId, db.customActivities);

  if (!activity) {
    return (
      <PublicLayout>
        <PageHeader
          pageId="sports-clubs"
          kicker={page.kicker || "Sports & Clubs"}
          title="Activity not found"
          subtitle="This sports or club activity page is not available."
          image={page.image}
        />
        <section className="mx-auto max-w-5xl px-6 py-20">
          <a
            href="/sports-clubs"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-5 py-3 text-sm font-bold text-navy shadow-soft"
          >
            Back to Sports & Clubs <ArrowRight className="h-4 w-4" />
          </a>
        </section>
      </PublicLayout>
    );
  }

  const group = EXTRA_CURRICULAR_GROUPS.find((item) => item.id === activity.groupId);
  const groupTheme = extraCurricularGroupTheme(activity.groupId);
  const ActivityIcon = extraCurricularActivityIcon(activity);
  const teacherProfiles = activityTeacherMatches(activity, db.teachers);
  const matchedTeacherProfiles = matchedActivityTeacherProfiles(teacherProfiles);
  const galleryAlbums = activityGalleryAlbums(activity, db.gallery);
  const galleryImages = activityGalleryImages(galleryAlbums);
  const logoImage = activityGalleryLogo(galleryAlbums);
  const relatedActivities = extraCurricularActivitiesByGroup(
    activity.groupId,
    db.customActivities,
  ).filter(
    (item) => item.id !== activity.id,
  );
  const previewTeachers = activityTeacherPreview(activity, 3, matchedTeacherProfiles);

  return (
    <PublicLayout>
      <PageHeader
        pageId="sports-clubs"
        kicker={group?.title || page.kicker || "Sports & Clubs"}
        title={activity.title}
        subtitle={activityLeadText(activity)}
        image={page.image}
      />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div
          className={`overflow-hidden rounded-[34px] border border-[#dbe5f1] bg-gradient-to-br ${groupTheme.panelClass} p-8 shadow-[0_24px_80px_-42px_rgba(10,22,40,0.5)] md:p-10`}
        >
          <div className="grid gap-8 xl:grid-cols-[1.2fr_0.9fr]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`grid h-14 w-14 place-items-center rounded-3xl shadow-soft ${groupTheme.iconClass}`}
                >
                  {logoImage ? (
                    <img
                      src={logoImage}
                      alt={`${activity.title} logo`}
                      className="h-full w-full rounded-3xl object-cover"
                    />
                  ) : (
                    <ActivityIcon className="h-6 w-6" />
                  )}
                </span>
                <span
                  className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] shadow-soft ${groupTheme.pillClass}`}
                >
                  {group?.title || "Sports & Clubs"}
                </span>
                {activity.note && (
                  <span className="rounded-full border border-[#d9e1ef] bg-white/90 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 shadow-soft">
                    {activity.note}
                  </span>
                )}
              </div>
              <h2 className="mt-6 max-w-4xl font-serif text-4xl font-bold leading-tight text-navy md:text-5xl">
                {activity.title}
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
                {activityLeadText(activity)}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {previewTeachers.map((teacherName) => (
                  <span
                    key={`${activity.id}-${teacherName}-hero`}
                    className="rounded-full bg-white/92 px-4 py-2 text-sm font-semibold text-slate-600 shadow-soft"
                  >
                    {teacherName}
                  </span>
                ))}
                {matchedTeacherProfiles.length > previewTeachers.length && (
                  <span
                    className={`rounded-full px-4 py-2 text-sm font-semibold shadow-soft ${groupTheme.pillClass}`}
                  >
                    +{matchedTeacherProfiles.length - previewTeachers.length} more teachers
                  </span>
                )}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/sports-clubs"
                  className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-bold text-white shadow-soft transition-smooth hover:-translate-y-0.5 hover:bg-navy-mid"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Directory
                </a>
                <a
                  href="#activity-gallery"
                  className="inline-flex items-center gap-2 rounded-full border border-[#d9e1ef] bg-white/90 px-5 py-3 text-sm font-bold text-navy shadow-soft transition-smooth hover:-translate-y-0.5 hover:border-gold"
                >
                  <Images className="h-4 w-4 text-gold" />
                  View Gallery
                </a>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <article className="rounded-[24px] border border-[#dce7f8] bg-white/92 p-5 shadow-soft">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  <Users className="h-4 w-4 text-gold" />
                  Teachers In Charge
                </p>
                <p className="mt-4 font-serif text-4xl font-bold text-navy">
                  {matchedTeacherProfiles.length}
                </p>
                <p className="mt-2 text-sm text-slate-500">Matched from staff positions</p>
              </article>
              <article className="rounded-[24px] border border-[#dce7f8] bg-white/92 p-5 shadow-soft">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  <Images className="h-4 w-4 text-gold" />
                  Gallery Photos
                </p>
                <p className="mt-4 font-serif text-4xl font-bold text-navy">
                  {galleryImages.length}
                </p>
                <p className="mt-2 text-sm text-slate-500">Uploaded by website admins</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-crimson">
            Teacher Profiles
          </p>
          <h2 className="mt-3 font-serif text-4xl font-bold text-navy">Teachers In Charge</h2>
          {matchedTeacherProfiles.length ? (
            <div className="stagger-children mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {matchedTeacherProfiles.map(({ teacherName, staff }) => (
                <article
                  key={`${activity.id}-${activityTeacherProfileKey(staff)}`}
                  className="group overflow-hidden rounded-[28px] border border-[#dde6f4] bg-white shadow-[0_18px_48px_-34px_rgba(10,22,40,0.55)] transition-smooth hover:-translate-y-1 hover:border-gold/70 hover:shadow-elegant"
                >
                  <div className={`h-20 bg-gradient-to-r ${groupTheme.panelClass}`} />
                  <div className="-mt-10 px-6 pb-6">
                    <div className="flex items-end justify-between gap-3">
                      <img
                        src={staff.image || "/loyola-crest.jpg"}
                        alt={teacherName}
                        className="h-24 w-24 rounded-[24px] border-4 border-white bg-slate-100 object-cover shadow-soft"
                      />
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                        Matched Profile
                      </span>
                    </div>
                    <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-crimson">
                      Teacher In Charge
                    </p>
                    <h3 className="mt-2 font-serif text-2xl font-bold leading-tight text-navy">
                      {teacherName}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {staff.position || staff.subject || staff.type || "Public staff profile"}
                    </p>
                    {staff.qualifications && (
                      <p className="mt-4 line-clamp-4 text-sm leading-7 text-slate-600">
                        {staff.qualifications}
                      </p>
                    )}
                    <a
                      href={`/staff/${publicStaffSlug(staff.slug || staff.name || teacherName)}`}
                      className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#d9e1ef] bg-white px-4 py-2.5 text-sm font-bold text-navy shadow-soft transition-smooth hover:-translate-y-0.5 hover:border-gold"
                    >
                      <Eye className="h-4 w-4 text-gold" />
                      View Staff Profile
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-lg border border-border bg-white p-5 text-sm leading-6 text-slate-500 shadow-soft">
              No staff profiles are assigned to this activity yet. Add the matching extra activity
              position code in staff management to show teachers here.
            </p>
          )}
        </div>
      </section>

      <section id="activity-gallery" className="bg-secondary/35 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-crimson">
                Activity Gallery
              </p>
              <h2 className="mt-3 font-serif text-4xl font-bold text-navy">
                Photos and achievements for {activity.title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                Website admins can link a gallery album to this activity, upload a club logo, and
                add event or achievement photos from the Media Library.
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-soft ${groupTheme.pillClass}`}
            >
              <Images className="h-4 w-4" />
              {galleryImages.length} photo{galleryImages.length === 1 ? "" : "s"}
            </div>
          </div>
          {galleryAlbums.length ? (
            <div className="stagger-children mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {galleryAlbums.map((album) => {
                const images = albumImages(album);
                const cover = images[0] || album.image || "/loyola-crest.jpg";
                return (
                  <article
                    key={album.id}
                    className="overflow-hidden rounded-[28px] border border-[#dde6f4] bg-white shadow-[0_18px_48px_-34px_rgba(10,22,40,0.55)] transition-smooth hover:-translate-y-1 hover:border-gold/70 hover:shadow-elegant"
                  >
                    <a href={albumHref(album)} className="block overflow-hidden bg-[#fbfcfe]">
                      <img
                        src={cover}
                        alt={album.label}
                        className="aspect-video w-full object-cover transition-smooth hover:scale-105"
                      />
                    </a>
                    <div className="p-6">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-crimson">
                        {images.length} photo{images.length === 1 ? "" : "s"}
                      </p>
                      <h3 className="mt-2 font-serif text-2xl font-bold leading-tight text-navy">
                        {album.label}
                      </h3>
                      {album.description && (
                        <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-500">
                          {album.description}
                        </p>
                      )}
                      <div className="mt-5 grid grid-cols-4 gap-2">
                        {images.slice(0, 4).map((image) => (
                          <img
                            key={`${album.id}-${image}`}
                            src={image}
                            alt=""
                            className="aspect-square rounded-lg object-cover"
                          />
                        ))}
                      </div>
                      <a
                        href={albumHref(album)}
                        className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#d9e1ef] bg-white px-4 py-2.5 text-sm font-bold text-navy shadow-soft transition-smooth hover:-translate-y-0.5 hover:border-gold"
                      >
                        <Images className="h-4 w-4 text-gold" />
                        Open Gallery
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-6 rounded-lg border border-border bg-white p-5 text-sm leading-6 text-slate-500 shadow-soft">
              No gallery album is linked yet. In Website Admin, open Media Library, create or edit a
              photo album, select this activity page, then upload the logo and achievement photos.
            </p>
          )}
        </div>
      </section>

      {relatedActivities.length > 0 && (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-crimson">
              More in {group?.title || "this group"}
            </p>
            <h2 className="mt-3 font-serif text-4xl font-bold text-navy">Related activity pages</h2>
            <div className="stagger-children mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {relatedActivities.slice(0, 6).map((item) => {
                const RelatedIcon = extraCurricularActivityIcon(item);
                const relatedTeacherProfiles = matchedActivityTeacherProfiles(
                  activityTeacherMatches(item, db.teachers),
                );
                const preview = activityTeacherPreview(item, 2, relatedTeacherProfiles);
                return (
                  <a
                    key={item.id}
                    href={extraCurricularActivityHref(item.id)}
                    className="group relative overflow-hidden rounded-[26px] border border-[#dde6f4] bg-white p-5 shadow-[0_18px_48px_-34px_rgba(10,22,40,0.55)] transition-smooth hover:-translate-y-1 hover:border-gold/70 hover:shadow-elegant"
                  >
                    <div
                      className={`absolute right-0 top-0 h-24 w-24 rounded-bl-[28px] opacity-70 ${groupTheme.glowClass}`}
                    />
                    <div className="relative flex items-start justify-between gap-3">
                      <span
                        className={`grid h-11 w-11 place-items-center rounded-2xl shadow-soft ${groupTheme.iconClass}`}
                      >
                        <RelatedIcon className="h-5 w-5" />
                      </span>
                      {item.note && (
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${groupTheme.pillClass}`}
                        >
                          {item.note}
                        </span>
                      )}
                    </div>
                    <h3 className="relative mt-5 font-serif text-2xl font-bold text-navy">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-crimson">
                      {activitySummary(item, relatedTeacherProfiles)}
                    </p>
                    <div className="relative mt-4 flex flex-wrap gap-2">
                      {preview.map((teacherName) => (
                        <span
                          key={`${item.id}-${teacherName}-related`}
                          className="rounded-full bg-[#f7f8fb] px-3 py-1.5 text-xs font-semibold text-slate-600"
                        >
                          {teacherName}
                        </span>
                      ))}
                    </div>
                    <span className="relative mt-5 inline-flex items-center gap-2 text-sm font-bold text-crimson">
                      Open Page <ArrowRight className="h-4 w-4" />
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

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
        {/* Section heading + category chips */}
        <div className="mb-8 flex flex-col gap-6" data-scroll-reveal>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker text-crimson">Photo Albums</p>
              <h2 className="mt-2 font-serif text-3xl font-bold text-navy">College Gallery</h2>
            </div>
            <p className="text-sm text-muted-foreground">{albums.length} album{albums.length === 1 ? "" : "s"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category}
                id={category === "Video Gallery" ? "videos" : undefined}
                className="chip-filter"
              >
                {category}
              </span>
            ))}
          </div>
        </div>

        {/* Albums grid */}
        <div
          className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
          data-scroll-reveal
          data-reveal-dir="scale"
        >
          {albums.map((item) => {
            const images = (item.images || (item.image ? [item.image] : []))
              .filter(Boolean)
              .slice(0, 10);
            const cover = images[0] || "/loyola-crest.jpg";
            return (
              <article
                key={item.id}
                className="hover-lift card-img-zoom group overflow-hidden rounded-2xl border border-border bg-white shadow-soft"
              >
                {/* Cover with overlay */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img src={cover} alt={item.label} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="gallery-card-overlay" />
                  <div className="absolute bottom-3 left-4 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-navy backdrop-blur-sm">
                      {images.length} photo{images.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <p className="section-kicker text-crimson">{`Photo album`}</p>
                  <h2 className="mt-2 font-serif text-xl text-navy">{item.label}</h2>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {item.description || "Browse this Loyola College album and open the full collection."}
                  </p>
                  {images.length > 1 && (
                    <div className="mt-4 grid grid-cols-5 gap-1.5">
                      {images.slice(0, 5).map((image) => (
                        <img
                          key={image}
                          src={image}
                          alt=""
                          className="aspect-square rounded-lg object-cover transition-transform duration-300 hover:scale-110"
                        />
                      ))}
                    </div>
                  )}
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-shimmer mt-5 inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white transition-smooth hover:bg-navy-mid hover:-translate-y-px"
                    >
                      <Images className="h-3.5 w-3.5" /> View Album
                    </a>
                  ) : (
                    <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-muted-foreground/30 px-5 py-2.5 text-sm font-bold text-white">
                      <Images className="h-3.5 w-3.5" /> View Album
                    </span>
                  )}
                </div>
              </article>
            );
          })}
          {albums.length === 0 && (
            <div className="col-span-full rounded-2xl border border-border bg-white p-12 text-center shadow-soft">
              <Camera className="mx-auto h-10 w-10 text-gold/60" />
              <p className="mt-4 font-serif text-xl text-navy">No albums published yet</p>
              <p className="mt-2 text-sm text-muted-foreground">Photo albums will appear here.</p>
            </div>
          )}
        </div>

        {/* Video gallery CTA */}
        {videoAlbums.length > 0 && (
          <div
            className="mt-12 overflow-hidden rounded-2xl border border-border bg-white shadow-elegant"
            data-scroll-reveal
          >
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="section-kicker text-crimson">Video Gallery</p>
                <h2 className="mt-2 font-serif text-2xl font-bold text-navy">School Videos & Coverage</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Watch school events, ceremonies, and YouTube coverage in the dedicated video gallery.
                </p>
              </div>
              <a
                href="/gallery/video-gallery"
                className="btn-shimmer inline-flex shrink-0 items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white transition-smooth hover:bg-navy-mid hover:-translate-y-px"
              >
                <Film className="h-4 w-4" /> Open Video Gallery
              </a>
            </div>
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
        <div className="mb-8" data-scroll-reveal>
          <p className="section-kicker text-crimson">Document Library</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-navy">Available Downloads</h2>
        </div>
        <div
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
          data-scroll-reveal
          data-reveal-dir="scale"
        >
          {db.downloads.map((item) => (
            <article
              key={item.id}
              className="card-shine hover-lift group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-soft"
            >
              {/* Top accent */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold to-gold/30 transition-all duration-500 group-hover:from-gold group-hover:to-gold" />
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/10 text-gold transition-smooth group-hover:bg-gold/20">
                <Download className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-serif text-xl text-navy">{item.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
              {item.type && (
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-crimson">
                  {item.type}
                </p>
              )}
              <a
                href={item.fileUrl || "#"}
                download
                className={`mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-smooth ${
                  item.fileUrl
                    ? "btn-shimmer bg-navy hover:bg-navy-mid hover:-translate-y-px"
                    : "pointer-events-none bg-muted-foreground/45"
                }`}
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </article>
          ))}
          {db.downloads.length === 0 && (
            <div className="col-span-full rounded-2xl border border-border bg-white p-12 text-center shadow-soft">
              <FileText className="mx-auto h-10 w-10 text-gold/60" />
              <p className="mt-4 font-serif text-xl text-navy">No downloads published yet</p>
            </div>
          )}
        </div>
      </section>
      <SubpagesSection parentId="downloads" />
    </PublicLayout>
  );
}

function StudentPortalLandingPage() {
  const db = useDb();
  const page = db.pages["student-portal"];
  const portalLinks = [
    { label: "LMS Login", icon: BookOpen, color: "bg-[#1e6cbf]/10 text-[#1e6cbf]" },
    { label: "Exam Results", icon: Award, color: "bg-gold/10 text-gold" },
    { label: "Timetables", icon: Calendar, color: "bg-crimson/10 text-crimson" },
    { label: "Assignments", icon: FileText, color: "bg-[#0e7f5a]/10 text-[#0e7f5a]" },
    { label: "Online Resources", icon: BookOpen, color: "bg-[#7c3aed]/10 text-[#7c3aed]" },
    { label: "School Calendar", icon: Calendar, color: "bg-gold/10 text-gold" },
    { label: "Notices", icon: Bell, color: "bg-crimson/10 text-crimson" },
    { label: "Help / Support", icon: Mail, color: "bg-[#1e6cbf]/10 text-[#1e6cbf]" },
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
        {/* Section heading */}
        <div className="mb-10 text-center" data-scroll-reveal>
          <p className="section-kicker justify-center text-crimson">Secure Access</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-navy">Student & Parent Portal</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Login with your portal credentials to access your academic tools and resources.
          </p>
        </div>

        {/* Portal cards */}
        <div
          className="grid gap-5 md:grid-cols-4"
          data-scroll-reveal
          data-reveal-dir="scale"
        >
          {portalLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href="/login"
                className="card-shine hover-lift group relative overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-soft transition-smooth hover:border-gold/50"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-smooth group-hover:scale-110 ${item.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-serif text-lg font-bold text-navy">{item.label}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">Open Secure Portal</p>
                <ArrowRight className="absolute bottom-5 right-5 h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
              </a>
            );
          })}
        </div>

        {/* Login CTA */}
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-border bg-navy p-8 text-center text-white shadow-elegant" data-scroll-reveal>
          <ShieldCheck className="h-12 w-12 text-gold" />
          <h3 className="font-serif text-2xl font-bold">Ready to Log In?</h3>
          <p className="max-w-md text-sm text-white/75">
            Use your college-issued credentials to securely access the portal.
          </p>
          <a
            href="/login"
            className="btn-shimmer mt-2 inline-flex items-center gap-2 rounded-xl bg-gold px-8 py-3 text-sm font-bold text-navy transition-smooth hover:brightness-105 hover:-translate-y-px"
          >
            <Lock className="h-4 w-4" /> Log In to Portal
          </a>
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
  const socials = db.websiteContent.socials || {};
  const socialLinks = [
    { href: socials.facebook, label: "Facebook" },
    { href: socials.instagram, label: "Instagram" },
    { href: socials.youtube, label: "YouTube" },
    { href: socials.linkedin, label: "LinkedIn" },
  ].filter((s) => s.href && s.href !== "#");

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
        {/* Info sidebar */}
        <aside className="space-y-5" data-scroll-reveal data-reveal-dir="left">
          {/* Contact card */}
          <div className="relative overflow-hidden rounded-2xl bg-navy p-7 text-white shadow-elegant">
            {/* Decorative blobs */}
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold/12 blur-2xl" />
            <div className="absolute -bottom-8 -left-6 h-28 w-28 rounded-full bg-crimson/14 blur-2xl" />

            <h2 className="relative font-serif text-2xl font-bold">College Office</h2>
            <div className="relative mt-6 space-y-4 text-sm text-white/80">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/15">
                  <MapPin className="h-4 w-4 text-gold" />
                </div>
                <span className="leading-relaxed">{db.websiteContent.address}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/15">
                  <Phone className="h-4 w-4 text-gold" />
                </div>
                <span>{db.websiteContent.phone}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/15">
                  <Mail className="h-4 w-4 text-gold" />
                </div>
                <span>{db.websiteContent.email}</span>
              </div>
              {db.websiteContent.officeHours && (
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/15">
                    <Calendar className="h-4 w-4 text-gold" />
                  </div>
                  <span>{db.websiteContent.officeHours}</span>
                </div>
              )}
            </div>

            {/* Social links */}
            {socialLinks.length > 0 && (
              <div className="relative mt-6 flex flex-wrap gap-2 border-t border-white/12 pt-5">
                {socialLinks.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-white/80 transition-smooth hover:border-gold hover:text-gold"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-soft">
            <div className="relative aspect-[4/3] min-h-[240px]">
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
                className="absolute left-3 top-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-navy shadow-soft transition-smooth hover:-translate-y-px hover:shadow-elegant"
              >
                Open in Maps ↗
              </a>
            </div>
          </div>

          {/* Job vacancies link */}
          <a
            href="/job-vacancies"
            className="card-shine hover-lift flex items-center gap-4 rounded-2xl border border-border bg-white p-5 shadow-soft transition-smooth hover:border-gold/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-navy">Job Vacancies</p>
              <p className="text-xs text-muted-foreground">Current openings at the college</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          </a>
        </aside>

        {/* Contact form */}
        <div
          className="overflow-hidden rounded-2xl border border-border bg-white shadow-elegant"
          data-scroll-reveal
          data-reveal-dir="right"
        >
          <div className="border-b border-border bg-navy px-8 py-5">
            <p className="section-kicker text-gold/80">Get in Touch</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-white">{db.forms.contactTitle}</h2>
          </div>
          <form onSubmit={submit} className="p-8">
            {sent && (
              <div className="mb-6 flex items-center gap-3 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {db.forms.contactSuccessText}
              </div>
            )}
            <div className="grid gap-5 md:grid-cols-3">
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
              className="login-submit btn-shimmer mt-6 rounded-xl bg-navy px-8 py-3 text-sm font-bold text-white shadow-[0_4px_20px_-4px_rgba(10,22,40,0.5)] transition-smooth hover:bg-navy-mid hover:-translate-y-px"
            >
              {db.forms.contactSubmitLabel}
            </button>
          </form>
        </div>
      </section>
      <SubpagesSection parentId="contact" />
    </PublicLayout>
  );
}

function GenericPage({ pageId }: { pageId: string }) {
  const db = useDb();
  const page = db.pages[pageId];
  if (shouldRenderVisualBuilder(pageId, page)) return <VisualBuilderPage pageId={pageId} />;

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
        <section className="mx-auto max-w-4xl px-6 py-20" data-scroll-reveal>
          <article className="card-shine overflow-hidden rounded-2xl border border-border bg-white shadow-elegant">
            <div className="border-b border-border bg-navy px-8 py-5">
              <p className="section-kicker text-gold/80">{pageId === "home" ? "Home" : pageId.split("/").pop()?.replaceAll("-", " ")}</p>
              <h2 className="mt-1 font-serif text-3xl font-bold text-white capitalize">{title}</h2>
            </div>
            <div className="p-8">
              <p className="leading-8 text-muted-foreground whitespace-pre-wrap">
                {page?.body || "Add page content from the Page Builder."}
              </p>
            </div>
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
        <div className="grid gap-12 lg:grid-cols-[380px_1fr] lg:gap-16">
          <div className="relative h-fit" data-scroll-reveal data-reveal-dir="left">
            {/* Photo frame with gold accent */}
            <div className="relative overflow-hidden rounded-2xl shadow-elegant">
              <img
                src={db.media.principalImage || "/loyola-crest.jpg"}
                alt="Rector of Loyola College"
                className="w-full object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/30 to-transparent" />
            </div>
            {/* Gold accent block */}
            <div className="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-2xl bg-gradient-to-br from-gold/30 to-gold/5" />
            {/* Name tag */}
            <div className="mt-6 rounded-xl border border-border bg-white p-4 shadow-soft">
              <p className="section-kicker text-crimson">College Rector</p>
              <p className="mt-1 font-serif text-lg font-bold text-navy">Rev. Dr. D.M.J. Kennedy Perera</p>
              <p className="text-xs text-muted-foreground">Rector & Principal · Loyola College Negombo</p>
            </div>
          </div>
          <article className="prose prose-lg prose-slate max-w-none" data-scroll-reveal data-reveal-dir="right">
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
      const formData = new FormData(event.currentTarget);
      if (twoFactorChallenge) {
        await authenticateTwoFactor(twoFactorChallenge.token, twoFactorCode);
        redirectAfterLogin();
        return;
      }

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

  const pageTitle = twoFactorChallenge ? "Verify sign in" : "Welcome back";
  const pageSubtitle = twoFactorChallenge
    ? `Enter the authentication code for ${twoFactorChallenge.email}.`
    : "Enter your NIC number and password to continue.";

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
            <p className="mt-0.5 text-xs font-bold uppercase italic tracking-[0.22em] text-amber-300">
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
            <p className="text-[10px] font-bold uppercase italic tracking-[0.18em] text-[#d4a017]">
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
              {pageTitle}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{pageSubtitle}</p>
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
                    NIC number
                  </span>
                  <div className="relative mt-2">
                    <Mail className="absolute top-1/2 left-0 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="login-email"
                      name="email"
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="200012345678 or 991234567V"
                      className="input-line pl-7"
                    />
                  </div>
                  <span className="mt-2 block text-[11px] leading-4 text-slate-400">
                    Use your National Identity Card number. Master and super admins may also sign
                    in with email.
                  </span>
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
            ) : twoFactorChallenge ? (
              "Verify and continue ->"
            ) : (
              "Sign in to portal ->"
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
      href: EDUTRACK_LAUNCH_URL,
      icon: BookOpen,
      roles: EDUTRACK_ROLES,
      meta: "Full syllabus tracking workspace",
      lockedMeta: "Teachers, coordinators, and EduTrack admins",
    },
    {
      title: "ELMS",
      href: "/portal/elms",
      icon: GraduationCap,
      roles: ELMS_ROLES,
      meta: "Learning workspace",
      lockedMeta: "Students and top admins",
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
  const visibleModules =
    auth.user.role === "teacher"
      ? modules.filter(
          (module) => module.title === "EduTrack" || module.href === REPORT_CARDS_SYSTEM_URL,
        )
      : modules;

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
          {visibleModules.map((module) => {
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
        current.teacher_id === currentUser.id
          ? current
          : { ...current, teacher_id: currentUser.id },
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
  const isViewAdmin = currentUser.role === "viewadmin";

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
    teachers.find(
      (teacher) => String(teacher.id) === String(progressForm.teacher_id || currentUser.id),
    )?.name || currentUser.name;
  const workspaceMode = isViewAdmin
    ? "View-only workspace"
    : isAdmin
      ? "Admin workspace"
      : "Teacher workspace";

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
            <a href={EDUTRACK_LAUNCH_URL} className={secondaryButtonClass}>
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
                <DataList title="Academic terms" empty="No academic terms yet.">
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
                <DataList title="Syllabus items" empty="No syllabus items yet.">
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
                <DataList title="Progress log" empty="No progress records yet.">
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
                <DataList title="Warning log" empty="No warnings right now.">
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
                  {isViewAdmin
                    ? "View Admin can inspect EduTrack records but cannot create or update data."
                    : "Teachers can update progress. Admin can create terms and syllabus."}
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
                  <form onSubmit={submitSubject} className="grid gap-3">
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
                  <form onSubmit={submitSyllabus} className="grid gap-3">
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

              {activeTab === "progress" && !isViewAdmin && (
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
              {activeTab === "progress" && isViewAdmin && (
                <ReadOnlyPanel title="Progress records are view-only for this account." />
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
                    className={isAdmin || isViewAdmin ? secondaryButtonClass : primaryButtonClass}
                  >
                    {isViewAdmin ? "View progress" : "Update progress"}
                  </button>
                </div>
              )}
              {activeTab === "warnings" && (
                <div className="mt-5 grid gap-3">
                  <ReadOnlyPanel title="Warnings show subjects below the term threshold." />
                  <a href={EDUTRACK_LAUNCH_URL} className={secondaryButtonClass}>
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
  const launchUrl = EDUTRACK_PUBLIC_URL ? EDUTRACK_DIRECT_URL : EDUTRACK_LOCAL_URL;

  useEffect(() => {
    if (!auth.loading && !auth.user) window.location.href = "/login";
  }, [auth.loading, auth.user]);

  useEffect(() => {
    if (!auth.loading && auth.user && EDUTRACK_ROLES.includes(auth.user.role)) {
      window.location.replace(launchUrl);
    }
  }, [auth.loading, auth.user, launchUrl]);

  if (auth.loading || !auth.user) {
    return <BrandedLoader title="Opening EduTrack" subtitle="Checking your session" />;
  }

  if (!EDUTRACK_ROLES.includes(auth.user.role)) {
    return (
      <AccessDeniedPage message="EduTrack is available for Master Admin, Super Admin, EduTrack Admin, View Admin, and Teacher accounts." />
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#081324] px-6 text-white">
      <section className="max-w-lg rounded-lg border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-gold">EduTrack</p>
        <h1 className="mt-3 font-serif text-4xl font-bold">Opening separate app</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          EduTrack now runs outside the public website. You will be redirected to the separate
          EduTrack system.
        </p>
        <a
          href={launchUrl}
          className="mt-6 inline-flex rounded-lg bg-gold px-5 py-3 text-sm font-black text-navy"
        >
          Open EduTrack
        </a>
      </section>
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
        { label: "Terms", href: edutrackHref("?tab=terms") },
        { label: "Syllabus", href: edutrackHref("?tab=syllabus") },
        { label: "Progress", href: edutrackHref("?tab=progress") },
        { label: "Warnings", href: edutrackHref("?tab=warnings") },
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
      actions: [{ label: "Open Report Card System", href: REPORT_CARDS_SYSTEM_URL }],
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
    viewadmin: <AdminPortal />,
    superadmin: <AdminPortal />,
    masteradmin: <AdminPortal />,
  };
  return <Suspense fallback={loading}>{portals[role] || <LoginPage />}</Suspense>;
}

function NewsAndEventsPreview() {
  const db = useDb();
  return (
    <section className="border-y border-border bg-[linear-gradient(180deg,#ffffff_0%,#f8faff_100%)] py-20">
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
  event: EventItem;
  compact?: boolean;
}) {
  const date = new Date(event.date);
  const hasValidDate = !Number.isNaN(date.getTime());
  const dayLabel = hasValidDate ? String(date.getDate()).padStart(2, "0") : "TBA";
  const monthLabel = hasValidDate ? date.toLocaleString("en", { month: "short" }).toUpperCase() : "DATE";
  const image = event.image || event.posterUrl || event.poster_url || "";
  const hasImage = Boolean(image);
  const description = event.description?.trim();

  if (compact) {
    return (
      <article className="group overflow-hidden rounded-2xl border border-border bg-white shadow-soft transition duration-500 hover:-translate-y-1 hover:shadow-[0_24px_60px_-32px_rgba(13,21,43,0.25)]">
        {hasImage ? (
          <div className="grid grid-cols-[104px_1fr]">
            <div className="relative min-h-36 overflow-hidden bg-slate-100">
              <img
                src={image}
                alt={event.title}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-navy/75 via-navy/20 to-transparent" />
              <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-navy backdrop-blur">
                {event.type}
              </div>
              <div className="absolute bottom-3 left-3 rounded-2xl bg-white/90 px-3 py-2 text-navy shadow-lg backdrop-blur">
                <p className="font-serif text-2xl font-black leading-none">{dayLabel}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-crimson">
                  {monthLabel}
                </p>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-crimson">
                {event.location}
              </p>
              <h3 className="mt-2 text-base font-bold leading-snug text-ink">{event.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {description || "Event details and campus highlights will appear here."}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-2xl bg-navy/6 px-4 py-3 text-center text-navy">
                <p className="font-serif text-3xl font-black leading-none">{dayLabel}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-crimson">
                  {monthLabel}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-crimson">
                  {event.type}
                </p>
                <h3 className="mt-2 text-base font-bold leading-snug text-ink">{event.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{event.location}</p>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {description || "Event details will appear here."}
                </p>
              </div>
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <article className="group overflow-hidden rounded-3xl border border-border bg-white shadow-soft transition duration-500 hover:-translate-y-1 hover:shadow-[0_28px_72px_-36px_rgba(13,21,43,0.3)]">
      {hasImage ? (
        <div className="group relative aspect-[16/10] overflow-hidden bg-slate-100">
          <img
            src={image}
            alt={event.title}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/25 to-transparent" />
          <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-navy shadow-lg backdrop-blur">
            {event.type}
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-end gap-4 text-white">
            <div className="rounded-3xl bg-white/15 px-4 py-3 shadow-[0_14px_32px_-18px_rgba(0,0,0,0.85)] backdrop-blur-md">
              <p className="font-serif text-4xl font-black leading-none">{dayLabel}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                {monthLabel}
              </p>
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-serif text-2xl font-bold leading-tight drop-shadow">
                {event.title}
              </h3>
              <p className="mt-1 text-sm text-white/85">{event.location}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-b border-border bg-page-soft/70 p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-3xl bg-navy/6 px-4 py-3 text-center text-navy">
              <p className="font-serif text-4xl font-black leading-none">{dayLabel}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-crimson">
                {monthLabel}
              </p>
            </div>
            <div className="min-w-0">
              <p className="rounded-full bg-crimson/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-crimson">
                {event.type}
              </p>
              <h3 className="mt-3 font-serif text-2xl font-bold leading-tight text-navy">
                {event.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{event.location}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-crimson/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-crimson">
            {event.type}
          </span>
          <span className="rounded-full bg-navy/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-navy">
            {event.location}
          </span>
          {hasValidDate && (
            <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gold">
              {date.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {description || "Event details, photo highlights, and schedule notes will appear here."}
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
