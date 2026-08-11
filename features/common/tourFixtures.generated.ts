// AUTO-GENERATED from the tour-fixtures workflow. Do not edit by hand —
// regenerated as more pages complete. Merged in tourFixtures.ts.

export const GENERATED_FIXTURES: Record<string, Record<string, unknown>> = {
  "customers": {
    "/api/me": {
      "role": "freelancer",
      "name": "Holly Bennett",
      "tenantId": "VOiiaTnDNd03MLbZaVcM"
    },
    "/api/library": {
      "venues": [
        {
          "id": "v-bedford",
          "name": "Bedford — Robinson Pool Sports Hall"
        },
        {
          "id": "v-milton",
          "name": "Milton Keynes — Stantonbury Leisure Centre"
        },
        {
          "id": "v-luton",
          "name": "Luton — Lea Manor Recreation Centre"
        },
        {
          "id": "v-stalbans",
          "name": "St Albans — Verulamium Community Hall"
        }
      ],
      "settings": {
        "requireDob": false,
        "askPhotoConsent": true,
        "collectSend": true,
        "collectSendPlan": true,
        "providerName": "Holly's Holiday Camps"
      },
      "childQuestions": []
    },
    "/api/customers": [
      {
        "id": "cust-thompson",
        "name": "Sarah Thompson",
        "firstName": "Sarah",
        "lastName": "Thompson",
        "email": "sarah.thompson@gmail.com",
        "phone": "07700 900101",
        "locationId": "v-bedford",
        "locationName": "Bedford — Robinson Pool Sports Hall",
        "marketingOptIn": true,
        "marketingOptInAt": "2026-06-02T09:14:00.000Z",
        "notes": "Rang about the August Multi-Sports week. Dad (Mark) collects on Fridays. Very happy after July camp.",
        "invitedAt": "2026-05-28T10:00:00.000Z",
        "joinedAt": "2026-05-29T18:22:00.000Z",
        "children": [
          {
            "name": "Amelia Thompson",
            "dob": "2017-03-14",
            "allergies": "Peanuts, tree nuts — carries an EpiPen",
            "medical": "Mild asthma, blue inhaler in her bag",
            "send": "",
            "dietary": "No pork",
            "collectionPassword": "Bluebell",
            "photoConsent": true,
            "emergencyName": "Mark Thompson (dad)",
            "emergencyPhone": "07700 900102",
            "likes": "Football, gymnastics, drawing",
            "dislikes": "Loud whistles"
          },
          {
            "name": "Oliver Thompson",
            "dob": "2019-06-02"
          }
        ]
      },
      {
        "id": "cust-patel",
        "name": "James Patel",
        "firstName": "James",
        "lastName": "Patel",
        "email": "james.patel@outlook.com",
        "phone": "07700 900110",
        "locationId": "v-milton",
        "locationName": "Milton Keynes — Stantonbury Leisure Centre",
        "marketingOptIn": true,
        "marketingOptInAt": "2026-06-10T12:00:00.000Z",
        "notes": "Two children, both did Football Academy in July. Interested in the October half-term camp.",
        "invitedAt": "2026-05-20T09:00:00.000Z",
        "joinedAt": "2026-05-21T08:05:00.000Z",
        "children": [
          {
            "name": "Priya Patel",
            "dob": "2015-11-20",
            "allergies": "None recorded",
            "medical": "",
            "send": "Dyslexia — benefits from clear verbal instructions",
            "sendPlanName": "Priya — SEND support plan.pdf",
            "sendPlanId": "file-priya-send",
            "collectionPassword": "Sunflower",
            "photoConsent": true,
            "emergencyName": "Anita Patel (mum)",
            "emergencyPhone": "07700 900111",
            "likes": "Football, coding",
            "dislikes": ""
          },
          {
            "name": "Arjun Patel",
            "dob": "2018-01-30",
            "allergies": "Dairy intolerance",
            "medical": "",
            "dietary": "Lactose-free",
            "photoConsent": false,
            "emergencyName": "Anita Patel (mum)",
            "emergencyPhone": "07700 900111",
            "likes": "Dinosaurs, Lego"
          }
        ]
      },
      {
        "id": "cust-wilson",
        "name": "Thomas Wilson",
        "firstName": "Thomas",
        "lastName": "Wilson",
        "email": "thomas.wilson@gmail.com",
        "phone": "07700 900120",
        "locationId": "v-stalbans",
        "locationName": "St Albans — Verulamium Community Hall",
        "marketingOptIn": false,
        "notes": "Booked Forest School twice. Lily loves the outdoor sessions — keen for every holiday.",
        "invitedAt": "2026-04-15T09:00:00.000Z",
        "joinedAt": "2026-04-16T07:40:00.000Z",
        "children": [
          {
            "name": "Lily Wilson",
            "dob": "2015-05-05",
            "allergies": "Bee stings — antihistamine in bag",
            "medical": "",
            "send": "",
            "collectionPassword": "Acorn",
            "photoConsent": true,
            "emergencyName": "Rachel Wilson (mum)",
            "emergencyPhone": "07700 900121",
            "likes": "Den building, bug hunting",
            "dislikes": "Getting muddy hands"
          }
        ]
      },
      {
        "id": "cust-wright",
        "name": "Emma Wright",
        "firstName": "Emma",
        "lastName": "Wright",
        "email": "emma.wright@gmail.com",
        "phone": "07700 900130",
        "locationId": "v-luton",
        "locationName": "Luton — Lea Manor Recreation Centre",
        "marketingOptIn": true,
        "marketingOptInAt": "2026-07-01T14:30:00.000Z",
        "notes": "First booking was the July Gymnastics camp. Asked about sibling discounts.",
        "joinedAt": "2026-06-30T19:00:00.000Z",
        "children": [
          {
            "name": "Jack Wright",
            "dob": "2016-09-05",
            "allergies": "None recorded",
            "medical": "Wears glasses",
            "photoConsent": true,
            "emergencyName": "Tom Wright (dad)",
            "emergencyPhone": "07700 900131",
            "likes": "Gymnastics, trampolining"
          }
        ]
      },
      {
        "id": "cust-oconnor",
        "name": "Daniel O'Connor",
        "firstName": "Daniel",
        "lastName": "O'Connor",
        "email": "daniel.oconnor@yahoo.co.uk",
        "phone": "07700 900140",
        "locationId": "v-stalbans",
        "locationName": "St Albans — Verulamium Community Hall",
        "marketingOptIn": false,
        "notes": "Signed up online, booked one Dance & Drama week for Freya.",
        "invitedAt": "2026-07-05T10:00:00.000Z",
        "joinedAt": "2026-07-06T09:12:00.000Z",
        "children": [
          {
            "name": "Freya O'Connor",
            "dob": "2020-04-18"
          }
        ]
      },
      {
        "id": "cust-taylor",
        "name": "Rebecca Taylor",
        "firstName": "Rebecca",
        "lastName": "Taylor",
        "email": "rebecca.taylor@gmail.com",
        "phone": "07700 900150",
        "locationId": "v-bedford",
        "locationName": "Bedford — Robinson Pool Sports Hall",
        "marketingOptIn": true,
        "marketingOptInAt": "2026-07-18T08:00:00.000Z",
        "notes": "Booked the Bedford Multi-Sports week for both children. Paid by childcare voucher.",
        "joinedAt": "2026-07-17T20:15:00.000Z",
        "children": [
          {
            "name": "Ella Taylor",
            "dob": "2016-10-30",
            "allergies": "Gluten (coeliac)",
            "dietary": "Gluten-free — brings own snacks",
            "photoConsent": true,
            "emergencyName": "Sophie Taylor (mum)",
            "emergencyPhone": "07700 900151",
            "likes": "Netball, art"
          },
          {
            "name": "Noah Taylor",
            "dob": "2019-03-25"
          }
        ]
      },
      {
        "id": "cust-khan",
        "name": "Aisha Khan",
        "firstName": "Aisha",
        "lastName": "Khan",
        "email": "aisha.khan@gmail.com",
        "phone": "07700 900160",
        "locationId": "v-bedford",
        "locationName": "Bedford — Robinson Pool Sports Hall",
        "marketingOptIn": true,
        "marketingOptInAt": "2026-08-01T11:00:00.000Z",
        "notes": "Enquired about August availability for Yusuf. Sign-up link sent, waiting for her to set a password.",
        "invitedAt": "2026-08-02T09:30:00.000Z",
        "children": [
          {
            "name": "Yusuf Khan",
            "dob": "2014-07-22"
          }
        ]
      },
      {
        "id": "cust-evans",
        "name": "Charlotte Evans",
        "firstName": "Charlotte",
        "lastName": "Evans",
        "email": "charlotte.evans@hotmail.com",
        "phone": "07700 900170",
        "locationId": "v-milton",
        "locationName": "Milton Keynes — Stantonbury Leisure Centre",
        "marketingOptIn": false,
        "notes": "Two girls, asked about the Gymnastics camp. Link sent last week.",
        "invitedAt": "2026-08-04T15:20:00.000Z",
        "children": [
          {
            "name": "Sophie Evans",
            "dob": "2019-12-01"
          },
          {
            "name": "Grace Evans",
            "dob": "2021-05-10"
          }
        ]
      },
      {
        "id": "cust-brown",
        "name": "Michael Brown",
        "firstName": "Michael",
        "lastName": "Brown",
        "email": "michael.brown@gmail.com",
        "phone": "07700 900180",
        "locationId": "v-luton",
        "locationName": "Luton — Lea Manor Recreation Centre",
        "marketingOptIn": false,
        "notes": "Phoned to ask about Football Academy prices. Not booked yet.",
        "children": [
          {
            "name": "Harry Brown",
            "dob": "2018-08-08"
          }
        ]
      },
      {
        "id": "cust-ali",
        "name": "Fatima Ali",
        "firstName": "Fatima",
        "lastName": "Ali",
        "email": "fatima.ali@gmail.com",
        "phone": "07700 900190",
        "marketingOptIn": true,
        "marketingOptInAt": "2026-08-06T13:00:00.000Z",
        "notes": "Enquired via the website contact form. Hasn't said which site yet.",
        "children": [
          {
            "name": "Zara Ali",
            "dob": "2017-02-11"
          }
        ]
      },
      {
        "id": "cust-sharma",
        "name": "Priya Sharma",
        "firstName": "Priya",
        "lastName": "Sharma",
        "email": "priya.sharma@gmail.com",
        "phone": "07700 900200",
        "locationId": "v-milton",
        "locationName": "Milton Keynes — Stantonbury Leisure Centre",
        "marketingOptIn": false,
        "notes": "Booked a Forest School day in July then cancelled — child was ill. Still a lead until she rebooks.",
        "children": [
          {
            "name": "Aarav Sharma",
            "dob": "2018-11-14"
          }
        ]
      },
      {
        "id": "cust-clark",
        "name": "George Clark",
        "firstName": "George",
        "lastName": "Clark",
        "email": "george.clark@gmail.com",
        "phone": "07700 900210",
        "locationId": "v-luton",
        "locationName": "Luton — Lea Manor Recreation Centre",
        "marketingOptIn": false,
        "notes": "Grandparent enquiring on behalf of grandchildren — hasn't given their details yet.",
        "children": []
      }
    ],
    "/api/bookings": [
      {
        "ref": "ACT-1001",
        "bid": "b1001",
        "booker": "Sarah Thompson",
        "email": "sarah.thompson@gmail.com",
        "phone": "07700 900101",
        "child": "Amelia Thompson",
        "listing": "Multi-Sports Holiday Camp",
        "pass": "Full week",
        "ticket": "Child",
        "dates": "20 Jul – 24 Jul 2026",
        "sessions": [
          "Mon 20 Jul 2026 · Multi-Sports",
          "Tue 21 Jul 2026 · Multi-Sports",
          "Wed 22 Jul 2026 · Multi-Sports",
          "Thu 23 Jul 2026 · Multi-Sports",
          "Fri 24 Jul 2026 · Multi-Sports"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 150,
        "kids": [
          {
            "name": "Amelia Thompson",
            "dob": "2017-03-14"
          },
          {
            "name": "Oliver Thompson",
            "dob": "2019-06-02"
          }
        ],
        "addons": [],
        "answers": [],
        "note": "",
        "recon": null,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "ACT-1012",
        "bid": "b1012",
        "booker": "Sarah Thompson",
        "email": "sarah.thompson@gmail.com",
        "phone": "07700 900101",
        "child": "Amelia Thompson",
        "listing": "Football Academy",
        "pass": "3 days",
        "ticket": "Child",
        "dates": "10 Aug – 12 Aug 2026",
        "sessions": [
          "Mon 10 Aug 2026 · Football",
          "Tue 11 Aug 2026 · Football",
          "Wed 12 Aug 2026 · Football"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 96,
        "kids": [
          {
            "name": "Amelia Thompson",
            "dob": "2017-03-14"
          }
        ],
        "addons": [
          "Early drop-off"
        ],
        "answers": [],
        "note": "",
        "recon": null,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "ACT-1002",
        "bid": "b1002",
        "booker": "James Patel",
        "email": "james.patel@outlook.com",
        "phone": "07700 900110",
        "child": "Priya Patel",
        "listing": "Football Academy",
        "pass": "Full week",
        "ticket": "Child",
        "dates": "20 Jul – 24 Jul 2026",
        "sessions": [
          "Mon 20 Jul 2026 · Football",
          "Tue 21 Jul 2026 · Football",
          "Wed 22 Jul 2026 · Football",
          "Thu 23 Jul 2026 · Football",
          "Fri 24 Jul 2026 · Football"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 160,
        "kids": [
          {
            "name": "Priya Patel",
            "dob": "2015-11-20"
          },
          {
            "name": "Arjun Patel",
            "dob": "2018-01-30"
          }
        ],
        "addons": [],
        "answers": [],
        "note": "",
        "recon": null,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "ACT-1013",
        "bid": "b1013",
        "booker": "James Patel",
        "email": "james.patel@outlook.com",
        "phone": "07700 900110",
        "child": "Arjun Patel",
        "listing": "Gymnastics Camp",
        "pass": "2 days",
        "ticket": "Child",
        "dates": "05 Aug – 06 Aug 2026",
        "sessions": [
          "Tue 05 Aug 2026 · Gymnastics",
          "Wed 06 Aug 2026 · Gymnastics"
        ],
        "status": "Confirmed",
        "pay": "Partially paid",
        "method": "Childcare voucher",
        "amount": 70,
        "amountPaid": 35,
        "kids": [
          {
            "name": "Arjun Patel",
            "dob": "2018-01-30"
          }
        ],
        "addons": [],
        "answers": [],
        "note": "",
        "recon": null,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "ACT-1003",
        "bid": "b1003",
        "booker": "Thomas Wilson",
        "email": "thomas.wilson@gmail.com",
        "phone": "07700 900120",
        "child": "Lily Wilson",
        "listing": "Forest School",
        "pass": "Full week",
        "ticket": "Child",
        "dates": "27 Jul – 31 Jul 2026",
        "sessions": [
          "Mon 27 Jul 2026 · Forest School",
          "Tue 28 Jul 2026 · Forest School",
          "Wed 29 Jul 2026 · Forest School",
          "Thu 30 Jul 2026 · Forest School",
          "Fri 31 Jul 2026 · Forest School"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 175,
        "kids": [
          {
            "name": "Lily Wilson",
            "dob": "2015-05-05"
          }
        ],
        "addons": [
          "Lunch club"
        ],
        "answers": [],
        "note": "",
        "recon": null,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "ACT-1014",
        "bid": "b1014",
        "booker": "Thomas Wilson",
        "email": "thomas.wilson@gmail.com",
        "phone": "07700 900120",
        "child": "Lily Wilson",
        "listing": "Forest School",
        "pass": "2 days",
        "ticket": "Child",
        "dates": "17 Aug – 18 Aug 2026",
        "sessions": [
          "Mon 17 Aug 2026 · Forest School",
          "Tue 18 Aug 2026 · Forest School"
        ],
        "status": "Approval needed",
        "pay": "Unpaid",
        "method": "—",
        "amount": 70,
        "kids": [
          {
            "name": "Lily Wilson",
            "dob": "2015-05-05"
          }
        ],
        "addons": [],
        "answers": [],
        "note": "",
        "recon": null,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "ACT-1004",
        "bid": "b1004",
        "booker": "Emma Wright",
        "email": "emma.wright@gmail.com",
        "phone": "07700 900130",
        "child": "Jack Wright",
        "listing": "Gymnastics Camp",
        "pass": "Full week",
        "ticket": "Child",
        "dates": "20 Jul – 24 Jul 2026",
        "sessions": [
          "Mon 20 Jul 2026 · Gymnastics",
          "Tue 21 Jul 2026 · Gymnastics",
          "Wed 22 Jul 2026 · Gymnastics",
          "Thu 23 Jul 2026 · Gymnastics",
          "Fri 24 Jul 2026 · Gymnastics"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 150,
        "kids": [
          {
            "name": "Jack Wright",
            "dob": "2016-09-05"
          }
        ],
        "addons": [],
        "answers": [],
        "note": "",
        "recon": null,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "ACT-1005",
        "bid": "b1005",
        "booker": "Daniel O'Connor",
        "email": "daniel.oconnor@yahoo.co.uk",
        "phone": "07700 900140",
        "child": "Freya O'Connor",
        "listing": "Dance & Drama Camp",
        "pass": "3 days",
        "ticket": "Child",
        "dates": "05 Aug – 07 Aug 2026",
        "sessions": [
          "Tue 05 Aug 2026 · Dance & Drama",
          "Wed 06 Aug 2026 · Dance & Drama",
          "Thu 07 Aug 2026 · Dance & Drama"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 90,
        "kids": [
          {
            "name": "Freya O'Connor",
            "dob": "2020-04-18"
          }
        ],
        "addons": [],
        "answers": [],
        "note": "",
        "recon": null,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "ACT-1006",
        "bid": "b1006",
        "booker": "Rebecca Taylor",
        "email": "rebecca.taylor@gmail.com",
        "phone": "07700 900150",
        "child": "Ella Taylor",
        "listing": "Multi-Sports Holiday Camp",
        "pass": "Full week",
        "ticket": "Child",
        "dates": "10 Aug – 14 Aug 2026",
        "sessions": [
          "Mon 10 Aug 2026 · Multi-Sports",
          "Tue 11 Aug 2026 · Multi-Sports",
          "Wed 12 Aug 2026 · Multi-Sports",
          "Thu 13 Aug 2026 · Multi-Sports",
          "Fri 14 Aug 2026 · Multi-Sports"
        ],
        "status": "Confirmed",
        "pay": "Funded",
        "method": "Childcare voucher",
        "amount": 260,
        "kids": [
          {
            "name": "Ella Taylor",
            "dob": "2016-10-30"
          },
          {
            "name": "Noah Taylor",
            "dob": "2019-03-25"
          }
        ],
        "addons": [
          "Late pick-up"
        ],
        "answers": [],
        "note": "",
        "recon": null,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "ACT-1007",
        "bid": "b1007",
        "booker": "Priya Sharma",
        "email": "priya.sharma@gmail.com",
        "phone": "07700 900200",
        "child": "Aarav Sharma",
        "listing": "Forest School",
        "pass": "1 day",
        "ticket": "Child",
        "dates": "22 Jul 2026",
        "sessions": [
          "Wed 22 Jul 2026 · Forest School"
        ],
        "status": "Cancelled",
        "pay": "Refunded",
        "method": "Card",
        "amount": 35,
        "kids": [
          {
            "name": "Aarav Sharma",
            "dob": "2018-11-14"
          }
        ],
        "addons": [],
        "answers": [],
        "note": "",
        "recon": null,
        "evid": null,
        "cancel": {
          "on": "2026-07-19T10:00:00.000Z",
          "by": "parent",
          "reason": "Illness",
          "refund": "full",
          "amount": 35
        }
      }
    ]
  },
  "meals": {
    "/api/me": {
      "role": "freelancer",
      "name": "Sunny Day Camps",
      "email": "hello@sunnydaycamps.co.uk"
    },
    "/api/meal-menus": [
      {
        "id": "m-hot",
        "name": "Hot lunch menu",
        "items": [
          {
            "id": "it-chicken",
            "name": "Roast chicken & roast potatoes",
            "price": 4.5,
            "allergens": [],
            "description": "Served with seasonal veg and gravy",
            "diet": "meat"
          },
          {
            "id": "it-veg-pasta",
            "name": "Veggie pasta bake",
            "price": 4,
            "allergens": [
              "gluten",
              "milk"
            ],
            "description": "Tomato & cheese pasta bake with garlic bread",
            "diet": "veg"
          },
          {
            "id": "it-fish",
            "name": "Fish fingers & chips",
            "price": 4.5,
            "allergens": [
              "fish",
              "gluten"
            ],
            "description": "With peas and a lemon wedge",
            "capacity": 30
          }
        ]
      },
      {
        "id": "m-packed",
        "name": "Packed lunch menu",
        "items": [
          {
            "id": "it-ham",
            "name": "Ham sandwich, fruit & crisps",
            "price": 3.5,
            "allergens": [
              "gluten"
            ],
            "description": "Wholemeal roll, apple and a small crisps",
            "diet": "meat"
          },
          {
            "id": "it-cheese",
            "name": "Cheese sandwich, fruit & crisps",
            "price": 3.5,
            "allergens": [
              "gluten",
              "milk"
            ],
            "description": "Cheddar in a wholemeal roll with fruit",
            "diet": "veg"
          },
          {
            "id": "it-hummus",
            "name": "Hummus & veg wrap",
            "price": 3.75,
            "allergens": [
              "gluten",
              "sesame"
            ],
            "description": "Hummus, cucumber and pepper in a wrap",
            "diet": "vegan"
          }
        ]
      },
      {
        "id": "m-hot-tea",
        "name": "Hot tea menu",
        "items": [
          {
            "id": "it-jacket",
            "name": "Jacket potato & beans",
            "price": 3.8,
            "allergens": [],
            "description": "With a side salad",
            "diet": "veg"
          },
          {
            "id": "it-curry",
            "name": "Chicken curry & rice",
            "price": 4.75,
            "allergens": [],
            "description": "Mild korma-style curry",
            "diet": "meat"
          },
          {
            "id": "it-veg-curry",
            "name": "Veg curry & rice",
            "price": 4.25,
            "allergens": [],
            "description": "Chickpea & sweet potato curry",
            "diet": "vegan"
          }
        ]
      },
      {
        "id": "m-friday",
        "name": "Friday treat menu",
        "items": [
          {
            "id": "it-pizza",
            "name": "Margherita pizza slice",
            "price": 4,
            "allergens": [
              "gluten",
              "milk"
            ],
            "description": "Cheese & tomato, with cucumber sticks",
            "diet": "veg"
          },
          {
            "id": "it-pepperoni",
            "name": "Pepperoni pizza slice",
            "price": 4.25,
            "allergens": [
              "gluten",
              "milk"
            ],
            "description": "With cucumber sticks",
            "diet": "meat"
          }
        ]
      },
      {
        "id": "m-breakfast",
        "name": "Breakfast club menu",
        "items": [
          {
            "id": "it-toast",
            "name": "Toast & cereal",
            "price": 2,
            "allergens": [
              "gluten",
              "milk"
            ],
            "description": "Choice of cereal, toast with jam",
            "diet": "veg"
          },
          {
            "id": "it-porridge",
            "name": "Porridge & fruit",
            "price": 2.5,
            "allergens": [
              "milk"
            ],
            "description": "With banana or berries",
            "diet": "veg"
          }
        ]
      }
    ],
    "/api/listings": [
      {
        "id": "L1",
        "title": "Summer Multi-Sports Camp — Guildford",
        "archived": false,
        "seasonId": "s-summer-hols",
        "runFrom": "2026-07-20",
        "runTo": "2026-08-14",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "datesOff": [],
        "mealsEnabled": true,
        "mealPlan": {
          "2026-07-20": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken",
              "it-veg-pasta"
            ]
          },
          "2026-07-22": {
            "menuId": "m-hot",
            "itemIds": [
              "it-fish",
              "it-veg-pasta"
            ]
          },
          "2026-07-24": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken"
            ]
          },
          "2026-07-27": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken",
              "it-veg-pasta"
            ]
          },
          "2026-07-29": {
            "menuId": "m-hot",
            "itemIds": [
              "it-fish",
              "it-veg-pasta"
            ]
          },
          "2026-07-31": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken",
              "it-veg-pasta"
            ]
          },
          "2026-08-03": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken",
              "it-veg-pasta"
            ]
          },
          "2026-08-05": {
            "menuId": "m-hot",
            "itemIds": [
              "it-fish",
              "it-veg-pasta"
            ]
          },
          "2026-08-07": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken",
              "it-veg-pasta"
            ]
          },
          "2026-08-10": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken",
              "it-veg-pasta"
            ]
          },
          "2026-08-12": {
            "menuId": "m-hot",
            "itemIds": [
              "it-fish",
              "it-veg-pasta"
            ]
          },
          "2026-08-14": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken",
              "it-veg-pasta"
            ]
          }
        },
        "mealConfig": {
          "catererEmail": "kitchen@sunnydaycamps.co.uk",
          "catererEvery": "day",
          "catererAt": "07:30",
          "cutoffWhen": "prev",
          "cutoffTime": "18:00"
        }
      },
      {
        "id": "L2",
        "title": "Summer Football Academy — Woking",
        "archived": false,
        "seasonId": "s-summer-hols",
        "runFrom": "2026-07-20",
        "runTo": "2026-08-07",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "datesOff": [],
        "mealsEnabled": true,
        "mealPlan": {
          "2026-07-20": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-07-21": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-07-22": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-07-23": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-07-24": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-07-27": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-07-28": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-07-29": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-07-30": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-07-31": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-08-03": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-08-04": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-08-05": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-08-06": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          },
          "2026-08-07": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-cheese",
              "it-hummus"
            ]
          }
        },
        "mealConfig": {
          "catererEvery": "off",
          "cutoffWhen": "same",
          "cutoffTime": "08:00"
        }
      },
      {
        "id": "L3",
        "title": "Gymnastics Holiday Club — Godalming",
        "archived": false,
        "seasonId": "s-summer-hols",
        "runFrom": "2026-08-03",
        "runTo": "2026-08-28",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "datesOff": [
          "2026-08-24"
        ],
        "mealsEnabled": true,
        "mealPlan": {
          "2026-08-04": {
            "menuId": "m-hot-tea",
            "itemIds": [
              "it-jacket",
              "it-curry",
              "it-veg-curry"
            ]
          },
          "2026-08-06": {
            "menuId": "m-hot-tea",
            "itemIds": [
              "it-jacket",
              "it-curry",
              "it-veg-curry"
            ]
          },
          "2026-08-11": {
            "menuId": "m-hot-tea",
            "itemIds": [
              "it-jacket",
              "it-curry",
              "it-veg-curry"
            ]
          },
          "2026-08-13": {
            "menuId": "m-hot-tea",
            "itemIds": [
              "it-jacket",
              "it-curry",
              "it-veg-curry"
            ]
          },
          "2026-08-18": {
            "menuId": "m-hot-tea",
            "itemIds": [
              "it-jacket",
              "it-curry",
              "it-veg-curry"
            ]
          },
          "2026-08-20": {
            "menuId": "m-hot-tea",
            "itemIds": [
              "it-jacket",
              "it-curry",
              "it-veg-curry"
            ]
          },
          "2026-08-25": {
            "menuId": "m-hot-tea",
            "itemIds": [
              "it-jacket",
              "it-curry",
              "it-veg-curry"
            ]
          },
          "2026-08-27": {
            "menuId": "m-hot-tea",
            "itemIds": [
              "it-jacket",
              "it-curry",
              "it-veg-curry"
            ]
          }
        },
        "mealConfig": {
          "catererEmail": "chef@flipsgym.co.uk",
          "catererEvery": "week",
          "catererAt": "09:00",
          "cutoffWhen": "2days",
          "cutoffTime": "12:00"
        }
      },
      {
        "id": "L4",
        "title": "Forest School Adventure Camp — Cranleigh",
        "archived": false,
        "seasonId": "s-summer-2",
        "runFrom": "2026-07-27",
        "runTo": "2026-08-21",
        "days": [
          1,
          3,
          5
        ],
        "datesOff": [],
        "mealsEnabled": true,
        "mealPlan": {
          "2026-07-27": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-hummus"
            ]
          },
          "2026-07-29": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-hummus"
            ]
          },
          "2026-07-31": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-hummus"
            ]
          },
          "2026-08-03": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-hummus"
            ]
          },
          "2026-08-05": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-hummus"
            ]
          },
          "2026-08-07": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-hummus"
            ]
          },
          "2026-08-10": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-hummus"
            ]
          },
          "2026-08-12": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-hummus"
            ]
          },
          "2026-08-14": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-hummus"
            ]
          },
          "2026-08-17": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-hummus"
            ]
          },
          "2026-08-19": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-hummus"
            ]
          },
          "2026-08-21": {
            "menuId": "m-packed",
            "itemIds": [
              "it-ham",
              "it-hummus"
            ]
          }
        },
        "mealConfig": {}
      },
      {
        "id": "L5",
        "title": "Drama & Performing Arts Week — Farnham",
        "archived": false,
        "seasonId": "s-summer-hols",
        "runFrom": "2026-08-17",
        "runTo": "2026-08-21",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "datesOff": [],
        "mealsEnabled": false,
        "mealPlan": {},
        "mealConfig": {}
      },
      {
        "id": "L6",
        "title": "Holiday Camp — Aldershot Kids Club",
        "archived": false,
        "seasonId": "s-summer-hols",
        "runFrom": "2026-07-20",
        "runTo": "2026-08-28",
        "days": [
          1,
          2,
          3,
          4,
          5
        ],
        "datesOff": [],
        "mealsEnabled": true,
        "mealPlan": {
          "2026-07-22": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken",
              "it-veg-pasta",
              "it-fish"
            ]
          },
          "2026-07-24": {
            "menuId": "m-friday",
            "itemIds": [
              "it-pizza",
              "it-pepperoni"
            ]
          },
          "2026-07-29": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken",
              "it-veg-pasta",
              "it-fish"
            ]
          },
          "2026-07-31": {
            "menuId": "m-friday",
            "itemIds": [
              "it-pizza",
              "it-pepperoni"
            ]
          },
          "2026-08-05": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken",
              "it-veg-pasta",
              "it-fish"
            ]
          },
          "2026-08-07": {
            "menuId": "m-friday",
            "itemIds": [
              "it-pizza",
              "it-pepperoni"
            ]
          },
          "2026-08-12": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken",
              "it-veg-pasta",
              "it-fish"
            ]
          },
          "2026-08-14": {
            "menuId": "m-friday",
            "itemIds": [
              "it-pizza",
              "it-pepperoni"
            ]
          },
          "2026-08-19": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken",
              "it-veg-pasta",
              "it-fish"
            ]
          },
          "2026-08-21": {
            "menuId": "m-friday",
            "itemIds": [
              "it-pizza",
              "it-pepperoni"
            ]
          },
          "2026-08-26": {
            "menuId": "m-hot",
            "itemIds": [
              "it-chicken",
              "it-veg-pasta",
              "it-fish"
            ]
          },
          "2026-08-28": {
            "menuId": "m-friday",
            "itemIds": [
              "it-pizza",
              "it-pepperoni"
            ]
          }
        },
        "mealConfig": {
          "catererEmail": "food@aldershotkidsclub.co.uk",
          "catererEvery": "day",
          "catererAt": "08:00",
          "cutoffWhen": "prev",
          "cutoffTime": "16:00"
        }
      }
    ],
    "/api/library": {
      "settings": {
        "providerName": "Sunny Day Camps",
        "seasons": [
          {
            "id": "s-autumn-1",
            "name": "Autumn 1"
          },
          {
            "id": "s-oct-half",
            "name": "Oct Half Term"
          },
          {
            "id": "s-autumn-2",
            "name": "Autumn 2"
          },
          {
            "id": "s-christmas",
            "name": "Christmas Holidays"
          },
          {
            "id": "s-spring-1",
            "name": "Spring 1"
          },
          {
            "id": "s-feb-half",
            "name": "Feb Half Term"
          },
          {
            "id": "s-spring-2",
            "name": "Spring 2"
          },
          {
            "id": "s-easter",
            "name": "Easter Holidays"
          },
          {
            "id": "s-summer-1",
            "name": "Summer 1"
          },
          {
            "id": "s-may-half",
            "name": "May Half Term"
          },
          {
            "id": "s-summer-2",
            "name": "Summer 2"
          },
          {
            "id": "s-summer-hols",
            "name": "Summer Holidays"
          },
          {
            "id": "s-full-year",
            "name": "Full year"
          }
        ],
        "meals": {
          "ordering": true,
          "showAllergens": true,
          "menuShare": "booked",
          "cutoffWhen": "prev",
          "cutoffTime": "17:00",
          "changeApproval": "review",
          "allergenNote": "All meals are prepared in a kitchen that also handles nuts, gluten, eggs and dairy. Please tell us about any allergy before booking a meal."
        }
      },
      "childQuestions": [
        {
          "id": "q-dietary",
          "label": "Dietary requirements",
          "type": "text",
          "help": "Separate from allergies — vegetarian, halal, no pork.",
          "scope": "all",
          "replaces": "dietary"
        },
        {
          "id": "q-suncream",
          "label": "May we apply sun cream?",
          "type": "yesno",
          "scope": "all",
          "replaces": "suncreamConsent"
        },
        {
          "id": "q-firstaid",
          "label": "May we give first aid?",
          "type": "yesno",
          "scope": "all",
          "replaces": "firstAidConsent"
        }
      ]
    },
    "/api/meal-orders/report": {
      "rows": [
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-07",
          "child": "Oliver Bennett",
          "dish": "Roast chicken & roast potatoes",
          "price": 4.5
        },
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-07",
          "child": "Amelia Clarke",
          "dish": "Veggie pasta bake",
          "price": 4
        },
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-07",
          "child": "Charlie Evans",
          "dish": "Roast chicken & roast potatoes",
          "price": 4.5
        },
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-10",
          "child": "Oliver Bennett",
          "dish": "Roast chicken & roast potatoes",
          "price": 4.5
        },
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-10",
          "child": "Amelia Clarke",
          "dish": "Veggie pasta bake",
          "price": 4
        },
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-10",
          "child": "Harry Watson",
          "dish": "Roast chicken & roast potatoes",
          "price": 4.5
        },
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-10",
          "child": "Isla Morgan",
          "dish": "Veggie pasta bake",
          "price": 4
        },
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-10",
          "child": "Jack Thompson",
          "dish": "Roast chicken & roast potatoes",
          "price": 4.5
        },
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-12",
          "child": "Oliver Bennett",
          "dish": "Fish fingers & chips",
          "price": 4.5
        },
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-12",
          "child": "Sophie Turner",
          "dish": "Veggie pasta bake",
          "price": 4
        },
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-12",
          "child": "Harry Watson",
          "dish": "Fish fingers & chips",
          "price": 4.5
        },
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-12",
          "child": "Grace Hughes",
          "dish": "Veggie pasta bake",
          "price": 4
        },
        {
          "listingId": "L2",
          "listingName": "Summer Football Academy — Woking",
          "date": "2026-08-03",
          "child": "George Patel",
          "dish": "Ham sandwich, fruit & crisps",
          "price": 3.5
        },
        {
          "listingId": "L2",
          "listingName": "Summer Football Academy — Woking",
          "date": "2026-08-03",
          "child": "Freya Robinson",
          "dish": "Cheese sandwich, fruit & crisps",
          "price": 3.5
        },
        {
          "listingId": "L2",
          "listingName": "Summer Football Academy — Woking",
          "date": "2026-08-03",
          "child": "Leo Walsh",
          "dish": "Hummus & veg wrap",
          "price": 3.75
        },
        {
          "listingId": "L2",
          "listingName": "Summer Football Academy — Woking",
          "date": "2026-08-05",
          "child": "George Patel",
          "dish": "Ham sandwich, fruit & crisps",
          "price": 3.5
        },
        {
          "listingId": "L2",
          "listingName": "Summer Football Academy — Woking",
          "date": "2026-08-05",
          "child": "Mia Foster",
          "dish": "Cheese sandwich, fruit & crisps",
          "price": 3.5
        },
        {
          "listingId": "L3",
          "listingName": "Gymnastics Holiday Club — Godalming",
          "date": "2026-08-11",
          "child": "Noah Khan",
          "dish": "Chicken curry & rice",
          "price": 4.75
        },
        {
          "listingId": "L3",
          "listingName": "Gymnastics Holiday Club — Godalming",
          "date": "2026-08-11",
          "child": "Ella Wright",
          "dish": "Veg curry & rice",
          "price": 4.25
        },
        {
          "listingId": "L3",
          "listingName": "Gymnastics Holiday Club — Godalming",
          "date": "2026-08-11",
          "child": "Archie Reid",
          "dish": "Jacket potato & beans",
          "price": 3.8
        },
        {
          "listingId": "L3",
          "listingName": "Gymnastics Holiday Club — Godalming",
          "date": "2026-08-13",
          "child": "Noah Khan",
          "dish": "Chicken curry & rice",
          "price": 4.75
        },
        {
          "listingId": "L3",
          "listingName": "Gymnastics Holiday Club — Godalming",
          "date": "2026-08-13",
          "child": "Ella Wright",
          "dish": "Jacket potato & beans",
          "price": 3.8
        }
      ],
      "missing": [
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-10",
          "child": "Freya Robinson"
        },
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-10",
          "child": "Leo Walsh"
        },
        {
          "listingId": "L1",
          "listingName": "Summer Multi-Sports Camp — Guildford",
          "date": "2026-08-12",
          "child": "Ella Wright"
        },
        {
          "listingId": "L2",
          "listingName": "Summer Football Academy — Woking",
          "date": "2026-08-03",
          "child": "Sophie Turner"
        },
        {
          "listingId": "L3",
          "listingName": "Gymnastics Holiday Club — Godalming",
          "date": "2026-08-11",
          "child": "Grace Hughes"
        }
      ]
    },
    "/api/meal-orders": [
      {
        "id": "mo-1",
        "childName": "George Patel",
        "date": "2026-08-12",
        "listingId": "L2",
        "items": [
          {
            "name": "Ham sandwich, fruit & crisps"
          }
        ],
        "changeRequest": {
          "name": "Hummus & veg wrap"
        }
      },
      {
        "id": "mo-2",
        "childName": "Isla Morgan",
        "date": "2026-08-12",
        "listingId": "L1",
        "items": [
          {
            "name": "Veggie pasta bake"
          }
        ],
        "cancelRequest": {
          "at": "2026-08-11T09:15:00Z"
        }
      },
      {
        "id": "mo-3",
        "childName": "Noah Khan",
        "date": "2026-08-13",
        "listingId": "L3",
        "items": [
          {
            "name": "Chicken curry & rice"
          }
        ],
        "changeRequest": {
          "name": "Veg curry & rice"
        }
      }
    ]
  },
  "calendar": {
    "/api/library": null,
    "/api/listings": [
      {
        "id": "lst-multisports",
        "title": "Multi-Sports Holiday Camp",
        "venue": {
          "name": "Oakwood Leisure Centre"
        },
        "blocks": [
          {
            "open": true,
            "capacity": 40,
            "dayCounts": {
              "2026-08-03": 34,
              "2026-08-04": 29,
              "2026-08-05": 37,
              "2026-08-06": 31,
              "2026-08-07": 38,
              "2026-08-10": 26,
              "2026-08-11": 33,
              "2026-08-12": 35,
              "2026-08-13": 28,
              "2026-08-14": 40,
              "2026-08-17": 22,
              "2026-08-18": 30,
              "2026-08-19": 36,
              "2026-08-20": 27,
              "2026-08-21": 39,
              "2026-08-24": 24,
              "2026-08-25": 31,
              "2026-08-26": 34,
              "2026-08-27": 29,
              "2026-08-28": 37
            },
            "sessions": [
              {
                "date": "2026-08-03",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-04",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-05",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-06",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-07",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-10",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-11",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-12",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-13",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-14",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-17",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-18",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-19",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-20",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-21",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-24",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-25",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-26",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-27",
                "start": "09:00",
                "end": "15:30"
              },
              {
                "date": "2026-08-28",
                "start": "09:00",
                "end": "15:30"
              }
            ]
          }
        ]
      },
      {
        "id": "lst-football",
        "title": "Football Academy",
        "venue": {
          "name": "Riverside Playing Fields"
        },
        "blocks": [
          {
            "open": true,
            "capacity": 30,
            "dayCounts": {
              "2026-08-03": 18,
              "2026-08-05": 22,
              "2026-08-07": 27,
              "2026-08-10": 15,
              "2026-08-12": 24,
              "2026-08-14": 29,
              "2026-08-17": 19,
              "2026-08-19": 26,
              "2026-08-21": 30,
              "2026-08-24": 17,
              "2026-08-26": 23,
              "2026-08-28": 28
            },
            "sessions": [
              {
                "date": "2026-08-03",
                "start": "10:00",
                "end": "12:00"
              },
              {
                "date": "2026-08-05",
                "start": "10:00",
                "end": "12:00"
              },
              {
                "date": "2026-08-07",
                "start": "10:00",
                "end": "12:00"
              },
              {
                "date": "2026-08-10",
                "start": "10:00",
                "end": "12:00"
              },
              {
                "date": "2026-08-12",
                "start": "10:00",
                "end": "12:00"
              },
              {
                "date": "2026-08-14",
                "start": "10:00",
                "end": "12:00"
              },
              {
                "date": "2026-08-17",
                "start": "10:00",
                "end": "12:00"
              },
              {
                "date": "2026-08-19",
                "start": "10:00",
                "end": "12:00"
              },
              {
                "date": "2026-08-21",
                "start": "10:00",
                "end": "12:00"
              },
              {
                "date": "2026-08-24",
                "start": "10:00",
                "end": "12:00"
              },
              {
                "date": "2026-08-26",
                "start": "10:00",
                "end": "12:00"
              },
              {
                "date": "2026-08-28",
                "start": "10:00",
                "end": "12:00"
              }
            ]
          }
        ]
      },
      {
        "id": "lst-gymnastics",
        "title": "Gymnastics Club",
        "venue": {
          "name": "Highfield Sports Hall"
        },
        "blocks": [
          {
            "open": true,
            "capacity": 24,
            "bookedCount": 20,
            "sessions": [
              {
                "date": "2026-08-04",
                "start": "13:00",
                "end": "15:00"
              },
              {
                "date": "2026-08-06",
                "start": "13:00",
                "end": "15:00"
              },
              {
                "date": "2026-08-11",
                "start": "13:00",
                "end": "15:00"
              },
              {
                "date": "2026-08-13",
                "start": "13:00",
                "end": "15:00"
              },
              {
                "date": "2026-08-18",
                "start": "13:00",
                "end": "15:00"
              },
              {
                "date": "2026-08-20",
                "start": "13:00",
                "end": "15:00"
              },
              {
                "date": "2026-08-25",
                "start": "13:00",
                "end": "15:00"
              },
              {
                "date": "2026-08-27",
                "start": "13:00",
                "end": "15:00"
              }
            ]
          }
        ]
      },
      {
        "id": "lst-forest",
        "title": "Forest School Adventures",
        "venue": {
          "name": "Bluebell Woods"
        },
        "blocks": [
          {
            "open": false,
            "capacity": 20,
            "dayCounts": {
              "2026-08-03": 12,
              "2026-08-05": 16,
              "2026-08-10": 9,
              "2026-08-12": 14,
              "2026-08-17": 11,
              "2026-08-19": 18,
              "2026-08-24": 8,
              "2026-08-26": 20
            },
            "sessions": [
              {
                "date": "2026-08-03",
                "start": "09:30",
                "end": "14:00"
              },
              {
                "date": "2026-08-05",
                "start": "09:30",
                "end": "14:00"
              },
              {
                "date": "2026-08-10",
                "start": "09:30",
                "end": "14:00"
              },
              {
                "date": "2026-08-12",
                "start": "09:30",
                "end": "14:00"
              },
              {
                "date": "2026-08-17",
                "start": "09:30",
                "end": "14:00"
              },
              {
                "date": "2026-08-19",
                "start": "09:30",
                "end": "14:00"
              },
              {
                "date": "2026-08-24",
                "start": "09:30",
                "end": "14:00"
              },
              {
                "date": "2026-08-26",
                "start": "09:30",
                "end": "14:00"
              }
            ]
          }
        ]
      },
      {
        "id": "lst-artcraft",
        "title": "Holiday Art & Craft Camp",
        "venue": {
          "name": "St Mary's Community Hall"
        },
        "blocks": [
          {
            "open": true,
            "capacity": 25,
            "dayCounts": {
              "2026-08-04": 19,
              "2026-08-06": 22,
              "2026-08-11": 17,
              "2026-08-13": 24,
              "2026-08-18": 15,
              "2026-08-20": 25,
              "2026-08-25": 20,
              "2026-08-27": 23
            },
            "sessions": [
              {
                "date": "2026-08-04",
                "start": "09:00",
                "end": "12:30"
              },
              {
                "date": "2026-08-06",
                "start": "09:00",
                "end": "12:30"
              },
              {
                "date": "2026-08-11",
                "start": "09:00",
                "end": "12:30"
              },
              {
                "date": "2026-08-13",
                "start": "09:00",
                "end": "12:30"
              },
              {
                "date": "2026-08-18",
                "start": "09:00",
                "end": "12:30"
              },
              {
                "date": "2026-08-20",
                "start": "09:00",
                "end": "12:30"
              },
              {
                "date": "2026-08-25",
                "start": "09:00",
                "end": "12:30"
              },
              {
                "date": "2026-08-27",
                "start": "09:00",
                "end": "12:30"
              }
            ]
          }
        ]
      },
      {
        "id": "lst-swim",
        "title": "Swim School",
        "venue": {
          "name": "Parkside Pool"
        },
        "blocks": [
          {
            "open": true,
            "capacity": 16,
            "dayCounts": {
              "2026-08-10": 14,
              "2026-08-11": 16,
              "2026-08-12": 12,
              "2026-08-13": 15,
              "2026-08-14": 16,
              "2026-08-17": 11,
              "2026-08-18": 13,
              "2026-08-19": 16,
              "2026-08-20": 14,
              "2026-08-21": 15
            },
            "sessions": [
              {
                "date": "2026-08-10",
                "start": "08:30",
                "end": "10:00"
              },
              {
                "date": "2026-08-11",
                "start": "08:30",
                "end": "10:00"
              },
              {
                "date": "2026-08-12",
                "start": "08:30",
                "end": "10:00"
              },
              {
                "date": "2026-08-13",
                "start": "08:30",
                "end": "10:00"
              },
              {
                "date": "2026-08-14",
                "start": "08:30",
                "end": "10:00"
              },
              {
                "date": "2026-08-17",
                "start": "08:30",
                "end": "10:00"
              },
              {
                "date": "2026-08-18",
                "start": "08:30",
                "end": "10:00"
              },
              {
                "date": "2026-08-19",
                "start": "08:30",
                "end": "10:00"
              },
              {
                "date": "2026-08-20",
                "start": "08:30",
                "end": "10:00"
              },
              {
                "date": "2026-08-21",
                "start": "08:30",
                "end": "10:00"
              }
            ]
          }
        ]
      },
      {
        "id": "lst-dancedrama",
        "title": "Dance & Drama Workshop",
        "venue": {
          "name": "The Old Church Studio"
        },
        "blocks": [
          {
            "open": true,
            "capacity": 28,
            "dayCounts": {
              "2026-08-07": 20,
              "2026-08-10": 24,
              "2026-08-14": 26,
              "2026-08-17": 22,
              "2026-08-21": 28,
              "2026-08-24": 18,
              "2026-08-28": 25
            },
            "sessions": [
              {
                "date": "2026-08-07",
                "start": "13:30",
                "end": "16:00"
              },
              {
                "date": "2026-08-10",
                "start": "13:30",
                "end": "16:00"
              },
              {
                "date": "2026-08-14",
                "start": "13:30",
                "end": "16:00"
              },
              {
                "date": "2026-08-17",
                "start": "13:30",
                "end": "16:00"
              },
              {
                "date": "2026-08-21",
                "start": "13:30",
                "end": "16:00"
              },
              {
                "date": "2026-08-24",
                "start": "13:30",
                "end": "16:00"
              },
              {
                "date": "2026-08-28",
                "start": "13:30",
                "end": "16:00"
              }
            ]
          }
        ]
      },
      {
        "id": "lst-science",
        "title": "Science Explorers",
        "venue": {
          "name": "Meadowbrook Primary"
        },
        "blocks": [
          {
            "open": true,
            "capacity": 30,
            "dayCounts": {
              "2026-07-29": 16,
              "2026-07-30": 19,
              "2026-07-31": 22,
              "2026-08-05": 25,
              "2026-08-12": 28,
              "2026-08-19": 30,
              "2026-08-26": 27,
              "2026-09-02": 14,
              "2026-09-03": 18
            },
            "sessions": [
              {
                "date": "2026-07-29",
                "start": "10:00",
                "end": "13:00"
              },
              {
                "date": "2026-07-30",
                "start": "10:00",
                "end": "13:00"
              },
              {
                "date": "2026-07-31",
                "start": "10:00",
                "end": "13:00"
              },
              {
                "date": "2026-08-05",
                "start": "10:00",
                "end": "13:00"
              },
              {
                "date": "2026-08-12",
                "start": "10:00",
                "end": "13:00"
              },
              {
                "date": "2026-08-19",
                "start": "10:00",
                "end": "13:00"
              },
              {
                "date": "2026-08-26",
                "start": "10:00",
                "end": "13:00"
              },
              {
                "date": "2026-09-02",
                "start": "10:00",
                "end": "13:00"
              },
              {
                "date": "2026-09-03",
                "start": "10:00",
                "end": "13:00"
              }
            ]
          }
        ]
      }
    ],
    "/api/calendar-events": [
      {
        "id": "ev-brief-0811",
        "title": "Morning staff briefing",
        "date": "2026-08-11",
        "start": "08:15",
        "end": "08:45",
        "allDay": false,
        "category": "meeting",
        "color": "#2AACE2",
        "notes": "Week 2 run-through, ratios and pick-ups",
        "remindMode": "on",
        "remindMinutes": 15
      },
      {
        "id": "ev-stocktake-0807",
        "title": "Kit & equipment stock-take",
        "date": "2026-08-07",
        "start": "15:45",
        "end": "16:30",
        "allDay": false,
        "category": "general",
        "color": "#7A5AF8",
        "notes": "Count footballs, bibs and craft supplies before week 2",
        "remindMode": "default"
      },
      {
        "id": "ev-firstaid-0814",
        "title": "Paediatric First Aid (INSET)",
        "date": "2026-08-14",
        "start": "16:00",
        "end": "18:00",
        "allDay": false,
        "category": "training",
        "color": "#0f9d58",
        "notes": "Refresher for all coaches — certificates renewed",
        "remindMode": "on",
        "remindMinutes": 60
      },
      {
        "id": "ev-parents-0819",
        "title": "Parents feedback evening",
        "date": "2026-08-19",
        "start": "17:30",
        "end": "19:30",
        "allDay": false,
        "category": "general",
        "color": "#7A5AF8",
        "notes": "Show-and-tell, photos from Moments, sign-ups for autumn",
        "remindMode": "default"
      },
      {
        "id": "ev-openday-0822",
        "title": "Summer Open Day",
        "date": "2026-08-22",
        "allDay": true,
        "category": "openday",
        "color": "#f0b100",
        "notes": "Site tours 10am–2pm, taster sessions on the field",
        "remindMode": "default"
      },
      {
        "id": "ev-cpd-week",
        "title": "Staff CPD training week",
        "date": "2026-08-24",
        "endDate": "2026-08-26",
        "allDay": true,
        "category": "training",
        "color": "#0f9d58",
        "notes": "Safeguarding, behaviour and SEND workshops",
        "remindMode": "off"
      },
      {
        "id": "ev-bankhol-0831",
        "title": "August Bank Holiday — closed",
        "date": "2026-08-31",
        "allDay": true,
        "category": "closure",
        "color": "#e07a5f",
        "notes": "No camps running",
        "remindMode": "off"
      }
    ]
  },
  "timetable": {},
  "email": {
    "/api/emails/mailbox": {
      "configured": true,
      "address": "bright-sparks@in.activityos.uk",
      "received": 128,
      "lastAt": "2026-08-11T08:42:00Z",
      "pendingVerification": null
    },
    "/api/emails/sender": {
      "fromName": "Bright Sparks Activity Camps",
      "fromAddress": "hello@brightsparkscamps.co.uk",
      "replyTo": "hello@brightsparkscamps.co.uk"
    },
    "/api/emails/recipients": {
      "count": 42,
      "families": [
        {
          "email": "sarah.thompson@gmail.com",
          "name": "Sarah Thompson"
        },
        {
          "email": "j.patel@outlook.com",
          "name": "James Patel"
        },
        {
          "email": "emmawilson88@icloud.com",
          "name": "Emma Wilson"
        },
        {
          "email": "tomharris.mk@gmail.com",
          "name": "Tom Harris"
        },
        {
          "email": "priya.shah@gmail.com",
          "name": "Priya Shah"
        },
        {
          "email": "chloe.baker@gmail.com",
          "name": "Chloe Baker"
        },
        {
          "email": "daniel.evans@hotmail.co.uk",
          "name": "Daniel Evans"
        },
        {
          "email": "aisha.khan@gmail.com",
          "name": "Aisha Khan"
        },
        {
          "email": "rebecca.turner@outlook.com",
          "name": "Rebecca Turner"
        },
        {
          "email": "m.obrien@gmail.com",
          "name": "Michael O'Brien"
        },
        {
          "email": "hannah.lewis@icloud.com",
          "name": "Hannah Lewis"
        },
        {
          "email": "gary.wright@gmail.com",
          "name": "Gary Wright"
        }
      ]
    },
    "/api/bookings": [
      {
        "id": "bk-1001",
        "email": "sarah.thompson@gmail.com",
        "booker": "Sarah Thompson",
        "name": "Olivia Thompson",
        "child": "Olivia Thompson",
        "age": 8,
        "listingId": "l-msc",
        "listing": "Summer Multi-Sports Camp",
        "title": "Summer Multi-Sports Camp",
        "listingTitle": "Summer Multi-Sports Camp",
        "locationName": "Oakwood Primary School",
        "date": "2026-08-11",
        "dates": "11–15 Aug 2026",
        "createdAt": "2026-07-30T14:12:00Z",
        "method": "Card"
      },
      {
        "id": "bk-1002",
        "email": "j.patel@outlook.com",
        "booker": "James Patel",
        "name": "Arjun Patel",
        "child": "Arjun Patel",
        "age": 7,
        "listingId": "l-fa",
        "listing": "Football Academy",
        "title": "Football Academy",
        "listingTitle": "Football Academy",
        "locationName": "Aylesbury Leisure Centre",
        "date": "2026-08-04",
        "dates": "4–8 Aug 2026",
        "createdAt": "2026-07-18T09:05:00Z",
        "method": "Tax-Free Childcare"
      },
      {
        "id": "bk-1003",
        "email": "j.patel@outlook.com",
        "booker": "James Patel",
        "name": "Rohan Patel",
        "child": "Rohan Patel",
        "age": 9,
        "listingId": "l-fa",
        "listing": "Football Academy",
        "title": "Football Academy",
        "listingTitle": "Football Academy",
        "locationName": "Aylesbury Leisure Centre",
        "date": "2026-08-04",
        "dates": "4–8 Aug 2026",
        "createdAt": "2026-07-18T09:05:00Z",
        "method": "Tax-Free Childcare"
      },
      {
        "id": "bk-1004",
        "email": "emmawilson88@icloud.com",
        "booker": "Emma Wilson",
        "name": "Freddie Wilson",
        "child": "Freddie Wilson",
        "age": 6,
        "listingId": "l-gym",
        "listing": "Gymnastics Holiday Club",
        "title": "Gymnastics Holiday Club",
        "listingTitle": "Gymnastics Holiday Club",
        "locationName": "Bletchley Community Hall",
        "date": "2026-08-05",
        "dates": "5–7 Aug 2026",
        "createdAt": "2026-07-25T16:40:00Z",
        "method": "Card"
      },
      {
        "id": "bk-1005",
        "email": "tomharris.mk@gmail.com",
        "booker": "Tom Harris",
        "name": "Lily Harris",
        "child": "Lily Harris",
        "age": 6,
        "listingId": "l-hc",
        "listing": "August Holiday Camp",
        "title": "August Holiday Camp",
        "listingTitle": "August Holiday Camp",
        "locationName": "Oakwood Primary School",
        "date": "2026-08-06",
        "dates": "3–7 Aug 2026",
        "createdAt": "2026-07-22T11:30:00Z",
        "method": "Childcare vouchers"
      },
      {
        "id": "bk-1006",
        "email": "tomharris.mk@gmail.com",
        "booker": "Tom Harris",
        "name": "Noah Harris",
        "child": "Noah Harris",
        "age": 9,
        "listingId": "l-hc",
        "listing": "August Holiday Camp",
        "title": "August Holiday Camp",
        "listingTitle": "August Holiday Camp",
        "locationName": "Oakwood Primary School",
        "date": "2026-08-06",
        "dates": "3–7 Aug 2026",
        "createdAt": "2026-07-22T11:30:00Z",
        "method": "Childcare vouchers"
      },
      {
        "id": "bk-1007",
        "email": "priya.shah@gmail.com",
        "booker": "Priya Shah",
        "name": "Dev Shah",
        "child": "Dev Shah",
        "age": 10,
        "listingId": "l-fs",
        "listing": "Forest School Adventure",
        "title": "Forest School Adventure",
        "listingTitle": "Forest School Adventure",
        "locationName": "Newport Pagnell Sports Ground",
        "date": "2026-07-28",
        "dates": "28 Jul–1 Aug 2026",
        "createdAt": "2026-07-10T19:22:00Z",
        "method": "Card"
      },
      {
        "id": "bk-1008",
        "email": "chloe.baker@gmail.com",
        "booker": "Chloe Baker",
        "name": "Isla Baker",
        "child": "Isla Baker",
        "age": 5,
        "listingId": "l-msc",
        "listing": "Summer Multi-Sports Camp",
        "title": "Summer Multi-Sports Camp",
        "listingTitle": "Summer Multi-Sports Camp",
        "locationName": "Oakwood Primary School",
        "date": "2026-07-22",
        "dates": "21–25 Jul 2026",
        "createdAt": "2026-07-05T08:15:00Z",
        "method": "HAF (funded £0)"
      },
      {
        "id": "bk-1009",
        "email": "daniel.evans@hotmail.co.uk",
        "booker": "Daniel Evans",
        "name": "Jack Evans",
        "child": "Jack Evans",
        "age": 11,
        "listingId": "l-fa",
        "listing": "Football Academy",
        "title": "Football Academy",
        "listingTitle": "Football Academy",
        "locationName": "Aylesbury Leisure Centre",
        "date": "2026-08-12",
        "dates": "11–15 Aug 2026",
        "createdAt": "2026-07-28T13:50:00Z",
        "method": "Bank transfer"
      },
      {
        "id": "bk-1010",
        "email": "aisha.khan@gmail.com",
        "booker": "Aisha Khan",
        "name": "Zara Khan",
        "child": "Zara Khan",
        "age": 7,
        "listingId": "l-gym",
        "listing": "Gymnastics Holiday Club",
        "title": "Gymnastics Holiday Club",
        "listingTitle": "Gymnastics Holiday Club",
        "locationName": "Bletchley Community Hall",
        "date": "2026-08-18",
        "dates": "18–20 Aug 2026",
        "createdAt": "2026-08-01T10:05:00Z",
        "method": "Card"
      },
      {
        "id": "bk-1011",
        "email": "rebecca.turner@outlook.com",
        "booker": "Rebecca Turner",
        "name": "Ethan Turner",
        "child": "Ethan Turner",
        "age": 8,
        "listingId": "l-msc",
        "listing": "Summer Multi-Sports Camp",
        "title": "Summer Multi-Sports Camp",
        "listingTitle": "Summer Multi-Sports Camp",
        "locationName": "Oakwood Primary School",
        "date": "2026-08-25",
        "dates": "25–29 Aug 2026",
        "createdAt": "2026-08-08T15:18:00Z",
        "method": "Card"
      },
      {
        "id": "bk-1012",
        "email": "m.obrien@gmail.com",
        "booker": "Michael O'Brien",
        "name": "Sophie O'Brien",
        "child": "Sophie O'Brien",
        "age": 12,
        "listingId": "l-fs",
        "listing": "Forest School Adventure",
        "title": "Forest School Adventure",
        "listingTitle": "Forest School Adventure",
        "locationName": "Newport Pagnell Sports Ground",
        "date": "2026-08-14",
        "dates": "11–15 Aug 2026",
        "createdAt": "2026-08-02T20:44:00Z",
        "method": "Card"
      },
      {
        "id": "bk-1013",
        "email": "hannah.lewis@icloud.com",
        "booker": "Hannah Lewis",
        "name": "Grace Lewis",
        "child": "Grace Lewis",
        "age": 6,
        "listingId": "l-hc",
        "listing": "August Holiday Camp",
        "title": "August Holiday Camp",
        "listingTitle": "August Holiday Camp",
        "locationName": "Oakwood Primary School",
        "date": "2026-08-19",
        "dates": "17–21 Aug 2026",
        "createdAt": "2026-08-06T12:00:00Z",
        "method": "Card"
      },
      {
        "id": "bk-1014",
        "email": "gary.wright@gmail.com",
        "booker": "Gary Wright",
        "name": "Alfie Wright",
        "child": "Alfie Wright",
        "age": 10,
        "listingId": "l-fa",
        "listing": "Football Academy",
        "title": "Football Academy",
        "listingTitle": "Football Academy",
        "locationName": "Aylesbury Leisure Centre",
        "date": "2026-08-19",
        "dates": "18–22 Aug 2026",
        "createdAt": "2026-08-07T09:33:00Z",
        "method": "Card"
      }
    ],
    "/api/listings": [
      {
        "id": "l-msc",
        "title": "Summer Multi-Sports Camp",
        "name": "Summer Multi-Sports Camp",
        "venueId": "v-oak",
        "runFrom": "2026-07-21",
        "runTo": "2026-08-29",
        "seasonId": "summer-2026"
      },
      {
        "id": "l-fa",
        "title": "Football Academy",
        "name": "Football Academy",
        "venueId": "v-ayl",
        "runFrom": "2026-07-28",
        "runTo": "2026-08-22",
        "seasonId": "summer-2026"
      },
      {
        "id": "l-gym",
        "title": "Gymnastics Holiday Club",
        "name": "Gymnastics Holiday Club",
        "venueId": "v-blet",
        "runFrom": "2026-08-04",
        "runTo": "2026-08-28",
        "seasonId": "summer-2026"
      },
      {
        "id": "l-fs",
        "title": "Forest School Adventure",
        "name": "Forest School Adventure",
        "venueId": "v-newp",
        "runFrom": "2026-07-14",
        "runTo": "2026-08-15",
        "seasonId": "summer-2026"
      },
      {
        "id": "l-hc",
        "title": "August Holiday Camp",
        "name": "August Holiday Camp",
        "venueId": "v-oak",
        "runFrom": "2026-08-03",
        "runTo": "2026-08-29",
        "seasonId": "summer-2026"
      },
      {
        "id": "l-asf",
        "title": "After-School Football Club",
        "name": "After-School Football Club",
        "venueId": "v-ayl",
        "runFrom": "2026-09-08",
        "runTo": "2026-12-18",
        "seasonId": "autumn-2026"
      }
    ],
    "/api/library": {
      "venues": [
        {
          "id": "v-oak",
          "name": "Oakwood Primary School",
          "city": "Milton Keynes"
        },
        {
          "id": "v-ayl",
          "name": "Aylesbury Leisure Centre",
          "city": "Aylesbury"
        },
        {
          "id": "v-blet",
          "name": "Bletchley Community Hall",
          "city": "Bletchley"
        },
        {
          "id": "v-newp",
          "name": "Newport Pagnell Sports Ground",
          "city": "Newport Pagnell"
        }
      ],
      "settings": {
        "providerName": "Bright Sparks Activity Camps",
        "providerNameMode": "business",
        "billing": {
          "businessName": "Bright Sparks Activity Camps",
          "phone": "01908 555 214",
          "email": "hello@brightsparkscamps.co.uk",
          "address": "12 Silbury Boulevard, Milton Keynes, MK9 3HL"
        },
        "social": {
          "facebook": "https://facebook.com/brightsparkscamps",
          "instagram": "https://instagram.com/brightsparkscamps",
          "website": "https://brightsparkscamps.co.uk"
        },
        "defaultSignatureId": "sig-main",
        "emailSignatures": [
          {
            "id": "sig-main",
            "name": "Main signature",
            "html": "<p><strong>Bright Sparks Activity Camps</strong><br>01908 555 214 · hello@brightsparkscamps.co.uk<br><a href=\"https://brightsparkscamps.co.uk\">brightsparkscamps.co.uk</a></p>"
          },
          {
            "id": "sig-short",
            "name": "Short reply",
            "html": "<p>Thanks,<br>The Bright Sparks team</p>"
          }
        ],
        "emailPrefs": {
          "mailboxSetupDismissed": true,
          "undoSeconds": 5,
          "replySignatureId": "sig-short"
        }
      }
    },
    "/api/emails/audiences": [
      {
        "id": "aud-all",
        "name": "All families",
        "desc": "Everyone who has ever booked a session",
        "count": 42,
        "emails": [
          "sarah.thompson@gmail.com",
          "j.patel@outlook.com",
          "emmawilson88@icloud.com",
          "tomharris.mk@gmail.com",
          "priya.shah@gmail.com",
          "chloe.baker@gmail.com"
        ],
        "people": [
          {
            "email": "sarah.thompson@gmail.com",
            "name": "Sarah Thompson"
          },
          {
            "email": "j.patel@outlook.com",
            "name": "James Patel"
          },
          {
            "email": "emmawilson88@icloud.com",
            "name": "Emma Wilson"
          },
          {
            "email": "tomharris.mk@gmail.com",
            "name": "Tom Harris"
          }
        ]
      },
      {
        "id": "aud-summer",
        "name": "Summer 2026 campers",
        "desc": "Families booked onto any July–August 2026 session",
        "count": 28,
        "emails": [
          "sarah.thompson@gmail.com",
          "chloe.baker@gmail.com",
          "rebecca.turner@outlook.com",
          "hannah.lewis@icloud.com"
        ],
        "people": [
          {
            "email": "sarah.thompson@gmail.com",
            "name": "Sarah Thompson"
          },
          {
            "email": "chloe.baker@gmail.com",
            "name": "Chloe Baker"
          },
          {
            "email": "rebecca.turner@outlook.com",
            "name": "Rebecca Turner"
          }
        ]
      },
      {
        "id": "aud-football",
        "name": "Football Academy parents",
        "desc": "Booked onto the Football Academy at Aylesbury",
        "count": 12,
        "emails": [
          "j.patel@outlook.com",
          "daniel.evans@hotmail.co.uk",
          "gary.wright@gmail.com"
        ],
        "people": [
          {
            "email": "j.patel@outlook.com",
            "name": "James Patel"
          },
          {
            "email": "daniel.evans@hotmail.co.uk",
            "name": "Daniel Evans"
          },
          {
            "email": "gary.wright@gmail.com",
            "name": "Gary Wright"
          }
        ]
      },
      {
        "id": "aud-haf",
        "name": "HAF-funded families",
        "desc": "Families using Holiday Activities & Food funded places",
        "count": 9,
        "emails": [
          "chloe.baker@gmail.com",
          "priya.shah@gmail.com"
        ],
        "people": [
          {
            "email": "chloe.baker@gmail.com",
            "name": "Chloe Baker"
          },
          {
            "email": "priya.shah@gmail.com",
            "name": "Priya Shah"
          }
        ]
      },
      {
        "id": "aud-lapsed",
        "name": "Lapsed – booked last year only",
        "desc": "Booked in 2025 but nothing yet in 2026",
        "count": 15,
        "emails": [
          "oldparent1@gmail.com",
          "oldparent2@outlook.com"
        ],
        "people": [
          {
            "email": "oldparent1@gmail.com",
            "name": "Laura Mitchell"
          },
          {
            "email": "oldparent2@outlook.com",
            "name": "Steven Cook"
          }
        ]
      },
      {
        "id": "aud-enquiries",
        "name": "Open enquiries",
        "desc": "Sent an enquiry but haven't booked yet",
        "count": 7,
        "emails": [
          "newlead1@gmail.com",
          "newlead2@icloud.com"
        ],
        "people": [
          {
            "email": "newlead1@gmail.com",
            "name": "Katie Brooks"
          },
          {
            "email": "newlead2@icloud.com",
            "name": "Paul Adams"
          }
        ]
      }
    ],
    "/api/messages/templates": [
      {
        "id": "tpl-welcome",
        "name": "Booking confirmation",
        "subject": "You're booked in for {ListingName}! 🎉",
        "body": "Hi {ParentName},\n\nThank you for booking {ChildName} onto {ListingName} at {VenueName}. We can't wait to see them!\n\nYour dates: {SessionDate}\nDrop-off is from 8:45am and pick-up by 3:30pm.\n\nPlease reply to this email if you have any questions.\n\nThe Bright Sparks team"
      },
      {
        "id": "tpl-reminder",
        "name": "Week-before reminder",
        "subject": "See you next week at {VenueName}",
        "body": "Hi {ParentName},\n\nJust a reminder that {ChildName} is booked onto {ListingName} starting {SessionDate}.\n\nPlease send them with a water bottle, sun cream and a packed lunch (unless you've added our meal plan).\n\nSee you soon!"
      },
      {
        "id": "tpl-lastspaces",
        "name": "Last few spaces",
        "subject": "Only a few spaces left for August!",
        "body": "Hi {ParentName},\n\nOur August camps are filling up fast — there are just a handful of spaces left across our Milton Keynes and Aylesbury venues.\n\nBook now to avoid disappointment: https://brightsparkscamps.co.uk\n\nThe Bright Sparks team"
      },
      {
        "id": "tpl-thankyou",
        "name": "Thank you / feedback",
        "subject": "Thank you for a brilliant summer!",
        "body": "Hi {ParentName},\n\nThank you for choosing Bright Sparks this summer — we've loved having {ChildName} with us.\n\nWe'd really appreciate a quick review, it helps other families find us.\n\nWith thanks,\nThe Bright Sparks team"
      },
      {
        "id": "tpl-haf",
        "name": "HAF places available",
        "subject": "Free funded holiday places available",
        "body": "Hi {ParentName},\n\nWe still have funded HAF (Holiday Activities & Food) places available for eligible families. These include a hot lunch and a full day of activities at no cost.\n\nReply to this email and we'll help you check your eligibility."
      },
      {
        "id": "tpl-newsletter",
        "name": "Monthly newsletter",
        "subject": "What's on at Bright Sparks this month",
        "body": "Hi {ParentName},\n\nHere's everything coming up at Bright Sparks:\n\n• New After-School Football Club from September\n• October half-term camp dates released\n• Sibling discount now 15%\n\nRead more on our website."
      }
    ],
    "/api/emails": [
      {
        "id": "em-901",
        "subject": "Summer camp — last few spaces!",
        "audience": "aud-summer",
        "recipientCount": 42,
        "sentByName": "Bright Sparks",
        "createdAt": "2026-08-09T09:02:00Z",
        "status": "sent",
        "delivered": 41,
        "openedBy": [
          "sarah.thompson@gmail.com",
          "j.patel@outlook.com",
          "emmawilson88@icloud.com",
          "tomharris.mk@gmail.com",
          "priya.shah@gmail.com",
          "chloe.baker@gmail.com",
          "daniel.evans@hotmail.co.uk",
          "aisha.khan@gmail.com",
          "rebecca.turner@outlook.com",
          "m.obrien@gmail.com",
          "hannah.lewis@icloud.com",
          "gary.wright@gmail.com",
          "opener13@gmail.com",
          "opener14@gmail.com",
          "opener15@gmail.com",
          "opener16@gmail.com",
          "opener17@gmail.com",
          "opener18@gmail.com",
          "opener19@gmail.com",
          "opener20@gmail.com",
          "opener21@gmail.com",
          "opener22@gmail.com",
          "opener23@gmail.com",
          "opener24@gmail.com",
          "opener25@gmail.com",
          "opener26@gmail.com"
        ]
      },
      {
        "id": "em-902",
        "subject": "August Holiday Camp now open for booking",
        "audience": "aud-all",
        "recipientCount": 38,
        "sentByName": "Bright Sparks",
        "createdAt": "2026-08-04T08:30:00Z",
        "status": "sent",
        "delivered": 37,
        "openedBy": [
          "sarah.thompson@gmail.com",
          "tomharris.mk@gmail.com",
          "hannah.lewis@icloud.com",
          "rebecca.turner@outlook.com",
          "aisha.khan@gmail.com",
          "chloe.baker@gmail.com",
          "o7@gmail.com",
          "o8@gmail.com",
          "o9@gmail.com",
          "o10@gmail.com",
          "o11@gmail.com",
          "o12@gmail.com",
          "o13@gmail.com",
          "o14@gmail.com",
          "o15@gmail.com",
          "o16@gmail.com",
          "o17@gmail.com",
          "o18@gmail.com",
          "o19@gmail.com",
          "o20@gmail.com",
          "o21@gmail.com",
          "o22@gmail.com"
        ]
      },
      {
        "id": "em-903",
        "subject": "Football Academy — week 2 reminder",
        "audience": "aud-football",
        "recipientCount": 12,
        "sentByName": "Bright Sparks",
        "createdAt": "2026-08-07T17:15:00Z",
        "status": "sent",
        "delivered": 12,
        "openedBy": [
          "j.patel@outlook.com",
          "daniel.evans@hotmail.co.uk",
          "gary.wright@gmail.com",
          "f4@gmail.com",
          "f5@gmail.com",
          "f6@gmail.com",
          "f7@gmail.com",
          "f8@gmail.com",
          "f9@gmail.com"
        ]
      },
      {
        "id": "em-904",
        "subject": "Free funded HAF places available",
        "audience": "aud-haf",
        "recipientCount": 9,
        "sentByName": "Bright Sparks",
        "createdAt": "2026-07-29T10:00:00Z",
        "status": "sent",
        "delivered": 9,
        "openedBy": [
          "chloe.baker@gmail.com",
          "priya.shah@gmail.com",
          "h3@gmail.com",
          "h4@gmail.com",
          "h5@gmail.com",
          "h6@gmail.com",
          "h7@gmail.com"
        ]
      },
      {
        "id": "em-905",
        "subject": "Thank you for a great July! 🌟",
        "audience": "aud-all",
        "recipientCount": 40,
        "sentByName": "Bright Sparks",
        "createdAt": "2026-07-28T18:45:00Z",
        "status": "sent",
        "delivered": 39,
        "openedBy": [
          "sarah.thompson@gmail.com",
          "j.patel@outlook.com",
          "emmawilson88@icloud.com",
          "tomharris.mk@gmail.com",
          "priya.shah@gmail.com",
          "chloe.baker@gmail.com",
          "daniel.evans@hotmail.co.uk",
          "aisha.khan@gmail.com",
          "rebecca.turner@outlook.com",
          "m.obrien@gmail.com",
          "hannah.lewis@icloud.com",
          "gary.wright@gmail.com",
          "t13@gmail.com",
          "t14@gmail.com",
          "t15@gmail.com",
          "t16@gmail.com",
          "t17@gmail.com",
          "t18@gmail.com",
          "t19@gmail.com",
          "t20@gmail.com",
          "t21@gmail.com",
          "t22@gmail.com",
          "t23@gmail.com",
          "t24@gmail.com",
          "t25@gmail.com",
          "t26@gmail.com",
          "t27@gmail.com",
          "t28@gmail.com",
          "t29@gmail.com",
          "t30@gmail.com",
          "t31@gmail.com"
        ]
      },
      {
        "id": "em-906",
        "subject": "Gymnastics club — spaces this August",
        "audience": "aud-summer",
        "recipientCount": 18,
        "sentByName": "Bright Sparks",
        "createdAt": "2026-08-01T11:20:00Z",
        "status": "sent",
        "delivered": 18,
        "openedBy": [
          "emmawilson88@icloud.com",
          "aisha.khan@gmail.com",
          "g3@gmail.com",
          "g4@gmail.com",
          "g5@gmail.com",
          "g6@gmail.com",
          "g7@gmail.com",
          "g8@gmail.com"
        ]
      },
      {
        "id": "em-907",
        "subject": "Bank holiday timetable update",
        "audience": "aud-all",
        "recipientCount": 42,
        "sentByName": "Bright Sparks",
        "createdAt": "2026-08-11T07:55:00Z",
        "status": "sending",
        "delivered": 0,
        "openedBy": []
      },
      {
        "id": "em-908",
        "subject": "Re: SEN support question",
        "audience": "one",
        "recipientCount": 1,
        "sentByName": "Bright Sparks",
        "createdAt": "2026-07-30T09:10:00Z",
        "status": "sent",
        "delivered": 1,
        "openedBy": [
          "priya.shah@gmail.com"
        ]
      }
    ],
    "/api/emails/scheduled": [
      {
        "id": "sch-501",
        "subject": "September After-School Football — now booking",
        "body": "Our new After-School Football Club at Aylesbury starts on Monday 8 September. Book your child's place now.",
        "recipientCount": 44,
        "sendAt": "2026-08-20T09:00",
        "status": "scheduled",
        "emailId": null
      },
      {
        "id": "sch-502",
        "subject": "End of summer — thank you!",
        "body": "That's a wrap on summer 2026! Thank you to every family who joined us.",
        "recipientCount": 42,
        "sendAt": "2026-08-30T18:00",
        "status": "scheduled",
        "emailId": null
      },
      {
        "id": "sch-503",
        "subject": "October half-term early-bird discount",
        "body": "Book your October half-term camp before 30 September and save 15%.",
        "recipientCount": 40,
        "sendAt": "2026-09-15T10:00",
        "status": "scheduled",
        "emailId": null
      },
      {
        "id": "sch-504",
        "subject": "Duplicate August reminder",
        "body": "This scheduled send was cancelled.",
        "recipientCount": 38,
        "sendAt": "2026-08-05T09:00",
        "status": "cancelled",
        "emailId": null
      }
    ],
    "/api/emails/messages": [
      {
        "id": "msg-1",
        "from": "Sarah Thompson",
        "fromEmail": "sarah.thompson@gmail.com",
        "subject": "Summer camp availability?",
        "body": "Hi, do you have any spaces left on your summer multi-activity camp in August? My daughter Olivia is 8. Thanks, Sarah",
        "unread": true,
        "starred": false,
        "labels": [
          "enquiry"
        ],
        "folder": "inbox",
        "at": "2026-08-11T08:42:00Z"
      },
      {
        "id": "msg-2",
        "from": "James Patel",
        "fromEmail": "j.patel@outlook.com",
        "subject": "After-school football for two",
        "body": "Hello — I'm interested in the after-school football club in Aylesbury for my two boys. What days does it run and how much is it? Cheers, James",
        "unread": true,
        "starred": true,
        "labels": [
          "follow"
        ],
        "folder": "inbox",
        "at": "2026-08-11T07:15:00Z"
      },
      {
        "id": "msg-3",
        "from": "Priya Shah",
        "fromEmail": "priya.shah@gmail.com",
        "subject": "SEN support question",
        "body": "Hello, my son Dev has additional needs (ASD) — are your camps able to support him, and do you have 1:1 options? Thank you, Priya",
        "unread": true,
        "starred": false,
        "labels": [
          "urgent",
          "follow"
        ],
        "folder": "inbox",
        "at": "2026-08-10T18:47:00Z"
      },
      {
        "id": "msg-4",
        "from": "Milton Keynes Council HAF",
        "fromEmail": "haf@milton-keynes.gov.uk",
        "subject": "HAF August funding confirmation",
        "body": "Dear provider, please find attached confirmation of your August HAF funded places and the reporting spreadsheet. Kind regards, MK HAF Team",
        "unread": false,
        "starred": true,
        "labels": [
          "haf",
          "system"
        ],
        "attachments": [
          {
            "name": "HAF-August-2026.pdf",
            "size": "248 KB"
          },
          {
            "name": "HAF-register-template.xlsx",
            "size": "34 KB"
          }
        ],
        "folder": "inbox",
        "at": "2026-08-09T12:03:00Z"
      },
      {
        "id": "msg-5",
        "from": "Emma Wilson",
        "fromEmail": "emmawilson88@icloud.com",
        "subject": "Holiday club prices",
        "body": "Could you send me a price list for the October holiday club please? Do you offer sibling discounts? Emma",
        "unread": false,
        "starred": false,
        "labels": [
          "enquiry"
        ],
        "folder": "inbox",
        "at": "2026-08-08T16:20:00Z"
      },
      {
        "id": "msg-6",
        "from": "Tom Harris",
        "fromEmail": "tomharris.mk@gmail.com",
        "subject": "Two children — any spaces?",
        "body": "Hi there, we've just moved to Aylesbury and I'm looking for holiday cover for my 6 and 9 year old. Do you have space and what are your hours? Tom",
        "unread": false,
        "starred": false,
        "folder": "archive",
        "at": "2026-08-05T11:03:00Z"
      },
      {
        "id": "msg-7",
        "from": "Stripe",
        "fromEmail": "no-reply@stripe.com",
        "subject": "Your payout of £1,284.50 is on its way",
        "body": "A payout of £1,284.50 has been initiated to your bank account ending 4417 and should arrive within 2 business days.",
        "unread": false,
        "starred": false,
        "labels": [
          "system"
        ],
        "folder": "archive",
        "at": "2026-08-04T06:00:00Z"
      },
      {
        "id": "msg-8",
        "from": "Rebecca Turner",
        "fromEmail": "rebecca.turner@outlook.com",
        "subject": "Change of week request",
        "body": "Hi, is it possible to move Ethan's booking from the 25th to the week of the 18th? Let me know if there's space. Thanks, Rebecca",
        "unread": true,
        "starred": false,
        "labels": [
          "follow"
        ],
        "folder": "inbox",
        "at": "2026-08-10T14:28:00Z"
      }
    ],
    "/api/moments": [
      {
        "id": "mom-1",
        "caption": "Forest School den-building in the sunshine today! 🌲",
        "comments": [
          {
            "role": "parent",
            "byName": "Priya Shah",
            "text": "Dev came home buzzing about this!",
            "marketing": true
          },
          {
            "role": "operator",
            "byName": "Bright Sparks",
            "text": "So glad he enjoyed it! 😊"
          }
        ]
      },
      {
        "id": "mom-2",
        "caption": "Penalty shoot-out finals at Football Academy ⚽",
        "comments": [
          {
            "role": "parent",
            "byName": "James Patel",
            "text": "Arjun scored the winner!",
            "marketing": true
          }
        ]
      },
      {
        "id": "mom-3",
        "caption": "Gymnastics group nailed their cartwheels this morning",
        "comments": []
      },
      {
        "id": "mom-4",
        "caption": "Multi-Sports champions of the week 🏆",
        "comments": [
          {
            "role": "parent",
            "byName": "Sarah Thompson",
            "text": "Olivia loves it here, thank you!",
            "marketing": true
          },
          {
            "role": "parent",
            "byName": "Chloe Baker",
            "text": "Best camp in Milton Keynes."
          }
        ]
      },
      {
        "id": "mom-5",
        "caption": "Lunchtime picnic in the park ☀️",
        "comments": [
          {
            "role": "operator",
            "byName": "Bright Sparks",
            "text": "Perfect weather for it!"
          }
        ]
      }
    ]
  },
  "ratios": {
    "/api/ratios": {
      "sessions": [
        {
          "blockId": "blk-fb-w6",
          "date": "2026-08-11",
          "start": "09:00",
          "end": "17:00",
          "blockName": "Week 6 · 10–14 Aug",
          "listingName": "Football Academy",
          "totalChildren": 14,
          "sendCount": 2,
          "children": [
            {
              "ref": "bk-fb-001",
              "childId": "ch-001",
              "name": "Oliver Bennett",
              "age": 6,
              "send": false,
              "allergies": false,
              "start": "09:00",
              "end": "17:00"
            },
            {
              "ref": "bk-fb-002",
              "childId": "ch-002",
              "name": "Amelia Clarke",
              "age": 5,
              "send": false,
              "allergies": true,
              "start": "09:00",
              "end": "17:00"
            },
            {
              "ref": "bk-fb-003",
              "childId": "ch-003",
              "name": "Harry Watson",
              "age": 7,
              "send": false,
              "allergies": false,
              "start": "09:00",
              "end": "13:00"
            },
            {
              "ref": "bk-fb-004",
              "childId": "ch-004",
              "name": "Isla Morgan",
              "age": 6,
              "send": true,
              "allergies": false,
              "start": "09:00",
              "end": "17:00"
            },
            {
              "ref": "bk-fb-005",
              "childId": "ch-005",
              "name": "Jack Thompson",
              "age": 7,
              "send": false,
              "allergies": false,
              "start": "08:00",
              "end": "18:00"
            },
            {
              "ref": "bk-fb-006",
              "childId": "ch-006",
              "name": "Freya Hughes",
              "age": 5,
              "send": false,
              "allergies": false,
              "start": "09:00",
              "end": "17:00"
            },
            {
              "ref": "bk-fb-007",
              "childId": "ch-007",
              "name": "Charlie Evans",
              "age": 9,
              "send": false,
              "allergies": false,
              "start": "09:00",
              "end": "17:00"
            },
            {
              "ref": "bk-fb-008",
              "childId": "ch-008",
              "name": "Sophie Turner",
              "age": 10,
              "send": false,
              "allergies": true,
              "start": "09:00",
              "end": "13:00"
            },
            {
              "ref": "bk-fb-009",
              "childId": "ch-009",
              "name": "George Walker",
              "age": 8,
              "send": false,
              "allergies": false,
              "start": "09:00",
              "end": "17:00"
            },
            {
              "ref": "bk-fb-010",
              "childId": "ch-010",
              "name": "Mia Robinson",
              "age": 10,
              "send": true,
              "allergies": false,
              "start": "08:00",
              "end": "18:00"
            },
            {
              "ref": "bk-fb-011",
              "childId": "ch-011",
              "name": "Leo Wright",
              "age": 9,
              "send": false,
              "allergies": false,
              "start": "09:00",
              "end": "17:00"
            },
            {
              "ref": "bk-fb-012",
              "childId": "ch-012",
              "name": "Ella Cooper",
              "age": 11,
              "send": false,
              "allergies": false,
              "start": "09:00",
              "end": "17:00"
            },
            {
              "ref": "bk-fb-013",
              "childId": "ch-013",
              "name": "Noah Phillips",
              "age": 12,
              "send": false,
              "allergies": false,
              "start": "09:00",
              "end": "13:00"
            },
            {
              "ref": "bk-fb-014",
              "childId": "ch-014",
              "name": "Lily Parker",
              "age": 12,
              "send": false,
              "allergies": true,
              "start": "08:00",
              "end": "18:00"
            }
          ]
        },
        {
          "blockId": "blk-fs-w6",
          "date": "2026-08-11",
          "start": "09:00",
          "end": "15:30",
          "blockName": "Week 6 · 10–14 Aug",
          "listingName": "Forest School Adventure",
          "totalChildren": 5,
          "sendCount": 1,
          "children": [
            {
              "ref": "bk-fs-001",
              "childId": "ch-101",
              "name": "Rowan Fisher",
              "age": 4,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-fs-002",
              "childId": "ch-102",
              "name": "Poppy Grant",
              "age": 6,
              "send": false,
              "allergies": true
            },
            {
              "ref": "bk-fs-003",
              "childId": "ch-103",
              "name": "Alfie Reid",
              "age": 7,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-fs-004",
              "childId": "ch-104",
              "name": "Daisy Knight",
              "age": 8,
              "send": true,
              "allergies": false
            },
            {
              "ref": "bk-fs-005",
              "childId": "ch-105",
              "name": "Finn Barker",
              "age": 10,
              "send": false,
              "allergies": false
            }
          ]
        },
        {
          "blockId": "blk-gym-w6",
          "date": "2026-08-11",
          "start": "10:00",
          "end": "16:00",
          "blockName": "Week 6 · 10–14 Aug",
          "listingName": "Gymnastics Intensive",
          "totalChildren": 6,
          "sendCount": 1,
          "children": [
            {
              "ref": "bk-gym-001",
              "childId": "ch-201",
              "name": "Ruby Shaw",
              "age": 5,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-gym-002",
              "childId": "ch-202",
              "name": "Max Holt",
              "age": 6,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-gym-003",
              "childId": "ch-203",
              "name": "Grace Lloyd",
              "age": 7,
              "send": false,
              "allergies": true
            },
            {
              "ref": "bk-gym-004",
              "childId": "ch-204",
              "name": "Ethan Ward",
              "age": 8,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-gym-005",
              "childId": "ch-205",
              "name": "Lucy Chapman",
              "age": 9,
              "send": true,
              "allergies": false
            },
            {
              "ref": "bk-gym-006",
              "childId": "ch-206",
              "name": "Dylan Cole",
              "age": 9,
              "send": false,
              "allergies": false
            }
          ]
        },
        {
          "blockId": "blk-ms-w6",
          "date": "2026-08-11",
          "start": "09:00",
          "end": "17:00",
          "blockName": "Week 6 · 10–14 Aug",
          "listingName": "Multi-Sports Camp",
          "totalChildren": 9,
          "sendCount": 1,
          "children": [
            {
              "ref": "bk-ms-001",
              "childId": "ch-301",
              "name": "Archie Dean",
              "age": 5,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-ms-002",
              "childId": "ch-302",
              "name": "Evie Mason",
              "age": 6,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-ms-003",
              "childId": "ch-303",
              "name": "Theo Payne",
              "age": 7,
              "send": false,
              "allergies": true
            },
            {
              "ref": "bk-ms-004",
              "childId": "ch-304",
              "name": "Willow Booth",
              "age": 8,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-ms-005",
              "childId": "ch-305",
              "name": "Oscar Frost",
              "age": 9,
              "send": true,
              "allergies": false
            },
            {
              "ref": "bk-ms-006",
              "childId": "ch-306",
              "name": "Maya Sharma",
              "age": 10,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-ms-007",
              "childId": "ch-307",
              "name": "Reuben Cross",
              "age": 11,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-ms-008",
              "childId": "ch-308",
              "name": "Nula Doyle",
              "age": 11,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-ms-009",
              "childId": "ch-309",
              "name": "Sam Webb",
              "age": 12,
              "send": false,
              "allergies": false
            }
          ]
        },
        {
          "blockId": "blk-shc-w6",
          "date": "2026-08-11",
          "start": "08:30",
          "end": "17:30",
          "blockName": "Week 6 · 10–14 Aug",
          "listingName": "Summer Holiday Camp",
          "totalChildren": 8,
          "sendCount": 1,
          "children": [
            {
              "ref": "bk-shc-001",
              "childId": "ch-401",
              "name": "Hugo Barnes",
              "age": 5,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-shc-002",
              "childId": "ch-402",
              "name": "Elsie Ford",
              "age": 6,
              "send": false,
              "allergies": true
            },
            {
              "ref": "bk-shc-003",
              "childId": "ch-403",
              "name": "Toby Hale",
              "age": 7,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-shc-004",
              "childId": "ch-404",
              "name": "Ava Newton",
              "age": 8,
              "send": true,
              "allergies": false
            },
            {
              "ref": "bk-shc-005",
              "childId": "ch-405",
              "name": "Joel Rhodes",
              "age": 9,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-shc-006",
              "childId": "ch-406",
              "name": "Bella Quinn",
              "age": 10,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-shc-007",
              "childId": "ch-407",
              "name": "Kai Osei",
              "age": 11,
              "send": false,
              "allergies": false
            },
            {
              "ref": "bk-shc-008",
              "childId": "ch-408",
              "name": "Zara Malik",
              "age": 11,
              "send": false,
              "allergies": false
            }
          ]
        }
      ]
    },
    "/api/library": {
      "settings": {
        "providerName": "Bright Sparks Camps",
        "providerNameMode": "person"
      },
      "staff": [
        {
          "id": "account-holder",
          "first": "Sarah",
          "last": "Mitchell",
          "role": "Camp Director"
        },
        {
          "id": "s-coach-1",
          "first": "Jordan",
          "last": "Blake",
          "role": "Lead Coach"
        },
        {
          "id": "s-coach-2",
          "first": "Priya",
          "last": "Nair",
          "role": "Sports Coach"
        },
        {
          "id": "s-coach-3",
          "first": "Marcus",
          "last": "Reed",
          "role": "Activity Leader"
        },
        {
          "id": "s-coach-4",
          "first": "Chloe",
          "last": "Fenwick",
          "role": "Assistant"
        },
        {
          "id": "s-coach-5",
          "first": "Dev",
          "last": "Anand",
          "role": "First Aider"
        }
      ]
    },
    "/api/listings": [
      {
        "id": "lst-football",
        "name": "Football Academy",
        "status": "live",
        "archived": false,
        "visibility": "public",
        "seasonId": "s-summer-hols",
        "passes": [
          {
            "name": "Full day",
            "price": 38,
            "days": 1
          }
        ],
        "blocks": [
          {
            "id": "blk-fb-w6",
            "name": "Week 6 · 10–14 Aug",
            "startDate": "2026-08-10",
            "endDate": "2026-08-14",
            "capacity": 40,
            "spotsLeft": 12,
            "open": true
          }
        ]
      },
      {
        "id": "lst-forest",
        "name": "Forest School Adventure",
        "status": "live",
        "archived": false,
        "visibility": "public",
        "seasonId": "s-summer-hols",
        "passes": [
          {
            "name": "Full day",
            "price": 42,
            "days": 1
          }
        ],
        "blocks": [
          {
            "id": "blk-fs-w6",
            "name": "Week 6 · 10–14 Aug",
            "startDate": "2026-08-10",
            "endDate": "2026-08-14",
            "capacity": 24,
            "spotsLeft": 8,
            "open": true
          }
        ]
      },
      {
        "id": "lst-gymnastics",
        "name": "Gymnastics Intensive",
        "status": "live",
        "archived": false,
        "visibility": "public",
        "seasonId": "s-summer-hols",
        "passes": [
          {
            "name": "Full day",
            "price": 36,
            "days": 1
          }
        ],
        "blocks": [
          {
            "id": "blk-gym-w6",
            "name": "Week 6 · 10–14 Aug",
            "startDate": "2026-08-10",
            "endDate": "2026-08-14",
            "capacity": 20,
            "spotsLeft": 5,
            "open": true
          }
        ]
      },
      {
        "id": "lst-multisports",
        "name": "Multi-Sports Camp",
        "status": "live",
        "archived": false,
        "visibility": "public",
        "seasonId": "s-summer-hols",
        "passes": [
          {
            "name": "Full day",
            "price": 35,
            "days": 1
          }
        ],
        "blocks": [
          {
            "id": "blk-ms-w6",
            "name": "Week 6 · 10–14 Aug",
            "startDate": "2026-08-10",
            "endDate": "2026-08-14",
            "capacity": 60,
            "spotsLeft": 22,
            "open": true
          }
        ]
      },
      {
        "id": "lst-summercamp",
        "name": "Summer Holiday Camp",
        "status": "live",
        "archived": false,
        "visibility": "public",
        "seasonId": "s-summer-hols",
        "passes": [
          {
            "name": "Full day",
            "price": 40,
            "days": 1
          }
        ],
        "blocks": [
          {
            "id": "blk-shc-w6",
            "name": "Week 6 · 10–14 Aug",
            "startDate": "2026-08-10",
            "endDate": "2026-08-14",
            "capacity": 60,
            "spotsLeft": 30,
            "open": true
          }
        ]
      }
    ],
    "/api/ratios/board/2026-08-11": {
      "overrides": {},
      "groupStaff": {
        "cubs": [
          "s-coach-1"
        ],
        "explorers": [
          "s-coach-2"
        ],
        "adventurers": [
          "s-coach-3"
        ]
      }
    }
  },
  "registers": {
    "/api/me": {
      "role": "owner"
    },
    "/api/library": null,
    "/api/listings": [
      {
        "id": "lst-summer-camp",
        "seasonId": "s-summer-hols"
      },
      {
        "id": "lst-football",
        "seasonId": "s-autumn-1"
      },
      {
        "id": "lst-gymnastics",
        "seasonId": "s-autumn-1"
      },
      {
        "id": "lst-forest",
        "seasonId": "s-summer-hols"
      }
    ],
    "/api/registers": [
      {
        "blockId": "blk-multisports-am",
        "date": "2026-08-11",
        "start": "08:30",
        "end": "12:30",
        "blockName": "Multi-Sports (AM)",
        "listingId": "lst-summer-camp",
        "listingName": "Summer Holiday Camp",
        "counts": {
          "expected": 7,
          "present": 5,
          "notArrived": 1,
          "absent": 1,
          "collected": 1
        },
        "heads": [
          {
            "n": 5,
            "by": "Sarah Lloyd",
            "at": "2026-08-11T08:50:00"
          },
          {
            "n": 6,
            "by": "Sarah Lloyd",
            "at": "2026-08-11T10:20:00"
          }
        ],
        "takenBy": {
          "name": "Sarah Lloyd",
          "at": "2026-08-11T08:35:00"
        },
        "attendees": [
          {
            "ref": "BK-4821-1",
            "booker": "Sophie Bennett",
            "email": "sophie.bennett@gmail.com",
            "phone": "07700 900321",
            "note": "Oliver and Amelia are siblings — same pick-up.",
            "addons": [
              "Early drop-off (08:00)"
            ],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Oliver Bennett",
                "age": 7
              }
            ],
            "child": {
              "dob": "2018-11-03",
              "school": "St Mary's Primary",
              "sex": "Male",
              "allergies": "Peanuts — carries an EpiPen in his bag",
              "medical": "",
              "dietary": "",
              "send": "",
              "careNotes": "Loves football; can be shy for the first ten minutes.",
              "collectionPassword": "SUNFLOWER",
              "emergencyName": "Grandad Ray Bennett",
              "emergencyPhone": "07700 900654",
              "photoConsent": true,
              "likes": "Football, Lego",
              "dislikes": "Loud noises",
              "swimming": "Confident (25m+)",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": false,
              "answers": {}
            },
            "attendance": {
              "status": "in",
              "inAt": "2026-08-11T08:31:00",
              "collectedAt": null,
              "collectedBy": null
            }
          },
          {
            "ref": "BK-4821-2",
            "booker": "Sophie Bennett",
            "email": "sophie.bennett@gmail.com",
            "phone": "07700 900321",
            "addons": [],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Amelia Bennett",
                "age": 5
              }
            ],
            "child": {
              "dob": "2020-06-21",
              "school": "St Mary's Primary",
              "sex": "Female",
              "allergies": "",
              "medical": "",
              "dietary": "Vegetarian",
              "send": "",
              "careNotes": "",
              "collectionPassword": "SUNFLOWER",
              "emergencyName": "Grandad Ray Bennett",
              "emergencyPhone": "07700 900654",
              "photoConsent": true,
              "likes": "Arts & crafts",
              "dislikes": "",
              "swimming": "Beginner",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": false,
              "answers": {}
            },
            "attendance": {
              "status": "in",
              "inAt": "2026-08-11T08:32:00",
              "collectedAt": null,
              "collectedBy": null
            }
          },
          {
            "ref": "BK-4795",
            "booker": "Emma Thompson",
            "email": "emma.thompson@outlook.com",
            "phone": "07700 900112",
            "addons": [],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Jack Thompson",
                "age": 9
              }
            ],
            "child": {
              "dob": "2016-12-12",
              "school": "Oakfield Junior",
              "sex": "Male",
              "allergies": "",
              "medical": "Asthma — blue reliever inhaler in the front pocket of his bag",
              "dietary": "",
              "send": "",
              "careNotes": "Remind him to use his inhaler before running games.",
              "collectionPassword": "RED-KITE-9",
              "emergencyName": "David Thompson",
              "emergencyPhone": "07700 900998",
              "photoConsent": false,
              "likes": "Dodgeball",
              "dislikes": "Swimming",
              "swimming": "Reluctant",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": true,
              "answers": {}
            },
            "attendance": {
              "status": "in",
              "inAt": "2026-08-11T08:45:00",
              "collectedAt": null,
              "collectedBy": null
            }
          },
          {
            "ref": "BK-4810",
            "booker": "Claire Murray",
            "email": "claire.murray@gmail.com",
            "phone": "07700 900447",
            "note": "Called in — poorly tummy.",
            "addons": [],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Isla Murray",
                "age": 6
              }
            ],
            "child": {
              "dob": "2019-08-30",
              "school": "Greenbank Primary",
              "sex": "Female",
              "allergies": "",
              "medical": "",
              "dietary": "",
              "send": "",
              "careNotes": "",
              "collectionPassword": "1207",
              "emergencyName": "Paul Murray",
              "emergencyPhone": "07700 900771",
              "photoConsent": true,
              "likes": "Gymnastics",
              "dislikes": "",
              "swimming": "Confident (25m+)",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": false,
              "answers": {}
            },
            "attendance": {
              "status": "absent",
              "inAt": null,
              "collectedAt": null,
              "collectedBy": null
            }
          },
          {
            "ref": "BK-4833",
            "booker": "Priya Patel",
            "email": "priya.patel@gmail.com",
            "phone": "07700 900228",
            "note": "1:1 support arranged with Nadia.",
            "addons": [
              "Packed lunch"
            ],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Harry Patel",
                "age": 8
              }
            ],
            "child": {
              "dob": "2017-10-05",
              "school": "Meadowview Primary",
              "sex": "Male",
              "allergies": "",
              "medical": "",
              "dietary": "Halal",
              "send": "EHCP in place — 1:1 support for transitions and busy spaces",
              "sendPlanName": "SEND support plan",
              "careNotes": "Uses a visual timetable; give warnings before activity changes.",
              "collectionPassword": "OWL-33",
              "emergencyName": "Raj Patel",
              "emergencyPhone": "07700 900335",
              "photoConsent": true,
              "likes": "Trains, drawing",
              "dislikes": "Sudden changes",
              "swimming": "Beginner",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": false,
              "answers": {}
            },
            "attendance": null
          },
          {
            "ref": "BK-4788",
            "booker": "Hannah Walsh",
            "email": "hannah.walsh@hotmail.com",
            "phone": "07700 900556",
            "addons": [],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Freya Walsh",
                "age": 4
              }
            ],
            "child": {
              "dob": "2021-07-19",
              "school": "Little Acorns Nursery",
              "sex": "Female",
              "allergies": "Dairy — no milk, cheese or yoghurt",
              "medical": "",
              "dietary": "Dairy-free",
              "send": "",
              "careNotes": "Has a comforter (grey bunny) at rest time.",
              "collectionPassword": "BUTTERCUP",
              "emergencyName": "Linda Walsh (Grandma)",
              "emergencyPhone": "07700 900889",
              "photoConsent": true,
              "likes": "Painting, singing",
              "dislikes": "",
              "swimming": "Non-swimmer",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": false,
              "answers": {}
            },
            "attendance": {
              "status": "in",
              "inAt": "2026-08-11T08:29:00",
              "collectedAt": "2026-08-11T12:05:00",
              "collectedBy": "Linda Walsh (Grandma)"
            }
          },
          {
            "ref": "BK-4801",
            "booker": "Rachel Clarke",
            "email": "rachel.clarke@gmail.com",
            "phone": "07700 900667",
            "addons": [
              "Lunch club",
              "Late pick-up (17:30)"
            ],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Noah Clarke",
                "age": 10
              }
            ],
            "child": {
              "dob": "2015-09-27",
              "school": "Oakfield Junior",
              "sex": "Male",
              "allergies": "",
              "medical": "",
              "dietary": "",
              "send": "",
              "careNotes": "",
              "collectionPassword": "9021",
              "emergencyName": "Mark Clarke",
              "emergencyPhone": "07700 900443",
              "photoConsent": true,
              "likes": "Basketball, coding",
              "dislikes": "",
              "swimming": "Confident (25m+)",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": true,
              "answers": {}
            },
            "attendance": {
              "status": "in",
              "inAt": "2026-08-11T08:38:00",
              "collectedAt": null,
              "collectedBy": null
            }
          }
        ]
      },
      {
        "blockId": "blk-forest-pm",
        "date": "2026-08-11",
        "start": "13:00",
        "end": "16:00",
        "blockName": "Forest School (PM)",
        "listingId": "lst-summer-camp",
        "listingName": "Summer Holiday Camp",
        "counts": {
          "expected": 5,
          "present": 3,
          "notArrived": 1,
          "absent": 1,
          "collected": 1
        },
        "heads": [
          {
            "n": 3,
            "by": "Tom Reilly",
            "at": "2026-08-11T13:25:00"
          }
        ],
        "takenBy": {
          "name": "Tom Reilly",
          "at": "2026-08-11T13:10:00"
        },
        "attendees": [
          {
            "ref": "BK-4840",
            "booker": "Laura Reid",
            "email": "laura.reid@gmail.com",
            "phone": "07700 900909",
            "addons": [],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Sophia Reid",
                "age": 6
              }
            ],
            "child": {
              "dob": "2019-11-14",
              "school": "Greenbank Primary",
              "sex": "Female",
              "allergies": "",
              "medical": "",
              "dietary": "",
              "send": "",
              "careNotes": "",
              "collectionPassword": "3345",
              "emergencyName": "Gary Reid",
              "emergencyPhone": "07700 900010",
              "photoConsent": true,
              "likes": "Mud kitchen",
              "dislikes": "",
              "swimming": "Beginner",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": false,
              "answers": {}
            },
            "attendance": null
          },
          {
            "ref": "BK-4777",
            "booker": "Karen Hughes",
            "email": "karen.hughes@btinternet.com",
            "phone": "07700 900123",
            "addons": [],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "George Hughes",
                "age": 11
              }
            ],
            "child": {
              "dob": "2014-10-22",
              "school": "Oakfield Junior",
              "sex": "Male",
              "allergies": "",
              "medical": "",
              "dietary": "",
              "send": "",
              "careNotes": "",
              "collectionPassword": "7788",
              "emergencyName": "Steve Hughes",
              "emergencyPhone": "07700 900234",
              "photoConsent": true,
              "likes": "Den building",
              "dislikes": "",
              "swimming": "Confident (25m+)",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": true,
              "answers": {}
            },
            "attendance": {
              "status": "in",
              "inAt": "2026-08-11T13:03:00",
              "collectedAt": null,
              "collectedBy": null
            }
          },
          {
            "ref": "BK-4826",
            "booker": "Nicola Adams",
            "email": "nicola.adams@gmail.com",
            "phone": "07700 900345",
            "addons": [
              "Early drop-off (08:00)"
            ],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Lily Adams",
                "age": 7
              }
            ],
            "child": {
              "dob": "2018-05-09",
              "school": "St Mary's Primary",
              "sex": "Female",
              "allergies": "Tree nuts (cashew, almond) — antihistamine in bag",
              "medical": "",
              "dietary": "",
              "send": "",
              "careNotes": "Check all snacks for nut traces.",
              "collectionPassword": "DAISY-12",
              "emergencyName": "Peter Adams",
              "emergencyPhone": "07700 900456",
              "photoConsent": true,
              "likes": "Bug hunting",
              "dislikes": "",
              "swimming": "Beginner",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": false,
              "answers": {}
            },
            "attendance": {
              "status": "in",
              "inAt": "2026-08-11T13:05:00",
              "collectedAt": null,
              "collectedBy": null
            }
          },
          {
            "ref": "BK-4818",
            "booker": "Gemma Evans",
            "email": "gemma.evans@gmail.com",
            "phone": "07700 900578",
            "note": "Family holiday.",
            "addons": [],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Charlie Evans",
                "age": 5
              }
            ],
            "child": {
              "dob": "2020-09-02",
              "school": "Little Acorns Nursery",
              "sex": "Male",
              "allergies": "",
              "medical": "",
              "dietary": "",
              "send": "",
              "careNotes": "",
              "collectionPassword": "2200",
              "emergencyName": "Ryan Evans",
              "emergencyPhone": "07700 900589",
              "photoConsent": true,
              "likes": "Climbing",
              "dislikes": "",
              "swimming": "Non-swimmer",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": false,
              "answers": {}
            },
            "attendance": {
              "status": "absent",
              "inAt": null,
              "collectedAt": null,
              "collectedBy": null
            }
          },
          {
            "ref": "BK-4763",
            "booker": "Sarah Foster",
            "email": "sarah.foster@gmail.com",
            "phone": "07700 900690",
            "addons": [],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Mia Foster",
                "age": 9
              }
            ],
            "child": {
              "dob": "2016-08-08",
              "school": "Meadowview Primary",
              "sex": "Female",
              "allergies": "",
              "medical": "Wears glasses; spare pair in her bag.",
              "dietary": "",
              "send": "",
              "careNotes": "",
              "collectionPassword": "5566",
              "emergencyName": "Mark Foster",
              "emergencyPhone": "07700 900701",
              "photoConsent": true,
              "likes": "Nature crafts",
              "dislikes": "",
              "swimming": "Confident (25m+)",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": false,
              "answers": {}
            },
            "attendance": {
              "status": "in",
              "inAt": "2026-08-11T13:01:00",
              "collectedAt": "2026-08-11T15:50:00",
              "collectedBy": "Mark Foster (Dad)"
            }
          }
        ]
      },
      {
        "blockId": "blk-football",
        "date": "2026-08-11",
        "start": "15:30",
        "end": "16:30",
        "blockName": "Football",
        "listingId": "lst-football",
        "listingName": "After-School Football Club",
        "counts": {
          "expected": 3,
          "present": 2,
          "notArrived": 1,
          "absent": 0,
          "collected": 0
        },
        "heads": [
          {
            "n": 2,
            "by": "Coach Dan",
            "at": "2026-08-11T15:45:00"
          }
        ],
        "takenBy": {
          "name": "Coach Dan",
          "at": "2026-08-11T15:35:00"
        },
        "attendees": [
          {
            "ref": "BK-4902",
            "booker": "Michelle Wright",
            "email": "michelle.wright@gmail.com",
            "phone": "07700 900814",
            "addons": [],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Leo Wright",
                "age": 8
              }
            ],
            "child": {
              "dob": "2017-06-30",
              "school": "Oakfield Junior",
              "sex": "Male",
              "allergies": "",
              "medical": "",
              "dietary": "",
              "send": "",
              "careNotes": "",
              "collectionPassword": "GOAL-7",
              "emergencyName": "Chris Wright",
              "emergencyPhone": "07700 900825",
              "photoConsent": true,
              "likes": "Football",
              "dislikes": "",
              "swimming": "Beginner",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": true,
              "answers": {}
            },
            "attendance": {
              "status": "in",
              "inAt": "2026-08-11T15:31:00",
              "collectedAt": null,
              "collectedBy": null
            }
          },
          {
            "ref": "BK-4915",
            "booker": "Deepa Shah",
            "email": "deepa.shah@gmail.com",
            "phone": "07700 900836",
            "addons": [],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Ava Shah",
                "age": 7
              }
            ],
            "child": {
              "dob": "2018-04-17",
              "school": "St Mary's Primary",
              "sex": "Female",
              "allergies": "Egg — no mayonnaise or baked goods with egg",
              "medical": "",
              "dietary": "",
              "send": "",
              "careNotes": "",
              "collectionPassword": "STAR-4",
              "emergencyName": "Anil Shah",
              "emergencyPhone": "07700 900847",
              "photoConsent": true,
              "likes": "Running",
              "dislikes": "",
              "swimming": "Confident (25m+)",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": false,
              "answers": {}
            },
            "attendance": {
              "status": "in",
              "inAt": "2026-08-11T15:33:00",
              "collectedAt": null,
              "collectedBy": null
            }
          },
          {
            "ref": "BK-4921",
            "booker": "Tom Barnes",
            "email": "tom.barnes@outlook.com",
            "phone": "07700 900858",
            "addons": [],
            "bookingStatus": "confirmed",
            "seats": 1,
            "children": [
              {
                "name": "Max Barnes",
                "age": 9
              }
            ],
            "child": {
              "dob": "2016-03-11",
              "school": "Meadowview Primary",
              "sex": "Male",
              "allergies": "",
              "medical": "",
              "dietary": "",
              "send": "",
              "careNotes": "",
              "collectionPassword": "4488",
              "emergencyName": "Sam Barnes",
              "emergencyPhone": "07700 900869",
              "photoConsent": true,
              "likes": "Goalkeeping",
              "dislikes": "",
              "swimming": "Beginner",
              "suncreamConsent": true,
              "firstAidConsent": true,
              "walkHomeConsent": true,
              "answers": {}
            },
            "attendance": null
          }
        ]
      }
    ]
  },
  "accidents": {
    "/api/incidents": [
      {
        "id": "inc_2001",
        "kind": "accident",
        "date": "2026-08-10",
        "time": "11:20",
        "childName": "Olivia Bennett",
        "childId": "ch_olivia_bennett",
        "location": "The main sports hall",
        "description": "Olivia tripped over a cone during the multi-sports relay and grazed her right knee on the floor. She was upset but calmed quickly after a cuddle and a cold pack.",
        "injury": "Grazed knee",
        "treatment": "Cleaned wound with saline wipe; Applied plaster; Reassured and comforted child",
        "firstAider": "Jade Whitmore",
        "severity": "minor",
        "parentNotified": true,
        "parentNotifiedAt": "2026-08-10T11:35:00.000Z",
        "parentNotifiedHow": "In person at pickup",
        "followUp": "Keep the plaster dry overnight; check the graze in the morning.",
        "recordedByName": "Jade Whitmore",
        "createdAt": "2026-08-10T11:34:00.000Z",
        "acknowledgedAt": "2026-08-10T18:02:00.000Z",
        "acknowledgedBy": "Sarah Bennett",
        "notes": [
          {
            "by": "Jade Whitmore",
            "role": "staff",
            "text": "Olivia was back playing within ten minutes and had a great afternoon.",
            "at": "2026-08-10T11:40:00.000Z"
          },
          {
            "by": "Sarah Bennett",
            "role": "parent",
            "text": "Thank you so much for letting me know — she showed me the plaster proudly! All healed by bedtime.",
            "at": "2026-08-10T18:05:00.000Z"
          }
        ]
      },
      {
        "id": "inc_2002",
        "kind": "accident",
        "date": "2026-08-10",
        "time": "14:05",
        "childName": "Harry Docherty",
        "childId": "ch_harry_docherty",
        "location": "The AstroTurf pitch",
        "description": "During a football match Harry went in for a tackle and knocked heads with another child. No loss of consciousness. Small bump appearing above the left eyebrow.",
        "injury": "Bump to the head",
        "treatment": "Applied a cold compress; Monitored for signs of concussion; Sat child out and observed",
        "firstAider": "Marcus Fielding",
        "severity": "moderate",
        "parentNotified": true,
        "parentNotifiedAt": "2026-08-10T14:15:00.000Z",
        "parentNotifiedHow": "Phone call",
        "followUp": "Head injury advice leaflet given. Parent to monitor overnight for drowsiness, vomiting or confusion.",
        "recordedByName": "Marcus Fielding",
        "createdAt": "2026-08-10T14:14:00.000Z",
        "updatedAt": "2026-08-10T16:30:00.000Z",
        "acknowledgedAt": "2026-08-10T15:10:00.000Z",
        "acknowledgedBy": "Paul Docherty",
        "attachments": [
          "https://placehold.co/600x400/eef4fd/1d3a8f?text=Head+injury+advice"
        ],
        "notes": [
          {
            "by": "Marcus Fielding",
            "role": "staff",
            "text": "Harry was bright and chatty for the rest of the session, no dizziness reported.",
            "at": "2026-08-10T14:20:00.000Z"
          },
          {
            "by": "Paul Docherty",
            "role": "parent",
            "text": "Thanks for the call. He's absolutely fine this evening, eating well and no complaints. Really appreciate how thorough you were.",
            "at": "2026-08-10T19:12:00.000Z"
          }
        ]
      },
      {
        "id": "inc_2003",
        "kind": "accident",
        "date": "2026-08-07",
        "time": "10:45",
        "childName": "Amelia Clarke",
        "childId": "ch_amelia_clarke",
        "location": "The forest school area",
        "description": "Amelia was stung on the back of her hand by a wasp while sitting near the picnic benches. Redness and mild swelling around the sting site. No known allergy on record.",
        "injury": "Insect sting",
        "treatment": "Removed sting and cleaned area; Applied a cold compress; Monitored for allergic reaction",
        "firstAider": "Priya Nair",
        "severity": "minor",
        "parentNotified": true,
        "parentNotifiedAt": "2026-08-07T10:55:00.000Z",
        "parentNotifiedHow": "Text message",
        "followUp": "Watch for any spreading rash or breathing difficulty and seek advice if concerned.",
        "recordedByName": "Priya Nair",
        "createdAt": "2026-08-07T10:54:00.000Z",
        "acknowledgedAt": "2026-08-07T12:40:00.000Z",
        "acknowledgedBy": "Emma Clarke",
        "notes": []
      },
      {
        "id": "inc_2004",
        "kind": "accident",
        "date": "2026-08-06",
        "time": "13:30",
        "childName": "Jacob Owusu",
        "childId": "ch_jacob_owusu",
        "location": "The gymnastics mat area",
        "description": "Jacob landed awkwardly coming off the trampette and turned his right ankle. Able to weight-bear with a slight limp. Some swelling around the ankle.",
        "injury": "Sprained ankle",
        "treatment": "Rest — sat child down; Applied a cold compress; Elevated the limb; Advised RICE (rest, ice, compression, elevation)",
        "firstAider": "Tom Ashby",
        "severity": "moderate",
        "parentNotified": true,
        "parentNotifiedAt": "2026-08-06T13:45:00.000Z",
        "parentNotifiedHow": "Phone call",
        "followUp": "Advised to rest the ankle at home and see a GP if pain or swelling worsens.",
        "recordedByName": "Tom Ashby",
        "createdAt": "2026-08-06T13:44:00.000Z",
        "acknowledgedAt": "2026-08-06T17:20:00.000Z",
        "acknowledgedBy": "Grace Owusu",
        "notes": [
          {
            "by": "Tom Ashby",
            "role": "staff",
            "text": "Jacob was comfortable resting with an ice pack for the last part of the day and was collected on time.",
            "at": "2026-08-06T14:00:00.000Z"
          }
        ]
      },
      {
        "id": "inc_2005",
        "kind": "accident",
        "date": "2026-08-05",
        "time": "09:50",
        "childName": "Sophie Turner",
        "childId": "ch_sophie_turner",
        "location": "The craft room",
        "description": "Sophie caught the side of her finger on the edge of a piece of card and gave herself a small paper cut. Very minor, tiny amount of blood.",
        "injury": "Small cut",
        "treatment": "Cleaned wound with saline wipe; Applied a plaster; Reassured and comforted child",
        "firstAider": "Jade Whitmore",
        "severity": "minor",
        "parentNotified": false,
        "followUp": "",
        "recordedByName": "Jade Whitmore",
        "createdAt": "2026-08-05T09:52:00.000Z",
        "notes": []
      },
      {
        "id": "inc_2006",
        "kind": "accident",
        "date": "2026-08-05",
        "time": "15:15",
        "childName": "Ethan Reid",
        "childId": "ch_ethan_reid",
        "location": "The playground",
        "description": "Ethan fell from the low climbing frame onto the safety surface and banged his elbow. Crying initially but settled. Small red mark, full movement in the arm.",
        "injury": "Bruised elbow",
        "treatment": "Applied a cold compress; Reassured and comforted child; Monitored the child",
        "firstAider": "Marcus Fielding",
        "severity": "minor",
        "parentNotified": true,
        "parentNotifiedAt": "2026-08-05T15:25:00.000Z",
        "parentNotifiedHow": "In person at pickup",
        "followUp": "Keep an eye on the elbow this evening for any increased swelling.",
        "recordedByName": "Marcus Fielding",
        "createdAt": "2026-08-05T15:24:00.000Z",
        "acknowledgedAt": "2026-08-05T18:45:00.000Z",
        "acknowledgedBy": "Hannah Reid",
        "notes": []
      },
      {
        "id": "inc_2007",
        "kind": "accident",
        "date": "2026-08-04",
        "time": "12:10",
        "childName": "Isla Morgan",
        "childId": "ch_isla_morgan",
        "location": "The dining hall",
        "description": "Isla slipped on a wet patch on the floor near the water station and bumped her chin. No cut to the skin but a red mark and she was tearful.",
        "injury": "Bumped chin",
        "treatment": "Applied a cold compress; Reassured and comforted child",
        "firstAider": "Priya Nair",
        "severity": "minor",
        "parentNotified": true,
        "parentNotifiedAt": "2026-08-04T12:20:00.000Z",
        "parentNotifiedHow": "Text message",
        "followUp": "",
        "recordedByName": "Priya Nair",
        "createdAt": "2026-08-04T12:19:00.000Z",
        "acknowledgedAt": "2026-08-04T16:05:00.000Z",
        "acknowledgedBy": "Laura Morgan",
        "notes": [
          {
            "by": "Laura Morgan",
            "role": "parent",
            "text": "No problem at all, thanks for letting me know. She was fine when I collected her.",
            "at": "2026-08-04T16:06:00.000Z"
          }
        ]
      },
      {
        "id": "inc_2008",
        "kind": "accident",
        "date": "2026-08-03",
        "time": "14:40",
        "childName": "Noah Patel",
        "childId": "ch_noah_patel",
        "location": "The AstroTurf pitch",
        "description": "Noah was running during a game of tag, tripped and skidded, grazing both knees and the palm of his left hand on the surface.",
        "injury": "Grazed knee",
        "treatment": "Cleaned wounds with saline wipes; Applied plasters; Reassured and comforted child; Gave the child a drink of water",
        "firstAider": "Tom Ashby",
        "severity": "minor",
        "parentNotified": true,
        "parentNotifiedAt": "2026-08-03T14:50:00.000Z",
        "parentNotifiedHow": "In person at pickup",
        "followUp": "Clean the grazes again tonight and keep them covered.",
        "recordedByName": "Tom Ashby",
        "createdAt": "2026-08-03T14:49:00.000Z",
        "notes": []
      },
      {
        "id": "inc_2009",
        "kind": "accident",
        "date": "2026-07-31",
        "time": "11:05",
        "childName": "Freya Hughes",
        "childId": "ch_freya_hughes",
        "location": "The sports hall",
        "description": "Freya complained of feeling dizzy and hot during a warm-up on a very warm day. Sat down in the shade, given water and cooled down. Likely mild overheating.",
        "injury": "Feeling faint / overheated",
        "treatment": "Moved child to a cool shaded area; Gave the child a drink of water; Rest — sat child down; Monitored the child",
        "firstAider": "Jade Whitmore",
        "severity": "moderate",
        "parentNotified": true,
        "parentNotifiedAt": "2026-07-31T11:20:00.000Z",
        "parentNotifiedHow": "Phone call",
        "followUp": "Encourage plenty of fluids at home. Please send a named water bottle each day.",
        "recordedByName": "Jade Whitmore",
        "createdAt": "2026-07-31T11:19:00.000Z",
        "acknowledgedAt": "2026-07-31T13:15:00.000Z",
        "acknowledgedBy": "Chloe Hughes",
        "notes": [
          {
            "by": "Jade Whitmore",
            "role": "staff",
            "text": "Freya perked up quickly after resting and drinking water, and re-joined activities after lunch.",
            "at": "2026-07-31T11:30:00.000Z"
          },
          {
            "by": "Chloe Hughes",
            "role": "parent",
            "text": "Thank you, she does forget to drink when she's busy playing! I'll pack a bigger bottle tomorrow.",
            "at": "2026-07-31T13:16:00.000Z"
          }
        ]
      },
      {
        "id": "inc_2010",
        "kind": "accident",
        "date": "2026-07-30",
        "time": "10:20",
        "childName": "Oscar Bennett",
        "childId": "ch_oscar_bennett",
        "location": "The forest school area",
        "description": "Oscar brushed against a patch of nettles while exploring and developed a nettle rash on his forearm. Itchy and a little sore but not distressed.",
        "injury": "Nettle rash",
        "treatment": "Rinsed the area with cool water; Applied a cold compress; Reassured and comforted child",
        "firstAider": "Priya Nair",
        "severity": "minor",
        "parentNotified": true,
        "parentNotifiedAt": "2026-07-30T10:30:00.000Z",
        "parentNotifiedHow": "Text message",
        "followUp": "",
        "recordedByName": "Priya Nair",
        "createdAt": "2026-07-30T10:29:00.000Z",
        "acknowledgedAt": "2026-07-30T15:00:00.000Z",
        "acknowledgedBy": "Sarah Bennett",
        "notes": []
      },
      {
        "id": "inc_2011",
        "kind": "accident",
        "date": "2026-07-29",
        "time": "13:55",
        "childName": "Lily Chapman",
        "childId": "ch_lily_chapman",
        "location": "The swimming pool",
        "description": "Lily swallowed a small amount of pool water and had a brief coughing fit at the poolside. Recovered fully after a rest and a drink. Precautionary log.",
        "injury": "Swallowed water",
        "treatment": "Rest — sat child down; Gave the child a drink of water; Monitored the child",
        "firstAider": "Marcus Fielding",
        "severity": "minor",
        "parentNotified": true,
        "parentNotifiedAt": "2026-07-29T14:05:00.000Z",
        "parentNotifiedHow": "In person at pickup",
        "followUp": "",
        "recordedByName": "Marcus Fielding",
        "createdAt": "2026-07-29T14:04:00.000Z",
        "notes": []
      },
      {
        "id": "inc_2012",
        "kind": "accident",
        "date": "2026-07-28",
        "time": "15:40",
        "childName": "Mohammed Ali",
        "childId": "ch_mohammed_ali",
        "location": "The car park drop-off",
        "description": "During a serious asthma episode Mohammed became very wheezy and short of breath after running. His reliever inhaler was administered and an ambulance was called as a precaution as symptoms were slow to ease.",
        "injury": "Asthma attack",
        "treatment": "Helped child use their reliever inhaler; Sat child upright and kept calm; Called 999 for an ambulance; Stayed with the child until help arrived",
        "firstAider": "Tom Ashby",
        "severity": "serious",
        "parentNotified": true,
        "parentNotifiedAt": "2026-07-28T15:45:00.000Z",
        "parentNotifiedHow": "Phone call — spoke to parent immediately",
        "followUp": "Paramedics assessed Mohammed and he was fine to go home with his parent. GP review of his asthma plan advised. Updated care plan needed before next session.",
        "recordedByName": "Tom Ashby",
        "createdAt": "2026-07-28T15:44:00.000Z",
        "updatedAt": "2026-07-28T17:00:00.000Z",
        "acknowledgedAt": "2026-07-28T16:10:00.000Z",
        "acknowledgedBy": "Yasmin Ali",
        "attachments": [
          "https://placehold.co/600x400/fdebec/c02636?text=Ambulance+report",
          "https://placehold.co/600x400/eef4fd/1d3a8f?text=Asthma+care+plan"
        ],
        "notes": [
          {
            "by": "Tom Ashby",
            "role": "staff",
            "text": "Ambulance arrived within 12 minutes. Mohammed's breathing had settled well by the time they assessed him. Parent met us at the camp.",
            "at": "2026-07-28T16:00:00.000Z"
          },
          {
            "by": "Yasmin Ali",
            "role": "parent",
            "text": "I can't thank your team enough for staying so calm and doing everything right. We've booked a GP review of his asthma plan for this week and will send the updated plan through.",
            "at": "2026-07-28T20:30:00.000Z"
          },
          {
            "by": "Tom Ashby",
            "role": "staff",
            "text": "Thank you — please do send the updated plan and we'll make sure all staff are briefed before his next day with us.",
            "at": "2026-07-28T21:05:00.000Z"
          }
        ]
      },
      {
        "id": "inc_2013",
        "kind": "accident",
        "date": "2026-07-27",
        "time": "09:35",
        "childName": "Charlotte Evans",
        "childId": "ch_charlotte_evans",
        "location": "The main hall",
        "description": "Charlotte bit her lip after bumping into a table corner while excited at the start of the day. Small amount of blood inside the lip, quickly stopped.",
        "injury": "Cut lip",
        "treatment": "Applied gentle pressure with a clean gauze; Gave a cold drink to reduce swelling; Reassured and comforted child",
        "firstAider": "Jade Whitmore",
        "severity": "minor",
        "parentNotified": true,
        "parentNotifiedAt": "2026-07-27T09:45:00.000Z",
        "parentNotifiedHow": "Text message",
        "followUp": "Soft foods for lunch today may be more comfortable.",
        "recordedByName": "Jade Whitmore",
        "createdAt": "2026-07-27T09:44:00.000Z",
        "acknowledgedAt": "2026-07-27T11:30:00.000Z",
        "acknowledgedBy": "Rebecca Evans",
        "notes": []
      }
    ],
    "/api/bookings": [
      {
        "child": "Olivia Bennett",
        "childId": "ch_olivia_bennett"
      },
      {
        "child": "Harry Docherty",
        "childId": "ch_harry_docherty"
      },
      {
        "child": "Amelia Clarke",
        "childId": "ch_amelia_clarke"
      },
      {
        "child": "Jacob Owusu",
        "childId": "ch_jacob_owusu"
      },
      {
        "child": "Sophie Turner",
        "childId": "ch_sophie_turner"
      },
      {
        "child": "Ethan Reid",
        "childId": "ch_ethan_reid"
      },
      {
        "child": "Isla Morgan",
        "childId": "ch_isla_morgan"
      },
      {
        "child": "Noah Patel",
        "childId": "ch_noah_patel"
      },
      {
        "child": "Freya Hughes",
        "childId": "ch_freya_hughes"
      },
      {
        "child": "Oscar Bennett",
        "childId": "ch_oscar_bennett"
      },
      {
        "child": "Lily Chapman",
        "childId": "ch_lily_chapman"
      },
      {
        "child": "Mohammed Ali",
        "childId": "ch_mohammed_ali"
      },
      {
        "child": "Charlotte Evans",
        "childId": "ch_charlotte_evans"
      },
      {
        "child": "William Foster",
        "childId": "ch_william_foster"
      },
      {
        "child": "Grace Thompson",
        "childId": "ch_grace_thompson"
      }
    ],
    "/api/me": {
      "role": "freelancer"
    },
    "/api/library": null
  }
};
