/** bookings.*_address is jsonb ({ suburb, addressLine, formattedAddress }); legacy rows may hold a plain string. */
export type AddressJson = { suburb?: string; addressLine?: string; formattedAddress?: string } | string | null | undefined;

/** Suburb-level label for dense lists. */
export function shortPlace(address: AddressJson): string {
  if (!address) return "—";
  if (typeof address === "string") {
    const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
    return parts.length > 1 ? parts.slice(-2).join(", ") : (parts[0] ?? "—");
  }
  return address.suburb || address.addressLine || address.formattedAddress || "—";
}

/** Full street address when available, otherwise the best partial. */
export function fullAddress(address: AddressJson): string {
  if (!address) return "";
  if (typeof address === "string") return address;
  return address.formattedAddress ?? `${address.addressLine ?? ""} ${address.suburb ?? ""}`.trim();
}
