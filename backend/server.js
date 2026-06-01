const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { registerStaffRoutes } = require("./routes/staff");

dotenv.config();

const app = express();
const legacyUploadRoot = path.join(__dirname, "uploads");

function resolveUploadRoot() {
  const configured =
    process.env.UPLOAD_ROOT || process.env.UPLOAD_DIR || process.env.PERSISTENT_UPLOAD_DIR;
  if (configured && configured.trim()) return path.resolve(configured.trim());

  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (process.env.NODE_ENV === "production" && homeDir) {
    return path.join(homeDir, "loyola-platform", "uploads");
  }

  return legacyUploadRoot;
}

const uploadRoot = resolveUploadRoot();
const videoUploadDir = path.join(uploadRoot, "videos");
const reliefUploadDir = path.join(uploadRoot, "edutrack");

let sharp = null;
let ffmpeg = null;

try {
  sharp = require("sharp");
} catch {
  console.warn(
    "[uploads] sharp is not installed. Image uploads will fail until dependencies are installed.",
  );
}

try {
  ffmpeg = require("fluent-ffmpeg");
  try {
    ffmpeg.setFfmpegPath(require("@ffmpeg-installer/ffmpeg").path);
  } catch {
    // Use the system ffmpeg if the bundled binary is not installed.
  }
  try {
    ffmpeg.setFfprobePath(require("@ffprobe-installer/ffprobe").path);
  } catch {
    // Duration validation will report a clear error if ffprobe is unavailable.
  }
} catch {
  console.warn(
    "[uploads] fluent-ffmpeg is not installed. Video uploads will fail until dependencies are installed.",
  );
}

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const envOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
  console.warn("[security] Use a strong JWT_SECRET with at least 24 characters before production.");
}

function copyMissingUploads(sourceRoot, targetRoot) {
  const source = path.resolve(sourceRoot);
  const target = path.resolve(targetRoot);
  if (source === target || !fs.existsSync(source)) return;

  const copyDirectory = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const sourcePath = path.join(from, entry.name);
      const targetPath = path.join(to, entry.name);
      if (entry.isDirectory()) {
        copyDirectory(sourcePath, targetPath);
      } else if (entry.isFile() && !fs.existsSync(targetPath)) {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  };

  copyDirectory(source, target);
}

fs.mkdirSync(uploadRoot, { recursive: true });
copyMissingUploads(legacyUploadRoot, uploadRoot);
fs.mkdirSync(videoUploadDir, { recursive: true });
fs.mkdirSync(reliefUploadDir, { recursive: true });
app.disable("x-powered-by");
app.set("trust proxy", true);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "4mb" }));
const uploadStaticRoots = [uploadRoot, legacyUploadRoot].filter(
  (root, index, roots) =>
    fs.existsSync(root) &&
    roots.findIndex((candidate) => path.resolve(candidate) === path.resolve(root)) === index,
);

uploadStaticRoots.forEach((root, index) => {
  app.use(
    "/uploads",
    express.static(root, {
      fallthrough: index < uploadStaticRoots.length - 1,
      maxAge: "7d",
      setHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );
});

const rateBuckets = new Map();
function rateLimit({ windowMs, max, keyPrefix }) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${req.ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (bucket.resetAt < now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    if (bucket.count > max) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    next();
  };
}

function safePathSegment(value) {
  return String(value || "media")
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\/+/g, "/")
    .slice(0, 120);
}

function safeFileName(value) {
  const cleaned = String(value || "media")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "media";
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const MAX_SHORT_VIDEO_SECONDS = 120;

const IMAGE_UPLOAD_TYPES = new Set(["image/jpeg", "image/png"]);
const VIDEO_UPLOAD_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const DOCUMENT_UPLOAD_TYPES = new Set(["application/pdf"]);
const IMAGE_UPLOAD_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const VIDEO_UPLOAD_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);
const DOCUMENT_UPLOAD_EXTENSIONS = new Set([".pdf"]);

function uploadMediaKind(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mimetype = String(file.mimetype || "").toLowerCase();

  if (IMAGE_UPLOAD_TYPES.has(mimetype) && IMAGE_UPLOAD_EXTENSIONS.has(ext)) return "image";
  if (
    VIDEO_UPLOAD_EXTENSIONS.has(ext) &&
    (VIDEO_UPLOAD_TYPES.has(mimetype) || mimetype.startsWith("video/") || !mimetype)
  ) {
    return "short_video_upload";
  }
  if (DOCUMENT_UPLOAD_TYPES.has(mimetype) && DOCUMENT_UPLOAD_EXTENSIONS.has(ext)) return "document";
  return "";
}

function uploadSizeLimit(file) {
  const kind = uploadMediaKind(file);
  if (kind === "image") return MAX_IMAGE_BYTES;
  if (kind === "short_video_upload") return MAX_VIDEO_BYTES;
  return MAX_DOCUMENT_BYTES;
}

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      const folder = safePathSegment(req.query.folder || "media");
      const destination = path.join(uploadRoot, folder);
      const resolvedDestination = path.resolve(destination);

      if (!resolvedDestination.startsWith(path.resolve(uploadRoot))) {
        cb(new Error("Invalid upload folder"));
        return;
      }

      fs.mkdirSync(resolvedDestination, { recursive: true });
      cb(null, resolvedDestination);
    },
    filename(req, file, cb) {
      cb(null, `${Date.now()}-${safeFileName(file.originalname)}`);
    },
  }),
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  fileFilter(req, file, cb) {
    if (!uploadMediaKind(file)) {
      cb(new Error("Unsupported file type. Use JPG, PNG, PDF, MP4, MOV, or WebM."));
      return;
    }
    cb(null, true);
  },
});

const reliefUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      fs.mkdirSync(reliefUploadDir, { recursive: true });
      cb(null, reliefUploadDir);
    },
    filename(req, file, cb) {
      cb(null, `${Date.now()}-${safeFileName(file.originalname || "relief.pdf")}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mimetype = String(file.mimetype || "").toLowerCase();
    if (ext === ".pdf" && (!mimetype || mimetype === "application/pdf" || mimetype === "application/octet-stream")) {
      return cb(null, true);
    }
    cb(new Error("PDF required"));
  },
});

function handleReliefUpload(req, res, next) {
  reliefUpload.single("pdf")(req, res, (error) => {
    if (!error) return next();
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "PDF is too large. Relief PDFs are limited to 10 MB."
        : error.message || "Relief upload failed.";
    return res.status(400).json({ error: message });
  });
}

function handleSingleUpload(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "File is too large. Images are limited to 5 MB and short videos to 500 MB."
        : error.message || "Upload failed.";
    return res.status(400).json({ error: message });
  });
}

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const publicDbKeys = new Set([
  "contentVersion",
  "publishedAt",
  "websiteContent",
  "navigation",
  "pages",
  "homeSections",
  "aboutSections",
  "academicsSections",
  "eventsSections",
  "newsSections",
  "loginContent",
  "automation",
  "admissionsSteps",
  "forms",
  "media",
  "news",
  "events",
  "gallery",
  "videoGallery",
  "downloads",
  "teachers",
]);

let contentSchemaReady = false;
let eduTrackDocumentIdColumn = null;

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

const ROLE_ENUM_SQL = `
  ENUM(
    'masteradmin',
    'superadmin',
    'website_admin',
    'eduzync_admin',
    'staff_admin',
    'teacher',
    'student',
    'parent'
  ) NOT NULL DEFAULT 'student'
`;

const ROLE_ENUM_MIGRATION_SQL = `
  ENUM(
    'masteradmin',
    'superadmin',
    'website_admin',
    'eduzync_admin',
    'staff_admin',
    'teacher',
    'student',
    'parent',
    'admin'
  ) NOT NULL DEFAULT 'student'
`;

const ROLES = {
  master: "masteradmin",
  super: "superadmin",
  website: "website_admin",
  eduzync: "eduzync_admin",
  staff: "staff_admin",
  teacher: "teacher",
  student: "student",
  parent: "parent",
};

const SYSTEM_OWNER_ROLES = [ROLES.master, ROLES.super];
const WEBSITE_ADMIN_ROLES = [ROLES.master, ROLES.super, ROLES.website];
const EDUZYNC_ADMIN_ROLES = [ROLES.master, ROLES.super, ROLES.eduzync];
const STAFF_ADMIN_ROLES = [ROLES.master, ROLES.super, ROLES.staff];
const SCHOOL_DATA_READ_ROLES = [ROLES.master, ROLES.super, ROLES.eduzync, ROLES.teacher];
const EDUTRACK_ROLES = [ROLES.master, ROLES.super, ROLES.eduzync, ROLES.teacher];
const REPORT_CARD_VIEW_ROLES = [
  ROLES.master,
  ROLES.super,
  ROLES.eduzync,
  ROLES.teacher,
  ROLES.student,
  ROLES.parent,
];

const rolePermissionsSeed = [
  [ROLES.master, "website_admin", 1, 1, 1, 1],
  [ROLES.master, "eduzync", 1, 1, 1, 1],
  [ROLES.master, "edutrack", 1, 1, 1, 1],
  [ROLES.master, "elms", 1, 1, 1, 1],
  [ROLES.master, "report_cards", 1, 1, 1, 1],
  [ROLES.master, "staff", 1, 1, 1, 1],
  [ROLES.master, "users", 1, 1, 1, 1],
  [ROLES.super, "website_admin", 1, 1, 1, 1],
  [ROLES.super, "eduzync", 1, 1, 1, 1],
  [ROLES.super, "edutrack", 1, 1, 1, 1],
  [ROLES.super, "elms", 1, 1, 1, 1],
  [ROLES.super, "report_cards", 1, 1, 1, 1],
  [ROLES.super, "staff", 1, 1, 1, 1],
  [ROLES.super, "users", 1, 1, 1, 0],
  [ROLES.staff, "staff", 1, 1, 1, 1],
  [ROLES.website, "website_admin", 1, 1, 1, 0],
  [ROLES.website, "media", 1, 1, 1, 0],
  [ROLES.website, "news", 1, 1, 1, 0],
  [ROLES.website, "notices", 1, 1, 1, 0],
  [ROLES.website, "events", 1, 1, 1, 0],
  [ROLES.eduzync, "eduzync", 1, 1, 1, 1],
  [ROLES.eduzync, "students", 1, 1, 1, 1],
  [ROLES.eduzync, "teachers", 1, 1, 1, 1],
  [ROLES.eduzync, "parents", 1, 1, 1, 1],
  [ROLES.eduzync, "classes", 1, 1, 1, 1],
  [ROLES.eduzync, "subjects", 1, 1, 1, 1],
  [ROLES.eduzync, "edutrack", 1, 1, 1, 0],
  [ROLES.eduzync, "report_cards", 1, 1, 1, 0],
  [ROLES.teacher, "edutrack", 1, 1, 1, 0],
  [ROLES.teacher, "elms", 1, 1, 1, 0],
  [ROLES.teacher, "report_cards", 1, 1, 1, 0],
  [ROLES.teacher, "students", 1, 0, 0, 0],
  [ROLES.teacher, "subjects", 1, 0, 0, 0],
  [ROLES.student, "elms", 1, 0, 0, 0],
  [ROLES.student, "report_cards", 1, 0, 0, 0],
  [ROLES.student, "profile", 1, 0, 0, 0],
  [ROLES.student, "notices", 1, 0, 0, 0],
  [ROLES.parent, "child_profile", 1, 0, 0, 0],
  [ROLES.parent, "report_cards", 1, 0, 0, 0],
  [ROLES.parent, "notices", 1, 0, 0, 0],
];

let accessSchemaReady = false;

async function seedRolePermissions() {
  for (const permission of rolePermissionsSeed) {
    await db.query(
      `
        INSERT INTO role_permissions
          (role, app_key, can_view, can_create, can_edit, can_delete)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          can_view = VALUES(can_view),
          can_create = VALUES(can_create),
          can_edit = VALUES(can_edit),
          can_delete = VALUES(can_delete)
      `,
      permission,
    );
  }
}

async function ensureAccessTables() {
  if (accessSchemaReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      role ${ROLE_ENUM_SQL},
      status VARCHAR(30) NOT NULL DEFAULT 'Active',
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      role VARCHAR(50) NOT NULL,
      app_key VARCHAR(100) NOT NULL,
      can_view BOOLEAN DEFAULT 1,
      can_create BOOLEAN DEFAULT 0,
      can_edit BOOLEAN DEFAULT 0,
      can_delete BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_role_app (role, app_key)
    )
  `);

  await db.query(`ALTER TABLE users MODIFY role ${ROLE_ENUM_MIGRATION_SQL}`);
  await db.query("UPDATE users SET role = ? WHERE role = 'admin'", [ROLES.website]);
  await db.query(`ALTER TABLE users MODIFY role ${ROLE_ENUM_SQL}`);
  await seedRolePermissions();
  accessSchemaReady = true;
}

async function ensureTableColumns(tableName, columns) {
  const [existingColumns] = await db.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [tableName],
  );
  const existingNames = new Set(existingColumns.map((column) => column.COLUMN_NAME));
  for (const column of columns) {
    if (existingNames.has(column.name)) continue;
    await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${column.definition}`);
  }
}

async function ensureTableIndexes(tableName, indexes) {
  const [existingIndexes] = await db.query(
    `
      SELECT DISTINCT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [tableName],
  );
  const existingNames = new Set(existingIndexes.map((index) => index.INDEX_NAME));
  for (const index of indexes) {
    if (existingNames.has(index.name)) continue;
    await db.query(index.sql);
  }
}

