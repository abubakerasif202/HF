const required = ["name", "phone", "email", "from", "to", "moveType", "propertySize"] as const;
const moveTypes = new Set(["Residential", "Apartment", "Office / Commercial", "Interstate", "Backloading", "Packing / Unpacking", "Other"]);
const propertySizes = new Set(["Studio / Small", "1 Bedroom", "2 Bedroom", "3 Bedroom", "4 Bedroom", "5+ Bedroom", "Office / Commercial", "Other"]);
// A genuine enquiry takes at least a moment to fill in; a session left open
// for over a day is treated as stale rather than as a real submission.
const MIN_FORM_DWELL_MS = 1_200;
const MAX_FORM_DWELL_MS = 24 * 60 * 60 * 1_000;
const fieldLimits: Record<string, number> = { name: 100, phone: 32, email: 254, date: 20, from: 180, to: 180, moveType: 40, propertySize: 40, details: 3000 };

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getClientKey(request: Request) {
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// Best-effort limiter. Serverless instances do not share memory and are
// recycled, so a determined caller can still get through by landing on cold
// instances. It exists to blunt naive floods, not as real abuse protection.
// Swap in a shared store (Upstash Redis, Vercel KV) for a durable limit.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const recentRequests = new Map<string, number[]>();

function isRateLimited(keys: string[]) {
  const now = Date.now();
  for (const [key, hits] of recentRequests) {
    const live = hits.filter((at) => now - at < RATE_LIMIT_WINDOW_MS);
    if (live.length) recentRequests.set(key, live);
    else recentRequests.delete(key);
  }
  const limited = keys.some((key) => (recentRequests.get(key)?.length ?? 0) >= RATE_LIMIT_MAX);
  if (!limited) for (const key of keys) recentRequests.set(key, [...(recentRequests.get(key) ?? []), now]);
  return limited;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 24_000) return Response.json({ error: "The request is too large." }, { status: 413 });
  const raw = await request.text();
  if (raw.length > 24_000) return Response.json({ error: "The request is too large." }, { status: 413 });
  const body = (() => { try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; } })();
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  if (body.company) return Response.json({ ok: true });

  for (const key of required) {
    if (typeof body[key] !== "string" || !body[key].trim()) {
      return Response.json({ error: "Please complete all required fields." }, { status: 422 });
    }
  }

  const values: Record<string, string> = {};
  for (const [key, limit] of Object.entries(fieldLimits)) {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    if (value.length > limit) return Response.json({ error: "One or more fields is too long." }, { status: 422 });
    values[key] = value;
  }
  if (!isValidEmail(values.email)) return Response.json({ error: "Please enter a valid email address." }, { status: 422 });
  if (!/^[0-9+ ()-]{8,}$/.test(values.phone)) return Response.json({ error: "Please enter a valid phone number." }, { status: 422 });
  if (!moveTypes.has(values.moveType) || !propertySizes.has(values.propertySize)) return Response.json({ error: "Please select a valid move and property type." }, { status: 422 });
  if (values.date && !/^\d{4}-\d{2}-\d{2}$/.test(values.date)) return Response.json({ error: "Please enter a valid moving date." }, { status: 422 });
  // Elapsed time is measured entirely on the client so device clock offset
  // cannot reject a genuine submission. Only the duration is trusted here.
  const elapsedMs = typeof body.elapsedMs === "number" && Number.isFinite(body.elapsedMs) ? body.elapsedMs : -1;
  if (elapsedMs < MIN_FORM_DWELL_MS || elapsedMs > MAX_FORM_DWELL_MS) return Response.json({ error: "Please review the form before sending." }, { status: 422 });

  const endpoint = process.env.QUOTE_ENDPOINT_URL;
  if (!endpoint) return Response.json({ error: "Quote delivery is not configured." }, { status: 503 });
  let endpointUrl: URL;
  try { endpointUrl = new URL(endpoint); } catch { return Response.json({ error: "Quote delivery is not configured." }, { status: 503 }); }
  if (endpointUrl.protocol !== "https:") return Response.json({ error: "Quote delivery is not configured securely." }, { status: 503 });
  const rateKeys = [`ip:${getClientKey(request)}`, `email:${values.email.toLowerCase()}`];
  if (isRateLimited(rateKeys)) return Response.json({ error: "Too many enquiries were sent. Please call HF Removals Adelaide." }, { status: 429 });

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.QUOTE_BEARER_TOKEN ? { authorization: `Bearer ${process.env.QUOTE_BEARER_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        name: values.name, phone: values.phone, email: values.email, date: values.date,
        from: values.from, to: values.to, moveType: values.moveType, propertySize: values.propertySize,
        details: values.details, source: "hfremovalsadelaide.com.au",
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return Response.json({ error: "The quote service could not accept the request." }, { status: 502 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "The quote service is temporarily unavailable." }, { status: 502 });
  }
}
