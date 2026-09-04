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
  ["Adelaide Hills", "Adelaide Hills"],
  ["North-Eastern Adelaide", "North-Eastern Adelaide"],
  ["Playford", "Northern Adelaide"],
  ["Western Adelaide", "Western Adelaide"],
  ["Adelaide Parklands", "Central Adelaide"],
  ["Albert Park", "Western Adelaide"],
  ["Allenby Gardens", "Western Adelaide"],
  ["Andrews Farm", "Northern Adelaide"],
  ["Angle Vale", "Northern Adelaide"],
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
  ["Craigmore", "Northern Adelaide"],
  ["Evanston", "Regional SA"],
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
  ["Munno Para West", "Northern Adelaide"],
  ["Myrtle Bank", "Eastern Adelaide"],
  ["New Port", "Western Adelaide"],
  ["Newton", "Eastern Adelaide"],
  ["Noarlunga", "Southern Adelaide"],
  ["North Adelaide", "Central Adelaide"],
  ["North Park", "Northern Adelaide"],
  ["Northfield", "Northern Adelaide"],
  ["Northern Adelaide", "Northern Adelaide"],
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
  ["Smithfield", "Northern Adelaide"],
  ["Salisbury North", "Northern Adelaide"],
  ["Salisbury East", "Northern Adelaide"],
  ["Seacliff", "Coastal Adelaide"],
  ["Seaford", "Coastal Adelaide"],
  ["Seaton", "Western Adelaide"],
  ["Seaton Park", "Western Adelaide"],
  ["Seaton South", "Western Adelaide"],
  ["Semaphore", "Coastal Adelaide"],
  ["Somerton Park", "Coastal Adelaide"],
  ["Somerton Park West", "Coastal Adelaide"],
  ["South Plympton", "Southern Adelaide"],
  ["Southern Adelaide", "Southern Adelaide"],
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
  ["Two Wells", "Regional SA"],
  ["Virginia", "Northern Adelaide"],
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

/**
 * Named streets, corridors and neighbouring suburbs that anchor each area page to
 * real local geography. Keyed by area slug.
 */
const supportingLocalities: Record<string, string[]> = {
  "adelaide-cbd": ["North Terrace", "King William Street", "Rundle Mall", "Grenfell Street", "Waymouth Street"],
  glenelg: ["Jetty Road", "Brighton Road", "Colley Terrace", "Anzac Highway", "Moseley Square"],
  norwood: ["The Parade", "Magill Road", "Portrush Road", "Fullarton Road", "Osmond Terrace"],
  salisbury: ["Salisbury Highway", "Commercial Road", "Park Terrace", "John Street", "Saints Road"],
  gawler: ["Murray Street", "Adelaide Road", "Main North Road", "the surrounding northern townships"],
  "elizabeth-vale": ["Main North Road", "the wider Elizabeth and Salisbury region"],
  "elizabeth-downs": ["Elizabeth", "Main North Road", "the neighbouring northern suburbs"],
  blakeview: ["the Blakeview estates", "the northside suburbs", "the Gawler corridor"],
  "northern-adelaide": ["Salisbury", "Elizabeth", "Andrews Farm", "Mawson Lakes", "Blakeview", "Gawler"],
  marion: ["Sturt Road", "Marion Road", "Morphett Road", "Diagonal Road", "Oaklands Road"],
  "mawson-lakes": ["Main North Road", "Mawson Lakes Boulevard"],
  elizabeth: ["Main North Road", "Elizabeth Way"],
  "morphett-vale": ["South Road", "Main South Road", "Beach Road", "States Road", "Reynella", "Noarlunga"],
  noarlunga: ["Beach Road", "Main South Road", "Dyson Road", "Seaford", "Port Noarlunga"],
  reynella: ["Main South Road", "Old South Road", "Reynella East", "Woodcroft", "Happy Valley", "Morphett Vale"],
};

type LocalAreaProfile = {
  description: string;
  intro: string;
  context: string;
  route: string;
  access: string;
  nearby: string[];
};

/**
 * Editorial profiles for the first production batch. These are deliberately
 * about move-planning differences, not claims about HF's job history.
 */
