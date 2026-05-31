require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const db = require("./config/db");

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean);

app.disable("x-powered-by");
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Origin not allowed"));
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(require("./routes/health")({ db }));
app.use(require("./routes/auth")({ db }));
app.use(require("./routes/users")({ db }));
app.use(require("./routes/staff")({ db }));
app.use(require("./routes/uploads")({ db }));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Loyola main app running on port ${port}`));
