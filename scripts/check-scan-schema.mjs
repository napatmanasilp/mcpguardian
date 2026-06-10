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

// Try to select from scans to see what columns exist
const { data, error } = await sba.from("scans").select("*").limit(1);

if (error) {
  console.error("Error querying scans:", JSON.stringify(error, null, 2));
  // Try with a raw SQL query via the REST API
  console.log("\nTrying information_schema query...");
}

// Try to get column info using the Supabase REST API directly
const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/scans?select=*&limit=0`, {
  headers: {
    "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Accept": "application/json",
    "Prefer": "return=representation"
  }
});

console.log("Response status:", response.status);
const responseHeaders = Object.fromEntries(response.headers.entries());
console.log("Response headers:", JSON.stringify(responseHeaders, null, 2));

if (response.ok) {
  const result = await response.json();
  console.log("Sample row:", JSON.stringify(result[0] || null, null, 2));
  console.log("Row count:", result.length);
  if (result.length > 0) {
    console.log("Columns:", Object.keys(result[0]).join(", "));
  }
} else {
  const text = await response.text();
  console.log("Error body:", text);
}
