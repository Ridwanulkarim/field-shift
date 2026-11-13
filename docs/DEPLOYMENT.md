# Deployment: Vercel (frontend) + Render (API)

Browser -> `https://field-shift-agrinomy.vercel.app` (static React build)
`/api/*` -> Vercel rewrite -> `https://field-shift-qfv8.onrender.com/api/*` (Express)

The browser only ever calls its own origin (`/api/...`), so the session cookie stays first-party.

## Vercel
- Project root directory: repo root (uses `/vercel.json`) or `frontend/` (uses `frontend/vercel.json`). Both rewrite `/api` to Render.
- No environment variable is needed. Leave `VITE_API_URL` unset.
- Changing the Render URL means editing the `destination` in both vercel.json files.

## Render (web service, root directory `backend`)
- Build: `npm ci` (runs `prisma generate`). Start: `npm start`. Health check: `/api/health`. `render.yaml` has these.
- Required environment variables:
  | Variable | Value |
  |---|---|
  | `NODE_ENV` | `production` |
  | `CORS_ORIGIN` | `https://field-shift-agrinomy.vercel.app` (comma-separate more origins) |
  | `ANONYMOUS_SESSION_SECRET` | 32+ random characters |
  | `DATABASE_URL_PRODUCTION` / `DIRECT_URL_PRODUCTION` | Neon strings (without them the API serves the committed offline files; Fields needs the database) |
  | `TRUST_PROXY` | `1` |
- A wrong `CORS_ORIGIN` shows up as 403 `ORIGIN_NOT_ALLOWED` on POST/PATCH/DELETE (Planner "Evaluate", Fields save).

## Smoke test after deploy
```bash
curl https://field-shift-qfv8.onrender.com/api/health
curl https://field-shift-agrinomy.vercel.app/api/health      # same JSON = rewrite works
curl -X POST https://field-shift-qfv8.onrender.com/api/evaluate -H "Origin: https://field-shift-agrinomy.vercel.app" -H "Content-Type: application/json" -d '{}'   # expect 422, not 403
```
Render's free tier sleeps when idle. The frontend pings `/api/health` on load and retries GETs, but the first visit can still take up to a minute.
