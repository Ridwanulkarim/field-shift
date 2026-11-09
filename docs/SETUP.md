# Setup guide: run Field Shift on your computer

This takes about 20 minutes. You need a free Neon account (hosted PostgreSQL) **or** a local PostgreSQL.

## 0. What you need installed

| Tool | Version | Check |
|---|---|---|
| Node.js | **22.18 or newer** (24 is fine) | `node --version` |
| npm | 10 or newer | `npm --version` |
| Git | any recent | `git --version` |

Node 22.18+ is required because the generated database client is a `.ts` file that Node must run directly. On an older Node you will see `Unknown file extension ".ts"`.

An internet connection is needed for `npm install`, Neon and (later) NASA.

## 1. Unpack and start the repository

Working directory: wherever you keep projects (for example `~/Desktop`).

```bash
unzip field-shift-final.zip
cd field-shift
git init -b main
git add .
git commit -m "Field Shift: full application"
```

`git status` must **not** list `node_modules`, `.env` or `src/generated`. `.gitignore` hides them.

## 2. Create the Neon database

1. Go to https://neon.com (formerly neon.tech) and sign up (free plan is enough).
2. Create a project named `field-shift`. Pick the region closest to you that Neon offers (for Bangladesh, a Singapore region if listed).
3. In the project dashboard click **Connect**. You need **two** strings:
   - **Pooled** connection string: the host contains `-pooler`. Turn the *Connection pooling* switch **on** to see it. This is `DATABASE_URL_PRODUCTION` (used by the production app).
   - **Direct** connection string: no `-pooler` in the host. Turn pooling **off** to see it. This is `DIRECT_URL_PRODUCTION` (used by Prisma migrations).
4. If a string ends with `&channel_binding=require`, delete that part.

Treat these strings like passwords. Never commit them, never paste them into chat or issues.

## 3. Configure the backend

Working directory: `field-shift/backend`

Create one environment file:

```bash
cp .env.example .env
```

Set the local PostgreSQL URLs in `DATABASE_URL_DEVELOPMENT` and
`DIRECT_URL_DEVELOPMENT`. Set the Neon URLs in `DATABASE_URL_PRODUCTION` and
`DIRECT_URL_PRODUCTION`. `NODE_ENV` selects which pair is used:

```bash
NODE_ENV=development npm run dev
NODE_ENV=production npm start
```

The real `.env` file is ignored by git. Never commit it.

## 4. Install, create tables, load reference data

Working directory: `field-shift/backend`

```bash
npm install
NODE_ENV=development npm run db:deploy
npm run db:seed
```

- `npm install` installs packages and runs `prisma generate` (creates the database client in `src/generated/`).
- `NODE_ENV=development npm run db:deploy` creates the tables in the local development database. Expected last line: `All migrations have been successfully applied.`
- `npm run db:seed` loads 12 districts and 22 crops. Expected: `Seeded reference data: 12 districts, 22 crops.` It is safe to run again.

The seed, ingestion and analysis commands use the database selected by `NODE_ENV`.
Set `NODE_ENV=production` before running them against the production database.

The anonymous field migration is additive. Existing fields created before
anonymous ownership have no session and are not exposed by the field API until
an operator assigns ownership; do not guess or share a session identifier.
New fields receive an opaque cookie automatically.

## 5. Load climate data

**Option A: real NASA POWER data (what you should present).**

```bash
npm run ingest:nasa -- --district=rajshahi
```

Try one district first. Expected: `OK  9131 days, ... missing values`. Then load all:

```bash
npm run ingest:nasa
```

Allow several minutes; it waits 2 seconds between districts on purpose. No NASA key is needed.

> **Important:** failures are recorded at `/api/health/data`; successful retrieval is stored with provenance and later API responses identify it as cached.

The NASA client timeout and retry count are configurable with
`NASA_POWER_TIMEOUT_MS` and `NASA_POWER_RETRIES`. Historical ingestion uses
`--start=YYYY --end=YYYY`.

**Option B: synthetic demo data (works offline, clearly not NASA).**

```bash
npm run db:seed:synthetic
```

This generates numbers by software so you can demo the screens. Every screen and API answer then shows a **SYNTHETIC DEMO DATA** warning. Real NASA data automatically takes priority once it is loaded. Do not present synthetic results as findings.

To refresh an existing real dataset without downloading the full history:

```bash
npm run ingest:refresh -- --lag=7 --overlap=2
```

