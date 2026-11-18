// End-to-end workflow check on SYNTHETIC data, desktop and mobile:
//   find an older booking -> open details -> create invoice draft -> verify totals -> issue -> download and inspect the PDF.
// Needs the mock-backed app running (node audit/admin-visual/run-app.mjs) and the same MOCK_PORT / APP_PORT.
//   MOCK_PORT=54411 APP_PORT=3211 node audit/admin-visual/workflow.mjs [--base http://127.0.0.1:3211]
// Output: audit/admin-visual/screens/workflow/<viewport>/*.png, invoice.pdf and report.json (git-ignored).
// The invoice settings typed here (ABN, prefix, payment text) are SYNTHETIC QA values that exist only in the mock.
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEGACY_PRICED_ID, LEGACY_UNPRICED_ID, FEATURED_BOOKING_ID } from "./fixtures.mjs";
import { buildAuthCookies } from "./session.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1]; };
const APP_PORT = process.env.APP_PORT ?? 3200;
const MOCK_PORT = process.env.MOCK_PORT ?? 54399;
const base = flag("--base", `http://127.0.0.1:${APP_PORT}`);
const mock = `http://127.0.0.1:${MOCK_PORT}`;
const only = flag("--only", "")?.split(",").filter(Boolean) ?? [];
const VIEWPORTS = [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }].filter((v) => !only.length || only.includes(v.name));
const outRoot = path.join(here, "screens", "workflow");

const report = { base, startedAt: new Date().toISOString(), viewports: {} };
let failed = false;

function pdfStrings(bytes) {
  const raw = Buffer.from(bytes).toString("latin1");
  return [...raw.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((m) => m[1].replace(/\\([()\\])/g, "$1"));
}

const probeOverflow = () => {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.right <= vw + 4) continue;
    let clipped = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const overflowX = getComputedStyle(p).overflowX;
      if (overflowX !== "visible" && p.getBoundingClientRect().right <= vw + 1) { clipped = true; break; }
    }
    if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")} right=${Math.round(rect.right)}`);
  }
  return { overflow: document.documentElement.scrollWidth > vw + 1 || offenders.length > 0, offenders: offenders.slice(0, 6) };
};

