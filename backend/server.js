const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { registerStaffRoutes } = require("./routes/staff");
const { sanitizeSiteDbSecurity, scanVisualContent } = require("./lib/sanitize-visual-content");
const {
  inferPositionCode,
  normalizePositionCode,
  parsePositionCode,
} = require("./lib/staff-position-codes");
const {
  EDUTRACK_SSO_ROLES,
  createEduTrackSsoToken,
  resolveEduTrackPublicUrl,
  verifyEduTrackSsoToken,
} = require("./lib/edutrack-sso");

dotenv.config();

const app = express();
const legacyUploadRoot = path.join(__dirname, "uploads");
const projectUploadRoot = path.join(__dirname, "..", "uploads");

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
copyMissingUploads(projectUploadRoot, uploadRoot);
fs.mkdirSync(reliefUploadDir, { recursive: true });
app.disable("x-powered-by");
app.set("trust proxy", true);

function isEduTrackRequestPath(requestPath) {
  return requestPath === "/edutrack" || requestPath.startsWith("/edutrack/");
}

function contentSecurityPolicyForRequest(req) {
  const isEduTrack = isEduTrackRequestPath(req.path);
  const common = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "media-src 'self' blob: https:",
    "connect-src 'self' http://localhost:5000 http://127.0.0.1:5000",
    "frame-src 'self' https://calendar.google.com https://www.google.com https://www.youtube.com",
  ];

  if (isEduTrack) {
    return [
      ...common,
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    ].join("; ");
  }

  return [
    ...common,
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  ].join("; ");
}

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", contentSecurityPolicyForRequest(req));
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
app.use(csrfProtection);
const uploadStaticRoots = [uploadRoot, legacyUploadRoot, projectUploadRoot].filter(
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
    if (
      ext === ".pdf" &&
      (!mimetype || mimetype === "application/pdf" || mimetype === "application/octet-stream")
    ) {
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

// Optional dedicated account-management database. When ACCOUNTS_DB_NAME is set,
// the account registry and account audit log live in that separate database;
// otherwise they share the main pool. Login/auth users stay in the main DB.
const accountsDb = process.env.ACCOUNTS_DB_NAME
  ? mysql.createPool({
      host: process.env.ACCOUNTS_DB_HOST || process.env.DB_HOST,
      port: Number(process.env.ACCOUNTS_DB_PORT || process.env.DB_PORT),
      user: process.env.ACCOUNTS_DB_USER || process.env.DB_USER,
      password: process.env.ACCOUNTS_DB_PASSWORD || process.env.DB_PASSWORD,
      database: process.env.ACCOUNTS_DB_NAME,
    })
  : db;

let accountManagementSchemaReady = false;

async function ensureAccountManagementTables() {
  if (accountManagementSchemaReady) return;
  await accountsDb.query(`
    CREATE TABLE IF NOT EXISTS edutrack_account_registry (
      user_id VARCHAR(64) PRIMARY KEY,
      external_staff_id VARCHAR(80) NULL,
      nic_number VARCHAR(20) NULL,
      name VARCHAR(190) NOT NULL,
      email VARCHAR(190) NOT NULL,
      role VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_by_user_id VARCHAR(64) NULL,
      created_by_name VARCHAR(190) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_account_registry_email (email),
      KEY idx_account_registry_role (role),
      KEY idx_account_registry_status (status)
    )
  `);
  await accountsDb.query(`
    CREATE TABLE IF NOT EXISTS edutrack_account_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      action VARCHAR(80) NOT NULL,
      target_user_id VARCHAR(64) NULL,
      target_email VARCHAR(190) NULL,
      target_name VARCHAR(190) NULL,
      target_role VARCHAR(50) NULL,
      actor_user_id VARCHAR(64) NULL,
      actor_name VARCHAR(190) NULL,
      details_json LONGTEXT NULL,
      ip_address VARCHAR(80) NULL,
      user_agent TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_account_audit_action (action),
      KEY idx_account_audit_target (target_user_id),
      KEY idx_account_audit_created (created_at)
    )
  `);
  await accountsDb
    .query(
      "ALTER TABLE edutrack_account_registry ADD COLUMN nic_number VARCHAR(20) NULL AFTER external_staff_id",
    )
    .catch(() => null);
  accountManagementSchemaReady = true;
}

async function upsertAccountRegistry(user, actor = {}) {
  try {
    await ensureAccountManagementTables();
    await accountsDb.query(
      `
        INSERT INTO edutrack_account_registry
          (user_id, external_staff_id, nic_number, name, email, role, status, created_by_user_id, created_by_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          external_staff_id = VALUES(external_staff_id),
          nic_number = VALUES(nic_number),
          name = VALUES(name),
          email = VALUES(email),
          role = VALUES(role),
          status = VALUES(status)
      `,
      [
        String(user.id || ""),
        user.external_staff_id || user.externalStaffId || null,
        normalizeNicNumber(user.nic_number || user.nicNumber || user.nic) || null,
        String(user.name || "").slice(0, 190),
        String(user.email || "").slice(0, 190),
        String(user.role || "").slice(0, 50),
        String(user.status || "Active").slice(0, 20),
        actor.id ? String(actor.id) : null,
        actor.name ? String(actor.name).slice(0, 190) : null,
      ],
    );
  } catch (error) {
    console.error("Account registry upsert failed:", error.message);
  }
}

async function recordAccountAudit(req, action, target = {}, details = null) {
  try {
    await ensureAccountManagementTables();
    await accountsDb.query(
      `
        INSERT INTO edutrack_account_audit_logs
          (action, target_user_id, target_email, target_name, target_role,
           actor_user_id, actor_name, details_json, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        String(action || "").slice(0, 80),
        target.id ? String(target.id) : null,
        target.email ? String(target.email).slice(0, 190) : null,
        target.name ? String(target.name).slice(0, 190) : null,
        target.role ? String(target.role).slice(0, 50) : null,
        req?.user?.id ? String(req.user.id) : null,
        req?.user?.name || req?.user?.email
          ? String(req.user.name || req.user.email).slice(0, 190)
          : null,
        details ? JSON.stringify(details) : null,
        String(req?.ip || req?.headers?.["x-forwarded-for"] || "").slice(0, 80),
        String(req?.headers?.["user-agent"] || "").slice(0, 1000),
      ],
    );
  } catch (error) {
    console.error("Account audit write failed:", error.message);
  }
}

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

function createTwoFactorChallengeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      purpose: TWO_FACTOR_CHALLENGE_PURPOSE,
    },
    process.env.JWT_SECRET,
    { expiresIn: "5m" },
  );
}

function verifyTwoFactorChallengeToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload?.purpose !== TWO_FACTOR_CHALLENGE_PURPOSE) {
    throw new Error("Invalid two-factor challenge");
  }
  return payload;
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value) {
  const cleanValue = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let decodedValue = 0;
  const bytes = [];

  for (const character of cleanValue) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) continue;
    decodedValue = (decodedValue << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((decodedValue >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function generateTwoFactorSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function normalizeTotpCode(value) {
  return String(value || "").replace(/\s+/g, "");
}

function totpCodeAtStep(secret, step) {
  const key = base32Decode(secret);
  if (!key.length) return "";

  const counter = Buffer.alloc(8);
  const high = Math.floor(step / 0x100000000);
  const low = step >>> 0;
  counter.writeUInt32BE(high, 0);
  counter.writeUInt32BE(low, 4);

  const hmac = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 1000000).padStart(6, "0");
}

function verifyTotpCode(secret, rawCode, options = {}) {
  const code = normalizeTotpCode(rawCode);
  if (!/^\d{6}$/.test(code)) return null;

  const windowSize = Number.isFinite(options.window) ? Number(options.window) : 1;
  const currentStep = Math.floor((options.now || Date.now()) / 30000);

  for (let offset = -windowSize; offset <= windowSize; offset += 1) {
    const step = currentStep + offset;
    const expected = totpCodeAtStep(secret, step);
    if (!expected || expected.length !== code.length) continue;
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return step;
  }

  return null;
}

function twoFactorEnabledForUser(user) {
  return Boolean(Number(user?.two_factor_enabled || 0) && user?.two_factor_secret);
}

function publicUserPayload(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    twoFactorEnabled: twoFactorEnabledForUser(user),
  };
}

function twoFactorOtpAuthUrl(user, secret) {
  const label = `${TWO_FACTOR_ISSUER}:${user.email || user.name || user.id}`;
  const params = new URLSearchParams({
    secret,
    issuer: TWO_FACTOR_ISSUER,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

async function verifyUserTotpAndRecord(user, code) {
  if (!twoFactorEnabledForUser(user)) return false;
  const matchedStep = verifyTotpCode(user.two_factor_secret, code);
  if (matchedStep == null) return false;

  const lastUsedStep =
    user.two_factor_last_used_step == null ? null : Number(user.two_factor_last_used_step);
  if (lastUsedStep != null && Number.isFinite(lastUsedStep) && lastUsedStep >= matchedStep) {
    return false;
  }

  await db.query("UPDATE users SET two_factor_last_used_step = ? WHERE id = ?", [
    matchedStep,
    user.id,
  ]);
  return true;
}

const ROLE_ENUM_SQL = `
  ENUM(
    'masteradmin',
    'superadmin',
    'website_admin',
    'eduzync_admin',
    'master_edutrack_admin',
    'academic_coordinator',
    'staff_admin',
    'viewadmin',
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
    'master_edutrack_admin',
    'academic_coordinator',
    'staff_admin',
    'viewadmin',
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
  masterEduTrack: "master_edutrack_admin",
  coordinator: "academic_coordinator",
  staff: "staff_admin",
  view: "viewadmin",
  teacher: "teacher",
  student: "student",
  parent: "parent",
};

const SYSTEM_OWNER_ROLES = [ROLES.master, ROLES.super];
const WEBSITE_ADMIN_ROLES = [ROLES.master, ROLES.super, ROLES.website, ROLES.view];
const EDUZYNC_ADMIN_ROLES = [ROLES.master, ROLES.super, ROLES.masterEduTrack, ROLES.eduzync];
const STAFF_ADMIN_ROLES = [ROLES.master, ROLES.super, ROLES.staff, ROLES.view];
const SCHOOL_DATA_READ_ROLES = [
  ROLES.master,
  ROLES.super,
  ROLES.masterEduTrack,
  ROLES.eduzync,
  ROLES.coordinator,
  ROLES.view,
  ROLES.teacher,
];
const EDUTRACK_ROLES = [
  ROLES.master,
  ROLES.super,
  ROLES.masterEduTrack,
  ROLES.eduzync,
  ROLES.coordinator,
  ROLES.view,
  ROLES.teacher,
];
const EDUTRACK_OVERSIGHT_ROLES = [
  ROLES.master,
  ROLES.super,
  ROLES.masterEduTrack,
  ROLES.eduzync,
  ROLES.coordinator,
];
const REPORT_CARD_VIEW_ROLES = [
  ROLES.master,
  ROLES.super,
  ROLES.masterEduTrack,
  ROLES.eduzync,
  ROLES.teacher,
  ROLES.student,
  ROLES.parent,
];

const AUTH_COOKIE_NAME = "loyola_session_token";
const CSRF_COOKIE_NAME = "loyola_csrf_token";
const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_ENABLED = false;
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const PASSWORD_RESET_RESPONSE =
  "If an active teacher account with a recovery email exists, a reset link will be sent.";
const TWO_FACTOR_ISSUER = "Loyola College Portal";
const TWO_FACTOR_CHALLENGE_PURPOSE = "two_factor_login";
const MAINTENANCE_BYPASS_ROLES = [
  ROLES.master,
  ROLES.super,
  ROLES.website,
  ROLES.eduzync,
  ROLES.masterEduTrack,
  ROLES.coordinator,
  ROLES.staff,
  ROLES.view,
];
const DEFAULT_MAINTENANCE_MESSAGE =
  "The public website is temporarily offline while Loyola College completes maintenance.";

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
  [ROLES.masterEduTrack, "eduzync", 1, 1, 1, 1],
  [ROLES.masterEduTrack, "edutrack", 1, 1, 1, 1],
  [ROLES.masterEduTrack, "report_cards", 1, 1, 1, 0],
  [ROLES.staff, "staff", 1, 1, 1, 1],
  [ROLES.website, "website_admin", 1, 1, 1, 0],
  [ROLES.website, "media", 1, 1, 1, 0],
  [ROLES.website, "news", 1, 1, 1, 0],
  [ROLES.website, "notices", 1, 1, 1, 0],
  [ROLES.website, "events", 1, 1, 1, 0],
  [ROLES.view, "website_admin", 1, 0, 0, 0],
  [ROLES.view, "edutrack", 1, 0, 0, 0],
  [ROLES.view, "staff", 1, 0, 0, 0],
  [ROLES.view, "students", 1, 0, 0, 0],
  [ROLES.view, "teachers", 1, 0, 0, 0],
  [ROLES.view, "subjects", 1, 0, 0, 0],
  [ROLES.view, "media", 1, 0, 0, 0],
  [ROLES.view, "news", 1, 0, 0, 0],
  [ROLES.view, "notices", 1, 0, 0, 0],
  [ROLES.view, "events", 1, 0, 0, 0],
  [ROLES.eduzync, "eduzync", 1, 1, 1, 1],
  [ROLES.eduzync, "students", 1, 1, 1, 1],
  [ROLES.eduzync, "teachers", 1, 1, 1, 1],
  [ROLES.eduzync, "parents", 1, 1, 1, 1],
  [ROLES.eduzync, "classes", 1, 1, 1, 1],
  [ROLES.eduzync, "subjects", 1, 1, 1, 1],
  [ROLES.eduzync, "edutrack", 1, 1, 1, 0],
  [ROLES.eduzync, "report_cards", 1, 1, 1, 0],
  [ROLES.coordinator, "edutrack", 1, 1, 1, 0],
  [ROLES.coordinator, "eduzync", 1, 0, 0, 0],
  [ROLES.coordinator, "teachers", 1, 0, 0, 0],
  [ROLES.coordinator, "subjects", 1, 0, 0, 0],
  [ROLES.coordinator, "students", 1, 0, 0, 0],
  [ROLES.teacher, "edutrack", 1, 1, 1, 0],
  [ROLES.teacher, "elms", 0, 0, 0, 0],
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
let maintenanceSettingsSchemaReady = false;

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
      external_staff_id VARCHAR(80) NULL,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      recovery_email VARCHAR(190) NULL,
      role ${ROLE_ENUM_SQL},
      status VARCHAR(30) NOT NULL DEFAULT 'Active',
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
  await ensureTableColumns("users", [
    { name: "external_staff_id", definition: "external_staff_id VARCHAR(80) NULL AFTER id" },
    {
      name: "nic_number",
      definition: "nic_number VARCHAR(20) NULL AFTER external_staff_id",
    },
    {
      name: "recovery_email",
      definition: "recovery_email VARCHAR(190) NULL AFTER email",
    },
    {
      name: "two_factor_enabled",
      definition: "two_factor_enabled BOOLEAN DEFAULT 0 AFTER password_hash",
    },
    {
      name: "two_factor_secret",
      definition: "two_factor_secret VARCHAR(128) NULL AFTER two_factor_enabled",
    },
    {
      name: "two_factor_pending_secret",
      definition: "two_factor_pending_secret VARCHAR(128) NULL AFTER two_factor_secret",
    },
    {
      name: "two_factor_confirmed_at",
      definition: "two_factor_confirmed_at TIMESTAMP NULL AFTER two_factor_pending_secret",
    },
    {
      name: "two_factor_last_used_step",
      definition: "two_factor_last_used_step BIGINT NULL AFTER two_factor_confirmed_at",
    },
    {
      name: "updated_at",
      definition: "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    },
  ]);
  await ensureTableIndexes("users", [
    {
      name: "idx_users_external_staff_id",
      sql: "CREATE INDEX idx_users_external_staff_id ON users (external_staff_id)",
    },
    {
      name: "idx_users_nic_number",
      sql: "CREATE INDEX idx_users_nic_number ON users (nic_number)",
    },
  ]);
  await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_password_reset_token_hash (token_hash),
      KEY idx_password_reset_user_id (user_id),
      KEY idx_password_reset_expires_at (expires_at)
    )
  `);
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

function parseCookieHeader(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) return cookies;
      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1);
      if (!key) return cookies;
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
      return cookies;
    }, {});
}

function tokenFromRequest(req) {
  const header = req.headers.authorization || "";
  const bearerToken = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (bearerToken) return bearerToken;
  return parseCookieHeader(req)[AUTH_COOKIE_NAME] || "";
}

function verifiedUserFromRequest(req) {
  const token = tokenFromRequest(req);
  if (!token) return null;

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    if (user.role === "admin") user.role = ROLES.website;
    return user;
  } catch {
    return null;
  }
}

function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: "/",
  };
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
  });
}

function csrfCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: "/",
  };
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function setCsrfCookie(res, token = createCsrfToken()) {
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions());
  return token;
}

function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
  });
}

function csrfTokensMatch(left, right) {
  const leftValue = String(left || "");
  const rightValue = String(right || "");
  if (!leftValue || !rightValue || leftValue.length !== rightValue.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(leftValue), Buffer.from(rightValue));
  } catch {
    return false;
  }
}

function isUnsafeMethod(method) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(String(method || "").toUpperCase());
}

function isCsrfExemptPath(requestPath) {
  return (
    requestPath === "/api/login" ||
    requestPath === "/api/login/2fa" ||
    requestPath === "/api/password-reset/request" ||
    requestPath === "/api/password-reset/confirm" ||
    requestPath === "/api/logout" ||
    requestPath === "/api/csrf" ||
    requestPath === "/api/health" ||
    requestPath === "/api/setup-admin" ||
    requestPath === "/api/internal/sync-teacher-account"
  );
}

function csrfProtection(req, res, next) {
  const cookies = parseCookieHeader(req);
  const hasAuthCookie = Boolean(cookies[AUTH_COOKIE_NAME]);

  if (!cookies[CSRF_COOKIE_NAME]) {
    setCsrfCookie(res);
  }

  if (!isUnsafeMethod(req.method) || isCsrfExemptPath(req.path) || !hasAuthCookie) {
    return next();
  }

  const headerToken = req.headers["x-csrf-token"];
  if (!csrfTokensMatch(cookies[CSRF_COOKIE_NAME], headerToken)) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  next();
}

function parseBooleanSetting(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function canBypassMaintenanceRole(role) {
  return MAINTENANCE_BYPASS_ROLES.includes(role);
}

function canBypassMaintenance(req) {
  const user = verifiedUserFromRequest(req);
  return Boolean(user && canBypassMaintenanceRole(user.role));
}

async function ensureMaintenanceSettingsTable() {
  if (maintenanceSettingsSchemaReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  maintenanceSettingsSchemaReady = true;
}

async function readMaintenanceSettings() {
  await ensureMaintenanceSettingsTable();
  const [rows] = await db.query(
    "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('maintenance_mode', 'maintenance_message')",
  );
  const settings = new Map(rows.map((row) => [row.setting_key, row.setting_value]));
  return {
    enabled: parseBooleanSetting(
      settings.get("maintenance_mode"),
      parseBooleanSetting(process.env.MAINTENANCE_MODE, false),
    ),
    message: String(settings.get("maintenance_message") || DEFAULT_MAINTENANCE_MESSAGE),
  };
}

async function readMaintenanceSettingsForGate() {
  try {
    return await readMaintenanceSettings();
  } catch (error) {
    console.warn(`[maintenance] Could not read settings: ${error.message}`);
    return {
      enabled: parseBooleanSetting(process.env.MAINTENANCE_MODE, false),
      message: DEFAULT_MAINTENANCE_MESSAGE,
    };
  }
}

async function writeMaintenanceSettings({ enabled, message }) {
  await ensureMaintenanceSettingsTable();
  const cleanMessage = String(message || DEFAULT_MAINTENANCE_MESSAGE)
    .trim()
    .slice(0, 500);
  await db.query(
    `
      INSERT INTO system_settings (setting_key, setting_value)
      VALUES ('maintenance_mode', ?), ('maintenance_message', ?)
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    `,
    [enabled ? "true" : "false", cleanMessage || DEFAULT_MAINTENANCE_MESSAGE],
  );
  return {
    enabled: Boolean(enabled),
    message: cleanMessage || DEFAULT_MAINTENANCE_MESSAGE,
  };
}

async function auth(req, res, next) {
  const token = tokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  let tokenUser;
  try {
    tokenUser = jwt.verify(token, process.env.JWT_SECRET);
    if (tokenUser.role === "admin") tokenUser.role = ROLES.website;
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const [[currentUser]] = await db.query(
      "SELECT id, name, email, role, status FROM users WHERE id = ? LIMIT 1",
      [tokenUser.id],
    );
    if (!currentUser || String(currentUser.status || "").toLowerCase() !== "active") {
      clearAuthCookie(res);
      clearCsrfCookie(res);
      return res.status(401).json({ error: "This account is not active" });
    }

    req.user = {
      ...tokenUser,
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role === "admin" ? ROLES.website : currentUser.role,
      status: currentUser.status,
    };

    if (tokenUser.email !== req.user.email || tokenUser.role !== req.user.role) {
      setAuthCookie(res, createToken(req.user));
    }

    return next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
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

function masterAdminOnly(req, res, next) {
  return authRole(ROLES.master)(req, res, next);
}

function websiteAdminOnly(req, res, next) {
  return authRole(...WEBSITE_ADMIN_ROLES)(req, res, next);
}

function eduzyncAdminOnly(req, res, next) {
  return authRole(...EDUZYNC_ADMIN_ROLES)(req, res, next);
}

function edutrackMasterOnly(req, res, next) {
  return authRole(ROLES.master, ROLES.super, ROLES.masterEduTrack)(req, res, next);
}

function edutrackOversightOnly(req, res, next) {
  return authRole(...EDUTRACK_OVERSIGHT_ROLES, ROLES.view)(req, res, next);
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

function isViewAdminRole(role) {
  return role === ROLES.view;
}

const VIEW_ADMIN_WRITE_PROTECTED_PREFIXES = [
  "/api/site-db",
  "/api/pages",
  "/api/publish-requests",
  "/api/uploads",
  "/api/users",
  "/api/staff",
  "/api/staff-",
  "/api/edutrack",
  "/api/students",
  "/api/teachers",
  "/api/subjects",
  "/api/parents",
  "/api/classes",
  "/api/enrollments",
  "/api/media",
  "/api/job-vacancies",
  "/api/admin/job-vacancies",
  "/api/maintenance",
];

function isViewAdminWriteProtectedPath(requestPath) {
  return VIEW_ADMIN_WRITE_PROTECTED_PREFIXES.some((prefix) =>
    prefix.endsWith("-")
      ? requestPath.startsWith(prefix)
      : requestPath === prefix || requestPath.startsWith(`${prefix}/`),
  );
}

function viewAdminWriteGuard(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (!isViewAdminWriteProtectedPath(req.path)) return next();

  const user = verifiedUserFromRequest(req);
  if (isViewAdminRole(user?.role)) {
    return res.status(403).json({
      error: "View Admin accounts are read-only and cannot change system data.",
    });
  }

  return next();
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
      const { accountEmail, accountUserId, accountStatus, recoveryEmail, ...publicTeacher } =
        teacher || {};
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
    recoveryEmail: row.recovery_email || "",
  };
}

function staffProfileWebsitePlace(profile) {
  const text = [profile.position, profile.department, profile.staff_type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/rector|principal|prefect|priest|sectional head/.test(text)) {
    return "College Administration";
  }
  return profile.department || profile.staff_type || "Subject Teachers";
}

function serializeStaffProfilePosition(row) {
  const sortOrder = Number(row.sort_order || row.display_order || 0);
  const visible = Number(row.visible_on_website ?? 1) !== 0;
  const known = Number(row.is_known ?? 1) !== 0;
  return {
    position_master_id: row.position_master_id || null,
    positionMasterId: row.position_master_id || null,
    position_code: row.position_code || "",
    positionCode: row.position_code || "",
    display_title: row.display_title || row.position || "",
    displayTitle: row.display_title || row.position || "",
    main_category: row.main_category || "",
    mainCategory: row.main_category || "",
    section: row.section || "",
    subsection: row.subsection || "",
    grade: row.grade || null,
    stream: row.stream || "",
    medium: row.medium || "",
    class_or_stream: row.class_or_stream || "",
    classOrStream: row.class_or_stream || "",
    department: row.department || "",
    position: row.position || row.display_title || "",
    website_place: row.website_place || "",
    websitePlace: row.website_place || "",
    subject: row.subject || "",
    classes: row.classes || "",
    is_primary: Number(row.is_primary || 0) === 1,
    isPrimary: Number(row.is_primary || 0) === 1,
    display_order: Number(row.display_order || 0),
    displayOrder: Number(row.display_order || 0),
    sort_order: sortOrder,
    sortOrder,
    visible_on_website: visible,
    visibleOnWebsite: visible,
    is_known: known,
    isKnown: known,
  };
}

function staffProfilePositionIdentity(position = {}) {
  const rawCode = normalizePositionCode(position.position_code || position.positionCode || "");
  const direct = parsePositionCode(rawCode);
  const inferredCode = direct.is_known ? rawCode : inferPositionCode(position);
  const parsed = parsePositionCode(inferredCode || rawCode);
  const taxonomy = parsed.is_known
    ? parsed
    : {
        display_title: position.display_title || position.displayTitle || position.position || "",
        main_category: position.main_category || position.mainCategory || "",
        section: position.section || "",
        subsection: position.subsection || "",
        grade: position.grade || null,
        stream: position.stream || "",
        medium: position.medium || "",
        class_or_stream: position.class_or_stream || position.classOrStream || "",
      };

  return [
    taxonomy.display_title,
    taxonomy.main_category,
    taxonomy.section,
    taxonomy.subsection,
    taxonomy.grade,
    taxonomy.stream,
    taxonomy.medium,
    taxonomy.class_or_stream,
    position.subject,
    position.classes,
  ]
    .map((value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

function dedupeStaffProfilePositions(positions = []) {
  const unique = new Map();
  positions.forEach((position) => {
    const key = staffProfilePositionIdentity(position);
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, position);
      return;
    }
    const shouldReplace =
      (existing.visibleOnWebsite === false && position.visibleOnWebsite !== false) ||
      (!existing.isPrimary && position.isPrimary);
    if (shouldReplace) unique.set(key, position);
  });
  return [...unique.values()];
}

async function readStaffProfileSiteRows(runner = db) {
  if (!(await tableExists("staff_profiles", runner))) return [];

  const [profiles] = await runner.query(`
    SELECT
      sp.id,
      sp.user_id,
      sp.teacher_id,
      sp.full_name,
      sp.slug,
      sp.email,
      sp.phone,
      sp.staff_type,
      sp.department,
      sp.position,
      sp.qualification,
      sp.bio,
      sp.status,
      sp.sort_order,
      sp.profile_image,
      sp.photo_url,
      u.email AS account_email,
      u.recovery_email
    FROM staff_profiles sp
    LEFT JOIN users u ON u.id = sp.user_id
    WHERE sp.full_name IS NOT NULL
      AND sp.full_name <> ''
    ORDER BY sp.sort_order ASC, sp.full_name ASC
  `);
  if (!profiles.length) return [];

  let positionRows = [];
  if (await tableExists("staff_positions", runner)) {
    const placeholders = profiles.map(() => "?").join(",");
    [positionRows] = await runner.query(
      `
        SELECT *
        FROM staff_positions
        WHERE staff_id IN (${placeholders})
        ORDER BY staff_id, is_primary DESC, sort_order ASC, display_order ASC, id ASC
      `,
      profiles.map((profile) => profile.id),
    );
  }

  const positionsByStaff = new Map();
  positionRows.forEach((row) => {
    const position = serializeStaffProfilePosition(row);
    if (!positionsByStaff.has(row.staff_id)) positionsByStaff.set(row.staff_id, []);
    positionsByStaff.get(row.staff_id).push(position);
  });

  return profiles.map((profile) => {
    const staffId = String(profile.id || "");
    const allPositions = dedupeStaffProfilePositions(positionsByStaff.get(staffId) || []);
    const fallbackWebsitePlace = staffProfileWebsitePlace(profile);
    const fallbackPosition = {
      position_code: "",
      positionCode: "",
      display_title: profile.position || profile.staff_type || "Staff Member",
      displayTitle: profile.position || profile.staff_type || "Staff Member",
      main_category: profile.staff_type || "Academic Staff",
      mainCategory: profile.staff_type || "Academic Staff",
      section: fallbackWebsitePlace,
      subsection: profile.department || "",
      department: profile.department || "",
      position: profile.position || "",
      website_place: fallbackWebsitePlace,
      websitePlace: fallbackWebsitePlace,
      subject: "",
      classes: "",
      sort_order: Number(profile.sort_order || 0),
      sortOrder: Number(profile.sort_order || 0),
      visible_on_website: true,
      visibleOnWebsite: true,
      is_known: true,
      isKnown: true,
    };
    const visiblePositions = allPositions.filter((position) => position.visibleOnWebsite !== false);
    const primary =
      visiblePositions.find((position) => position.isPrimary) ||
      visiblePositions[0] ||
      allPositions.find((position) => position.isPrimary) ||
      allPositions[0] ||
      fallbackPosition;
    const positionCodes = allPositions
      .map((position) => position.positionCode || position.position_code || "")
      .filter(Boolean);
    const hasVisibleWebsitePosition =
      profile.status === "Active" && visiblePositions.length > 0;

    return serializeTeacherRow({
      id: staffId,
      staff_id: staffId,
      slug: profile.slug || syncSlug(profile.full_name || staffId),
      name: profile.full_name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      subject: primary.subject || "",
      classes: primary.classes || "",
      status: hasVisibleWebsitePosition ? "Active" : "Hidden",
      image: profile.photo_url || profile.profile_image || "",
      type: profile.staff_type || "Academic Staff",
      category: primary.mainCategory || primary.websitePlace || fallbackWebsitePlace,
      website_place: primary.section || primary.websitePlace || fallbackWebsitePlace,
      qualifications: profile.qualification || "",
      responsibilities: profile.bio || "",
      bio: profile.bio || "",
      section: primary.department || profile.department || "",
      position: primary.displayTitle || primary.position || profile.position || "",
      positions_json: JSON.stringify(allPositions),
      position_codes: JSON.stringify(positionCodes),
      sort_order: Number(profile.sort_order || 0) + Number(primary.sortOrder || 0),
      account_email: profile.account_email || "",
      account_user_id: profile.user_id || "",
      recovery_email: profile.recovery_email || "",
    });
  });
}

async function readTeacherSiteRows(runner = db) {
  const [rows] = await runner.query(`
    SELECT
      t.id,
      t.staff_id,
      t.slug,
      t.name,
      t.email,
      t.phone,
      t.subject,
      t.classes,
      t.status,
      t.image,
      t.type,
      t.category,
      t.website_place,
      t.qualifications,
      t.responsibilities,
      t.bio,
      t.section,
      t.position,
      t.positions_json,
      t.position_codes,
      t.sort_order,
      t.account_email,
      t.account_user_id,
      t.created_at,
      u.recovery_email
    FROM teachers t
    LEFT JOIN users u ON u.id = t.account_user_id
    WHERE t.name IS NOT NULL
      AND t.name <> ''
    ORDER BY
      CASE
        WHEN t.status = 'Active' THEN 0
        ELSE 1
      END,
      CASE
        WHEN t.id = COALESCE(NULLIF(t.staff_id, ''), t.id) THEN 1
        ELSE 0
      END,
      t.category,
      t.sort_order,
      t.name
  `);
  const teacherRows = rows.map(serializeTeacherRow);
  const profileRows = await readStaffProfileSiteRows(runner);
  const profileStaffIds = new Set(profileRows.map((row) => row.staffId).filter(Boolean));
  const byId = new Map();
  teacherRows.forEach((row) => {
    if (!row.staffId || !profileStaffIds.has(row.staffId)) byId.set(row.id, row);
  });
  profileRows.forEach((row) => byId.set(row.id, row));
  return [...byId.values()].sort(
    (a, b) =>
      (a.status === "Active" ? 0 : 1) - (b.status === "Active" ? 0 : 1) ||
      a.category.localeCompare(b.category) ||
      Number(a.sortOrder || 0) - Number(b.sortOrder || 0) ||
      a.name.localeCompare(b.name),
  );
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
  const user = verifiedUserFromRequest(req);
  return Boolean(user && WEBSITE_ADMIN_ROLES.includes(user.role));
}

function canManageSystemUsers(req) {
  const user = verifiedUserFromRequest(req);
  return Boolean(user && SYSTEM_OWNER_ROLES.includes(user.role));
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
      external_staff_id VARCHAR(80) NULL,
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
    CREATE TABLE IF NOT EXISTS job_vacancies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      requirements TEXT NULL,
      deadline DATE NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'Open',
      attachment_url TEXT NULL,
      attachment_type VARCHAR(100) NULL,
      application_email VARCHAR(190) NULL,
      is_visible TINYINT(1) NOT NULL DEFAULT 1,
      created_by VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      KEY idx_job_vacancies_status (status),
      KEY idx_job_vacancies_visible (is_visible),
      KEY idx_job_vacancies_deadline (deadline)
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
    CREATE TABLE IF NOT EXISTS edutrack_daily_syllabus_progress (
      id INT AUTO_INCREMENT PRIMARY KEY,
      teacher_user_id VARCHAR(64),
      teacher_id VARCHAR(80),
      teacher_name VARCHAR(190),
      record_date DATE NOT NULL,
      grade VARCHAR(50),
      section VARCHAR(50),
      subject VARCHAR(150),
      period_label VARCHAR(80),
      unit_number VARCHAR(80),
      main_topic VARCHAR(255),
      subtopic VARCHAR(255),
      completed_work TEXT,
      page_reference VARCHAR(255),
      notes TEXT,
      completion_status VARCHAR(40) DEFAULT 'Completed',
      next_planned_lesson TEXT,
      status VARCHAR(50) DEFAULT 'submitted',
      created_by_user_id VARCHAR(64),
      created_by_name VARCHAR(190),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id VARCHAR(64),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      locked_at TIMESTAMP NULL,
      locked_by_user_id VARCHAR(64)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS edutrack_syllabus_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      syllabus_record_id INT,
      action VARCHAR(100) NOT NULL,
      old_value_json LONGTEXT,
      new_value_json LONGTEXT,
      actor_user_id VARCHAR(64),
      actor_name VARCHAR(190),
      ip_address VARCHAR(80),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      status VARCHAR(50) DEFAULT 'pending_download',
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
      download_count INT DEFAULT 0,
      allowed_extra_prints INT DEFAULT 0,
      allowed_extra_downloads INT DEFAULT 0,
      locked_at TIMESTAMP NULL,
      locked_by_user_id VARCHAR(64),
      printed_by_user_id VARCHAR(64),
      printed_by_name VARCHAR(190),
      printed_by_email VARCHAR(190),
      printed_at TIMESTAMP NULL,
      downloaded_by_user_id VARCHAR(64),
      downloaded_by_name VARCHAR(190),
      downloaded_by_email VARCHAR(190),
      downloaded_at TIMESTAMP NULL,
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
      details_json LONGTEXT,
      ip_address VARCHAR(80),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS edutrack_teacher_subject_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      teacher_user_id VARCHAR(64) NULL,
      teacher_id VARCHAR(80) NULL,
      teacher_name VARCHAR(190) NOT NULL,
      subject_id VARCHAR(80) NULL,
      subject_name VARCHAR(150) NOT NULL,
      grade VARCHAR(50) NOT NULL,
      section VARCHAR(50) NULL,
      class_name VARCHAR(100) NULL,
      academic_year VARCHAR(20) NOT NULL,
      assigned_by_user_id VARCHAR(64) NULL,
      assigned_by_name VARCHAR(190) NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_ypp_assign_teacher_user (teacher_user_id),
      KEY idx_ypp_assign_teacher_id (teacher_id),
      KEY idx_ypp_assign_subject (subject_name),
      KEY idx_ypp_assign_grade_section (grade, section),
      KEY idx_ypp_assign_year (academic_year),
      KEY idx_ypp_assign_status (status)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS edutrack_year_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NULL,
      teacher_user_id VARCHAR(64) NULL,
      teacher_id VARCHAR(80) NULL,
      teacher_name VARCHAR(190) NOT NULL,
      subject_name VARCHAR(150) NOT NULL,
      grade VARCHAR(50) NOT NULL,
      section VARCHAR(50) NULL,
      academic_year VARCHAR(20) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'Draft',
      progress_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
      created_by_user_id VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_ypp_plans_assignment (assignment_id),
      KEY idx_ypp_plans_teacher_user (teacher_user_id),
      KEY idx_ypp_plans_teacher_id (teacher_id),
      KEY idx_ypp_plans_subject (subject_name),
      KEY idx_ypp_plans_grade_section (grade, section),
      KEY idx_ypp_plans_year (academic_year),
      KEY idx_ypp_plans_status (status)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS edutrack_year_plan_terms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      year_plan_id INT NOT NULL,
      term_name VARCHAR(80) NOT NULL,
      term_order INT NOT NULL,
      unit_count INT NOT NULL DEFAULT 0,
      progress_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_ypp_term (year_plan_id, term_order),
      KEY idx_ypp_terms_plan (year_plan_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS edutrack_year_plan_units (
      id INT AUTO_INCREMENT PRIMARY KEY,
      term_id INT NOT NULL,
      year_plan_id INT NOT NULL,
      unit_number VARCHAR(80) NOT NULL,
      unit_title VARCHAR(255) NULL,
      display_order INT NOT NULL DEFAULT 0,
      progress_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_ypp_unit (term_id, display_order),
      KEY idx_ypp_units_plan (year_plan_id),
      KEY idx_ypp_units_term (term_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS edutrack_year_plan_topics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      unit_id INT NOT NULL,
      term_id INT NOT NULL,
      year_plan_id INT NOT NULL,
      main_topic VARCHAR(255) NOT NULL,
      display_order INT NOT NULL DEFAULT 0,
      progress_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_ypp_topics_plan (year_plan_id),
      KEY idx_ypp_topics_term (term_id),
      KEY idx_ypp_topics_unit (unit_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS edutrack_year_plan_subtopics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      topic_id INT NOT NULL,
      unit_id INT NOT NULL,
      term_id INT NOT NULL,
      year_plan_id INT NOT NULL,
      subtopic_title VARCHAR(255) NOT NULL,
      display_order INT NOT NULL DEFAULT 0,
      is_completed TINYINT(1) NOT NULL DEFAULT 0,
      completed_at TIMESTAMP NULL,
      completed_by_user_id VARCHAR(64) NULL,
      completed_by_name VARCHAR(190) NULL,
      completion_note TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_ypp_subtopics_plan (year_plan_id),
      KEY idx_ypp_subtopics_term (term_id),
      KEY idx_ypp_subtopics_unit (unit_id),
      KEY idx_ypp_subtopics_topic (topic_id),
      KEY idx_ypp_subtopics_completed (is_completed)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS edutrack_year_plan_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      year_plan_id INT NULL,
      entity_type VARCHAR(80) NOT NULL,
      entity_id VARCHAR(80) NULL,
      action VARCHAR(100) NOT NULL,
      old_value_json LONGTEXT NULL,
      new_value_json LONGTEXT NULL,
      actor_user_id VARCHAR(64) NULL,
      actor_name VARCHAR(190) NULL,
      ip_address VARCHAR(80) NULL,
      user_agent TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ypp_audit_plan (year_plan_id),
      KEY idx_ypp_audit_entity (entity_type, entity_id),
      KEY idx_ypp_audit_actor (actor_user_id)
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
  await addColumnIfMissing(
    "edutrack_relief_assignments",
    "uploaded_at",
    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
  );
  await addColumnIfMissing("edutrack_relief_assignments", "allowed_extra_prints", "INT DEFAULT 0");
  await addColumnIfMissing("edutrack_relief_assignments", "download_count", "INT DEFAULT 0");
  await addColumnIfMissing(
    "edutrack_relief_assignments",
    "allowed_extra_downloads",
    "INT DEFAULT 0",
  );
  await addColumnIfMissing("edutrack_relief_assignments", "locked_at", "TIMESTAMP NULL");
  await addColumnIfMissing("edutrack_relief_assignments", "locked_by_user_id", "VARCHAR(64)");
  await addColumnIfMissing("edutrack_relief_assignments", "downloaded_by_user_id", "VARCHAR(64)");
  await addColumnIfMissing("edutrack_relief_assignments", "downloaded_by_name", "VARCHAR(190)");
  await addColumnIfMissing("edutrack_relief_assignments", "downloaded_by_email", "VARCHAR(190)");
  await addColumnIfMissing("edutrack_relief_assignments", "downloaded_at", "TIMESTAMP NULL");
  await addColumnIfMissing("edutrack_relief_assignments", "last_unlocked_by", "VARCHAR(64)");
  await addColumnIfMissing("edutrack_relief_assignments", "last_unlocked_at", "TIMESTAMP NULL");
  await addColumnIfMissing("edutrack_relief_assignments", "last_unlock_reason", "TEXT");
  await addColumnIfMissing("edutrack_relief_assignment_audit_logs", "details_json", "LONGTEXT");
  await addColumnIfMissing("edutrack_relief_assignment_audit_logs", "ip_address", "VARCHAR(80)");
  await addColumnIfMissing("edutrack_relief_assignment_audit_logs", "user_agent", "TEXT");
  await addColumnIfMissing(
    "edutrack_year_plans",
    "progress_percentage",
    "DECIMAL(5,2) NOT NULL DEFAULT 0",
  );
  await addColumnIfMissing(
    "edutrack_year_plans",
    "approval_status",
    "VARCHAR(30) NOT NULL DEFAULT 'draft'",
  );
  await addColumnIfMissing("edutrack_year_plans", "submitted_at", "TIMESTAMP NULL");
  await addColumnIfMissing("edutrack_year_plans", "submitted_by_name", "VARCHAR(190) NULL");
  await addColumnIfMissing("edutrack_year_plans", "reviewed_at", "TIMESTAMP NULL");
  await addColumnIfMissing("edutrack_year_plans", "reviewed_by_user_id", "VARCHAR(64) NULL");
  await addColumnIfMissing("edutrack_year_plans", "reviewed_by_name", "VARCHAR(190) NULL");
  await addColumnIfMissing("edutrack_year_plans", "review_comment", "TEXT NULL");
  await ensureTableIndexes("edutrack_teacher_subject_assignments", [
    {
      name: "idx_ypp_assign_teacher_user",
      sql: "CREATE INDEX idx_ypp_assign_teacher_user ON edutrack_teacher_subject_assignments (teacher_user_id)",
    },
    {
      name: "idx_ypp_assign_teacher_id",
      sql: "CREATE INDEX idx_ypp_assign_teacher_id ON edutrack_teacher_subject_assignments (teacher_id)",
    },
    {
      name: "idx_ypp_assign_year",
      sql: "CREATE INDEX idx_ypp_assign_year ON edutrack_teacher_subject_assignments (academic_year)",
    },
  ]);
  await ensureTableIndexes("edutrack_year_plans", [
    {
      name: "idx_ypp_plans_teacher_user",
      sql: "CREATE INDEX idx_ypp_plans_teacher_user ON edutrack_year_plans (teacher_user_id)",
    },
    {
      name: "idx_ypp_plans_teacher_id",
      sql: "CREATE INDEX idx_ypp_plans_teacher_id ON edutrack_year_plans (teacher_id)",
    },
    {
      name: "idx_ypp_plans_year",
      sql: "CREATE INDEX idx_ypp_plans_year ON edutrack_year_plans (academic_year)",
    },
  ]);
  await ensureTableIndexes("edutrack_daily_syllabus_progress", [
    {
      name: "idx_daily_syllabus_teacher_id",
      sql: "CREATE INDEX idx_daily_syllabus_teacher_id ON edutrack_daily_syllabus_progress (teacher_id)",
    },
    {
      name: "idx_daily_syllabus_record_date",
      sql: "CREATE INDEX idx_daily_syllabus_record_date ON edutrack_daily_syllabus_progress (record_date)",
    },
    {
      name: "idx_daily_syllabus_subject",
      sql: "CREATE INDEX idx_daily_syllabus_subject ON edutrack_daily_syllabus_progress (subject)",
    },
    {
      name: "idx_daily_syllabus_grade",
      sql: "CREATE INDEX idx_daily_syllabus_grade ON edutrack_daily_syllabus_progress (grade)",
    },
    {
      name: "idx_daily_syllabus_section",
      sql: "CREATE INDEX idx_daily_syllabus_section ON edutrack_daily_syllabus_progress (section)",
    },
    {
      name: "idx_daily_syllabus_unit_number",
      sql: "CREATE INDEX idx_daily_syllabus_unit_number ON edutrack_daily_syllabus_progress (unit_number)",
    },
  ]);
  await backfillMediaCategories();
  await addColumnIfMissing("teachers", "staff_id", "VARCHAR(50) NULL");
  await addColumnIfMissing("teachers", "external_staff_id", "VARCHAR(80) NULL");
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
    {
      name: "idx_teachers_external_staff_id",
      sql: "CREATE INDEX idx_teachers_external_staff_id ON teachers (external_staff_id)",
    },
  ]);
  await ensureStaffSyncSchema();
  await ensureSiteDatabaseSchema();
  await ensureWebsitePagesSchema();

  contentSchemaReady = true;
}

async function ensureStaffSyncSchema() {
  if (await tableExists("staff_profiles")) {
    await addColumnIfMissing(
      "staff_profiles",
      "edutrack_sync_status",
      "VARCHAR(30) DEFAULT 'not_synced'",
    );
    await addColumnIfMissing("staff_profiles", "edutrack_sync_error", "TEXT NULL");
    await addColumnIfMissing("staff_profiles", "edutrack_teacher_id", "VARCHAR(80) NULL");
  }

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
}

async function addColumnIfMissing(table, column, definition) {
  const safeTable = table.replace(/[^a-z0-9_]/gi, "");
  const safeColumn = column.replace(/[^a-z0-9_]/gi, "");
  const [rows] = await db.query(`SHOW COLUMNS FROM ${safeTable} LIKE ?`, [safeColumn]);
  if (rows.length > 0) return;
  await db.query(`ALTER TABLE ${safeTable} ADD COLUMN ${safeColumn} ${definition}`);
}

async function tableExists(table, runner = db) {
  const safeTable = table.replace(/[^a-z0-9_]/gi, "");
  const [rows] = await runner.query(
    `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1
    `,
    [safeTable],
  );
  return rows.length > 0;
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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function passwordResetTokenHash(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

function passwordResetUrl(token) {
  const configuredBase = String(
    process.env.PASSWORD_RESET_BASE_URL ||
      process.env.PUBLIC_API_URL ||
      (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080"),
  ).trim();
  if (!configuredBase) throw new Error("PASSWORD_RESET_BASE_URL or PUBLIC_API_URL is required");

  const url = new URL(
    "/reset-password",
    configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`,
  );
  url.searchParams.set("token", token);
  return url.toString();
}

function escapeEmailHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let passwordResetTransport = null;
function getPasswordResetTransport() {
  if (passwordResetTransport) return passwordResetTransport;

  const host = String(process.env.SMTP_HOST || "smtp-relay.brevo.com").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || "").trim();
  const password = String(process.env.SMTP_PASSWORD || "").trim();
  const from = String(process.env.SMTP_FROM || "").trim();
  if (!host || !Number.isFinite(port) || !user || !password || !from) {
    throw new Error("SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM are required");
  }

  passwordResetTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass: password },
    tls: { minVersion: "TLSv1.2" },
  });
  return passwordResetTransport;
}

