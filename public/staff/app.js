(function () {
  const app = document.getElementById("app");
  const managerRoles = new Set(["masteradmin", "superadmin", "staff_admin"]);

  const state = {
    user: null,
    view: "dashboard",
    staff: [],
    dashboard: {},
    attendance: [],
    leave: [],
    documents: [],
    notices: [],
    audit: [],
    positionMaster: [],
    nextId: "",
    editingId: "",
    editingPositionId: "",
    filters: {
      search: "",
      type: "All",
      status: "All",
      date: new Date().toISOString().slice(0, 10),
      attendanceSection: "All Sections",
      attendanceStaffType: "All",
      attendanceSearch: "",
    },
    positionFilters: {
      search: "",
      category: "All",
      department: "All",
      websitePlace: "All",
      status: "All",
    },
    csvImport: {
      fileName: "",
      csv: "",
      mode: "merge",
      preview: null,
    },
  };

  const staffTypes = ["Academic Staff", "Non-Academic Staff", "Supportive Staff"];
  const statuses = ["Active", "Inactive", "On Leave", "Suspended"];
  const departments = [
    "Administration",
    "Primary School",
    "Middle School",
    "Upper School",
    "Advanced Level",
    "Academic Department",
    "Financial Department",
    "IT Department",
    "Office",
    "Library",
    "Maintenance",
    "Supportive Staff",
  ];
  const defaultPositionTitles = [
    "Rector / Principal",
    "Vice Principal",
    "Sectional Head",
    "Grade Head",
    "Stream Head",
    "Subject Coordinator",
    "Coordinator",
    "Class Teacher",
    "Subject Teacher",
    "Counsellor",
    "Librarian",
    "Accountant",
    "Manager - IT",
    "Administrative Secretary",
    "Office Assistant",
    "Maintenance Supervisor",
    "Supportive Staff Member",
    "Other",
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
  const positionWebsitePlaces = [
    ...websitePlaces,
    "All Teachers Directory only",
    "Hidden from Website",
  ];

  const modules = [
    ["dashboard", "Dashboard", "Overview and alerts"],
    ["profiles", "Staff Profiles", "Staff master records"],
    ["form", "New Staff", "Create profile"],
    ["positions", "Position Settings", "Position master"],
    ["attendance", "Attendance", "Daily marking"],
    ["leave", "Leave Requests", "Approvals"],
    ["documents", "Documents", "Staff files"],
    ["notices", "Notices", "Internal updates"],
    ["roles", "Roles", "Access model"],
    ["audit", "Audit History", "System activity"],
  ];

  const moduleIcons = {
    dashboard: "grid",
    profiles: "users",
    form: "plus",
    positions: "grid",
    attendance: "calendar",
    leave: "clock",
    documents: "file",
    notices: "bell",
    roles: "shield",
    audit: "activity",
  };

  const attendanceStatuses = [
    ["Present", "P", "Present"],
    ["Absent", "A", "Absent"],
    ["Duty Leave", "DL", "Duty Leave"],
    ["Maternity Leave", "ML", "Maternity Leave"],
    ["Short Leave", "SL", "Short Leave"],
    ["Half Day", "HD", "Half Day"],
    ["Leave Approved", "LA", "Leave Approved"],
    ["Informed", "I", "Informed"],
    ["Late to Come", "LT", "Late to Come"],
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

  const viewSubtitles = {
    dashboard: "Today's HR overview and operational workload.",
    profiles: "Search, filter, maintain, and export staff master records.",
    form: "Create or update staff profiles and linked portal accounts.",
    positions: "Create, organize, disable, and delete reusable staff positions.",
    attendance: "Mark daily attendance and review the day's register.",
    leave: "Create, approve, and reject staff leave requests.",
    documents: "Upload and manage staff documents.",
    notices: "Publish internal notices for staff teams.",
    roles: "Reference access levels for staff system users.",
    audit: "Review the latest staff system activity.",
  };

  const iconPaths = {
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4" />',
    arrow: '<path d="M5 12h14" /><path d="m13 6 6 6-6 6" />',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" />',
    calendar:
      '<path d="M8 3v4" /><path d="M16 3v4" /><path d="M4 9h16" /><rect x="4" y="5" width="16" height="16" rx="2" />',
    clock: '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />',
    download: '<path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" />',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />',
    plus: '<path d="M12 5v14" /><path d="M5 12h14" />',
    refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v6h-6" />',
    search: '<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />',
    shield: '<path d="M12 3 5 6v6c0 4.5 2.8 7.4 7 9 4.2-1.6 7-4.5 7-9V6z" />',
    trash: '<path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 15h10l1-15" />',
    users:
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />',
  };

  function icon(name) {
    const path = iconPaths[name] || iconPaths.grid;
    return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  }

  function token() {
    return localStorage.getItem("loyola_token") || "";
  }

  function isManager() {
    return managerRoles.has(state.user?.role);
  }

  function headers(extra = {}) {
    return {
      Authorization: `Bearer ${token()}`,
      ...extra,
    };
  }

  async function api(path, options = {}) {
    const isForm = options.body instanceof FormData;
    const response = await fetch(path, {
      ...options,
      headers: headers({
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
      }),
      cache: "no-store",
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(
        (data && data.error) || `Request failed with status ${response.status}`,
      );
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function roleLabel(role) {
    return String(role || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function initials(name) {
    return String(name || "Staff")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }

  function avatar(person) {
    const image = person.photo_url || person.profile_image || person.image;
    const fallback = esc(initials(person.full_name || person.name));
    if (image) {
      return `<span class="avatar"><img src="${esc(image)}" alt="" onerror="this.parentElement.textContent='${fallback}'" /></span>`;
    }
    return `<span class="avatar">${fallback}</span>`;
  }

  function selected(current, value) {
    return current === value ? "selected" : "";
  }

  function optionList(items, current) {
    return uniqueOptions(items, current)
      .map((item) => `<option ${selected(current, item)}>${esc(item)}</option>`)
      .join("");
  }

  function uniqueOptions(items, current = "") {
    const seen = new Set();
    return [current, ...items]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function activePositionMaster(currentTitle = "", currentId = "", includeCurrent = false) {
    return [...state.positionMaster]
      .filter((item) => {
        const sameId = currentId && String(item.id) === String(currentId);
        const sameTitle = currentTitle && item.position_title === currentTitle;
        return item.status === "Active" || sameId || (includeCurrent && sameTitle);
      })
      .sort((a, b) => {
        const order =
          Number(a.display_order || a.displayOrder || 0) -
          Number(b.display_order || b.displayOrder || 0);
        return (
          order || String(a.position_title || "").localeCompare(String(b.position_title || ""))
        );
      });
  }

  function positionOptionList(currentTitle = "", currentId = "", includeCurrent = false) {
    const master = activePositionMaster(currentTitle, currentId, includeCurrent);
    const options = master.map((item) => {
      const title = item.position_title || item.positionTitle || "";
      const label = item.category ? `${title} - ${item.category}` : title;
      return `<option value="${esc(title)}" data-position-id="${esc(item.id)}" ${selected(String(currentId || ""), String(item.id)) || selected(currentTitle, title)}>${esc(label)}</option>`;
    });
    const usedTitles = new Set(
      master.map((item) => String(item.position_title || item.positionTitle || "").toLowerCase()),
    );
    const fallbackTitles = state.positionMaster.length
      ? includeCurrent
        ? [currentTitle]
        : []
      : defaultPositionTitles;
    uniqueOptions(fallbackTitles, includeCurrent ? currentTitle : "")
      .filter((title) => title && !usedTitles.has(title.toLowerCase()))
      .forEach((title) => {
        options.push(
          `<option value="${esc(title)}" ${selected(currentTitle, title)}>${esc(title)}</option>`,
        );
      });
    return options.join("");
  }

  function positionMasterBySelection(select) {
    const selectedOption = select?.selectedOptions?.[0];
    const id = selectedOption?.dataset.positionId || "";
    if (id) return state.positionMaster.find((item) => String(item.id) === String(id)) || null;
    const title = select?.value || "";
    return (
      activePositionMaster(title).find(
        (item) => item.position_title === title || item.positionTitle === title,
      ) || null
    );
  }

  function selectedPositionMasterId(select) {
    const master = positionMasterBySelection(select);
    return master?.id || "";
  }

  function statusClass(value) {
    return String(value || "Active")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function loginAccountHtml(person = {}) {
    const hasLogin = Boolean(person.user_id || person.account_status || person.account_email);
    if (!hasLogin) {
      return `
        <span class="status inactive">Not Created</span>
        <small>No portal login</small>
      `;
    }
    const accountStatus = person.account_status || "Active";
    return `
      <span class="status ${esc(statusClass(accountStatus))}">Created</span>
      <small>${esc(accountStatus)}${person.user_id ? ` / ${esc(person.user_id)}` : ""}</small>
    `;
  }

  function staffDisplayId(person = {}) {
    return person.id || person.teacher_id || person.user_id || "";
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

  const autoSortClassOrder = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const autoSortStreamOrder = ["maths", "bio", "commerce", "arts", "technology"];
  const autoSortMediumOrder = ["sin", "eng"];
  const autoSortFixedCodes = [
    "rector-principal",
    "vice-rector",
    "principal-primary",
    "priest-in-charge-middle-upper",
    "sectional-head-upper",
    "vice-principal-advanced-level",
    "vice-principal-primary",
    "vice-principal-middle",
    "vice-principal-upper",
    "assistant-sectional-head-primary",
    "assistant-sectional-head-middle",
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
    "subject-coordinator-middle-roman-catholicism",
    "subject-coordinator-middle-health-science-physical-education",
    "subject-coordinator-middle-practical-technical-skills",
    "subject-coordinator-upper-sinhala",
    "subject-coordinator-upper-mathematics",
    "subject-coordinator-upper-science",
    "subject-coordinator-upper-english",
    "subject-coordinator-upper-history-geography-civics",
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
      autoSortClassOrder.map((letter) => `class-teacher-${gradeIndex + 1}-${letter}`),
    ).flat(),
    ...Array.from({ length: 3 }, (_, gradeIndex) =>
      autoSortClassOrder.map((letter) => `class-teacher-${gradeIndex + 6}-${letter}`),
    ).flat(),
    ...Array.from({ length: 3 }, (_, gradeIndex) =>
      autoSortClassOrder.map((letter) => `class-teacher-${gradeIndex + 9}-${letter}`),
    ).flat(),
    ...[12, 13].flatMap((grade) =>
      autoSortStreamOrder.flatMap((stream) =>
        autoSortMediumOrder.flatMap((medium) =>
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
  const autoSortCodeOrder = new Map(
    autoSortFixedCodes.map((code, index) => [code, (index + 1) * 1000]),
  );

  function profileSlugFromName(value) {
    return String(value || "")
      .slice(0, 150)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function autoSortOrderFromPositionCodes(input) {
    const primaryCode = normalizePositionCodes(input)[0];
    return primaryCode ? autoSortCodeOrder.get(primaryCode) || 0 : 0;
  }

  function positionCodesForProfile(person = {}) {
    const profile = person || {};
    const explicit = profile.position_codes || profile.positionCodes;
    const fromExplicit = normalizePositionCodes(explicit);
    if (fromExplicit.length) return fromExplicit;
    return normalizePositionCodes(
      (profile.positions || [])
        .map((position) => position.position_code || position.positionCode)
        .filter(Boolean),
    );
  }

  function positionCodesText(person = {}) {
    return positionCodesForProfile(person).join("\n");
  }

  function positionBadgesHtml(person = {}) {
    const codes = positionCodesForProfile(person);
    if (!codes.length) return `<span class="muted">No position codes</span>`;
    return `<div class="code-badges">${codes
      .map((code) => `<span class="code-badge">${esc(code)}</span>`)
      .join("")}</div>`;
  }

  function isWebsitePositionVisible(position = {}) {
    const place = position.website_place || position.websitePlace || "";
    return (
      place !== "Hidden from Website" &&
      position.visible_on_website !== false &&
      position.visibleOnWebsite !== false
    );
  }

  function websitePositionHtml(person = {}) {
    const profile = person || {};
    const positions = staffPositions(profile);
    const primary = positions.find((position) => position.is_primary) || positions[0] || {};
    const place =
      primary.website_place ||
      primary.websitePlace ||
      profile.website_place ||
      profile.category ||
      "-";
    const visible = isWebsitePositionVisible(primary);
    const visibleCount = positions.filter(isWebsitePositionVisible).length;
    const hiddenCount = Math.max(0, positions.length - visibleCount);
    const summary =
      positions.length > 1
        ? `${visibleCount} show / ${hiddenCount} hidden`
        : primary.position || profile.position || "";

    return `
      <div class="website-position-cell">
        <strong>${esc(place || "-")}</strong>
        <span class="status ${visible ? "active" : "inactive"}">${visible ? "Show" : "Hidden"}</span>
        ${summary ? `<small>${esc(summary)}</small>` : ""}
      </div>
    `;
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

  function autoWebsitePlace(position, type, department = "") {
    const context = `${position || ""} ${type || ""} ${department || ""}`;
    if (/Assistant Sectional Head/i.test(position)) return "Assistant Sectional Heads";
    if (
      /Rector|Principal|Archbishop|General Manager|Vice Rector|Vice Principal|Prefect|Priest in Charge|Sectional Head/i.test(
        position,
      )
    )
      return "College Administration";
    if (/Subject Head/i.test(position)) return "Subject Heads";
    if (/Grade Head/i.test(position)) return "Grade Heads";
    if (/Stream Head|A\/L/i.test(position)) return "Advanced Level Stream Heads";
    if (/English Medium/i.test(position)) return "English Medium Coordinators";
    if (/Coordinator/i.test(position))
      return sectionedWebsitePlace("Subject Coordinators", context);
    if (/Class Teacher/i.test(position)) return sectionedWebsitePlace("Class Teachers", context);
    if (/Special Need|Resource/i.test(position)) return "Special Need Resource Unit";
    if (/Visiting/i.test(position)) return "Visiting Teachers";
    if (/Counsellor|Counselor/i.test(position)) return "Counsellor";
    if (/Subject Teacher/i.test(position))
      return sectionedWebsitePlace("Subject Teachers", context);
    if (type === "Supportive Staff") return "Supportive Staff";
    if (/Account|Financial/i.test(position)) return "Financial Department";
    if (/\bIT\b|Technology/i.test(position)) return "IT Department";
    if (/Library|Librarian|Nursing|Health/i.test(position)) return "Health & Library Services";
    if (/Maintenance/i.test(position)) return "Maintenance Department";
    if (type === "Non-Academic Staff" || /Secretary|Office|Bookstore|Reception/i.test(position)) {
      return "Administrative Department";
    }
    return sectionedWebsitePlace("Subject Teachers", context);
  }

  async function loadCore() {
    const [staff, dashboard, positionMaster] = await Promise.all([
      api("/api/staff"),
      api("/api/staff/dashboard"),
      api("/api/staff-position-master"),
    ]);
    state.staff = Array.isArray(staff) ? staff : [];
    state.dashboard = dashboard || {};
    state.positionMaster = Array.isArray(positionMaster) ? positionMaster : [];
  }

  async function loadNextId() {
    try {
      const result = await api("/api/staff/next-id");
      state.nextId = result.id || "";
    } catch {
      state.nextId = "";
    }
  }

  async function loadViewData(view) {
    if (view === "attendance") {
      const params = new URLSearchParams({
        date: state.filters.date || today(),
        section: state.filters.attendanceSection || "All Sections",
        staff_type: state.filters.attendanceStaffType || "All",
        search: state.filters.attendanceSearch || "",
      });
      state.attendance = await api(`/api/staff/attendance?${params.toString()}`);
    }
    if (view === "leave") state.leave = await api("/api/staff-leave");
    if (view === "documents") state.documents = await api("/api/staff-documents");
    if (view === "notices") state.notices = await api("/api/staff-notices");
    if (view === "audit") state.audit = await api("/api/staff-audit");
  }

  function setNotice(message, type = "") {
    const notice = document.getElementById("notice");
    if (!notice) return;
    notice.className = `notice ${type} show`;
    notice.textContent = message;
    clearTimeout(setNotice.timer);
    setNotice.timer = setTimeout(() => {
      notice.className = "notice";
      notice.textContent = "";
    }, 4200);
  }

  async function setView(view, options = {}) {
    state.view = view;
    if (view !== "form" || options.newRecord) state.editingId = "";
    if (view === "form" && options.editingId) state.editingId = options.editingId;
    if (view !== "positions") state.editingPositionId = "";
    if (view === "form" && !state.editingId) await loadNextId();
    await loadViewData(view).catch((error) => setNotice(error.message, "error"));
    history.replaceState(null, "", `#${view}`);
    renderShell();
  }

  function filteredStaff() {
    return state.staff.filter((person) => {
      const haystack = [
        person.id,
        person.full_name,
        person.email,
        person.phone,
        person.nic,
        person.staff_type,
        person.department,
        person.position,
        person.slug,
        person.bio,
        positionCodesForProfile(person).join(" "),
        (person.positions || [])
          .map((position) =>
            [
              position.position_code || position.positionCode,
              position.display_title || position.displayTitle,
              position.main_category || position.mainCategory,
              position.section,
              position.subsection,
              position.department,
              position.position,
              position.website_place || position.websitePlace,
              position.subject,
              position.classes,
            ].join(" "),
          )
          .join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (state.filters.search && !haystack.includes(state.filters.search.toLowerCase()))
        return false;
      if (state.filters.type !== "All" && person.staff_type !== state.filters.type) return false;
      if (state.filters.status !== "All" && person.status !== state.filters.status) return false;
      return true;
    });
  }

  function panel(title, subtitle, body, action = "") {
    return `
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>${esc(title)}</h2>
            ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
          </div>
          ${action}
        </div>
        ${body}
      </section>
    `;
  }

  function metric(label, value, tone = "", iconName = "grid", helper = "") {
    return `
      <article class="metric ${tone}">
        <div class="metric-head">
          <span class="metric-icon">${icon(iconName)}</span>
          <span>${esc(label)}</span>
        </div>
        <strong>${esc(value)}</strong>
        ${helper ? `<small>${esc(helper)}</small>` : ""}
      </article>
    `;
  }

  function dashboardHtml() {
    const d = state.dashboard || {};
    const recent = d.recentStaff || state.staff.slice(0, 6);
    return `
      <div class="hero-band">
        <div>
          <p class="eyebrow">Staff Operations</p>
          <h2>Professional staff control center</h2>
          <p>Today's staff overview for HR, attendance, documents, and internal notices.</p>
        </div>
        <button class="button gold" type="button" data-action="new-staff">${icon("plus")} Add Staff</button>
      </div>
      <div class="metric-grid">
        ${metric("Total Staff", d.total || state.staff.length, "", "users", "Master profile count")}
        ${metric("Active Staff", d.active || 0, "success", "shield", "Currently active")}
        ${metric("Marked Today", d.attendanceToday || 0, "", "calendar", "Attendance entries")}
        ${metric("Pending Leave", d.pendingLeave || 0, "warning", "clock", "Awaiting review")}
        ${metric("Documents", d.documents || 0, "", "file", "Stored files")}
      </div>
      <div class="split-grid">
        ${panel(
          "Recently Added",
          "Latest staff records",
          `<div class="row-list">${
            recent.length
              ? recent
                  .map(
                    (person) => `
                      <button class="profile-row" data-edit="${esc(person.id)}">
                        ${avatar(person)}
                        <span>
                          <strong>${esc(person.full_name)}</strong>
                          <small>${esc(person.position || person.department || "Staff")}</small>
                        </span>
                        <em class="status ${esc(statusClass(person.status))}">${esc(person.status || "Active")}</em>
                      </button>
                    `,
                  )
                  .join("")
              : `<div class="empty">No staff records yet.</div>`
          }</div>`,
        )}
        ${panel(
          "Status Summary",
          "Current HR state",
          `<div class="summary-list">
            ${["Active", "Inactive", "On Leave", "Suspended"]
              .map(
                (status) => `
                  <div>
                    <span>${esc(status)}</span>
                    <strong>${state.staff.filter((person) => person.status === status).length}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>`,
        )}
      </div>
    `;
  }

  function csvImportPreviewHtml() {
    const preview = state.csvImport.preview;
    if (!preview) return "";
    const invalid = preview.invalidRows || [];
    const unknown = preview.unknownPositionCodes || [];
    return panel(
      "CSV Import Preview",
      `${preview.totalRows || 0} rows scanned`,
      `
        <div class="import-preview">
          <div class="summary-list import-summary">
            <div><span>New staff profiles</span><strong>${esc(preview.newStaffProfiles || 0)}</strong></div>
            <div><span>Existing profiles to update</span><strong>${esc(preview.existingProfilesToUpdate || 0)}</strong></div>
            <div><span>Duplicate rows</span><strong>${esc((preview.duplicateRows || []).length)}</strong></div>
            <div><span>Invalid rows</span><strong>${esc(invalid.length)}</strong></div>
          </div>
          <div class="import-mode">
            <label class="check">
              <input type="radio" name="import-mode" value="merge" ${state.csvImport.mode !== "replace" ? "checked" : ""} />
              <span>Merge with existing position codes</span>
            </label>
            <label class="check">
              <input type="radio" name="import-mode" value="replace" ${state.csvImport.mode === "replace" ? "checked" : ""} />
              <span>Replace existing position codes</span>
            </label>
          </div>
          ${
            unknown.length
              ? `<p class="inline-warning">Unknown codes will import and appear under Uncategorized Staff: ${unknown
                  .map(esc)
                  .join(", ")}</p>`
              : ""
          }
          ${
            invalid.length
              ? `<div class="error-list">${invalid
                  .slice(0, 5)
                  .map(
                    (row) =>
                      `<div>Row ${esc(row.rowNumber)}: ${esc((row.errors || []).join(", "))}</div>`,
                  )
                  .join("")}</div>`
              : ""
          }
          <div class="form-actions">
            <button class="button ghost" type="button" data-action="cancel-import">Cancel Import</button>
            ${
              invalid.length
                ? `<button class="button ghost" type="button" data-action="download-error-report">${icon("download")} Error Report</button>`
                : ""
            }
            <button class="button primary" type="button" data-action="confirm-import">${icon("plus")} Confirm Import</button>
          </div>
        </div>
      `,
    );
  }

  function profilesResultsHtml() {
    const rows = filteredStaff();
    return panel(
      "Staff Profiles",
      `${rows.length} record${rows.length === 1 ? "" : "s"} visible`,
      `<div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Email</th>
              <th>Website Position</th>
              <th>Status</th>
              <th>Login Account</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      (person) => `
                        <tr>
                          <td>
                            <div class="identity">
                              ${avatar(person)}
                              <span>
                                <strong>${esc(person.full_name)}</strong>
                                <small>Staff ID ${esc(staffDisplayId(person))}</small>
                              </span>
                            </div>
                          </td>
                          <td data-label="Email">
                            <strong>${esc(person.email || person.account_email || "-")}</strong>
                          </td>
                          <td data-label="Website Position">${websitePositionHtml(person)}</td>
                          <td data-label="Status"><span class="status ${esc(statusClass(person.status))}">${esc(person.status || "Active")}</span></td>
                          <td data-label="Login Account">${loginAccountHtml(person)}</td>
                          <td class="right">
                            <button class="icon-button" title="Edit staff" data-edit="${esc(person.id)}">${icon("file")} Edit</button>
                            <button class="icon-button danger" title="Delete staff" data-delete="${esc(person.id)}">${icon("trash")} Delete</button>
                          </td>
                        </tr>
                      `,
                    )
                    .join("")
                : `<tr><td colspan="6"><div class="empty">No staff match your filters.</div></td></tr>`
            }
          </tbody>
        </table>
      </div>`,
    );
  }

  function profilesHtml() {
    return `
      <div class="module-toolbar">
        <div class="filter-grid">
          <label class="field compact search-field">
            <span>Search</span>
            <span class="input-icon">${icon("search")}</span>
            <input id="filter-search" value="${esc(state.filters.search)}" placeholder="Search name, ID, NIC, position" />
          </label>
          <label class="field compact">
            <span>Type</span>
            <select id="filter-type">${optionList(["All", ...staffTypes], state.filters.type)}</select>
          </label>
          <label class="field compact">
            <span>Status</span>
            <select id="filter-status">${optionList(["All", ...statuses], state.filters.status)}</select>
          </label>
        </div>
        <div class="toolbar-actions">
          <button class="button ghost" type="button" data-action="download-template">${icon("download")} Download CSV Template</button>
          <label class="button ghost import-button">${icon("download")} Import Staff CSV<input id="import-csv-file" type="file" accept=".csv,text/csv" /></label>
          <button class="button" type="button" data-action="export">${icon("download")} Export CSV</button>
          <button class="button gold" type="button" data-action="new-staff">${icon("plus")} Add Staff</button>
        </div>
      </div>
      ${csvImportPreviewHtml()}
      <div id="profiles-results">${profilesResultsHtml()}</div>
    `;
  }

  function filteredPositionMaster() {
    const filters = state.positionFilters;
    return state.positionMaster.filter((position) => {
      const haystack = [
        position.position_title,
        position.category,
        position.department,
        position.website_place,
        position.default_staff_type,
        position.description,
      ]
        .join(" ")
        .toLowerCase();
      if (filters.search && !haystack.includes(filters.search.toLowerCase())) return false;
      if (filters.category !== "All" && position.category !== filters.category) return false;
      if (filters.department !== "All" && position.department !== filters.department) return false;
      if (filters.websitePlace !== "All" && position.website_place !== filters.websitePlace)
        return false;
      if (filters.status !== "All" && position.status !== filters.status) return false;
      return true;
    });
  }

  function positionSettingsHtml() {
    const filters = state.positionFilters;
    const rows = filteredPositionMaster();
    const editing = state.editingPositionId
      ? state.positionMaster.find((item) => String(item.id) === String(state.editingPositionId))
      : null;
    const categoryOptions = uniqueOptions(
      [...positionCategories, ...state.positionMaster.map((item) => item.category)],
      editing?.category || "",
    );
    const departmentOptions = uniqueOptions(
      [...departments, ...state.positionMaster.map((item) => item.department)],
      editing?.department || "",
    );
    const filterCategories = uniqueOptions(
      ["All", ...positionCategories, ...state.positionMaster.map((item) => item.category)],
      filters.category,
    );
    const filterDepartments = uniqueOptions(
      ["All", ...departments, ...state.positionMaster.map((item) => item.department)],
      filters.department,
    );
    const filterPlaces = uniqueOptions(["All", ...positionWebsitePlaces], filters.websitePlace);

    return `
      <div class="module-toolbar position-toolbar">
        <div class="filter-grid position-filter-grid">
          <label class="field compact search-field">
            <span>Search</span>
            <span class="input-icon">${icon("search")}</span>
            <input id="position-filter-search" value="${esc(filters.search)}" placeholder="Search title, category, department" />
          </label>
          <label class="field compact">
            <span>Category</span>
            <select id="position-filter-category">${optionList(filterCategories, filters.category)}</select>
          </label>
          <label class="field compact">
            <span>Department</span>
            <select id="position-filter-department">${optionList(filterDepartments, filters.department)}</select>
          </label>
          <label class="field compact">
            <span>Website Place</span>
            <select id="position-filter-place">${optionList(filterPlaces, filters.websitePlace)}</select>
          </label>
          <label class="field compact">
            <span>Status</span>
            <select id="position-filter-status">${optionList(["All", "Active", "Disabled"], filters.status)}</select>
          </label>
        </div>
      </div>
      <div class="split-grid wide-right">
        ${panel(
          editing ? "Edit Position" : "Add New Position",
          "Disabled positions remain safe for already assigned staff but do not appear for new selections.",
          `
            <form id="position-master-form" class="compact-form position-master-form">
              <label class="field">
                <span>Position Title</span>
                <input name="position_title" value="${esc(editing?.position_title || "")}" required placeholder="Example: Discipline Coordinator" />
              </label>
              <label class="field">
                <span>Category</span>
                <input name="category" list="position-category-options" value="${esc(editing?.category || "Subject Teachers")}" required />
                <datalist id="position-category-options">
                  ${categoryOptions.map((item) => `<option value="${esc(item)}"></option>`).join("")}
                </datalist>
              </label>
              <label class="field">
                <span>Department</span>
                <select name="department">${optionList(departmentOptions, editing?.department || "Academic Department")}</select>
              </label>
              <label class="field">
                <span>Website Place</span>
                <select name="website_place">${optionList(positionWebsitePlaces, editing?.website_place || "Subject Teachers")}</select>
              </label>
              <label class="field">
                <span>Default Staff Type</span>
                <select name="default_staff_type">${optionList(staffTypes, editing?.default_staff_type || "Academic Staff")}</select>
              </label>
              <label class="field">
                <span>Display Order</span>
                <input name="display_order" type="number" step="1" value="${esc(editing?.display_order ?? state.positionMaster.length + 1)}" />
              </label>
              <label class="field">
                <span>Status</span>
                <select name="status">${optionList(["Active", "Disabled"], editing?.status || "Active")}</select>
              </label>
              <label class="check">
                <input name="visible_on_website" type="checkbox" ${(editing?.visible_on_website ?? true) ? "checked" : ""} />
                <span>Visible on website by default</span>
              </label>
              <label class="field">
                <span>Description</span>
                <textarea name="description" placeholder="Optional internal note">${esc(editing?.description || "")}</textarea>
              </label>
              <div class="form-actions">
                ${editing ? `<button class="button ghost" type="button" data-action="cancel-position-edit">Cancel Edit</button>` : ""}
                <button class="button primary" type="submit">${editing ? "Update Position" : "Add Position"}</button>
              </div>
            </form>
          `,
        )}
        ${panel(
          "Position Master",
          `${rows.length} position${rows.length === 1 ? "" : "s"} visible`,
          `<div class="table-wrap">
            <table class="data-table positions-table">
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Website Place</th>
                  <th>Staff Type</th>
                  <th>Website</th>
                  <th>Status</th>
                  <th>Order</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows.length
                    ? rows
                        .map(
                          (position) => `
                            <tr>
                              <td data-label="Position"><strong>${esc(position.position_title)}</strong><small>${esc(position.description || "")}</small></td>
                              <td data-label="Category">${esc(position.category || "-")}</td>
                              <td data-label="Department">${esc(position.department || "-")}</td>
                              <td data-label="Website Place">${esc(position.website_place || "-")}</td>
                              <td data-label="Staff Type">${esc(position.default_staff_type || "Academic Staff")}</td>
                              <td data-label="Website"><span class="status ${position.visible_on_website ? "active" : "inactive"}">${position.visible_on_website ? "Visible" : "Hidden"}</span></td>
                              <td data-label="Status"><span class="status ${esc(statusClass(position.status))}">${esc(position.status || "Active")}</span></td>
                              <td data-label="Order">${esc(position.display_order || 0)}</td>
                              <td class="right">
                                <button class="icon-button" title="Edit position" data-edit-position="${esc(position.id)}">${icon("file")} Edit</button>
                                <button class="icon-button danger" title="Delete position" data-delete-position="${esc(position.id)}">${icon("trash")} Delete</button>
                              </td>
                            </tr>
                          `,
                        )
                        .join("")
                    : `<tr><td colspan="9"><div class="empty">No positions match your filters.</div></td></tr>`
                }
              </tbody>
            </table>
          </div>`,
        )}
      </div>
    `;
  }

  function field(label, name, value = "", attrs = "") {
    return `
      <label class="field">
        <span>${esc(label)}</span>
        <input name="${esc(name)}" value="${esc(value || "")}" ${attrs} />
      </label>
    `;
  }

  function resolvedPositionWebsitePlace(
    position = {},
    person = {},
    fallbackPosition = "",
    fallbackDepartment = "",
  ) {
    const explicit = position.website_place || position.websitePlace;
    if (explicit) return explicit;
    if (position.visible_on_website === false || position.visibleOnWebsite === false) {
      return "Hidden from Website";
    }
    const profilePlace = person.website_place || person.websitePlace || person.category;
    if (profilePlace) return profilePlace;
    const role = position.position || fallbackPosition || person.position || "";
    const type = person.staff_type || person.staffType || "Academic Staff";
    const department = position.department || fallbackDepartment || person.department || "";
    return role ? autoWebsitePlace(role, type, department) : "All Teachers Directory only";
  }

  function staffPositions(person) {
    const rows = Array.isArray(person?.positions) ? person.positions : [];
    if (rows.length) {
      return rows
        .map((position, index) => {
          const department = position.department || person?.department || "";
          const role = position.position || person?.position || "";
          const visible =
            position.visible_on_website !== false && position.visibleOnWebsite !== false;
          return {
            position_master_id: position.position_master_id || position.positionMasterId || "",
            department,
            position: role,
            website_place: resolvedPositionWebsitePlace(position, person, role, department),
            subject: position.subject || "",
            classes: position.classes || "",
            is_primary: position.is_primary === true || position.isPrimary === true || index === 0,
            display_order: Number(position.display_order || position.displayOrder || index),
            visible_on_website: visible,
          };
        })
        .sort((a, b) => {
          if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
          return a.display_order - b.display_order;
        });
    }
    if (!person) return [];
    const department = person.department || "";
    const role = person.position || "";
    return [
      {
        position_master_id: "",
        department,
        position: role,
        website_place: resolvedPositionWebsitePlace(
          { website_place: person.website_place || person.category },
          person,
          role,
          department,
        ),
        subject: person.subject || "",
        classes: person.classes || "",
        is_primary: true,
        display_order: 0,
        visible_on_website: true,
      },
    ];
  }

  function additionalPositionRowHtml(position = {}, index = 0) {
    const visible = position.visible_on_website !== false && position.visibleOnWebsite !== false;
    const keepAssignedPosition = Boolean(position.position);
    return `
      <div class="position-row" data-position-row>
        <div class="position-row-grid">
          <label class="field">
            <span>Department</span>
            <select data-position-field="department">${optionList(departments, position.department || "Middle School")}</select>
          </label>
          <label class="field">
            <span>Position</span>
            <select data-position-field="position">${positionOptionList(position.position || "Subject Teacher", position.position_master_id || position.positionMasterId || "", keepAssignedPosition)}</select>
          </label>
          <label class="field">
            <span>Website Place</span>
            <select data-position-field="website_place">${optionList(positionWebsitePlaces, position.website_place || position.websitePlace || "Subject Teachers")}</select>
          </label>
          <label class="field">
            <span>Subject</span>
            <input data-position-field="subject" value="${esc(position.subject || "")}" />
          </label>
          <label class="field">
            <span>Classes</span>
            <input data-position-field="classes" value="${esc(position.classes || "")}" />
          </label>
          <label class="check position-visible">
            <input data-position-field="visible_on_website" type="checkbox" ${visible ? "checked" : ""} />
            <span>Show on website</span>
          </label>
        </div>
        <button class="icon-button danger" type="button" data-action="remove-position">${icon("trash")} Remove</button>
        <input data-position-field="display_order" type="hidden" value="${esc(index + 1)}" />
      </div>
    `;
  }

  function staffFormHtml() {
    const person = state.editingId ? state.staff.find((item) => item.id === state.editingId) : null;
    const isEdit = Boolean(person);
    const id = isEdit ? person.id : state.nextId;
    const hasAccount = Boolean(person?.user_id);
    const profileImage = person?.photo_url || person?.profile_image || person?.image || "";

    return panel(
      isEdit ? "Edit Staff Profile" : "Create Staff Profile",
      "Staff ID is generated automatically by the backend.",
      `
        <form id="staff-form" class="staff-form" data-edit-mode="${isEdit ? "true" : "false"}">
          <section class="profile-card">
            <div class="photo-box" id="photo-box">
              ${
                profileImage
                  ? `<img src="${esc(profileImage)}" alt="" onerror="this.parentElement.innerHTML='<div><strong>No Photo</strong><span>Upload JPG or PNG</span></div>'" />`
                  : `<div><strong>No Photo</strong><span>Upload JPG or PNG</span></div>`
              }
            </div>
            <input type="hidden" id="profile-image" name="profile_image" value="${esc(profileImage)}" />
            <label class="file-field">
              <span>Upload Photo</span>
              <input id="photo-file" type="file" accept="image/jpeg,image/png" />
            </label>
            <button class="button danger ghost" type="button" data-action="clear-photo">${icon("trash")} Remove Photo</button>
          </section>
          <section class="form-sections">
            <div class="form-section">
              <h3>Identity</h3>
              <div class="form-grid">
                <label class="field generated-id-field">
                  <span>Staff ID</span>
                  <input name="id" value="${esc(id || "")}" placeholder="Auto generated" ${isEdit ? "readonly" : ""} />
                  <small>${isEdit ? "Staff ID cannot be changed while editing." : "Auto generated. Type an old deleted Staff ID here only when re-adding the same person."}</small>
                </label>
                ${field("Full Name", "full_name", person?.full_name || "", "required")}
                <label class="field">
                  <span>Slug</span>
                  <input name="slug" value="${esc(person?.slug || "")}" />
                  <small>Auto generated from full name unless edited.</small>
                </label>
                ${field("Email", "email", person?.email || "", 'type="email"')}
                ${field("Phone", "phone", person?.phone || "")}
                <label class="field">
                  <span>Status</span>
                  <select name="status">${optionList(["Active", "Inactive"], person?.status || "Active")}</select>
                </label>
                <label class="field">
                  <span>Sort Order</span>
                  <input name="sort_order" value="${esc(person?.sort_order ?? person?.sortOrder ?? 0)}" type="number" step="1" />
                  <small>Auto generated from the first position code unless edited.</small>
                </label>
              </div>
            </div>
            <div class="form-section">
              <h3>Position Codes</h3>
              <label class="field">
                <span>Position Codes</span>
                <textarea name="position_codes" rows="6" placeholder="class-teacher-6-c&#10;grade-head-6">${esc(positionCodesText(person))}</textarea>
                <small>Optional while creating a draft profile. Add one or more position codes to show this staff member on the public staff page.</small>
              </label>
            </div>
            <div class="form-section">
              <h3>Professional Information</h3>
              <div class="form-grid two">
                <label class="field">
                  <span>Qualifications</span>
                  <textarea name="qualification">${esc(person?.qualification || "")}</textarea>
                </label>
                <label class="field">
                  <span>Bio</span>
                  <textarea name="bio">${esc(person?.bio || person?.responsibilities || "")}</textarea>
                </label>
              </div>
            </div>
            <div class="form-section">
              <h3>Login Account</h3>
              <div class="account-strip">
                <label class="check">
                  <input name="accountEnabled" type="checkbox" ${hasAccount ? "checked" : ""} />
                  <span>Create or update teacher login in users table</span>
                </label>
                ${field("Temporary / New Password", "accountPassword", "", 'type="password" placeholder="Minimum 6 characters for new accounts"')}
              </div>
            </div>
            <div class="form-actions">
              <button class="button ghost" type="button" data-action="profiles">Cancel</button>
              ${isEdit ? `<button class="button danger" type="button" data-delete="${esc(person.id)}">${icon("trash")} Delete</button>` : ""}
              <button class="button primary" type="submit">${icon(isEdit ? "file" : "plus")} ${isEdit ? "Update Staff" : "Create Staff"}</button>
            </div>
          </section>
        </form>
      `,
    );
  }

  function attendanceHtml() {
    const currentDate = state.filters.date || today();
    const summary = attendanceStatuses.reduce((counts, [status]) => {
      counts[status] = state.attendance.filter((row) => row.status === status).length;
      return counts;
    }, {});
    const unmarked = state.attendance.filter((row) => !row.status).length;
    return `
      <div class="module-toolbar">
        <div class="filter-grid attendance-filter-grid">
          <label class="field compact">
            <span>Date</span>
            <input id="attendance-date" type="date" value="${esc(currentDate)}" />
          </label>
          <label class="field compact">
            <span>Section</span>
            <select id="attendance-section">${optionList(attendanceSections, state.filters.attendanceSection || "All Sections")}</select>
          </label>
          <label class="field compact">
            <span>Staff Type</span>
            <select id="attendance-staff-type">${optionList(["All", ...staffTypes], state.filters.attendanceStaffType || "All")}</select>
          </label>
          <label class="field compact">
            <span>Search</span>
            <input id="attendance-search" value="${esc(state.filters.attendanceSearch || "")}" placeholder="Name, ID, NIC, position" />
          </label>
        </div>
        <div class="toolbar-actions">
          <button class="button ghost" type="button" data-action="load-attendance">${icon("refresh")} Load Staff</button>
          <button class="button gold" type="button" data-action="mark-all-present">${icon("calendar")} Mark All Present</button>
          <button class="button primary" type="button" data-action="save-attendance">${icon("shield")} Save Attendance</button>
          <button class="button ghost" type="button" data-action="print-attendance">${icon("file")} Print Daily Report</button>
          <button class="button ghost" type="button" data-action="export-attendance">${icon("download")} Export CSV</button>
        </div>
      </div>
      <div class="attendance-summary-grid">
        <div class="attendance-summary-card"><strong>${esc(state.attendance.length)}</strong><span>Total Staff</span></div>
        <div class="attendance-summary-card good"><strong>${esc(summary.Present || 0)}</strong><span>Present</span></div>
        <div class="attendance-summary-card bad"><strong>${esc(summary.Absent || 0)}</strong><span>Absent</span></div>
        <div class="attendance-summary-card warn"><strong>${esc(summary["Late to Come"] || 0)}</strong><span>Late</span></div>
        <div class="attendance-summary-card"><strong>${esc(unmarked)}</strong><span>Unmarked</span></div>
      </div>
      <div class="attendance-legend">
        ${attendanceStatuses.map(([status, abbr]) => `<span><b>${esc(abbr)}</b>${esc(status)}</span>`).join("")}
      </div>
      <div class="table-wrap attendance-table-wrap">
        <table class="data-table attendance-table">
          <thead>
            <tr>
              <th>Staff ID</th>
              <th>Teacher / Staff Name</th>
              <th>Section</th>
              <th>Position</th>
              <th>Status</th>
              <th>Note / Reason</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            ${
              state.attendance.length
                ? state.attendance
                    .map(
                      (row) => `
                        <tr>
                          <td data-label="Staff ID"><strong>${esc(row.staff_id || row.staff_profile_id || "")}</strong></td>
                          <td data-label="Name">
                            <div class="identity">
                              ${avatar({ full_name: row.staff_name || row.full_name })}
                              <span><strong>${esc(row.staff_name || row.full_name || "-")}</strong><small>${esc(row.staff_type || "")}</small></span>
                            </div>
                          </td>
                          <td data-label="Section">${esc(row.section || "-")}</td>
                          <td data-label="Position">${esc(row.position || "-")}</td>
                          <td data-label="Status">
                            <div class="attendance-status-buttons">
                              ${attendanceStatuses
                                .map(
                                  ([status, abbr, title]) => `
                                    <button
                                      class="attendance-status-btn ${row.status === status ? "selected" : ""} ${esc(statusClass(status))}"
                                      type="button"
                                      title="${esc(title)}"
                                      data-attendance-status="${esc(status)}"
                                      data-staff-id="${esc(row.staff_profile_id || row.staff_id)}"
                                    >${esc(abbr)}</button>
                                  `,
                                )
                                .join("")}
                            </div>
                          </td>
                          <td data-label="Note">
                            <input class="attendance-note" data-attendance-note="${esc(row.staff_profile_id || row.staff_id)}" value="${esc(row.note || row.reason || "")}" placeholder="Optional" />
                          </td>
                          <td data-label="Last Updated">${esc(row.last_updated ? new Date(row.last_updated).toLocaleString() : "-")}</td>
                        </tr>
                      `,
                    )
                    .join("")
                : `<tr><td colspan="7" class="empty">No staff loaded for these filters.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
  }

  function leaveHtml() {
    return `
      <div class="split-grid wide-right">
        ${panel(
          "New Leave Request",
          "Create staff leave for approval",
          `<form id="leave-form" class="compact-form">
            <label class="field">
              <span>Staff Member</span>
              <select name="staff_id" required>
                <option value="">Select staff</option>
                ${state.staff.map((person) => `<option value="${esc(person.id)}">${esc(person.full_name)}</option>`).join("")}
              </select>
            </label>
            <label class="field">
              <span>Leave Type</span>
              <select name="leave_type">${optionList(["Casual", "Medical", "Duty", "No Pay", "Other"], "Casual")}</select>
            </label>
            ${field("Start Date", "start_date", "", 'type="date" required')}
            ${field("End Date", "end_date", "", 'type="date" required')}
            <label class="field">
              <span>Reason</span>
              <textarea name="reason"></textarea>
            </label>
            <button class="button primary" type="submit">${icon("clock")} Submit Leave</button>
          </form>`,
        )}
        ${panel(
          "Leave Requests",
          "Approve or reject staff leave",
          `<div class="row-list">${
            state.leave.length
              ? state.leave
                  .map(
                    (item) => `
                      <div class="request-row">
                        <span>
                          <strong>${esc(item.full_name || item.staff_id)}</strong>
                          <small>${esc(item.leave_type)} / ${esc(String(item.start_date).slice(0, 10))} to ${esc(String(item.end_date).slice(0, 10))}</small>
                        </span>
                        <em class="status ${esc(statusClass(item.status))}">${esc(item.status)}</em>
                        <button class="icon-button" data-leave-status="${esc(item.id)}:Approved">${icon("shield")} Approve</button>
                        <button class="icon-button danger" data-leave-status="${esc(item.id)}:Rejected">${icon("trash")} Reject</button>
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="empty">No leave requests.</div>`
          }</div>`,
        )}
      </div>
    `;
  }

  function documentsHtml() {
    return `
      <div class="split-grid wide-right">
        ${panel(
          "Upload Document",
          "PDF files are stored in uploads/staff/documents",
          `<form id="document-form" class="compact-form">
            <label class="field">
              <span>Staff Member</span>
              <select name="staff_id" required>
                <option value="">Select staff</option>
                ${state.staff.map((person) => `<option value="${esc(person.id)}">${esc(person.full_name)}</option>`).join("")}
              </select>
            </label>
            ${field("Document Title", "title", "", "required")}
            <label class="field">
              <span>Document Type</span>
              <select name="document_type">${optionList(["Appointment", "Certificate", "NIC", "Leave", "Contract", "Other"], "Certificate")}</select>
            </label>
            <label class="file-field">
              <span>PDF File</span>
              <input id="document-file" type="file" accept="application/pdf" required />
            </label>
            <button class="button primary" type="submit">${icon("file")} Upload Document</button>
          </form>`,
        )}
        ${panel(
          "Staff Documents",
          `${state.documents.length} files`,
          tableHtml(
            ["Staff", "Title", "Type", "Uploaded", ""],
            state.documents,
            (row) => [
              row.full_name || row.staff_id,
              `<a href="${esc(row.file_url)}" target="_blank" rel="noreferrer">${esc(row.title)}</a>`,
              row.document_type || "-",
              String(row.created_at || "").slice(0, 10),
              `<button class="icon-button danger" data-delete-document="${esc(row.id)}">${icon("trash")} Delete</button>`,
            ],
            true,
          ),
        )}
      </div>
    `;
  }

  function noticesHtml() {
    return `
      <div class="split-grid wide-right">
        ${panel(
          "Publish Staff Notice",
          "Internal update for staff system users",
          `<form id="notice-form" class="compact-form">
            ${field("Title", "title", "", "required")}
            <label class="field">
              <span>Audience</span>
              <select name="audience">${optionList(["All staff", "Academic Staff", "Non-Academic Staff", "Supportive Staff"], "All staff")}</select>
            </label>
            <label class="field">
              <span>Priority</span>
              <select name="priority">${optionList(["Normal", "Important", "Urgent"], "Normal")}</select>
            </label>
            <label class="field">
              <span>Message</span>
              <textarea name="body"></textarea>
            </label>
            <button class="button primary" type="submit">${icon("bell")} Publish Notice</button>
          </form>`,
        )}
        ${panel(
          "Staff Notices",
          `${state.notices.length} notices`,
          `<div class="notice-list">${
            state.notices.length
              ? state.notices
                  .map(
                    (item) => `
                      <article>
                        <span class="status ${esc(statusClass(item.priority))}">${esc(item.priority)}</span>
                        <h3>${esc(item.title)}</h3>
                        <p>${esc(item.body || "")}</p>
                        <small>${esc(item.audience)} / ${esc(String(item.created_at || "").slice(0, 10))}</small>
                        <button class="icon-button danger" data-delete-notice="${esc(item.id)}">${icon("trash")} Delete</button>
                      </article>
                    `,
                  )
                  .join("")
              : `<div class="empty">No staff notices yet.</div>`
          }</div>`,
        )}
      </div>
    `;
  }

  function rolesHtml() {
    const rows = [
      ["masteradmin", "Full access", "All apps, all staff actions"],
      ["superadmin", "Full access", "All apps except highest ownership tasks"],
      ["staff_admin", "Staff system", "Profiles, accounts, attendance, leave, documents"],
      ["teacher", "Self service", "Own profile, attendance, leave, documents"],
      ["website_admin", "No staff access", "Website CMS only"],
      ["eduzync_admin", "Academic access", "EduTrack and academic data only"],
    ];
    return panel(
      "Staff Roles & Permissions",
      "Recommended access model for staff.domain.com",
      tableHtml(["Role", "Access", "Scope"], rows, (row) => row),
    );
  }

  function auditHtml() {
    return panel(
      "Audit History",
      "Latest staff system changes",
      tableHtml(["When", "Actor", "Action", "Target", "Details"], state.audit, (row) => [
        String(row.created_at || "")
          .replace("T", " ")
          .slice(0, 19),
        row.actor_user_id || "-",
        row.action,
        [row.target_type, row.target_id].filter(Boolean).join(" / "),
        safeDetails(row.details),
      ]),
    );
  }

  function tableHtml(headers, rows, mapper, html = false) {
    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map((row) => {
                      const cells = mapper(row);
                      return `<tr>${cells.map((cell) => `<td>${html ? cell : esc(cell)}</td>`).join("")}</tr>`;
                    })
                    .join("")
                : `<tr><td colspan="${headers.length}"><div class="empty">No records yet.</div></td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
  }

  function safeDetails(value) {
    if (!value) return "";
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      return Object.entries(parsed)
        .map(([key, item]) => `${key}: ${item}`)
        .join(", ");
    } catch {
      return String(value).slice(0, 160);
    }
  }

  function renderContent() {
    if (state.view === "dashboard") return dashboardHtml();
    if (state.view === "profiles") return profilesHtml();
    if (state.view === "form") return staffFormHtml();
    if (state.view === "positions") return positionSettingsHtml();
    if (state.view === "attendance") return attendanceHtml();
    if (state.view === "leave") return leaveHtml();
    if (state.view === "documents") return documentsHtml();
    if (state.view === "notices") return noticesHtml();
    if (state.view === "roles") return rolesHtml();
    if (state.view === "audit") return auditHtml();
    return dashboardHtml();
  }

  function renderShell() {
    app.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <a class="brand" href="/portal">
            <img src="/loyola-crest.jpg" alt="" />
            <span>
              <strong>Loyola Staff</strong>
              <small>Professional HR System</small>
            </span>
          </a>
          <nav class="nav">
            ${modules
              .map(
                ([id, label, sub]) => `
                  <button class="${state.view === id ? "active" : ""}" data-view="${id}">
                    <span class="nav-icon">${icon(moduleIcons[id])}</span>
                    <span class="nav-copy">
                      <strong>${esc(label)}</strong>
                      <small>${esc(sub)}</small>
                    </span>
                  </button>
                `,
              )
              .join("")}
          </nav>
          <div class="side-links">
            <a href="/portal">Available Apps</a>
            <a href="/about/college-staff" target="_blank" rel="noreferrer">Preview Staff Page</a>
            <a href="/admin">Website Admin</a>
          </div>
        </aside>
        <main class="main">
          <header class="topbar">
            <div>
              <p class="eyebrow">staff.domain.com ready</p>
              <h1>${esc(modules.find(([id]) => id === state.view)?.[1] || "Staff Management")}</h1>
              <p class="topbar-subtitle">${esc(viewSubtitles[state.view] || "")}</p>
            </div>
            <div class="top-actions">
              <span class="user-pill">
                <span class="avatar small">${esc(initials(state.user?.name || state.user?.email || "Admin"))}</span>
                <span>
                  <strong>${esc(state.user?.name || "Staff Admin")}</strong>
                  <small>${esc(roleLabel(state.user?.role))}</small>
                </span>
              </span>
              <button class="button ghost" data-action="refresh">${icon("refresh")} Refresh</button>
            </div>
          </header>
          <section class="content">
            <div id="notice" class="notice"></div>
            ${renderContent()}
          </section>
        </main>
      </div>
    `;
    bindActions();
  }

  async function openNewStaffForm(event) {
    if (event) event.preventDefault();
    await setView("form", { newRecord: true });
  }

  function bindStaffRowActions(root = document) {
    root.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => setView("form", { editingId: button.dataset.edit }));
    });
    root.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => deleteStaff(button.dataset.delete));
    });
  }

  function bindActions() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", (event) => {
        if (button.dataset.view === "form") return openNewStaffForm(event);
        return setView(button.dataset.view);
      });
    });
    document.querySelectorAll("[data-action='new-staff']").forEach((button) => {
      button.addEventListener("click", openNewStaffForm);
    });
    document.querySelectorAll("[data-action='profiles']").forEach((button) => {
      button.addEventListener("click", () => setView("profiles"));
    });
    document.querySelectorAll("[data-action='refresh']").forEach((button) => {
      button.addEventListener("click", refreshCurrentView);
    });
    document.querySelectorAll("[data-action='export']").forEach((button) => {
      button.addEventListener("click", exportStaffCsv);
    });
    document.querySelectorAll("[data-action='download-template']").forEach((button) => {
      button.addEventListener("click", downloadCsvTemplate);
    });
    document.querySelectorAll("[data-action='cancel-import']").forEach((button) => {
      button.addEventListener("click", () => {
        state.csvImport = { fileName: "", csv: "", mode: "merge", preview: null };
        renderShell();
      });
    });
    document.querySelectorAll("[data-action='confirm-import']").forEach((button) => {
      button.addEventListener("click", confirmStaffCsvImport);
    });
    document.querySelectorAll("[data-action='download-error-report']").forEach((button) => {
      button.addEventListener("click", downloadImportErrorReport);
    });
    document.querySelectorAll("[name='import-mode']").forEach((radio) => {
      radio.addEventListener("change", async () => {
        state.csvImport.mode = radio.value;
        if (state.csvImport.csv) await previewStaffCsvImport();
      });
    });
    const importCsvFile = document.getElementById("import-csv-file");
    if (importCsvFile) importCsvFile.addEventListener("change", importStaffCsv);
    bindStaffRowActions();

    const search = document.getElementById("filter-search");
    if (search) search.addEventListener("input", () => updateFilter("search", search.value));
    const type = document.getElementById("filter-type");
    if (type) type.addEventListener("change", () => updateFilter("type", type.value));
    const status = document.getElementById("filter-status");
    if (status) status.addEventListener("change", () => updateFilter("status", status.value));
    const positionSearch = document.getElementById("position-filter-search");
    if (positionSearch) {
      positionSearch.addEventListener("input", () =>
        updatePositionFilter("search", positionSearch.value),
      );
    }
    const positionCategory = document.getElementById("position-filter-category");
    if (positionCategory) {
      positionCategory.addEventListener("change", () =>
        updatePositionFilter("category", positionCategory.value),
      );
    }
    const positionDepartment = document.getElementById("position-filter-department");
    if (positionDepartment) {
      positionDepartment.addEventListener("change", () =>
        updatePositionFilter("department", positionDepartment.value),
      );
    }
    const positionPlace = document.getElementById("position-filter-place");
    if (positionPlace) {
      positionPlace.addEventListener("change", () =>
        updatePositionFilter("websitePlace", positionPlace.value),
      );
    }
    const positionStatus = document.getElementById("position-filter-status");
    if (positionStatus) {
      positionStatus.addEventListener("change", () =>
        updatePositionFilter("status", positionStatus.value),
      );
    }
    const positionMasterForm = document.getElementById("position-master-form");
    if (positionMasterForm) positionMasterForm.addEventListener("submit", submitPositionMasterForm);
    const positionMasterPlace = positionMasterForm?.querySelector("[name='website_place']");
    if (positionMasterPlace) {
      positionMasterPlace.addEventListener("change", () => {
        const visible = positionMasterForm.querySelector("[name='visible_on_website']");
        if (visible && positionMasterPlace.value === "Hidden from Website") visible.checked = false;
      });
    }
    document.querySelectorAll("[data-edit-position]").forEach((button) => {
      button.addEventListener("click", () => editPositionMaster(button.dataset.editPosition));
    });
    document.querySelectorAll("[data-delete-position]").forEach((button) => {
      button.addEventListener("click", () => deletePositionMaster(button.dataset.deletePosition));
    });
    document.querySelectorAll("[data-action='cancel-position-edit']").forEach((button) => {
      button.addEventListener("click", () => {
        state.editingPositionId = "";
        renderShell();
      });
    });
    const attendanceDate = document.getElementById("attendance-date");
    if (attendanceDate) {
      attendanceDate.addEventListener("change", async () => {
        state.filters.date = attendanceDate.value || today();
        await setView("attendance");
      });
    }
    const attendanceSection = document.getElementById("attendance-section");
    if (attendanceSection) {
      attendanceSection.addEventListener("change", async () => {
        state.filters.attendanceSection = attendanceSection.value || "All Sections";
        await setView("attendance");
      });
    }
    const attendanceStaffType = document.getElementById("attendance-staff-type");
    if (attendanceStaffType) {
      attendanceStaffType.addEventListener("change", async () => {
        state.filters.attendanceStaffType = attendanceStaffType.value || "All";
        await setView("attendance");
      });
    }
    const attendanceSearch = document.getElementById("attendance-search");
    if (attendanceSearch) {
      attendanceSearch.addEventListener("input", () => {
        state.filters.attendanceSearch = attendanceSearch.value || "";
        clearTimeout(bindEvents.attendanceSearchTimer);
        bindEvents.attendanceSearchTimer = setTimeout(() => setView("attendance"), 320);
      });
    }
    document.querySelectorAll("[data-attendance-status]").forEach((button) => {
      button.addEventListener("click", () => {
        setAttendanceStatus(button.dataset.staffId, button.dataset.attendanceStatus);
      });
    });
    document.querySelectorAll("[data-attendance-note]").forEach((input) => {
      input.addEventListener("input", () => {
        setAttendanceNote(input.dataset.attendanceNote, input.value);
      });
    });
    document.querySelectorAll("[data-action='load-attendance']").forEach((button) => {
      button.addEventListener("click", () => setView("attendance"));
    });
    document.querySelectorAll("[data-action='mark-all-present']").forEach((button) => {
      button.addEventListener("click", markAllAttendancePresent);
    });
    document.querySelectorAll("[data-action='save-attendance']").forEach((button) => {
      button.addEventListener("click", saveAttendanceBulk);
    });
    document.querySelectorAll("[data-action='print-attendance']").forEach((button) => {
      button.addEventListener("click", printAttendanceReport);
    });
    document.querySelectorAll("[data-action='export-attendance']").forEach((button) => {
      button.addEventListener("click", exportAttendanceCsv);
    });

    const staffForm = document.getElementById("staff-form");
    if (staffForm) {
      bindStaffAutoFields(staffForm);
      staffForm.addEventListener("submit", submitStaffForm);
    }
    const photoFile = document.getElementById("photo-file");
    if (photoFile) photoFile.addEventListener("change", uploadProfilePhoto);
    const clearPhoto = document.querySelector("[data-action='clear-photo']");
    if (clearPhoto) clearPhoto.addEventListener("click", clearProfilePhoto);
    const addPosition = document.querySelector("[data-action='add-position']");
    if (addPosition) addPosition.addEventListener("click", addAdditionalPosition);
    document.querySelectorAll("[data-action='remove-position']").forEach((button) => {
      button.addEventListener("click", () => removeAdditionalPosition(button));
    });
    const position = document.getElementById("position");
    const staffType = document.getElementById("staff-type");
    const primaryDepartment = document.querySelector("#staff-form [name='department']");
    if (position) position.addEventListener("change", syncPrimaryPositionDefaults);
    if (staffType) staffType.addEventListener("change", syncWebsitePlace);
    if (primaryDepartment) primaryDepartment.addEventListener("change", syncWebsitePlace);
    document.querySelectorAll("[data-position-field='position']").forEach((select) => {
      select.addEventListener("change", () => syncAdditionalPositionDefaults(select));
    });

    const leaveForm = document.getElementById("leave-form");
    if (leaveForm) leaveForm.addEventListener("submit", submitLeave);
    document.querySelectorAll("[data-leave-status]").forEach((button) => {
      button.addEventListener("click", () => updateLeaveStatus(button.dataset.leaveStatus));
    });
    const documentForm = document.getElementById("document-form");
    if (documentForm) documentForm.addEventListener("submit", submitDocument);
    document.querySelectorAll("[data-delete-document]").forEach((button) => {
      button.addEventListener("click", () => deleteDocument(button.dataset.deleteDocument));
    });
    const noticeForm = document.getElementById("notice-form");
    if (noticeForm) noticeForm.addEventListener("submit", submitNotice);
    document.querySelectorAll("[data-delete-notice]").forEach((button) => {
      button.addEventListener("click", () => deleteNotice(button.dataset.deleteNotice));
    });
  }

  function bindStaffAutoFields(form) {
    const fullName = form.querySelector("[name='full_name']");
    const slugInput = form.querySelector("[name='slug']");
    const sortOrderInput = form.querySelector("[name='sort_order']");
    const positionCodes = form.querySelector("[name='position_codes']");
    if (!fullName || !slugInput || !sortOrderInput || !positionCodes) return;

    const isEditMode = form.dataset.editMode === "true";
    const initialGeneratedSlug = profileSlugFromName(fullName.value);
    const initialSlug = String(slugInput.value || "").trim();
    const initialSortOrder = Number(sortOrderInput.value || 0);
    const hasManualInitialSlug = isEditMode
      ? Boolean(initialSlug)
      : Boolean(initialSlug && initialSlug !== initialGeneratedSlug);
    slugInput.dataset.manual = hasManualInitialSlug ? "true" : "false";
    sortOrderInput.dataset.manual = isEditMode && initialSortOrder !== 0 ? "true" : "false";

    const syncSlug = () => {
      if (slugInput.dataset.manual === "true" && slugInput.value.trim()) return;
      slugInput.value = profileSlugFromName(fullName.value);
      slugInput.dataset.manual = "false";
    };

    const syncSortOrder = () => {
      const current = Number(sortOrderInput.value || 0);
      if (sortOrderInput.dataset.manual === "true" && current !== 0) return;
      sortOrderInput.value = String(autoSortOrderFromPositionCodes(positionCodes.value));
      sortOrderInput.dataset.manual = "false";
    };

    fullName.addEventListener("input", syncSlug);
    slugInput.addEventListener("input", () => {
      const value = slugInput.value.trim();
      if (!value) {
        slugInput.dataset.manual = "false";
        syncSlug();
        return;
      }
      slugInput.dataset.manual = value === profileSlugFromName(fullName.value) ? "false" : "true";
    });
    positionCodes.addEventListener("input", syncSortOrder);
    sortOrderInput.addEventListener("input", () => {
      const current = Number(sortOrderInput.value || 0);
      if (!sortOrderInput.value || current === 0) {
        sortOrderInput.dataset.manual = "false";
        syncSortOrder();
        return;
      }
      sortOrderInput.dataset.manual = "true";
    });

    syncSlug();
    syncSortOrder();
  }

  function staffSortOrderIsManual(form) {
    const input = form.querySelector("[name='sort_order']");
    return input?.dataset.manual === "true" && Number(input.value || 0) !== 0;
  }

  async function refreshCurrentView() {
    await loadCore();
    await loadViewData(state.view).catch(() => null);
    renderShell();
    setNotice("Staff system refreshed.", "success");
  }

  function updateFilter(key, value) {
    state.filters[key] = value;
    if (state.view === "profiles") {
      renderProfilesResults();
      return;
    }
    renderShell();
  }

  function renderProfilesResults() {
    const results = document.getElementById("profiles-results");
    if (!results) {
      renderShell();
      return;
    }
    results.innerHTML = profilesResultsHtml();
    bindStaffRowActions(results);
  }

  function updatePositionFilter(key, value) {
    state.positionFilters[key] = value;
    renderShell();
  }

  function syncWebsitePlace() {
    const category = document.getElementById("category");
    const position = document.getElementById("position");
    const staffType = document.getElementById("staff-type");
    const department = document.querySelector("[name='department']");
    const master = positionMasterBySelection(position);
    if (category && position && staffType) {
      category.value =
        master?.website_place ||
        autoWebsitePlace(position.value, staffType.value, department?.value || "");
    }
  }

  function syncPrimaryPositionDefaults() {
    const position = document.getElementById("position");
    const master = positionMasterBySelection(position);
    if (!master) {
      syncWebsitePlace();
      return;
    }
    const department = document.querySelector("[name='department']");
    const category = document.getElementById("category");
    const staffType = document.getElementById("staff-type");
    if (department && master.department) department.value = master.department;
    if (category && master.website_place) category.value = master.website_place;
    if (staffType && master.default_staff_type) staffType.value = master.default_staff_type;
  }

  function syncAdditionalPositionDefaults(select) {
    const row = select.closest("[data-position-row]");
    const master = positionMasterBySelection(select);
    if (!row || !master) return;
    const department = row.querySelector("[data-position-field='department']");
    const websitePlace = row.querySelector("[data-position-field='website_place']");
    const visible = row.querySelector("[data-position-field='visible_on_website']");
    if (department && master.department) department.value = master.department;
    if (websitePlace && master.website_place) websitePlace.value = master.website_place;
    if (visible) {
      visible.checked =
        master.visible_on_website !== false && master.website_place !== "Hidden from Website";
    }
  }

  async function uploadFile(file, folder) {
    const form = new FormData();
    form.append("file", file);
    return api(`/api/uploads?folder=${encodeURIComponent(folder)}`, {
      method: "POST",
      body: form,
    });
  }

  function currentStaffFormId() {
    const input = document.querySelector("#staff-form [name='id']");
    return String(input?.value || state.editingId || state.nextId || "").trim();
  }

  async function uploadStaffProfilePhoto(file) {
    const staffId = currentStaffFormId();
    const form = new FormData();
    form.append("file", file);
    return api(`/api/staff/profile-photo?staff_id=${encodeURIComponent(staffId)}`, {
      method: "POST",
      body: form,
    });
  }

  async function uploadProfilePhoto(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      setNotice("Uploading profile photo...");
      const result = await uploadStaffProfilePhoto(file);
      const url = result.fileUrl || result.url || "";
      document.getElementById("profile-image").value = url;
      document.getElementById("photo-box").innerHTML = `<img src="${esc(url)}" alt="" />`;
      setNotice(
        result.savedToProfile
          ? "Profile photo saved."
          : "Profile photo uploaded. Save the profile to finish linking it.",
        "success",
      );
    } catch (error) {
      setNotice(error.message || "Upload failed.", "error");
    } finally {
      event.target.value = "";
    }
  }

  function clearProfilePhoto() {
    document.getElementById("profile-image").value = "";
    document.getElementById("photo-box").innerHTML =
      `<div><strong>No Photo</strong><span>Upload JPG or PNG</span></div>`;
  }

  function addAdditionalPosition() {
    const list = document.getElementById("positions-list");
    if (!list) return;
    list.querySelector(".empty")?.remove();
    const wrapper = document.createElement("div");
    wrapper.innerHTML = additionalPositionRowHtml(
      {},
      list.querySelectorAll("[data-position-row]").length,
    );
    const row = wrapper.firstElementChild;
    list.appendChild(row);
    row
      .querySelector("[data-action='remove-position']")
      .addEventListener("click", () => removeAdditionalPosition(row));
    const position = row.querySelector("[data-position-field='position']");
    if (position)
      position.addEventListener("change", () => syncAdditionalPositionDefaults(position));
  }

  function removeAdditionalPosition(target) {
    const row = target.closest ? target.closest("[data-position-row]") : target;
    const list = document.getElementById("positions-list");
    if (!row || !list) return;
    row.remove();
    if (!list.querySelector("[data-position-row]")) {
      list.innerHTML = `<div class="empty small">No additional positions added.</div>`;
    }
  }

  function collectStaffPositions(payload) {
    const primaryPositionSelect = document.getElementById("position");
    const primaryVisible = payload.category !== "Hidden from Website";
    const positionsPayload = [
      {
        position_master_id: selectedPositionMasterId(primaryPositionSelect),
        department: payload.department || "",
        position: payload.position || "",
        website_place:
          payload.category ||
          autoWebsitePlace(payload.position, payload.staff_type, payload.department),
        subject: payload.subject || "",
        classes: payload.classes || "",
        is_primary: true,
        display_order: 0,
        visible_on_website: primaryVisible,
      },
    ];

    document.querySelectorAll("[data-position-row]").forEach((row, index) => {
      const read = (field) => row.querySelector(`[data-position-field='${field}']`);
      const websitePlace = read("website_place")?.value || "";
      const position = {
        position_master_id: selectedPositionMasterId(read("position")),
        department: read("department")?.value || "",
        position: read("position")?.value || "",
        website_place: websitePlace,
        subject: read("subject")?.value || "",
        classes: read("classes")?.value || "",
        is_primary: false,
        display_order: index + 1,
        visible_on_website:
          websitePlace === "Hidden from Website"
            ? false
            : Boolean(read("visible_on_website")?.checked),
      };
      if (
        position.department ||
        position.position ||
        position.website_place ||
        position.subject ||
        position.classes
      ) {
        positionsPayload.push(position);
      }
    });

    return positionsPayload;
  }

  async function submitStaffForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    payload.accountEnabled = data.get("accountEnabled") === "on";
    payload.profile_image = document.getElementById("profile-image").value;
    payload.photo_url = payload.profile_image;
    payload.position_codes = normalizePositionCodes(payload.position_codes).join("\n");
    payload.sort_order = staffSortOrderIsManual(form) ? Number(payload.sort_order || 0) : 0;
    const hasPositionCodes = Boolean(payload.position_codes);
    const wasEditing = Boolean(state.editingId);

    button.disabled = true;
    try {
      const result = await api(
        state.editingId ? `/api/staff/${encodeURIComponent(state.editingId)}` : "/api/staff",
        {
          method: state.editingId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      await loadCore();
      await setView("profiles");
      setNotice(
        result.duplicateWarning ||
          (wasEditing
            ? "Staff profile updated."
            : hasPositionCodes
              ? "Staff profile created."
              : "Staff profile created as a draft. Add position codes to show it on the public staff page."),
        result.duplicateWarning ? "warning" : "success",
      );
    } catch (error) {
      setNotice(error.message || "Could not save staff profile.", "error");
    } finally {
      button.disabled = false;
    }
  }

  async function deleteStaff(id) {
    if (!id || !confirm("Delete this staff profile and disable linked account?")) return;
    try {
      await api(`/api/staff/${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadCore();
      await setView("profiles");
      setNotice("Staff profile deleted.", "success");
    } catch (error) {
      setNotice(error.message || "Delete failed.", "error");
    }
  }

  function editPositionMaster(id) {
    state.editingPositionId = id || "";
    renderShell();
  }

  async function submitPositionMasterForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    payload.visible_on_website = data.get("visible_on_website") === "on";
    payload.display_order = Number(payload.display_order || 0);

    button.disabled = true;
    try {
      const editingId = state.editingPositionId;
      await api(
        editingId
          ? `/api/staff-position-master/${encodeURIComponent(editingId)}`
          : "/api/staff-position-master",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      state.editingPositionId = "";
      await loadCore();
      renderShell();
      setNotice(editingId ? "Position updated." : "Position added.", "success");
    } catch (error) {
      setNotice(error.message || "Position save failed.", "error");
    } finally {
      button.disabled = false;
    }
  }

  async function deletePositionMaster(id) {
    if (
      !id ||
      !confirm("Delete this position? If it is assigned to staff, delete will be blocked.")
    )
      return;
    try {
      await api(`/api/staff-position-master/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (String(state.editingPositionId) === String(id)) state.editingPositionId = "";
      await loadCore();
      renderShell();
      setNotice("Position deleted.", "success");
    } catch (error) {
      setNotice(error.message || "Position delete failed.", "error");
    }
  }

  function setAttendanceStatus(staffId, status) {
    state.attendance = state.attendance.map((row) =>
      String(row.staff_profile_id || row.staff_id) === String(staffId)
        ? { ...row, status }
        : row,
    );
    renderShell();
  }

  function setAttendanceNote(staffId, note) {
    state.attendance = state.attendance.map((row) =>
      String(row.staff_profile_id || row.staff_id) === String(staffId)
        ? { ...row, note }
        : row,
    );
  }

  function markAllAttendancePresent() {
    state.attendance = state.attendance.map((row) => ({ ...row, status: "Present" }));
    renderShell();
    setNotice("All loaded staff marked Present. Click Save Attendance to store it.", "success");
  }

  async function saveAttendanceBulk() {
    const records = state.attendance
      .filter((row) => row.status || row.note)
      .map((row) => ({
        staff_profile_id: row.staff_profile_id || row.staff_id,
        staff_id: row.staff_id || row.staff_profile_id,
        attendance_date: state.filters.date || today(),
        section: row.section || "",
        staff_type: row.staff_type || "",
        position: row.position || "",
        status: row.status || "Present",
        note: row.note || "",
      }));
    if (!records.length) {
      setNotice("Select at least one attendance status before saving.", "error");
      return;
    }
    try {
      await api("/api/staff/attendance/bulk-mark", {
        method: "POST",
        body: JSON.stringify({ date: state.filters.date || today(), records }),
      });
      await setView("attendance");
      setNotice("Attendance saved.", "success");
    } catch (error) {
      setNotice(error.message || "Attendance save failed.", "error");
    }
  }

  function attendanceReportRows() {
    return state.attendance.map((row) => ({
      staffId: row.staff_id || row.staff_profile_id || "",
      name: row.staff_name || row.full_name || "",
      section: row.section || "",
      position: row.position || "",
      status: row.status || "Unmarked",
      note: row.note || row.reason || "",
    }));
  }

  function printAttendanceReport() {
    const rows = attendanceReportRows();
    const summary = attendanceStatuses
      .map(([status]) => `${status}: ${rows.filter((row) => row.status === status).length}`)
      .join(" | ");
    const tableRows = rows
      .map(
        (row) => `
          <tr>
            <td>${esc(row.staffId)}</td>
            <td>${esc(row.name)}</td>
            <td>${esc(row.section)}</td>
            <td>${esc(row.position)}</td>
            <td>${esc(row.status)}</td>
            <td>${esc(row.note)}</td>
          </tr>
        `,
      )
      .join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Daily Staff Attendance Report</title>
          <style>
            body{font-family:Arial,sans-serif;color:#111827;padding:24px}
            h1{font-size:20px;margin:0}
            h2{font-size:16px;margin:4px 0 18px}
            table{width:100%;border-collapse:collapse;font-size:12px}
            th,td{border:1px solid #d1d5db;padding:6px;text-align:left;vertical-align:top}
            th{background:#f3f4f6}
            .meta{font-size:12px;margin:12px 0 16px}
            .sig{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:36px}
            .sig div{border-top:1px solid #111827;padding-top:8px}
          </style>
        </head>
        <body>
          <h1>Loyola College Negombo</h1>
          <h2>Daily Staff Attendance Report</h2>
          <div class="meta">
            Date: ${esc(state.filters.date || today())}<br>
            Section: ${esc(state.filters.attendanceSection || "All Sections")}<br>
            Generated by: ${esc(state.user?.name || state.user?.email || "-")}<br>
            Generated at: ${esc(new Date().toLocaleString())}<br>
            ${esc(summary)}
          </div>
          <table>
            <thead><tr><th>Staff ID</th><th>Name</th><th>Section</th><th>Position</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>${tableRows || '<tr><td colspan="6">No records</td></tr>'}</tbody>
          </table>
          <div class="sig"><div>Prepared by:</div><div>Checked by:</div><div>Approved by:</div></div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  async function exportAttendanceCsv() {
    const params = new URLSearchParams({
      date: state.filters.date || today(),
      section: state.filters.attendanceSection || "All Sections",
      staff_type: state.filters.attendanceStaffType || "All",
      search: state.filters.attendanceSearch || "",
    });
    try {
      const response = await fetch(`/api/staff/attendance/export/csv?${params.toString()}`, {
        headers: headers(),
      });
      if (!response.ok) throw new Error("Attendance export failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `staff-attendance-${state.filters.date || today()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setNotice(error.message || "Attendance export failed.", "error");
    }
  }

  async function submitLeave(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await api("/api/staff-leave", { method: "POST", body: JSON.stringify(payload) });
      await setView("leave");
      setNotice("Leave request submitted.", "success");
    } catch (error) {
      setNotice(error.message || "Leave request failed.", "error");
    }
  }

  async function updateLeaveStatus(value) {
    const [id, status] = String(value || "").split(":");
    if (!id || !status) return;
    try {
      await api(`/api/staff-leave/${encodeURIComponent(id)}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      await setView("leave");
      setNotice(`Leave ${status.toLowerCase()}.`, "success");
    } catch (error) {
      setNotice(error.message || "Leave update failed.", "error");
    }
  }

  async function submitDocument(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const file = document.getElementById("document-file").files[0];
    if (!file) {
      setNotice("Choose a PDF document.", "error");
      return;
    }
    try {
      setNotice("Uploading document...");
      const uploaded = await uploadFile(file, "staff/documents");
      payload.file_url = uploaded.fileUrl || uploaded.url || "";
      await api("/api/staff-documents", { method: "POST", body: JSON.stringify(payload) });
      await setView("documents");
      setNotice("Document uploaded.", "success");
    } catch (error) {
      setNotice(error.message || "Document upload failed.", "error");
    }
  }

  async function deleteDocument(id) {
    if (!id || !confirm("Delete this document record?")) return;
    try {
      await api(`/api/staff-documents/${encodeURIComponent(id)}`, { method: "DELETE" });
      await setView("documents");
      setNotice("Document deleted.", "success");
    } catch (error) {
      setNotice(error.message || "Document delete failed.", "error");
    }
  }

  async function submitNotice(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await api("/api/staff-notices", { method: "POST", body: JSON.stringify(payload) });
      await setView("notices");
      setNotice("Notice published.", "success");
    } catch (error) {
      setNotice(error.message || "Notice publish failed.", "error");
    }
  }

  async function deleteNotice(id) {
    if (!id || !confirm("Delete this notice?")) return;
    try {
      await api(`/api/staff-notices/${encodeURIComponent(id)}`, { method: "DELETE" });
      await setView("notices");
      setNotice("Notice deleted.", "success");
    } catch (error) {
      setNotice(error.message || "Notice delete failed.", "error");
    }
  }

  async function importStaffCsv(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setNotice("Choose a .csv file.", "error");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice("CSV file is too large. Limit is 2 MB.", "error");
      event.target.value = "";
      return;
    }
    try {
      state.csvImport.csv = await file.text();
      state.csvImport.fileName = file.name;
      state.csvImport.mode = "merge";
      await previewStaffCsvImport();
    } catch (error) {
      setNotice(error.message || "CSV preview failed.", "error");
    } finally {
      event.target.value = "";
    }
  }

  async function previewStaffCsvImport() {
    const result = await api("/api/staff/import-csv/preview", {
      method: "POST",
      body: JSON.stringify({
        csv: state.csvImport.csv,
        fileName: state.csvImport.fileName,
        mode: state.csvImport.mode,
      }),
    });
    state.csvImport.preview = result.preview;
    renderShell();
    setNotice("CSV preview ready. Review it before confirming.", "success");
  }

  async function confirmStaffCsvImport() {
    if (!state.csvImport.csv) return;
    try {
      const result = await api("/api/staff/import-csv", {
        method: "POST",
        body: JSON.stringify({
          csv: state.csvImport.csv,
          fileName: state.csvImport.fileName,
          mode: state.csvImport.mode,
        }),
      });
      state.csvImport = { fileName: "", csv: "", mode: "merge", preview: null };
      await loadCore();
      renderShell();
      setNotice(
        `CSV import complete. Created ${result.created || 0}, updated ${result.updated || 0}, skipped ${result.skipped || 0}.`,
        result.errors ? "warning" : "success",
      );
    } catch (error) {
      setNotice(error.message || "CSV import failed.", "error");
    }
  }

  function downloadBlob(content, fileName, type = "text/csv;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadCsvTemplate() {
    try {
      const response = await fetch("/api/staff/import-csv/template", {
        headers: headers(),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Template download failed.");
      downloadBlob(await response.text(), "staff-import-template.csv");
    } catch (error) {
      setNotice(error.message || "Template download failed.", "error");
    }
  }

  function downloadImportErrorReport() {
    const csv = state.csvImport.preview?.errorReportCsv || "";
    if (!csv) return setNotice("There are no invalid rows to export.", "warning");
    downloadBlob(csv, `staff-import-errors-${today()}.csv`);
  }

  function exportStaffCsv() {
    const rows = [
      [
        "name",
        "slug",
        "photo_url",
        "qualifications",
        "email",
        "phone",
        "bio",
        "position_codes",
        "status",
        "sort_order",
      ],
      ...filteredStaff().map((person) => [
        person.full_name,
        person.slug || "",
        person.photo_url || person.profile_image || "",
        person.qualification || "",
        person.email || "",
        person.phone || "",
        person.bio || person.responsibilities || "",
        positionCodesForProfile(person).join(","),
        String(person.status || "Active").toLowerCase(),
        person.sort_order || person.sortOrder || 0,
      ]),
    ];
    const safeCell = (cell) => {
      const value = String(cell || "");
      return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    };
    const csv = rows
      .map((row) => row.map((cell) => `"${safeCell(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `loyola-staff-${today()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function locked(title, message) {
    app.innerHTML = `
      <main class="locked">
        <section>
          <img src="/loyola-crest.jpg" alt="" />
          <h1>${esc(title)}</h1>
          <p>${esc(message)}</p>
          <div class="top-actions">
            <a class="button primary" href="/login">Login</a>
            <a class="button ghost" href="/portal">Back to Portal</a>
          </div>
        </section>
      </main>
    `;
  }

  async function init() {
    if (!token()) {
      window.location.href = "/login";
      return;
    }

    try {
      state.user = await api("/api/me");
      if (!isManager()) {
        locked(
          "Staff system is locked",
          "Use a Master Admin, Super Admin, or Staff Admin account.",
        );
        return;
      }
      const hashView = location.hash.replace("#", "");
      if (modules.some(([id]) => id === hashView)) state.view = hashView;
      await loadCore();
      await loadViewData(state.view).catch(() => null);
      if (state.view === "form") await loadNextId();
      renderShell();
    } catch (error) {
      if (error.status === 401) {
        window.location.href = "/login";
        return;
      }
      locked("Staff system could not load", error.message || "Please try again.");
    }
  }

  init();
})();