async function ensurePublishRequestsSchema() {
  await ensureTableColumns("publish_requests", [
    { name: "requested_by", definition: "requested_by VARCHAR(50) NULL AFTER id" },
    {
      name: "requested_by_email",
      definition: "requested_by_email VARCHAR(190) NULL AFTER requested_by",
    },
    {
      name: "requested_by_name",
      definition: "requested_by_name VARCHAR(150) NULL AFTER requested_by_email",
    },
    {
      name: "request_type",
      definition: "request_type VARCHAR(100) DEFAULT 'website_update' AFTER requested_by_name",
    },
    {
      name: "title",
      definition:
        "title VARCHAR(255) NOT NULL DEFAULT 'Website update approval' AFTER request_type",
    },
    { name: "description", definition: "description TEXT NULL AFTER title" },
    { name: "data", definition: "data LONGTEXT NULL AFTER description" },
    { name: "status", definition: "status VARCHAR(30) NOT NULL DEFAULT 'pending' AFTER data" },
    { name: "submitted_by", definition: "submitted_by VARCHAR(190) NULL AFTER status" },
    {
      name: "submitted_by_role",
      definition: "submitted_by_role VARCHAR(50) NULL AFTER submitted_by",
    },
    { name: "review_note", definition: "review_note TEXT NULL AFTER status" },
    { name: "reviewed_by", definition: "reviewed_by VARCHAR(50) NULL AFTER review_note" },
    {
      name: "reviewed_by_email",
      definition: "reviewed_by_email VARCHAR(190) NULL AFTER reviewed_by",
    },
    {
      name: "reviewed_by_name",
      definition: "reviewed_by_name VARCHAR(150) NULL AFTER reviewed_by_email",
    },
    { name: "reviewed_at", definition: "reviewed_at TIMESTAMP NULL AFTER reviewed_by_name" },
    { name: "published_by", definition: "published_by VARCHAR(50) NULL AFTER reviewed_at" },
    {
      name: "published_by_email",
      definition: "published_by_email VARCHAR(190) NULL AFTER published_by",
    },
    {
      name: "published_by_name",
      definition: "published_by_name VARCHAR(150) NULL AFTER published_by_email",
    },
    { name: "published_at", definition: "published_at TIMESTAMP NULL AFTER published_by_name" },
    {
      name: "created_at",
      definition: "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER published_at",
    },
    {
      name: "updated_at",
      definition:
        "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
    },
  ]);

  await db.query(
    "UPDATE publish_requests SET requested_by = 'legacy' WHERE requested_by IS NULL OR requested_by = ''",
  );
  await db.query(
    "UPDATE publish_requests SET status = 'pending' WHERE status IS NULL OR status = ''",
  );

  await ensureTableIndexes("publish_requests", [
    {
      name: "idx_publish_requests_status",
      sql: "CREATE INDEX idx_publish_requests_status ON publish_requests (status)",
    },
    {
      name: "idx_publish_requests_requested_by",
      sql: "CREATE INDEX idx_publish_requests_requested_by ON publish_requests (requested_by)",
    },
  ]);
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    if (req.user.role === "admin") req.user.role = ROLES.website;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function isAdminRole(role) {
  return [ROLES.master, ROLES.super, ROLES.website, ROLES.eduzync].includes(role);
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
}

function authRole(...allowedRoles) {
  return (req, res, next) => auth(req, res, () => requireRole(...allowedRoles)(req, res, next));
}

function adminOnly(req, res, next) {
  return authRole(ROLES.master, ROLES.super)(req, res, next);
}

function websiteAdminOnly(req, res, next) {
  return authRole(...WEBSITE_ADMIN_ROLES)(req, res, next);
}

function eduzyncAdminOnly(req, res, next) {
  return authRole(...EDUZYNC_ADMIN_ROLES)(req, res, next);
}

function staffAdminOnly(req, res, next) {
  return authRole(...STAFF_ADMIN_ROLES)(req, res, next);
}

function schoolDataReadOnly(req, res, next) {
  return authRole(...SCHOOL_DATA_READ_ROLES)(req, res, next);
}

function teacherOrAdmin(req, res, next) {
  return authRole(...EDUTRACK_ROLES)(req, res, next);
}

function parseJsonField(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function publicDb(dbPayload) {
  const output = Object.fromEntries(
    Object.entries(dbPayload).filter(([key]) => publicDbKeys.has(key)),
  );
  if (Array.isArray(output.teachers)) {
    output.teachers = output.teachers.map((teacher) => {
      const { accountEmail, accountUserId, accountStatus, ...publicTeacher } = teacher || {};
      return publicTeacher;
    });
  }
  return output;
}

function serializeTeacherRow(row) {
  return {
    id: String(row.id || ""),
    staffId: row.staff_id || "",
    slug: row.slug || "",
    name: row.name || "",
    email: row.email || "",
    phone: row.phone || "",
    subject: row.subject || "",
    classes: row.classes || "",
    status: row.status || "Active",
    image: row.image || "",
    type: row.type || "",
    category: row.category || row.website_place || "",
    websitePlace: row.website_place || row.category || "",
    qualifications: row.qualifications || "",
    responsibilities: row.responsibilities || "",
    bio: row.bio || row.responsibilities || "",
    section: row.section || "",
    position: row.position || "",
    positions: parseJsonField(row.positions_json, []),
    positionCodes: parseJsonField(row.position_codes, []),
    sortOrder: Number(row.sort_order || 0),
    accountEmail: row.account_email || "",
    accountUserId: row.account_user_id || "",
  };
}

async function readTeacherSiteRows(runner = db) {
  const [rows] = await runner.query(`
    SELECT
      id,
      staff_id,
      slug,
      name,
      email,
      phone,
      subject,
      classes,
      status,
      image,
      type,
      category,
      website_place,
      qualifications,
      responsibilities,
      bio,
      section,
      position,
      positions_json,
      position_codes,
      sort_order,
      account_email,
      account_user_id,
      created_at
    FROM teachers
    WHERE name IS NOT NULL
      AND name <> ''
    ORDER BY
      CASE
        WHEN status = 'Active' THEN 0
        ELSE 1
      END,
      CASE
        WHEN id = COALESCE(NULLIF(staff_id, ''), id) THEN 1
        ELSE 0
      END,
      category,
      sort_order,
      name
  `);
  return rows.map(serializeTeacherRow);
}

async function withLiveTeacherRows(siteDb) {
  if (!isPlainObject(siteDb)) return siteDb;
  const teachers = await readTeacherSiteRows();
  if (!teachers.length) return siteDb;
  return {
    ...siteDb,
    teachers,
  };
}

function canReadPrivateDb(req) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  if (!token) return false;

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    if (user.role === "admin") user.role = ROLES.website;
    return WEBSITE_ADMIN_ROLES.includes(user.role);
  } catch {
    return false;
  }
}

function canManageSystemUsers(req) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  if (!token) return false;

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    if (user.role === "admin") user.role = ROLES.website;
    return SYSTEM_OWNER_ROLES.includes(user.role);
  } catch {
    return false;
  }
}

