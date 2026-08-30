export type Faq = { question: string; answer: string };
export type ContentPage = {
  slug: string;
  kind: "service" | "area" | "route" | "guide";
  eyebrow: string;
  title: string;
  description: string;
  intro: string;
  highlights: string[];
  sections: { title: string; body: string }[];
  faqs: Faq[];
  price?: string;
  unit?: string;
};

export const siteOrigin = "https://www.hfremovalsadelaide.com.au";
export const quoteFormEndpoint = "https://api.web3forms.com/submit";
export const canonicalEmail = "admin@hfremovalsadelaide.com.au";
export const web3FormsAccessKey =
  process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY ?? "b3427589-09df-4f1c-abae-5b3fc3266ba5";

export const business = {
  name: "HF Removals Adelaide",
  legalName: "HFremovalsadelaide - BeMovedWithUs",
  tagline: "Moving Made Easy With Us",
  domain: siteOrigin,
  phones: [
    { display: "0491 704 136", href: "tel:+61491704136", primary: true },
    { display: "0493 092 539", href: "tel:+61493092539", primary: false },
  ],
  emails: [canonicalEmail],
  address: {
    full: "20 Prunus Ave, Elizabeth Vale SA 5112, Australia",
    street: "20 Prunus Ave",
    suburb: "Elizabeth Vale",
    state: "SA",
    postcode: "5112",
    countryCode: "AU",
  },
  areaServed: [
    "Adelaide Metro",
    "Adelaide CBD",
    "Northern suburbs",
    "Southern suburbs",
    "Eastern suburbs",
    "Western suburbs",
    "Coastal suburbs",
    "Elizabeth Vale",
    "Elizabeth",
    "Salisbury",
    "Blakeview",
    "Gawler",
    "Marion",
    "Norwood",
    "Glenelg",
    "South Australia",
    "Interstate Australia",
  ],
  ceo: { name: "Muhammad Rasheed", title: "CEO, HF Removals Adelaide" },
  insuranceAmount: "$1,000,000",
  insurance: "Up to $1,000,000 Public Liability & Transit Insurance",
  insuranceQualifier:
    "Coverage and eligibility depend on the applicable policy terms and the scope of the move. Ask us about the details relevant to your move.",
  googleBusiness: {
    rating: 4.9,
    reviewCount: 417,
    hoursLabel: "7:00 am–8:00 pm daily",
    hoursShort: "7am–8pm",
    hoursVerifiedAt: "2026-08-27",
    category: "Moving and storage service",
    plusCode: "6MW7+J5 Elizabeth Vale, South Australia",
    coordinates: { latitude: -34.7578, longitude: 138.6834 },
    verifiedAt: "2026-08-21",
    directionsUrl:
      "https://www.google.com/maps/dir/?api=1&destination=20%20Prunus%20Ave%2C%20Elizabeth%20Vale%20SA%205112%2C%20Australia",
    mapEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3278.0861872991422!2d138.66031787548314!3d-34.75342166541935!2m3!1f0!2f0!3f0!3m2!1i1024!1i768!4f13.1!3m3!1m2!1s0x6ab0ad918429ad09%3A0x94810a85444deebe!2sHF%20Removals%20Adelaide!5e0!3m2!1sen!2sau!4v1787515237189!5m2!1sen!2sau",
  },
  truckVolumeGuidance: [
    { label: "Package 1", volume: "25–45 m³", examples: ["2–3 bedroom houses", "garage contents", "plants", "offices"] },
    { label: "Package 2", volume: "40–60 m³", examples: ["3–4 bedroom houses", "outdoor goods", "offices"] },
  ],
  packingMaterials: [
    "Moving blankets",
    "Shrink wrap",
    "Bubble wrap",
    "Complimentary mattress protection",
    "Complimentary side-table protective wraps",
  ],
  // 384px covers the largest UI render (176px footer mark) at 2x DPR. The 800px
  // master lives in brand/ and is not shipped from public/.
  logo: "/images/hf-logo-384.webp",
  logoWidth: 384,
  logoHeight: 384,
  headerLogo: "/images/hf-logo-384.webp",
  heroImage: "/images/hf-hero-truck-1792.webp",
  ceoImage: "/images/muhammad-rasheed-ceo.webp",
} as const;

// Discovery, metadata, schema and sitemap URLs all read from this single origin.


/**
 * Google review excerpts transcribed from supplied Google Business Profile
 * screenshots. `complete: false` marks a visibly truncated excerpt rather than
 * the full review text. Kept here with the rest of the supplied business facts.
 */