const localAreaProfiles: Record<string, LocalAreaProfile> = {
  playford: {
    description: "Removalists across Playford for homes, furniture and northern Adelaide moves. HF Removals Adelaide plans around the full route and property access.",
    intro: "Playford is a broader northern service area covering established suburbs and the growth corridor. Use the individual suburb pages for local planning, or send both addresses when a move crosses Elizabeth, Munno Para, Angle Vale or Gawler.",
    context: "established suburbs, growth-corridor estates, homes, units and larger household inventories",
    route: "the Playford connections between Elizabeth, Craigmore, Smithfield, Munno Para, Angle Vale and Gawler",
    access: "estate driveways, established-street parking, garages, stairs, gates and longer carry paths",
    nearby: ["Elizabeth", "Elizabeth Vale", "Craigmore", "Smithfield", "Blakeview", "Andrews Farm", "Munno Para", "Munno Para West", "Angle Vale"],
  },
  "northern-adelaide": {
    description: "Removalists across Northern Adelaide for homes, furniture and growth-corridor moves. Explore local planning pages or request a quote.",
    intro: "Northern Adelaide combines established suburbs, apartment pockets, family homes and newer estates. The service-area directory connects those local pages so you can compare the planning details most relevant to your addresses.",
    context: "established homes, units, family inventories and northern growth-corridor estates",
    route: "the northern network from Salisbury and Mawson Lakes through Elizabeth, Munno Para and Gawler",
    access: "driveways, estate streets, unit entries, garages and furniture carry paths",
    nearby: ["Salisbury", "Elizabeth", "Elizabeth Vale", "Munno Para West", "Gawler"],
  },
  "north-eastern-adelaide": {
    description: "Removalists across North-Eastern Adelaide for homes, units and foothill-connected moves. Plan access and inventory with HF.",
    intro: "North-Eastern Adelaide spans established suburbs, family homes and foothill approaches. Use the area pages to narrow the local context, then include slopes, stairs and truck positioning in the quote request.",
    context: "family homes, units, estate streets and foothill approaches",
    route: "the north-eastern network between Golden Grove, Modbury, Tea Tree Gully and Mawson Lakes",
    access: "slopes, stairs, driveways, shared entries and furniture carry distance",
    nearby: ["Golden Grove", "Modbury", "Tea Tree Gully", "Mawson Lakes"],
  },
  "adelaide-hills": {
    description: "Removalists across the Adelaide Hills for homes and connected metro moves. Share route, inventory and driveway details for a quote.",
    intro: "Adelaide Hills moves need access planning at both ends, especially where gradients, long driveways or limited turning space affect loading. The relevant suburb and destination should be included in the enquiry.",
    context: "hills homes, slopes, longer driveways and careful furniture carries",
    route: "the Hills connection between Mount Barker, Stirling, Aldgate and Adelaide metro",
    access: "gradients, long driveways, turning space, stairs and gates",
    nearby: ["Mount Barker", "Stirling", "Aldgate", "Norwood"],
  },
  "southern-adelaide": {
    description: "Removalists across Southern Adelaide for homes, furniture and coastal-connected moves. Request a practical quote based on your addresses.",
    intro: "Southern Adelaide includes established homes, townhouses, storage-linked moves and coastal connections. A room-by-room inventory plus garage and outdoor contents gives the team a clearer scope.",
    context: "family homes, townhouses, garages and southern corridor routes",
    route: "the southern network from Morphett Vale and Reynella through Noarlunga and Seaford",
    access: "driveways, garages, townhouse stairs, parking and longer furniture carries",
    nearby: ["Morphett Vale", "Noarlunga", "Seaford", "Woodcroft"],
  },
  "western-adelaide": {
    description: "Removalists across Western Adelaide for homes, units, furniture and commercial-connected moves. Share access details for a tailored quote.",
    intro: "Western Adelaide combines established homes, apartments, port-side streets and commercial pockets. Tell HF about loading positions, shared entries and any workplace timing requirements.",
    context: "homes, units, port-side streets and commercial-connected moves",
    route: "the western network through West Lakes, Findon, Seaton, Woodville and the coast",
    access: "kerbside parking, shared entries, loading zones, stairs and commercial access windows",
    nearby: ["West Lakes", "Findon", "Seaton", "Woodville", "West Beach"],
  },
  "elizabeth-vale": {
    description: "Removalists in Elizabeth Vale for home, furniture and connected Adelaide moves. Share your inventory and access details for a practical quote.",
    intro: "Elizabeth Vale is a useful starting point for a move plan because homes, units and nearby northern suburbs can have very different loading conditions. HF Removals Adelaide scopes the actual pickup and delivery addresses, not just the suburb name.",
    context: "homes, units and townhouses around the Elizabeth and Salisbury corridor",
    route: "the connection between Elizabeth Vale, Elizabeth, Salisbury and the destination suburb",
    access: "driveway or kerbside loading, stairs, gates, unit entries and any longer carry from the truck",
    nearby: ["Elizabeth", "Salisbury", "Craigmore", "Smithfield", "Munno Para"],
  },
  "munno-para-west": {
    description: "Removalists Munno Para West for residential, furniture and commercial moves across Adelaide's northern growth corridor. Request a tailored quote.",
    intro: "Munno Para West moves often involve newer estate homes, garages and a growing mix of family-sized inventories. Include outdoor items, bulky furniture and the usable truck approach when asking HF to review the move.",
    context: "newer estate homes, family inventories, garages and outdoor furniture",
    route: "the northern growth corridor between Munno Para West, Angle Vale, Andrews Farm and nearby destinations",
    access: "driveway width, estate street parking, garage access, gates and the distance from the truck to the front door",
    nearby: ["Angle Vale", "Andrews Farm", "Munno Para", "Smithfield", "Blakeview"],
  },
  "angle-vale": {
    description: "Removalists Angle Vale for house, furniture and regional-connected moves. Plan your inventory, access and pickup route with HF Removals Adelaide.",
    intro: "Angle Vale sits within a fast-changing northern corridor where a move may include a newer home, a larger outdoor inventory or a connection toward Gawler and Two Wells. A complete item list makes the quote more useful.",
    context: "new-build and established homes, larger blocks and outdoor items",
    route: "the local connection between Angle Vale, Munno Para West, Virginia, Two Wells and Gawler",
    access: "longer driveways, gates, outdoor furniture, sheds and the safest truck position on the property",
    nearby: ["Munno Para West", "Andrews Farm", "Virginia", "Two Wells", "Gawler"],
  },
  "andrews-farm": {
    description: "Removalists Andrews Farm for family-home, furniture and northern Adelaide moves. Send both addresses and your inventory for a clear quote.",
    intro: "Andrews Farm enquiries commonly need a whole-property inventory rather than a room-only list. Garages, outdoor play equipment, plants and large family furniture can materially change loading and placement planning.",
    context: "estate homes, family furniture, garages, plants and outdoor equipment",
    route: "the estate corridor linking Andrews Farm with Munno Para West, Blakeview, Elizabeth and Gawler",
    access: "driveways, estate parking, garage contents, gates and furniture paths through newer homes",
    nearby: ["Munno Para West", "Blakeview", "Elizabeth", "Craigmore", "Gawler"],
  },
  "blakeview": {
    description: "Removalists Blakeview for complete household moves, furniture and packing support. HF Removals Adelaide plans around access and inventory.",
    intro: "Blakeview household moves are easier to scope when the main rooms are considered alongside garages, sheds, plants and outdoor furniture. Mention anything needing dismantling or extra protection before moving day.",
    context: "estate homes, whole-home inventories and garage or outdoor contents",
    route: "the Gawler corridor and nearby connections through Andrews Farm, Craigmore and Munno Para West",
    access: "estate street layout, driveway position, garage contents, gates and the route to each room",
    nearby: ["Andrews Farm", "Craigmore", "Munno Para West", "Gawler", "Elizabeth"],
  },
  "elizabeth": {
    description: "Removalists Elizabeth for house, unit and furniture moves across Adelaide's northern suburbs. Request an inventory-led moving quote.",
    intro: "Elizabeth moves can range from compact unit relocations to full household moves with garages and storage items. The property type, stairs and parking arrangement are useful details to provide with the inventory.",
    context: "established homes, units, townhouses and complete household inventories",
    route: "the Main North Road corridor between Elizabeth Vale, Salisbury, Craigmore and Munno Para",
    access: "kerbside parking, driveways, unit entries, stairs and furniture carry distance",
    nearby: ["Elizabeth Vale", "Craigmore", "Salisbury", "Munno Para", "Smithfield"],
  },
  "craigmore": {
    description: "Removalists Craigmore for family homes, furniture and northern Adelaide moves. Share property access and bulky items for a tailored quote.",
    intro: "Craigmore move planning should account for family-sized homes, garages and the slope or driveway approach at each address. A few clear photos or notes about access can help explain unusual carry paths.",
    context: "family homes, garages, larger furniture and mixed driveway access",
    route: "the northern connection between Craigmore, Blakeview, Elizabeth, Smithfield and Gawler",
    access: "driveway slope, garage access, stairs, gates and the path for large furniture",
    nearby: ["Blakeview", "Elizabeth", "Elizabeth Vale", "Smithfield", "Gawler"],
  },
  "smithfield": {
    description: "Removalists Smithfield for local northern Adelaide moves, furniture and household relocations. Get a quote based on your actual move details.",
    intro: "Smithfield sits between established northern suburbs and newer growth areas, so the move may pair an older home with an estate property or unit. Include both property types when describing the route.",
    context: "established homes, newer estates, units and mixed household inventories",
    route: "the corridor linking Smithfield with Elizabeth, Munno Para, Craigmore and Gawler",
    access: "older or newer driveway layouts, kerb access, stairs, gates and destination room placement",
    nearby: ["Elizabeth", "Munno Para", "Craigmore", "Salisbury", "Blakeview"],
  },
  "munno-para": {
    description: "Removalists Munno Para for residential and furniture moves across the northern growth corridor. Send your inventory and access notes to HF.",
    intro: "Munno Para enquiries often connect established local streets with newer housing around the northern corridor. Clarify whether the load includes garage contents, appliances, plants or furniture requiring disassembly.",
    context: "mixed established and newer homes, garages and family inventories",
    route: "the local corridor from Munno Para to Munno Para West, Smithfield, Elizabeth and Angle Vale",
    access: "driveway width, street parking, garage contents, gates and stairs or narrow entries",
    nearby: ["Munno Para West", "Smithfield", "Elizabeth", "Angle Vale", "Andrews Farm"],
  },
  "salisbury": {
    description: "Removalists Salisbury for homes, units, furniture and workplace moves. HF Removals Adelaide scopes loading access and the full route.",
    intro: "Salisbury has a mix of established homes, units and commercial activity. For a useful quote, identify loading space, stairs or lifts, workplace contacts and any furniture that needs special handling.",
    context: "established homes, units, storage items and small workplace moves",
    route: "the Main North Road connection between Salisbury, Elizabeth, Mawson Lakes and northern destinations",
    access: "unit entries, loading positions, stairs, lifts, parking and longer furniture carries",
    nearby: ["Elizabeth Vale", "Elizabeth", "Salisbury North", "Mawson Lakes", "Parafield Gardens"],
  },
  "gawler": {
    description: "Removalists Gawler for local, Adelaide-connected and regional moves. Share the complete route, inventory and access conditions for a quote.",
    intro: "A Gawler move may be local to the town, connected with Adelaide or part of a longer South Australian route. The destination postcode, property access and inventory help distinguish those scopes from one another.",
    context: "family homes, townhouses, regional properties and longer routes",
    route: "the Gawler connection with Blakeview, Andrews Farm, Angle Vale and Adelaide's northern suburbs",
    access: "larger driveways, town access, stairs, sheds, storage items and destination parking",
    nearby: ["Evanston", "Blakeview", "Andrews Farm", "Angle Vale", "Munno Para West"],
  },
  "evanston": {
    description: "Removalists Evanston for Gawler-area homes and connected Adelaide moves. Get practical planning for inventory, access and destination placement.",
    intro: "Evanston enquiries benefit from a clear distinction between a nearby Gawler-area move and a longer Adelaide connection. Include postcodes, property type and any shed or outdoor contents in the request.",
    context: "Gawler-area homes, larger blocks, sheds and regional-connected moves",
    route: "the Gawler area and its connection south through the northern Adelaide corridor",
    access: "driveways, sheds, gates, outdoor items and the approach for loading at both properties",
    nearby: ["Gawler", "Angle Vale", "Two Wells", "Blakeview", "Virginia"],
  },
  "virginia": {
    description: "Removalists Virginia for homes, larger properties and northern corridor moves. Provide complete access and inventory details for an accurate quote.",
    intro: "Virginia moves can involve larger residential properties and a mix of household, shed or outdoor items. A complete inventory is especially useful when the load is not limited to the main living areas.",
    context: "larger properties, sheds, outdoor contents and northern corridor homes",
    route: "the connection between Virginia, Angle Vale, Two Wells, Munno Para West and Gawler",
    access: "long driveways, gates, sheds, outdoor furniture and truck turning or parking space",
    nearby: ["Angle Vale", "Two Wells", "Munno Para West", "Gawler", "Evanston"],
  },
  "two-wells": {
    description: "Removalists Two Wells for local and Adelaide-connected moves. HF Removals Adelaide reviews the full route, inventory and property access.",
    intro: "Two Wells enquiries can sit between a local town move and a longer connection into Adelaide or the northern corridor. Tell HF where the truck can load, what is stored outside and where the move finishes.",
    context: "town homes, larger blocks, storage or shed contents and longer connections",
    route: "the corridor between Two Wells, Virginia, Angle Vale, Gawler and Adelaide's north",
    access: "driveway length, turning space, gates, sheds and the carry path from truck to home",
    nearby: ["Virginia", "Angle Vale", "Gawler", "Evanston", "Munno Para West"],
  },
  "mawson-lakes": {
    description: "Removalists Mawson Lakes for apartments, homes, furniture and office moves. Plan lifts, loading access and inventory with HF.",
    intro: "Mawson Lakes includes apartments, townhouses, homes and nearby commercial spaces. Apartment moves should include lift booking requirements, shared entries and loading arrangements alongside the furniture list.",
    context: "apartments, townhouses, homes and nearby commercial spaces",
    route: "the northern city connection from Mawson Lakes through Salisbury, Parafield Gardens and Adelaide",
    access: "lift bookings, shared entries, loading bays, parking and longer carries through common areas",
    nearby: ["Salisbury", "Parafield Gardens", "Elizabeth", "Golden Grove", "Modbury"],
  },
  "golden-grove": {
    description: "Removalists Golden Grove for family homes, furniture and north-eastern Adelaide moves. Request a quote based on access and inventory.",
    intro: "Golden Grove moves commonly involve family homes and larger furniture, with access varying between estate streets, driveways and sloping approaches. Note garages, outdoor items and any stairs before the move is scoped.",
    context: "family homes, estate streets, garages and larger furniture",
    route: "the north-eastern connection between Golden Grove, Greenwith, Fairview Park, Modbury and Tea Tree Gully",
    access: "sloped driveways, estate parking, garages, gates and furniture carry paths",
    nearby: ["Greenwith", "Fairview Park", "Tea Tree Gully", "Modbury", "Redwood Park"],
  },
  "modbury": {
    description: "Removalists Modbury for homes, units and north-eastern Adelaide moves. HF plans around access, inventory and destination placement.",
    intro: "Modbury move requests can involve established homes, units and connections across the north-east. Identify stairs, shared driveways, bulky furniture and any time-sensitive access at either end.",
    context: "established homes, units, townhouses and north-eastern connections",
    route: "the north-eastern corridor between Modbury, Tea Tree Gully, Golden Grove and Mawson Lakes",
    access: "shared driveways, stairs, unit entries, parking and furniture carry distance",
    nearby: ["Tea Tree Gully", "Golden Grove", "Fairview Park", "Mawson Lakes", "Greenwith"],
  },
  "tea-tree-gully": {
    description: "Removalists Tea Tree Gully for local home, furniture and north-eastern Adelaide moves. Share your access details for a tailored quote.",
    intro: "Tea Tree Gully properties can vary from established homes to sloping streets and foothill approaches. Mention driveway gradients, stairs, retaining walls and bulky pieces when describing the job.",
    context: "established homes, foothill approaches, slopes and larger furniture",
    route: "the foothill-side connection between Tea Tree Gully, Modbury, Golden Grove and the north-east",
    access: "sloping driveways, retaining walls, stairs, narrow entries and truck positioning",
    nearby: ["Modbury", "Golden Grove", "Greenwith", "Fairview Park", "Redwood Park"],
  },
  "mount-barker": {
    description: "Removalists Mount Barker for Adelaide Hills homes and connected moves. Plan the full route, driveway access and household inventory with HF.",
    intro: "Mount Barker moves need the complete origin-to-destination picture, particularly when a hills home connects with Adelaide metro or another regional address. Include driveway length, slopes and shed contents in the enquiry.",
    context: "hills estates, family homes, longer driveways and larger household loads",
    route: "the Adelaide Hills connection between Mount Barker, Stirling, Aldgate and Adelaide metro",
    access: "gradients, long driveways, turning space, stairs, gates and larger furniture carries",
    nearby: ["Stirling", "Aldgate", "Strathalbyn", "Norwood", "Adelaide Hills"],
  },
  "morphett-vale": {
    description: "Removalists Morphett Vale for homes, furniture and southern Adelaide moves. Send both addresses, inventory and access notes for a quote.",
    intro: "Morphett Vale connects established homes, townhouses and southern corridor routes. A clear list of garage contents, appliances and bulky furniture helps the team plan the move beyond the main rooms.",
    context: "established homes, townhouses, garages and southern corridor moves",
    route: "the southern connection between Morphett Vale, Reynella, Noarlunga and the coast",
    access: "driveways, garages, townhouse stairs, parking and furniture placement at the destination",
    nearby: ["Reynella", "Noarlunga", "Seaford", "Woodcroft", "Salisbury"],
  },
};

