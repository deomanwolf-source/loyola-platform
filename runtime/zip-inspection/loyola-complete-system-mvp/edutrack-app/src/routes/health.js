const express = require("express");
module.exports=function({db}){const r=express.Router();r.get("/api/health",async(req,res)=>{try{const [rows]=await db.query("SELECT 1 AS ok");res.json({status:"ok",app:"edutrack",database:rows[0].ok===1,dbName:process.env.DB_NAME})}catch(e){res.status(500).json({status:"error",message:e.message})}});return r};
