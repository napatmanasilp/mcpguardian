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

// Use the Supabase REST API with raw SQL query capabilities
// First, try using the /rest/v1/rpc/ endpoint or a direct query

// More robust approach: use POST to the query endpoint
const sqlQuery = `
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'scans'
ORDER BY ordinal_position;
`;

const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/`, {
  method: "POST",
  headers: {
    "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  body: JSON.stringify({ query: sqlQuery })
});

console.log("SQL query status:", response.status);
const text = await response.text();
console.log("Response:", text.substring(0, 2000));

// Try alternative: use the table with a limit of 0 with Prefer: headers=only
const response2 = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/scans?limit=0`, {
  method: "GET",
  headers: {
    "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Prefer": "return=representation,headers=only"
  }
});

console.log("\nHeaders-only status:", response2.status);
console.log("Headers:", JSON.stringify(Object.fromEntries(response2.headers.entries()), null, 2));
