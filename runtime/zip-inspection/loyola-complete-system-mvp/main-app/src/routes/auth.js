const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { auth } = require("../middleware/auth");
const { makeId } = require("../utils/id");

module.exports = function authRoutes({ db }) {
  const router = express.Router();

  router.post("/api/setup-masteradmin", async (req, res) => {
    const [existing] = await db.query("SELECT id FROM users WHERE role='masteradmin' LIMIT 1");
    if (existing.length) return res.status(409).json({ error: "Masteradmin already exists" });

    const { name, email, password } = req.body || {};
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({ error: "Name, email, and password 8+ chars required" });
    }

    const id = makeId("USR");
    const hash = await bcrypt.hash(password, 12);
    await db.query("INSERT INTO users (id, name, email, role, status, password_hash) VALUES (?, ?, ?, 'masteradmin', 'Active', ?)", [id, name, email, hash]);
    res.json({ success: true, id });
  });

  router.post("/api/login", async (req, res) => {
    const { email, password } = req.body || {};
    const [rows] = await db.query("SELECT * FROM users WHERE email=? AND status='Active' LIMIT 1", [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid login" });

    const ok = await bcrypt.compare(password || "", user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid login" });

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.cookie("auth_token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

  router.get("/api/me", auth, (req, res) => res.json({ user: req.user }));

  router.post("/api/logout", (req, res) => {
    res.clearCookie("auth_token");
    res.json({ success: true });
  });

  return router;
};