export const googleReviews = [
  {
    name: "Mishaal",
    initials: "M",
    detail: "Google review",
    content: "Muhammad and the team at HF Removals provided an exceptional house moving service. They were incredibly punctual, arriving exactly when promised, and handled everything with great care. Their pricing is highly competitive and fair. I will definitely use them again!",
    complete: true,
  },
  {
    name: "Max Lazzaris",
    initials: "ML",
    detail: "Google review · signed Sharon and max",
    content: "10/10",
    complete: false,
  },
  {
    name: "Ayan Ali",
    initials: "AA",
    detail: "Google review · Adelaide to Melbourne move",
    content: "no damage",
    complete: false,
  },
  {
    name: "shagun sharma",
    initials: "SS",
    detail: "Local Guide · Google review",
    content: "HF Removals Adelaide · interstate move",
    complete: false,
  },
] as const;

export const localPricing = [
  { name: "2 Movers + Truck", halfHour: "$79", hourly: "$158", note: "per 30 minutes" },
  { name: "3 Movers + Truck", halfHour: "$99", hourly: "$198", note: "per 30 minutes" },
] as const;

/**
 * Cheapest published local rate. Headlines, meta copy, the trust strip and the quote
 * form banner all quote "from" pricing, so they read this instead of repeating the
 * figure and drifting apart at the next price change.
 */
export const entryLocalRate = localPricing[0];

export const interstatePricing = [
  { slug: "adelaide-melbourne", label: "Adelaide ↔ Melbourne", price: "$119.43", unit: "per m³" },
  { slug: "adelaide-sydney", label: "Adelaide ↔ Sydney", price: "$130.19", unit: "per m³" },
  { slug: "adelaide-queensland", label: "Adelaide ↔ Queensland", price: "$164.04", unit: "per m³" },
  { slug: "adelaide-perth", label: "Adelaide ↔ Perth", price: "$186.06", unit: "per m³" },
] as const;

export const standardMoveFaqs: Faq[] = [
  {
    question: "How much do removalists cost in Adelaide?",
    answer:
      "Our local rates start from $79 per 30 minutes ($158/hr) for 2 movers and a truck, or $99 per 30 minutes ($198/hr) for 3 movers and a truck. Final cost depends on access, inventory, travel distance, and packing requirements.",
  },
  {
    question: "Are moving blankets, straps, and protective wraps included?",
    answer:
      "Yes. Professional moving blankets, heavy-duty tie-down straps, and trolleys are standard on every truck. We also provide complimentary mattress protection and side-table protective wrapping.",
  },
  {
    question: "Are my belongings insured during transit?",
    answer:
      "Yes. HF Removals Adelaide holds up to $1,000,000 in Public Liability and Transit Insurance. Specific terms apply based on policy conditions and move scope.",
  },
  {
    question: "How do interstate removal rates work?",
    answer:
      "Interstate moves from Adelaide are charged transparently on a per-cubic-metre (m³) reference rate (e.g. Melbourne from $119.43/m³, Sydney from $130.19/m³, Queensland from $164.04/m³, Perth from $186.06/m³). We review your itemised inventory to calculate exact volume.",
  },
  {
    question: "Can you move high-rise apartments with lift bookings?",
    answer:
      "Yes. We specialize in Adelaide CBD and multi-story apartment relocations, managing lift booking time slots, loading dock clearances, parking permits, and stair access.",
  },
  {
    question: "Do you offer packing and dismantling services?",
    answer:
      "Yes. We provide full or partial packing and unpacking services, as well as disassembly and reassembly of beds, desks, and large furniture.",
  },
  {
    question: "How early should I book my move?",
    answer:
      "We recommend booking 1–2 weeks in advance once your moving date is confirmed. Our published business hours are 7:00 am–8:00 pm daily, and same-day or urgent move requests may be accommodated when truck capacity allows.",
  },
  {
    question: "What details do you need to give a firm quote?",
    answer:
      "Simply share both pickup and drop-off suburbs, preferred moving date, property size, key inventory items, and access notes (such as stairs or tight driveways).",
  },
];

