import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("HF admin access checks both owner identity and active staff role", async () => {
  const identity = await readFile(new URL("../lib/admin-access.ts", import.meta.url), "utf8");
  const auth = await readFile(new URL("../lib/server/supabase-ssr.ts", import.meta.url), "utf8");
  const actions = await readFile(new URL("../app/admin/actions.ts", import.meta.url), "utf8");
  const login = await readFile(new URL("../app/admin/login/LoginForm.tsx", import.meta.url), "utf8");
  assert.match(identity, /ADMIN_LOGIN_EMAIL = "admin@hfremovalsadelaide\.com\.au"/);
  assert.match(identity, /staff\.role === "owner"/);
  assert.match(identity, /staff\?\.active === true/);
  assert.match(auth, /if \(!data\.user \|\| !isAdminEmail\(data\.user\.email\)\) return null/);
  assert.match(auth, /if \(!isAuthorizedAdmin\(data\.user\.email, staff\)\) return null/);
  assert.match(actions, /if \(!isAdminEmail\(email\)\) return/);
  assert.match(login, /defaultValue=\{ADMIN_LOGIN_EMAIL\} readOnly/);
});
