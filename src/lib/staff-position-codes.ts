export type ParsedPositionCode = {
  position_code: string;
  main_category: string;
  section: string;
  subsection: string;
  grade: number | null;
  stream: string;
  medium: string;
  class_or_stream: string;
  display_title: string;
  sort_order: number;
  is_known: boolean;
};

export const MAIN_CATEGORY_ORDER = [
  "Academic Staff",
  "Subject Coordinators",
  "Class Teachers",
  "Subject Teachers",
  "Non-Academic Staff",
  "Supportive Staff",
  "General Academic Council",
  "Uncategorized Staff",
];

const STREAM_LABELS: Record<string, string> = {
  maths: "Maths",
  bio: "Bio",
  commerce: "Commerce",
  arts: "Arts",
  technology: "Technology",
};

const MEDIUM_LABELS: Record<string, string> = {
  sin: "Sinhala Medium",
  eng: "English Medium",
};
export const STREAM_ORDER = ["maths", "bio", "commerce", "arts", "technology"];
export const MEDIUM_ORDER = ["sin", "eng"];
export const CLASS_ORDER = ["a", "b", "c", "d", "e", "f", "g", "h"];

export const FIXED_POSITION_CODE_ORDER = [
  "rector-principal",
  "vice-rector",
  "principal-primary",
  "principal-middle-upper",
  "priest-in-charge-middle-upper",
  "priest-in-charge-advanced-level",
  "sectional-head-upper",
  "deputy-principal",
  "vice-principal-primary",
  "vice-principal-middle",
  "vice-principal-upper",
  "vice-principal-advanced-level",
  "vice-principal-advanced-level-section",
  "academic-coordinator-primary",
  "academic-coordinator-middle",
  "academic-coordinator-upper",
  "academic-coordinator-al-arts-commerce",
  "academic-coordinator-al-maths-bio",
  "academic-coordinator-al-technology",
  "assistant-sectional-head-primary",
  "assistant-sectional-head-middle",
  "assistant-sectional-head-upper",
  "assistant-sectional-head-advanced-level",
  "subject-head-primary",
  "subject-head-middle",
  "subject-head-upper",
  "subject-head-advanced-level",
  ...Array.from({ length: 13 }, (_, index) => `grade-head-${index + 1}`),
  "stream-head-science-maths",
  "stream-head-maths",
  "stream-head-bio",
  "stream-head-commerce",
  "stream-head-arts",
  "stream-head-technology",
  "subject-coordinator-primary-sinhala",
  "subject-coordinator-primary-mathematics",
  "subject-coordinator-primary-environmental-studies",
  "subject-coordinator-primary-english",
  "subject-coordinator-primary-roman-catholicism",
  "subject-coordinator-middle-sinhala",
  "subject-coordinator-middle-mathematics",
  "subject-coordinator-middle-science",
  "subject-coordinator-middle-english",
  "subject-coordinator-middle-history-geography-civics",
  "subject-coordinator-middle-buddhism",
  "subject-coordinator-middle-ict",
  "subject-coordinator-middle-roman-catholicism",
  "subject-coordinator-middle-health-science-physical-education",
  "subject-coordinator-middle-practical-technical-skills",
  "subject-coordinator-upper-sinhala",
  "subject-coordinator-upper-mathematics",
  "subject-coordinator-upper-science",
  "subject-coordinator-upper-english",
  "subject-coordinator-upper-history-geography-civics",
  "subject-coordinator-upper-buddhism",
  "subject-coordinator-upper-buddhism-commerce",
  "subject-coordinator-upper-ict",
  "subject-coordinator-upper-roman-catholicism",
  "subject-coordinator-upper-health-science-physical-education",
  "subject-coordinator-upper-practical-technical-skills",
  "subject-coordinator-aesthetic-art",
  "subject-coordinator-aesthetic-arts",
  "subject-coordinator-aesthetic-dancing",
  "subject-coordinator-aesthetic-eastern-music",
  "subject-coordinator-aesthetic-western-music",
  "subject-coordinator-advanced-level-science-maths",
  "subject-coordinator-advanced-level-commerce",
  "subject-coordinator-advanced-level-arts",
  "subject-coordinator-advanced-level-technology",
  "english-medium-coordinator-primary",
  "english-medium-coordinator-middle",
  "english-medium-coordinator-upper",
  "english-medium-coordinator-advanced-level",
  ...Array.from({ length: 5 }, (_, gradeIndex) =>
    CLASS_ORDER.map((letter) => `class-teacher-${gradeIndex + 1}-${letter}`),
  ).flat(),
  ...Array.from({ length: 3 }, (_, gradeIndex) =>
    CLASS_ORDER.map((letter) => `class-teacher-${gradeIndex + 6}-${letter}`),
  ).flat(),
  ...Array.from({ length: 3 }, (_, gradeIndex) =>
    CLASS_ORDER.map((letter) => `class-teacher-${gradeIndex + 9}-${letter}`),
  ).flat(),
  ...[12, 13].flatMap((grade) =>
    STREAM_ORDER.flatMap((stream) =>
      MEDIUM_ORDER.flatMap((medium) =>
        ["a", "b", "c", "d"].map(
          (letter) => `class-teacher-${grade}-${stream}-${medium}-${letter}`,
        ),
      ),
    ),
  ),
  "subject-teacher-primary",
  "subject-teacher-middle",
  "subject-teacher-upper",
  "subject-teacher-advanced-level",
  "special-need-resource-unit",
  "visiting-teacher",
  "counsellor",
  "administrative-secretary",
  "secretary",
  "head-academic-office",
  "academic-officer-head",
  "academic-officer",
  "accountant",
  "accounts-assistant",
  "assistant-accountant",
  "assistant-account-clerk",
  "manager-it",
  "it-manager",
  "assistant-it",
  "it-assistant",
  "receptionist",
  "bookstore-clerk",
  "shop-keeper",
  "bookstore-assistant",
  "office-assistant",
  "maintenance-supervisor",
  "maintenance-manager",
  "nursing-officer",
  "librarian",
  "primary-secretary",
  "assistant-primary-secretary",
  "cambridge-office",
  "supportive-staff",
  "council-al-president",
  "council-al-vice-president",
  "council-al-secretary",
  "council-al-member",
  "council-upper-member",
  "council-middle-member",
  "council-primary-member",
];
const POSITION_CODE_ORDER = new Map(
  FIXED_POSITION_CODE_ORDER.map((code, index) => [code, (index + 1) * 1000]),
);

