import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** True when local PostgreSQL server binaries are available. */
export function postgresAvailable() {
  try {
    execFileSync("initdb", ["--version"], { stdio: "ignore" });
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

const SUPABASE_STUBS = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as 'select null::uuid';
`;

/**
 * Starts a throwaway PostgreSQL cluster (never the app database), applies the
 * REAL migration files from supabase/migrations in order up to `upTo`
 * (inclusive filename prefix), and hands `sql(query)` to the callback.
 * `sql` runs with ON_ERROR_STOP and returns trimmed unaligned output.
 */
export async function withMigratedPostgres({ upTo = "9999" } = {}, run) {
  const root = mkdtempSync(join(tmpdir(), "hf-pg-"));
  const data = join(root, "data");
  const port = await freePort();
  const base = ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
  // psql on Windows emits CRLF; normalise so multi-line output compares equal everywhere.
  const sql = (query) => execFileSync("psql", [...base, "-Atc", query], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).replace(/\r/g, "").trim();
  // Separate sessions for genuine concurrency tests (each call is its own psql connection).
  const sqlAsync = (query) => new Promise((resolve, reject) => {
    execFile("psql", [...base, "-Atc", query], { encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) reject(new Error(String(stderr || error.message)));
      else resolve(stdout.replace(/\r/g, "").trim());
    });
  });
  const file = (path) => execFileSync("psql", [...base, "-q", "-f", path], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  let started = false;
  try {
    execFileSync("initdb", ["-D", data, "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8"], { stdio: "ignore" });
    execFileSync("pg_ctl", ["-D", data, "-l", join(root, "server.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"], { stdio: "ignore" });
    started = true;
    sql(SUPABASE_STUBS);
    const dir = new URL("../../supabase/migrations/", import.meta.url);
    const files = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
    const applied = [];
    for (const name of files) {
      if (name.slice(0, 4) > upTo.slice(0, 4)) break;
      file(new URL(name, dir).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
      applied.push(name);
    }
    await run({ sql, sqlAsync, applied, applyFile: (name) => file(new URL(name, dir).pathname.replace(/^\/([A-Za-z]:)/, "$1")) });
  } finally {
    if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
    rmSync(root, { recursive: true, force: true });
  }
}

export const readMigration = (name) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
