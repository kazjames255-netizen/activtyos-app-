// ─────────────────────────────────────────────────────────────────────────
// Hazard bank — an extensive, editable library of trip/off-site-visit hazards.
// Each entry has a short `area` (the picker label), an extensive `desc` of what
// the hazard actually is, the `who` risk (who could be harmed and how — the
// injury/harm), a suggested risk rating and a set of control-measure statements.
// Grounded in a real School Trips & Educational Visits risk assessment (Tall
// Oaks Academy Trust, 31 Aug 2022) and general activity-provider good practice
// (HSE, EVOLVE / National Guidance, EYFS ratios).
//
// When added, the hazard row is prefilled with the extensive `desc` as the
// "Hazard — what it is" and `who` as the "Risk", both fully editable.
// ─────────────────────────────────────────────────────────────────────────

export type BankRisk = "L" | "M" | "H";

export interface BankEntry {
  id: string;
  cat: string; // grouping for the picker
  area: string; // short label (picker heading)
  desc: string; // the hazard — an extensive description of what it is
  who: string; // the risk — who could be harmed and how (the injury/harm)
  initial: BankRisk; // risk before controls
  residual: BankRisk; // risk with controls in place
  controls: string[]; // control-measure statements
}

export const HAZARD_CATEGORIES = [
  "Planning & supervision",
  "Travel & transport",
  "Safeguarding & security",
  "Health, medical & welfare",
  "Environment & venue",
  "Activity-specific",
] as const;

