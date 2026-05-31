const express = require("express");
const { auth, requireRole } = require("../middleware/auth");

async function syncToEduTrack(staff, db) {
  const base = process.env.EDUTRACK_INTERNAL_BASE_URL;
  const secret = process.env.EDUTRACK_SYNC_SECRET;
  if (!base || !secret) return { skipped: true, reason: "sync env missing" };

  const payload = {
    staffId: staff.staff_id,
    name: staff.full_name,
    email: staff.email,
    role: "teacher",
    status: staff.status,
    position: staff.position || "",
    department: staff.department || "",
    subject: staff.subject || "",
    classes: staff.classes || "",
    photoUrl: staff.photo_url || ""
  };

  try {
    const response = await fetch(`${base}/api/internal/sync-teacher-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-edutrack-sync-secret": secret
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`EduTrack sync failed: ${response.status}`);
    const data = await response.json();
    await db.query("UPDATE staff_profiles SET edutrack_sync_status='synced', edutrack_sync_error=NULL, edutrack_teacher_id=? WHERE staff_id=?", [data.edutrack_teacher_id || null, staff.staff_id]);
    return { success: true, data };
  } catch (error) {
    await db.query("UPDATE staff_profiles SET edutrack_sync_status='failed', edutrack_sync_error=? WHERE staff_id=?", [error.message, staff.staff_id]);
    await db.query("INSERT INTO staff_sync_outbox (staff_profile_id, payload, status, error) SELECT id, ?, 'failed', ? FROM staff_profiles WHERE staff_id=?", [JSON.stringify(payload), error.message, staff.staff_id]);
    return { warning: true, error: error.message };
  }
}

module.exports = function staffRoutes({ db }) {
  const router = express.Router();

  router.get("/api/staff", async (req, res) => {
    const [rows] = await db.query(`
      SELECT sp.*, GROUP_CONCAT(stp.position ORDER BY stp.is_primary DESC SEPARATOR ', ') AS positions
      FROM staff_profiles sp
      LEFT JOIN staff_positions stp ON stp.staff_profile_id = sp.id
      GROUP BY sp.id
      ORDER BY sp.full_name
    `);
    res.json(rows);
  });

  router.post("/api/staff", auth, requireRole("masteradmin", "superadmin", "staff_admin"), async (req, res) => {
    const { staff_id, full_name, email, phone, nic, staff_type = "Academic Staff", department = "", status = "Active", position = "Teacher", website_place = "Subject Teachers", subject = "", classes = "", sync_edutrack = false } = req.body || {};
    if (!staff_id || !full_name) return res.status(400).json({ error: "staff_id and full_name are required" });

    await db.query(`
      INSERT INTO staff_profiles (staff_id, full_name, email, phone, nic, staff_type, department, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        full_name=VALUES(full_name), email=VALUES(email), phone=VALUES(phone), nic=VALUES(nic),
        staff_type=VALUES(staff_type), department=VALUES(department), status=VALUES(status)
    `, [staff_id, full_name, email || null, phone || null, nic || null, staff_type, department, status]);

    const [[profile]] = await db.query("SELECT id FROM staff_profiles WHERE staff_id=?", [staff_id]);
    await db.query(`
      INSERT INTO staff_positions (staff_profile_id, department, position, website_place, subject, classes, is_primary, visible_on_website)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1)
      ON DUPLICATE KEY UPDATE position=VALUES(position)
    `, [profile.id, department, position, website_place, subject, classes]);

    let syncResult = null;
    if (sync_edutrack) {
      syncResult = await syncToEduTrack({ staff_id, full_name, email, status, position, department, subject, classes }, db);
    }

    res.json({ success: true, sync: syncResult });
  });

  return router;
};
