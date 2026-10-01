// Consent-gated, tab-scoped acquisition storage; no cookies or cross-site scripts.
export const ATTRIBUTION_KEY = "hf-acquisition-v1";
export const ATTRIBUTION_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"] as const;
export type Attribution = Partial<Record<typeof ATTRIBUTION_PARAMS[number] | "landing_page" | "referrer", string>>;
export function safePage(raw: string): string | undefined {
  try { const url = new URL(raw); return /^https?:$/.test(url.protocol) ? `${url.origin}${url.pathname}`.slice(0, 500) : undefined; } catch { return undefined; }
}
export function captureAttribution(url: string, referrer: string): Attribution {
  const page = new URL(url);
  const result: Attribution = { landing_page: safePage(url) };
  const referring = safePage(referrer);
  if (referring && new URL(referring).origin !== page.origin) result.referrer = referring;
  for (const key of ATTRIBUTION_PARAMS) {
    const value = page.searchParams.get(key)?.trim();
    if (value && value.length <= 200 && !/[\u0000-\u001f]/.test(value)) result[key] = value;
  }
  return result;
}
export function meaningful(attribution: Attribution) {
  return ATTRIBUTION_PARAMS.some((key) => Boolean(attribution[key])) || Boolean(attribution.referrer);
}
export function mergeAttribution(first: Attribution | undefined, current: Attribution): Attribution {
  // A later campaign may replace an initial direct visit, but never a meaningful acquisition.
  return first && meaningful(first) ? first : meaningful(current) ? current : first ?? current;
}
export function readAttribution(): Attribution | undefined {
  if (typeof window === "undefined") return;
  try {
    if (navigator.globalPrivacyControl || navigator.doNotTrack === "1") { sessionStorage.removeItem(ATTRIBUTION_KEY); return; }
    const stored = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) ?? "null");
    if (!stored || stored.consent !== true || Date.now() - stored.createdAt > 24 * 60 * 60 * 1000) return;
    return stored.first;
  } catch { return; }
}
export function recordAttribution(consent: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (!consent || navigator.globalPrivacyControl || navigator.doNotTrack === "1") { sessionStorage.removeItem(ATTRIBUTION_KEY); return; }
    const current = captureAttribution(window.location.href, document.referrer);
    const first = mergeAttribution(readAttribution(), current);
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({ consent: true, first, latest: current, createdAt: Date.now() }));
  } catch { /* Storage restrictions must never affect forms. */ }
}