const SECTION_ORDER: Record<string, string[]> = {
  "Academic Staff": [
    "College Administration",
    "Academic Coordinators",
    "Assistant Sectional Heads",
    "Subject Heads",
    "Grade Heads",
    "Stream Heads",
  ],
  "Subject Coordinators": [
    "Primary School",
    "Middle School",
    "Upper School",
    "Aesthetic Subject Coordinators",
    "Advanced Level",
    "English Medium Coordinators",
  ],
  "Class Teachers": [
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7",
    "Grade 8",
    "Grade 9",
    "Grade 10",
    "Grade 11",
    "Advanced Level",
  ],
  "Subject Teachers": [
    "Primary School",
    "Middle School",
    "Upper School",
    "Advanced Level",
    "Special Need Resource Unit",
    "Visiting Teachers",
    "Counsellor",
  ],
  "Non-Academic Staff": [
    "Administrative Department",
    "Academic Office",
    "Financial Department",
    "IT Department",
    "Front Office",
    "Bookstore",
    "Office Support",
    "Primary Office",
    "Cambridge Office",
    "Maintenance Department",
    "Health Services",
    "Library",
    "Other Non-Academic Staff",
  ],
  "Supportive Staff": ["Supportive Staff"],
  "General Academic Council": [
    "Advanced Level Section",
    "Upper School",
    "Middle School",
    "Primary School",
  ],
  "Uncategorized Staff": ["Uncategorized Staff"],
};

function titleCaseCode(value: string) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