async function ensureContentTables() {
  if (contentSchemaReady) return;

  await ensureAccessTables();

  await db.query(`
    CREATE TABLE IF NOT EXISTS site_database (
      id VARCHAR(50) PRIMARY KEY,
      content LONGTEXT NOT NULL,
      content_version BIGINT NOT NULL,
      published_at VARCHAR(40) NOT NULL,
      draft_content LONGTEXT NULL,
      draft_content_version BIGINT NOT NULL DEFAULT 0,
      draft_updated_at VARCHAR(40) NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS publish_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      requested_by VARCHAR(50) NOT NULL,
      requested_by_email VARCHAR(190),
      requested_by_name VARCHAR(150),
      request_type VARCHAR(100) DEFAULT 'website_update',
      title VARCHAR(255) NOT NULL DEFAULT 'Website update approval',
      description TEXT,
      data LONGTEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      submitted_by VARCHAR(190),
      submitted_by_role VARCHAR(50),
      review_note TEXT,
      reviewed_by VARCHAR(50),
      reviewed_by_email VARCHAR(190),
      reviewed_by_name VARCHAR(150),
      reviewed_at TIMESTAMP NULL,
      published_by VARCHAR(50),
      published_by_email VARCHAR(190),
      published_by_name VARCHAR(150),
      published_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_publish_requests_status (status),
      KEY idx_publish_requests_requested_by (requested_by)
    )
  `);
  await ensurePublishRequestsSchema();

  await db.query(`
    CREATE TABLE IF NOT EXISTS students (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      grade VARCHAR(50) NOT NULL,
      section VARCHAR(50) NOT NULL,
      attendance INT DEFAULT 0,
      guardian VARCHAR(150),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id VARCHAR(50) PRIMARY KEY,
      staff_id VARCHAR(50) NULL,
      slug VARCHAR(180) NULL,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(190) NULL,
      phone VARCHAR(50) NULL,
      subject VARCHAR(100),
      classes VARCHAR(100),
      status VARCHAR(30) DEFAULT 'Active',
      position VARCHAR(150),
      website_place VARCHAR(120) NULL,
      type VARCHAR(100),
      category VARCHAR(100),
      section VARCHAR(100),
      qualifications TEXT,
      responsibilities TEXT,
      bio TEXT NULL,
      image TEXT,
      positions_json LONGTEXT NULL,
      position_codes LONGTEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      account_email VARCHAR(190),
      account_user_id VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS parents (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(50),
      children TEXT,
      status VARCHAR(30) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS classes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      grade VARCHAR(50),
      section VARCHAR(50),
      class_teacher_id VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      grade VARCHAR(50),
      section VARCHAR(50),
      teacher_id VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id VARCHAR(50) NOT NULL,
      class_id INT NOT NULL,
      academic_year VARCHAR(20),
      status VARCHAR(30) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS academic_terms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      level VARCHAR(50) NOT NULL,
      term_name VARCHAR(50) NOT NULL,
      start_date DATE,
      end_date DATE,
      warning_threshold INT DEFAULT 80,
      status VARCHAR(30) DEFAULT 'Not set',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS syllabus_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      subject_id INT NOT NULL,
      grade VARCHAR(50),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      term_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS syllabus_progress (
      id INT AUTO_INCREMENT PRIMARY KEY,
      teacher_id VARCHAR(50) NOT NULL,
      subject_id INT NOT NULL,
      syllabus_item_id INT NOT NULL,
      status ENUM('pending','completed') DEFAULT 'pending',
      completed_at TIMESTAMP NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS website_pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(150) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      content JSON,
      draft_json LONGTEXT NULL,
      published_json LONGTEXT NULL,
      published_at TIMESTAMP NULL,
      status VARCHAR(30) DEFAULT 'published',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS news (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_id VARCHAR(50) UNIQUE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      image_url TEXT,
      category VARCHAR(100),
      status VARCHAR(30) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS notices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_id VARCHAR(50) UNIQUE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      file_url TEXT,
      priority VARCHAR(50) DEFAULT 'normal',
      status VARCHAR(30) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_id VARCHAR(50) UNIQUE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      poster_url TEXT,
      event_date DATE,
      venue VARCHAR(255),
      status VARCHAR(30) DEFAULT 'upcoming',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS media_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_id VARCHAR(50) UNIQUE,
      file_name VARCHAR(255),
      file_url TEXT,
      webm_url TEXT,
      file_type VARCHAR(100),
      file_size INT,
      duration_seconds DECIMAL(8,2),
      folder VARCHAR(100),
      category VARCHAR(100),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS edutrack_documents (
      collection_name VARCHAR(80) NOT NULL,
      doc_id VARCHAR(120) NOT NULL,
      data LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (collection_name, doc_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS edutrack_relief_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      teacher_id VARCHAR(80),
      teacher_name VARCHAR(190),
      title VARCHAR(255) NOT NULL,
      assignment_date DATE,
      grade VARCHAR(50),
      section VARCHAR(50),
      subject_name VARCHAR(150),
      period_label VARCHAR(80),
      note TEXT,
      pdf_file_path TEXT,
      original_file_name VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending_print',
      uploaded_by_user_id VARCHAR(64),
      uploaded_by_name VARCHAR(190),
      uploaded_by_email VARCHAR(190),
      uploaded_teacher_id VARCHAR(80),
      uploaded_teacher_name VARCHAR(190),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      relief_teacher_id VARCHAR(80),
      relief_teacher_name VARCHAR(190),
      relief_teacher_position VARCHAR(150),
      relief_teacher_subject VARCHAR(150),
      print_count INT DEFAULT 0,
      allowed_extra_prints INT DEFAULT 0,
      printed_by_user_id VARCHAR(64),
      printed_by_name VARCHAR(190),
      printed_by_email VARCHAR(190),
      printed_at TIMESTAMP NULL,
      last_unlocked_by VARCHAR(64),
      last_unlocked_at TIMESTAMP NULL,
      last_unlock_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS edutrack_relief_assignment_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT,
      action VARCHAR(100) NOT NULL,
      actor_user_id VARCHAR(64),
      actor_name VARCHAR(190),
      actor_email VARCHAR(190),
      uploaded_teacher_id VARCHAR(80),
      uploaded_teacher_name VARCHAR(190),
      relief_teacher_id VARCHAR(80),
      relief_teacher_name VARCHAR(190),
      details LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS report_cards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id VARCHAR(50) NOT NULL,
      term VARCHAR(100) NOT NULL,
      academic_year VARCHAR(20),
      grade VARCHAR(50),
      section VARCHAR(50),
      remarks TEXT,
      published TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS report_card_subjects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      report_card_id INT NOT NULL,
      subject VARCHAR(150) NOT NULL,
      marks DECIMAL(5,2),
      grade VARCHAR(10),
      teacher_comment TEXT,
      FOREIGN KEY (report_card_id) REFERENCES report_cards(id) ON DELETE CASCADE
    )
  `);

  await addColumnIfMissing("news", "source_id", "VARCHAR(50) UNIQUE");
  await addColumnIfMissing("notices", "source_id", "VARCHAR(50) UNIQUE");
  await addColumnIfMissing("events", "source_id", "VARCHAR(50) UNIQUE");
  await addColumnIfMissing("media_files", "source_id", "VARCHAR(50) UNIQUE");
  await addColumnIfMissing("media_files", "webm_url", "TEXT");
  await addColumnIfMissing("media_files", "original_url", "TEXT");
  await addColumnIfMissing("media_files", "optimized_url", "TEXT");
  await addColumnIfMissing("media_files", "thumb_url", "TEXT");
  await addColumnIfMissing("media_files", "variant_urls", "LONGTEXT");
  await addColumnIfMissing("media_files", "duration_seconds", "DECIMAL(8,2)");
  await addColumnIfMissing("media_files", "original_size", "INT");
  await addColumnIfMissing("media_files", "category", "VARCHAR(100)");
  await addColumnIfMissing("media_files", "warnings", "LONGTEXT");
  await addColumnIfMissing("edutrack_relief_assignments", "uploaded_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  await addColumnIfMissing("edutrack_relief_assignments", "allowed_extra_prints", "INT DEFAULT 0");
  await addColumnIfMissing("edutrack_relief_assignments", "last_unlocked_by", "VARCHAR(64)");
  await addColumnIfMissing("edutrack_relief_assignments", "last_unlocked_at", "TIMESTAMP NULL");
  await addColumnIfMissing("edutrack_relief_assignments", "last_unlock_reason", "TEXT");
  await backfillMediaCategories();
  await addColumnIfMissing("teachers", "staff_id", "VARCHAR(50) NULL");
  await addColumnIfMissing("teachers", "slug", "VARCHAR(180) NULL");
  await addColumnIfMissing("teachers", "email", "VARCHAR(190) NULL");
  await addColumnIfMissing("teachers", "phone", "VARCHAR(50) NULL");
  await addColumnIfMissing("teachers", "website_place", "VARCHAR(120) NULL");
  await addColumnIfMissing("teachers", "positions_json", "LONGTEXT NULL");
  await addColumnIfMissing("teachers", "position_codes", "LONGTEXT NULL");
  await addColumnIfMissing("teachers", "bio", "TEXT NULL");
  await addColumnIfMissing("teachers", "sort_order", "INT NOT NULL DEFAULT 0");
  await addColumnIfMissing("teachers", "account_email", "VARCHAR(190)");
  await addColumnIfMissing("teachers", "account_user_id", "VARCHAR(50)");
  await ensureTableIndexes("teachers", [
    {
      name: "idx_teachers_staff_id",
      sql: "CREATE INDEX idx_teachers_staff_id ON teachers (staff_id)",
    },
  ]);
  await ensureSiteDatabaseSchema();
  await ensureWebsitePagesSchema();

  contentSchemaReady = true;
}

async function addColumnIfMissing(table, column, definition) {
  const safeTable = table.replace(/[^a-z0-9_]/gi, "");
  const safeColumn = column.replace(/[^a-z0-9_]/gi, "");
  const [rows] = await db.query(`SHOW COLUMNS FROM ${safeTable} LIKE ?`, [safeColumn]);
  if (rows.length > 0) return;
  await db.query(`ALTER TABLE ${safeTable} ADD COLUMN ${safeColumn} ${definition}`);
}

async function tableColumns(table) {
  const safeTable = table.replace(/[^a-z0-9_]/gi, "");
  const [columns] = await db.query(`SHOW COLUMNS FROM ${safeTable}`);
  return columns;
}

async function backfillMediaCategories() {
  const [rows] = await db.query(
    "SELECT id, folder, file_type FROM media_files WHERE category IS NULL OR category = ''",
  );

  for (const row of rows) {
    await db.query("UPDATE media_files SET category = ? WHERE id = ?", [
      mediaCategoryFromFolder(row.folder, row.file_type),
      row.id,
    ]);
  }
}

async function ensureSiteDatabaseSchema() {
  const columns = await tableColumns("site_database");
  const byName = new Map(columns.map((column) => [column.Field, column]));

  if (!byName.has("content")) {
    await db.query("ALTER TABLE site_database ADD COLUMN content LONGTEXT");
  }
  if (!byName.has("content_version")) {
    await db.query(
      "ALTER TABLE site_database ADD COLUMN content_version BIGINT NOT NULL DEFAULT 0",
    );
  }
  if (!byName.has("published_at")) {
    await db.query(
      "ALTER TABLE site_database ADD COLUMN published_at VARCHAR(40) NOT NULL DEFAULT ''",
    );
  }
  if (!byName.has("draft_content")) {
    await db.query("ALTER TABLE site_database ADD COLUMN draft_content LONGTEXT NULL");
  }
  if (!byName.has("draft_content_version")) {
    await db.query(
      "ALTER TABLE site_database ADD COLUMN draft_content_version BIGINT NOT NULL DEFAULT 0",
    );
  }
  if (!byName.has("draft_updated_at")) {
    await db.query("ALTER TABLE site_database ADD COLUMN draft_updated_at VARCHAR(40) NULL");
  }

  const idColumn = byName.get("id");
  if (
    idColumn &&
    !String(idColumn.Type || "")
      .toLowerCase()
      .startsWith("varchar")
  ) {
    await db.query("ALTER TABLE site_database MODIFY id VARCHAR(50) NOT NULL");
  }

  if (byName.has("data")) {
    await db.query(
      "UPDATE site_database SET content = data WHERE content IS NULL AND data IS NOT NULL",
    );
  }
}

async function ensureWebsitePagesSchema() {
  await addColumnIfMissing("website_pages", "slug", "VARCHAR(150)");
  await addColumnIfMissing("website_pages", "title", "VARCHAR(255)");
  await addColumnIfMissing("website_pages", "content", "LONGTEXT");
  await addColumnIfMissing("website_pages", "draft_json", "LONGTEXT NULL");
  await addColumnIfMissing("website_pages", "published_json", "LONGTEXT NULL");
  await addColumnIfMissing("website_pages", "published_at", "TIMESTAMP NULL");
  await addColumnIfMissing("website_pages", "status", "VARCHAR(30) DEFAULT 'published'");
  await addColumnIfMissing(
    "website_pages",
    "updated_at",
    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  );
}

async function getEduTrackDocumentIdColumn() {
  if (eduTrackDocumentIdColumn) return eduTrackDocumentIdColumn;

  const [columns] = await db.query("SHOW COLUMNS FROM edutrack_documents");
  const names = new Set(columns.map((column) => column.Field));

  if (names.has("doc_id")) {
    eduTrackDocumentIdColumn = "doc_id";
    return eduTrackDocumentIdColumn;
  }

  if (names.has("id")) {
    eduTrackDocumentIdColumn = "id";
    return eduTrackDocumentIdColumn;
  }

  await db.query("ALTER TABLE edutrack_documents ADD COLUMN doc_id VARCHAR(120)");
  eduTrackDocumentIdColumn = "doc_id";
  return eduTrackDocumentIdColumn;
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeAccountStatus(value) {
  return String(value || "Active").toLowerCase() === "active" ? "Active" : "Disabled";
}

function normalizePortalRole(value) {
  const role = value === "admin" ? ROLES.website : String(value || "");
  return Object.values(ROLES).includes(role) ? role : ROLES.website;
}

function scrubUserPasswords(siteDb) {
  if (!Array.isArray(siteDb.users)) return siteDb;
  return {
    ...siteDb,
    users: siteDb.users.map((user) => ({
      ...user,
      password: "",
    })),
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function removeStaffTeacherRows(siteDb, teacherId) {
  if (!isPlainObject(siteDb) || !Array.isArray(siteDb.teachers)) {
    return { changed: false, siteDb };
  }

  const normalizedTeacherId = String(teacherId || "").trim();
  const teachers = siteDb.teachers.filter(
    (teacher) =>
      String(teacher?.id || "").trim() !== normalizedTeacherId &&
      String(teacher?.staffId || teacher?.staff_id || "").trim() !== normalizedTeacherId,
  );

  if (teachers.length === siteDb.teachers.length) {
    return { changed: false, siteDb };
  }

  return { changed: true, siteDb: { ...siteDb, teachers } };
}

async function removeTeacherFromSiteDatabaseContent(runner, teacherId) {
  const normalizedTeacherId = String(teacherId || "").trim();
  if (!normalizedTeacherId) return false;

  const [rows] = await runner.query(
    "SELECT content, draft_content FROM site_database WHERE id = ? LIMIT 1 FOR UPDATE",
    ["main"],
  );
  if (!rows.length) return false;

  const contentVersion = Date.now();
  const publishedAt = new Date(contentVersion).toISOString();
  const contentResult = removeStaffTeacherRows(
    parseJsonField(rows[0].content, null),
    normalizedTeacherId,
  );
  const draftResult = removeStaffTeacherRows(
    parseJsonField(rows[0].draft_content, null),
    normalizedTeacherId,
  );

  if (!contentResult.changed && !draftResult.changed) return false;

  const updates = [];
  const values = [];

  if (contentResult.changed) {
    updates.push("content = ?", "content_version = ?", "published_at = ?");
    values.push(
      JSON.stringify(
        scrubUserPasswords({
          ...contentResult.siteDb,
          contentVersion,
          publishedAt,
        }),
      ),
      contentVersion,
      publishedAt,
    );
  }

  if (draftResult.changed) {
    updates.push("draft_content = ?", "draft_content_version = ?", "draft_updated_at = ?");
    values.push(
      JSON.stringify(
        scrubUserPasswords({
          ...draftResult.siteDb,
          contentVersion,
          publishedAt: draftResult.siteDb.publishedAt || publishedAt,
        }),
      ),
      contentVersion,
      publishedAt,
    );
  }

  values.push("main");
  await runner.query(`UPDATE site_database SET ${updates.join(", ")} WHERE id = ?`, values);
  return true;
}

async function syncTeacherAccountToEduTrack() {
  return { ok: true, skipped: true };
}

function protectPageSnapshot(siteDb, existingDb) {
  const incomingPages = isPlainObject(siteDb.pages) ? siteDb.pages : {};
  const existingPages = isPlainObject(existingDb?.pages) ? existingDb.pages : {};
  const incomingCount = Object.keys(incomingPages).length;
  const existingCount = Object.keys(existingPages).length;
  const missingHome = !isPlainObject(incomingPages.home);
  const likelyAccidentalMassDrop =
    existingCount >= 4 && incomingCount > 0 && incomingCount < Math.ceil(existingCount / 2);

  let nextDb = siteDb;

  if (existingCount > 0 && (incomingCount === 0 || missingHome || likelyAccidentalMassDrop)) {
    nextDb = {
      ...nextDb,
      pages: {
        ...existingPages,
        ...incomingPages,
      },
    };
  }

  if (
    (!Array.isArray(nextDb.navigation) || nextDb.navigation.length === 0) &&
    Array.isArray(existingDb?.navigation) &&
    existingDb.navigation.length > 0
  ) {
    nextDb = {
      ...nextDb,
      navigation: existingDb.navigation,
    };
  }

  if (!isPlainObject(nextDb.pages) || !isPlainObject(nextDb.pages.home)) {
    throw new Error("Refusing to publish a website database without the home page.");
  }

  return nextDb;
}

function shouldPreserveExistingArray(incoming, existing) {
  if (!Array.isArray(existing) || existing.length === 0) return false;
  if (!Array.isArray(incoming)) return true;
  if (incoming.length === 0) return true;
  return existing.length >= 6 && incoming.length < Math.ceil(existing.length / 2);
}

function mergeMediaSnapshot(incoming = {}, existing = {}) {
  if (!isPlainObject(existing)) return incoming;
  const next = isPlainObject(incoming) ? { ...incoming } : {};
  for (const [key, value] of Object.entries(existing)) {
    if ((next[key] == null || next[key] === "") && value) next[key] = value;
  }
  return next;
}

function mergeHomeSectionsSnapshot(incoming = {}, existing = {}) {
  if (!isPlainObject(existing)) return incoming;
  const next = isPlainObject(incoming) ? { ...incoming } : {};
  for (const key of ["rectorImage"]) {
    if (!next[key] && existing[key]) next[key] = existing[key];
  }

  if (shouldPreserveExistingArray(next.leadershipCards, existing.leadershipCards)) {
    next.leadershipCards = existing.leadershipCards;
  } else if (Array.isArray(next.leadershipCards) && Array.isArray(existing.leadershipCards)) {
    const existingById = new Map(existing.leadershipCards.map((card) => [card?.id, card]));
    next.leadershipCards = next.leadershipCards.map((card) => {
      const existingCard = existingById.get(card?.id);
      if (!existingCard) return card;
      return {
        ...card,
        image: card?.image || existingCard.image || "",
      };
    });
  }

  return next;
}

function protectPersistentContentSnapshot(siteDb, existingDb) {
  if (!isPlainObject(existingDb)) return siteDb;
  const nextDb = { ...siteDb };

  for (const key of [
    "news",
    "downloads",
    "events",
    "gallery",
    "videoGallery",
    "students",
    "parents",
    "messages",
    "teachers",
    "staffAttendance",
    "staffDocuments",
    "staffLeaveRequests",
    "staffNotices",
    "staffRoles",
  ]) {
    if (shouldPreserveExistingArray(nextDb[key], existingDb[key])) {
      nextDb[key] = existingDb[key];
    }
  }

  nextDb.media = mergeMediaSnapshot(nextDb.media, existingDb.media);
  nextDb.homeSections = mergeHomeSectionsSnapshot(nextDb.homeSections, existingDb.homeSections);
  return nextDb;
}

async function upsertPortalUserAccount(runner, user) {
  const accountId = String(user?.id || `U-${Date.now()}`).trim();
  const accountEmail = normalizeEmail(user?.email || "");
  const accountName = String(user?.name || accountEmail.split("@")[0] || "User")
    .trim()
    .slice(0, 150);
  const accountRole = normalizePortalRole(user?.role);
  const accountStatus = normalizeAccountStatus(user?.status || "Active");
  const password = typeof user?.password === "string" ? user.password : "";

  if (!accountId) throw new Error("User account id is required");
  if (!accountEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)) {
    throw new Error("A valid user account email is required");
  }

  const [emailMatches] = await runner.query("SELECT id FROM users WHERE email = ? LIMIT 1", [
    accountEmail,
  ]);
  const effectiveAccountId = emailMatches.length ? String(emailMatches[0].id) : accountId;

  const [idMatches] = await runner.query("SELECT id FROM users WHERE id = ? LIMIT 1", [
    effectiveAccountId,
  ]);
  const hasPassword = password.length > 0;

  if (!idMatches.length && !hasPassword) {
    throw new Error(`Password is required for new user account ${accountEmail}`);
  }

  if (hasPassword && password.length < 6) {
    throw new Error("User account password must be at least 6 characters");
  }

  if (idMatches.length) {
    if (hasPassword) {
      const passwordHash = await bcrypt.hash(password, 12);
      await runner.query(
        "UPDATE users SET name = ?, email = ?, role = ?, status = ?, password_hash = ? WHERE id = ?",
        [accountName, accountEmail, accountRole, accountStatus, passwordHash, effectiveAccountId],
      );
    } else {
      await runner.query(
        "UPDATE users SET name = ?, email = ?, role = ?, status = ? WHERE id = ?",
        [accountName, accountEmail, accountRole, accountStatus, effectiveAccountId],
      );
    }
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await runner.query(
      "INSERT INTO users (id, name, email, role, status, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
      [accountId, accountName, accountEmail, accountRole, accountStatus, passwordHash],
    );
  }
}

async function upsertTeacherUserAccount(runner, { id, name, email, password, status = "Active" }) {
  const requestedAccountId = String(id || "").trim();
  const accountEmail = normalizeEmail(email);
  const accountName = String(name || accountEmail.split("@")[0] || "Teacher").trim();
  const accountStatus = normalizeAccountStatus(status);

  if (!accountEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)) {
    throw new Error("A valid teacher account email is required");
  }

  const [emailMatches] = await runner.query("SELECT id FROM users WHERE email = ? LIMIT 1", [
    accountEmail,
  ]);
  const accountId =
    (emailMatches.length && String(emailMatches[0].id)) ||
    requestedAccountId ||
    `T-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  if (
    emailMatches.length &&
    requestedAccountId &&
    String(emailMatches[0].id) !== requestedAccountId
  ) {
    throw new Error("This email is already used by another user account");
  }

  const [idMatches] = await runner.query("SELECT id FROM users WHERE id = ? LIMIT 1", [accountId]);
  const hasPassword = typeof password === "string" && password.length > 0;
  if (!idMatches.length && !hasPassword) {
    throw new Error("Password is required for a new teacher account");
  }

  if (hasPassword && password.length < 6) {
    throw new Error("Teacher account password must be at least 6 characters");
  }

  if (idMatches.length) {
    if (hasPassword) {
      const passwordHash = await bcrypt.hash(password, 12);
      await runner.query(
        "UPDATE users SET name = ?, email = ?, role = 'teacher', status = ?, password_hash = ? WHERE id = ?",
        [accountName, accountEmail, accountStatus, passwordHash, accountId],
      );
    } else {
      await runner.query(
        "UPDATE users SET name = ?, email = ?, role = 'teacher', status = ? WHERE id = ?",
        [accountName, accountEmail, accountStatus, accountId],
      );
    }
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await runner.query(
      "INSERT INTO users (id, name, email, role, status, password_hash) VALUES (?, ?, ?, 'teacher', ?, ?)",
      [accountId, accountName, accountEmail, accountStatus, passwordHash],
    );
  }

  return {
    id: accountId,
    name: accountName,
    email: accountEmail,
    role: "teacher",
    status: accountStatus,
  };
}

function mysqlDateTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 19).replace("T", " ");
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function mysqlDate(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function deleteMissingQuery(table, column, values, onlySourceRows = false) {
  const safeTable = table.replace(/[^a-z0-9_]/gi, "");
  const safeColumn = column.replace(/[^a-z0-9_]/gi, "");
  if (values.length === 0) {
    return {
      sql: `DELETE FROM ${safeTable}${onlySourceRows ? ` WHERE ${safeColumn} IS NOT NULL` : ""}`,
      values: [],
    };
  }
  return {
    sql: `DELETE FROM ${safeTable} WHERE ${onlySourceRows ? `${safeColumn} IS NOT NULL AND ` : ""}${safeColumn} NOT IN (${values.map(() => "?").join(",")})`,
    values,
  };
}

function mediaSourceId(folder, url) {
  const hash = crypto.createHash("sha1").update(`${folder}:${url}`).digest("hex").slice(0, 18);
  return `M-${hash}`;
}

function inferFileName(url) {
  const cleanUrl = String(url).split("?")[0].split("#")[0];
  const last = cleanUrl.split("/").filter(Boolean).pop() || "media";
  try {
    return decodeURIComponent(last).slice(0, 255);
  } catch {
    return last.slice(0, 255);
  }
}

function inferFileType(url) {
  const lower = String(url).toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif|svg)(\?|#|$)/.test(lower)) return "image";
  if (/\.(mp4|webm|mov)(\?|#|$)/.test(lower)) return "video";
  if (/\.pdf(\?|#|$)/.test(lower)) return "document";
  return "file";
}

function mediaCategoryFromFolder(folder = "", fileType = "") {
  const cleanFolder = String(folder || "").toLowerCase();
  const cleanType = String(fileType || "").toLowerCase();

  if (cleanFolder.startsWith("pages/") || cleanFolder === "page-images") return "Page images";
  if (cleanFolder.includes("news")) return "News photos";
  if (cleanFolder.includes("event")) return "Event photos";
  if (cleanFolder.includes("gallery-videos") || cleanFolder.includes("video-gallery")) {
    return "Video gallery";
  }
  if (cleanFolder.includes("gallery")) return "Gallery photos";
  if (cleanFolder.includes("staff")) return "Staff profiles";
  if (cleanFolder.includes("notice") || cleanFolder.includes("download")) return "Documents";
  if (cleanFolder.includes("site")) return "Site assets";
  if (cleanType.includes("video")) return "Videos";
  if (cleanType.includes("image")) return "Photos";
  if (cleanType.includes("document") || cleanType.includes("pdf")) return "Documents";
  return "Other media";
}

function publicBaseUrl(req) {
  return (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function publicUploadUrl(req, absolutePath) {
  const relativePath = path.relative(uploadRoot, absolutePath).replace(/\\/g, "/");
  return `${publicBaseUrl(req)}/uploads/${relativePath}`;
}

function uniqueMediaBaseName(file) {
  const base = safeFileName(
    path.basename(file.originalname || "media", path.extname(file.originalname || "")),
  );
  const random = crypto.randomBytes(6).toString("hex");
  return `${Date.now()}-${random}-${base || "media"}`;
}

async function unlinkQuiet(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // The file may already be gone after a failed conversion cleanup.
  }
}

function requireSharp() {
  if (!sharp) {
    throw new Error(
      "Image processing is not available. Run npm install in backend to install sharp.",
    );
  }
}

function requireFfmpeg() {
  if (!ffmpeg) {
    throw new Error(
      "Video processing is not available. Run npm install in backend to install ffmpeg support.",
    );
  }
}

function probeVideo(filePath) {
  requireFfmpeg();
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        reject(new Error("Could not validate video duration. Make sure ffprobe is installed."));
        return;
      }
      resolve(metadata || {});
    });
  });
}

function transcodeVideo(inputPath, outputPath, options) {
  requireFfmpeg();
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .outputOptions(options)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

async function processImageUpload(req, file, folder) {
  requireSharp();
  const outputDirectory = path.join(uploadRoot, folder);
  await fs.promises.mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, `${uniqueMediaBaseName(file)}.webp`);

  try {
    await sharp(file.path)
      .rotate()
      .resize({ width: 2200, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toFile(outputPath);
  } finally {
    await unlinkQuiet(file.path);
  }

  const stat = await fs.promises.stat(outputPath);
  return {
    fileName: `${path.basename(file.originalname, path.extname(file.originalname))}.webp`,
    fileUrl: publicUploadUrl(req, outputPath),
    webmUrl: "",
    fileType: "image",
    mediaType: "image",
    fileSize: stat.size,
    durationSeconds: null,
  };
}

async function processStaffProfilePhotoUpload(req, file, folder) {
  requireSharp();
  const outputDirectory = path.join(uploadRoot, safePathSegment(folder));
  await fs.promises.mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, `${uniqueMediaBaseName(file)}-512.webp`);

  try {
    await sharp(file.path)
      .rotate()
      .resize({ width: 512, height: 512, fit: "cover", withoutEnlargement: true })
      .webp({ quality: 84, effort: 5 })
      .toFile(outputPath);
  } finally {
    await unlinkQuiet(file.path);
  }

  const stat = await fs.promises.stat(outputPath);
  const fileUrl = publicUploadUrl(req, outputPath);
  return {
    fileName: path.basename(outputPath),
    fileUrl,
    originalUrl: fileUrl,
    optimizedUrl: fileUrl,
    thumbUrl: "",
    webmUrl: "",
    variants: { staffProfile: fileUrl },
    fileType: "image",
    mediaType: "image",
    fileSize: stat.size,
    originalSize: Number(file.size || 0),
    durationSeconds: null,
  };
}

async function processVideoUpload(req, file) {
  requireFfmpeg();
  await fs.promises.mkdir(videoUploadDir, { recursive: true });

  const metadata = await probeVideo(file.path);
  const durationSeconds = Number(metadata.format?.duration || 0);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    await unlinkQuiet(file.path);
    throw new Error("Could not read video duration. Please upload a valid MP4, MOV, or WebM file.");
  }
  if (durationSeconds > MAX_SHORT_VIDEO_SECONDS) {
    await unlinkQuiet(file.path);
    throw new Error(
      "Video is longer than 2 minutes. For long videos, please use a YouTube link to save hosting storage and bandwidth.",
    );
  }

  const baseName = uniqueMediaBaseName(file);
  const mp4Path = path.join(videoUploadDir, `${baseName}.mp4`);
  const webmPath = path.join(videoUploadDir, `${baseName}.webm`);
  const scaleFilter =
    "scale=1280:720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2";

  try {
    await transcodeVideo(file.path, mp4Path, [
      "-map 0:v:0",
      "-map 0:a?",
      "-sn",
      "-vf",
      scaleFilter,
      "-c:v libx264",
      "-preset veryfast",
      "-crf 28",
      "-pix_fmt yuv420p",
      "-c:a aac",
      "-b:a 128k",
      "-ac 2",
      "-movflags +faststart",
    ]);

    await transcodeVideo(file.path, webmPath, [
      "-map 0:v:0",
      "-map 0:a?",
      "-sn",
      "-vf",
      scaleFilter,
      "-c:v libvpx-vp9",
      "-b:v 0",
      "-crf 34",
      "-deadline good",
      "-cpu-used 4",
      "-row-mt 1",
      "-c:a libopus",
      "-b:a 96k",
      "-ac 2",
    ]);
  } catch (error) {
    await unlinkQuiet(mp4Path);
    await unlinkQuiet(webmPath);
    throw new Error(`Video conversion failed: ${error.message || "Unknown ffmpeg error"}`);
  } finally {
    await unlinkQuiet(file.path);
  }

  const [mp4Stat, webmStat] = await Promise.all([
    fs.promises.stat(mp4Path),
    fs.promises.stat(webmPath),
  ]);

  return {
    fileName: `${path.basename(file.originalname, path.extname(file.originalname))}.mp4`,
    fileUrl: publicUploadUrl(req, mp4Path),
    webmUrl: publicUploadUrl(req, webmPath),
    fileType: "video",
    mediaType: "short_video_upload",
    fileSize: mp4Stat.size + webmStat.size,
    durationSeconds,
  };
}

async function processDocumentUpload(req, file, folder) {
  const outputDirectory = path.join(uploadRoot, folder);
  await fs.promises.mkdir(outputDirectory, { recursive: true });

  if (path.dirname(file.path) !== outputDirectory) {
    const outputPath = path.join(
      outputDirectory,
      `${uniqueMediaBaseName(file)}${path.extname(file.originalname)}`,
    );
    await fs.promises.rename(file.path, outputPath);
    file.path = outputPath;
  }

  return {
    fileName: file.originalname,
    fileUrl: publicUploadUrl(req, file.path),
    webmUrl: "",
    fileType: "document",
    mediaType: "document",
    fileSize: file.size,
    durationSeconds: null,
  };
}

async function processUploadedMedia(req, file, folder) {
  const kind = uploadMediaKind(file);
  if (kind === "image") return processImageUpload(req, file, folder);
  if (kind === "short_video_upload") return processVideoUpload(req, file);
  if (kind === "document") return processDocumentUpload(req, file, folder);
  await unlinkQuiet(file.path);
  throw new Error("Unsupported media type.");
}

async function readSiteDb({ draft = false } = {}) {
  await ensureContentTables();

  let [rows] = await db.query(
    "SELECT content, draft_content FROM site_database WHERE id = ? LIMIT 1",
    ["main"],
  );
  if (rows.length === 0) {
    [rows] = await db.query(
      "SELECT content, draft_content FROM site_database WHERE content IS NOT NULL OR draft_content IS NOT NULL ORDER BY updated_at DESC LIMIT 1",
    );
  }

  if (rows.length === 0) return null;
  if (draft && rows[0].draft_content) {
    return parseJsonField(rows[0].draft_content);
  }
  return parseJsonField(rows[0].content || rows[0].draft_content);
}

async function syncWebsitePages(
  connection,
  siteDb,
  { mode = "published", publishedAt = null } = {},
) {
  const pages = siteDb.pages && typeof siteDb.pages === "object" ? siteDb.pages : {};
  const navigation = Array.isArray(siteDb.navigation) ? siteDb.navigation : [];
  const navById = new Map(navigation.map((item) => [item.id, item]));
  const slugs = Object.keys(pages);

  for (const slug of slugs) {
    const page = pages[slug] || {};
    const nav = navById.get(slug);
    const title = String(page.title || nav?.label || slug).slice(0, 255);
    const status = nav?.visible === false ? "hidden" : "published";

    const pageJson = JSON.stringify(page);
    if (mode === "draft") {
      await connection.query(
        `
          INSERT INTO website_pages (slug, title, draft_json, status)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            draft_json = VALUES(draft_json),
            status = VALUES(status)
        `,
        [slug, title, pageJson, status],
      );
    } else {
      await connection.query(
        `
          INSERT INTO website_pages (slug, title, content, published_json, draft_json, status, published_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            content = VALUES(content),
            published_json = VALUES(published_json),
            draft_json = VALUES(draft_json),
            status = VALUES(status),
            published_at = VALUES(published_at)
        `,
        [slug, title, pageJson, pageJson, pageJson, status, publishedAt],
      );
    }
  }
}

async function syncNews(connection, siteDb) {
  const newsItems = Array.isArray(siteDb.news) ? siteDb.news : [];

  for (const item of newsItems) {
    await connection.query(
      `
        INSERT INTO news (source_id, title, description, image_url, category, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          description = VALUES(description),
          image_url = VALUES(image_url),
          category = VALUES(category),
          status = VALUES(status),
          created_at = VALUES(created_at)
      `,
      [
        item.id,
        String(item.title || "Untitled news").slice(0, 255),
        item.body || item.description || "",
        item.image || item.image_url || "",
        item.audience || item.category || "General",
        item.status || "published",
        mysqlDateTime(item.date || item.created_at),
      ],
    );
  }

  const cleanup = deleteMissingQuery(
    "news",
    "source_id",
    newsItems.map((item) => item.id).filter(Boolean),
    true,
  );
  await connection.query(cleanup.sql, cleanup.values);
}

async function syncNotices(connection, siteDb) {
  const downloads = Array.isArray(siteDb.downloads) ? siteDb.downloads : [];

  for (const item of downloads) {
    await connection.query(
      `
        INSERT INTO notices (source_id, title, description, file_url, priority, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          description = VALUES(description),
          file_url = VALUES(file_url),
          priority = VALUES(priority),
          status = VALUES(status),
          created_at = VALUES(created_at)
      `,
      [
        item.id,
        String(item.title || "Untitled notice").slice(0, 255),
        item.description || "",
        item.fileUrl || item.file_url || "",
        item.category || "normal",
        item.status || "published",
        mysqlDateTime(item.date || item.created_at),
      ],
    );
  }

  const cleanup = deleteMissingQuery(
    "notices",
    "source_id",
    downloads.map((item) => item.id).filter(Boolean),
    true,
  );
  await connection.query(cleanup.sql, cleanup.values);
}

async function syncEvents(connection, siteDb) {
  const events = Array.isArray(siteDb.events) ? siteDb.events : [];

  for (const item of events) {
    await connection.query(
      `
        INSERT INTO events (source_id, title, description, poster_url, event_date, venue, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          description = VALUES(description),
          poster_url = VALUES(poster_url),
          event_date = VALUES(event_date),
          venue = VALUES(venue),
          status = VALUES(status),
          created_at = VALUES(created_at)
      `,
      [
        item.id,
        String(item.title || "Untitled event").slice(0, 255),
        item.type || item.description || "",
        item.posterUrl || item.poster_url || "",
        mysqlDate(item.date || item.event_date),
        item.location || item.venue || "",
        item.status || "upcoming",
        mysqlDateTime(item.created_at || item.date),
      ],
    );
  }

  const cleanup = deleteMissingQuery(
    "events",
    "source_id",
    events.map((item) => item.id).filter(Boolean),
    true,
  );
  await connection.query(cleanup.sql, cleanup.values);
}

async function syncPortalUsers(connection, siteDb) {
  const users = Array.isArray(siteDb.users) ? siteDb.users : [];

  for (const user of users) {
    await upsertPortalUserAccount(connection, user);
  }
}

async function syncPeople(connection, siteDb) {
  const students = Array.isArray(siteDb.students) ? siteDb.students : [];
  const teachers = Array.isArray(siteDb.teachers) ? siteDb.teachers : [];
  const parents = Array.isArray(siteDb.parents) ? siteDb.parents : [];

  for (const item of students) {
    await connection.query(
      `
        INSERT INTO students (id, name, grade, section, attendance, guardian)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          grade = VALUES(grade),
          section = VALUES(section),
          attendance = VALUES(attendance),
          guardian = VALUES(guardian)
      `,
      [
        item.id,
        String(item.name || "Unnamed student").slice(0, 150),
        item.grade || "",
        item.section || "",
        Number(item.attendance || 0),
        item.guardian || "",
      ],
    );
  }

  for (const item of teachers) {
    const accountEmail = normalizeEmail(item.accountEmail || "");
    const requestedAccountUserId = String(item.accountUserId || "").trim();
    let linkedAccountUserId = null;

    if (requestedAccountUserId) {
      const [userMatches] = await connection.query("SELECT id FROM users WHERE id = ? LIMIT 1", [
        requestedAccountUserId,
      ]);

      if (userMatches.length) {
        linkedAccountUserId = requestedAccountUserId;
        if (accountEmail) {
          const user = await upsertTeacherUserAccount(connection, {
            id: requestedAccountUserId,
            name: item.name,
            email: accountEmail,
            status: item.accountStatus || "Active",
          });
          linkedAccountUserId = user.id;
        }
      }
    }

    await connection.query(
      `
        INSERT INTO teachers (
          id, staff_id, slug, name, email, phone, subject, classes, status, position,
          website_place, type, category, section, qualifications, responsibilities, bio,
          image, positions_json, position_codes, sort_order, account_email, account_user_id
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
          position = VALUES(position),
          website_place = VALUES(website_place),
          type = VALUES(type),
          category = VALUES(category),
          section = VALUES(section),
          qualifications = VALUES(qualifications),
          responsibilities = VALUES(responsibilities),
          bio = VALUES(bio),
          image = VALUES(image),
          positions_json = VALUES(positions_json),
          position_codes = VALUES(position_codes),
          sort_order = VALUES(sort_order),
          account_email = VALUES(account_email),
          account_user_id = VALUES(account_user_id)
      `,
      [
        item.id,
        item.staffId || item.staff_id || "",
        item.slug || "",
        String(item.name || "Unnamed staff").slice(0, 150),
        item.email || "",
        item.phone || "",
        item.subject || "",
        item.classes || "",
        item.status || "Active",
        item.position || "",
        item.websitePlace || item.website_place || item.category || "",
        item.type || "",
        item.category || "",
        item.section || "",
        item.qualifications || "",
        item.responsibilities || "",
        item.bio || item.responsibilities || "",
        item.image || "",
        JSON.stringify(Array.isArray(item.positions) ? item.positions : []),
        JSON.stringify(Array.isArray(item.positionCodes) ? item.positionCodes : []),
        Number(item.sortOrder || item.sort_order || 0),
        accountEmail,
        linkedAccountUserId,
      ],
    );
  }

  for (const item of parents) {
    await connection.query(
      `
        INSERT INTO parents (id, name, phone, children, status)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          phone = VALUES(phone),
          children = VALUES(children),
          status = VALUES(status)
      `,
      [
        item.id,
        String(item.name || "Unnamed parent").slice(0, 150),
        item.phone || "",
        item.children || "",
        item.status || "Active",
      ],
    );
  }

  for (const [table, ids] of [
    ["students", students.map((item) => item.id).filter(Boolean)],
    ["parents", parents.map((item) => item.id).filter(Boolean)],
  ]) {
    const cleanup = deleteMissingQuery(table, "id", ids);
    await connection.query(cleanup.sql, cleanup.values);
  }
}

function collectMedia(siteDb) {
  const media = [];
  const add = (folder, url, options = {}) => {
    if (!url || typeof url !== "string") return;
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith("data:")) return;
    media.push({
      source_id: mediaSourceId(folder, trimmed),
      file_name: inferFileName(trimmed),
      file_url: trimmed,
      webm_url: options.webmUrl || options.webm_url || "",
      file_type: options.fileType || inferFileType(trimmed),
      file_size: Number(options.fileSize || options.file_size || 0),
      duration_seconds: options.durationSeconds || options.duration_seconds || null,
      folder,
      category:
        options.category ||
        mediaCategoryFromFolder(folder, options.fileType || inferFileType(trimmed)),
    });
  };

  add("site", siteDb.websiteContent?.heroImage);
  add("site", siteDb.websiteContent?.backgroundMediaUrl);
  add("site", siteDb.websiteContent?.logoImage);
  add("site", siteDb.websiteContent?.seo?.ogImage);
  add("site", siteDb.media?.campusImage);
  add("site", siteDb.media?.aboutImage);
  add("site", siteDb.media?.principalImage);
  (siteDb.homeSections?.leadershipCards || []).forEach((item) => add("site", item.image));
  add("site", siteDb.homeSections?.rectorImage);

  Object.entries(siteDb.pages || {}).forEach(([slug, page]) => {
    add(`pages/${slug}`, page.image);
    add(`pages/${slug}`, page.backgroundMediaUrl);
    add(`pages/${slug}`, page.anthemVideoCoverImage);
  });

  (siteDb.news || []).forEach((item) => add("news", item.image || item.image_url));
  (siteDb.downloads || []).forEach((item) => add("notices", item.fileUrl || item.file_url));
  (siteDb.teachers || []).forEach((item) => add("staff", item.image));
  (siteDb.staffDocuments || []).forEach((item) => add("staff-documents", item.fileUrl));
  (siteDb.gallery || []).forEach((item) => {
    add("gallery", item.image);
    (item.images || []).forEach((image) => add("gallery", image));
  });
  (siteDb.videoGallery || []).forEach((item) => {
    add("video-gallery", item.coverImage);
    (item.videos || []).forEach((video) => {
      add("video-gallery", video.url, {
        webmUrl: video.webmUrl,
        fileType: video.source === "youtube" ? "youtube_video" : "video",
        fileSize: video.size,
        durationSeconds: video.durationSeconds,
      });
      add("video-gallery", video.thumbnail);
    });
  });

  return Array.from(new Map(media.map((item) => [item.source_id, item])).values());
}

async function syncMediaFiles(connection, siteDb) {
  const media = collectMedia(siteDb);

  for (const item of media) {
    await connection.query(
      `
        INSERT INTO media_files (source_id, file_name, file_url, webm_url, file_type, file_size, duration_seconds, folder, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          file_name = VALUES(file_name),
          file_url = VALUES(file_url),
          webm_url = VALUES(webm_url),
          file_type = VALUES(file_type),
          file_size = VALUES(file_size),
          duration_seconds = VALUES(duration_seconds),
          folder = VALUES(folder),
          category = VALUES(category)
      `,
      [
        item.source_id,
        item.file_name,
        item.file_url,
        item.webm_url || "",
        item.file_type,
        item.file_size,
        item.duration_seconds || null,
        item.folder,
        item.category,
      ],
    );
  }

  const cleanup = deleteMissingQuery(
    "media_files",
    "source_id",
    media.map((item) => item.source_id),
    true,
  );
  await connection.query(cleanup.sql, cleanup.values);
}

async function syncPublishedTables(connection, siteDb, { publishedAt = null } = {}) {
  await syncPortalUsers(connection, siteDb);
  await syncWebsitePages(connection, siteDb, { mode: "published", publishedAt });
  await syncNews(connection, siteDb);
  await syncNotices(connection, siteDb);
  await syncEvents(connection, siteDb);
  await syncPeople(connection, siteDb);
  await syncMediaFiles(connection, siteDb);
}

async function writeSiteDb(siteDb, { mode = "published" } = {}) {
  await ensureContentTables();

  const contentVersion = Date.now();
  const nowIso = new Date(contentVersion).toISOString();
  const existingDb = await readSiteDb({ draft: mode === "draft" });
  const publishedDb = mode === "draft" ? await readSiteDb({ draft: false }) : null;
  const protectedDb = protectPageSnapshot(siteDb, existingDb);
  const persistentDb = protectPersistentContentSnapshot(protectedDb, existingDb);
  const syncDb = {
    ...persistentDb,
    contentVersion,
    publishedAt: mode === "published" ? nowIso : persistentDb.publishedAt || nowIso,
  };
  const savedDb = scrubUserPasswords(syncDb);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    if (mode === "draft") {
      const publishedSnapshot = scrubUserPasswords(publishedDb || existingDb || savedDb);
      await connection.query(
        `
          INSERT INTO site_database (id, content, content_version, published_at, draft_content, draft_content_version, draft_updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            draft_content = VALUES(draft_content),
            draft_content_version = VALUES(draft_content_version),
            draft_updated_at = VALUES(draft_updated_at)
        `,
        [
          "main",
          JSON.stringify(publishedSnapshot),
          Number(publishedSnapshot.contentVersion || 0),
          publishedSnapshot.publishedAt || "",
          JSON.stringify(savedDb),
          contentVersion,
          nowIso,
        ],
      );

      await syncWebsitePages(connection, syncDb, { mode: "draft" });
    } else {
      await connection.query(
        `
          INSERT INTO site_database (id, content, content_version, published_at, draft_content, draft_content_version, draft_updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            content = VALUES(content),
            content_version = VALUES(content_version),
            published_at = VALUES(published_at),
            draft_content = VALUES(draft_content),
            draft_content_version = VALUES(draft_content_version),
            draft_updated_at = VALUES(draft_updated_at)
        `,
        [
          "main",
          JSON.stringify(savedDb),
          contentVersion,
          nowIso,
          JSON.stringify(savedDb),
          contentVersion,
          nowIso,
        ],
      );

      await syncPublishedTables(connection, syncDb, { publishedAt: mysqlDateTime(nowIso) });
    }
    await connection.commit();
    return { db: savedDb, contentVersion, storage: "mysql", mode };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function actorFromRequest(req) {
  return {
    id: String(req.user?.id || req.user?.email || "unknown").slice(0, 50),
    email: req.user?.email ? String(req.user.email).slice(0, 190) : null,
    name: req.user?.name ? String(req.user.name).slice(0, 150) : null,
  };
}

function dateField(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function serializePublishRequest(row, includeData = false) {
  const request = {
    id: row.id,
    requested_by: row.requested_by,
    requested_by_email: row.requested_by_email,
    requested_by_name: row.requested_by_name,
    status: row.status,
    review_note: row.review_note || "",
    reviewed_by: row.reviewed_by,
    reviewed_by_email: row.reviewed_by_email,
    reviewed_by_name: row.reviewed_by_name,
    reviewed_at: dateField(row.reviewed_at),
    published_by: row.published_by,
    published_by_email: row.published_by_email,
    published_by_name: row.published_by_name,
    published_at: dateField(row.published_at),
    created_at: dateField(row.created_at),
    updated_at: dateField(row.updated_at),
  };

  if (includeData) request.data = parseJsonField(row.data, {});
  return request;
}

async function fetchPublishRequest(id) {
  const [rows] = await db.query("SELECT * FROM publish_requests WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}

app.get("/api/health", async (req, res) => {
  try {
    await ensureAccessTables();
    const [rows] = await db.query("SELECT 1 AS ok");

    res.json({
      status: "ok",
      database: rows[0].ok === 1,
      dbName: process.env.DB_NAME,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

app.get("/api/users", adminOnly, async (req, res) => {
  try {
    await ensureAccessTables();
    const [rows] = await db.query("SELECT id, name, email, role, status, created_at FROM users");

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/staff-accounts", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const { teacherId, name, email, password = "", status = "Active" } = req.body || {};

    const user = await upsertTeacherUserAccount(db, {
      id: teacherId,
      name,
      email,
      password,
      status,
    });

    res.json({ success: true, user });
  } catch (error) {
    const statusCode =
      /already used|valid teacher account|Password is required|at least 6|id is required/i.test(
        error.message,
      )
        ? 400
        : 500;
    res.status(statusCode).json({ error: error.message });
  }
});

app.delete("/api/staff-accounts/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [result] = await db.query(
      "UPDATE users SET status = 'Disabled' WHERE id = ? AND role = 'teacher'",
      [req.params.id],
    );
    res.json({ success: true, disabled: result.affectedRows > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/site-db", async (req, res) => {
  try {
    const requesterCanReadPrivate = canReadPrivateDb(req);
    const useDraft =
      requesterCanReadPrivate &&
      (req.query.draft === "1" || req.headers["x-loyola-draft"] === "true");
    const siteDb = await readSiteDb({ draft: useDraft });
    if (!siteDb) {
      const staffOnlyDb = await withLiveTeacherRows({});
      return res.json({
        db: staffOnlyDb.teachers?.length
          ? requesterCanReadPrivate
            ? staffOnlyDb
            : publicDb(staffOnlyDb)
          : null,
        found: Boolean(staffOnlyDb.teachers?.length),
        storage: "mysql",
        mode: useDraft ? "draft" : "published",
      });
    }
    const dbWithStaff = await withLiveTeacherRows(siteDb);

    res.json({
      db: requesterCanReadPrivate ? dbWithStaff : publicDb(dbWithStaff),
      found: true,
      storage: "mysql",
      mode: useDraft ? "draft" : "published",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/site-db", adminOnly, async (req, res) => {
  try {
    if (!req.body?.db || typeof req.body.db !== "object") {
      return res.status(400).json({ error: "Missing db payload" });
    }

    const saved = await writeSiteDb(req.body.db, { mode: "published" });
    res.json({ ok: true, ...saved });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/site-db/draft", websiteAdminOnly, async (req, res) => {
  try {
    if (!req.body?.db || typeof req.body.db !== "object") {
      return res.status(400).json({ error: "Missing db payload" });
    }

    const saved = await writeSiteDb(req.body.db, { mode: "draft" });
    res.json({ ok: true, ...saved });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/site-db/publish", adminOnly, async (req, res) => {
  try {
    const incomingDb = req.body?.db && typeof req.body.db === "object" ? req.body.db : null;
    const draftDb = incomingDb || (await readSiteDb({ draft: true }));
    if (!draftDb || typeof draftDb !== "object") {
      return res.status(400).json({ error: "No draft content is available to publish." });
    }

    const saved = await writeSiteDb(draftDb, { mode: "published" });
    res.json({ ok: true, ...saved });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/publish-requests", authRole(ROLES.website), async (req, res) => {
  try {
    await ensureContentTables();

    if (!req.body?.db || typeof req.body.db !== "object") {
      return res.status(400).json({ error: "Missing db payload" });
    }

    const actor = actorFromRequest(req);
    const data = scrubUserPasswords(req.body.db);
    const [result] = await db.query(
      `
        INSERT INTO publish_requests
          (
            requested_by,
            requested_by_email,
            requested_by_name,
            request_type,
            title,
            description,
            data,
            status,
            submitted_by,
            submitted_by_role
          )
        VALUES (?, ?, ?, 'website_update', ?, ?, ?, 'pending', ?, ?)
      `,
      [
        actor.id,
        actor.email,
        actor.name,
        "Website update approval",
        "Full site database snapshot submitted for approval.",
        JSON.stringify(data),
        actor.email,
        req.user?.role || ROLES.website,
      ],
    );

    const request = await fetchPublishRequest(result.insertId);
    res.status(201).json({
      ok: true,
      request: serializePublishRequest(request, true),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/publish-requests", adminOnly, async (req, res) => {
  try {
    await ensureContentTables();

    const allowedStatuses = new Set(["pending", "approved", "rejected", "published"]);
    const status = String(req.query.status || "")
      .trim()
      .toLowerCase();
    const where = allowedStatuses.has(status) ? "WHERE status = ?" : "";
    const values = allowedStatuses.has(status) ? [status] : [];
    const [rows] = await db.query(
      `
        SELECT *
        FROM publish_requests
        ${where}
        ORDER BY
          CASE status
            WHEN 'pending' THEN 1
            WHEN 'approved' THEN 2
            WHEN 'rejected' THEN 3
            WHEN 'published' THEN 4
            ELSE 5
          END,
          created_at DESC
        LIMIT 200
      `,
      values,
    );

    res.json({ requests: rows.map((row) => serializePublishRequest(row)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/publish-requests/mine", authRole(ROLES.website), async (req, res) => {
  try {
    await ensureContentTables();
    const actor = actorFromRequest(req);
    const [rows] = await db.query(
      `
        SELECT *
        FROM publish_requests
        WHERE requested_by = ?
           OR requested_by_email = ?
           OR submitted_by = ?
        ORDER BY created_at DESC
        LIMIT 100
      `,
      [actor.id, actor.email, actor.email],
    );

    res.json({ requests: rows.map((row) => serializePublishRequest(row)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/publish-requests/:id", adminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const request = await fetchPublishRequest(req.params.id);
    if (!request) return res.status(404).json({ error: "Publish request not found" });
    res.json({ request: serializePublishRequest(request, true) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/publish-requests/:id/approve", adminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const request = await fetchPublishRequest(req.params.id);
    if (!request) return res.status(404).json({ error: "Publish request not found" });
    if (request.status === "published") {
      return res.status(409).json({ error: "Published requests cannot be approved again." });
    }

    const actor = actorFromRequest(req);
    const reviewNote = String(req.body?.reviewNote || req.body?.review_note || "").trim();
    await db.query(
      `
        UPDATE publish_requests
        SET status = 'approved',
            review_note = ?,
            reviewed_by = ?,
            reviewed_by_email = ?,
            reviewed_by_name = ?,
            reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [reviewNote || null, actor.id, actor.email, actor.name, req.params.id],
    );

    const updated = await fetchPublishRequest(req.params.id);
    res.json({ ok: true, request: serializePublishRequest(updated, true) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/publish-requests/:id/reject", adminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const request = await fetchPublishRequest(req.params.id);
    if (!request) return res.status(404).json({ error: "Publish request not found" });
    if (request.status === "published") {
      return res.status(409).json({ error: "Published requests cannot be rejected." });
    }

    const reviewNote = String(req.body?.reviewNote || req.body?.review_note || "").trim();
    if (!reviewNote) {
      return res.status(400).json({ error: "A review note is required when rejecting." });
    }

    const actor = actorFromRequest(req);
    await db.query(
      `
        UPDATE publish_requests
        SET status = 'rejected',
            review_note = ?,
            reviewed_by = ?,
            reviewed_by_email = ?,
            reviewed_by_name = ?,
            reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [reviewNote, actor.id, actor.email, actor.name, req.params.id],
    );

    const updated = await fetchPublishRequest(req.params.id);
    res.json({ ok: true, request: serializePublishRequest(updated, true) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/publish-requests/:id/publish", adminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const request = await fetchPublishRequest(req.params.id);
    if (!request) return res.status(404).json({ error: "Publish request not found" });
    if (request.status !== "approved") {
      return res.status(409).json({ error: "Only approved requests can be published." });
    }

    const siteDb = parseJsonField(request.data, null);
    if (!siteDb || typeof siteDb !== "object") {
      return res.status(400).json({ error: "Publish request contains invalid site data." });
    }

    const saved = await writeSiteDb(siteDb);
    const actor = actorFromRequest(req);
    await db.query(
      `
        UPDATE publish_requests
        SET status = 'published',
            published_by = ?,
            published_by_email = ?,
            published_by_name = ?,
            published_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [actor.id, actor.email, actor.name, req.params.id],
    );

    const updated = await fetchPublishRequest(req.params.id);
    res.json({ ok: true, request: serializePublishRequest(updated, true), ...saved });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pages", async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT slug, title, COALESCE(published_json, content) AS content, status, published_at, updated_at FROM website_pages ORDER BY slug ASC",
    );

    res.json(
      rows.map((row) => ({
        ...row,
        content: parseJsonField(row.content, {}),
      })),
    );
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/api/pages/:slug", async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT slug, title, COALESCE(published_json, content) AS content, status, published_at, updated_at FROM website_pages WHERE slug = ? LIMIT 1",
      [req.params.slug],
    );

    if (!rows.length || rows[0].status === "hidden") {
      return res.status(404).json({ error: "Page not found" });
    }

    res.json({
      ...rows[0],
      content: parseJsonField(rows[0].content, {}),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pages/:slug/draft", websiteAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT slug, title, COALESCE(draft_json, published_json, content) AS content, status, published_at, updated_at FROM website_pages WHERE slug = ? LIMIT 1",
      [req.params.slug],
    );

    if (!rows.length) return res.status(404).json({ error: "Draft page not found" });

    res.json({
      ...rows[0],
      content: parseJsonField(rows[0].content, {}),
      mode: "draft",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pages/:slug/draft", websiteAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const pageContent = req.body?.content;
    if (!pageContent || typeof pageContent !== "object") {
      return res.status(400).json({ error: "Missing page content payload" });
    }

    const slug = req.params.slug;
    const draftDb = (await readSiteDb({ draft: true })) || (await readSiteDb()) || {};
    const nextDb = {
      ...draftDb,
      pages: {
        ...(draftDb.pages || {}),
        [slug]: pageContent,
      },
    };
    const saved = await writeSiteDb(nextDb, { mode: "draft" });

    res.json({ ok: true, slug, content: pageContent, ...saved });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pages/:slug/publish", adminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const slug = req.params.slug;
    const draftDb = (await readSiteDb({ draft: true })) || (await readSiteDb());
    if (!draftDb?.pages?.[slug]) {
      return res.status(404).json({ error: "Draft page not found" });
    }

    const pageContent =
      req.body?.content && typeof req.body.content === "object"
        ? req.body.content
        : draftDb.pages[slug];
    const nextDb = {
      ...draftDb,
      pages: {
        ...draftDb.pages,
        [slug]: pageContent,
      },
    };
    const saved = await writeSiteDb(nextDb, { mode: "published" });

    res.json({ ok: true, slug, content: pageContent, ...saved });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/news", async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT id, source_id, title, description, image_url, category, status, created_at FROM news ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/notices", async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT id, source_id, title, description, file_url, priority, status, created_at FROM notices ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/events", async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT id, source_id, title, description, poster_url, event_date, venue, status, created_at FROM events ORDER BY event_date DESC, created_at DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/media", async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT id, source_id, file_name, file_url, webm_url, file_type, file_size, duration_seconds, folder, category, uploaded_at FROM media_files ORDER BY uploaded_at DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/students", schoolDataReadOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT id, name, grade, section, attendance, guardian, created_at FROM students ORDER BY grade, section, name",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/students", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const {
      id = `S-${Date.now()}`,
      name,
      grade = "",
      section = "",
      attendance = 0,
      guardian = "",
    } = req.body || {};

    if (!name) return res.status(400).json({ error: "Student name is required" });

    await db.query(
      "INSERT INTO students (id, name, grade, section, attendance, guardian) VALUES (?, ?, ?, ?, ?, ?)",
      [id, name, grade, section, Number(attendance || 0), guardian],
    );

    res.status(201).json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/students/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const { name, grade = "", section = "", attendance = 0, guardian = "" } = req.body || {};

    if (!name) return res.status(400).json({ error: "Student name is required" });

    const [result] = await db.query(
      "UPDATE students SET name = ?, grade = ?, section = ?, attendance = ?, guardian = ? WHERE id = ?",
      [name, grade, section, Number(attendance || 0), guardian, req.params.id],
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Student not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/students/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [result] = await db.query("DELETE FROM students WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Student not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/teachers", async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT id, staff_id, slug, name, email, phone, subject, classes, status, image, type, category, website_place, qualifications, responsibilities, bio, section, position, positions_json, position_codes, sort_order, created_at FROM teachers ORDER BY category, sort_order, name",
    );
    res.json(rows.map(serializeTeacherRow));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/teachers", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const {
      id = `T-${Date.now()}`,
      name,
      subject = "",
      classes = "",
      status = "Active",
      image = "",
      type = "",
      category = "",
      qualifications = "",
      responsibilities = "",
      section = "",
      position = "",
    } = req.body || {};

    if (!name) return res.status(400).json({ error: "Teacher name is required" });

    await db.query(
      `
        INSERT INTO teachers
          (id, name, subject, classes, status, image, type, category, qualifications, responsibilities, section, position)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        name,
        subject,
        classes,
        status,
        image,
        type,
        category,
        qualifications,
        responsibilities,
        section,
        position,
      ],
    );

    res.status(201).json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/teachers/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const {
      name,
      subject = "",
      classes = "",
      status = "Active",
      image = "",
      type = "",
      category = "",
      qualifications = "",
      responsibilities = "",
      section = "",
      position = "",
    } = req.body || {};

    if (!name) return res.status(400).json({ error: "Teacher name is required" });

    const [result] = await db.query(
      `
        UPDATE teachers
        SET name = ?, subject = ?, classes = ?, status = ?, image = ?, type = ?,
          category = ?, qualifications = ?, responsibilities = ?, section = ?, position = ?
        WHERE id = ?
      `,
      [
        name,
        subject,
        classes,
        status,
        image,
        type,
        category,
        qualifications,
        responsibilities,
        section,
        position,
        req.params.id,
      ],
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Teacher not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/teachers/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [result] = await db.query("DELETE FROM teachers WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Teacher not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/parents", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT id, name, phone, children, status, created_at FROM parents ORDER BY name",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/parents", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const {
      id = `P-${Date.now()}`,
      name,
      phone = "",
      children = "",
      status = "Active",
    } = req.body || {};

    if (!name) return res.status(400).json({ error: "Parent name is required" });

    await db.query(
      "INSERT INTO parents (id, name, phone, children, status) VALUES (?, ?, ?, ?, ?)",
      [id, name, phone, children, status],
    );

    res.status(201).json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/parents/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const { name, phone = "", children = "", status = "Active" } = req.body || {};

    if (!name) return res.status(400).json({ error: "Parent name is required" });

    const [result] = await db.query(
      "UPDATE parents SET name = ?, phone = ?, children = ?, status = ? WHERE id = ?",
      [name, phone, children, status, req.params.id],
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Parent not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/parents/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [result] = await db.query("DELETE FROM parents WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Parent not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/classes", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT id, name, grade, section, class_teacher_id, created_at FROM classes ORDER BY grade, section, name",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/classes", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const { name, grade = "", section = "", class_teacher_id = "" } = req.body || {};

    if (!name) return res.status(400).json({ error: "Class name is required" });

    const [result] = await db.query(
      "INSERT INTO classes (name, grade, section, class_teacher_id) VALUES (?, ?, ?, ?)",
      [name, grade, section, class_teacher_id],
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/classes/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const { name, grade = "", section = "", class_teacher_id = "" } = req.body || {};

    if (!name) return res.status(400).json({ error: "Class name is required" });

    const [result] = await db.query(
      "UPDATE classes SET name = ?, grade = ?, section = ?, class_teacher_id = ? WHERE id = ?",
      [name, grade, section, class_teacher_id, Number(req.params.id)],
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Class not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/classes/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [result] = await db.query("DELETE FROM classes WHERE id = ?", [Number(req.params.id)]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Class not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/subjects", schoolDataReadOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT id, name, grade, section, teacher_id, created_at FROM subjects ORDER BY grade, section, name",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/subjects", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const { name, grade = "", section = "", teacher_id = "" } = req.body || {};

    if (!name) return res.status(400).json({ error: "Subject name is required" });

    const [result] = await db.query(
      "INSERT INTO subjects (name, grade, section, teacher_id) VALUES (?, ?, ?, ?)",
      [name, grade, section, teacher_id],
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/subjects/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const { name, grade = "", section = "", teacher_id = "" } = req.body || {};

    if (!name) return res.status(400).json({ error: "Subject name is required" });

    const [result] = await db.query(
      "UPDATE subjects SET name = ?, grade = ?, section = ?, teacher_id = ? WHERE id = ?",
      [name, grade, section, teacher_id, Number(req.params.id)],
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Subject not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/subjects/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [result] = await db.query("DELETE FROM subjects WHERE id = ?", [Number(req.params.id)]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Subject not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/enrollments", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT id, student_id, class_id, academic_year, status, created_at FROM enrollments ORDER BY academic_year DESC, id DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/enrollments", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const { student_id, class_id, academic_year = "", status = "Active" } = req.body || {};

    if (!student_id || !class_id) {
      return res.status(400).json({ error: "student_id and class_id are required" });
    }

    const [result] = await db.query(
      "INSERT INTO enrollments (student_id, class_id, academic_year, status) VALUES (?, ?, ?, ?)",
      [student_id, Number(class_id), academic_year, status],
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/enrollments/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [result] = await db.query("DELETE FROM enrollments WHERE id = ?", [
      Number(req.params.id),
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Enrollment not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/terms", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT id, level, term_name, start_date, end_date, warning_threshold, status, created_at FROM academic_terms ORDER BY start_date DESC, id DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edutrack/terms", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const {
      level,
      term_name,
      start_date = null,
      end_date = null,
      warning_threshold = 80,
      status = "Not set",
    } = req.body || {};

    if (!level || !term_name) {
      return res.status(400).json({ error: "level and term_name are required" });
    }

    const [result] = await db.query(
      `
        INSERT INTO academic_terms
          (level, term_name, start_date, end_date, warning_threshold, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [level, term_name, start_date || null, end_date || null, Number(warning_threshold), status],
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/edutrack/terms/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const {
      level,
      term_name,
      start_date = null,
      end_date = null,
      warning_threshold = 80,
      status = "Not set",
    } = req.body || {};

    if (!level || !term_name) {
      return res.status(400).json({ error: "level and term_name are required" });
    }

    const [result] = await db.query(
      `
        UPDATE academic_terms
        SET level = ?, term_name = ?, start_date = ?, end_date = ?,
          warning_threshold = ?, status = ?
        WHERE id = ?
      `,
      [
        level,
        term_name,
        start_date || null,
        end_date || null,
        Number(warning_threshold),
        status,
        Number(req.params.id),
      ],
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Term not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/edutrack/terms/:id", adminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [result] = await db.query("DELETE FROM academic_terms WHERE id = ?", [
      Number(req.params.id),
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Term not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/syllabus", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      `
        SELECT si.id, si.subject_id, si.grade, si.title, si.description, si.term_id,
          si.created_at, s.name AS subject_name, t.term_name
        FROM syllabus_items si
        LEFT JOIN subjects s ON s.id = si.subject_id
        LEFT JOIN academic_terms t ON t.id = si.term_id
        ORDER BY si.grade, s.name, si.id
      `,
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edutrack/syllabus", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const { subject_id, grade = "", title, description = "", term_id = null } = req.body || {};

    if (!subject_id || !title) {
      return res.status(400).json({ error: "subject_id and title are required" });
    }

    const [result] = await db.query(
      `
        INSERT INTO syllabus_items (subject_id, grade, title, description, term_id)
        VALUES (?, ?, ?, ?, ?)
      `,
      [Number(subject_id), grade, title, description, term_id ? Number(term_id) : null],
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/edutrack/syllabus/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const { subject_id, grade = "", title, description = "", term_id = null } = req.body || {};

    if (!subject_id || !title) {
      return res.status(400).json({ error: "subject_id and title are required" });
    }

    const [result] = await db.query(
      `
        UPDATE syllabus_items
        SET subject_id = ?, grade = ?, title = ?, description = ?, term_id = ?
        WHERE id = ?
      `,
      [
        Number(subject_id),
        grade,
        title,
        description,
        term_id ? Number(term_id) : null,
        Number(req.params.id),
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Syllabus item not found" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/edutrack/syllabus/:id", adminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [result] = await db.query("DELETE FROM syllabus_items WHERE id = ?", [
      Number(req.params.id),
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Syllabus item not found" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/progress", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      `
        SELECT sp.id, sp.teacher_id, sp.subject_id, sp.syllabus_item_id, sp.status,
          sp.completed_at, sp.note, sp.created_at, si.title AS syllabus_title,
          s.name AS subject_name
        FROM syllabus_progress sp
        LEFT JOIN syllabus_items si ON si.id = sp.syllabus_item_id
        LEFT JOIN subjects s ON s.id = sp.subject_id
        ORDER BY sp.created_at DESC
      `,
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edutrack/progress", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const {
      teacher_id,
      subject_id,
      syllabus_item_id,
      status = "pending",
      completed_at = null,
      note = "",
    } = req.body || {};

    if (!teacher_id || !subject_id || !syllabus_item_id) {
      return res
        .status(400)
        .json({ error: "teacher_id, subject_id and syllabus_item_id are required" });
    }

    const completedAt = status === "completed" ? completed_at || mysqlDateTime() : null;
    const [result] = await db.query(
      `
        INSERT INTO syllabus_progress
          (teacher_id, subject_id, syllabus_item_id, status, completed_at, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        teacher_id,
        Number(subject_id),
        Number(syllabus_item_id),
        status === "completed" ? "completed" : "pending",
        completedAt,
        note,
      ],
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/edutrack/progress/:id", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const {
      teacher_id,
      subject_id,
      syllabus_item_id,
      status = "pending",
      completed_at = null,
      note = "",
    } = req.body || {};

    if (!teacher_id || !subject_id || !syllabus_item_id) {
      return res
        .status(400)
        .json({ error: "teacher_id, subject_id and syllabus_item_id are required" });
    }

    const completedAt = status === "completed" ? completed_at || mysqlDateTime() : null;
    const [result] = await db.query(
      `
        UPDATE syllabus_progress
        SET teacher_id = ?, subject_id = ?, syllabus_item_id = ?, status = ?,
          completed_at = ?, note = ?
        WHERE id = ?
      `,
      [
        teacher_id,
        Number(subject_id),
        Number(syllabus_item_id),
        status === "completed" ? "completed" : "pending",
        completedAt,
        note,
        Number(req.params.id),
      ],
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Progress not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/edutrack/progress/:id", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const [result] = await db.query("DELETE FROM syllabus_progress WHERE id = ?", [
      Number(req.params.id),
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Progress not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/dashboard", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const [[totals]] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM syllabus_items) AS total_items,
        (SELECT COUNT(DISTINCT syllabus_item_id) FROM syllabus_progress WHERE status = 'completed') AS completed_items
    `);
    const [bySubject] = await db.query(`
      SELECT s.id AS subject_id, s.name AS subject_name, COUNT(si.id) AS total_items,
        COUNT(DISTINCT CASE WHEN sp.status = 'completed' THEN sp.syllabus_item_id END) AS completed_items
      FROM subjects s
      LEFT JOIN syllabus_items si ON si.subject_id = s.id
      LEFT JOIN syllabus_progress sp ON sp.syllabus_item_id = si.id
      GROUP BY s.id, s.name
      ORDER BY s.name
    `);
    const [byTeacher] = await db.query(`
      SELECT teacher_id, COUNT(DISTINCT syllabus_item_id) AS completed_items
      FROM syllabus_progress
      WHERE status = 'completed'
      GROUP BY teacher_id
      ORDER BY teacher_id
    `);

    const totalItems = Number(totals.total_items || 0);
    const completedItems = Number(totals.completed_items || 0);
    res.json({
      totalItems,
      completedItems,
      completionPercent: totalItems ? Math.round((completedItems / totalItems) * 100) : 0,
      bySubject: bySubject.map((row) => ({
        ...row,
        completionPercent: Number(row.total_items)
          ? Math.round((Number(row.completed_items) / Number(row.total_items)) * 100)
          : 0,
      })),
      byTeacher,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/warnings", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(`
      SELECT t.id AS term_id, t.term_name, t.warning_threshold, s.id AS subject_id,
        s.name AS subject_name, COUNT(si.id) AS total_items,
        COUNT(DISTINCT CASE WHEN sp.status = 'completed' THEN sp.syllabus_item_id END) AS completed_items
      FROM academic_terms t
      JOIN syllabus_items si ON si.term_id = t.id
      LEFT JOIN subjects s ON s.id = si.subject_id
      LEFT JOIN syllabus_progress sp ON sp.syllabus_item_id = si.id
      GROUP BY t.id, t.term_name, t.warning_threshold, s.id, s.name
      ORDER BY t.start_date DESC, s.name
    `);
    res.json(
      rows
        .map((row) => {
          const total = Number(row.total_items || 0);
          const completed = Number(row.completed_items || 0);
          const completionPercent = total ? Math.round((completed / total) * 100) : 0;
          return {
            ...row,
            completionPercent,
            warning: completionPercent < Number(row.warning_threshold || 80),
          };
        })
        .filter((row) => row.warning),
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function reliefActor(req) {
  return {
    id: String(req.user?.id || ""),
    name: req.user?.name || req.user?.email || req.user?.id || "Unknown",
    email: req.user?.email || "",
  };
}

function normalizeReliefAssignment(row) {
  return {
    ...row,
    fileUrl: `/api/edutrack/relief-assignments/${row.id}/file`,
    isLocked: Number(row.print_count || 0) >= 1 + Number(row.allowed_extra_prints || 0),
  };
}

function resolveReliefPdfPath(row) {
  const rawPath = String(row?.pdf_file_path || "");
  const candidates = [];
  if (rawPath) candidates.push(path.resolve(rawPath));
  if (rawPath) candidates.push(path.join(reliefUploadDir, path.basename(rawPath)));
  if (row?.original_file_name) {
    candidates.push(path.join(reliefUploadDir, safeFileName(row.original_file_name)));
  }

  const allowedRoots = [uploadRoot, legacyUploadRoot]
    .filter(Boolean)
    .map((root) => path.resolve(root));

  return candidates.find((candidate) => {
    const resolved = path.resolve(candidate);
    return (
      allowedRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`)) &&
      fs.existsSync(resolved)
    );
  });
}

app.get("/api/edutrack/relief-assignments", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT * FROM edutrack_relief_assignments ORDER BY created_at DESC",
    );
    res.json(rows.map(normalizeReliefAssignment));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/edutrack/relief-assignments",
  teacherOrAdmin,
  handleReliefUpload,
  async (req, res) => {
    try {
      await ensureContentTables();
      if (!req.file) return res.status(400).json({ error: "PDF required" });

      const {
        title,
        assignment_date = null,
        grade = "",
        section = "",
        subject_name = "",
        period_label = "",
        note = "",
      } = req.body || {};

      if (!title || !assignment_date || !grade || !section || !subject_name) {
        return res
          .status(400)
          .json({ error: "title, assignment_date, grade, section and subject_name are required" });
      }

      const actor = reliefActor(req);
      const [result] = await db.query(
        `
          INSERT INTO edutrack_relief_assignments
            (teacher_id, teacher_name, title, assignment_date, grade, section, subject_name,
             period_label, note, pdf_file_path, original_file_name, uploaded_by_user_id,
             uploaded_by_name, uploaded_by_email, uploaded_teacher_id, uploaded_teacher_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          actor.id,
          actor.name,
          title,
          assignment_date || null,
          grade,
          section,
          subject_name,
          period_label,
          note,
          req.file.path,
          req.file.originalname,
          actor.id,
          actor.name,
          actor.email,
          actor.id,
          actor.name,
        ],
      );

      await db.query(
        `
          INSERT INTO edutrack_relief_assignment_audit_logs
            (assignment_id, action, actor_user_id, actor_name, actor_email, uploaded_teacher_id,
             uploaded_teacher_name, details)
          VALUES (?, 'uploaded', ?, ?, ?, ?, ?, ?)
        `,
        [
          result.insertId,
          actor.id,
          actor.name,
          actor.email,
          actor.id,
          actor.name,
          `Uploaded ${req.file.originalname}`,
        ],
      );

      res.status(201).json({ success: true, id: result.insertId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.post(
  "/api/edutrack/relief-assignments/:id/print",
  eduzyncAdminOnly,
  async (req, res) => {
    const { relief_teacher_id } = req.body || {};
    if (!relief_teacher_id) {
      return res.status(400).json({ error: "relief_teacher_id required" });
    }

    const conn = await db.getConnection();
    try {
      await ensureContentTables();
      const actor = reliefActor(req);
      await conn.beginTransaction();
      const [rows] = await conn.query(
        "SELECT * FROM edutrack_relief_assignments WHERE id = ? FOR UPDATE",
        [Number(req.params.id)],
      );
      const assignment = rows[0];
      if (!assignment) throw new Error("Assignment not found");

      if (Number(assignment.print_count || 0) >= 1 + Number(assignment.allowed_extra_prints || 0)) {
        await conn.query(
          `
            INSERT INTO edutrack_relief_assignment_audit_logs
              (assignment_id, action, actor_user_id, actor_name, actor_email, relief_teacher_id, details)
            VALUES (?, 'blocked_attempt', ?, ?, ?, ?, ?)
          `,
          [
            assignment.id,
            actor.id,
            actor.name,
            actor.email,
            relief_teacher_id,
            "Print blocked because the assignment is locked",
          ],
        );
        await conn.commit();
        return res.status(403).json({ error: "Already printed and locked" });
      }

      const [[teacher]] = await conn.query(
        `
          SELECT id, staff_id, name, position, subject
          FROM teachers
          WHERE id = ? OR staff_id = ? OR account_user_id = ?
          LIMIT 1
        `,
        [relief_teacher_id, relief_teacher_id, relief_teacher_id],
      );
      if (!teacher) throw new Error("Relief teacher not found");

      await conn.query(
        `
          UPDATE edutrack_relief_assignments
          SET relief_teacher_id = ?, relief_teacher_name = ?, relief_teacher_position = ?,
            relief_teacher_subject = ?, print_count = print_count + 1, printed_by_user_id = ?,
            printed_by_name = ?, printed_by_email = ?, printed_at = NOW(), status = 'printed'
          WHERE id = ?
        `,
        [
          teacher.id,
          teacher.name,
          teacher.position || "",
          teacher.subject || "",
          actor.id,
          actor.name,
          actor.email,
          assignment.id,
        ],
      );

      await conn.query(
        `
          INSERT INTO edutrack_relief_assignment_audit_logs
            (assignment_id, action, actor_user_id, actor_name, actor_email, relief_teacher_id,
             relief_teacher_name, details)
          VALUES (?, 'print_used', ?, ?, ?, ?, ?, ?)
        `,
        [
          assignment.id,
          actor.id,
          actor.name,
          actor.email,
          teacher.id,
          teacher.name,
          "One official print used",
        ],
      );
      await conn.commit();
      res.json({
        success: true,
        printUrl: `/api/edutrack/relief-assignments/${assignment.id}/file`,
      });
    } catch (error) {
      await conn.rollback();
      res.status(400).json({ error: error.message });
    } finally {
      conn.release();
    }
  },
);

app.post(
  "/api/edutrack/relief-assignments/:id/unlock",
  eduzyncAdminOnly,
  async (req, res) => {
    try {
      await ensureContentTables();
      const actor = reliefActor(req);
      const reason = String(req.body?.reason || "Manual unlock").trim();
      const [result] = await db.query(
        `
          UPDATE edutrack_relief_assignments
          SET allowed_extra_prints = allowed_extra_prints + 1,
            last_unlocked_by = ?, last_unlocked_at = NOW(), last_unlock_reason = ?
          WHERE id = ?
        `,
        [actor.id, reason, Number(req.params.id)],
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: "Assignment not found" });
      await db.query(
        `
          INSERT INTO edutrack_relief_assignment_audit_logs
            (assignment_id, action, actor_user_id, actor_name, actor_email, details)
          VALUES (?, 'unlocked', ?, ?, ?, ?)
        `,
        [Number(req.params.id), actor.id, actor.name, actor.email, reason],
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.get("/api/edutrack/relief-assignments/:id/file", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      "SELECT * FROM edutrack_relief_assignments WHERE id = ? LIMIT 1",
      [Number(req.params.id)],
    );
    if (!rows.length) return res.status(404).json({ error: "Assignment not found" });
    const filePath = resolveReliefPdfPath(rows[0]);
    if (!filePath) return res.status(404).json({ error: "PDF file not found" });
    res.download(filePath, rows[0].original_file_name || path.basename(filePath));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/relief-assignments/:id/audit", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      `
        SELECT id, assignment_id, action, actor_user_id, actor_name, actor_email,
          relief_teacher_id, relief_teacher_name, details, created_at
        FROM edutrack_relief_assignment_audit_logs
        WHERE assignment_id = ?
        ORDER BY created_at DESC, id DESC
      `,
      [Number(req.params.id)],
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/edutrack/relief-assignments/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const actor = reliefActor(req);
    const assignmentId = Number(req.params.id);
    const [result] = await db.query("DELETE FROM edutrack_relief_assignments WHERE id = ?", [
      assignmentId,
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Assignment not found" });
    await db.query(
      `
        INSERT INTO edutrack_relief_assignment_audit_logs
          (assignment_id, action, actor_user_id, actor_name, actor_email, details)
        VALUES (?, 'deleted', ?, ?, ?, ?)
      `,
      [assignmentId, actor.id, actor.name, actor.email, "Assignment record deleted"],
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function eduTrackRole(role) {
  if ([ROLES.master, ROLES.super, ROLES.eduzync].includes(role)) return "admin";
  if (role === "teacher") return "teacher";
  return role || "teacher";
}

function fromPlatformUser(row, extra = {}) {
  const data = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: eduTrackRole(row.role),
    status: row.status,
    createdAt: row.created_at,
    ...extra,
  };
  return { id: row.id, data };
}

async function readEduTrackDoc(collectionName, docId) {
  const idColumn = await getEduTrackDocumentIdColumn();
  const [rows] = await db.query(
    `SELECT data FROM edutrack_documents WHERE collection_name = ? AND ${idColumn} = ?`,
    [collectionName, docId],
  );
  if (!rows.length) return null;
  return parseJsonField(rows[0].data, {});
}

async function writeEduTrackDoc(collectionName, docId, data) {
  const idColumn = await getEduTrackDocumentIdColumn();
  if (idColumn === "id") {
    await db.query(
      `
        INSERT INTO edutrack_documents (id, collection_name, data)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE collection_name = VALUES(collection_name), data = VALUES(data)
      `,
      [docId, collectionName, JSON.stringify(data || {})],
    );
    return;
  }

  await db.query(
    `
      INSERT INTO edutrack_documents (collection_name, doc_id, data)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE data = VALUES(data)
    `,
    [collectionName, docId, JSON.stringify(data || {})],
  );
}

async function listEduTrackDocs(collectionName) {
  const idColumn = await getEduTrackDocumentIdColumn();
  const [rows] = await db.query(
    `SELECT ${idColumn} AS doc_id, data FROM edutrack_documents WHERE collection_name = ? ORDER BY updated_at DESC`,
    [collectionName],
  );
  return rows.map((row) => ({ id: row.doc_id, data: parseJsonField(row.data, {}) }));
}

async function platformUsersForEduTrack() {
  const [users] = await db.query(
    "SELECT id, name, email, role, status, created_at FROM users WHERE role IN ('teacher','eduzync_admin','superadmin','masteradmin') ORDER BY name",
  );
  const docs = await listEduTrackDocs("users");
  const extraById = new Map(docs.map((item) => [item.id, item.data]));
  return users.map((user) => fromPlatformUser(user, extraById.get(user.id) || {}));
}

app.get("/api/edutrack/session", teacherOrAdmin, async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, name, email, role, status, created_at FROM users WHERE id = ?",
      [req.user.id],
    );
    if (!users.length) return res.status(404).json({ error: "User not found" });
    const extra = (await readEduTrackDoc("users", req.user.id)) || {};
    res.json(fromPlatformUser(users[0], extra).data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edutrack/create-user", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const { email, password, name = "Teacher" } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email and password are required" });

    const [existing] = await db.query(
      "SELECT id, name, email, role, status FROM users WHERE email = ?",
      [email],
    );
    if (existing.length > 0) return res.json({ success: true, user: existing[0], existing: true });

    const id = `T-${Date.now()}`;
    const passwordHash = await bcrypt.hash(password, 12);
    await db.query(
      "INSERT INTO users (id, name, email, role, status, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
      [id, name || email.split("@")[0], email, "teacher", "Active", passwordHash],
    );
    res
      .status(201)
      .json({ success: true, user: { id, name, email, role: "teacher", status: "Active" } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/compat/:collection", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const collectionName = safePathSegment(req.params.collection).replace(/\//g, "-");
    if (collectionName === "users") return res.json({ items: await platformUsersForEduTrack() });
    const docs = await listEduTrackDocs(collectionName);
    res.json({ items: docs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/compat/:collection/:id", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const collectionName = safePathSegment(req.params.collection).replace(/\//g, "-");
    const docId = String(req.params.id);
    if (collectionName === "users") {
      const [users] = await db.query(
        "SELECT id, name, email, role, status, created_at FROM users WHERE id = ?",
        [docId],
      );
      if (!users.length) return res.json({ exists: false, data: null });
      const extra = (await readEduTrackDoc("users", docId)) || {};
      return res.json({ exists: true, data: fromPlatformUser(users[0], extra).data });
    }
    const data = await readEduTrackDoc(collectionName, docId);
    res.json({ exists: Boolean(data), data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edutrack/compat/:collection", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const collectionName = safePathSegment(req.params.collection).replace(/\//g, "-");
    const id = `${collectionName}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    await writeEduTrackDoc(collectionName, id, { ...(req.body || {}), id });
    res.status(201).json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/edutrack/compat/:collection/:id", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const collectionName = safePathSegment(req.params.collection).replace(/\//g, "-");
    const docId = String(req.params.id);
    await writeEduTrackDoc(collectionName, docId, { ...(req.body || {}), id: docId });
    res.json({ success: true, id: docId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/edutrack/compat/:collection/:id", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const collectionName = safePathSegment(req.params.collection).replace(/\//g, "-");
    const docId = String(req.params.id);
    const current = (await readEduTrackDoc(collectionName, docId)) || {};
    await writeEduTrackDoc(collectionName, docId, { ...current, ...(req.body || {}), id: docId });
    res.json({ success: true, id: docId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/edutrack/compat/:collection/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const collectionName = safePathSegment(req.params.collection).replace(/\//g, "-");
    const idColumn = await getEduTrackDocumentIdColumn();
    await db.query(`DELETE FROM edutrack_documents WHERE collection_name = ? AND ${idColumn} = ?`, [
      collectionName,
      String(req.params.id),
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/report-cards", authRole(...REPORT_CARD_VIEW_ROLES), async (req, res) => {
  try {
    await ensureContentTables();
    let [cards] = await db.query(
      "SELECT id, student_id, term, academic_year, grade, section, remarks, published, created_at, updated_at FROM report_cards ORDER BY updated_at DESC",
    );
    if (req.user.role === ROLES.student) {
      cards = cards.filter((card) => String(card.student_id) === String(req.user.id));
    }
    if (req.user.role === ROLES.parent) {
      const [parents] = await db.query("SELECT children FROM parents WHERE id = ? LIMIT 1", [
        req.user.id,
      ]);
      const children = String(parents[0]?.children || "")
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
      cards = cards.filter((card) => children.includes(String(card.student_id)));
    }
    const [subjects] = await db.query(
      "SELECT id, report_card_id, subject, marks, grade, teacher_comment FROM report_card_subjects ORDER BY id ASC",
    );
    const subjectsByCard = new Map();
    subjects.forEach((subject) => {
      const list = subjectsByCard.get(subject.report_card_id) || [];
      list.push(subject);
      subjectsByCard.set(subject.report_card_id, list);
    });
    res.json(cards.map((card) => ({ ...card, subjects: subjectsByCard.get(card.id) || [] })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/report-cards",
  authRole(ROLES.master, ROLES.super, ROLES.eduzync, ROLES.teacher),
  async (req, res) => {
    const connection = await db.getConnection();
    try {
      await ensureContentTables();
      const {
        student_id,
        term,
        academic_year,
        grade,
        section,
        remarks = "",
        published = false,
        subjects = [],
      } = req.body || {};

      if (!student_id || !term) {
        return res.status(400).json({ error: "student_id and term are required" });
      }

      await connection.beginTransaction();
      const [result] = await connection.query(
        `
        INSERT INTO report_cards
          (student_id, term, academic_year, grade, section, remarks, published)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [
          student_id,
          term,
          academic_year || "",
          grade || "",
          section || "",
          remarks,
          published ? 1 : 0,
        ],
      );

      const reportCardId = result.insertId;
      for (const item of Array.isArray(subjects) ? subjects : []) {
        await connection.query(
          `
          INSERT INTO report_card_subjects
            (report_card_id, subject, marks, grade, teacher_comment)
          VALUES (?, ?, ?, ?, ?)
        `,
          [
            reportCardId,
            item.subject || "",
            item.marks == null ? null : Number(item.marks),
            item.grade || "",
            item.teacher_comment || "",
          ],
        );
      }

      await connection.commit();
      res.json({ success: true, id: reportCardId });
    } catch (error) {
      await connection.rollback();
      res.status(500).json({ error: error.message });
    } finally {
      connection.release();
    }
  },
);

app.post(
  "/api/uploads",
  authRole(ROLES.master, ROLES.super, ROLES.website, ROLES.eduzync, ROLES.staff),
  handleSingleUpload,
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      await ensureContentTables();

      if (req.file.size > uploadSizeLimit(req.file)) {
        await unlinkQuiet(req.file.path);
        return res.status(400).json({ error: "File size is too large for this file type." });
      }

      const folder = safePathSegment(req.query.folder || "media");
      const stored = await processUploadedMedia(req, req.file, folder);
      const sourceId = mediaSourceId(folder, stored.fileUrl);
      const category = mediaCategoryFromFolder(folder, stored.fileType);

      await db.query(
        `
        INSERT INTO media_files (
          source_id, file_name, file_url, webm_url, file_type, file_size, duration_seconds, folder, category
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          file_name = VALUES(file_name),
          file_url = VALUES(file_url),
          webm_url = VALUES(webm_url),
          file_type = VALUES(file_type),
          file_size = VALUES(file_size),
          duration_seconds = VALUES(duration_seconds),
          folder = VALUES(folder),
          category = VALUES(category)
      `,
        [
          sourceId,
          stored.fileName,
          stored.fileUrl,
          stored.webmUrl,
          stored.fileType,
          stored.fileSize,
          stored.durationSeconds,
          folder,
          category,
        ],
      );

      res.json({
        success: true,
        url: stored.fileUrl,
        fileUrl: stored.fileUrl,
        webmUrl: stored.webmUrl,
        mediaType: stored.mediaType,
        file: {
          name: stored.fileName,
          type: stored.fileType,
          size: stored.fileSize,
          durationSeconds: stored.durationSeconds,
          folder,
          category,
        },
      });
    } catch (error) {
      if (req.file?.path) await unlinkQuiet(req.file.path);
      const message = error.message || "Upload failed.";
      const status =
        /unsupported|too large|longer than|duration|valid mp4|valid mp4|processing is not available/i.test(
          message,
        )
          ? 400
          : 500;
      res.status(status).json({
        error: message,
      });
    }
  },
);

app.post(
  "/api/setup-admin",
  rateLimit({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: "setup-admin" }),
  async (req, res) => {
    try {
      await ensureAccessTables();
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          error: "Name, email and password are required",
        });
      }

      const [adminRows] = await db.query(
        "SELECT COUNT(*) AS total FROM users WHERE role IN ('website_admin', 'eduzync_admin', 'superadmin', 'masteradmin')",
      );
      if (Number(adminRows[0]?.total || 0) > 0 && !canManageSystemUsers(req)) {
        return res.status(403).json({ error: "Setup is locked because an admin already exists." });
      }

      const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);

      if (existing.length > 0) {
        return res.status(400).json({
          error: "User already exists",
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const id = "U-" + Date.now();

      await db.query(
        "INSERT INTO users (id, name, email, role, status, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
        [id, name, email, "masteradmin", "Active", passwordHash],
      );

      res.json({
        success: true,
        message: "Master admin created",
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
      });
    }
  },
);

app.post(
  "/api/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "login" }),
  async (req, res) => {
    try {
      await ensureAccessTables();
      const { email, password } = req.body;

      const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

      if (users.length === 0) {
        return res.status(401).json({
          error: "Invalid email or password",
        });
      }

      const user = users[0];

      if (String(user.status || "").toLowerCase() !== "active") {
        return res.status(403).json({ error: "This account is not active." });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return res.status(401).json({
          error: "Invalid email or password",
        });
      }

      const token = createToken(user);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
      });
    }
  },
);

app.get("/api/me", auth, async (req, res) => {
  try {
    await ensureAccessTables();
    const [users] = await db.query("SELECT id, name, email, role, status FROM users WHERE id = ?", [
      req.user.id,
    ]);

    if (users.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json(users[0]);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

registerStaffRoutes(app, {
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
});

const frontendRoot = path.join(__dirname, "..", "public");
const frontendIndex = path.join(frontendRoot, "index.html");
const frontendAssets = path.join(frontendRoot, "assets");

if (fs.existsSync(frontendIndex)) {
  const sendFrontendApp = (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(frontendIndex);
  };

  app.get(
    [
      "/",
      "/login",
      "/portal",
      "/admin",
      "/portal/edutrack",
      "/portal/eduzync",
      "/portal/elms",
      "/portal/reports",
    ],
    sendFrontendApp,
  );

  app.get(["/edutrack", "/edutrack/"], (req, res) => {
    res.sendFile(path.join(frontendRoot, "edutrack", "index.html"));
  });

  app.get(["/staff", "/staff/"], (req, res) => {
    res.sendFile(path.join(frontendRoot, "staff", "index.html"));
  });

  if (fs.existsSync(frontendAssets)) {
    app.use(
      "/assets",
      express.static(frontendAssets, {
        immutable: true,
        index: false,
        maxAge: "1y",
        setHeaders(res) {
          res.setHeader("X-Content-Type-Options", "nosniff");
        },
      }),
    );
  }

  app.use(
    express.static(frontendRoot, {
      index: false,
      maxAge: "1d",
      setHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );

  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    if (req.path.startsWith("/assets/") || path.extname(req.path)) {
      return res.status(404).type("text/plain").send("Static file not found");
    }
    sendFrontendApp(req, res);
  });
}

app.use((req, res) => {
  res.status(404).json({ error: "API route not found" });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(500).json({ error: error.message || "Server error" });
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Backend running on http://localhost:${process.env.PORT || 5000}`);
});
