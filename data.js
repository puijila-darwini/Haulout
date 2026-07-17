// data.js - Immutable Reference Data Layer
export const VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
  architecture: "0.1",
  specification: "0.1"
};

export const CONFIG = {
  version: "1.0.0",
  pollingInterval: 60000, // Canonical 1-minute engine cycle tracking
  debugEnabled: true,
  journalSize: 100,
  notificationLimit: 50,
  autosaveInterval: 5000 // Responsive 5-second disk flush cycle
};

export const SEAL_COUNT = 360;
export const LUNAR_CYCLE = 29.53059; 
export const SOLAR_YEAR = 365.24219; 
export const MINUTE = 60000;         
export const DAY = 86400000;         

export const SPECIES = [
  { id: "harbor", name: "Harbor Seal", habitat: "Inshore Shelfs", rarity: "Common", symbolicWeight: 1 },
  { id: "grey", name: "Grey Seal", habitat: "Rocky Reefs", rarity: "Common", symbolicWeight: 2 },
  { id: "ringed", name: "Ringed Seal", habitat: "Ice Floes", rarity: "Uncommon", symbolicWeight: 3 },
  { id: "bearded", name: "Bearded Seal", habitat: "Deep Benthos", rarity: "Uncommon", symbolicWeight: 4 },
  { id: "hooded", name: "Hooded Seal", habitat: "Pelagic Openings", rarity: "Rare", symbolicWeight: 5 },
  { id: "elephant", name: "Elephant Seal", habitat: "Abyssal Zones", rarity: "Rare", symbolicWeight: 8 },
  { id: "walrus", name: "Pacific Walrus", habitat: "Arctic Ice Edge", rarity: "Epic", symbolicWeight: 13 }
];

export const BEHAVIOURS = [
  "Resting", "Hunting", "Watching", "Diving",
  "Calling", "Hauling Out", "Sleeping", "Travelling"
];

export const ZODIAC = [
  { sign: "Aries", symbol: "♈" }, { sign: "Taurus", symbol: "♉" },
  { sign: "Gemini", symbol: "♊" }, { sign: "Cancer", symbol: "♋" },
  { sign: "Leo", symbol: "♌" },    { sign: "Virgo", symbol: "♍" },
  { sign: "Libra", symbol: "♎" },   { sign: "Scorpio", symbol: "♏" },
  { sign: "Sagittarius", symbol: "♐" }, { sign: "Capricorn", symbol: "♑" },
  { sign: "Aquarius", symbol: "♒" }, { sign: "Pisces", symbol: "♓" }
];

export const NOTIFICATION_TYPES = {
  MORNING: "MORNING",
  LUNAR: "LUNAR",
  SOLAR: "SOLAR",
  RITUAL: "RITUAL",
  SYSTEM: "SYSTEM"
};

// Fixed Geographical Sectors and Terrain Typing Matrix
export const LOCATIONS = [
  { name: "Far Shore", type: "SHORE" },
  { name: "Mixed", type: "ROCK" },
  { name: "Small Smooth", type: "ROCK" },
  { name: "Small Rough", type: "ROCK" },
  { name: "Big Smooth", type: "ROCK" },
  { name: "Big Rough", type: "ROCK" },
  { name: "Near Shore", type: "SHORE" }
];