async function runViewport(browser, viewport) {
  const dir = path.join(outRoot, viewport.name);
  mkdirSync(dir, { recursive: true });
  await fetch(`${mock}/__reset`, { method: "POST" });
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, acceptDownloads: true, hasTouch: viewport.name === "mobile", isMobile: viewport.name === "mobile" });
  await context.addCookies(buildAuthCookies(mock));
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200)); });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${String(error).slice(0, 200)}`));

  const checks = [];
  const overflow = [];
  const check = (name, pass, detail = "") => { checks.push({ name, pass: Boolean(pass), detail: String(detail).slice(0, 300) }); if (!pass) failed = true; console.log(`${pass ? "PASS" : "FAIL"} [${viewport.name}] ${name}${pass ? "" : ` — ${detail}`}`); };
  const shot = async (name) => { await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true }); overflow.push([name, await page.evaluate(probeOverflow)]); };
  const text = async (selector) => (await page.locator(selector).first().innerText()).replace(/\s+/g, " ").trim();
  const settle = () => page.waitForLoadState("networkidle").catch(() => {});

  // 1. Dispatch: queues + visible Find booking action ----------------------------------------------------------
  await page.goto(`${base}/admin/dispatch`);
  await page.getByRole("heading", { name: "Work queues" }).waitFor();
  const tabs = await page.getByRole("tab").allInnerTexts();
  check("Dispatch shows Today / Upcoming / Needs crew or truck queues", tabs.length === 3 && /Today/.test(tabs[0]) && /Upcoming/.test(tabs[1]) && /Needs crew or truck/.test(tabs[2]), tabs.join(" | "));
  await page.getByRole("tab", { name: /Needs crew or truck/ }).click();
  await page.locator(".a-dispatch-queue-item").first().waitFor();
  const unassigned = await page.locator(".a-dispatch-queue-item").count();
  check("Jobs awaiting crew or truck are listed", unassigned > 0, `${unassigned} listed`);
  await page.keyboard.press("Tab"); // focus management smoke: tabpanel is reachable
  await page.getByRole("tab", { name: /Today/ }).focus();
  await page.keyboard.press("ArrowRight");
  check("Queue tabs are keyboard operable (ArrowRight)", await page.getByRole("tab", { name: /Upcoming/ }).getAttribute("aria-selected") === "true");
  await page.getByRole("tab", { name: /^Today/ }).click();
  const findLink = page.getByRole("link", { name: "Find booking" });
  check("Find booking action is visible in Dispatch", await findLink.isVisible());
  const box = await findLink.boundingBox();
  check("Find booking target is at least 44px tall", box && box.height >= 44, JSON.stringify(box));
  const conflictText = (await page.locator(".a-dispatch-conflicts").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  check("Dispatch names the overlapping booking/event and labels a missing finish time as possible", /Calendar overlap/.test(conflictText) && /Sample external event/.test(conflictText), conflictText.slice(0, 200));
  await shot("01-dispatch");

  // Runs an action that triggers a search and waits until the results region has finished updating.
  const searched = async (action, fragment = "") => {
    const done = page.waitForResponse((r) => r.url().includes("/api/admin/bookings/search") && r.request().method() === "GET" && r.url().includes(fragment));
    await action();
    await done;
    await page.waitForFunction(() => document.querySelector(".a-find-results")?.getAttribute("aria-busy") === "false");
  };
  const submitQuery = (value) => searched(async () => { await q.fill(value); await page.keyboard.press("Enter"); }, new URLSearchParams({ q: value }).toString());
  // 2. Booking Finder ---------------------------------------------------------------------------------------------
  await findLink.click();
  await page.waitForURL("**/admin/dispatch/find");
  const q = page.getByLabel("Booking, customer or place");
  check("Finder search box is focused on open", await q.evaluate((el) => el === document.activeElement));
  await submitQuery("+61 400 000 099");
  const first = await text(".a-find-result");
  check("+61 mobile finds the older booking, ranked first as a phone match", /HF-2025-00007/.test(first) && /Phone match/i.test(first), first);
  check("Result shows date, customer, route, status and assignment", /2025|2026/.test(first) && /Sample Legacy Customer/.test(first) && /Elizabeth Vale/.test(first) && /Gawler/.test(first) && /Completed/.test(first) && /Sample Crew Alpha/.test(first) && /Sample HR Truck 1/.test(first), first);
  await shot("02-finder-phone");
  await submitQuery("0400000099");
  check("Local-format number finds the same booking", /HF-2025-00007/.test(await text(".a-find-result")));
  await submitQuery("hf-2025-00007");
  check("Exact reference ranks first", /Exact reference/i.test(await text(".a-find-result")), await text(".a-find-result"));
  await submitQuery("gawler");
  check("Partial suburb matches", (await page.locator(".a-find-result").allInnerTexts()).some((t) => /HF-2025-00007/.test(t)));
  await submitQuery("zzzz-nothing");
  await page.getByText("No bookings match").waitFor();
  check("Empty state is shown", true);
  await q.fill(""); await page.getByLabel("Status").selectOption("completed");
  await page.getByLabel("Moves from").fill("2025-01-01"); await page.getByLabel("Moves to").fill("2025-12-31");
  await searched(() => page.getByRole("button", { name: "Search" }).click(), "status=completed");
  const filtered = await page.locator(".a-find-result").allInnerTexts();
  check("Date-range and status filters apply", filtered.length === 1 && /HF-2025-00007/.test(filtered[0]), filtered.join(" || ").slice(0, 200));
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByText(/Showing 1–20 of \d+ bookings/).waitFor();
  check("Results are paginated", await page.locator(".a-find-result").count() === 20);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByText(/Showing 21–/).waitFor();
  check("Next page loads the remaining bookings", await page.locator(".a-find-result").count() > 0);
  await page.route("**/api/admin/bookings/search**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Booking search is unavailable. Try again shortly." }) }));
  await q.fill("error-case"); await page.keyboard.press("Enter");
  await page.getByRole("alert").filter({ hasText: "unavailable" }).waitFor();
  check("Error state offers a retry", await page.getByRole("button", { name: "Try again" }).isVisible());
  await page.unroute("**/api/admin/bookings/search**");
  await submitQuery("+61 400 000 099");
  const link = page.locator(".a-find-result").first();
  await link.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(`**/admin/bookings/${LEGACY_PRICED_ID}`);
  check("Keyboard Enter on a result opens the original booking record", true);

  // 3. Booking detail ----------------------------------------------------------------------------------------------
  const hero = await text(".a-bk-hero");
  check("Detail shows contact, move date/time, route, agreed price, crew, truck and status",
    /Sample Legacy Customer/.test(hero) && /0400 000 099/.test(hero) && /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(hero) && /Elizabeth Vale/i.test(hero) && /Gawler/i.test(hero)
    && /agreed price/i.test(hero) && /\$711\.00/.test(hero) && /Sample Crew Alpha/.test(hero) && /Sample HR Truck 1/.test(hero) && /Completed/i.test(hero), hero.slice(0, 400));
  await shot("03-booking-detail");

  // 4. Create invoice draft (settings not configured yet) ------------------------------------------------------------
  await page.getByRole("button", { name: /Create invoice/ }).click();
  await page.waitForURL(/\/admin\/invoices\/[0-9a-f-]{36}$/);
  const draftUrl = page.url();
  await page.getByRole("heading", { name: "Draft invoice" }).waitFor();
  check("Draft is prefilled with customer, reference and service date", (await page.getByLabel("Customer name").inputValue()) === "Sample Legacy Customer" && /HF-2025-00007/.test(await text(".a-inv-header")));
  const lineValues = await page.locator(".a-inv-line").evaluateAll((rows) => rows.map((r) => [...r.querySelectorAll("input,select")].map((i) => i.value).join("|")));
  check("Hourly rate and billed hours come from the booking, not live package rates", lineValues.length === 2 && /3\.5\|158\.00/.test(lineValues[0]) && /1\|158\.00/.test(lineValues[1]), lineValues.join(" ; "));
  check("Historical $100 confirmation is a separate payment, not a charge", (await page.locator(".a-inv-payment input[inputmode=decimal]").first().inputValue()) === "100.00");
  const blockers = await text(".a-inv-blockers");
  check("Missing HF settings are identified and block issuing", /Configure invoice settings first: ABN, GST registration status, Invoice number prefix, Payment instructions, Payment terms/.test(blockers) && await page.getByRole("button", { name: "Issue invoice" }).isDisabled(), blockers);
  await shot("04-draft-blocked");

  // 5. Configure synthetic settings, return to the draft ---------------------------------------------------------------
  await page.getByRole("link", { name: "Open invoice settings" }).first().click();
  await page.waitForURL("**/admin/invoices/settings");
  await page.getByLabel("ABN").fill("11 111 111 111");
  await page.getByRole("button", { name: "Save invoice settings" }).click();
  await page.getByText(/ABN is not valid/).waitFor();
  check("Invalid ABN is rejected by the checksum", true);
  await page.getByLabel("ABN").fill("51 824 753 556");
  await page.getByLabel("GST registered?").selectOption("yes");
  await page.getByLabel(/booked rates GST-inclusive/).selectOption("inclusive");
  await page.getByLabel("Invoice number prefix").fill("INV-");
  await page.getByLabel("Payment terms (days)").fill("14");
  await page.getByLabel("Payment instructions").fill("QA ONLY - synthetic payment instructions. Pay by bank transfer to the account on file.");
  await page.getByRole("button", { name: "Save invoice settings" }).click();
  await page.getByText("Invoice settings saved.").waitFor();
  await shot("05-settings");
  await page.goto(draftUrl);
  await page.getByRole("heading", { name: "Draft invoice" }).waitFor();

  // 6. Totals: GST-inclusive, deposit, discount, validation, save --------------------------------------------------------
  // The draft was created before settings existed, so its GST mode is unset: the owner must choose it explicitly.
  check("GST mode is not assumed: unchosen mode blocks issuing and hides the totals", !(await page.getByRole("radio", { name: /Include GST/ }).isChecked()) && /include GST or exclude GST/.test(await text(".a-inv-blockers")) && /Choose .Include GST. or .Exclude GST./.test(await text(".a-inv-side")) && /Total \(incl\. GST\) —/.test(await text(".a-inv-sum")), await text(".a-inv-side"));
  await page.getByRole("radio", { name: /Include GST/ }).check();  const sum = () => text(".a-inv-sum");
  let totals = await sum();
  check("Totals: 3.5h + call-out at $158/h = $711.00 incl. GST $64.64, less $100 deposit = $611.00",
    /Subtotal \(excl\. GST\) \$646\.36/.test(totals) && /GST \(10%\) \$64\.64/.test(totals) && /Total \(incl\. GST\) \$711\.00/.test(totals) && /Paid so far −\$100\.00/.test(totals) && /Balance due \$611\.00/.test(totals), totals);
  await page.getByRole("button", { name: "Discount" }).click();
  await page.locator(".a-inv-line").last().getByLabel(/Unit price/).fill("11.00");
  totals = await sum();
  check("Discount lowers the total and the GST base ($700.00, GST $63.64)", /GST \(10%\) \$63\.64/.test(totals) && /Total \(incl\. GST\) \$700\.00/.test(totals) && /Balance due \$600\.00/.test(totals), totals);
  await page.locator(".a-inv-line").last().getByLabel(/Remove line/).click();
  await page.locator(".a-inv-line").first().getByLabel("Qty").fill("abc");
  check("An invalid quantity is flagged and blocks issuing", /Fix the highlighted/.test(await text(".a-inv-blockers")) && await page.getByRole("button", { name: "Issue invoice" }).isDisabled());
  await page.locator(".a-inv-line").first().getByLabel("Qty").fill("3.5");
  await page.getByLabel("Invoice notes").fill("QA note: thanks for choosing HF Removals Adelaide.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Draft saved.").first().waitFor();
  check("Draft saves and issuing unlocks", await page.getByRole("button", { name: "Issue invoice" }).isEnabled());
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const paper = await text(".a-inv-paper");
  check("On-screen preview is stamped DRAFT and shows the totals", /DRAFT/.test(paper) && /\$711\.00/.test(paper) && /Balance due \$611\.00/.test(paper), paper.slice(0, 200));
  await shot("06-draft-preview");

  // 7. Issue --------------------------------------------------------------------------------------------------------------
  await page.getByRole("button", { name: "Issue invoice" }).click();
  check("Issuing asks for confirmation naming the next number", /INV-00001/.test(await text(".a-inv-confirm")));
  await page.getByRole("button", { name: "Confirm and issue" }).click();
  await page.getByRole("heading", { name: "INV-00001" }).waitFor();
  const issued = await text(".a-inv");
  check("Invoice is issued as INV-00001 with a frozen snapshot summary", /Issued/.test(issued) && /\$711\.00/.test(issued) && /Balance due now \$611\.00/.test(issued), issued.slice(0, 300));
  await shot("07-issued");

  // 8. PDF: download and inspect; unauthenticated access is refused ----------------------------------------------------------
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download PDF" }).click()]);
  const pdfPath = path.join(dir, "invoice.pdf");
  await download.saveAs(pdfPath);
  const strings = pdfStrings(readFileSync(pdfPath));
  const joined = strings.join("\n");
  check("PDF downloads as HF-INV-00001.pdf", download.suggestedFilename() === "HF-INV-00001.pdf", download.suggestedFilename());
  for (const needle of ["TAX INVOICE", "INV-00001", "ABN 51 824 753 556", "HF REMOVALS PTY LTD", "Sample Legacy Customer", "HF-2025-00007", "$711.00", "GST (10%)", "$64.64", "$646.36", "Deposit received", "-$100.00", "Balance due", "$611.00", "QA ONLY - synthetic payment instructions"]) {
    check(`PDF contains "${needle}"`, joined.includes(needle));
  }
  check("PDF is a real PDF with a page tree", readFileSync(pdfPath).subarray(0, 8).toString() === "%PDF-1.4\n" || readFileSync(pdfPath).subarray(0, 5).toString() === "%PDF-");
  const pdfUrl = `${base}/api/admin/invoices/${draftUrl.split("/").pop()}/pdf`;
  const anon = await browser.newContext();
  const anonResponse = await anon.request.get(pdfUrl, { maxRedirects: 0 });
  check("PDF refuses an unauthenticated request (401, or redirect to login)", [401, 302, 303, 307, 308].includes(anonResponse.status()) && !(anonResponse.headers()["content-type"] ?? "").includes("pdf"), String(anonResponse.status()));
  await anon.close();

  // 9. Payment, retry-safety, void and reissue ------------------------------------------------------------------------------------
  await page.getByLabel("Amount ($)").fill("999.00");
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByText("That payment is more than the balance due.").waitFor();
  check("A payment above the balance is refused", true);
  await page.getByLabel("Amount ($)").fill("200.00");
  await page.getByLabel("Method").fill("Bank transfer");
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByText("Payment recorded. Balance due $411.00.").waitFor();
  check("Payment recorded separately; balance due falls to $411.00", true);
  await page.getByRole("button", { name: /Void or correct/ }).click();
  await page.getByLabel(/Reason \(required/).fill("QA: corrected call-out hours");
  await page.getByRole("button", { name: "Void and start corrected draft" }).click();
  await page.waitForURL(/\/admin\/invoices\/[0-9a-f-]{36}$/);
  await page.getByText(/replaces voided invoice INV-00001/).waitFor();
  check("Void-and-reissue opens a corrected draft linked to the voided number", true);
  const reissueLines = await page.locator(".a-inv-payment").count();
  check("Money already received is carried onto the corrected draft", reissueLines === 2, `${reissueLines} payment rows`);
  await page.getByRole("radio", { name: /Include GST/ }).check();
  await page.locator(".a-inv-line").first().getByLabel("Qty").fill("3");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Draft saved.").first().waitFor();
  await page.getByRole("button", { name: "Issue invoice" }).click();
  await page.getByRole("button", { name: "Confirm and issue" }).click();
  await page.getByRole("heading", { name: "INV-00002" }).waitFor();
  check("Reissued invoice gets a new number; the voided number is not reused", true);
  await page.goto(`${base}/admin/invoices`);
  const listText = await text(".a-inv-list");
  check("Invoices view lists the void and the reissued invoice", /INV-00001/.test(listText) && /INV-00002/.test(listText) && /Void/.test(listText) && /Issued/.test(listText), listText.slice(0, 300));
  await shot("08-invoices-list");

  // 10. Original booking editing flow still works (internal note server action) -------------------------------------------------------
  await page.goto(`${base}/admin/bookings/${FEATURED_BOOKING_ID}`);
  const conflictBanner = await text(".a-bk-conflicts").catch(() => "");
  check("Booking detail warns of a possible conflict when a finish time is missing, naming the event", /Possible/.test(conflictBanner) && /Sample external event \(no finish time\)/.test(conflictBanner), conflictBanner.slice(0, 250));
  await shot("09-booking-conflict");
  const noteBox = page.getByRole("textbox").filter({ hasNot: page.locator("[disabled]") }).last();
  void noteBox;
  const noteArea = page.locator("form textarea").first();
  if (await noteArea.count()) {
    await noteArea.fill("QA internal note from workflow");
    await page.getByRole("button", { name: /add note|save note/i }).first().click().catch(() => {});
    await settle();
    await page.reload(); // the existing action only revalidates /admin/bookings, so the detail page shows it on the next load
    check("Existing note form still saves on the original booking screen", /QA internal note from workflow/.test(await page.locator("body").innerText()));
  }

  // 11. Older booking with no price at all --------------------------------------------------------------------------------------------
  await page.goto(`${base}/admin/bookings/${LEGACY_UNPRICED_ID}`);
  check("Booking with no recorded price shows 'Not recorded' for agreed price", /agreed price\s+not recorded/i.test(await text(".a-bk-hero")));
  await page.getByRole("button", { name: /Create invoice/ }).click();
  await page.waitForURL(/\/admin\/invoices\/[0-9a-f-]{36}$/);
  check("Missing pricing is flagged for review before issuing", /Pricing is missing/.test(await text(".a-inv-blockers")) && await page.getByRole("button", { name: "Issue invoice" }).isDisabled());
  await shot("10-draft-no-price");

  report.viewports[viewport.name] = { checks, overflow, consoleErrors: consoleErrors.filter((e) => !/favicon|Failed to load resource.*404/i.test(e)) };
  if (viewport.name === "mobile") {
    const bad = overflow.filter(([, o]) => o.overflow);
    check("No horizontal overflow on any mobile screen", bad.length === 0, JSON.stringify(bad.map(([n, o]) => [n, o.offenders])).slice(0, 300));
  }
  await context.close();
}

const browser = await chromium.launch();
try {
  for (const viewport of VIEWPORTS) {
    try { await runViewport(browser, viewport); } catch (error) { failed = true; console.error(`FAIL [${viewport.name}] workflow aborted: ${String(error).slice(0, 600)}`); report.viewports[viewport.name] = { aborted: String(error).slice(0, 600) }; }
  }
} finally {
  await browser.close();
}
mkdirSync(outRoot, { recursive: true });
report.finishedAt = new Date().toISOString();
writeFileSync(path.join(outRoot, "report.json"), JSON.stringify(report, null, 2));
const total = Object.values(report.viewports).flatMap((v) => v.checks ?? []);
console.log(`\nworkflow: ${total.filter((c) => c.pass).length}/${total.length} checks passed${failed ? " (FAILURES)" : ""}`);
process.exit(failed ? 1 : 0);