export const services: ContentPage[] = [
  {
    slug: "residential-removals",
    kind: "service",
    eyebrow: "House removals",
    title: "A clear plan for moving home",
    description: "House removals in Adelaide planned around your inventory, property access and preferred level of packing support.",
    intro:
      "For customers comparing house movers in Adelaide, HF scopes the practical details before moving day so loading, protection and final placement can be planned around the property.",
    highlights: ["Homes, apartments and townhouses", "Inventory-led scoping", "Packing and protective wraps", "Placement at your destination"],
    sections: [
      { title: "Before moving day", body: "Build a room-by-room inventory, identify fragile or bulky pieces and note stairs, lifts, gates and parking at both addresses." },
      { title: "Protection and handling", body: "Available protection includes blankets, shrink wrap, bubble wrap, mattress wraps and side-table wraps." },
      { title: "At your new address", body: "Label rooms and confirm priority items so the team can work toward practical placement rather than leaving an unplanned stack of boxes." },
    ],
    faqs: standardMoveFaqs,
  },
  {
    slug: "office-commercial-removals",
    kind: "service",
    eyebrow: "Office & commercial removals",
    title: "Coordinate the move around your workplace",
    description: "Office and commercial removals with practical planning for furniture, equipment, access and destination placement.",
    intro:
      "Commercial moves benefit from a clear inventory, named contacts and an agreed placement plan. HF works from the operational details you provide, from loading access to workstation destinations.",
    highlights: ["Office furniture", "Workstations and equipment", "Access coordination", "Destination labelling"],
    sections: [
      { title: "Create an accountable inventory", body: "Group items by team, room or destination zone and identify equipment that needs special handling or separate preparation." },
      { title: "Confirm site access", body: "Share loading areas, lift requirements, parking restrictions and site contacts for both ends of the move." },
      { title: "Plan placement", body: "A labelled floor plan and clearly marked cartons help direct furniture and equipment to the intended area." },
    ],
    faqs: standardMoveFaqs,
  },
  {
    slug: "interstate-removals",
    kind: "service",
    eyebrow: "Interstate removals",
    title: "Plan an interstate move by volume and scope",
    description: "Interstate removals from Adelaide with transparent per-cubic-metre reference rates and practical move planning.",
    intro:
      "HF provides interstate moving support between Adelaide and listed destinations. A reliable quote starts with an accurate inventory, cubic-volume estimate and access details at both ends.",
    highlights: ["Adelaide connections", "Per-m³ reference pricing", "Inventory and volume planning", "Packing support"],
    sections: [
      { title: "Volume matters", body: "Interstate reference rates are shown per cubic metre, not as a total move price. Your inventory and item dimensions help establish the likely volume." },
      { title: "Prepare both addresses", body: "Provide full origin and destination details, including suburb or postcode, stairs, lifts, parking and large-item access." },
      { title: "Pack for distance", body: "Identify fragile, high-care and bulky items early so suitable wrapping and loading requirements can be discussed." },
    ],
    faqs: standardMoveFaqs,
  },
  {
    slug: "backloading",
    kind: "service",
    eyebrow: "Backloading",
    title: "Flexible interstate capacity, properly scoped",
    description: "Backloading enquiries from Adelaide assessed around destination, volume, access and the complete move scope.",
    intro:
      "Backloading can suit eligible interstate moves when available capacity aligns with the destination and inventory. HF reviews each enquiry rather than promising a fixed schedule.",
    highlights: ["Interstate enquiries", "Volume-based scoping", "Destination details", "Packing readiness"],
    sections: [
      { title: "Start with an inventory", body: "List furniture, appliances, cartons and unusual items. Add dimensions where practical to reduce uncertainty in the volume estimate." },
      { title: "Share destination detail", body: "A destination city, suburb and postcode are needed before suitability or pricing can be assessed." },
      { title: "Keep timing flexible", body: "Availability depends on the individual move and transport scope. Confirm timing directly with HF rather than relying on assumed route schedules." },
    ],
    faqs: standardMoveFaqs,
  },
  {
    slug: "packing-unpacking",
    kind: "service",
    eyebrow: "Packing & unpacking",
    title: "Prepare, protect and place with more support",
    description: "Packing and unpacking support using practical protection for furniture, mattresses, side tables and boxed belongings.",
    intro:
      "Packing support can be included when you want help preparing belongings for loading or organising placement after arrival. The scope is tailored to the inventory and materials required.",
    highlights: [...business.packingMaterials],
    sections: [
      { title: "Decide the level of help", body: "Tell HF whether you need complete packing support, help with selected rooms or protection for specific furniture." },
      { title: "Separate essentials", body: "Keep medication, keys, documents, chargers and first-night essentials with you rather than inside general moving cartons." },
      { title: "Label for placement", body: "Mark each carton with its destination room and any handling notes to support an organised unload." },
    ],
    faqs: standardMoveFaqs,
  },
];

