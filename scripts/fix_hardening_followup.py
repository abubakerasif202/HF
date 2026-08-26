from pathlib import Path


def replace_if_present(path_str: str, old: str, new: str) -> None:
    path = Path(path_str)
    text = path.read_bytes().decode("utf-8")
    if old in text:
        text = text.replace(old, new, 1)
        path.write_bytes(text.encode("utf-8"))
        print(f"Updated {path_str}: {old[:60]}")
    else:
        print(f"Already updated {path_str}: {old[:60]}")


path = Path("app/components/patterns/PricingBreakdownPattern.tsx")
text = path.read_bytes().decode("utf-8")
old = "    isPopular: idx === 0,"
if old in text:
    text = text.replace(old + "\r\n", "", 1).replace(old + "\n", "", 1)
    path.write_bytes(text.encode("utf-8"))
    print("Removed remaining pricing popularity flag")
else:
    print("Pricing popularity flag already removed")

replace_if_present(
    "app/components/Site.tsx",
    "              <strong>{business.googleBusiness.reviewCount}+</strong>",
    "              <strong>{business.googleBusiness.reviewCount}</strong>",
)
replace_if_present(
    "app/components/Site.tsx",
    "              <span>5-Star Reviews</span>",
    "              <span>Google Reviews</span>",
)
replace_if_present(
    "app/components/Site.tsx",
    '        <SectionHeading eyebrow="Answers & Guidance" title={title} copy="Have a specific question about your upcoming move? Call our team anytime." />',
    '        <SectionHeading eyebrow="Answers & Guidance" title={title} copy="Have a specific question about your upcoming move? Contact our team during the published business hours." />',
)
