import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const raw = readFileSync(".env.local", "utf8");
const env = {};
raw.split("\n").forEach((line) => {
  const i = line.indexOf("=");
  if (i > 0) {
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
});

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
if (listError) {
  console.error("List error:", listError.message);
  process.exit(1);
}

const testUser = users.users.find((u) => u.email === "testuser.mcpguardian@gmail.com");
if (!testUser) {
  console.log(
    "Test user not found. Emails:",
    users.users.map((u) => u.email).join(", "),
  );
  process.exit(1);
}

console.log("Found:", testUser.id, testUser.email, "| confirmed:", !!testUser.email_confirmed_at);

if (testUser.email_confirmed_at) {
  console.log("Email already confirmed. Skipping.");
  process.exit(0);
}

const { data, error } = await supabaseAdmin.auth.admin.updateUserById(testUser.id, {
  email_confirmed_at: new Date().toISOString(),
});

if (error) {
  console.error("Confirm error:", error.message);
  process.exit(1);
}

console.log("Email confirmed for:", data.user.email);
