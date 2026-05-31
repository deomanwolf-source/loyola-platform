const express = require("express");

module.exports = function healthRoutes({ db }) {
  const router = express.Router();
  router.get("/api/health", async (req, res) => {
    try {
      const [rows] = await db.query("SELECT 1 AS ok");
      res.json({ status: "ok", app: "main", database: rows[0].ok === 1 });
    } catch (error) {
      res.status(500).json({ status: "error", app: "main", message: error.message });
    }
  });
  return router;
};
