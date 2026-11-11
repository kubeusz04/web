# Service configuration

## Heroku

The `websitegift` Heroku app is connected to `kubeusz04/web` on `main` using the official Node.js buildpack. `Procfile` runs `npm start`. The launcher binds to `0.0.0.0` on Heroku and uses its assigned `PORT`.

Set `APP_MODE=service` and `APP_URL` to the HTTPS application origin. Configure the Supabase variables below. Use the session pooler on IPv4, with `sslmode=verify-full`, and set `NODE_EXTRA_CA_CERTS=/app/certs/supabase-ca.crt` so Node trusts Supabase's official database CA. The certificate is public and bundled in the repository. Secrets belong in Heroku Config Vars.

Deploy manually from the Heroku Deploy tab after pushing a verified commit. Check the actual student-credit allocation and monthly usage in Heroku Billing. Basic web compute is chargeable and consumes eligible credits.

Use separate staging projects. Store credentials in server environment variables or `.env.local`, never `NEXT_PUBLIC_*`. Do not paste or commit secrets.

## PostgreSQL / Supabase

1. Set `APP_MODE=service`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET=gift-media` and an HTTPS `APP_URL`. Follow the provider connection string’s TLS configuration; do not disable certificate verification.
2. Run `npm run db:migrate`. Portable numbered migrations are applied transactionally and tracked in `schema_migrations`. PostgreSQL migrations use an advisory lock. Initialization also applies missing migrations, but run the command explicitly before release.
3. Apply `migrations/002-postgres-security.sql` in Supabase SQL Editor. It enables RLS, denies direct anon/authenticated table access and creates a private storage bucket. This Supabase-specific step is separate from portable migrations. Keep any custom bucket name consistent in SQL and environment.
4. Keep Supabase email confirmation enabled. Configure site/confirmation URLs and its auth SMTP provider. Unconfirmed signup displays a confirmation instruction; confirm, then sign in.
5. Prove anon/authenticated direct requests cannot list application data or storage objects. Only the monolith’s server credentials access the bucket and database.

The DB connection must own the tables or have an appropriate server RLS bypass role. Do not use browser credentials as `DATABASE_URL`. Service cookies require HTTPS. Supabase identity is checked at sign-in; the application then uses hashed seven-day owner sessions and checks its own blocked/role state on requests. Operational account revocation must clear app sessions as well as hosted identity sessions.

## Administrator

Set `ADMIN_EMAIL` to a controlled email before its first registration/sign-in. Local registration or the first confirmed Supabase login creates the server role. Existing profiles are not silently promoted by later environment changes: use a restricted, audited DB operation. Never accept roles from a client field.

## Stripe (sandbox only)

Use standard Stripe-hosted Checkout in payment mode. The Stripe MCP implementation planner was called and accepted for WebsiteGift on 2026-11-11. Managed Payments and Connect are excluded.

Store a replacement test restricted key (`rk_test_`) or test secret key (`sk_test_`) in Heroku `STRIPE_SECRET_KEY`; no browser key is required for hosted redirects. Rotate any previously exposed secret in Stripe. Grant the restricted key the Checkout Session create/read, charge read and dispute read permissions needed by this integration, and verify those permissions in sandbox.

Create a sandbox webhook endpoint at `https://websitegift-2df82156633c.herokuapp.com/api/stripe/webhook`, with the API version matching stripe-node 23.1.0. Store its signing secret in `STRIPE_WEBHOOK_SECRET`. Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`

Dynamic payment methods remain enabled. Manage Link and eligible payment methods in the sandbox Dashboard. Adaptive Pricing and automatic tax have not been enabled; confirm pricing, supported currencies and tax registrations before changing those features.

Checkout uses Stripe's default session expiry (24 hours), allowing identical idempotent creation retries without a time-dependent `expires_at`. The application retrieves pending sessions before allowing another checkout: expired sessions release the pending order; completed asynchronous payments stay blocked until confirmation. An unknown creation result with no stored session after 23 hours requires manual reconciliation before another attempt.

Partial refunds preserve hosting. A full refund permanently revokes publication and viewer sessions. Active/lost disputes suspend payment entitlement and unpublish the gift; a won/closed warning dispute restores the entitlement without extending hosting. The owner must publish again. Current Stripe objects are retrieved to avoid stale dispute/refund snapshots overriding the latest state. Unrelated merchant payments are ignored.

The success redirect never fulfils orders. Signed webhooks and session reconciliation apply verified amounts/currency atomically. Payment state and email jobs commit together; retry email delivery using `npm run mail:retry`. Live keys/events remain rejected. Hosted checkout additionally requires actual seller details and `LEGAL_APPROVED=true` after review; do not use placeholders to bypass that gate.

Before launch, complete a genuine sandbox Checkout and verify signed delivery, delayed payment success/failure, duplicate/reordered events, full/partial refunds and disputes. Local mocked Stripe tests do not establish provider acceptance.

## Transactional email

Configure a verified Resend domain, `RESEND_API_KEY` and `MAIL_FROM`. Supabase Auth email uses its own SMTP settings.

Run `npm run mail:retry` every minute. Administrators can also retry due jobs from Delivery. Webhooks enqueue work; email failure never revokes entitlement or charges again. Confirmations include immutable price/package/consent records and the accepted terms text, not only a mutable terms link.

Retries reuse a persisted payload and idempotency key. Uncertain attempts near the provider’s 24-hour idempotency boundary move to `review`; reconcile provider delivery before resending. Do not clear sent markers blindly.

## Deploy

Only build/deploy `WebsiteGift/`. The supplied local Docker context can be built with:

```powershell
docker build -t blisko-staging .
```

Provide environment values through the hosting secret manager. The container listens on port 3000 as a non-root user and defaults to service mode. Configure HTTPS, a maximum request body of 26 MB, timeouts and proxy limits. Redact/disable access logging for `/g/*`, `/api/gift/*`, cookies and query strings. App request logging is disabled; infrastructure logging needs separate configuration.

Schedule `npm run maintenance` daily and `npm run mail:retry` every minute from the deployed app directory/container. Monitor failure counts and delivery review jobs. Verify Linux image-processing dependencies. Docker/PostgreSQL deployment has not run here: the Docker engine is unavailable and service credentials are absent.

Review CSP/security headers for the hosting environment. The supplied policy allows Next.js inline bootstrap scripts; customer HTML is never rendered. A nonce policy can further harden the deployment.

## Sources consulted

- [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route), [cookies](https://nextjs.org/docs/app/api-reference/functions/cookies), and installed 16.4.5 docs in `node_modules/next/dist/docs/`.
- [Supabase passwords](https://supabase.com/docs/guides/auth/passwords), [storage access control](https://supabase.com/docs/guides/storage/security/access-control).
- [Stripe Node webhook signing](https://github.com/stripe/stripe-node#webhook-signing), [Checkout fulfilment](https://docs.stripe.com/checkout/fulfillment).
- [Resend send email](https://resend.com/docs/api-reference/emails/send-email), [24-hour idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
- [Sharp resizing](https://sharp.pixelplumbing.com/api-resize/), [metadata rules](https://sharp.pixelplumbing.com/api-output/).
- [Three.js disposal](https://github.com/mrdoob/three.js/blob/dev/manual/pages/how-to-dispose-of-objects.html).

Next.js, Supabase, Stripe, Tailwind, Three.js and Sharp were resolved through Context7 CLI; relevant official pages were checked directly too. Documentation alone does not establish provider-backed verification.
