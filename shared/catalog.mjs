// Hotels, tiers, rate types, cancel policy and tax rate. Edit this file to add a hotel.
export default {
  "hotels": [
    {
      "id": "portofino",
      "match": "portofino",
      "name": "Loews Portofino Bay Hotel",
      "short": "Portofino",
      "tier": "Premier",
      "express": true
    },
    {
      "id": "hardrock",
      "match": "hard rock",
      "name": "Hard Rock Hotel",
      "short": "Hard Rock",
      "tier": "Premier",
      "express": true
    },
    {
      "id": "royalpacific",
      "match": "royal pacific",
      "name": "Loews Royal Pacific Resort",
      "short": "Royal Pacific",
      "tier": "Premier",
      "express": true
    },
    {
      "id": "helios",
      "match": "helios",
      "name": "Helios Grand Hotel",
      "short": "Helios Grand",
      "tier": "Premier",
      "express": false
    },
    {
      "id": "sapphire",
      "match": "sapphire",
      "name": "Loews Sapphire Falls Resort",
      "short": "Sapphire Falls",
      "tier": "Preferred",
      "express": false
    },
    {
      "id": "aventura",
      "match": "aventura",
      "name": "Aventura Hotel",
      "short": "Aventura",
      "tier": "Prime",
      "express": false
    },
    {
      "id": "cabana",
      "match": "cabana",
      "name": "Cabana Bay Beach Resort",
      "short": "Cabana Bay",
      "tier": "Prime",
      "express": false
    },
    {
      "id": "stellanova",
      "match": "stella nova",
      "name": "Stella Nova Resort",
      "short": "Stella Nova",
      "tier": "Prime",
      "express": false
    },
    {
      "id": "terraluna",
      "match": "terra luna",
      "name": "Terra Luna Resort",
      "short": "Terra Luna",
      "tier": "Prime",
      "express": false
    },
    {
      "id": "surfside",
      "match": "surfside",
      "name": "Endless Summer Resort – Surfside Inn",
      "short": "Surfside",
      "tier": "Value",
      "express": false
    },
    {
      "id": "dockside",
      "match": "dockside",
      "name": "Endless Summer Resort – Dockside Inn",
      "short": "Dockside",
      "tier": "Value",
      "express": false
    }
  ],
  "rateTypes": [
    {
      "id": "standard",
      "name": "Standard"
    },
    {
      "id": "ap",
      "name": "Annual Passholder"
    },
    {
      "id": "florida",
      "name": "Florida Resident"
    },
    {
      "id": "military",
      "name": "Military"
    }
  ],
  "adultsOptions": [
    1,
    2,
    3,
    4
  ],
  "cancelPolicy": {
    "freeUntilDaysBefore": 6,
    "note": "Loews' standard policy: full refund 6+ days before arrival; inside 5 days costs one night + tax. Special rates can differ — check your confirmation."
  },
  "taxRate": 0.125,
  "taxNote": "Orlando hotel tax is 12.5% (6% lodging + 6.5% sales tax)."
};
