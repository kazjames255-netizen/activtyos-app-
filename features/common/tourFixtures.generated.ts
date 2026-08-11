// AUTO-GENERATED from the tour-fixtures workflow. Do not edit by hand.
// Merged (with the hand-authored dashboard winning) in tourFixtures.ts.

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
  },
  "medication": {
    "/api/me": {
      "role": "freelancer"
    },
    "/api/library": {
      "settings": {
        "providerName": "Sunshine Sports Camps",
        "medication": {
          "informParentGiven": true,
          "informParentMissed": true,
          "notifyParentNote": true,
          "notifyParentAuthorise": true,
          "remindWhenDue": true,
          "requireWitness": false,
          "leadsOnly": false
        }
      }
    },
    "/api/bookings": [
      {
        "child": "Oliver Bennett",
        "childId": "c-oliver",
        "listing": "Summer Multi-Sports Camp",
        "days": [
          "2026-08-10",
          "2026-08-11",
          "2026-08-12",
          "2026-08-13",
          "2026-08-14"
        ]
      },
      {
        "child": "Amelia Clarke",
        "childId": "c-amelia",
        "listing": "Summer Multi-Sports Camp",
        "days": [
          "2026-08-11",
          "2026-08-12",
          "2026-08-13",
          "2026-08-14",
          "2026-08-15"
        ]
      },
      {
        "child": "Harry Dawson",
        "childId": "c-harry",
        "listing": "Football Academy",
        "days": [
          "2026-08-03",
          "2026-08-04",
          "2026-08-05",
          "2026-08-06",
          "2026-08-07"
        ]
      },
      {
        "child": "Sophia Evans",
        "childId": "c-sophia",
        "listing": "Gymnastics Camp",
        "days": [
          "2026-07-27",
          "2026-07-28",
          "2026-07-29",
          "2026-07-30",
          "2026-07-31"
        ]
      },
      {
        "child": "Jack Foster",
        "childId": "c-jack",
        "listing": "Forest School Adventures",
        "days": [
          "2026-08-10",
          "2026-08-11",
          "2026-08-12",
          "2026-08-13",
          "2026-08-14"
        ]
      },
      {
        "child": "Isla Green",
        "childId": "c-isla",
        "listing": "Summer Multi-Sports Camp",
        "days": [
          "2026-08-11",
          "2026-08-12",
          "2026-08-13",
          "2026-08-14",
          "2026-08-15"
        ]
      },
      {
        "child": "Charlie Hughes",
        "childId": "c-charlie",
        "listing": "Football Academy",
        "days": [
          "2026-08-10",
          "2026-08-11",
          "2026-08-12",
          "2026-08-13",
          "2026-08-14"
        ]
      },
      {
        "child": "Lily Jackson",
        "childId": "c-lily",
        "listing": "Holiday Camp",
        "days": [
          "2026-08-04",
          "2026-08-05",
          "2026-08-06",
          "2026-08-07",
          "2026-08-08"
        ]
      },
      {
        "child": "George King",
        "childId": "c-george",
        "listing": "Gymnastics Camp",
        "days": [
          "2026-08-10",
          "2026-08-11",
          "2026-08-12",
          "2026-08-13",
          "2026-08-14"
        ]
      },
      {
        "child": "Freya Lewis",
        "childId": "c-freya",
        "listing": "Forest School Adventures",
        "days": [
          "2026-08-11",
          "2026-08-12",
          "2026-08-13",
          "2026-08-14",
          "2026-08-15"
        ]
      }
    ],
    "/api/medications": [
      {
        "id": "m-oliver-ventolin",
        "childId": "c-oliver",
        "childName": "Oliver Bennett",
        "name": "Ventolin (salbutamol) inhaler",
        "dose": "one puff",
        "route": "inhaler",
        "condition": "asthma",
        "schedule": "On every booked day · at 12:30",
        "instructions": "Shake well and use with the blue spacer. Wait 30 seconds between puffs. Offer before high-energy activity.",
        "asNeeded": false,
        "storage": "Office first-aid cupboard, room temperature",
        "heldOnSite": true,
        "expiryDate": "2027-03-31",
        "consentGranted": true,
        "consentBy": "Rachel Bennett",
        "consentDate": "2026-07-28T09:15:00.000Z",
        "parentNote": "He gets wheezy after running — please offer it before football and let me know if he needs it more than once.",
        "archived": false
      },
      {
        "id": "m-amelia-piriton",
        "childId": "c-amelia",
        "childName": "Amelia Clarke",
        "name": "Piriton (chlorphenamine)",
        "dose": "5ml",
        "route": "oral",
        "condition": "hay fever",
        "schedule": "On these days: Mon 11 Aug, Tue 12 Aug, Wed 13 Aug · at 09:00",
        "instructions": "Give with breakfast. May cause slight drowsiness.",
        "asNeeded": false,
        "storage": "Office medicine box",
        "heldOnSite": true,
        "expiryDate": "2027-09-30",
        "consentGranted": true,
        "consentBy": "James Clarke",
        "consentDate": "2026-08-01T08:40:00.000Z",
        "archived": false
      },
      {
        "id": "m-harry-epipen",
        "childId": "c-harry",
        "childName": "Harry Dawson",
        "name": "EpiPen (adrenaline auto-injector)",
        "dose": "0.3mg auto-injector",
        "route": "intramuscular",
        "condition": "severe nut allergy (anaphylaxis)",
        "schedule": "Only when needed",
        "instructions": "EMERGENCY ONLY. Administer to the outer thigh, hold 3 seconds, then call 999. A second pen is in his named bag.",
        "asNeeded": true,
        "storage": "Harry's named red med bag — kept with the group lead at all times",
        "heldOnSite": true,
        "expiryDate": "2026-12-15",
        "consentGranted": true,
        "consentBy": "Sarah Dawson",
        "consentDate": "2026-08-02T18:22:00.000Z",
        "parentNote": "Please make sure whoever is leading his group carries the bag on trips and at lunch.",
        "archived": false
      },
      {
        "id": "m-sophia-calpol",
        "childId": "c-sophia",
        "childName": "Sophia Evans",
        "name": "Calpol (paracetamol)",
        "dose": "5ml",
        "route": "oral",
        "condition": "pain / high temperature",
        "schedule": "Only when needed",
        "instructions": "Only if temperature is above 38°C or she is in obvious discomfort. Maximum one dose every 6 hours. Call me before a second dose.",
        "asNeeded": true,
        "storage": "Office medicine box",
        "heldOnSite": true,
        "expiryDate": "2028-01-31",
        "consentGranted": true,
        "consentBy": "Emma Evans",
        "consentDate": "2026-07-26T10:05:00.000Z",
        "archived": false
      },
      {
        "id": "m-sophia-amox",
        "childId": "c-sophia",
        "childName": "Sophia Evans",
        "name": "Amoxicillin",
        "dose": "5ml",
        "route": "oral",
        "condition": "chest infection",
        "schedule": "On every booked day · at 08:30, 16:30",
        "instructions": "Course prescribed by GP. Give with food.",
        "asNeeded": false,
        "storage": "Fridge in the office",
        "heldOnSite": false,
        "expiryDate": "2026-08-24",
        "consentGranted": false,
        "archived": false
      },
      {
        "id": "m-jack-amox",
        "childId": "c-jack",
        "childName": "Jack Foster",
        "name": "Amoxicillin",
        "dose": "5ml",
        "route": "oral",
        "condition": "ear infection",
        "schedule": "On every booked day · at 08:30, 16:30",
        "instructions": "7-day course, ends 15 Aug. Give with food. Shake the bottle before use.",
        "asNeeded": false,
        "storage": "Fridge in the office",
        "heldOnSite": true,
        "expiryDate": "2026-08-20",
        "consentGranted": true,
        "consentBy": "Laura Foster",
        "consentDate": "2026-08-08T07:55:00.000Z",
        "archived": false
      },
      {
        "id": "m-isla-insulin",
        "childId": "c-isla",
        "childName": "Isla Green",
        "name": "NovoRapid (insulin) — pump",
        "dose": "per carb count",
        "route": "insulin pump",
        "condition": "type 1 diabetes",
        "schedule": "On every booked day",
        "instructions": "Parent-managed pump. Staff to supervise carbohydrate counting at lunch only — do NOT adjust the pump. Check blood glucose before lunch.",
        "asNeeded": false,
        "storage": "Isla carries her own kit; hypo box in her bag",
        "heldOnSite": false,
        "expiryDate": "2026-10-31",
        "consentGranted": true,
        "consentBy": "Priya Green",
        "consentDate": "2026-08-05T09:00:00.000Z",
        "parentNote": "Check BG before lunch. If below 4, give the juice + biscuits in her hypo box and call me straight away.",
        "archived": false
      },
      {
        "id": "m-charlie-mph",
        "childId": "c-charlie",
        "childName": "Charlie Hughes",
        "name": "Methylphenidate (Medikinet)",
        "dose": "one 10mg tablet",
        "route": "oral",
        "condition": "ADHD",
        "schedule": "On these days: Mon 10 Aug, Tue 11 Aug · at 12:00",
        "instructions": "Give with lunch.",
        "asNeeded": false,
        "storage": "Locked office cabinet",
        "heldOnSite": true,
        "expiryDate": "2027-05-31",
        "consentGranted": false,
        "archived": false
      },
      {
        "id": "m-lily-hc",
        "childId": "c-lily",
        "childName": "Lily Jackson",
        "name": "Hydrocortisone 1% cream",
        "dose": "thin layer",
        "route": "topical",
        "condition": "eczema",
        "schedule": "Only when needed",
        "instructions": "Apply a thin layer to affected areas (backs of knees, inner elbows) up to twice daily. Wash hands after.",
        "asNeeded": true,
        "storage": "Office medicine box",
        "heldOnSite": true,
        "expiryDate": "2026-06-30",
        "consentGranted": true,
        "consentBy": "Mark Jackson",
        "consentDate": "2026-08-03T08:30:00.000Z",
        "archived": false
      },
      {
        "id": "m-freya-melatonin",
        "childId": "c-freya",
        "childName": "Freya Lewis",
        "name": "Melatonin",
        "dose": "3mg",
        "route": "oral",
        "condition": "sleep (SEND)",
        "schedule": "Only when needed",
        "instructions": "Only if I request it ahead of a late pick-up. Not a routine dose.",
        "asNeeded": true,
        "storage": "Office medicine box",
        "heldOnSite": true,
        "expiryDate": "2027-11-30",
        "consentGranted": true,
        "consentBy": "Hannah Lewis",
        "consentDate": "2026-08-06T16:10:00.000Z",
        "archived": false
      },
      {
        "id": "m-george-salbutamol",
        "childId": "c-george",
        "childName": "George King",
        "name": "Salbutamol inhaler",
        "dose": "two puffs",
        "route": "inhaler",
        "condition": "asthma",
        "schedule": "On every booked day · at 15:00",
        "instructions": "Use with spacer. Two puffs, 30 seconds apart.",
        "asNeeded": false,
        "storage": "Office first-aid cupboard",
        "heldOnSite": true,
        "expiryDate": "2027-02-28",
        "consentGranted": false,
        "consentBy": "Diane King",
        "consentDate": "2026-08-04T09:20:00.000Z",
        "consentWithdrawnAt": "2026-08-11T07:45:00.000Z",
        "parentNote": "We've stopped this for now on the GP's advice — please don't administer.",
        "archived": true
      },
      {
        "id": "m-oliver-eyedrops",
        "childId": "c-oliver",
        "childName": "Oliver Bennett",
        "name": "Chloramphenicol eye drops",
        "dose": "one drop each eye",
        "route": "ophthalmic",
        "condition": "conjunctivitis",
        "schedule": "On these days: Wed 29 Jul, Thu 30 Jul, Fri 31 Jul · at 09:00",
        "instructions": "One drop in each eye. Finished course on 31 Jul.",
        "asNeeded": false,
        "storage": "Fridge in the office",
        "heldOnSite": true,
        "expiryDate": "2026-07-31",
        "consentGranted": true,
        "consentBy": "Rachel Bennett",
        "consentDate": "2026-07-27T08:50:00.000Z",
        "archived": true
      }
    ],
    "/api/medications/administrations": [
      {
        "id": "a1",
        "medicationId": "m-oliver-ventolin",
        "medName": "Ventolin (salbutamol) inhaler",
        "childName": "Oliver Bennett",
        "date": "2026-08-11",
        "time": "12:30",
        "doseGiven": "one puff",
        "given": true,
        "administeredByName": "Emma Thompson",
        "notes": "Before football, no wheeze after"
      },
      {
        "id": "a2",
        "medicationId": "m-oliver-ventolin",
        "medName": "Ventolin (salbutamol) inhaler",
        "childName": "Oliver Bennett",
        "date": "2026-08-10",
        "time": "12:35",
        "doseGiven": "one puff",
        "given": true,
        "administeredByName": "Daniel Roberts"
      },
      {
        "id": "a3",
        "medicationId": "m-amelia-piriton",
        "medName": "Piriton (chlorphenamine)",
        "childName": "Amelia Clarke",
        "date": "2026-08-11",
        "time": "09:00",
        "doseGiven": "5ml",
        "given": true,
        "administeredByName": "Emma Thompson",
        "notes": "With breakfast"
      },
      {
        "id": "a4",
        "medicationId": "m-jack-amox",
        "medName": "Amoxicillin",
        "childName": "Jack Foster",
        "date": "2026-08-11",
        "time": "08:30",
        "doseGiven": "5ml",
        "given": true,
        "administeredByName": "Priya Shah",
        "notes": "With toast"
      },
      {
        "id": "a5",
        "medicationId": "m-jack-amox",
        "medName": "Amoxicillin",
        "childName": "Jack Foster",
        "date": "2026-08-10",
        "time": "08:30",
        "doseGiven": "5ml",
        "given": true,
        "administeredByName": "Priya Shah"
      },
      {
        "id": "a6",
        "medicationId": "m-jack-amox",
        "medName": "Amoxicillin",
        "childName": "Jack Foster",
        "date": "2026-08-10",
        "time": "16:30",
        "doseGiven": "5ml",
        "given": true,
        "administeredByName": "Daniel Roberts"
      },
      {
        "id": "a7",
        "medicationId": "m-jack-amox",
        "medName": "Amoxicillin",
        "childName": "Jack Foster",
        "date": "2026-08-09",
        "time": "16:30",
        "doseGiven": "Not given",
        "given": false,
        "administeredByName": "Daniel Roberts",
        "notes": "Refused — spat it out. Retried 15 mins later, took it"
      },
      {
        "id": "a8",
        "medicationId": "m-isla-insulin",
        "medName": "NovoRapid (insulin) — pump",
        "childName": "Isla Green",
        "date": "2026-08-11",
        "time": "12:15",
        "doseGiven": "carb count supervised (48g)",
        "given": true,
        "administeredByName": "Michael Carter",
        "notes": "BG 6.2 before lunch"
      },
      {
        "id": "a9",
        "medicationId": "m-isla-insulin",
        "medName": "NovoRapid (insulin) — pump",
        "childName": "Isla Green",
        "date": "2026-08-10",
        "time": "12:20",
        "doseGiven": "carb count supervised (52g)",
        "given": true,
        "administeredByName": "Michael Carter",
        "notes": "BG 5.8 before lunch"
      },
      {
        "id": "a10",
        "medicationId": "m-lily-hc",
        "medName": "Hydrocortisone 1% cream",
        "childName": "Lily Jackson",
        "date": "2026-08-11",
        "time": "09:15",
        "doseGiven": "thin layer",
        "given": true,
        "administeredByName": "Emma Thompson",
        "notes": "Backs of knees, a little red this morning"
      },
      {
        "id": "a11",
        "medicationId": "m-lily-hc",
        "medName": "Hydrocortisone 1% cream",
        "childName": "Lily Jackson",
        "date": "2026-08-05",
        "time": "09:10",
        "doseGiven": "thin layer",
        "given": true,
        "administeredByName": "Emma Thompson"
      },
      {
        "id": "a12",
        "medicationId": "m-sophia-calpol",
        "medName": "Calpol (paracetamol)",
        "childName": "Sophia Evans",
        "date": "2026-07-29",
        "time": "13:40",
        "doseGiven": "5ml",
        "given": true,
        "administeredByName": "Daniel Roberts",
        "witnessedBy": "Priya Shah",
        "notes": "Temp 38.4°C, settled after and rejoined the group"
      },
      {
        "id": "a13",
        "medicationId": "m-george-salbutamol",
        "medName": "Salbutamol inhaler",
        "childName": "George King",
        "date": "2026-08-10",
        "time": "15:00",
        "doseGiven": "two puffs",
        "given": true,
        "administeredByName": "Priya Shah",
        "notes": "Recorded before consent was withdrawn"
      },
      {
        "id": "a14",
        "medicationId": "m-oliver-eyedrops",
        "medName": "Chloramphenicol eye drops",
        "childName": "Oliver Bennett",
        "date": "2026-07-30",
        "time": "09:00",
        "doseGiven": "one drop each eye",
        "given": true,
        "administeredByName": "Emma Thompson"
      },
      {
        "id": "a15",
        "medicationId": "m-oliver-eyedrops",
        "medName": "Chloramphenicol eye drops",
        "childName": "Oliver Bennett",
        "date": "2026-07-31",
        "time": "09:05",
        "doseGiven": "one drop each eye",
        "given": true,
        "administeredByName": "Emma Thompson",
        "notes": "Course complete"
      }
    ]
  },
  "incidents": {
    "/api/me": {
      "role": "freelancer",
      "name": "Sarah Mitchell",
      "tenantId": "VOiiaTnDNd03MLbZaVcM"
    },
    "/api/bookings": [
      {
        "child": "Oliver Bennett",
        "childId": "c-oliver",
        "listing": "Summer Multi-Sports Camp",
        "dates": "4–8 Aug 2026",
        "status": "confirmed"
      },
      {
        "child": "Amelia Hughes",
        "childId": "c-amelia",
        "listing": "Forest School Holiday Camp",
        "dates": "4–8 Aug 2026",
        "status": "confirmed"
      },
      {
        "child": "Jack Thompson",
        "childId": "c-jack",
        "listing": "Football Development Camp",
        "dates": "4–8 Aug 2026",
        "status": "confirmed"
      },
      {
        "child": "Isla Richardson",
        "childId": "c-isla",
        "listing": "Forest School Holiday Camp",
        "dates": "4–8 Aug 2026",
        "status": "confirmed"
      },
      {
        "child": "Harry Patel",
        "childId": "c-harry",
        "listing": "Football Development Camp",
        "dates": "4–8 Aug 2026",
        "status": "confirmed"
      },
      {
        "child": "Sophie Clarke",
        "childId": "c-sophie",
        "listing": "Little Movers Gymnastics",
        "dates": "3–7 Aug 2026",
        "status": "confirmed"
      },
      {
        "child": "Freddie Morgan",
        "childId": "c-freddie",
        "listing": "Football Development Camp",
        "dates": "28 Jul–1 Aug 2026",
        "status": "completed"
      },
      {
        "child": "Grace Walker",
        "childId": "c-grace",
        "listing": "Summer Multi-Sports Camp",
        "dates": "28 Jul–1 Aug 2026",
        "status": "completed"
      },
      {
        "child": "Noah Edwards",
        "childId": "c-noah",
        "listing": "Adventure Holiday Camp",
        "dates": "21–25 Jul 2026",
        "status": "completed"
      },
      {
        "child": "Ava Robinson",
        "childId": "c-ava",
        "listing": "Little Movers Gymnastics",
        "dates": "21–25 Jul 2026",
        "status": "completed"
      },
      {
        "child": "Leo Nguyen",
        "childId": "c-leo",
        "listing": "Summer Multi-Sports Camp",
        "dates": "4–8 Aug 2026",
        "status": "confirmed"
      }
    ],
    "/api/library": {
      "settings": {
        "providerName": "Sunshine Holiday Camps",
        "providerNameMode": "business",
        "billing": {
          "businessName": "Sunshine Holiday Camps Ltd",
          "email": "hello@sunshinecamps.co.uk",
          "phone": "01992 555 0123",
          "address": "Loughton Manor, High Road, Loughton, Essex IG10 4AA"
        },
        "safeguarding": {
          "notifyParentAccident": true,
          "notifyParentIncident": false,
          "notifyStaffAcknowledged": true,
          "requireAcknowledgement": false,
          "dslTitle": "Designated Safeguarding Lead (DSL)",
          "dslName": "Sarah Mitchell",
          "dslEmail": "sarah@sunshinecamps.co.uk",
          "contacts": {
            "nspccPhone": "0808 800 5000",
            "policePhone": "999 (emergency) / 101",
            "authorities": [
              {
                "id": "essex",
                "name": "Essex",
                "ladoName": "Essex LADO",
                "ladoPhone": "03330 139 797",
                "socialCarePhone": "0345 603 7627",
                "outOfHoursPhone": "0345 606 1212"
              },
              {
                "id": "redbridge",
                "name": "Redbridge",
                "ladoName": "Redbridge LADO",
                "ladoPhone": "020 8708 5350",
                "socialCarePhone": "020 8708 3885",
                "outOfHoursPhone": "020 8708 5897"
              }
            ],
            "extra": [
              {
                "label": "Ofsted concerns line",
                "phone": "0300 123 4666"
              }
            ]
          }
        }
      }
    },
    "/api/incidents": [
      {
        "id": "inc-1001",
        "kind": "incident",
        "date": "2026-08-10",
        "time": "14:20",
        "childName": "Oliver Bennett",
        "childId": "c-oliver",
        "location": "Loughton Manor — Main hall",
        "description": "Pushed another child during a game of dodgeball; both were upset but there was no injury. Separated and spoke with both boys, who were playing together again by home time.",
        "severity": "minor",
        "incidentType": "Rough play",
        "actionTaken": "Time to calm down; both children spoken to; reminded of the rules",
        "witnesses": "Tom Bradley (coach)",
        "shareWithParent": true,
        "parentNotified": true,
        "parentNotifiedAt": "2026-08-10T15:05:00Z",
        "parentNotifiedHow": "In person at pickup",
        "followUp": "Monitor at tomorrow's session",
        "recordedByName": "Tom Bradley",
        "acknowledgedAt": "2026-08-10T18:30:00Z",
        "acknowledgedBy": "Emma Bennett",
        "createdAt": "2026-08-10T15:04:00Z",
        "concernCategory": "Child-on-child abuse (bullying, harassment)",
        "subject": "child",
        "reportedTo": "Designated Safeguarding Lead (DSL) · Sarah Mitchell",
        "localAuthority": "Essex",
        "dslLog": [
          {
            "id": "c1",
            "key": "monitor",
            "label": "Manage internally — monitor & review",
            "note": "Low level; both children fine. Noted for pattern-watching.",
            "at": "2026-08-10T15:10:00Z",
            "by": "Sarah Mitchell",
            "done": true,
            "doneAt": "2026-08-10T15:10:00Z"
          }
        ],
        "notes": [
          {
            "by": "Tom Bradley",
            "role": "staff",
            "text": "Logged after the session; both boys fine and playing together again by home time.",
            "at": "2026-08-10T15:06:00Z"
          },
          {
            "by": "Emma Bennett",
            "role": "parent",
            "text": "Thanks for letting me know — I've had a chat with Oliver this evening.",
            "at": "2026-08-10T18:32:00Z"
          }
        ]
      },
      {
        "id": "inc-1002",
        "kind": "incident",
        "date": "2026-08-08",
        "time": "11:10",
        "childName": "Amelia Hughes",
        "childId": "c-amelia",
        "location": "Buckhurst Hill Primary — Playground",
        "description": "Became very upset and withdrawn after lunch and said she 'didn't want to go home'. Comforted and stayed with her keyworker for the afternoon.",
        "severity": "moderate",
        "incidentType": "Emotional / dysregulation",
        "actionTaken": "1:1 support; offered a quiet space; mum phoned",
        "witnesses": "Priya Shah",
        "shareWithParent": false,
        "parentNotified": true,
        "parentNotifiedAt": "2026-08-08T12:00:00Z",
        "parentNotifiedHow": "By phone",
        "followUp": "Check in with mum at the end of the week",
        "recordedByName": "Priya Shah",
        "createdAt": "2026-08-08T11:40:00Z",
        "concernCategory": "Welfare concern / early help",
        "subject": "child",
        "reportedTo": "Designated Safeguarding Lead (DSL) · Sarah Mitchell",
        "localAuthority": "Essex",
        "dslLog": [
          {
            "id": "d1",
            "key": "early-help",
            "label": "Early help assessment",
            "note": "Discussed with mum; agreed to start an early help conversation.",
            "reviewDate": "2026-08-22",
            "at": "2026-08-08T12:15:00Z",
            "by": "Sarah Mitchell",
            "done": false
          }
        ]
      },
      {
        "id": "inc-1003",
        "kind": "incident",
        "date": "2026-08-07",
        "time": "15:45",
        "childName": "Jack Thompson",
        "childId": "c-jack",
        "location": "Chigwell Sports Hall",
        "description": "Swore repeatedly at a coach after being asked to wait his turn and refused to rejoin the game. Calmed down after about ten minutes and apologised.",
        "severity": "minor",
        "incidentType": "Language / swearing",
        "actionTaken": "Reminded of expectations; short break; rejoined the activity",
        "shareWithParent": false,
        "parentNotified": false,
        "recordedByName": "Daniel O'Connor",
        "createdAt": "2026-08-07T16:00:00Z",
        "concernCategory": "Welfare concern / early help",
        "subject": "child",
        "reportedTo": "Designated Safeguarding Lead (DSL) · Sarah Mitchell",
        "localAuthority": "Essex"
      },
      {
        "id": "inc-1004",
        "kind": "incident",
        "date": "2026-08-05",
        "time": "10:30",
        "childName": "Isla Richardson",
        "childId": "c-isla",
        "location": "Epping Forest Centre — Forest School",
        "description": "Disclosed that an older sibling 'hits her' at home. Recorded her exact words; no leading questions were asked. Reassured her and kept her with a familiar adult.",
        "severity": "serious",
        "incidentType": "Other",
        "actionTaken": "Listened, reassured, recorded verbatim; did not question further",
        "shareWithParent": false,
        "parentNotified": false,
        "recordedByName": "Sarah Mitchell",
        "createdAt": "2026-08-05T10:55:00Z",
        "concernCategory": "Disclosure / allegation by a child",
        "subject": "child",
        "reportedTo": "Designated Safeguarding Lead (DSL) · Sarah Mitchell",
        "localAuthority": "Essex",
        "dslLog": [
          {
            "id": "a1",
            "key": "childrens-social-care",
            "label": "Refer to children's social care (MASH)",
            "note": "Called Essex MASH and gave a verbal referral; written referral to follow within 48h.",
            "reviewDate": "2026-08-12",
            "at": "2026-08-05T11:10:00Z",
            "by": "Sarah Mitchell",
            "done": false
          },
          {
            "id": "a2",
            "key": "inform-parents",
            "label": "Consult / inform parents or carers",
            "note": "Agreed with MASH not to inform the sibling's household yet.",
            "at": "2026-08-05T11:25:00Z",
            "by": "Sarah Mitchell",
            "done": true,
            "doneAt": "2026-08-05T11:25:00Z"
          }
        ]
      },
      {
        "id": "inc-1005",
        "kind": "incident",
        "date": "2026-08-04",
        "time": "13:15",
        "childName": "Harry Patel",
        "childId": "c-harry",
        "location": "Loughton Manor — Astro pitch",
        "description": "Fell during football and grazed his knee, then threw the ball at a peer in frustration afterwards. Knee cleaned and he was helped to calm down before rejoining.",
        "severity": "moderate",
        "injury": "Grazed knee",
        "incidentType": "Unsafe behaviour",
        "actionTaken": "First aid to the knee; talked through the frustration; rejoined",
        "firstAider": "Tom Bradley",
        "witnesses": "Two peers on the pitch",
        "shareWithParent": true,
        "parentNotified": true,
        "parentNotifiedAt": "2026-08-04T17:00:00Z",
        "parentNotifiedHow": "At pickup",
        "recordedByName": "Tom Bradley",
        "updatedAt": "2026-08-05T09:00:00Z",
        "createdAt": "2026-08-04T13:40:00Z",
        "attachments": [
          "/uploads/harry-knee-graze.jpg"
        ],
        "concernCategory": "Welfare concern / early help",
        "subject": "child",
        "reportedTo": "Designated Safeguarding Lead (DSL) · Sarah Mitchell",
        "localAuthority": "Essex",
        "bodyMap": [
          {
            "view": "front",
            "x": 45,
            "y": 78,
            "n": 1,
            "note": "Graze to right knee, cleaned"
          }
        ]
      },
      {
        "id": "inc-1006",
        "kind": "incident",
        "date": "2026-08-03",
        "time": "09:50",
        "childName": "Sophie Clarke",
        "childId": "c-sophie",
        "location": "Woodford Green Prep",
        "description": "Arrived with bruising on her upper arm and said 'I fell off my bike'. Observation recorded factually and a body map completed; DSL informed.",
        "severity": "serious",
        "incidentType": "Other",
        "actionTaken": "Recorded observation; body map completed; DSL informed",
        "shareWithParent": false,
        "parentNotified": false,
        "recordedByName": "Sarah Mitchell",
        "updatedAt": "2026-08-03T16:45:00Z",
        "createdAt": "2026-08-03T10:00:00Z",
        "attachments": [
          "/uploads/sophie-arm-1.jpg",
          "/uploads/sophie-arm-2.jpg"
        ],
        "concernCategory": "Physical abuse",
        "subject": "child",
        "reportedTo": "Designated Safeguarding Lead (DSL) · Sarah Mitchell",
        "localAuthority": "Essex",
        "bodyMap": [
          {
            "view": "front",
            "x": 32,
            "y": 38,
            "n": 1,
            "note": "Bruise ~3cm, upper right arm"
          },
          {
            "view": "back",
            "x": 60,
            "y": 30,
            "n": 2,
            "note": "Faint mark, left shoulder blade"
          }
        ],
        "dslLog": [
          {
            "id": "b1",
            "key": "monitor",
            "label": "Manage internally — monitor & review",
            "note": "No threshold met yet; body map recorded, will watch for further marks.",
            "reviewDate": "2026-08-17",
            "at": "2026-08-03T10:05:00Z",
            "by": "Sarah Mitchell",
            "done": false
          },
          {
            "id": "b2",
            "key": "inform-parents",
            "label": "Consult / inform parents or carers",
            "note": "Mentioned the mark to mum at pickup; she confirmed the bike fall.",
            "at": "2026-08-03T16:40:00Z",
            "by": "Sarah Mitchell",
            "done": true,
            "doneAt": "2026-08-03T16:40:00Z"
          }
        ]
      },
      {
        "id": "inc-1007",
        "kind": "incident",
        "date": "2026-07-30",
        "time": "14:00",
        "childName": "Freddie Morgan",
        "childId": "c-freddie",
        "location": "Chigwell Sports Hall",
        "description": "Repeatedly excluded another child from the team and made unkind comments about their kit. Talked through kindness with the group and reshuffled the teams.",
        "severity": "minor",
        "incidentType": "Bullying / unkindness",
        "actionTaken": "Discussed kindness; both children supported; group reshuffled",
        "witnesses": "Priya Shah",
        "shareWithParent": true,
        "parentNotified": true,
        "parentNotifiedAt": "2026-07-30T17:30:00Z",
        "parentNotifiedHow": "By phone",
        "recordedByName": "Priya Shah",
        "createdAt": "2026-07-30T14:15:00Z",
        "concernCategory": "Child-on-child abuse (bullying, harassment)",
        "subject": "child",
        "reportedTo": "Designated Safeguarding Lead (DSL) · Sarah Mitchell",
        "localAuthority": "Essex",
        "dslLog": [
          {
            "id": "e1",
            "key": "monitor",
            "label": "Manage internally — monitor & review",
            "at": "2026-07-30T14:25:00Z",
            "by": "Sarah Mitchell",
            "done": true,
            "doneAt": "2026-07-30T14:25:00Z"
          }
        ],
        "notes": [
          {
            "by": "Priya Shah",
            "role": "staff",
            "text": "Reshuffled the teams so everyone gets a turn — kept a closer eye for the rest of the session.",
            "at": "2026-07-30T14:20:00Z"
          },
          {
            "by": "Laura Morgan",
            "role": "parent",
            "text": "Appreciate you dealing with it. We'll have a talk with Freddie too.",
            "at": "2026-07-30T19:10:00Z"
          }
        ]
      },
      {
        "id": "inc-1008",
        "kind": "incident",
        "date": "2026-07-28",
        "time": "12:30",
        "childName": "Grace Walker",
        "childId": "c-grace",
        "location": "Buckhurst Hill Primary",
        "description": "Mentioned she hadn't had breakfast 'again' and seemed very hungry at lunch. Gave her a snack and noted the comment.",
        "severity": "moderate",
        "incidentType": "Other",
        "actionTaken": "Provided food; noted the pattern; will monitor",
        "shareWithParent": false,
        "parentNotified": false,
        "followUp": "Watch for a repeat; start an early-help conversation if it continues",
        "recordedByName": "Daniel O'Connor",
        "createdAt": "2026-07-28T12:45:00Z",
        "concernCategory": "Neglect",
        "subject": "child",
        "reportedTo": "Designated Safeguarding Lead (DSL) · Sarah Mitchell",
        "localAuthority": "Essex"
      },
      {
        "id": "inc-1009",
        "kind": "incident",
        "date": "2026-07-24",
        "time": "15:30",
        "childName": "Noah Edwards",
        "childId": "c-noah",
        "location": "Epping Forest Centre",
        "description": "Showed another child an inappropriate video on his phone during break. Phone was taken and stored, and we had an online-safety chat with the group.",
        "severity": "moderate",
        "incidentType": "Online / device",
        "actionTaken": "Device removed and stored; parents to collect; online-safety chat delivered",
        "witnesses": "Tom Bradley",
        "shareWithParent": true,
        "parentNotified": true,
        "parentNotifiedAt": "2026-07-24T16:10:00Z",
        "parentNotifiedHow": "By phone",
        "recordedByName": "Tom Bradley",
        "acknowledgedAt": "2026-07-24T19:00:00Z",
        "acknowledgedBy": "Rachel Edwards",
        "createdAt": "2026-07-24T15:50:00Z",
        "attachments": [
          "/uploads/noah-device-note.jpg"
        ],
        "concernCategory": "Online / digital harm",
        "subject": "child",
        "reportedTo": "Designated Safeguarding Lead (DSL) · Sarah Mitchell",
        "localAuthority": "Redbridge",
        "dslLog": [
          {
            "id": "f1",
            "key": "monitor",
            "label": "Manage internally — monitor & review",
            "note": "Online-safety chat done; parents collected the phone.",
            "at": "2026-07-24T15:45:00Z",
            "by": "Sarah Mitchell",
            "done": true,
            "doneAt": "2026-07-24T15:45:00Z"
          },
          {
            "id": "f2",
            "key": "inform-parents",
            "label": "Consult / inform parents or carers",
            "at": "2026-07-24T16:00:00Z",
            "by": "Sarah Mitchell",
            "done": true,
            "doneAt": "2026-07-24T16:00:00Z"
          }
        ],
        "notes": [
          {
            "by": "Rachel Edwards",
            "role": "parent",
            "text": "So sorry — we've spoken to Noah about what's appropriate and removed the app.",
            "at": "2026-07-24T19:05:00Z"
          }
        ]
      },
      {
        "id": "inc-1010",
        "kind": "incident",
        "date": "2026-07-22",
        "time": "10:15",
        "childName": "Ava Robinson",
        "childId": "c-ava",
        "location": "Loughton Manor — Main hall",
        "description": "Bit another child on the hand during a squabble over toys; the skin was not broken. Both children were comforted and the hand was checked.",
        "severity": "minor",
        "incidentType": "Physical",
        "actionTaken": "Both children comforted; first aider checked the hand; parents told at pickup",
        "firstAider": "Priya Shah",
        "shareWithParent": true,
        "parentNotified": true,
        "parentNotifiedAt": "2026-07-22T16:30:00Z",
        "parentNotifiedHow": "At pickup",
        "recordedByName": "Priya Shah",
        "createdAt": "2026-07-22T10:30:00Z",
        "concernCategory": "Child-on-child abuse (bullying, harassment)",
        "subject": "child",
        "reportedTo": "Designated Safeguarding Lead (DSL) · Sarah Mitchell",
        "localAuthority": "Essex"
      },
      {
        "id": "inc-1011",
        "kind": "incident",
        "date": "2026-07-18",
        "time": "16:20",
        "childName": "Mark Reynolds (Coach)",
        "location": "Chigwell Sports Hall",
        "description": "A parent raised that a coach used a raised voice and firmly grabbed a child's arm to move them. Account recorded; the coach is not on shift pending review.",
        "severity": "serious",
        "incidentType": "Other",
        "actionTaken": "Coach stood down pending review; LADO to be consulted the same working day",
        "witnesses": "Parent (reporting) and one assistant",
        "shareWithParent": false,
        "parentNotified": false,
        "recordedByName": "Sarah Mitchell",
        "createdAt": "2026-07-18T16:40:00Z",
        "concernCategory": "Allegation against a member of staff / volunteer",
        "subject": "staff",
        "reportedTo": "Designated Safeguarding Lead (DSL) · Sarah Mitchell",
        "localAuthority": "Essex",
        "dslLog": [
          {
            "id": "g1",
            "key": "lado",
            "label": "Refer to the LADO",
            "note": "Rang the Essex LADO within one working day; advice logged, coach remains stood down.",
            "reviewDate": "2026-07-21",
            "at": "2026-07-18T16:45:00Z",
            "by": "Sarah Mitchell",
            "done": true,
            "doneAt": "2026-07-21T09:30:00Z"
          },
          {
            "id": "g2",
            "key": "inform-parents",
            "label": "Consult / inform parents or carers",
            "note": "Kept the reporting parent updated on the process.",
            "at": "2026-07-18T17:30:00Z",
            "by": "Sarah Mitchell",
            "done": true,
            "doneAt": "2026-07-18T17:30:00Z"
          }
        ]
      }
    ]
  },
  "moments": {
    "/api/me": {
      "role": "freelancer"
    },
    "/api/library": null,
    "/api/listings": [
      {
        "id": "l-multisports",
        "title": "Summer Multi-Sports Camp"
      },
      {
        "id": "l-football",
        "title": "Football Academy Week"
      },
      {
        "id": "l-forest",
        "title": "Forest School Adventure"
      },
      {
        "id": "l-gymnastics",
        "title": "Gymnastics Holiday Camp"
      },
      {
        "id": "l-drama",
        "title": "Stage & Drama Camp"
      },
      {
        "id": "l-swim",
        "title": "Swim & Splash Week"
      },
      {
        "id": "l-science",
        "title": "Mini Scientists Camp"
      }
    ],
    "/api/moments/taggable": [
      {
        "childId": "c1",
        "name": "Olivia Bennett",
        "photoConsent": true,
        "parentName": "Sarah Bennett",
        "email": "sarah.bennett@gmail.com",
        "listing": "Summer Multi-Sports Camp",
        "postcode": "GU1 4AP"
      },
      {
        "childId": "c2",
        "name": "Jack Thompson",
        "photoConsent": true,
        "parentName": "Laura Thompson",
        "email": "laura.t@outlook.com",
        "listing": "Football Academy Week",
        "postcode": "GU2 7XH"
      },
      {
        "childId": "c3",
        "name": "Amelia Clarke",
        "photoConsent": false,
        "parentName": "Emma Clarke",
        "email": "emma.clarke@gmail.com",
        "listing": "Forest School Adventure",
        "postcode": "GU1 2RT"
      },
      {
        "childId": "c4",
        "name": "Harry Wilson",
        "photoConsent": true,
        "parentName": "James Wilson",
        "email": "j.wilson@yahoo.co.uk",
        "listing": "Summer Multi-Sports Camp",
        "postcode": "GU7 1DB"
      },
      {
        "childId": "c5",
        "name": "Sophie Turner",
        "photoConsent": true,
        "parentName": "Rachel Turner",
        "email": "rachel.turner@gmail.com",
        "listing": "Gymnastics Holiday Camp",
        "postcode": "GU4 8PN"
      },
      {
        "childId": "c6",
        "name": "Charlie Evans",
        "photoConsent": false,
        "parentName": "Daniel Evans",
        "email": "dan.evans@hotmail.com",
        "listing": "Football Academy Week",
        "postcode": "GU3 3LM"
      },
      {
        "childId": "c7",
        "name": "Isla Robinson",
        "photoConsent": true,
        "parentName": "Hannah Robinson",
        "email": "hannah.r@gmail.com",
        "listing": "Forest School Adventure",
        "postcode": "GU1 1AA"
      },
      {
        "childId": "c8",
        "name": "George Walker",
        "photoConsent": true,
        "parentName": "Michael Walker",
        "email": "m.walker@gmail.com",
        "listing": "Swim & Splash Week",
        "postcode": "GU5 9QP"
      },
      {
        "childId": "c9",
        "name": "Freya Hughes",
        "photoConsent": true,
        "parentName": "Katie Hughes",
        "email": "katie.hughes@gmail.com",
        "listing": "Stage & Drama Camp",
        "postcode": "GU2 4BW"
      },
      {
        "childId": "c10",
        "name": "Noah Patel",
        "photoConsent": true,
        "parentName": "Priya Patel",
        "email": "priya.patel@gmail.com",
        "listing": "Mini Scientists Camp",
        "postcode": "GU7 2SR"
      },
      {
        "childId": "c11",
        "name": "Ruby Morgan",
        "photoConsent": true,
        "parentName": "Chloe Morgan",
        "email": "chloe.morgan@gmail.com",
        "listing": "Gymnastics Holiday Camp",
        "postcode": "GU1 3EF"
      },
      {
        "childId": "c12",
        "name": "Leo Cooper",
        "photoConsent": false,
        "parentName": "Sam Cooper",
        "email": "sam.cooper@gmail.com",
        "listing": "Summer Multi-Sports Camp",
        "postcode": "GU4 7HG"
      }
    ],
    "/api/moments": [
      {
        "id": "m1",
        "photoUrl": "https://picsum.photos/seed/moment-football-1/900/900",
        "caption": "Jack had a fantastic time on the field today, scoring goals in our mini tournament and came back beaming!",
        "activity": "Sports",
        "photoType": "child",
        "date": "2026-08-11",
        "listingId": "l-football",
        "childIds": [
          "c2",
          "c4"
        ],
        "childNames": [
          "Jack Thompson",
          "Harry Wilson"
        ],
        "postedByName": "Coach Danny",
        "createdAt": "2026-08-11T10:42:00.000Z",
        "comments": [
          {
            "by": "p-laura",
            "byName": "Laura Thompson",
            "role": "parent",
            "text": "He hasn't stopped talking about his hat-trick! Thank you so much.",
            "at": "2026-08-11T16:05:00.000Z",
            "marketing": true
          },
          {
            "by": "s-danny",
            "byName": "Coach Danny",
            "role": "staff",
            "text": "He was brilliant Laura — a real team player today.",
            "at": "2026-08-11T16:20:00.000Z"
          }
        ]
      },
      {
        "id": "m2",
        "photoUrl": "https://picsum.photos/seed/moment-art-2/900/900",
        "caption": "Olivia spent the morning being really creative, painting a picture to bring home. A really lovely day all round.",
        "activity": "Arts & crafts",
        "photoType": "child",
        "date": "2026-08-11",
        "listingId": "l-multisports",
        "childIds": [
          "c1"
        ],
        "childNames": [
          "Olivia Bennett"
        ],
        "postedByName": "Miss Priya",
        "createdAt": "2026-08-11T11:15:00.000Z",
        "comments": [
          {
            "by": "p-sarah",
            "byName": "Sarah Bennett",
            "role": "parent",
            "text": "This is going straight on the fridge. She's so proud of it!",
            "at": "2026-08-11T17:30:00.000Z",
            "marketing": true
          }
        ]
      },
      {
        "id": "m3",
        "photoUrl": "https://picsum.photos/seed/moment-forestwork-3/900/900",
        "caption": "The children built the most incredible den in the woodland this afternoon — proper teamwork.",
        "activity": "Outdoors",
        "photoType": "work",
        "date": "2026-08-11",
        "listingId": "l-forest",
        "childIds": [
          "c3",
          "c7"
        ],
        "childNames": [
          "Amelia Clarke",
          "Isla Robinson"
        ],
        "postedByName": "Ranger Tom",
        "createdAt": "2026-08-11T14:05:00.000Z",
        "comments": []
      },
      {
        "id": "m4",
        "photoUrl": "https://picsum.photos/seed/moment-gym-4/900/900",
        "caption": "Sophie grew in confidence on the beam today and nailed her cartwheel — such a happy afternoon!",
        "activity": "Free play",
        "photoType": "child",
        "date": "2026-08-10",
        "listingId": "l-gymnastics",
        "childIds": [
          "c5",
          "c11"
        ],
        "childNames": [
          "Sophie Turner",
          "Ruby Morgan"
        ],
        "postedByName": "Miss Rachel",
        "createdAt": "2026-08-10T13:20:00.000Z",
        "comments": [
          {
            "by": "p-rachel",
            "byName": "Rachel Turner",
            "role": "parent",
            "text": "She showed me her cartwheel three times when she got home. Amazing progress!",
            "at": "2026-08-10T18:10:00.000Z"
          },
          {
            "by": "p-chloe",
            "byName": "Chloe Morgan",
            "role": "parent",
            "text": "Ruby loved every second, thank you team.",
            "at": "2026-08-10T19:02:00.000Z",
            "marketing": true
          }
        ]
      },
      {
        "id": "m5",
        "photoUrl": "https://picsum.photos/seed/moment-science-5/900/900",
        "caption": "Noah was a brilliant little scientist today, making a fizzy volcano experiment and was so proud!",
        "activity": "Science",
        "photoType": "child",
        "date": "2026-08-10",
        "listingId": "l-science",
        "childIds": [
          "c10"
        ],
        "childNames": [
          "Noah Patel"
        ],
        "postedByName": "Dr Amina",
        "createdAt": "2026-08-10T15:40:00.000Z",
        "comments": [
          {
            "by": "p-priya",
            "byName": "Priya Patel",
            "role": "parent",
            "text": "He wants to do the volcano again at home now! So engaged.",
            "at": "2026-08-10T20:15:00.000Z"
          }
        ]
      },
      {
        "id": "m6",
        "photoUrl": "https://picsum.photos/seed/moment-lunch-6/900/900",
        "caption": "Snack time was a hit for the whole group — everyone tried the fruit skewers.",
        "activity": "Lunch & snack",
        "photoType": "child",
        "date": "2026-08-10",
        "listingId": "l-multisports",
        "childIds": [
          "c1",
          "c4",
          "c12"
        ],
        "childNames": [
          "Olivia Bennett",
          "Harry Wilson",
          "Leo Cooper"
        ],
        "postedByName": "Miss Priya",
        "createdAt": "2026-08-10T12:05:00.000Z",
        "comments": []
      },
      {
        "id": "m7",
        "photoUrl": "https://picsum.photos/seed/moment-drama-7/900/900",
        "caption": "Freya shone in drama today, performing in our end of day show — a real highlight of the day.",
        "activity": "Drama",
        "photoType": "child",
        "date": "2026-08-07",
        "listingId": "l-drama",
        "childIds": [
          "c9"
        ],
        "childNames": [
          "Freya Hughes"
        ],
        "postedByName": "Mr Oliver",
        "createdAt": "2026-08-07T15:55:00.000Z",
        "comments": [
          {
            "by": "p-katie",
            "byName": "Katie Hughes",
            "role": "parent",
            "text": "We came to watch and she was the star of the show. Wonderful week.",
            "at": "2026-08-07T18:40:00.000Z",
            "marketing": true
          },
          {
            "by": "s-oliver",
            "byName": "Mr Oliver",
            "role": "staff",
            "text": "A natural performer — hope to see her back next holidays!",
            "at": "2026-08-07T19:00:00.000Z"
          }
        ]
      },
      {
        "id": "m8",
        "photoUrl": "https://picsum.photos/seed/moment-swim-8/900/900",
        "caption": "George did brilliantly in the pool today, swimming widths with the floats. Such a happy afternoon!",
        "activity": "Swimming",
        "photoType": "child",
        "date": "2026-08-06",
        "listingId": "l-swim",
        "childIds": [
          "c8"
        ],
        "childNames": [
          "George Walker"
        ],
        "postedByName": "Coach Beth",
        "createdAt": "2026-08-06T11:30:00.000Z",
        "comments": [
          {
            "by": "p-michael",
            "byName": "Michael Walker",
            "role": "parent",
            "text": "First time swimming a full width! Over the moon.",
            "at": "2026-08-06T17:20:00.000Z"
          }
        ]
      },
      {
        "id": "m9",
        "photoUrl": "https://picsum.photos/seed/moment-footballwork-9/900/900",
        "caption": "The squad designed their own team crests before kick-off — brilliant imaginations on display.",
        "activity": "Arts & crafts",
        "photoType": "work",
        "date": "2026-08-05",
        "listingId": "l-football",
        "childIds": [
          "c2",
          "c6"
        ],
        "childNames": [
          "Jack Thompson",
          "Charlie Evans"
        ],
        "postedByName": "Coach Danny",
        "createdAt": "2026-08-05T10:10:00.000Z",
        "comments": []
      },
      {
        "id": "m10",
        "photoUrl": "https://picsum.photos/seed/moment-forest-10/900/900",
        "caption": "Isla loved hunting for bugs and minibeasts today and came back beaming!",
        "activity": "Outdoors",
        "photoType": "child",
        "date": "2026-08-04",
        "listingId": "l-forest",
        "childIds": [
          "c7"
        ],
        "childNames": [
          "Isla Robinson"
        ],
        "postedByName": "Ranger Tom",
        "createdAt": "2026-08-04T14:25:00.000Z",
        "comments": [
          {
            "by": "p-hannah",
            "byName": "Hannah Robinson",
            "role": "parent",
            "text": "She found a stag beetle and told the whole family about it at dinner!",
            "at": "2026-08-04T19:30:00.000Z",
            "marketing": true
          }
        ]
      },
      {
        "id": "m11",
        "photoUrl": "https://picsum.photos/seed/moment-multisport-11/900/900",
        "caption": "Great team spirit from Harry today, racing in the relay games. A really lovely day all round.",
        "activity": "Sports",
        "photoType": "child",
        "date": "2026-07-31",
        "listingId": "l-multisports",
        "childIds": [
          "c4"
        ],
        "childNames": [
          "Harry Wilson"
        ],
        "postedByName": "Miss Priya",
        "createdAt": "2026-07-31T13:50:00.000Z",
        "comments": []
      },
      {
        "id": "m12",
        "photoUrl": "https://picsum.photos/seed/moment-gymwork-12/900/900",
        "caption": "Ruby and the group made their own medals ready for our end-of-week showcase.",
        "activity": "Arts & crafts",
        "photoType": "work",
        "date": "2026-07-30",
        "listingId": "l-gymnastics",
        "childIds": [
          "c11",
          "c5"
        ],
        "childNames": [
          "Ruby Morgan",
          "Sophie Turner"
        ],
        "postedByName": "Miss Rachel",
        "createdAt": "2026-07-30T11:00:00.000Z",
        "comments": [
          {
            "by": "p-chloe",
            "byName": "Chloe Morgan",
            "role": "parent",
            "text": "The medal is now hanging on her bedroom door. So sweet!",
            "at": "2026-07-30T18:45:00.000Z"
          }
        ]
      },
      {
        "id": "m13",
        "photoUrl": "https://picsum.photos/seed/moment-play-13/900/900",
        "caption": "Lots of giggles from Charlie today, building an amazing fort and making lovely new friends.",
        "activity": "Free play",
        "photoType": "work",
        "date": "2026-07-29",
        "listingId": "l-football",
        "childIds": [
          "c6"
        ],
        "childNames": [
          "Charlie Evans"
        ],
        "postedByName": "Coach Danny",
        "createdAt": "2026-07-29T14:40:00.000Z",
        "comments": []
      },
      {
        "id": "m14",
        "photoUrl": "https://picsum.photos/seed/moment-swim-14/900/900",
        "caption": "A lovely outdoor adventure for the whole group — pond dipping and bird spotting in the sunshine.",
        "activity": "Outdoors",
        "photoType": "child",
        "date": "2026-07-28",
        "listingId": "l-forest",
        "childIds": [
          "c7",
          "c3"
        ],
        "childNames": [
          "Isla Robinson",
          "Amelia Clarke"
        ],
        "postedByName": "Ranger Tom",
        "createdAt": "2026-07-28T15:10:00.000Z",
        "comments": [
          {
            "by": "p-hannah",
            "byName": "Hannah Robinson",
            "role": "parent",
            "text": "These weekly photos make my day, thank you for sharing them.",
            "at": "2026-07-28T20:00:00.000Z",
            "marketing": true
          }
        ]
      }
    ]
  },
  "documents": {
    "/api/me": {
      "role": "freelancer"
    },
    "/api/documents": [
      {
        "id": "doc_001",
        "title": "Child Protection & Safeguarding Policy 2026",
        "category": "Policies",
        "url": "https://files.activityos.uk/docs/safeguarding-policy-2026.pdf",
        "fileType": "application/pdf",
        "notes": "Reviewed annually — next review Apr 2027",
        "uploadedByName": "Rachael Gilbert",
        "createdAt": "2026-04-12T09:15:00.000Z"
      },
      {
        "id": "doc_002",
        "title": "Health & Safety Policy",
        "category": "Policies",
        "url": "https://files.activityos.uk/docs/health-safety-policy.pdf",
        "fileType": "application/pdf",
        "notes": "Signed off by lead",
        "uploadedByName": "Rachael Gilbert",
        "createdAt": "2026-03-02T11:40:00.000Z"
      },
      {
        "id": "doc_003",
        "title": "Behaviour Management Policy",
        "category": "Policies",
        "url": "https://files.activityos.uk/docs/behaviour-management.pdf",
        "fileType": "application/pdf",
        "uploadedByName": "Rachael Gilbert",
        "createdAt": "2026-02-18T14:05:00.000Z"
      },
      {
        "id": "doc_004",
        "title": "Multi-Sports Camp — Site Risk Assessment (Treehouse)",
        "category": "Risk assessments",
        "url": "https://files.activityos.uk/docs/ra-treehouse-multisports.pdf",
        "fileType": "application/pdf",
        "notes": "Valid for Summer 2026 term",
        "uploadedByName": "Tom Fletcher",
        "createdAt": "2026-07-01T08:30:00.000Z"
      },
      {
        "id": "doc_005",
        "title": "Forest School Activity Risk Assessment",
        "category": "Risk assessments",
        "url": "https://files.activityos.uk/docs/ra-forest-school.pdf",
        "fileType": "application/pdf",
        "notes": "Includes fire-pit and tool-use controls",
        "uploadedByName": "Tom Fletcher",
        "createdAt": "2026-06-20T10:12:00.000Z"
      },
      {
        "id": "doc_006",
        "title": "Off-Site Trip Risk Assessment — Woburn Safari",
        "category": "Risk assessments",
        "url": "https://files.activityos.uk/docs/ra-trip-woburn.pdf",
        "fileType": "application/pdf",
        "uploadedByName": "Tom Fletcher",
        "createdAt": "2026-07-28T16:45:00.000Z"
      },
      {
        "id": "doc_007",
        "title": "Public Liability Insurance Certificate 2026/27",
        "category": "Insurance",
        "url": "https://files.activityos.uk/docs/public-liability-2026.pdf",
        "fileType": "application/pdf",
        "notes": "£10m cover — expires 31 Mar 2027",
        "uploadedByName": "Rachael Gilbert",
        "createdAt": "2026-04-01T09:00:00.000Z"
      },
      {
        "id": "doc_008",
        "title": "Employers' Liability Insurance Certificate",
        "category": "Insurance",
        "url": "https://files.activityos.uk/docs/employers-liability-2026.pdf",
        "fileType": "application/pdf",
        "notes": "Displayed at all venues",
        "uploadedByName": "Rachael Gilbert",
        "createdAt": "2026-04-01T09:05:00.000Z"
      },
      {
        "id": "doc_009",
        "title": "Paediatric First Aid Certificate — Sarah Whitmore",
        "category": "Certificates",
        "url": "https://files.activityos.uk/docs/pfa-sarah-whitmore.pdf",
        "fileType": "application/pdf",
        "notes": "3-year — expires Sep 2027",
        "uploadedByName": "Sarah Whitmore",
        "createdAt": "2026-05-14T13:20:00.000Z"
      },
      {
        "id": "doc_010",
        "title": "Enhanced DBS Certificate — James Okoro",
        "category": "Certificates",
        "url": "https://files.activityos.uk/docs/dbs-james-okoro.pdf",
        "fileType": "application/pdf",
        "notes": "On the update service",
        "uploadedByName": "James Okoro",
        "createdAt": "2026-06-05T15:30:00.000Z"
      },
      {
        "id": "doc_011",
        "title": "Level 3 Coaching Award — Priya Patel",
        "category": "Certificates",
        "url": "https://files.activityos.uk/docs/coaching-l3-priya-patel.jpg",
        "fileType": "image/jpeg",
        "uploadedByName": "Priya Patel",
        "createdAt": "2026-01-22T10:00:00.000Z"
      },
      {
        "id": "doc_012",
        "title": "Fire Evacuation Procedure — Wolverton Hall",
        "category": "Procedures",
        "url": "https://files.activityos.uk/docs/fire-evac-wolverton.pdf",
        "fileType": "application/pdf",
        "notes": "Muster point: main car park",
        "uploadedByName": "Tom Fletcher",
        "createdAt": "2026-07-10T08:00:00.000Z"
      },
      {
        "id": "doc_013",
        "title": "Medication Administration Procedure",
        "category": "Procedures",
        "url": "https://files.activityos.uk/docs/medication-procedure.pdf",
        "fileType": "application/pdf",
        "uploadedByName": "Sarah Whitmore",
        "createdAt": "2026-05-30T12:15:00.000Z"
      },
      {
        "id": "doc_014",
        "title": "Parent Handbook — Summer 2026",
        "category": "Other",
        "url": "https://files.activityos.uk/docs/parent-handbook-summer-2026.pdf",
        "fileType": "application/pdf",
        "notes": "Sent to all booked families",
        "uploadedByName": "Rachael Gilbert",
        "createdAt": "2026-06-28T09:45:00.000Z"
      },
      {
        "id": "doc_015",
        "title": "Staff Code of Conduct",
        "category": "Other",
        "url": "https://files.activityos.uk/docs/staff-code-of-conduct.pdf",
        "fileType": "application/pdf",
        "uploadedByName": "Rachael Gilbert",
        "createdAt": "2026-03-15T11:00:00.000Z"
      }
    ]
  },
  "expenses": {
    "/api/library": {
      "settings": {
        "money": {
          "basis": "cash",
          "usePurchaseOrders": false
        },
        "expenses": {
          "categories": [
            "First aid"
          ],
          "includeSubscription": false
        }
      },
      "childQuestions": []
    },
    "/api/subscription": {
      "current": {
        "plan": "pro",
        "since": "2025-09-01T00:00:00.000Z",
        "details": {
          "name": "Pro",
          "price": 29,
          "cadence": "monthly"
        }
      }
    },
    "/api/suppliers": [
      {
        "id": "sup-oakfield",
        "name": "Oakfield Leisure Centre",
        "email": "hire@oakfieldleisure.co.uk",
        "phone": "01908 552210",
        "address": "Oakfield Rd, Milton Keynes MK6 5LA",
        "notes": "Sports hall + astro pitch, weekday day-rate"
      },
      {
        "id": "sup-aim",
        "name": "Activities Industry Mutual",
        "email": "cover@aimutual.co.uk",
        "phone": "0345 872 5230",
        "address": "Alexandra House, Loughborough LE11 5GD",
        "notes": "Public liability + activity cover, monthly direct debit"
      },
      {
        "id": "sup-bakerross",
        "name": "Baker Ross",
        "email": "orders@bakerross.co.uk",
        "phone": "0844 576 8901",
        "address": "2 Cromwell Business Centre, Romford RM7 0AN",
        "notes": "Craft supplies for Forest School week"
      },
      {
        "id": "sup-decathlon",
        "name": "Decathlon",
        "email": "",
        "phone": "020 3603 6900",
        "address": "Canada Water, London SE16 7EF",
        "notes": "Football kit + bibs"
      },
      {
        "id": "sup-stjohn",
        "name": "St John Ambulance",
        "email": "training@sja.org.uk",
        "phone": "0344 770 4800",
        "address": "27 St John's Lane, London EC1M 4NI",
        "notes": "Paediatric first aid certification"
      },
      {
        "id": "sup-newportpagnell",
        "name": "Newport Pagnell Hall",
        "email": "bookings@nphall.org.uk",
        "phone": "01908 611777",
        "address": "Silver St, Newport Pagnell MK16 0EG",
        "notes": "Wet-weather backup venue"
      }
    ],
    "/api/expenses": {
      "summary": {
        "total": 3647.05,
        "count": 18,
        "byCategory": {
          "Equipment": 557.4,
          "Venue hire": 1320,
          "Staff": 752,
          "Insurance": 289.5,
          "Marketing": 178,
          "Travel": 64.3,
          "Supplies": 232.65,
          "Software": 29,
          "Training": 150,
          "Utilities": 74.2
        }
      },
      "items": [
        {
          "id": "exp-201",
          "date": "2026-08-05",
          "category": "Equipment",
          "amount": 245,
          "supplier": "Sports Direct",
          "notes": "Cones, bibs & size-4 footballs for Multi-Sports week",
          "status": "paid",
          "paidAt": "2026-08-05T09:12:00.000Z",
          "receiptUrl": "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='120'%20height='120'%3E%3Crect%20width='120'%20height='120'%20fill='%23eaf0fc'/%3E%3Ctext%20x='60'%20y='58'%20font-size='13'%20text-anchor='middle'%20fill='%231d3a8f'%3ESports%20Direct%3C/text%3E%3Ctext%20x='60'%20y='76'%20font-size='12'%20text-anchor='middle'%20fill='%234a4763'%3E£245.00%3C/text%3E%3C/svg%3E",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-202",
          "date": "2026-08-03",
          "category": "Venue hire",
          "amount": 480,
          "supplier": "Oakfield Leisure Centre",
          "notes": "Sports hall — Summer Holiday Camp wk 5",
          "status": "paid",
          "paidAt": "2026-08-03T08:00:00.000Z",
          "receiptUrl": "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='120'%20height='120'%3E%3Crect%20width='120'%20height='120'%20fill='%23ece9fd'/%3E%3Ctext%20x='60'%20y='58'%20font-size='12'%20text-anchor='middle'%20fill='%234b3bc9'%3EOakfield%3C/text%3E%3Ctext%20x='60'%20y='76'%20font-size='12'%20text-anchor='middle'%20fill='%234a4763'%3E£480.00%3C/text%3E%3C/svg%3E",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-203",
          "date": "2026-08-07",
          "category": "Staff",
          "amount": 620,
          "supplier": "Rachael Gilbert",
          "notes": "Camp lead wages — August week 1",
          "status": "pending",
          "dueDate": "2026-08-20",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-204",
          "date": "2026-08-01",
          "category": "Insurance",
          "amount": 96.5,
          "supplier": "Activities Industry Mutual",
          "notes": "Public liability & activity cover",
          "status": "paid",
          "paidAt": "2026-08-01T06:30:00.000Z",
          "repeat": "monthly",
          "repeatUntil": "2027-03-01",
          "seriesId": "series-insurance",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-205",
          "date": "2026-07-28",
          "category": "Marketing",
          "amount": 120,
          "supplier": "Meta Ads",
          "notes": "Facebook/Instagram promo — Summer camp enrolment",
          "status": "paid",
          "paidAt": "2026-07-28T14:20:00.000Z",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-206",
          "date": "2026-07-22",
          "category": "Travel",
          "amount": 64.3,
          "supplier": "BP",
          "notes": "Fuel — minibus, Forest School day trips",
          "status": "paid",
          "paidAt": "2026-07-22T17:05:00.000Z",
          "receiptUrl": "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='120'%20height='120'%3E%3Crect%20width='120'%20height='120'%20fill='%23fbeede'/%3E%3Ctext%20x='60'%20y='58'%20font-size='14'%20text-anchor='middle'%20fill='%23a9660a'%3EBP%20Fuel%3C/text%3E%3Ctext%20x='60'%20y='76'%20font-size='12'%20text-anchor='middle'%20fill='%234a4763'%3E£64.30%3C/text%3E%3C/svg%3E",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-207",
          "date": "2026-07-15",
          "category": "Supplies",
          "amount": 88.75,
          "supplier": "Baker Ross",
          "notes": "Craft packs & lanyards — Gymnastics & Craft week",
          "status": "paid",
          "paidAt": "2026-07-15T11:40:00.000Z",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-208",
          "date": "2026-07-02",
          "category": "Software",
          "amount": 29,
          "supplier": "ActivityOS",
          "notes": "Pro plan subscription — July",
          "status": "paid",
          "paidAt": "2026-07-02T00:05:00.000Z",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-209",
          "date": "2026-07-01",
          "category": "Insurance",
          "amount": 96.5,
          "supplier": "Activities Industry Mutual",
          "notes": "Public liability & activity cover",
          "status": "paid",
          "paidAt": "2026-07-01T06:30:00.000Z",
          "repeat": "monthly",
          "repeatUntil": "2027-03-01",
          "seriesId": "series-insurance",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-210",
          "date": "2026-06-18",
          "category": "Venue hire",
          "amount": 360,
          "supplier": "Newport Pagnell Hall",
          "notes": "Wet-weather backup — Football Camp",
          "status": "paid",
          "paidAt": "2026-06-18T09:00:00.000Z",
          "receiptUrl": "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='120'%20height='120'%3E%3Crect%20width='120'%20height='120'%20fill='%23f6e9fb'/%3E%3Ctext%20x='60'%20y='58'%20font-size='11'%20text-anchor='middle'%20fill='%238a2fb0'%3ENP%20Hall%3C/text%3E%3Ctext%20x='60'%20y='76'%20font-size='12'%20text-anchor='middle'%20fill='%234a4763'%3E£360.00%3C/text%3E%3C/svg%3E",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-211",
          "date": "2026-06-10",
          "category": "Training",
          "amount": 150,
          "supplier": "St John Ambulance",
          "notes": "Paediatric first aid — 2 staff",
          "status": "paid",
          "paidAt": "2026-06-10T16:00:00.000Z",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-212",
          "date": "2026-06-05",
          "category": "Equipment",
          "amount": 312.4,
          "supplier": "Decathlon",
          "notes": "Football kit, bibs & pump — new season",
          "status": "pending",
          "dueDate": "2026-06-30",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-213",
          "date": "2026-05-20",
          "category": "Utilities",
          "amount": 74.2,
          "supplier": "British Gas",
          "notes": "Store unit electricity — Q2",
          "status": "paid",
          "paidAt": "2026-05-20T10:10:00.000Z",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-214",
          "date": "2026-05-08",
          "category": "Marketing",
          "amount": 58,
          "supplier": "Instantprint",
          "notes": "A5 leaflets — school gate distribution",
          "status": "paid",
          "paidAt": "2026-05-08T12:00:00.000Z",
          "receiptUrl": "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='120'%20height='120'%3E%3Crect%20width='120'%20height='120'%20fill='%23e5f2fd'/%3E%3Ctext%20x='60'%20y='58'%20font-size='11'%20text-anchor='middle'%20fill='%231f77c9'%3EInstantprint%3C/text%3E%3Ctext%20x='60'%20y='76'%20font-size='12'%20text-anchor='middle'%20fill='%234a4763'%3E£58.00%3C/text%3E%3C/svg%3E",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-215",
          "date": "2026-05-01",
          "category": "Insurance",
          "amount": 96.5,
          "supplier": "Activities Industry Mutual",
          "notes": "Public liability & activity cover",
          "status": "paid",
          "paidAt": "2026-05-01T06:30:00.000Z",
          "repeat": "monthly",
          "repeatUntil": "2027-03-01",
          "seriesId": "series-insurance",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-216",
          "date": "2026-04-14",
          "category": "Staff",
          "amount": 132,
          "supplier": "Disclosure & Barring Service",
          "notes": "DBS checks — 2 new coaches",
          "status": "paid",
          "paidAt": "2026-04-14T13:30:00.000Z",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-217",
          "date": "2026-04-02",
          "category": "Venue hire",
          "amount": 480,
          "supplier": "Oakfield Leisure Centre",
          "notes": "Sports hall — Easter Holiday Camp",
          "status": "paid",
          "paidAt": "2026-04-02T08:00:00.000Z",
          "createdByName": "Kaz James"
        },
        {
          "id": "exp-218",
          "date": "2026-03-25",
          "category": "Supplies",
          "amount": 143.9,
          "supplier": "Costco",
          "notes": "Snacks, squash & first-aid restock",
          "status": "paid",
          "paidAt": "2026-03-25T15:45:00.000Z",
          "receiptUrl": "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='120'%20height='120'%3E%3Crect%20width='120'%20height='120'%20fill='%23eceff4'/%3E%3Ctext%20x='60'%20y='58'%20font-size='14'%20text-anchor='middle'%20fill='%2348566e'%3ECostco%3C/text%3E%3Ctext%20x='60'%20y='76'%20font-size='12'%20text-anchor='middle'%20fill='%234a4763'%3E£143.90%3C/text%3E%3C/svg%3E",
          "createdByName": "Kaz James"
        }
      ]
    }
  },
  "finance": {
    "/api/bookings": [
      {
        "ref": "R-1041",
        "bid": "B1041",
        "createdAt": "2026-03-05T10:12:00Z",
        "booker": "Sarah Thompson",
        "email": "sarah.thompson@example.co.uk",
        "phone": "07700 900041",
        "child": "Oliver Thompson",
        "age": 8,
        "kids": [
          {
            "name": "Oliver Thompson",
            "age": 8
          },
          {
            "name": "Emily Thompson",
            "age": 6
          }
        ],
        "listing": "Football Academy",
        "pass": "Full week",
        "ticket": "Sibling x2",
        "dates": "16 Mar – 20 Mar 2026",
        "days": [
          "2026-03-16",
          "2026-03-17",
          "2026-03-18",
          "2026-03-19",
          "2026-03-20"
        ],
        "sessions": [
          "Mon 16 Mar 2026 · 09:00 – 15:00",
          "Tue 17 Mar 2026 · 09:00 – 15:00",
          "Wed 18 Mar 2026 · 09:00 – 15:00",
          "Thu 19 Mar 2026 · 09:00 – 15:00",
          "Fri 20 Mar 2026 · 09:00 – 15:00"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 120,
        "amountPaid": 120,
        "addons": [],
        "answers": [],
        "note": "",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1042",
        "bid": "B1042",
        "createdAt": "2026-03-19T14:41:00Z",
        "booker": "James Patel",
        "email": "james.patel@example.co.uk",
        "phone": "07700 900042",
        "child": "Aisha Patel",
        "age": 7,
        "kids": [
          {
            "name": "Aisha Patel",
            "age": 7
          }
        ],
        "listing": "Gymnastics Camp",
        "pass": "3 days",
        "ticket": "Standard",
        "dates": "30 Mar – 01 Apr 2026",
        "days": [
          "2026-03-30",
          "2026-03-31",
          "2026-04-01"
        ],
        "sessions": [
          "Mon 30 Mar 2026 · 09:30 – 12:30",
          "Tue 31 Mar 2026 · 09:30 – 12:30",
          "Wed 01 Apr 2026 · 09:30 – 12:30"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 75,
        "amountPaid": 75,
        "addons": [],
        "answers": [],
        "note": "",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1055",
        "bid": "B1055",
        "createdAt": "2026-04-08T09:03:00Z",
        "booker": "Emma Wilson",
        "email": "emma.wilson@example.co.uk",
        "phone": "07700 900055",
        "child": "Jack Wilson",
        "age": 9,
        "kids": [
          {
            "name": "Jack Wilson",
            "age": 9
          }
        ],
        "listing": "Forest School Adventure",
        "pass": "Full week",
        "ticket": "Standard",
        "dates": "13 Apr – 17 Apr 2026",
        "days": [
          "2026-04-13",
          "2026-04-14",
          "2026-04-15",
          "2026-04-16",
          "2026-04-17"
        ],
        "sessions": [
          "Mon 13 Apr 2026 · 09:00 – 15:30",
          "Tue 14 Apr 2026 · 09:00 – 15:30",
          "Wed 15 Apr 2026 · 09:00 – 15:30",
          "Thu 16 Apr 2026 · 09:00 – 15:30",
          "Fri 17 Apr 2026 · 09:00 – 15:30"
        ],
        "status": "Confirmed",
        "pay": "Funded",
        "method": "Tax-Free Childcare",
        "amount": 160,
        "amountPaid": 160,
        "voucherScheme": "Tax-Free Childcare",
        "addons": [],
        "answers": [],
        "note": "Paid via TFC reference TFC-88213",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1061",
        "bid": "B1061",
        "createdAt": "2026-04-22T18:26:00Z",
        "booker": "Liam O'Connor",
        "email": "liam.oconnor@example.co.uk",
        "phone": "07700 900061",
        "child": "Rory O'Connor",
        "age": 10,
        "kids": [
          {
            "name": "Rory O'Connor",
            "age": 10
          },
          {
            "name": "Niamh O'Connor",
            "age": 5
          }
        ],
        "listing": "Multi-Sports Holiday Camp",
        "pass": "Full week",
        "ticket": "Sibling x2",
        "dates": "27 Apr – 01 May 2026",
        "days": [
          "2026-04-27",
          "2026-04-28",
          "2026-04-29",
          "2026-04-30",
          "2026-05-01"
        ],
        "sessions": [
          "Mon 27 Apr 2026 · 09:00 – 15:00",
          "Tue 28 Apr 2026 · 09:00 – 15:00",
          "Wed 29 Apr 2026 · 09:00 – 15:00",
          "Thu 30 Apr 2026 · 09:00 – 15:00",
          "Fri 01 May 2026 · 09:00 – 15:00"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 145,
        "amountPaid": 145,
        "addons": [
          "Early drop-off"
        ],
        "answers": [],
        "note": "",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1078",
        "bid": "B1078",
        "createdAt": "2026-05-06T11:47:00Z",
        "booker": "Priya Sharma",
        "email": "priya.sharma@example.co.uk",
        "phone": "07700 900078",
        "child": "Anaya Sharma",
        "age": 6,
        "kids": [
          {
            "name": "Anaya Sharma",
            "age": 6
          }
        ],
        "listing": "Junior Dance Camp",
        "pass": "3 days",
        "ticket": "Standard",
        "dates": "11 May – 13 May 2026",
        "days": [
          "2026-05-11",
          "2026-05-12",
          "2026-05-13"
        ],
        "sessions": [
          "Mon 11 May 2026 · 10:00 – 13:00",
          "Tue 12 May 2026 · 10:00 – 13:00",
          "Wed 13 May 2026 · 10:00 – 13:00"
        ],
        "status": "Cancelled",
        "pay": "Refunded",
        "method": "Card",
        "amount": 90,
        "amountPaid": 90,
        "addons": [],
        "answers": [],
        "note": "Family moved away",
        "recon": true,
        "evid": null,
        "refundLog": [],
        "cancel": {
          "on": "2026-05-10",
          "by": "Priya Sharma",
          "reason": "Relocation",
          "refund": "approved",
          "amount": 90,
          "refundTo": "card"
        }
      },
      {
        "ref": "R-1085",
        "bid": "B1085",
        "createdAt": "2026-05-20T08:19:00Z",
        "booker": "David Clarke",
        "email": "david.clarke@example.co.uk",
        "phone": "07700 900085",
        "child": "Harry Clarke",
        "age": 11,
        "kids": [
          {
            "name": "Harry Clarke",
            "age": 11
          }
        ],
        "listing": "Football Academy",
        "pass": "Full week",
        "ticket": "Standard",
        "dates": "25 May – 29 May 2026",
        "days": [
          "2026-05-25",
          "2026-05-26",
          "2026-05-27",
          "2026-05-28",
          "2026-05-29"
        ],
        "sessions": [
          "Mon 25 May 2026 · 09:00 – 15:00",
          "Tue 26 May 2026 · 09:00 – 15:00",
          "Wed 27 May 2026 · 09:00 – 15:00",
          "Thu 28 May 2026 · 09:00 – 15:00",
          "Fri 29 May 2026 · 09:00 – 15:00"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 120,
        "amountPaid": 120,
        "addons": [],
        "answers": [],
        "note": "",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1092",
        "bid": "B1092",
        "createdAt": "2026-06-03T09:58:00Z",
        "booker": "Sarah Thompson",
        "email": "sarah.thompson@example.co.uk",
        "phone": "07700 900041",
        "child": "Oliver Thompson",
        "age": 8,
        "kids": [
          {
            "name": "Oliver Thompson",
            "age": 8
          },
          {
            "name": "Emily Thompson",
            "age": 6
          }
        ],
        "listing": "Summer Holiday Club",
        "pass": "Full week",
        "ticket": "Sibling x2",
        "dates": "08 Jun – 12 Jun 2026",
        "days": [
          "2026-06-08",
          "2026-06-09",
          "2026-06-10",
          "2026-06-11",
          "2026-06-12"
        ],
        "sessions": [
          "Mon 08 Jun 2026 · 08:30 – 16:00",
          "Tue 09 Jun 2026 · 08:30 – 16:00",
          "Wed 10 Jun 2026 · 08:30 – 16:00",
          "Thu 11 Jun 2026 · 08:30 – 16:00",
          "Fri 12 Jun 2026 · 08:30 – 16:00"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 200,
        "amountPaid": 200,
        "addons": [
          "Late pick-up"
        ],
        "answers": [],
        "note": "",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1105",
        "bid": "B1105",
        "createdAt": "2026-06-17T13:12:00Z",
        "booker": "Grace Bennett",
        "email": "grace.bennett@example.co.uk",
        "phone": "07700 900105",
        "child": "Freddie Bennett",
        "age": 5,
        "kids": [
          {
            "name": "Freddie Bennett",
            "age": 5
          }
        ],
        "listing": "Forest School Adventure",
        "pass": "Full week",
        "ticket": "Standard",
        "dates": "22 Jun – 26 Jun 2026",
        "days": [
          "2026-06-22",
          "2026-06-23",
          "2026-06-24",
          "2026-06-25",
          "2026-06-26"
        ],
        "sessions": [
          "Mon 22 Jun 2026 · 09:00 – 15:30",
          "Tue 23 Jun 2026 · 09:00 – 15:30",
          "Wed 24 Jun 2026 · 09:00 – 15:30",
          "Thu 25 Jun 2026 · 09:00 – 15:30",
          "Fri 26 Jun 2026 · 09:00 – 15:30"
        ],
        "status": "Confirmed",
        "pay": "Unpaid",
        "method": "Card",
        "amount": 160,
        "amountPaid": 0,
        "addons": [],
        "answers": [],
        "note": "Invoice requested",
        "recon": false,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1120",
        "bid": "B1120",
        "createdAt": "2026-07-01T07:44:00Z",
        "booker": "Mohammed Ali",
        "email": "mohammed.ali@example.co.uk",
        "phone": "07700 900120",
        "child": "Yusuf Ali",
        "age": 9,
        "kids": [
          {
            "name": "Yusuf Ali",
            "age": 9
          },
          {
            "name": "Layla Ali",
            "age": 7
          }
        ],
        "listing": "Multi-Sports Holiday Camp",
        "pass": "Full week",
        "ticket": "HAF funded",
        "dates": "06 Jul – 10 Jul 2026",
        "days": [
          "2026-07-06",
          "2026-07-07",
          "2026-07-08",
          "2026-07-09",
          "2026-07-10"
        ],
        "sessions": [
          "Mon 06 Jul 2026 · 09:00 – 15:00",
          "Tue 07 Jul 2026 · 09:00 – 15:00",
          "Wed 08 Jul 2026 · 09:00 – 15:00",
          "Thu 09 Jul 2026 · 09:00 – 15:00",
          "Fri 10 Jul 2026 · 09:00 – 15:00"
        ],
        "status": "Confirmed",
        "pay": "Funded",
        "method": "HAF (funded £0)",
        "amount": 0,
        "amountPaid": 0,
        "addons": [],
        "answers": [],
        "note": "HAF-funded place",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1121",
        "bid": "B1121",
        "createdAt": "2026-07-08T16:31:00Z",
        "booker": "Charlotte Evans",
        "email": "charlotte.evans@example.co.uk",
        "phone": "07700 900121",
        "child": "Sophie Evans",
        "age": 6,
        "kids": [
          {
            "name": "Sophie Evans",
            "age": 6
          }
        ],
        "listing": "Gymnastics Camp",
        "pass": "3 days",
        "ticket": "Standard",
        "dates": "13 Jul – 15 Jul 2026",
        "days": [
          "2026-07-13",
          "2026-07-14",
          "2026-07-15"
        ],
        "sessions": [
          "Mon 13 Jul 2026 · 09:30 – 12:30",
          "Tue 14 Jul 2026 · 09:30 – 12:30",
          "Wed 15 Jul 2026 · 09:30 – 12:30"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 135,
        "amountPaid": 135,
        "addons": [],
        "answers": [],
        "note": "",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1135",
        "bid": "B1135",
        "createdAt": "2026-07-15T10:05:00Z",
        "booker": "Tom Richardson",
        "email": "tom.richardson@example.co.uk",
        "phone": "07700 900135",
        "child": "Ella Richardson",
        "age": 10,
        "kids": [
          {
            "name": "Ella Richardson",
            "age": 10
          },
          {
            "name": "Max Richardson",
            "age": 12
          }
        ],
        "listing": "Summer Holiday Club",
        "pass": "Full week",
        "ticket": "Sibling x2",
        "dates": "20 Jul – 24 Jul 2026",
        "days": [
          "2026-07-20",
          "2026-07-21",
          "2026-07-22",
          "2026-07-23",
          "2026-07-24"
        ],
        "sessions": [
          "Mon 20 Jul 2026 · 08:30 – 16:00",
          "Tue 21 Jul 2026 · 08:30 – 16:00",
          "Wed 22 Jul 2026 · 08:30 – 16:00",
          "Thu 23 Jul 2026 · 08:30 – 16:00",
          "Fri 24 Jul 2026 · 08:30 – 16:00"
        ],
        "status": "Confirmed",
        "pay": "Partially paid",
        "method": "Card",
        "amount": 250,
        "amountPaid": 150,
        "addons": [
          "Late pick-up"
        ],
        "answers": [],
        "note": "£100 balance to follow",
        "recon": false,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1140",
        "bid": "B1140",
        "createdAt": "2026-07-22T12:38:00Z",
        "booker": "Emma Wilson",
        "email": "emma.wilson@example.co.uk",
        "phone": "07700 900055",
        "child": "Jack Wilson",
        "age": 9,
        "kids": [
          {
            "name": "Jack Wilson",
            "age": 9
          }
        ],
        "listing": "Football Academy",
        "pass": "Full week",
        "ticket": "Standard",
        "dates": "27 Jul – 31 Jul 2026",
        "days": [
          "2026-07-27",
          "2026-07-28",
          "2026-07-29",
          "2026-07-30",
          "2026-07-31"
        ],
        "sessions": [
          "Mon 27 Jul 2026 · 09:00 – 15:00",
          "Tue 28 Jul 2026 · 09:00 – 15:00",
          "Wed 29 Jul 2026 · 09:00 – 15:00",
          "Thu 30 Jul 2026 · 09:00 – 15:00",
          "Fri 31 Jul 2026 · 09:00 – 15:00"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 120,
        "amountPaid": 120,
        "addons": [],
        "answers": [],
        "note": "",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1150",
        "bid": "B1150",
        "createdAt": "2026-07-29T15:52:00Z",
        "booker": "Olivia Turner",
        "email": "olivia.turner@example.co.uk",
        "phone": "07700 900150",
        "child": "Mia Turner",
        "age": 4,
        "kids": [
          {
            "name": "Mia Turner",
            "age": 4
          }
        ],
        "listing": "Junior Dance Camp",
        "pass": "3 days",
        "ticket": "Standard",
        "dates": "03 Aug – 05 Aug 2026",
        "days": [
          "2026-08-03",
          "2026-08-04",
          "2026-08-05"
        ],
        "sessions": [
          "Mon 03 Aug 2026 · 10:00 – 13:00",
          "Tue 04 Aug 2026 · 10:00 – 13:00",
          "Wed 05 Aug 2026 · 10:00 – 13:00"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 95,
        "amountPaid": 95,
        "addons": [],
        "answers": [],
        "note": "",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1161",
        "bid": "B1161",
        "createdAt": "2026-08-04T09:00:00Z",
        "booker": "Nathan Cook",
        "email": "nathan.cook@example.co.uk",
        "phone": "07700 900161",
        "child": "Leo Cook",
        "age": 8,
        "kids": [
          {
            "name": "Leo Cook",
            "age": 8
          },
          {
            "name": "Ruby Cook",
            "age": 6
          }
        ],
        "listing": "Multi-Sports Holiday Camp",
        "pass": "Full week",
        "ticket": "Sibling x2",
        "dates": "10 Aug – 14 Aug 2026",
        "days": [
          "2026-08-10",
          "2026-08-11",
          "2026-08-12",
          "2026-08-13",
          "2026-08-14"
        ],
        "sessions": [
          "Mon 10 Aug 2026 · 09:00 – 15:00",
          "Tue 11 Aug 2026 · 09:00 – 15:00",
          "Wed 12 Aug 2026 · 09:00 – 15:00",
          "Thu 13 Aug 2026 · 09:00 – 15:00",
          "Fri 14 Aug 2026 · 09:00 – 15:00"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 180,
        "amountPaid": 180,
        "addons": [
          "Early drop-off"
        ],
        "answers": [],
        "note": "",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1168",
        "bid": "B1168",
        "createdAt": "2026-08-07T14:30:00Z",
        "booker": "Hannah Lewis",
        "email": "hannah.lewis@example.co.uk",
        "phone": "07700 900168",
        "child": "Poppy Lewis",
        "age": 5,
        "kids": [
          {
            "name": "Poppy Lewis",
            "age": 5
          }
        ],
        "listing": "Forest School Adventure",
        "pass": "Full week",
        "ticket": "Standard",
        "dates": "10 Aug – 14 Aug 2026",
        "days": [
          "2026-08-10",
          "2026-08-11",
          "2026-08-12",
          "2026-08-13",
          "2026-08-14"
        ],
        "sessions": [
          "Mon 10 Aug 2026 · 09:00 – 15:30",
          "Tue 11 Aug 2026 · 09:00 – 15:30",
          "Wed 12 Aug 2026 · 09:00 – 15:30",
          "Thu 13 Aug 2026 · 09:00 – 15:30",
          "Fri 14 Aug 2026 · 09:00 – 15:30"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 160,
        "amountPaid": 160,
        "addons": [],
        "answers": [],
        "note": "",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1172",
        "bid": "B1172",
        "createdAt": "2026-08-10T08:15:00Z",
        "booker": "Daniel Scott",
        "email": "daniel.scott@example.co.uk",
        "phone": "07700 900172",
        "child": "Isla Scott",
        "age": 7,
        "kids": [
          {
            "name": "Isla Scott",
            "age": 7
          }
        ],
        "listing": "Gymnastics Camp",
        "pass": "3 days",
        "ticket": "Standard",
        "dates": "12 Aug – 14 Aug 2026",
        "days": [
          "2026-08-12",
          "2026-08-13",
          "2026-08-14"
        ],
        "sessions": [
          "Wed 12 Aug 2026 · 09:30 – 12:30",
          "Thu 13 Aug 2026 · 09:30 – 12:30",
          "Fri 14 Aug 2026 · 09:30 – 12:30"
        ],
        "status": "Confirmed",
        "pay": "Paid",
        "method": "Card",
        "amount": 110,
        "amountPaid": 110,
        "addons": [],
        "answers": [],
        "note": "",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1175",
        "bid": "B1175",
        "createdAt": "2026-08-11T07:00:00Z",
        "booker": "Sophie Green",
        "email": "sophie.green@example.co.uk",
        "phone": "07700 900175",
        "child": "Charlie Green",
        "age": 11,
        "kids": [
          {
            "name": "Charlie Green",
            "age": 11
          },
          {
            "name": "Grace Green",
            "age": 9
          }
        ],
        "listing": "Summer Holiday Club",
        "pass": "Full week",
        "ticket": "Sibling x2",
        "dates": "17 Aug – 21 Aug 2026",
        "days": [
          "2026-08-17",
          "2026-08-18",
          "2026-08-19",
          "2026-08-20",
          "2026-08-21"
        ],
        "sessions": [
          "Mon 17 Aug 2026 · 08:30 – 16:00",
          "Tue 18 Aug 2026 · 08:30 – 16:00",
          "Wed 19 Aug 2026 · 08:30 – 16:00",
          "Thu 20 Aug 2026 · 08:30 – 16:00",
          "Fri 21 Aug 2026 · 08:30 – 16:00"
        ],
        "status": "Confirmed",
        "pay": "Funded",
        "method": "Tax-Free Childcare",
        "amount": 200,
        "amountPaid": 200,
        "voucherScheme": "Tax-Free Childcare",
        "addons": [],
        "answers": [],
        "note": "TFC ref TFC-90441",
        "recon": true,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1180",
        "bid": "B1180",
        "createdAt": "2026-08-02T11:24:00Z",
        "booker": "Rebecca Hughes",
        "email": "rebecca.hughes@example.co.uk",
        "phone": "07700 900180",
        "child": "George Hughes",
        "age": 8,
        "kids": [
          {
            "name": "George Hughes",
            "age": 8
          }
        ],
        "listing": "Football Academy",
        "pass": "Full week",
        "ticket": "Standard",
        "dates": "10 Aug – 14 Aug 2026",
        "days": [
          "2026-08-10",
          "2026-08-11",
          "2026-08-12",
          "2026-08-13",
          "2026-08-14"
        ],
        "sessions": [
          "Mon 10 Aug 2026 · 09:00 – 15:00",
          "Tue 11 Aug 2026 · 09:00 – 15:00",
          "Wed 12 Aug 2026 · 09:00 – 15:00",
          "Thu 13 Aug 2026 · 09:00 – 15:00",
          "Fri 14 Aug 2026 · 09:00 – 15:00"
        ],
        "status": "Confirmed",
        "pay": "Invoice sent",
        "method": "Card",
        "amount": 120,
        "amountPaid": 0,
        "addons": [],
        "answers": [],
        "note": "Invoice INV-2043 issued",
        "recon": false,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1200",
        "bid": "B1200",
        "createdAt": "2026-08-06T19:10:00Z",
        "booker": "Amelia Ward",
        "email": "amelia.ward@example.co.uk",
        "phone": "07700 900200",
        "child": "Noah Ward",
        "age": 7,
        "kids": [
          {
            "name": "Noah Ward",
            "age": 7
          }
        ],
        "listing": "Gymnastics Camp",
        "pass": "3 days",
        "ticket": "Standard",
        "dates": "17 Aug – 19 Aug 2026",
        "days": [
          "2026-08-17",
          "2026-08-18",
          "2026-08-19"
        ],
        "sessions": [
          "Mon 17 Aug 2026 · 09:30 – 12:30",
          "Tue 18 Aug 2026 · 09:30 – 12:30",
          "Wed 19 Aug 2026 · 09:30 – 12:30"
        ],
        "status": "Waitlisted",
        "pay": "Unpaid",
        "method": "Card",
        "amount": 135,
        "amountPaid": 0,
        "addons": [],
        "answers": [],
        "note": "On the waiting list",
        "recon": false,
        "evid": null,
        "cancel": null
      },
      {
        "ref": "R-1201",
        "bid": "B1201",
        "createdAt": "2026-08-05T20:40:00Z",
        "booker": "Jacob Reed",
        "email": "jacob.reed@example.co.uk",
        "phone": "07700 900201",
        "child": "Ethan Reed",
        "age": 10,
        "kids": [
          {
            "name": "Ethan Reed",
            "age": 10
          }
        ],
        "listing": "Forest School Adventure",
        "pass": "Full week",
        "ticket": "Standard",
        "dates": "17 Aug – 21 Aug 2026",
        "days": [
          "2026-08-17",
          "2026-08-18",
          "2026-08-19",
          "2026-08-20",
          "2026-08-21"
        ],
        "sessions": [
          "Mon 17 Aug 2026 · 09:00 – 15:30",
          "Tue 18 Aug 2026 · 09:00 – 15:30",
          "Wed 19 Aug 2026 · 09:00 – 15:30",
          "Thu 20 Aug 2026 · 09:00 – 15:30",
          "Fri 21 Aug 2026 · 09:00 – 15:30"
        ],
        "status": "Declined",
        "pay": "Unpaid",
        "method": "Card",
        "amount": 160,
        "amountPaid": 0,
        "addons": [],
        "answers": [],
        "note": "Camp full for those dates",
        "declineReason": "Fully booked",
        "recon": false,
        "evid": null,
        "cancel": null
      }
    ],
    "/api/invoices": {
      "items": [
        {
          "id": "INV-2041",
          "customerName": "Grace Bennett",
          "amount": 160,
          "date": "2026-07-10",
          "dueDate": "2026-07-24",
          "status": "sent",
          "overdue": true
        },
        {
          "id": "INV-2042",
          "customerName": "Tom Richardson",
          "amount": 100,
          "date": "2026-07-18",
          "dueDate": "2026-08-01",
          "status": "sent",
          "overdue": true
        },
        {
          "id": "INV-2047",
          "customerName": "Jacob Reed",
          "amount": 90,
          "date": "2026-06-28",
          "dueDate": "2026-07-12",
          "status": "sent",
          "overdue": true
        },
        {
          "id": "INV-2043",
          "customerName": "Rebecca Hughes",
          "amount": 120,
          "date": "2026-08-02",
          "dueDate": "2026-08-16",
          "status": "sent",
          "overdue": false
        },
        {
          "id": "INV-2046",
          "customerName": "Amelia Ward",
          "amount": 220,
          "date": "2026-08-05",
          "dueDate": "2026-08-19",
          "status": "sent",
          "overdue": false
        },
        {
          "id": "INV-2044",
          "customerName": "Nathan Cook",
          "amount": 180,
          "date": "2026-08-04",
          "dueDate": "2026-08-18",
          "status": "paid",
          "overdue": false
        },
        {
          "id": "INV-2045",
          "customerName": "Charlotte Evans",
          "amount": 135,
          "date": "2026-07-08",
          "dueDate": "2026-07-22",
          "status": "paid",
          "overdue": false
        },
        {
          "id": "INV-2048",
          "customerName": "Sarah Thompson",
          "amount": 200,
          "date": "2026-06-03",
          "dueDate": "2026-06-17",
          "status": "paid",
          "overdue": false
        }
      ],
      "summary": {
        "count": 8,
        "outstanding": 690,
        "collected": 515,
        "overdue": 350
      }
    },
    "/api/payments": [
      {
        "id": "PM-9017",
        "refs": [
          "R-1175"
        ],
        "email": "sophie.green@example.co.uk",
        "amount": 200,
        "type": "payment",
        "status": "paid",
        "createdAt": "2026-08-11T07:02:00Z"
      },
      {
        "id": "PM-9003",
        "refs": [
          "R-1172"
        ],
        "email": "daniel.scott@example.co.uk",
        "amount": 110,
        "type": "payment",
        "status": "paid",
        "createdAt": "2026-08-10T08:20:00Z"
      },
      {
        "id": "PM-9002",
        "refs": [
          "R-1168"
        ],
        "email": "hannah.lewis@example.co.uk",
        "amount": 160,
        "type": "payment",
        "status": "paid",
        "createdAt": "2026-08-07T14:35:00Z"
      },
      {
        "id": "PM-9001",
        "refs": [
          "R-1161"
        ],
        "email": "nathan.cook@example.co.uk",
        "amount": 180,
        "type": "payment",
        "status": "paid",
        "createdAt": "2026-08-04T09:05:00Z"
      },
      {
        "id": "PM-9004",
        "refs": [
          "R-1150"
        ],
        "email": "olivia.turner@example.co.uk",
        "amount": 95,
        "type": "payment",
        "status": "paid",
        "createdAt": "2026-07-29T15:55:00Z"
      },
      {
        "id": "PM-9005",
        "refs": [
          "R-1140"
        ],
        "email": "emma.wilson@example.co.uk",
        "amount": 120,
        "type": "payment",
        "status": "paid",
        "createdAt": "2026-07-22T12:41:00Z"
      },
      {
        "id": "PM-9006",
        "refs": [
          "R-1135"
        ],
        "email": "tom.richardson@example.co.uk",
        "amount": 150,
        "type": "payment",
        "status": "paid",
        "createdAt": "2026-07-15T10:08:00Z"
      },
      {
        "id": "PM-9007",
        "refs": [
          "R-1121"
        ],
        "email": "charlotte.evans@example.co.uk",
        "amount": 135,
        "type": "payment",
        "status": "paid",
        "createdAt": "2026-07-08T16:34:00Z"
      },
      {
        "id": "PM-9008",
        "refs": [
          "R-1092"
        ],
        "email": "sarah.thompson@example.co.uk",
        "amount": 200,
        "type": "payment",
        "status": "paid",
        "createdAt": "2026-06-03T10:01:00Z"
      },
      {
        "id": "PM-9010",
        "refs": [
          "R-1085"
        ],
        "email": "david.clarke@example.co.uk",
        "amount": 120,
        "type": "payment",
        "status": "paid",
        "createdAt": "2026-05-20T08:22:00Z"
      },
      {
        "id": "PM-9011",
        "refs": [
          "R-1061"
        ],
        "email": "liam.oconnor@example.co.uk",
        "amount": 145,
        "type": "payment",
        "status": "paid",
        "createdAt": "2026-04-22T18:29:00Z"
      },
      {
        "id": "PM-9013",
        "refs": [
          "R-1041"
        ],
        "email": "sarah.thompson@example.co.uk",
        "amount": 120,
        "type": "payment",
        "status": "paid",
        "createdAt": "2026-03-05T10:15:00Z"
      },
      {
        "id": "PM-9009",
        "refs": [
          "R-1078"
        ],
        "email": "priya.sharma@example.co.uk",
        "amount": 90,
        "type": "refund",
        "status": "refunded",
        "createdAt": "2026-05-10T12:00:00Z"
      },
      {
        "id": "PM-9012",
        "refs": [
          "R-1135"
        ],
        "email": "tom.richardson@example.co.uk",
        "amount": 25,
        "type": "refund",
        "status": "refunded",
        "createdAt": "2026-07-30T09:00:00Z"
      }
    ],
    "/api/payments/status": {
      "connected": true,
      "payoutsEnabled": true,
      "chargesEnabled": true,
      "detailsSubmitted": true
    }
  },
  "newsfeed": {
    "/api/me": {
      "role": "freelancer",
      "name": "Hannah Whitfield",
      "tenantId": "VOiiaTnDNd03MLbZaVcM"
    },
    "/api/library": null,
    "/api/listings": [
      {
        "id": "lst_multisports",
        "title": "Multi-Sports Holiday Camp"
      },
      {
        "id": "lst_football",
        "title": "Football Academy"
      },
      {
        "id": "lst_gymnastics",
        "title": "Gymnastics Stars"
      },
      {
        "id": "lst_forest",
        "title": "Forest School Adventures"
      },
      {
        "id": "lst_dance",
        "title": "Dance & Drama Week"
      },
      {
        "id": "lst_tennis",
        "title": "Junior Tennis Camp"
      }
    ],
    "/api/discounts": [
      {
        "code": "SUMMER10",
        "type": "percent",
        "value": 10,
        "expiry": "31 Aug 2026",
        "active": true
      },
      {
        "code": "SIBLING5",
        "type": "perAttendee",
        "value": 5,
        "expiry": "31 Dec 2026",
        "active": true
      },
      {
        "code": "EARLYBIRD",
        "type": "fixed",
        "value": 15,
        "expiry": "01 Jul 2026",
        "active": true
      },
      {
        "code": "AUGUST20",
        "type": "percent",
        "value": 20,
        "active": true
      },
      {
        "code": "OLDCODE",
        "type": "fixed",
        "value": 8,
        "expiry": "01 Jan 2026",
        "active": false
      }
    ],
    "/api/posts": [
      {
        "id": "post_urgent_heat",
        "tpl": "urgent",
        "title": "Heatwave — extra water & sun cream on Wednesday",
        "body": "With temperatures forecast to reach 31°C on Wednesday 13 August, please send your child with a named refillable water bottle, a sun hat and sun cream already applied before drop-off. We'll keep the children in the shade during the hottest part of the day and move the afternoon football session indoors. Please tap Acknowledge so we know you've seen this.",
        "priority": "urgent",
        "pinned": true,
        "ackRequired": true,
        "react": true,
        "status": "published",
        "audience": "all",
        "audLabel": "All families",
        "seen": 142,
        "reactions": 9,
        "ref": "NF-1042",
        "postedByName": "Hannah Whitfield",
        "createdAt": "2026-08-10T08:15:00.000Z"
      },
      {
        "id": "post_reminder_kit",
        "tpl": "reminder",
        "title": "Don't forget: trainers & packed lunch",
        "body": "A quick reminder that every child needs a packed lunch, a mid-morning snack and clean trainers each day. We're a nut-free camp, so please avoid anything containing nuts. Lost property is emptied every Friday.",
        "colour": "#f59e0b",
        "pinned": true,
        "react": true,
        "status": "published",
        "audience": "all",
        "audLabel": "All families",
        "folder": "Policies",
        "seen": 118,
        "reactions": 4,
        "ref": "NF-1038",
        "postedByName": "Hannah Whitfield",
        "createdAt": "2026-08-09T16:40:00.000Z"
      },
      {
        "id": "post_event_sportsday",
        "tpl": "event",
        "title": "End-of-summer Sports Day & family picnic",
        "body": "Join us for our end-of-summer celebration! Races, a tug-of-war, medals for every child and a family picnic on the field. Parents, carers and siblings are all welcome — bring a blanket and your best cheering voices.",
        "date": "Fri 22 Aug 2026",
        "time": "10:00 – 13:00",
        "location": "Kingsmead Recreation Ground, Guildford",
        "react": true,
        "status": "published",
        "audience": "all",
        "audLabel": "All families",
        "folder": "Summer 2026",
        "rsvp": {
          "yes": 47,
          "no": 6,
          "maybe": 12
        },
        "cta": {
          "label": "RSVP now",
          "url": "https://forms.example.com/sportsday"
        },
        "seen": 131,
        "reactions": 23,
        "ref": "NF-1035",
        "postedByName": "Hannah Whitfield",
        "createdAt": "2026-08-08T11:05:00.000Z"
      },
      {
        "id": "post_booking_forest",
        "tpl": "booking",
        "title": "Last spaces — Forest School Adventures",
        "body": "Only a handful of places left on our Forest School week (25–29 August). Den building, campfire cooking, bug hunts and woodland crafts for ages 5–11. Book soon to avoid missing out!",
        "colour": "#15b364",
        "react": true,
        "status": "published",
        "audience": "all",
        "audLabel": "All families",
        "cta": {
          "label": "Book now",
          "target": "Forest School Adventures",
          "listingId": "lst_forest"
        },
        "seen": 96,
        "reactions": 11,
        "ref": "NF-1031",
        "postedByName": "Hannah Whitfield",
        "createdAt": "2026-08-07T09:30:00.000Z"
      },
      {
        "id": "post_celebrate_medals",
        "tpl": "celebrate",
        "title": "Gymnastics Stars smash their badges!",
        "body": "A huge well done to our Gymnastics Stars group — 18 children earned their bronze and silver badges this week. Special shout-out to Amelia, Noah and Priya for their brilliant beam routines. We're so proud of every one of them!",
        "react": true,
        "status": "published",
        "audience": "listing",
        "audId": "lst_gymnastics",
        "audIds": [
          "lst_gymnastics"
        ],
        "audLabel": "Listings: Gymnastics Stars",
        "seen": 54,
        "reactions": 38,
        "ref": "NF-1028",
        "postedByName": "Hannah Whitfield",
        "createdAt": "2026-08-06T15:20:00.000Z",
        "editedAt": "2026-08-06T15:45:00.000Z"
      },
      {
        "id": "post_announce_welcome",
        "tpl": "announce",
        "title": "Welcome to summer camp 2026!",
        "body": "We can't wait to get started. Camp runs Monday to Friday, 9am–3:30pm, with early drop-off from 8am and late pick-up until 5pm available. Your daily register, photos and any messages will all appear right here in your app. Here's to a brilliant summer!",
        "react": true,
        "status": "published",
        "audience": "all",
        "audLabel": "All families",
        "folder": "Summer 2026",
        "seen": 156,
        "reactions": 27,
        "ref": "NF-1001",
        "postedByName": "Hannah Whitfield",
        "createdAt": "2026-07-21T10:00:00.000Z"
      },
      {
        "id": "post_newsletter_august",
        "tpl": "newsletter",
        "title": "August at Whitfield Activity Camps",
        "body": "This month at Whitfield Activity Camps — what's on, our summer offer, and a look back at a brilliant few weeks.",
        "react": true,
        "status": "published",
        "audience": "all",
        "audLabel": "All families",
        "folder": "Summer 2026",
        "seen": 128,
        "reactions": 19,
        "ref": "NF-1030",
        "postedByName": "Hannah Whitfield",
        "createdAt": "2026-08-05T12:00:00.000Z",
        "newsletter": {
          "layout": "classic",
          "palette": "sky",
          "company": {
            "name": "Whitfield Activity Camps",
            "phone": "01483 555 0123",
            "email": "hello@whitfieldcamps.co.uk",
            "address": "Kingsmead Pavilion, Guildford, GU1 4TX",
            "logo": ""
          },
          "blocks": [
            {
              "t": "banner"
            },
            {
              "t": "hero",
              "heading": "This month at Whitfield Activity Camps",
              "body": "Long summer days, happy children and plenty still to come. Here's everything you need to know for August."
            },
            {
              "t": "heading",
              "heading": "What's on"
            },
            {
              "t": "text",
              "body": "Multi-Sports, Football Academy and Gymnastics Stars run every week through to 29 August. Our ever-popular Forest School Adventures returns for its final week of the summer from 25 August — with just a few spaces left."
            },
            {
              "t": "eventbar",
              "date": "Fri 22 Aug 2026",
              "time": "10:00 – 13:00",
              "location": "Kingsmead Recreation Ground"
            },
            {
              "t": "columns",
              "left": "Please pack a nut-free lunch, a snack, a named water bottle, a sun hat and sun cream every day.",
              "right": "Early drop-off from 8am and late pick-up until 5pm are available — just let us know the day before."
            },
            {
              "t": "discount",
              "code": "SUMMER10",
              "codeDesc": "10% off your next booking — this week only."
            },
            {
              "t": "button",
              "label": "Book your place",
              "url": "https://whitfieldcamps.co.uk/book",
              "listingTitle": "Summer Camp"
            },
            {
              "t": "quote",
              "body": "My two have come home exhausted and beaming every single day. Thank you!",
              "heading": "— Sarah, parent"
            },
            {
              "t": "footer"
            }
          ]
        }
      },
      {
        "id": "post_reminder_photos",
        "tpl": "reminder",
        "title": "Photo consent — please check your settings",
        "body": "We love sharing the fun on the Newsfeed. If you'd prefer your child's photo not to be shared, you can update your consent in your account settings at any time and we'll honour it straight away.",
        "colour": "#f59e0b",
        "react": true,
        "status": "published",
        "audience": "all",
        "audLabel": "All families",
        "folder": "Policies",
        "seen": 89,
        "reactions": 2,
        "ref": "NF-1024",
        "postedByName": "Hannah Whitfield",
        "createdAt": "2026-08-04T08:50:00.000Z"
      },
      {
        "id": "post_draft_openday",
        "tpl": "announce",
        "title": "Autumn term clubs — coming soon",
        "body": "We're putting the finishing touches to our after-school and Saturday clubs for the autumn term. Football, gymnastics and a brand-new coding club will be on offer. Full details and booking to follow — watch this space!",
        "react": true,
        "status": "draft",
        "audience": "all",
        "audLabel": "All families",
        "seen": 0,
        "reactions": 0,
        "ref": "NF-1050",
        "postedByName": "Hannah Whitfield",
        "createdAt": "2026-08-11T07:20:00.000Z"
      },
      {
        "id": "post_scheduled_lastday",
        "tpl": "event",
        "title": "Last day of summer camp — dress-up Friday!",
        "body": "Our final day of the summer holidays is a costume day — superheroes, princesses, dinosaurs, anything goes! There'll be a disco in the afternoon and a certificate for every child. Normal pick-up times apply.",
        "date": "Fri 29 Aug 2026",
        "time": "09:00 – 15:30",
        "location": "Kingsmead Pavilion",
        "react": true,
        "status": "scheduled",
        "publishAt": "27 Aug 2026, 08:00",
        "audience": "all",
        "audLabel": "All families",
        "folder": "Summer 2026",
        "seen": 0,
        "reactions": 0,
        "ref": "NF-1048",
        "postedByName": "Hannah Whitfield",
        "createdAt": "2026-08-10T13:10:00.000Z"
      },
      {
        "id": "post_booking_tennis",
        "tpl": "booking",
        "title": "New! Junior Tennis Camp — August week",
        "body": "By popular demand we've added a Junior Tennis Camp for ages 7–12, running 18–22 August. All equipment provided, coached by LTA-qualified staff. £145 for the week, with sibling discounts available.",
        "colour": "#15b364",
        "react": true,
        "status": "published",
        "audience": "listing",
        "audId": "lst_tennis",
        "audIds": [
          "lst_tennis"
        ],
        "audLabel": "Listings: Junior Tennis Camp",
        "cta": {
          "label": "Reserve a place",
          "target": "Junior Tennis Camp",
          "listingId": "lst_tennis"
        },
        "seen": 63,
        "reactions": 8,
        "ref": "NF-1026",
        "postedByName": "Hannah Whitfield",
        "createdAt": "2026-08-03T10:15:00.000Z"
      },
      {
        "id": "post_archived_julyclose",
        "tpl": "announce",
        "title": "Bank holiday closure — 25 May",
        "body": "A reminder that camp was closed on Monday 25 May for the spring bank holiday. All bookings for that day were automatically credited to your wallet.",
        "react": true,
        "status": "archived",
        "audience": "all",
        "audLabel": "All families",
        "seen": 74,
        "reactions": 1,
        "ref": "NF-0987",
        "postedByName": "Hannah Whitfield",
        "createdAt": "2026-05-20T09:00:00.000Z"
      }
    ]
  },
  "purchasing": {
    "/api/invoices": {
      "items": [
        {
          "id": "inv-2601",
          "customerName": "Sarah Whitfield",
          "customerEmail": "sarah.whitfield@gmail.com",
          "customerAddress": "14 Bramble Close, Milton Keynes, MK4 2QP",
          "reference": "INV-1042",
          "bookingRef": "BK-8841",
          "description": "Summer Holiday Camp — Week 1 (Olivia, age 8)",
          "amount": 180,
          "lineItems": [
            {
              "description": "Holiday Camp full day x5",
              "qty": 5,
              "unitPrice": 36
            }
          ],
          "taxRate": 0,
          "date": "2026-08-03",
          "dueDate": "2026-08-17",
          "status": "paid",
          "paidVia": "link",
          "paidAt": "2026-08-05",
          "notes": "Paid promptly via card link."
        },
        {
          "id": "inv-2602",
          "customerName": "James Okafor",
          "customerEmail": "j.okafor@outlook.com",
          "customerAddress": "3 Willow Bank, Bletchley, MK2 3HN",
          "reference": "INV-1043",
          "description": "Multi-Sports Camp — Week 2 (Daniel, age 10)",
          "amount": 165,
          "lineItems": [
            {
              "description": "Multi-Sports full day x5",
              "qty": 5,
              "unitPrice": 33
            }
          ],
          "taxRate": 0,
          "date": "2026-08-04",
          "dueDate": "2026-08-18",
          "status": "paid",
          "paidVia": "manual",
          "paidAt": "2026-08-06",
          "notes": "Bank transfer received."
        },
        {
          "id": "inv-2603",
          "customerName": "Priya Sharma",
          "customerEmail": "priya.sharma88@gmail.com",
          "customerAddress": "27 Fenny Road, Stony Stratford, MK11 1AA",
          "reference": "INV-1044",
          "poNumber": "PO-5567",
          "accountRef": "ACME-SCHOOL",
          "description": "Forest School block — 6 sessions (Aarav, age 6)",
          "amount": 210,
          "lineItems": [
            {
              "description": "Forest School session",
              "qty": 6,
              "unitPrice": 35
            }
          ],
          "taxRate": 0,
          "date": "2026-07-28",
          "dueDate": "2026-08-11",
          "status": "sent",
          "emailedAt": "2026-07-28",
          "notes": "Awaiting payment."
        },
        {
          "id": "inv-2604",
          "customerName": "Emma Thompson",
          "customerEmail": "emma.t@hotmail.com",
          "customerAddress": "9 Ashby Grove, Wolverton, MK12 5LR",
          "reference": "INV-1045",
          "description": "Gymnastics Camp — Week 3 (Grace, age 7)",
          "amount": 150,
          "lineItems": [
            {
              "description": "Gymnastics full day x5",
              "qty": 5,
              "unitPrice": 30
            }
          ],
          "taxRate": 0,
          "date": "2026-08-01",
          "dueDate": "2026-08-15",
          "status": "sent",
          "emailedAt": "2026-08-01"
        },
        {
          "id": "inv-2605",
          "customerName": "Michael Brennan",
          "customerEmail": "m.brennan@gmail.com",
          "customerAddress": "41 Tanners Drive, Blakelands, MK14 5BN",
          "reference": "INV-1039",
          "description": "Football Camp — July (Jack, age 9)",
          "amount": 132,
          "lineItems": [
            {
              "description": "Football half day x8",
              "qty": 8,
              "unitPrice": 16.5
            }
          ],
          "taxRate": 0,
          "date": "2026-07-06",
          "dueDate": "2026-07-20",
          "status": "sent",
          "emailedAt": "2026-07-06",
          "overdue": true,
          "notes": "Overdue — chase sent."
        },
        {
          "id": "inv-2606",
          "customerName": "Laura Bennett",
          "customerEmail": "laura.bennett@gmail.com",
          "customerAddress": "5 Coriander Court, Newport Pagnell, MK16 0FG",
          "reference": "INV-1046",
          "description": "Holiday Camp — Week 4 (Sophie, age 5 & Ethan, age 8)",
          "amount": 320,
          "lineItems": [
            {
              "description": "Holiday Camp full day x5 (Sophie)",
              "qty": 5,
              "unitPrice": 32
            },
            {
              "description": "Holiday Camp full day x5 (Ethan)",
              "qty": 5,
              "unitPrice": 32
            }
          ],
          "taxRate": 0,
          "date": "2026-08-08",
          "dueDate": "2026-08-22",
          "status": "paid",
          "paidVia": "link",
          "paidAt": "2026-08-09"
        },
        {
          "id": "inv-2607",
          "customerName": "David Nwosu",
          "customerEmail": "david.nwosu@yahoo.co.uk",
          "customerAddress": "18 Cedar Way, Shenley Brook End, MK5 7AB",
          "reference": "INV-1047",
          "description": "Draft — Autumn after-school club (Chloe, age 6)",
          "amount": 96,
          "lineItems": [
            {
              "description": "After-school session x8",
              "qty": 8,
              "unitPrice": 12
            }
          ],
          "taxRate": 0,
          "date": "2026-08-10",
          "status": "draft"
        },
        {
          "id": "inv-2608",
          "customerName": "Hannah Clarke",
          "customerEmail": "hannah.clarke@gmail.com",
          "customerAddress": "22 Linford Lane, Willen, MK15 9DL",
          "reference": "INV-1041",
          "description": "Multi-Sports Camp — Week 1 (Ruby, age 7)",
          "amount": 165,
          "lineItems": [
            {
              "description": "Multi-Sports full day x5",
              "qty": 5,
              "unitPrice": 33
            }
          ],
          "taxRate": 0,
          "date": "2026-07-27",
          "dueDate": "2026-08-10",
          "status": "paid",
          "paidVia": "link",
          "paidAt": "2026-07-30"
        },
        {
          "id": "inv-2609",
          "customerName": "Robert Fielding",
          "customerEmail": "rob.fielding@gmail.com",
          "customerAddress": "7 Kingsmead, Loughton, MK5 8AA",
          "reference": "INV-1038",
          "description": "Cancelled — camp withdrawn (Leo, age 11)",
          "amount": 165,
          "lineItems": [
            {
              "description": "Multi-Sports full day x5",
              "qty": 5,
              "unitPrice": 33
            }
          ],
          "taxRate": 0,
          "date": "2026-07-02",
          "dueDate": "2026-07-16",
          "status": "cancelled",
          "notes": "Family cancelled, credit issued."
        },
        {
          "id": "inv-2610",
          "customerName": "Aisha Malik",
          "customerEmail": "aisha.malik@gmail.com",
          "customerAddress": "33 Downland, Two Mile Ash, MK8 8AF",
          "reference": "INV-1048",
          "description": "Gymnastics Camp — Week 4 (Zara, age 6)",
          "amount": 150,
          "lineItems": [
            {
              "description": "Gymnastics full day x5",
              "qty": 5,
              "unitPrice": 30
            }
          ],
          "taxRate": 0,
          "date": "2026-08-09",
          "dueDate": "2026-08-23",
          "status": "sent",
          "emailedAt": "2026-08-09"
        },
        {
          "id": "inv-2611",
          "customerName": "Tom Richardson",
          "customerEmail": "tom.richardson@gmail.com",
          "customerAddress": "12 Great Monks Street, Fullers Slade, MK11 2BW",
          "reference": "INV-1040",
          "description": "Forest School — July block (Noah, age 5)",
          "amount": 175,
          "lineItems": [
            {
              "description": "Forest School session",
              "qty": 5,
              "unitPrice": 35
            }
          ],
          "taxRate": 0,
          "date": "2026-07-14",
          "dueDate": "2026-07-28",
          "status": "paid",
          "paidVia": "manual",
          "paidAt": "2026-07-19"
        }
      ],
      "summary": {
        "count": 11,
        "outstanding": 675,
        "collected": 990,
        "overdue": 132
      }
    },
    "/api/income": {
      "items": [
        {
          "id": "inc-501",
          "date": "2026-08-10",
          "category": "Sessions",
          "amount": 96,
          "source": "Door takings — Mon multi-sports",
          "method": "Cash",
          "notes": "3 drop-ins paid on the day",
          "listingId": "lst-multisports"
        },
        {
          "id": "inc-502",
          "date": "2026-08-07",
          "category": "Camps",
          "amount": 360,
          "source": "Holiday Camp Week 3 — card machine",
          "method": "Card",
          "listingId": "lst-holidaycamp"
        },
        {
          "id": "inc-503",
          "date": "2026-08-05",
          "category": "Grants",
          "amount": 2400,
          "source": "HAF funding — Milton Keynes Council (Aug)",
          "method": "Bank transfer",
          "notes": "Summer HAF places, 40 funded sessions"
        },
        {
          "id": "inc-504",
          "date": "2026-08-03",
          "category": "Memberships",
          "amount": 45,
          "source": "Gold membership renewal — Whitfield",
          "method": "Card",
          "repeat": "monthly",
          "repeatUntil": "2027-08-03",
          "seriesId": "mem-whitfield"
        },
        {
          "id": "inc-505",
          "date": "2026-08-02",
          "category": "Merchandise",
          "amount": 84,
          "source": "Club hoodies x7",
          "method": "Card",
          "listingId": "lst-holidaycamp"
        },
        {
          "id": "inc-506",
          "date": "2026-07-29",
          "category": "Deposits",
          "amount": 150,
          "source": "Autumn camp deposits x6",
          "method": "Bank transfer"
        },
        {
          "id": "inc-507",
          "date": "2026-07-24",
          "category": "Sessions",
          "amount": 132,
          "source": "Football pay-and-play evenings",
          "method": "PayPal",
          "listingId": "lst-football"
        },
        {
          "id": "inc-508",
          "date": "2026-07-20",
          "category": "Camps",
          "amount": 495,
          "source": "Multi-Sports Week 1 — Tax-Free Childcare",
          "method": "Tax-Free Childcare",
          "listingId": "lst-multisports"
        },
        {
          "id": "inc-509",
          "date": "2026-07-15",
          "category": "Fundraising",
          "amount": 218.5,
          "source": "Summer fete — cake stall & raffle",
          "method": "Cash"
        },
        {
          "id": "inc-510",
          "date": "2026-07-10",
          "category": "Camps",
          "amount": 288,
          "source": "Gymnastics Week 1 — childcare vouchers",
          "method": "Childcare vouchers",
          "listingId": "lst-gymnastics"
        },
        {
          "id": "inc-511",
          "date": "2026-07-03",
          "category": "Memberships",
          "amount": 45,
          "source": "Gold membership — Whitfield",
          "method": "Card",
          "repeat": "monthly",
          "repeatUntil": "2027-08-03",
          "seriesId": "mem-whitfield"
        },
        {
          "id": "inc-512",
          "date": "2026-06-26",
          "category": "Sessions",
          "amount": 72,
          "source": "Forest School drop-ins",
          "method": "Cash",
          "listingId": "lst-forestschool"
        },
        {
          "id": "inc-513",
          "date": "2026-06-12",
          "category": "Grants",
          "amount": 1500,
          "source": "Sport England small grant",
          "method": "Bank transfer"
        },
        {
          "id": "inc-514",
          "date": "2026-05-18",
          "category": "Other",
          "amount": 60,
          "source": "Venue hire recharge — birthday party",
          "method": "Bank transfer"
        },
        {
          "id": "inc-515",
          "date": "2026-04-09",
          "category": "Camps",
          "amount": 420,
          "source": "Easter camp balance takings",
          "method": "Card",
          "listingId": "lst-holidaycamp"
        }
      ],
      "summary": {
        "total": 6595.5,
        "count": 15,
        "byCategory": {
          "Sessions": 300,
          "Camps": 1563,
          "Memberships": 90,
          "Merchandise": 84,
          "Grants": 3900,
          "Fundraising": 218.5,
          "Deposits": 150,
          "Other": 60
        }
      }
    },
    "/api/bookings": [
      {
        "ref": "BK-8841",
        "pay": "Paid",
        "method": "Card",
        "amount": 180,
        "amountPaid": 180,
        "createdAt": "2026-08-05",
        "booker": "Sarah Whitfield",
        "listing": "Summer Holiday Camp",
        "listingId": "lst-holidaycamp"
      },
      {
        "ref": "BK-8842",
        "pay": "Paid",
        "method": "Tax-Free Childcare",
        "amount": 165,
        "amountPaid": 165,
        "createdAt": "2026-08-04",
        "booker": "James Okafor",
        "listing": "Multi-Sports Camp",
        "listingId": "lst-multisports"
      },
      {
        "ref": "BK-8843",
        "pay": "Part paid",
        "method": "Bank transfer",
        "amount": 210,
        "amountPaid": 105,
        "createdAt": "2026-08-02",
        "booker": "Priya Sharma",
        "listing": "Forest School",
        "listingId": "lst-forestschool"
      },
      {
        "ref": "BK-8844",
        "pay": "Paid",
        "method": "Childcare vouchers",
        "amount": 150,
        "amountPaid": 150,
        "createdAt": "2026-08-01",
        "booker": "Emma Thompson",
        "listing": "Gymnastics Camp",
        "listingId": "lst-gymnastics"
      },
      {
        "ref": "BK-8845",
        "pay": "Unpaid",
        "method": "Invoice",
        "amount": 132,
        "amountPaid": 0,
        "createdAt": "2026-07-30",
        "booker": "Michael Brennan",
        "listing": "Football Camp",
        "listingId": "lst-football"
      },
      {
        "ref": "BK-8846",
        "pay": "Paid",
        "method": "Card",
        "amount": 320,
        "amountPaid": 320,
        "createdAt": "2026-08-08",
        "booker": "Laura Bennett",
        "listing": "Summer Holiday Camp",
        "listingId": "lst-holidaycamp"
      },
      {
        "ref": "BK-8847",
        "pay": "Paid",
        "method": "HAF (funded £0)",
        "amount": 0,
        "amountPaid": 0,
        "createdAt": "2026-08-06",
        "booker": "Kelly Adams",
        "listing": "Multi-Sports Camp",
        "listingId": "lst-multisports"
      },
      {
        "ref": "BK-8848",
        "pay": "Paid",
        "method": "Card",
        "amount": 165,
        "amountPaid": 165,
        "createdAt": "2026-07-27",
        "booker": "Hannah Clarke",
        "listing": "Multi-Sports Camp",
        "listingId": "lst-multisports"
      },
      {
        "ref": "BK-8849",
        "pay": "Paid",
        "method": "PayPal",
        "amount": 175,
        "amountPaid": 175,
        "createdAt": "2026-07-19",
        "booker": "Tom Richardson",
        "listing": "Forest School",
        "listingId": "lst-forestschool"
      },
      {
        "ref": "BK-8850",
        "pay": "Paid",
        "method": "Cash",
        "amount": 96,
        "amountPaid": 96,
        "createdAt": "2026-08-10",
        "booker": "Nadia Hussain",
        "listing": "Multi-Sports Camp",
        "listingId": "lst-multisports"
      },
      {
        "ref": "BK-8851",
        "pay": "Paid",
        "method": "Card",
        "amount": 288,
        "amountPaid": 288,
        "createdAt": "2026-07-10",
        "booker": "Rachel Green",
        "listing": "Gymnastics Camp",
        "listingId": "lst-gymnastics"
      },
      {
        "ref": "BK-8852",
        "pay": "Part paid",
        "method": "Bank transfer",
        "amount": 360,
        "amountPaid": 180,
        "createdAt": "2026-08-07",
        "booker": "Oliver Hunt",
        "listing": "Summer Holiday Camp",
        "listingId": "lst-holidaycamp"
      },
      {
        "ref": "BK-8853",
        "pay": "Paid",
        "method": "Card",
        "amount": 132,
        "amountPaid": 132,
        "createdAt": "2026-07-24",
        "booker": "Sophie Walker",
        "listing": "Football Camp",
        "listingId": "lst-football"
      }
    ],
    "/api/listings": [
      {
        "id": "lst-holidaycamp",
        "seasonId": "s-summer-hols"
      },
      {
        "id": "lst-multisports",
        "seasonId": "s-summer-hols"
      },
      {
        "id": "lst-gymnastics",
        "seasonId": "s-summer-hols"
      },
      {
        "id": "lst-forestschool",
        "seasonId": "s-summer-hols"
      },
      {
        "id": "lst-football",
        "seasonId": "s-summer-2"
      },
      {
        "id": "lst-afterschool",
        "seasonId": "s-autumn-1"
      }
    ],
    "/api/customers": [
      {
        "id": "cus-1",
        "name": "Sarah Whitfield",
        "email": "sarah.whitfield@gmail.com",
        "children": [
          {
            "name": "Olivia Whitfield"
          }
        ]
      },
      {
        "id": "cus-2",
        "name": "James Okafor",
        "email": "j.okafor@outlook.com",
        "children": [
          {
            "name": "Daniel Okafor"
          }
        ]
      },
      {
        "id": "cus-3",
        "name": "Priya Sharma",
        "email": "priya.sharma88@gmail.com",
        "children": [
          {
            "name": "Aarav Sharma"
          }
        ]
      },
      {
        "id": "cus-4",
        "name": "Emma Thompson",
        "email": "emma.t@hotmail.com",
        "children": [
          {
            "name": "Grace Thompson"
          }
        ]
      },
      {
        "id": "cus-5",
        "name": "Michael Brennan",
        "email": "m.brennan@gmail.com",
        "children": [
          {
            "name": "Jack Brennan"
          }
        ]
      },
      {
        "id": "cus-6",
        "name": "Laura Bennett",
        "email": "laura.bennett@gmail.com",
        "children": [
          {
            "name": "Sophie Bennett"
          },
          {
            "name": "Ethan Bennett"
          }
        ]
      },
      {
        "id": "cus-7",
        "name": "Hannah Clarke",
        "email": "hannah.clarke@gmail.com",
        "children": [
          {
            "name": "Ruby Clarke"
          }
        ]
      },
      {
        "id": "cus-8",
        "name": "Aisha Malik",
        "email": "aisha.malik@gmail.com",
        "children": [
          {
            "name": "Zara Malik"
          }
        ]
      },
      {
        "id": "cus-9",
        "name": "Tom Richardson",
        "email": "tom.richardson@gmail.com",
        "children": [
          {
            "name": "Noah Richardson"
          }
        ]
      }
    ],
    "/api/library": {
      "settings": {
        "billing": {
          "businessName": "Sunshine Sports & Camps",
          "defaultTaxRate": 0,
          "fields": {
            "poNumber": true,
            "accountRef": true,
            "customerAddress": true
          }
        },
        "seasons": [
          {
            "id": "s-summer-2",
            "name": "Summer 2"
          },
          {
            "id": "s-summer-hols",
            "name": "Summer Holidays"
          },
          {
            "id": "s-autumn-1",
            "name": "Autumn 1"
          },
          {
            "id": "s-oct-half",
            "name": "Oct Half Term"
          }
        ]
      },
      "childQuestions": []
    }
  },
  "staff": {
    "/api/me": {
      "role": "company",
      "tenantName": "Sunrise Active Camps"
    },
    "/api/invites": [
      {
        "token": "inv_9f3a1c7b2e8d4a6f0b5c9d2e7a1f4b8c",
        "role": "franchise",
        "createdAt": "2026-07-14T09:12:00.000Z",
        "usedBy": "franchise_leeds_north",
        "sentTo": "leedsnorth@sunriseactive.co.uk"
      },
      {
        "token": "inv_2b7e4d9a1f6c8035e2a4b7d1c9f0e3a6",
        "role": "franchise",
        "createdAt": "2026-07-22T14:35:00.000Z",
        "usedBy": null,
        "sentTo": "manchester.central@sunriseactive.co.uk"
      },
      {
        "token": "inv_5c1a8f3b7d2e9046a1b3c5d7e9f1a2b4",
        "role": "franchise",
        "createdAt": "2026-08-01T11:05:00.000Z",
        "usedBy": null,
        "sentTo": null
      },
      {
        "token": "inv_7d4b2a9c6f1e8350b2c4a6d8e0f2b4c6",
        "role": "staff",
        "createdAt": "2026-07-09T08:40:00.000Z",
        "usedBy": "staff_emma_richardson",
        "sentTo": "emma.richardson@sunriseactive.co.uk"
      },
      {
        "token": "inv_1a6c3e8b5d0f7924a3b5c7d9e1f3a5b7",
        "role": "staff",
        "createdAt": "2026-07-18T16:20:00.000Z",
        "usedBy": "staff_daniel_okafor",
        "sentTo": "daniel.okafor@sunriseactive.co.uk"
      },
      {
        "token": "inv_8e2b5d1a9c4f6738b1c3a5d7e9f0b2c4",
        "role": "staff",
        "createdAt": "2026-07-25T10:15:00.000Z",
        "usedBy": null,
        "sentTo": "sophie.turner@sunriseactive.co.uk"
      },
      {
        "token": "inv_3f9c1b7d4a2e8560c3a5b7d9e1f2a4b6",
        "role": "staff",
        "createdAt": "2026-07-31T13:50:00.000Z",
        "usedBy": null,
        "sentTo": "james.patel@gmail.com"
      },
      {
        "token": "inv_6b4d2f8a1c9e7350a2b4c6d8e0f1a3b5",
        "role": "staff",
        "createdAt": "2026-08-04T09:30:00.000Z",
        "usedBy": null,
        "sentTo": null
      },
      {
        "token": "inv_4c8e2a6f1b9d7350c1a3b5d7e9f0b2a4",
        "role": "staff",
        "createdAt": "2026-08-07T15:45:00.000Z",
        "usedBy": "staff_grace_bennett",
        "sentTo": "grace.bennett@sunriseactive.co.uk"
      },
      {
        "token": "inv_0d5b3f9c7a1e8462b0c2a4d6e8f1b3c5",
        "role": "staff",
        "createdAt": "2026-08-10T12:00:00.000Z",
        "usedBy": null,
        "sentTo": null
      }
    ]
  },
  "tasks": {
    "/api/me": {
      "role": "company",
      "name": "Jordan Blake",
      "email": "jordan@sunrisecamps.co.uk"
    },
    "/api/listings": [
      {
        "id": "lst_multisports",
        "title": "Multi-Sports Holiday Camp",
        "location": "Riverside Primary School"
      },
      {
        "id": "lst_football",
        "title": "Football Academy",
        "location": "Bedford Leisure Centre"
      },
      {
        "id": "lst_gymnastics",
        "title": "Gymnastics Camp",
        "location": "Kingsway Sports Hall"
      },
      {
        "id": "lst_forest",
        "title": "Forest School Adventures",
        "location": "Oakwood Country Park"
      },
      {
        "id": "lst_juniors",
        "title": "Junior Multi-Sports",
        "location": "Elmpark Community Centre"
      },
      {
        "id": "lst_dance",
        "title": "Dance & Drama Week",
        "location": "Kingsway Sports Hall"
      }
    ],
    "/api/bookings": [
      {
        "ref": "BK-2087",
        "booker": "Sarah Whitfield",
        "email": "sarah.whitfield@gmail.com",
        "phone": "07712 445880",
        "postcode": "MK40 2QR",
        "child": "Oliver Whitfield",
        "kids": [
          {
            "name": "Oliver Whitfield",
            "age": 8
          },
          {
            "name": "Emily Whitfield",
            "age": 6
          }
        ],
        "listing": "Multi-Sports Holiday Camp",
        "pass": "Full week",
        "dates": "10–14 Aug 2026"
      },
      {
        "ref": "BK-2086",
        "booker": "James Okafor",
        "email": "j.okafor@outlook.com",
        "phone": "07890 112233",
        "postcode": "MK42 8LN",
        "child": "Daniel Okafor",
        "kids": [
          {
            "name": "Daniel Okafor",
            "age": 10
          }
        ],
        "listing": "Football Academy",
        "pass": "3 days",
        "dates": "11–13 Aug 2026"
      },
      {
        "ref": "BK-2085",
        "booker": "Priya Sharma",
        "email": "priya.sharma88@gmail.com",
        "phone": "07455 667788",
        "postcode": "MK43 0PS",
        "child": "Aanya Sharma",
        "kids": [
          {
            "name": "Aanya Sharma",
            "age": 7
          },
          {
            "name": "Rohan Sharma",
            "age": 9
          }
        ],
        "listing": "Gymnastics Camp",
        "pass": "Full week",
        "dates": "10–14 Aug 2026"
      },
      {
        "ref": "BK-2084",
        "booker": "Emma Thompson",
        "email": "emma.t@hotmail.co.uk",
        "phone": "07701 334455",
        "postcode": "MK41 9RT",
        "child": "Sophie Thompson",
        "kids": [
          {
            "name": "Sophie Thompson",
            "age": 5
          }
        ],
        "listing": "Forest School Adventures",
        "pass": "2 days",
        "dates": "12–13 Aug 2026"
      },
      {
        "ref": "BK-2083",
        "booker": "Michael Barda",
        "email": "m.barda@gmail.com",
        "phone": "07966 778899",
        "postcode": "MK40 1DG",
        "child": "Leo Barda",
        "kids": [
          {
            "name": "Leo Barda",
            "age": 11
          },
          {
            "name": "Mia Barda",
            "age": 8
          }
        ],
        "listing": "Multi-Sports Holiday Camp",
        "pass": "Full week",
        "dates": "10–14 Aug 2026"
      },
      {
        "ref": "BK-2082",
        "booker": "Rebecca Nolan",
        "email": "becky.nolan@gmail.com",
        "phone": "07533 221100",
        "postcode": "MK44 3EH",
        "child": "Grace Nolan",
        "kids": [
          {
            "name": "Grace Nolan",
            "age": 9
          }
        ],
        "listing": "Dance & Drama Week",
        "pass": "Full week",
        "dates": "10–14 Aug 2026"
      },
      {
        "ref": "BK-2081",
        "booker": "David Chen",
        "email": "david.chen@yahoo.com",
        "phone": "07844 556677",
        "postcode": "MK42 7AB",
        "child": "Lucas Chen",
        "kids": [
          {
            "name": "Lucas Chen",
            "age": 6
          },
          {
            "name": "Chloe Chen",
            "age": 4
          }
        ],
        "listing": "Junior Multi-Sports",
        "pass": "Full week",
        "dates": "10–14 Aug 2026"
      },
      {
        "ref": "BK-2080",
        "booker": "Hannah Price",
        "email": "hannah.price@icloud.com",
        "phone": "07700 990011",
        "postcode": "MK45 2WQ",
        "child": "Isla Price",
        "kids": [
          {
            "name": "Isla Price",
            "age": 7
          }
        ],
        "listing": "Football Academy",
        "pass": "Full week",
        "dates": "10–14 Aug 2026"
      },
      {
        "ref": "BK-2079",
        "booker": "Tom Fletcher",
        "email": "tom.fletcher@gmail.com",
        "phone": "07922 445566",
        "postcode": "MK40 4JN",
        "child": "Harry Fletcher",
        "kids": [
          {
            "name": "Harry Fletcher",
            "age": 10
          },
          {
            "name": "Freya Fletcher",
            "age": 12
          }
        ],
        "listing": "Gymnastics Camp",
        "pass": "3 days",
        "dates": "11–13 Aug 2026"
      },
      {
        "ref": "BK-2078",
        "booker": "Sarah Whitfield",
        "email": "sarah.whitfield@gmail.com",
        "phone": "07712 445880",
        "postcode": "MK40 2QR",
        "child": "Oliver Whitfield",
        "kids": [
          {
            "name": "Oliver Whitfield",
            "age": 8
          }
        ],
        "listing": "Forest School Adventures",
        "pass": "1 day",
        "dates": "18 Aug 2026"
      }
    ],
    "/api/tasks": [
      {
        "id": "tsk_001",
        "t": "Call the Barda family — confirm Mia's inhaler is in her bag",
        "who": "Jordan Blake",
        "prio": "urgent",
        "due": "2026-08-08",
        "time": "09:30",
        "status": "prog",
        "link": {
          "k": "parent",
          "v": "Michael Barda",
          "href": "/company/families/BK-2083"
        },
        "cat": "Welfare",
        "labels": [
          "medical",
          "follow-up"
        ],
        "subs": [
          {
            "t": "Check medical form on file",
            "done": true
          },
          {
            "t": "Confirm inhaler received at drop-off",
            "done": false
          }
        ],
        "comments": [
          {
            "who": "Jess Whitmore",
            "body": "Left a voicemail this morning, no answer yet.",
            "when": "8 Aug, 10:12"
          }
        ],
        "atts": [
          {
            "name": "Mia-medical-form.pdf"
          }
        ],
        "createdByName": "Jess Whitmore",
        "calEventId": "cal_88a1"
      },
      {
        "id": "tsk_002",
        "t": "Chase outstanding balance — BK-2086 Okafor",
        "who": "Priya Patel",
        "prio": "high",
        "due": "2026-08-10",
        "time": null,
        "status": "todo",
        "link": {
          "k": "book",
          "v": "#BK-2086",
          "href": "/company/bookings/BK-2086"
        },
        "cat": "Finance",
        "labels": [
          "payment"
        ],
        "subs": [],
        "comments": [],
        "atts": []
      },
      {
        "id": "tsk_003",
        "t": "Print Week 2 registers for Multi-Sports",
        "who": "Jordan Blake",
        "prio": "high",
        "due": "2026-08-11",
        "time": "07:45",
        "status": "todo",
        "link": {
          "k": "list",
          "v": "Multi-Sports Holiday Camp",
          "href": "/company/listings/lst_multisports"
        },
        "cat": "Operations",
        "labels": [
          "registers"
        ],
        "subs": [
          {
            "t": "Print morning register",
            "done": false
          },
          {
            "t": "Print afternoon register",
            "done": false
          }
        ],
        "comments": [],
        "atts": []
      },
      {
        "id": "tsk_004",
        "t": "First-aid certificate expiring — renew before September",
        "who": "Jordan Blake",
        "prio": "urgent",
        "due": "2026-08-11",
        "time": null,
        "status": "prog",
        "link": {
          "k": "comp",
          "v": "First-aid — Sam Carter",
          "href": "/company/compliance"
        },
        "cat": "Compliance",
        "labels": [
          "staff",
          "expiring"
        ],
        "subs": [
          {
            "t": "Book renewal course",
            "done": true
          },
          {
            "t": "Upload new certificate",
            "done": false
          }
        ],
        "comments": [
          {
            "who": "Sam Carter",
            "body": "Course booked for 20th Aug.",
            "when": "9 Aug, 14:03"
          }
        ],
        "atts": [],
        "spawn": true,
        "calEventId": "cal_2f30"
      },
      {
        "id": "tsk_005",
        "t": "Restock first-aid kits at Riverside",
        "who": "Sam Carter",
        "prio": "med",
        "due": "2026-08-11",
        "time": "16:00",
        "status": "todo",
        "link": {
          "k": "venue",
          "v": "Riverside Primary School",
          "href": "/company/locations"
        },
        "cat": "Operations",
        "labels": [
          "inventory"
        ],
        "subs": [],
        "comments": []
      },
      {
        "id": "tsk_006",
        "t": "Welcome call to new family — Chen (first booking)",
        "who": "Jess Whitmore",
        "prio": "med",
        "due": "2026-08-12",
        "time": "11:00",
        "status": "todo",
        "link": {
          "k": "parent",
          "v": "David Chen",
          "href": "/company/families/BK-2081"
        },
        "cat": "Customer care",
        "labels": [
          "onboarding"
        ],
        "subs": [],
        "comments": []
      },
      {
        "id": "tsk_007",
        "t": "Confirm coach cover for Gymnastics — Liam off Thursday",
        "who": "Jordan Blake",
        "prio": "high",
        "due": "2026-08-13",
        "time": null,
        "status": "backlog",
        "link": {
          "k": "list",
          "v": "Gymnastics Camp",
          "href": "/company/listings/lst_gymnastics"
        },
        "cat": "Staffing",
        "labels": [
          "cover"
        ],
        "subs": [
          {
            "t": "Ask Chloe if free",
            "done": false
          },
          {
            "t": "Update ratios board",
            "done": false
          }
        ],
        "comments": []
      },
      {
        "id": "tsk_008",
        "t": "Order extra footballs and bibs for Academy",
        "who": "Liam O'Brien",
        "prio": "low",
        "due": "2026-08-14",
        "time": null,
        "status": "backlog",
        "link": {
          "k": "list",
          "v": "Football Academy",
          "href": "/company/listings/lst_football"
        },
        "cat": "Purchasing",
        "labels": [
          "equipment"
        ],
        "subs": [],
        "comments": []
      },
      {
        "id": "tsk_009",
        "t": "Risk assessment for Forest School site walk",
        "who": "",
        "prio": "high",
        "due": "2026-08-14",
        "time": "08:00",
        "status": "todo",
        "link": {
          "k": "comp",
          "v": "Forest School RA",
          "href": "/company/compliance"
        },
        "cat": "Compliance",
        "labels": [
          "safety",
          "unassigned"
        ],
        "subs": [
          {
            "t": "Walk the woodland boundary",
            "done": false
          },
          {
            "t": "Log hazards in system",
            "done": false
          }
        ],
        "comments": []
      },
      {
        "id": "tsk_010",
        "t": "Follow up on Sophie Thompson's dietary note (nut allergy)",
        "who": "Jess Whitmore",
        "prio": "urgent",
        "due": "2026-08-12",
        "time": null,
        "status": "todo",
        "link": {
          "k": "child",
          "v": "Sophie Thompson",
          "href": "/company/families/BK-2084"
        },
        "cat": "Welfare",
        "labels": [
          "allergy",
          "medical"
        ],
        "subs": [],
        "comments": [
          {
            "who": "Emma Thompson",
            "body": "Please make sure the kitchen knows — severe nut allergy.",
            "when": "10 Aug, 18:22"
          }
        ],
        "atts": []
      },
      {
        "id": "tsk_011",
        "t": "Send parent newsletter — Week 3 what's on",
        "who": "Priya Patel",
        "prio": "low",
        "due": "2026-08-18",
        "time": null,
        "status": "backlog",
        "link": {
          "k": "gen",
          "v": "Marketing"
        },
        "cat": "Marketing",
        "labels": [
          "newsletter"
        ],
        "subs": [],
        "comments": []
      },
      {
        "id": "tsk_012",
        "t": "Review photo consent for Dance & Drama group",
        "who": "",
        "prio": "med",
        "due": "2026-08-21",
        "time": null,
        "status": "backlog",
        "link": {
          "k": "list",
          "v": "Dance & Drama Week",
          "href": "/company/listings/lst_dance"
        },
        "cat": "Compliance",
        "labels": [
          "consent"
        ],
        "subs": [],
        "comments": []
      },
      {
        "id": "tsk_013",
        "t": "Plan Week 4 timetable and staff rota",
        "who": "Jordan Blake",
        "prio": "med",
        "due": null,
        "time": null,
        "status": "backlog",
        "link": {
          "k": "gen",
          "v": "Planning"
        },
        "cat": "Operations",
        "labels": [
          "rota"
        ],
        "subs": [
          {
            "t": "Draft timetable",
            "done": false
          },
          {
            "t": "Check staff availability",
            "done": false
          },
          {
            "t": "Publish to team",
            "done": false
          }
        ],
        "comments": []
      },
      {
        "id": "tsk_014",
        "t": "Debrief with Sam after incident report #INC-114",
        "who": "Jordan Blake",
        "prio": "high",
        "due": "2026-08-10",
        "time": "17:30",
        "status": "done",
        "link": {
          "k": "comp",
          "v": "Incident #INC-114",
          "href": "/company/incidents/INC-114"
        },
        "cat": "Welfare",
        "labels": [
          "incident"
        ],
        "subs": [
          {
            "t": "Read report",
            "done": true
          },
          {
            "t": "Meet Sam",
            "done": true
          }
        ],
        "comments": [
          {
            "who": "Jordan Blake",
            "body": "All resolved, parent informed and happy.",
            "when": "10 Aug, 18:00"
          }
        ],
        "atts": []
      },
      {
        "id": "tsk_015",
        "t": "Confirm minibus booking for Oakwood trip",
        "who": "Liam O'Brien",
        "prio": "med",
        "due": "2026-08-08",
        "time": null,
        "status": "done",
        "link": {
          "k": "venue",
          "v": "Oakwood Country Park",
          "href": "/company/locations"
        },
        "cat": "Operations",
        "labels": [
          "transport"
        ],
        "subs": [],
        "comments": []
      },
      {
        "id": "tsk_016",
        "t": "Update safeguarding policy for new term",
        "who": "Jordan Blake",
        "prio": "high",
        "due": "2026-08-04",
        "time": null,
        "status": "done",
        "link": {
          "k": "comp",
          "v": "Safeguarding policy",
          "href": "/company/compliance"
        },
        "cat": "Compliance",
        "labels": [
          "policy"
        ],
        "subs": [],
        "comments": [],
        "archived": true
      },
      {
        "id": "tsk_017",
        "t": "Archive Week 1 registers",
        "who": "Priya Patel",
        "prio": "low",
        "due": "2026-08-03",
        "time": null,
        "status": "done",
        "link": {
          "k": "gen",
          "v": "Operations"
        },
        "cat": "Operations",
        "labels": [],
        "subs": [],
        "comments": [],
        "archived": true
      }
    ]
  },
  "referrals": {
    "/api/referrals": {
      "enabled": true,
      "type": "amount",
      "friendOff": 5,
      "referrerReward": 10,
      "friendsBooked": 12,
      "rewardsPaid": 70,
      "referredRevenue": 1269,
      "friendDiscountTotal": 60,
      "rewardsIssued": 12,
      "rewardsRedeemed": 7,
      "outstandingCount": 5,
      "outstandingLiability": 50,
      "monthly": [
        {
          "label": "Jun",
          "count": 3,
          "revenue": 270
        },
        {
          "label": "Jul",
          "count": 5,
          "revenue": 615
        },
        {
          "label": "Aug",
          "count": 4,
          "revenue": 384
        }
      ],
      "leaderboard": [
        {
          "email": "sarah.thompson@gmail.com",
          "name": "Sarah Thompson",
          "count": 3,
          "reward": 30
        },
        {
          "email": "james.okafor@outlook.com",
          "name": "James Okafor",
          "count": 2,
          "reward": 20
        },
        {
          "email": "priya.patel@gmail.com",
          "name": "Priya Patel",
          "count": 2,
          "reward": 20
        },
        {
          "email": "hannah.williams@yahoo.co.uk",
          "name": "Hannah Williams",
          "count": 2,
          "reward": 20
        },
        {
          "email": "daniel.murphy@gmail.com",
          "name": "Daniel Murphy",
          "count": 2,
          "reward": 20
        },
        {
          "email": "chloe.bennett@icloud.com",
          "name": "Chloe Bennett",
          "count": 1,
          "reward": 10
        }
      ],
      "recent": [
        {
          "referrerEmail": "sarah.thompson@gmail.com",
          "referrerName": "Sarah Thompson",
          "friendEmail": "emma.clarke@gmail.com",
          "friendName": "Emma Clarke",
          "reward": 10,
          "friendOff": 5,
          "friendSpend": 96,
          "friendDiscount": 5,
          "type": "amount",
          "cap": null,
          "bookingRef": "BK-2081",
          "rewardRedeemed": false,
          "at": "2026-08-09T09:15:00.000Z",
          "viaCode": "SARAH-REF"
        },
        {
          "referrerEmail": "james.okafor@outlook.com",
          "referrerName": "James Okafor",
          "friendEmail": "olivia.reed@gmail.com",
          "friendName": "Olivia Reed",
          "reward": 10,
          "friendOff": 5,
          "friendSpend": 48,
          "friendDiscount": 5,
          "type": "amount",
          "cap": null,
          "bookingRef": "BK-2074",
          "rewardRedeemed": true,
          "at": "2026-08-06T14:40:00.000Z",
          "viaCode": "JAMES-REF"
        },
        {
          "referrerEmail": "priya.patel@gmail.com",
          "referrerName": "Priya Patel",
          "friendEmail": "lucas.grant@outlook.com",
          "friendName": "Lucas Grant",
          "reward": 10,
          "friendOff": 5,
          "friendSpend": 165,
          "friendDiscount": 5,
          "type": "amount",
          "cap": null,
          "bookingRef": "BK-2066",
          "rewardRedeemed": false,
          "at": "2026-08-03T11:05:00.000Z",
          "viaCode": "PRIYA-REF"
        },
        {
          "referrerEmail": "hannah.williams@yahoo.co.uk",
          "referrerName": "Hannah Williams",
          "friendEmail": "sophie.turner@gmail.com",
          "friendName": "Sophie Turner",
          "reward": 10,
          "friendOff": 5,
          "friendSpend": 105,
          "friendDiscount": 5,
          "type": "amount",
          "cap": null,
          "bookingRef": "BK-2059",
          "rewardRedeemed": true,
          "at": "2026-07-30T16:20:00.000Z",
          "viaCode": "HANNAH-REF"
        },
        {
          "referrerEmail": "daniel.murphy@gmail.com",
          "referrerName": "Daniel Murphy",
          "friendEmail": "george.harris@icloud.com",
          "friendName": "George Harris",
          "reward": 10,
          "friendOff": 5,
          "friendSpend": 60,
          "friendDiscount": 5,
          "type": "amount",
          "cap": null,
          "bookingRef": "BK-2048",
          "rewardRedeemed": false,
          "at": "2026-07-26T08:50:00.000Z",
          "viaCode": "DANIEL-REF"
        },
        {
          "referrerEmail": "sarah.thompson@gmail.com",
          "referrerName": "Sarah Thompson",
          "friendEmail": "isla.morgan@gmail.com",
          "friendName": "Isla Morgan",
          "reward": 10,
          "friendOff": 5,
          "friendSpend": 150,
          "friendDiscount": 5,
          "type": "amount",
          "cap": null,
          "bookingRef": "BK-2039",
          "rewardRedeemed": true,
          "at": "2026-07-22T13:10:00.000Z",
          "viaCode": "SARAH-REF"
        },
        {
          "referrerEmail": "chloe.bennett@icloud.com",
          "referrerName": "Chloe Bennett",
          "friendEmail": "noah.evans@gmail.com",
          "friendName": "Noah Evans",
          "reward": 10,
          "friendOff": 5,
          "friendSpend": 75,
          "friendDiscount": 5,
          "type": "amount",
          "cap": null,
          "bookingRef": null,
          "rewardRedeemed": false,
          "at": "2026-07-18T10:35:00.000Z",
          "viaCode": "CHLOE-REF"
        },
        {
          "referrerEmail": "james.okafor@outlook.com",
          "referrerName": "James Okafor",
          "friendEmail": "amelia.foster@yahoo.co.uk",
          "friendName": "Amelia Foster",
          "reward": 10,
          "friendOff": 5,
          "friendSpend": 120,
          "friendDiscount": 5,
          "type": "amount",
          "cap": null,
          "bookingRef": "BK-2021",
          "rewardRedeemed": true,
          "at": "2026-07-14T15:00:00.000Z",
          "viaCode": "JAMES-REF"
        },
        {
          "referrerEmail": "priya.patel@gmail.com",
          "referrerName": "Priya Patel",
          "friendEmail": "jacob.hughes@gmail.com",
          "friendName": "Jacob Hughes",
          "reward": 10,
          "friendOff": 5,
          "friendSpend": 180,
          "friendDiscount": 5,
          "type": "amount",
          "cap": null,
          "bookingRef": "BK-2013",
          "rewardRedeemed": true,
          "at": "2026-07-08T09:45:00.000Z",
          "viaCode": "PRIYA-REF"
        },
        {
          "referrerEmail": "hannah.williams@yahoo.co.uk",
          "referrerName": "Hannah Williams",
          "friendEmail": "mia.robinson@gmail.com",
          "friendName": "Mia Robinson",
          "reward": 10,
          "friendOff": 5,
          "friendSpend": 45,
          "friendDiscount": 5,
          "type": "amount",
          "cap": null,
          "bookingRef": "BK-1998",
          "rewardRedeemed": false,
          "at": "2026-06-28T12:25:00.000Z",
          "viaCode": "HANNAH-REF"
        },
        {
          "referrerEmail": "daniel.murphy@gmail.com",
          "referrerName": "Daniel Murphy",
          "friendEmail": "leo.walker@outlook.com",
          "friendName": "Leo Walker",
          "reward": 10,
          "friendOff": 5,
          "friendSpend": 135,
          "friendDiscount": 5,
          "type": "amount",
          "cap": null,
          "bookingRef": "BK-1985",
          "rewardRedeemed": true,
          "at": "2026-06-19T14:15:00.000Z",
          "viaCode": "DANIEL-REF"
        },
        {
          "referrerEmail": "sarah.thompson@gmail.com",
          "referrerName": "Sarah Thompson",
          "friendEmail": "ava.mitchell@gmail.com",
          "friendName": "Ava Mitchell",
          "reward": 10,
          "friendOff": 5,
          "friendSpend": 90,
          "friendDiscount": 5,
          "type": "amount",
          "cap": null,
          "bookingRef": "BK-1972",
          "rewardRedeemed": true,
          "at": "2026-06-11T10:00:00.000Z",
          "viaCode": "SARAH-REF"
        }
      ]
    }
  },
  "marketing": {
    "/api/listings": [
      {
        "id": "lst_multisports",
        "title": "Summer Multi-Sports Camp"
      },
      {
        "id": "lst_football",
        "title": "Football Academy — August"
      },
      {
        "id": "lst_gymnastics",
        "title": "Gymnastics Holiday Club"
      },
      {
        "id": "lst_forest",
        "title": "Forest School Adventure Days"
      },
      {
        "id": "lst_easter",
        "title": "Easter Holiday Camp"
      },
      {
        "id": "lst_swimming",
        "name": "Learn to Swim Intensive"
      }
    ],
    "/api/customers": [
      {
        "id": "cus_khan",
        "name": "Amara Khan",
        "email": "amara.khan@gmail.com"
      },
      {
        "id": "cus_patel",
        "name": "Rahul Patel",
        "email": "rahul.patel@outlook.com"
      },
      {
        "id": "cus_smith",
        "name": "Charlotte Smith",
        "email": "charlotte.smith@gmail.com"
      },
      {
        "id": "cus_obrien",
        "name": "Sean O'Brien",
        "email": "sean.obrien@hotmail.co.uk"
      },
      {
        "id": "cus_williams",
        "name": "Bethan Williams",
        "email": "bethan.williams@yahoo.co.uk"
      },
      {
        "id": "cus_johnson",
        "name": "Marcus Johnson",
        "email": "marcus.johnson@gmail.com"
      },
      {
        "id": "cus_ahmed",
        "name": "Yusuf Ahmed",
        "email": "yusuf.ahmed@gmail.com"
      },
      {
        "id": "cus_taylor",
        "name": "Emily Taylor",
        "email": "emily.taylor@icloud.com"
      },
      {
        "id": "cus_roberts",
        "name": "Gareth Roberts",
        "email": "gareth.roberts@gmail.com"
      },
      {
        "id": "cus_evans",
        "name": "Nia Evans",
        "email": "nia.evans@outlook.com"
      },
      {
        "id": "cus_okafor",
        "name": "Chidi Okafor",
        "email": "chidi.okafor@gmail.com"
      },
      {
        "id": "cus_nowak",
        "name": "Kasia Nowak",
        "email": "kasia.nowak@gmail.com"
      },
      {
        "id": "cus_murphy",
        "name": "Dervla Murphy",
        "email": "dervla.murphy@hotmail.com"
      }
    ],
    "/api/discounts/groups": [
      {
        "id": "grp_nhs",
        "name": "NHS parents",
        "emails": [
          "amara.khan@gmail.com",
          "yusuf.ahmed@gmail.com",
          "emily.taylor@icloud.com",
          "dervla.murphy@hotmail.com"
        ]
      },
      {
        "id": "grp_returning",
        "name": "Returning families 2025",
        "emails": [
          "rahul.patel@outlook.com",
          "charlotte.smith@gmail.com",
          "marcus.johnson@gmail.com",
          "gareth.roberts@gmail.com",
          "nia.evans@outlook.com"
        ]
      },
      {
        "id": "grp_stmarys",
        "name": "St Mary's School parents",
        "emails": [
          "sean.obrien@hotmail.co.uk",
          "bethan.williams@yahoo.co.uk",
          "chidi.okafor@gmail.com"
        ]
      }
    ],
    "/api/discounts": [
      {
        "id": "dsc_summer25",
        "code": "SUMMER25",
        "type": "percent",
        "value": 25,
        "minSpend": 60,
        "expiry": "2026-08-31",
        "usageLimit": 100,
        "usedCount": 63,
        "active": true,
        "perCustomerLimit": true
      },
      {
        "id": "dsc_earlybird",
        "code": "EARLYBIRD10",
        "type": "amount",
        "value": 10,
        "minSpend": 50,
        "expiry": "2026-08-25",
        "usageLimit": 50,
        "usedCount": 28,
        "active": true,
        "listingId": "lst_multisports"
      },
      {
        "id": "dsc_sibling",
        "code": "SIBLING5",
        "type": "perAttendee",
        "value": 5,
        "usageLimit": null,
        "usedCount": 47,
        "active": true,
        "exclusive": false
      },
      {
        "id": "dsc_khan2026",
        "code": "KHAN2026",
        "type": "percent",
        "value": 20,
        "expiry": "2026-09-30",
        "usageLimit": 1,
        "usedCount": 0,
        "active": true,
        "assignedTo": "amara.khan@gmail.com",
        "assignedName": "Amara Khan"
      },
      {
        "id": "dsc_nhs15",
        "code": "NHS15",
        "type": "percent",
        "value": 15,
        "minSpend": 40,
        "expiry": "2026-12-31",
        "usageLimit": 40,
        "usedCount": 12,
        "active": true,
        "assignedGroupId": "grp_nhs",
        "assignedGroupName": "NHS parents",
        "assignedEmails": [
          "amara.khan@gmail.com",
          "yusuf.ahmed@gmail.com",
          "emily.taylor@icloud.com",
          "dervla.murphy@hotmail.com"
        ],
        "perCustomerLimit": true
      },
      {
        "id": "dsc_footy20",
        "code": "FOOTY20",
        "type": "percent",
        "value": 20,
        "expiry": "2026-08-20",
        "usageLimit": 30,
        "usedCount": 30,
        "active": true,
        "listingId": "lst_football"
      },
      {
        "id": "dsc_welcome",
        "code": "WELCOME2026",
        "type": "amount",
        "value": 15,
        "minSpend": 75,
        "usageLimit": 200,
        "usedCount": 91,
        "active": true,
        "perCustomerLimit": true
      },
      {
        "id": "dsc_easter",
        "code": "EASTER30",
        "type": "percent",
        "value": 30,
        "expiry": "2026-04-18",
        "usageLimit": 60,
        "usedCount": 58,
        "active": false,
        "listingId": "lst_easter"
      },
      {
        "id": "dsc_forest",
        "code": "FOREST5",
        "type": "amount",
        "value": 5,
        "expiry": "2026-08-31",
        "usageLimit": 25,
        "usedCount": 9,
        "active": true,
        "listingId": "lst_forest",
        "exclusive": true
      },
      {
        "id": "dsc_returning",
        "code": "LOYAL10",
        "type": "percent",
        "value": 10,
        "minSpend": 30,
        "expiry": "2026-11-30",
        "usageLimit": 50,
        "usedCount": 22,
        "active": true,
        "assignedGroupId": "grp_returning",
        "assignedGroupName": "Returning families 2025",
        "assignedEmails": [
          "rahul.patel@outlook.com",
          "charlotte.smith@gmail.com",
          "marcus.johnson@gmail.com",
          "gareth.roberts@gmail.com",
          "nia.evans@outlook.com"
        ]
      },
      {
        "id": "dsc_gym",
        "code": "GYMFUN",
        "type": "perAttendee",
        "value": 7.5,
        "minSpend": 45,
        "usageLimit": 40,
        "usedCount": 16,
        "active": true,
        "listingId": "lst_gymnastics"
      },
      {
        "id": "dsc_flash",
        "code": "FLASH50",
        "type": "percent",
        "value": 50,
        "expiry": "2026-07-15",
        "usageLimit": 20,
        "usedCount": 20,
        "active": false
      },
      {
        "id": "dsc_patel",
        "code": "PATEL2026",
        "type": "amount",
        "value": 25,
        "expiry": "2026-10-31",
        "usageLimit": 1,
        "usedCount": 1,
        "active": true,
        "assignedTo": "rahul.patel@outlook.com",
        "assignedName": "Rahul Patel"
      }
    ]
  },
  "trips": {
    "/api/trips": [
      {
        "id": "trip-eureka-1108",
        "destination": "Eureka! The National Children's Museum",
        "address": "Discovery Rd, Halifax HX1 2NE",
        "date": "2026-08-11",
        "departTime": "08:45",
        "returnTime": "16:15",
        "listingId": "lst-multisports-hx",
        "transport": "Coach",
        "lead": "Sarah Whitcombe",
        "leadPhone": "07700 900412",
        "evc": "Helen Barford",
        "cost": "18.50",
        "offsiteRatio": 8,
        "itinerary": [
          {
            "t": "08:45",
            "a": "Depart base",
            "k": "Head-count on"
          },
          {
            "t": "09:30",
            "a": "Arrive at venue",
            "k": "Register taken"
          },
          {
            "t": "09:45",
            "a": "Welcome & safety briefing",
            "k": "Meeting-point reminder"
          },
          {
            "t": "10:30",
            "a": "Morning activity session",
            "k": "Water / hydration break"
          },
          {
            "t": "12:30",
            "a": "Lunch",
            "k": "Wash hands"
          },
          {
            "t": "13:30",
            "a": "Afternoon activity session",
            "k": "Apply sun cream / hats"
          },
          {
            "t": "15:00",
            "a": "Final head count & register",
            "k": "Head-count off"
          },
          {
            "t": "15:30",
            "a": "Travel back to base",
            "k": "Seatbelts checked"
          },
          {
            "t": "16:15",
            "a": "Handover to parents / carers",
            "k": "Confirm collection / password"
          }
        ],
        "kit": "Packed lunch, water bottle, sun cream, hat, weather-appropriate clothing, any medication.",
        "hazards": [
          {
            "h": "Transport / travel",
            "who": "All children & staff",
            "controls": "• Seatbelts on\n• Head-count on and off\n• First-aider on board\n• DBS-checked driver",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Lost / separated child",
            "who": "Children",
            "controls": "• Hi-vis vests\n• Agreed meeting point\n• Head-count at every leg\n• Buddy system",
            "initial": "H",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Road crossing / pedestrian",
            "who": "All",
            "controls": "• Use crossings\n• Staff front and back\n• Walk in pairs",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Weather / sun / heat",
            "who": "All",
            "controls": "• Sun cream\n• Hats & water\n• Shade breaks\n• Check forecast",
            "initial": "L",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Medical / allergies",
            "who": "Named children",
            "controls": "• Meds & care plans carried\n• First-aid kit\n• Emergency contacts to hand",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          }
        ],
        "raSigned": true,
        "raAssessor": "Sarah Whitcombe",
        "raDate": "2026-08-01",
        "raRef": "RA-2026-071",
        "raReview": "Reviewed before each run",
        "roster": [
          {
            "n": "Sarah Whitcombe",
            "r": "Trip lead",
            "fa": true
          },
          {
            "n": "Marcus Reilly",
            "r": "Activity leader",
            "fa": false
          },
          {
            "n": "Priya Nair",
            "r": "Activity leader",
            "fa": true
          }
        ],
        "attendees": [
          {
            "n": "Amelia Thornton",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Jacob Fielding",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Sofia Marchetti",
            "age": 9,
            "consent": "granted",
            "paid": true,
            "em": true,
            "med": "Asthma — inhaler",
            "sent": true
          },
          {
            "n": "Oliver Bennett",
            "age": 6,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Ruby Castellano",
            "age": 10,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Harry Dawson",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Isla Ferguson",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Noah Whitfield",
            "age": 9,
            "consent": "granted",
            "paid": true,
            "em": true,
            "med": "Nut allergy — EpiPen",
            "sent": true
          },
          {
            "n": "Freya Lindqvist",
            "age": 6,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Ethan Pardeep",
            "age": 11,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Grace Ashworth",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Leo Nakamura",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          }
        ],
        "checkpoints": [
          {
            "n": "Depart base",
            "counted": 12,
            "time": "08:45"
          },
          {
            "n": "Arrive venue",
            "counted": 12,
            "time": "09:32"
          },
          {
            "n": "Lunch / midpoint",
            "counted": 12,
            "time": "12:35"
          },
          {
            "n": "Before return",
            "counted": null
          },
          {
            "n": "Back at base",
            "counted": null
          }
        ],
        "signoff": {
          "approvedBy": "Helen Barford (Manager)",
          "approvedAt": "Fri 8 Aug 2026, 16:20",
          "submitted": true
        },
        "returned": false,
        "payBy": "2026-08-06",
        "parentMsgSentAt": "Wed 30 Jul 2026, 09:15",
        "askPay": true,
        "askConsent": true,
        "childNames": [
          "Amelia Thornton",
          "Jacob Fielding",
          "Sofia Marchetti",
          "Oliver Bennett",
          "Ruby Castellano",
          "Harry Dawson",
          "Isla Ferguson",
          "Noah Whitfield",
          "Freya Lindqvist",
          "Ethan Pardeep",
          "Grace Ashworth",
          "Leo Nakamura"
        ],
        "staff": [
          "Sarah Whitcombe",
          "Marcus Reilly",
          "Priya Nair"
        ],
        "headcount": 12,
        "consentObtained": true,
        "status": "planned",
        "createdByName": "Sarah Whitcombe"
      },
      {
        "id": "trip-forest-1414",
        "destination": "Hardcastle Crags Forest School",
        "address": "Hebden Bridge HX7 7AP",
        "date": "2026-08-14",
        "departTime": "08:45",
        "returnTime": "16:15",
        "listingId": "lst-forest-hx",
        "transport": "Minibus",
        "lead": "Sarah Whitcombe",
        "leadPhone": "07700 900412",
        "evc": "Helen Barford",
        "cost": "12.00",
        "offsiteRatio": 8,
        "itinerary": [
          {
            "t": "08:45",
            "a": "Depart base",
            "k": "Head-count on"
          },
          {
            "t": "09:30",
            "a": "Arrive at venue",
            "k": "Register taken"
          },
          {
            "t": "09:45",
            "a": "Welcome & safety briefing",
            "k": "Meeting-point reminder"
          },
          {
            "t": "10:30",
            "a": "Morning activity session",
            "k": "Water / hydration break"
          },
          {
            "t": "12:30",
            "a": "Lunch",
            "k": "Wash hands"
          },
          {
            "t": "13:30",
            "a": "Afternoon activity session",
            "k": "Apply sun cream / hats"
          },
          {
            "t": "15:00",
            "a": "Final head count & register",
            "k": "Head-count off"
          },
          {
            "t": "15:30",
            "a": "Travel back to base",
            "k": "Seatbelts checked"
          },
          {
            "t": "16:15",
            "a": "Handover to parents / carers",
            "k": "Confirm collection / password"
          }
        ],
        "kit": "Packed lunch, water bottle, sun cream, hat, weather-appropriate clothing, any medication.",
        "hazards": [
          {
            "h": "Transport / travel",
            "who": "All children & staff",
            "controls": "• Seatbelts on\n• Head-count on and off\n• First-aider on board\n• DBS-checked driver",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Lost / separated child",
            "who": "Children",
            "controls": "• Hi-vis vests\n• Agreed meeting point\n• Head-count at every leg\n• Buddy system",
            "initial": "H",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Road crossing / pedestrian",
            "who": "All",
            "controls": "• Use crossings\n• Staff front and back\n• Walk in pairs",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Weather / sun / heat",
            "who": "All",
            "controls": "• Sun cream\n• Hats & water\n• Shade breaks\n• Check forecast",
            "initial": "L",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Medical / allergies",
            "who": "Named children",
            "controls": "• Meds & care plans carried\n• First-aid kit\n• Emergency contacts to hand",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          }
        ],
        "raSigned": true,
        "raAssessor": "Sarah Whitcombe",
        "raDate": "2026-08-01",
        "raRef": "RA-2026-072",
        "raReview": "Reviewed before each run",
        "roster": [
          {
            "n": "Sarah Whitcombe",
            "r": "Trip lead",
            "fa": true
          },
          {
            "n": "Marcus Reilly",
            "r": "Activity leader",
            "fa": false
          },
          {
            "n": "Priya Nair",
            "r": "Activity leader",
            "fa": true
          }
        ],
        "attendees": [
          {
            "n": "Amelia Thornton",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Ruby Castellano",
            "age": 10,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Isla Ferguson",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Grace Ashworth",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Leo Nakamura",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Oliver Bennett",
            "age": 6,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Harry Dawson",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Sofia Marchetti",
            "age": 9,
            "consent": "granted",
            "paid": true,
            "em": true,
            "med": "Asthma — inhaler",
            "sent": true
          },
          {
            "n": "Mia Kowalski",
            "age": 9,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Charlie Beaumont",
            "age": 6,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          }
        ],
        "checkpoints": [
          {
            "n": "Depart base",
            "counted": null
          },
          {
            "n": "Arrive venue",
            "counted": null
          },
          {
            "n": "Lunch / midpoint",
            "counted": null
          },
          {
            "n": "Before return",
            "counted": null
          },
          {
            "n": "Back at base",
            "counted": null
          }
        ],
        "signoff": {
          "approvedBy": "Helen Barford (Manager)",
          "approvedAt": "Sat 9 Aug 2026, 11:05",
          "submitted": true
        },
        "returned": false,
        "payBy": "2026-08-11",
        "parentMsgSentAt": "Mon 4 Aug 2026, 14:40",
        "askPay": true,
        "askConsent": true,
        "childNames": [
          "Amelia Thornton",
          "Ruby Castellano",
          "Isla Ferguson",
          "Grace Ashworth",
          "Leo Nakamura",
          "Oliver Bennett",
          "Harry Dawson",
          "Sofia Marchetti",
          "Mia Kowalski",
          "Charlie Beaumont"
        ],
        "staff": [
          "Sarah Whitcombe",
          "Marcus Reilly",
          "Priya Nair"
        ],
        "headcount": 10,
        "consentObtained": true,
        "status": "planned",
        "createdByName": "Sarah Whitcombe"
      },
      {
        "id": "trip-yorkwildlife-1817",
        "destination": "Yorkshire Wildlife Park",
        "address": "Branton, Doncaster DN9 3QN",
        "date": "2026-08-18",
        "departTime": "08:30",
        "returnTime": "17:00",
        "listingId": "lst-holidaycamp-le",
        "transport": "Coach",
        "lead": "Sarah Whitcombe",
        "leadPhone": "07700 900412",
        "evc": "Helen Barford",
        "cost": "24.00",
        "offsiteRatio": 8,
        "itinerary": [
          {
            "t": "08:45",
            "a": "Depart base",
            "k": "Head-count on"
          },
          {
            "t": "09:30",
            "a": "Arrive at venue",
            "k": "Register taken"
          },
          {
            "t": "09:45",
            "a": "Welcome & safety briefing",
            "k": "Meeting-point reminder"
          },
          {
            "t": "10:30",
            "a": "Morning activity session",
            "k": "Water / hydration break"
          },
          {
            "t": "12:30",
            "a": "Lunch",
            "k": "Wash hands"
          },
          {
            "t": "13:30",
            "a": "Afternoon activity session",
            "k": "Apply sun cream / hats"
          },
          {
            "t": "15:00",
            "a": "Final head count & register",
            "k": "Head-count off"
          },
          {
            "t": "15:30",
            "a": "Travel back to base",
            "k": "Seatbelts checked"
          },
          {
            "t": "16:15",
            "a": "Handover to parents / carers",
            "k": "Confirm collection / password"
          }
        ],
        "kit": "Packed lunch, water bottle, sun cream, hat, weather-appropriate clothing, any medication.",
        "hazards": [
          {
            "h": "Transport / travel",
            "who": "All children & staff",
            "controls": "• Seatbelts on\n• Head-count on and off\n• First-aider on board\n• DBS-checked driver",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Lost / separated child",
            "who": "Children",
            "controls": "• Hi-vis vests\n• Agreed meeting point\n• Head-count at every leg\n• Buddy system",
            "initial": "H",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Road crossing / pedestrian",
            "who": "All",
            "controls": "• Use crossings\n• Staff front and back\n• Walk in pairs",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Weather / sun / heat",
            "who": "All",
            "controls": "• Sun cream\n• Hats & water\n• Shade breaks\n• Check forecast",
            "initial": "L",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Medical / allergies",
            "who": "Named children",
            "controls": "• Meds & care plans carried\n• First-aid kit\n• Emergency contacts to hand",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          }
        ],
        "raSigned": true,
        "raAssessor": "Sarah Whitcombe",
        "raDate": "2026-08-01",
        "raRef": "RA-2026-073",
        "raReview": "Reviewed before each run",
        "roster": [
          {
            "n": "Sarah Whitcombe",
            "r": "Trip lead",
            "fa": true
          },
          {
            "n": "Marcus Reilly",
            "r": "Activity leader",
            "fa": false
          },
          {
            "n": "Priya Nair",
            "r": "Activity leader",
            "fa": true
          },
          {
            "n": "Daniel Okafor",
            "r": "Activity leader",
            "fa": false
          }
        ],
        "attendees": [
          {
            "n": "Ethan Pardeep",
            "age": 11,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Freya Lindqvist",
            "age": 6,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Noah Whitfield",
            "age": 9,
            "consent": "granted",
            "paid": true,
            "em": true,
            "med": "Nut allergy — EpiPen",
            "sent": true
          },
          {
            "n": "Jacob Fielding",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Amelia Thornton",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Ruby Castellano",
            "age": 10,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Mia Kowalski",
            "age": 9,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Charlie Beaumont",
            "age": 6,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Grace Ashworth",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Leo Nakamura",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Isla Ferguson",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Harry Dawson",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Oliver Bennett",
            "age": 6,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Sofia Marchetti",
            "age": 9,
            "consent": "granted",
            "paid": true,
            "em": true,
            "med": "Asthma — inhaler",
            "sent": true
          }
        ],
        "checkpoints": [
          {
            "n": "Depart base",
            "counted": null
          },
          {
            "n": "Arrive venue",
            "counted": null
          },
          {
            "n": "Lunch / midpoint",
            "counted": null
          },
          {
            "n": "Before return",
            "counted": null
          },
          {
            "n": "Back at base",
            "counted": null
          }
        ],
        "signoff": {},
        "returned": false,
        "payBy": "2026-08-15",
        "parentMsgSentAt": "Fri 8 Aug 2026, 10:00",
        "askPay": true,
        "askConsent": true,
        "childNames": [
          "Ethan Pardeep",
          "Freya Lindqvist",
          "Noah Whitfield",
          "Jacob Fielding",
          "Amelia Thornton",
          "Ruby Castellano",
          "Mia Kowalski",
          "Charlie Beaumont",
          "Grace Ashworth",
          "Leo Nakamura",
          "Isla Ferguson",
          "Harry Dawson",
          "Oliver Bennett",
          "Sofia Marchetti"
        ],
        "staff": [
          "Sarah Whitcombe",
          "Marcus Reilly",
          "Priya Nair",
          "Daniel Okafor"
        ],
        "headcount": 14,
        "consentObtained": true,
        "status": "planned",
        "createdByName": "Sarah Whitcombe"
      },
      {
        "id": "trip-magna-2020",
        "destination": "Magna Science Adventure Centre",
        "address": "Sheffield Rd, Rotherham S60 1FD",
        "date": "2026-08-20",
        "departTime": "08:45",
        "returnTime": "16:15",
        "listingId": "lst-multisports-hx",
        "transport": "Coach",
        "lead": "Sarah Whitcombe",
        "leadPhone": "07700 900412",
        "evc": "Helen Barford",
        "cost": "16.50",
        "offsiteRatio": 8,
        "itinerary": [
          {
            "t": "08:45",
            "a": "Depart base",
            "k": "Head-count on"
          },
          {
            "t": "09:30",
            "a": "Arrive at venue",
            "k": "Register taken"
          },
          {
            "t": "09:45",
            "a": "Welcome & safety briefing",
            "k": "Meeting-point reminder"
          },
          {
            "t": "10:30",
            "a": "Morning activity session",
            "k": "Water / hydration break"
          },
          {
            "t": "12:30",
            "a": "Lunch",
            "k": "Wash hands"
          },
          {
            "t": "13:30",
            "a": "Afternoon activity session",
            "k": "Apply sun cream / hats"
          },
          {
            "t": "15:00",
            "a": "Final head count & register",
            "k": "Head-count off"
          },
          {
            "t": "15:30",
            "a": "Travel back to base",
            "k": "Seatbelts checked"
          },
          {
            "t": "16:15",
            "a": "Handover to parents / carers",
            "k": "Confirm collection / password"
          }
        ],
        "kit": "Packed lunch, water bottle, sun cream, hat, weather-appropriate clothing, any medication.",
        "hazards": [
          {
            "h": "Transport / travel",
            "who": "All children & staff",
            "controls": "• Seatbelts on\n• Head-count on and off\n• First-aider on board\n• DBS-checked driver",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Lost / separated child",
            "who": "Children",
            "controls": "• Hi-vis vests\n• Agreed meeting point\n• Head-count at every leg\n• Buddy system",
            "initial": "H",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Road crossing / pedestrian",
            "who": "All",
            "controls": "• Use crossings\n• Staff front and back\n• Walk in pairs",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Weather / sun / heat",
            "who": "All",
            "controls": "• Sun cream\n• Hats & water\n• Shade breaks\n• Check forecast",
            "initial": "L",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Medical / allergies",
            "who": "Named children",
            "controls": "• Meds & care plans carried\n• First-aid kit\n• Emergency contacts to hand",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          }
        ],
        "raSigned": true,
        "raAssessor": "Sarah Whitcombe",
        "raDate": "2026-08-01",
        "raRef": "RA-2026-074",
        "raReview": "Reviewed before each run",
        "roster": [
          {
            "n": "Sarah Whitcombe",
            "r": "Trip lead",
            "fa": true
          },
          {
            "n": "Marcus Reilly",
            "r": "Activity leader",
            "fa": false
          },
          {
            "n": "Priya Nair",
            "r": "Activity leader",
            "fa": true
          }
        ],
        "attendees": [
          {
            "n": "Amelia Thornton",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Jacob Fielding",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Ruby Castellano",
            "age": 10,
            "consent": "granted",
            "paid": false,
            "em": true,
            "sent": true
          },
          {
            "n": "Oliver Bennett",
            "age": 6,
            "consent": "pending",
            "paid": false,
            "em": true,
            "sent": true
          },
          {
            "n": "Harry Dawson",
            "age": 8,
            "consent": "pending",
            "paid": false,
            "em": false,
            "sent": true
          },
          {
            "n": "Isla Ferguson",
            "age": 7,
            "consent": "pending",
            "paid": false,
            "em": true,
            "sent": true
          },
          {
            "n": "Grace Ashworth",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Leo Nakamura",
            "age": 7,
            "consent": "declined",
            "paid": false,
            "em": true
          },
          {
            "n": "Mia Kowalski",
            "age": 9,
            "consent": "granted",
            "paid": false,
            "em": true,
            "sent": true
          },
          {
            "n": "Charlie Beaumont",
            "age": 6,
            "consent": "pending",
            "paid": false,
            "em": true,
            "sent": true
          }
        ],
        "checkpoints": [
          {
            "n": "Depart base",
            "counted": null
          },
          {
            "n": "Arrive venue",
            "counted": null
          },
          {
            "n": "Lunch / midpoint",
            "counted": null
          },
          {
            "n": "Before return",
            "counted": null
          },
          {
            "n": "Back at base",
            "counted": null
          }
        ],
        "signoff": {},
        "returned": false,
        "payBy": "2026-08-17",
        "parentMsgSentAt": "Sat 9 Aug 2026, 18:30",
        "askPay": true,
        "askConsent": true,
        "childNames": [
          "Amelia Thornton",
          "Jacob Fielding",
          "Ruby Castellano",
          "Grace Ashworth",
          "Mia Kowalski"
        ],
        "staff": [
          "Sarah Whitcombe",
          "Marcus Reilly",
          "Priya Nair"
        ],
        "headcount": 5,
        "consentObtained": false,
        "status": "planned",
        "createdByName": "Sarah Whitcombe"
      },
      {
        "id": "trip-lightwater-2525",
        "destination": "Lightwater Valley Family Adventure Park",
        "address": "North Stainley, Ripon HG4 3HT",
        "date": "2026-08-25",
        "departTime": "08:45",
        "returnTime": "16:15",
        "listingId": "lst-holidaycamp-le",
        "transport": "Minibus",
        "lead": "Marcus Reilly",
        "leadPhone": "07700 900733",
        "evc": "Helen Barford",
        "cost": "22.00",
        "offsiteRatio": 8,
        "itinerary": [
          {
            "t": "08:45",
            "a": "Depart base",
            "k": "Head-count on"
          },
          {
            "t": "09:30",
            "a": "Arrive at venue",
            "k": "Register taken"
          },
          {
            "t": "09:45",
            "a": "Welcome & safety briefing",
            "k": "Meeting-point reminder"
          },
          {
            "t": "10:30",
            "a": "Morning activity session",
            "k": "Water / hydration break"
          },
          {
            "t": "12:30",
            "a": "Lunch",
            "k": "Wash hands"
          },
          {
            "t": "13:30",
            "a": "Afternoon activity session",
            "k": "Apply sun cream / hats"
          },
          {
            "t": "15:00",
            "a": "Final head count & register",
            "k": "Head-count off"
          },
          {
            "t": "15:30",
            "a": "Travel back to base",
            "k": "Seatbelts checked"
          },
          {
            "t": "16:15",
            "a": "Handover to parents / carers",
            "k": "Confirm collection / password"
          }
        ],
        "kit": "Packed lunch, water bottle, sun cream, hat, weather-appropriate clothing, any medication.",
        "hazards": [
          {
            "h": "Transport / travel",
            "who": "All children & staff",
            "controls": "• Seatbelts on\n• Head-count on and off\n• First-aider on board",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-08",
            "amendedBy": "Marcus Reilly"
          },
          {
            "h": "Lost / separated child",
            "who": "Children",
            "controls": "• Hi-vis vests\n• Agreed meeting point\n• Buddy system",
            "initial": "H",
            "residual": "L",
            "done": false,
            "amendedOn": "2026-08-08",
            "amendedBy": "Marcus Reilly"
          },
          {
            "h": "Water safety",
            "who": "Children near water",
            "controls": "• Count in and out of water\n• Lifeguard present\n• No deep water",
            "initial": "H",
            "residual": "",
            "done": false
          },
          {
            "h": "Weather / sun / heat",
            "who": "All",
            "controls": "• Sun cream\n• Hats & water\n• Shade breaks",
            "initial": "L",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-08",
            "amendedBy": "Marcus Reilly"
          }
        ],
        "raSigned": false,
        "raAssessor": "",
        "raDate": "2026-08-08",
        "raReview": "Reviewed before each run",
        "roster": [
          {
            "n": "Marcus Reilly",
            "r": "Trip lead",
            "fa": false
          }
        ],
        "attendees": [
          {
            "n": "Ethan Pardeep",
            "age": 11,
            "consent": "granted",
            "paid": false,
            "em": true,
            "sent": true
          },
          {
            "n": "Freya Lindqvist",
            "age": 6,
            "consent": "granted",
            "paid": false,
            "em": true,
            "sent": true
          },
          {
            "n": "Noah Whitfield",
            "age": 9,
            "consent": "granted",
            "paid": false,
            "em": true,
            "med": "Nut allergy — EpiPen",
            "sent": true
          },
          {
            "n": "Mia Kowalski",
            "age": 9,
            "consent": "pending",
            "paid": false,
            "em": true
          },
          {
            "n": "Charlie Beaumont",
            "age": 6,
            "consent": "pending",
            "paid": false,
            "em": true
          },
          {
            "n": "Sofia Marchetti",
            "age": 9,
            "consent": "pending",
            "paid": false,
            "em": true,
            "med": "Asthma — inhaler"
          },
          {
            "n": "Amelia Thornton",
            "age": 8,
            "consent": "granted",
            "paid": false,
            "em": true,
            "sent": true
          },
          {
            "n": "Jacob Fielding",
            "age": 7,
            "consent": "pending",
            "paid": false,
            "em": true
          },
          {
            "n": "Ruby Castellano",
            "age": 10,
            "consent": "granted",
            "paid": false,
            "em": true,
            "sent": true
          }
        ],
        "checkpoints": [
          {
            "n": "Depart base",
            "counted": null
          },
          {
            "n": "Arrive venue",
            "counted": null
          },
          {
            "n": "Lunch / midpoint",
            "counted": null
          },
          {
            "n": "Before return",
            "counted": null
          },
          {
            "n": "Back at base",
            "counted": null
          }
        ],
        "signoff": {},
        "returned": false,
        "payBy": "2026-08-22",
        "askPay": true,
        "askConsent": true,
        "childNames": [
          "Ethan Pardeep",
          "Freya Lindqvist",
          "Noah Whitfield",
          "Amelia Thornton",
          "Ruby Castellano"
        ],
        "staff": [
          "Marcus Reilly"
        ],
        "headcount": 5,
        "consentObtained": false,
        "status": "planned",
        "createdByName": "Marcus Reilly"
      },
      {
        "id": "trip-natlmedia-0729",
        "destination": "National Science & Media Museum",
        "address": "Little Horton Ln, Bradford BD1 1NQ",
        "date": "2026-07-29",
        "departTime": "08:45",
        "returnTime": "16:15",
        "listingId": "lst-multisports-hx",
        "transport": "Coach",
        "lead": "Sarah Whitcombe",
        "leadPhone": "07700 900412",
        "evc": "Helen Barford",
        "cost": "14.00",
        "offsiteRatio": 8,
        "itinerary": [
          {
            "t": "08:45",
            "a": "Depart base",
            "k": "Head-count on"
          },
          {
            "t": "09:30",
            "a": "Arrive at venue",
            "k": "Register taken"
          },
          {
            "t": "09:45",
            "a": "Welcome & safety briefing",
            "k": "Meeting-point reminder"
          },
          {
            "t": "10:30",
            "a": "Morning activity session",
            "k": "Water / hydration break"
          },
          {
            "t": "12:30",
            "a": "Lunch",
            "k": "Wash hands"
          },
          {
            "t": "13:30",
            "a": "Afternoon activity session",
            "k": "Apply sun cream / hats"
          },
          {
            "t": "15:00",
            "a": "Final head count & register",
            "k": "Head-count off"
          },
          {
            "t": "15:30",
            "a": "Travel back to base",
            "k": "Seatbelts checked"
          },
          {
            "t": "16:15",
            "a": "Handover to parents / carers",
            "k": "Confirm collection / password"
          }
        ],
        "kit": "Packed lunch, water bottle, sun cream, hat, weather-appropriate clothing, any medication.",
        "hazards": [
          {
            "h": "Transport / travel",
            "who": "All children & staff",
            "controls": "• Seatbelts on\n• Head-count on and off\n• First-aider on board\n• DBS-checked driver",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Lost / separated child",
            "who": "Children",
            "controls": "• Hi-vis vests\n• Agreed meeting point\n• Head-count at every leg\n• Buddy system",
            "initial": "H",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Road crossing / pedestrian",
            "who": "All",
            "controls": "• Use crossings\n• Staff front and back\n• Walk in pairs",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Weather / sun / heat",
            "who": "All",
            "controls": "• Sun cream\n• Hats & water\n• Shade breaks\n• Check forecast",
            "initial": "L",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Medical / allergies",
            "who": "Named children",
            "controls": "• Meds & care plans carried\n• First-aid kit\n• Emergency contacts to hand",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          }
        ],
        "raSigned": true,
        "raAssessor": "Sarah Whitcombe",
        "raDate": "2026-08-01",
        "raRef": "RA-2026-061",
        "raReview": "Reviewed before each run",
        "roster": [
          {
            "n": "Sarah Whitcombe",
            "r": "Trip lead",
            "fa": true
          },
          {
            "n": "Marcus Reilly",
            "r": "Activity leader",
            "fa": false
          },
          {
            "n": "Priya Nair",
            "r": "Activity leader",
            "fa": true
          }
        ],
        "attendees": [
          {
            "n": "Amelia Thornton",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Jacob Fielding",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Sofia Marchetti",
            "age": 9,
            "consent": "granted",
            "paid": true,
            "em": true,
            "med": "Asthma — inhaler",
            "sent": true
          },
          {
            "n": "Oliver Bennett",
            "age": 6,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Ruby Castellano",
            "age": 10,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Harry Dawson",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Isla Ferguson",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Grace Ashworth",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Leo Nakamura",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Mia Kowalski",
            "age": 9,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          }
        ],
        "checkpoints": [
          {
            "n": "Depart base",
            "counted": 10,
            "time": "08:45"
          },
          {
            "n": "Arrive venue",
            "counted": 10,
            "time": "09:32"
          },
          {
            "n": "Lunch / midpoint",
            "counted": 10,
            "time": "12:35"
          },
          {
            "n": "Before return",
            "counted": 10,
            "time": "15:05"
          },
          {
            "n": "Back at base",
            "counted": 10,
            "time": "16:18"
          }
        ],
        "signoff": {
          "approvedBy": "Helen Barford (Manager)",
          "approvedAt": "Fri 25 Jul 2026, 15:10",
          "submitted": true
        },
        "returned": true,
        "payBy": "2026-07-24",
        "parentMsgSentAt": "Mon 21 Jul 2026, 09:00",
        "askPay": true,
        "askConsent": true,
        "childNames": [
          "Amelia Thornton",
          "Jacob Fielding",
          "Sofia Marchetti",
          "Oliver Bennett",
          "Ruby Castellano",
          "Harry Dawson",
          "Isla Ferguson",
          "Grace Ashworth",
          "Leo Nakamura",
          "Mia Kowalski"
        ],
        "staff": [
          "Sarah Whitcombe",
          "Marcus Reilly",
          "Priya Nair"
        ],
        "headcount": 10,
        "consentObtained": true,
        "notes": "Great day. Lower-school children flagged for a shorter afternoon next time. No incidents; all children handed back to named adults.",
        "status": "completed",
        "createdByName": "Sarah Whitcombe"
      },
      {
        "id": "trip-brimham-0805",
        "destination": "Brimham Rocks (National Trust)",
        "address": "Summerbridge, Harrogate HG3 4DW",
        "date": "2026-08-05",
        "departTime": "08:45",
        "returnTime": "16:15",
        "listingId": "lst-forest-hx",
        "transport": "Minibus",
        "lead": "Priya Nair",
        "leadPhone": "07700 900588",
        "evc": "Helen Barford",
        "cost": "9.50",
        "offsiteRatio": 8,
        "itinerary": [
          {
            "t": "08:45",
            "a": "Depart base",
            "k": "Head-count on"
          },
          {
            "t": "09:30",
            "a": "Arrive at venue",
            "k": "Register taken"
          },
          {
            "t": "09:45",
            "a": "Welcome & safety briefing",
            "k": "Meeting-point reminder"
          },
          {
            "t": "10:30",
            "a": "Morning activity session",
            "k": "Water / hydration break"
          },
          {
            "t": "12:30",
            "a": "Lunch",
            "k": "Wash hands"
          },
          {
            "t": "13:30",
            "a": "Afternoon activity session",
            "k": "Apply sun cream / hats"
          },
          {
            "t": "15:00",
            "a": "Final head count & register",
            "k": "Head-count off"
          },
          {
            "t": "15:30",
            "a": "Travel back to base",
            "k": "Seatbelts checked"
          },
          {
            "t": "16:15",
            "a": "Handover to parents / carers",
            "k": "Confirm collection / password"
          }
        ],
        "kit": "Packed lunch, water bottle, sun cream, hat, weather-appropriate clothing, any medication.",
        "hazards": [
          {
            "h": "Transport / travel",
            "who": "All children & staff",
            "controls": "• Seatbelts on\n• Head-count on and off\n• First-aider on board\n• DBS-checked driver",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Lost / separated child",
            "who": "Children",
            "controls": "• Hi-vis vests\n• Agreed meeting point\n• Head-count at every leg\n• Buddy system",
            "initial": "H",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Road crossing / pedestrian",
            "who": "All",
            "controls": "• Use crossings\n• Staff front and back\n• Walk in pairs",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Weather / sun / heat",
            "who": "All",
            "controls": "• Sun cream\n• Hats & water\n• Shade breaks\n• Check forecast",
            "initial": "L",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Medical / allergies",
            "who": "Named children",
            "controls": "• Meds & care plans carried\n• First-aid kit\n• Emergency contacts to hand",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          }
        ],
        "raSigned": true,
        "raAssessor": "Sarah Whitcombe",
        "raDate": "2026-08-01",
        "raRef": "RA-2026-066",
        "raReview": "Reviewed before each run",
        "roster": [
          {
            "n": "Sarah Whitcombe",
            "r": "Trip lead",
            "fa": true
          },
          {
            "n": "Marcus Reilly",
            "r": "Activity leader",
            "fa": false
          },
          {
            "n": "Priya Nair",
            "r": "Activity leader",
            "fa": true
          }
        ],
        "attendees": [
          {
            "n": "Freya Lindqvist",
            "age": 6,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Ethan Pardeep",
            "age": 11,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Grace Ashworth",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Leo Nakamura",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Charlie Beaumont",
            "age": 6,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Mia Kowalski",
            "age": 9,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Harry Dawson",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Isla Ferguson",
            "age": 7,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          }
        ],
        "checkpoints": [
          {
            "n": "Depart base",
            "counted": 8,
            "time": "08:45"
          },
          {
            "n": "Arrive venue",
            "counted": 8,
            "time": "09:32"
          },
          {
            "n": "Lunch / midpoint",
            "counted": 8,
            "time": "12:35"
          },
          {
            "n": "Before return",
            "counted": 8,
            "time": "15:05"
          },
          {
            "n": "Back at base",
            "counted": 8,
            "time": "16:18"
          }
        ],
        "signoff": {
          "approvedBy": "Helen Barford (Manager)",
          "approvedAt": "Fri 1 Aug 2026, 16:45",
          "submitted": true
        },
        "returned": true,
        "payBy": "2026-07-31",
        "parentMsgSentAt": "Tue 29 Jul 2026, 10:20",
        "askPay": true,
        "askConsent": true,
        "childNames": [
          "Freya Lindqvist",
          "Ethan Pardeep",
          "Grace Ashworth",
          "Leo Nakamura",
          "Charlie Beaumont",
          "Mia Kowalski",
          "Harry Dawson",
          "Isla Ferguson"
        ],
        "staff": [
          "Sarah Whitcombe",
          "Marcus Reilly",
          "Priya Nair"
        ],
        "headcount": 8,
        "consentObtained": true,
        "notes": "Weather held. One grazed knee (first aid given, parent informed). Excellent engagement at the scramble area.",
        "status": "completed",
        "createdByName": "Priya Nair"
      },
      {
        "id": "trip-tropical-1515",
        "destination": "Tropical World Roundhay",
        "address": "Princes Ave, Leeds LS8 2ER",
        "date": "2026-08-15",
        "departTime": "08:45",
        "returnTime": "16:15",
        "listingId": "lst-holidaycamp-le",
        "transport": "Coach",
        "lead": "Sarah Whitcombe",
        "leadPhone": "07700 900412",
        "evc": "Helen Barford",
        "cost": "13.00",
        "offsiteRatio": 8,
        "itinerary": [
          {
            "t": "08:45",
            "a": "Depart base",
            "k": "Head-count on"
          },
          {
            "t": "09:30",
            "a": "Arrive at venue",
            "k": "Register taken"
          },
          {
            "t": "09:45",
            "a": "Welcome & safety briefing",
            "k": "Meeting-point reminder"
          },
          {
            "t": "10:30",
            "a": "Morning activity session",
            "k": "Water / hydration break"
          },
          {
            "t": "12:30",
            "a": "Lunch",
            "k": "Wash hands"
          },
          {
            "t": "13:30",
            "a": "Afternoon activity session",
            "k": "Apply sun cream / hats"
          },
          {
            "t": "15:00",
            "a": "Final head count & register",
            "k": "Head-count off"
          },
          {
            "t": "15:30",
            "a": "Travel back to base",
            "k": "Seatbelts checked"
          },
          {
            "t": "16:15",
            "a": "Handover to parents / carers",
            "k": "Confirm collection / password"
          }
        ],
        "kit": "Packed lunch, water bottle, sun cream, hat, weather-appropriate clothing, any medication.",
        "hazards": [
          {
            "h": "Transport / travel",
            "who": "All children & staff",
            "controls": "• Seatbelts on\n• Head-count on and off\n• First-aider on board\n• DBS-checked driver",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Lost / separated child",
            "who": "Children",
            "controls": "• Hi-vis vests\n• Agreed meeting point\n• Head-count at every leg\n• Buddy system",
            "initial": "H",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Road crossing / pedestrian",
            "who": "All",
            "controls": "• Use crossings\n• Staff front and back\n• Walk in pairs",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Weather / sun / heat",
            "who": "All",
            "controls": "• Sun cream\n• Hats & water\n• Shade breaks\n• Check forecast",
            "initial": "L",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          },
          {
            "h": "Medical / allergies",
            "who": "Named children",
            "controls": "• Meds & care plans carried\n• First-aid kit\n• Emergency contacts to hand",
            "initial": "M",
            "residual": "L",
            "done": true,
            "amendedOn": "2026-08-01",
            "amendedBy": "Sarah Whitcombe"
          }
        ],
        "raSigned": true,
        "raAssessor": "Sarah Whitcombe",
        "raDate": "2026-08-01",
        "raRef": "RA-2026-068",
        "raReview": "Reviewed before each run",
        "roster": [
          {
            "n": "Sarah Whitcombe",
            "r": "Trip lead",
            "fa": true
          },
          {
            "n": "Marcus Reilly",
            "r": "Activity leader",
            "fa": false
          },
          {
            "n": "Priya Nair",
            "r": "Activity leader",
            "fa": true
          }
        ],
        "attendees": [
          {
            "n": "Amelia Thornton",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Ruby Castellano",
            "age": 10,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          },
          {
            "n": "Oliver Bennett",
            "age": 6,
            "consent": "granted",
            "paid": false,
            "em": true,
            "sent": true
          },
          {
            "n": "Isla Ferguson",
            "age": 7,
            "consent": "pending",
            "paid": false,
            "em": true,
            "sent": true
          },
          {
            "n": "Grace Ashworth",
            "age": 8,
            "consent": "granted",
            "paid": true,
            "em": true,
            "sent": true
          }
        ],
        "checkpoints": [
          {
            "n": "Depart base",
            "counted": null
          },
          {
            "n": "Arrive venue",
            "counted": null
          },
          {
            "n": "Lunch / midpoint",
            "counted": null
          },
          {
            "n": "Before return",
            "counted": null
          },
          {
            "n": "Back at base",
            "counted": null
          }
        ],
        "signoff": {},
        "returned": false,
        "payBy": "2026-08-12",
        "askPay": true,
        "askConsent": true,
        "childNames": [
          "Amelia Thornton",
          "Ruby Castellano",
          "Oliver Bennett",
          "Grace Ashworth"
        ],
        "staff": [
          "Sarah Whitcombe",
          "Marcus Reilly",
          "Priya Nair"
        ],
        "headcount": 4,
        "consentObtained": false,
        "notes": "Cancelled — coach operator double-booked; parents refunded to wallet. Rebooking for early September.",
        "status": "cancelled",
        "createdByName": "Sarah Whitcombe"
      }
    ],
    "/api/me": {
      "name": "Sarah Whitcombe",
      "email": "sarah@whitcombeactive.co.uk",
      "role": "freelancer"
    },
    "/api/library": {
      "settings": {
        "providerName": "Whitcombe Active Kids",
        "providerNameMode": "business",
        "trips": {
          "notifyParent": true,
          "requireConsent": true,
          "ratioTarget": 8
        }
      },
      "staff": [
        {
          "first": "Sarah",
          "last": "Whitcombe"
        },
        {
          "first": "Marcus",
          "last": "Reilly"
        },
        {
          "first": "Priya",
          "last": "Nair"
        },
        {
          "first": "Daniel",
          "last": "Okafor"
        },
        {
          "first": "Helen",
          "last": "Barford"
        },
        {
          "first": "Tom",
          "last": "Ashfield"
        }
      ],
      "venues": [
        {
          "name": "Eureka! The National Children's Museum",
          "address": "Discovery Rd, Halifax HX1 2NE",
          "city": "Halifax"
        },
        {
          "name": "Hardcastle Crags Forest School",
          "address": "Hebden Bridge HX7 7AP",
          "city": "Hebden Bridge"
        },
        {
          "name": "Yorkshire Wildlife Park",
          "address": "Branton, Doncaster DN9 3QN",
          "city": "Doncaster"
        },
        {
          "name": "Magna Science Adventure Centre",
          "address": "Sheffield Rd, Rotherham S60 1FD",
          "city": "Rotherham"
        },
        {
          "name": "Tropical World Roundhay",
          "address": "Princes Ave, Leeds LS8 2ER",
          "city": "Leeds"
        }
      ]
    },
    "/api/bookings": [
      {
        "child": "Amelia Thornton",
        "age": 8,
        "listing": "Summer Multi-Sports Camp",
        "listingId": "lst-multisports-hx",
        "pass": "Full week + trips",
        "days": [
          "2026-08-11",
          "2026-08-14",
          "2026-08-18",
          "2026-08-20",
          "2026-08-25"
        ],
        "status": "confirmed"
      },
      {
        "child": "Jacob Fielding",
        "age": 7,
        "listing": "Summer Multi-Sports Camp",
        "listingId": "lst-multisports-hx",
        "pass": "Full week + trips",
        "days": [
          "2026-08-11",
          "2026-08-18",
          "2026-08-20"
        ],
        "status": "confirmed"
      },
      {
        "child": "Sofia Marchetti",
        "age": 9,
        "listing": "Summer Multi-Sports Camp",
        "listingId": "lst-multisports-hx",
        "pass": "Full week + trips",
        "days": [
          "2026-08-11",
          "2026-08-20"
        ],
        "status": "confirmed"
      },
      {
        "child": "Oliver Bennett",
        "age": 6,
        "listing": "Summer Multi-Sports Camp",
        "listingId": "lst-multisports-hx",
        "pass": "Day pass (no trips)",
        "days": [
          "2026-08-11",
          "2026-08-20"
        ],
        "status": "confirmed"
      },
      {
        "child": "Ruby Castellano",
        "age": 10,
        "listing": "Summer Multi-Sports Camp",
        "listingId": "lst-multisports-hx",
        "pass": "Full week + trips",
        "days": [
          "2026-08-11",
          "2026-08-14",
          "2026-08-18",
          "2026-08-20",
          "2026-08-25"
        ],
        "status": "confirmed"
      },
      {
        "child": "Harry Dawson",
        "age": 8,
        "listing": "Summer Multi-Sports Camp",
        "listingId": "lst-multisports-hx",
        "pass": "Day pass (no trips)",
        "days": [
          "2026-08-11",
          "2026-08-20"
        ],
        "status": "confirmed"
      },
      {
        "child": "Isla Ferguson",
        "age": 7,
        "listing": "Summer Multi-Sports Camp",
        "listingId": "lst-multisports-hx",
        "pass": "Full week + trips",
        "days": [
          "2026-08-11",
          "2026-08-14",
          "2026-08-20"
        ],
        "status": "confirmed"
      },
      {
        "child": "Noah Whitfield",
        "age": 9,
        "listing": "Holiday Camp — Leeds",
        "listingId": "lst-holidaycamp-le",
        "pass": "Full week + trips",
        "days": [
          "2026-08-18",
          "2026-08-25"
        ],
        "status": "confirmed"
      },
      {
        "child": "Freya Lindqvist",
        "age": 6,
        "listing": "Forest School Adventures",
        "listingId": "lst-forest-hx",
        "pass": "Full week + trips",
        "days": [
          "2026-08-14"
        ],
        "status": "confirmed"
      },
      {
        "child": "Ethan Pardeep",
        "age": 11,
        "listing": "Holiday Camp — Leeds",
        "listingId": "lst-holidaycamp-le",
        "pass": "Full week + trips",
        "days": [
          "2026-08-18",
          "2026-08-25"
        ],
        "status": "confirmed"
      },
      {
        "child": "Grace Ashworth",
        "age": 8,
        "listing": "Forest School Adventures",
        "listingId": "lst-forest-hx",
        "pass": "Full week + trips",
        "days": [
          "2026-08-14"
        ],
        "status": "confirmed"
      },
      {
        "child": "Leo Nakamura",
        "age": 7,
        "listing": "Forest School Adventures",
        "listingId": "lst-forest-hx",
        "pass": "Full week + trips",
        "days": [
          "2026-08-14"
        ],
        "status": "confirmed"
      },
      {
        "child": "Mia Kowalski",
        "age": 9,
        "listing": "Holiday Camp — Leeds",
        "listingId": "lst-holidaycamp-le",
        "pass": "Full week + trips",
        "days": [
          "2026-08-18",
          "2026-08-25"
        ],
        "status": "confirmed"
      },
      {
        "child": "Charlie Beaumont",
        "age": 6,
        "listing": "Holiday Camp — Leeds",
        "listingId": "lst-holidaycamp-le",
        "pass": "Day pass (no trips)",
        "days": [
          "2026-08-18",
          "2026-08-25"
        ],
        "status": "confirmed"
      },
      {
        "child": "Dylan Osei",
        "age": 10,
        "listing": "Summer Multi-Sports Camp",
        "listingId": "lst-multisports-hx",
        "pass": "Full week + trips",
        "days": [
          "2026-08-11",
          "2026-08-20"
        ],
        "status": "confirmed"
      },
      {
        "child": "Poppy Hargreaves",
        "age": 5,
        "listing": "Forest School Adventures",
        "listingId": "lst-forest-hx",
        "pass": "Full week + trips",
        "days": [
          "2026-08-14"
        ],
        "status": "confirmed"
      },
      {
        "child": "Zara Iqbal",
        "age": 8,
        "listing": "Holiday Camp — Leeds",
        "listingId": "lst-holidaycamp-le",
        "pass": "Full week + trips",
        "days": [
          "2026-08-18"
        ],
        "status": "confirmed"
      },
      {
        "child": "Finley Rhodes",
        "age": 12,
        "listing": "Summer Multi-Sports Camp",
        "listingId": "lst-multisports-hx",
        "pass": "Full week + trips",
        "days": [
          "2026-08-20"
        ],
        "status": "confirmed"
      },
      {
        "child": "Aria Delacroix",
        "age": 7,
        "listing": "Holiday Camp — Leeds",
        "listingId": "lst-holidaycamp-le",
        "pass": "Waitlist",
        "days": [
          "2026-08-25"
        ],
        "status": "waitlisted"
      },
      {
        "child": "Samuel Adebayo",
        "age": 9,
        "listing": "Summer Multi-Sports Camp",
        "listingId": "lst-multisports-hx",
        "pass": "Full week + trips",
        "days": [
          "2026-08-18"
        ],
        "status": "cancelled"
      }
    ]
  }
};
