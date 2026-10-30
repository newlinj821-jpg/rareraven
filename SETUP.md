# RateRaven setup guide

RateRaven has two parts. You set each up once.

- **The website** runs on **Netlify**: the calendar, "Watch a room", My rooms, and your Admin page. It stores everything itself, so there's no database to set up.
- **The scraper** runs on **GitHub** for free, three times a day: **7:10am, 1:10pm and 7:10pm Central**. Each time, it asks your website what to check, opens the hotel booking pages, reads every room, price and discount, and sends the results back. Your website then messages everyone whose price dropped and writes the **Raven's Report** for the home page.

You need about 45 minutes, a free GitHub account, and a free Netlify account. You don't need to install anything on your computer.

---

## Part 1 · Put the files on GitHub

1. Go to **github.com** and sign in (or create a free account).
2. Top right, click **+** → **New repository**.
   - Name: `rateraven`
   - Choose **Public**. Public repositories get unlimited free scraper time. Private ones get 2,000 free minutes a month, which isn't enough for three checks a day.
   - Click **Create repository**.
3. On the new page, click **uploading an existing file**.
4. Unzip `rateraven.zip` on your computer. Open the `rateraven` folder, select **everything inside it**, and drag it onto the GitHub page. Click **Commit changes**.
5. **Check the hidden folder made it.** Macs and some browsers skip folders whose names start with a dot. In your repository, look for a folder called `.github`. If it's missing:
   - Click **Add file** → **Create new file**.
   - In the name box, type exactly: `.github/workflows/morning-check.yml`
   - Open `morning-check.yml` from the zip (it's in `.github/workflows/`) in any text editor, copy everything, and paste it in.
   - Click **Commit changes**.

## Part 2 · Put the website on Netlify

1. Go to **app.netlify.com** → **Add new site** → **Import an existing project** → **GitHub**.
2. Pick your `rateraven` repository. Leave every setting as it is (the project already tells Netlify what to do) and click **Deploy**.
3. When it finishes, Netlify shows your web address, e.g. `https://rateraven-abc123.netlify.app`. You can rename it under **Site configuration** → **Change site name**.

### Add two passwords to Netlify

Go to **Site configuration** → **Environment variables** → **Add a variable**, and add these three:

| Key | Value |
|---|---|
| `ADMIN_USERNAME` | `Eros32` |
| `ADMIN_PASSWORD` | `Eros32!` |
| `SCRAPER_SECRET` | A long random password, at least 30 letters and numbers. This is how your website knows the scraper is really yours. Copy it somewhere; you'll paste it into GitHub next. |

Then go to **Deploys** → **Trigger deploy** → **Deploy site** so the website picks them up.

Your login lives only in Netlify's settings, never in the code, so it stays private even though the repository is public. After 10 wrong tries in an hour, the Admin page locks for the rest of that hour. You can change the password any time by editing `ADMIN_PASSWORD` and redeploying.

## Part 3 · Connect the scraper to your website

In your GitHub repository: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add two secrets:

| Name | Value |
|---|---|
| `SITE_URL` | Your Netlify address, e.g. `https://rateraven-abc123.netlify.app` (no `/` at the end). |
| `SCRAPER_SECRET` | The same long password you gave Netlify. |

Then open the **Actions** tab. If GitHub asks, click **I understand my workflows, go ahead and enable them**.

## Part 4 · Teach the scraper the booking site

The scraper needs to know what a hotel search link looks like. You show it once by pasting real links.

1. Open the official booking site the way you normally book (Universal Orlando's hotel page → **Book**, or loewshotels.com).
2. Search **Loews Portofino Bay** for any dates with **2 adults**. When the room list shows, **copy the whole address from the address bar**.
3. Do the same for every other hotel. The dates don't matter.
4. Do one more search with the **Annual Passholder** rate chosen and copy that link. Then do the same for **Florida Resident** and **Military**.
5. Open `https://YOUR-SITE.netlify.app/admin`, sign in with username **Eros32** and password **Eros32!**, and go to **Scraper setup**.
6. Paste each link into its box and click **Work it out**. Check what it found:
   - **Link pattern** should show `{checkIn}`, `{checkOut}` (or `{nights}`), `{adults}` and `{hotel}` where the dates, adults and hotel used to be.
   - **Hotel codes** should list a different code for each hotel.
   - **Rate codes** should show what the discount links add, e.g. `promo=UAP`.
7. Click **Save scraper setup**.

**If a discount doesn't change the link** (the site picks the rate with a button on the page instead), type the button's words in that rate's **Click text** box, e.g. `Annual Passholder`. The scraper will click it.

**If the address bar doesn't change at all when you search** (no dates in the link), the site needs a click-through version of the scraper. That's a bigger change, so ask for it.

## Part 5 · Test one search

1. On GitHub: **Actions** → **Price check** → **Run workflow**.
2. Leave mode on **probe**, pick a hotel, date and rate, and click **Run workflow**. It takes about 2 minutes.
3. Back on your Admin page, go to **Test a search** → **Refresh results**. You'll see:
   - A **screenshot** of the page the scraper saw.
   - **Every room it read**, with the nightly price, stay total, struck-out "was" price, and discount labels.

Compare that with what you see on the booking site yourself.

| What you see | What to do |
|---|---|
| Rooms and prices match | You're done. Go to Part 6. |
| "blocked" or a robot-check screenshot | The booking site is refusing automated visits. Lower **Tabs at once** to 2 and **Searches per morning** to 1,000 (Admin → Calendar), wait a day, and test again. |
| "empty", but the screenshot shows prices | The automatic reader missed this layout. Admin → Scraper setup → Advanced, then add `"selectors": { "card": "...", "name": "...", "price": "..." }`. Ask for help working out the three values from the screenshot. |
| Screenshot shows the wrong hotel or dates | Paste the links again in Part 4. |

## Part 6 · Run a full check once

**Actions** → **Price check** → **Run workflow** → mode **daily**.

The first full run fills in the closest dates. After that it runs by itself at 7:10am, 1:10pm and 7:10pm Central:

- **Every check:** watched rooms first, then the next two weeks of the calendar. Drop alerts go out right after.
- **Morning check only:** the rest of the calendar (later dates less often) and everyone's daily summary and cancel-deadline reminders.

The whole 12-month calendar fills in within about two weeks. The morning check takes about 1½ hours; afternoon and evening take about 25 minutes each. You can switch any of the three off, or change how many searches each does, in Admin → **Calendar**.

You're live. Everything below is optional.

---

## Optional · Email alerts

Phone push (ntfy) and Discord work without this.

1. Sign up at **resend.com**, add your domain (e.g. your own web address), and follow its steps to verify it.
2. Create an **API key**.
3. In Netlify → Environment variables, add:
   - `RESEND_API_KEY` = the key
   - `EMAIL_FROM` = e.g. `RateRaven <alerts@yourdomain.com>`
4. Redeploy (Deploys → Trigger deploy).
5. Admin → **Email** → tick **Let people get alerts by email** → **Save**.

Visitors can then add an email address, and anyone who loses their private link can have a new one emailed to them.

## Optional · Sell passes

Off by default, so everything is free. When it's on: the calendar stays free, free links watch a set number of rooms, and a one-time pass unlocks more rooms for a year. Nothing renews. You set every number in Admin → **Sales**.

1. Create a **Stripe** account at stripe.com and finish its sign-up steps.
2. Stripe → **Developers** → **API keys**: copy the **Secret key** (starts with `sk_live_`, or `sk_test_` for testing).
3. Stripe → **Developers** → **Webhooks** → **Add endpoint**:
   - URL: `https://YOUR-SITE.netlify.app/api/stripe-webhook`
   - Events: `checkout.session.completed` and `charge.refunded`
   - Save, then copy the **Signing secret** (starts with `whsec_`).
4. In Netlify → Environment variables, add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, then redeploy.
5. Admin → **Sales**: set the price, the length of the pass, and the room limits, tick **Sell passes**, and **Save**.

**Test first** with `sk_test_` keys and Stripe's test card `4242 4242 4242 4242`, then swap to the live keys.

To give someone a pass for free, paste their private link into **Give someone a free pass**.

## Optional · "Run now" buttons on the Admin page

Without this, you start tests from GitHub's Actions tab (**Price check** → **Run workflow**). To use the buttons instead:

1. On GitHub: your picture → **Settings** → **Developer settings** → **Fine-grained tokens** → **Generate new token**.
2. Set **Repository access** to only `rateraven`, and **Permissions** → **Actions** to **Read and write**. Generate it and copy it.
3. In Netlify, add:
   - `GITHUB_TOKEN` = the token
   - `GITHUB_REPO` = `your-github-name/rateraven`
4. Redeploy.

## Optional · Tip jar

Off by default. When it's on, a tip jar shows at the bottom of the home page.

1. Admin → **Tip jar**.
2. Either paste your **Ko-fi, Buy Me a Coffee, PayPal or Venmo link**, or leave the link empty to take card tips through Stripe (needs your Stripe keys from "Sell passes" below; passes don't have to be switched on). You can change the message and the amounts.
3. Tick **Show the tip jar** and **Save**.

Card tips show on the Admin **Status** page.

## Optional · Your own web address

In Netlify: **Domain management** → **Add a domain**, and follow the steps.

---

## How visitors use it

- **Calendar** (home page): pick a rate, the number of adults, and hotels (all, a tier like Premier, or 2–3 to compare). Tap a night to see every hotel's price, room, discount labels, "was" price, and whether Express is included.
- **Watch a room**: they enter the hotel, dates, rate, adults, what they paid, and optionally a room name like "King". They get a **private link**: no account, no password. Alerts go to the free **ntfy** phone app, Discord, or email if you switched it on.
- **After any check**, people get a message if a watched room drops below what they paid (only again if it drops further), or if a sold-out room becomes bookable again. Savings are shown with Orlando's 12.5% hotel tax included.
- **Each morning**, people also get an optional **summary** of every room they watch, plus **free-cancel reminders** 2 days before the deadline and on the deadline day. Loews' standard deadline is 6 days before arrival; they can enter their own and add it to their phone's calendar from My rooms.
- **The Raven's Report** at the top of the home page is rewritten after every check: how many nights got cheaper, the biggest drops, the cheapest night that comes with Express, the cheapest night in each hotel tier, and which discount is winning.
- **Plan the cheapest stay**: visitors enter their dates and see every hotel ranked by total cost with tax, whether splitting the stay between two hotels saves money, and the "Express trick": the cheapest single night at a hotel that includes Express Unlimited for that day and the next.
- **My rooms**: the current price, lowest price seen, a chart of each morning's price against what they paid, every room and its price, edit, pause and remove.

## Good to know

- **Be polite to the booking site.** The scraper waits between searches, skips pictures and trackers, slows down by itself if the site pushes back, and stops if it's being blocked. Checking hotel sites automatically may go against their terms of use. Keep the volume modest; that's your call as the site owner.
- **The scraper was tested on look-alike booking pages, not the live Loews site.** The live site couldn't be reached from where this was built. Part 5 is how you confirm it reads the real site correctly.
- **GitHub pauses scheduled jobs** in repositories with no activity for 60 days. The morning job switches itself back on each run, so you shouldn't need to do anything.
- **Changing the code**: any file you change on GitHub redeploys the website automatically within a minute.

## Where things are

| | |
|---|---|
| `public/` | The web pages: calendar, My rooms, Admin |
| `netlify/functions/` | The website's back end: storage, alerts, payments, admin |
| `scraper/` | The morning price checker (`run.mjs`, `extract.mjs`) |
| `.github/workflows/morning-check.yml` | Runs the scraper at 7:10am, 1:10pm and 7:10pm Central |
| `shared/catalog.mjs` | Hotel list, tiers, Express perk, rate types, cancel policy, tax rate. Edit to add a hotel. |
| `public/fonts/` | The site's typefaces (Alfa Slab One and Atkinson Hyperlegible, free OFL license) |
| `test/` | Self-tests and a local preview server |
