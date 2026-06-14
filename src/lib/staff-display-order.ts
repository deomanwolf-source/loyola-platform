import {
  FIXED_POSITION_CODE_ORDER,
  normalizePositionCode,
  parsePositionCode,
  type ParsedPositionCode,
} from "@/lib/staff-position-codes";

export type StaffDisplayGroup = {
  id: string;
  title: string;
  sideTitle?: string;
  codes?: string[];
  match?: (position: ParsedPositionCode) => boolean;
};

const classTeacherRange = (from: number, to: number) => (position: ParsedPositionCode) =>
  position.main_category === "Class Teachers" &&
  Number(position.grade || 0) >= from &&
  Number(position.grade || 0) <= to;

export const STAFF_DISPLAY_GROUPS: StaffDisplayGroup[] = [
  {
    id: "academic-1st",
    title: "Academic Staff",
    sideTitle: "1st",
    codes: [
      "rector-principal",
      "vice-rector",
      "principal-primary",
      "priest-in-charge-middle-upper",
      "priest-in-charge-advanced-level",
      "sectional-head-upper",
      "deputy-principal",
    ],
  },
  {
    id: "vice-principals",
    title: "Vice Principals",
    codes: [
      "vice-principal-advanced-level",
      "vice-principal-primary",
      "vice-principal-middle",
      "vice-principal-upper",
    ],
  },
  {
    id: "academic-coordinators",
    title: "Academic Co-ordinators",
    match: (position) => position.section === "Academic Coordinators",
  },
  {
    id: "assistant-sectional-heads",
    title: "Assistant Sectional Heads",
    codes: [
      "assistant-sectional-head-primary",
      "assistant-sectional-head-middle",
      "assistant-sectional-head-upper",
      "assistant-sectional-head-advanced-level",
    ],
  },
  {
    id: "subject-heads",
    title: "Subject Heads",
    codes: [
      "subject-head-primary",
      "subject-head-middle",
      "subject-head-upper",
      "subject-head-advanced-level",
    ],
  },
  { id: "grade-heads", title: "Grade Heads", match: (position) => position.section === "Grade Heads" },
  { id: "stream-heads", title: "A/L Stream Heads", match: (position) => position.section === "Stream Heads" },
  {
    id: "subject-coordinators-primary",
    title: "Subject Co-ordinators - Primary School",
    match: (position) => position.main_category === "Subject Coordinators" && position.section === "Primary School",
  },
  {
    id: "subject-coordinators-middle",
    title: "Subject Co-ordinators - Middle School",
    match: (position) => position.main_category === "Subject Coordinators" && position.section === "Middle School",
  },
  {
    id: "subject-coordinators-upper",
    title: "Subject Co-ordinators - Upper School",
    match: (position) => position.main_category === "Subject Coordinators" && position.section === "Upper School",
  },
  {
    id: "subject-coordinators-aesthetic",
    title: "Aesthetic Subject Co-ordinators - Grade 6 to 11",
    match: (position) => position.main_category === "Subject Coordinators" && position.section === "Aesthetic Subject Coordinators",
  },
  {
    id: "subject-coordinators-al",
    title: "Subject Co-ordinators - Advanced Level",
    match: (position) => position.main_category === "Subject Coordinators" && position.section === "Advanced Level",
  },
  {
    id: "english-medium-coordinators",
    title: "English Medium Co-ordinators",
    match: (position) => position.section === "English Medium Coordinators",
  },
  { id: "class-teachers-primary", title: "Class Teachers - Primary School", match: classTeacherRange(1, 5) },
  { id: "class-teachers-middle", title: "Class Teachers - Middle School", match: classTeacherRange(6, 8) },
  { id: "class-teachers-upper", title: "Class Teachers - Upper School", match: classTeacherRange(9, 11) },
  {
    id: "class-teachers-al",
    title: "Class Teachers - Advanced Level Section",
    match: (position) => position.main_category === "Class Teachers" && position.section === "Advanced Level",
  },
  {
    id: "subject-teachers-primary",
    title: "Subject Teachers - Primary School",
    match: (position) =>
      position.main_category === "Subject Teachers" && position.section === "Primary School",
  },
  {
    id: "subject-teachers-middle",
    title: "Subject Teachers - Middle School",
    match: (position) =>
      position.main_category === "Subject Teachers" && position.section === "Middle School",
  },
  {
    id: "subject-teachers-upper",
    title: "Subject Teachers - Upper School",
    match: (position) =>
      position.main_category === "Subject Teachers" && position.section === "Upper School",
  },
  {
    id: "subject-teachers-al",
    title: "Subject Teachers - Advanced Level",
    match: (position) =>
      position.main_category === "Subject Teachers" && position.section === "Advanced Level",
  },
  {
    id: "special-needs",
    title: "Special Need Resource Unit",
    codes: ["special-need-resource-unit"],
  },
  {
    id: "visiting-teachers",
    title: "Visiting Teachers",
    codes: ["visiting-teacher"],
  },
  {
    id: "counselling-members",
    title: "Counselling Members",
    codes: ["counsellor"],
  },
  {
    id: "subject-teachers-other",
    title: "Other Subject Teachers",
    match: (position) => position.main_category === "Subject Teachers",
  },
  {
    id: "non-academic-administrative",
    title: "Administrative Department",
    match: (position) =>
      position.main_category === "Non-Academic Staff" &&
      position.section === "Administrative Department",
  },
  {
    id: "non-academic-academic-office",
    title: "Academic Office",
    match: (position) =>
      position.main_category === "Non-Academic Staff" && position.section === "Academic Office",
  },
  {
    id: "non-academic-financial",
    title: "Financial Department",
    match: (position) =>
      position.main_category === "Non-Academic Staff" &&
      position.section === "Financial Department",
  },
  {
    id: "non-academic-it",
    title: "IT Department",
    match: (position) =>
      position.main_category === "Non-Academic Staff" && position.section === "IT Department",
  },
  {
    id: "non-academic-front-office",
    title: "Front Office",
    match: (position) =>
      position.main_category === "Non-Academic Staff" && position.section === "Front Office",
  },
  {
    id: "non-academic-bookstore",
    title: "Bookstore",
    match: (position) =>
      position.main_category === "Non-Academic Staff" && position.section === "Bookstore",
  },
  {
    id: "non-academic-office-support",
    title: "Office Support",
    match: (position) =>
      position.main_category === "Non-Academic Staff" && position.section === "Office Support",
  },
  {
    id: "non-academic-maintenance",
    title: "Maintenance Department",
    match: (position) =>
      position.main_category === "Non-Academic Staff" &&
      position.section === "Maintenance Department",
  },
  {
    id: "non-academic-health",
    title: "Health Services",
    match: (position) =>
      position.main_category === "Non-Academic Staff" && position.section === "Health Services",
  },
  {
    id: "non-academic-library",
    title: "Library",
    match: (position) =>
      position.main_category === "Non-Academic Staff" && position.section === "Library",
  },
  {
    id: "non-academic-other",
    title: "Other Non-Academic Staff",
    match: (position) => position.main_category === "Non-Academic Staff",
  },
  {
    id: "supportive",
    title: "Supportive Staff",
    match: (position) => position.main_category === "Supportive Staff",
  },
  {
    id: "academic-council",
    title: "General Academic Council",
    match: (position) => position.main_category === "General Academic Council",
  },
  {
    id: "uncategorized",
    title: "Uncategorized Staff",
    match: (position) => position.main_category === "Uncategorized Staff" || !position.is_known,
  },
];