export const areas: ContentPage[] = [
  {
    slug: "elizabeth-vale",
    kind: "area",
    eyebrow: "Elizabeth Vale moving support",
    title: "Prepare the access, inventory and protection details",
    description: "Removalist support for Elizabeth Vale moves, scoped around property access, inventory and packing requirements.",
    intro: "HF Removals Adelaide receives enquiries at its Elizabeth Vale business address. Your move can begin or end elsewhere; a quote is based on the actual addresses and scope you provide.",
    highlights: ["Pickup and destination access", "Inventory preparation", "Protective wrapping", "Local or interstate scope"],
    sections: [
      { title: "Describe both properties", body: "Note stairs, narrow entries, gates, parking and any distance between the truck position and the doorway." },
      { title: "List high-care items", body: "Call out mattresses, tables, mirrors, fragile cartons and large furniture when requesting a quote." },
    ],
    faqs: standardMoveFaqs,
  },
  {
    slug: "elizabeth",
    kind: "area",
    eyebrow: "Elizabeth removals",
    title: "Scope the move room by room",
    description: "Removalist support for Elizabeth moves with room-by-room inventory and property-size planning.",
    intro: "For an Elizabeth move, start with a room-by-room list and decide whether you will pack yourself or want help with selected belongings.",
    highlights: ["Room-by-room inventory", "Property-size scoping", "Packing choices", "Final placement"],
    sections: [
      { title: "Build a useful inventory", body: "Count cartons and list furniture, appliances, outdoor pieces and items that need dismantling or extra care." },
      { title: "Plan the destination", body: "Label destination rooms and identify any placement priorities before the team arrives." },
    ],
    faqs: standardMoveFaqs,
  },
  {
    slug: "salisbury",
    kind: "area",
    eyebrow: "Salisbury removals",
    title: "Coordinate homes, units and workplaces",
    description: "Salisbury removalist support with planning for stairs, lifts, loading access and destination placement.",
    intro: "Salisbury enquiries can involve homes, units or workplaces. The most useful first step is to describe both sites and the access conditions the team needs to plan around.",
    highlights: ["Stairs and lifts", "Parking and loading", "Residential or commercial", "Named site contacts"],
    sections: [
      { title: "Confirm access windows", body: "If a lift, loading area or site contact must be coordinated, include that information in the quote request." },
      { title: "Separate commercial requirements", body: "For workplace moves, group furniture and equipment by destination area and identify site rules in advance." },
    ],
    faqs: standardMoveFaqs,
  },
  {
    slug: "blakeview",
    kind: "area",
    eyebrow: "Blakeview removals",
    title: "Plan a whole-home inventory with care",
    description: "Blakeview moving support focused on whole-home inventories, bulky items and protective preparation.",
    intro: "A whole-home move is easier to scope when outdoor items, garage contents, plants and bulky furniture are included alongside the main rooms.",
    highlights: ["Whole-home inventory", "Garage and outdoor items", "Dismantling questions", "Mattress and furniture protection"],
    sections: [
      { title: "Look beyond the main rooms", body: "Include garages, sheds, balconies, plants and outdoor furniture so the inventory reflects the complete move." },
      { title: "Identify dismantling needs", body: "Discuss beds, tables or other furniture that may need preparation before loading." },
    ],
    faqs: standardMoveFaqs,
  },
  {
    slug: "gawler",
    kind: "area",
    eyebrow: "Gawler removals",
    title: "Prepare moves connecting Adelaide and regional SA",
    description: "Gawler removalist support with practical planning for access at both ends, inventory and move distance.",
    intro: "For moves involving Gawler, Adelaide or South Australian regional areas, accurate origin and destination details help HF review the distance, access and inventory together.",
    highlights: ["Origin and destination detail", "Regional enquiries", "Volume preparation", "Packing readiness"],
    sections: [
      { title: "Provide the full route", body: "Share both suburbs or postcodes and any access conditions that could affect loading or unloading." },
      { title: "Reduce volume uncertainty", body: "Add carton counts and dimensions for unusually large items when you can." },
    ],
    faqs: standardMoveFaqs,
  },
];

const routeDetails = [
  ["adelaide-melbourne", "Melbourne", "$119.43", "Prepare an itemised inventory and confirm access at both addresses before the volume is assessed."],
  ["adelaide-sydney", "Sydney", "$130.19", "Include destination access windows, lift or loading details and an accurate volume estimate."],
  ["adelaide-queensland", "Queensland", "$164.04", "Queensland is a broad destination; include the city, suburb and postcode in your enquiry."],
  ["adelaide-perth", "Perth", "$186.06", "Identify bulky items and prepare belongings for a longer-distance move before final scoping."],
] as const;

