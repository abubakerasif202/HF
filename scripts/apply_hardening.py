from pathlib import Path
import re


def read_raw(path: str) -> tuple[Path, str]:
    p = Path(path)
    return p, p.read_bytes().decode("utf-8")


def write_raw(p: Path, text: str) -> None:
    p.write_bytes(text.encode("utf-8"))


def replace_once(path: str, old: str, new: str) -> None:
    p, text = read_raw(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected 1 occurrence, found {count}: {old[:100]!r}")
    write_raw(p, text.replace(old, new, 1))


def replace_block(path: str, old: str, new: str) -> None:
    p, text = read_raw(path)
    pattern = re.escape(old).replace(r"\
", r"\r?\n")
    updated, count = re.subn(pattern, lambda _m: new, text, count=1)
    if count != 1:
        raise RuntimeError(f"{path}: expected block once, found {count}: {old[:100]!r}")
    write_raw(p, updated)


def remove_line(path: str, line: str) -> None:
    p, text = read_raw(path)
    pattern = re.escape(line) + r"\r?\n"
    updated, count = re.subn(pattern, "", text, count=1)
    if count != 1:
        raise RuntimeError(f"{path}: expected line once, found {count}: {line!r}")
    write_raw(p, updated)


# Verified business hours and stale 24/7 claims.
replace_once(
    "lib/site-data.ts",
    '    hoursLabel: "Open 24 Hours",',
    '    hoursLabel: "7:00 am–8:00 pm daily",\n    hoursShort: "7am–8pm",\n    hoursVerifiedAt: "2026-08-27",',
)
replace_once(
    "lib/site-data.ts",
    '      "We recommend booking 1–2 weeks in advance once your moving date is confirmed. However, we operate 24/7 and also accommodate same-day or urgent move requests whenever truck capacity allows.",',
    '      "We recommend booking 1–2 weeks in advance once your moving date is confirmed. Our published business hours are 7:00 am–8:00 pm daily, and same-day or urgent move requests may be accommodated when truck capacity allows.",',
)

# Remove route prices that were introduced by mapping other routes rather than from supplied pricing.
for line in [
    '  { slug: "adelaide-western-sydney", label: "Adelaide ↔ Western Sydney", price: "$130.19", unit: "per m³" },',
    '  { slug: "adelaide-smithfield", label: "Adelaide ↔ Smithfield NSW", price: "$130.19", unit: "per m³" },',
    '  { slug: "adelaide-brisbane", label: "Adelaide ↔ Brisbane", price: "$164.04", unit: "per m³" },',
    '  { slug: "adelaide-canberra", label: "Adelaide ↔ Canberra", price: "$130.19", unit: "per m³" },',
    '  ["adelaide-western-sydney", "Western Sydney", "$130.19", "Western Sydney covers a wide spread of suburbs, so name the destination suburb and postcode alongside driveway or unit access."],',
    '  ["adelaide-smithfield", "Smithfield NSW", "$130.19", "Note whether the delivery address is residential or industrial, since dock height and truck turning space change the unload plan."],',
    '  ["adelaide-brisbane", "Brisbane", "$164.04", "Long-haul loads travel further, so flag fragile pieces and anything that needs dismantling before the volume is locked in."],',
    '  ["adelaide-canberra", "Canberra", "$130.19", "Confirm the destination suburb and any building or estate access rules, then build the inventory around them."],',
]:
    remove_line("lib/site-data.ts", line)

# Quote form: keep only services represented by the verified service dataset.
replace_block(
    "app/components/SiteClient.tsx",
    '''const ADDITIONAL_SERVICES = [
  "Full Packing Service",
  "Unpacking Service",
  "Furniture Disassembly / Reassembly",
  "Piano / Pool Table Moving",
  "Short/Long-Term Storage",
  "Extra Transit Insurance / Cover",
  "Packing Boxes & Materials Supply",
  "Cleaning (End of Lease)",
  "Rubbish/Junk Removal",
] as const;''',
    '''const ADDITIONAL_SERVICES = [
  "Full Packing Service",
  "Unpacking Service",
  "Furniture Disassembly / Reassembly",
] as const;''',
)
replace_block(
    "app/components/SiteClient.tsx",
    '''            <option>Residential (House / Unit)</option>
            <option>Apartment / High-Rise (Lift Access)</option>
            <option>Studio / Granny Flat</option>
            <option>Office / Commercial Relocation</option>
            <option>Retail / Warehouse Relocation</option>
            <option>Interstate Long Distance</option>
            <option>Backloading Route</option>
            <option>Packing & Protection Only</option>
            <option>Single Item / Heavy Furniture</option>
            <option>Piano / Pool Table Move</option>
            <option>Storage Drop-Off / Pick-Up</option>
            <option>End-of-Lease Move + Clean</option>
            <option>Senior / Downsizing Move</option>
            <option>Student Move (Share House)</option>''',
    '''            <option>Residential (House / Unit)</option>
            <option>Apartment / High-Rise (Lift Access)</option>
            <option>Office / Commercial Relocation</option>
            <option>Interstate Long Distance</option>
            <option>Backloading Route</option>
            <option>Packing & Protection Only</option>''',
)
replace_once(
    "app/components/SiteClient.tsx",
    '          <p>⚡ <strong>Local Rate:</strong> {entryLocalRate.name} from <em>{entryLocalRate.halfHour} / 30 min</em> ({entryLocalRate.hourly}/hr) · All protective gear included</p>',
    '          <p>⚡ <strong>Local Rate:</strong> {entryLocalRate.name} from <em>{entryLocalRate.halfHour} / 30 min</em> ({entryLocalRate.hourly}/hr) · Final quote confirms the move scope</p>',
)
replace_once(
    "app/components/SiteClient.tsx",
    '              <label className={`package-option ${index === 0 ? "package-option--popular" : ""}`} key={pricing.name}>',
    '              <label className="package-option" key={pricing.name}>',
)
replace_once(
    "app/components/SiteClient.tsx",
    '                    {index === 0 && <b className="package-popular">Popular</b>}',
    '',
)

# Homepage pricing: remove unsourced popularity/fit/fee guarantees while preserving verified rates.
replace_once(
    "app/components/Site.tsx",
    '          copy="Local Adelaide moves use fair 30-minute billing increments. Interstate moves are charged on clear per-cubic-metre rates."',
    '          copy="Local Adelaide moves use published 30-minute billing increments. Interstate routes below show supplied per-cubic-metre reference rates."',
)
replace_once("app/components/Site.tsx", "{localPricing.map((item, index) => (", "{localPricing.map((item) => (")
replace_once(
    "app/components/Site.tsx",
    '            <article className={`price-card ${index === 0 ? "price-card--popular" : ""}`} key={item.name}>',
    '            <article className="price-card" key={item.name}>',
)
remove_line("app/components/Site.tsx", '              {index === 0 && <span className="price-popular-badge">Most Popular</span>}')
remove_line("app/components/Site.tsx", '              <p className="price-kicker">{index === 0 ? "Most Popular for 1-3 Bedrooms" : "Ideal for 3-5 Bedrooms & Large Homes"}</p>')
replace_once(
    "app/components/Site.tsx",
    '                <li>✓ No extra charges for stairs (disclosed in brief)</li>',
    '                <li>✓ Final quote confirms access, inventory and move scope</li>',
)
replace_once("app/components/Site.tsx", '              <a className="button button-ruby" href="/#quote">Book This Option</a>', '              <a className="button button-ruby" href="/#quote">Request Quote for This Option</a>')
replace_once(
    "app/components/Site.tsx",
    '            <p>Calculated per cubic metre (m³) so you only pay for the exact volume you transport.</p>',
    '            <p>Calculated per cubic metre (m³); final pricing depends on the confirmed route, volume and move scope.</p>',
)

# Reusable pricing pattern mirrors the same integrity rules.
replace_once(
    "app/components/patterns/PricingBreakdownPattern.tsx",
    '  subtitle = "Local Adelaide moves use fair 30-minute billing increments. Interstate moves are charged on clear per-cubic-metre rates.",',
    '  subtitle = "Local Adelaide moves use published 30-minute billing increments. Interstate routes below show the supplied per-cubic-metre reference rates.",',
)
replace_once(
    "app/components/patterns/PricingBreakdownPattern.tsx",
    '  interstateSubtitle = "Calculated per cubic metre (m³) so you only pay for the exact volume you transport.",',
    '  interstateSubtitle = "Calculated per cubic metre (m³); final pricing depends on the confirmed route, volume and move scope.",',
)
replace_block(
    "app/components/patterns/PricingBreakdownPattern.tsx",
    '''const DEFAULT_LOCAL_FEATURES: string[] = [
  "Fully equipped truck with moving blankets & heavy straps",
  "Complimentary mattress & furniture protection wrap",
  "Transparent 30-minute billing increments with no hidden charges",
  "Up to $1,000,000 Public Liability & Transit Insurance included*",
];''',
    '''const DEFAULT_LOCAL_FEATURES: string[] = [
  "Moving blankets and heavy-duty straps available on the truck",
  "Complimentary mattress and side-table protective wraps",
  "Published 30-minute billing; final quote confirms the move scope",
  "Up to $1,000,000 Public Liability & Transit Insurance; policy terms and move scope apply",
];''',
)
replace_once(
    "app/components/patterns/PricingBreakdownPattern.tsx",
    '  const tiers: PricingTierItem[] = localTiers ?? localPricing.map((item: (typeof localPricing)[number], idx: number) => ({',
    '  const tiers: PricingTierItem[] = localTiers ?? localPricing.map((item: (typeof localPricing)[number]) => ({',
)
remove_line("app/components/patterns/PricingBreakdownPattern.tsx", '    badge: idx === 0 ? "Most Popular for 1–3 Bedrooms" : "Ideal for 3–5 Bedrooms & Large Homes",')
replace_once("app/components/patterns/PricingBreakdownPattern.tsx", '    ctaText: "Book This Option",', '    ctaText: "Request Quote for This Option",')
replace_once("app/components/patterns/PricingBreakdownPattern.tsx", '{tier.ctaText || "Book This Option"}', '{tier.ctaText || "Request a Quote"}')

# Visible trust/hours wording.
replace_once(
    "app/components/Site.tsx",
    '      desc: `${business.googleBusiness.reviewCount}+ Verified Adelaide Reviews`,',
    '      desc: `${business.googleBusiness.reviewCount} Google Reviews`,',
)
replace_once(
    "app/components/Site.tsx",
    '              <span>{business.googleBusiness.rating} RATED ADELAIDE REMOVALISTS ({business.googleBusiness.reviewCount}+ REVIEWS)</span>',
    '              <span>{business.googleBusiness.rating} RATED ADELAIDE REMOVALISTS ({business.googleBusiness.reviewCount} REVIEWS)</span>',
)
replace_once("app/components/Site.tsx", '            <span><b>24h</b> Enquiries</span>', '            <span><b>{business.googleBusiness.hoursShort}</b> Daily hours</span>')
replace_once("app/components/Site.tsx", '                <span>Primary phone (24/7)</span>', '                <span>Primary phone</span>')

# Structured data agrees with visible hours.
replace_once("app/page.tsx", '          opens: "00:00",', '          opens: "07:00",')
replace_once("app/page.tsx", '          closes: "23:59",', '          closes: "20:00",')

# Regression expectations.
replace_once(
    "tests/rendered-html.test.mjs",
    '  assert.match(html, /Open 24 Hours/i);',
    '  assert.match(html, /7:00 am–8:00 pm daily/i);\n  assert.doesNotMatch(html, /24\\/7|24h Enquiries/i);',
)
replace_once(
    "tests/rendered-html.test.mjs",
    '  assert.match(data, /verifiedAt: "2026-08-21"/);',
    '  assert.match(data, /verifiedAt: "2026-08-21"/);\n  assert.match(data, /hoursVerifiedAt: "2026-08-27"/);\n  assert.doesNotMatch(data, /adelaide-(?:western-sydney|smithfield|brisbane|canberra)/);',
)
replace_once("tests/rendered-html.test.mjs", '  assert.match(html, /price-card price-card--popular/);', '  assert.doesNotMatch(html, /price-card price-card--popular/);')
replace_once("tests/rendered-html.test.mjs", '  assert.match(html, /price-popular-badge[^>]*>Most Popular/);', '  assert.doesNotMatch(html, /price-popular-badge[^>]*>Most Popular/);')
replace_once("tests/rendered-html.test.mjs", '  assert.match(html, /package-option package-option--popular/);', '  assert.doesNotMatch(html, /package-option package-option--popular/);')
replace_once("tests/rendered-html.test.mjs", '  assert.match(html, /package-popular[^>]*>Popular/);', '  assert.doesNotMatch(html, /package-popular[^>]*>Popular/);')

print("HF production hardening patch applied")
