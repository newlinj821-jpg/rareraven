# RateRaven

Checks every on-site Loews hotel at Universal Orlando three times a day (7:10am, 1:10pm, 7:10pm Central):
a 12-month price calendar (Standard, Annual Passholder, Florida resident, Military; 1–2 or 4 adults),
a stay planner (split stays, the Express trick), the Raven's Report after every check, and room watches that send phone/Discord/email alerts when a booked room drops.

**Start here: [SETUP.md](SETUP.md)** — step-by-step, no coding needed.

Tests: `node test/site-test.mjs` (whole system) and `cd scraper && npm test` (page reader).
Independent project; not affiliated with Universal, NBCUniversal or Loews Hotels.
