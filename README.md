# CoasterVerse

CoasterVerse is a private-first, public-ready roller-coaster credit and ride tracker for Netlify.

## Current feature set

- Animated total coaster-credit showcase with moving coaster/track graphic
- 63 curated U.S. parks / 368 coaster catalog
- Park completion percentages and ridden/unridden filtering
- Fast +1 ride logging with first-ride credit detection
- Coaster ratings, favorites, personal ranking and notes
- Manufacturer and coaster-type statistics
- Achievements / badges
- Year in Coasters summary
- Full ride timeline
- Trip Mode / park-day ride counting
- Mobile bottom navigation and dedicated quick-log button
- Public leaderboard
- Share Studio that renders a 1080×1350 PNG ad and post caption
- Encrypted private local vault and JSON backup/import
- Optional public email accounts via Resend
- Optional cross-device public account vault sync via Netlify Blobs
- Supabase is **not required**

## Private owner mode

Set these Netlify environment variables:

- `CV_PRIVATE_USER`
- `CV_PRIVATE_PASS`

The private owner account can use the tracker while the public site is off.

## Turn public mode on without Supabase

CoasterVerse's public backend uses Netlify Functions + Netlify Blobs. Log in with the private owner account, open **Settings**, and switch **Public site + leaderboard** on.

Public local/device tracking can work with no email provider. For email accounts, magic-link login, and cross-device sync, also configure:

- `CV_AUTH_SECRET` — long random secret used to sign email/session tokens
- `RESEND_API_KEY` — Resend API key
- `CV_EMAIL_FROM` — verified Resend sender, e.g. `CoasterVerse <login@example.com>`
- `CV_SITE_URL` — production site origin, e.g. `https://coasterverse.example.com`
- `CV_PUBLIC_OWNER_NAME` — optional owner leaderboard display name

Then enable **Email signups through Resend** from CoasterVerse Settings.

No Supabase project is required. Supabase can be added later if desired, but it is not part of the required runtime path.

## Public data model

Netlify Blobs stores:

- site public-mode settings
- public leaderboard profile aggregates
- email-account ride vaults for cross-device sync

Private-owner ride data continues to use the encrypted browser-local vault unless deliberately published as aggregate leaderboard stats.

## Image use

A small set of coaster photographs is loaded from Wikimedia Commons for visual cards/park heroes. See `/image-credits.html` for attribution and licensing links. Coasters without a mapped image use generated track artwork rather than broken placeholders.

## Validation

`npm test` verifies the coaster catalog and the major v5 UI/public-mode wiring. GitHub Actions runs the same install/test path used to catch previous Netlify deployment failures.
