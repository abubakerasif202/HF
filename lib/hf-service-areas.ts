import { areas as featuredAreas, standardMoveFaqs, type ContentPage } from "./site-data";

export type ServiceAreaRegion =
  | "Central Adelaide"
  | "Northern Adelaide"
  | "North-Eastern Adelaide"
  | "Eastern Adelaide"
  | "Adelaide Hills"
  | "Western Adelaide"
  | "Coastal Adelaide"
  | "Southern Adelaide"
  | "Regional SA";

type ServiceAreaSeed = readonly [name: string, region: ServiceAreaRegion];

const serviceAreaSeed: ServiceAreaSeed[] = [
  ["Adelaide CBD", "Central Adelaide"],
  ["Adelaide Parklands", "Central Adelaide"],
  ["Albert Park", "Western Adelaide"],
  ["Allenby Gardens", "Western Adelaide"],
  ["Andrews Farm", "Northern Adelaide"],
  ["Angle Park", "Western Adelaide"],
  ["Athelstone", "Eastern Adelaide"],
  ["Belair", "Adelaide Hills"],
  ["Birkenhead", "Western Adelaide"],
  ["Blackwood", "Adelaide Hills"],
  ["Blakeview", "Northern Adelaide"],
  ["Bridgewater", "Adelaide Hills"],
  ["Brighton", "Coastal Adelaide"],
  ["Burnside", "Eastern Adelaide"],
  ["Campbelltown", "Eastern Adelaide"],
  ["Christies Beach", "Coastal Adelaide"],
  ["Clarence Park", "Southern Adelaide"],
  ["Clearview", "Northern Adelaide"],
  ["Colonel Light Gardens", "Southern Adelaide"],
  ["Coromandel Valley", "Adelaide Hills"],
  ["Croydon", "Western Adelaide"],
  ["Dudley Park", "Western Adelaide"],
  ["Edwardstown", "Southern Adelaide"],
  ["Elizabeth", "Northern Adelaide"],
  ["Elizabeth Downs", "Northern Adelaide"],
  ["Elizabeth Vale", "Northern Adelaide"],
  ["Fairview Park", "North-Eastern Adelaide"],
  ["Ferryden Park", "Western Adelaide"],
  ["Field Park", "Southern Adelaide"],
  ["Findon", "Western Adelaide"],
  ["Fulham", "Western Adelaide"],
  ["Fullarton", "Eastern Adelaide"],
  ["Gawler", "Regional SA"],
  ["Glandore", "Southern Adelaide"],
  ["Glen Osmond", "Adelaide Hills"],
  ["Glenelg", "Coastal Adelaide"],
  ["Glengowrie", "Coastal Adelaide"],
  ["Glenunga", "Eastern Adelaide"],
  ["Golden Grove", "North-Eastern Adelaide"],
  ["Goodwood", "Southern Adelaide"],
  ["Grange", "Coastal Adelaide"],
  ["Hallett Cove", "Coastal Adelaide"],
  ["Hampstead Gardens", "Northern Adelaide"],
  ["Henley Beach", "Coastal Adelaide"],
  ["Henley Beach South", "Coastal Adelaide"],
  ["Hope Valley", "North-Eastern Adelaide"],
  ["Hove", "Coastal Adelaide"],
  ["Hyde Park", "Southern Adelaide"],
  ["Kensington Gardens", "Eastern Adelaide"],
  ["Kidman Park", "Western Adelaide"],
  ["Kilburn", "Northern Adelaide"],
  ["Kings Park", "Southern Adelaide"],
  ["Klemzig", "Eastern Adelaide"],
  ["Largs Bay", "Coastal Adelaide"],
  ["Linden Park", "Eastern Adelaide"],
  ["Locksley", "Western Adelaide"],
  ["Magill", "Eastern Adelaide"],
  ["Malvern", "Southern Adelaide"],
  ["Marion", "Southern Adelaide"],
  ["Mawson Lakes", "Northern Adelaide"],
  ["Medindie", "Central Adelaide"],
  ["Melrose Park", "Southern Adelaide"],
  ["Mile End", "Western Adelaide"],
  ["Mitcham", "Adelaide Hills"],
  ["Moana", "Coastal Adelaide"],
  ["Modbury", "North-Eastern Adelaide"],
  ["Morphett Vale", "Southern Adelaide"],
  ["Mount Barker", "Regional SA"],
  ["Munno Para", "Northern Adelaide"],
  ["Myrtle Bank", "Eastern Adelaide"],
  ["New Port", "Western Adelaide"],
  ["Newton", "Eastern Adelaide"],
  ["Noarlunga", "Southern Adelaide"],
  ["North Adelaide", "Central Adelaide"],
  ["North Park", "Northern Adelaide"],
  ["Northfield", "Northern Adelaide"],
  ["Norwood", "Eastern Adelaide"],
  ["Oaklands Park", "Southern Adelaide"],
  ["Paradise", "North-Eastern Adelaide"],
  ["Parafield Gardens", "Northern Adelaide"],
  ["Payneham", "Eastern Adelaide"],
  ["Pennington", "Western Adelaide"],
  ["Plympton", "Southern Adelaide"],
  ["Port Adelaide", "Western Adelaide"],
  ["Port Noarlunga", "Coastal Adelaide"],
  ["Prospect", "Central Adelaide"],
  ["Reynella", "Southern Adelaide"],
  ["Ridgehaven", "North-Eastern Adelaide"],
  ["Rosemont", "Central Adelaide"],
  ["Rosewater", "Western Adelaide"],
  ["Salisbury", "Northern Adelaide"],
  ["Seacliff", "Coastal Adelaide"],
  ["Seaford", "Coastal Adelaide"],
  ["Seaton", "Western Adelaide"],
  ["Seaton Park", "Western Adelaide"],
  ["Seaton South", "Western Adelaide"],
  ["Semaphore", "Coastal Adelaide"],
  ["Somerton Park", "Coastal Adelaide"],
  ["Somerton Park West", "Coastal Adelaide"],
  ["South Plympton", "Southern Adelaide"],
  ["St Marys", "Southern Adelaide"],
  ["St Peters", "Eastern Adelaide"],
  ["Stepney", "Eastern Adelaide"],
  ["Tea Tree Gully", "North-Eastern Adelaide"],
  ["Toorak Gardens", "Eastern Adelaide"],
  ["Torrensville", "Western Adelaide"],
  ["Trinity Gardens", "Eastern Adelaide"],
  ["Trott Park", "Southern Adelaide"],
  ["Unley", "Southern Adelaide"],
  ["Unley Park", "Southern Adelaide"],
  ["Urrbrae", "Adelaide Hills"],
  ["Valley View", "Northern Adelaide"],
  ["Victor Harbor", "Regional SA"],
  ["Victor Harbor Road Corridor", "Regional SA"],
  ["Walkerville", "Central Adelaide"],
  ["West Beach", "Coastal Adelaide"],
  ["West Croydon", "Western Adelaide"],
  ["West Lakes", "Western Adelaide"],
  ["West Terrace", "Central Adelaide"],
  ["Windsor Gardens", "North-Eastern Adelaide"],
  ["Woodcroft", "Southern Adelaide"],
  ["Woodville", "Western Adelaide"],
  ["Woodville Gardens", "Western Adelaide"],
  ["Yatala Vale", "North-Eastern Adelaide"],
];

