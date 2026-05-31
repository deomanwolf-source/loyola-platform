const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { makeId } = require("../utils/id");

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }

module.exports = function uploadRoutes({ db }) {
  const router = express.Router();
  const uploadRoot = path.resolve(process.env.UPLOAD_ROOT || "uploads");
  const originalDir = path.join(uploadRoot, "original");
  const optimizedDir = path.join(uploadRoot, "optimized");
  const thumbDir = path.join(uploadRoot, "thumbs");

  [originalDir, optimizedDir, thumbDir].forEach(ensure);

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, originalDir),
      filename: (req, file, cb) => {
        const safe = String(file.originalname || "file").replace(/[^a-z0-9._-]/gi, "-");
        cb(null, `${Date.now()}-${safe}`);
      }
    }),
    limits: { fileSize: 80 * 1024 * 1024 }
  });

  router.post("/api/uploads", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const sourceId = makeId("MEDIA");
    let optimizedUrl = null;
    let thumbnailUrl = null;
    const mime = req.file.mimetype || "";

    if (mime.startsWith("image/")) {
      const optName = `${sourceId}.webp`;
      const thumbName = `${sourceId}-thumb.webp`;
      await sharp(req.file.path).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 90 }).toFile(path.join(optimizedDir, optName));
      await sharp(req.file.path).rotate().resize({ width: 400, height: 400, fit: "cover", withoutEnlargement: true }).webp({ quality: 85 }).toFile(path.join(thumbDir, thumbName));
      optimizedUrl = `/uploads/optimized/${optName}`;
      thumbnailUrl = `/uploads/thumbs/${thumbName}`;
    }

    const originalUrl = `/uploads/original/${req.file.filename}`;
    await db.query(`
      INSERT INTO media_files (source_id, original_url, optimized_url, thumbnail_url, file_name, original_name, file_type, file_size, folder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [sourceId, originalUrl, optimizedUrl, thumbnailUrl, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, req.body.folder || "general"]);

    res.json({ success: true, sourceId, originalUrl, optimizedUrl, thumbnailUrl });
  });

  router.use("/uploads", express.static(uploadRoot, { maxAge: "7d" }));
  return router;
};
