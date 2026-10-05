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
  legalName: "HF REMOVALS PTY LTD",
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
  ceo: { name: "Muhammad Rasheed", title: "Company Director" },
  insuranceAmount: "$1,000,000",
  insurance: "Up to $1,000,000 Public Liability & Transit Insurance",
  insuranceQualifier:
    "Coverage and eligibility depend on the applicable policy terms and the scope of the move. Ask us about the details relevant to your move.",
  googleBusiness: {
    rating: 5.0,
    reviewCount: 455,
    // Google Business Profile shows "Open 24 hours"; schema expresses that as 00:00–23:59 daily.
    hoursLabel: "Open 24 hours",
    hoursShort: "24 hours",
    openingHours: {
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "00:00",
      closes: "23:59",
    },
    hoursVerifiedAt: "2026-10-04",
    // Public Google Business Profile listing (reviews link in the utility bar and reviews section).
    listingUrl: "https://maps.google.com/?cid=10700874558509895358",
    category: "Moving and storage service",
    plusCode: "6MW7+J5 Elizabeth Vale, South Australia",
    coordinates: { latitude: -34.7578, longitude: 138.6834 },
    verifiedAt: "2026-10-04",
    directionsUrl:
      "https://www.google.com/maps/dir/?api=1&destination=20%20Prunus%20Ave%2C%20Elizabeth%20Vale%20SA%205112%2C%20Australia",
    mapEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3278.0861872991422!2d138.66031787548314!3d-34.75342166541935!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6ab0ad918429ad09%3A0x94810a85444deebe!2sHF%20Removals%20Adelaide!5e0!3m2!1sen!2sau!4v1787515237189!5m2!1sen!2sau",
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

/**
 * Published local moving packages — the ONE place the local rates are stored.
 * The public pricing UI, quote form, booking wizard, meta copy, FAQ answers and
 * the server-side package names all derive from this table. The booking API's
 * authoritative charge still comes from the pricing_rules table, seeded with the
 * same cents (supabase/migrations/0001_booking_system.sql); a test keeps the two
 * in step.
 */
export const billingIncrementMinutes = 30;
export const minimumServiceMinutes = 180;
export const calloutMinutes = 60;

export type TruckClass = "HR" | "MR" | "Small";

/**
 * Branded marketing imagery (cropped from the supplied HF concept artwork, with all
 * poster text removed). Presented as branded visuals, not documentary proof of the
 * exact physical fleet. Important copy is always rebuilt as HTML around these images.
 */
export const hfImages = {
  heroFleet: { src: "/images/hf/hero/hf-hero-fleet-crew.webp", width: 667, height: 360, alt: "HF Removals green truck and two movers carrying wrapped furniture outside a modern Adelaide home" },
  crewService: { src: "/images/hf/crew/hf-crew-service.webp", width: 380, height: 535, alt: "Smiling HF Removals mover carrying an HF-branded moving box with a crew mate and furniture behind" },
  carefulHandling: { src: "/images/hf/protection/hf-careful-handling.webp", width: 460, height: 372, alt: "Two HF Removals movers carrying a mattress wrapped in protective film past stacked HF boxes and moving blankets" },
  customersCrew: { src: "/images/hf/crew/hf-customers-crew.webp", width: 622, height: 310, alt: "HF Removals truck and crew carrying wrapped furniture at a customer's home" },
  serviceArea: { src: "/images/hf/locations/hf-adelaide-service-area.webp", width: 390, height: 262, alt: "HF Removals truck driving along an Adelaide road" },
} as const;

/** Customer-facing message when no active vehicle of the chosen class can take an online booking. */
export const TRUCK_UNAVAILABLE_MESSAGE = `This truck is currently unavailable for online booking. Please call ${business.phones[0].display} or choose another truck.`;

/** The three truck options sold on the homepage, pricing page, quote form and booking wizard. */
export const truckPackages = [
  {
    id: "hr-16t-2men",
    truckClass: "HR",
    name: "HR Truck",
    tonnage: 16,
    crewSize: 2,
    ratePer30MinCents: 7900,
    sizeLabel: "Large",
    headline: "Larger houses and bigger loads",
    bestFor: ["Larger houses", "Larger furniture loads", "Bigger residential moves"],
    alt: "HF Removals HR 16 ton truck and two movers carrying wrapped furniture outside a large Adelaide home",
    image: { src: "/images/hf/fleet/hf-hr-truck-16-ton.webp", width: 657, height: 480, objectPosition: "50% 40%" },
    story: { question: "Big house?", answer: "We have a big truck." },
    bestForLine: "Bigger houses and larger moves.",
  },
  {
    id: "mr-12t-2men",
    truckClass: "MR",
    name: "MR Truck",
    tonnage: 12,
    crewSize: 2,
    ratePer30MinCents: 7400,
    sizeLabel: "Medium",
    headline: "Medium house moves",
    bestFor: ["Medium-size house moves", "Medium furniture loads", "Customers who don't need the largest truck"],
    alt: "HF Removals MR 12 ton truck with two movers carrying wrapped furniture in a suburban street",
    image: { src: "/images/hf/fleet/hf-mr-truck-12-ton.webp", width: 622, height: 450, objectPosition: "50% 40%" },
    story: { question: "Medium move?", answer: "We have the right truck." },
    bestForLine: "Ideal for medium-size moves.",
  },
  {
    id: "small-8t-2men",
    truckClass: "Small",
    name: "Small Truck",
    tonnage: 8,
    crewSize: 2,
    ratePer30MinCents: 6900,
    sizeLabel: "Small",
    headline: "Apartments and smaller moves",
    bestFor: ["Apartments and units", "Smaller moves", "Selected furniture and smaller loads"],
    alt: "HF Removals crew carrying wrapped furniture past the Small 8 ton truck outside an Adelaide apartment building",
    image: { src: "/images/hf/fleet/hf-small-truck-8-ton.webp", width: 547, height: 460, objectPosition: "50% 35%" },
    story: { question: "Apartment or small move?", answer: "We have a smaller truck." },
    bestForLine: "Perfect for apartments and smaller moves.",
  },
] as const;

/**
 * Crew upgrade (not one of the three headline truck options). Kept so the 3-mover
 * rate still prices correctly; the truck is assigned to suit the load.
 */
export const crewUpgradePackages = [
  { id: "3-men", truckClass: null, name: "3 Movers + Truck", tonnage: null, crewSize: 3, ratePer30MinCents: 9900 },
] as const;

/** Thumbnail for pickers/summaries; the crew-upgrade has no truck of its own, so it shows the crew. */
export const crewUpgradeImage = { src: "/images/hf/crew/hf-crew-service.webp", width: 380, height: 535, objectPosition: "50% 30%" } as const;

/**
 * Retired package, kept ONLY so historical bookings/holds made before the truck
 * options (crew_size 2, no package_id) still resolve a name and rate. Never offered.
 */
export const legacyPackages = [
  { id: "2-men", truckClass: null, name: "2 Movers + Truck", tonnage: null, crewSize: 2, ratePer30MinCents: 7900 },
] as const;

/** Every package a customer can currently book online. */
export const movingPackages = [...truckPackages, ...crewUpgradePackages] as const;

const allKnownPackages = [...movingPackages, ...legacyPackages] as const;

export type MovingPackage = (typeof movingPackages)[number];
export type MovingPackageId = MovingPackage["id"];
export type KnownPackage = (typeof allKnownPackages)[number];
export type TruckPackage = (typeof truckPackages)[number];
export type TruckPackageId = TruckPackage["id"];

/** Formats integer cents as AUD for display, dropping ".00" for whole dollars. */
export function formatAud(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/**
 * Resolve a package by stable id. A bare crewSize resolves only when unambiguous:
 * 3 movers -> the crew upgrade, 2 movers -> the retired "2-men" package. (The three
 * truck options all share crewSize 2, so crewSize alone can never pick a truck.)
 */
export function findMovingPackage(by: { id?: string; crewSize?: number }): KnownPackage | undefined {
  if (by.id !== undefined) return allKnownPackages.find((item) => item.id === by.id);
  const crewSize = by.crewSize;
  if (crewSize === undefined) return undefined;
  const bookable = movingPackages.filter((item) => item.crewSize === crewSize);
  if (bookable.length === 1) return bookable[0];
  return legacyPackages.find((item) => item.crewSize === crewSize);
}

export function isBookablePackageId(id: string): id is MovingPackageId {
  return movingPackages.some((item) => item.id === id);
}

/** Maps a free-text vehicles.vehicle_type onto a truck class, or null when it can't be told. */
export function truckClassForVehicleType(vehicleType: string | null | undefined): TruckClass | null {
  const value = (vehicleType ?? "").trim().toLowerCase();
  if (!value) return null;
  if (/\bhr\b|\b16\s*(t|ton)/.test(value)) return "HR";
  if (/\bmr\b|\b12\s*(t|ton)/.test(value)) return "MR";
  if (/\bsmall\b|\b8\s*(t|ton)/.test(value)) return "Small";
  return null;
}

export function formatTonnage(tonnage: number): string {
  return `${tonnage} Ton`;
}

interface DisplaySource {
  id: string;
  crewSize: number;
  name: string;
  ratePer30MinCents: number;
  tonnage: number | null;
  truckClass: TruckClass | null;
}

function toDisplayRow<T extends DisplaySource>(item: T) {
  return {
    id: item.id as T["id"],
    crewSize: item.crewSize,
    name: item.name,
    truckClass: item.truckClass as T["truckClass"],
    tonnage: item.tonnage,
    capacity: item.tonnage ? formatTonnage(item.tonnage) : null,
    crewLabel: `${item.crewSize} Men`,
    ratePer30MinCents: item.ratePer30MinCents,
    halfHour: formatAud(item.ratePer30MinCents),
    hourly: formatAud(item.ratePer30MinCents * (60 / billingIncrementMinutes)),
    callout: formatAud(item.ratePer30MinCents * (calloutMinutes / billingIncrementMinutes)),
    note: "per 30 minutes",
  };
}

/** Display rows for the three truck options, derived from truckPackages. */
export const truckPricing = truckPackages.map((item) => ({
  ...toDisplayRow(item),
  sizeLabel: item.sizeLabel,
  headline: item.headline,
  bestFor: item.bestFor,
  bestForLine: item.bestForLine,
  story: item.story,
  alt: item.alt,
  image: item.image,
}));

/** Display rows for every bookable package (trucks + crew upgrade). */
export const localPricing = movingPackages.map((item) => toDisplayRow(item));

/** The crew-upgrade display row(s), shown as secondary information only. */
export const crewUpgradePricing = crewUpgradePackages.map((item) => toDisplayRow(item));

/**
 * Cheapest published local rate. Headlines, meta copy, the trust strip and the quote
 * form banner all quote "from" pricing, so they read this instead of repeating the
 * figure and drifting apart at the next price change.
 */
export const entryLocalRate = truckPricing.reduce((lowest, row) => (row.ratePer30MinCents < lowest.ratePer30MinCents ? row : lowest));

/** One-line summary of all three truck rates for copy, FAQs and meta text. */
export const truckRateSummary = truckPricing.map((row) => `${row.name} (${row.capacity}) ${row.halfHour} per 30 minutes`).join(", ");

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
      `Choose the truck that suits your move, each with a 2-man crew: ${truckRateSummary} (${truckPricing.map((row) => `${row.hourly}/hr`).join(", ")} hourly equivalent). A 3-hour minimum service and a separate 1-hour call-out fee apply — the call-out covers truck fuel and basic transport charges, not extra labour time. Additional service time beyond the 3-hour minimum is billed in 30-minute increments, and your final price is calculated when the job is completed.`,
  },
  {
    question: "Do I need to pay anything upfront to book online?",
    answer:
      "No. Booking online through Book Your Move requires no advance payment — choose an available time, review your booking and confirm it. Your final price is calculated once the move is complete, based on actual billable time (3-hour minimum service plus a separate 1-hour call-out fee).",
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
      "We recommend booking 1–2 weeks in advance once your moving date is confirmed. Our Google Business Profile lists us as open 24 hours, every day, and same-day or urgent move requests may be accommodated when truck capacity allows.",
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
    title: "A practical plan for moving home",
    description: "Residential removalists in Adelaide for homes, apartments and townhouses. Plan house moving, furniture protection, packing support and destination placement with HF Removals Adelaide.",
    intro:
      "HF Removals Adelaide provides house removals for homes, apartments and townhouses across Adelaide. We plan around your inventory, property access, furniture protection and destination placement so the quote reflects the actual move.",
    highlights: ["Homes, apartments and townhouses", "Room-by-room inventory", "Packing and protective wraps", "Placement at your destination"],
    sections: [
      { title: "Choose support for a whole-home move", body: "Use residential removals when you need to coordinate belongings from several rooms, including cartons, furniture and appliances, in one move plan. For a few selected bulky pieces, a furniture-removal enquiry may be a better starting point. For a home moving interstate, include the destination route so the quote can be assessed using the appropriate scope." },
      { title: "Prepare the house move", body: "Build a room-by-room inventory and include garages, outdoor items, fragile pieces and bulky furniture. Note stairs, lifts, gates and parking at both addresses." },
      { title: "Homes, apartments and townhouses", body: "Share the property type, entry path, lift or loading-zone requirements and any tight access before moving day so loading can be planned around the building." },
      { title: "Furniture moving and placement", body: "List lounges, beds, tables, appliances and other large furniture. Available protection includes moving blankets, shrink wrap, bubble wrap, mattress protection and side-table protective wrapping; label destination rooms and identify priority items for the unload." },
      { title: "Agree the preparation and moving-day sequence", body: "Decide whether you need full or partial packing and discuss furniture dismantling before moving day. Keep keys and essentials with you, make the agreed entry path accessible and prepare room labels for arrival." },
      { title: "Request a house removals quote", body: "Send the pickup and delivery addresses, preferred date, property sizes, room inventory and access notes. Explain whether the move includes selected rooms, the whole home or apartment access so HF can review the team, truck and work required." },
    ],
    faqs: [
      { question: "What should I include in a house moving quote?", answer: "Share both addresses, your preferred date, property type and a room-by-room inventory. Include garage and outdoor contents, stairs, lifts, parking and furniture that may need dismantling." },
      { question: "Can you help with apartment and townhouse moves?", answer: "Yes. Include any lift booking, loading-zone restrictions, stairs and narrow entries at both buildings so the move can be planned around the access available." },
      { question: "Can I request packing help for my home move?", answer: "Full or partial packing and unpacking support is available. Tell HF which rooms or items need help, and keep documents, medication, keys and first-night essentials with you." },
      { question: "How is a local house move charged?", answer: `Pick the truck that fits the move, each with a 2-man crew: ${truckRateSummary}. A 3-hour minimum service and a separate 1-hour call-out fee apply. The call-out covers truck fuel and basic transport charges, not extra labour. Additional service time is billed in 30-minute increments, with the final amount calculated when the job is complete.` },
      { question: "What furniture protection is provided for a home move?", answer: "Moving blankets, heavy-duty tie-down straps and trolleys are standard on every truck, with complimentary mattress protection and side-table protective wrapping. Identify fragile belongings and ask about any additional packing work or materials needed for your inventory." },
    ],
  },
  {
    slug: "furniture-removals",
    kind: "service",
    eyebrow: "Furniture removals",
    title: "Move furniture with a clear access plan",
    description: "Furniture removalists in Adelaide for household furniture, bulky pieces and furniture-moving support planned around access, protection and placement.",
    intro:
      "Furniture removals in Adelaide can be a complete household relocation or a smaller job involving selected large pieces. HF scopes the item list, entry paths, stairs or lifts and destination placement before confirming what the move requires.",
    highlights: ["Large furniture inventory", "Entry and access checks", "Protective wrapping", "Destination placement"],
    sections: [
      { title: "A selected-item move starts with the item list", body: "A furniture move can focus on a lounge, bed, table or other selected pieces without treating the enquiry as a full house relocation. List all pieces together, including any accompanying cartons or appliances. A short item list still needs access assessment and is subject to the published local minimum service and call-out terms." },
      { title: "List every large item", body: "Include lounges, beds, tables, cabinets, appliances, mirrors and outdoor furniture. Dimensions for unusually large pieces help identify access or dismantling questions early." },
      { title: "Check the path in and out", body: "Share stairs, lifts, narrow entries, gates, parking and the distance from the truck to each doorway at both addresses." },
      { title: "Protect and place", body: "Discuss suitable blankets, shrink wrap, bubble wrap, mattress protection or side-table wrapping, then label the destination room or placement priority." },
      { title: "Prepare dismantling and reassembly", body: "Identify beds, desks and other furniture that may need to be taken apart. Confirm the required work with HF, empty contents where appropriate and keep labelled fittings together for reassembly." },
      { title: "Request a furniture-moving quote", body: "Provide the complete item list, both addresses, preferred date and dimensions for awkward pieces. Include packing or dismantling requirements and any access booking so a selected-item move can be assessed as carefully as a whole household." },
    ],
    faqs: [
      { question: "Can I enquire about moving only selected furniture?", answer: "Yes. Furniture enquiries can cover selected large pieces or a household inventory. List every item and both addresses; the published local minimum service and call-out terms still need to be considered when planning your budget." },
      { question: "What measurements help with a furniture move?", answer: "Provide dimensions for bulky pieces and measure the narrowest doors, corridors, stairs or lift openings on the route in and out. Photos and access notes can help explain a tight fit before moving day." },
      { question: "Should furniture be dismantled before moving?", answer: "Discuss beds, desks and other large furniture with HF before the move. Disassembly and reassembly are available; confirm which items need this work rather than assuming every piece must be taken apart." },
      { question: "What protection can I discuss for individual furniture pieces?", answer: "Moving blankets, heavy-duty tie-down straps and trolleys are standard truck equipment. Complimentary mattress protection and side-table protective wrapping are provided. Identify glass, mirrors and delicate finishes so HF can discuss suitable wrapping and confirm the preparation needed for those pieces." },
      { question: "Will moving one item avoid the local minimum charge?", answer: "The published local policy is a 3-hour minimum service plus a separate 1-hour call-out fee. Share the complete item list and ask HF to confirm the quote and charging terms for your selected-item enquiry before booking." },
    ],
  },
  {
    slug: "office-commercial-removals",
    kind: "service",
    eyebrow: "Office & commercial removals",
    title: "Coordinate the move around your workplace",
    description: "Office removalists and commercial movers in Adelaide for workplace relocation, office furniture, workstations, equipment, loading access and destination placement.",
    intro:
      "Office and commercial removals in Adelaide benefit from a clear inventory, named site contacts and an agreed placement plan. HF works from the workplace details you provide, from loading access and lifts to workstation, office furniture and equipment destinations.",
    highlights: ["Office furniture", "Workstations and equipment", "Access coordination", "Destination labelling"],
    sections: [
      { title: "Define the physical workplace relocation", body: "This enquiry is for moving workplace furniture, cartons and equipment between sites. Identify desks or other furniture needing disassembly and reassembly, and specify any packing help separately. Assign equipment preparation, data backups and reconnection to the responsible workplace contacts so those tasks are accounted for in your own relocation plan." },
      { title: "Create a workplace inventory", body: "Group office furniture, workstations, equipment, archives and cartons by team, room or destination zone. Identify items that need separate preparation or handling discussion." },
      { title: "Confirm loading access", body: "Share loading areas, lift requirements, parking restrictions, building rules and site contacts for both ends of the commercial relocation." },
      { title: "Plan destination placement", body: "A labelled floor plan and clearly marked cartons help direct desks, chairs, equipment and furniture to the intended workplace area." },
      { title: "Prepare equipment and a move sequence", body: "Agree who will prepare and disconnect workplace equipment, identify fragile devices and separate records or items that must remain accessible. Share any required sequence for moving teams or rooms without assuming a particular completion time." },
      { title: "Request a commercial removals quote", body: "Send the inventory, site addresses, preferred date, building contacts and access restrictions. Include dismantling, packing and placement needs so the proposed scope matches the workplace relocation." },
    ],
    faqs: [
      { question: "What information is needed for an office relocation quote?", answer: "Provide both workplace addresses, a furniture and equipment inventory, preferred date, site contacts and building access rules. A destination floor plan or labels by team and room help explain placement requirements." },
      { question: "How should office equipment and archives be prepared?", answer: "Identify fragile devices and equipment that needs separate preparation. Group cartons and archives by destination area, and confirm who will disconnect and prepare equipment before it is moved." },
      { question: "Can a commercial move be planned around building access windows?", answer: "Share lift booking windows, loading restrictions, security requirements and site contacts with HF. Confirm the proposed move timing directly before arranging building access or staff attendance." },
      { question: "How do I specify desk dismantling and packing work?", answer: "List the desks or other furniture needing disassembly and reassembly, and identify the rooms, archives or items requiring packing support. HF offers these services; confirm the exact work and materials in your individual quote rather than assuming every preparation task is included." },
      { question: "Can you promise that the office will be ready to reopen at a set time?", answer: "Confirm the physical moving scope and proposed timing directly with HF. Your workplace plan should also allow for equipment reconnection, IT checks and staff setup; the website does not publish a guaranteed reopening time." },
    ],
  },
  {
    slug: "interstate-removals",
    kind: "service",
    eyebrow: "Interstate removals",
    title: "Plan your Adelaide interstate relocation",
    description: "Interstate removalists in Adelaide for Adelaide interstate removals, with per-cubic-metre reference pricing, route planning, inventory and access preparation.",
    intro:
      "HF provides interstate removals between Adelaide and the listed destinations. A useful quote starts with an accurate inventory, cubic-volume estimate, access details at both ends and a clear route.",
    highlights: ["Adelaide interstate routes", "Per-m³ reference pricing", "Inventory and volume planning", "Packing and protection"],
    sections: [
      { title: "Plan the complete interstate relocation", body: "Start with the pickup suburb, destination city, suburb and postcode, preferred dates and property types at both ends. This service suits a household or furniture move crossing state boundaries; the destination route and cubic volume need assessment rather than relying on the local hourly rate." },
      { title: "Build an inventory and volume", body: "List furniture, appliances, cartons, plants, garage items and unusually large pieces. Dimensions for bulky items help establish a more useful cubic-metre estimate." },
      { title: "Understand per-m³ reference pricing", body: "The listed Melbourne, Sydney, Queensland and Perth figures are reference rates per cubic metre, not total move prices. Final pricing depends on confirmed volume and the complete scope." },
      { title: "Confirm loading and access", body: "Share stairs, lifts, driveways, parking, loading zones, gates and the carry distance from the truck to each doorway at origin and destination." },
      { title: "Prepare and protect belongings", body: "Identify fragile, high-care and bulky items early. Packing support, blankets, shrink wrap, bubble wrap and mattress or side-table protection can be discussed against the inventory." },
      { title: "Scope the route and quote", body: "HF reviews the complete origin-to-destination route, inventory and access details before confirming what applies to your individual enquiry." },
      { title: "Prepare for pickup and destination handover", body: "Keep your travel documents, medication, keys and personal essentials with you. Name a contact for each property, label cartons for their destination rooms and identify any fixed lift or access window. Confirm pickup and delivery arrangements with HF before making travel or building bookings that depend on the move." },
    ],
    faqs: [
      { question: "How is an Adelaide interstate move quoted?", answer: "HF reviews the route, itemised inventory, cubic-volume estimate, packing requirements and access at both addresses. Published route figures are reference rates per cubic metre, not a fixed total for your move." },
      { question: "Which interstate route information should I provide?", answer: "Include the pickup and destination city, suburb and postcode, your preferred moving date and any timing constraints. For a Queensland enquiry, the actual destination is needed rather than the state name alone." },
      { question: "Is an interstate delivery time guaranteed?", answer: "No fixed transit time or departure schedule is published here. Confirm pickup and delivery arrangements for your individual enquiry directly with HF before making dependent travel or access bookings." },
      { question: "Can I ask about backloading for my interstate move?", answer: "Yes. Backloading suitability depends on whether available capacity aligns with your destination, inventory and timing. It must be assessed for the individual enquiry." },
      { question: "Can packing and furniture dismantling be part of an interstate enquiry?", answer: "Yes. HF offers full or partial packing and unpacking, plus disassembly and reassembly of beds, desks and large furniture. List the items and work needed at each address so the materials and service scope can be confirmed with your interstate quote." },
    ],
  },
  {
    slug: "backloading",
    kind: "service",
    eyebrow: "Backloading",
    title: "Flexible interstate capacity, properly scoped",
    description: "Backloading removals from Adelaide: discuss your destination, inventory, date flexibility and access with HF to assess suitability and request a quote.",
    intro:
      "Backloading from Adelaide is an option to ask about when your interstate belongings may fit available transport capacity and you have room to adjust pickup or delivery dates. HF needs your item list, complete route and acceptable date windows to assess whether the available space and timing suit your move.",
    highlights: ["Available capacity assessment", "Pickup and delivery flexibility", "Itemised volume estimate", "Confirmed transport scope"],
    sections: [
      { title: "Decide whether flexible capacity suits you", body: "Backloading may be worth assessing for a household inventory or selected furniture when the route, space and timing align. Tell HF if keys, settlement, a lease end or building access creates a fixed deadline. Those constraints need to be considered before you rely on backloading for the move." },
      { title: "Start with an inventory", body: "List furniture, appliances, cartons and unusual items. Add dimensions where practical to reduce uncertainty in the volume estimate." },
      { title: "Share destination detail", body: "A destination city, suburb and postcode are needed before suitability or pricing can be assessed." },
      { title: "Give separate pickup and delivery windows", body: "State the earliest and latest dates you can accept at each address, then identify which dates are fixed. Explain who can release and receive the belongings within those windows. HF can use this information to assess available capacity; a preferred date alone does not confirm a transport arrangement." },
      { title: "Confirm packing readiness and access", body: "Explain whether belongings are packed, whether furniture needs dismantling and whether you want packing support. Include stairs, lifts, parking and loading arrangements at both properties so access constraints are considered alongside available capacity." },
      { title: "Assess the full move before booking arrangements", body: "Share preferred dates and any fixed constraints when requesting a quote. Confirm the proposed transport scope, inclusions and pickup or delivery arrangements directly before making dependent plans." },
    ],
    faqs: [
      { question: "When might backloading suit my move?", answer: "It may suit an eligible interstate move when available transport capacity matches the destination and inventory. Share your date flexibility so HF can assess the enquiry; availability is not promised." },
      { question: "Is backloading always cheaper than an interstate move?", answer: "Do not assume a discount or fixed price. Ask HF to assess your inventory, route, access and timing, then compare quotes for the same scope and inclusions." },
      { question: "What should be ready before a backloading enquiry?", answer: "Provide an itemised inventory, estimated carton count, dimensions for bulky items, both addresses and packing requirements. Explain any fixed pickup or delivery constraints." },
      { question: "Can I request backloading if my delivery date is fixed?", answer: "You can enquire, but give HF the exact deadline and any access booking window. Suitability depends on available capacity matching your route, inventory and timing. Confirm an arrangement directly before relying on it for keys, travel or building bookings." },
      { question: "Does an interstate per-m³ rate confirm a backloading price?", answer: "No. The published interstate figures are route reference rates per cubic metre. A backloading quote still requires assessment of your inventory, available capacity, access, dates and packing requirements; confirm the total scope and price for your enquiry." },
    ],
  },
  {
    slug: "packing-unpacking",
    kind: "service",
    eyebrow: "Packing & unpacking",
    title: "Prepare, protect and place with more support",
    description: "Packing and unpacking services in Adelaide for full or partial moving preparation. Discuss rooms, fragile items, furniture protection and quote requirements with HF.",
    intro:
      "Packing and unpacking support in Adelaide can be included when you want help preparing belongings for loading or organising placement after arrival. The scope is tailored to the inventory and materials required.",
    highlights: [...business.packingMaterials],
    sections: [
      { title: "Match the service to the preparation you need", body: "Full packing may suit a move where you want help across the home; partial packing can focus on selected rooms or belongings while you prepare the rest. Unpacking is a separate part of the scope to discuss for the destination. State clearly whether your enquiry covers packing, unpacking or both, alongside any furniture-moving requirements." },
      { title: "Decide the level of help", body: "Tell HF whether you need complete packing support, help with selected rooms or protection for specific furniture." },
      { title: "Separate essentials", body: "Keep medication, keys, documents, chargers and first-night essentials with you rather than inside general moving cartons." },
      { title: "Label for placement", body: "Mark each carton with its destination room and any handling notes to support an organised unload." },
      { title: "Identify fragile and awkward items", body: "List glass, mirrors, delicate belongings and furniture finishes needing attention. Discuss materials and preparation with HF instead of treating every item as a standard carton." },
      { title: "Plan unpacking priorities", body: "Decide which rooms and belongings you want help organising after arrival. Provide destination labels and keep essential items separate so the unpacking scope is clear." },
      { title: "Request a packing quote", body: "Share the rooms or items involved, approximate carton count, moving date and whether help is needed before loading, after arrival or both. Confirm materials and inclusions for your individual scope." },
    ],
    faqs: [
      { question: "Can I request packing help for selected rooms?", answer: "Yes. HF offers full or partial packing and unpacking support. Explain which rooms, cartons or furniture need assistance so the scope and materials can be discussed." },
      { question: "What should I keep out of moving cartons?", answer: "Keep medication, keys, important documents, valuables, chargers and first-night essentials with you. Label destination rooms and identify fragile items for handling discussion." },
      { question: "Are packing materials included in every packing enquiry?", answer: "Discuss the materials required and confirm what applies to your packing scope. Existing furniture protection includes moving blankets, shrink wrap, bubble wrap, complimentary mattress protection and side-table protective wraps." },
      { question: "Does a packing enquiry automatically include unpacking?", answer: "Specify whether you want packing before loading, unpacking at the destination or both. Full and partial support are available, but the rooms, items, materials and work must be agreed for your move." },
    ],
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
      { title: "Coordinate homes, units and workplaces", body: "If a lift, loading area or site contact must be coordinated, include that information in the quote request." },
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

const routePlanning: Record<string, { title: string; body: string }[]> = {
  "adelaide-melbourne": [
    { title: "Coordinate the Adelaide pickup and Melbourne handover", body: "Keep the two address records separate: pickup inventory and loading access in Adelaide, then the Melbourne destination contact, parking position and room placement plan. If either property has a lift or loading booking, share the allowed window before confirming arrangements." },
    { title: "Prepare room labels for the Melbourne property", body: "Label cartons and furniture for the rooms at the destination rather than only their original rooms. Identify items needed first after arrival and keep keys, documents and personal essentials outside the moving inventory." },
  ],
  "adelaide-sydney": [
    { title: "Describe the Sydney destination building", body: "Include the destination suburb, postcode, property type and entry details. For an apartment or workplace, check lift dimensions, loading access, building contacts and booking requirements; for a house, describe gates, stairs and the carry from parking to the doorway." },
    { title: "Match large furniture to the delivery access", body: "Compare bulky furniture dimensions with the narrowest doorway, corridor or lift opening at the Sydney property. Flag uncertain fits and dismantling questions before loading in Adelaide, and provide a destination placement plan." },
  ],
  "adelaide-queensland": [
    { title: "Specify where in Queensland the move ends", body: "Queensland is a state rather than one delivery point. Provide the actual city, suburb, postcode and destination access notes so HF can assess the route and scope against the published reference rate." },
    { title: "Plan contact and access at the Queensland property", body: "Name the person who can receive the belongings and describe parking, lifts, stairs, gates and room placement. Share any date constraints for assessment rather than assuming one timetable applies to every Queensland destination." },
  ],
  "adelaide-perth": [
    { title: "Prepare the complete Adelaide to Perth inventory", body: "Include garage and outdoor contents, appliances, carton counts and bulky furniture alongside the main rooms. Note fragile items and packing support needed before loading so the volume estimate represents the full interstate move." },
    { title: "Separate personal travel from the Perth delivery plan", body: "Keep documents, medication, keys and first-arrival essentials with you. Provide a Perth destination contact and access details, and confirm individual pickup and delivery arrangements before relying on them for travel or building bookings." },
  ],
};

export const interstateRoutes: ContentPage[] = routeDetails.map(([slug, destination, price, angle]) => ({
  slug,
  kind: "route",
  eyebrow: `Adelaide ↔ ${destination}`,
  title: `Plan your Adelaide to ${destination} move`,
  description: `Adelaide to ${destination} removals with a ${price} per m³ reference rate and inventory-led planning.`,
  intro: `Plan an interstate furniture or household move between Adelaide and ${destination} with HF Removals Adelaide. ${angle} The published rate is a per-cubic-metre reference, not a total move price.`,
  highlights: ["Inventory and volume estimate", "Access at both addresses", "Packing requirements", "Destination details"],
  price,
  unit: "per m³",
  sections: [
    { title: "How volume pricing works", body: `The ${price} rate applies per cubic metre. Final move cost depends on the volume and scope of the move.` },
    { title: "Prepare your inventory", body: "List furniture, appliances, cartons and high-care items. Dimensions for bulky pieces help improve the volume estimate." },
    { title: "Confirm both addresses", body: "Share origin and destination suburbs or postcodes plus stairs, lifts, parking and loading access." },
    ...routePlanning[slug],
    { title: "Discuss protection and packing before pickup", body: "Identify fragile items, mattresses, mirrors and furniture requiring protective wrapping. Explain whether you will pack yourself or need full or partial packing support, and confirm the materials and work included in your individual scope." },
    { title: "Confirm timing and backloading suitability", body: "Share your preferred dates and any fixed access constraints. Ask whether backloading may suit the route and inventory; available capacity and pickup or delivery arrangements must be confirmed for the individual move." },
  ],
  faqs: [
    { question: `Is ${price} the total price to ${destination}?`, answer: `No. ${price} is the published reference rate per cubic metre. Final cost depends on volume and scope.` },
    { question: "Is a fixed transit time promised?", answer: "No fixed transit time or departure schedule is published here. Confirm timing for your individual move directly with HF." },
  ],
}));

const guideSeed = [
  ["adelaide-moving-checklist", "Adelaide Moving Checklist", "Build a calm sequence from early inventory to final placement.", ["Create a room-by-room inventory", "Confirm both addresses and access", "Book packing support if needed", "Label cartons by destination room"]],
  ["how-removalist-pricing-works", "How Removalist Costs Are Calculated", "Learn how hourly moving costs, minimum service, call-out fees, access and interstate volume affect a removalist quote. Use the pricing page for HF's published rates.", ["Understand service time and call-out fees", "Identify what affects loading and unloading", "Estimate interstate volume separately", "Compare quotes using the same scope"]],
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
    "For a local HF move, separate the labour service from the call-out. The published policy is a 3-hour minimum service plus a separate 1-hour call-out fee covering truck fuel and basic transport charges, not an additional hour of labour. Service time beyond the minimum is billed in 30-minute increments, and the final amount is calculated when the job is completed. The pricing page lists the current team-and-truck rates.",
    "A property-size label alone does not describe the whole job. The inventory, number of movers, truck requirements, stairs or lifts, parking, carry distance, dismantling and packing needs help explain the work involved. Provide the same access details for pickup and delivery; these details support an estimate rather than a promised duration.",
    "Interstate reference rates use cubic metres rather than local hourly units. List furniture, appliances, cartons and garage or outdoor contents, then measure unusually large pieces. A per-m³ rate is not the total move price: confirmed volume, route and complete scope still need to be assessed.",
    "Send each provider the same inventory, both addresses, preferred date and access notes. Check the number of movers, charging unit, minimum service, call-out treatment, packing work and other inclusions in the quote. Ask about anything unclear rather than comparing an hourly figure with an interstate volume rate or assuming a fee is included.",
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

const guideFaqs: Record<string, Faq[]> = {
  "adelaide-moving-checklist": [
    { question: "What should I check before requesting a moving quote?", answer: "Prepare both addresses, your preferred date and a room-by-room item list. Include garages and outdoor belongings, then record parking, stairs, lifts and the path from the truck to each property." },
    { question: "What should stay with me on moving day?", answer: "Keep keys, documents, medication, valuables, chargers and first-night essentials separate from the load. Label destination rooms before unloading so cartons and furniture can be directed clearly." },
  ],
  "estimate-moving-volume": [
    { question: "Is a bedroom count enough to estimate moving volume?", answer: "A bedroom count is a starting point rather than an inventory. Include the actual furniture, appliances and packed cartons, plus garage, shed and outdoor items. Measure unusually large pieces so HF can review the volume and scope." },
    { question: "How do I account for items that will be dismantled?", answer: "List the item and its dimensions, and explain whether it will travel assembled or dismantled. Confirm who will dismantle it and keep the parts together; do not assume that a flat-packed size applies to an assembled piece." },
  ],
  "preparing-interstate-move": [
    { question: "What timing should I confirm for an interstate move?", answer: "Discuss pickup and delivery separately, including any fixed deadline and building access window at either end. Do not make plans around an assumed departure or transit time; confirm the arrangements for your move with HF." },
    { question: "What destination details does an interstate enquiry need?", answer: "Provide the delivery city, suburb, postcode and address, together with the item list and access notes. A state name alone does not describe the full route or the work needed at the destination." },
  ],
  "apartment-moving-preparation": [
    { question: "Which building arrangements should I check before moving?", answer: "Ask building management about lift reservations, loading positions, access hours and shared-area requirements at both properties. Include those conditions in your enquiry so the moving plan can be reviewed against them." },
    { question: "What if furniture may not fit in the lift or doorway?", answer: "Measure the piece and the narrowest doors, corridors, stairs and lift openings along its path. Send those measurements to HF before moving day and discuss dismantling where relevant rather than assuming the item will fit." },
  ],
  "office-relocation-checklist": [
    { question: "How should we label office furniture and equipment?", answer: "Use the destination room, team or workstation label and share a placement plan. Nominate a contact at each site so questions about security, access and final positioning can be resolved during the move." },
    { question: "Who should prepare IT equipment before an office move?", answer: "Arrange backups, disconnection and reconnection with your own IT contact. Identify devices that need separate handling and discuss their physical transport with HF; a furniture move does not imply IT installation support." },
  ],
  "packing-before-moving-day": [
    { question: "Which rooms should I pack first?", answer: "Start with stored and low-use belongings, then work toward everyday rooms. Leave an essentials bag accessible and label cartons with their destination room and a short contents description." },
    { question: "How do I request help with only part of the packing?", answer: "List the rooms or items you want HF to help prepare, what is already packed and any fragile pieces. Discuss materials and unpacking separately so the agreed scope is clear." },
  ],
  "preparing-large-furniture": [
    { question: "Which measurements matter for large furniture?", answer: "Record the piece's dimensions and the narrowest doorways, stair turns, corridors and lift openings at both addresses. Include the carry path and loading position so HF can review the access." },
    { question: "Should I dismantle furniture before moving day?", answer: "Discuss each piece with HF first and agree who will do the work. If dismantling is agreed, label the parts and keep fasteners together for reassembly; do not assume it is included without confirming the scope." },
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
  faqs: slug === "how-removalist-pricing-works" ? [
    { question: "Why is an hourly rate different from the final moving cost?", answer: "An hourly rate is a charging unit, not a total. For local HF moves, consider the 3-hour minimum service, separate 1-hour call-out fee and additional service time billed in 30-minute increments. The actual job determines the final amount." },
    { question: "Does the call-out fee add another hour of moving labour?", answer: "No. HF's published call-out fee covers truck fuel and basic transport charges. It is separate from the service time and should be accounted for separately when estimating the cost." },
    { question: "Where can I find the published HF removalist rates?", answer: "The removalist pricing page lists the local team-and-truck rates and interstate per-cubic-metre reference figures. Use this guide to understand the calculation, then request a quote based on your actual inventory and access." },
  ] : guideFaqs[slug] ?? [],
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
  if (parts.length !== 2) return undefined;
  const [group, slug] = parts;
  if (group === "services") return services.find((page) => page.slug === slug);
  if (group === "areas") return areas.find((page) => page.slug === slug);
  if (group === "interstate") return interstateRoutes.find((page) => page.slug === slug);
  if (group === "guides") return guides.find((page) => page.slug === slug);
  return undefined;
}
