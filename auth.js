import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";
const {Pool}=pg;

const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}):null;
const plans={free:{seconds:900},pro:{seconds:18000},agency:{seconds:60000}};

export async function initDb(){
  if(!pool)return;
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',monthly_seconds INTEGER NOT NULL DEFAULT 0,
    month_key TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY,user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scenario TEXT NOT NULL,duration_seconds INTEGER NOT NULL DEFAULT 0,
    score INTEGER,transcript TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS sessions_user_created_idx ON sessions(user_id,created_at DESC);`);
}

function requireDb(){if(!pool)throw new Error("DATABASE_URL manquante");}
function monthKey(){return new Date().toISOString().slice(0,7);}
function sign(user){return jwt.sign({sub:user.id,email:user.email,plan:user.plan},process.env.JWT_SECRET,{expiresIn:"30d"});}
export function auth(req,res,next){
  try{
    const h=req.headers.authorization||"";
    const token=h.startsWith("Bearer ")?h.slice(7):"";
    if(!token)throw new Error("Connexion requise");
    req.user=jwt.verify(token,process.env.JWT_SECRET);
    next();
  }catch{res.status(401).json({error:"Connexion requise."});}
}
export async function register(email,password){
  requireDb();email=email.trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email))throw new Error("Email invalide.");
  if(password.length<8)throw new Error("Mot de passe : 8 caractères minimum.");
  const exists=await pool.query("SELECT id FROM users WHERE email=$1",[email]);
  if(exists.rowCount)throw new Error("Cet email est déjà utilisé.");
  const user={id:crypto.randomUUID(),email,plan:"free"};
  const hash=await bcrypt.hash(password,12);
  await pool.query("INSERT INTO users(id,email,password_hash,plan,month_key) VALUES($1,$2,$3,$4,$5)",[user.id,email,hash,user.plan,monthKey()]);
  return {token:sign(user),user};
}
export async function login(email,password){
  requireDb();const q=await pool.query("SELECT * FROM users WHERE email=$1",[email.trim().toLowerCase()]);
  if(!q.rowCount||!(await bcrypt.compare(password,q.rows[0].password_hash)))throw new Error("Email ou mot de passe incorrect.");
  const u=q.rows[0];return {token:sign(u),user:{id:u.id,email:u.email,plan:u.plan}};
}
export async function canStart(id){
  requireDb();
  const q=await pool.query("SELECT plan,monthly_seconds,month_key FROM users WHERE id=$1",[id]);
  if(!q.rowCount)throw new Error("Compte introuvable.");
  const u=q.rows[0],key=monthKey(),used=u.month_key===key?u.monthly_seconds:0,limit=plans[u.plan]?.seconds??plans.free.seconds;
  if(used>=limit)throw new Error("Quota mensuel atteint. Passe au plan supérieur.");
  return {plan:u.plan,used,limit,remaining:limit-used};
}
export async function me(id){
  requireDb();const q=await pool.query("SELECT id,email,plan,monthly_seconds,month_key FROM users WHERE id=$1",[id]);
  if(!q.rowCount)throw new Error("Compte introuvable.");
  const u=q.rows[0],key=monthKey();
  if(u.month_key!==key){await pool.query("UPDATE users SET month_key=$1,monthly_seconds=0 WHERE id=$2",[key,id]);u.monthly_seconds=0;}
  const h=await pool.query("SELECT scenario,duration_seconds,score,created_at FROM sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20",[id]);
  const count=await pool.query("SELECT COUNT(*)::int AS n FROM sessions WHERE user_id=$1",[id]);
  return {user:{email:u.email,plan:u.plan,monthly_seconds:u.monthly_seconds,sessions:count.rows[0].n,limit_seconds:plans[u.plan]?.seconds??plans.free.seconds},history:h.rows};
}
export async function saveSession(id,{scenario,duration_seconds,score,transcript}){
  requireDb();const u=await pool.query("SELECT plan,monthly_seconds,month_key FROM users WHERE id=$1",[id]);
  if(!u.rowCount)throw new Error("Compte introuvable.");
  const row=u.rows[0],key=monthKey(),used=row.month_key===key?row.monthly_seconds:0,limit=plans[row.plan]?.seconds??plans.free.seconds;
  const seconds=Math.max(0,Math.min(3600,Number(duration_seconds)||0));
  if(used+seconds>limit)throw new Error("Quota mensuel atteint. Passe au plan supérieur.");
  if(row.month_key!==key)await pool.query("UPDATE users SET month_key=$1,monthly_seconds=0 WHERE id=$2",[key,id]);
  await pool.query("INSERT INTO sessions(id,user_id,scenario,duration_seconds,score,transcript) VALUES($1,$2,$3,$4,$5,$6)",[crypto.randomUUID(),id,String(scenario||"custom").slice(0,80),seconds,score==null?null:Math.max(0,Math.min(100,Number(score))),String(transcript||"").slice(0,30000)]);
  await pool.query("UPDATE users SET monthly_seconds=monthly_seconds+$1 WHERE id=$2",[seconds,id]);
  return me(id);
}

export async function setPlan(id,plan){requireDb();if(!["free","pro","agency"].includes(plan))throw new Error("Plan invalide.");await pool.query("UPDATE users SET plan=$1 WHERE id=$2",[plan,id]);return me(id);}