Schedule this command with the deployment platform's cron or a separate worker,
not inside the Express process. `--lag` avoids requesting dates NASA POWER may
not have published yet; `--overlap` re-fetches a recent window and preserves
previously valid values when the refresh contains fill values.

## 6. Start the app (two terminals)

Terminal 1, working directory `field-shift/backend`:

```bash
npm run dev
```
Expected: `Field Shift API listening on http://localhost:4000`.

Terminal 2, working directory `field-shift/frontend`:

```bash
npm install
npm run dev
```
Open http://localhost:5173.

## 7. Check that it works

With the backend running:

```bash
curl http://localhost:4000/api/health          # {"status":"ok",...}
curl http://localhost:4000/api/health/db       # {"status":"ok","database":"reachable"}
curl http://localhost:4000/api/health/data     # which districts have nasa / synthetic / none
```

In the browser: choose a district, keep Boro + Aman selected, press **Compare rotations**. You should see your current rotation plus three alternatives, each with reasons, risks and an "What this does not know" list.

## 8. Run the automated tests

Working directory: `field-shift/backend`

```bash
npm test
```
Expected without a database: every test file passes and the tests that need a real database are reported as skipped (the totals change as tests are added, so compare passed against failed, not a fixed number).

To also run the database tests, point them at a **throw-away** database (a Neon dev branch or a local database that has been migrated). They create and delete one district called `zz-test-district`:

```bash
TEST_DATABASE_URL="postgresql://..." npm test
```
Expected: no failed tests and nothing skipped.

## 9. Single-server demo mode (one command on the demo laptop)

```bash
cd frontend && npm run build
cd ../backend
FRONTEND_DIST=../frontend/dist npm start
```
Open http://localhost:4000. The API and the page come from one process.

**Ports, once:** API `4000` (`PORT`), Vite dev server `5173` (it proxies `/api` to 4000), `CORS_ORIGIN=http://localhost:5173`. If you change `PORT`, change the proxy target in `frontend/vite.config.js` and `getApiBase` in `frontend/src/services/api.js`.

**No database, or wifi off:** see `docs/OFFLINE.md` (`npm run export:offline` once, then `npm run start:offline`, or `OFFLINE=1`).

Before a demo: open the app once a few minutes early. Neon free projects can pause when idle, and the first request after a pause is slow.

## 10. Using a local PostgreSQL instead of Neon

```bash
sudo -u postgres psql -c "CREATE ROLE fieldshift LOGIN PASSWORD 'choose-a-password' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE fieldshift OWNER fieldshift;"
```
In `backend/.env` set only:
```
DATABASE_URL=postgresql://fieldshift:choose-a-password@localhost:5432/fieldshift
```
(no `sslmode`, no `DIRECT_URL` needed). Then continue from step 4. Use letters and digits in the password so it needs no URL-encoding.

## 11. Team workflow

- One person creates the Neon project and shares the connection strings **privately** (not in Git). Or each person makes their own free Neon project and runs steps 2 to 5; the result is identical because everything is created by scripts.
- Work on branches: `git switch -c my-change`, commit, open a pull request.
- Never commit `.env`.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `Unknown file extension ".ts"` | Node older than 22.18. Install the current LTS from nodejs.org. |
| `P1001: Can't reach database server` | Wrong host, Neon project asleep (retry once), or no internet. Re-copy the string from Neon. |
| `P1000` / `password authentication failed` | Password changed or mistyped. Copy a fresh string from Neon (**Connect**). |
| `prisma migrate` hangs or fails on the pooled host | `DIRECT_URL` must be the **non-pooled** string. |
| Error mentioning `channel_binding` | Remove `&channel_binding=require` from both URLs. |
| `prisma generate` fails during `npm install` | Needs internet to download Prisma files. Check network/proxy, then `npm run db:generate`. |
| Page shows "Cannot reach the Field Shift server" | Backend not running, or not on port 4000. |
| Banner says **SYNTHETIC DEMO DATA** | Expected until NASA ingestion has succeeded for that district. |
| `No climate data is loaded for this district` | Run step 5 for that district. |
| `EADDRINUSE` port 4000 | Another process uses it. Set `PORT=4001` in `.env`, change the proxy target in `frontend/vite.config.js` and the port in `frontend/src/services/api.js`. |
| `npm run ingest:nasa` prints `FAILED` | Check internet and `https://power.larc.nasa.gov` is reachable. Send the exact message to the team. |
