import type { LiveTourSteps } from "./LiveTour";
import type { SettingsLink } from "./tourNarrator";

// AUTO-GENERATED (listings + blocks tour). Merged in tourFixtures.ts / tourSteps.ts.

export const LB_FIXTURES: Record<string, Record<string, unknown>> = {
  "listings": {
    "/api/listings": [
      {
        "id": "lst-summer-w4",
        "name": "Summer Multi-Activity Camp — Week 4",
        "title": "Summer Multi-Activity Camp — Week 4",
        "tenantId": "VOiiaTnDNd03MLbZaVcM",
        "venueId": "v-riverside",
        "categoryIds": [
          "c-holiday"
        ],
        "ageFrom": "5",
        "ageTo": "12",
        "runFrom": "2026-08-17",
        "runTo": "2026-08-21",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "maxAttendees": "60",
        "capacityScope": "listing",
        "status": "live",
        "visibility": "public",
        "passes": [
          {
            "name": "5-day pass",
            "price": 165,
            "days": 5
          },
          {
            "name": "Day pass",
            "price": 38,
            "days": 1
          }
        ],
        "blocks": [
          {
            "id": "blk-sw4",
            "name": "Week 4",
            "startDate": "2026-08-17",
            "endDate": "2026-08-21",
            "capacity": 60,
            "spotsLeft": 12,
            "open": true
          }
        ]
      },
      {
        "id": "lst-summer-w5",
        "name": "Summer Multi-Activity Camp — Week 5",
        "title": "Summer Multi-Activity Camp — Week 5",
        "tenantId": "VOiiaTnDNd03MLbZaVcM",
        "venueId": "v-riverside",
        "categoryIds": [
          "c-holiday"
        ],
        "ageFrom": "5",
        "ageTo": "12",
        "runFrom": "2026-08-24",
        "runTo": "2026-08-28",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "maxAttendees": "60",
        "capacityScope": "listing",
        "status": "live",
        "visibility": "public",
        "opensAt": "2026-08-15T09:00",
        "passes": [
          {
            "name": "5-day pass",
            "price": 165,
            "days": 5
          },
          {
            "name": "Day pass",
            "price": 38,
            "days": 1
          }
        ],
        "blocks": [
          {
            "id": "blk-sw5",
            "name": "Week 5",
            "startDate": "2026-08-24",
            "endDate": "2026-08-28",
            "capacity": 60,
            "spotsLeft": 41,
            "open": true
          }
        ]
      },
      {
        "id": "lst-football-int",
        "name": "Football Intensive Camp",
        "title": "Football Intensive Camp",
        "tenantId": "VOiiaTnDNd03MLbZaVcM",
        "venueId": "v-oakwood",
        "categoryIds": [
          "c-specialist",
          "c-holiday"
        ],
        "ageFrom": "7",
        "ageTo": "12",
        "runFrom": "2026-08-11",
        "runTo": "2026-08-14",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "maxAttendees": "30",
        "capacityScope": "listing",
        "status": "live",
        "visibility": "public",
        "passes": [
          {
            "name": "4-day pass",
            "price": 120,
            "days": 4
          },
          {
            "name": "Day pass",
            "price": 35,
            "days": 1
          }
        ],
        "blocks": [
          {
            "id": "blk-fi",
            "name": "August block",
            "startDate": "2026-08-11",
            "endDate": "2026-08-14",
            "capacity": 30,
            "spotsLeft": 4,
            "open": true
          }
        ]
      },
      {
        "id": "lst-lego-robotics",
        "name": "LEGO and Robotics Camp",
        "title": "LEGO and Robotics Camp",
        "tenantId": "VOiiaTnDNd03MLbZaVcM",
        "venueId": "v-woodland",
        "categoryIds": [
          "c-specialist"
        ],
        "ageFrom": "6",
        "ageTo": "10",
        "runFrom": "2026-08-18",
        "runTo": "2026-08-20",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "maxAttendees": "24",
        "capacityScope": "listing",
        "status": "live",
        "visibility": "public",
        "passes": [
          {
            "name": "3-day pass",
            "price": 99,
            "days": 3
          },
          {
            "name": "Day pass",
            "price": 36,
            "days": 1
          }
        ],
        "blocks": [
          {
            "id": "blk-lr",
            "name": "Build week",
            "startDate": "2026-08-18",
            "endDate": "2026-08-20",
            "capacity": 24,
            "spotsLeft": 0,
            "open": true
          }
        ]
      },
      {
        "id": "lst-send-explorers",
        "name": "SEND Explorers Camp",
        "title": "SEND Explorers Camp",
        "tenantId": "VOiiaTnDNd03MLbZaVcM",
        "venueId": "v-woodland",
        "categoryIds": [
          "c-send"
        ],
        "ageFrom": "5",
        "ageTo": "12",
        "runFrom": "2026-08-19",
        "runTo": "2026-08-21",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "maxAttendees": "16",
        "capacityScope": "day",
        "status": "live",
        "visibility": "public",
        "passes": [
          {
            "name": "3-day pass",
            "price": 135,
            "days": 3
          },
          {
            "name": "Day pass (1:1 support)",
            "price": 55,
            "days": 1
          }
        ],
        "blocks": [
          {
            "id": "blk-se",
            "name": "August block",
            "startDate": "2026-08-19",
            "endDate": "2026-08-21",
            "capacity": 16,
            "spotsLeft": 9,
            "open": true
          }
        ]
      },
      {
        "id": "lst-early-july",
        "name": "Early July Adventure Camp",
        "title": "Early July Adventure Camp",
        "tenantId": "VOiiaTnDNd03MLbZaVcM",
        "venueId": "v-riverside",
        "categoryIds": [
          "c-holiday"
        ],
        "ageFrom": "6",
        "ageTo": "12",
        "runFrom": "2026-07-27",
        "runTo": "2026-07-31",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "maxAttendees": "60",
        "capacityScope": "listing",
        "status": "live",
        "visibility": "public",
        "passes": [
          {
            "name": "5-day pass",
            "price": 160,
            "days": 5
          },
          {
            "name": "Day pass",
            "price": 37,
            "days": 1
          }
        ],
        "blocks": [
          {
            "id": "blk-ej",
            "name": "Week 1",
            "startDate": "2026-07-27",
            "endDate": "2026-07-31",
            "capacity": 60,
            "spotsLeft": 3,
            "open": false
          }
        ]
      },
      {
        "id": "lst-junior-tennis",
        "name": "Junior Tennis Camp",
        "title": "Junior Tennis Camp",
        "tenantId": "VOiiaTnDNd03MLbZaVcM",
        "venueId": "v-oakwood",
        "categoryIds": [
          "c-specialist"
        ],
        "ageFrom": "8",
        "ageTo": "12",
        "runFrom": "2026-08-04",
        "runTo": "2026-08-07",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "maxAttendees": "24",
        "capacityScope": "listing",
        "status": "live",
        "visibility": "public",
        "passes": [
          {
            "name": "4-day pass",
            "price": 112,
            "days": 4
          },
          {
            "name": "Day pass",
            "price": 32,
            "days": 1
          }
        ],
        "blocks": [
          {
            "id": "blk-jt",
            "name": "August block",
            "startDate": "2026-08-04",
            "endDate": "2026-08-07",
            "capacity": 24,
            "spotsLeft": 6,
            "open": false
          }
        ]
      },
      {
        "id": "lst-afterschool-football",
        "name": "After-School Football Club",
        "title": "After-School Football Club",
        "tenantId": "VOiiaTnDNd03MLbZaVcM",
        "venueId": "v-oakwood",
        "categoryIds": [
          "c-after"
        ],
        "ageFrom": "5",
        "ageTo": "11",
        "runFrom": "2026-09-09",
        "runTo": "2026-12-09",
        "days": [
          3
        ],
        "maxAttendees": "20",
        "capacityScope": "listing",
        "status": "live",
        "visibility": "public",
        "passes": [
          {
            "name": "Autumn term (13 weeks)",
            "price": 182
          },
          {
            "name": "Half-term (6 weeks)",
            "price": 90
          }
        ],
        "blocks": [
          {
            "id": "blk-asf",
            "name": "Autumn term — Wednesdays",
            "startDate": "2026-09-09",
            "endDate": "2026-12-09",
            "capacity": 20,
            "spotsLeft": 8,
            "open": true
          }
        ]
      },
      {
        "id": "lst-breakfast-club",
        "name": "Sunrise Breakfast Club",
        "title": "Sunrise Breakfast Club",
        "tenantId": "VOiiaTnDNd03MLbZaVcM",
        "venueId": "v-riverside",
        "categoryIds": [
          "c-breakfast"
        ],
        "ageFrom": "4",
        "ageTo": "11",
        "runFrom": "2026-09-08",
        "runTo": "2026-12-11",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "maxAttendees": "30",
        "capacityScope": "day",
        "status": "live",
        "visibility": "public",
        "passes": [
          {
            "name": "Termly (5 mornings)",
            "price": 150
          },
          {
            "name": "Daily drop-in",
            "price": 5
          }
        ],
        "blocks": [
          {
            "id": "blk-bc",
            "name": "Autumn term",
            "startDate": "2026-09-08",
            "endDate": "2026-12-11",
            "capacity": 30,
            "spotsLeft": 22,
            "open": true
          }
        ]
      },
      {
        "id": "lst-saturday-art",
        "name": "Saturday Art Class",
        "title": "Saturday Art Class",
        "tenantId": "VOiiaTnDNd03MLbZaVcM",
        "venueId": "v-woodland",
        "categoryIds": [
          "c-classes"
        ],
        "ageFrom": "6",
        "ageTo": "12",
        "runFrom": "2026-09-05",
        "runTo": "2026-10-24",
        "days": [
          6
        ],
        "maxAttendees": "15",
        "capacityScope": "listing",
        "status": "live",
        "visibility": "public",
        "passes": [
          {
            "name": "8-week block",
            "price": 96
          },
          {
            "name": "Drop-in",
            "price": 14
          }
        ],
        "blocks": [
          {
            "id": "blk-sa",
            "name": "Autumn block — Saturdays",
            "startDate": "2026-09-05",
            "endDate": "2026-10-24",
            "capacity": 15,
            "spotsLeft": 5,
            "open": true
          }
        ]
      },
      {
        "id": "lst-online-coding",
        "name": "Online Coding Club",
        "title": "Online Coding Club",
        "tenantId": "VOiiaTnDNd03MLbZaVcM",
        "venueId": "v-online",
        "categoryIds": [
          "c-classes",
          "c-specialist"
        ],
        "ageFrom": "9",
        "ageTo": "12",
        "runFrom": "2026-09-10",
        "runTo": "2026-11-26",
        "days": [
          4
        ],
        "maxAttendees": "25",
        "capacityScope": "listing",
        "status": "live",
        "visibility": "public",
        "passes": [
          {
            "name": "Half-term (6 sessions)",
            "price": 54
          }
        ],
        "blocks": [
          {
            "id": "blk-oc",
            "name": "Autumn — Thursdays online",
            "startDate": "2026-09-10",
            "endDate": "2026-11-26",
            "capacity": 25,
            "spotsLeft": 18,
            "open": true
          }
        ]
      },
      {
        "id": "lst-autumn-halfterm",
        "name": "Autumn Half-Term Camp",
        "title": "Autumn Half-Term Camp",
        "tenantId": "VOiiaTnDNd03MLbZaVcM",
        "venueId": "v-riverside",
        "categoryIds": [
          "c-holiday"
        ],
        "ageFrom": "5",
        "ageTo": "12",
        "runFrom": "2026-10-26",
        "runTo": "2026-10-30",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "maxAttendees": "60",
        "capacityScope": "listing",
        "status": "draft",
        "visibility": "public",
        "passes": [
          {
            "name": "5-day pass",
            "price": 165,
            "days": 5
          },
          {
            "name": "Day pass",
            "price": 38,
            "days": 1
          }
        ],
        "blocks": [
          {
            "id": "blk-ah",
            "name": "Half-term week",
            "startDate": "2026-10-26",
            "endDate": "2026-10-30",
            "capacity": 60,
            "spotsLeft": 60,
            "open": true
          }
        ]
      },
      {
        "id": "lst-school-enrichment",
        "name": "Wellingborough School Enrichment Day",
        "title": "Wellingborough School Enrichment Day",
        "tenantId": "VOiiaTnDNd03MLbZaVcM",
        "venueId": "v-oakwood",
        "categoryIds": [
          "c-enrich"
        ],
        "ageFrom": "7",
        "ageTo": "11",
        "runFrom": "2026-09-18",
        "runTo": "2026-09-18",
        "days": [
          5
        ],
        "maxAttendees": "90",
        "capacityScope": "listing",
        "status": "live",
        "visibility": "hidden",
        "passes": [
          {
            "name": "Full day (per child)",
            "price": 18
          }
        ],
        "blocks": [
          {
            "id": "blk-en",
            "name": "Enrichment day",
            "startDate": "2026-09-18",
            "endDate": "2026-09-18",
            "capacity": 90,
            "spotsLeft": 30,
            "open": true
          }
        ]
      }
    ],
    "/api/library": {
      "whereHeading": {
        "eyebrow": "Where it runs",
        "title": "Getting there"
      },
      "categories": [
        {
          "id": "c-breakfast",
          "name": "Breakfast Clubs"
        },
        {
          "id": "c-after",
          "name": "After-School Clubs"
        },
        {
          "id": "c-holiday",
          "name": "Holiday Multi-Activity Camps"
        },
        {
          "id": "c-enrich",
          "name": "School Enrichment Days"
        },
        {
          "id": "c-specialist",
          "name": "Specialist Camps"
        },
        {
          "id": "c-classes",
          "name": "Weekly Classes"
        },
        {
          "id": "c-send",
          "name": "SEND and Inclusion"
        }
      ],
      "venues": [
        {
          "id": "v-riverside",
          "name": "Riverside Sports Hall",
          "address": "Bedford Rd, Northampton NN1 5NS",
          "city": "Northampton",
          "kind": "place",
          "facilities": [
            "Free car park",
            "Indoor sports hall",
            "Café on site",
            "Changing rooms"
          ],
          "directions": "Free car park off Bedford Road. Drop-off at the main entrance — please don't block the leisure centre bays.",
          "what3words": "///filled.count.soap",
          "transport": "Riverside bus stop, 3 min walk",
          "lat": 52.2333,
          "lng": -0.8894,
          "zoom": 16
        },
        {
          "id": "v-oakwood",
          "name": "Oakwood Leisure Centre",
          "address": "Purbeck, Milton Keynes MK14 6BN",
          "city": "Milton Keynes",
          "kind": "place",
          "facilities": [
            "Astro pitch",
            "Floodlit",
            "Changing rooms",
            "Drop-off zone"
          ],
          "directions": "Enter from Purbeck. Use the visitor car park and the side gate to the astro pitch.",
          "transport": "Purbeck Rd bus stop, 4 min walk",
          "lat": 52.0632,
          "lng": -0.7594,
          "zoom": 16
        },
        {
          "id": "v-woodland",
          "name": "Woodland Adventure Centre",
          "address": "Mowsbury Park, Bedford MK41 8DH",
          "city": "Bedford",
          "kind": "place",
          "facilities": [
            "Free car park",
            "Covered area if wet",
            "Bike racks"
          ],
          "directions": "Park in the Mowsbury Park car park and follow the signs to the adventure centre.",
          "lat": 52.1651,
          "lng": -0.4553,
          "zoom": 15
        },
        {
          "id": "v-online",
          "name": "Online",
          "address": "",
          "kind": "online",
          "directions": "A Zoom link is emailed the day before. Sessions start on the hour — please join a few minutes early."
        }
      ],
      "provided": [
        "Hot lunch",
        "Snacks and drinks",
        "All equipment",
        "Materials",
        "Water",
        "Certificate"
      ],
      "toBring": [
        "Packed lunch",
        "Sun cream",
        "Water bottle",
        "Trainers",
        "Change of clothes"
      ],
      "safety": [
        "DBS-checked staff",
        "First aid on site",
        "Safeguarding lead",
        "Low ratios",
        "Secure venue"
      ],
      "send": [
        "Wheelchair accessible",
        "1:1 support available",
        "Quiet space",
        "Visual timetables",
        "SEND-trained staff"
      ],
      "outcomes": [
        "Teamwork",
        "Confidence",
        "New skills",
        "Physical activity",
        "Creativity",
        "Making friends"
      ],
      "addons": [
        {
          "id": "a-lunch",
          "name": "Hot lunch",
          "type": "perday",
          "price": 4.5,
          "emoji": "🍽️",
          "description": "A freshly cooked hot meal each day."
        },
        {
          "id": "a-late",
          "name": "Late pick-up (till 6pm)",
          "type": "perday",
          "price": 6,
          "emoji": "🕕",
          "description": "An extra hour of supervised care at the end of the day."
        },
        {
          "id": "a-early",
          "name": "Early drop-off (from 8am)",
          "type": "perday",
          "price": 5,
          "emoji": "🌅",
          "description": "Drop off an hour early — breakfast included."
        },
        {
          "id": "a-tshirt",
          "name": "Camp T-shirt",
          "type": "once",
          "price": 9,
          "emoji": "👕",
          "description": "A branded camp T-shirt to take home.",
          "questions": [
            {
              "id": "q-size",
              "label": "T-shirt size",
              "type": "choice",
              "options": [
                "Age 5-6",
                "Age 7-8",
                "Age 9-10",
                "Age 11-12"
              ],
              "required": true
            }
          ]
        }
      ],
      "staff": [
        {
          "id": "s-alex",
          "first": "Alex",
          "last": "Turner",
          "bio": "Camp lead — DBS-checked with paediatric first aid."
        },
        {
          "id": "s-priya",
          "first": "Priya",
          "last": "Shah",
          "bio": "Sports coach and SEND-trained playworker."
        },
        {
          "id": "s-jordan",
          "first": "Jordan",
          "last": "Okafor",
          "bio": "Arts and crafts specialist."
        }
      ],
      "emojis": {},
      "settings": {
        "providerName": "Sunrise Activity Camps",
        "providerNameMode": "business",
        "marketplaceListed": true
      },
      "childQuestions": []
    }
  },
  "blocks": {
    "/api/periods": [
      {
        "id": "per-fullday",
        "title": "Full day",
        "start": "09:00",
        "finish": "15:30"
      },
      {
        "id": "per-early",
        "title": "Early drop-off",
        "start": "08:00",
        "finish": "09:00"
      },
      {
        "id": "per-late",
        "title": "Late pick-up",
        "start": "15:30",
        "finish": "17:30"
      },
      {
        "id": "per-morning",
        "title": "Morning only",
        "start": "09:00",
        "finish": "12:30"
      },
      {
        "id": "per-afternoon",
        "title": "Afternoon only",
        "start": "12:30",
        "finish": "15:30"
      },
      {
        "id": "per-extended",
        "title": "Extended day",
        "start": "08:00",
        "finish": "17:30"
      },
      {
        "id": "per-club",
        "title": "Club session",
        "start": "15:45",
        "finish": "16:45"
      },
      {
        "id": "per-class",
        "title": "Class slot",
        "start": "10:00",
        "finish": "10:45"
      },
      {
        "id": "per-saturday",
        "title": "Saturday session",
        "start": "09:30",
        "finish": "11:30"
      }
    ],
    "/api/passes": [
      {
        "id": "pass-5day",
        "name": "5-day week pass",
        "days": 5,
        "details": "Monday to Friday, our best-value full-week booking. Lunch club and all activities included."
      },
      {
        "id": "pass-4day",
        "name": "4-day pass",
        "days": 4
      },
      {
        "id": "pass-3day",
        "name": "3-day pass",
        "days": 3,
        "details": "Any three days of the week — pick your days at checkout."
      },
      {
        "id": "pass-2day",
        "name": "2-day pass",
        "days": 2
      },
      {
        "id": "pass-1day",
        "name": "Single day pass",
        "days": 1,
        "details": "Perfect for trying us out or filling a one-off gap in the holidays."
      },
      {
        "id": "pass-term12",
        "name": "Full term (12 weeks)",
        "days": 12,
        "details": "One weekly session across the whole term, paid up front."
      },
      {
        "id": "pass-term10",
        "name": "Full term (10 weeks)",
        "days": 10
      },
      {
        "id": "pass-term6",
        "name": "Half term (6 weeks)",
        "days": 6
      },
      {
        "id": "pass-taster",
        "name": "Taster session",
        "days": 1,
        "details": "A single come-and-try session before committing to the full term."
      }
    ],
    "/api/listings": [
      {
        "id": "lst-summer-camp",
        "name": "Summer Multi-Activity Camp — Loughton"
      },
      {
        "id": "lst-football-camp",
        "name": "Football Stars Holiday Camp — Chigwell"
      },
      {
        "id": "lst-football-club",
        "name": "After-School Football Club — Buckhurst Hill"
      },
      {
        "id": "lst-little-kickers",
        "name": "Little Kickers Class — Woodford"
      },
      {
        "id": "lst-art-camp",
        "name": "Holiday Art and Craft Camp — Loughton"
      },
      {
        "id": "lst-gymnastics",
        "name": "Gymnastics Club — Epping"
      },
      {
        "id": "lst-saturday-sports",
        "name": "Multi-Sports Saturday Class — Loughton"
      },
      {
        "id": "lst-tennis-camp",
        "name": "Tennis Camp — Theydon Bois"
      }
    ],
    "/api/block-bundles": [
      {
        "id": "bnd-summer-camp",
        "name": "Summer Multi-Activity Camp — Full Week",
        "periodIds": [
          "per-fullday",
          "per-early",
          "per-late"
        ],
        "passIds": [
          "pass-5day",
          "pass-3day",
          "pass-1day"
        ],
        "listingIds": [
          "lst-summer-camp",
          "lst-art-camp"
        ],
        "order": 0,
        "archived": false,
        "priced": true,
        "masterPrice": 150,
        "calcOn": true,
        "passFlat": {},
        "passMode": {},
        "periodPrice": {},
        "resolved": {
          "passes": [
            {
              "id": "pass-5day",
              "name": "5-day week pass",
              "days": 5,
              "price": 150,
              "details": "Monday to Friday, our best-value full-week booking. Lunch club and all activities included."
            },
            {
              "id": "pass-3day",
              "name": "3-day pass",
              "days": 3,
              "price": 90,
              "details": "Any three days of the week — pick your days at checkout."
            },
            {
              "id": "pass-1day",
              "name": "Single day pass",
              "days": 1,
              "price": 30,
              "details": "Perfect for trying us out or filling a one-off gap in the holidays."
            }
          ],
          "timings": {
            "pass-5day_per-fullday": 150,
            "pass-5day_per-early": 30,
            "pass-5day_per-late": 50,
            "pass-3day_per-fullday": 90,
            "pass-3day_per-early": 18,
            "pass-3day_per-late": 30,
            "pass-1day_per-fullday": 30,
            "pass-1day_per-early": 6,
            "pass-1day_per-late": 10
          },
          "perDay": 30
        }
      },
      {
        "id": "bnd-football-camp",
        "name": "Football Stars Holiday Camp",
        "periodIds": [
          "per-fullday"
        ],
        "passIds": [
          "pass-5day",
          "pass-1day"
        ],
        "listingIds": [
          "lst-football-camp"
        ],
        "order": 1,
        "archived": false,
        "priced": true,
        "masterPrice": 160,
        "calcOn": true,
        "passFlat": {},
        "passMode": {},
        "periodPrice": {},
        "resolved": {
          "passes": [
            {
              "id": "pass-5day",
              "name": "5-day week pass",
              "days": 5,
              "price": 160,
              "details": "Monday to Friday, our best-value full-week booking. Lunch club and all activities included."
            },
            {
              "id": "pass-1day",
              "name": "Single day pass",
              "days": 1,
              "price": 32,
              "details": "Perfect for trying us out or filling a one-off gap in the holidays."
            }
          ],
          "timings": {
            "pass-5day_per-fullday": 160,
            "pass-1day_per-fullday": 32
          },
          "perDay": 32
        }
      },
      {
        "id": "bnd-football-club",
        "name": "After-School Football Club — Autumn Term",
        "periodIds": [
          "per-club"
        ],
        "passIds": [
          "pass-term12",
          "pass-term6",
          "pass-1day"
        ],
        "listingIds": [
          "lst-football-club"
        ],
        "order": 2,
        "archived": false,
        "priced": true,
        "masterPrice": 96,
        "calcOn": true,
        "passFlat": {},
        "passMode": {},
        "periodPrice": {},
        "resolved": {
          "passes": [
            {
              "id": "pass-term12",
              "name": "Full term (12 weeks)",
              "days": 12,
              "price": 96,
              "details": "One weekly session across the whole term, paid up front."
            },
            {
              "id": "pass-term6",
              "name": "Half term (6 weeks)",
              "days": 6,
              "price": 48
            },
            {
              "id": "pass-1day",
              "name": "Single day pass",
              "days": 1,
              "price": 8,
              "details": "Perfect for trying us out or filling a one-off gap in the holidays."
            }
          ],
          "timings": {
            "pass-term12_per-club": 96,
            "pass-term6_per-club": 48,
            "pass-1day_per-club": 8
          },
          "perDay": 8
        }
      },
      {
        "id": "bnd-little-kickers",
        "name": "Little Kickers Class — Weekly",
        "periodIds": [
          "per-class"
        ],
        "passIds": [
          "pass-term10",
          "pass-taster"
        ],
        "listingIds": [
          "lst-little-kickers"
        ],
        "order": 3,
        "archived": false,
        "priced": true,
        "masterPrice": 70,
        "calcOn": true,
        "passFlat": {},
        "passMode": {},
        "periodPrice": {},
        "resolved": {
          "passes": [
            {
              "id": "pass-term10",
              "name": "Full term (10 weeks)",
              "days": 10,
              "price": 70
            },
            {
              "id": "pass-taster",
              "name": "Taster session",
              "days": 1,
              "price": 7,
              "details": "A single come-and-try session before committing to the full term."
            }
          ],
          "timings": {
            "pass-term10_per-class": 70,
            "pass-taster_per-class": 7
          },
          "perDay": 7
        }
      },
      {
        "id": "bnd-art-camp",
        "name": "Holiday Art and Craft Camp — Half Days",
        "periodIds": [
          "per-morning",
          "per-afternoon"
        ],
        "passIds": [
          "pass-4day",
          "pass-2day",
          "pass-1day"
        ],
        "listingIds": [
          "lst-art-camp"
        ],
        "order": 4,
        "archived": false,
        "priced": true,
        "masterPrice": 72,
        "calcOn": true,
        "passFlat": {},
        "passMode": {},
        "periodPrice": {},
        "resolved": {
          "passes": [
            {
              "id": "pass-4day",
              "name": "4-day pass",
              "days": 4,
              "price": 72
            },
            {
              "id": "pass-2day",
              "name": "2-day pass",
              "days": 2,
              "price": 36
            },
            {
              "id": "pass-1day",
              "name": "Single day pass",
              "days": 1,
              "price": 18,
              "details": "Perfect for trying us out or filling a one-off gap in the holidays."
            }
          ],
          "timings": {
            "pass-4day_per-morning": 72,
            "pass-4day_per-afternoon": 72,
            "pass-2day_per-morning": 36,
            "pass-2day_per-afternoon": 36,
            "pass-1day_per-morning": 18,
            "pass-1day_per-afternoon": 18
          },
          "perDay": 18
        }
      },
      {
        "id": "bnd-gymnastics",
        "name": "Gymnastics Club — Spring Term",
        "periodIds": [
          "per-club"
        ],
        "passIds": [
          "pass-term12",
          "pass-term6"
        ],
        "listingIds": [],
        "order": 5,
        "archived": false,
        "priced": false,
        "masterPrice": null,
        "calcOn": true,
        "passFlat": {},
        "passMode": {},
        "periodPrice": {},
        "resolved": {
          "passes": [
            {
              "id": "pass-term12",
              "name": "Full term (12 weeks)",
              "days": 12,
              "price": 0,
              "details": "One weekly session across the whole term, paid up front."
            },
            {
              "id": "pass-term6",
              "name": "Half term (6 weeks)",
              "days": 6,
              "price": 0
            }
          ],
          "timings": {
            "pass-term12_per-club": 0,
            "pass-term6_per-club": 0
          },
          "perDay": 0
        }
      },
      {
        "id": "bnd-saturday-sports",
        "name": "Multi-Sports Saturday Class",
        "periodIds": [
          "per-saturday"
        ],
        "passIds": [
          "pass-term10",
          "pass-taster"
        ],
        "listingIds": [
          "lst-saturday-sports"
        ],
        "order": 6,
        "archived": false,
        "priced": false,
        "masterPrice": null,
        "calcOn": true,
        "passFlat": {},
        "passMode": {},
        "periodPrice": {},
        "resolved": {
          "passes": [
            {
              "id": "pass-term10",
              "name": "Full term (10 weeks)",
              "days": 10,
              "price": 0
            },
            {
              "id": "pass-taster",
              "name": "Taster session",
              "days": 1,
              "price": 0,
              "details": "A single come-and-try session before committing to the full term."
            }
          ],
          "timings": {
            "pass-term10_per-saturday": 0,
            "pass-taster_per-saturday": 0
          },
          "perDay": 0
        }
      },
      {
        "id": "bnd-tennis-camp",
        "name": "Tennis Camp — Summer 2025",
        "periodIds": [
          "per-fullday"
        ],
        "passIds": [
          "pass-5day",
          "pass-1day"
        ],
        "listingIds": [],
        "order": 7,
        "archived": true,
        "priced": true,
        "masterPrice": 175,
        "calcOn": true,
        "passFlat": {},
        "passMode": {},
        "periodPrice": {},
        "resolved": {
          "passes": [
            {
              "id": "pass-5day",
              "name": "5-day week pass",
              "days": 5,
              "price": 175,
              "details": "Monday to Friday, our best-value full-week booking. Lunch club and all activities included."
            },
            {
              "id": "pass-1day",
              "name": "Single day pass",
              "days": 1,
              "price": 35,
              "details": "Perfect for trying us out or filling a one-off gap in the holidays."
            }
          ],
          "timings": {
            "pass-5day_per-fullday": 175,
            "pass-1day_per-fullday": 35
          },
          "perDay": 35
        }
      }
    ]
  }
};

