const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer || req.cookies?.auth_token;
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || (!roles.includes(req.user.role) && req.user.role !== "masteradmin")) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
}

module.exports = { auth, requireRole };