function formatList(items: string[]) {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Appends a locality section to an area page when anchors exist for it. Anchors already
 * named in the page's access copy are dropped so the two sections do not repeat each other.
 */
function withSupportingLocalities(page: ContentPage, name: string): ContentPage {
  const anchors = supportingLocalities[page.slug];
  if (!anchors) return page;

  const existingCopy = page.sections.map((section) => section.body).join(" ");
  const fresh = anchors.filter((anchor) => !existingCopy.includes(anchor));
  if (fresh.length === 0) return page;

  return {
    ...page,
    sections: [
      ...page.sections,
      {
        title: `Where we work around ${name}`,
        body: `Jobs in this area regularly take us along ${formatList(fresh)}. Naming the closest of these in your enquiry helps the team judge truck positioning and carry distance before the day.`,
      },
    ],
  };
}

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
  nearby: localAreaProfiles[slugifyArea(name)]?.nearby ?? [],
}));

function buildGeneratedAreaPage(name: string, region: ServiceAreaRegion, slug: string): ContentPage {
  const profile = regionProfiles[region];
  const local = localAreaProfiles[slug];
  const access = localAccessOverrides[slug] ?? profile.access;
  const description = local?.description ?? `${name} removalists with practical planning for access, inventory, furniture protection, packing support and Adelaide connections.`;
  const intro = local?.intro ?? `HF Removals Adelaide accepts enquiries involving ${name}. ${profile.intro} A useful quote starts with the actual addresses, inventory and access conditions rather than the suburb name alone.`;
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
      answer: `For ${name}, useful planning details can include ${local?.access ?? access}. The exact quote should be based on the real access conditions at both addresses.`,
    },
  ];

  return {
    slug,
    kind: "area",
    eyebrow: `${name} removals`,
    title: `Removalists in ${name}`,
    description,
    intro,
    highlights: [`${name} pickup or delivery`, local?.context ?? "Inventory-led move planning", "Furniture protection options", `${region} coverage`],
    sections: [
      {
        title: `Moving in ${name}`,
        body: `For a move involving ${name}, plan around ${local?.access ?? access}. Confirm the truck position, entry path, stairs or lifts and any timing restrictions before moving day.`,
      },
      {
        title: local ? `What to include for a ${name} move` : "Build the quote around the real inventory",
        body: local ? `List furniture, appliances, cartons, plants, garage or outdoor items and anything unusually heavy, fragile or difficult to access. For ${name}, pay particular attention to ${local.context}.` : "List furniture, appliances, cartons, plants, garage or outdoor items and anything unusually heavy, fragile or difficult to access. Add dimensions for bulky pieces where practical.",
      },
      {
        title: local ? `Moving between ${name} and nearby areas` : "Confirm the complete route",
        body: `Share both suburbs or postcodes and note ${local?.route ?? profile.route}. HF can then review whether the move is local, regional or connected to an interstate service.`,
      },
    ],
    faqs: [...localFaqs, ...standardMoveFaqs.slice(0, 4)],
  };
}

const featuredBySlug = new Map(featuredAreas.map((area) => [area.slug, area]));

export const hfServiceAreas: ContentPage[] = hfServiceAreaRecords.map(({ name, region, slug }) =>
  withSupportingLocalities(featuredBySlug.get(slug) ?? buildGeneratedAreaPage(name, region, slug), name),
);

export const hfServiceAreaCount = hfServiceAreas.length;