export const LB_STEPS: Record<string, LiveTourSteps> = {
  "listings": {
    "title": "Listings, services and tickets",
    "introLine": "Here's your Listings page — every camp, club and class you offer, each one a bookable page for parents.",
    "doneLine": "That's your Listings page — build camps, clubs and classes, then manage how full each one is and who can see it.",
    "steps": [
      {
        "find": "Listings, services & tickets",
        "line": "This is where all your programmes live — camps, clubs and classes — each one a page parents can find and book."
      },
      {
        "find": "＋ New listing",
        "line": "Hit New listing to open the guided builder and create a camp, club or class from scratch."
      },
      {
        "find": "Published",
        "line": "Flip between Published, Unpublished and Ended to see each listing's status at a glance."
      },
      {
        "find": "Runs on",
        "line": "Search, filter by location, category or the exact date a listing runs on, then sort however you like."
      },
      {
        "find": "Public",
        "line": "Every card shows how full it is, and lets you flip a listing between public and hidden or copy its booking link."
      },
      {
        "find": "Categories",
        "line": "The Categories tab holds the filters parents browse by, like Holiday Camp or After-School Club."
      },
      {
        "find": "Locations",
        "line": "Locations is your venues — set each address and map pin once, then reuse it across every listing."
      }
    ]
  },
  "blocks": {
    "title": "Sessions and blocks",
    "introLine": "This is your blocks builder — the reusable scheduling patterns behind every camp, club and class you run. Let me walk you through how periods, passes and priced blocks fit together.",
    "doneLine": "That's the full loop: build a period, add a pass, combine them into a block, price it once and send it to as many listings as you like.",
    "steps": [
      {
        "find": "Sessions & blocks",
        "line": "Welcome to Sessions and blocks — your reusable scheduling patterns for every camp, club and class, built once and shared across all your listings."
      },
      {
        "find": "Make your periods",
        "line": "Start here. A period is just a session time window — a full day, an early drop-off, a late pick-up — and those timings feed straight into the price calculator."
      },
      {
        "find": "Make your passes",
        "line": "Next, passes. A pass is simply how long a parent books, from a single day to a full 5-day week or a whole term. You offer the options, the calculator does the maths."
      },
      {
        "find": "Build your blocks",
        "line": "Now combine them. Add the periods and passes you want, give your block a name, and move it into your library to reuse anywhere."
      },
      {
        "find": "Block Library",
        "line": "Here are your finished blocks — camps, clubs and classes side by side. Drag the handle to reorder, search by name, and expand any card to see what's inside."
      },
      {
        "find": "Sort pricing",
        "line": "Open Sort pricing to set the full price for your longest pass — every shorter pass and each timing is worked out for you, pro-rata, and you can override any of them."
      },
      {
        "find": "Sent to listings",
        "line": "Finally, send a block to one or more listings. It snapshots the pass prices onto each, so one priced block powers all your bookings at once."
      }
    ]
  }
};

