import { z } from "zod";
const text = (max: number) => z.string().trim().max(max).default("");
const attributionSchema = z.object({
  utm_source: text(200), utm_medium: text(200), utm_campaign: text(200), utm_content: text(200), utm_term: text(200),
  gclid: text(200), fbclid: text(200), landing_page: text(500), referrer: text(500),
});
export const quoteSchema = z.object({
  request_id: z.string().uuid(), name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(8).max(32).regex(/^[0-9+() -]+$/),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]).default(""),
  moving_from: z.string().trim().min(1).max(180), moving_to: z.string().trim().min(1).max(180),
  move_type: z.enum(["Residential (House / Unit)", "Apartment / High-Rise (Lift Access)", "Office / Commercial Relocation", "Interstate Long Distance", "Backloading Route", "Packing & Protection Only"]),
  move_category: z.enum(["Interstate Move", "Local Adelaide Move"]),
  moving_package: text(100), property_size: text(100), floor_access: text(100), parking_access: text(100),
  boxes_needed: text(100), details: text(3000), "services[]": z.array(z.string().max(100)).max(10).default([]),
  preferred_moving_date: z.union([z.literal(""), z.iso.date()]).default(""),
  source_page: z.string().max(500), _gotcha: text(100),
  attribution_consent: z.boolean().default(false), attribution: attributionSchema.optional(),
});
export type QuoteInput = z.infer<typeof quoteSchema>;
