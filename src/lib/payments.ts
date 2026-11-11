import Stripe from "stripe";
import { transaction, query } from "./db";
import { AppError, type User } from "./security";
import { owned, catalog, enforceLimits } from "./service";
import { appUrl, brand } from "./config";
import { legalVersion, termsText } from "./legal";
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_"))
    throw new AppError(
      "Test payments need Stripe configuration. You have not been charged.",
      503,
    );
  return new Stripe(key);
}
export async function checkout(
  user: User,
  id: string,
  planId: string,
  consent: { terms: boolean; immediate: boolean; acknowledge: boolean },
) {
  const client = stripe();
  if (!consent.terms || !consent.immediate || !consent.acknowledge)
    throw new AppError("Please provide the required consents.");
  if (
    process.env.APP_MODE !== "local" &&
    (process.env.LEGAL_APPROVED !== "true" ||
      !process.env.SELLER_NAME ||
      !process.env.SELLER_EMAIL ||
      !process.env.SELLER_ADDRESS ||
      !process.env.SELLER_TAX_ID)
  )
    throw new AppError(
      "Sales are blocked pending seller details and legal review.",
      503,
    );
  const order = await transaction(async (tx) => {
    const p = await owned(tx, user, id, true);
    const paid = await tx.all(
      "SELECT id FROM orders WHERE project_id=? AND status=?",
      [id, "paid"],
    );
    if (paid.length)
      throw new AppError("This gift is already paid. Continue to publication.");
    const c = await catalog(tx),
      plan = c.plans.find((p) => p.id === planId);
    if (!plan) throw new AppError("Invalid package.");
    await enforceLimits(tx, id, p.draft, plan);
    const pending = await tx.all<{
      id: string;
      stripe_session: string | null;
      plan: string;
      created_at: string;
    }>(
      "SELECT id,stripe_session,plan,created_at FROM orders WHERE project_id=? AND status=? ORDER BY created_at DESC",
      [id, "pending"],
    );
    if (pending.length) {
      if (JSON.parse(pending[0].plan).id !== planId)
        throw new AppError(
          "A checkout is already pending for another package. Complete it or wait for its 30-minute expiry.",
        );
      return {
        id: pending[0].id,
        plan: JSON.parse(pending[0].plan),
        existing: pending[0].stripe_session as string | null,
        createdAt: pending[0].created_at,
      };
    }
    const orderId = crypto.randomUUID(),
      createdAt = new Date().toISOString();
    await tx.run(
      "INSERT INTO orders(id,project_id,owner_id,email,plan,amount,currency,status,consent,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
      [
        orderId,
        id,
        user.id,
        user.email,
        JSON.stringify(plan),
        plan.price,
        brand.currency,
        "pending",
        JSON.stringify({
          ...consent,
          version: legalVersion,
          at: createdAt,
          termsText,
          seller: {
            name: process.env.SELLER_NAME || "TEST MODE",
            address: process.env.SELLER_ADDRESS || "",
            taxId: process.env.SELLER_TAX_ID || "",
            email: process.env.SELLER_EMAIL || "",
          },
        }),
        createdAt,
      ],
    );
    return { id: orderId, plan, existing: null, createdAt };
  });
  const session = order.existing
    ? await client.checkout.sessions.retrieve(order.existing)
    : await client.checkout.sessions.create(
        {
          mode: "payment",
          customer_email: user.email,
          client_reference_id: order.id,
          metadata: { orderId: order.id, projectId: id, userId: user.id },
          line_items: [
            {
              price_data: {
                currency: brand.currency,
                unit_amount: order.plan.price,
                product_data: { name: `WebsiteGift — ${order.plan.name}` },
              },
              quantity: 1,
            },
          ],
          success_url: `${appUrl()}/dashboard?payment=return`,
          cancel_url: `${appUrl()}/editor/${id}?payment=canceled`,
          expires_at: Math.floor(Date.parse(order.createdAt) / 1000) + 1800,
        },
        { idempotencyKey: `checkout-${order.id}` },
      );
  await transaction((tx) =>
    tx.run(
      "UPDATE orders SET stripe_session=? WHERE id=? AND (stripe_session IS NULL OR stripe_session=?)",
      [session.id, order.id, session.id],
    ),
  );
  if (!session.url)
    throw new AppError(
      "This session has expired. Wait for the order status to update.",
      409,
    );
  return session.url;
}
export interface PaymentFact {
  eventId: string;
  orderId?: string;
  sessionId?: string;
  paymentIntent?: string;
  state: "paid" | "failed" | "expired" | "refunded" | "pending";
  amount?: number;
  currency?: string;
}
export async function applyPayment(fact: PaymentFact) {
  return transaction(async (tx) => {
    // Insert first: PostgreSQL unique conflict waits for concurrent duplicate; no side effects twice.
    const inserted = await tx.all<{ id: string }>(
      "INSERT INTO webhook_events(id,created_at) VALUES(?,?) ON CONFLICT(id) DO NOTHING RETURNING id",
      [fact.eventId, new Date().toISOString()],
    );
    if (!inserted.length) return { duplicate: true };
    if (!fact.orderId && !fact.paymentIntent)
      throw new AppError("Missing payment reference.", 400);
    if (fact.orderId)
      await tx.run("UPDATE orders SET status=status WHERE id=?", [
        fact.orderId,
      ]);
    else
      await tx.run("UPDATE orders SET status=status WHERE payment_intent=?", [
        fact.paymentIntent,
      ]);
    const [order] = await tx.all<{
      id: string;
      status: string;
      stripe_session: string | null;
      amount: number;
      currency: string;
      project_id: string | null;
      plan: string;
      paid_at: string | null;
    }>(
      "SELECT * FROM orders WHERE " +
        (fact.orderId ? "id=?" : "payment_intent=?"),
      [fact.orderId || fact.paymentIntent],
    );
    if (!order) throw new AppError("Order not found.", 409);
    if (
      fact.sessionId &&
      order.stripe_session &&
      fact.sessionId !== order.stripe_session
    )
      throw new AppError("Session mismatch.", 400);
    if (
      fact.state === "paid" &&
      (fact.amount !== order.amount || fact.currency !== order.currency)
    )
      throw new AppError("Amount mismatch.", 400);
    const terminal = order.status === "refunded";
    const state = terminal
      ? "refunded"
      : fact.state === "refunded"
        ? "refunded"
        : order.status === "paid"
          ? "paid"
          : fact.state;
    await tx.run(
      "UPDATE orders SET status=?,payment_intent=COALESCE(?,payment_intent),stripe_session=COALESCE(stripe_session,?),paid_at=COALESCE(paid_at,?) WHERE id=?",
      [
        state,
        fact.paymentIntent || null,
        fact.sessionId || null,
        state === "paid" ? new Date().toISOString() : null,
        order.id,
      ],
    );
    if (state === "paid" && order.status !== "paid" && order.project_id) {
      const plan = JSON.parse(order.plan);
      await tx.run("UPDATE projects SET expires_at=? WHERE id=?", [
        new Date(Date.now() + plan.days * 86400000).toISOString(),
        order.project_id,
      ]);
      await tx.run(
        "INSERT INTO email_jobs(id,order_id,status,next_at) VALUES(?,?,?,?) ON CONFLICT(order_id) DO NOTHING",
        [crypto.randomUUID(), order.id, "pending", new Date().toISOString()],
      );
    }
    if (state === "refunded") {
      await tx.run(
        "UPDATE email_jobs SET status=? WHERE order_id=? AND status<>?",
        ["canceled", order.id, "sent"],
      );
      if (order.project_id) {
        await tx.run("UPDATE projects SET published=NULL WHERE id=?", [
          order.project_id,
        ]);
        await tx.run("DELETE FROM viewer_sessions WHERE project_id=?", [
          order.project_id,
        ]);
      }
    }
    return { duplicate: false, state };
  });
}
export async function handleStripeEvent(event: Stripe.Event) {
  const client = stripe();
  if (event.type.startsWith("checkout.session.")) {
    const s = event.data.object as Stripe.Checkout.Session;
    if (!s.metadata?.orderId) return;
    const current = await client.checkout.sessions.retrieve(s.id);
    const state =
      current.payment_status === "paid"
        ? "paid"
        : event.type === "checkout.session.async_payment_failed"
          ? "failed"
          : current.status === "expired"
            ? "expired"
            : "pending";
    return applyPayment({
      eventId: event.id,
      orderId: current.metadata?.orderId,
      sessionId: current.id,
      paymentIntent:
        typeof current.payment_intent === "string"
          ? current.payment_intent
          : undefined,
      state,
      amount: current.amount_total ?? undefined,
      currency: current.currency ?? undefined,
    });
  }
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const pi =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (pi) {
      const sessions = await client.checkout.sessions.list({
        payment_intent: pi,
        limit: 1,
      });
      return applyPayment({
        eventId: event.id,
        paymentIntent: pi,
        orderId: sessions.data[0]?.metadata?.orderId,
        state: "refunded",
      });
    }
  }
}
export { retryEmails } from "./mail";
