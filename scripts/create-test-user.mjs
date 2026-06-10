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

// First try to delete existing test user
const { data: users } = await sba.auth.admin.listUsers();
const existing = users.users.find((x) => x.email === "testaudit@mcpaudit.dev");
if (existing) {
  console.log("Deleting existing user:", existing.id);
  await sba.auth.admin.deleteUser(existing.id);
}

// Create a new pre-confirmed user
const { data, error } = await sba.auth.admin.createUser({
  email: "testaudit@mcpaudit.dev",
  password: "TestPassword123!",
  email_confirm: true,
});

if (error) {
  console.error("Create error:", error.message, JSON.stringify(error));
  process.exit(1);
}

console.log("Created user:", data.user.id, data.user.email);
console.log("confirmed_at:", data.user.email_confirmed_at);
console.log("Success:", !!data.user.email_confirmed_at ? "YES" : "NO");