export const interstateRoutes: ContentPage[] = routeDetails.map(([slug, destination, price, angle]) => ({
  slug,
  kind: "route",
  eyebrow: `Adelaide ↔ ${destination}`,
  title: `Plan your Adelaide to ${destination} move`,
  description: `Adelaide to ${destination} removals with a ${price} per m³ reference rate and inventory-led planning.`,
  intro: `${angle} The published rate is a per-cubic-metre reference, not a total move price.`,
  highlights: ["Inventory and volume estimate", "Access at both addresses", "Packing requirements", "Destination details"],
  price,
  unit: "per m³",
  sections: [
    { title: "How volume pricing works", body: `The ${price} rate applies per cubic metre. Final move cost depends on the volume and scope of the move.` },
    { title: "Prepare your inventory", body: "List furniture, appliances, cartons and high-care items. Dimensions for bulky pieces help improve the volume estimate." },
    { title: "Confirm both addresses", body: "Share origin and destination suburbs or postcodes plus stairs, lifts, parking and loading access." },
  ],
  faqs: [
    { question: `Is ${price} the total price to ${destination}?`, answer: `No. ${price} is the published reference rate per cubic metre. Final cost depends on volume and scope.` },
    { question: "Is a fixed transit time promised?", answer: "No fixed transit time or departure schedule is published here. Confirm timing for your individual move directly with HF." },
  ],
}));

const guideSeed = [
  ["adelaide-moving-checklist", "Adelaide Moving Checklist", "Build a calm sequence from early inventory to final placement.", ["Create a room-by-room inventory", "Confirm both addresses and access", "Book packing support if needed", "Label cartons by destination room"]],
  ["how-removalist-pricing-works", "How Removalist Pricing Works", "Understand local time-based rates and interstate per-volume rates.", ["Separate local and interstate pricing", "Record property and access details", "Count cartons and bulky items", "Ask what applies to your scope"]],
  ["estimate-moving-volume", "How to Estimate Moving Volume", "Prepare a practical inventory for a per-cubic-metre quote.", ["List furniture and appliances", "Count packed cartons", "Measure unusually large items", "Flag garage and outdoor goods"]],
  ["preparing-interstate-move", "Preparing for an Interstate Move", "Reduce uncertainty before an interstate quote and moving day.", ["Confirm the destination suburb", "Build an accurate volume estimate", "Plan packing for distance", "Keep essentials and documents separate"]],
  ["apartment-moving-preparation", "Apartment Moving Preparation", "Plan lifts, loading access, stairs and compact-space moves.", ["Check lift requirements", "Confirm loading access", "Measure tight entries", "Label destination rooms"]],
  ["office-relocation-checklist", "Office Relocation Checklist", "Coordinate people, equipment, furniture and site access.", ["Nominate site contacts", "Group items by destination", "Identify equipment handling needs", "Share loading and lift rules"]],
  ["packing-before-moving-day", "Packing Before Moving Day", "Pack in a sequence that protects belongings and supports placement.", ["Start with low-use rooms", "Use clear carton labels", "Separate fragile items", "Keep essentials with you"]],
  ["preparing-large-furniture", "Preparing Large Furniture", "Identify measurements, dismantling and protection requirements early.", ["Measure entries and furniture", "Discuss dismantling", "Empty and secure moving parts", "Request suitable protective wrapping"]],
] as const;

