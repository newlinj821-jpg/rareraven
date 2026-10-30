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
   | `ADMIN_USERNAME` | The username you want for Admin |
   | `ADMIN_PASSWORD` | A strong password you choose. **Never write it in any file in this repository**: the repository is public, and Netlify will refuse to publish if it finds it. |
   | `SCRAPER_SECRET` | Make one up: at least 30 random letters and numbers, e.g. mash the keyboard. **Copy it into Notes**; you need it again in a minute. |

2. Go to **Deploys** → **Trigger deploy** → **Deploy site**. Wait for **Published**.
3. Open your website. You should see RateRaven. The calendar is empty until the first check runs.

## Step 4 · Give GitHub the secret code (about 2 min)

1. Go to **github.com/YOUR-NAME/YOUR-REPOSITORY** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. **Name:** `SCRAPER_SECRET` · **Secret:** the same code you gave Netlify. Tap **Add secret**.
3. Tap the **Actions** tab. If it says workflows are disabled, tap **I understand my workflows, go ahead and enable them**.

## Step 5 · Start it (1 tap)

On GitHub: **Actions** → **Price check** → **Run workflow** → choose **daily** → **Run workflow**.

That's everything. The first run **teaches itself Universal's booking site** (about 10 minutes): how it puts dates in its links, and which codes give Passholder, Florida resident and Military rates. Then it starts checking prices. You can see what it learned on your Admin page under **Scraper setup**, with a screenshot.

From then on it checks by itself at **7:10am, 1:10pm and 7:10pm Central**.

If the learner can't work the site out, Admin → Scraper setup says so and shows what it saw. Send that screenshot to Claude.

---

### Put it on your home screen

Open your site in Safari → **Share** → **Add to Home Screen**. Do the same on your **My rooms** page to open straight to your watched rooms.

### Updating to a new version

Upload the new `rateraven.zip` to the same repository (**Add file → Upload files**, then **Commit changes**). It unpacks itself within a minute or two, and Netlify updates the website on its own.

### Later, from your phone

- **Change settings:** your-site/admin (tip jar, sales, email, check times).
- **Edit any file:** on GitHub, open it, tap the **pencil**, change it, **Commit changes**. Netlify updates the site in about a minute.
- For tips, sales and email, see the **Optional** sections in `SETUP.md`. They're all done in Safari too.
