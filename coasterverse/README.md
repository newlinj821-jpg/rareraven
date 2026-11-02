# CoasterVerse — Private Final

A private, single-user roller coaster credit + ride-count tracker built to upgrade cleanly into a public multi-user app later.

## What it does
- Tap a coaster row **or +1** to log a ride instantly; every tap gets a short Undo action.
- The first ride automatically creates the coaster credit.
- Credits and total rides are tracked separately.
- Curated U.S.-only enthusiast database: **63 parks / 368 roller coasters**, including Disney, Universal, Six Flags, the legacy Cedar Fair parks, SeaWorld/Busch Gardens, and standout independents.
- Most-ridden coaster, park, and classification leaderboards.
- Custom park/coaster entry for anything missing from the seed database.
- Encrypted local ride vault. Data stays in the browser unless exported.
- JSON backup/restore.
- Installable PWA.
- Private login via a Netlify Function.

## Private login
The private username and password are **not stored in the repository**. Configure them in Netlify with:
- `CV_PRIVATE_USER`
- `CV_PRIVATE_PASS`

Use the private credentials you chose for this deployment.

For a later public build, replace `auth.js` + the login function with email authentication and replace `storage.js` with a cloud storage adapter. The UI and ride model do not need to be rewritten.

## Netlify from this monorepo
Create a Netlify site from the GitHub repository and set:
- **Base directory:** `coasterverse`
- **Build command:** leave blank
- **Publish directory:** `.`
- **Functions directory:** `netlify/functions`

Required environment variables:
- `CV_PRIVATE_USER`
- `CV_PRIVATE_PASS`

## Data model
A credit is derived from ride history: one or more ride records for a coaster = one unique credit. This avoids duplicate credit records and makes repeated rides accurate by construction.

## Validate
```bash
npm test
```
