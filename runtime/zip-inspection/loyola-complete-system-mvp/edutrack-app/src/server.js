require("dotenv").config();
const express=require("express");const cors=require("cors");const cookieParser=require("cookie-parser");const path=require("path");const db=require("./config/db");
const app=express();const allowed=(process.env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean);
app.disable("x-powered-by");app.use(cors({origin(o,cb){if(!o||allowed.length===0||allowed.includes(o))return cb(null,true);cb(new Error("Origin not allowed"))},credentials:true}));app.use(cookieParser());app.use(express.json({limit:"10mb"}));app.use(express.static(path.join(__dirname,"..","public")));
app.use(require("./routes/health")({db}));app.use(require("./routes/auth")({db}));app.use(require("./routes/internalSync")({db}));app.use(require("./routes/syllabus")({db}));app.use(require("./routes/relief")({db}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"..","public","index.html")));
const port=Number(process.env.PORT||5002);app.listen(port,()=>console.log(`EduTrack running on port ${port}`));
