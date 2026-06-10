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

console.log("URL:", env.NEXT_PUBLIC_SUPABASE_URL ? "found" : "missing");
console.log("Key length:", env.SUPABASE_SERVICE_ROLE_KEY ? env.SUPABASE_SERVICE_ROLE_KEY.length : "missing");

const sba = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// First find the user
const { data: users, error: listError } = await sba.auth.admin.listUsers();
if (listError) { console.error("List error:", listError.message, JSON.stringify(listError)); process.exit(1); }

const u = users.users.find((x) => x.email === "testuser.mcpguardian@gmail.com");
if (!u) { console.log("User not found. Emails:", users.users.map(x => x.email).join(", ")); process.exit(1); }

console.log("Found user:", u.id);
console.log("Before - confirmed_at:", u.email_confirmed_at);

// Now try to update
const now = new Date().toISOString();
console.log("Setting confirmed_at to:", now);

const { data, error } = await sba.auth.admin.updateUserById(u.id, {
  email_confirmed_at: now,
});

if (error) {
  console.error("Update error:", error.message, JSON.stringify(error));
  process.exit(1);
}

console.log("After update - confirmed_at:", data.user.email_confirmed_at);
console.log("Success:", data.user.email_confirmed_at === now ? "YES - matches" : "NO - different value");
