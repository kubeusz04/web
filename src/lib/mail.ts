import { query, transaction } from "./db";
import { appUrl } from "./config";
import { termsText } from "./legal";
type Job = {
  id: string;
  order_id: string;
  attempts: number;
  payload: string | null;
};
type Order = {
  email: string;
  amount: number;
  currency: string;
  plan: string;
  consent: string;
  status: string;
  created_at: string;
};
export async function retryEmails() {
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
    return { sent: 0, configured: false };
  const jobs = await query<Job>(
    "SELECT * FROM email_jobs WHERE status IN ('pending','failed') AND next_at<=? AND attempts<10",
    [new Date().toISOString()],
  );
  let sent = 0;
  for (const job of jobs) {
    const [order] = await query<Order>("SELECT * FROM orders WHERE id=?", [
      job.order_id,
    ]);
    if (
      !order ||
      order.status !== "paid" ||
      order.email === "[account deleted]"
    ) {
      await transaction((tx) =>
        tx.run("UPDATE email_jobs SET status=? WHERE id=?", [
          "canceled",
          job.id,
        ]),
      );
      continue;
    }
    // Provider idempotency lasts 24 hours. Uncertain deliveries beyond that require reconciliation.
    if (
      job.attempts > 0 &&
      Date.now() - Date.parse(order.created_at) > 23 * 3600000
    ) {
      await transaction((tx) =>
        tx.run("UPDATE email_jobs SET status=?,last_error=? WHERE id=?", [
          "review",
          "Reconcile provider delivery before resending outside the idempotency window.",
          job.id,
        ]),
      );
      continue;
    }
    const consent = JSON.parse(order.consent),
      plan = JSON.parse(order.plan);
    const payload =
      job.payload ||
      JSON.stringify({
        from: process.env.MAIL_FROM,
        to: order.email,
        subject: "WebsiteGift — order confirmation",
        text: `Order confirmation: ${job.order_id}\nTotal: ${order.amount / 100} ${order.currency.toUpperCase()}\nPackage: ${plan.name}\nHosting: ${plan.days} days from confirmed payment.\nConsent record: terms=${consent.terms}, immediate delivery=${consent.immediate}, withdrawal acknowledgment=${consent.acknowledge}; version=${consent.version}; at=${consent.at}\nSeller: ${JSON.stringify(consent.seller || { name: "TEST FIXTURE" })}\nDashboard and publication: ${appUrl()}/dashboard\n\nTERMS ACCEPTED AT CHECKOUT (durable copy):\n${consent.termsText || termsText}\n\nThis confirmation is not a tax invoice.`,
      });
    const claimed = await transaction(async (tx) => {
      const rows = await tx.all(
        "UPDATE email_jobs SET next_at=?,attempts=attempts+1,payload=COALESCE(payload,?) WHERE id=? AND next_at<=? AND status IN ('pending','failed') RETURNING id",
        [
          new Date(Date.now() + 600000).toISOString(),
          payload,
          job.id,
          new Date().toISOString(),
        ],
      );
      return rows.length > 0;
    });
    if (!claimed) continue;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `confirmation-${job.order_id}`,
        },
        body: payload,
      });
      if (!response.ok) throw new Error("delivery");
      await transaction((tx) =>
        tx.run("UPDATE email_jobs SET status=?,last_error=NULL WHERE id=?", [
          "sent",
          job.id,
        ]),
      );
      sent++;
    } catch {
      await transaction((tx) =>
        tx.run(
          "UPDATE email_jobs SET status=?,last_error=?,next_at=? WHERE id=?",
          [
            "failed",
            "Provider did not confirm delivery",
            new Date(
              Date.now() + Math.min(3600000, 60000 * 2 ** job.attempts),
            ).toISOString(),
            job.id,
          ],
        ),
      );
    }
  }
  return { sent, configured: true };
}