export const HAZARD_BANK: BankEntry[] = [
  // ── Planning & supervision ───────────────────────────────────────────────
  {
    id: "planning-evc", cat: "Planning & supervision", area: "Untrained staff / poor trip planning",
    desc: "The trip is organised or led by staff without the training or authority to plan an off-site visit — no Educational Visits Coordinator (EVC) involvement, the venue and its activities are not risk-assessed in advance, and the plan is not checked or signed off before the day.",
    who: "Staff, children and the public could be harmed — because hazards go unidentified and controls are not in place, this can lead to injury, a child going missing, or a safeguarding failure that no one is prepared for.",
    initial: "H", residual: "L",
    controls: [
      "A trained Educational Visits Coordinator (EVC) prepares or checks a thorough risk assessment before the visit.",
      "The EVC ensures every external visit is properly coordinated; in their absence the Head of Setting is responsible.",
      "The venue and activities are confirmed safe — obtain the venue's own risk assessment for any activity performed there.",
      "The visit is planned, organised and checked in line with the setting's Educational Visits Policy and national guidance.",
      "The completed risk assessment is signed off by the person in charge at least 7 days before the visit for review.",
      "No child attends without a signed parental consent form on file.",
    ],
  },
  {
    id: "planning-ratios", cat: "Planning & supervision", area: "Too few staff / ratios not met",
    desc: "There are not enough adults on the trip to supervise the children safely for the off-site environment — the adult-to-child ratio is looser than the risk demands, there is no named lead or first aider, or a child needing 1:1 support does not have it.",
    who: "Children could be harmed — with too few adults a child may be unsupervised near roads, water or crowds, wander off, or have a medical need missed, leading to serious injury or a child going missing.",
    initial: "H", residual: "L",
    controls: [
      "Staff the trip to at least the setting's off-site ratio, tighter than the on-site ratio and set by risk assessment.",
      "A named trip lead holds overall responsibility and carries the register at all times.",
      "At least one paediatric first aider is present for the whole visit.",
      "Ratios account for any child with additional needs — add 1:1 support where the child's plan requires it.",
      "If staffing drops below the assessed ratio the visit does not proceed until cover is arranged.",
    ],
  },
  {
    id: "planning-headcount", cat: "Planning & supervision", area: "No / infrequent head counts",
    desc: "Children are not counted and checked against the register at the key transition points of the day — leaving base, arriving, moving between activities or areas, and returning — so no one notices promptly if a child is missing.",
    who: "Children could be harmed — a child left unaccounted for at a transition point may be lost, injured, or left behind at a venue or on transport before anyone realises.",
    initial: "M", residual: "L",
    controls: [
      "A full head count is taken and logged at every checkpoint: before departure, on arrival, before and after each activity, and before return.",
      "Children are counted before entering and on leaving any area or building.",
      "The named lead holds the register and confirms the count against it each time.",
      "Children are kept in small, consistent groups each with a named adult.",
    ],
  },
  {
    id: "planning-lost", cat: "Planning & supervision", area: "Lost or separated child",
    desc: "A child becomes separated from the group — wandering off, lost in a crowd, or left behind at a stop — with no agreed meeting point, hi-vis, buddy system or search-and-escalation plan in place.",
    who: "A child could be harmed — separation risks the child being lost and distressed, approached or led away by a stranger, or injured while alone and unsupervised.",
    initial: "H", residual: "L",
    controls: [
      "A predetermined meeting point is agreed and shown to children at the start of the visit.",
      "Children are regularly head counted, kept in small groups and checked before entering/leaving areas.",
      "Children wear hi-vis and know their group leader's name; staff carry the lead's mobile number (phone tree).",
      "If a child is missing, a staff member stays with the group while others search and alert venue staff; escalate to the lead, then the setting and, if needed, the police.",
      "A code of conduct is signed by parents before the visit and expectations are relayed to children.",
    ],
  },
  {
    id: "planning-behaviour", cat: "Planning & supervision", area: "Poor behaviour / not following instructions",
    desc: "Children do not follow staff directions or the code of conduct during the visit — pushing, running off, messing about in transit or refusing to stay with the group — and expectations have not been set or reinforced.",
    who: "Children and others could be harmed — unsafe behaviour can cause a fall or collision injury, or lead a child to leave the group and become lost.",
    initial: "M", residual: "L",
    controls: [
      "Expectations and a code of conduct are made clear to children before and throughout the visit.",
      "Staff brief children on sensible, calm behaviour while walking, in transit and at the venue.",
      "Individual children who may need extra support are identified in advance and monitored by their group leader.",
      "Staff follow the setting's behaviour policy; a child whose behaviour presents a serious risk may be withdrawn from an activity.",
    ],
  },
  {
    id: "planning-inclusion", cat: "Planning & supervision", area: "Inclusion, SEND & equality not considered",
    desc: "The trip is planned without considering disabled or additional-needs participants — no reasonable adjustments, missing care/health plans, or no 1:1 support arranged — so a child cannot take part safely or is excluded.",
    who: "Disabled or additional-needs participants could be harmed or excluded — without reasonable adjustments a child may be placed at a substantial disadvantage or at inappropriate risk on the visit.",
    initial: "M", residual: "L",
    controls: [
      "Reasonable adjustments are made so participants are not placed at a substantial disadvantage (Equality Act 2010).",
      "Adjustments must not place any participant at inappropriate risk, nor unduly change the activity's purpose.",
      "Care/health plans and any 1:1 support are arranged before the visit.",
      "Every individual is treated with respect and dignity regardless of any protected characteristic.",
    ],
  },
  {
    id: "planning-planb", cat: "Planning & supervision", area: "No contingency / Plan B",
    desc: "There is no fallback plan for the day going wrong — bad weather, a transport breakdown, the venue closing, or an on-the-day emergency — and staff do not carry emergency contacts, the venue address or an emergency float.",
    who: "All attending could be harmed — with no Plan B the group can be left stranded, exposed to the elements, or unable to respond quickly to an emergency.",
    initial: "M", residual: "L",
    controls: [
      "An alternative plan is agreed in case circumstances change on the day.",
      "Inhalers, medication and a first-aid kit stay with the group leader/first aider.",
      "In an emergency the party leader contacts the Head of Setting immediately for further instructions.",
      "Emergency contacts, the venue address and an emergency float are carried by the lead.",
    ],
  },

  // ── Travel & transport ───────────────────────────────────────────────────
  {
    id: "travel-roads", cat: "Travel & transport", area: "Walking & crossing roads",
    desc: "The group moves on foot along pavements and across roads to or during the visit — sharing the pedestrian environment with traffic, at crossings and junctions, sometimes in an unfamiliar area.",
    who: "Staff, pupils and the public could be harmed — a child stepping into the road or a driver failing to stop risks a child being struck by a vehicle, causing serious or fatal injury.",
    initial: "M", residual: "L",
    controls: [
      "Children walk in organised pairs with adults spaced at regular intervals, and an adult at the front and rear.",
      "Roads are crossed between two adult markers in a calm, organised manner, adults front and rear.",
      "Adults wear fluorescent/hi-vis vests.",
      "Recognised crossings are used wherever possible; the route is walked or checked in advance.",
    ],
  },
  {
    id: "travel-coach", cat: "Travel & transport", area: "Coach / minibus journey",
    desc: "The group travels to and from the venue by coach or minibus — walking to the vehicle, boarding and alighting at the roadside, and seated for the journey with a driver and other road users.",
    who: "Staff and pupils could be harmed — a road traffic collision or sudden stop risks impact injury to seated children, and a child could be struck by passing traffic while boarding or alighting at the kerb.",
    initial: "M", residual: "L",
    controls: [
      "Children are supervised stepping on and off the bus, in pairs while walking to it.",
      "Pupils sit in pairs with seatbelts fastened at all times while travelling.",
      "Staff head-count and check seatbelts are fastened before departure.",
      "Staff are positioned at the front, middle and back of the coach.",
      "No food or drink is consumed on the coach; travel-sickness resources and a first-aid kit are on hand.",
      "The driver is DBS-checked and the operator/vehicle is licensed and insured.",
    ],
  },
  {
    id: "travel-public", cat: "Travel & transport", area: "Public transport (bus / train)",
    desc: "The group uses scheduled public transport — busy platforms or bus stops, the platform edge and train gap, closing doors, and mixing with members of the public, with the risk of a missed connection.",
    who: "Children could be harmed — falls from the platform edge or into the gap, being caught in doors, or being separated from the group in a busy station risk injury or a child being lost.",
    initial: "M", residual: "L",
    controls: [
      "Children are counted on and off at every stop; adults board first and last.",
      "Children stand back from platform edges behind the yellow line and mind the gap when boarding.",
      "Groups stay together in a reserved area; a meeting point and next-stop plan is agreed if separated.",
      "Tickets, timetable and a contingency for missed connections are held by the lead.",
    ],
  },
  {
    id: "travel-embark", cat: "Travel & transport", area: "Embarking / disembarking / car parks",
    desc: "Children load and unload from vehicles in car parks, laybys and drop-off zones where other vehicles are moving and reversing, often close to the group.",
    who: "Children could be harmed — a moving or reversing vehicle in a car park or drop-off area risks a child being struck, causing serious injury.",
    initial: "M", residual: "L",
    controls: [
      "Children are held on the pavement/safe area until the group is ready to move as one.",
      "Loading and unloading happens away from moving traffic, with adults between children and vehicles.",
      "A head count is taken immediately on and off every vehicle.",
    ],
  },

  // ── Safeguarding & security ──────────────────────────────────────────────
  {
    id: "safe-public", cat: "Safeguarding & security", area: "Contact with the public / strangers",
    desc: "During the visit children share space with members of the public — on the route, at the venue and in busy areas — where an unknown adult could approach, speak to or attempt to lead away a child.",
    who: "Children could be harmed — unsupervised contact with the public risks a safeguarding incident, or a child being approached, upset or led away from the group.",
    initial: "M", residual: "L",
    controls: [
      "Children are supervised by a DBS-checked adult at all times and stay within specified areas.",
      "Ratios keep contact with the public minimal and always supervised.",
      "Children are warned to stay with adults, remain in their group and not to approach members of the public.",
      "Adults routinely head-count to ensure all children are accounted for.",
    ],
  },
  {
    id: "safe-dbs", cat: "Safeguarding & security", area: "Unchecked adults supervising children",
    desc: "An adult who has not been safely recruited — no enhanced DBS, or a volunteer/helper not briefed on safeguarding — supervises children or is left alone with them during the visit.",
    who: "Children could be harmed — being supervised by, or alone with, an unchecked adult is a safeguarding risk.",
    initial: "M", residual: "L",
    controls: [
      "Only adults with a valid enhanced DBS supervise or are alone with children.",
      "Any adult without a setting DBS is accompanied by a checked staff member when with groups of children.",
      "Volunteers and helpers are briefed on the code of conduct and safeguarding reporting before the visit.",
      "The designated safeguarding lead's contact details are carried by the trip lead.",
    ],
  },
  {
    id: "safe-toilet", cat: "Safeguarding & security", area: "Toileting & intimate care",
    desc: "Children need to use public/venue toilets during the visit, and some may need intimate care — situations that must be supervised safely without leaving a child unaccounted for or with an unchecked adult.",
    who: "Children could be harmed — poor supervision around toilets is both a safeguarding risk and a risk of a child being left behind or unaccounted for.",
    initial: "M", residual: "L",
    controls: [
      "Children go to the toilet as required and wash hands thoroughly.",
      "Children go to the toilet in supervised groups.",
      "Only adults with a DBS certificate take or supervise children toileting; others are accompanied by checked staff.",
      "Intimate care follows the child's care plan and the setting's intimate-care policy.",
    ],
  },
  {
    id: "safe-photo", cat: "Safeguarding & security", area: "Photography & social media",
    desc: "Photos or videos are taken during the visit — on staff or personal devices — and could be shared, including images of children for whom no photo consent is held.",
    who: "Children could be harmed — images taken or shared without consent are a safeguarding and privacy risk.",
    initial: "L", residual: "L",
    controls: [
      "Photos are only taken on setting devices and only where photo consent is held.",
      "No images are shared publicly that identify a child without consent.",
      "Staff do not use personal devices to photograph children.",
    ],
  },
  {
    id: "safe-collection", cat: "Safeguarding & security", area: "Collection & handover at the end",
    desc: "At the end of the visit children are handed back to parents or collectors, sometimes in a busy or unfamiliar place, where identity is not always obvious.",
    who: "A child could be harmed — being released to an unauthorised adult at handover is a serious safeguarding risk.",
    initial: "M", residual: "L",
    controls: [
      "Children are only released to a parent/authorised collector, checked against the register.",
      "A password or ID check is used where the collector is not known to staff.",
      "Late or non-collection follows the setting's uncollected-child procedure.",
    ],
  },

  // ── Health, medical & welfare ────────────────────────────────────────────
  {
    id: "health-slips", cat: "Health, medical & welfare", area: "Slips, trips & falls",
    desc: "The group moves over unfamiliar ground during the visit — uneven paths, steps, wet or slippery surfaces, kerbs and obstacles — indoors and out.",
    who: "Pupils and staff could be harmed — a trip or fall on uneven or wet ground can cause cuts, bruises, sprains or fractures.",
    initial: "M", residual: "L",
    controls: [
      "Staff check the areas and routes used for foreign objects and trip hazards.",
      "Children are briefed to walk, not run, and to follow directions to prevent accidents.",
      "First aid is administered by group leaders as required; injuries are recorded.",
      "Appropriate footwear is advised in advance.",
    ],
  },
  {
    id: "health-medical", cat: "Health, medical & welfare", area: "Medical conditions & medication",
    desc: "Children with known medical conditions (asthma, epilepsy, diabetes, etc.) attend the visit, requiring inhalers, medication and health care plans to be carried and available away from the setting.",
    who: "Pupils with health needs could be harmed — if inhalers, medication or the care plan are not to hand, a condition such as an asthma attack may go untreated and worsen.",
    initial: "M", residual: "L",
    controls: [
      "The group leader is fully aware of, and carries a copy of, each pupil's Health Care Plan (HCP).",
      "Inhalers and other medication are kept by group leaders and available at all times.",
      "All health issues are recorded and carried with the group leader.",
      "Medication is administered per the child's plan and logged; parents are informed.",
    ],
  },
  {
    id: "health-firstaid", cat: "Health, medical & welfare", area: "Inadequate first-aid provision",
    desc: "A child or adult is injured or falls ill during the visit and there is no trained first aider present, no first-aid kit in transit or on site, and the nearest medical help has not been identified.",
    who: "Pupils and staff could be harmed — without a trained first aider or kit to hand, treatment is delayed and a minor injury or illness may worsen.",
    initial: "M", residual: "L",
    controls: [
      "A trained paediatric first aider is available at all times.",
      "A suitable first-aid kit is available during transit and on site.",
      "The nearest A&E / minor-injuries unit and the emergency float are identified before the visit.",
      "Accidents and near-misses are recorded and reported per the accident/RIDDOR procedure.",
    ],
  },
  {
    id: "health-allergy", cat: "Health, medical & welfare", area: "Severe allergy / anaphylaxis",
    desc: "One or more children on the visit have a known severe allergy (food, insect stings, animals) and could come into contact with their allergen through catering, snacks, animal contact or the environment.",
    who: "Named children with a severe allergy could be harmed — exposure to an allergen can trigger anaphylaxis, a rapid and life-threatening reaction.",
    initial: "H", residual: "M",
    controls: [
      "Named children's allergies and triggers are known to all supervising staff before departure.",
      "Adrenaline auto-injectors (e.g. EpiPen) and an allergy care plan are carried and in date.",
      "Trained staff can recognise anaphylaxis and administer the auto-injector, then call 999.",
      "Food/snacks are checked; allergen exposure at the venue (e.g. animals, catering) is avoided.",
    ],
  },
  {
    id: "health-food", cat: "Health, medical & welfare", area: "Food, catering & packed lunches",
    desc: "Children eat packed lunches or venue catering during the visit, away from the setting's usual food controls, with mixed dietary and allergy needs and the chance of food being shared.",
    who: "Children could be harmed — allergens, choking hazards or poor food hygiene risk an allergic reaction, choking or illness.",
    initial: "L", residual: "L",
    controls: [
      "Packed lunches are checked against known allergies; no sharing of food.",
      "Hands are washed before eating, especially after animal contact or outdoor activity.",
      "Catering at the venue is confirmed to meet dietary and allergen requirements.",
    ],
  },
  {
    id: "health-heat", cat: "Health, medical & welfare", area: "Hot weather, sun & hydration",
    desc: "The visit takes place in hot or sunny conditions with time spent outdoors and limited shade, and children may not manage their own sun protection or fluids.",
    who: "Pupils and staff could be harmed — heat and sun exposure risk dehydration, heat exhaustion and sunburn.",
    initial: "L", residual: "L",
    controls: [
      "In extreme heat the EVC/lead assesses whether the event should continue.",
      "Sunhats are worn and sun cream applied; shade breaks are taken.",
      "Everyone has access to fluids to prevent dehydration.",
      "Suitable clothing is advised before the event.",
    ],
  },
  {
    id: "health-cold", cat: "Health, medical & welfare", area: "Cold / wet weather",
    desc: "The visit takes place in cold, wet or windy conditions with time spent outdoors, and children may arrive without warm or waterproof clothing.",
    who: "Pupils and staff could be harmed — cold, wet conditions risk discomfort, hypothermia or cold-related illness.",
    initial: "L", residual: "L",
    controls: [
      "In extreme cold or wet the EVC/lead assesses whether the event should continue.",
      "Suitable warm, waterproof clothing and footwear are advised in advance.",
      "Staff ensure children have the appropriate equipment and clothing to prevent injury or discomfort.",
      "Shelter and a warm-up/dry-off plan are available.",
    ],
  },
  {
    id: "health-manual", cat: "Health, medical & welfare", area: "Manual handling & equipment",
    desc: "Staff lift and carry equipment, bags, supplies or provide physical support to children during the visit.",
    who: "Staff could be harmed — lifting or carrying awkward loads risks back or muscle injury.",
    initial: "L", residual: "L",
    controls: [
      "Loads are kept light; staff use good lifting technique and get help for heavy items.",
      "Equipment is checked as fit for use before the visit.",
    ],
  },

  // ── Environment & venue ──────────────────────────────────────────────────
  {
    id: "env-fire", cat: "Environment & venue", area: "Fire / evacuation",
    desc: "A fire or the need to evacuate occurs at the venue or in transit, in an unfamiliar building where the group must reach an assembly point and account for every child.",
    who: "Pupils and staff could be harmed — a fire risks burns or smoke inhalation, and a child could be lost or left behind during an evacuation.",
    initial: "M", residual: "L",
    controls: [
      "In the event of fire, activities cease and staff and children proceed to the venue's fire evacuation point / safe area.",
      "Staff check and register children at the assembly point.",
      "Further instructions are given by leadership depending on the situation.",
      "The venue's fire exits and assembly point are identified on arrival.",
    ],
  },
  {
    id: "env-water", cat: "Environment & venue", area: "Water (pool, river, open water, coast)",
    desc: "The visit involves or passes near water — a swimming pool, river, lake, canal or the coast — where a child could enter or fall into the water.",
    who: "Children could be harmed — water presents a risk of drowning or cold-water shock, which can be fatal within minutes.",
    initial: "H", residual: "M",
    controls: [
      "A qualified lifeguard (e.g. NPLQ) is on duty where required; staff supervise poolside/waterside.",
      "Children are grouped by ability and counted in and out of the water.",
      "No-running and no-entry-without-permission rules are briefed; edges and depths are checked.",
      "Buoyancy aids are used for open water; changing-room supervision is same-gender and door-supervised.",
    ],
  },
  {
    id: "env-terrain", cat: "Environment & venue", area: "Outdoor terrain / forest",
    desc: "The visit takes place on rough or natural ground — woodland, fields, hills or parkland — with uneven surfaces, obstacles and areas where a child could move out of an adult's sight.",
    who: "Children could be harmed — uneven or wooded ground risks trips and falls causing injury, or a child straying out of sight and becoming lost.",
    initial: "M", residual: "L",
    controls: [
      "Boundaries are set and shown to children; the area is checked for hazards (holes, branches, ticks, litter) before use.",
      "Appropriate footwear and clothing are worn; a first-aid kit is carried.",
      "Group sizes and counts suit the terrain; children stay within sight of an adult.",
    ],
  },
  {
    id: "env-animals", cat: "Environment & venue", area: "Animals / farm / zoo contact",
    desc: "The visit involves contact with, or proximity to, animals — a farm, zoo, city farm or petting area — where children may touch animals or their surroundings.",
    who: "Children could be harmed — animal contact risks bites, kicks or crush injuries, and infection such as E. coli or cryptosporidium causing serious illness.",
    initial: "M", residual: "L",
    controls: [
      "Hands are washed thoroughly with soap and water after any animal contact and before eating (gel is not enough).",
      "Children do not put hands/faces near mouths after touching animals; no eating in animal areas.",
      "Contact follows venue rules and is supervised; children keep clear of enclosures.",
    ],
  },
  {
    id: "env-weather-extreme", cat: "Environment & venue", area: "Extreme weather (storm / lightning)",
    desc: "Severe weather — a storm, lightning, high winds or heavy rain — develops during an outdoor visit where the group is exposed and away from immediate shelter.",
    who: "Pupils and staff could be harmed — storms risk injury from falling branches or debris, a lightning strike, or exposure to the elements.",
    initial: "M", residual: "L",
    controls: [
      "The forecast is checked; the EVC/lead decides whether to proceed, shorten or cancel.",
      "In a storm the group moves indoors/to shelter and away from water, trees and high ground.",
      "A clear recall signal and shelter point are agreed with the group.",
    ],
  },
  {
    id: "env-venue", cat: "Environment & venue", area: "Venue-specific hazards & equipment",
    desc: "The venue has its own particular hazards — machinery, water features, heights, exhibits, animals or specialist equipment — that the group is unfamiliar with and that have their own safety rules.",
    who: "Children and staff could be harmed — venue-specific hazards or equipment can cause injury if the venue's rules and briefings are not followed.",
    initial: "M", residual: "L",
    controls: [
      "The venue's own risk assessment is obtained and reviewed before the visit.",
      "Staff follow the venue's rules, safety briefing and any equipment instructions.",
      "High-risk equipment/areas are only used with venue supervision and correct ratios.",
    ],
  },
  {
    id: "env-crowds", cat: "Environment & venue", area: "Crowds / large venues / theme parks",
    desc: "The visit is to a large, busy attraction — a theme park, museum or event — with dense crowds, multiple zones and rides where children could be separated or caught in a press of people.",
    who: "Children could be harmed — busy venues risk a child being separated in the crowd, or crushing and injury in a press of people.",
    initial: "M", residual: "L",
    controls: [
      "Small groups each keep a named adult; meeting points and times are agreed across the day.",
      "Children carry a card with the group leader's mobile number (no child's name/contact visible).",
      "Head counts are taken frequently and at every ride/zone transition.",
    ],
  },
  {
    id: "env-infection", cat: "Environment & venue", area: "Infection control & hygiene",
    desc: "The group mixes with the public, shares facilities and eats away from the setting, where poor hand hygiene or an unwell child could spread illness.",
    who: "Children and staff could be harmed — poor hygiene risks the spread of illness (stomach bugs, colds) through the group.",
    initial: "L", residual: "L",
    controls: [
      "Hand hygiene is maintained, especially before eating and after the toilet or animal contact.",
      "Children who are unwell do not attend; symptoms on the day are reported to the lead.",
      "First-aiders use gloves; waste is bagged and disposed of appropriately.",
    ],
  },

  // ── Activity-specific ────────────────────────────────────────────────────
  {
    id: "act-sport", cat: "Activity-specific", area: "Sports & physical activity",
    desc: "The visit includes an active or sporting session — team games, athletics or a coached activity — with physical exertion, contact and equipment.",
    who: "Children could be harmed — physical activity risks sprains, collisions and impact injuries.",
    initial: "M", residual: "L",
    controls: [
      "Activities are age-appropriate and led by a competent coach; a warm-up is included.",
      "The playing area and equipment are checked; suitable footwear and any protective kit are worn.",
      "Rules are briefed and enforced; a first aider and kit are present.",
    ],
  },
  {
    id: "act-swim", cat: "Activity-specific", area: "Swimming lesson / pool session",
    desc: "The visit is a swimming session at a pool — children of mixed ability in and around water, plus changing rooms — supervised by the setting's staff alongside pool staff.",
    who: "Children could be harmed — a pool session risks drowning, slips on wet poolside, and safeguarding concerns in changing rooms.",
    initial: "H", residual: "M",
    controls: [
      "A qualified lifeguard is on duty and staff supervise poolside throughout.",
      "Children are grouped and taught by ability; counted in and out of the water.",
      "Poolside is walked, not run; changing rooms are same-gender supervised with no phones.",
    ],
  },
  {
    id: "act-adventure", cat: "Activity-specific", area: "Adventurous activity (climbing, watersports)",
    desc: "The visit includes a higher-risk adventurous activity — climbing, high ropes, watersports, caving or similar — delivered by an external provider using specialist equipment.",
    who: "Children could be harmed — adventurous activities risk falls from height, drowning or equipment failure causing serious injury.",
    initial: "H", residual: "M",
    controls: [
      "The provider holds a current AALA licence (where required) and provides qualified instructors.",
      "The provider's risk assessment and safety briefing are obtained and followed; correct PPE is worn and checked.",
      "Ratios and ability grouping meet the provider's requirements; a rescue/recall plan is in place.",
    ],
  },
];

export const bankByCategory = () =>
  HAZARD_CATEGORIES.map((cat) => ({ cat, entries: HAZARD_BANK.filter((e) => e.cat === cat) })).filter((g) => g.entries.length > 0);
