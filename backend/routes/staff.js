const {
  inferPositionCode,
  normalizePositionCode,
  normalizePositionCodes,
  parsePositionCode,
  parsePositionCodes,
} = require("../lib/staff-position-codes");

function registerStaffRoutes(app, context) {
  const {
    db,
    ROLES,
    authRole,
    staffAdminOnly,
    ensureContentTables,
    upsertTeacherUserAccount,
    removeTeacherFromSiteDatabaseContent,
    syncTeacherAccountToEduTrack,
    handleSingleUpload,
    uploadSizeLimit,
    unlinkQuiet,
    safePathSegment,
    mediaSourceId,
    mediaCategoryFromFolder,
    processStaffProfilePhotoUpload,
  } = context;

  const staffManagerOnly = staffAdminOnly || authRole(ROLES.master, ROLES.super, ROLES.staff);
  const attendanceManagerOnly = authRole(
    ROLES.master,
    ROLES.super,
    ROLES.staff,
    ROLES.masterEduTrack,
    ROLES.eduzync,
  );
  const staffSelfOrManager = authRole(ROLES.master, ROLES.super, ROLES.staff, ROLES.teacher);

  let staffSchemaReady = false;
  const websitePlaces = [
    "College Administration",
    "Assistant Sectional Heads",
    "Subject Heads",
    "Grade Heads",
    "Advanced Level Stream Heads",
    "Subject Coordinators - Primary School",
    "Subject Coordinators - Middle School",
    "Subject Coordinators - Upper School",
    "Aesthetic Subject Coordinators",
    "Subject Coordinators - Advanced Level",
    "English Medium Coordinators",
    "Class Teachers - Primary School",
    "Class Teachers - Middle School",
    "Class Teachers - Upper School",
    "Class Teachers - Advanced Level",
    "Subject Teachers - Primary School",
    "Subject Teachers - Middle School",
    "Subject Teachers - Upper School",
    "Subject Teachers - Advanced Level",
    "Special Need Resource Unit",
    "Visiting Teachers",
    "Counsellor",
    "Administrative Department",
    "Academic Department",
    "Financial Department",
    "IT Department",
    "Front Office / Bookstore / Office Support",
    "Maintenance Department",
    "Health & Library Services",
    "Supportive Staff",
    "General Academic Council - Advanced Level Section",
    "General Academic Council - Upper School",
    "General Academic Council - Middle School",
    "General Academic Council - Primary School",
  ];
  const positionCategories = [
    "College Administration",
    "Assistant Sectional Heads",
    "Subject Heads",
    "Grade Heads",
    "Advanced Level Stream Heads",
    "Subject Coordinators",
    "Class Teachers",
    "Subject Teachers",
    "Special Academic Positions",
    "Non-Academic Staff",
    "Supportive Staff",
    "General Academic Council",
  ];
  const positionMasterWebsitePlaces = [
    ...websitePlaces,
    "All Teachers Directory only",
    "Hidden from Website",
  ];
  const staffTypes = ["Academic Staff", "Non-Academic Staff", "Supportive Staff"];
  const defaultPositionMasterEntries = [
    [
      "Rector / Principal",
      "College Administration",
      "Administration",
      "College Administration",
      "Academic Staff",
    ],
    [
      "Vice Rector",
      "College Administration",
      "Administration",
      "College Administration",
      "Academic Staff",
    ],
    [
      "Prefect of Games",
      "College Administration",
      "Administration",
      "College Administration",
      "Academic Staff",
    ],
    [
      "Principal of Primary School",
      "College Administration",
      "Primary School",
      "College Administration",
      "Academic Staff",
    ],
    [
      "Priest in Charge",
      "College Administration",
      "Administration",
      "College Administration",
      "Academic Staff",
    ],
    [
      "Sectional Head of Upper School",
      "College Administration",
      "Upper School",
      "College Administration",
      "Academic Staff",
    ],
    [
      "Vice Principal - Advanced Level",
      "College Administration",
      "Advanced Level",
      "College Administration",
      "Academic Staff",
    ],
    [
      "Vice Principal - Primary School",
      "College Administration",
      "Primary School",
      "College Administration",
      "Academic Staff",
    ],
    [
      "Vice Principal - Middle School",
      "College Administration",
      "Middle School",
      "College Administration",
      "Academic Staff",
    ],
    [
      "Vice Principal - Upper School",
      "College Administration",
      "Upper School",
      "College Administration",
      "Academic Staff",
    ],
    [
      "Assistant Sectional Head - Primary School",
      "Assistant Sectional Heads",
      "Primary School",
      "Assistant Sectional Heads",
      "Academic Staff",
    ],
    [
      "Assistant Sectional Head - Middle School",
      "Assistant Sectional Heads",
      "Middle School",
      "Assistant Sectional Heads",
      "Academic Staff",
    ],
    [
      "Assistant Sectional Head - Advanced Level",
      "Assistant Sectional Heads",
      "Advanced Level",
      "Assistant Sectional Heads",
      "Academic Staff",
    ],
    [
      "Subject Head - Primary School",
      "Subject Heads",
      "Primary School",
      "Subject Heads",
      "Academic Staff",
    ],
    [
      "Subject Head - Middle School",
      "Subject Heads",
      "Middle School",
      "Subject Heads",
      "Academic Staff",
    ],
    [
      "Subject Head - Upper School",
      "Subject Heads",
      "Upper School",
      "Subject Heads",
      "Academic Staff",
    ],
    [
      "Subject Head - Advanced Level",
      "Subject Heads",
      "Advanced Level",
      "Subject Heads",
      "Academic Staff",
    ],
    ...Array.from({ length: 11 }, (_, index) => [
      `Grade ${index + 1} Head`,
      "Grade Heads",
      `Grade ${index + 1}`,
      "Grade Heads",
      "Academic Staff",
    ]),
    [
      "Science / Mathematics Stream Head",
      "Advanced Level Stream Heads",
      "Advanced Level",
      "Advanced Level Stream Heads",
      "Academic Staff",
    ],
    [
      "Commerce Stream Head",
      "Advanced Level Stream Heads",
      "Advanced Level",
      "Advanced Level Stream Heads",
      "Academic Staff",
    ],
    [
      "Arts Stream Head",
      "Advanced Level Stream Heads",
      "Advanced Level",
      "Advanced Level Stream Heads",
      "Academic Staff",
    ],
    [
      "Technology Stream Head",
      "Advanced Level Stream Heads",
      "Advanced Level",
      "Advanced Level Stream Heads",
      "Academic Staff",
    ],
    [
      "Sinhala Subject Coordinator",
      "Subject Coordinators",
      "Primary School",
      "Subject Coordinators - Primary School",
      "Academic Staff",
    ],
    [
      "Mathematics Subject Coordinator",
      "Subject Coordinators",
      "Primary School",
      "Subject Coordinators - Primary School",
      "Academic Staff",
    ],
    [
      "Environmental Studies Subject Coordinator",
      "Subject Coordinators",
      "Primary School",
      "Subject Coordinators - Primary School",
      "Academic Staff",
    ],
    [
      "English Subject Coordinator",
      "Subject Coordinators",
      "Primary School",
      "Subject Coordinators - Primary School",
      "Academic Staff",
    ],
    [
      "Roman Catholicism Subject Coordinator",
      "Subject Coordinators",
      "Primary School",
      "Subject Coordinators - Primary School",
      "Academic Staff",
    ],
    [
      "Sinhala Subject Coordinator",
      "Subject Coordinators",
      "Middle School",
      "Subject Coordinators - Middle School",
      "Academic Staff",
    ],
    [
      "Mathematics Subject Coordinator",
      "Subject Coordinators",
      "Middle School",
      "Subject Coordinators - Middle School",
      "Academic Staff",
    ],
    [
      "Science Subject Coordinator",
      "Subject Coordinators",
      "Middle School",
      "Subject Coordinators - Middle School",
      "Academic Staff",
    ],
    [
      "English Subject Coordinator",
      "Subject Coordinators",
      "Middle School",
      "Subject Coordinators - Middle School",
      "Academic Staff",
    ],
    [
      "History / Geography / Civics Subject Coordinator",
      "Subject Coordinators",
      "Middle School",
      "Subject Coordinators - Middle School",
      "Academic Staff",
    ],
    [
      "Health Science & Physical Education Coordinator",
      "Subject Coordinators",
      "Middle School",
      "Subject Coordinators - Middle School",
      "Academic Staff",
    ],
    [
      "Practical & Technical Skills Coordinator",
      "Subject Coordinators",
      "Middle School",
      "Subject Coordinators - Middle School",
      "Academic Staff",
    ],
    [
      "Sinhala Subject Coordinator",
      "Subject Coordinators",
      "Upper School",
      "Subject Coordinators - Upper School",
      "Academic Staff",
    ],
    [
      "Mathematics Subject Coordinator",
      "Subject Coordinators",
      "Upper School",
      "Subject Coordinators - Upper School",
      "Academic Staff",
    ],
    [
      "Science Subject Coordinator",
      "Subject Coordinators",
      "Upper School",
      "Subject Coordinators - Upper School",
      "Academic Staff",
    ],
    [
      "English Subject Coordinator",
      "Subject Coordinators",
      "Upper School",
      "Subject Coordinators - Upper School",
      "Academic Staff",
    ],
    [
      "Roman Catholicism Subject Coordinator",
      "Subject Coordinators",
      "Upper School",
      "Subject Coordinators - Upper School",
      "Academic Staff",
    ],
    [
      "Art Coordinator",
      "Subject Coordinators",
      "Aesthetic",
      "Aesthetic Subject Coordinators",
      "Academic Staff",
    ],
    [
      "Dancing Coordinator",
      "Subject Coordinators",
      "Aesthetic",
      "Aesthetic Subject Coordinators",
      "Academic Staff",
    ],
    [
      "Eastern Music Coordinator",
      "Subject Coordinators",
      "Aesthetic",
      "Aesthetic Subject Coordinators",
      "Academic Staff",
    ],
    [
      "Western Music Coordinator",
      "Subject Coordinators",
      "Aesthetic",
      "Aesthetic Subject Coordinators",
      "Academic Staff",
    ],
    [
      "Science / Mathematics Subject Coordinator",
      "Subject Coordinators",
      "Advanced Level",
      "Subject Coordinators - Advanced Level",
      "Academic Staff",
    ],
    [
      "Commerce Subject Coordinator",
      "Subject Coordinators",
      "Advanced Level",
      "Subject Coordinators - Advanced Level",
      "Academic Staff",
    ],
    [
      "Arts Subject Coordinator",
      "Subject Coordinators",
      "Advanced Level",
      "Subject Coordinators - Advanced Level",
      "Academic Staff",
    ],
    [
      "English Medium Coordinator - Primary School",
      "Subject Coordinators",
      "Primary School",
      "English Medium Coordinators",
      "Academic Staff",
    ],
    [
      "English Medium Coordinator - Middle School",
      "Subject Coordinators",
      "Middle School",
      "English Medium Coordinators",
      "Academic Staff",
    ],
    [
      "English Medium Coordinator - Upper School",
      "Subject Coordinators",
      "Upper School",
      "English Medium Coordinators",
      "Academic Staff",
    ],
    [
      "English Medium Coordinator - Advanced Level",
      "Subject Coordinators",
      "Advanced Level",
      "English Medium Coordinators",
      "Academic Staff",
    ],
    [
      "Class Teacher - Primary School",
      "Class Teachers",
      "Primary School",
      "Class Teachers - Primary School",
      "Academic Staff",
    ],
    [
      "Class Teacher - Middle School",
      "Class Teachers",
      "Middle School",
      "Class Teachers - Middle School",
      "Academic Staff",
    ],
    [
      "Class Teacher - Upper School",
      "Class Teachers",
      "Upper School",
      "Class Teachers - Upper School",
      "Academic Staff",
    ],
    [
      "Class Teacher - Advanced Level",
      "Class Teachers",
      "Advanced Level",
      "Class Teachers - Advanced Level",
      "Academic Staff",
    ],
    [
      "Subject Teacher - Primary School",
      "Subject Teachers",
      "Primary School",
      "Subject Teachers - Primary School",
      "Academic Staff",
    ],
    [
      "Subject Teacher - Middle School",
      "Subject Teachers",
      "Middle School",
      "Subject Teachers - Middle School",
      "Academic Staff",
    ],
    [
      "Subject Teacher - Upper School",
      "Subject Teachers",
      "Upper School",
      "Subject Teachers - Upper School",
      "Academic Staff",
    ],
    [
      "Subject Teacher - Advanced Level",
      "Subject Teachers",
      "Advanced Level",
      "Subject Teachers - Advanced Level",
      "Academic Staff",
    ],
    [
      "Special Need Resource Teacher",
      "Special Academic Positions",
      "Special Need Resource Unit",
      "Special Need Resource Unit",
      "Academic Staff",
    ],
    [
      "Visiting Teacher",
      "Special Academic Positions",
      "Academic Department",
      "Visiting Teachers",
      "Academic Staff",
    ],
    [
      "Counsellor",
      "Special Academic Positions",
      "Academic Department",
      "Counsellor",
      "Academic Staff",
    ],
    [
      "Administrative Secretary",
      "Non-Academic Staff",
      "Administrative Department",
      "Administrative Department",
      "Non-Academic Staff",
    ],
    [
      "Secretary",
      "Non-Academic Staff",
      "Administrative Department",
      "Administrative Department",
      "Non-Academic Staff",
    ],
    [
      "Head - Academic Office",
      "Non-Academic Staff",
      "Academic Department",
      "Academic Department",
      "Non-Academic Staff",
    ],
    [
      "Academic Officer",
      "Non-Academic Staff",
      "Academic Department",
      "Academic Department",
      "Non-Academic Staff",
    ],
    [
      "Accountant",
      "Non-Academic Staff",
      "Financial Department",
      "Financial Department",
      "Non-Academic Staff",
    ],
    [
      "Accounts Assistant",
      "Non-Academic Staff",
      "Financial Department",
      "Financial Department",
      "Non-Academic Staff",
    ],
    ["Manager - IT", "Non-Academic Staff", "IT Department", "IT Department", "Non-Academic Staff"],
    ["Assistant IT", "Non-Academic Staff", "IT Department", "IT Department", "Non-Academic Staff"],
    [
      "Receptionist",
      "Non-Academic Staff",
      "Front Office",
      "Front Office / Bookstore / Office Support",
      "Non-Academic Staff",
    ],
    [
      "Bookstore Clerk",
      "Non-Academic Staff",
      "Bookstore",
      "Front Office / Bookstore / Office Support",
      "Non-Academic Staff",
    ],
    [
      "Office Assistant",
      "Non-Academic Staff",
      "Office",
      "Front Office / Bookstore / Office Support",
      "Non-Academic Staff",
    ],
    [
      "Bookstore Assistant",
      "Non-Academic Staff",
      "Bookstore",
      "Front Office / Bookstore / Office Support",
      "Non-Academic Staff",
    ],
    [
      "Maintenance Supervisor",
      "Non-Academic Staff",
      "Maintenance Department",
      "Maintenance Department",
      "Non-Academic Staff",
    ],
    [
      "Nursing Officer",
      "Non-Academic Staff",
      "Health Services",
      "Health & Library Services",
      "Non-Academic Staff",
    ],
    [
      "Librarian",
      "Non-Academic Staff",
      "Library",
      "Health & Library Services",
      "Non-Academic Staff",
    ],
    [
      "Supportive Staff Member",
      "Supportive Staff",
      "Supportive Staff",
      "Supportive Staff",
      "Supportive Staff",
    ],
    [
      "President",
      "General Academic Council",
      "Advanced Level",
      "General Academic Council - Advanced Level Section",
      "Academic Staff",
    ],
    [
      "Vice President",
      "General Academic Council",
      "Advanced Level",
      "General Academic Council - Advanced Level Section",
      "Academic Staff",
    ],
    [
      "Secretary",
      "General Academic Council",
      "Advanced Level",
      "General Academic Council - Advanced Level Section",
      "Academic Staff",
    ],
    [
      "Council Member",
      "General Academic Council",
      "Advanced Level",
      "General Academic Council - Advanced Level Section",
      "Academic Staff",
    ],
    [
      "Council Member",
      "General Academic Council",
      "Upper School",
      "General Academic Council - Upper School",
      "Academic Staff",
    ],
    [
      "Council Member",
      "General Academic Council",
      "Middle School",
      "General Academic Council - Middle School",
      "Academic Staff",
    ],
    [
      "Council Member",
      "General Academic Council",
      "Primary School",
      "General Academic Council - Primary School",
      "Academic Staff",
    ],
    [
      "Other",
      "Special Academic Positions",
      "Academic Department",
      "All Teachers Directory only",
      "Academic Staff",
    ],
  ];
  const defaultPositionMaster = defaultPositionMasterEntries.map(
    ([positionTitle, category, department, websitePlace, defaultStaffType], index) => ({
      positionTitle,
      category,
      department,
      websitePlace,
      defaultStaffType,
      displayOrder: index + 1,
    }),
  );

  function clean(value, maxLength = 255) {
    return String(value || "")
      .trim()
      .slice(0, maxLength);
  }

  function cleanNullable(value, maxLength = 255) {
    const cleaned = clean(value, maxLength);
    return cleaned || null;
  }

  function booleanField(body, ...keys) {
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      const value = body[key];
      return value === true || value === "true" || value === "on" || value === 1 || value === "1";
    }
    return false;
  }

  function hasField(body, ...keys) {
    return keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
  }

  function normalizeStatus(value) {
    const status = clean(value || "Active", 40);
    if (["Active", "Inactive", "On Leave", "Suspended"].includes(status)) return status;
    const lower = status.toLowerCase();
    if (lower === "active") return "Active";
    if (lower === "inactive") return "Inactive";
    if (status === "Hidden") return "Inactive";
    return "Active";
  }

  function teacherStatusFromStaff(status) {
    return status === "Active" ? "Active" : "Hidden";
  }

  function normalizeDate(value) {
    const date = clean(value, 20);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  }

  function actorId(req) {
    return clean(req.user?.id || req.user?.email || "system", 50);
  }

  function staffProfilePhotoFolder() {
    return safePathSegment("staff/profiles");
  }

  function isProfilePhotoFile(file) {
    return file && ["image/jpeg", "image/png"].includes(String(file.mimetype || "").toLowerCase());
  }

  function hasManageAccess(req) {
    return [ROLES.master, ROLES.super, ROLES.staff].includes(req.user?.role);
  }

  function safeIdentifier(value) {
    return String(value || "").replace(/[^a-z0-9_]/gi, "");
  }

  async function addColumnIfMissing(table, column, definition) {
    const safeTable = safeIdentifier(table);
    const safeColumn = safeIdentifier(column);
    const [rows] = await db.query(`SHOW COLUMNS FROM ${safeTable} LIKE ?`, [safeColumn]);
    if (rows.length) return;
    await db.query(`ALTER TABLE ${safeTable} ADD COLUMN ${safeColumn} ${definition}`);
  }

  async function addIndexIfMissing(table, indexName, definition) {
    const safeTable = safeIdentifier(table);
    const safeIndex = safeIdentifier(indexName);
    const [rows] = await db.query(`SHOW INDEX FROM ${safeTable} WHERE Key_name = ?`, [safeIndex]);
    if (rows.length) return;
    await db.query(`ALTER TABLE ${safeTable} ADD INDEX ${safeIndex} ${definition}`);
  }

  function schoolSectionFromText(value) {
    const text = String(value || "").toLowerCase();
    if (/primary|grade [1-5]\b/.test(text)) return "Primary School";
    if (/middle|grade [6-8]\b/.test(text)) return "Middle School";
    if (/upper|grade (9|10|11)\b/.test(text)) return "Upper School";
    if (/advanced|advance|a\/l|grade (12|13)\b|commerce|arts|biology|technology/.test(text)) {
      return "Advanced Level";
    }
    return "";
  }

  function sectionedWebsitePlace(prefix, context) {
    return `${prefix} - ${schoolSectionFromText(context) || "Primary School"}`;
  }

  function normalizeWebsitePlace(value, position = "", staffType = "", department = "") {
    const raw = clean(value, 120);
    const special = raw.toLowerCase();
    if (special === "hidden from website" || special === "all teachers directory only") return "";
    if (websitePlaces.includes(raw)) return raw;
    const context = `${raw} ${position} ${staffType} ${department}`;
    if (special === "subject coordinators") {
      return sectionedWebsitePlace("Subject Coordinators", context);
    }
    if (special === "class teachers") {
      return sectionedWebsitePlace("Class Teachers", context);
    }
    if (special === "subject teachers") {
      return sectionedWebsitePlace("Subject Teachers", context);
    }

    const aliases = new Map([
      ["top administration", "College Administration"],
      ["vice principals", "College Administration"],
      ["administration", "College Administration"],
      ["college administration", "College Administration"],
      ["assistant sectional heads", "Assistant Sectional Heads"],
      ["subject heads", "Subject Heads"],
      ["a/l stream heads", "Advanced Level Stream Heads"],
      ["al stream heads", "Advanced Level Stream Heads"],
      ["stream heads", "Advanced Level Stream Heads"],
      ["primary school subject coordinators", "Subject Coordinators - Primary School"],
      ["middle school subject coordinators", "Subject Coordinators - Middle School"],
      ["upper school subject coordinators", "Subject Coordinators - Upper School"],
      ["aesthetic subject coordinators", "Aesthetic Subject Coordinators"],
      ["advanced level subject coordinators", "Subject Coordinators - Advanced Level"],
      ["english medium coordinators", "English Medium Coordinators"],
      ["class teachers - primary school", "Class Teachers - Primary School"],
      ["class teachers - middle school", "Class Teachers - Middle School"],
      ["class teachers - upper school", "Class Teachers - Upper School"],
      ["class teachers - advance level section", "Class Teachers - Advanced Level"],
      ["class teachers - advanced level", "Class Teachers - Advanced Level"],
      ["subject teachers - primary school", "Subject Teachers - Primary School"],
      ["subject teachers - middle school", "Subject Teachers - Middle School"],
      ["subject teachers - upper school", "Subject Teachers - Upper School"],
      ["subject teachers - advanced level", "Subject Teachers - Advanced Level"],
      ["special academic positions", "Special Need Resource Unit"],
      ["administrative department", "Administrative Department"],
      ["academic department", "Academic Department"],
      ["financial department", "Financial Department"],
      ["it department", "IT Department"],
      ["front office", "Front Office / Bookstore / Office Support"],
      ["bookstore", "Front Office / Bookstore / Office Support"],
      ["office support", "Front Office / Bookstore / Office Support"],
      ["maintenance department", "Maintenance Department"],
      ["health & library services", "Health & Library Services"],
      ["other non-academic positions", "Administrative Department"],
      ["all teachers directory", ""],
    ]);
    if (aliases.has(special)) return aliases.get(special);

    const role = `${position} ${staffType} ${department}`.toLowerCase();
    if (/assistant sectional head/.test(role)) return "Assistant Sectional Heads";
    if (
      /rector|principal|archbishop|general manager|vice principal|vice rector|prefect|priest in charge|sectional head/.test(
        role,
      )
    )
      return "College Administration";
    if (/subject head/.test(role)) return "Subject Heads";
    if (/grade head/.test(role)) return "Grade Heads";
    if (/stream head|a\/l/.test(role)) return "Advanced Level Stream Heads";
    if (/english medium/.test(role)) return "English Medium Coordinators";
    if (/coordinator/.test(role)) return sectionedWebsitePlace("Subject Coordinators", role);
    if (/class teacher/.test(role)) return sectionedWebsitePlace("Class Teachers", role);
    if (/special need|resource/.test(role)) return "Special Need Resource Unit";
    if (/visiting/.test(role)) return "Visiting Teachers";
    if (/counsellor|counselor/.test(role)) return "Counsellor";
    if (/subject teacher|teacher/.test(role))
      return sectionedWebsitePlace("Subject Teachers", role);
    if (/supportive/.test(role)) return "Supportive Staff";
    if (/account|financial/.test(role)) return "Financial Department";
    if (/\bit\b|technology/.test(role)) return "IT Department";
    if (/library|nursing|health/.test(role)) return "Health & Library Services";
    if (/maintenance/.test(role)) return "Maintenance Department";
    if (/non-academic|office|secretary|bookstore|reception/.test(role)) {
      return "Administrative Department";
    }
    return sectionedWebsitePlace("Subject Teachers", role);
  }

  function booleanLike(value, fallback = false) {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return fallback;
    if (["true", "on", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "off", "0", "no", "n"].includes(normalized)) return false;
    return fallback;
  }

  function normalizeDefaultStaffType(value, category = "") {
    const staffType = clean(value, 100);
    if (staffTypes.includes(staffType)) return staffType;
    if (category === "Non-Academic Staff") return "Non-Academic Staff";
    if (category === "Supportive Staff") return "Supportive Staff";
    return "Academic Staff";
  }

  function normalizePositionCategory(value, position = "", staffType = "") {
    const category = clean(value, 120);
    if (category) return category;
    const role = `${position} ${staffType}`.toLowerCase();
    if (/assistant sectional head/.test(role)) return "Assistant Sectional Heads";
    if (/rector|principal|vice principal|vice rector|prefect|priest|sectional head/.test(role)) {
      return "College Administration";
    }
    if (/subject head/.test(role)) return "Subject Heads";
    if (/grade head/.test(role)) return "Grade Heads";
    if (/stream head|a\/l/.test(role)) return "Advanced Level Stream Heads";
    if (/coordinator|subject head/.test(role)) return "Subject Coordinators";
    if (/class teacher/.test(role)) return "Class Teachers";
    if (/subject teacher|teacher/.test(role)) return "Subject Teachers";
    if (/supportive/.test(role)) return "Supportive Staff";
    if (/non-academic|office|secretary|account|library|maintenance|it/.test(role)) {
      return "Non-Academic Staff";
    }
    return "Special Academic Positions";
  }

  function normalizeMasterWebsitePlace(value, position = "", staffType = "", department = "") {
    const raw = clean(value, 120);
    if (positionMasterWebsitePlaces.includes(raw)) return raw;
    const normalized = normalizeWebsitePlace(raw, position, staffType, department);
    return normalized || "All Teachers Directory only";
  }

  function normalizePositionMasterStatus(value) {
    return clean(value, 40) === "Disabled" ? "Disabled" : "Active";
  }

  function positionMasterPayload(body = {}) {
    const positionTitle = clean(
      body.position_title || body.positionTitle || body.position || body.title,
      150,
    );
    const category = normalizePositionCategory(
      body.category,
      positionTitle,
      body.default_staff_type || body.defaultStaffType,
    );
    const defaultStaffType = normalizeDefaultStaffType(
      body.default_staff_type || body.defaultStaffType,
      category,
    );
    const websitePlace = normalizeMasterWebsitePlace(
      body.website_place || body.websitePlace,
      positionTitle,
      defaultStaffType,
      body.department || body.section,
    );
    const visibleDefault = websitePlace !== "Hidden from Website";

    return {
      positionTitle,
      category,
      department: clean(body.department || body.section, 120),
      websitePlace,
      description: clean(body.description, 1000),
      defaultStaffType,
      visibleOnWebsite:
        websitePlace === "Hidden from Website"
          ? false
          : booleanLike(body.visible_on_website ?? body.visibleOnWebsite, visibleDefault),
      status: normalizePositionMasterStatus(body.status),
      displayOrder: Number.isFinite(Number(body.display_order ?? body.displayOrder))
        ? Number(body.display_order ?? body.displayOrder)
        : 0,
    };
  }

  function slug(value) {
    return (
      clean(value, 80)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "position"
    );
  }

  function profileSlug(value) {
    return (
      clean(value, 150)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || ""
    );
  }

  function normalizeSortOrder(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : fallback;
  }

  function staffTypeFromMainCategory(mainCategory) {
    if (mainCategory === "Non-Academic Staff") return "Non-Academic Staff";
    if (mainCategory === "Supportive Staff") return "Supportive Staff";
    return "Academic Staff";
  }

  function positionRecordFromParsed(parsed, index = 0) {
    const title = parsed.display_title || parsed.position_code || "Staff Member";
    return {
      positionMasterId: null,
      positionCode: parsed.position_code || "",
      displayTitle: title,
      mainCategory: parsed.main_category || "Uncategorized Staff",
      section: parsed.section || "Uncategorized Staff",
      subsection: parsed.subsection || "",
      grade: parsed.grade || null,
      stream: parsed.stream || "",
      medium: parsed.medium || "",
      classOrStream: parsed.class_or_stream || "",
      department: parsed.subsection || parsed.section || parsed.main_category || "",
      position: title,
      websitePlace: parsed.section || parsed.main_category || "Uncategorized Staff",
      subject:
        parsed.main_category === "Subject Coordinators" && parsed.subsection
          ? parsed.subsection
          : "",
      classes: parsed.class_or_stream || "",
      isPrimary: index === 0,
      displayOrder: index,
      sortOrder: Math.round(Number(parsed.sort_order || 0)),
      visibleOnWebsite: true,
      isKnown: parsed.is_known !== false,
    };
  }

  function positionsFromPositionCodes(positionCodes) {
    return parsePositionCodes(positionCodes).map(positionRecordFromParsed);
  }

  function legacyPositionRecord(entry = {}, index = 0) {
    const inferred = inferPositionCode(entry);
    if (inferred) return positionRecordFromParsed(parsePositionCode(inferred), index);

    const fallbackCode = normalizePositionCode(
      entry.position || entry.title || entry.website_place || entry.websitePlace || entry.category,
    );
    const parsed = parsePositionCode(fallbackCode);
    const record = positionRecordFromParsed(parsed, index);
    const position = clean(entry.position || entry.title || record.position, 150);
    const department = clean(entry.department || entry.section || record.department, 120);
    const websitePlace = normalizeWebsitePlace(
      entry.website_place || entry.websitePlace || entry.category || record.websitePlace,
      position,
      entry.staffType || entry.staff_type || "",
      department,
    );
    return {
      ...record,
      positionCode: parsed.position_code,
      displayTitle: parsed.is_known ? parsed.display_title : position || parsed.display_title,
      mainCategory:
        parsed.is_known && parsed.main_category ? parsed.main_category : "Uncategorized Staff",
      section: parsed.is_known && parsed.section ? parsed.section : "Uncategorized Staff",
      department,
      position: position || parsed.display_title,
      websitePlace: websitePlace || parsed.section,
      subject: clean(entry.subject || "", 100),
      classes: clean(entry.classes || "", 100),
      isPrimary: index === 0,
      displayOrder: index,
      sortOrder: Math.round(Number(parsed.sort_order || 0)),
      visibleOnWebsite: true,
      isKnown: parsed.is_known,
    };
  }

  function positionCodesInput(body = {}) {
    if (Object.prototype.hasOwnProperty.call(body, "position_codes")) return body.position_codes;
    if (Object.prototype.hasOwnProperty.call(body, "positionCodes")) return body.positionCodes;
    return null;
  }

  function positionCodesToText(codes) {
    return normalizePositionCodes(codes).join("\n");
  }

  async function ensureStaffTables() {
    if (staffSchemaReady) return;
    await ensureContentTables();

    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_profiles (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NULL,
        teacher_id VARCHAR(50) NULL,
        full_name VARCHAR(150) NOT NULL,
        slug VARCHAR(180) NULL,
        email VARCHAR(190) NULL,
        phone VARCHAR(50) NULL,
        nic VARCHAR(50) NULL,
        staff_type VARCHAR(100) NOT NULL DEFAULT 'Academic Staff',
        department VARCHAR(120) NULL,
        position VARCHAR(150) NULL,
        qualification TEXT NULL,
        bio TEXT NULL,
        joined_date DATE NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Active',
        sort_order INT NOT NULL DEFAULT 0,
        profile_image TEXT NULL,
        photo_url TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_staff_profiles_user_id (user_id),
        KEY idx_staff_profiles_teacher_id (teacher_id),
        KEY idx_staff_profiles_status (status),
        KEY idx_staff_profiles_type (staff_type),
        KEY idx_staff_profiles_slug (slug),
        KEY idx_staff_profiles_sort (sort_order)
      )
    `);
    await addColumnIfMissing("staff_profiles", "slug", "VARCHAR(180) NULL");
    await addColumnIfMissing("staff_profiles", "bio", "TEXT NULL");
    await addColumnIfMissing("staff_profiles", "sort_order", "INT NOT NULL DEFAULT 0");
    await addColumnIfMissing("staff_profiles", "profile_image", "TEXT NULL");
    await addColumnIfMissing("staff_profiles", "photo_url", "TEXT NULL");
    await addColumnIfMissing(
      "staff_profiles",
      "edutrack_sync_status",
      "VARCHAR(30) DEFAULT 'not_synced'",
    );
    await addColumnIfMissing("staff_profiles", "edutrack_sync_error", "TEXT NULL");
    await addColumnIfMissing("staff_profiles", "edutrack_teacher_id", "VARCHAR(80) NULL");
    await addIndexIfMissing("staff_profiles", "idx_staff_profiles_email", "(email)");
    await addIndexIfMissing("staff_profiles", "idx_staff_profiles_nic", "(nic)");
    await addIndexIfMissing("staff_profiles", "idx_staff_profiles_slug", "(slug)");
    await addIndexIfMissing("staff_profiles", "idx_staff_profiles_sort", "(sort_order)");

    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_profile_photos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_id VARCHAR(50) NOT NULL,
        file_name VARCHAR(255) NULL,
        file_url TEXT NOT NULL,
        folder VARCHAR(120) NOT NULL,
        media_source_id VARCHAR(50) NULL,
        uploaded_by VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_staff_profile_photos_staff (staff_id),
        KEY idx_staff_profile_photos_media (media_source_id)
      )
    `);

    await addColumnIfMissing("teachers", "staff_id", "VARCHAR(50) NULL");
    await addColumnIfMissing("teachers", "external_staff_id", "VARCHAR(80) NULL");
    await addColumnIfMissing("teachers", "slug", "VARCHAR(180) NULL");
    await addColumnIfMissing("teachers", "website_place", "VARCHAR(120) NULL");
    await addColumnIfMissing("teachers", "positions_json", "LONGTEXT NULL");
    await addColumnIfMissing("teachers", "position_codes", "LONGTEXT NULL");
    await addColumnIfMissing("teachers", "email", "VARCHAR(190) NULL");
    await addColumnIfMissing("teachers", "phone", "VARCHAR(50) NULL");
    await addColumnIfMissing("teachers", "bio", "TEXT NULL");
    await addColumnIfMissing("teachers", "sort_order", "INT NOT NULL DEFAULT 0");
    await addIndexIfMissing("teachers", "idx_teachers_staff_id", "(staff_id)");
    await addIndexIfMissing("teachers", "idx_teachers_external_staff_id", "(external_staff_id)");

    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_sync_outbox (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_profile_id VARCHAR(50),
        target_system VARCHAR(50) NOT NULL DEFAULT 'edutrack',
        payload LONGTEXT,
        status VARCHAR(30) DEFAULT 'pending',
        error TEXT,
        attempts INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_staff_sync_outbox_staff (staff_profile_id),
        KEY idx_staff_sync_outbox_status (status)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_positions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_id VARCHAR(50) NOT NULL,
        position_master_id INT NULL,
        position_code VARCHAR(180) NOT NULL DEFAULT '',
        display_title VARCHAR(180) NOT NULL DEFAULT '',
        main_category VARCHAR(120) NOT NULL DEFAULT '',
        section VARCHAR(120) NOT NULL DEFAULT '',
        subsection VARCHAR(120) NOT NULL DEFAULT '',
        grade INT NULL,
        stream VARCHAR(80) NOT NULL DEFAULT '',
        medium VARCHAR(80) NOT NULL DEFAULT '',
        class_or_stream VARCHAR(120) NOT NULL DEFAULT '',
        department VARCHAR(120) NOT NULL DEFAULT '',
        position VARCHAR(150) NOT NULL DEFAULT '',
        website_place VARCHAR(120) NOT NULL DEFAULT 'Subject Teachers',
        subject VARCHAR(100) NOT NULL DEFAULT '',
        classes VARCHAR(100) NOT NULL DEFAULT '',
        is_primary TINYINT(1) NOT NULL DEFAULT 0,
        display_order INT NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        visible_on_website TINYINT(1) NOT NULL DEFAULT 1,
        is_known TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_staff_position (
          staff_id,
          website_place,
          position,
          subject,
          classes
        ),
        KEY idx_staff_positions_staff (staff_id),
        KEY idx_staff_positions_master (position_master_id),
        KEY idx_staff_positions_place (website_place),
        KEY idx_staff_positions_visible (visible_on_website)
      )
    `);
    await addColumnIfMissing("staff_positions", "position_master_id", "INT NULL");
    await addColumnIfMissing(
      "staff_positions",
      "position_code",
      "VARCHAR(180) NOT NULL DEFAULT ''",
    );
    await addColumnIfMissing(
      "staff_positions",
      "display_title",
      "VARCHAR(180) NOT NULL DEFAULT ''",
    );
    await addColumnIfMissing(
      "staff_positions",
      "main_category",
      "VARCHAR(120) NOT NULL DEFAULT ''",
    );
    await addColumnIfMissing("staff_positions", "section", "VARCHAR(120) NOT NULL DEFAULT ''");
    await addColumnIfMissing("staff_positions", "subsection", "VARCHAR(120) NOT NULL DEFAULT ''");
    await addColumnIfMissing("staff_positions", "grade", "INT NULL");
    await addColumnIfMissing("staff_positions", "stream", "VARCHAR(80) NOT NULL DEFAULT ''");
    await addColumnIfMissing("staff_positions", "medium", "VARCHAR(80) NOT NULL DEFAULT ''");
    await addColumnIfMissing(
      "staff_positions",
      "class_or_stream",
      "VARCHAR(120) NOT NULL DEFAULT ''",
    );
    await addColumnIfMissing("staff_positions", "sort_order", "INT NOT NULL DEFAULT 0");
    await addColumnIfMissing("staff_positions", "is_known", "TINYINT(1) NOT NULL DEFAULT 1");
    await addIndexIfMissing(
      "staff_positions",
      "idx_staff_positions_master",
      "(position_master_id)",
    );
    await addIndexIfMissing("staff_positions", "idx_staff_positions_code", "(position_code)");
    await addIndexIfMissing("staff_positions", "idx_staff_positions_category", "(main_category)");
    await addIndexIfMissing("staff_positions", "idx_staff_positions_sort", "(sort_order)");

    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_position_master (
        id INT AUTO_INCREMENT PRIMARY KEY,
        position_title VARCHAR(150) NOT NULL,
        category VARCHAR(120) NOT NULL DEFAULT '',
        department VARCHAR(120) NOT NULL DEFAULT '',
        website_place VARCHAR(120) NOT NULL DEFAULT 'Subject Teachers',
        description TEXT NULL,
        default_staff_type VARCHAR(100) NOT NULL DEFAULT 'Academic Staff',
        visible_on_website TINYINT(1) NOT NULL DEFAULT 1,
        status VARCHAR(40) NOT NULL DEFAULT 'Active',
        display_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_staff_position_master (
          position_title,
          category,
          department,
          website_place
        ),
        KEY idx_staff_position_master_title (position_title),
        KEY idx_staff_position_master_category (category),
        KEY idx_staff_position_master_place (website_place),
        KEY idx_staff_position_master_status (status),
        KEY idx_staff_position_master_order (display_order)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_id VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        check_in TIME NULL,
        check_out TIME NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Present',
        note TEXT NULL,
        marked_by VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_staff_date (staff_id, date),
        KEY idx_staff_attendance_date (date),
        KEY idx_staff_attendance_staff (staff_id)
      )
    `);
    await addColumnIfMissing("staff_attendance", "staff_profile_id", "VARCHAR(50) NULL");
    await addColumnIfMissing("staff_attendance", "staff_name", "VARCHAR(190) NULL");
    await addColumnIfMissing("staff_attendance", "attendance_date", "DATE NULL");
    await addColumnIfMissing("staff_attendance", "section", "VARCHAR(120) NULL");
    await addColumnIfMissing("staff_attendance", "staff_type", "VARCHAR(100) NULL");
    await addColumnIfMissing("staff_attendance", "position", "VARCHAR(150) NULL");
    await addColumnIfMissing("staff_attendance", "reason", "TEXT NULL");
    await addColumnIfMissing("staff_attendance", "late_minutes", "INT NULL");
    await addColumnIfMissing("staff_attendance", "marked_by_user_id", "VARCHAR(50) NULL");
    await addColumnIfMissing("staff_attendance", "marked_by_name", "VARCHAR(190) NULL");
    await addColumnIfMissing("staff_attendance", "marked_at", "TIMESTAMP NULL");
    await addColumnIfMissing("staff_attendance", "updated_by_user_id", "VARCHAR(50) NULL");
    await addColumnIfMissing(
      "staff_attendance",
      "updated_at",
      "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    );
    await db.query(`
      UPDATE staff_attendance
      SET staff_profile_id = COALESCE(NULLIF(staff_profile_id, ''), staff_id),
          attendance_date = COALESCE(attendance_date, date)
      WHERE staff_profile_id IS NULL
         OR staff_profile_id = ''
         OR attendance_date IS NULL
    `);
    await addIndexIfMissing("staff_attendance", "idx_staff_attendance_profile", "(staff_profile_id)");
    await addIndexIfMissing(
      "staff_attendance",
      "idx_staff_attendance_attendance_date",
      "(attendance_date)",
    );
    const [attendanceUniqueIndexes] = await db.query(
      "SHOW INDEX FROM staff_attendance WHERE Key_name = 'unique_staff_profile_attendance_date'",
    );
    if (!attendanceUniqueIndexes.length) {
      await db.query(
        "ALTER TABLE staff_attendance ADD UNIQUE KEY unique_staff_profile_attendance_date (staff_profile_id, attendance_date)",
      );
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_attendance_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attendance_id INT NULL,
        staff_profile_id VARCHAR(50) NULL,
        staff_id VARCHAR(50) NULL,
        action VARCHAR(100) NOT NULL,
        old_status VARCHAR(40) NULL,
        new_status VARCHAR(40) NULL,
        old_value_json LONGTEXT NULL,
        new_value_json LONGTEXT NULL,
        actor_user_id VARCHAR(50) NULL,
        actor_name VARCHAR(190) NULL,
        ip_address VARCHAR(80) NULL,
        user_agent TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_staff_att_audit_attendance (attendance_id),
        KEY idx_staff_att_audit_staff (staff_profile_id),
        KEY idx_staff_att_audit_actor (actor_user_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_leave_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_id VARCHAR(50) NOT NULL,
        leave_type VARCHAR(80) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Pending',
        reviewed_by VARCHAR(50) NULL,
        review_note TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_staff_leave_staff (staff_id),
        KEY idx_staff_leave_status (status)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_id VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        document_type VARCHAR(100) NULL,
        uploaded_by VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_staff_documents_staff (staff_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_notices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        body TEXT NULL,
        audience VARCHAR(100) NOT NULL DEFAULT 'All staff',
        priority VARCHAR(40) NOT NULL DEFAULT 'Normal',
        status VARCHAR(40) NOT NULL DEFAULT 'Published',
        created_by VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_staff_notices_status (status)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor_user_id VARCHAR(50) NULL,
        action VARCHAR(120) NOT NULL,
        target_type VARCHAR(80) NULL,
        target_id VARCHAR(80) NULL,
        details LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_staff_audit_target (target_type, target_id),
        KEY idx_staff_audit_actor (actor_user_id)
      )
    `);

    await seedStaffPositionMaster();
    await backfillStaffProfiles();
    await repairStaffPublicRows();
    staffSchemaReady = true;
  }

  async function seedStaffPositionMaster() {
    for (const item of defaultPositionMaster) {
      await db.query(
        `
          INSERT INTO staff_position_master
            (
              position_title, category, department, website_place, description,
              default_staff_type, visible_on_website, status, display_order
            )
          VALUES (?, ?, ?, ?, '', ?, ?, 'Active', ?)
          ON DUPLICATE KEY UPDATE
            position_title = position_title
        `,
        [
          item.positionTitle,
          item.category,
          item.department,
          item.websitePlace,
          item.defaultStaffType,
          item.websitePlace === "Hidden from Website" ? 0 : 1,
          item.displayOrder,
        ],
      );
    }

    const [assignedPositions] = await db.query(`
      SELECT DISTINCT
        position,
        department,
        website_place
      FROM staff_positions
      WHERE position IS NOT NULL
        AND position <> ''
    `);

    for (const [index, row] of assignedPositions.entries()) {
      const positionTitle = clean(row.position, 150);
      if (!positionTitle) continue;
      const department = clean(row.department, 120);
      const websitePlace = normalizeMasterWebsitePlace(
        row.website_place,
        positionTitle,
        "",
        department,
      );
      const category = normalizePositionCategory("", positionTitle, "");
      const defaultStaffType = normalizeDefaultStaffType("", category);
      await db.query(
        `
          INSERT INTO staff_position_master
            (
              position_title, category, department, website_place, description,
              default_staff_type, visible_on_website, status, display_order
            )
          VALUES (?, ?, ?, ?, '', ?, ?, 'Active', ?)
          ON DUPLICATE KEY UPDATE
            position_title = position_title
        `,
        [
          positionTitle,
          category,
          department,
          websitePlace,
          defaultStaffType,
          websitePlace === "Hidden from Website" ? 0 : 1,
          defaultPositionMaster.length + index + 1,
        ],
      );
    }
  }

  async function backfillStaffProfiles() {
    await db.query(`
      INSERT IGNORE INTO staff_profiles
        (
          id,
          user_id,
          teacher_id,
          full_name,
          email,
          staff_type,
          department,
          position,
          qualification,
          status,
          profile_image,
          photo_url
        )
      SELECT
        COALESCE(
          NULLIF(t.staff_id, ''),
          CASE
            WHEN t.id LIKE '%__%' THEN SUBSTRING_INDEX(t.id, '__', 1)
            ELSE t.id
          END
        ),
        u.id,
        t.id,
        t.name,
        COALESCE(NULLIF(t.account_email, ''), u.email),
        COALESCE(NULLIF(t.type, ''), 'Academic Staff'),
        COALESCE(NULLIF(t.section, ''), NULLIF(t.category, '')),
        NULLIF(t.position, ''),
        NULLIF(t.qualifications, ''),
        CASE WHEN t.status = 'Active' THEN 'Active' ELSE 'Inactive' END,
        NULLIF(t.image, ''),
        NULLIF(t.image, '')
      FROM teachers t
      LEFT JOIN users u ON u.id = NULLIF(t.account_user_id, '')
      WHERE t.id IS NOT NULL
        AND t.name IS NOT NULL
        AND t.name <> ''
    `);
    await db.query(
      "UPDATE staff_profiles SET photo_url = profile_image WHERE (photo_url IS NULL OR photo_url = '') AND profile_image IS NOT NULL",
    );
    await ensureProfileSlugs();
    await sanitizeStaffProfileUserLinks();
    await backfillStaffPositions();
    await repairPublicPlacementProfiles();
    await seedStaffPositionMaster();
  }

  async function ensureProfileSlugs() {
    const [rows] = await db.query(
      "SELECT id, full_name, slug FROM staff_profiles WHERE slug IS NULL OR slug = ''",
    );
    for (const row of rows) {
      const generated = profileSlug(row.full_name || row.id);
      if (!generated) continue;
      await db.query("UPDATE staff_profiles SET slug = ? WHERE id = ?", [generated, row.id]);
    }
  }

  async function repairPublicPlacementProfiles() {
    const [rows] = await db.query(`
      SELECT
        sp.id,
        COALESCE(NULLIF(t.staff_id, ''), SUBSTRING_INDEX(sp.id, '__', 1)) AS canonical_id
      FROM staff_profiles sp
      LEFT JOIN teachers t
        ON t.id = sp.teacher_id
        OR t.id = sp.id
      WHERE sp.id LIKE '%__%'
    `);

    for (const row of rows) {
      const profileId = clean(row.id, 50);
      const canonicalId = clean(row.canonical_id || profileId.split("__")[0], 50);
      if (!profileId || !canonicalId || profileId === canonicalId) continue;

      await db.query(
        `
          INSERT IGNORE INTO staff_profiles
            (
              id, user_id, teacher_id, full_name, email, phone, nic,
              slug, staff_type, department, position, qualification, bio, joined_date,
              status, sort_order, profile_image, photo_url
            )
          SELECT
              ?, user_id, teacher_id, full_name, email, phone, nic,
              slug, staff_type, department, position, qualification, bio, joined_date,
              status, sort_order, profile_image, photo_url
          FROM staff_profiles
          WHERE id = ?
        `,
        [canonicalId, profileId],
      );
      await db.query(
        `
          UPDATE staff_profiles target
          JOIN staff_profiles source ON source.id = ?
          SET
            target.user_id = COALESCE(target.user_id, source.user_id),
            target.teacher_id = COALESCE(target.teacher_id, source.teacher_id),
            target.email = COALESCE(NULLIF(target.email, ''), source.email),
            target.phone = COALESCE(NULLIF(target.phone, ''), source.phone),
            target.nic = COALESCE(NULLIF(target.nic, ''), source.nic),
            target.slug = COALESCE(NULLIF(target.slug, ''), source.slug),
            target.bio = COALESCE(NULLIF(target.bio, ''), source.bio),
            target.sort_order = CASE
              WHEN target.sort_order = 0 THEN source.sort_order
              ELSE target.sort_order
            END,
            target.profile_image = COALESCE(NULLIF(target.profile_image, ''), source.profile_image),
            target.photo_url = COALESCE(NULLIF(target.photo_url, ''), source.photo_url)
          WHERE target.id = ?
        `,
        [profileId, canonicalId],
      );
      await db.query(
        `
          INSERT IGNORE INTO staff_positions
            (
              staff_id, position_master_id, position_code, display_title,
              main_category, section, subsection, grade, stream, medium, class_or_stream,
              department, position, website_place, subject, classes, is_primary,
              display_order, sort_order, visible_on_website, is_known
            )
          SELECT
              ?, position_master_id, position_code, display_title,
              main_category, section, subsection, grade, stream, medium, class_or_stream,
              department, position, website_place, subject, classes, 0,
              display_order + 10, sort_order, visible_on_website, is_known
          FROM staff_positions
          WHERE staff_id = ?
        `,
        [canonicalId, profileId],
      );
      const [[primary]] = await db.query(
        "SELECT COUNT(*) AS total FROM staff_positions WHERE staff_id = ? AND is_primary = 1",
        [canonicalId],
      );
      if (Number(primary.total || 0) === 0) {
        await db.query(
          "UPDATE staff_positions SET is_primary = 1, display_order = 0 WHERE staff_id = ? ORDER BY display_order ASC, id ASC LIMIT 1",
          [canonicalId],
        );
      }
      await db.query("DELETE FROM staff_positions WHERE staff_id = ?", [profileId]);
      await db.query("DELETE FROM staff_profiles WHERE id = ?", [profileId]);
    }
  }

  async function backfillStaffPositions() {
    const [profiles] = await db.query(`
      SELECT id, department, position, staff_type
      FROM staff_profiles
      WHERE id IS NOT NULL AND id <> ''
    `);

    for (const profile of profiles) {
      const department = clean(profile.department, 120);
      const position = clean(profile.position, 150);
      if (!department && !position) continue;
      const record = legacyPositionRecord(
        {
          department,
          position,
          staffType: profile.staff_type,
          website_place: normalizeWebsitePlace("", position, profile.staff_type, department),
        },
        0,
      );
      await db.query(
        `
          INSERT IGNORE INTO staff_positions
            (
              staff_id, position_code, display_title, main_category, section, subsection,
              grade, stream, medium, class_or_stream, department, position, website_place,
              subject, classes, is_primary, display_order, sort_order, visible_on_website, is_known
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', 1, 0, ?, 1, ?)
        `,
        [
          profile.id,
          record.positionCode,
          record.displayTitle,
          record.mainCategory,
          record.section,
          record.subsection,
          record.grade,
          record.stream,
          record.medium,
          record.classOrStream,
          record.department,
          record.position,
          record.websitePlace,
          record.sortOrder,
          record.isKnown ? 1 : 0,
        ],
      );
    }

    const [teachers] = await db.query(`
      SELECT
        t.id,
        COALESCE(NULLIF(t.staff_id, ''), sp.id, t.id) AS staff_id,
        t.section,
        t.position,
        t.category,
        t.website_place,
        t.subject,
        t.classes,
        t.type
      FROM teachers t
      LEFT JOIN staff_profiles sp
        ON sp.id = COALESCE(NULLIF(t.staff_id, ''), t.id)
      WHERE t.id IS NOT NULL
        AND t.name IS NOT NULL
        AND t.name <> ''
    `);

    for (const teacher of teachers) {
      const staffId = clean(teacher.staff_id, 50);
      if (!staffId) continue;
      const position = clean(teacher.position, 150);
      const department = clean(teacher.section, 120);
      const subject = clean(teacher.subject, 100);
      const classes = clean(teacher.classes, 100);
      const websitePlace = normalizeWebsitePlace(
        teacher.website_place || teacher.category,
        position,
        teacher.type,
        department,
      );
      if (!position && !department && !subject && !classes) continue;
      const record = legacyPositionRecord(
        {
          department,
          position,
          website_place: websitePlace,
          subject,
          classes,
          staffType: teacher.type,
        },
        1,
      );

      await db.query(
        `
          INSERT INTO staff_positions
            (
              staff_id, position_code, display_title, main_category, section, subsection,
              grade, stream, medium, class_or_stream, department, position, website_place,
              subject, classes, is_primary, display_order, sort_order, visible_on_website, is_known
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 10, ?, 1, ?)
          ON DUPLICATE KEY UPDATE
            position_code = VALUES(position_code),
            display_title = VALUES(display_title),
            main_category = VALUES(main_category),
            section = VALUES(section),
            subsection = VALUES(subsection),
            grade = VALUES(grade),
            stream = VALUES(stream),
            medium = VALUES(medium),
            class_or_stream = VALUES(class_or_stream),
            department = VALUES(department),
            display_order = LEAST(display_order, VALUES(display_order)),
            sort_order = VALUES(sort_order),
            visible_on_website = VALUES(visible_on_website),
            is_known = VALUES(is_known)
        `,
        [
          staffId,
          record.positionCode,
          record.displayTitle,
          record.mainCategory,
          record.section,
          record.subsection,
          record.grade,
          record.stream,
          record.medium,
          record.classOrStream,
          record.department,
          record.position,
          record.websitePlace,
          subject,
          classes,
          record.sortOrder,
          record.isKnown ? 1 : 0,
        ],
      );
    }
  }

  async function sanitizeStaffProfileUserLinks() {
    await db.query("UPDATE staff_profiles SET user_id = NULL WHERE user_id = ''");
    await db.query(`
      UPDATE staff_profiles sp
      LEFT JOIN users u ON u.id = sp.user_id
      SET sp.user_id = NULL
      WHERE sp.user_id IS NOT NULL
        AND u.id IS NULL
    `);
    await db.query(`
      UPDATE staff_profiles sp
      JOIN teachers t ON t.id = sp.teacher_id
      JOIN users u ON u.id = t.account_user_id
      SET sp.user_id = u.id
      WHERE sp.user_id IS NULL
    `);
  }

  async function logStaffAction(req, action, targetType, targetId, details = {}) {
    try {
      await db.query(
        `
          INSERT INTO staff_audit_logs
            (actor_user_id, action, target_type, target_id, details)
          VALUES (?, ?, ?, ?, ?)
        `,
        [actorId(req), action, targetType, targetId, JSON.stringify(details)],
      );
    } catch (error) {
      console.error("[staff-audit] Failed to write staff audit log:", error);
    }
  }

  async function latestStaffProfilePhoto(runner, staffId) {
    const id = clean(staffId, 50);
    if (!id) return "";
    const [rows] = await runner.query(
      "SELECT file_url FROM staff_profile_photos WHERE staff_id = ? ORDER BY id DESC LIMIT 1",
      [id],
    );
    return rows[0]?.file_url || "";
  }

  async function existingPublicTeacherPhoto(runner, staffId, teacherId = "") {
    const id = clean(staffId, 50);
    const linkedTeacherId = clean(teacherId, 50);
    const values = [];
    const conditions = [];

    if (id) {
      conditions.push("staff_id = ?");
      values.push(id);
      conditions.push("id = ?");
      values.push(id);
    }
    if (linkedTeacherId && linkedTeacherId !== id) {
      conditions.push("id = ?");
      values.push(linkedTeacherId);
    }
    if (!conditions.length) return "";

    const [rows] = await runner.query(
      `
        SELECT image
        FROM teachers
        WHERE (${conditions.join(" OR ")})
          AND image IS NOT NULL
          AND image <> ''
        ORDER BY
          CASE
            WHEN staff_id = ? THEN 0
            WHEN id = ? THEN 1
            ELSE 2
          END
        LIMIT 1
      `,
      [...values, id, linkedTeacherId || id],
    );
    return rows[0]?.image || "";
  }

  async function applyStaffProfilePhoto(runner, staffId, fileUrl) {
    const id = clean(staffId, 50);
    const url = clean(fileUrl, 2048);
    if (!id || id === "pending" || !url) return false;

    const [profiles] = await runner.query("SELECT id FROM staff_profiles WHERE id = ? LIMIT 1", [
      id,
    ]);
    if (!profiles.length) return false;

    await runner.query("UPDATE staff_profiles SET profile_image = ?, photo_url = ? WHERE id = ?", [
      url,
      url,
      id,
    ]);
    await runner.query("UPDATE teachers SET image = ? WHERE staff_id = ? OR id = ?", [url, id, id]);
    return true;
  }

  async function recordStaffProfilePhoto(
    req,
    { staffId, folder, fileUrl, fileName, fileSize, sourceId },
  ) {
    const category = mediaCategoryFromFolder(folder, "image");
    await db.query(
      `
        INSERT INTO media_files (
          source_id,
          file_name,
          file_url,
          original_url,
          optimized_url,
          thumb_url,
          variant_urls,
          file_type,
          file_size,
          original_size,
          folder,
          category,
          warnings
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          file_name = VALUES(file_name),
          file_url = VALUES(file_url),
          original_url = VALUES(original_url),
          optimized_url = VALUES(optimized_url),
          thumb_url = VALUES(thumb_url),
          variant_urls = VALUES(variant_urls),
          file_type = VALUES(file_type),
          file_size = VALUES(file_size),
          original_size = VALUES(original_size),
          folder = VALUES(folder),
          category = VALUES(category),
          warnings = VALUES(warnings)
      `,
      [
        sourceId,
        fileName,
        fileUrl,
        fileUrl,
        fileUrl,
        null,
        JSON.stringify({ staffProfile: fileUrl }),
        "image",
        fileSize,
        fileSize,
        folder,
        category,
        JSON.stringify([]),
      ],
    );

    await db.query(
      `
        INSERT INTO staff_profile_photos
          (staff_id, file_name, file_url, folder, media_source_id, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [staffId, fileName, fileUrl, folder, sourceId, actorId(req)],
    );
  }

  async function nextStaffId() {
    await ensureStaffTables();
    const [rows] = await db.query(`
      SELECT id FROM staff_profiles WHERE id LIKE 'LCS-%'
      UNION
      SELECT id FROM teachers WHERE id LIKE 'LCS-%'
    `);
    const highest = rows.reduce((max, row) => {
      const match = /^LCS-(\d{4,})$/.exec(String(row.id || ""));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `LCS-${String(highest + 1).padStart(4, "0")}`;
  }

  function parsePositionsInput(body = {}) {
    const raw = body.positions || body.staff_positions || body.staffPositions;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function normalizePositionEntry(entry = {}, index = 0, fallback = {}) {
    const typedCode = normalizePositionCode(entry.position_code || entry.positionCode || "");
    if (typedCode) {
      const parsed = parsePositionCode(typedCode);
      const record = positionRecordFromParsed(parsed, index);
      return {
        ...record,
        positionMasterId: null,
        displayOrder: Number.isFinite(Number(entry.display_order ?? entry.displayOrder))
          ? Number(entry.display_order ?? entry.displayOrder)
          : index,
        visibleOnWebsite: booleanLike(entry.visible_on_website ?? entry.visibleOnWebsite, true),
      };
    }

    const position = clean(entry.position || entry.title || fallback.position || "", 150);
    const department = clean(entry.department || entry.section || fallback.department || "", 120);
    const staffType = fallback.staffType || fallback.staff_type || "";
    const rawWebsitePlace =
      entry.website_place || entry.websitePlace || entry.category || fallback.category;
    const masterId = Number(entry.position_master_id ?? entry.positionMasterId);
    const hiddenFromWebsite = clean(rawWebsitePlace, 120).toLowerCase() === "hidden from website";
    const legacy = legacyPositionRecord(
      {
        ...entry,
        position,
        department,
        website_place: normalizeWebsitePlace(rawWebsitePlace, position, staffType, department),
        staffType,
      },
      index,
    );
    return {
      ...legacy,
      positionMasterId: Number.isFinite(masterId) && masterId > 0 ? masterId : null,
      department,
      position,
      websitePlace: normalizeWebsitePlace(rawWebsitePlace, position, staffType, department),
      subject: clean(entry.subject || fallback.subject || "", 100),
      classes: clean(entry.classes || fallback.classes || "", 100),
      isPrimary: booleanLike(entry.is_primary ?? entry.isPrimary, index === 0),
      displayOrder: Number.isFinite(Number(entry.display_order ?? entry.displayOrder))
        ? Number(entry.display_order ?? entry.displayOrder)
        : index,
      sortOrder: legacy.sortOrder || 0,
      visibleOnWebsite: hiddenFromWebsite
        ? false
        : booleanLike(entry.visible_on_website ?? entry.visibleOnWebsite, true),
    };
  }

  function positionKey(position) {
    return [
      position.websitePlace,
      position.department,
      position.position,
      position.subject,
      position.classes,
    ]
      .map((part) => clean(part).toLowerCase())
      .join("|");
  }

  function normalizePositionPayload(body, payload) {
    const typedCodes = positionCodesInput(body);
    if (typedCodes !== null) {
      const positions = positionsFromPositionCodes(typedCodes);
      if (!positions.length) return [];
      positions.forEach((position, index) => {
        position.isPrimary = index === 0;
        position.displayOrder = index;
      });
      return positions;
    }

    const input = parsePositionsInput(body);
    const fallback = {
      department: payload.department,
      position: payload.position,
      category: payload.category,
      subject: payload.subject,
      classes: payload.classes,
      staffType: payload.staffType,
    };
    const source = input.length ? input : [fallback];
    const positions = [];
    const seen = new Set();

    source.forEach((entry, index) => {
      const normalized = normalizePositionEntry(entry, index, fallback);
      if (
        !normalized.department &&
        !normalized.position &&
        !normalized.subject &&
        !normalized.classes
      ) {
        return;
      }
      const key = positionKey(normalized);
      if (seen.has(key)) return;
      seen.add(key);
      positions.push(normalized);
    });

    if (!positions.length) {
      positions.push(normalizePositionEntry(fallback, 0, fallback));
    }

    if (!positions.some((position) => position.isPrimary)) {
      positions[0].isPrimary = true;
    }
    let primarySeen = false;
    positions.forEach((position, index) => {
      if (position.isPrimary && !primarySeen) {
        primarySeen = true;
        position.displayOrder = 0;
        return;
      }
      position.isPrimary = false;
      position.displayOrder = Number.isFinite(position.displayOrder)
        ? Math.max(1, position.displayOrder)
        : index + 1;
    });

    return positions.sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return Number(a.displayOrder || 0) - Number(b.displayOrder || 0);
    });
  }

  function applyPrimaryPosition(payload) {
    const primary =
      payload.positions.find((position) => position.isPrimary) || payload.positions[0];
    if (!primary) return;
    payload.department = primary.department;
    payload.position = primary.position;
    payload.category = primary.websitePlace;
    payload.subject = primary.subject;
    payload.classes = primary.classes;
  }

  function profilePayload(body = {}) {
    const id = clean(body.id || body.staff_id, 50);
    const fullName = clean(body.full_name || body.fullName || body.name, 150);
    const requestedSlug = profileSlug(body.slug || "");
    const teacherId = clean(body.teacher_id || body.teacherId || id, 50);
    const userId = clean(
      body.user_id || body.userId || body.account_user_id || body.accountUserId,
      50,
    );
    const providedStaffType = clean(body.staff_type || body.staffType || body.type || "", 100);
    const staffType = providedStaffType || "Academic Staff";
    const department = clean(body.department || body.section || "", 120);
    const qualification = clean(body.qualification || body.qualifications || "", 3000);
    const profileImage = clean(
      body.photo_url ||
        body.photoUrl ||
        body.profile_image ||
        body.profileImage ||
        body.image ||
        "",
      2048,
    );
    const email = clean(
      body.email || body.accountEmail || body.account_email || "",
      190,
    ).toLowerCase();

    const payload = {
      id,
      slug: requestedSlug || profileSlug(fullName || id),
      userId,
      teacherId,
      fullName,
      email,
      phone: clean(body.phone, 50),
      nic: clean(body.nic, 50),
      staffType,
      department,
      position: clean(body.position, 150),
      qualification,
      bio: clean(body.bio || body.responsibilities || "", 5000),
      joinedDate: normalizeDate(body.joined_date || body.joinedDate),
      status: normalizeStatus(body.status),
      sortOrder: normalizeSortOrder(body.sort_order ?? body.sortOrder, 0),
      profileImage,
      photoUrl: profileImage,
      accountEnabled: booleanField(body, "accountEnabled", "account_enabled"),
      accountEnabledProvided: hasField(body, "accountEnabled", "account_enabled"),
      accountPassword: String(body.accountPassword || body.password || ""),
      subject: clean(body.subject, 100),
      classes: clean(body.classes, 100),
      category: clean(body.category || body.website_place || body.websitePlace, 120),
      responsibilities: clean(body.responsibilities, 3000),
    };
    payload.positions = normalizePositionPayload(body, payload);
    payload.positionCodesProvided = positionCodesInput(body) !== null;
    const primaryPosition = payload.positions[0];
    if (!payload.sortOrder && primaryPosition?.sortOrder) {
      payload.sortOrder = normalizeSortOrder(primaryPosition.sortOrder, 0);
    }
    if (primaryPosition && !providedStaffType) {
      payload.staffType = staffTypeFromMainCategory(primaryPosition.mainCategory);
    }
    payload.positionCodes = payload.positions
      .map((position) => position.positionCode)
      .filter(Boolean);
    payload.replacePositions = hasField(
      body,
      "position_codes",
      "positionCodes",
      "positions",
      "staff_positions",
      "staffPositions",
    );
    applyPrimaryPosition(payload);
    return payload;
  }

  function serializePosition(row) {
    const department = row.department || "";
    const position = row.position || "";
    const websitePlace = normalizeWebsitePlace(row.website_place, position, "", department);
    return {
      id: row.id,
      staff_id: row.staff_id,
      position_master_id: row.position_master_id || null,
      positionMasterId: row.position_master_id || null,
      position_code: row.position_code || "",
      positionCode: row.position_code || "",
      display_title: row.display_title || position || "",
      displayTitle: row.display_title || position || "",
      main_category: row.main_category || "",
      mainCategory: row.main_category || "",
      section: row.section || "",
      subsection: row.subsection || "",
      grade: row.grade == null ? null : Number(row.grade),
      stream: row.stream || "",
      medium: row.medium || "",
      class_or_stream: row.class_or_stream || "",
      classOrStream: row.class_or_stream || "",
      department,
      position,
      website_place: websitePlace,
      websitePlace,
      subject: row.subject || "",
      classes: row.classes || "",
      is_primary: row.is_primary === 1 || row.is_primary === true,
      isPrimary: row.is_primary === 1 || row.is_primary === true,
      display_order: Number(row.display_order || 0),
      displayOrder: Number(row.display_order || 0),
      sort_order: Number(row.sort_order || 0),
      sortOrder: Number(row.sort_order || 0),
      visible_on_website: row.visible_on_website !== 0,
      visibleOnWebsite: row.visible_on_website !== 0,
      is_known: row.is_known !== 0,
      isKnown: row.is_known !== 0,
    };
  }

  function serializePositionMaster(row) {
    return {
      id: row.id,
      position_title: row.position_title || "",
      positionTitle: row.position_title || "",
      category: row.category || "",
      department: row.department || "",
      website_place: row.website_place || "",
      websitePlace: row.website_place || "",
      description: row.description || "",
      default_staff_type: row.default_staff_type || "Academic Staff",
      defaultStaffType: row.default_staff_type || "Academic Staff",
      visible_on_website: row.visible_on_website !== 0,
      visibleOnWebsite: row.visible_on_website !== 0,
      status: row.status || "Active",
      display_order: Number(row.display_order || 0),
      displayOrder: Number(row.display_order || 0),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async function readPositionMaster(id = null) {
    await ensureStaffTables();
    const values = [];
    const where = [];
    if (id) {
      where.push("id = ?");
      values.push(id);
    }
    const [rows] = await db.query(
      `
        SELECT *
        FROM staff_position_master
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY status = 'Disabled', display_order ASC, position_title ASC
      `,
      values,
    );
    return rows.map(serializePositionMaster);
  }

  function serializeProfile(row, positions = []) {
    const primary = positions.find((position) => position.is_primary) || positions[0] || null;
    const image = row.photo_url || row.profile_image || row.teacher_image || "";
    return {
      id: row.id,
      slug: row.slug || profileSlug(row.full_name || row.id),
      user_id: row.user_id || "",
      teacher_id: row.teacher_id || "",
      full_name: row.full_name || "",
      email: row.email || row.user_email || "",
      phone: row.phone || "",
      nic: row.nic || "",
      staff_type: row.staff_type || "Academic Staff",
      department: primary?.department || row.department || "",
      position: primary?.position || row.position || "",
      qualification: row.qualification || "",
      qualifications: row.qualification || "",
      bio: row.bio || row.responsibilities || "",
      joined_date: row.joined_date,
      status: row.status || "Active",
      sort_order: Number(row.sort_order || 0),
      sortOrder: Number(row.sort_order || 0),
      photo_url: image,
      profile_image: image,
      image,
      subject: primary?.subject || row.subject || "",
      classes: primary?.classes || row.classes || "",
      website_place: primary?.website_place || row.category || "",
      category: primary?.website_place || row.category || "",
      responsibilities: row.responsibilities || "",
      positions,
      position_codes: positions.map((position) => position.position_code).filter(Boolean),
      positionCodes: positions.map((position) => position.position_code).filter(Boolean),
      account_status: row.account_status || "",
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  function systemRolePosition(role) {
    if (role === ROLES.master) return "Master Admin";
    if (role === ROLES.super) return "Super Admin";
    if (role === ROLES.staff) return "Staff Admin";
    return "Portal User";
  }

  async function systemAccountProfile(req) {
    const [rows] = await db.query(
      "SELECT id, name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1",
      [req.user.id],
    );
    const user = rows[0] || req.user;

    return {
      id: user.id,
      user_id: user.id,
      teacher_id: "",
      full_name: user.name || user.email || systemRolePosition(user.role || req.user.role),
      email: user.email || req.user.email || "",
      phone: "",
      nic: "",
      staff_type: "Administration",
      department: "Administration",
      position: systemRolePosition(user.role || req.user.role),
      qualification: "",
      joined_date: null,
      status: user.status || "Active",
      profile_image: "",
      subject: "",
      classes: "",
      website_place: "Top Administration",
      category: "",
      responsibilities: "",
      positions: [
        {
          id: "",
          staff_id: user.id,
          department: "Administration",
          position: systemRolePosition(user.role || req.user.role),
          website_place: "Top Administration",
          websitePlace: "Top Administration",
          subject: "",
          classes: "",
          is_primary: true,
          isPrimary: true,
          display_order: 0,
          displayOrder: 0,
          visible_on_website: false,
          visibleOnWebsite: false,
        },
      ],
      account_status: user.status || "Active",
      role: user.role || req.user.role,
      is_system_account: true,
      created_at: user.created_at || null,
      updated_at: null,
    };
  }

  async function selfProfile(req) {
    const profiles = await readProfiles({ userId: req.user.id });
    return profiles[0] || (hasManageAccess(req) ? await systemAccountProfile(req) : null);
  }

  async function dashboardPayload() {
    await ensureStaffTables();
    const staff = await readProfiles();
    const [[attendanceToday]] = await db.query(
      "SELECT COUNT(*) AS total FROM staff_attendance WHERE COALESCE(attendance_date, date) = CURRENT_DATE()",
    );
    const [attendanceStatusRows] = await db.query(
      `
        SELECT status, COUNT(*) AS total
        FROM staff_attendance
        WHERE COALESCE(attendance_date, date) = CURRENT_DATE()
        GROUP BY status
      `,
    );
    const [[pendingLeave]] = await db.query(
      "SELECT COUNT(*) AS total FROM staff_leave_requests WHERE status = 'Pending'",
    );
    const [[documents]] = await db.query("SELECT COUNT(*) AS total FROM staff_documents");
    const [recentLogs] = await db.query(
      "SELECT id, actor_user_id, action, target_type, target_id, details, created_at FROM staff_audit_logs ORDER BY created_at DESC LIMIT 8",
    );

    const byType = staff.reduce((counts, item) => {
      const key = item.staff_type || "Academic Staff";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
    const byStatus = staff.reduce((counts, item) => {
      const key = item.status || "Active";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
    const attendanceByStatus = attendanceStatusRows.reduce((counts, row) => {
      counts[row.status || "Unmarked"] = Number(row.total || 0);
      return counts;
    }, {});
    const leaveToday =
      (attendanceByStatus["Duty Leave"] || 0) +
      (attendanceByStatus["Maternity Leave"] || 0) +
      (attendanceByStatus["Short Leave"] || 0) +
      (attendanceByStatus["Half Day"] || 0) +
      (attendanceByStatus["Leave Approved"] || 0) +
      (attendanceByStatus.Informed || 0);
    const activeStaffCount = staff.filter((item) => item.status === "Active").length;

    return {
      total: staff.length,
      active: staff.filter((item) => item.status === "Active").length,
      inactive: staff.filter((item) => item.status !== "Active").length,
      attendanceToday: Number(attendanceToday.total || 0),
      presentToday: attendanceByStatus.Present || 0,
      absentToday: attendanceByStatus.Absent || 0,
      leaveToday,
      lateToday: attendanceByStatus["Late to Come"] || attendanceByStatus.Late || 0,
      unmarkedToday: Math.max(0, activeStaffCount - Number(attendanceToday.total || 0)),
      attendanceByStatus,
      pendingLeave: Number(pendingLeave.total || 0),
      documents: Number(documents.total || 0),
      byType,
      byStatus,
      recentStaff: [...staff]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 8),
      recentLogs,
    };
  }

  const attendanceStatuses = [
    "Present",
    "Absent",
    "Duty Leave",
    "Maternity Leave",
    "Short Leave",
    "Half Day",
    "Leave Approved",
    "Informed",
    "Late to Come",
  ];
  const attendanceSections = [
    "All Sections",
    "Primary School",
    "Middle School",
    "Upper School",
    "A/L Section",
    "Administration",
    "Non-Academic Staff",
    "Supportive Staff",
  ];

  function normalizeAttendanceStatus(value) {
    const status = clean(value || "Present", 40);
    if (attendanceStatuses.includes(status)) return status;
    if (status === "Late") return "Late to Come";
    if (status === "Leave") return "Leave Approved";
    return "Present";
  }

  function actorName(req) {
    return clean(req.user?.name || req.user?.email || req.user?.id || "System", 190);
  }

  function staffAttendanceSection(profile = {}) {
    const staffType = profile.staff_type || profile.staffType || "";
    const source = [
      profile.department,
      profile.section,
      profile.position,
      profile.website_place,
      profile.websitePlace,
      profile.staff_type,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (staffType === "Supportive Staff" || /supportive/.test(source)) return "Supportive Staff";
    if (staffType === "Non-Academic Staff" || /non-academic|office|bookstore|financial|it|library|maintenance/.test(source)) {
      return "Non-Academic Staff";
    }
    if (/advanced|advance|a\/l|grade (12|13)|al section/.test(source)) return "A/L Section";
    if (/upper|grade (9|10|11)/.test(source)) return "Upper School";
    if (/middle|grade (6|7|8)/.test(source)) return "Middle School";
    if (/primary|grade ([1-5])/.test(source)) return "Primary School";
    if (/admin|principal|rector|secretary/.test(source)) return "Administration";
    return profile.department || "Administration";
  }

  function staffAttendanceProfileMatches(profile, { section, staffType, search }) {
    if (section && section !== "All Sections" && staffAttendanceSection(profile) !== section) return false;
    if (staffType && staffType !== "All" && staffType !== "All Staff" && profile.staff_type !== staffType) return false;
    const term = clean(search, 120).toLowerCase();
    if (!term) return true;
    return [
      profile.id,
      profile.teacher_id,
      profile.full_name,
      profile.nic,
      profile.position,
      profile.department,
      profile.staff_type,
      profile.email,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(term);
  }

  async function attendanceRecordsByDate(date) {
    const [rows] = await db.query(
      `
        SELECT *
        FROM staff_attendance
        WHERE COALESCE(attendance_date, date) = ?
      `,
      [date],
    );
    const byProfile = new Map();
    rows.forEach((row) => {
      byProfile.set(String(row.staff_profile_id || row.staff_id || ""), row);
      byProfile.set(String(row.staff_id || ""), row);
    });
    return byProfile;
  }

  async function staffAttendanceRows(query = {}) {
    await ensureStaffTables();
    const date = normalizeDate(query.date || query.attendance_date) || new Date().toISOString().slice(0, 10);
    const section = attendanceSections.includes(clean(query.section, 120))
      ? clean(query.section, 120)
      : "All Sections";
    const staffType = clean(query.staff_type || query.staffType || "All", 100);
    const search = clean(query.search, 120);
    const profiles = (await readProfiles()).filter((profile) =>
      staffAttendanceProfileMatches(profile, { section, staffType, search }),
    );
    const byProfile = await attendanceRecordsByDate(date);
    return profiles.map((profile) => {
      const record = byProfile.get(String(profile.id)) || null;
      const computedSection = staffAttendanceSection(profile);
      const status = record?.status || "";
      return {
        attendance_id: record?.id || null,
        id: record?.id || null,
        staff_profile_id: profile.id,
        staff_id: profile.id,
        teacher_id: profile.teacher_id || "",
        staff_name: profile.full_name,
        full_name: profile.full_name,
        attendance_date: date,
        date,
        section: record?.section || computedSection,
        staff_type: record?.staff_type || profile.staff_type || "",
        position: record?.position || profile.position || "",
        status,
        note: record?.note || "",
        reason: record?.reason || "",
        late_minutes: record?.late_minutes || "",
        last_updated: record?.updated_at || record?.marked_at || record?.created_at || null,
        marked_by_name: record?.marked_by_name || "",
      };
    });
  }

  function attendanceSummary(rows) {
    const byStatus = Object.fromEntries(attendanceStatuses.map((status) => [status, 0]));
    let unmarked = 0;
    rows.forEach((row) => {
      if (!row.status) {
        unmarked += 1;
      } else if (Object.prototype.hasOwnProperty.call(byStatus, row.status)) {
        byStatus[row.status] += 1;
      }
    });
    return {
      totalStaff: rows.length,
      ...byStatus,
      Unmarked: unmarked,
    };
  }

  async function insertStaffAttendanceAudit(conn, req, attendanceId, staffProfileId, staffId, action, oldValue, newValue) {
    await conn.query(
      `
        INSERT INTO staff_attendance_audit_logs
          (attendance_id, staff_profile_id, staff_id, action, old_status, new_status,
           old_value_json, new_value_json, actor_user_id, actor_name, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        attendanceId || null,
        staffProfileId || null,
        staffId || null,
        action,
        oldValue?.status || null,
        newValue?.status || null,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        actorId(req),
        actorName(req),
        clean(req.ip || req.headers["x-forwarded-for"] || "", 80),
        clean(req.headers["user-agent"] || "", 1000),
      ],
    );
  }

  async function bulkMarkStaffAttendance(req, res) {
    const conn = await db.getConnection();
    try {
      await ensureStaffTables();
      const input = Array.isArray(req.body)
        ? req.body
        : Array.isArray(req.body?.records)
          ? req.body.records
          : req.body && typeof req.body === "object"
            ? [req.body]
            : [];
      if (!Array.isArray(input) || !input.length) {
        return res.status(400).json({ error: "Attendance records are required" });
      }
      const date =
        normalizeDate(req.body?.date || input[0]?.attendance_date || input[0]?.date) ||
        new Date().toISOString().slice(0, 10);
      const profiles = await readProfiles();
      const profilesById = new Map(profiles.map((profile) => [String(profile.id), profile]));
      await conn.beginTransaction();
      let saved = 0;
      for (const item of input) {
        const staffProfileId = clean(item.staff_profile_id || item.staffProfileId || item.staff_id || item.staffId, 50);
        if (!staffProfileId) continue;
        const profile = profilesById.get(staffProfileId);
        if (!profile) continue;
        const attendanceDate = normalizeDate(item.attendance_date || item.date) || date;
        const status = normalizeAttendanceStatus(item.status);
        const payload = {
          staff_profile_id: profile.id,
          staff_id: profile.id,
          staff_name: profile.full_name,
          attendance_date: attendanceDate,
          section: clean(item.section || staffAttendanceSection(profile), 120),
          staff_type: clean(item.staff_type || profile.staff_type, 100),
          position: clean(item.position || profile.position, 150),
          status,
          note: cleanNullable(item.note, 2000),
          reason: cleanNullable(item.reason || item.note, 2000),
          late_minutes: Number.isFinite(Number(item.late_minutes)) ? Number(item.late_minutes) : null,
        };
        const [existingRows] = await conn.query(
          `
            SELECT *
            FROM staff_attendance
            WHERE (staff_profile_id = ? OR staff_id = ?)
              AND COALESCE(attendance_date, date) = ?
            LIMIT 1
            FOR UPDATE
          `,
          [payload.staff_profile_id, payload.staff_id, payload.attendance_date],
        );
        const existing = existingRows[0] || null;
        await conn.query(
          `
            INSERT INTO staff_attendance
              (staff_profile_id, staff_id, staff_name, attendance_date, date, section,
               staff_type, position, status, note, reason, late_minutes, marked_by,
               marked_by_user_id, marked_by_name, marked_at, updated_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
            ON DUPLICATE KEY UPDATE
              staff_name = VALUES(staff_name),
              attendance_date = VALUES(attendance_date),
              date = VALUES(date),
              section = VALUES(section),
              staff_type = VALUES(staff_type),
              position = VALUES(position),
              status = VALUES(status),
              note = VALUES(note),
              reason = VALUES(reason),
              late_minutes = VALUES(late_minutes),
              marked_by = VALUES(marked_by),
              marked_by_user_id = VALUES(marked_by_user_id),
              marked_by_name = VALUES(marked_by_name),
              updated_by_user_id = VALUES(updated_by_user_id),
              updated_at = NOW()
          `,
          [
            payload.staff_profile_id,
            payload.staff_id,
            payload.staff_name,
            payload.attendance_date,
            payload.attendance_date,
            payload.section,
            payload.staff_type,
            payload.position,
            payload.status,
            payload.note,
            payload.reason,
            payload.late_minutes,
            actorId(req),
            actorId(req),
            actorName(req),
            actorId(req),
          ],
        );
        const [savedRows] = await conn.query(
          `
            SELECT *
            FROM staff_attendance
            WHERE staff_profile_id = ? AND attendance_date = ?
            LIMIT 1
          `,
          [payload.staff_profile_id, payload.attendance_date],
        );
        const savedRow = savedRows[0] || {};
        await insertStaffAttendanceAudit(
          conn,
          req,
          savedRow.id || existing?.id || null,
          payload.staff_profile_id,
          payload.staff_id,
          existing ? "attendance.updated" : "attendance.created",
          existing,
          payload,
        );
        saved += 1;
      }
      await conn.commit();
      await logStaffAction(req, "attendance.bulk_marked", "attendance", date, { saved });
      res.status(201).json({ success: true, saved });
    } catch (error) {
      await conn.rollback();
      res.status(500).json({ error: error.message });
    } finally {
      conn.release();
    }
  }

  async function dailyAttendanceReport(req, res) {
    try {
      const rows = await staffAttendanceRows(req.query || {});
      res.json({
        title: "Daily Staff Attendance Report",
        date: normalizeDate(req.query.date) || new Date().toISOString().slice(0, 10),
        section: clean(req.query.section || "All Sections", 120),
        generatedBy: actorName(req),
        generatedAt: new Date().toISOString(),
        summary: attendanceSummary(rows),
        records: rows,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async function attendanceAggregateReport(req, res, mode) {
    try {
      await ensureStaffTables();
      const dateFrom = normalizeDate(req.query.date_from || req.query.from) || `${new Date().getFullYear()}-01-01`;
      const dateTo = normalizeDate(req.query.date_to || req.query.to) || new Date().toISOString().slice(0, 10);
      const section = clean(req.query.section, 120);
      const staffId = clean(req.query.staff_id || req.params.staffId, 50);
      const where = ["COALESCE(attendance_date, date) BETWEEN ? AND ?"];
      const params = [dateFrom, dateTo];
      if (section && section !== "All Sections") {
        where.push("section = ?");
        params.push(section);
      }
      if (staffId) {
        where.push("(staff_profile_id = ? OR staff_id = ?)");
        params.push(staffId, staffId);
      }
      const group =
        mode === "monthly"
          ? "DATE_FORMAT(COALESCE(attendance_date, date), '%Y-%m')"
          : mode === "section"
            ? "section"
            : "staff_profile_id, staff_name";
      const [rows] = await db.query(
        `
          SELECT ${group} AS bucket, status, COUNT(*) AS total
          FROM staff_attendance
          WHERE ${where.join(" AND ")}
          GROUP BY ${group}, status
          ORDER BY bucket ASC, status ASC
        `,
        params,
      );
      res.json({
        title: `${mode} staff attendance report`,
        generatedBy: actorName(req),
        generatedAt: new Date().toISOString(),
        filters: { date_from: dateFrom, date_to: dateTo, section, staff_id: staffId },
        records: rows,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async function exportAttendanceCsv(req, res) {
    try {
      const rows = await staffAttendanceRows(req.query || {});
      const headers = ["Staff ID", "Name", "Date", "Section", "Staff Type", "Position", "Status", "Note", "Last Updated"];
      const csvEscape = (value) => {
        const text = value == null ? "" : String(value);
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };
      const lines = [
        headers.join(","),
        ...rows.map((row) =>
          [
            row.staff_id,
            row.staff_name,
            row.attendance_date,
            row.section,
            row.staff_type,
            row.position,
            row.status || "Unmarked",
            row.note,
            row.last_updated,
          ]
            .map(csvEscape)
            .join(","),
        ),
      ];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="staff-attendance-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(lines.join("\r\n"));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async function readProfiles({ staffId = null, userId = null } = {}) {
    await ensureStaffTables();
    const where = [];
    const values = [];

    if (staffId) {
      where.push("sp.id = ?");
      values.push(staffId);
    }
    if (userId) {
      where.push("(sp.user_id = ? OR sp.teacher_id = ?)");
      values.push(userId, userId);
    }

    const [rows] = await db.query(
      `
        SELECT
          sp.*,
          u.email AS user_email,
          u.status AS account_status,
          t.image AS teacher_image,
          t.subject,
          t.classes,
          t.category,
          t.responsibilities
        FROM staff_profiles sp
        LEFT JOIN users u ON u.id = sp.user_id
        LEFT JOIN teachers t ON t.id = COALESCE(NULLIF(sp.teacher_id, ''), sp.id)
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY
          sp.sort_order ASC,
          CASE
            WHEN sp.id REGEXP '^LCS-[0-9]+$' THEN 0
            ELSE 1
          END,
          CASE
            WHEN sp.id REGEXP '^LCS-[0-9]+$' THEN CAST(SUBSTRING_INDEX(sp.id, '-', -1) AS UNSIGNED)
            ELSE 999999999
          END,
          sp.id ASC,
          sp.full_name ASC
      `,
      values,
    );

    const ids = rows.map((row) => row.id).filter(Boolean);
    if (!ids.length) return [];

    const placeholders = ids.map(() => "?").join(",");
    const [positionRows] = await db.query(
      `
        SELECT *
        FROM staff_positions
        WHERE staff_id IN (${placeholders})
        ORDER BY staff_id, is_primary DESC, sort_order ASC, display_order ASC, id ASC
      `,
      ids,
    );
    const byStaff = new Map();
    positionRows.forEach((row) => {
      const item = serializePosition(row);
      if (!byStaff.has(item.staff_id)) byStaff.set(item.staff_id, []);
      byStaff.get(item.staff_id).push(item);
    });

    const profiles = rows.map((row) => serializeProfile(row, byStaff.get(row.id) || []));
    const byNic = new Map();
    const byEmail = new Map();
    profiles.forEach((profile) => {
      if (profile.nic) {
        const key = profile.nic.toLowerCase();
        byNic.set(key, [...(byNic.get(key) || []), profile.id]);
      }
      if (profile.email) {
        const key = profile.email.toLowerCase();
        byEmail.set(key, [...(byEmail.get(key) || []), profile.id]);
      }
    });
    profiles.forEach((profile) => {
      const nicMatches = profile.nic ? byNic.get(profile.nic.toLowerCase()) || [] : [];
      const emailMatches = profile.email ? byEmail.get(profile.email.toLowerCase()) || [] : [];
      const matches = [...new Set([...nicMatches, ...emailMatches])].filter(
        (id) => id !== profile.id,
      );
      profile.duplicate_warning = matches.length
        ? `Duplicate NIC/email also appears on ${matches.join(", ")}`
        : "";
    });
    return profiles;
  }

  async function readUserAccount(runner, userId) {
    const cleanUserId = clean(userId, 50);
    if (!cleanUserId) return null;

    const [rows] = await runner.query("SELECT id, email FROM users WHERE id = ? LIMIT 1", [
      cleanUserId,
    ]);
    return rows[0] || null;
  }

  async function readTeacherId(runner, teacherId) {
    const id = clean(teacherId, 50);
    if (!id) return null;
    const [rows] = await runner.query("SELECT id FROM teachers WHERE id = ? LIMIT 1", [id]);
    return rows[0]?.id || null;
  }

  async function resolveLinkedUserAccount(runner, payload, { id, isUpdate }) {
    if (payload.accountEnabled) {
      let selectedUser = await readUserAccount(runner, payload.userId);
      if (!selectedUser && isUpdate) {
        const [existing] = await runner.query(
          "SELECT user_id FROM staff_profiles WHERE id = ? LIMIT 1",
          [id],
        );
        selectedUser = await readUserAccount(runner, existing[0]?.user_id);
      }
      if (!selectedUser && isUpdate) {
        const [existingTeacher] = await runner.query(
          "SELECT account_user_id FROM teachers WHERE id = ? LIMIT 1",
          [payload.teacherId || id],
        );
        selectedUser = await readUserAccount(runner, existingTeacher[0]?.account_user_id);
      }
      const user = await upsertTeacherUserAccount(runner, {
        id: selectedUser?.id || "",
        name: payload.fullName,
        email: payload.email,
        password: payload.accountPassword,
        status: payload.status === "Active" ? "Active" : "Disabled",
      });
      return { id: user.id, email: user.email };
    }

    const selectedUser = await readUserAccount(runner, payload.userId);
    if (selectedUser) return selectedUser;

    if (isUpdate && !payload.accountEnabledProvided) {
      const [existing] = await runner.query(
        "SELECT user_id FROM staff_profiles WHERE id = ? LIMIT 1",
        [id],
      );
      const existingUser = await readUserAccount(runner, existing[0]?.user_id);
      if (existingUser) return existingUser;

      const [existingTeacher] = await runner.query(
        "SELECT account_user_id FROM teachers WHERE id = ? LIMIT 1",
        [payload.teacherId || id],
      );
      return readUserAccount(runner, existingTeacher[0]?.account_user_id);
    }

    return null;
  }

  async function findStaffIdentityMatch(runner, payload, requestedId = "") {
    const id = clean(requestedId || payload.id, 50);
    if (id) {
      const [rows] = await runner.query("SELECT id FROM staff_profiles WHERE id = ? LIMIT 1", [id]);
      if (rows.length) return { id: rows[0].id, matchType: "Staff ID" };
    }

    if (payload.slug) {
      const [rows] = await runner.query("SELECT id FROM staff_profiles WHERE slug = ? LIMIT 1", [
        payload.slug,
      ]);
      if (rows.length) return { id: rows[0].id, matchType: "slug" };
    }

    if (payload.nic) {
      const [rows] = await runner.query("SELECT id FROM staff_profiles WHERE nic = ? LIMIT 1", [
        payload.nic,
      ]);
      if (rows.length) return { id: rows[0].id, matchType: "NIC" };
    }

    if (payload.email) {
      const [rows] = await runner.query("SELECT id FROM staff_profiles WHERE email = ? LIMIT 1", [
        payload.email,
      ]);
      if (rows.length) return { id: rows[0].id, matchType: "email" };
    }

    if (!id && payload.fullName) {
      const [rows] = await runner.query(
        "SELECT id FROM staff_profiles WHERE LOWER(full_name) = LOWER(?) LIMIT 1",
        [payload.fullName],
      );
      if (rows.length) return { id: rows[0].id, matchType: "name" };
    }

    return null;
  }

  async function readStaffPositions(runner, staffId) {
    const [rows] = await runner.query(
      `
        SELECT *
        FROM staff_positions
        WHERE staff_id = ?
        ORDER BY is_primary DESC, sort_order ASC, display_order ASC, id ASC
      `,
      [staffId],
    );
    return rows.map((row) => {
      const department = row.department || "";
      const position = row.position || "";
      return {
        positionMasterId: row.position_master_id || null,
        positionCode: row.position_code || "",
        displayTitle: row.display_title || position || "",
        mainCategory: row.main_category || "",
        section: row.section || "",
        subsection: row.subsection || "",
        grade: row.grade == null ? null : Number(row.grade),
        stream: row.stream || "",
        medium: row.medium || "",
        classOrStream: row.class_or_stream || "",
        department,
        position,
        websitePlace: normalizeWebsitePlace(row.website_place, position, "", department),
        subject: row.subject || "",
        classes: row.classes || "",
        isPrimary: row.is_primary === 1,
        displayOrder: Number(row.display_order || 0),
        sortOrder: Number(row.sort_order || 0),
        visibleOnWebsite: row.visible_on_website !== 0,
        isKnown: row.is_known !== 0,
      };
    });
  }

  async function repairStaffPublicRows() {
    const [profiles] = await db.query(`
      SELECT
        sp.*,
        COALESCE(NULLIF(sp.email, ''), u.email) AS account_email
      FROM staff_profiles sp
      LEFT JOIN users u ON u.id = sp.user_id
      WHERE sp.id IS NOT NULL
        AND sp.id <> ''
        AND sp.full_name IS NOT NULL
        AND sp.full_name <> ''
    `);

    for (const profile of profiles) {
      const positions = await readStaffPositions(db, profile.id);
      await syncStaffPublicRows(
        db,
        {
          id: profile.id,
          slug: profile.slug || profileSlug(profile.full_name || profile.id),
          teacherId: profile.teacher_id || profile.id,
          userId: profile.user_id || null,
          accountEmail: profile.account_email || profile.email || "",
          fullName: profile.full_name,
          email: profile.email || "",
          phone: profile.phone || "",
          staffType: profile.staff_type || "Academic Staff",
          department: profile.department || "",
          position: profile.position || "",
          category: profile.category || "",
          subject: "",
          classes: "",
          status: profile.status || "Active",
          photoUrl: profile.photo_url || profile.profile_image || "",
          profileImage: profile.profile_image || profile.photo_url || "",
          qualification: profile.qualification || "",
          bio: profile.bio || "",
          sortOrder: Number(profile.sort_order || 0),
          responsibilities: profile.bio || "",
        },
        positions,
      );
    }
  }

  async function upsertStaffPositions(runner, staffId, positions, { replace = false } = {}) {
    if (replace) {
      await runner.query("DELETE FROM staff_positions WHERE staff_id = ?", [staffId]);
    }

    if (!positions.length) return;
    const normalized = positions;
    if (normalized.some((position) => position.isPrimary)) {
      await runner.query("UPDATE staff_positions SET is_primary = 0 WHERE staff_id = ?", [staffId]);
    }

    for (const position of normalized) {
      await runner.query(
        `
          INSERT INTO staff_positions
            (
              staff_id, position_master_id, position_code, display_title,
              main_category, section, subsection, grade, stream, medium, class_or_stream,
              department, position, website_place, subject, classes,
              is_primary, display_order, sort_order, visible_on_website, is_known
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            position_master_id = VALUES(position_master_id),
            position_code = VALUES(position_code),
            display_title = VALUES(display_title),
            main_category = VALUES(main_category),
            section = VALUES(section),
            subsection = VALUES(subsection),
            grade = VALUES(grade),
            stream = VALUES(stream),
            medium = VALUES(medium),
            class_or_stream = VALUES(class_or_stream),
            department = VALUES(department),
            position = VALUES(position),
            website_place = VALUES(website_place),
            subject = VALUES(subject),
            classes = VALUES(classes),
            is_primary = VALUES(is_primary),
            display_order = VALUES(display_order),
            sort_order = VALUES(sort_order),
            visible_on_website = VALUES(visible_on_website),
            is_known = VALUES(is_known)
        `,
        [
          staffId,
          position.positionMasterId || null,
          position.positionCode || "",
          position.displayTitle || position.position || "",
          position.mainCategory || "",
          position.section || "",
          position.subsection || "",
          position.grade || null,
          position.stream || "",
          position.medium || "",
          position.classOrStream || "",
          position.department,
          position.position,
          position.websitePlace,
          position.subject,
          position.classes,
          position.isPrimary ? 1 : 0,
          Number(position.displayOrder || 0),
          Number(position.sortOrder || 0),
          position.visibleOnWebsite ? 1 : 0,
          position.isKnown === false ? 0 : 1,
        ],
      );
    }
  }

  function publicTeacherId(staffId, position, index) {
    if (index === 0) return staffId;
    const suffix = `${slug(position.websitePlace || position.position)}-${index}`;
    return clean(`${staffId}__${suffix}`, 50);
  }

  function positionSummary(position) {
    return [
      position.position,
      position.department,
      position.websitePlace,
      position.subject,
      position.classes,
    ]
      .filter(Boolean)
      .join(" / ");
  }

  async function syncStaffPublicRows(runner, profile, positions) {
    const staffId = profile.id;
    if (profile.positionCodesProvided && !positions.length) {
      await runner.query("DELETE FROM teachers WHERE staff_id = ? OR id = ?", [staffId, staffId]);
      return;
    }
    const primary = positions.find((position) => position.isPrimary) ||
      positions[0] || {
        department: profile.department || "",
        position: profile.position || "",
        websitePlace: normalizeWebsitePlace(
          profile.category,
          profile.position,
          profile.staffType,
          profile.department,
        ),
        subject: profile.subject || "",
        classes: profile.classes || "",
        visibleOnWebsite: true,
      };
    const sourcePositions = (positions.length ? positions : [primary]).map((position) => ({
      ...position,
      websitePlace: normalizeWebsitePlace(
        position.websitePlace,
        position.position,
        profile.staffType,
        position.department,
      ),
    }));
    const active = profile.status === "Active";
    const visiblePositions = sourcePositions.filter(
      (position) => position.visibleOnWebsite !== false,
    );
    const publicPhoto =
      profile.photoUrl ||
      profile.profileImage ||
      (await existingPublicTeacherPhoto(runner, staffId, profile.teacherId));
    const positionsJson = JSON.stringify(
      sourcePositions.map((position) => ({
        position_master_id: position.positionMasterId || null,
        positionMasterId: position.positionMasterId || null,
        position_code: position.positionCode || "",
        positionCode: position.positionCode || "",
        display_title: position.displayTitle || position.position || "",
        displayTitle: position.displayTitle || position.position || "",
        main_category: position.mainCategory || "",
        mainCategory: position.mainCategory || "",
        section: position.section || "",
        subsection: position.subsection || "",
        grade: position.grade || null,
        stream: position.stream || "",
        medium: position.medium || "",
        class_or_stream: position.classOrStream || "",
        classOrStream: position.classOrStream || "",
        department: position.department,
        position: position.position,
        website_place: position.websitePlace,
        websitePlace: position.websitePlace,
        subject: position.subject,
        classes: position.classes,
        is_primary: position.isPrimary,
        isPrimary: position.isPrimary,
        display_order: position.displayOrder,
        displayOrder: position.displayOrder,
        sort_order: position.sortOrder || 0,
        sortOrder: position.sortOrder || 0,
        visible_on_website: position.visibleOnWebsite,
        visibleOnWebsite: position.visibleOnWebsite,
        is_known: position.isKnown !== false,
        isKnown: position.isKnown !== false,
      })),
    );
    const rows = (visiblePositions.length ? visiblePositions : [primary]).map((position) => ({
      ...position,
      status: active ? "Active" : "Hidden",
    }));
    const positionCodes = normalizePositionCodes(
      sourcePositions.map((position) => position.positionCode).filter(Boolean),
    );

    await runner.query("DELETE FROM teachers WHERE staff_id = ? OR id = ?", [staffId, staffId]);

    for (const [index, position] of rows.entries()) {
      await runner.query(
        `
          INSERT INTO teachers
            (
              id, staff_id, slug, name, email, phone, subject, classes, status, image, type, category,
              website_place, qualifications, responsibilities, section, position,
              positions_json, position_codes, bio, sort_order, account_email, account_user_id
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            staff_id = VALUES(staff_id),
            slug = VALUES(slug),
            name = VALUES(name),
            email = VALUES(email),
            phone = VALUES(phone),
            subject = VALUES(subject),
            classes = VALUES(classes),
            status = VALUES(status),
            image = VALUES(image),
            type = VALUES(type),
            category = VALUES(category),
            website_place = VALUES(website_place),
            qualifications = VALUES(qualifications),
            responsibilities = VALUES(responsibilities),
            section = VALUES(section),
            position = VALUES(position),
            positions_json = VALUES(positions_json),
            position_codes = VALUES(position_codes),
            bio = VALUES(bio),
            sort_order = VALUES(sort_order),
            account_email = VALUES(account_email),
            account_user_id = VALUES(account_user_id)
        `,
        [
          publicTeacherId(staffId, position, index),
          staffId,
          profile.slug || profileSlug(profile.fullName || staffId),
          profile.fullName,
          profile.email || "",
          profile.phone || "",
          position.subject || primary.subject || "",
          position.classes || primary.classes || "",
          position.status,
          publicPhoto,
          profile.staffType,
          position.mainCategory || position.websitePlace,
          position.section || position.websitePlace,
          profile.qualification,
          profile.bio || profile.responsibilities || "",
          position.department || primary.department || "",
          position.displayTitle || position.position || primary.position || "",
          positionsJson,
          JSON.stringify(positionCodes),
          profile.bio || profile.responsibilities || "",
          Number(profile.sortOrder || 0) + Number(position.sortOrder || position.displayOrder || 0),
          profile.accountEmail || "",
          profile.userId || null,
        ],
      );
    }
  }

  function buildEduTrackTeacherSyncPayload(profile, positions, options = {}) {
    const userId = clean(options.userId, 50);
    const email = clean(options.accountEmail || profile.email, 190).toLowerCase();
    if (!userId || !email) return null;

    const primary = positions.find((position) => position.isPrimary) || positions[0] || {};
    const payload = {
      staffId: profile.id,
      teacherId: profile.teacherId || profile.id,
      userId,
      name: profile.fullName,
      email,
      status: profile.status === "Active" ? "Active" : "Disabled",
      subject: primary.subject || profile.subject || "",
      classes: primary.classes || profile.classes || "",
      position: primary.position || profile.position || "",
      department: primary.department || profile.department || "",
      staffType: profile.staffType || "Academic Staff",
      photoUrl: profile.photoUrl || profile.profileImage || "",
      websitePlace: primary.websitePlace || profile.category || "",
      positions,
    };

    if (profile.accountPassword) payload.password = profile.accountPassword;
    return payload;
  }

  async function syncSavedProfileToEduTrack(payload) {
    if (typeof syncTeacherAccountToEduTrack !== "function") return null;
    try {
      return await syncTeacherAccountToEduTrack(db, payload);
    } catch (error) {
      return {
        ok: false,
        queued: false,
        warning: `EduTrack teacher sync failed after staff save: ${error.message}`,
      };
    }
  }

  async function saveProfile(req, payload, { isUpdate = false } = {}) {
    await ensureStaffTables();
    let id = payload.id || (await nextStaffId());
    const requestedId = id;

    if (!payload.fullName) {
      const error = new Error("Staff full name is required");
      error.status = 400;
      throw error;
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const identityMatch = await findStaffIdentityMatch(connection, payload, id);
      let duplicateWarning = "";
      if (identityMatch) {
        if (isUpdate && identityMatch.id !== id) {
          const error = new Error(
            `Duplicate ${identityMatch.matchType} found on staff profile ${identityMatch.id}.`,
          );
          error.status = 409;
          throw error;
        }
        if (!isUpdate && identityMatch.id !== id) {
          duplicateWarning = `Existing staff profile ${identityMatch.id} matched by ${identityMatch.matchType}; updated that profile instead of creating a duplicate.`;
        }
        id = identityMatch.id;
      }

      const [existingProfiles] = await connection.query(
        "SELECT id, teacher_id, profile_image, photo_url FROM staff_profiles WHERE id = ? LIMIT 1",
        [id],
      );
      const wasExisting = existingProfiles.length > 0;
      let teacherId = existingProfiles[0]?.teacher_id || payload.teacherId || id;
      const existingTeacherId = await readTeacherId(connection, teacherId);
      payload.id = id;
      payload.teacherId = teacherId;

      const linkedUser = await resolveLinkedUserAccount(connection, payload, {
        id,
        isUpdate: isUpdate || wasExisting,
      });
      const userId = linkedUser?.id || null;
      const accountEmail = linkedUser?.email || null;

      if (!payload.profileImage && !payload.photoUrl) {
        const existingPhoto =
          existingProfiles[0]?.photo_url || existingProfiles[0]?.profile_image || "";
        const latestPhoto =
          existingPhoto ||
          (await latestStaffProfilePhoto(connection, id)) ||
          (requestedId !== id ? await latestStaffProfilePhoto(connection, requestedId) : "") ||
          (await existingPublicTeacherPhoto(connection, id, teacherId)) ||
          (requestedId !== id
            ? await existingPublicTeacherPhoto(connection, requestedId, teacherId)
            : "");
        if (latestPhoto) {
          payload.profileImage = latestPhoto;
          payload.photoUrl = latestPhoto;
          if (requestedId !== id) {
            await connection.query(
              "UPDATE staff_profile_photos SET staff_id = ? WHERE staff_id = ?",
              [id, requestedId],
            );
          }
        }
      }

      await connection.query(
        `
          INSERT INTO staff_profiles
            (
              id, user_id, teacher_id, full_name, slug, email, phone, nic,
              staff_type, department, position, qualification, bio, joined_date,
              status, sort_order, profile_image, photo_url
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            teacher_id = VALUES(teacher_id),
            full_name = VALUES(full_name),
            slug = VALUES(slug),
            email = VALUES(email),
            phone = VALUES(phone),
            nic = VALUES(nic),
            staff_type = VALUES(staff_type),
            department = VALUES(department),
            position = VALUES(position),
            qualification = VALUES(qualification),
            bio = VALUES(bio),
            joined_date = VALUES(joined_date),
            status = VALUES(status),
            sort_order = VALUES(sort_order),
            profile_image = VALUES(profile_image),
            photo_url = VALUES(photo_url)
        `,
        [
          id,
          userId,
          cleanNullable(existingTeacherId, 50),
          payload.fullName,
          cleanNullable(payload.slug || profileSlug(payload.fullName), 180),
          cleanNullable(payload.email, 190),
          cleanNullable(payload.phone, 50),
          cleanNullable(payload.nic, 50),
          payload.staffType,
          cleanNullable(payload.department, 120),
          cleanNullable(payload.position, 150),
          cleanNullable(payload.qualification, 3000),
          cleanNullable(payload.bio, 5000),
          payload.joinedDate,
          payload.status,
          Number(payload.sortOrder || 0),
          cleanNullable(payload.profileImage, 2048),
          cleanNullable(payload.photoUrl || payload.profileImage, 2048),
        ],
      );

      await upsertStaffPositions(connection, id, payload.positions, {
        replace: payload.replacePositions,
      });
      const savedPositions = await readStaffPositions(connection, id);
      await syncStaffPublicRows(
        connection,
        {
          ...payload,
          id,
          slug: payload.slug || profileSlug(payload.fullName),
          userId,
          accountEmail,
          photoUrl: payload.photoUrl || payload.profileImage,
        },
        savedPositions,
      );
      teacherId = id;
      payload.teacherId = teacherId;
      await connection.query("UPDATE staff_profiles SET teacher_id = ? WHERE id = ?", [
        teacherId,
        id,
      ]);

      await connection.commit();
      const eduTrackPayload = buildEduTrackTeacherSyncPayload(
        {
          ...payload,
          id,
          userId,
          accountEmail,
          accountPassword: payload.accountPassword,
          teacherId,
          photoUrl: payload.photoUrl || payload.profileImage,
        },
        savedPositions,
        { userId, accountEmail },
      );
      const eduTrackSync = eduTrackPayload
        ? await syncSavedProfileToEduTrack(eduTrackPayload)
        : null;
      await logStaffAction(
        req,
        isUpdate || wasExisting ? "staff.updated" : "staff.created",
        "staff",
        id,
        {
          fullName: payload.fullName,
          teacherId,
          userId,
          eduTrackSync: eduTrackSync
            ? {
                ok: Boolean(eduTrackSync.ok),
                queued: Boolean(eduTrackSync.queued),
              }
            : null,
        },
      );

      return {
        id,
        created: !wasExisting,
        updated: wasExisting,
        duplicateWarning,
        edutrackSync: eduTrackSync,
        warning: eduTrackSync?.ok === false ? eduTrackSync.warning : undefined,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    const source = String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (quoted) {
        if (char === '"' && next === '"') {
          cell += '"';
          index += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          cell += char;
        }
        continue;
      }
      if (char === '"') {
        quoted = true;
        continue;
      }
      if (char === ",") {
        row.push(cell);
        cell = "";
        continue;
      }
      if (char === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }
      cell += char;
    }

    row.push(cell);
    if (row.some((value) => String(value || "").trim())) rows.push(row);
    if (!rows.length) return [];

    const headers = rows.shift().map((header) =>
      clean(header)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/(^_|_$)/g, ""),
    );
    return rows
      .filter((items) => items.some((value) => String(value || "").trim()))
      .map((items) => {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = items[index] == null ? "" : String(items[index]).trim();
        });
        return record;
      });
  }

  function csvField(row, ...keys) {
    for (const key of keys) {
      const normalized = key
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/(^_|_$)/g, "");
      if (Object.prototype.hasOwnProperty.call(row, normalized) && row[normalized]) {
        return row[normalized];
      }
    }
    return "";
  }

  function csvRowToStaffBody(row) {
    const fullName = csvField(row, "full_name", "full name", "name");
    const positionCodes =
      csvField(row, "position_codes", "position codes", "position_code", "position code") ||
      csvField(row, "position", "role", "title");
    return {
      id: csvField(row, "staff_id", "staff id", "id"),
      full_name: fullName,
      slug: csvField(row, "slug") || profileSlug(fullName),
      email: csvField(row, "email", "account_email", "account email"),
      phone: csvField(row, "phone", "mobile", "telephone"),
      nic: csvField(row, "nic", "NIC"),
      photo_url: csvField(row, "photo_url", "photo", "profile_image", "image"),
      staff_type: csvField(row, "staff_type", "staff type", "type"),
      status: csvField(row, "status") || "Active",
      qualification: csvField(row, "qualification", "qualifications"),
      bio: csvField(row, "bio", "responsibilities"),
      position_codes: positionCodes,
      sort_order: csvField(row, "sort_order", "sort order") || 0,
      joined_date: csvField(row, "joined_date", "joined date"),
    };
  }

  function csvSafeCell(value) {
    const text = String(value || "");
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  }

  function csvErrorReport(rows) {
    const output = [["row", "name", "slug", "errors"]];
    rows.forEach((row) => output.push([row.rowNumber, row.name, row.slug, row.errors.join("; ")]));
    return output
      .map((items) => items.map((item) => `"${csvSafeCell(item).replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }

  async function csvRowsToImportPlan(rows, { mode = "merge" } = {}) {
    await ensureStaffTables();
    const seen = new Set();
    const plan = {
      totalRows: rows.length,
      newStaffProfiles: 0,
      existingProfilesToUpdate: 0,
      duplicateRows: [],
      invalidRows: [],
      unknownPositionCodes: [],
      rows: [],
      payloads: [],
      errorReportCsv: "",
    };
    const unknownCodes = new Set();

    for (const [index, row] of rows.entries()) {
      const body = csvRowToStaffBody(row);
      const rowNumber = index + 2;
      const normalizedCodes = normalizePositionCodes(body.position_codes);
      const errors = [];
      if (!body.full_name) {
        errors.push("name is required");
      }
      if (!normalizedCodes.length) {
        errors.push("position_codes is required");
      }
      if (body.status && !["active", "inactive"].includes(String(body.status).toLowerCase())) {
        errors.push("status must be active or inactive");
      }
      const slugValue = profileSlug(body.slug || body.full_name);
      const duplicateKey = slugValue || body.full_name.toLowerCase();
      const duplicate = duplicateKey && seen.has(duplicateKey);
      if (duplicate) {
        plan.duplicateRows.push({ rowNumber, name: body.full_name, slug: slugValue });
        errors.push("duplicate row in CSV");
      }
      if (duplicateKey) seen.add(duplicateKey);

      normalizedCodes.forEach((code) => {
        if (!parsePositionCode(code).is_known) unknownCodes.add(code);
      });

      if (errors.length) {
        plan.invalidRows.push({
          rowNumber,
          name: body.full_name,
          slug: slugValue,
          errors,
        });
        continue;
      }

      const payload = profilePayload({ ...body, slug: slugValue, position_codes: normalizedCodes });
      payload.replacePositions = mode === "replace";
      payload.positionCodesProvided = true;
      const match = await findStaffIdentityMatch(db, payload, payload.id);
      const action = match ? "update" : "create";
      if (match) plan.existingProfilesToUpdate += 1;
      else plan.newStaffProfiles += 1;

      plan.rows.push({
        rowNumber,
        name: payload.fullName,
        slug: payload.slug,
        action,
        normalizedPositionCodes: normalizedCodes,
        unknownPositionCodes: normalizedCodes.filter((code) => !parsePositionCode(code).is_known),
      });
      plan.payloads.push(payload);
    }

    plan.unknownPositionCodes = [...unknownCodes];
    plan.errorReportCsv = csvErrorReport(plan.invalidRows);
    return plan;
  }

  function csvTemplate() {
    return [
      "name,slug,photo_url,qualifications,email,phone,bio,position_codes,status,sort_order",
      'Mrs. Example Teacher,mrs-example-teacher,,,,,,"class-teacher-6-c",active,10',
      'Mrs. Example Multi Role,mrs-example-multi-role,,,,,,"grade-head-6,class-teacher-6-c,subject-coordinator-middle-science",active,20',
      'Mr. Example AL Teacher,mr-example-al-teacher,,,,,,"class-teacher-12-bio-eng-a",active,30',
    ].join("\n");
  }

  async function pruneSiteDatabaseTeachersNotIn(runner, staffIds) {
    const allowedIds = new Set(staffIds.map((id) => clean(id, 50)).filter(Boolean));
    const [rows] = await runner.query(
      "SELECT content FROM site_database WHERE id = ? LIMIT 1 FOR UPDATE",
      ["main"],
    );
    if (!rows.length) return 0;

    let siteDb;
    try {
      siteDb = JSON.parse(rows[0].content || "{}");
    } catch {
      return 0;
    }
    if (!siteDb || !Array.isArray(siteDb.teachers)) return 0;

    const nextTeachers = siteDb.teachers.filter((teacher) => {
      const rawId = clean(teacher?.id, 50);
      const staffId = clean(teacher?.staffId || teacher?.staff_id, 50);
      const canonicalId = staffId || rawId.split("__")[0];
      return allowedIds.has(canonicalId);
    });
    const removed = siteDb.teachers.length - nextTeachers.length;
    if (removed <= 0) return 0;

    const contentVersion = Date.now();
    const publishedAt = new Date(contentVersion).toISOString();
    await runner.query(
      `
        UPDATE site_database
        SET content = ?, content_version = ?, published_at = ?
        WHERE id = ?
      `,
      [
        JSON.stringify({
          ...siteDb,
          teachers: nextTeachers,
          contentVersion,
          publishedAt,
        }),
        contentVersion,
        publishedAt,
        "main",
      ],
    );
    return removed;
  }

  async function pruneStaffDataNotInCsv(req, staffIds) {
    const ids = [...new Set(staffIds.map((id) => clean(id, 50)).filter(Boolean))];
    if (!ids.length) {
      const error = new Error("CSV sync needs at least one valid staff ID.");
      error.status = 400;
      throw error;
    }

    const placeholders = ids.map(() => "?").join(",");
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [staleProfiles] = await connection.query(
        `SELECT id, user_id, teacher_id, full_name FROM staff_profiles WHERE id NOT IN (${placeholders})`,
        ids,
      );
      const [staleTeachers] = await connection.query(
        `
          SELECT id, staff_id, name
          FROM teachers
          WHERE COALESCE(
            NULLIF(staff_id, ''),
            CASE
              WHEN id LIKE '%__%' THEN SUBSTRING_INDEX(id, '__', 1)
              ELSE id
            END
          ) NOT IN (${placeholders})
        `,
        ids,
      );

      const staleProfileIds = staleProfiles.map((row) => row.id).filter(Boolean);
      const staleTeacherIds = staleTeachers.map((row) => row.id).filter(Boolean);
      const staleTeacherStaffIds = staleTeachers.map((row) => row.staff_id).filter(Boolean);
      const siteRemoved = await pruneSiteDatabaseTeachersNotIn(connection, ids);

      if (staleProfileIds.length) {
        const staleProfilePlaceholders = staleProfileIds.map(() => "?").join(",");
        await connection.query(
          `DELETE FROM staff_positions WHERE staff_id IN (${staleProfilePlaceholders})`,
          staleProfileIds,
        );
        await connection.query(
          `DELETE FROM staff_attendance WHERE staff_id IN (${staleProfilePlaceholders})`,
          staleProfileIds,
        );
        await connection.query(
          `DELETE FROM staff_leave_requests WHERE staff_id IN (${staleProfilePlaceholders})`,
          staleProfileIds,
        );
        await connection.query(
          `DELETE FROM staff_documents WHERE staff_id IN (${staleProfilePlaceholders})`,
          staleProfileIds,
        );
        await connection.query(
          `DELETE FROM staff_profile_photos WHERE staff_id IN (${staleProfilePlaceholders})`,
          staleProfileIds,
        );
        await connection.query(
          `DELETE FROM staff_profiles WHERE id IN (${staleProfilePlaceholders})`,
          staleProfileIds,
        );
      }

      if (staleTeachers.length) {
        const teacherConditions = [];
        const teacherValues = [];
        if (staleTeacherIds.length) {
          teacherConditions.push(`id IN (${staleTeacherIds.map(() => "?").join(",")})`);
          teacherValues.push(...staleTeacherIds);
        }
        if (staleTeacherStaffIds.length) {
          teacherConditions.push(`staff_id IN (${staleTeacherStaffIds.map(() => "?").join(",")})`);
          teacherValues.push(...staleTeacherStaffIds);
        }
        if (teacherConditions.length) {
          await connection.query(
            `DELETE FROM teachers WHERE ${teacherConditions.join(" OR ")}`,
            teacherValues,
          );
        }
      }

      const staleUserIds = staleProfiles.map((row) => row.user_id).filter(Boolean);
      if (staleUserIds.length) {
        await connection.query(
          `UPDATE users SET status = 'Disabled' WHERE id IN (${staleUserIds.map(() => "?").join(",")})`,
          staleUserIds,
        );
      }

      await connection.commit();
      await logStaffAction(req, "staff.csv_pruned", "staff", "csv", {
        keptStaff: ids.length,
        removedProfiles: staleProfileIds.length,
        removedTeachers: staleTeachers.length,
        removedSiteTeachers: siteRemoved,
      });

      return {
        keptStaff: ids.length,
        removedProfiles: staleProfileIds.length,
        removedTeachers: staleTeachers.length,
        removedSiteTeachers: siteRemoved,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  app.get("/api/staff/next-id", staffManagerOnly, async (req, res) => {
    try {
      res.json({ id: await nextStaffId() });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staff", staffManagerOnly, async (req, res) => {
    try {
      res.json(await readProfiles());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staff/me", staffSelfOrManager, async (req, res) => {
    try {
      res.json({ profile: await selfProfile(req) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staff/profile", staffSelfOrManager, async (req, res) => {
    try {
      res.json({ profile: await selfProfile(req) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staff/dashboard", staffManagerOnly, async (req, res) => {
    try {
      res.json(await dashboardPayload());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staff/duplicate-check", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const payload = profilePayload({
        id: req.query.id,
        nic: req.query.nic,
        email: req.query.email,
      });
      const match = await findStaffIdentityMatch(db, payload, payload.id);
      res.json({
        duplicate: Boolean(match && (!payload.id || match.id !== payload.id)),
        match,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staff-position-master", staffManagerOnly, async (req, res) => {
    try {
      res.json(await readPositionMaster());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/staff-position-master", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const payload = positionMasterPayload(req.body || {});
      if (!payload.positionTitle) {
        return res.status(400).json({ error: "Position title is required" });
      }
      const [result] = await db.query(
        `
          INSERT INTO staff_position_master
            (
              position_title, category, department, website_place, description,
              default_staff_type, visible_on_website, status, display_order
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          payload.positionTitle,
          payload.category,
          payload.department,
          payload.websitePlace,
          payload.description || null,
          payload.defaultStaffType,
          payload.visibleOnWebsite ? 1 : 0,
          payload.status,
          payload.displayOrder,
        ],
      );
      await logStaffAction(req, "position.created", "position", result.insertId, {
        positionTitle: payload.positionTitle,
      });
      res.status(201).json({ success: true, id: result.insertId });
    } catch (error) {
      const duplicate = error.code === "ER_DUP_ENTRY";
      res.status(duplicate ? 409 : 500).json({
        error: duplicate ? "This position already exists." : error.message,
      });
    }
  });

  app.put("/api/staff-position-master/:id", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid position id" });
      const payload = positionMasterPayload(req.body || {});
      if (!payload.positionTitle) {
        return res.status(400).json({ error: "Position title is required" });
      }
      const [result] = await db.query(
        `
          UPDATE staff_position_master
          SET
            position_title = ?,
            category = ?,
            department = ?,
            website_place = ?,
            description = ?,
            default_staff_type = ?,
            visible_on_website = ?,
            status = ?,
            display_order = ?
          WHERE id = ?
        `,
        [
          payload.positionTitle,
          payload.category,
          payload.department,
          payload.websitePlace,
          payload.description || null,
          payload.defaultStaffType,
          payload.visibleOnWebsite ? 1 : 0,
          payload.status,
          payload.displayOrder,
          id,
        ],
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: "Position not found" });
      await logStaffAction(req, "position.updated", "position", id, {
        positionTitle: payload.positionTitle,
      });
      res.json({ success: true, id });
    } catch (error) {
      const duplicate = error.code === "ER_DUP_ENTRY";
      res.status(duplicate ? 409 : 500).json({
        error: duplicate ? "This position already exists." : error.message,
      });
    }
  });

  app.delete("/api/staff-position-master/:id", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid position id" });
      const [rows] = await db.query(
        "SELECT position_title FROM staff_position_master WHERE id = ? LIMIT 1",
        [id],
      );
      if (!rows.length) return res.status(404).json({ error: "Position not found" });
      const title = rows[0].position_title || "";
      const [[usage]] = await db.query(
        `
          SELECT COUNT(*) AS total
          FROM staff_positions
          WHERE position_master_id = ?
             OR LOWER(position) = LOWER(?)
        `,
        [id, title],
      );
      if (Number(usage.total || 0) > 0) {
        return res.status(409).json({
          error: `This position is assigned to ${usage.total} staff position record(s). Disable it instead of deleting.`,
        });
      }
      await db.query("DELETE FROM staff_position_master WHERE id = ?", [id]);
      await logStaffAction(req, "position.deleted", "position", id, { positionTitle: title });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staff/import-csv/template", staffManagerOnly, async (req, res) => {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="staff-import-template.csv"');
    res.send(csvTemplate());
  });

  app.post("/api/staff/import-csv/preview", staffManagerOnly, async (req, res) => {
    try {
      const csv = String(req.body?.csv || req.body?.content || "");
      const fileName = clean(req.body?.fileName || req.body?.filename || "", 255);
      if (fileName && !fileName.toLowerCase().endsWith(".csv")) {
        return res.status(400).json({ error: "Only .csv files can be imported." });
      }
      if (Buffer.byteLength(csv, "utf8") > 2 * 1024 * 1024) {
        return res.status(400).json({ error: "CSV file is too large. Limit is 2 MB." });
      }
      const rows = parseCsv(csv);
      if (!rows.length) return res.status(400).json({ error: "CSV file has no importable rows" });
      const plan = await csvRowsToImportPlan(rows, { mode: req.body?.mode || "merge" });
      const { payloads, ...preview } = plan;
      res.json({ success: true, preview });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/staff/import-csv", staffManagerOnly, async (req, res) => {
    try {
      const csv = String(req.body?.csv || req.body?.content || "");
      const fileName = clean(req.body?.fileName || req.body?.filename || "", 255);
      if (fileName && !fileName.toLowerCase().endsWith(".csv")) {
        return res.status(400).json({ error: "Only .csv files can be imported." });
      }
      if (Buffer.byteLength(csv, "utf8") > 2 * 1024 * 1024) {
        return res.status(400).json({ error: "CSV file is too large. Limit is 2 MB." });
      }
      const rows = parseCsv(csv);
      if (!rows.length) return res.status(400).json({ error: "CSV file has no importable rows" });
      const mode = req.body?.mode === "replace" ? "replace" : "merge";
      const syncImport = booleanLike(req.body?.sync || req.query.sync, false);
      const plan = await csvRowsToImportPlan(rows, { mode });

      const results = {
        success: true,
        rows: rows.length,
        profiles: plan.payloads.length,
        created: 0,
        updated: 0,
        skipped: plan.invalidRows.length,
        errors: plan.invalidRows.length,
        removedProfiles: 0,
        removedTeachers: 0,
        removedSiteTeachers: 0,
        unknownPositionCodes: plan.unknownPositionCodes,
        invalidRows: plan.invalidRows,
        duplicateRows: plan.duplicateRows,
        errorReportCsv: plan.errorReportCsv,
        warnings: [],
      };

      const importedIds = [];
      for (const payload of plan.payloads) {
        const result = await saveProfile(req, payload, { isUpdate: false });
        importedIds.push(result.id);
        if (result.created) results.created += 1;
        else results.updated += 1;
        if (result.duplicateWarning) {
          results.warnings.push(result.duplicateWarning);
        }
      }

      if (syncImport) {
        const pruned = await pruneStaffDataNotInCsv(req, importedIds);
        results.removedProfiles = pruned.removedProfiles;
        results.removedTeachers = pruned.removedTeachers;
        results.removedSiteTeachers = pruned.removedSiteTeachers;
        results.keptStaff = pruned.keptStaff;
      }

      res.json(results);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post(
    "/api/staff/profile-photo",
    staffManagerOnly,
    (req, res, next) => {
      const staffId =
        clean(req.query.staff_id || req.query.staffId || req.query.id || "", 50) || "pending";
      const folder = staffProfilePhotoFolder();
      req.query.folder = folder;
      req.staffProfilePhotoUpload = { staffId, folder };
      next();
    },
    handleSingleUpload,
    async (req, res) => {
      try {
        await ensureStaffTables();
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        if (!isProfilePhotoFile(req.file)) {
          await unlinkQuiet(req.file.path);
          return res.status(400).json({ error: "Profile photos must be JPG or PNG images." });
        }

        if (req.file.size > uploadSizeLimit(req.file)) {
          await unlinkQuiet(req.file.path);
          return res.status(400).json({ error: "Profile photo is too large." });
        }

        const { staffId, folder } = req.staffProfilePhotoUpload;
        const stored = await processStaffProfilePhotoUpload(req, req.file, folder);
        const fileUrl = stored.fileUrl;
        const sourceId = mediaSourceId(folder, fileUrl);

        await recordStaffProfilePhoto(req, {
          staffId,
          folder,
          fileUrl,
          fileName: stored.fileName,
          fileSize: stored.fileSize,
          sourceId,
        });
        const savedToProfile = await applyStaffProfilePhoto(db, staffId, fileUrl);
        await logStaffAction(req, "staff.photo_uploaded", "staff", staffId, {
          fileUrl,
          savedToProfile,
        });

        res.json({
          success: true,
          url: fileUrl,
          fileUrl,
          staffId,
          folder,
          savedToProfile,
          file: {
            name: stored.fileName,
            type: "image",
            size: stored.fileSize,
            originalSize: stored.originalSize,
            folder,
          },
        });
      } catch (error) {
        if (req.file?.path) await unlinkQuiet(req.file.path);
        res
          .status(error.status || 500)
          .json({ error: error.message || "Profile photo upload failed." });
      }
    },
  );

  app.get("/api/staff-attendance", attendanceManagerOnly, async (req, res) => {
    try {
      res.json(await staffAttendanceRows(req.query || {}));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/staff-attendance", attendanceManagerOnly, bulkMarkStaffAttendance);
  app.get("/api/staff/attendance", attendanceManagerOnly, async (req, res) => {
    try {
      res.json(await staffAttendanceRows(req.query || {}));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/staff/attendance/bulk-mark", attendanceManagerOnly, bulkMarkStaffAttendance);
  app.get("/api/staff/attendance/today-summary", attendanceManagerOnly, async (req, res) => {
    try {
      const rows = await staffAttendanceRows({ date: new Date().toISOString().slice(0, 10) });
      res.json(attendanceSummary(rows));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/staff/attendance/reports/daily", attendanceManagerOnly, dailyAttendanceReport);
  app.get("/api/staff/attendance/reports/monthly", attendanceManagerOnly, (req, res) =>
    attendanceAggregateReport(req, res, "monthly"),
  );
  app.get("/api/staff/attendance/reports/section", attendanceManagerOnly, (req, res) =>
    attendanceAggregateReport(req, res, "section"),
  );
  app.get("/api/staff/attendance/reports/staff/:staffId", attendanceManagerOnly, (req, res) =>
    attendanceAggregateReport(req, res, "staff"),
  );
  app.get("/api/staff/attendance/export/csv", attendanceManagerOnly, exportAttendanceCsv);

  app.get("/api/staff/:id", staffSelfOrManager, async (req, res) => {
    try {
      const staffId = clean(req.params.id, 50);
      const managerFallbackIds = new Set([
        "",
        "admin",
        "staff",
        "masteradmin",
        "superadmin",
        "staff_admin",
        "undefined",
        "null",
        req.user.id,
        req.user.email,
        req.user.role,
      ]);

      if (staffId === "dashboard" && hasManageAccess(req)) {
        return res.json(await dashboardPayload());
      }
      if (staffId === "next-id" && hasManageAccess(req)) {
        return res.json({ id: await nextStaffId() });
      }
      if (staffId === "me" || staffId === "profile") {
        return res.json({ profile: await selfProfile(req) });
      }

      const profiles = await readProfiles({ staffId });
      const profile = profiles[0] || null;
      if (!profile) {
        if (hasManageAccess(req) && managerFallbackIds.has(staffId)) {
          return res.json(await systemAccountProfile(req));
        }
        return res.status(404).json({ error: "Staff member not found" });
      }
      if (
        !hasManageAccess(req) &&
        profile.user_id !== req.user.id &&
        profile.teacher_id !== req.user.id
      ) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/staff", staffManagerOnly, async (req, res) => {
    try {
      const result = await saveProfile(req, profilePayload(req.body));
      res.status(result.created ? 201 : 200).json({ success: true, ...result });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.put("/api/staff/:id", staffManagerOnly, async (req, res) => {
    try {
      const result = await saveProfile(req, profilePayload({ ...req.body, id: req.params.id }), {
        isUpdate: true,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.delete("/api/staff/:id", staffManagerOnly, async (req, res) => {
    const staffId = clean(req.params.id, 50);
    const connection = await db.getConnection();
    try {
      await ensureStaffTables();
      await connection.beginTransaction();

      const [profiles] = await connection.query(
        "SELECT user_id, teacher_id, full_name FROM staff_profiles WHERE id = ? LIMIT 1",
        [staffId],
      );
      if (!profiles.length) {
        await connection.rollback();
        return res.status(404).json({ error: "Staff member not found" });
      }

      const profile = profiles[0];
      await connection.query("DELETE FROM staff_positions WHERE staff_id = ?", [staffId]);
      await connection.query("DELETE FROM staff_profiles WHERE id = ?", [staffId]);
      await connection.query("DELETE FROM teachers WHERE staff_id = ? OR id = ?", [
        staffId,
        staffId,
      ]);
      await removeTeacherFromSiteDatabaseContent(connection, staffId);
      if (profile.teacher_id && profile.teacher_id !== staffId) {
        await connection.query("DELETE FROM teachers WHERE id = ?", [profile.teacher_id]);
        await removeTeacherFromSiteDatabaseContent(connection, profile.teacher_id);
      }
      if (profile.user_id) {
        await connection.query("UPDATE users SET status = 'Disabled' WHERE id = ?", [
          profile.user_id,
        ]);
      }

      await connection.commit();
      await logStaffAction(req, "staff.deleted", "staff", staffId, {
        fullName: profile.full_name,
      });
      res.json({ success: true });
    } catch (error) {
      await connection.rollback();
      res.status(500).json({ error: error.message });
    } finally {
      connection.release();
    }
  });

  app.delete("/api/staff-accounts/:id", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const accountId = clean(req.params.id, 50);
      const [result] = await db.query(
        "UPDATE users SET status = 'Disabled' WHERE id = ? AND role = 'teacher'",
        [accountId],
      );
      await db.query("UPDATE staff_profiles SET user_id = NULL WHERE user_id = ?", [accountId]);
      await db.query(
        "UPDATE teachers SET account_user_id = NULL, account_email = NULL WHERE account_user_id = ?",
        [accountId],
      );
      await logStaffAction(req, "account.disabled", "user", accountId);
      res.json({ success: true, disabled: result.affectedRows > 0 });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staff-leave", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const [rows] = await db.query(`
        SELECT l.*, sp.full_name, sp.department, sp.position
        FROM staff_leave_requests l
        LEFT JOIN staff_profiles sp ON sp.id = l.staff_id
        ORDER BY
          CASE l.status WHEN 'Pending' THEN 1 WHEN 'Approved' THEN 2 WHEN 'Rejected' THEN 3 ELSE 4 END,
          l.created_at DESC
        LIMIT 500
      `);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/staff-leave", staffSelfOrManager, async (req, res) => {
    try {
      await ensureStaffTables();
      const staffId = clean(req.body.staff_id || req.body.staffId, 50);
      const leaveType = clean(req.body.leave_type || req.body.leaveType || "Casual", 80);
      const startDate = normalizeDate(req.body.start_date || req.body.startDate);
      const endDate = normalizeDate(req.body.end_date || req.body.endDate);
      if (!staffId || !startDate || !endDate) {
        return res.status(400).json({ error: "staff_id, start_date and end_date are required" });
      }

      if (!hasManageAccess(req)) {
        const profiles = await readProfiles({ staffId });
        const profile = profiles[0];
        if (!profile || (profile.user_id !== req.user.id && profile.teacher_id !== req.user.id)) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const [result] = await db.query(
        `
          INSERT INTO staff_leave_requests
            (staff_id, leave_type, start_date, end_date, reason, status)
          VALUES (?, ?, ?, ?, ?, 'Pending')
        `,
        [staffId, leaveType, startDate, endDate, cleanNullable(req.body.reason, 2000)],
      );
      await logStaffAction(req, "leave.created", "leave", result.insertId, { staffId });
      res.status(201).json({ success: true, id: result.insertId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/staff-leave/:id/status", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const status = clean(req.body.status, 40);
      if (!["Approved", "Rejected", "Pending"].includes(status)) {
        return res.status(400).json({ error: "Invalid leave status" });
      }
      const [result] = await db.query(
        `
          UPDATE staff_leave_requests
          SET status = ?, reviewed_by = ?, review_note = ?
          WHERE id = ?
        `,
        [
          status,
          actorId(req),
          cleanNullable(req.body.review_note || req.body.reviewNote, 1000),
          req.params.id,
        ],
      );
      if (result.affectedRows === 0)
        return res.status(404).json({ error: "Leave request not found" });
      await logStaffAction(req, `leave.${status.toLowerCase()}`, "leave", req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staff-documents", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const [rows] = await db.query(`
        SELECT d.*, sp.full_name
        FROM staff_documents d
        LEFT JOIN staff_profiles sp ON sp.id = d.staff_id
        ORDER BY d.created_at DESC
        LIMIT 500
      `);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/staff-documents", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const staffId = clean(req.body.staff_id || req.body.staffId, 50);
      const title = clean(req.body.title, 255);
      const fileUrl = clean(req.body.file_url || req.body.fileUrl, 2048);
      if (!staffId || !title || !fileUrl) {
        return res.status(400).json({ error: "staff_id, title and file_url are required" });
      }
      const [result] = await db.query(
        `
          INSERT INTO staff_documents
            (staff_id, title, file_url, document_type, uploaded_by)
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          staffId,
          title,
          fileUrl,
          cleanNullable(req.body.document_type || req.body.documentType, 100),
          actorId(req),
        ],
      );
      await logStaffAction(req, "document.uploaded", "document", result.insertId, {
        staffId,
        title,
      });
      res.status(201).json({ success: true, id: result.insertId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/staff-documents/:id", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const [result] = await db.query("DELETE FROM staff_documents WHERE id = ?", [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: "Document not found" });
      await logStaffAction(req, "document.deleted", "document", req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staff-notices", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const [rows] = await db.query(
        "SELECT * FROM staff_notices ORDER BY created_at DESC LIMIT 200",
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/staff-notices", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const title = clean(req.body.title, 255);
      if (!title) return res.status(400).json({ error: "Notice title is required" });
      const [result] = await db.query(
        `
          INSERT INTO staff_notices
            (title, body, audience, priority, status, created_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          title,
          cleanNullable(req.body.body, 3000),
          clean(req.body.audience || "All staff", 100),
          clean(req.body.priority || "Normal", 40),
          clean(req.body.status || "Published", 40),
          actorId(req),
        ],
      );
      await logStaffAction(req, "notice.created", "notice", result.insertId, { title });
      res.status(201).json({ success: true, id: result.insertId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/staff-notices/:id", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const [result] = await db.query("DELETE FROM staff_notices WHERE id = ?", [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: "Notice not found" });
      await logStaffAction(req, "notice.deleted", "notice", req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staff-audit", staffManagerOnly, async (req, res) => {
    try {
      await ensureStaffTables();
      const [rows] = await db.query(
        "SELECT id, actor_user_id, action, target_type, target_id, details, created_at FROM staff_audit_logs ORDER BY created_at DESC LIMIT 300",
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = {
  registerStaffRoutes,
};
