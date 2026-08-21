const required = ["name", "phone", "email", "from", "to", "moveType", "propertySize"] as const;
const moveTypes = new Set(["Residential", "Apartment", "Office / Commercial", "Interstate", "Backloading", "Packing / Unpacking", "Other"]);
const propertySizes = new Set(["Studio / Small", "1 Bedroom", "2 Bedroom", "3 Bedroom", "4 Bedroom", "5+ Bedroom", "Office / Commercial", "Other"]);
const fieldLimits: Record<string, number> = { name: 100, phone: 32, email: 254, date: 20, from: 180, to: 180, moveType: 40, propertySize: 40, details: 3000 };
const rateLimitWindowMs = 60_000;
const rateLimitMax = 5;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export const runtime = "nodejs";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getClientKey(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function isRateLimited(key: string, now = Date.now()) {
  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }
  current.count += 1;
  return current.count > rateLimitMax;
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
  const startedAt = typeof body.startedAt === "number" ? body.startedAt : 0;
  if (!startedAt || Date.now() - startedAt < 1_200 || startedAt > Date.now()) return Response.json({ error: "Please review the form before sending." }, { status: 422 });

  const rateKeys = [`ip:${getClientKey(request)}`, `email:${values.email.toLowerCase()}`];
  if (rateKeys.some((key) => isRateLimited(key))) return Response.json({ error: "Too many enquiries were sent. Please call HF Removals Adelaide." }, { status: 429 });

  const endpoint = process.env.QUOTE_ENDPOINT_URL;
  if (!endpoint) return Response.json({ error: "Quote delivery is not configured." }, { status: 503 });
  let endpointUrl: URL;
  try { endpointUrl = new URL(endpoint); } catch { return Response.json({ error: "Quote delivery is not configured." }, { status: 503 }); }
  if (endpointUrl.protocol !== "https:") return Response.json({ error: "Quote delivery is not configured securely." }, { status: 503 });
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
