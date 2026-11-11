# Operations and recovery

Run the email worker every minute and maintenance daily. Review failed/review delivery jobs and pending deletions. Operational project listings exclude private bodies. Inspect content only for necessary support, use a non-sensitive reason/ticket reference and preserve the audit record.

Do not log passwords, cookies, tokens, gift URLs, request bodies, letters or provider secrets. Configure infrastructure redaction separately. Unlisted links still grant access to anyone holding them, subject to the optional password.

## Retention and deletion

Shared configuration defines 30 days after gift expiry, 90 days of inactivity for unpaid drafts and a 30-day backup rotation target. Paid availability comes from the immutable purchased package, initially 365 days. The worker deletes eligible projects/media, retries incomplete deletions, cleans abandoned media reservations older than an hour and expires sessions/rate records. It reports counts only. Without scheduling, expiry still blocks recipients, but physical cleanup does not run.

Project deletion unpublishes and marks the project as deleting before touching storage. Failures leave a pending project for a safe retry. Active uploads block deletion until complete. Account deletion removes projects, hosted identity and sessions, clears email payloads and anonymises order email references. Minimal order amounts, package snapshots and consent evidence remain for legal/accounting review. Deleted content may remain in backups until rotation; communicate this.

Images are decoded, auto-oriented, bounded to 2,400 pixels and converted to metadata-free WebP. Previews are bounded to 1,200 pixels. The original upload is not retained separately. Video/audio remain in accepted formats with byte-range playback. Users should keep original files separately and hold the necessary rights.

## Back up

Encrypt backups in a separate, access-controlled location and rotate after 30 days. Never accidentally include the original parent project’s private media in a platform backup/deployment.

Local mode: stop this app, copy the complete `.data/` directory (database, WAL companions if present, private media) together, then restart. Copying while stopped avoids database/file mismatches. This is local recovery, not a production availability design.

Service mode: configure PostgreSQL point-in-time recovery or consistent exports, plus a separate versioned backup of the private Storage bucket. Database backups alone do not include storage-object bytes. Record a matching DB/object recovery timestamp and keep credentials separately in a secret manager.

## Restore drill

1. Restore into isolated staging, not directly over active customer data.
2. Restore the schema/data and matching object bytes. Keep Stripe in test mode and use a test email sender.
3. Invalidate restored owner/viewer sessions before exposing the restored app. Recipient links may remain valid unless rotated: protect the restored database accordingly.
4. Use two fictional accounts to check owner isolation; check an eligible gift as an anonymous recipient.
5. Verify representative media, orders, consent/package snapshots and publication revisions. Reconcile Stripe events after the backup, keeping webhook deduplication intact.
6. Record actual recovery time/data-loss window. Define RPO/RTO with the operator before sales; no untested recovery target is promised.

## Incidents

If Stripe succeeds during app downtime, restore the endpoint and replay the provider’s signed event. Do not grant access from a screenshot or success URL. Duplicate events are safe. Unmapped events fail transactionally without permanently consuming their event ID, allowing reconciled retry.

Email failure leaves paid dashboard access intact. Retry due outbox jobs. Reconcile `review` jobs with Resend before an intentional resend outside its 24-hour deduplication window.

Block abusive projects in administration; content inspection is a separate audited action. Privileged database/operator access must also be audited by the hosting provider.