const guideBodies: Record<string, string[]> = {
  "adelaide-moving-checklist": [
    "Walk through each room, garage and outdoor area. List furniture, appliances, cartons, plants and anything that may need dismantling or added protection.",
    "Write down the complete origin and destination addresses, parking options, stairs, lifts, gates and the likely distance from the truck position to each doorway.",
    "Decide whether you will pack everything yourself or need help with selected rooms, fragile items, mattresses or furniture protection.",
    "Mark cartons with their destination room and keep medication, documents, chargers, keys and first-night items with you.",
  ],
  "how-removalist-pricing-works": [
    "Local HF rates are published in 30-minute units with an hourly equivalent. Ask which move-specific terms apply before relying on a budget estimate.",
    "Interstate reference rates are per cubic metre. They are not a total move price, because the final amount depends on volume and the complete scope.",
    "Access, inventory, packing, bulky items and the two addresses help a removalist understand the resources involved in the move.",
    "Compare quotes using the same inventory and scope. Clarify any item you do not understand rather than assuming an inclusion or fee.",
  ],
  "estimate-moving-volume": [
    "Start with the largest items in every room: lounges, beds, tables, appliances, cabinets and outdoor furniture.",
    "Add a realistic carton count. If packing has not started, estimate by room and revise the list before the quote is finalised.",
    "Measure pieces that are unusually large or difficult to describe and include garage, shed, balcony, plant and outdoor contents.",
    "Send the organised inventory to HF so the published per-m³ route rate can be considered against the actual move scope.",
  ],
  "preparing-interstate-move": [
    "Provide the destination city, suburb and postcode. Broad labels such as Queensland are not enough to scope an individual move.",
    "Build an itemised inventory and volume estimate, including cartons and bulky pieces, before treating any per-m³ figure as useful.",
    "Identify fragile and high-care items and discuss suitable wrapping for the longer-distance move rather than packing them as ordinary cartons.",
    "Keep travel documents, medication, keys, chargers and essential personal items outside the removal inventory and accessible to you.",
  ],
  "apartment-moving-preparation": [
    "Confirm whether lifts must be booked, padded or used within a designated time window and provide those details with the enquiry.",
    "Check where a moving vehicle can stand and the walking distance between that position, the building entry and your apartment.",
    "Measure narrow entries, corridors and lift dimensions where large furniture may be a close fit. Flag pieces that may need dismantling.",
    "Label cartons and furniture by destination room so unloading stays organised within the new building's access constraints.",
  ],
  "office-relocation-checklist": [
    "Name one contact for each site and record building, security, loading and lift requirements that the move plan must accommodate.",
    "Label furniture, cartons and equipment by team, room or destination zone so each group can be directed at the new workplace.",
    "Identify IT equipment, fragile devices, archives and oversized pieces that need separate preparation or handling discussion.",
    "Share an agreed placement plan and confirm which items must remain accessible during the transition instead of packing everything together.",
  ],
  "packing-before-moving-day": [
    "Begin with stored and low-use belongings, then move toward daily-use rooms so the property remains practical while packing progresses.",
    "Write the destination room and a short contents description on each carton. Mark fragile cartons clearly without relying on colour alone.",
    "Use suitable protection for fragile items and discuss blankets, shrink wrap, bubble wrap, mattress wraps or furniture wraps where needed.",
    "Keep keys, medication, valuables, documents, device chargers and first-night supplies in a separate bag that stays with you.",
  ],
  "preparing-large-furniture": [
    "Measure the furniture and the narrowest doors, stairs, corridors and lift openings at both properties before moving day.",
    "Ask whether beds, tables or other pieces should be dismantled and who will handle that work before the item is loaded.",
    "Empty drawers where appropriate, secure doors and moving parts, and keep labelled fittings or fasteners together for reassembly.",
    "Identify finishes, glass, corners and surfaces that may need blankets, wrap or other protection when the move is being scoped.",
  ],
};

export const guides: ContentPage[] = guideSeed.map(([slug, title, description, highlights]) => ({
  slug,
  kind: "guide",
  eyebrow: "Moving guide",
  title,
  description,
  intro: description,
  highlights: [...highlights],
  sections: highlights.map((heading, index) => ({
    title: `${String(index + 1).padStart(2, "0")} — ${heading}`,
    body: guideBodies[slug][index],
  })),
  faqs: standardMoveFaqs,
}));

export const allContentPages = [...services, ...areas, ...interstateRoutes, ...guides];

export const indexablePaths = [
  "/", "/about", "/contact", "/adelaide-removalists", "/services", "/pricing", "/areas", "/interstate", "/guides", "/privacy", "/terms",
  ...services.map((page) => `/services/${page.slug}`),
  ...areas.map((page) => `/areas/${page.slug}`),
  ...interstateRoutes.map((page) => `/interstate/${page.slug}`),
  ...guides.map((page) => `/guides/${page.slug}`),
];

export const nav = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Areas", href: "/areas" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

export const canonical = (path: string) =>
  `${business.domain}${path === "/" ? "" : path.replace(/\/+$/, "")}`;

export function findContentPage(parts: string[]): ContentPage | undefined {
  const [group, slug] = parts;
  if (group === "services") return services.find((page) => page.slug === slug);
  if (group === "areas") return areas.find((page) => page.slug === slug);
  if (group === "interstate") return interstateRoutes.find((page) => page.slug === slug);
  if (group === "guides") return guides.find((page) => page.slug === slug);
  return undefined;
}