async function sendTeacherPasswordResetEmail(user, recoveryEmail, token) {
  const resetUrl = passwordResetUrl(token);
  const teacherName = escapeEmailHtml(user.name || "Teacher");
  const accountEmail = escapeEmailHtml(user.email);
  const resetUrlHtml = escapeEmailHtml(resetUrl);

  await getPasswordResetTransport().sendMail({
    from: process.env.SMTP_FROM,
    to: recoveryEmail,
    subject: "Reset your Loyola College portal password",
    text: [
      `Hello ${user.name || "Teacher"},`,
      "",
      `A password reset was requested for ${user.email}.`,
      `Open this link within 30 minutes: ${resetUrl}`,
      "",
      "If you did not request this reset, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0a1628;max-width:620px;margin:auto">
        <h2 style="margin-bottom:8px">Reset your portal password</h2>
        <p>Hello ${teacherName},</p>
        <p>A password reset was requested for <strong>${accountEmail}</strong>.</p>
        <p style="margin:28px 0">
          <a href="${resetUrlHtml}" style="background:#0a1628;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">
            Reset password
          </a>
        </p>
        <p>This link expires in 30 minutes and can only be used once.</p>
        <p>If you did not request this reset, you can ignore this email.</p>
      </div>
    `,
  });
}

function normalizeAccountStatus(value) {
  return String(value || "Active").toLowerCase() === "active" ? "Active" : "Disabled";
}

// Sri Lankan NIC: old format 9 digits + V/X, new format 12 digits.
function normalizeNicNumber(value) {
  const nic = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return /^(\d{9}[VX]|\d{12})$/.test(nic) ? nic : "";
}

function looksLikeNicNumber(value) {
  return Boolean(normalizeNicNumber(value));
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

const EXPLICIT_DELETE_COLLECTIONS = ["news", "events"];

function explicitDeletedIds(siteDb, key) {
  if (!isPlainObject(siteDb?.deletedContentIds)) return new Set();
  const ids = Array.isArray(siteDb.deletedContentIds[key]) ? siteDb.deletedContentIds[key] : [];
  return new Set(ids.map((id) => String(id || "").trim()).filter(Boolean));
}

function applyExplicitContentDeletes(targetDb, markerDb = targetDb) {
  if (!isPlainObject(targetDb)) return targetDb;
  let nextDb = targetDb;

  for (const key of EXPLICIT_DELETE_COLLECTIONS) {
    const deletedIds = explicitDeletedIds(markerDb, key);
    if (!deletedIds.size || !Array.isArray(nextDb[key])) continue;

    const filtered = nextDb[key].filter((item) => {
      const itemId = String(item?.id || item?.source_id || "").trim();
      return !deletedIds.has(itemId);
    });

    if (filtered.length !== nextDb[key].length) {
      if (nextDb === targetDb) nextDb = { ...targetDb };
      nextDb[key] = filtered;
    }
  }

  return nextDb;
}

function clearExplicitContentDeletes(siteDb) {
  if (!isPlainObject(siteDb) || !isPlainObject(siteDb.deletedContentIds)) return siteDb;
  const nextDb = { ...siteDb };
  delete nextDb.deletedContentIds;
  return nextDb;
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

function compactText(value, maxLength = 190) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function syncSetupPassword() {
  return `SetupRequired-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}

function syncAccountId(prefix = "EDUUSR") {
  return `${prefix}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

function syncSlug(value) {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 180) || "teacher"
  );
}

async function markStaffEduTrackSync(runner, payload, status, error = "", teacherId = "") {
  if (!(await tableExists("staff_profiles"))) return;
  const staffId = compactText(payload?.staffId || payload?.staff_id, 50);
  const effectiveTeacherId = compactText(
    teacherId || payload?.teacherId || payload?.teacher_id,
    50,
  );
  if (!staffId && !effectiveTeacherId) return;

  await runner.query(
    `
      UPDATE staff_profiles
      SET edutrack_sync_status = ?, edutrack_sync_error = ?, edutrack_teacher_id = ?
      WHERE id = ? OR teacher_id = ?
    `,
    [status, error || null, effectiveTeacherId || null, staffId, effectiveTeacherId || staffId],
  );
}

async function queueStaffEduTrackSync(runner, payload, error) {
  await ensureStaffSyncSchema();
  const staffId = compactText(payload?.staffId || payload?.staff_id, 50);
  const errorMessage = error.message || String(error);
  const [existing] = staffId
    ? await runner.query(
        `
          SELECT id
          FROM staff_sync_outbox
          WHERE staff_profile_id = ?
            AND target_system = 'edutrack'
            AND status IN ('pending', 'failed')
          ORDER BY id DESC
          LIMIT 1
        `,
        [staffId],
      )
    : [[]];
  if (existing.length) {
    await runner.query(
      `
        UPDATE staff_sync_outbox
        SET payload = ?, status = 'failed', error = ?, attempts = attempts + 1
        WHERE id = ?
      `,
      [JSON.stringify(payload || {}), errorMessage, existing[0].id],
    );
  } else {
    await runner.query(
      `
        INSERT INTO staff_sync_outbox (staff_profile_id, target_system, payload, status, error, attempts)
        VALUES (?, 'edutrack', ?, 'failed', ?, 1)
      `,
      [staffId || null, JSON.stringify(payload || {}), errorMessage],
    );
  }
  await markStaffEduTrackSync(runner, payload, "failed", error.message || String(error));
}

async function upsertLocalEduTrackTeacher(runner, payload = {}, options = {}) {
  const staffId = compactText(payload.staffId || payload.staff_id || payload.external_staff_id, 50);
  const teacherId = compactText(payload.teacherId || payload.teacher_id || staffId, 50);
  const requestedUserId = compactText(payload.userId || payload.user_id, 50);
  const email = normalizeEmail(payload.email);
  const name = compactText(
    payload.name || payload.fullName || payload.full_name || email.split("@")[0],
    150,
  );
  const status = normalizeAccountStatus(payload.status);

  if (!staffId || !teacherId || !name || !email) {
    throw new Error("staffId, teacherId, name, and email are required for EduTrack sync");
  }

  const [existingUsers] = await runner.query(
    `
      SELECT id, role
      FROM users
      WHERE id = ? OR external_staff_id = ? OR email = ?
      ORDER BY (id = ?) DESC, (external_staff_id = ?) DESC, id
      LIMIT 1
    `,
    [
      requestedUserId || "__missing_user__",
      staffId,
      email,
      requestedUserId || "__missing_user__",
      staffId,
    ],
  );
  if (existingUsers[0]?.role && existingUsers[0].role !== ROLES.teacher) {
    throw new Error("EduTrack sync target user must be a teacher account");
  }
  const userId = existingUsers[0]?.id || requestedUserId || syncAccountId();
  const password = typeof payload.password === "string" ? payload.password : "";

  if (existingUsers.length) {
    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);
      await runner.query(
        `
          UPDATE users
          SET external_staff_id = ?, name = ?, email = ?, role = 'teacher',
            status = ?, password_hash = ?
          WHERE id = ?
        `,
        [staffId, name, email, status, passwordHash, userId],
      );
    } else {
      await runner.query(
        `
          UPDATE users
          SET external_staff_id = ?, name = ?, email = ?, role = 'teacher', status = ?
          WHERE id = ?
        `,
        [staffId, name, email, status, userId],
      );
    }
  } else {
    const passwordHash = await bcrypt.hash(password || syncSetupPassword(), 12);
    await runner.query(
      `
        INSERT INTO users (id, external_staff_id, name, email, role, status, password_hash)
        VALUES (?, ?, ?, ?, 'teacher', ?, ?)
      `,
      [userId, staffId, name, email, status, passwordHash],
    );
  }

  const positions = Array.isArray(payload.positions) ? payload.positions : [];
  const positionCodes = positions
    .map((position) => position.positionCode || position.position_code || "")
    .filter(Boolean);
  const websitePlace = compactText(payload.websitePlace || payload.website_place || "", 120);
  const staffType = compactText(payload.staffType || payload.staff_type || "Academic Staff", 100);
  const photoUrl = compactText(payload.photoUrl || payload.photo_url || "", 2048);
  const [linkedTeacherRows] = await runner.query(
    `
      SELECT id
      FROM teachers
      WHERE account_user_id = ?
         OR (
           (staff_id = ? OR external_staff_id = ?)
           AND account_user_id = ?
         )
      ORDER BY (account_user_id = ?) DESC, id
      LIMIT 1
    `,
    [userId, staffId, staffId, userId, userId],
  );
  let storageTeacherId = linkedTeacherRows[0]?.id || teacherId;
  if (!linkedTeacherRows.length) {
    const [idOwners] = await runner.query("SELECT id FROM teachers WHERE id = ? LIMIT 1", [
      teacherId,
    ]);
    if (idOwners.length) {
      storageTeacherId = `SYNC-${crypto
        .createHash("sha256")
        .update(`${userId}:${staffId}`)
        .digest("hex")
        .slice(0, 40)}`;
    }
  }

  await runner.query(
    `
      INSERT INTO teachers (
        id, staff_id, external_staff_id, slug, name, email, subject, classes, status,
        position, website_place, type, category, image, positions_json, position_codes,
        account_email, account_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        staff_id = VALUES(staff_id),
        external_staff_id = VALUES(external_staff_id),
        slug = VALUES(slug),
        name = VALUES(name),
        email = VALUES(email),
        subject = VALUES(subject),
        classes = VALUES(classes),
        status = VALUES(status),
        position = VALUES(position),
        website_place = VALUES(website_place),
        type = VALUES(type),
        category = VALUES(category),
        image = VALUES(image),
        positions_json = VALUES(positions_json),
        position_codes = VALUES(position_codes),
        account_email = VALUES(account_email),
        account_user_id = VALUES(account_user_id)
    `,
    [
      storageTeacherId,
      staffId,
      staffId,
      syncSlug(name),
      name,
      email,
      compactText(payload.subject, 100),
      compactText(payload.classes, 100),
      status,
      compactText(payload.position, 150),
      websitePlace,
      staffType,
      websitePlace,
      photoUrl,
      JSON.stringify(positions),
      JSON.stringify(positionCodes),
      email,
      userId,
    ],
  );

  if (options.markSync !== false) {
    await markStaffEduTrackSync(runner, payload, "synced", "", teacherId);
  }
  return { userId, teacherId, storageTeacherId };
}

function externalEduTrackSyncConfig() {
  const enabled = String(process.env.ENABLE_CROSS_SYSTEM_TEACHER_SYNC || "")
    .trim()
    .toLowerCase();
  if (!["1", "true", "yes", "on"].includes(enabled)) {
    return { base: "", secret: "", available: false };
  }

  const base = String(
    process.env.EDUTRACK_INTERNAL_BASE_URL ||
      process.env.EDUTRACK_PUBLIC_URL ||
      resolveEduTrackPublicUrl() ||
      "",
  ).replace(/\/+$/g, "");
  const secret = process.env.EDUTRACK_SYNC_SECRET;
  return { base, secret, available: Boolean(base && secret) };
}

function eduTrackSsoSecret() {
  return (
    process.env.EDUTRACK_SSO_SECRET ||
    process.env.EDUTRACK_SYNC_SECRET ||
    process.env.JWT_SECRET
  );
}

function portalEduTrackAccountSyncConfig() {
  if (process.env.APP_NAME === "edutrack") {
    return { base: "", secret: "", available: false };
  }

  const base = String(
    process.env.EDUTRACK_INTERNAL_BASE_URL ||
      process.env.EDUTRACK_PUBLIC_URL ||
      resolveEduTrackPublicUrl() ||
      "",
  ).replace(/\/+$/g, "");
  const secret = process.env.EDUTRACK_SYNC_SECRET || process.env.EDUTRACK_SSO_SECRET;
  return { base, secret, available: Boolean(base && secret) };
}

function shouldMirrorPortalUserToEduTrack(role) {
  return EDUTRACK_SSO_ROLES.has(String(role || ""));
}

function portalUserEduTrackSyncPayload(user, password = "", statusOverride = "") {
  const role = normalizePortalRole(user?.role);
  return {
    id: compactText(user?.id, 50),
    externalStaffId: compactText(user?.external_staff_id || user?.externalStaffId, 80),
    name: compactText(user?.name, 150),
    email: normalizeEmail(user?.email),
    role,
    status: statusOverride || normalizeAccountStatus(user?.status),
    password: typeof password === "string" ? password : "",
  };
}

async function postPortalUserToExternalEduTrack(payload) {
  const { base, secret } = portalEduTrackAccountSyncConfig();
  if (!base || !secret) {
    return { skipped: true, reason: "edutrack-account-sync-not-configured" };
  }

  const timeoutMs = Math.max(Number(process.env.EDUTRACK_SYNC_TIMEOUT_MS || 8000), 1000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${base}/api/internal/sync-portal-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-edutrack-sync-secret": secret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `EduTrack user sync failed with status ${response.status}`);
  }
  return data;
}

async function syncPortalUserAccountToEduTrack(user, options = {}) {
  const previousRole = options.previousRole || "";
  const shouldSync =
    shouldMirrorPortalUserToEduTrack(user?.role) ||
    shouldMirrorPortalUserToEduTrack(previousRole) ||
    options.force === true;
  if (!shouldSync) return { skipped: true, reason: "role-not-edutrack-enabled" };

  const statusOverride = shouldMirrorPortalUserToEduTrack(user?.role)
    ? options.statusOverride || ""
    : "Disabled";
  const payload = portalUserEduTrackSyncPayload(user, options.password || "", statusOverride);
  if (!payload.id || !payload.email || !payload.name) {
    return { skipped: true, reason: "missing-required-account-fields" };
  }

  try {
    return await postPortalUserToExternalEduTrack(payload);
  } catch (error) {
    return {
      ok: false,
      warning: error.message || String(error),
    };
  }
}

function eduTrackPortalAccountSyncConfig() {
  if (process.env.APP_NAME !== "edutrack") {
    return { base: "", secret: "", available: false };
  }

  const configuredBase =
    process.env.LOYOLA_PORTAL_INTERNAL_BASE_URL ||
    process.env.LOYOLA_PORTAL_PUBLIC_URL ||
    process.env.MAIN_PORTAL_INTERNAL_BASE_URL ||
    process.env.MAIN_PORTAL_PUBLIC_URL ||
    process.env.PORTAL_INTERNAL_BASE_URL ||
    process.env.PORTAL_PUBLIC_URL ||
    (process.env.NODE_ENV === "production" ? "https://loyolacollege.lk" : "");
  const base = String(configuredBase || "").replace(/\/+$/g, "");
  const secret = process.env.EDUTRACK_SYNC_SECRET || process.env.EDUTRACK_SSO_SECRET;
  const pointsToSelf = /(^https?:\/\/)?edutrack\.loyolacollege\.lk/i.test(base);
  return { base: pointsToSelf ? "" : base, secret, available: Boolean(base && secret && !pointsToSelf) };
}

function portalRoleFromEduTrackRole(value) {
  const role = String(value || "").trim();
  if (!role || role === "teacher") return ROLES.teacher;
  if (role === "coordinator" || role === "academic_coordinator") return ROLES.coordinator;
  if (role === "admin" || role === "edutrack_admin") {
    return ROLES.eduzync;
  }
  if (role === "student") return ROLES.student;
  if (role === "parent") return ROLES.parent;
  return normalizePortalRole(role);
}

function looksLikeBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(String(value || "").trim());
}

function eduTrackUserPortalSyncPayload(user = {}, options = {}) {
  const email = normalizeEmail(user.email);
  const externalStaffId = compactText(
    user.externalStaffId ||
      user.external_staff_id ||
      user.staffId ||
      user.staff_id ||
      user.teacherId ||
      user.teacher_id,
    80,
  );
  const id = compactText(user.id || user.userId || user.user_id || externalStaffId, 50);
  return {
    id,
    externalStaffId,
    name: compactText(user.name || user.displayName || email.split("@")[0] || "Teacher", 150),
    email,
    role: portalRoleFromEduTrackRole(user.platformRole || user.role),
    status: normalizeAccountStatus(user.status),
    password: typeof options.password === "string" ? options.password : "",
    passwordHash: compactText(
      options.passwordHash || user.passwordHash || user.password_hash,
      120,
    ),
  };
}

async function postEduTrackUserToPortal(pathname, payload) {
  const { base, secret } = eduTrackPortalAccountSyncConfig();
  if (!base || !secret) {
    return { skipped: true, reason: "portal-account-sync-not-configured" };
  }

  const timeoutMs = Math.max(Number(process.env.EDUTRACK_SYNC_TIMEOUT_MS || 8000), 1000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${base}${pathname}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-edutrack-sync-secret": secret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Portal user sync failed with status ${response.status}`);
  }
  return data;
}

async function syncEduTrackUserAccountToPortal(user, options = {}) {
  if (process.env.APP_NAME !== "edutrack") {
    return { skipped: true, reason: "not-edutrack-app" };
  }

  const payload = eduTrackUserPortalSyncPayload(user, options);
  if (!payload.id || !payload.email || !payload.name) {
    return { skipped: true, reason: "missing-required-account-fields" };
  }

  try {
    return await postEduTrackUserToPortal("/api/internal/sync-edutrack-user", payload);
  } catch (error) {
    return { ok: false, warning: error.message || String(error) };
  }
}

async function deleteEduTrackUserAccountFromPortal(user) {
  if (process.env.APP_NAME !== "edutrack") {
    return { skipped: true, reason: "not-edutrack-app" };
  }

  const payload = eduTrackUserPortalSyncPayload(user);
  if (!payload.id && !payload.email) {
    return { skipped: true, reason: "missing-account-identity" };
  }

  try {
    return await postEduTrackUserToPortal("/api/internal/delete-edutrack-user", payload);
  } catch (error) {
    return { ok: false, warning: error.message || String(error) };
  }
}

async function verifyEduTrackLoginFromPortal(email, password) {
  if (process.env.APP_NAME === "edutrack") return null;
  const accountEmail = normalizeEmail(email);
  const accountPassword = String(password || "");
  if (!accountEmail || !accountPassword) return null;

  const { base, secret } = portalEduTrackAccountSyncConfig();
  if (!base || !secret) return null;

  const timeoutMs = Math.max(Number(process.env.EDUTRACK_SYNC_TIMEOUT_MS || 8000), 1000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${base}/api/internal/verify-edutrack-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-edutrack-sync-secret": secret,
      },
      body: JSON.stringify({ email: accountEmail, password: accountPassword }),
      signal: controller.signal,
    });
  } catch (error) {
    console.warn(`[login] EduTrack fallback verification failed: ${error.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403 || response.status === 404) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.warn(
      `[login] EduTrack fallback verification failed with status ${response.status}: ${
        data?.error || "unknown error"
      }`,
    );
    return null;
  }
  return data?.user || null;
}

async function portalLoginUserFromEduTrack(email, password, localUser = null) {
  if (localUser) {
    if (String(localUser.status || "").toLowerCase() !== "active") return null;
    if (!EDUTRACK_SSO_ROLES.has(String(localUser.role || ""))) return null;
  }

  const verifiedUser = await verifyEduTrackLoginFromPortal(email, password);
  if (!verifiedUser) return null;

  try {
    const syncedUser = await upsertWebsiteUserFromEduTrack({
      ...verifiedUser,
      email: verifiedUser.email || email,
      password,
    });
    const [[user]] = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [syncedUser.id]);
    return user || null;
  } catch (error) {
    console.warn(`[login] EduTrack fallback account sync failed: ${error.message}`);
    return null;
  }
}

async function storedEduTrackUserForPortalSync(userId, extra = {}, fallback = {}) {
  const id = compactText(userId || extra.id || fallback.id, 50);
  let stored = {};
  if (id) {
    const [rows] = await db.query(
      "SELECT id, external_staff_id, name, email, role, status, password_hash FROM users WHERE id = ? LIMIT 1",
      [id],
    );
    stored = rows[0] || {};
  }
  return {
    ...stored,
    ...fallback,
    ...extra,
    id: id || stored.id || fallback.id || extra.id,
    email: extra.email || fallback.email || stored.email,
    name: extra.name || fallback.name || stored.name,
    role: extra.role || fallback.role || stored.role,
    status: extra.status || fallback.status || stored.status,
    external_staff_id:
      extra.external_staff_id ||
      extra.externalStaffId ||
      fallback.external_staff_id ||
      fallback.externalStaffId ||
      stored.external_staff_id,
    passwordHash: stored.password_hash || fallback.passwordHash || extra.passwordHash,
  };
}

async function upsertWebsiteUserFromEduTrack(payload = {}) {
  if (process.env.APP_NAME === "edutrack") {
    const error = new Error("EduTrack-to-portal sync is not available on the EduTrack app");
    error.status = 404;
    throw error;
  }

  await ensureAccessTables();

  const requestedId = compactText(payload.id || payload.userId || payload.user_id, 50);
  const externalStaffId = compactText(
    payload.externalStaffId || payload.external_staff_id || payload.staffId || payload.staff_id,
    80,
  );
  const email = normalizeEmail(payload.email);
  const name = compactText(payload.name || email.split("@")[0] || "Teacher", 150);
  const role = portalRoleFromEduTrackRole(payload.role || payload.platformRole);
  const status = normalizeAccountStatus(payload.status);
  const password = typeof payload.password === "string" ? payload.password : "";
  const passwordHash = String(payload.passwordHash || payload.password_hash || "").trim();

  if (!email || !isValidEmail(email) || !name) {
    const error = new Error("name and a valid email are required");
    error.status = 400;
    throw error;
  }
  if (password && password.length < 6) {
    const error = new Error("Password must be at least 6 characters");
    error.status = 400;
    throw error;
  }
  if (passwordHash && !looksLikeBcryptHash(passwordHash)) {
    const error = new Error("Invalid password hash");
    error.status = 400;
    throw error;
  }

  const [matches] = await db.query(
    `
      SELECT id, role
      FROM users
      WHERE ${requestedId ? "id = ? OR" : ""} email = ?
      ORDER BY ${requestedId ? "(id = ?) DESC," : ""} id
      LIMIT 1
    `,
    requestedId ? [requestedId, email, requestedId] : [email],
  );
  const userId = matches[0]?.id || requestedId || syncAccountId("EDU");
  const nextPasswordHash = password
    ? await bcrypt.hash(password, 12)
    : passwordHash || "";

  if (matches.length && SYSTEM_OWNER_ROLES.includes(matches[0].role) && !SYSTEM_OWNER_ROLES.includes(role)) {
    const error = new Error("Refusing to downgrade a system owner account from EduTrack sync");
    error.status = 403;
    throw error;
  }

  if (matches.length) {
    if (nextPasswordHash) {
      await db.query(
        `
          UPDATE users
          SET external_staff_id = COALESCE(NULLIF(?, ''), external_staff_id),
              name = ?,
              email = ?,
              role = ?,
              status = ?,
              password_hash = ?
          WHERE id = ?
        `,
        [externalStaffId, name, email, role, status, nextPasswordHash, userId],
      );
    } else {
      await db.query(
        `
          UPDATE users
          SET external_staff_id = COALESCE(NULLIF(?, ''), external_staff_id),
              name = ?,
              email = ?,
              role = ?,
              status = ?
          WHERE id = ?
        `,
        [externalStaffId, name, email, role, status, userId],
      );
    }
  } else {
    const insertPasswordHash =
      nextPasswordHash || (await bcrypt.hash(syncSetupPassword(), 12));
    await db.query(
      `
        INSERT INTO users (id, external_staff_id, name, email, role, status, password_hash)
        VALUES (?, NULLIF(?, ''), ?, ?, ?, ?, ?)
      `,
      [userId, externalStaffId, name, email, role, status, insertPasswordHash],
    );
  }

  if (role === ROLES.teacher || externalStaffId) {
    await linkPortalUserToStaffRecords(db, userId, externalStaffId, email);
  }

  return { id: userId, external_staff_id: externalStaffId, name, email, role, status };
}

async function deleteWebsiteUserFromEduTrack(payload = {}) {
  if (process.env.APP_NAME === "edutrack") {
    const error = new Error("EduTrack-to-portal delete is not available on the EduTrack app");
    error.status = 404;
    throw error;
  }

  await ensureAccessTables();
  const userId = compactText(payload.id || payload.userId || payload.user_id, 50);
  const email = normalizeEmail(payload.email);
  if (!userId && !email) return { deleted: false, reason: "missing-account-identity" };

  const [rows] = await db.query(
    `
      SELECT id, role
      FROM users
      WHERE ${userId ? "id = ? OR" : ""} ${email ? "email = ?" : "1 = 0"}
      ORDER BY ${userId ? "(id = ?) DESC," : ""} id
      LIMIT 1
    `,
    userId && email ? [userId, email, userId] : userId ? [userId, userId] : [email],
  );
  const user = rows[0];
  if (!user) return { deleted: false };
  if (SYSTEM_OWNER_ROLES.includes(user.role)) {
    const error = new Error("Refusing to delete a system owner account from EduTrack sync");
    error.status = 403;
    throw error;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await unlinkPortalUserFromStaffRecords(connection, user.id);
    const [result] = await connection.query("DELETE FROM users WHERE id = ?", [user.id]);
    await connection.commit();
    return { deleted: Number(result.affectedRows || 0) > 0 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function syncExistingEduTrackUsersToPortal() {
  if (process.env.APP_NAME !== "edutrack") {
    return { skipped: true, reason: "not-edutrack-app" };
  }
  if (!eduTrackPortalAccountSyncConfig().available) {
    return { skipped: true, reason: "portal-account-sync-not-configured" };
  }

  await ensureContentTables();
  const [users] = await db.query(
    `
      SELECT id, external_staff_id, name, email, role, status, password_hash
      FROM users
      WHERE NULLIF(email, '') IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 2000
    `,
  );
  const docs = await listEduTrackDocs("users");
  const docById = new Map(docs.map((doc) => [String(doc.id), doc.data || {}]));
  const result = { checked: users.length, synced: 0, failed: 0, warnings: [] };

  for (const user of users) {
    const doc = docById.get(String(user.id)) || {};
    const payload = await storedEduTrackUserForPortalSync(user.id, doc, user);
    const syncResult = await syncEduTrackUserAccountToPortal(payload, {
      passwordHash: user.password_hash,
    });
    if (syncResult?.success || syncResult?.user) {
      result.synced += 1;
    } else if (syncResult?.skipped) {
      result.warnings.push(`${user.email}: ${syncResult.reason}`);
    } else {
      result.failed += 1;
      result.warnings.push(`${user.email}: ${syncResult?.warning || "sync failed"}`);
    }
  }

  return result;
}

let eduTrackPortalAccountSyncScheduled = false;
function scheduleEduTrackPortalAccountSyncMaintenance(delayMs = 6000) {
  if (eduTrackPortalAccountSyncScheduled || process.env.APP_NAME !== "edutrack") return;
  eduTrackPortalAccountSyncScheduled = true;
  setTimeout(async () => {
    try {
      const result = await syncExistingEduTrackUsersToPortal();
      if (!result.skipped) {
        console.log(
          `EduTrack portal account sync checked ${result.checked} users; synced ${result.synced}, failed ${result.failed}.`,
        );
      }
    } catch (error) {
      console.error("EduTrack portal account sync failed:", error.message);
    }
  }, delayMs);
}

function requiresExternalEduTrackSync() {
  const enabled = String(process.env.ENABLE_CROSS_SYSTEM_TEACHER_SYNC || "")
    .trim()
    .toLowerCase();
  return (
    ["1", "true", "yes", "on"].includes(enabled) &&
    process.env.APP_NAME !== "edutrack" &&
    process.env.NODE_ENV === "production"
  );
}

async function postExternalEduTrackSync(payload) {
  const { base, secret } = externalEduTrackSyncConfig();
  if (!base || !secret) return null;

  const timeoutMs = Math.max(Number(process.env.EDUTRACK_SYNC_TIMEOUT_MS || 8000), 1000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${base}/api/internal/sync-teacher-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-edutrack-sync-secret": secret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `EduTrack sync failed with status ${response.status}`);
  }
  return data;
}

async function runLocalEduTrackSync(runner, payload, options = {}) {
  if (runner === db && typeof db.getConnection === "function") {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const result = await upsertLocalEduTrackTeacher(connection, payload, options);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  return upsertLocalEduTrackTeacher(runner, payload, options);
}

async function syncTeacherAccountToEduTrack(runnerOrPayload, maybePayload) {
  const runner =
    runnerOrPayload && typeof runnerOrPayload.query === "function" ? runnerOrPayload : db;
  const payload =
    runnerOrPayload && typeof runnerOrPayload.query === "function" ? maybePayload : runnerOrPayload;

  if (!payload) return { ok: false, queued: false, warning: "EduTrack sync payload missing" };
  if (!externalEduTrackSyncConfig().available) {
    return { ok: true, skipped: true, reason: "cross-system-teacher-sync-disabled" };
  }

  await ensureContentTables();
  await ensureStaffSyncSchema();

  try {
    if (!externalEduTrackSyncConfig().available && requiresExternalEduTrackSync()) {
      throw new Error(
        "EduTrack sync endpoint is not configured. Set EDUTRACK_INTERNAL_BASE_URL and EDUTRACK_SYNC_SECRET.",
      );
    }

    const externalResult = await postExternalEduTrackSync(payload);
    if (externalResult) {
      const teacherId =
        externalResult.edutrack_teacher_id || externalResult.teacherId || payload.teacherId;
      await markStaffEduTrackSync(runner, payload, "synced", "", teacherId);
      return { ok: true, remote: true, data: externalResult, teacherId };
    }

    const localResult = await runLocalEduTrackSync(runner, payload);
    return {
      ok: true,
      remote: false,
      data: localResult,
      teacherId: localResult.teacherId,
    };
  } catch (error) {
    await queueStaffEduTrackSync(runner, payload, error);
    return {
      ok: false,
      queued: true,
      warning: `EduTrack teacher sync failed and was queued: ${error.message}`,
    };
  }
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

function visualSnapshotPublishIssues(siteDb) {
  const pages = isPlainObject(siteDb?.pages) ? siteDb.pages : {};
  const issues = [];

  for (const [slug, page] of Object.entries(pages)) {
    if (!isPlainObject(page)) continue;
    const visualHtml = typeof page.visualHtml === "string" ? page.visualHtml.trim() : "";
    if (!visualHtml || page.visualMode === "coded") continue;

    const visualBaseCss = typeof page.visualBaseCss === "string" ? page.visualBaseCss.trim() : "";
    const visualCss = typeof page.visualCss === "string" ? page.visualCss.trim() : "";

    if (!visualBaseCss) issues.push(`${slug}: missing visualBaseCss`);
    if (!visualCss) issues.push(`${slug}: missing visualCss`);
  }

  return issues;
}

function assertVisualSnapshotsReadyForPublish(siteDb) {
  const issues = visualSnapshotPublishIssues(siteDb);
  if (issues.length > 0) {
    throw new Error(
      `Publish blocked because visual page CSS snapshots are incomplete. ${issues.join("; ")}`,
    );
  }
}

async function upsertPortalUserAccount(runner, user) {
  const accountId = String(user?.id || `U-${Date.now()}`).trim();
  const externalStaffId = compactText(user?.external_staff_id || user?.externalStaffId, 80);
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
        "UPDATE users SET external_staff_id = COALESCE(NULLIF(?, ''), external_staff_id), name = ?, email = ?, role = ?, status = ?, password_hash = ? WHERE id = ?",
        [
          externalStaffId,
          accountName,
          accountEmail,
          accountRole,
          accountStatus,
          passwordHash,
          effectiveAccountId,
        ],
      );
    } else {
      await runner.query(
        "UPDATE users SET external_staff_id = COALESCE(NULLIF(?, ''), external_staff_id), name = ?, email = ?, role = ?, status = ? WHERE id = ?",
        [externalStaffId, accountName, accountEmail, accountRole, accountStatus, effectiveAccountId],
      );
    }
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await runner.query(
      "INSERT INTO users (id, external_staff_id, name, email, role, status, password_hash) VALUES (?, NULLIF(?, ''), ?, ?, ?, ?, ?)",
      [accountId, externalStaffId, accountName, accountEmail, accountRole, accountStatus, passwordHash],
    );
  }
}

async function upsertTeacherUserAccount(
  runner,
  { id, externalStaffId, name, email, recoveryEmail, password, status = "Active" },
) {
  const requestedAccountId = String(id || "").trim();
  const accountExternalStaffId = compactText(externalStaffId, 80) || null;
  const accountEmail = normalizeEmail(email);
  const recoveryEmailProvided = recoveryEmail !== undefined;
  const normalizedRecoveryEmail = normalizeEmail(recoveryEmail);
  const accountName = String(name || accountEmail.split("@")[0] || "Teacher").trim();
  const accountStatus = normalizeAccountStatus(status);

  if (!isValidEmail(accountEmail)) {
    throw new Error("A valid teacher account email is required");
  }
  if (recoveryEmailProvided && normalizedRecoveryEmail && !isValidEmail(normalizedRecoveryEmail)) {
    throw new Error("A valid personal recovery email is required");
  }
  if (normalizedRecoveryEmail && normalizedRecoveryEmail === accountEmail) {
    throw new Error("Recovery email must be different from the teacher portal email");
  }

  const [emailMatches] = await runner.query(
    "SELECT id, role FROM users WHERE email = ? LIMIT 1",
    [accountEmail],
  );
  if (emailMatches.length && emailMatches[0].role !== ROLES.teacher) {
    const error = new Error(
      "This email belongs to a non-teacher account. Use a different teacher login email.",
    );
    error.status = 409;
    throw error;
  }
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

  const [idMatches] = await runner.query(
    "SELECT id, recovery_email, role FROM users WHERE id = ? LIMIT 1",
    [accountId],
  );
  if (idMatches.length && idMatches[0].role !== ROLES.teacher) {
    const error = new Error(
      "This staff profile is linked to a non-teacher account. Remove that link before creating a teacher login.",
    );
    error.status = 409;
    throw error;
  }
  const accountRecoveryEmail = recoveryEmailProvided
    ? normalizedRecoveryEmail || null
    : idMatches[0]?.recovery_email || null;
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
        "UPDATE users SET external_staff_id = COALESCE(?, external_staff_id), name = ?, email = ?, recovery_email = ?, role = 'teacher', status = ?, password_hash = ? WHERE id = ?",
        [
          accountExternalStaffId,
          accountName,
          accountEmail,
          accountRecoveryEmail,
          accountStatus,
          passwordHash,
          accountId,
        ],
      );
    } else {
      await runner.query(
        "UPDATE users SET external_staff_id = COALESCE(?, external_staff_id), name = ?, email = ?, recovery_email = ?, role = 'teacher', status = ? WHERE id = ?",
        [
          accountExternalStaffId,
          accountName,
          accountEmail,
          accountRecoveryEmail,
          accountStatus,
          accountId,
        ],
      );
    }
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await runner.query(
      "INSERT INTO users (id, external_staff_id, name, email, recovery_email, role, status, password_hash) VALUES (?, ?, ?, ?, ?, 'teacher', ?, ?)",
      [
        accountId,
        accountExternalStaffId,
        accountName,
        accountEmail,
        accountRecoveryEmail,
        accountStatus,
        passwordHash,
      ],
    );
  }

  return {
    id: accountId,
    externalStaffId: accountExternalStaffId || "",
    name: accountName,
    email: accountEmail,
    recoveryEmail: accountRecoveryEmail || "",
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

  if (
    cleanFolder.startsWith("pages/") ||
    cleanFolder === "page-images" ||
    cleanFolder.includes("site-images/pages")
  ) {
    return "Page images";
  }
  if (cleanFolder.includes("news")) return "News photos";
  if (cleanFolder.includes("event")) return "Event photos";
  if (cleanFolder.includes("gallery-videos") || cleanFolder.includes("video-gallery")) {
    return "Video gallery";
  }
  if (cleanFolder.includes("gallery")) return "Gallery photos";
  if (cleanFolder.includes("notice") || cleanFolder.includes("download")) return "Documents";
  if (cleanFolder.includes("document")) return "Documents";
  if (cleanFolder.includes("staff")) return "Staff profiles";
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

async function processVideoUpload(req, file, folder = "videos") {
  requireFfmpeg();
  const outputDirectory = path.join(uploadRoot, safePathSegment(folder || "videos"));
  await fs.promises.mkdir(outputDirectory, { recursive: true });

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
  const mp4Path = path.join(outputDirectory, `${baseName}.mp4`);
  const webmPath = path.join(outputDirectory, `${baseName}.webm`);
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
  if (kind === "short_video_upload") return processVideoUpload(req, file, folder);
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
        item.description || item.type || "",
        item.posterUrl || item.poster_url || item.image || "",
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
            externalStaffId: item.staffId || item.externalStaffId || item.id,
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
  (siteDb.events || []).forEach((item) =>
    add("events", item.image || item.posterUrl || item.poster_url),
  );
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
  const sanitizedInput = sanitizeSiteDbSecurity(siteDb);
  if (mode === "published") assertVisualSnapshotsReadyForPublish(sanitizedInput);
  const incomingDb = applyExplicitContentDeletes(sanitizedInput, sanitizedInput);
  const existingDb = await readSiteDb({ draft: mode === "draft" });
  const publishedDb = mode === "draft" ? await readSiteDb({ draft: false }) : null;
  const deletionAwareExistingDb = applyExplicitContentDeletes(existingDb, incomingDb);
  const protectedDb = protectPageSnapshot(incomingDb, deletionAwareExistingDb);
  const persistentDb = protectPersistentContentSnapshot(protectedDb, deletionAwareExistingDb);
  const syncDb = {
    ...persistentDb,
    contentVersion,
    publishedAt: mode === "published" ? nowIso : persistentDb.publishedAt || nowIso,
  };
  const savedDb = scrubUserPasswords(
    mode === "published" ? clearExplicitContentDeletes(syncDb) : syncDb,
  );

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

app.use(viewAdminWriteGuard);

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

app.get("/api/csrf", (req, res) => {
  const token = setCsrfCookie(res);
  res.json({ csrfToken: token });
});

app.get("/api/maintenance", async (req, res) => {
  try {
    const settings = await readMaintenanceSettingsForGate();
    res.json({
      ...settings,
      canViewSite: canBypassMaintenance(req),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/maintenance", websiteAdminOnly, async (req, res) => {
  try {
    const current = await readMaintenanceSettings();
    const next = await writeMaintenanceSettings({
      enabled: Boolean(req.body?.enabled),
      message: typeof req.body?.message === "string" ? req.body.message : current.message,
    });
    res.json({ success: true, ...next, canViewSite: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function isPublicContentApiRequest(req) {
  if (req.method !== "GET") return false;
  const publicApiPaths = [
    "/api/site-db",
    "/api/pages",
    "/api/news",
    "/api/notices",
    "/api/events",
    "/api/media",
    "/api/teachers",
  ];
  return publicApiPaths.some(
    (apiPath) => req.path === apiPath || req.path.startsWith(`${apiPath}/`),
  );
}

app.use(async (req, res, next) => {
  if (!isPublicContentApiRequest(req)) return next();

  try {
    const settings = await readMaintenanceSettingsForGate();
    if (!settings.enabled || canBypassMaintenance(req)) return next();
    return res.status(503).json({
      error: "Website maintenance is active.",
      maintenance: true,
      message: settings.message,
    });
  } catch (error) {
    return next(error);
  }
});

async function readManagedPortalUsers() {
  await ensureAccessTables();
  const [rows] = await db.query(
    "SELECT id, external_staff_id, name, email, role, status, two_factor_enabled, created_at FROM users ORDER BY created_at DESC",
  );

  const users = rows.map((user) => ({
    ...user,
    accountMissing: false,
    source: "users",
    twoFactorEnabled: Boolean(Number(user.two_factor_enabled || 0)),
  }));

  if (!(await tableExists("staff_profiles"))) return users;

  const [staffRows] = await db.query(`
    SELECT
      sp.id AS external_staff_id,
      sp.full_name AS name,
      sp.email AS email,
      sp.status AS staff_status,
      sp.created_at AS created_at,
      sp.user_id AS linked_user_id,
      u.id AS user_id
    FROM staff_profiles sp
    LEFT JOIN users u
      ON u.id = sp.user_id
      OR NULLIF(u.external_staff_id, '') = sp.id
      OR (NULLIF(sp.email, '') IS NOT NULL AND LOWER(u.email) = LOWER(sp.email))
    WHERE u.id IS NULL
    ORDER BY sp.full_name ASC
  `);

  return [
    ...users,
    ...staffRows.map((row) => ({
      id: `staff:${row.external_staff_id}`,
      external_staff_id: row.external_staff_id,
      name: row.name || row.external_staff_id,
      email: row.email || "",
      role: ROLES.teacher,
      status: "Not Created",
      source: "staff_profiles",
      accountMissing: true,
      twoFactorEnabled: false,
      created_at: row.created_at,
    })),
  ];
}

async function linkPortalUserToStaffRecords(runner, userId, externalStaffId, email) {
  const staffId = compactText(externalStaffId, 80);
  const accountEmail = normalizeEmail(email);
  if (!staffId && !accountEmail) return;

  if (await tableExists("staff_profiles", runner)) {
    const values = [];
    const clauses = [];
    if (staffId) {
      clauses.push("id = ?");
      values.push(staffId);
    }
    if (accountEmail) {
      clauses.push("LOWER(email) = LOWER(?)");
      values.push(accountEmail);
    }
    if (clauses.length) {
      await runner.query(
        `UPDATE staff_profiles SET user_id = ? WHERE ${clauses.join(" OR ")}`,
        [userId, ...values],
      );
    }
  }

  if (await tableExists("teachers", runner)) {
    const values = [];
    const clauses = [];
    if (staffId) {
      clauses.push("(staff_id = ? OR external_staff_id = ? OR id = ?)");
      values.push(staffId, staffId, staffId);
    }
    if (accountEmail) {
      clauses.push("LOWER(email) = LOWER(?)");
      values.push(accountEmail);
    }
    if (clauses.length) {
      await runner.query(
        `
          UPDATE teachers
          SET account_user_id = ?, account_email = ?
          WHERE ${clauses.join(" OR ")}
        `,
        [userId, accountEmail, ...values],
      );
    }
  }
}

async function unlinkPortalUserFromStaffRecords(runner, userId) {
  const accountId = compactText(userId, 50);
  if (!accountId) return;
  if (await tableExists("staff_profiles", runner)) {
    await runner.query("UPDATE staff_profiles SET user_id = NULL WHERE user_id = ?", [accountId]);
  }
  if (await tableExists("teachers", runner)) {
    await runner.query(
      "UPDATE teachers SET account_user_id = NULL, account_email = NULL WHERE account_user_id = ?",
      [accountId],
    );
  }
}

app.get("/api/users", masterAdminOnly, async (req, res) => {
  try {
    res.json(await readManagedPortalUsers());
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/users", masterAdminOnly, async (req, res) => {
  try {
    await ensureAccessTables();
    const {
      id,
      name,
      email,
      password,
      role = ROLES.teacher,
      status = "Active",
      external_staff_id,
      externalStaffId,
    } = req.body || {};
    const accountEmail = normalizeEmail(email);
    const accountName = compactText(name || accountEmail.split("@")[0], 150);
    const accountPassword = String(password || "");
    const staffId = compactText(external_staff_id || externalStaffId, 80);

    if (!accountName || !accountEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)) {
      return res.status(400).json({ error: "Name and a valid email are required" });
    }
    if (accountPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const [existing] = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [
      accountEmail,
    ]);
    if (existing.length) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }

    const accountId = compactText(id, 50) || syncAccountId("USR");
    await upsertPortalUserAccount(db, {
      id: accountId,
      external_staff_id: staffId,
      name: accountName,
      email: accountEmail,
      password: accountPassword,
      role,
      status,
    });
    if (normalizePortalRole(role) === ROLES.teacher || staffId) {
      await linkPortalUserToStaffRecords(db, accountId, staffId, accountEmail);
    }
    const savedUser = {
      id: accountId,
      external_staff_id: staffId,
      name: accountName,
      email: accountEmail,
      role: normalizePortalRole(role),
      status: normalizeAccountStatus(status),
      twoFactorEnabled: false,
    };
    const eduTrackSync = await syncPortalUserAccountToEduTrack(savedUser, {
      password: accountPassword,
    });

    res.status(201).json({
      success: true,
      user: savedUser,
      eduTrackSync,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/users/:id", masterAdminOnly, async (req, res) => {
  try {
    await ensureAccessTables();
    const userId = compactText(req.params.id, 50);
    const [[existing]] = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
    if (!existing) return res.status(404).json({ error: "User not found" });

    const nextEmail =
      req.body?.email === undefined ? existing.email : normalizeEmail(req.body.email);
    const nextName = req.body?.name === undefined ? existing.name : compactText(req.body.name, 150);
    const nextRole =
      req.body?.role === undefined ? existing.role : normalizePortalRole(req.body.role);
    const nextStatus =
      req.body?.status === undefined ? existing.status : normalizeAccountStatus(req.body.status);
    const nextExternalStaffId =
      req.body?.external_staff_id === undefined && req.body?.externalStaffId === undefined
        ? compactText(existing.external_staff_id || "", 80)
        : compactText(req.body.external_staff_id || req.body.externalStaffId, 80);
    const nextPassword =
      typeof req.body?.password === "string" && req.body.password.length > 0
        ? req.body.password
        : "";

    if (!nextName || !nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return res.status(400).json({ error: "Name and a valid email are required" });
    }
    if (nextPassword && nextPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const [emailMatches] = await db.query(
      "SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1",
      [nextEmail, userId],
    );
    if (emailMatches.length) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }

    if (nextPassword) {
      const passwordHash = await bcrypt.hash(nextPassword, 12);
      await db.query(
        "UPDATE users SET external_staff_id = NULLIF(?, ''), name = ?, email = ?, role = ?, status = ?, password_hash = ? WHERE id = ?",
        [nextExternalStaffId, nextName, nextEmail, nextRole, nextStatus, passwordHash, userId],
      );
    } else {
      await db.query(
        "UPDATE users SET external_staff_id = NULLIF(?, ''), name = ?, email = ?, role = ?, status = ? WHERE id = ?",
        [nextExternalStaffId, nextName, nextEmail, nextRole, nextStatus, userId],
      );
    }
    const savedUser = {
      id: userId,
      external_staff_id: nextExternalStaffId,
      name: nextName,
      email: nextEmail,
      role: nextRole,
      status: nextStatus,
      twoFactorEnabled: twoFactorEnabledForUser(existing),
    };
    const eduTrackSync = await syncPortalUserAccountToEduTrack(savedUser, {
      password: nextPassword,
      previousRole: existing.role,
    });
    if (nextRole === ROLES.teacher || savedUser.external_staff_id) {
      await linkPortalUserToStaffRecords(db, userId, savedUser.external_staff_id, nextEmail);
    }

    res.json({
      success: true,
      user: savedUser,
      eduTrackSync,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/users/:id", masterAdminOnly, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAccessTables();
    const userId = compactText(req.params.id, 50);
    if (req.user?.id === userId) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    const [[existing]] = await db.query(
      "SELECT id, external_staff_id, name, email, role, status FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    if (!existing) return res.status(404).json({ error: "User not found" });

    const eduTrackSync = await syncPortalUserAccountToEduTrack(
      { ...existing, status: "Disabled" },
      { previousRole: existing.role, statusOverride: "Disabled" },
    );

    await connection.beginTransaction();
    await unlinkPortalUserFromStaffRecords(connection, userId);
    const [result] = await connection.query("DELETE FROM users WHERE id = ?", [userId]);
    await connection.commit();

    res.json({ success: true, deleted: result.affectedRows > 0, eduTrackSync });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback failures so the original error is reported.
    }
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

app.post("/api/users/:id/2fa/reset", masterAdminOnly, async (req, res) => {
  try {
    await ensureAccessTables();
    const userId = compactText(req.params.id, 50);
    if (!userId) return res.status(400).json({ error: "User id is required" });

    const [result] = await db.query(
      `
        UPDATE users
        SET two_factor_enabled = 0,
            two_factor_secret = NULL,
            two_factor_pending_secret = NULL,
            two_factor_confirmed_at = NULL,
            two_factor_last_used_step = NULL
        WHERE id = ?
      `,
      [userId],
    );

    res.json({ success: true, reset: result.affectedRows > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/staff-accounts", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const {
      teacherId,
      name,
      email,
      recoveryEmail,
      password = "",
      status = "Active",
    } = req.body || {};

    const user = await upsertTeacherUserAccount(db, {
      id: teacherId,
      externalStaffId: teacherId,
      name,
      email,
      recoveryEmail,
      password,
      status,
    });

    res.json({ success: true, user });
  } catch (error) {
    const statusCode =
      error.status ||
      /already used|valid teacher account|valid personal recovery email|Recovery email|Password is required|at least 6|id is required/i.test(
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

app.post("/api/internal/sync-teacher-account", async (req, res) => {
  if (!externalEduTrackSyncConfig().available) {
    return res.status(404).json({
      error: "Teacher sync is disabled in this standalone EduTrack deployment",
    });
  }
  const configuredSecret = process.env.EDUTRACK_SYNC_SECRET;
  const requestSecret = req.headers["x-edutrack-sync-secret"];
  if (!configuredSecret || requestSecret !== configuredSecret) {
    return res.status(401).json({ error: "Invalid sync secret" });
  }

  const connection = await db.getConnection();
  try {
    await ensureContentTables();
    await ensureStaffSyncSchema();
    await connection.beginTransaction();
    const result = await upsertLocalEduTrackTeacher(connection, req.body || {});
    await connection.commit();
    res.json({
      success: true,
      edutrack_user_id: result.userId,
      edutrack_teacher_id: result.teacherId,
    });
  } catch (error) {
    await connection.rollback();
    res.status(400).json({ error: error.message });
  } finally {
    connection.release();
  }
});

async function upsertPortalUserForEduTrack(payload = {}) {
  await ensureAccessTables();
  await ensureContentTables();

  const requestedId = compactText(payload.id || payload.userId || payload.user_id, 50);
  const externalStaffId = compactText(
    payload.externalStaffId || payload.external_staff_id || payload.staffId || payload.staff_id,
    80,
  );
  const email = normalizeEmail(payload.email);
  const name = compactText(payload.name || email.split("@")[0] || "User", 150);
  const role = normalizePortalRole(payload.role);
  const status = shouldMirrorPortalUserToEduTrack(role)
    ? normalizeAccountStatus(payload.status)
    : "Disabled";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!requestedId || !name || !isValidEmail(email)) {
    const error = new Error("id, name, and a valid email are required");
    error.status = 400;
    throw error;
  }
  if (password && password.length < 8) {
    const error = new Error("Password must be at least 8 characters");
    error.status = 400;
    throw error;
  }

  const [matches] = await db.query(
    `
      SELECT id, role
      FROM users
      WHERE id = ? OR email = ?
      ORDER BY (id = ?) DESC, id
      LIMIT 1
    `,
    [requestedId, email, requestedId],
  );
  const userId = matches[0]?.id || requestedId;

  if (matches.length) {
    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);
      await db.query(
        `
          UPDATE users
          SET external_staff_id = COALESCE(NULLIF(?, ''), external_staff_id),
              name = ?,
              email = ?,
              role = ?,
              status = ?,
              password_hash = ?
          WHERE id = ?
        `,
        [externalStaffId, name, email, role, status, passwordHash, userId],
      );
    } else {
      await db.query(
        `
          UPDATE users
          SET external_staff_id = COALESCE(NULLIF(?, ''), external_staff_id),
              name = ?,
              email = ?,
              role = ?,
              status = ?
          WHERE id = ?
        `,
        [externalStaffId, name, email, role, status, userId],
      );
    }
  } else {
    const passwordHash = await bcrypt.hash(password || crypto.randomBytes(48).toString("hex"), 12);
    await db.query(
      `
        INSERT INTO users (id, external_staff_id, name, email, role, status, password_hash)
        VALUES (?, NULLIF(?, ''), ?, ?, ?, ?, ?)
      `,
      [userId, externalStaffId, name, email, role, status, passwordHash],
    );
  }

  const now = new Date().toISOString();
  const currentDoc = (await readEduTrackDoc("users", userId)) || {};
  const teacherId = externalStaffId || userId;
  await writeEduTrackDoc("users", userId, {
    ...currentDoc,
    id: userId,
    userId,
    name,
    email,
    role: eduTrackRole(role),
    platformRole: role,
    status,
    source: "portal-users",
    updatedAt: now,
    createdAt: currentDoc.createdAt || now,
    ...(role === ROLES.teacher
      ? {
          teacherId,
          teacher_id: teacherId,
          staffId: teacherId,
          staff_id: teacherId,
        }
      : {}),
  });

  if (role === ROLES.teacher && status === "Active") {
    await upsertLocalEduTrackTeacher(
      db,
      {
        userId,
        staffId: teacherId,
        teacherId,
        name,
        email,
        status,
        staffType: "Portal User",
      },
      { markSync: false },
    );
  }

  return {
    id: userId,
    name,
    email,
    role,
    status,
  };
}

app.post("/api/internal/sync-portal-user", async (req, res) => {
  if (process.env.APP_NAME !== "edutrack") {
    return res.status(404).json({ error: "EduTrack portal user sync is not available here" });
  }

  const configuredSecret = process.env.EDUTRACK_SYNC_SECRET || process.env.EDUTRACK_SSO_SECRET;
  const requestSecret = req.headers["x-edutrack-sync-secret"];
  if (!configuredSecret || requestSecret !== configuredSecret) {
    return res.status(401).json({ error: "Invalid sync secret" });
  }

  try {
    const user = await upsertPortalUserForEduTrack(req.body || {});
    res.json({ success: true, user });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.post("/api/internal/verify-edutrack-login", async (req, res) => {
  if (process.env.APP_NAME !== "edutrack") {
    return res.status(404).json({ error: "EduTrack login verification is not available here" });
  }

  const configuredSecret = process.env.EDUTRACK_SYNC_SECRET || process.env.EDUTRACK_SSO_SECRET;
  const requestSecret = req.headers["x-edutrack-sync-secret"];
  if (!configuredSecret || requestSecret !== configuredSecret) {
    return res.status(401).json({ error: "Invalid sync secret" });
  }

  try {
    await ensureContentTables();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!isValidEmail(email) || !password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const [users] = await db.query(
      "SELECT id, external_staff_id, name, email, role, status, password_hash FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    const user = users[0];
    if (!user || String(user.status || "").toLowerCase() !== "active") {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash || "");
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const extra = (await readEduTrackDoc("users", user.id)) || {};
    const payload = await storedEduTrackUserForPortalSync(user.id, extra, user);
    delete payload.passwordHash;
    delete payload.password_hash;
    res.json({ success: true, user: payload });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/internal/sync-edutrack-user", async (req, res) => {
  if (process.env.APP_NAME === "edutrack") {
    return res.status(404).json({ error: "Website portal user sync is not available here" });
  }

  const configuredSecret = process.env.EDUTRACK_SYNC_SECRET || process.env.EDUTRACK_SSO_SECRET;
  const requestSecret = req.headers["x-edutrack-sync-secret"];
  if (!configuredSecret || requestSecret !== configuredSecret) {
    return res.status(401).json({ error: "Invalid sync secret" });
  }

  try {
    const user = await upsertWebsiteUserFromEduTrack(req.body || {});
    res.json({ success: true, user });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.post("/api/internal/delete-edutrack-user", async (req, res) => {
  if (process.env.APP_NAME === "edutrack") {
    return res.status(404).json({ error: "Website portal user delete is not available here" });
  }

  const configuredSecret = process.env.EDUTRACK_SYNC_SECRET || process.env.EDUTRACK_SSO_SECRET;
  const requestSecret = req.headers["x-edutrack-sync-secret"];
  if (!configuredSecret || requestSecret !== configuredSecret) {
    return res.status(401).json({ error: "Invalid sync secret" });
  }

  try {
    const result = await deleteWebsiteUserFromEduTrack(req.body || {});
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
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

app.get("/api/security/visual-content-scan", websiteAdminOnly, async (req, res) => {
  try {
    const useDraft = req.query.draft === "1" || req.headers["x-loyola-draft"] === "true";
    const siteDb = await readSiteDb({ draft: useDraft });
    res.json({
      mode: useDraft ? "draft" : "published",
      issues: scanVisualContent(siteDb),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const data = scrubUserPasswords(sanitizeSiteDbSecurity(req.body.db));
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

function jobVacancyPayload(body = {}) {
  const allowedStatuses = new Set(["Open", "Closed", "Expired"]);
  const status = compactText(body.status || "Open", 30);
  const deadline = compactText(body.deadline, 10);
  return {
    title: compactText(body.title, 255),
    description: compactText(body.description, 10000),
    requirements: compactText(body.requirements, 10000),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : null,
    status: allowedStatuses.has(status) ? status : "Open",
    attachmentUrl: compactText(body.attachment_url || body.attachmentUrl, 2000),
    attachmentType: compactText(body.attachment_type || body.attachmentType, 100),
    applicationEmail: normalizeEmail(body.application_email || body.applicationEmail || ""),
    isVisible:
      body.is_visible === undefined && body.isVisible === undefined
        ? true
        : Boolean(body.is_visible ?? body.isVisible),
  };
}

function serializeJobVacancy(row) {
  const deadline =
    row.deadline instanceof Date
      ? row.deadline.toISOString().slice(0, 10)
      : String(row.deadline || "").slice(0, 10);
  const isPastDeadline =
    deadline && new Date(`${deadline}T23:59:59`).getTime() < new Date().setHours(0, 0, 0, 0);
  return {
    ...row,
    deadline: deadline || null,
    status: row.status === "Open" && isPastDeadline ? "Expired" : row.status,
    is_visible: Boolean(row.is_visible),
  };
}

app.get("/api/job-vacancies", async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      `SELECT id, title, description, requirements, deadline, status, attachment_url,
              attachment_type, application_email, is_visible, created_at, updated_at
       FROM job_vacancies
       WHERE is_visible = 1 AND deleted_at IS NULL
       ORDER BY CASE status WHEN 'Open' THEN 0 WHEN 'Closed' THEN 1 ELSE 2 END,
                deadline IS NULL, deadline ASC, created_at DESC`,
    );
    res.json(rows.map(serializeJobVacancy));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/job-vacancies", websiteAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [rows] = await db.query(
      `SELECT id, title, description, requirements, deadline, status, attachment_url,
              attachment_type, application_email, is_visible, created_at, updated_at, deleted_at
       FROM job_vacancies
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`,
    );
    res.json(rows.map(serializeJobVacancy));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/job-vacancies", websiteAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const payload = jobVacancyPayload(req.body);
    if (!payload.title || !payload.description) {
      return res.status(400).json({ error: "Title and description are required" });
    }
    const [result] = await db.query(
      `INSERT INTO job_vacancies
        (title, description, requirements, deadline, status, attachment_url,
         attachment_type, application_email, is_visible, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.title,
        payload.description,
        payload.requirements || null,
        payload.deadline,
        payload.status,
        payload.attachmentUrl || null,
        payload.attachmentType || null,
        payload.applicationEmail || null,
        payload.isVisible ? 1 : 0,
        req.user.id,
      ],
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/admin/job-vacancies/:id", websiteAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const payload = jobVacancyPayload(req.body);
    if (!payload.title || !payload.description) {
      return res.status(400).json({ error: "Title and description are required" });
    }
    const [result] = await db.query(
      `UPDATE job_vacancies
       SET title = ?, description = ?, requirements = ?, deadline = ?, status = ?,
           attachment_url = ?, attachment_type = ?, application_email = ?, is_visible = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [
        payload.title,
        payload.description,
        payload.requirements || null,
        payload.deadline,
        payload.status,
        payload.attachmentUrl || null,
        payload.attachmentType || null,
        payload.applicationEmail || null,
        payload.isVisible ? 1 : 0,
        Number(req.params.id),
      ],
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Vacancy not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/admin/job-vacancies/:id", websiteAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const [result] = await db.query(
      "UPDATE job_vacancies SET is_visible = 0, deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL",
      [Number(req.params.id)],
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Vacancy not found" });
    res.json({ success: true });
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
    res.json(await readTeacherSiteRows());
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

const DAILY_COMPLETION_STATUSES = new Set(["Completed", "Partially Completed", "Not Completed"]);

function isEduTrackAdminUser(req) {
  return EDUZYNC_ADMIN_ROLES.includes(req.user?.role) || isViewAdminRole(req.user?.role);
}

function isEduTrackCoordinatorUser(req) {
  return req.user?.role === ROLES.coordinator;
}

function isEduTrackOversightUser(req) {
  return isEduTrackAdminUser(req) || isEduTrackCoordinatorUser(req);
}

function isEduTrackMasterUser(req) {
  return [ROLES.master, ROLES.super, ROLES.masterEduTrack].includes(req.user?.role);
}

function requestAuditMeta(req) {
  return {
    ip: String(req.ip || req.headers["x-forwarded-for"] || "").slice(0, 80),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 1000),
  };
}

function dateOnly(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  const text = String(value);
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : text.slice(0, 10);
}

async function eduTrackActor(req) {
  const [users] = await db.query(
    "SELECT id, external_staff_id, name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1",
    [req.user?.id],
  );
  const row = users[0] || {
    id: req.user?.id || "",
    external_staff_id: "",
    name: req.user?.name || req.user?.email || req.user?.id || "Unknown",
    email: req.user?.email || "",
    role: req.user?.role || "",
  };
  const extra = (await readEduTrackDoc("users", row.id).catch(() => null)) || {};
  const identityHints = await loadEduTrackIdentityHints();
  const hint = findEduTrackIdentityHint(identityHints, row, extra);
  const mergedExtra = mergeEduTrackIdentity(row, extra, hint);
  const teacherId =
    mergedExtra.teacherId ||
    mergedExtra.teacher_id ||
    mergedExtra.staffId ||
    mergedExtra.staff_id ||
    row.external_staff_id ||
    row.id;
  return {
    id: String(row.id || ""),
    name: row.name || mergedExtra.name || row.email || row.id || "Unknown",
    email: row.email || "",
    role: row.role || req.user?.role || "",
    teacherId: String(teacherId || ""),
    teacherName: mergedExtra.name || row.name || row.email || row.id || "Unknown",
    extra: mergedExtra,
  };
}

function normalizeDailyProgressInput(body = {}, actor, existing = null) {
  const completedWork = String(
    body.completed_work || body.topic_done_today || body.topic || existing?.completed_work || "",
  ).trim();
  const record = {
    teacher_user_id: String(body.teacher_user_id || existing?.teacher_user_id || actor.id || ""),
    teacher_id: String(
      body.teacher_id || existing?.teacher_id || actor.teacherId || actor.id || "",
    ),
    teacher_name: String(
      body.teacher_name || existing?.teacher_name || actor.teacherName || actor.name || "",
    ),
    record_date: dateOnly(body.record_date || body.date || existing?.record_date),
    grade: String(body.grade || existing?.grade || "").trim(),
    section: String(body.section || body.class_section || existing?.section || "").trim(),
    subject: String(body.subject || body.subject_name || existing?.subject || "").trim(),
    period_label: String(body.period_label || body.period || existing?.period_label || "").trim(),
    unit_number: String(body.unit_number || body.unit || existing?.unit_number || "").trim(),
    main_topic: String(body.main_topic || completedWork || existing?.main_topic || "").trim(),
    subtopic: String(body.subtopic || existing?.subtopic || "").trim(),
    completed_work: completedWork,
    page_reference: String(
      body.page_reference || body.pages || existing?.page_reference || "",
    ).trim(),
    notes: String(body.notes || body.note || existing?.notes || "").trim(),
    completion_status: String(
      body.completion_status || existing?.completion_status || "Completed",
    ).trim(),
    next_planned_lesson: String(
      body.next_planned_lesson || existing?.next_planned_lesson || "",
    ).trim(),
    status: String(body.status || existing?.status || "submitted").trim(),
  };
  if (!DAILY_COMPLETION_STATUSES.has(record.completion_status)) {
    record.completion_status = "Completed";
  }
  return record;
}

function assertDailyProgressRequired(record) {
  const missing = [];
  [
    "record_date",
    "section",
    "subject",
    "unit_number",
    "completed_work",
    "completion_status",
  ].forEach((field) => {
    if (!record[field]) missing.push(field);
  });
  if (missing.length) {
    const error = new Error(`Missing required fields: ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }
}

function canAccessDailyRecord(req, actor, row, action) {
  if (isEduTrackMasterUser(req)) return true;
  if (req.user?.role === ROLES.eduzync) return action !== "delete";
  const ownsRecord =
    String(row.teacher_user_id || "") === actor.id ||
    String(row.teacher_id || "") === actor.teacherId;
  if (!ownsRecord) return false;
  if (action === "read" || action === "create") return true;
  if (action === "delete") return false;
  const today = new Date().toISOString().slice(0, 10);
  const recordDate = dateOnly(row.record_date);
  return !row.locked_at && recordDate === today;
}

async function insertDailySyllabusAudit(conn, req, recordId, action, oldValue, newValue, actor) {
  const meta = requestAuditMeta(req);
  await conn.query(
    `
      INSERT INTO edutrack_syllabus_audit_logs
        (syllabus_record_id, action, old_value_json, new_value_json, actor_user_id,
         actor_name, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      recordId,
      action,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      actor.id,
      actor.name,
      meta.ip,
      meta.userAgent,
    ],
  );
}

function dailyProgressWhere(query, req, actor) {
  const conditions = [];
  const params = [];
  if (!isEduTrackOversightUser(req)) {
    conditions.push("(teacher_user_id = ? OR teacher_id = ?)");
    params.push(actor.id, actor.teacherId);
  }
  const addEq = (column, value) => {
    if (value == null || String(value).trim() === "") return;
    conditions.push(`${column} = ?`);
    params.push(String(value).trim());
  };
  addEq("record_date", query.date || query.record_date);
  addEq("teacher_id", query.teacher_id);
  addEq("subject", query.subject);
  addEq("grade", query.grade);
  addEq("section", query.section);
  addEq("unit_number", query.unit_number);
  addEq("completion_status", query.completion_status);
  if (query.date_from) {
    conditions.push("record_date >= ?");
    params.push(String(query.date_from).slice(0, 10));
  }
  if (query.date_to) {
    conditions.push("record_date <= ?");
    params.push(String(query.date_to).slice(0, 10));
  }
  if (query.teacher_name) {
    conditions.push("teacher_name LIKE ?");
    params.push(`%${String(query.teacher_name).trim()}%`);
  }
  if (query.search) {
    const like = `%${String(query.search).trim()}%`;
    conditions.push(
      "(teacher_name LIKE ? OR teacher_id LIKE ? OR subject LIKE ? OR grade LIKE ? OR section LIKE ? OR unit_number LIKE ? OR main_topic LIKE ? OR subtopic LIKE ? OR completed_work LIKE ?)",
    );
    params.push(like, like, like, like, like, like, like, like, like);
  }
  return {
    sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

async function listDailyProgressRecords(req, actor) {
  const { sql, params } = dailyProgressWhere(req.query || {}, req, actor);
  const limit = Math.min(Math.max(Number(req.query.limit || 300), 1), 1000);
  const [rows] = await db.query(
    `
      SELECT *
      FROM edutrack_daily_syllabus_progress
      ${sql}
      ORDER BY record_date DESC, created_at DESC, id DESC
      LIMIT ${limit}
    `,
    params,
  );
  return rows;
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const YEAR_PLAN_TERMS = [
  { order: 1, name: "1st Term" },
  { order: 2, name: "2nd Term" },
  { order: 3, name: "3rd Term" },
];

function shortText(value, max = 255) {
  return String(value == null ? "" : value)
    .trim()
    .slice(0, max);
}

function nullableShortText(value, max = 255) {
  const text = shortText(value, max);
  return text || null;
}

function positiveInt(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback;
}

function boundedInt(value, fallback = 0, max = 200) {
  const num = positiveInt(value, fallback);
  return Math.max(0, Math.min(max, num));
}

function currentAcademicYear() {
  return String(new Date().getFullYear());
}

function canAccessYearPlan(req, actor, plan, action = "read") {
  if (isEduTrackAdminUser(req)) return true;
  if (action === "read" && isEduTrackCoordinatorUser(req)) return true;
  const ownsPlan =
    String(plan.teacher_user_id || "") === actor.id ||
    String(plan.teacher_id || "") === actor.teacherId;
  if (!ownsPlan) return false;
  if (action === "delete") return false;
  return true;
}

function canAccessAssignment(req, actor, assignment) {
  if (isEduTrackAdminUser(req)) return true;
  return (
    String(assignment.teacher_user_id || "") === actor.id ||
    String(assignment.teacher_id || "") === actor.teacherId
  );
}

async function insertYearPlanAudit(
  conn,
  req,
  yearPlanId,
  entityType,
  entityId,
  action,
  oldValue,
  newValue,
  actor,
) {
  const meta = requestAuditMeta(req);
  await conn.query(
    `
      INSERT INTO edutrack_year_plan_audit_logs
        (year_plan_id, entity_type, entity_id, action, old_value_json, new_value_json,
         actor_user_id, actor_name, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      yearPlanId || null,
      shortText(entityType, 80) || "year_plan",
      entityId == null ? null : String(entityId),
      shortText(action, 100),
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      actor.id,
      actor.name,
      meta.ip,
      meta.userAgent,
    ],
  );
}

function serializeYearPlanSummary(row) {
  const totalSubtopics = Number(row.total_subtopics || 0);
  const completedSubtopics = Number(row.completed_subtopics || 0);
  return {
    ...row,
    progress_percentage: Number(row.progress_percentage || 0),
    total_terms: Number(row.total_terms || 0),
    total_units: Number(row.total_units || 0),
    total_topics: Number(row.total_topics || 0),
    total_subtopics: totalSubtopics,
    completed_subtopics: completedSubtopics,
    pending_subtopics: Math.max(0, totalSubtopics - completedSubtopics),
  };
}

function attachYearPlanSummary(plan) {
  const terms = plan.terms || [];
  const units = terms.flatMap((term) => term.units || []);
  const topics = units.flatMap((unit) => unit.topics || []);
  const subtopics = topics.flatMap((topic) => topic.subtopics || []);
  const completed = subtopics.filter((subtopic) => Number(subtopic.is_completed || 0) === 1).length;
  plan.summary = {
    total_terms: terms.length,
    total_units: units.length,
    total_topics: topics.length,
    total_subtopics: subtopics.length,
    completed_subtopics: completed,
    pending_subtopics: Math.max(0, subtopics.length - completed),
    completion_percentage: subtopics.length ? Math.round((completed / subtopics.length) * 100) : 0,
  };
  return plan;
}

async function readYearPlanDetail(planId, runner = db) {
  const [plans] = await runner.query("SELECT * FROM edutrack_year_plans WHERE id = ? LIMIT 1", [
    Number(planId),
  ]);
  const plan = plans[0];
  if (!plan) return null;
  const [terms] = await runner.query(
    "SELECT * FROM edutrack_year_plan_terms WHERE year_plan_id = ? ORDER BY term_order ASC, id ASC",
    [plan.id],
  );
  const [units] = await runner.query(
    "SELECT * FROM edutrack_year_plan_units WHERE year_plan_id = ? ORDER BY term_id ASC, display_order ASC, id ASC",
    [plan.id],
  );
  const [topics] = await runner.query(
    "SELECT * FROM edutrack_year_plan_topics WHERE year_plan_id = ? ORDER BY unit_id ASC, display_order ASC, id ASC",
    [plan.id],
  );
  const [subtopics] = await runner.query(
    "SELECT * FROM edutrack_year_plan_subtopics WHERE year_plan_id = ? ORDER BY topic_id ASC, display_order ASC, id ASC",
    [plan.id],
  );
  const subtopicsByTopic = new Map();
  subtopics.forEach((row) => {
    if (!subtopicsByTopic.has(row.topic_id)) subtopicsByTopic.set(row.topic_id, []);
    subtopicsByTopic.get(row.topic_id).push(row);
  });
  const topicsByUnit = new Map();
  topics.forEach((row) => {
    if (!topicsByUnit.has(row.unit_id)) topicsByUnit.set(row.unit_id, []);
    topicsByUnit.get(row.unit_id).push({
      ...row,
      progress_percentage: Number(row.progress_percentage || 0),
      subtopics: subtopicsByTopic.get(row.id) || [],
    });
  });
  const unitsByTerm = new Map();
  units.forEach((row) => {
    if (!unitsByTerm.has(row.term_id)) unitsByTerm.set(row.term_id, []);
    unitsByTerm.get(row.term_id).push({
      ...row,
      progress_percentage: Number(row.progress_percentage || 0),
      topics: topicsByUnit.get(row.id) || [],
    });
  });
  return attachYearPlanSummary({
    ...plan,
    progress_percentage: Number(plan.progress_percentage || 0),
    terms: terms.map((term) => ({
      ...term,
      progress_percentage: Number(term.progress_percentage || 0),
      units: unitsByTerm.get(term.id) || [],
    })),
  });
}

async function refreshYearPlanProgress(yearPlanId, runner = db) {
  const [topicRows] = await runner.query(
    `
      SELECT topic_id, COUNT(*) AS total, SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) AS done
      FROM edutrack_year_plan_subtopics
      WHERE year_plan_id = ?
      GROUP BY topic_id
    `,
    [Number(yearPlanId)],
  );
  for (const row of topicRows) {
    const total = Number(row.total || 0);
    const pct = total ? Math.round((Number(row.done || 0) / total) * 100) : 0;
    await runner.query(
      "UPDATE edutrack_year_plan_topics SET progress_percentage = ? WHERE id = ?",
      [pct, row.topic_id],
    );
  }

  const [unitRows] = await runner.query(
    `
      SELECT unit_id, COUNT(*) AS total, SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) AS done
      FROM edutrack_year_plan_subtopics
      WHERE year_plan_id = ?
      GROUP BY unit_id
    `,
    [Number(yearPlanId)],
  );
  for (const row of unitRows) {
    const total = Number(row.total || 0);
    const pct = total ? Math.round((Number(row.done || 0) / total) * 100) : 0;
    await runner.query("UPDATE edutrack_year_plan_units SET progress_percentage = ? WHERE id = ?", [
      pct,
      row.unit_id,
    ]);
  }

  const [termRows] = await runner.query(
    `
      SELECT term_id, COUNT(*) AS total, SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) AS done
      FROM edutrack_year_plan_subtopics
      WHERE year_plan_id = ?
      GROUP BY term_id
    `,
    [Number(yearPlanId)],
  );
  for (const row of termRows) {
    const total = Number(row.total || 0);
    const pct = total ? Math.round((Number(row.done || 0) / total) * 100) : 0;
    await runner.query("UPDATE edutrack_year_plan_terms SET progress_percentage = ? WHERE id = ?", [
      pct,
      row.term_id,
    ]);
  }

  const [[planRow]] = await runner.query(
    `
      SELECT COUNT(*) AS total, SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) AS done
      FROM edutrack_year_plan_subtopics
      WHERE year_plan_id = ?
    `,
    [Number(yearPlanId)],
  );
  const total = Number(planRow.total || 0);
  const pct = total ? Math.round((Number(planRow.done || 0) / total) * 100) : 0;
  await runner.query(
    "UPDATE edutrack_year_plans SET progress_percentage = ?, updated_at = NOW() WHERE id = ?",
    [pct, Number(yearPlanId)],
  );
}

async function readPlanByChild(table, id, runner = db) {
  const safeTable = table.replace(/[^a-z0-9_]/gi, "");
  const [rows] = await runner.query(`SELECT * FROM ${safeTable} WHERE id = ? LIMIT 1`, [
    Number(id),
  ]);
  const row = rows[0];
  if (!row) return null;
  const [plans] = await runner.query("SELECT * FROM edutrack_year_plans WHERE id = ? LIMIT 1", [
    Number(row.year_plan_id),
  ]);
  return { row, plan: plans[0] || null };
}

function yearPlanAssignmentPayload(body = {}, actor) {
  return {
    teacher_user_id: shortText(body.teacher_user_id || body.teacherUserId || "", 64),
    teacher_id: shortText(body.teacher_id || body.teacherId || "", 80),
    teacher_name: shortText(body.teacher_name || body.teacherName || "", 190),
    subject_id: shortText(body.subject_id || body.subjectId || "", 80),
    subject_name: shortText(body.subject_name || body.subjectName || body.subject || "", 150),
    grade: shortText(body.grade || "", 50),
    section: shortText(body.section || "", 50),
    class_name: shortText(body.class_name || body.className || body.class || "", 100),
    academic_year: shortText(body.academic_year || body.academicYear || currentAcademicYear(), 20),
    assigned_by_user_id: actor.id,
    assigned_by_name: actor.name,
    status: shortText(body.status || "Active", 40) || "Active",
  };
}

function assertAssignmentPayload(payload) {
  const missing = [];
  ["teacher_name", "subject_name", "grade", "academic_year"].forEach((field) => {
    if (!payload[field]) missing.push(field);
  });
  if (missing.length) {
    const error = new Error(`Missing required fields: ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }
}

async function listYearPlanAssignments(req, actor, mineOnly = false) {
  const where = [];
  const params = [];
  if (mineOnly || !isEduTrackOversightUser(req)) {
    where.push("(a.teacher_user_id = ? OR a.teacher_id = ?)");
    params.push(actor.id, actor.teacherId);
  }
  const addEq = (column, value) => {
    if (value == null || String(value).trim() === "") return;
    where.push(`${column} = ?`);
    params.push(String(value).trim());
  };
  addEq("a.teacher_id", req.query.teacher_id);
  addEq("a.teacher_user_id", req.query.teacher_user_id);
  addEq("a.subject_name", req.query.subject);
  addEq("a.grade", req.query.grade);
  addEq("a.section", req.query.section);
  addEq("a.academic_year", req.query.academic_year);
  addEq("a.status", req.query.status);
  if (req.query.search) {
    const like = `%${String(req.query.search).trim()}%`;
    where.push(
      "(a.teacher_name LIKE ? OR a.teacher_id LIKE ? OR a.subject_name LIKE ? OR a.grade LIKE ? OR a.section LIKE ? OR a.class_name LIKE ?)",
    );
    params.push(like, like, like, like, like, like);
  }
  const [rows] = await db.query(
    `
      SELECT a.*,
        p.id AS year_plan_id,
        p.status AS year_plan_status,
        p.progress_percentage AS year_plan_progress
      FROM edutrack_teacher_subject_assignments a
      LEFT JOIN edutrack_year_plans p ON p.assignment_id = a.id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY a.academic_year DESC, a.teacher_name ASC, a.subject_name ASC, a.grade ASC, a.section ASC
      LIMIT 1000
    `,
    params,
  );
  return rows.map((row) => ({
    ...row,
    year_plan_progress: Number(row.year_plan_progress || 0),
  }));
}

// Subject Assignments (compat "subjects" docs) and Teacher Assignments
// (edutrack_teacher_subject_assignments) are separate stores. Mirror every
// subject-with-teacher into a teacher assignment row so the teacher's
// "My Assigned Subjects" page and the year-plan flow pick it up.
async function syncSubjectDocToTeacherAssignments(docData) {
  try {
    const subjectName = compactText(docData?.name, 150);
    const teacherUserId = compactText(docData?.teacherId, 64);
    const grade = compactText(docData?.grade, 50);
    if (!subjectName || !teacherUserId || !grade) return;
    const [users] = await db.query(
      "SELECT id, external_staff_id, name FROM users WHERE id = ? LIMIT 1",
      [teacherUserId],
    );
    const teacher = users[0];
    if (!teacher) return;
    const academicYear = currentAcademicYear();
    const classIds = Array.isArray(docData.classIds)
      ? docData.classIds
      : docData.classId
        ? String(docData.classId).split(",")
        : [];
    const classLabel = compactText(
      classIds
        .map((id) => String(id).trim())
        .filter(Boolean)
        .join(", "),
      100,
    );
    const [existing] = await db.query(
      `
        SELECT id FROM edutrack_teacher_subject_assignments
        WHERE teacher_user_id = ? AND subject_name = ? AND grade = ? AND academic_year = ?
        LIMIT 1
      `,
      [teacher.id, subjectName, grade, academicYear],
    );
    if (existing.length) return;
    await db.query(
      `
        INSERT INTO edutrack_teacher_subject_assignments
          (teacher_user_id, teacher_id, teacher_name, subject_name, grade, section,
           class_name, academic_year, assigned_by_name, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Subject Assignments sync', 'Active')
      `,
      [
        teacher.id,
        teacher.external_staff_id || teacher.id,
        teacher.name,
        subjectName,
        grade,
        compactText(classLabel, 50) || null,
        classLabel || null,
        academicYear,
      ],
    );
  } catch (error) {
    console.error("Subject-to-teacher-assignment sync failed:", error.message);
  }
}

let subjectAssignmentBackfillDone = false;
async function backfillSubjectDocTeacherAssignments() {
  if (subjectAssignmentBackfillDone) return;
  subjectAssignmentBackfillDone = true;
  try {
    const docs = await listEduTrackDocs("subjects");
    for (const item of docs) {
      await syncSubjectDocToTeacherAssignments(item.data || item || {});
    }
  } catch (error) {
    subjectAssignmentBackfillDone = false;
    console.error("Subject assignment backfill failed:", error.message);
  }
}

app.get("/api/edutrack/my-assignments", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    await backfillSubjectDocTeacherAssignments();
    const actor = await eduTrackActor(req);
    res.json(await listYearPlanAssignments(req, actor, true));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/teacher-assignments", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    await backfillSubjectDocTeacherAssignments();
    const actor = await eduTrackActor(req);
    res.json(await listYearPlanAssignments(req, actor, false));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edutrack/teacher-assignments", eduzyncAdminOnly, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const payload = yearPlanAssignmentPayload(req.body || {}, actor);
    assertAssignmentPayload(payload);
    await conn.beginTransaction();
    const [result] = await conn.query(
      `
        INSERT INTO edutrack_teacher_subject_assignments
          (teacher_user_id, teacher_id, teacher_name, subject_id, subject_name,
           grade, section, class_name, academic_year, assigned_by_user_id,
           assigned_by_name, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.teacher_user_id || null,
        payload.teacher_id || null,
        payload.teacher_name,
        payload.subject_id || null,
        payload.subject_name,
        payload.grade,
        payload.section || null,
        payload.class_name || null,
        payload.academic_year,
        payload.assigned_by_user_id,
        payload.assigned_by_name,
        payload.status,
      ],
    );
    await insertYearPlanAudit(
      conn,
      req,
      null,
      "assignment",
      result.insertId,
      "created",
      null,
      payload,
      actor,
    );
    await conn.commit();
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    await conn.rollback();
    res.status(error.status || 500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.put("/api/edutrack/teacher-assignments/:id", eduzyncAdminOnly, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const payload = yearPlanAssignmentPayload(req.body || {}, actor);
    assertAssignmentPayload(payload);
    await conn.beginTransaction();
    const [existingRows] = await conn.query(
      "SELECT * FROM edutrack_teacher_subject_assignments WHERE id = ? FOR UPDATE",
      [Number(req.params.id)],
    );
    const existing = existingRows[0];
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: "Teacher assignment not found" });
    }
    await conn.query(
      `
        UPDATE edutrack_teacher_subject_assignments
        SET teacher_user_id = ?, teacher_id = ?, teacher_name = ?, subject_id = ?,
          subject_name = ?, grade = ?, section = ?, class_name = ?, academic_year = ?,
          status = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [
        payload.teacher_user_id || null,
        payload.teacher_id || null,
        payload.teacher_name,
        payload.subject_id || null,
        payload.subject_name,
        payload.grade,
        payload.section || null,
        payload.class_name || null,
        payload.academic_year,
        payload.status,
        existing.id,
      ],
    );
    await conn.query(
      `
        UPDATE edutrack_year_plans
        SET teacher_user_id = ?, teacher_id = ?, teacher_name = ?, subject_name = ?,
          grade = ?, section = ?, academic_year = ?, updated_at = NOW()
        WHERE assignment_id = ?
      `,
      [
        payload.teacher_user_id || null,
        payload.teacher_id || null,
        payload.teacher_name,
        payload.subject_name,
        payload.grade,
        payload.section || null,
        payload.academic_year,
        existing.id,
      ],
    );
    await insertYearPlanAudit(
      conn,
      req,
      null,
      "assignment",
      existing.id,
      "updated",
      existing,
      payload,
      actor,
    );
    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    res.status(error.status || 500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.delete("/api/edutrack/teacher-assignments/:id", edutrackMasterOnly, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT * FROM edutrack_teacher_subject_assignments WHERE id = ? FOR UPDATE",
      [Number(req.params.id)],
    );
    const existing = rows[0];
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: "Teacher assignment not found" });
    }
    await conn.query("DELETE FROM edutrack_teacher_subject_assignments WHERE id = ?", [
      existing.id,
    ]);
    await insertYearPlanAudit(
      conn,
      req,
      null,
      "assignment",
      existing.id,
      "deleted",
      existing,
      null,
      actor,
    );
    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

function yearPlanListWhere(query, req, actor) {
  const where = [];
  const params = [];
  if (!isEduTrackOversightUser(req)) {
    where.push("(p.teacher_user_id = ? OR p.teacher_id = ?)");
    params.push(actor.id, actor.teacherId);
  }
  const addEq = (column, value) => {
    if (value == null || String(value).trim() === "") return;
    where.push(`${column} = ?`);
    params.push(String(value).trim());
  };
  addEq("p.teacher_id", query.teacher_id);
  addEq("p.teacher_user_id", query.teacher_user_id);
  addEq("p.subject_name", query.subject);
  addEq("p.grade", query.grade);
  addEq("p.section", query.section);
  addEq("p.academic_year", query.academic_year);
  addEq("p.status", query.status);
  addEq("p.approval_status", query.approval_status);
  if (query.search) {
    const like = `%${String(query.search).trim()}%`;
    where.push(
      "(p.teacher_name LIKE ? OR p.teacher_id LIKE ? OR p.subject_name LIKE ? OR p.grade LIKE ? OR p.section LIKE ?)",
    );
    params.push(like, like, like, like, like);
  }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

app.get("/api/edutrack/year-plans", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const { sql, params } = yearPlanListWhere(req.query || {}, req, actor);
    const [rows] = await db.query(
      `
        SELECT p.*,
          COUNT(DISTINCT t.id) AS total_terms,
          COUNT(DISTINCT u.id) AS total_units,
          COUNT(DISTINCT mt.id) AS total_topics,
          COUNT(DISTINCT st.id) AS total_subtopics,
          COUNT(DISTINCT CASE WHEN st.is_completed = 1 THEN st.id END) AS completed_subtopics
        FROM edutrack_year_plans p
        LEFT JOIN edutrack_year_plan_terms t ON t.year_plan_id = p.id
        LEFT JOIN edutrack_year_plan_units u ON u.year_plan_id = p.id
        LEFT JOIN edutrack_year_plan_topics mt ON mt.year_plan_id = p.id
        LEFT JOIN edutrack_year_plan_subtopics st ON st.year_plan_id = p.id
        ${sql}
        GROUP BY p.id
        ORDER BY p.academic_year DESC, p.teacher_name ASC, p.subject_name ASC, p.grade ASC, p.section ASC
        LIMIT 1000
      `,
      params,
    );
    res.json(rows.map(serializeYearPlanSummary));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edutrack/year-plans", teacherOrAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const assignmentId = positiveInt(req.body?.assignment_id || req.body?.assignmentId, 0);
    let assignment = null;
    if (assignmentId) {
      const [assignments] = await conn.query(
        "SELECT * FROM edutrack_teacher_subject_assignments WHERE id = ? LIMIT 1",
        [assignmentId],
      );
      assignment = assignments[0] || null;
      if (!assignment) return res.status(404).json({ error: "Teacher assignment not found" });
      if (!canAccessAssignment(req, actor, assignment)) {
        return res.status(403).json({ error: "Access denied for this assignment" });
      }
      const [existingPlans] = await conn.query(
        "SELECT id FROM edutrack_year_plans WHERE assignment_id = ? LIMIT 1",
        [assignmentId],
      );
      if (existingPlans[0]) {
        return res.status(200).json({
          success: true,
          id: existingPlans[0].id,
          plan: await readYearPlanDetail(existingPlans[0].id, conn),
        });
      }
    }
    const payload = {
      assignment_id: assignment?.id || null,
      teacher_user_id:
        assignment?.teacher_user_id || shortText(req.body?.teacher_user_id || actor.id, 64),
      teacher_id:
        assignment?.teacher_id ||
        shortText(req.body?.teacher_id || actor.teacherId || actor.id, 80),
      teacher_name:
        assignment?.teacher_name ||
        shortText(req.body?.teacher_name || actor.teacherName || actor.name, 190),
      subject_name:
        assignment?.subject_name ||
        shortText(req.body?.subject_name || req.body?.subject || "", 150),
      grade: assignment?.grade || shortText(req.body?.grade || "", 50),
      section: assignment?.section || shortText(req.body?.section || "", 50),
      academic_year:
        assignment?.academic_year ||
        shortText(req.body?.academic_year || currentAcademicYear(), 20),
      status: shortText(req.body?.status || "Draft", 40) || "Draft",
    };
    const missing = ["teacher_name", "subject_name", "grade", "academic_year"].filter(
      (key) => !payload[key],
    );
    if (missing.length)
      return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
    if (!isEduTrackAdminUser(req)) {
      payload.teacher_user_id = actor.id;
      payload.teacher_id = actor.teacherId || actor.id;
      payload.teacher_name = actor.teacherName || actor.name;
    }
    await conn.beginTransaction();
    const [result] = await conn.query(
      `
        INSERT INTO edutrack_year_plans
          (assignment_id, teacher_user_id, teacher_id, teacher_name, subject_name,
           grade, section, academic_year, status, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.assignment_id,
        payload.teacher_user_id || null,
        payload.teacher_id || null,
        payload.teacher_name,
        payload.subject_name,
        payload.grade,
        payload.section || null,
        payload.academic_year,
        payload.status,
        actor.id,
      ],
    );
    await insertYearPlanAudit(
      conn,
      req,
      result.insertId,
      "year_plan",
      result.insertId,
      "created",
      null,
      payload,
      actor,
    );
    await conn.commit();
    res.status(201).json({
      success: true,
      id: result.insertId,
      plan: await readYearPlanDetail(result.insertId),
    });
  } catch (error) {
    await conn.rollback();
    res.status(error.status || 500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.get("/api/edutrack/year-plans/:id", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const plan = await readYearPlanDetail(req.params.id);
    if (!plan) return res.status(404).json({ error: "Year plan not found" });
    if (!canAccessYearPlan(req, actor, plan, "read"))
      return res.status(403).json({ error: "Access denied" });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/edutrack/year-plans/:id", teacherOrAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT * FROM edutrack_year_plans WHERE id = ? FOR UPDATE", [
      Number(req.params.id),
    ]);
    const existing = rows[0];
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: "Year plan not found" });
    }
    if (!canAccessYearPlan(req, actor, existing, "edit")) {
      await conn.rollback();
      return res.status(403).json({ error: "Access denied" });
    }
    const status = shortText(req.body?.status || existing.status || "Draft", 40);
    const academicYear = shortText(req.body?.academic_year || existing.academic_year, 20);
    await conn.query(
      "UPDATE edutrack_year_plans SET status = ?, academic_year = ?, updated_at = NOW() WHERE id = ?",
      [status, academicYear, existing.id],
    );
    await insertYearPlanAudit(
      conn,
      req,
      existing.id,
      "year_plan",
      existing.id,
      "updated",
      existing,
      { status, academic_year: academicYear },
      actor,
    );
    await conn.commit();
    res.json({ success: true, plan: await readYearPlanDetail(existing.id) });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

const YEAR_PLAN_APPROVAL_STATUSES = new Set([
  "draft",
  "submitted",
  "approved",
  "changes_requested",
]);

app.post("/api/edutrack/year-plans/:id/submit", teacherOrAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT * FROM edutrack_year_plans WHERE id = ? FOR UPDATE", [
      Number(req.params.id),
    ]);
    const existing = rows[0];
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: "Year plan not found" });
    }
    if (!canAccessYearPlan(req, actor, existing, "edit")) {
      await conn.rollback();
      return res.status(403).json({ error: "Access denied" });
    }
    if (existing.approval_status === "approved") {
      await conn.rollback();
      return res.status(409).json({ error: "This year plan is already approved." });
    }
    await conn.query(
      `
        UPDATE edutrack_year_plans
        SET approval_status = 'submitted', submitted_at = NOW(), submitted_by_name = ?,
            reviewed_at = NULL, reviewed_by_user_id = NULL, reviewed_by_name = NULL,
            review_comment = NULL, updated_at = NOW()
        WHERE id = ?
      `,
      [shortText(actor.teacherName || actor.name, 190), existing.id],
    );
    await insertYearPlanAudit(
      conn,
      req,
      existing.id,
      "year_plan",
      existing.id,
      "submitted_for_review",
      { approval_status: existing.approval_status },
      { approval_status: "submitted" },
      actor,
    );
    await conn.commit();
    res.json({ success: true, plan: await readYearPlanDetail(existing.id) });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.post("/api/edutrack/year-plans/:id/review", edutrackOversightOnly, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const decision = String(req.body?.decision || "").trim();
    const nextStatus =
      decision === "approve"
        ? "approved"
        : decision === "request_changes"
          ? "changes_requested"
          : "";
    if (!nextStatus) {
      return res.status(400).json({ error: "decision must be 'approve' or 'request_changes'" });
    }
    const comment = shortText(req.body?.comment || "", 2000);
    if (nextStatus === "changes_requested" && !comment) {
      return res.status(400).json({ error: "A comment is required when requesting changes." });
    }
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT * FROM edutrack_year_plans WHERE id = ? FOR UPDATE", [
      Number(req.params.id),
    ]);
    const existing = rows[0];
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: "Year plan not found" });
    }
    await conn.query(
      `
        UPDATE edutrack_year_plans
        SET approval_status = ?, reviewed_at = NOW(), reviewed_by_user_id = ?,
            reviewed_by_name = ?, review_comment = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [nextStatus, actor.id, shortText(actor.name, 190), comment || null, existing.id],
    );
    await insertYearPlanAudit(
      conn,
      req,
      existing.id,
      "year_plan",
      existing.id,
      nextStatus === "approved" ? "review_approved" : "review_changes_requested",
      { approval_status: existing.approval_status },
      { approval_status: nextStatus, review_comment: comment },
      actor,
    );
    await conn.commit();
    res.json({ success: true, plan: await readYearPlanDetail(existing.id) });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.get("/api/edutrack/analytics/overview", edutrackOversightOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const academicYear = shortText(req.query.academic_year || "", 20);
    const planWhere = academicYear ? "WHERE p.academic_year = ?" : "";
    const planParams = academicYear ? [academicYear] : [];

    const [planRows] = await db.query(
      `
        SELECT p.id, p.teacher_id, p.teacher_user_id, p.teacher_name, p.subject_name, p.grade,
          p.section, p.academic_year, p.approval_status, p.updated_at,
          COUNT(DISTINCT st.id) AS total_subtopics,
          COUNT(DISTINCT CASE WHEN st.is_completed = 1 THEN st.id END) AS completed_subtopics
        FROM edutrack_year_plans p
        LEFT JOIN edutrack_year_plan_subtopics st ON st.year_plan_id = p.id
        ${planWhere}
        GROUP BY p.id
        LIMIT 3000
      `,
      planParams,
    );

    const [activityRows] = await db.query(`
      SELECT record_date, COUNT(*) AS records,
        SUM(CASE WHEN completion_status = 'Completed' THEN 1 ELSE 0 END) AS completed_records
      FROM edutrack_daily_syllabus_progress
      WHERE record_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
      GROUP BY record_date
      ORDER BY record_date ASC
    `);

    const [statusRows] = await db.query(`
      SELECT completion_status, COUNT(*) AS records
      FROM edutrack_daily_syllabus_progress
      WHERE record_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
      GROUP BY completion_status
    `);

    const [[reliefStats]] = await db.query(`
      SELECT
        SUM(CASE WHEN status <> 'deleted' THEN 1 ELSE 0 END) AS total,
        SUM(CASE WHEN status <> 'deleted' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS last_30_days
      FROM edutrack_relief_assignments
    `);

    const [[teacherCounts]] = await db.query(`
      SELECT
        SUM(CASE WHEN role = 'teacher' AND LOWER(COALESCE(status, '')) = 'active' THEN 1 ELSE 0 END) AS active_teachers,
        SUM(CASE WHEN role = 'academic_coordinator' AND LOWER(COALESCE(status, '')) = 'active' THEN 1 ELSE 0 END) AS active_coordinators
      FROM users
    `);

    const approvalPipeline = { draft: 0, submitted: 0, approved: 0, changes_requested: 0 };
    const teacherMap = new Map();
    const gradeMap = new Map();
    let totalSubtopics = 0;
    let completedSubtopics = 0;
    planRows.forEach((row) => {
      const status = YEAR_PLAN_APPROVAL_STATUSES.has(row.approval_status)
        ? row.approval_status
        : "draft";
      approvalPipeline[status] += 1;
      const total = Number(row.total_subtopics || 0);
      const completed = Number(row.completed_subtopics || 0);
      totalSubtopics += total;
      completedSubtopics += completed;
      const teacherKey = String(row.teacher_user_id || row.teacher_id || row.teacher_name);
      if (!teacherMap.has(teacherKey)) {
        teacherMap.set(teacherKey, {
          teacher_id: row.teacher_id,
          teacher_name: row.teacher_name,
          plans: 0,
          total_subtopics: 0,
          completed_subtopics: 0,
          pending_review: 0,
          last_activity: null,
        });
      }
      const teacher = teacherMap.get(teacherKey);
      teacher.plans += 1;
      teacher.total_subtopics += total;
      teacher.completed_subtopics += completed;
      if (status === "submitted") teacher.pending_review += 1;
      const updated = row.updated_at ? new Date(row.updated_at).toISOString() : null;
      if (updated && (!teacher.last_activity || updated > teacher.last_activity)) {
        teacher.last_activity = updated;
      }
      const gradeKey = String(row.grade || "-");
      if (!gradeMap.has(gradeKey)) {
        gradeMap.set(gradeKey, { grade: gradeKey, total_subtopics: 0, completed_subtopics: 0, plans: 0 });
      }
      const grade = gradeMap.get(gradeKey);
      grade.plans += 1;
      grade.total_subtopics += total;
      grade.completed_subtopics += completed;
    });

    const withPct = (item) => ({
      ...item,
      completion_percentage: item.total_subtopics
        ? Math.round((item.completed_subtopics / item.total_subtopics) * 100)
        : 0,
    });
    const teachers = Array.from(teacherMap.values()).map(withPct);
    const grades = Array.from(gradeMap.values())
      .map(withPct)
      .sort((a, b) => {
        const numA = Number(a.grade);
        const numB = Number(b.grade);
        if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
        return String(a.grade).localeCompare(String(b.grade));
      });
    const atRisk = teachers
      .filter((item) => item.total_subtopics > 0 && item.completion_percentage < 40)
      .sort((a, b) => a.completion_percentage - b.completion_percentage)
      .slice(0, 12);
    const topPerformers = teachers
      .filter((item) => item.total_subtopics > 0)
      .sort((a, b) => b.completion_percentage - a.completion_percentage)
      .slice(0, 6);

    res.json({
      generatedAt: new Date().toISOString(),
      academicYear: academicYear || "all",
      summary: {
        totalPlans: planRows.length,
        totalSubtopics,
        completedSubtopics,
        completionPercentage: totalSubtopics
          ? Math.round((completedSubtopics / totalSubtopics) * 100)
          : 0,
        activeTeachers: Number(teacherCounts?.active_teachers || 0),
        activeCoordinators: Number(teacherCounts?.active_coordinators || 0),
        atRiskTeachers: atRisk.length,
        pendingReviews: approvalPipeline.submitted,
      },
      approvalPipeline,
      teachers: teachers.sort((a, b) => a.teacher_name.localeCompare(b.teacher_name)),
      atRisk,
      topPerformers,
      grades,
      dailyActivity: activityRows.map((row) => ({
        date: dateOnly(row.record_date),
        records: Number(row.records || 0),
        completed_records: Number(row.completed_records || 0),
      })),
      statusBreakdown: statusRows.map((row) => ({
        status: row.completion_status || "Unknown",
        records: Number(row.records || 0),
      })),
      relief: {
        total: Number(reliefStats?.total || 0),
        last30Days: Number(reliefStats?.last_30_days || 0),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edutrack/year-plans/:id/generate-units", teacherOrAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    await conn.beginTransaction();
    const [plans] = await conn.query("SELECT * FROM edutrack_year_plans WHERE id = ? FOR UPDATE", [
      Number(req.params.id),
    ]);
    const plan = plans[0];
    if (!plan) {
      await conn.rollback();
      return res.status(404).json({ error: "Year plan not found" });
    }
    if (!canAccessYearPlan(req, actor, plan, "edit")) {
      await conn.rollback();
      return res.status(403).json({ error: "Access denied" });
    }
    const counts = {
      1: boundedInt(req.body?.term1_units || req.body?.term_1 || req.body?.first_term_units, 0, 50),
      2: boundedInt(
        req.body?.term2_units || req.body?.term_2 || req.body?.second_term_units,
        0,
        50,
      ),
      3: boundedInt(req.body?.term3_units || req.body?.term_3 || req.body?.third_term_units, 0, 50),
    };
    for (const term of YEAR_PLAN_TERMS) {
      await conn.query(
        `
          INSERT INTO edutrack_year_plan_terms (year_plan_id, term_name, term_order, unit_count)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE term_name = VALUES(term_name), unit_count = VALUES(unit_count), updated_at = NOW()
        `,
        [plan.id, term.name, term.order, counts[term.order]],
      );
      const [termRows] = await conn.query(
        "SELECT id FROM edutrack_year_plan_terms WHERE year_plan_id = ? AND term_order = ? LIMIT 1",
        [plan.id, term.order],
      );
      const termId = termRows[0]?.id;
      for (let index = 1; index <= counts[term.order]; index += 1) {
        await conn.query(
          `
            INSERT INTO edutrack_year_plan_units
              (term_id, year_plan_id, unit_number, unit_title, display_order)
            VALUES (?, ?, ?, '', ?)
            ON DUPLICATE KEY UPDATE unit_number = VALUES(unit_number), updated_at = NOW()
          `,
          [termId, plan.id, `Unit ${String(index).padStart(2, "0")}`, index],
        );
      }
    }
    await refreshYearPlanProgress(plan.id, conn);
    await insertYearPlanAudit(
      conn,
      req,
      plan.id,
      "year_plan",
      plan.id,
      "generated_units",
      null,
      counts,
      actor,
    );
    await conn.commit();
    res.json({ success: true, plan: await readYearPlanDetail(plan.id) });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.put("/api/edutrack/year-plan-terms/:id", teacherOrAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const found = await readPlanByChild("edutrack_year_plan_terms", req.params.id, conn);
    if (!found?.row) return res.status(404).json({ error: "Term not found" });
    if (!canAccessYearPlan(req, actor, found.plan, "edit"))
      return res.status(403).json({ error: "Access denied" });
    await conn.query(
      "UPDATE edutrack_year_plan_terms SET unit_count = ?, updated_at = NOW() WHERE id = ?",
      [boundedInt(req.body?.unit_count, found.row.unit_count || 0, 50), found.row.id],
    );
    await insertYearPlanAudit(
      conn,
      req,
      found.plan.id,
      "term",
      found.row.id,
      "updated",
      found.row,
      req.body,
      actor,
    );
    res.json({ success: true, plan: await readYearPlanDetail(found.plan.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.put("/api/edutrack/year-plan-units/:id", teacherOrAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const found = await readPlanByChild("edutrack_year_plan_units", req.params.id, conn);
    if (!found?.row) return res.status(404).json({ error: "Unit not found" });
    if (!canAccessYearPlan(req, actor, found.plan, "edit"))
      return res.status(403).json({ error: "Access denied" });
    const unitNumber = shortText(req.body?.unit_number || found.row.unit_number, 80);
    const unitTitle = nullableShortText(req.body?.unit_title ?? found.row.unit_title, 255);
    const displayOrder = positiveInt(req.body?.display_order, found.row.display_order || 1);
    await conn.query(
      "UPDATE edutrack_year_plan_units SET unit_number = ?, unit_title = ?, display_order = ?, updated_at = NOW() WHERE id = ?",
      [unitNumber, unitTitle, displayOrder, found.row.id],
    );
    await insertYearPlanAudit(
      conn,
      req,
      found.plan.id,
      "unit",
      found.row.id,
      "updated",
      found.row,
      req.body,
      actor,
    );
    res.json({ success: true, plan: await readYearPlanDetail(found.plan.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.post("/api/edutrack/year-plan-units/:id/topics", teacherOrAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const found = await readPlanByChild("edutrack_year_plan_units", req.params.id, conn);
    if (!found?.row) return res.status(404).json({ error: "Unit not found" });
    if (!canAccessYearPlan(req, actor, found.plan, "edit"))
      return res.status(403).json({ error: "Access denied" });
    const mainTopic = shortText(req.body?.main_topic || req.body?.topic || "", 255);
    if (!mainTopic) return res.status(400).json({ error: "main_topic is required" });
    const [maxRows] = await conn.query(
      "SELECT COALESCE(MAX(display_order), 0) AS max_order FROM edutrack_year_plan_topics WHERE unit_id = ?",
      [found.row.id],
    );
    const displayOrder = positiveInt(
      req.body?.display_order,
      Number(maxRows[0]?.max_order || 0) + 1,
    );
    const [result] = await conn.query(
      `
        INSERT INTO edutrack_year_plan_topics
          (unit_id, term_id, year_plan_id, main_topic, display_order)
        VALUES (?, ?, ?, ?, ?)
      `,
      [found.row.id, found.row.term_id, found.row.year_plan_id, mainTopic, displayOrder],
    );
    await insertYearPlanAudit(
      conn,
      req,
      found.plan.id,
      "topic",
      result.insertId,
      "created",
      null,
      req.body,
      actor,
    );
    res
      .status(201)
      .json({ success: true, id: result.insertId, plan: await readYearPlanDetail(found.plan.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.put("/api/edutrack/year-plan-topics/:id", teacherOrAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const found = await readPlanByChild("edutrack_year_plan_topics", req.params.id, conn);
    if (!found?.row) return res.status(404).json({ error: "Topic not found" });
    if (!canAccessYearPlan(req, actor, found.plan, "edit"))
      return res.status(403).json({ error: "Access denied" });
    const mainTopic = shortText(
      req.body?.main_topic || req.body?.topic || found.row.main_topic,
      255,
    );
    const displayOrder = positiveInt(req.body?.display_order, found.row.display_order || 1);
    await conn.query(
      "UPDATE edutrack_year_plan_topics SET main_topic = ?, display_order = ?, updated_at = NOW() WHERE id = ?",
      [mainTopic, displayOrder, found.row.id],
    );
    await insertYearPlanAudit(
      conn,
      req,
      found.plan.id,
      "topic",
      found.row.id,
      "updated",
      found.row,
      req.body,
      actor,
    );
    res.json({ success: true, plan: await readYearPlanDetail(found.plan.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.post("/api/edutrack/year-plan-topics/:id/subtopics", teacherOrAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const found = await readPlanByChild("edutrack_year_plan_topics", req.params.id, conn);
    if (!found?.row) return res.status(404).json({ error: "Topic not found" });
    if (!canAccessYearPlan(req, actor, found.plan, "edit"))
      return res.status(403).json({ error: "Access denied" });
    const raw = Array.isArray(req.body?.subtopics)
      ? req.body.subtopics
      : String(req.body?.subtopic_title || req.body?.subtopics || req.body?.title || "")
          .split(/\r?\n/)
          .map((item) => item.trim());
    const titles = raw
      .map((item) => shortText(item?.subtopic_title || item?.title || item, 255))
      .filter(Boolean);
    if (!titles.length) return res.status(400).json({ error: "At least one subtopic is required" });
    const [maxRows] = await conn.query(
      "SELECT COALESCE(MAX(display_order), 0) AS max_order FROM edutrack_year_plan_subtopics WHERE topic_id = ?",
      [found.row.id],
    );
    let nextOrder = Number(maxRows[0]?.max_order || 0) + 1;
    const ids = [];
    for (const title of titles) {
      const [result] = await conn.query(
        `
          INSERT INTO edutrack_year_plan_subtopics
            (topic_id, unit_id, term_id, year_plan_id, subtopic_title, display_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          found.row.id,
          found.row.unit_id,
          found.row.term_id,
          found.row.year_plan_id,
          title,
          nextOrder,
        ],
      );
      ids.push(result.insertId);
      nextOrder += 1;
    }
    await refreshYearPlanProgress(found.plan.id, conn);
    await insertYearPlanAudit(
      conn,
      req,
      found.plan.id,
      "subtopic",
      ids.join(","),
      "created",
      null,
      titles,
      actor,
    );
    res.status(201).json({ success: true, ids, plan: await readYearPlanDetail(found.plan.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.put("/api/edutrack/year-plan-subtopics/:id", teacherOrAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const found = await readPlanByChild("edutrack_year_plan_subtopics", req.params.id, conn);
    if (!found?.row) return res.status(404).json({ error: "Subtopic not found" });
    if (!canAccessYearPlan(req, actor, found.plan, "edit"))
      return res.status(403).json({ error: "Access denied" });
    const title = shortText(
      req.body?.subtopic_title || req.body?.title || found.row.subtopic_title,
      255,
    );
    const note = nullableShortText(req.body?.completion_note ?? found.row.completion_note, 2000);
    const displayOrder = positiveInt(req.body?.display_order, found.row.display_order || 1);
    await conn.query(
      "UPDATE edutrack_year_plan_subtopics SET subtopic_title = ?, completion_note = ?, display_order = ?, updated_at = NOW() WHERE id = ?",
      [title, note, displayOrder, found.row.id],
    );
    await insertYearPlanAudit(
      conn,
      req,
      found.plan.id,
      "subtopic",
      found.row.id,
      "updated",
      found.row,
      req.body,
      actor,
    );
    res.json({ success: true, plan: await readYearPlanDetail(found.plan.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.post(
  "/api/edutrack/year-plan-subtopics/:id/toggle-complete",
  teacherOrAdmin,
  async (req, res) => {
    const conn = await db.getConnection();
    try {
      await ensureContentTables();
      const actor = await eduTrackActor(req);
      const found = await readPlanByChild("edutrack_year_plan_subtopics", req.params.id, conn);
      if (!found?.row) return res.status(404).json({ error: "Subtopic not found" });
      if (!canAccessYearPlan(req, actor, found.plan, "edit"))
        return res.status(403).json({ error: "Access denied" });
      const hasExplicit = Object.prototype.hasOwnProperty.call(req.body || {}, "is_completed");
      const completed = hasExplicit
        ? Number(req.body.is_completed) === 1 || req.body.is_completed === true
        : !Number(found.row.is_completed);
      const note = nullableShortText(
        req.body?.completion_note || req.body?.note || found.row.completion_note,
        2000,
      );
      await conn.query(
        `
        UPDATE edutrack_year_plan_subtopics
        SET is_completed = ?, completed_at = ?, completed_by_user_id = ?, completed_by_name = ?,
          completion_note = ?, updated_at = NOW()
        WHERE id = ?
      `,
        [
          completed ? 1 : 0,
          completed ? mysqlDateTime() : null,
          completed ? actor.id : null,
          completed ? actor.name : null,
          note,
          found.row.id,
        ],
      );
      await refreshYearPlanProgress(found.plan.id, conn);
      await insertYearPlanAudit(
        conn,
        req,
        found.plan.id,
        "subtopic",
        found.row.id,
        completed ? "completed" : "reopened",
        found.row,
        { is_completed: completed, completion_note: note },
        actor,
      );
      res.json({ success: true, plan: await readYearPlanDetail(found.plan.id) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      conn.release();
    }
  },
);

function yearPlanReportWhere(query, req, actor) {
  const where = [];
  const params = [];
  if (!isEduTrackOversightUser(req)) {
    where.push("(p.teacher_user_id = ? OR p.teacher_id = ?)");
    params.push(actor.id, actor.teacherId);
  }
  const addEq = (column, value) => {
    if (value == null || String(value).trim() === "") return;
    where.push(`${column} = ?`);
    params.push(String(value).trim());
  };
  addEq("p.teacher_id", query.teacher_id || query.teacherId);
  addEq("p.teacher_name", query.teacher_name);
  addEq("p.subject_name", query.subject || query.subject_name);
  addEq("p.grade", query.grade);
  addEq("p.section", query.section);
  addEq("p.academic_year", query.academic_year);
  addEq("t.term_name", query.term || query.term_name);
  if (query.status === "Completed") where.push("st.is_completed = 1");
  if (query.status === "Pending") where.push("(st.id IS NULL OR st.is_completed = 0)");
  if (query.search) {
    const like = `%${String(query.search).trim()}%`;
    where.push(
      "(p.teacher_name LIKE ? OR p.teacher_id LIKE ? OR p.subject_name LIKE ? OR p.grade LIKE ? OR p.section LIKE ? OR u.unit_title LIKE ? OR mt.main_topic LIKE ? OR st.subtopic_title LIKE ?)",
    );
    params.push(like, like, like, like, like, like, like, like);
  }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

async function yearPlanReportPayload(req, actor, extraQuery = {}) {
  const query = { ...(req.query || {}), ...extraQuery };
  const { sql, params } = yearPlanReportWhere(query, req, actor);
  const [rows] = await db.query(
    `
      SELECT
        p.id AS year_plan_id,
        p.teacher_user_id,
        p.teacher_id,
        p.teacher_name,
        p.subject_name,
        p.grade,
        p.section,
        p.academic_year,
        p.status AS plan_status,
        p.progress_percentage AS plan_progress,
        t.term_name,
        t.term_order,
        u.unit_number,
        u.unit_title,
        mt.main_topic,
        st.id AS subtopic_id,
        st.subtopic_title,
        st.is_completed,
        st.completed_at,
        st.completed_by_name,
        st.completion_note
      FROM edutrack_year_plans p
      LEFT JOIN edutrack_year_plan_terms t ON t.year_plan_id = p.id
      LEFT JOIN edutrack_year_plan_units u ON u.term_id = t.id
      LEFT JOIN edutrack_year_plan_topics mt ON mt.unit_id = u.id
      LEFT JOIN edutrack_year_plan_subtopics st ON st.topic_id = mt.id
      ${sql}
      ORDER BY p.academic_year DESC, p.teacher_name ASC, p.subject_name ASC,
        p.grade ASC, p.section ASC, t.term_order ASC, u.display_order ASC,
        mt.display_order ASC, st.display_order ASC
      LIMIT 5000
    `,
    params,
  );
  const summary = rows.reduce(
    (acc, row) => {
      if (row.year_plan_id) acc.planIds.add(row.year_plan_id);
      const unitKey = `${row.year_plan_id}:${row.term_order}:${row.unit_number}`;
      if (row.unit_number) acc.unitKeys.add(unitKey);
      if (row.main_topic) acc.topicKeys.add(`${unitKey}:${row.main_topic}`);
      if (row.subtopic_id) {
        acc.totalSubtopics += 1;
        if (Number(row.is_completed || 0) === 1) acc.completedSubtopics += 1;
      }
      return acc;
    },
    {
      planIds: new Set(),
      unitKeys: new Set(),
      topicKeys: new Set(),
      totalSubtopics: 0,
      completedSubtopics: 0,
    },
  );
  return {
    title: "EduTrack Year Plan Progress Report",
    generatedBy: actor.name,
    generatedAt: new Date().toISOString(),
    filters: query,
    records: rows,
    summary: {
      totalPlans: summary.planIds.size,
      totalUnits: summary.unitKeys.size,
      totalMainTopics: summary.topicKeys.size,
      totalSubtopics: summary.totalSubtopics,
      completedSubtopics: summary.completedSubtopics,
      pendingSubtopics: Math.max(0, summary.totalSubtopics - summary.completedSubtopics),
      completionPercentage: summary.totalSubtopics
        ? Math.round((summary.completedSubtopics / summary.totalSubtopics) * 100)
        : 0,
    },
  };
}

app.get("/api/edutrack/year-plan-reports", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    res.json(await yearPlanReportPayload(req, actor));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/year-plan-reports/teacher/:teacherId", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    res.json(await yearPlanReportPayload(req, actor, { teacher_id: req.params.teacherId }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/year-plan-reports/subject", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    res.json(await yearPlanReportPayload(req, actor));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/year-plan-reports/grade-section", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    res.json(await yearPlanReportPayload(req, actor));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/year-plan-reports/export/csv", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const report = await yearPlanReportPayload(req, actor);
    const headers = [
      "Teacher",
      "Teacher ID",
      "Academic Year",
      "Subject",
      "Grade",
      "Section",
      "Term",
      "Unit No.",
      "Unit Title",
      "Main Topic",
      "Subtopic",
      "Status",
      "Completed Date",
      "Note",
    ];
    const lines = [
      headers.join(","),
      ...report.records.map((row) =>
        [
          row.teacher_name,
          row.teacher_id,
          row.academic_year,
          row.subject_name,
          row.grade,
          row.section,
          row.term_name,
          row.unit_number,
          row.unit_title,
          row.main_topic,
          row.subtopic_title,
          Number(row.is_completed || 0) === 1 ? "Completed" : "Pending",
          row.completed_at,
          row.completion_note,
        ]
          .map(csvEscape)
          .join(","),
      ),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="edutrack-year-plan-progress-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(lines.join("\r\n"));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/daily-syllabus-progress", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    res.json(await listDailyProgressRecords(req, actor));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edutrack/daily-syllabus-progress", teacherOrAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const record = normalizeDailyProgressInput(req.body || {}, actor);
    if (!isEduTrackAdminUser(req)) {
      record.teacher_user_id = actor.id;
      record.teacher_id = actor.teacherId || actor.id;
      record.teacher_name = actor.teacherName || actor.name;
    }
    assertDailyProgressRequired(record);
    await conn.beginTransaction();
    const [result] = await conn.query(
      `
        INSERT INTO edutrack_daily_syllabus_progress
          (teacher_user_id, teacher_id, teacher_name, record_date, grade, section, subject,
           period_label, unit_number, main_topic, subtopic, completed_work, page_reference,
           notes, completion_status, next_planned_lesson, status, created_by_user_id,
           created_by_name, updated_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        record.teacher_user_id,
        record.teacher_id,
        record.teacher_name,
        record.record_date,
        record.grade,
        record.section,
        record.subject,
        record.period_label,
        record.unit_number,
        record.main_topic,
        record.subtopic,
        record.completed_work,
        record.page_reference,
        record.notes,
        record.completion_status,
        record.next_planned_lesson,
        record.status,
        actor.id,
        actor.name,
        actor.id,
      ],
    );
    await insertDailySyllabusAudit(conn, req, result.insertId, "created", null, record, actor);
    await conn.commit();
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    await conn.rollback();
    res.status(error.status || 500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.put("/api/edutrack/daily-syllabus-progress/:id", teacherOrAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT * FROM edutrack_daily_syllabus_progress WHERE id = ? FOR UPDATE",
      [Number(req.params.id)],
    );
    const existing = rows[0];
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: "Daily progress record not found" });
    }
    if (!canAccessDailyRecord(req, actor, existing, "edit")) {
      await insertDailySyllabusAudit(
        conn,
        req,
        existing.id,
        "blocked_edit",
        existing,
        req.body,
        actor,
      );
      await conn.commit();
      return res.status(403).json({ error: "You cannot edit this progress record" });
    }
    const record = normalizeDailyProgressInput(req.body || {}, actor, existing);
    if (!isEduTrackAdminUser(req)) {
      record.teacher_user_id = existing.teacher_user_id || actor.id;
      record.teacher_id = existing.teacher_id || actor.teacherId || actor.id;
      record.teacher_name = existing.teacher_name || actor.teacherName || actor.name;
    }
    assertDailyProgressRequired(record);
    await conn.query(
      `
        UPDATE edutrack_daily_syllabus_progress
        SET teacher_user_id = ?, teacher_id = ?, teacher_name = ?, record_date = ?, grade = ?,
          section = ?, subject = ?, period_label = ?, unit_number = ?, main_topic = ?,
          subtopic = ?, completed_work = ?, page_reference = ?, notes = ?,
          completion_status = ?, next_planned_lesson = ?, status = ?,
          updated_by_user_id = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [
        record.teacher_user_id,
        record.teacher_id,
        record.teacher_name,
        record.record_date,
        record.grade,
        record.section,
        record.subject,
        record.period_label,
        record.unit_number,
        record.main_topic,
        record.subtopic,
        record.completed_work,
        record.page_reference,
        record.notes,
        record.completion_status,
        record.next_planned_lesson,
        record.status,
        actor.id,
        existing.id,
      ],
    );
    await insertDailySyllabusAudit(conn, req, existing.id, "updated", existing, record, actor);
    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    res.status(error.status || 500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.delete("/api/edutrack/daily-syllabus-progress/:id", teacherOrAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT * FROM edutrack_daily_syllabus_progress WHERE id = ? FOR UPDATE",
      [Number(req.params.id)],
    );
    const existing = rows[0];
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: "Daily progress record not found" });
    }
    if (!isEduTrackMasterUser(req)) {
      await insertDailySyllabusAudit(
        conn,
        req,
        existing.id,
        "blocked_delete",
        existing,
        null,
        actor,
      );
      await conn.commit();
      return res.status(403).json({ error: "Master EduTrack access required to delete records" });
    }
    await conn.query("DELETE FROM edutrack_daily_syllabus_progress WHERE id = ?", [existing.id]);
    await insertDailySyllabusAudit(conn, req, existing.id, "deleted", existing, null, actor);
    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.get("/api/edutrack/daily-syllabus-progress/report", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const records = await listDailyProgressRecords(req, actor);
    const summary = records.reduce(
      (acc, row) => {
        acc.total += 1;
        acc.byStatus[row.completion_status || "Unknown"] =
          (acc.byStatus[row.completion_status || "Unknown"] || 0) + 1;
        acc.byTeacher[row.teacher_name || row.teacher_id || "Unknown"] =
          (acc.byTeacher[row.teacher_name || row.teacher_id || "Unknown"] || 0) + 1;
        acc.bySubject[row.subject || "Unknown"] =
          (acc.bySubject[row.subject || "Unknown"] || 0) + 1;
        return acc;
      },
      { total: 0, byStatus: {}, byTeacher: {}, bySubject: {} },
    );
    res.json({
      title: "EduTrack Daily Syllabus Progress Report",
      generatedBy: actor.name,
      generatedAt: new Date().toISOString(),
      records,
      summary,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/daily-syllabus-progress/export/csv", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const actor = await eduTrackActor(req);
    const records = await listDailyProgressRecords(req, actor);
    const headers = [
      "Teacher",
      "Teacher ID",
      "Date",
      "Class / Section",
      "Subject",
      "Period",
      "Unit Number",
      "Topic Done Today",
      "Completion Status",
      "Notes",
      "Created At",
    ];
    const lines = [
      headers.join(","),
      ...records.map((row) =>
        [
          row.teacher_name,
          row.teacher_id,
          dateOnly(row.record_date),
          row.section,
          row.subject,
          row.period_label,
          row.unit_number,
          row.completed_work,
          row.completion_status,
          row.notes,
          row.created_at,
        ]
          .map(csvEscape)
          .join(","),
      ),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="edutrack-daily-syllabus-progress-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    );
    res.send(lines.join("\r\n"));
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

async function reliefActorInfo(req) {
  const actor = await eduTrackActor(req);
  return {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    role: actor.role,
    teacherId: actor.teacherId,
    teacherName: actor.teacherName,
  };
}

async function lookupEduTrackTeacher(teacherId, conn = db) {
  const value = String(teacherId || "").trim();
  if (!value) return null;
  const [rows] = await conn.query(
    `
      SELECT id, staff_id, external_staff_id, name, position, subject, section, classes,
        account_user_id, account_email
      FROM teachers
      WHERE id = ? OR staff_id = ? OR external_staff_id = ? OR account_user_id = ?
      ORDER BY
        (account_user_id IS NOT NULL AND account_user_id <> '') DESC,
        (staff_id = ?) DESC,
        (external_staff_id = ?) DESC,
        (id = ?) DESC
      LIMIT 1
    `,
    [value, value, value, value, value, value, value],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.staff_id || row.external_staff_id || row.id,
    userId: row.account_user_id || "",
    name: row.name || "",
    position: row.position || "",
    subject: row.subject || "",
    section: row.section || row.classes || "",
    classes: row.classes || "",
    email: row.account_email || "",
  };
}

async function insertReliefAudit(conn, req, assignment, action, details = {}, actor = null) {
  const resolvedActor = actor || (await reliefActorInfo(req));
  const meta = requestAuditMeta(req);
  const detailsJson = typeof details === "string" ? { message: details } : details || {};
  await conn.query(
    `
      INSERT INTO edutrack_relief_assignment_audit_logs
        (assignment_id, action, actor_user_id, actor_name, actor_email, uploaded_teacher_id,
         uploaded_teacher_name, relief_teacher_id, relief_teacher_name, details, details_json,
         ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      Number(assignment?.id || assignment || 0),
      action,
      resolvedActor.id,
      resolvedActor.name,
      resolvedActor.email,
      assignment?.uploaded_teacher_id || assignment?.teacher_id || "",
      assignment?.uploaded_teacher_name || assignment?.teacher_name || "",
      detailsJson.relief_teacher_id || assignment?.relief_teacher_id || "",
      detailsJson.relief_teacher_name || assignment?.relief_teacher_name || "",
      detailsJson.message || action,
      JSON.stringify(detailsJson),
      meta.ip,
      meta.userAgent,
    ],
  );
}

function normalizeReliefAssignment(row) {
  const downloadCount = Number(row.download_count ?? row.print_count ?? 0);
  const allowedDownloads = 1 + Number(row.allowed_extra_downloads ?? row.allowed_extra_prints ?? 0);
  return {
    ...row,
    fileUrl: `/api/edutrack/relief-assignments/${row.id}/file`,
    download_count: downloadCount,
    allowed_extra_downloads: Number(row.allowed_extra_downloads ?? row.allowed_extra_prints ?? 0),
    isLocked: downloadCount >= allowedDownloads,
    isDownloadLocked: downloadCount >= allowedDownloads,
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
    const actor = await reliefActorInfo(req);
    const canSeeAll = isEduTrackOversightUser(req);
    const [rows] = canSeeAll
      ? await db.query(
          "SELECT * FROM edutrack_relief_assignments WHERE status <> 'deleted' ORDER BY created_at DESC",
        )
      : await db.query(
          `
            SELECT *
            FROM edutrack_relief_assignments
            WHERE status <> 'deleted' AND uploaded_by_user_id = ?
            ORDER BY created_at DESC
          `,
          [actor.id],
        );
    res.json(rows.map(normalizeReliefAssignment));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/teachers/lookup/:teacherId", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const teacher = await lookupEduTrackTeacher(req.params.teacherId);
    if (!teacher) return res.status(404).json({ error: "Teacher not found" });
    res.json(teacher);
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

      const actor = await reliefActorInfo(req);
      const [result] = await db.query(
        `
          INSERT INTO edutrack_relief_assignments
            (teacher_id, teacher_name, title, assignment_date, grade, section, subject_name,
             period_label, note, pdf_file_path, original_file_name, uploaded_by_user_id,
             uploaded_by_name, uploaded_by_email, uploaded_teacher_id, uploaded_teacher_name, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          actor.teacherId || actor.id,
          actor.teacherName || actor.name,
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
          actor.teacherId || actor.id,
          actor.teacherName || actor.name,
          "pending_download",
        ],
      );

      await insertReliefAudit(
        db,
        req,
        {
          id: result.insertId,
          uploaded_teacher_id: actor.teacherId || actor.id,
          uploaded_teacher_name: actor.teacherName || actor.name,
        },
        "uploaded",
        { message: `Uploaded ${req.file.originalname}` },
        actor,
      );

      res.status(201).json({ success: true, id: result.insertId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.get("/api/edutrack/relief-assignments/:id", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const actor = await reliefActorInfo(req);
    const [rows] = await db.query(
      "SELECT * FROM edutrack_relief_assignments WHERE id = ? AND status <> 'deleted' LIMIT 1",
      [Number(req.params.id)],
    );
    const assignment = rows[0];
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    const canRead = isEduTrackAdminUser(req) || assignment.uploaded_by_user_id === actor.id;
    if (!canRead) return res.status(403).json({ error: "Access denied" });
    res.json(normalizeReliefAssignment(assignment));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/edutrack/relief-assignments/:id/official-download",
  eduzyncAdminOnly,
  async (req, res) => {
    const { relief_teacher_id, reason = "" } = req.body || {};
    if (!relief_teacher_id) {
      return res.status(400).json({ error: "relief_teacher_id required" });
    }

    const conn = await db.getConnection();
    let committed = false;
    try {
      await ensureContentTables();
      const actor = await reliefActorInfo(req);
      await conn.beginTransaction();
      const [rows] = await conn.query(
        "SELECT * FROM edutrack_relief_assignments WHERE id = ? FOR UPDATE",
        [Number(req.params.id)],
      );
      const assignment = rows[0];
      if (!assignment) throw new Error("Assignment not found");

      const downloadCount = Number(assignment.download_count ?? assignment.print_count ?? 0);
      const allowedDownloads = 1 + Number(assignment.allowed_extra_downloads ?? 0);
      if (downloadCount >= allowedDownloads) {
        await insertReliefAudit(
          conn,
          req,
          assignment,
          "blocked_download_attempt",
          {
            message: "Download blocked because the assignment is locked",
            relief_teacher_id,
          },
          actor,
        );
        await conn.commit();
        committed = true;
        return res.status(403).json({ error: "Already downloaded and locked" });
      }

      const downloadReason = String(reason || "").trim();
      if (downloadCount > 0 && !downloadReason) {
        throw new Error("Reason required for an extra download");
      }

      const filePath = resolveReliefPdfPath(assignment);
      if (!filePath) throw new Error("PDF file not found");

      const teacher = await lookupEduTrackTeacher(relief_teacher_id, conn);
      if (!teacher) throw new Error("Relief teacher not found");

      const nextDownloadCount = downloadCount + 1;
      const willLock = nextDownloadCount >= allowedDownloads;
      await conn.query(
        `
          UPDATE edutrack_relief_assignments
          SET relief_teacher_id = ?, relief_teacher_name = ?, relief_teacher_position = ?,
            relief_teacher_subject = ?, download_count = ?, downloaded_by_user_id = ?,
            downloaded_by_name = ?, downloaded_by_email = ?, downloaded_at = NOW(),
            locked_at = CASE WHEN ? THEN NOW() ELSE locked_at END,
            locked_by_user_id = CASE WHEN ? THEN ? ELSE locked_by_user_id END,
            status = CASE WHEN ? THEN 'locked' ELSE 'downloaded' END
          WHERE id = ?
        `,
        [
          teacher.id,
          teacher.name,
          teacher.position || "",
          teacher.subject || "",
          nextDownloadCount,
          actor.id,
          actor.name,
          actor.email,
          willLock ? 1 : 0,
          willLock ? 1 : 0,
          actor.id,
          willLock ? 1 : 0,
          assignment.id,
        ],
      );

      await insertReliefAudit(
        conn,
        req,
        assignment,
        downloadCount > 0 ? "extra_download_used" : "first_download",
        {
          message:
            downloadCount > 0
              ? `Extra official download used. Reason: ${downloadReason}`
              : "First official download used",
          relief_teacher_id: teacher.id,
          relief_teacher_name: teacher.name,
          download_count: nextDownloadCount,
          locked: willLock,
        },
        actor,
      );
      await conn.commit();
      committed = true;
      res.download(filePath, assignment.original_file_name || path.basename(filePath));
    } catch (error) {
      if (!committed) await conn.rollback();
      res.status(400).json({ error: error.message });
    } finally {
      conn.release();
    }
  },
);

app.post("/api/edutrack/relief-assignments/:id/print", eduzyncAdminOnly, (req, res) => {
  res.status(410).json({ error: "Printing is disabled. Use Official Download." });
});

async function unlockReliefDownload(req, res) {
  try {
    await ensureContentTables();
    const actor = await reliefActorInfo(req);
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "Unlock reason required" });
    const [result] = await db.query(
      `
          UPDATE edutrack_relief_assignments
          SET allowed_extra_downloads = allowed_extra_downloads + 1,
            last_unlocked_by = ?, last_unlocked_at = NOW(), last_unlock_reason = ?
          WHERE id = ?
        `,
      [actor.id, reason, Number(req.params.id)],
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Assignment not found" });
    await insertReliefAudit(
      db,
      req,
      { id: Number(req.params.id) },
      "one_more_download_unlocked",
      { message: reason, unlock_kind: "download" },
      actor,
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

app.post(
  "/api/edutrack/relief-assignments/:id/unlock-one-download",
  edutrackMasterOnly,
  (req, res) => {
    unlockReliefDownload(req, res);
  },
);

app.post("/api/edutrack/relief-assignments/:id/unlock", edutrackMasterOnly, (req, res) => {
  unlockReliefDownload(req, res);
});

app.get("/api/edutrack/relief-assignments/:id/file", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    return res.status(403).json({
      error: "Use the official download endpoint so access can be audited and locked.",
    });
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
          relief_teacher_id, relief_teacher_name, details, details_json, ip_address, user_agent,
          created_at
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

app.post(
  "/api/edutrack/relief-assignments/:id/delete-request",
  eduzyncAdminOnly,
  async (req, res) => {
    try {
      await ensureContentTables();
      const actor = await reliefActorInfo(req);
      const assignmentId = Number(req.params.id);
      const reason = String(req.body?.reason || "Delete requested").trim();
      const [rows] = await db.query(
        "SELECT * FROM edutrack_relief_assignments WHERE id = ? AND status <> 'deleted' LIMIT 1",
        [assignmentId],
      );
      const assignment = rows[0];
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      const [result] = await db.query(
        "UPDATE edutrack_relief_assignments SET status = 'delete_requested', updated_at = NOW() WHERE id = ?",
        [assignmentId],
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: "Assignment not found" });
      await insertReliefAudit(db, req, assignment, "delete_requested", { message: reason }, actor);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.post(
  "/api/edutrack/relief-assignments/:id/approve-delete",
  edutrackMasterOnly,
  async (req, res) => {
    try {
      await ensureContentTables();
      const actor = await reliefActorInfo(req);
      const assignmentId = Number(req.params.id);
      const [rows] = await db.query(
        "SELECT * FROM edutrack_relief_assignments WHERE id = ? LIMIT 1",
        [assignmentId],
      );
      const assignment = rows[0];
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      const filePath = resolveReliefPdfPath(assignment);
      let fileDeleted = false;
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        fileDeleted = true;
      }
      await db.query(
        "UPDATE edutrack_relief_assignments SET status = 'deleted', pdf_file_path = NULL, updated_at = NOW() WHERE id = ?",
        [assignmentId],
      );
      await insertReliefAudit(
        db,
        req,
        assignment,
        "delete_approved",
        {
          message: String(req.body?.reason || "Delete approved").trim(),
          file_deleted: fileDeleted,
        },
        actor,
      );
      if (fileDeleted) {
        await insertReliefAudit(
          db,
          req,
          assignment,
          "file_deleted",
          { message: "PDF file deleted from protected storage" },
          actor,
        );
      }
      res.json({ success: true, fileDeleted });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.post(
  "/api/edutrack/relief-assignments/:id/reject-delete",
  edutrackMasterOnly,
  async (req, res) => {
    try {
      await ensureContentTables();
      const actor = await reliefActorInfo(req);
      const assignmentId = Number(req.params.id);
      const [rows] = await db.query(
        "SELECT * FROM edutrack_relief_assignments WHERE id = ? LIMIT 1",
        [assignmentId],
      );
      const assignment = rows[0];
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      await db.query(
        "UPDATE edutrack_relief_assignments SET status = 'pending_download', updated_at = NOW() WHERE id = ?",
        [assignmentId],
      );
      await insertReliefAudit(
        db,
        req,
        assignment,
        "delete_rejected",
        { message: String(req.body?.reason || "Delete rejected").trim() },
        actor,
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.delete("/api/edutrack/relief-assignments/:id", edutrackMasterOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const actor = await reliefActorInfo(req);
    const assignmentId = Number(req.params.id);
    const [rows] = await db.query(
      "SELECT * FROM edutrack_relief_assignments WHERE id = ? LIMIT 1",
      [assignmentId],
    );
    const assignment = rows[0];
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    await db.query(
      "UPDATE edutrack_relief_assignments SET status = 'deleted', updated_at = NOW() WHERE id = ?",
      [assignmentId],
    );
    await insertReliefAudit(
      db,
      req,
      assignment,
      "delete_approved",
      { message: "Master direct delete marked the assignment as deleted" },
      actor,
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function eduTrackRole(role) {
  if ([ROLES.master, ROLES.super, ROLES.masterEduTrack, ROLES.eduzync, ROLES.view].includes(role))
    return "admin";
  if (role === ROLES.coordinator) return "coordinator";
  if (role === "teacher") return "teacher";
  return role || "teacher";
}

function fromPlatformUser(row, extra = {}) {
  const data = {
    id: row.id,
    name: row.name,
    email: row.email,
    ...extra,
    nicNumber:
      normalizeNicNumber(row.nic_number) ||
      normalizeNicNumber(extra.nicNumber || extra.nic_number || extra.nic) ||
      "",
    role: eduTrackRole(row.role),
    platformRole: row.role,
    isMasterAdmin: [ROLES.master, ROLES.super, ROLES.masterEduTrack].includes(row.role),
    status: row.status,
    createdAt: row.created_at,
  };
  return { id: row.id, data };
}

function firstEduTrackValue(...values) {
  return values.map((value) => compactText(value, 190)).find(Boolean) || "";
}

function addEduTrackIdentityHint(index, hint = {}) {
  const normalized = {
    userId: firstEduTrackValue(hint.userId, hint.user_id, hint.account_user_id),
    teacherId: firstEduTrackValue(
      hint.teacherId,
      hint.teacher_id,
      hint.edutrack_teacher_id,
      hint.id,
    ),
    staffId: firstEduTrackValue(hint.staffId, hint.staff_id, hint.external_staff_id, hint.id),
    email: firstEduTrackValue(hint.email, hint.account_email, hint.user_email).toLowerCase(),
    name: firstEduTrackValue(hint.name, hint.full_name),
    subject: firstEduTrackValue(hint.subject),
    classes: firstEduTrackValue(hint.classes),
    staffType: firstEduTrackValue(hint.staffType, hint.staff_type, hint.type),
    department: firstEduTrackValue(hint.department, hint.section, hint.category),
    position: firstEduTrackValue(hint.position),
  };
  const add = (map, key) => {
    if (key && !map.has(key)) map.set(key, normalized);
  };
  add(index.byUserId, normalized.userId);
  add(index.byTeacherId, normalized.teacherId);
  add(index.byTeacherId, normalized.staffId);
  add(index.byEmail, normalized.email);
}

async function loadEduTrackIdentityHints() {
  const index = { byUserId: new Map(), byTeacherId: new Map(), byEmail: new Map() };
  if (await tableExists("staff_profiles")) {
    try {
      const [profiles] = await db.query("SELECT * FROM staff_profiles");
      profiles.forEach((profile) =>
        addEduTrackIdentityHint(index, {
          userId: firstEduTrackValue(profile.user_id, profile.teacher_id),
          teacherId: firstEduTrackValue(
            profile.edutrack_teacher_id,
            profile.id,
            profile.teacher_id,
          ),
          staffId: profile.id,
          email: firstEduTrackValue(profile.email, profile.user_email),
          name: profile.full_name,
          staffType: profile.staff_type,
          department: firstEduTrackValue(profile.department, profile.section),
          position: profile.position,
        }),
      );
    } catch (error) {
      console.warn("EduTrack staff profile identity hints skipped:", error.message);
    }
  }
  if (await tableExists("teachers")) {
    try {
      const [teachers] = await db.query(
        "SELECT id, staff_id, external_staff_id, name, email, subject, classes, type, category, section, position, account_email, account_user_id FROM teachers",
      );
      teachers.forEach((teacher) =>
        addEduTrackIdentityHint(index, {
          userId: teacher.account_user_id,
          teacherId: firstEduTrackValue(teacher.staff_id, teacher.external_staff_id, teacher.id),
          staffId: firstEduTrackValue(teacher.staff_id, teacher.external_staff_id),
          email: firstEduTrackValue(teacher.account_email, teacher.email),
          name: teacher.name,
          subject: teacher.subject,
          classes: teacher.classes,
          staffType: teacher.type,
          department: firstEduTrackValue(teacher.section, teacher.category),
          position: teacher.position,
        }),
      );
    } catch (error) {
      console.warn("EduTrack teacher identity hints skipped:", error.message);
    }
  }
  return index;
}

function findEduTrackIdentityHint(index, row = {}, extra = {}) {
  const idKeys = [
    row.id,
    row.external_staff_id,
    extra.teacherId,
    extra.teacher_id,
    extra.staffId,
    extra.staff_id,
  ]
    .map((value) => compactText(value, 190))
    .filter(Boolean);
  for (const key of idKeys) {
    const byUser = index.byUserId.get(key);
    if (byUser) return byUser;
  }
  for (const key of idKeys) {
    const byTeacher = index.byTeacherId.get(key);
    if (byTeacher) return byTeacher;
  }
  const emailKeys = [row.email, extra.email]
    .map((value) => compactText(value, 190).toLowerCase())
    .filter(Boolean);
  for (const key of emailKeys) {
    const byEmail = index.byEmail.get(key);
    if (byEmail) return byEmail;
  }
  return null;
}

function mergeEduTrackIdentity(row = {}, extra = {}, hint = null) {
  const staffId = firstEduTrackValue(
    hint?.staffId,
    row.external_staff_id,
    extra.staffId,
    extra.staff_id,
  );
  const teacherId = firstEduTrackValue(
    hint?.teacherId,
    staffId,
    row.external_staff_id,
    extra.teacherId,
    extra.teacher_id,
  );
  const merged = {
    ...extra,
    teacherId,
    teacher_id: firstEduTrackValue(extra.teacher_id, teacherId),
    staffId,
    staff_id: firstEduTrackValue(extra.staff_id, staffId),
    subject: firstEduTrackValue(extra.subject, hint?.subject),
    classes: firstEduTrackValue(extra.classes, hint?.classes),
    staffType: firstEduTrackValue(extra.staffType, hint?.staffType),
    department: firstEduTrackValue(extra.department, hint?.department),
    position: firstEduTrackValue(extra.position, hint?.position),
  };
  const displayName = firstEduTrackValue(extra.name, hint?.name);
  if (displayName) merged.name = displayName;
  return merged;
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

const EDUTRACK_LEGACY_TEACHER_CLEANUP_KEY = "edutrack_legacy_teacher_cleanup_v1";
let eduTrackLegacyTeacherCleanupPromise = null;

function eduTrackTeacherIdentityValues(row = {}) {
  return [row.id, row.staff_id, row.external_staff_id, row.account_user_id, row.user_id]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

async function unassignEduTrackTeacherReferences(connection, identityValues, idColumn) {
  const values = [...new Set(identityValues)].filter(Boolean);
  if (!values.length) return { subjects: 0, classes: 0, documentSubjects: 0 };

  const placeholders = values.map(() => "?").join(", ");
  const [subjectsResult] = await connection.query(
    `UPDATE subjects SET teacher_id = '' WHERE teacher_id IN (${placeholders})`,
    values,
  );
  const [classesResult] = await connection.query(
    `UPDATE classes SET class_teacher_id = '' WHERE class_teacher_id IN (${placeholders})`,
    values,
  );

  const [subjectDocuments] = await connection.query(
    `SELECT ${idColumn} AS doc_id, data
     FROM edutrack_documents
     WHERE collection_name = 'subjects'`,
  );
  const identitySet = new Set(values);
  let documentSubjects = 0;
  for (const document of subjectDocuments) {
    const data = parseJsonField(document.data, {});
    const assignedTeacherId = String(data.teacherId || data.teacher_id || "").trim();
    if (!identitySet.has(assignedTeacherId)) continue;

    data.teacherId = "";
    if (Object.prototype.hasOwnProperty.call(data, "teacher_id")) data.teacher_id = "";
    await connection.query(
      `UPDATE edutrack_documents
       SET data = ?
       WHERE collection_name = 'subjects' AND ${idColumn} = ?`,
      [JSON.stringify(data), document.doc_id],
    );
    documentSubjects += 1;
  }

  return {
    subjects: Number(subjectsResult.affectedRows || 0),
    classes: Number(classesResult.affectedRows || 0),
    documentSubjects,
  };
}

async function cleanupLegacyEduTrackTeachers() {
  if (process.env.APP_NAME !== "edutrack") return { skipped: true, reason: "not-edutrack" };
  return { skipped: true, reason: "destructive-cleanup-disabled" };

  await ensureContentTables();
  await ensureMaintenanceSettingsTable();
  const idColumn = await getEduTrackDocumentIdColumn();
  const teacherColumns = new Set((await tableColumns("teachers")).map((column) => column.Field));
  const hasLegacyUserId = teacherColumns.has("user_id");
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const [markers] = await connection.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1 FOR UPDATE",
      [EDUTRACK_LEGACY_TEACHER_CLEANUP_KEY],
    );
    if (markers.length) {
      await connection.commit();
      return { skipped: true, reason: "already-completed" };
    }

    const [teacherRows] = await connection.query(
      `
        SELECT id, staff_id, external_staff_id, account_user_id
          ${hasLegacyUserId ? ", user_id" : ""}
        FROM teachers
      `,
    );
    const [teacherUsers] = await connection.query(
      "SELECT id, external_staff_id, role FROM users WHERE role = 'teacher'",
    );
    const teacherUserById = new Map(teacherUsers.map((user) => [String(user.id || ""), user]));

    const protectedTeacherRows = teacherRows.filter((teacher) => {
      const accountUserId = String(teacher.account_user_id || "").trim();
      const staffId = firstEduTrackValue(teacher.staff_id, teacher.external_staff_id, teacher.id);
      const account = teacherUserById.get(accountUserId);
      const accountStaffId = String(account?.external_staff_id || "").trim();
      return Boolean(
        accountUserId &&
        staffId &&
        account &&
        (!accountStaffId || accountStaffId === staffId) &&
        (!hasLegacyUserId || !String(teacher.user_id || "").trim()),
      );
    });
    const protectedTeacherRowIds = new Set(
      protectedTeacherRows.map((teacher) => String(teacher.id)),
    );
    const protectedUserIds = new Set(
      protectedTeacherRows.map((teacher) => String(teacher.account_user_id)),
    );
    const protectedIdentityValues = new Set(
      protectedTeacherRows.flatMap((teacher) => eduTrackTeacherIdentityValues(teacher)),
    );
    const staleTeacherRows = teacherRows.filter(
      (teacher) => !protectedTeacherRowIds.has(String(teacher.id)),
    );
    const staleTeacherUsers = teacherUsers.filter((user) => !protectedUserIds.has(String(user.id)));
    const staleUserIds = staleTeacherUsers.map((user) => String(user.id));
    const staleReferenceValues = [
      ...staleTeacherRows.flatMap((teacher) => eduTrackTeacherIdentityValues(teacher)),
      ...staleTeacherUsers.flatMap((user) => [
        String(user.id || "").trim(),
        String(user.external_staff_id || "").trim(),
      ]),
    ].filter((value) => value && !protectedIdentityValues.has(value));

    const unassigned = await unassignEduTrackTeacherReferences(
      connection,
      staleReferenceValues,
      idColumn,
    );

    if (staleTeacherRows.length) {
      const ids = staleTeacherRows.map((teacher) => String(teacher.id));
      await connection.query(
        `DELETE FROM teachers WHERE id IN (${ids.map(() => "?").join(", ")})`,
        ids,
      );
    }

    if (staleUserIds.length) {
      const placeholders = staleUserIds.map(() => "?").join(", ");
      await connection.query(
        `DELETE FROM edutrack_documents
         WHERE collection_name = 'users' AND ${idColumn} IN (${placeholders})`,
        staleUserIds,
      );
      await connection.query(
        `DELETE FROM password_reset_tokens WHERE user_id IN (${placeholders})`,
        staleUserIds,
      );
      await connection.query(
        `DELETE FROM users WHERE role = 'teacher' AND id IN (${placeholders})`,
        staleUserIds,
      );
    }

    const summary = {
      removedTeacherRows: staleTeacherRows.length,
      removedTeacherUsers: staleUserIds.length,
      unassigned,
      completedAt: new Date().toISOString(),
    };
    await connection.query(
      `
        INSERT INTO system_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
      `,
      [EDUTRACK_LEGACY_TEACHER_CLEANUP_KEY, JSON.stringify(summary)],
    );
    await connection.commit();
    return { skipped: false, ...summary };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function ensureLegacyEduTrackTeacherCleanup() {
  if (process.env.APP_NAME !== "edutrack") {
    return Promise.resolve({ skipped: true, reason: "not-edutrack" });
  }
  if (!eduTrackLegacyTeacherCleanupPromise) {
    eduTrackLegacyTeacherCleanupPromise = cleanupLegacyEduTrackTeachers().catch((error) => {
      eduTrackLegacyTeacherCleanupPromise = null;
      throw error;
    });
  }
  return eduTrackLegacyTeacherCleanupPromise;
}

async function backfillEduTrackTeacherAccountLinks() {
  if (await tableExists("staff_profiles")) {
    await db.query(`
      UPDATE users u
      JOIN (
        SELECT user_id, MIN(id) AS staff_id
        FROM staff_profiles
        WHERE NULLIF(user_id, '') IS NOT NULL
        GROUP BY user_id
      ) linked ON linked.user_id = u.id
      SET u.external_staff_id = linked.staff_id
      WHERE u.role = 'teacher'
        AND NULLIF(linked.staff_id, '') IS NOT NULL
        AND (
          NULLIF(u.external_staff_id, '') IS NULL
          OR u.external_staff_id <> linked.staff_id
        )
    `);
  }

  if (await tableExists("teachers")) {
    await db.query(`
      UPDATE users u
      JOIN (
        SELECT
          account_user_id,
          MIN(COALESCE(NULLIF(staff_id, ''), NULLIF(external_staff_id, ''), id)) AS staff_id
        FROM teachers
        WHERE NULLIF(account_user_id, '') IS NOT NULL
        GROUP BY account_user_id
      ) linked ON linked.account_user_id = u.id
      SET u.external_staff_id = linked.staff_id
      WHERE u.role = 'teacher'
        AND NULLIF(linked.staff_id, '') IS NOT NULL
        AND NULLIF(u.external_staff_id, '') IS NULL
    `);
  }
}

function isActiveStatus(value) {
  return String(value || "").trim().toLowerCase() === "active";
}

function eduTrackStaffPositionPayload(row = {}) {
  const gradeValue = row.grade === null || row.grade === undefined ? null : Number(row.grade);
  return {
    positionMasterId: row.position_master_id || null,
    positionCode: row.position_code || "",
    displayTitle: row.display_title || row.position || "",
    mainCategory: row.main_category || "",
    section: row.section || "",
    subsection: row.subsection || "",
    grade: Number.isFinite(gradeValue) ? gradeValue : null,
    stream: row.stream || "",
    medium: row.medium || "",
    classOrStream: row.class_or_stream || "",
    department: row.department || "",
    position: row.position || "",
    websitePlace: row.website_place || "",
    subject: row.subject || "",
    classes: row.classes || "",
    isPrimary: Boolean(Number(row.is_primary || 0)),
    displayOrder: Number(row.display_order || 0),
    sortOrder: Number(row.sort_order || 0),
    visibleOnWebsite: row.visible_on_website == null ? true : Boolean(Number(row.visible_on_website)),
    isKnown: row.is_known == null ? true : Boolean(Number(row.is_known)),
  };
}

function buildEduTrackSyncPayloadFromStaffProfile(profile = {}, positions = []) {
  const email = normalizeEmail(profile.account_email || profile.email);
  const userId = compactText(profile.account_user_id || profile.user_id, 50);
  if (!profile.id || !userId || !email) return null;

  const primary = positions.find((position) => position.isPrimary) || positions[0] || {};
  return {
    staffId: compactText(profile.id, 50),
    teacherId: compactText(profile.teacher_id || profile.id, 50),
    userId,
    name: compactText(profile.full_name || profile.account_name || email.split("@")[0], 150),
    email,
    status:
      isActiveStatus(profile.status) && isActiveStatus(profile.account_status)
        ? "Active"
        : "Disabled",
    subject: primary.subject || "",
    classes: primary.classes || "",
    position: primary.position || profile.position || "",
    department: primary.department || profile.department || "",
    staffType: profile.staff_type || "Academic Staff",
    photoUrl: profile.photo_url || profile.profile_image || "",
    websitePlace: primary.websitePlace || primary.website_place || profile.department || "",
    positions,
  };
}

async function loadStaffProfileEduTrackSyncPayloads(limit = 500) {
  if (!(await tableExists("staff_profiles"))) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));
  const [profiles] = await db.query(`
    SELECT
      sp.id,
      sp.user_id,
      sp.teacher_id,
      sp.full_name,
      sp.email,
      sp.staff_type,
      sp.department,
      sp.position,
      sp.status,
      sp.profile_image,
      sp.photo_url,
      u.id AS account_user_id,
      u.name AS account_name,
      u.email AS account_email,
      u.status AS account_status
    FROM staff_profiles sp
    JOIN users u
      ON u.id = sp.user_id
     AND u.role = 'teacher'
    WHERE NULLIF(sp.user_id, '') IS NOT NULL
      AND NULLIF(u.email, '') IS NOT NULL
    ORDER BY sp.updated_at DESC, sp.id ASC
    LIMIT ${safeLimit}
  `);

  if (!profiles.length) return [];

  const positionByStaffId = new Map();
  if (await tableExists("staff_positions")) {
    const staffIds = profiles.map((profile) => String(profile.id || "")).filter(Boolean);
    if (staffIds.length) {
      const placeholders = staffIds.map(() => "?").join(",");
      const [positionRows] = await db.query(
        `
          SELECT *
          FROM staff_positions
          WHERE staff_id IN (${placeholders})
          ORDER BY staff_id, is_primary DESC, sort_order ASC, display_order ASC, id ASC
        `,
        staffIds,
      );
      positionRows.forEach((row) => {
        const staffId = String(row.staff_id || "");
        if (!positionByStaffId.has(staffId)) positionByStaffId.set(staffId, []);
        positionByStaffId.get(staffId).push(eduTrackStaffPositionPayload(row));
      });
    }
  }

  return profiles
    .map((profile) =>
      buildEduTrackSyncPayloadFromStaffProfile(
        profile,
        positionByStaffId.get(String(profile.id || "")) || [],
      ),
    )
    .filter(Boolean);
}

async function syncStaffProfilesToExternalEduTrack(options = {}) {
  if (process.env.APP_NAME === "edutrack") return { skipped: true, reason: "edutrack-app" };
  if (!externalEduTrackSyncConfig().available) {
    return { skipped: true, reason: "external-sync-not-configured" };
  }

  await ensureContentTables();
  await ensureStaffSyncSchema();
  await backfillEduTrackTeacherAccountLinks();

  const payloads = await loadStaffProfileEduTrackSyncPayloads(options.limit || 500);
  let synced = 0;
  let failed = 0;

  for (const payload of payloads) {
    try {
      const result = await postExternalEduTrackSync(payload);
      if (!result) continue;
      const teacherId = result.edutrack_teacher_id || result.teacherId || payload.teacherId;
      await markStaffEduTrackSync(db, payload, "synced", "", teacherId);
      synced += 1;
    } catch (error) {
      failed += 1;
      await queueStaffEduTrackSync(db, payload, error);
    }
  }

  return { skipped: false, checked: payloads.length, synced, failed };
}

async function replayStaffEduTrackSyncOutbox(limit = 50) {
  if (process.env.APP_NAME === "edutrack") return { skipped: true, reason: "edutrack-app" };
  if (!externalEduTrackSyncConfig().available) {
    return { skipped: true, reason: "external-sync-not-configured" };
  }

  await ensureStaffSyncSchema();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
  const [rows] = await db.query(`
    SELECT id, payload, attempts
    FROM staff_sync_outbox
    WHERE target_system = 'edutrack'
      AND status IN ('pending', 'failed')
    ORDER BY updated_at ASC, id ASC
    LIMIT ${safeLimit}
  `);

  let synced = 0;
  let failed = 0;

  for (const row of rows) {
    const payload = parseJsonField(row.payload, null);
    if (!payload) {
      await db.query(
        "UPDATE staff_sync_outbox SET status = 'failed', error = ?, attempts = attempts + 1 WHERE id = ?",
        ["Invalid EduTrack sync payload", row.id],
      );
      failed += 1;
      continue;
    }

    try {
      const result = await postExternalEduTrackSync(payload);
      if (!result) continue;
      const teacherId = result.edutrack_teacher_id || result.teacherId || payload.teacherId;
      await db.query(
        "UPDATE staff_sync_outbox SET status = 'synced', error = NULL, attempts = attempts + 1 WHERE id = ?",
        [row.id],
      );
      await markStaffEduTrackSync(db, payload, "synced", "", teacherId);
      synced += 1;
    } catch (error) {
      failed += 1;
      await db.query(
        "UPDATE staff_sync_outbox SET status = 'failed', error = ?, attempts = attempts + 1 WHERE id = ?",
        [error.message || String(error), row.id],
      );
    }
  }

  return { skipped: false, checked: rows.length, synced, failed };
}

function scheduleEduTrackStaffSyncMaintenance() {
  if (process.env.APP_NAME === "edutrack") return;
  const config = externalEduTrackSyncConfig();
  if (!config.available) {
    if (requiresExternalEduTrackSync()) {
      console.warn(
        "EduTrack teacher sync is not configured. Set EDUTRACK_INTERNAL_BASE_URL and EDUTRACK_SYNC_SECRET.",
      );
    }
    return;
  }

  const delayMs = Math.max(Number(process.env.EDUTRACK_SYNC_STARTUP_DELAY_MS || 3000), 0);
  setTimeout(async () => {
    try {
      const replay = await replayStaffEduTrackSyncOutbox();
      const reconcile = await syncStaffProfilesToExternalEduTrack();
      if (replay.checked || reconcile.checked) {
        console.log(
          `EduTrack staff sync checked ${replay.checked + reconcile.checked} records; synced ${
            replay.synced + reconcile.synced
          }, failed ${replay.failed + reconcile.failed}.`,
        );
      }
    } catch (error) {
      console.error("EduTrack staff sync maintenance failed:", error.message);
    }
  }, delayMs);
}

async function deleteEduTrackTeacherAccount(userId, actorUserId) {
  if (process.env.APP_NAME !== "edutrack") {
    const error = new Error("Teacher deletion is only available in the EduTrack application");
    error.statusCode = 404;
    throw error;
  }

  await ensureContentTables();
  const idColumn = await getEduTrackDocumentIdColumn();
  const teacherColumns = new Set((await tableColumns("teachers")).map((column) => column.Field));
  const hasLegacyUserId = teacherColumns.has("user_id");
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const [[user]] = await connection.query(
      `
        SELECT id, external_staff_id, name, email, role, status
        FROM users
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [userId],
    );

    if (!user) {
      await connection.query(
        `DELETE FROM edutrack_documents
         WHERE collection_name = 'users' AND ${idColumn} = ?`,
        [userId],
      );
      await connection.commit();
      return { deleted: false };
    }
    if (user.role !== ROLES.teacher) {
      const error = new Error("Only teacher accounts can be deleted from this screen");
      error.statusCode = 403;
      throw error;
    }
    if (String(actorUserId || "") === String(user.id)) {
      const error = new Error("You cannot delete your own account");
      error.statusCode = 400;
      throw error;
    }

    const [teacherRows] = await connection.query(
      `
        SELECT id, staff_id, external_staff_id, account_user_id
          ${hasLegacyUserId ? ", user_id" : ""}
        FROM teachers
      `,
    );
    const externalStaffId = String(user.external_staff_id || "").trim();
    const linkedRows = teacherRows.filter((teacher) => {
      const accountUserId = String(teacher.account_user_id || "").trim();
      const legacyUserId = hasLegacyUserId ? String(teacher.user_id || "").trim() : "";
      if (accountUserId === userId || legacyUserId === userId) return true;
      if (!externalStaffId || accountUserId || legacyUserId) return false;
      return eduTrackTeacherIdentityValues(teacher).includes(externalStaffId);
    });
    const identityValues = [
      userId,
      externalStaffId,
      ...linkedRows.flatMap((teacher) => eduTrackTeacherIdentityValues(teacher)),
    ];
    const unassigned = await unassignEduTrackTeacherReferences(
      connection,
      identityValues,
      idColumn,
    );

    if (linkedRows.length) {
      const ids = linkedRows.map((teacher) => String(teacher.id));
      await connection.query(
        `DELETE FROM teachers WHERE id IN (${ids.map(() => "?").join(", ")})`,
        ids,
      );
    }
    await connection.query(
      `DELETE FROM edutrack_documents
       WHERE collection_name = 'users' AND ${idColumn} = ?`,
      [userId],
    );
    await connection.query("DELETE FROM password_reset_tokens WHERE user_id = ?", [userId]);
    const [deleteResult] = await connection.query(
      "DELETE FROM users WHERE id = ? AND role = 'teacher'",
      [userId],
    );
    await connection.commit();
    const portalSync = await deleteEduTrackUserAccountFromPortal(user);
    return {
      deleted: Number(deleteResult.affectedRows || 0) > 0,
      removedTeacherRows: linkedRows.length,
      unassigned,
      portalSync,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function canViewMasterAccounts(viewer) {
  return [ROLES.master, ROLES.super].includes(viewer?.role);
}

async function platformUsersForEduTrack(viewer = null) {
  await backfillEduTrackTeacherAccountLinks();
  await ensureLegacyEduTrackTeacherCleanup();
  const [users] = await db.query(
    `
      SELECT
        u.id,
        COALESCE(NULLIF(u.external_staff_id, ''), linked.staff_id) AS external_staff_id,
        u.nic_number,
        u.name,
        u.email,
        u.role,
        u.status,
        u.created_at
      FROM users u
      LEFT JOIN (
        SELECT
          account_user_id,
          MIN(COALESCE(NULLIF(staff_id, ''), NULLIF(external_staff_id, ''), id)) AS staff_id
        FROM teachers
        WHERE NULLIF(account_user_id, '') IS NOT NULL
        GROUP BY account_user_id
      ) linked ON linked.account_user_id = u.id
      WHERE u.role IN ('eduzync_admin','master_edutrack_admin','superadmin','masteradmin','academic_coordinator')
         OR (
           u.role = 'teacher'
           AND LOWER(COALESCE(u.status, '')) = 'active'
           AND linked.account_user_id IS NOT NULL
         )
      ORDER BY u.name
    `,
  );
  // Master and super admin rows are visible only to master/super admins
  // (a viewer always sees their own row).
  const visibleUsers = canViewMasterAccounts(viewer)
    ? users
    : users.filter(
        (user) =>
          ![ROLES.master, ROLES.super].includes(user.role) ||
          String(user.id) === String(viewer?.id || ""),
      );
  const docs = await listEduTrackDocs("users");
  const extraById = new Map(docs.map((item) => [item.id, item.data]));
  const identityHints = await loadEduTrackIdentityHints();
  return visibleUsers.map((user) => {
    const extra = extraById.get(user.id) || {};
    const hint = findEduTrackIdentityHint(identityHints, user, extra);
    return fromPlatformUser(user, mergeEduTrackIdentity(user, extra, hint));
  });
}

const EDUTRACK_TEACHER_CSV_MAX_BYTES = 2 * 1024 * 1024;

function normalizeEduTrackCsvHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

function parseEduTrackTeacherCsv(text) {
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

  const headers = rows.shift().map(normalizeEduTrackCsvHeader);
  return rows
    .filter((items) => items.some((value) => String(value || "").trim()))
    .map((items) => {
      const record = {};
      headers.forEach((header, index) => {
        if (!header) return;
        record[header] = items[index] == null ? "" : String(items[index]).trim();
      });
      return record;
    });
}

function eduTrackCsvField(row, ...keys) {
  for (const key of keys) {
    const normalized = normalizeEduTrackCsvHeader(key);
    if (Object.prototype.hasOwnProperty.call(row, normalized) && row[normalized]) {
      return row[normalized];
    }
  }
  return "";
}

function splitEduTrackCsvList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => compactText(item, 80)).filter(Boolean);
  }
  return String(value || "")
    .split(/[,\n;|]+/g)
    .map((item) => compactText(item, 80))
    .filter(Boolean);
}

function eduTrackLevelFromGrade(grade) {
  const value = Number(grade);
  if (!Number.isInteger(value) || value < 1 || value > 13) return "";
  if (value <= 5) return "primary";
  if (value <= 9) return "middle";
  if (value <= 11) return "upper";
  return "advanced";
}

function parseEduTrackCsvGrades(value) {
  const grades = splitEduTrackCsvList(value)
    .map((item) => {
      const match =
        String(item).match(/(?:grade|gr|g|level)?\s*-?\s*(1[0-3]|[1-9])\b/i) ||
        String(item).match(/\b(1[0-3]|[1-9])\b/);
      return match ? Number(match[1]) : NaN;
    })
    .filter((grade) => Number.isInteger(grade) && grade >= 1 && grade <= 13);
  return [...new Set(grades)].sort((a, b) => a - b);
}

function deriveEduTrackGradesFromClassIds(classIds) {
  const grades = classIds
    .map((classId) => {
      const text = String(classId || "").toUpperCase();
      const match =
        text.match(/(?:GRADE|GR|G)[-_\s]*(1[0-3]|[1-9])(?=[A-Z_\-\s]|$)/) ||
        text.match(/^(1[0-3]|[1-9])[A-Z]?$/);
      return match ? Number(match[1]) : NaN;
    })
    .filter((grade) => Number.isInteger(grade) && grade >= 1 && grade <= 13);
  return [...new Set(grades)].sort((a, b) => a - b);
}

function eduTrackTeacherPayloadFromCsvRow(row, index) {
  const teacherId = compactText(
    eduTrackCsvField(
      row,
      "teacher_id",
      "teacher id",
      "teacher_code",
      "staff_id",
      "staff id",
      "staff_no",
      "employee_id",
      "employee no",
      "id",
    ),
    50,
  ).toUpperCase();
  const classIds = splitEduTrackCsvList(
    eduTrackCsvField(row, "class_ids", "class ids", "class_id", "class id", "classes", "class"),
  ).map((item) => item.toUpperCase());
  const grades =
    parseEduTrackCsvGrades(eduTrackCsvField(row, "grades", "grade", "grade_assigned")) ||
    [];
  const effectiveGrades = grades.length ? grades : deriveEduTrackGradesFromClassIds(classIds);
  const email = normalizeEmail(
    eduTrackCsvField(row, "email", "account_email", "login_email", "teacher_email"),
  );
  const password = String(
    eduTrackCsvField(row, "password", "temporary_password", "temp_password", "new_password"),
  ).trim();
  const nicNumber = normalizeNicNumber(
    eduTrackCsvField(row, "nic", "nic_number", "nic no", "national_id", "national id card"),
  );

  return {
    rowNumber: index + 2,
    nicNumber,
    userId: compactText(eduTrackCsvField(row, "user_id", "account_user_id"), 50),
    staffId: teacherId,
    teacherId,
    name: compactText(
      eduTrackCsvField(row, "name", "full_name", "full name", "teacher_name", "staff_name"),
      150,
    ),
    email,
    password,
    status: normalizeAccountStatus(eduTrackCsvField(row, "status", "account_status") || "Active"),
    subject: compactText(eduTrackCsvField(row, "subject", "subjects", "department_subject"), 100),
    classes: compactText(classIds.join(", "), 100),
    position: compactText(eduTrackCsvField(row, "position", "job_title", "designation"), 150),
    department: compactText(eduTrackCsvField(row, "department", "section"), 100),
    staffType: compactText(eduTrackCsvField(row, "staff_type", "type") || "Academic Staff", 100),
    classIds,
    classId: classIds[0] || "",
    grades: effectiveGrades,
    grade: effectiveGrades[0] || "",
    level: effectiveGrades.length
      ? eduTrackLevelFromGrade(effectiveGrades[effectiveGrades.length - 1])
      : "",
  };
}

function validateEduTrackTeacherImportPayload(payload) {
  const errors = [];
  if (!payload.name) errors.push("name is required");
  if (!payload.teacherId) errors.push("teacher_id is required");
  if (!payload.email) errors.push("email is required");
  else if (!isValidEmail(payload.email)) errors.push("email is invalid");
  return errors;
}

async function findEduTrackTeacherImportTarget(payload) {
  const missing = "__missing__";
  const [users] = await db.query(
    `
      SELECT id, role
      FROM users
      WHERE email = ? OR id = ? OR external_staff_id = ?
      ORDER BY (email = ?) DESC, (id = ?) DESC, id
      LIMIT 1
    `,
    [
      payload.email,
      payload.userId || missing,
      payload.staffId || missing,
      payload.email,
      payload.userId || missing,
    ],
  );
  const [teachers] = await db.query(
    `
      SELECT id, account_user_id
      FROM teachers
      WHERE id = ?
         OR staff_id = ?
         OR external_staff_id = ?
         OR account_email = ?
         OR email = ?
         OR account_user_id = ?
      ORDER BY (account_user_id = ?) DESC, id
      LIMIT 1
    `,
    [
      payload.teacherId || missing,
      payload.staffId || missing,
      payload.staffId || missing,
      payload.email,
      payload.email,
      payload.userId || missing,
      payload.userId || missing,
    ],
  );
  return { user: users[0] || null, teacher: teachers[0] || null };
}

async function writeEduTrackTeacherUserDocument(userId, payload) {
  const current = (await readEduTrackDoc("users", userId)) || {};
  const now = new Date().toISOString();
  await writeEduTrackDoc("users", userId, {
    ...current,
    id: userId,
    name: payload.name,
    email: payload.email,
    role: "teacher",
    nicNumber: payload.nicNumber || current.nicNumber || "",
    teacherId: payload.teacherId,
    teacher_id: payload.teacherId,
    staffId: payload.staffId,
    staff_id: payload.staffId,
    external_staff_id: payload.staffId,
    classIds: payload.classIds,
    classId: payload.classId,
    grades: payload.grades,
    grade: payload.grade,
    level: payload.level,
    subject: payload.subject,
    position: payload.position,
    department: payload.department,
    staffType: payload.staffType,
    classes: payload.classes,
    status: payload.status,
    createdAt: current.createdAt || now,
    updatedAt: now,
  });
}

async function importEduTrackTeacherCsvRow(row, index) {
  const payload = eduTrackTeacherPayloadFromCsvRow(row, index);
  const validationErrors = validateEduTrackTeacherImportPayload(payload);
  if (validationErrors.length) {
    throw new Error(validationErrors.join("; "));
  }

  const existing = await findEduTrackTeacherImportTarget(payload);
  if (!existing.user && !payload.password) {
    throw new Error("password is required for a new teacher account");
  }
  if (existing.user?.role && existing.user.role !== ROLES.teacher) {
    throw new Error("email or user_id belongs to a non-teacher account");
  }

  const result = await runLocalEduTrackSync(db, payload, { markSync: false });
  if (payload.nicNumber) {
    const [dupes] = await db.query(
      "SELECT id FROM users WHERE nic_number = ? AND id <> ? LIMIT 1",
      [payload.nicNumber, result.userId],
    );
    if (!dupes.length) {
      await db.query("UPDATE users SET nic_number = ? WHERE id = ?", [
        payload.nicNumber,
        result.userId,
      ]);
    }
  }
  await writeEduTrackTeacherUserDocument(result.userId, payload);
  return {
    action: existing.user || existing.teacher ? "updated" : "created",
    userId: result.userId,
    teacherId: result.teacherId,
    storageTeacherId: result.storageTeacherId,
  };
}

async function linkExistingEduTrackTeacherDocument(docId, data) {
  const role = String(data?.role || "").trim().toLowerCase();
  const teacherId = firstEduTrackValue(
    data?.teacherId,
    data?.teacher_id,
    data?.staffId,
    data?.staff_id,
    data?.external_staff_id,
  );
  if ((role && role !== "teacher") || !teacherId) return;

  const [[user]] = await db.query(
    "SELECT id, external_staff_id, name, email, role, status FROM users WHERE id = ? LIMIT 1",
    [docId],
  );
  if (!user || user.role !== ROLES.teacher) return;

  const classIds = splitEduTrackCsvList(data.classIds || data.classId || data.classes).map((item) =>
    item.toUpperCase(),
  );
  const grades = Array.isArray(data.grades)
    ? data.grades
        .map((grade) => Number(grade))
        .filter((grade) => Number.isInteger(grade) && grade >= 1 && grade <= 13)
    : parseEduTrackCsvGrades(data.grade || "");
  const effectiveGrades = grades.length ? [...new Set(grades)].sort((a, b) => a - b) : [];
  await upsertLocalEduTrackTeacher(
    db,
    {
      userId: user.id,
      staffId: teacherId,
      teacherId,
      name: compactText(data.name || user.name, 150),
      email: normalizeEmail(data.email || user.email),
      status: data.status || user.status || "Active",
      subject: compactText(data.subject, 100),
      classes: compactText(classIds.join(", "), 100),
      position: compactText(data.position, 150),
      department: compactText(data.department, 100),
      staffType: compactText(data.staffType || data.staff_type || "Academic Staff", 100),
      classIds,
      classId: classIds[0] || "",
      grades: effectiveGrades,
      grade: effectiveGrades[0] || "",
      level: effectiveGrades.length
        ? eduTrackLevelFromGrade(effectiveGrades[effectiveGrades.length - 1])
        : data.level || "",
    },
    { markSync: false },
  );
}

app.get("/api/edutrack/session", teacherOrAdmin, async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, external_staff_id, nic_number, name, email, role, status, created_at FROM users WHERE id = ?",
      [req.user.id],
    );
    if (!users.length) return res.status(404).json({ error: "User not found" });
    const extra = (await readEduTrackDoc("users", req.user.id)) || {};
    const identityHints = await loadEduTrackIdentityHints();
    const hint = findEduTrackIdentityHint(identityHints, users[0], extra);
    res.json(fromPlatformUser(users[0], mergeEduTrackIdentity(users[0], extra, hint)).data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/accounts", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    // Master and super admin accounts stay hidden from everyone except
    // master/super admins themselves.
    const canSeeMasterAccounts = [ROLES.master, ROLES.super].includes(req.user?.role);
    const visibleRoles = canSeeMasterAccounts
      ? "'teacher','academic_coordinator','eduzync_admin','master_edutrack_admin','masteradmin','superadmin'"
      : "'teacher','academic_coordinator','eduzync_admin','master_edutrack_admin'";
    const [users] = await db.query(`
      SELECT id, external_staff_id, nic_number, name, email, role, status, created_at
      FROM users
      WHERE role IN (${visibleRoles})
      ORDER BY FIELD(role,'masteradmin','superadmin','master_edutrack_admin','eduzync_admin','academic_coordinator','teacher'), name
    `);
    res.json(
      users.map((user) => ({
        id: user.id,
        external_staff_id: user.external_staff_id,
        nic_number: user.nic_number || "",
        name: user.name,
        email: user.email,
        role: eduTrackRole(user.role),
        platformRole: user.role,
        status: normalizeAccountStatus(user.status),
        created_at: user.created_at,
      })),
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/edutrack/accounts/:id/status", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const targetId = compactText(req.params.id, 64);
    const nextStatus = normalizeAccountStatus(req.body?.status);
    if (targetId === String(req.user?.id)) {
      return res.status(400).json({ error: "You cannot change your own account status." });
    }
    const [rows] = await db.query(
      "SELECT id, external_staff_id, name, email, role, status FROM users WHERE id = ? LIMIT 1",
      [targetId],
    );
    const target = rows[0];
    if (!target) return res.status(404).json({ error: "User not found" });
    const protectedRoles = [ROLES.master, ROLES.super, ROLES.masterEduTrack, ROLES.eduzync];
    if (protectedRoles.includes(target.role) && !isEduTrackMasterUser(req)) {
      return res
        .status(403)
        .json({ error: "Only master admins can change an admin account status." });
    }
    if ([ROLES.master, ROLES.super].includes(target.role)) {
      return res.status(403).json({ error: "Master accounts cannot be disabled from EduTrack." });
    }
    await db.query("UPDATE users SET status = ? WHERE id = ?", [nextStatus, target.id]);
    const updated = { ...target, status: nextStatus };
    await syncEduTrackUserAccountToPortal(
      await storedEduTrackUserForPortalSync(target.id, {}, updated),
    ).catch(() => null);
    await upsertAccountRegistry(updated, req.user || {});
    await recordAccountAudit(
      req,
      nextStatus === "Active" ? "account_enabled" : "account_disabled",
      { id: target.id, email: target.email, name: target.name, role: target.role },
      { previous_status: target.status },
    );
    res.json({ success: true, user: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/edutrack/accounts/:id/nic", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const targetId = compactText(req.params.id, 64);
    const rawNic = String(req.body?.nic || req.body?.nic_number || "").trim();
    const nicNumber = rawNic ? normalizeNicNumber(rawNic) : "";
    if (rawNic && !nicNumber) {
      return res.status(400).json({
        error: "NIC number must be 12 digits or 9 digits followed by V or X.",
      });
    }
    const [rows] = await db.query(
      "SELECT id, nic_number, name, email, role, status FROM users WHERE id = ? LIMIT 1",
      [targetId],
    );
    const target = rows[0];
    if (!target) return res.status(404).json({ error: "User not found" });
    const protectedRoles = [ROLES.master, ROLES.super, ROLES.masterEduTrack, ROLES.eduzync];
    if (protectedRoles.includes(target.role) && !isEduTrackMasterUser(req)) {
      return res
        .status(403)
        .json({ error: "Only master admins can change an admin account NIC." });
    }
    if (nicNumber) {
      const [dupes] = await db.query(
        "SELECT id FROM users WHERE nic_number = ? AND id <> ? LIMIT 1",
        [nicNumber, target.id],
      );
      if (dupes.length) {
        return res
          .status(409)
          .json({ error: "This NIC number is already used by another account." });
      }
    }
    await db.query("UPDATE users SET nic_number = ? WHERE id = ?", [
      nicNumber || null,
      target.id,
    ]);
    const updated = { ...target, nic_number: nicNumber || null };
    await upsertAccountRegistry(updated, req.user || {});
    await recordAccountAudit(
      req,
      nicNumber ? "nic_updated" : "nic_cleared",
      { id: target.id, email: target.email, name: target.name, role: target.role },
      { previous_nic: target.nic_number || null },
    );
    res.json({ success: true, user: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/accounts/audit", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureAccountManagementTables();
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
    const [rows] = await accountsDb.query(
      `
        SELECT id, action, target_user_id, target_email, target_name, target_role,
          actor_user_id, actor_name, details_json, created_at
        FROM edutrack_account_audit_logs
        ORDER BY id DESC
        LIMIT ${limit}
      `,
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edutrack/create-user", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const {
      email,
      password,
      name = "Teacher",
      role = "teacher",
      status = "Active",
      teacherId,
      teacher_id,
      staffId,
      staff_id,
      externalStaffId,
      external_staff_id,
      nic,
      nicNumber,
      nic_number,
    } = req.body || {};
    const accountEmail = normalizeEmail(email);
    const accountName = compactText(name || accountEmail.split("@")[0] || "Teacher", 150);
    const accountRole = portalRoleFromEduTrackRole(role);
    const accountStatus = normalizeAccountStatus(status);
    const staffIdentity = compactText(
      externalStaffId || external_staff_id || staffId || staff_id || teacherId || teacher_id,
      80,
    );
    if (!accountEmail || !password)
      return res.status(400).json({ error: "email and password are required" });
    const rawNic = String(nic || nicNumber || nic_number || "").trim();
    const accountNic = normalizeNicNumber(rawNic);
    if (rawNic && !accountNic) {
      return res.status(400).json({
        error: "NIC number must be 12 digits or 9 digits followed by V or X.",
      });
    }
    if (accountNic) {
      const [nicRows] = await db.query(
        "SELECT id, email FROM users WHERE nic_number = ? LIMIT 1",
        [accountNic],
      );
      if (nicRows.length && normalizeEmail(nicRows[0].email) !== accountEmail) {
        return res
          .status(409)
          .json({ error: "This NIC number is already used by another account." });
      }
    }
    const creatableRoles = [ROLES.teacher, ROLES.coordinator, ROLES.eduzync, ROLES.masterEduTrack];
    if (!creatableRoles.includes(accountRole)) {
      return res.status(400).json({
        error: "role must be teacher, coordinator, or an EduTrack admin role",
      });
    }
    const adminTierRoles = [ROLES.eduzync, ROLES.masterEduTrack];
    if (adminTierRoles.includes(accountRole) && !isEduTrackMasterUser(req)) {
      return res
        .status(403)
        .json({ error: "Only master admins can create EduTrack admin accounts." });
    }

    const [existing] = await db.query(
      "SELECT id, external_staff_id, name, email, role, status, password_hash FROM users WHERE email = ?",
      [accountEmail],
    );
    if (existing.length > 0) {
      if (accountNic && !normalizeNicNumber(existing[0].nic_number)) {
        await db.query("UPDATE users SET nic_number = ? WHERE id = ?", [
          accountNic,
          existing[0].id,
        ]);
        existing[0].nic_number = accountNic;
      }
      const portalSync = await syncEduTrackUserAccountToPortal(
        await storedEduTrackUserForPortalSync(existing[0].id, req.body || {}, existing[0]),
        { passwordHash: existing[0].password_hash },
      );
      await upsertAccountRegistry(existing[0], req.user || {});
      await recordAccountAudit(req, "account_create_skipped_existing", {
        id: existing[0].id,
        email: existing[0].email,
        name: existing[0].name,
        role: existing[0].role,
      });
      return res.json({ success: true, user: existing[0], existing: true, portalSync });
    }

    const id = `T-${Date.now()}`;
    const passwordHash = await bcrypt.hash(password, 12);
    await db.query(
      "INSERT INTO users (id, external_staff_id, nic_number, name, email, role, status, password_hash) VALUES (?, NULLIF(?, ''), NULLIF(?, ''), ?, ?, ?, ?, ?)",
      [
        id,
        staffIdentity,
        accountNic,
        accountName,
        accountEmail,
        accountRole,
        accountStatus,
        passwordHash,
      ],
    );
    const user = {
      id,
      external_staff_id: staffIdentity,
      nic_number: accountNic || null,
      name: accountName,
      email: accountEmail,
      role: accountRole,
      status: accountStatus,
      teacherId: teacherId || teacher_id || staffIdentity,
      staffId: staffId || staff_id || staffIdentity,
      passwordHash,
    };
    const portalSync = await syncEduTrackUserAccountToPortal(user, {
      password,
      passwordHash,
    });
    await upsertAccountRegistry(user, req.user || {});
    await recordAccountAudit(req, "account_created", {
      id,
      email: accountEmail,
      name: accountName,
      role: accountRole,
    });
    res.status(201).json({
      success: true,
      user: { ...user, passwordHash: undefined },
      portalSync,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edutrack/sync-users-to-portal", edutrackMasterOnly, async (req, res) => {
  try {
    const result = await syncExistingEduTrackUsersToPortal();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edutrack/reset-user-password", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const userId = compactText(req.body?.id || req.body?.userId || "", 50);
    const email = normalizeEmail(req.body?.email || "");
    const nicNumber = normalizeNicNumber(req.body?.nic || req.body?.nic_number || "");
    const password = String(req.body?.password || "");
    if ((!userId && !email && !nicNumber) || password.length < 6) {
      return res.status(400).json({ error: "User identity and a 6+ character password are required" });
    }
    let rows;
    if (nicNumber && !userId && !email) {
      [rows] = await db.query(
        "SELECT id, external_staff_id, name, email, role, status FROM users WHERE nic_number = ? LIMIT 1",
        [nicNumber],
      );
    } else {
      [rows] = await db.query(
        `
          SELECT id, external_staff_id, name, email, role, status
          FROM users
          WHERE ${userId ? "id = ? OR" : ""} ${email ? "email = ?" : "1 = 0"}
          ORDER BY ${userId ? "(id = ?) DESC," : ""} id
          LIMIT 1
        `,
        userId && email ? [userId, email, userId] : userId ? [userId, userId] : [email],
      );
    }
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    const protectedRoles = [ROLES.master, ROLES.super, ROLES.masterEduTrack, ROLES.eduzync];
    if (protectedRoles.includes(user.role) && !isEduTrackMasterUser(req)) {
      return res
        .status(403)
        .json({ error: "Only master admins can reset an admin account password." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, user.id]);
    const portalSync = await syncEduTrackUserAccountToPortal(
      { ...user, passwordHash },
      { password, passwordHash },
    );
    await recordAccountAudit(req, "password_reset", {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    res.json({ success: true, user: { ...user, passwordHash: undefined }, portalSync });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edutrack/teachers/import-csv", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const csv = String(req.body?.csv || req.body?.content || "");
    const fileName = compactText(req.body?.fileName || req.body?.filename || "", 255);

    if (fileName && !fileName.toLowerCase().endsWith(".csv")) {
      return res.status(400).json({ error: "Only .csv files can be imported." });
    }
    if (Buffer.byteLength(csv, "utf8") > EDUTRACK_TEACHER_CSV_MAX_BYTES) {
      return res.status(400).json({ error: "CSV file is too large. Limit is 2 MB." });
    }

    const rows = parseEduTrackTeacherCsv(csv);
    if (!rows.length) return res.status(400).json({ error: "CSV file has no importable rows." });

    const results = {
      success: true,
      rows: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (let index = 0; index < rows.length; index += 1) {
      try {
        const imported = await importEduTrackTeacherCsvRow(rows[index], index);
        if (imported.action === "created") results.created += 1;
        else results.updated += 1;
      } catch (error) {
        results.skipped += 1;
        results.errors.push({
          row: index + 2,
          error: error.message || String(error),
        });
      }
    }

    if (!results.created && !results.updated && results.errors.length) {
      return res.status(400).json({
        ...results,
        success: false,
        error: "No teachers were imported. Fix the CSV errors and try again.",
      });
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/edutrack/compat/:collection", teacherOrAdmin, async (req, res) => {
  try {
    await ensureContentTables();
    const collectionName = safePathSegment(req.params.collection).replace(/\//g, "-");
    if (collectionName === "users")
      return res.json({ items: await platformUsersForEduTrack(req.user) });
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
        "SELECT id, external_staff_id, nic_number, name, email, role, status, created_at FROM users WHERE id = ?",
        [docId],
      );
      if (!users.length) return res.json({ exists: false, data: null });
      const isSelf = String(req.user?.id || "") === docId;
      if (
        [ROLES.master, ROLES.super].includes(users[0].role) &&
        !canViewMasterAccounts(req.user) &&
        !isSelf
      ) {
        return res.json({ exists: false, data: null });
      }
      const extra = (await readEduTrackDoc("users", docId)) || {};
      const identityHints = await loadEduTrackIdentityHints();
      const hint = findEduTrackIdentityHint(identityHints, users[0], extra);
      return res.json({
        exists: true,
        data: fromPlatformUser(users[0], mergeEduTrackIdentity(users[0], extra, hint)).data,
      });
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
    const payload = { ...(req.body || {}), id };
    await writeEduTrackDoc(collectionName, id, payload);
    if (collectionName === "subjects") await syncSubjectDocToTeacherAssignments(payload);
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
    const payload = { ...(req.body || {}), id: docId };
    await writeEduTrackDoc(collectionName, docId, payload);
    if (collectionName === "subjects") await syncSubjectDocToTeacherAssignments(payload);
    let portalSync = null;
    if (collectionName === "users" && EDUZYNC_ADMIN_ROLES.includes(req.user?.role)) {
      await linkExistingEduTrackTeacherDocument(docId, payload);
      portalSync = await syncEduTrackUserAccountToPortal(
        await storedEduTrackUserForPortalSync(docId, payload),
      );
    }
    res.json({ success: true, id: docId, portalSync });
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
    const payload = { ...current, ...(req.body || {}), id: docId };
    await writeEduTrackDoc(collectionName, docId, payload);
    if (collectionName === "subjects") await syncSubjectDocToTeacherAssignments(payload);
    let portalSync = null;
    if (collectionName === "users" && EDUZYNC_ADMIN_ROLES.includes(req.user?.role)) {
      await linkExistingEduTrackTeacherDocument(docId, payload);
      portalSync = await syncEduTrackUserAccountToPortal(
        await storedEduTrackUserForPortalSync(docId, payload),
      );
    }
    res.json({ success: true, id: docId, portalSync });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/edutrack/compat/:collection/:id", eduzyncAdminOnly, async (req, res) => {
  try {
    await ensureContentTables();
    const collectionName = safePathSegment(req.params.collection).replace(/\//g, "-");
    if (collectionName === "users") {
      const targetId = String(req.params.id);
      const [targetRows] = await db.query(
        "SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1",
        [targetId],
      );
      const result = await deleteEduTrackTeacherAccount(targetId, req.user?.id);
      await recordAccountAudit(req, "account_deleted", {
        id: targetId,
        email: targetRows[0]?.email,
        name: targetRows[0]?.name,
        role: targetRows[0]?.role,
      });
      await accountsDb
        .query("DELETE FROM edutrack_account_registry WHERE user_id = ?", [targetId])
        .catch(() => null);
      return res.json({ success: true, ...result });
    }
    const idColumn = await getEduTrackDocumentIdColumn();
    await db.query(`DELETE FROM edutrack_documents WHERE collection_name = ? AND ${idColumn} = ?`, [
      collectionName,
      String(req.params.id),
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
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
        "SELECT COUNT(*) AS total FROM users WHERE role IN ('website_admin', 'eduzync_admin', 'master_edutrack_admin', 'superadmin', 'masteradmin')",
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
  "/api/password-reset/request",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: "password-reset-request" }),
  async (req, res) => {
    if (!PASSWORD_RESET_ENABLED) {
      return res.status(404).json({ error: "Password recovery is not available." });
    }

    const accountEmail = normalizeEmail(req.body?.email);

    try {
      await ensureContentTables();
      await db.query(
        "DELETE FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at <= UTC_TIMESTAMP()",
      );

      if (isValidEmail(accountEmail)) {
        const [[user]] = await db.query(
          `
            SELECT
              u.id,
              u.name,
              u.email,
              COALESCE(
                NULLIF(u.recovery_email, ''),
                NULLIF(t.email, '')
              ) AS recovery_email,
              u.role,
              u.status
            FROM users u
            LEFT JOIN teachers t
              ON t.account_user_id = u.id OR t.account_email = u.email
            WHERE u.email = ?
            ORDER BY
              CASE WHEN u.recovery_email IS NOT NULL AND u.recovery_email <> '' THEN 0 ELSE 1 END,
              CASE WHEN t.email IS NOT NULL AND t.email <> '' THEN 0 ELSE 1 END
            LIMIT 1
          `,
          [accountEmail],
        );
        const recoveryEmail = normalizeEmail(user?.recovery_email);
        const canReset =
          user?.role === ROLES.teacher &&
          String(user?.status || "").toLowerCase() === "active" &&
          isValidEmail(recoveryEmail) &&
          recoveryEmail !== accountEmail;

        if (canReset) {
          const token = crypto.randomBytes(32).toString("base64url");
          const tokenHash = passwordResetTokenHash(token);
          const expiresAt = mysqlDateTime(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

          await db.query(
            "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL",
            [user.id],
          );
          await db.query(
            "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
            [user.id, tokenHash, expiresAt],
          );

          try {
            await sendTeacherPasswordResetEmail(user, recoveryEmail, token);
          } catch (error) {
            await db.query("DELETE FROM password_reset_tokens WHERE token_hash = ?", [tokenHash]);
            throw error;
          }
        }
      }
    } catch (error) {
      console.error(`[password-reset] Could not process reset request: ${error.message}`);
    }

    res.json({ success: true, message: PASSWORD_RESET_RESPONSE });
  },
);

app.post(
  "/api/password-reset/confirm",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "password-reset-confirm" }),
  async (req, res) => {
    if (!PASSWORD_RESET_ENABLED) {
      return res.status(404).json({ error: "Password recovery is not available." });
    }

    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
      return res.status(400).json({ error: "This password reset link is invalid or expired." });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: "Password must be between 8 and 128 characters." });
    }

    await ensureAccessTables();
    const passwordHash = await bcrypt.hash(password, 12);
    const tokenHash = passwordResetTokenHash(token);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      const [[resetRequest]] = await connection.query(
        `
          SELECT prt.id, prt.user_id, u.role, u.status
          FROM password_reset_tokens prt
          INNER JOIN users u ON u.id = prt.user_id
          WHERE prt.token_hash = ?
            AND prt.used_at IS NULL
            AND prt.expires_at > UTC_TIMESTAMP()
          LIMIT 1
          FOR UPDATE
        `,
        [tokenHash],
      );

      if (
        !resetRequest ||
        resetRequest.role !== ROLES.teacher ||
        String(resetRequest.status || "").toLowerCase() !== "active"
      ) {
        await connection.rollback();
        return res.status(400).json({ error: "This password reset link is invalid or expired." });
      }

      await connection.query("UPDATE users SET password_hash = ? WHERE id = ?", [
        passwordHash,
        resetRequest.user_id,
      ]);
      await connection.query(
        "UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL",
        [resetRequest.user_id],
      );
      await connection.commit();
      const [[updatedUser]] = await db.query(
        "SELECT id, external_staff_id, name, email, role, status FROM users WHERE id = ? LIMIT 1",
        [resetRequest.user_id],
      );
      if (updatedUser) {
        await syncPortalUserAccountToEduTrack(updatedUser, { password });
      }

      clearAuthCookie(res);
      clearCsrfCookie(res);
      return res.json({
        success: true,
        message: "Your password has been reset. You can now sign in.",
      });
    } catch (error) {
      await connection.rollback();
      return res.status(500).json({ error: "Could not reset the password. Please try again." });
    } finally {
      connection.release();
    }
  },
);

app.post(
  "/api/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "login" }),
  async (req, res) => {
    try {
      await ensureAccessTables();
      const { email, nic, identifier, password } = req.body || {};
      const rawIdentifier = String(nic || identifier || email || "").trim();
      const nicNumber = normalizeNicNumber(rawIdentifier);
      const accountEmail = nicNumber ? "" : normalizeEmail(rawIdentifier);
      const accountPassword = String(password || "");

      if (!nicNumber && accountEmail && String(process.env.LOGIN_REQUIRE_NIC || "") === "1") {
        return res
          .status(400)
          .json({ error: "Please sign in with your NIC number instead of your email." });
      }

      let user = null;
      if (nicNumber) {
        const [users] = await db.query("SELECT * FROM users WHERE nic_number = ? LIMIT 1", [
          nicNumber,
        ]);
        user = users[0] || null;
      } else if (accountEmail) {
        const [users] = await db.query("SELECT * FROM users WHERE email = ?", [accountEmail]);
        user = users[0] || null;
      }

      if (user && String(user.status || "").toLowerCase() !== "active") {
        return res.status(403).json({ error: "This account is not active." });
      }

      let validPassword = user
        ? await bcrypt.compare(accountPassword, user.password_hash || "")
        : false;

      if (!validPassword && accountEmail) {
        const eduTrackUser = await portalLoginUserFromEduTrack(accountEmail, accountPassword, user);
        if (eduTrackUser) {
          user = eduTrackUser;
          validPassword = true;
        }
      }

      if (!user || !validPassword) {
        return res.status(401).json({ error: "Invalid NIC number or password" });
      }

      if (String(user.status || "").toLowerCase() !== "active") {
        return res.status(403).json({ error: "This account is not active." });
      }

      if (twoFactorEnabledForUser(user)) {
        return res.json({
          success: true,
          requiresTwoFactor: true,
          twoFactorToken: createTwoFactorChallengeToken(user),
          user: {
            email: user.email,
          },
        });
      }

      const token = createToken(user);
      setAuthCookie(res, token);
      setCsrfCookie(res);

      res.json({
        success: true,
        token,
        user: publicUserPayload(user),
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
      });
    }
  },
);

app.post(
  "/api/login/2fa",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "login-2fa" }),
  async (req, res) => {
    try {
      await ensureAccessTables();
      const { twoFactorToken, code } = req.body || {};
      let challenge;
      try {
        challenge = verifyTwoFactorChallengeToken(twoFactorToken);
      } catch {
        return res.status(401).json({ error: "Two-factor login expired. Sign in again." });
      }

      const [users] = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [challenge.id]);
      const user = users[0];
      if (!user || String(user.status || "").toLowerCase() !== "active") {
        return res.status(401).json({ error: "Invalid two-factor login." });
      }

      if (!(await verifyUserTotpAndRecord(user, code))) {
        return res.status(401).json({ error: "Invalid authentication code." });
      }

      const token = createToken(user);
      setAuthCookie(res, token);
      setCsrfCookie(res);

      res.json({
        success: true,
        token,
        user: publicUserPayload(user),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.post("/api/logout", (req, res) => {
  clearAuthCookie(res);
  clearCsrfCookie(res);
  res.json({ success: true });
});

async function findOrCreateEduTrackSsoUser(payload) {
  await ensureAccessTables();

  let requestedId = compactText(payload.id, 50);
  const email = normalizeEmail(payload.email);
  const name = compactText(payload.name || email.split("@")[0], 150);

  if (!requestedId || !email || !name || !EDUTRACK_SSO_ROLES.has(payload.role)) {
    throw new Error("Invalid EduTrack SSO user");
  }

  const findUserByEmail = async () => {
    const [[user]] = await db.query(
      "SELECT id, external_staff_id, name, email, role, status, password_hash FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    return user || null;
  };
  const findUserById = async () => {
    const [[user]] = await db.query(
      "SELECT id, external_staff_id, name, email, role, status, password_hash FROM users WHERE id = ? LIMIT 1",
      [requestedId],
    );
    return user || null;
  };
  const refreshSsoUser = async (user) => {
    if (!user) return null;
    await db.query(
      "UPDATE users SET name = ?, email = ?, role = ?, status = 'Active' WHERE id = ?",
      [name, email, payload.role, user.id],
    );
    const [[freshUser]] = await db.query(
      "SELECT id, external_staff_id, name, email, role, status, password_hash FROM users WHERE id = ? LIMIT 1",
      [user.id],
    );
    return freshUser || user;
  };
  const attachExistingTeacherAccount = async (user) => {
    if (payload.role !== ROLES.teacher || user?.role !== ROLES.teacher) {
      return user;
    }

    try {
      const [teacherRows] = await db.query(
        `
          SELECT id
          FROM teachers
          WHERE account_user_id = ? OR account_email = ? OR email = ?
          ORDER BY (account_user_id = ?) DESC, (account_email = ?) DESC, id
          LIMIT 1
        `,
        [user.id, email, email, user.id, email],
      );

      if (!teacherRows.length) return user;

      await db.query(
        `
          UPDATE teachers
          SET account_user_id = ?, account_email = COALESCE(NULLIF(account_email, ''), ?)
          WHERE id = ?
        `,
        [user.id, email, teacherRows[0].id],
      );

      const [[linkedUser]] = await db.query(
        "SELECT id, external_staff_id, name, email, role, status, password_hash FROM users WHERE id = ? LIMIT 1",
        [user.id],
      );
      return linkedUser || user;
    } catch {
      return user;
    }
  };

  let user = await findUserByEmail();
  if (user) return attachExistingTeacherAccount(await refreshSsoUser(user));

  const idOwner = await findUserById();
  if (idOwner) {
    requestedId = `SSO-${crypto.createHash("sha256").update(email).digest("hex").slice(0, 40)}`;
    user = await findUserById();
    if (user) return attachExistingTeacherAccount(await refreshSsoUser(user));
  }

  const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString("hex"), 12);
  try {
    await db.query(
      `
        INSERT INTO users (id, external_staff_id, name, email, role, status, password_hash)
        VALUES (?, NULL, ?, ?, ?, 'Active', ?)
      `,
      [requestedId, name, email, payload.role, passwordHash],
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_ENTRY") throw error;
  }

  user = (await findUserByEmail()) || (await findUserById());
  if (!user) throw new Error("Could not create the EduTrack SSO account");
  return attachExistingTeacherAccount(user);
}

app.get("/api/edutrack/sso/complete", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Referrer-Policy", "no-referrer");

  if (process.env.APP_NAME !== "edutrack") {
    return res.status(404).json({ error: "EduTrack SSO is not available on this application" });
  }

  try {
    const payload = verifyEduTrackSsoToken(String(req.query.token || ""), eduTrackSsoSecret());
    const user = await findOrCreateEduTrackSsoUser(payload);

    if (String(user.status || "").toLowerCase() !== "active") {
      return res.status(403).type("text").send("This EduTrack account is not active.");
    }
    if (!EDUTRACK_SSO_ROLES.has(user.role)) {
      return res.status(403).type("text").send("EduTrack access is not enabled for this account.");
    }

    setAuthCookie(res, createToken(user));
    setCsrfCookie(res);
    return res.redirect(302, payload.returnPath);
  } catch {
    return res.status(401).type("text").send("EduTrack sign-in link is invalid or expired.");
  }
});

app.get("/api/me", auth, async (req, res) => {
  try {
    await ensureAccessTables();
    const [users] = await db.query(
      "SELECT id, name, email, role, status, two_factor_enabled, two_factor_secret FROM users WHERE id = ?",
      [req.user.id],
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json(publicUserPayload(users[0]));
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/api/me/security", auth, async (req, res) => {
  try {
    await ensureAccessTables();
    const [[user]] = await db.query(
      "SELECT id, name, email, role, status, two_factor_enabled, two_factor_secret FROM users WHERE id = ? LIMIT 1",
      [req.user.id],
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ twoFactorEnabled: twoFactorEnabledForUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/me/2fa/setup", auth, async (req, res) => {
  try {
    await ensureAccessTables();
    const [[user]] = await db.query(
      "SELECT id, name, email, role, status, two_factor_enabled, two_factor_secret FROM users WHERE id = ? LIMIT 1",
      [req.user.id],
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    const secret = generateTwoFactorSecret();
    await db.query("UPDATE users SET two_factor_pending_secret = ? WHERE id = ?", [
      secret,
      req.user.id,
    ]);

    res.json({
      success: true,
      secret,
      otpauthUrl: twoFactorOtpAuthUrl(user, secret),
      twoFactorEnabled: twoFactorEnabledForUser(user),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/me/2fa/confirm", auth, async (req, res) => {
  try {
    await ensureAccessTables();
    const [[user]] = await db.query(
      "SELECT id, two_factor_pending_secret FROM users WHERE id = ? LIMIT 1",
      [req.user.id],
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    const pendingSecret = user.two_factor_pending_secret;
    if (!pendingSecret) {
      return res.status(400).json({ error: "Start two-factor setup before confirming." });
    }
    if (verifyTotpCode(pendingSecret, req.body?.code) == null) {
      return res.status(400).json({ error: "Invalid authentication code." });
    }

    await db.query(
      `
        UPDATE users
        SET two_factor_enabled = 1,
            two_factor_secret = ?,
            two_factor_pending_secret = NULL,
            two_factor_confirmed_at = CURRENT_TIMESTAMP,
            two_factor_last_used_step = NULL
        WHERE id = ?
      `,
      [pendingSecret, req.user.id],
    );

    res.json({ success: true, twoFactorEnabled: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/me/2fa/disable", auth, async (req, res) => {
  try {
    await ensureAccessTables();
    const [[user]] = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [req.user.id]);
    if (!user) return res.status(404).json({ error: "User not found" });

    const validPassword = await bcrypt.compare(
      String(req.body?.password || ""),
      user.password_hash,
    );
    if (!validPassword) {
      return res.status(401).json({ error: "Password is incorrect." });
    }
    if (twoFactorEnabledForUser(user) && !(await verifyUserTotpAndRecord(user, req.body?.code))) {
      return res.status(401).json({ error: "Invalid authentication code." });
    }

    await db.query(
      `
        UPDATE users
        SET two_factor_enabled = 0,
            two_factor_secret = NULL,
            two_factor_pending_secret = NULL,
            two_factor_confirmed_at = NULL,
            two_factor_last_used_step = NULL
        WHERE id = ?
      `,
      [req.user.id],
    );

    res.json({ success: true, twoFactorEnabled: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function maintenancePageHtml(settings) {
  const message = escapeHtml(settings.message || DEFAULT_MAINTENANCE_MESSAGE);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Maintenance | Loyola College Negombo</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #eef3ff; color: #172033; }
      main { width: min(92vw, 560px); padding: 42px 28px; text-align: center; }
      .crest { width: 78px; height: 78px; border-radius: 999px; object-fit: contain; background: #fff; border: 1px solid #d8e1f5; padding: 8px; box-shadow: 0 14px 36px rgba(8, 40, 111, 0.12); }
      .eyebrow { margin: 26px 0 10px; color: #b70f1b; font-size: 12px; font-weight: 900; letter-spacing: 0.18em; text-transform: uppercase; }
      h1 { margin: 0; color: #08286f; font-family: Georgia, "Times New Roman", serif; font-size: clamp(34px, 7vw, 52px); line-height: 1.02; }
      p { margin: 18px auto 0; max-width: 46ch; color: #4b5870; font-size: 16px; line-height: 1.7; }
      .actions { margin-top: 30px; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
      a { display: inline-flex; min-height: 46px; align-items: center; justify-content: center; border-radius: 10px; padding: 0 18px; font-size: 14px; font-weight: 800; text-decoration: none; }
      .primary { background: #08286f; color: #fff; }
      .secondary { border: 1px solid #c8d4ec; background: #fff; color: #08286f; }
    </style>
  </head>
  <body>
    <main>
      <img class="crest" src="/loyola-crest.jpg" alt="" />
      <p class="eyebrow">Scheduled maintenance</p>
      <h1>We will be back soon.</h1>
      <p>${message}</p>
      <div class="actions">
        <a class="primary" href="/login?next=%2F">Admin login</a>
        <a class="secondary" href="/portal">Open portal</a>
      </div>
    </main>
  </body>
</html>`;
}

function isMaintenanceSystemPath(requestPath) {
  if (
    requestPath === "/login" ||
    requestPath === "/portal" ||
    requestPath === "/admin" ||
    requestPath.startsWith("/portal/")
  ) {
    return true;
  }

  if (requestPath.startsWith("/assets/")) return true;

  const assetExtensions = new Set([
    ".css",
    ".js",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
  ]);
  return assetExtensions.has(path.extname(requestPath).toLowerCase());
}

async function maintenancePageGate(req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (isMaintenanceSystemPath(req.path)) return next();

  try {
    const settings = await readMaintenanceSettingsForGate();
    if (!settings.enabled || canBypassMaintenance(req)) return next();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.status(503).type("html").send(maintenancePageHtml(settings));
  } catch (error) {
    return next(error);
  }
}

function resolveFrontendRoot() {
  const configured = String(process.env.FRONTEND_ROOT || "").trim();

  if (process.env.APP_NAME === "edutrack") {
    const standaloneEduTrackPublic = path.join(__dirname, "..", "edutrack", "public");
    const usesDefaultPublicRoot = !configured || configured === "public" || configured === "./public";

    if (usesDefaultPublicRoot && fs.existsSync(path.join(standaloneEduTrackPublic, "index.html"))) {
      return standaloneEduTrackPublic;
    }
  }

  return path.resolve(configured || path.join(__dirname, "..", "public"));
}

const frontendRoot = resolveFrontendRoot();
const frontendIndex = path.join(frontendRoot, "index.html");
const frontendAssets = path.join(frontendRoot, "assets");

if (fs.existsSync(frontendIndex)) {
  const eduTrackPublicUrl = resolveEduTrackPublicUrl();
  const sendFrontendApp = (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(frontendIndex);
  };

  app.use(maintenancePageGate);

  if (process.env.APP_NAME === "edutrack") {
    app.get("/", (req, res) => {
      res.redirect(302, "/portal/edutrack");
    });
  } else if (eduTrackPublicUrl) {
    app.get(["/portal/edutrack", "/portal/edutrack/"], async (req, res, next) => {
      const sessionUser = verifiedUserFromRequest(req);
      if (!sessionUser) {
        return res.redirect(302, "/login?next=%2Fportal%2Fedutrack");
      }
      if (!EDUTRACK_SSO_ROLES.has(sessionUser.role)) return next();

      try {
        await ensureAccessTables();
        const [[user]] = await db.query(
          `
            SELECT id, external_staff_id, name, email, role, status
            FROM users
            WHERE id = ?
            LIMIT 1
          `,
          [sessionUser.id],
        );
        if (!user || String(user.status || "").toLowerCase() !== "active") {
          clearAuthCookie(res);
          clearCsrfCookie(res);
          return res.redirect(302, "/login?next=%2Fportal%2Fedutrack");
        }
        if (!EDUTRACK_SSO_ROLES.has(user.role)) return next();

        const token = createEduTrackSsoToken(user, eduTrackSsoSecret(), req.originalUrl);
        const target = new URL("/api/edutrack/sso/complete", `${eduTrackPublicUrl}/`);
        target.searchParams.set("token", token);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Referrer-Policy", "no-referrer");
        return res.redirect(302, target.toString());
      } catch (error) {
        return next(error);
      }
    });
  }

  app.get(
    [
      ...(process.env.APP_NAME === "edutrack" ? [] : ["/"]),
      "/login",
      "/portal",
      "/admin",
      ...(process.env.APP_NAME === "edutrack" ? ["/portal/edutrack"] : []),
      "/portal/eduzync",
      "/portal/elms",
      "/portal/reports",
    ],
    sendFrontendApp,
  );

  if (process.env.APP_NAME === "edutrack") {
    app.get(["/edutrack", "/edutrack/"], (req, res) => {
      res.sendFile(path.join(frontendRoot, "edutrack", "index.html"));
    });
  }

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
    if (
      process.env.APP_NAME !== "edutrack" &&
      (req.path === "/edutrack" ||
        req.path.startsWith("/edutrack/") ||
        req.path === "/portal/edutrack" ||
        req.path === "/portal/edutrack/")
    ) {
      return res
        .status(404)
        .type("text/plain")
        .send("EduTrack runs as a separate application. Set EDUTRACK_PUBLIC_URL on the website backend.");
    }
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

if (process.env.APP_NAME === "edutrack") {
  backfillEduTrackTeacherAccountLinks()
    .then(() => ensureLegacyEduTrackTeacherCleanup())
    .then((result) => {
      if (!result.skipped) {
        console.log(
          `EduTrack legacy teacher cleanup removed ${result.removedTeacherUsers} users and ${result.removedTeacherRows} teacher rows.`,
        );
      }
    })
    .catch((error) => {
      console.error("EduTrack legacy teacher cleanup failed:", error.message);
    });
  scheduleEduTrackPortalAccountSyncMaintenance();
} else {
  scheduleEduTrackStaffSyncMaintenance();
}

app.listen(process.env.PORT || 5000, () => {
  console.log(`Backend running on http://localhost:${process.env.PORT || 5000}`);
});
