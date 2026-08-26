from pathlib import Path

path = Path("app/components/patterns/PricingBreakdownPattern.tsx")
text = path.read_bytes().decode("utf-8")
old = "    isPopular: idx === 0,"
if old in text:
    text = text.replace(old + "\r\n", "", 1).replace(old + "\n", "", 1)
    path.write_bytes(text.encode("utf-8"))
    print("Removed remaining pricing popularity flag")
else:
    print("Pricing popularity flag already removed")
