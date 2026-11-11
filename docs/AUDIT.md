# Audit and architecture — 6 November 2026

The original is a static gift with no package manifest, accounts, backend, database or orders. Confirmed: index.html (film), home.html (navigation), us.html (archive), cosmos.html (Three.js), kata.html (surprise), the named JavaScript modules and both letters/reasons files. Its media folder contains 2,688 files totalling 1,014,688,130 bytes. No original files were changed or copied into the new application.

External paths include ../mobile.css and ../mobile.js on all experiences, plus ../calendar-home.css and ../holidays.html in navigation. The original loads Google fonts, hardcodes private planets and third-party references, and builds its film from private date-based manifests. The shots/us/util renderers use innerHTML in text-producing paths. These paths were not reused for customer input.

The new app lives only in platform/. Demo names/stories are fictional; the coast photograph is AI-generated. No original photography, private letter, recording, audio track or franchise asset appears in public seeds, tests or the deployment context. The user subsequently requested English, which overrides the initial Polish interface preference; PLN and Polish/EU sales requirements remain.

## Stages

1. Versioned schema, validation, Next.js/TypeScript monolith, PostgreSQL adapter and explicitly local SQLite adapter.
2. Account → film project → save → preview → Checkout integration → verified payment fact → explicit snapshot publication → recipient.
3. Archive, actual Three.js cosmos and clue/reveal surprises through the common model/editor.
4. Storefront and administrator role enforced on the server.
5. Isolation/payment/publication tests, responsive review, private media hardening, outbox/cleanup workers and deployment documentation.

The local path is tested with synthetic payment fixtures. Real service-backed acceptance remains a release blocker.

## Trust boundaries

- Browser input is untrusted. Zod validates the document/version. Customer content renders as React text, without executable HTML/JavaScript.
- HTTP mutations validate origin, authenticate opaque HttpOnly owner sessions, enforce roles/rate limits and invoke domain services. Browser user IDs and prices are never authoritative.
- SQLite is labelled local mode, not a production fallback. Missing service configuration fails closed.
- Project mutations use transactions and row locks; stale revisions cannot overwrite newer saves. Publication replaces one complete JSON snapshot.
- Supabase authenticates hosted sign-in. The monolith issues hashed seven-day owner sessions and checks its database role/blocked state on each request.
- Storage is private and served through authorised app endpoints. The Supabase security migration grants no browser database/storage access. Server credentials bypass RLS intentionally and must remain secret.
- Recipient links use 256-bit tokens and noindex. Only paid, unexpired published snapshots are served. A one-hour opaque viewer cookie grants access only to their referenced media. Password changes, rotation, refunds and unpublishing invalidate viewer grants.
- Orders snapshot price, package and consent. Signed webhooks are the only HTTP source of payment facts. Deduplication and entitlement changes share one transaction.
- Admin listings exclude customer text. Necessary content inspection requires a reason and an audit entry.

## Renderer decisions

The film retains timed cinematic frames and media controls; the archive unfolds timeline entries and letters; the cosmos contains navigable 3D stars/planets and per-object memories; surprises use editable clues/reveals. Counts come from data. The original branded, microphone-based surprise becomes an original keyboard/touch interaction, avoiding a microphone dependency and licensed franchise references.

The generated references establish ivory/terracotta/midnight colours, editorial headings and a three-column editor. English copy, operational notices and the necessary extra section/media controls intentionally extend the earlier Polish references. System fonts avoid external font requests.
