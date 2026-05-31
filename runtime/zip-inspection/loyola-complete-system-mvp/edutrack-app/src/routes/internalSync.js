const express = require("express");
const bcrypt = require("bcryptjs");
const { makeId } = require("../utils/id");

module.exports = function internalSyncRoutes({ db }) {
  const router = express.Router();

  router.post("/api/internal/sync-teacher-account", async (req, res) => {
    const secret = req.headers["x-edutrack-sync-secret"];
    if (!secret || secret !== process.env.EDUTRACK_SYNC_SECRET) return res.status(401).json({ error: "Invalid sync secret" });

    const { staffId, teacherId, name, email, password, status = "Active", subject = "", classes = "", position = "", department = "", photoUrl = "" } = req.body || {};
    if (!staffId || !name || !email) return res.status(400).json({ error: "staffId, name, and email required" });

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [existing] = await conn.query("SELECT id FROM users WHERE external_staff_id=? OR email=? LIMIT 1", [staffId, email]);
      const userId = existing[0]?.id || makeId("EDUUSR");
      const hash = password ? await bcrypt.hash(password, 12) : await bcrypt.hash(`SetupRequired-${Date.now()}`, 12);

      if (existing.length) {
        await conn.query("UPDATE users SET external_staff_id=?, name=?, email=?, role='teacher', status=? WHERE id=?", [staffId, name, email, status, userId]);
      } else {
        await conn.query("INSERT INTO users (id, external_staff_id, name, email, role, status, password_hash) VALUES (?, ?, ?, ?, 'teacher', ?, ?)", [userId, staffId, name, email, status, hash]);
      }

      const effectiveTeacherId = teacherId || staffId;
      await conn.query(`
        INSERT INTO teachers (id, user_id, external_staff_id, name, email, position, department, subject, classes, photo_url, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), name=VALUES(name), email=VALUES(email), position=VALUES(position), department=VALUES(department), subject=VALUES(subject), classes=VALUES(classes), photo_url=VALUES(photo_url), status=VALUES(status)
      `, [effectiveTeacherId, userId, staffId, name, email, position, department, subject, classes, photoUrl, status]);

      await conn.commit();
      res.json({ success: true, edutrack_user_id: userId, edutrack_teacher_id: effectiveTeacherId });
    } catch (e) {
      await conn.rollback();
      res.status(500).json({ error: e.message });
    } finally {
      conn.release();
    }
  });

  return router;
};
