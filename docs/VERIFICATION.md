# Verification — 6 November 2026

The user selected “Keep this as a local demo for now.” The verified handoff is therefore the local demonstration. External acceptance below remains deferred, not implicitly verified.

## Verified locally

- `npm run build`: production compilation, TypeScript and route generation pass.
- `npm run typecheck`: passes.
- `npm test`: 27 domain/presentation/integration tests pass against an isolated SQLite database.
- `npm run test:e2e`: twelve Chrome browser scenarios pass against the production build, including the standalone `npm start` launcher and original presentation restoration. The launcher build explicitly traces Sharp's native runtime libraries to prevent missing Windows DLLs.
- `npm audit --omit=dev`: zero reported vulnerabilities at verification time.
- `npm run db:migrate`, `npm run seed:local`, `npm run maintenance`: execute successfully locally. `npm run mail:retry` reports `configured: false` without credentials.

Domain tests cover ownership, persistence, stale revisions, unpaid publication, foreign media assignment, wrong payment amounts, duplicate/concurrent payment events, event ordering, atomic snapshots, stable republishing links, package limits, password/link changes, refunds before/after payment, raw-body Stripe signatures, database rate limits, historical prices, immutable email retry payloads, deletion reservations, blocked-project deletion, retention cleanup, unique content IDs and authoritative stored media types.

Current browser scenarios cover registration, upload, autosave, refresh, sign-out/sign-in persistence, original film compositions and photo finale, literal rendering of a script-shaped string, unpaid publication rejection, success-URL non-entitlement, synthetic paid publication, anonymous recipients, draft isolation, republishing, HTTP ownership/CSRF/storage checks, corrupt-image rejection, administrator forms/auditing, WebGL fallback and mobile sky/surprise/film controls. Passwords, revocation and refund rules are covered by domain tests. See `RESTORATION.md` for fidelity limits and unverified media paths.

The paid scenario uses a test-runner database fixture and invokes the same payment-fact service as the webhook. **It is not a real Stripe Checkout verification.** No application route grants synthetic entitlements.

## Visual review

Chrome was used through the available Chrome DevTools connector for page identity, accessibility snapshot and console inspection. No dedicated Browser skill/plugin was available, so repeatable interaction and screenshot verification used project Playwright with installed Chrome. Desktop viewport: 1536×1024. Mobile viewport: 390×844. No uncaught page errors occurred in the tested paths. The checked storefront console had no warnings/errors.

Concept references are `editor-concept.png`, `home-concept.png` and `storefront-lower-concept.png`. Screenshots are saved outside source in the Codex visualizations folder. The concepts and desktop/mobile renders were inspected using `view_image`.

Comparison points: ivory/terracotta/midnight palette; editorial serif headings; brand/header hierarchy; sidebar/form/canvas structure; photograph print/crop treatment; ordered scene rows; media controls; open pricing comparison; FAQ dividers; and mobile stacking/overflow. Fixes included proper form-label association, readable editor typography, bounded desktop scrolling, smaller canvas framing, checkbox sizing and mobile overflow checks.

Intentional deviations: English replaces the earlier Polish concept copy at the user’s request; necessary local-mode, ownership and rights notices are visible; extra section/media/package controls support the actual product; the fictional coast asset differs from the concept photograph; product previews include code-native letter/orbit/reveal UI. The implementation follows the concept’s visual system, but pixel-identical or independent agency sign-off is not claimed.

## Not verified / external gates

No real Stripe transaction, Supabase Auth confirmation, hosted PostgreSQL/RLS test, hosted storage request, real confirmation email, Docker deployment, backup restore drill or physical iOS/Android playback test was performed. Credentials are absent; the local Docker engine is not running. These remain mandatory staging acceptance work. Seller-specific legal documents remain explicitly labelled drafts.

See `BEFORE-SALES.md` and `SETUP.md`. The product must not be represented as ready for real sales until these gates are resolved.


