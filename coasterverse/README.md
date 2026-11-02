# CoasterVerse — Private Final

Private, single-user roller coaster credit + ride tracker. Built for GitHub → Netlify deployment and structured so a future public version can replace the auth/storage adapters without rewriting the UI.

## What it does
- **Tap a coaster once:** first credit + first ride.
- **Tap it again:** +1 ride, no duplicate credit.
- Separates **unique credits** from **total rides** everywhere.
- Shows coaster **park, park location, and type/classification**.
- Curated coaster-only catalog covering Disney, Universal, legacy Cedar Fair parks, Six Flags, SeaWorld/Busch, Hersheypark, Dollywood, Holiday World, Silver Dollar City, Knoebels, Lagoon, and other major destinations.
- Personal leaderboards for most-ridden coasters, parks, and classifications.
- Full ride log with delete/undo.
- Add missing coasters privately.
- JSON backup import/export.
- Installable PWA.

## Netlify deployment from this monorepo
This project lives in `/coasterverse` inside the `rareraven` repo so it does not replace the existing root application.

When creating a new Netlify site from GitHub:
1. Select the `rareraven` repository.
2. Set **Base directory** to `coasterverse`.
3. Leave build command blank.
4. Publish directory is `.` and is already configured in `coasterverse/netlify.toml`.
5. Add these environment variables in Netlify:
   - `COASTERVERSE_USERNAME` = `eros69`
   - `COASTERVERSE_PASSWORD` = `eros69`
   - `COASTERVERSE_SESSION_SECRET = a long random secret (32+ characters)
6. Deploy.

The password is intentionally *
not committed to GitHub**. The `rareraven` repository is public, and committing a login password would make the private gate meaningless.

## Current storage model
Ride data is stored in the browser via the `storage.js` adapter. Use Export before moving devices. A future public version can swap this adapter for Supabase/Postgres while preserving the tracker UI and coaster model.

## Public-version upgrade path
- Replace `auth.js` + Netlify single-user auth with email/password, OAuth, magic-link, or passkey auth.
- Replace `storage.js` with per-user cloud storage.
- Move the coaster catalog to a database/admin interface.
- Add public profiles, following/friends, global leaderboards, park completion rankings, and privacy controls.
