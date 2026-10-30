// Hotels, tiers, rate types, cancel policy and tax rate. Edit this file to add a hotel.
export default {
  "hotels": [
    {
      "id": "portofino",
      "name": "Loews Portofino Bay Hotel",
      "short": "Portofino",
      "tier": "Premier",
      "express": true
    },
    {
      "id": "hardrock",
      "name": "Hard Rock Hotel",
      "short": "Hard Rock",
      "tier": "Premier",
      "express": true
    },
    {
      "id": "royalpacific",
      "name": "Loews Royal Pacific Resort",
      "short": "Royal Pacific",
      "tier": "Premier",
      "express": true
    },
    {
      "id": "helios",
      "name": "Helios Grand Hotel",
      "short": "Helios Grand",
      "tier": "Premier",
      "express": false
    },
    {
      "id": "sapphire",
      "name": "Loews Sapphire Falls Resort",
      "short": "Sapphire Falls",
      "tier": "Preferred",
      "express": false
    },
    {
      "id": "aventura",
      "name": "Aventura Hotel",
      "short": "Aventura",
      "tier": "Prime",
      "express": false
    },
    {
      "id": "cabana",
      "name": "Cabana Bay Beach Resort",
      "short": "Cabana Bay",
      "tier": "Prime",
      "express": false
    },
    {
      "id": "stellanova",
      "name": "Stella Nova Resort",
      "short": "Stella Nova",
      "tier": "Prime",
      "express": false
    },
    {
      "id": "terraluna",
      "name": "Terra Luna Resort",
      "short": "Terra Luna",
      "tier": "Prime",
      "express": false
    },
    {
      "id": "surfside",
      "name": "Endless Summer Resort – Surfside Inn",
      "short": "Surfside",
      "tier": "Value",
      "express": false
    },
    {
      "id": "dockside",
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
