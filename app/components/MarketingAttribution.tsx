"use client";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { readAttribution, recordAttribution } from "../../lib/marketing-attribution.ts";
const subscribe = (listener: () => void) => {
  window.addEventListener("hf-attribution-change", listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener("hf-attribution-change", listener); window.removeEventListener("storage", listener); };
};
const subscribeHydration = () => () => {};
const hasConsent = () => Boolean(readAttribution());
const noConsent = () => false;
const isHydrated = () => true;

export function MarketingAttribution() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const consent = useSyncExternalStore(subscribe, hasConsent, noConsent);
  const hydrated = useSyncExternalStore(subscribeHydration, isHydrated, noConsent);
  useEffect(() => { if (readAttribution()) recordAttribution(true); }, [pathname, query]);
  if (process.env.NEXT_PUBLIC_HF_QUOTE_BRIDGE_ENABLED !== "true") return null;
  return <aside className="container" style={{ paddingBlock: "1rem", marginBottom: "6rem" }} aria-label="Optional marketing attribution">
    <label><input type="checkbox" disabled={!hydrated} checked={consent} onChange={(event) => {
      recordAttribution(event.target.checked);
      window.dispatchEvent(new Event("hf-attribution-change"));
    }} /> Allow HF to remember how I found this site in this tab, to help measure enquiries. Optional; not an email subscription. <a href="/privacy">Privacy</a></label>
  </aside>;
}
