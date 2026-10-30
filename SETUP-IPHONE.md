# RateRaven setup on iPhone only

Everything here happens in **Safari**. It takes about 45 minutes.

**Before you start:** in the Claude app, tap the `rateraven.zip` file → **Share** → **Save to Files**, and put it in **On My iPhone** or **iCloud Drive**. Don't unzip it.

**Tip:** GitHub and Netlify are easier with the full-size website. In Safari, tap **aA** in the address bar → **Request Desktop Website**. Pinch to zoom as needed.

---

## Step 1 · Put the files on GitHub (about 10 min)

1. Go to **github.com/new** and sign in.
   - Name: `rateraven`
   - Choose **Public**.
   - Turn on **Add a README file**. This matters: the next steps don't work on an empty repository.
   - Tap **Create repository**.
2. Go to **github.com/codespaces**, tap **New codespace**, choose your `rateraven` repository, and tap **Create codespace**.
   A code editor opens in Safari after a minute. It's free for this.
3. **Upload the zip:** in the file list on the left (tap the two-pages icon if it's hidden), **press and hold on the empty space** → **Upload…** → pick `rateraven.zip` from Files.
4. **Open the terminal:** tap the **☰** menu (top left) → **Terminal** → **New Terminal**. A panel opens at the bottom.
5. Copy this whole line, then press and hold in the terminal → **Paste**, then tap Return:

   ```
   unzip -oq rateraven.zip && cp -rf rateraven/. . && rm -rf rateraven rateraven.zip && git add -A && git commit -qm "RateRaven" && git push && echo "ALL DONE"
   ```

6. Wait for **ALL DONE**. If it asks whether to paste multiple lines, tap **Paste**.
7. Check it worked: go to **github.com/YOUR-NAME/rateraven**. You should see the folders `.github`, `netlify`, `public`, `scraper`, `shared` and `test`.
8. Clean up: go to **github.com/codespaces**, tap **⋯** next to the codespace → **Delete**. The files are safe on GitHub now.

## Step 2 · Make the website on Netlify (about 5 min)

1. Go to **app.netlify.com** and sign up with **GitHub**. That's easiest because it connects them.
2. Tap **Add new site** (or **Add new project**) → **Import an existing project** → **GitHub** → **Authorize**.
3. Pick **rateraven**. If it isn't listed, tap **Configure the Netlify app on GitHub**, allow `rateraven`, and come back.
4. Don't change any settings. Tap **Deploy**.
5. Wait about a minute until it says **Published**. Your web address is shown at the top, like `https://something-123.netlify.app`. Tap **Site configuration** → **Change site name** to pick a nicer one, e.g. `rateraven`.

## Step 3 · Add your login and the secret (about 5 min)

1. On Netlify: **Site configuration** → **Environment variables** → **Add a variable** → **Add a single variable**. Add these three, one at a time:

   | Key | Value |
   |---|---|
   | `ADMIN_USERNAME` | `Eros32` |
   | `ADMIN_PASSWORD` | `Eros32!` |
   | `SCRAPER_SECRET` | Make one up: at least 30 random letters and numbers, e.g. mash the keyboard. **Copy it into Notes**; you need it again in a minute. |

2. Go to **Deploys** → **Trigger deploy** → **Deploy site**. Wait for **Published**.
3. Open your website. You should see RateRaven. The calendar is empty until the first check runs.

## Step 4 · Connect the price checker (about 5 min)

1. Go to **github.com/YOUR-NAME/rateraven** → **Settings** (top row, scroll sideways if needed) → **Secrets and variables** → **Actions** → **New repository secret**.
2. Add two secrets:

   | Name | Secret |
   |---|---|
   | `SITE_URL` | Your Netlify address, e.g. `https://rateraven.netlify.app` (no `/` at the end) |
   | `SCRAPER_SECRET` | The same text you saved in Notes |

3. Tap the **Actions** tab. If you see a green button saying workflows are disabled, tap **I understand my workflows, go ahead and enable them**.

## Step 5 · Teach it the booking site (about 15 min)

1. In Safari, go to the official Universal or Loews booking page. Search **Loews Portofino Bay**, any dates, **2 adults**.
2. When the rooms show, tap the **address bar**, then **Copy**. (Or tap **Share** → **Copy**.)
3. Open a new tab: `https://YOUR-SITE.netlify.app/admin`. Sign in with **Eros32** and **Eros32!**, go to **Scraper setup**, and paste into the **Portofino** box.
4. Repeat for each hotel. Then do one search with the **Annual Passholder** rate, one with **Florida Resident** and one with **Military**, and paste each into its box under **Discount rates**.
   Admin remembers nothing until you save, so keep that tab open while you switch tabs.
5. Tap **Work it out**, check it looks sensible, and tap **Save scraper setup**.

## Step 6 · Test one search (about 3 min)

1. On GitHub: **Actions** → **Price check** (left side; on a phone tap **All workflows** first) → **Run workflow** → leave it on **probe** → **Run workflow**.
   If you don't see **Run workflow**, turn on **Request Desktop Website** (see the tip at the top).
2. Wait about 2 minutes, until there's a green check.
3. On your Admin page, go to **Test a search** → **Refresh results**. You'll see a screenshot and every room it read.

**Send that screenshot to Claude.** It shows whether the scraper can read the real booking site, and what to change if it can't.

## Step 7 · Turn it on

On GitHub: **Actions** → **Price check** → **Run workflow** → choose **daily** → **Run workflow**.

That's it. From now on it checks by itself at **7:10am, 1:10pm and 7:10pm Central**.

---

### Put it on your home screen

Open your site in Safari → **Share** → **Add to Home Screen**. Do the same on your **My rooms** page to open straight to your watched rooms.

### Later, from your phone

- **Change settings:** your-site/admin (tip jar, sales, email, check times).
- **Edit any file:** on GitHub, open it, tap the **pencil**, change it, **Commit changes**. Netlify updates the site in about a minute.
- For tips, sales and email, see the **Optional** sections in `SETUP.md`. They're all done in Safari too.
