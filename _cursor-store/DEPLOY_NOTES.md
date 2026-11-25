# Billkit deploy notes

## Build

```bash
npm install
npm run build
npm start
```

Dev server: `npm run dev` (port 3847).

Local app while this agent is running: http://127.0.0.1:3847

## Tests

```bash
npm test
npm run typecheck
npm run test:e2e
```

CI: `.github/workflows/ci.yml` on `ubuntu-latest`, no secrets. Playwright `@playwright/test` 1.65.1. Typecheck is `next typegen && tsc --noEmit`.

Latest local results: 13 unit tests passed, production build succeeded, 7 Playwright tests passed (auth, create-and-send, mock payment, overdue dashboard, read-only demo, tenant isolation, mobile marketing).

## Environment

Every variable is optional. With none set, Billkit runs in mock mode and still completes signup, invoicing, payment, billing, email, and reminder copy.

- `SESSION_SECRET` — sign mock sessions before any public mock-mode deploy
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — all three Supabase values are required together
- `STRIPE_SECRET_KEY` — test secret `sk_test_...`
- `STRIPE_WEBHOOK_SECRET` — endpoint `POST /api/stripe/webhook`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — optional
- `RESEND_API_KEY`
- `RESEND_FROM`
- `GROQ_API_KEY` / `GROQ_MODEL`
- `GEMINI_API_KEY` / `GEMINI_MODEL`
- `BILLKIT_E2E=1` — Playwright only; enables `POST /api/test/reset`

Apply `supabase/migrations/20261125120000_init.sql` for live Postgres. Super admin is `app_metadata.role = superadmin`, not user metadata.

## Live URL

Target: https://billkit.quvantic.com

Vercel CLI in this environment is not logged in (`vercel whoami` → loggedIn false, no token). No preview deployment was created. After `npx vercel login`, deploy with `npx vercel deploy` and attach the hostname. Vercel will show the DNS records Mustafa needs to add for billkit.quvantic.com.

## Git

Commit `d2c65f3` on `main`, pushed to Origin. Bundle: `/cursor/stores/self/repo.bundle`.