export const serviceAreaRegionOrder: ServiceAreaRegion[] = [
  "Central Adelaide",
  "Northern Adelaide",
  "North-Eastern Adelaide",
  "Eastern Adelaide",
  "Adelaide Hills",
  "Western Adelaide",
  "Coastal Adelaide",
  "Southern Adelaide",
  "Regional SA",
];

const regionProfiles: Record<ServiceAreaRegion, { intro: string; access: string; route: string }> = {
  "Central Adelaide": {
    intro: "Inner-city and city-fringe moves often depend on parking, building access, carry distance and timing windows.",
    access: "loading zones, apartment or office access, restricted parking and shorter street-frontage windows",
    route: "city traffic, timed access and the position of the truck at both addresses",
  },
  "Northern Adelaide": {
    intro: "Northern Adelaide moves commonly involve family homes, units, garages and estate-style access.",
    access: "driveways, garage contents, unit access, street parking and larger household inventories",
    route: "Main North Road and northern corridor travel where relevant to the actual addresses",
  },
  "North-Eastern Adelaide": {
    intro: "North-eastern moves can combine suburban streets with slopes, estate access and larger household furniture.",
    access: "sloped driveways, estate streets, garage contents and furniture carry paths",
    route: "north-eastern corridor traffic and the most practical truck approach to each property",
  },
  "Eastern Adelaide": {
    intro: "Eastern Adelaide moves often include character homes, units, townhouses and tighter residential streets.",
    access: "narrow entries, kerbside parking, older-home layouts, stairs and careful furniture handling",
    route: "local traffic, school or retail activity and the most practical loading position",
  },
  "Adelaide Hills": {
    intro: "Hills moves benefit from early access planning because gradients, long driveways and turning space can affect loading.",
    access: "slopes, longer driveways, turning space, stairs and longer furniture carry distances",
    route: "hills roads, driveway approach and any access limits relevant to the truck",
  },
  "Western Adelaide": {
    intro: "Western Adelaide includes homes, units, commercial pockets and port-side routes with varied access conditions.",
    access: "mixed residential access, unit entries, driveway position, parking and commercial-adjacent streets",
    route: "western corridor traffic, port-side activity where relevant and truck positioning",
  },
  "Coastal Adelaide": {
    intro: "Coastal moves often need extra attention to parking, apartments, shared entries and busy beachside streets.",
    access: "coastal parking, apartment or townhouse entries, shared driveways and weekend traffic",
    route: "beachside congestion, local parking limits and the carry path from truck to door",
  },
  "Southern Adelaide": {
    intro: "Southern Adelaide moves commonly combine family homes, townhouses, garages and storage-linked inventories.",
    access: "garage-heavy loads, driveways, townhouse stairs, unit access and larger household inventories",
    route: "southern corridor traffic and the most practical approach to pickup and delivery",
  },
  "Regional SA": {
    intro: "Regional and outer-metro enquiries need a complete route, accurate inventory and clear access notes at both ends.",
    access: "longer travel, larger properties, driveways, storage or shed contents and destination access",
    route: "the complete origin-to-destination route, travel distance and any regional access constraints",
  },
};