export function normalizePositionCode(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizePositionCodes(input: unknown) {
  const rawItems = Array.isArray(input)
    ? input.flatMap((item) => String(item || "").split(/[,;\n]/))
    : String(input || "").split(/[,;\n]/);
  const seen = new Set<string>();
  const codes: string[] = [];
  rawItems.forEach((item) => {
    const code = normalizePositionCode(item);
    if (!code || seen.has(code)) return;
    seen.add(code);
    codes.push(code);
  });
  return codes;
}

function orderOf(list: string[], value: string, fallback = 99) {
  const index = list.indexOf(value);
  return index === -1 ? fallback : index + 1;
}

function sortOrderFor(parsed: Omit<ParsedPositionCode, "sort_order">, localOrder = 0) {
  const codeRank = POSITION_CODE_ORDER.get(parsed.position_code);
  if (codeRank) return codeRank;
  const mainRank = orderOf(MAIN_CATEGORY_ORDER, parsed.main_category, 99);
  const sectionRank = orderOf(SECTION_ORDER[parsed.main_category] || [], parsed.section, 99);
  const gradeRank = parsed.grade ? Number(parsed.grade) : 99;
  const streamRank = parsed.stream
    ? orderOf(["Maths", "Bio", "Commerce", "Arts", "Technology", "Science / Maths"], parsed.stream)
    : 99;
  const mediumRank = parsed.medium ? orderOf(["Sinhala Medium", "English Medium"], parsed.medium) : 99;
  const classRank = parsed.class_or_stream
    ? Math.max(1, String(parsed.class_or_stream).slice(-1).toUpperCase().charCodeAt(0) - 64)
    : 99;
  return (
    mainRank * 100000 +
    sectionRank * 10000 +
    gradeRank * 100 +
    streamRank * 10 +
    mediumRank +
    classRank / 100 +
    localOrder / 1000
  );
}

function known(
  code: string,
  data: Partial<ParsedPositionCode> & { local_order?: number },
): ParsedPositionCode {
  const parsed = {
    position_code: code,
    main_category: data.main_category || "Academic Staff",
    section: data.section || "",
    subsection: data.subsection || "",
    grade: data.grade || null,
    stream: data.stream || "",
    medium: data.medium || "",
    class_or_stream: data.class_or_stream || "",
    display_title: data.display_title || titleCaseCode(code),
    is_known: true,
  };
  return { ...parsed, sort_order: sortOrderFor(parsed, data.local_order || 0) };
}

function unknown(code: string): ParsedPositionCode {
  const normalized = normalizePositionCode(code);
  const parsed = {
    position_code: normalized,
    main_category: "Uncategorized Staff",
    section: "Uncategorized Staff",
    subsection: "",
    grade: null,
    stream: "",
    medium: "",
    class_or_stream: "",
    display_title: titleCaseCode(normalized) || "Uncategorized Staff",
    is_known: false,
  };
  return { ...parsed, sort_order: sortOrderFor(parsed) };
}

const STATIC_CODES = new Map<string, Partial<ParsedPositionCode> & { local_order?: number }>();
const add = (code: string, data: Partial<ParsedPositionCode> & { local_order?: number }) =>
  STATIC_CODES.set(code, data);

const POSITION_CODE_ALIASES = new Map<string, string>([
  ["principal-of-primary-school", "principal-primary"],
  ["principal-primary-school", "principal-primary"],
  ["principal-of-middle-school-upper-school", "principal-middle-upper"],
  ["principal-of-middle-and-upper-school", "principal-middle-upper"],
  ["principal-of-middle-upper-school", "principal-middle-upper"],
  ["principal-middle-and-upper-school", "principal-middle-upper"],
  ["principal-middle-upper-school", "principal-middle-upper"],
]);

[
  ["rector-principal", "Rector / Principal"],
  ["vice-rector", "Vice Rector"],
  ["principal-primary", "Principal of Primary School"],
  ["principal-middle-upper", "Principal of Middle School & Upper School"],
  ["priest-in-charge-middle-upper", "Priest in Charge of Middle School & Upper School"],
  ["priest-in-charge-advanced-level", "Priest in Charge of Advanced Level Section"],
  ["sectional-head-upper", "Sectional Head of Upper School"],
  ["deputy-principal", "Deputy Principal"],
  ["vice-principal-primary", "Vice Principal - Primary Section"],
  ["vice-principal-middle", "Vice Principal - Middle School"],
  ["vice-principal-upper", "Vice Principal - Upper School"],
  ["vice-principal-advanced-level", "Vice Principal - Advanced Level Section"],
  ["vice-principal-advanced-level-section", "Vice Principal - Advanced Level Section"],
].forEach(([code, title], index) =>
  add(code, {
    main_category: "Academic Staff",
    section: "College Administration",
    display_title: title,
    local_order: index + 1,
  }),
);

[
  ["academic-coordinator-primary", "Primary Section", "Academic Coordinator - Primary Section"],
  ["academic-coordinator-middle", "Middle School", "Academic Coordinator - Middle School"],
  ["academic-coordinator-upper", "Upper School", "Academic Coordinator - Upper School"],
  [
    "academic-coordinator-al-arts-commerce",
    "Advanced Level",
    "Academic Coordinator - Arts & Commerce",
    "Arts & Commerce",
  ],
  [
    "academic-coordinator-al-maths-bio",
    "Advanced Level",
    "Academic Coordinator - Maths & Bio",
    "Maths & Bio",
  ],
  [
    "academic-coordinator-al-technology",
    "Advanced Level",
    "Academic Coordinator - Technology",
    "Technology",
  ],
].forEach(([code, subsection, title, classOrStream], index) =>
  add(code, {
    main_category: "Academic Staff",
    section: "Academic Coordinators",
    subsection,
    class_or_stream: classOrStream || subsection,
    display_title: title,
    local_order: index + 1,
  }),
);

[
  ["assistant-sectional-head-primary", "Primary Section"],
  ["assistant-sectional-head-middle", "Middle School"],
  ["assistant-sectional-head-upper", "Upper School"],
  ["assistant-sectional-head-advanced-level", "Advanced Level Section"],
].forEach(([code, subsection], index) =>
  add(code, {
    main_category: "Academic Staff",
    section: "Assistant Sectional Heads",
    subsection,
    display_title: `Assistant Sectional Head - ${subsection}`,
    local_order: index + 1,
  }),
);

[
  ["subject-head-primary", "Primary Section"],
  ["subject-head-middle", "Middle School"],
  ["subject-head-upper", "Upper School"],
  ["subject-head-advanced-level", "Advanced Level Section"],
].forEach(([code, subsection], index) =>
  add(code, {
    main_category: "Academic Staff",
    section: "Subject Heads",
    subsection,
    display_title: `Subject Head - ${subsection}`,
    local_order: index + 1,
  }),
);

[
  ["stream-head-maths", "Maths"],
  ["stream-head-bio", "Bio"],
  ["stream-head-commerce", "Commerce"],
  ["stream-head-arts", "Arts"],
  ["stream-head-technology", "Technology"],
  ["stream-head-science-maths", "Science / Maths"],
].forEach(([code, stream], index) =>
  add(code, {
    main_category: "Academic Staff",
    section: "Stream Heads",
    subsection: stream,
    stream,
    display_title: `${stream} Stream Head`,
    local_order: index + 1,
  }),
);

const SUBJECT_COORDINATORS: Record<string, { section: string; subjects: string[] }> = {
  primary: {
    section: "Primary School",
    subjects: ["sinhala", "mathematics", "environmental-studies", "english", "roman-catholicism"],
  },
  middle: {
    section: "Middle School",
    subjects: [
      "sinhala",
      "mathematics",
      "science",
      "english",
      "history-geography-civics",
      "buddhism",
      "ict",
      "roman-catholicism",
      "health-science-physical-education",
      "practical-technical-skills",
    ],
  },
  upper: {
    section: "Upper School",
    subjects: [
      "sinhala",
      "mathematics",
      "science",
      "english",
      "history-geography-civics",
      "buddhism",
      "buddhism-commerce",
      "ict",
      "roman-catholicism",
      "health-science-physical-education",
      "practical-technical-skills",
    ],
  },
  aesthetic: {
    section: "Aesthetic Subject Coordinators",
    subjects: ["art", "arts", "dancing", "eastern-music", "western-music"],
  },
  "advanced-level": {
    section: "Advanced Level",
    subjects: ["science-maths", "commerce", "arts", "technology"],
  },
};

const SUBJECT_COORDINATOR_LABELS: Record<string, string> = {
  "history-geography-civics": "History / Geography / Civics",
  "health-science-physical-education": "Health Science & Physical Education",
  "practical-technical-skills": "Practical & Technical Skills",
  "science-maths": "Science / Maths",
  "buddhism-commerce": "Buddhism / Commerce",
  ict: "ICT",
};

Object.entries(SUBJECT_COORDINATORS).forEach(([level, config]) => {
  config.subjects.forEach((subject, index) => {
    const code = `subject-coordinator-${level}-${subject}`;
    const subjectLabel = SUBJECT_COORDINATOR_LABELS[subject] || titleCaseCode(subject);
    add(code, {
      main_category: "Subject Coordinators",
      section: config.section,
      subsection: subjectLabel,
      display_title: `${subjectLabel} Subject Coordinator`,
      local_order: index + 1,
    });
  });
});

[
  ["english-medium-coordinator-primary", "Primary School"],
  ["english-medium-coordinator-middle", "Middle School"],
  ["english-medium-coordinator-upper", "Upper School"],
  ["english-medium-coordinator-advanced-level", "Advanced Level"],
].forEach(([code, subsection], index) =>
  add(code, {
    main_category: "Subject Coordinators",
    section: "English Medium Coordinators",
    subsection,
    display_title: `English Medium Coordinator - ${subsection}`,
    local_order: index + 1,
  }),
);

[
  ["subject-teacher-primary", "Primary School"],
  ["subject-teacher-middle", "Middle School"],
  ["subject-teacher-upper", "Upper School"],
  ["subject-teacher-advanced-level", "Advanced Level"],
].forEach(([code, section], index) =>
  add(code, {
    main_category: "Subject Teachers",
    section,
    display_title: `Subject Teacher - ${section}`,
    local_order: index + 1,
  }),
);

[
  ["special-need-resource-unit", "Special Need Resource Unit", "Special Need Resource Unit"],
  ["visiting-teacher", "Visiting Teachers", "Visiting Teacher"],
  ["counsellor", "Counsellor", "Counsellor"],
].forEach(([code, section, title], index) =>
  add(code, {
    main_category: "Subject Teachers",
    section,
    display_title: title,
    local_order: index + 1,
  }),
);

[
  ["administrative-secretary", "Administrative Department", "Administrative Secretary"],
  ["secretary", "Administrative Department", "Secretary"],
  ["head-academic-office", "Academic Office", "Head – Academic Office"],
  ["academic-officer-head", "Academic Office", "Academic Officer - Head"],
  ["academic-officer", "Academic Office", "Academic Officer"],
  ["accountant", "Financial Department", "Accountant"],
  ["accounts-assistant", "Financial Department", "Accounts Assistant"],
  ["assistant-accountant", "Financial Department", "Assistant Accountant"],
  ["assistant-account-clerk", "Financial Department", "Assistant Account Clerk"],
  ["manager-it", "IT Department", "Manager – IT"],
  ["it-manager", "IT Department", "IT Manager"],
  ["assistant-it", "IT Department", "Assistant IT"],
  ["it-assistant", "IT Department", "IT Assistant"],
  ["receptionist", "Front Office", "Receptionist"],
  ["bookstore-clerk", "Bookstore", "Bookstore Clerk"],
  ["shop-keeper", "Bookstore", "Shop Keeper"],
  ["bookstore-assistant", "Bookstore", "Bookstore Assistant"],
  ["office-assistant", "Office Support", "Office Assistant"],
  ["maintenance-supervisor", "Maintenance Department", "Maintenance Supervisor"],
  ["maintenance-manager", "Maintenance Department", "Maintenance Manager"],
  ["nursing-officer", "Health Services", "Nursing Officer"],
  ["librarian", "Library", "Librarian"],
  ["primary-secretary", "Primary Office", "Primary Secretary"],
  ["assistant-primary-secretary", "Primary Office", "Assistant Primary Secretary"],
  ["cambridge-office", "Cambridge Office", "Cambridge Office"],
].forEach(([code, section, title], index) =>
  add(code, {
    main_category: "Non-Academic Staff",
    section,
    display_title: title,
    local_order: index + 1,
  }),
);

add("supportive-staff", {
  main_category: "Supportive Staff",
  section: "Supportive Staff",
  display_title: "Supportive Staff",
  local_order: 1,
});

[
  ["council-al-president", "Advanced Level Section", "President"],
  ["council-al-vice-president", "Advanced Level Section", "Vice President"],
  ["council-al-secretary", "Advanced Level Section", "Secretary"],
  ["council-al-member", "Advanced Level Section", "Council Member"],
  ["council-upper-member", "Upper School", "Council Member"],
  ["council-middle-member", "Middle School", "Council Member"],
  ["council-primary-member", "Primary School", "Council Member"],
].forEach(([code, section, title], index) =>
  add(code, {
    main_category: "General Academic Council",
    section,
    display_title: title,
    local_order: index + 1,
  }),
);

function parseClassTeacher(code: string) {
  const parts = code.split("-");
  const grade = Number(parts[2]);
  if (!Number.isInteger(grade)) return null;

  if (grade >= 1 && grade <= 11 && parts.length === 4) {
    const classLetter = parts[3];
    if (!/^[a-h]$/.test(classLetter)) return null;
    const classLabel = `${grade}-${classLetter.toUpperCase()}`;
    return known(code, {
      main_category: "Class Teachers",
      section: `Grade ${grade}`,
      subsection: `Grade ${grade}`,
      grade,
      class_or_stream: classLabel,
      display_title: `Grade ${classLabel}`,
    });
  }

  if ((grade === 12 || grade === 13) && parts.length === 6) {
    const streamCode = parts[3];
    const mediumCode = parts[4];
    const classLetter = parts[5];
    if (!STREAM_LABELS[streamCode] || !MEDIUM_LABELS[mediumCode] || !/^[a-d]$/.test(classLetter)) {
      return null;
    }
    const stream = STREAM_LABELS[streamCode];
    const medium = MEDIUM_LABELS[mediumCode];
    const classLabel = `${grade} ${stream} ${medium} ${classLetter.toUpperCase()}`;
    return known(code, {
      main_category: "Class Teachers",
      section: "Advanced Level",
      subsection: `Grade ${grade}`,
      grade,
      stream,
      medium,
      class_or_stream: classLabel,
      display_title: classLabel,
    });
  }

  return null;
}

function parseLegacyClassTeacher(code: string) {
  const advancedLevelMatch = /^(12|13)-(maths|bio|commerce|arts|technology)-(sin|sinhala|eng|english)(?:-medium)?-([a-d])$/.exec(code);
  if (!advancedLevelMatch) return null;

  const [, grade, stream, medium, letter] = advancedLevelMatch;
  const mediumCode = medium === "english" ? "eng" : medium === "sinhala" ? "sin" : medium;
  return parseClassTeacher(`class-teacher-${grade}-${stream}-${mediumCode}-${letter}`);
}

export function parsePositionCode(input: unknown): ParsedPositionCode {
  const code = normalizePositionCode(input);
  if (!code) return unknown("");

  if (code.startsWith("class-teacher-")) {
    return parseClassTeacher(code) || unknown(code);
  }

  const legacyClassTeacher = parseLegacyClassTeacher(code);
  if (legacyClassTeacher) return legacyClassTeacher;

  const aliasedCode = POSITION_CODE_ALIASES.get(code);
  if (aliasedCode && aliasedCode !== code) return parsePositionCode(aliasedCode);

  const gradeHead = /^grade-head-(\d{1,2})$/.exec(code);
  if (gradeHead) {
    const grade = Number(gradeHead[1]);
    if (grade >= 1 && grade <= 13) {
      return known(code, {
        main_category: "Academic Staff",
        section: "Grade Heads",
        subsection: `Grade ${grade}`,
        grade,
        display_title: `Grade ${grade} Head`,
      });
    }
    return unknown(code);
  }

  const staticMatch = STATIC_CODES.get(code);
  if (staticMatch) return known(code, staticMatch);

  return unknown(code);
}

export function parsePositionCodes(input: unknown) {
  return normalizePositionCodes(input).map(parsePositionCode);
}
