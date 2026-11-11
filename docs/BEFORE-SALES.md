# Required before the first real sale

The critical external path is **not yet verified**. Do not describe the deployment as sale-ready.

1. Configure staging PostgreSQL, Supabase Auth and a private bucket. Apply portable and Supabase security migrations; prove anonymous/cross-account isolation on the actual services.
2. Complete a real **Stripe test** Checkout and signed webhook. Check delayed success/failure, cancellation/expiry, duplicate/reordered events, success-page refresh, project-specific entitlements and refunds. Verify actual payment-method availability.
3. Verify real confirmation delivery, durable terms/consent content, failures and retries. Enable/monitor the email worker.
4. Supply actual seller name, address, registration/tax details and contact. Obtain Polish/EU review of consumer/privacy documents, digital-content/hosting classification, conformity obligations, withdrawal, complaints, durable confirmation, processor agreements and transfers. Replace labelled drafts; an environment flag is not legal approval.
5. Enable daily cleanup, encrypted database **and object** backups, 30-day rotation and a staging restore drill. Define statutory retention, RPO/RTO and operational ownership.
6. Check HTTPS, cookies, CSP, secret management, infrastructure log redaction, upload limits and dependencies. Run browser acceptance against deployed staging, and test real iOS Safari/Android playback/touch. These physical devices have not been tested here.
7. Obtain explicit authorisation before public deployment, live payments or paid services. Live Stripe keys remain rejected; enabling live mode requires a reviewed code change and release acceptance.

For external acceptance, record environment, timestamp, test order/event IDs and expected/actual results. Exclude links, secrets and private content. Current status: **not run — credentials/configuration absent**.

## Legal sources checked

- [UOKiK — withdrawal exceptions](https://prawakonsumenta.uokik.gov.pl/prawo-odstapienia-od-umowy/wylaczenia-prawa-do-odstapienia/): digital-content exceptions depend on statutory conditions, not only immediate-delivery consent.
- [UOKiK — pre-contract information](https://prawakonsumenta.uokik.gov.pl/pytania-i-odpowiedzi/prawo-do-informacji/): required information and durable confirmation.
- [UODO](https://uodo.gov.pl/), [Article 13 guidance](https://uodo.gov.pl/pl/file/5757): complete the controller information for the actual arrangement.

These sources informed the draft mechanisms; they do not approve the documents or settle seller-specific analysis. No company details, testimonials, customer counts, licensed-music claims or indefinite-hosting promises were invented.
