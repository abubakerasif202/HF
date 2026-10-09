// Minimal Supabase emulator (GoTrue + PostgREST subset) for local admin visual QA.
// Serves SYNTHETIC fixtures only. Usage: node audit/admin-visual/mock-supabase.mjs   (env MOCK_PORT, default 54399)
import http from "node:http";
import { pathToFileURL } from "node:url";
import { tables, relations } from "./fixtures.mjs";
import { buildSession, ownerUser } from "./session.mjs";

const PORT = Number(process.env.MOCK_PORT ?? 54399);
const ANON_KEY = "mock-anon-key";
const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}T/;

// Mutable copy so PATCH/POST/DELETE work for the lifetime of the process.
const db = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, structuredClone(rows)]));
const requestLog = [];

// ---------- filter evaluation ----------
function coerceCompare(rowValue, text) {
  if (rowValue === null || rowValue === undefined) return [null, null];
  if (typeof rowValue === "boolean") return [Number(rowValue), text === "true" ? 1 : 0];
  if (typeof rowValue === "number") return [rowValue, Number(text)];
  if (typeof rowValue === "string" && DATE_RE.test(rowValue) && DATE_RE.test(text)) return [Date.parse(rowValue), Date.parse(text)];
  return [String(rowValue), text];
}

function parseList(text) {
  const inner = text.replace(/^\(/, "").replace(/\)$/, "");
  return inner === "" ? [] : inner.split(",").map((s) => s.trim().replace(/^"(.*)"$/, "$1"));
}

function matches(row, column, spec) {
  let negate = false;
  let rest = spec;
  if (rest.startsWith("not.")) { negate = true; rest = rest.slice(4); }
  const dot = rest.indexOf(".");
  const op = dot === -1 ? rest : rest.slice(0, dot);
  const operand = dot === -1 ? "" : rest.slice(dot + 1);
  const value = row[column];
  let result;
  if (op === "is") {
    result = operand === "null" ? value == null : operand === "true" ? value === true : operand === "false" ? value === false : false;
  } else if (op === "in") {
    result = parseList(operand).some((item) => String(value) === item);
  } else if (op === "ilike" || op === "like") {
    const pattern = new RegExp(`^${operand.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/%/g, ".*")}$`, op === "ilike" ? "i" : "");
    result = value != null && pattern.test(String(value));
  } else {
    const [a, b] = coerceCompare(value, operand);
    if (a === null) result = op === "neq";
    else if (op === "eq") result = a === b;
    else if (op === "neq") result = a !== b;
    else if (op === "gt") result = a > b;
    else if (op === "gte") result = a >= b;
    else if (op === "lt") result = a < b;
    else if (op === "lte") result = a <= b;
    else { console.warn(`[mock] unsupported operator "${op}" on ${column}`); result = true; }
  }
  return negate ? !result : result;
}

function applyFilters(rows, params) {
  const filters = [];
  for (const [key, value] of params) {
    if (RESERVED.has(key)) continue;
    if (key === "or" || key === "and") { console.warn(`[mock] logical filter "${key}" is not supported; ignored`); continue; }
    filters.push([key, value]);
  }
  return rows.filter((row) => filters.every(([column, spec]) => matches(row, column, spec)));
}

function applyOrder(rows, orderParam) {
  if (!orderParam) return rows;
  const keys = orderParam.split(",").map((part) => {
    const [column, ...flags] = part.split(".");
    return { column, desc: flags.includes("desc"), nullsFirst: flags.includes("nullsfirst") };
  });
  return [...rows].sort((x, y) => {
    for (const { column, desc, nullsFirst } of keys) {
      const a = x[column], b = y[column];
      if (a == null && b == null) continue;
      const nullsLead = nullsFirst || desc; // Postgres default: NULLs last for ASC, first for DESC
      if (a == null) return nullsLead ? -1 : 1;
      if (b == null) return nullsLead ? 1 : -1;
      const [ca, cb] = typeof a === "string" && DATE_RE.test(a) ? [Date.parse(a), Date.parse(b)] : [a, b];
      if (ca < cb) return desc ? 1 : -1;
      if (ca > cb) return desc ? -1 : 1;
    }
    return 0;
  });
}

// ---------- select / embed ----------
function splitTop(text) {
  const parts = [];
  let depth = 0, buf = "";
  for (const ch of text) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) { parts.push(buf.trim()); buf = ""; } else buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function project(table, row, selectText) {
  if (!selectText || selectText === "*") return { ...row };
  const out = {};
  for (const item of splitTop(selectText)) {
    if (item === "*") { Object.assign(out, row); continue; }
    const embed = /^(?:(\w+):)?(\w+)(?:!\w+)?\((.*)\)$/s.exec(item);
    if (embed) {
      const [, alias, rel, inner] = embed;
      const link = relations[table]?.[rel];
      if (!link) { console.warn(`[mock] unknown relation ${table}.${rel}`); out[alias ?? rel] = null; continue; }
      const [target, fk] = link;
      const hit = db[target].find((candidate) => candidate.id === row[fk]);
      out[alias ?? rel] = hit ? project(target, hit, inner) : null;
      continue;
    }
    const aliased = /^(\w+):(\w+)$/.exec(item);
    if (aliased) out[aliased[1]] = row[aliased[2]];
    else out[item] = row[item];
  }
  return out;
}

