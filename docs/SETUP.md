# Service configuration

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

## Stripe — test mode only

1. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` for test mode. `sk_live_` keys are rejected.
2. Create a test webhook destination at `https://YOUR-STAGING-HOST/api/stripe/webhook`. For local forwarding, follow Stripe’s documented webhook tooling and use that forwarder’s signing secret.
3. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` and `charge.refunded`.
4. Checkout builds prices/currency on the server from the package configuration. Stripe Price IDs are unnecessary. No specific payment methods, including BLIK, are promised or forced; availability depends on the actual account/currency configuration.
5. Run the external checklist in `BEFORE-SALES.md`. A return URL never unlocks a gift. Check the order history after verified webhook delivery, then publish explicitly.

Checkout sessions last 30 minutes. Pending orders reuse their idempotency key and immutable price snapshot. Switching package while a checkout is pending is rejected to avoid charging a different offer; finish or wait for its expiry/webhook. Reconcile uncertain requests with Stripe before attempting a manual replacement order.

Full or partial `charge.refunded` notifications conservatively revoke the order’s publication and entitlement. Confirm the final refund policy with the seller/legal adviser before live release. The app does not initiate refunds; use Stripe’s test dashboard during acceptance.

Service Checkout also requires `LEGAL_APPROVED=true` and all seller fields. This is a release gate, not proof of legal approval. Local mode permits Stripe test integration with labelled draft documents. Do not set the approval flag just to bypass legal work.

## Transactional email

Configure a verified Resend domain, `RESEND_API_KEY` and `MAIL_FROM`. Supabase Auth email uses its own SMTP settings.

Run `npm run mail:retry` every minute. Administrators can also retry due jobs from Delivery. Webhooks enqueue work; email failure never revokes entitlement or charges again. Confirmations include immutable price/package/consent records and the accepted terms text, not only a mutable terms link.

Retries reuse a persisted payload and idempotency key. Uncertain attempts near the provider’s 24-hour idempotency boundary move to `review`; reconcile provider delivery before resending. Do not clear sent markers blindly.

## Deploy

Only build/deploy `platform/`. The supplied local Docker context can be built with:

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
