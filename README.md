# WebsiteGift

Current handoff scope: **local demonstration**, as requested by the user. External provider acceptance and real sales are deferred. No public deployment or live payment is enabled.

A runnable personalised digital gift platform. **English interface and demo content; PLN pricing.** The original anniversary gift and its approximately 1 GB of private media remain outside this application and its build/deployment context.

The gift renderer now reuses the original film scene engine, photo finale, archive styles and Three.js sky engine. See [restoration notes](docs/RESTORATION.md) for editable settings, verified behavior and remaining fidelity gaps. The editor/storefront keep the platform interface.

**Not cleared for real sales.** Local workflows have been tested. Real Stripe Checkout, hosted PostgreSQL/Supabase, transactional delivery and deployment still require provider configuration and staging acceptance. Live Stripe keys are deliberately rejected.

## Run locally

Requires Node.js 24.12+ and npm. From `platform/`:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run db:migrate
npm run seed:local
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The [complete original gift demo](http://127.0.0.1:3000/demo/original) starts with the recovered original menu and fictional content. Skip copying the example if `.env.local` already contains configuration.

The optional local seed creates a **fictional, unpaid** preview account: `preview@blisko.local` / `Blisko-local-preview-2026`. It refuses external databases and service mode, and creates no paid entitlements. You can also register a new account. Local passwords use salted scrypt; service mode uses Supabase Auth. Local records and private files live in `.data/`, ignored by Git and Docker.

## Implemented

- Storefront, four product pages and interactive demos, configurable packages, FAQ, contact and clearly labelled draft legal pages.
- Accounts, gift library, duplication of text/settings, project/account deletion and order history.
- Data-driven cinematic film, interactive archive, Three.js cosmos with an accessible fallback, and clue/reveal surprises.
- Editing names, occasion, date, dedication, finale, sections, dynamic item lists, text, categories, media, crop, supported themes/fonts, scene durations and reveal answers. Reorder or hide sections/items.
- Server autosave, revision conflict checks, local unsaved-draft recovery, mobile/desktop previews and a shared recipient renderer.
- Separate draft/published snapshots; paid publication, stable links, QR download, passwords, link regeneration/revocation. Recipients need no account.
- Server-priced Stripe test Checkout; raw-body webhook signatures; transactional event deduplication; delayed, failed and expired payments; refund revocation. Success URLs never grant access.
- Private, authorised media delivery, byte ranges, signature/type checks, 25 MB upload limit, image decoding/resizing/metadata stripping, smaller previews and package/rate limits.
- Server-protected administrator forms for storefront, products, FAQ and packages; operational order/delivery views, blocking and audited content inspection.
- Durable confirmation outbox, immutable payloads, backoff, provider idempotency and reconciliation outside the safe retry window.
- Ordered migrations, Supabase security SQL, retention cleanup, Dockerfile and backup/restore instructions.

## Verify

```powershell
npm run typecheck
npm test
npm run build
# With the local server running in another terminal:
npm run test:e2e
```

Browser tests use installed Chrome and require local mode at `127.0.0.1:3000`. They create fictional accounts in the local application database. Domain tests use an isolated temporary SQLite database. Both refuse an inherited external `DATABASE_URL`; never run fixtures against customer data.

Paid-publication browser tests introduce a **synthetic payment fact from the test runner**. There is no application endpoint or production payment bypass. This does not verify an actual Stripe payment. See [verification](docs/VERIFICATION.md).

## Service setup and deployment

See [setup](docs/SETUP.md), [operations/recovery](docs/OPERATIONS.md), [audit/architecture](docs/AUDIT.md), and [release blockers](docs/BEFORE-SALES.md). For a local production build, run `npm run build` then `npm start`. Deploy only `platform/`, never its parent folder or original `media/`.

| Path | Responsibility |
|---|---|
| `src/lib/schema.ts` | Versioned content and validation |
| `src/lib/service.ts` | Ownership, drafts, snapshots, package enforcement |
| `src/lib/db.ts`, `migrations/` | SQLite/PostgreSQL transactions and migration history |
| `src/lib/payments.ts`, `mail.ts` | Verified payment facts and outbox |
| `src/lib/media.ts` | Private storage and processing |
| `src/lib/config.ts`, `i18n.ts` | Brand, package defaults, retention and locale/currency registry |
| `src/components/editor.tsx` | Editor and autosave |
| `src/components/experience.tsx`, `cosmos.tsx` | Shared renderers |
| `src/app/api/[...path]/route.ts` | Authenticated HTTP boundary |
| `tests/` | Integration/browser acceptance tests |

Schema v1 is the initial content schema. `migrateGift` rejects unsupported versions; future changes must add explicit migrations. Only English and PLN are currently offered. Another locale requires translated messages and a schema migration; another currency needs an explicit server price book rather than client conversion.

