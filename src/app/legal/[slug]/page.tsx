import { notFound } from "next/navigation";
import Link from "next/link";
import { Header, Footer } from "@/components/ui";
import { legalVersion, termsText } from "@/lib/legal";
import { retention } from "@/lib/config";
export default async function Legal({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!["terms", "privacy", "contact"].includes(slug)) notFound();
  const seller = process.env.SELLER_NAME || "[Seller legal name required]",
    address = process.env.SELLER_ADDRESS || "[Registered address required]",
    tax = process.env.SELLER_TAX_ID || "[Tax / registration number required]",
    email = process.env.SELLER_EMAIL;
  return (
    <>
      <Header />
      <main className="page-container legal-page">
        <h1>
          {
            {
              terms: "Terms of service",
              privacy: "Your privacy",
              contact: "Let’s talk.",
            }[slug]
          }
        </h1>
        <div className="legal-warning">
          <strong>Draft — not approved for real sales.</strong>
          <br />
          Seller details and legal review are outstanding. Test payments only.
          This template is not legal advice or a legally approved document.
        </div>
        <h2>Who is responsible?</h2>
        <p>
          {seller}
          <br />
          {address}
          <br />
          Tax / registration number: {tax}
          <br />
          Contact:{" "}
          {email ? (
            <a href={`mailto:${email}`}>{email}</a>
          ) : (
            "[Seller contact email required]"
          )}
        </p>
        {slug === "terms" ? (
          <>
            <p>Version: {legalVersion}</p>
            {termsText
              .split("\n")
              .slice(1)
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            <h2>Withdrawal request</h2>
            <p>
              Send the seller your name, order identifier, purchase date and a
              clear statement that you wish to withdraw. Final seller-specific
              contact details and the statutory model form must be supplied
              before launch.
            </p>
            <h2>Sources checked</h2>
            <p>
              The draft follows the issues described by{" "}
              <a href="https://prawakonsumenta.uokik.gov.pl/prawo-odstapienia-od-umowy/wylaczenia-prawa-do-odstapienia/">
                UOKiK on digital-content withdrawal exceptions
              </a>{" "}
              and{" "}
              <a href="https://prawakonsumenta.uokik.gov.pl/pytania-i-odpowiedzi/prawo-do-informacji/">
                pre-contract information and durable confirmation
              </a>
              . A seller-specific review remains required.
            </p>
          </>
        ) : slug === "privacy" ? (
          <>
            <h2>What we process</h2>
            <p>
              Account email, authentication records, gift text and media,
              publication settings, consent records and order history. Payment
              details are handled by Stripe; card data is not stored in this
              app. Do not upload sensitive material that you do not need for the
              gift.
            </p>
            <h2>Purpose and lawful basis</h2>
            <p>
              Account and gift delivery support performance of your contract.
              Order retention may be required by law. Security records support
              protection against abuse. The seller must document the exact legal
              bases, retention periods and any legitimate-interest assessment
              before launch.
            </p>
            <h2>Who receives data</h2>
            <p>
              In service mode: the selected hosting provider, Supabase
              (authentication, PostgreSQL and private media), Stripe (payments),
              and Resend (transactional confirmations). These providers are not
              configured in the local demo. The seller must finalise processor
              agreements, hosting regions and safeguards for any international
              transfers.
            </p>
            <h2>Who can view a gift</h2>
            <p>
              Your draft belongs to your account. Published content is available
              to anyone with its unlisted link and, if enabled, password. An
              unlisted link can be forwarded. Administrator inspection requires
              a stated support reason and creates an audit entry.
            </p>
            <h2>Retention and deletion</h2>
            <p>
              You can delete projects and their media, or delete your account
              from the dashboard. Published gifts stop being served at the
              package expiry date. The daily maintenance worker deletes expired
              projects after {retention.expiredDays} days and unpaid drafts
              after {retention.unpaidDraftDays} days without editing. The
              operator must enable and monitor this worker. Minimal order
              records are retained separately where required; the seller must
              finalise their statutory retention schedule. Backup rotation must
              remove copies after {retention.backupDays} days.
            </p>
            <h2>Your rights</h2>
            <p>
              You may request access, correction, export, restriction, erasure
              and, where applicable, portability or objection. Contact the
              seller. You can lodge a complaint with the Polish supervisory
              authority, <a href="https://uodo.gov.pl/">UODO</a>. The controller
              must complete the Article 13 GDPR information before launch.
            </p>
            <h2>Cookies and local recovery</h2>
            <p>
              HttpOnly session cookies authenticate the owner; a one-hour
              recipient cookie controls private media access. A local browser
              draft backup recovers unsaved edits and is removed after
              successful saving. No advertising, tracking or nonessential
              analytics are installed.
            </p>
          </>
        ) : (
          <>
            <h2>Questions, complaints and withdrawal</h2>
            <p>
              {email ? (
                <>
                  Email <a href={`mailto:${email}`}>{email}</a>.
                </>
              ) : (
                "The seller’s contact email has not been configured. Real sales remain blocked."
              )}{" "}
              Include your order identifier and a description of the issue. Do
              not send gift passwords, access links, payment card details or
              private letters in a support request.
            </p>
            <h2>Need to make a change?</h2>
            <p>
              Open <Link href="/dashboard">your gifts</Link> to edit a draft,
              republish a paid gift or regenerate its link. Returning from
              Stripe does not confirm payment: check the order status in your
              dashboard.
            </p>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
