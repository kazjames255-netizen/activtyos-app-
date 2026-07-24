// STARTER catalog (categories/activities, facilities, swatch palette) —
// seeds a tenant's timetable library on first use; their edited copy lives
// on the tenant library doc (`timetable` key) after that. Listings are the
// tenant's real ones, loaded by the store from GET /api/listings?mine=1.
import type { Category } from "./types";

export const SWATCHES: string[] = ["#1D3A8F","#E91E63","#F97316","#0EA5A0","#7A5AF8","#15B364","#F59E0B","#2AACE2","#64748B","#111827"];

export const FACILITIES: string[] = ["Sports Hall","Field","Playground","Classroom","Studio","Pool"];

export const CATEGORIES: Category[] = [
 {
  "id": "sports",
  "name": "Sports",
  "color": "#3551c9",
  "acts": [
   {
    "name": "Football",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Field"
   },
   {
    "name": "Multi-Sports",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Sports Hall"
   },
   {
    "name": "Basketball",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Sports Hall"
   },
   {
    "name": "Dodgeball",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Sports Hall"
   },
   {
    "name": "Cricket",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Field"
   },
   {
    "name": "Rounders",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Field"
   },
   {
    "name": "Hockey",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Field"
   },
   {
    "name": "Tag Rugby",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Field"
   },
   {
    "name": "Tennis",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Playground"
   },
   {
    "name": "Benchball",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Sports Hall"
   },
   {
    "name": "Handball",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Sports Hall"
   },
   {
    "name": "Athletics",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Field"
   },
   {
    "name": "Netball",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Playground"
   }
  ]
 },
 {
  "id": "arts",
  "name": "Arts",
  "color": "#E91E63",
  "acts": [
   {
    "name": "Arts & Crafts",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Classroom"
   },
   {
    "name": "Painting",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Classroom"
   },
   {
    "name": "Junk Modelling",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Classroom"
   },
   {
    "name": "Drama",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Studio"
   },
   {
    "name": "Dance",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Studio"
   },
   {
    "name": "Singing",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Studio"
   },
   {
    "name": "Music",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Studio"
   },
   {
    "name": "Den Building",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Playground"
   },
   {
    "name": "Jewellery Making",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Classroom"
   },
   {
    "name": "Mask Making",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Classroom"
   },
   {
    "name": "Pottery",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Classroom"
   },
   {
    "name": "Face Painting",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Classroom"
   }
  ]
 },
 {
  "id": "extreme",
  "name": "Extreme",
  "color": "#F97316",
  "acts": [
   {
    "name": "Archery",
    "on": true,
    "whole": false,
    "exclude": [
     0
    ],
    "place": "Field"
   },
   {
    "name": "Fencing",
    "on": true,
    "whole": false,
    "exclude": [
     0
    ],
    "place": "Sports Hall"
   },
   {
    "name": "Climbing Wall",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Sports Hall"
   },
   {
    "name": "Nerf Wars",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Sports Hall"
   },
   {
    "name": "Laser Tag",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Field"
   },
   {
    "name": "Go-Karts",
    "on": true,
    "whole": false,
    "exclude": [
     0
    ],
    "place": "Playground"
   },
   {
    "name": "Inflatables",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Field"
   },
   {
    "name": "Assault Course",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Field"
   },
   {
    "name": "Bushcraft",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Field"
   },
   {
    "name": "Forest School",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Field"
   },
   {
    "name": "Zip Wire",
    "on": true,
    "whole": false,
    "exclude": [
     0
    ],
    "place": "Field"
   }
  ]
 },
 {
  "id": "others",
  "name": "Others",
  "color": "#0EA5A0",
  "acts": [
   {
    "name": "Swimming",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Pool"
   },
   {
    "name": "Cooking",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Classroom"
   },
   {
    "name": "Science / STEM",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Classroom"
   },
   {
    "name": "Board Games",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Classroom"
   },
   {
    "name": "Lego Build",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Classroom"
   },
   {
    "name": "Treasure Hunt",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Playground"
   },
   {
    "name": "Movie Time",
    "on": true,
    "whole": true,
    "exclude": [],
    "place": "Studio"
   },
   {
    "name": "Talent Show",
    "on": true,
    "whole": true,
    "exclude": [],
    "place": "Studio"
   },
   {
    "name": "Water Day",
    "on": true,
    "whole": true,
    "exclude": [],
    "place": "Field"
   },
   {
    "name": "Free Play",
    "on": true,
    "whole": false,
    "exclude": [],
    "place": "Playground"
   }
  ]
 }
];

export const DEFAULT_GROUPS = [
  { name: "Reds", band: "5-7" },
  { name: "Blues", band: "8-10" },
  { name: "Greens", band: "11-13" },
];
