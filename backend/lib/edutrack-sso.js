const jwt = require("jsonwebtoken");

const EDUTRACK_SSO_PURPOSE = "edutrack_sso";
const DEFAULT_EDUTRACK_PUBLIC_URL = "https://edutrack.loyolacollege.lk";
const EDUTRACK_SSO_ROLES = new Set([
  "masteradmin",
  "superadmin",
  "master_edutrack_admin",
  "eduzync_admin",
  "academic_coordinator",
  "viewadmin",
  "teacher",
]);

function resolveEduTrackPublicUrl(env = process.env) {
  if (env.APP_NAME === "edutrack") return "";

  const configured = String(env.EDUTRACK_PUBLIC_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");

  return env.NODE_ENV === "production" ? DEFAULT_EDUTRACK_PUBLIC_URL : "";
}

function sanitizeEduTrackReturnPath(value) {
  try {
    const url = new URL(String(value || "/portal/edutrack"), "https://loyolacollege.lk");
    if (url.pathname !== "/portal/edutrack" && url.pathname !== "/portal/edutrack/") {
      return "/portal/edutrack";
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return "/portal/edutrack";
  }
}

function createEduTrackSsoToken(user, secret, returnPath) {
  if (!secret) throw new Error("JWT_SECRET is required for EduTrack SSO");

  return jwt.sign(
    {
      id: String(user.id || ""),
      email: String(user.email || "")
        .trim()
        .toLowerCase(),
      name: String(user.name || "").trim(),
      role: String(user.role || ""),
      purpose: EDUTRACK_SSO_PURPOSE,
      returnPath: sanitizeEduTrackReturnPath(returnPath),
    },
    secret,
    { expiresIn: "60s" },
  );
}

function verifyEduTrackSsoToken(token, secret) {
  if (!secret) throw new Error("JWT_SECRET is required for EduTrack SSO");

  const payload = jwt.verify(token, secret);
  if (payload?.purpose !== EDUTRACK_SSO_PURPOSE) {
    throw new Error("Invalid EduTrack SSO token");
  }
  if (!EDUTRACK_SSO_ROLES.has(payload.role)) {
    throw new Error("EduTrack access is not enabled for this role");
  }

  return {
    ...payload,
    returnPath: sanitizeEduTrackReturnPath(payload.returnPath),
  };
}

module.exports = {
  EDUTRACK_SSO_ROLES,
  createEduTrackSsoToken,
  resolveEduTrackPublicUrl,
  sanitizeEduTrackReturnPath,
  verifyEduTrackSsoToken,
};