export const LB_SETTINGS: Record<string, SettingsLink[]> = {
  "listings": [
    {
      "icon": "🆕",
      "label": "New listing defaults",
      "tab": "defaults",
      "note": "What every new listing starts with — default capacity, running days and whether spaces are shown."
    },
    {
      "icon": "🗓️",
      "label": "Seasons",
      "tab": "seasons",
      "note": "Your term and holiday date ranges, so each listing can be tagged to the season it runs in."
    },
    {
      "icon": "↩️",
      "label": "Cancellation policies",
      "tab": "cancel",
      "note": "The refund policies a listing can be built on and offer to parents."
    },
    {
      "icon": "👶",
      "label": "Age & ratio groups",
      "tab": "groups",
      "note": "The age bands that drive the optional per-group place caps on a listing."
    },
    {
      "icon": "🌐",
      "label": "Marketplace",
      "tab": "marketplace",
      "note": "Whether your public listings also appear in the cross-provider Browse feed."
    }
  ],
  "blocks": [
    {
      "icon": "🗓️",
      "label": "Bookings",
      "tab": "bookings",
      "note": "Booking rules and capacity limits that every block's passes book against."
    },
    {
      "icon": "🍂",
      "label": "Seasons",
      "tab": "seasons",
      "note": "Holiday and term date ranges that scope when your blocks actually run."
    },
    {
      "icon": "💷",
      "label": "Money",
      "tab": "money",
      "note": "Pricing, tax and payout defaults sitting behind the block price calculator."
    },
    {
      "icon": "⚙️",
      "label": "Defaults",
      "tab": "defaults",
      "note": "Default listing and booking settings new blocks inherit when you send them out."
    }
  ]
};
