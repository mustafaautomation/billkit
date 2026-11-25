# Rescued from Cursor

Source: Billkit invoicing SaaS | Cursor https://cursor.com/agents/bc-6bb3ef93-1e08-5ead-aae9-445d0d1462b5
Scope: Last Agent Turn
Captured: 2026-11-25T12:11:27.056Z
Files written: 90

Not in this copy: files Cursor's template created and the agent never changed (e.g. tsconfig, shadcn ui components, lockfiles, public assets) when scope is 'Last Agent Turn'; binaries.

- may be incomplete (check): lib/data/service.ts

## Repairs (25 Nov 2026, Claude Code)

- `lib/data/service.ts` was EMPTY in the capture (the original was ~1060 lines). It was **rewritten from scratch** from its call sites (`lib/actions/*`, `lib/context.ts`, every page/route that imports it), the `Store` interface, domain helpers (money, metrics, plans), email/AI/PDF modules, seed data and the README rules. It exports the 33 functions the app imports plus `Actor` / `InvoiceDraft` types. Behaviour that had to be inferred (not copied): tenant scoping by `actor.workspaceId` (cross-tenant ids -> `not_found`), demo actor rejected with `readonly`, owner-only settings/billing/team, Starter invoice-per-month and seat limits, invoice numbering `<prefix>-<nextNumber>`, first public open marks `sent` -> `viewed` (+ notification + mocked email), lazy overdue sweep when a member loads the dashboard or invoice list (marks `overdue` once, notifies, emails), mock plan change/cancel, invite tokens (7 days) and magic/reset tokens (1 hour, link only returned while email is mocked). Review it before relying on it in production.
- Recreated template files: `tsconfig.json` (`@/*` -> `./*`), `eslint.config.mjs`, `components.json` (shadcn `base-nova`, Base UI), `lib/utils.ts` (re-exports `cn` from the `cn` package).
- Regenerated shadcn/ui components with `npx shadcn@4.23.0 add button input textarea tooltip sonner sheet`.
- Regenerated `package-lock.json` with `npm install`.
- README screenshots (`docs/screenshots/*.png`) re-captured from the running app (mock mode, seeded data) with a throwaway Playwright script; the repo has no screenshot script.

Verified locally: `npm run typecheck` OK, `npm run lint` clean, `npm test` 13 passed, `npm run build` OK, Playwright 7 passed (against `BILLKIT_E2E=1 npm start -p 3847`), plus an ad-hoc check of reminder draft/send, PDF download (token ok / bad token 404), mock Pro upgrade, invite link and super-admin page.
