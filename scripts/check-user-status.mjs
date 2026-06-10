import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const raw = readFileSync(".env.local", "utf8");
const env = {};
raw.split("\n").forEach((line) => {
  const i = line.indexOf("=");
  if (i > 0) {
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
    env[k] = v;
  }
});

const sba = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sba.auth.admin.listUsers();
if (error) { console.error("List error:", error.message); process.exit(1); }

const u = data.users.find((x) => x.email === "testuser.mcpguardian@gmail.com");
if (!u) { console.log("User not found in auth.users"); process.exit(1); }

console.log("ID:", u.id);
console.log("Email:", u.email);
console.log("confirmed_at:", u.email_confirmed_at);
console.log("last_sign_in:", u.last_sign_in_at);
console.log("created_at:", u.created_at);
console.log("Raw confirmed_at value:", JSON.stringify(u.email_confirmed_at));