const localAccessOverrides: Record<string, string> = {
  "adelaide-cbd": "service lifts, loading zones, apartment towers and office access windows",
  "north-adelaide": "heritage-style properties, parking controls and careful furniture carry paths",
  glenelg: "beachside apartments, coastal parking, shared entries and weekend activity",
  marion: "family homes, townhouses, shared unit access and Marion Road or South Road approaches",
  salisbury: "family homes, storage items, units and Main North Road access",
  elizabeth: "full household inventories, garage items and northern access conditions",
  "elizabeth-vale": "units, townhouses, hospital-area traffic and practical driveway or kerb access",
  blakeview: "estate homes, driveways, garage contents and school-run timing",
  gawler: "family homes, townhouse access and longer Adelaide-to-regional travel planning",
  "andrews-farm": "new-build and estate moves with driveway access and larger family inventories",
  "mawson-lakes": "apartments, lift access, shared entries and estate-style streets",
  norwood: "The Parade, tighter streets, older homes, apartments and careful furniture access",
  "hallett-cove": "sloped streets, hill access, split-level homes and apartment or townhouse moves",
  "henley-beach": "beachside apartments, homes, parking pressure and shared-entry access",
  "port-adelaide": "heritage streets, port-side access and mixed residential-commercial moves",
  blackwood: "sloped driveways, larger furniture and hills access planning",
  "mount-barker": "estate homes, longer metro travel, driveways and larger household loads",
  "victor-harbor": "coastal access, longer-distance timing and complete origin-to-destination planning",
  "victor-harbor-road-corridor": "longer corridor travel, storage stops, regional timing and destination access",
  "toorak-gardens": "premium homes, careful furniture handling and tighter residential access",
  "hyde-park": "compact streets, villas, townhouses and careful loading positions",
  malvern: "villa and townhouse moves with parking, stairs and furniture-access planning",
};

function slugifyArea(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const hfServiceAreaRecords = serviceAreaSeed.map(([name, region]) => ({
  name,
  region,
  slug: slugifyArea(name),
}));

function buildGeneratedAreaPage(name: string, region: ServiceAreaRegion, slug: string): ContentPage {
  const profile = regionProfiles[region];
  const access = localAccessOverrides[slug] ?? profile.access;
  const localFaqs = [
    {
      question: `Does HF Removals service ${name}?`,
      answer: `HF Removals Adelaide accepts local and connecting move enquiries involving ${name}. Share both addresses, your inventory, preferred date and access notes so the team can review the scope.`,
    },
    {
      question: `What should I include in a ${name} removalist quote?`,
      answer: `Include the pickup and delivery addresses, property type, furniture and carton inventory, stairs or lifts, parking, bulky items and any packing support you need.`,
    },
    {
      question: `What access details matter for a move in ${name}?`,
      answer: `For ${name}, useful planning details can include ${access}. The exact quote should be based on the real access conditions at both addresses.`,
    },
  ];

  return {
    slug,
    kind: "area",
    eyebrow: `${name} removals`,
    title: `Plan your ${name} move around access and inventory`,
    description: `${name} removalists with practical planning for access, inventory, furniture protection, packing support and Adelaide connections.`,
    intro: `HF Removals Adelaide accepts enquiries involving ${name}. ${profile.intro} A useful quote starts with the actual addresses, inventory and access conditions rather than the suburb name alone.`,
    highlights: [`${name} pickup or delivery`, "Inventory-led quote planning", "Furniture protection options", `${region} coverage`],
    sections: [
      {
        title: `Moving in ${name}`,
        body: `For a move involving ${name}, plan around ${access}. Confirm the truck position, entry path, stairs or lifts and any timing restrictions before moving day.`,
      },
      {
        title: "Build the quote around the real inventory",
        body: "List furniture, appliances, cartons, plants, garage or outdoor items and anything unusually heavy, fragile or difficult to access. Add dimensions for bulky pieces where practical.",
      },
      {
        title: "Confirm the complete route",
        body: `Share both suburbs or postcodes and note ${profile.route}. HF can then review whether the move is local, regional or connected to an interstate service.`,
      },
    ],
    faqs: [...localFaqs, ...standardMoveFaqs.slice(0, 4)],
  };
}

const featuredBySlug = new Map(featuredAreas.map((area) => [area.slug, area]));

export const hfServiceAreas: ContentPage[] = hfServiceAreaRecords.map(({ name, region, slug }) =>
  featuredBySlug.get(slug) ?? buildGeneratedAreaPage(name, region, slug),
);

export const hfServiceAreaCount = hfServiceAreas.length;
