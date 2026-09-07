# Deploying Purim Platform (free, permanent)

Three free services, each doing one job:

| Service | Job | Cost | Expires? |
| --- | --- | --- | --- |
| **GitHub** | Stores the code, hands it to Render | Free | No |
| **Neon** | Runs the PostgreSQL database (your data) | Free | **No** |
| **Render** | Runs the app and serves it at a URL | Free | No |

No credit card required for any of them. Total time: ~25 minutes, mostly waiting
on downloads and builds.

> **Why Neon instead of Render's own database?** Render's *free* database is
> deleted 30 days after creation. Neon's free database has no such limit, so the
> data survives indefinitely. Render still runs the app for free — it just
> connects out to Neon for storage.

Order of operations:

1. Code → GitHub
2. Database → Neon (copy its connection string)
3. App → Render (paste that connection string, deploy)

---

## Part 1 — GitHub

### 1a. Create a GitHub account (skip if you have one)

1. Go to <https://github.com/signup>.
2. Enter your email, a password, and a username.
3. Solve the puzzle, then type the code GitHub emails you.
4. On any "choose a plan" screen, pick **Free**.

### 1b. Install Git (skip if `git --version` prints a version)

- Open **Terminal** (Cmd+Space → "Terminal") and run `git --version`.
- If macOS pops up *"command line developer tools"*, click **Install** and wait for
  it to finish (~5 min). This is Apple's tool bundle; it's unrelated to the project.

### 1c. Create an empty repository on GitHub

1. Go to <https://github.com/new>.
2. **Repository name:** `purim-platform`
3. Leave it **Public** (Private also deploys fine).
4. Do **not** tick "Add a README", ".gitignore", or "license" — this project
   already includes them, and adding them here causes a conflict on first push.
5. Click **Create repository**. Keep that page open — it shows a URL like
   `https://github.com/YOUR-USERNAME/purim-platform.git`.

### 1d. Push this project up

From inside the project folder (Claude can run these for you once Git is
installed — you only do the sign-in in step 4):

```bash
cd "/Users/sophiawahba/Purim Platform"

git init
git add .
git commit -m "Initial commit: Purim Platform"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/purim-platform.git
git push -u origin main
```

- Replace `YOUR-USERNAME` with your GitHub username.
- The first `git push` opens a browser window to sign in to GitHub — approve it.
- Reload the GitHub page; your files should now be there.

> If `git commit` complains about identity, run these once and retry:
> ```bash
> git config --global user.email "abiewahba10@icloud.com"
> git config --global user.name "Your Name"
> ```

---

## Part 2 — Neon (the database)

### 2a. Create a Neon account

1. Go to <https://neon.tech> and click **Sign up**.
2. Choose **Continue with GitHub** (or Google). Approve the prompt.
3. Pick the **Free** plan if asked.

### 2b. Create a project

1. Neon drops you into a "Create project" screen (or click **New Project**).
2. **Project name:** `purim-platform`
3. **Postgres version:** leave the default.
4. **Region:** pick the one closest to you (e.g. *US East (Ohio)*). Remember which
   one — you'll want Render in a nearby region too.
5. Click **Create project**.

### 2c. Copy the connection string

1. After the project is created, Neon shows a **Connection string** box (also under
   **Dashboard → Connect** later).
2. Make sure the toggle/dropdown is set to include the password (labeled something
   like **"Show password"** or **"Pooled connection"** — pooled is fine).
3. Copy the whole string. It looks like:
   ```
   postgresql://purim_owner:npg_XXXXXXXX@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Paste it somewhere safe for a minute — you need it in Part 3.

> This string contains a password. Don't commit it to GitHub or share it. It only
> gets pasted into Render's dashboard, which keeps it private.

---

## Part 3 — Render (the app)

### 3a. Create a Render account

1. Go to <https://render.com> → **Get Started**.
2. Choose **Sign up with GitHub**. Approve the authorization prompt.

### 3b. Deploy the Blueprint

This repo's `render.yaml` tells Render to create **one free web service** and to
ask you for the database URL.

1. Render dashboard → **New +** (top right) → **Blueprint**.
2. Select your **`purim-platform`** repository → **Connect**.
   - Not listed? Click **Configure account** / **Configure in GitHub**, grant
     Render access to the repo, then return.
3. Render reads `render.yaml` and shows a web service `purim-platform`, plus a
   field asking for **`DATABASE_URL`** (because it's marked "sync: false" — a
   secret you provide).
4. **Paste your Neon connection string** into the `DATABASE_URL` field.
5. Name the blueprint anything (e.g. `purim`). Click **Apply**.
6. Wait ~3–5 minutes. Render downloads the code, runs `npm install` and
   `npm run build` (compiling the React app), then `npm start`. On start the
   server connects to Neon, creates the tables, and seeds the sample data.

### 3c. Open the app

- Click the **`purim-platform`** service. Its URL is near the top, like
  `https://purim-platform.onrender.com`. Open it — you should see the app with the
  two sample products in place.

---

## Everyday updates

Whenever the code changes:

```bash
cd "/Users/sophiawahba/Purim Platform"
git add .
git commit -m "Describe what changed"
git push
```

Render notices the push and redeploys automatically in a few minutes. Your data in
Neon is untouched by deploys.

---

## Good to know about the free tiers

- **The Render web service sleeps after ~15 minutes with no visitors.** The next
  visit takes ~50 seconds to wake it, then it's fast. It is **not** deleted — it
  lasts as long as you keep the account.
- **The Neon database sleeps after ~5 minutes idle** and wakes on the next query
  in under a second. Also **not** deleted — no 30-day limit.
- **Nothing here charges you.** If you ever outgrow the free tiers (many hundreds
  of thousands of rows, or you want the app to never sleep), Render's smallest
  always-on plan is ~$7/month and Neon's paid tier is similar — but a community
  giveaway won't come close.

### Backing up your data (optional but wise)

Neon keeps a short automatic history on the free plan. For your own copy, once you
have PostgreSQL's command-line tools installed:

```bash
pg_dump "PASTE_YOUR_NEON_CONNECTION_STRING" > purim-backup-$(date +%Y-%m-%d).sql
```

Run that once in a while and keep the file somewhere safe.

---

## Manual setup (only if the Blueprint route fails)

1. **Render → New + → Web Service.** Connect the `purim-platform` repo. Settings:
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free
2. Under **Environment**, add:
   - `DATABASE_URL` = your Neon connection string
   - `NODE_ENV` = `production`
3. **Create Web Service.** Wait for the build, then open the URL.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build fails on `vite: not found` | Confirm `render.yaml` is in the repo and the build command is `npm install && npm run build`. |
| App loads but every action errors, logs say `no pg_hba.conf entry` or `SSL` | The database URL is wrong or missing. Re-copy it from Neon (include `?sslmode=require`) and update `DATABASE_URL` in Render → **Environment**. |
| Logs say `password authentication failed` | You copied the connection string without the password. In Neon, toggle "Show password" and copy again. |
| `relation "orders" does not exist` | The server creates tables on start. Trigger **Manual Deploy → Deploy latest commit** in Render. |
| Page is blank | Open the web service **Logs** tab in Render for the real error. |
