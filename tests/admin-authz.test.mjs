import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { isAdminEmail, isAuthorizedAdmin } from "../lib/admin-access.ts";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

test("only the owner email with an active owner staff row is authorized", () => {
  const owner = { active: true, role: "owner" };
  assert.equal(isAuthorizedAdmin("admin@hfremovalsadelaide.com.au", owner), true);
  assert.equal(isAuthorizedAdmin("  ADMIN@hfremovalsadelaide.com.au ", owner), true);
  assert.equal(isAuthorizedAdmin("other@example.com", owner), false);
  assert.equal(isAuthorizedAdmin("admin@hfremovalsadelaide.com.au", { active: false, role: "owner" }), false);
  assert.equal(isAuthorizedAdmin("admin@hfremovalsadelaide.com.au", { active: true, role: "staff" }), false);
  assert.equal(isAuthorizedAdmin("admin@hfremovalsadelaide.com.au", null), false);
  assert.equal(isAuthorizedAdmin(null, owner), false);
  assert.equal(isAdminEmail(undefined), false);
});

test("every protected admin page re-checks authorization itself", async () => {
  const files = (await walk(path.join(root, "app/admin/(protected)"))).filter((f) => /page\.tsx$/.test(f));
  assert.ok(files.length >= 9, "expected the admin pages to be found");
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.match(source, /await requireAdmin\(\)/, `${file} must call requireAdmin()`);
  }
});

test("every admin server action file authorizes before mutating", async () => {
  const files = (await walk(path.join(root, "app/admin"))).filter((f) => /actions\.ts$/.test(f));
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const exported = [...source.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    for (const name of exported) {
      if (name === "signInAction" || name === "signOutAction") continue;
      const body = source.slice(source.indexOf(`export async function ${name}`));
      assert.match(body.slice(0, 600), /requireStaff\(\)/, `${file}:${name} must call requireStaff() first`);
    }
  }
});

test("admin quote API distinguishes 401 from 403 and never caches", async () => {
  const route = await readFile(path.join(root, "app/api/admin/quotes/route.ts"), "utf8");
  assert.match(route, /status === "forbidden" \? 403 : 401/);
  assert.match(route, /private, no-store, max-age=0/);
  assert.match(route, /origin !== new URL\(request\.url\)\.origin/);
});

test("proxy only matches admin routes so the public site stays login-free", async () => {
  const proxy = await readFile(path.join(root, "proxy.ts"), "utf8");
  assert.match(proxy, /matcher: \["\/admin\/:path\*", "\/api\/admin\/:path\*"\]/);
  assert.match(proxy, /auth\.getUser\(\)/);
  assert.doesNotMatch(proxy, /getSession\(/);
});

test("session cookies are httpOnly and login errors are generic", async () => {
  const ssr = await readFile(path.join(root, "lib/server/supabase-ssr.ts"), "utf8");
  const actions = await readFile(path.join(root, "app/admin/actions.ts"), "utf8");
  assert.match(ssr, /httpOnly: true/);
  assert.doesNotMatch(actions, /error\.message/);
  assert.doesNotMatch(actions, /not an active staff member/);
});

test("migration 0017 makes the RLS helper owner-only and revokes anon grants", async () => {
  const sql = await readFile(path.join(root, "supabase/migrations/0017_owner_only_rls_and_grants.sql"), "utf8");
  assert.match(sql, /active and role = 'owner'/);
  assert.match(sql, /revoke all on table[\s\S]*public\.bookings[\s\S]*from anon, authenticated/);
  assert.doesNotMatch(sql, /grant [^;]* to anon/i);
});