// ---------- HTTP helpers ----------
function send(res, status, body, headers = {}) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "Content-Range",
    ...headers,
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

function wantsObject(req) {
  return (req.headers.accept ?? "").includes("vnd.pgrst.object");
}

function respondRows(req, res, status, rows, extraHeaders = {}) {
  if (wantsObject(req)) {
    if (rows.length !== 1) {
      return send(res, 406, { code: "PGRST116", details: `The result contains ${rows.length} rows`, hint: null, message: "Cannot coerce the result to a single JSON object" }, extraHeaders);
    }
    return send(res, status, rows[0], extraHeaders);
  }
  return send(res, status, rows, extraHeaders);
}

// ---------- REST ----------
const RPC_RESULTS = {
  expire_stale_holds: 0,
  purge_expired_booking_rate_limits: 0,
  next_booking_number: "HF-9999",
  consume_booking_rate_limit: { allowed: true, retry_after_seconds: 1 },
  consume_quote_rate_limit: { allowed: true, retry_after_seconds: 1 },
};

async function handleRest(req, res, url) {
  const [, , , resource, ...rest] = url.pathname.split("/"); // /rest/v1/<resource>
  if (resource === "rpc") {
    const fn = rest[0];
    await readJson(req);
    return send(res, 200, fn in RPC_RESULTS ? RPC_RESULTS[fn] : null);
  }
  const rows = db[resource];
  if (!rows) return send(res, 404, { code: "42P01", message: `relation "public.${resource}" does not exist (mock has no such table)`, details: null, hint: null });

  const params = url.searchParams;
  const prefer = req.headers.prefer ?? "";
  const countExact = prefer.includes("count=exact");
  const wantRepresentation = prefer.includes("return=representation");

  if (req.method === "GET" || req.method === "HEAD") {
    const filtered = applyOrder(applyFilters(rows, params), params.get("order"));
    const total = filtered.length;
    const offset = Number(params.get("offset") ?? 0);
    const limitParam = params.get("limit");
    const page = filtered.slice(offset, limitParam == null ? undefined : offset + Number(limitParam));
    const headers = {};
    if (countExact) headers["content-range"] = page.length ? `${offset}-${offset + page.length - 1}/${total}` : `*/${total}`;
    if (req.method === "HEAD") { res.writeHead(200, { "access-control-allow-origin": "*", ...headers }); return res.end(); }
    const projected = page.map((row) => project(resource, row, params.get("select")));
    return respondRows(req, res, 200, projected, headers);
  }

  if (req.method === "POST") {
    const body = await readJson(req);
    const incoming = (Array.isArray(body) ? body : body ? [body] : []).map((row) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row }));
    const conflictKey = params.get("on_conflict") ?? "id";
    const saved = incoming.map((row) => {
      const existing = prefer.includes("resolution=merge-duplicates") ? rows.find((r) => r[conflictKey] === row[conflictKey]) : undefined;
      if (existing) { Object.assign(existing, row); return existing; }
      rows.push(row);
      return row;
    });
    return wantRepresentation ? respondRows(req, res, 201, saved.map((r) => project(resource, r, params.get("select")))) : send(res, 201, undefined);
  }

  if (req.method === "PATCH") {
    const body = await readJson(req);
    const targets = applyFilters(rows, params);
    for (const row of targets) Object.assign(row, body);
    return wantRepresentation ? respondRows(req, res, 200, targets.map((r) => project(resource, r, params.get("select")))) : send(res, 204, undefined);
  }

  if (req.method === "DELETE") {
    const targets = new Set(applyFilters(rows, params));
    db[resource] = rows.filter((row) => !targets.has(row));
    tables[resource] = db[resource];
    return send(res, 204, undefined);
  }

  return send(res, 405, { message: "method not allowed" });
}

// ---------- Auth ----------
async function handleAuth(req, res, url) {
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  if (path === "/user" && req.method === "GET") {
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!token || token === ANON_KEY) return send(res, 401, { code: 401, error_code: "no_authorization", msg: "This endpoint requires a Bearer token" });
    return send(res, 200, ownerUser());
  }
  if (path === "/token") return send(res, 200, buildSession());
  if (path === "/logout") { res.writeHead(204, { "access-control-allow-origin": "*" }); return res.end(); }
  if (path === "/settings") return send(res, 200, { external: {}, disable_signup: true, mailer_autoconfirm: false });
  return send(res, 404, { msg: `mock auth: unhandled ${req.method} ${path}` });
}

export function startMockSupabase(port = PORT) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    requestLog.push(`${req.method} ${url.pathname}${url.search}`.slice(0, 300));
    if (requestLog.length > 500) requestLog.shift();
    try {
      if (req.method === "OPTIONS") return send(res, 204, undefined);
      if (url.pathname === "/__health") return send(res, 200, { ok: true, synthetic: true });
      if (url.pathname === "/__log") return send(res, 200, requestLog);
      if (url.pathname.startsWith("/auth/v1/")) return await handleAuth(req, res, url);
      if (url.pathname.startsWith("/rest/v1/")) return await handleRest(req, res, url);
      return send(res, 404, { message: "mock supabase: not found", path: url.pathname });
    } catch (error) {
      console.error("[mock] handler error", error);
      return send(res, 500, { message: String(error) });
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startMockSupabase();
  console.log(`[mock-supabase] SYNTHETIC data only — listening on http://127.0.0.1:${PORT}`);
}
