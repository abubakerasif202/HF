// Starts the mock Supabase and the REAL, unmodified app against it (production build + `next start`).
//   node audit/admin-visual/run-app.mjs            # build if needed, then serve on :3200
//   node audit/admin-visual/run-app.mjs --rebuild  # force a fresh `next build`
// The production build is used (not `next dev`) because it is what ships and it avoids dev overlays in screenshots.
// NEXT_PUBLIC_* values are inlined at build time, so the build MUST run with the mock env — it does.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startMockSupabase } from "./mock-supabase.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const MOCK_PORT = Number(process.env.MOCK_PORT ?? 54399);
const APP_PORT = Number(process.env.APP_PORT ?? 3200);
const nextBin = path.join(repo, "node_modules", "next", "dist", "bin", "next");

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "mock-service-role-key", // not a real key; only the mock server ever sees it
  RATE_LIMIT_SECRET: "mock",
  NEXT_TELEMETRY_DISABLED: "1",
};
// Make sure nothing pointing at real services leaks in from the parent shell.
for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY", "GOOGLE_REFRESH_TOKEN", "GOOGLE_CLIENT_SECRET", "CRON_SECRET"]) delete env[key];

function run(args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, ...args], { cwd: repo, env, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${label} exited with ${code}`))));
  });
}

await startMockSupabase(MOCK_PORT);
console.log(`[run-app] mock supabase (SYNTHETIC) on http://127.0.0.1:${MOCK_PORT}`);

if (process.argv.includes("--rebuild") || !existsSync(path.join(repo, ".next", "BUILD_ID"))) {
  console.log("[run-app] next build (with mock env)...");
  await run(["build"], "next build");
}
console.log(`[run-app] next start on http://127.0.0.1:${APP_PORT}`);
await run(["start", "-H", "127.0.0.1", "-p", String(APP_PORT)], "next start");
