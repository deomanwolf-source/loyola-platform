"use strict";

const MAIN_CATEGORY_ORDER = [
  "Academic Staff",
  "Subject Coordinators",
  "Class Teachers",
  "Subject Teachers",
  "Non-Academic Staff",
  "Supportive Staff",
  "General Academic Council",
  "Uncategorized Staff",
];

const STREAM_LABELS = {
  maths: "Maths",
  bio: "Bio",
  commerce: "Commerce",
  arts: "Arts",
  technology: "Technology",
};

const MEDIUM_LABELS = {
  sin: "Sinhala Medium",
  eng: "English Medium",
};

const STREAM_ORDER = ["maths", "bio", "commerce", "arts", "technology"];
const MEDIUM_ORDER = ["sin", "eng"];
const CLASS_ORDER = ["a", "b", "c", "d", "e", "f", "g", "h"];

const FIXED_POSITION_CODE_ORDER = [
  "rector-principal",
  "vice-rector",
  "principal-primary",
  "priest-in-charge-middle-upper",
  "priest-in-charge-advanced-level",
  "sectional-head-upper",
  "deputy-principal",
  "vice-principal-advanced-level",
  "vice-principal-primary",
  "vice-principal-middle",
  "vice-principal-upper",
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
        ["a", "b", "c", "d"].map((letter) => `class-teacher-${grade}-${stream}-${medium}-${letter}`),
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
  "academic-officer",
  "accountant",
  "accounts-assistant",
  "manager-it",
  "assistant-it",
  "receptionist",
  "bookstore-clerk",
  "bookstore-assistant",
  "office-assistant",
  "maintenance-supervisor",
  "nursing-officer",
  "librarian",
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

function titleCaseCode(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

function normalizePositionCode(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePositionCodes(input) {
  const rawItems = Array.isArray(input)
    ? input.flatMap((item) => String(item || "").split(/[,;\n]/))
    : String(input || "").split(/[,;\n]/);
  const seen = new Set();
  const codes = [];
  rawItems.forEach((item) => {
    const code = normalizePositionCode(item);
    if (!code || seen.has(code)) return;
    seen.add(code);
    codes.push(code);
  });
  return codes;
}

function orderOf(list, value, fallback = 99) {
  const index = list.indexOf(value);
  return index === -1 ? fallback : index + 1;
}

const SECTION_ORDER = {
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

function sortOrderFor(parsed, localOrder = 0) {
  const codeRank = POSITION_CODE_ORDER.get(parsed.position_code);
  if (codeRank) return codeRank;
  const mainRank = orderOf(MAIN_CATEGORY_ORDER, parsed.main_category, 99);
  const sectionRank = orderOf(SECTION_ORDER[parsed.main_category] || [], parsed.section, 99);
  const gradeRank = parsed.grade ? Number(parsed.grade) : 99;
  const streamRank = parsed.stream
    ? orderOf(
        ["Maths", "Bio", "Commerce", "Arts", "Technology", "Science / Maths"],
        parsed.stream,
        99,
      )
    : 99;
  const mediumRank = parsed.medium
    ? orderOf(["Sinhala Medium", "English Medium"], parsed.medium, 99)
    : 99;
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

function known(code, data, localOrder = 0) {
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
  parsed.sort_order = sortOrderFor(parsed, localOrder);
  return parsed;
}

function unknown(code) {
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
  parsed.sort_order = sortOrderFor(parsed);
  return parsed;
}

const STATIC_CODES = new Map();

function add(code, data) {
  STATIC_CODES.set(code, data);
}

[
  ["rector-principal", "Rector / Principal"],
  ["vice-rector", "Vice Rector"],
  ["principal-primary", "Principal of Primary School"],
  ["priest-in-charge-middle-upper", "Priest in Charge of Middle School & Upper School"],
  ["priest-in-charge-advanced-level", "Priest in Charge of Advanced Level Section"],
  ["sectional-head-upper", "Sectional Head of Upper School"],
  ["deputy-principal", "Deputy Principal"],
  ["vice-principal-primary", "Vice Principal - Primary Section"],
  ["vice-principal-middle", "Vice Principal - Middle School"],
  ["vice-principal-upper", "Vice Principal - Upper School"],
  ["vice-principal-advanced-level", "Vice Principal - Advanced Level Section"],
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

const SUBJECT_COORDINATORS = {
  primary: {
    section: "Primary School",
    subjects: [
      "sinhala",
      "mathematics",
      "environmental-studies",
      "english",
      "roman-catholicism",
    ],
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

const SUBJECT_COORDINATOR_LABELS = {
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
  ["academic-officer", "Academic Office", "Academic Officer"],
  ["accountant", "Financial Department", "Accountant"],
  ["accounts-assistant", "Financial Department", "Accounts Assistant"],
  ["manager-it", "IT Department", "Manager – IT"],
  ["assistant-it", "IT Department", "Assistant IT"],
  ["receptionist", "Front Office", "Receptionist"],
  ["bookstore-clerk", "Bookstore", "Bookstore Clerk"],
  ["bookstore-assistant", "Bookstore", "Bookstore Assistant"],
  ["office-assistant", "Office Support", "Office Assistant"],
  ["maintenance-supervisor", "Maintenance Department", "Maintenance Supervisor"],
  ["nursing-officer", "Health Services", "Nursing Officer"],
  ["librarian", "Library", "Librarian"],
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

function parseClassTeacher(code) {
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

function parsePositionCode(input) {
  const code = normalizePositionCode(input);
  if (!code) return unknown("");

  if (code.startsWith("class-teacher-")) {
    return parseClassTeacher(code) || unknown(code);
  }

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
  if (staticMatch) return known(code, staticMatch, staticMatch.local_order || 0);

  return unknown(code);
}

function parsePositionCodes(input) {
  return normalizePositionCodes(input).map(parsePositionCode);
}

function inferPositionCode(input = {}) {
  const position = normalizePositionCode(input.position || input.title || "");
  const websitePlace = normalizePositionCode(input.website_place || input.websitePlace || input.category || "");
  const department = normalizePositionCode(input.department || input.section || "");
  const classes = normalizePositionCode(input.classes || "");

  const direct = [position, websitePlace, `${position}-${department}`].find(
    (candidate) => candidate && parsePositionCode(candidate).is_known,
  );
  if (direct) return direct;

  const gradeHead = /grade-(\d{1,2})-head/.exec(position) || /grade-(\d{1,2})/.exec(classes);
  if (/grade.*head|head.*grade/.test(position) && gradeHead) return `grade-head-${gradeHead[1]}`;

  const classTeacher = /class-teacher-(\d{1,2})-([a-h])/.exec(position);
  if (classTeacher) return `class-teacher-${classTeacher[1]}-${classTeacher[2]}`;

  const aliasMap = new Map([
    ["rector-principal", "rector-principal"],
    ["vice-rector", "vice-rector"],
    ["principal-of-primary-school", "principal-primary"],
    ["principal-primary-school", "principal-primary"],
    ["deputy-principal", "deputy-principal"],
    ["vice-principal-primary-school", "vice-principal-primary"],
    ["vice-principal-primary-section", "vice-principal-primary"],
    ["vice-principal-middle-school", "vice-principal-middle"],
    ["vice-principal-upper-school", "vice-principal-upper"],
    ["vice-principal-advanced-level", "vice-principal-advanced-level"],
    ["history-geography-civics-subject-coordinator-middle-school", "subject-coordinator-middle-history-geography-civics"],
    ["history-geography-civics-coordinator-middle-school", "subject-coordinator-middle-history-geography-civics"],
    ["buddhism-subject-coordinator-middle-school", "subject-coordinator-middle-buddhism"],
    ["buddhism-coordinator-middle-school", "subject-coordinator-middle-buddhism"],
    ["ict-subject-coordinator-middle-school", "subject-coordinator-middle-ict"],
    ["ict-coordinator-middle-school", "subject-coordinator-middle-ict"],
    ["history-geography-civics-subject-coordinator-upper-school", "subject-coordinator-upper-history-geography-civics"],
    ["history-geography-civics-coordinator-upper-school", "subject-coordinator-upper-history-geography-civics"],
    ["buddhism-subject-coordinator-upper-school", "subject-coordinator-upper-buddhism"],
    ["buddhism-coordinator-upper-school", "subject-coordinator-upper-buddhism"],
    ["buddhism-commerce-subject-coordinator-upper-school", "subject-coordinator-upper-buddhism-commerce"],
    ["buddhism-commerce-coordinator-upper-school", "subject-coordinator-upper-buddhism-commerce"],
    ["ict-subject-coordinator-upper-school", "subject-coordinator-upper-ict"],
    ["ict-coordinator-upper-school", "subject-coordinator-upper-ict"],
    ["assistant-it", "assistant-it"],
    ["assistant-i-t", "assistant-it"],
    ["manager-it", "manager-it"],
    ["manager-i-t", "manager-it"],
    ["supportive-staff-member", "supportive-staff"],
  ]);

  return aliasMap.get(position) || "";
}

module.exports = {
  MAIN_CATEGORY_ORDER,
  MEDIUM_ORDER,
  STREAM_ORDER,
  CLASS_ORDER,
  FIXED_POSITION_CODE_ORDER,
  normalizePositionCode,
  normalizePositionCodes,
  parsePositionCode,
  parsePositionCodes,
  inferPositionCode,
  titleCaseCode,
};
