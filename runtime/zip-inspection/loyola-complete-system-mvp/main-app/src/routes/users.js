const express = require("express");
const bcrypt = require("bcryptjs");
const { auth, requireRole } = require("../middleware/auth");
const { makeId } = require("../utils/id");

module.exports = function userRoutes({ db }) {
  const router = express.Router();

  router.get("/api/users", auth, requireRole("masteradmin", "superadmin", "users_admin"), async (req, res) => {
    const [rows] = await db.query("SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC");
    res.json(rows);
  });

  router.post("/api/users", auth, requireRole("masteradmin", "superadmin", "users_admin"), async (req, res) => {
    const { name, email, password, role = "teacher", status = "Active" } = req.body || {};
    if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: "Name, email, and password 8+ chars required" });
    const id = makeId("USR");
    const hash = await bcrypt.hash(password, 12);
    await db.query("INSERT INTO users (id, name, email, role, status, password_hash) VALUES (?, ?, ?, ?, ?, ?)", [id, name, email, role, status, hash]);
    res.json({ success: true, id });
  });

  router.put("/api/users/:id", auth, requireRole("masteradmin", "superadmin", "users_admin"), async (req, res) => {
    const { name, role, status } = req.body || {};
    await db.query("UPDATE users SET name=COALESCE(?, name), role=COALESCE(?, role), status=COALESCE(?, status) WHERE id=?", [name || null, role || null, status || null, req.params.id]);
    res.json({ success: true });
  });

  return router;
};