const GROUP_BY_CODE = new Map<string, StaffDisplayGroup>();
STAFF_DISPLAY_GROUPS.forEach((group) => group.codes?.forEach((code) => GROUP_BY_CODE.set(code, group)));

export function staffPositionCodeOrder(code: string) {
  const normalized = normalizePositionCode(code);
  const index = FIXED_POSITION_CODE_ORDER.indexOf(normalized);
  return index === -1 ? 999999 : (index + 1) * 1000;
}

export function staffDisplayGroupFor(position: ParsedPositionCode) {
  const byCode = GROUP_BY_CODE.get(position.position_code);
  if (byCode) return byCode;
  return STAFF_DISPLAY_GROUPS.find((group) => group.match?.(position)) || STAFF_DISPLAY_GROUPS[STAFF_DISPLAY_GROUPS.length - 1];
}

export function parseStaffPosition(
  input: Partial<ParsedPositionCode> & {
    positionCode?: string;
    position_code?: string;
    displayTitle?: string;
    mainCategory?: string;
    classOrStream?: string;
    isKnown?: boolean;
    sortOrder?: number;
  },
) {
  const code = normalizePositionCode(input.position_code || input.positionCode || "");
  const parsed = code ? parsePositionCode(code) : parsePositionCode(input.display_title || input.displayTitle || "");
  const inputMainCategory = input.main_category || input.mainCategory || "";
  const inputSection = input.section || "";
  const inputSubsection = input.subsection || "";
  const inputClassOrStream = input.class_or_stream || input.classOrStream || "";
  const inputIsKnown = input.is_known ?? input.isKnown;
  const inputTitle = input.display_title || input.displayTitle || "";
  const inputTitleLooksLikeCode =
    Boolean(inputTitle) && normalizePositionCode(inputTitle) === (code || parsed.position_code);
  const displayTitle =
    parsed.is_known || !inputTitle || inputTitleLooksLikeCode ? parsed.display_title : inputTitle;
  const shouldTrustParsed =
    parsed.is_known &&
    (!inputMainCategory ||
      inputMainCategory === "Uncategorized Staff" ||
      (inputMainCategory === "Academic Staff" && parsed.main_category !== "Academic Staff"));
  return {
    ...parsed,
    ...input,
    position_code: code || parsed.position_code,
    main_category: shouldTrustParsed ? parsed.main_category : inputMainCategory || parsed.main_category,
    section: shouldTrustParsed || !inputSection || inputSection === "Uncategorized Staff" ? parsed.section : inputSection,
    subsection: shouldTrustParsed || !inputSubsection ? parsed.subsection : inputSubsection,
    grade: input.grade ?? parsed.grade,
    stream: input.stream || parsed.stream,
    medium: input.medium || parsed.medium,
    class_or_stream: shouldTrustParsed || !inputClassOrStream ? parsed.class_or_stream : inputClassOrStream,
    is_known: shouldTrustParsed ? parsed.is_known : inputIsKnown ?? parsed.is_known,
    display_title: displayTitle,
    sort_order: Number(input.sort_order || input.sortOrder || parsed.sort_order || staffPositionCodeOrder(code)),
  } as ParsedPositionCode;
}
