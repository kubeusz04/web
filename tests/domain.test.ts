import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Stripe from "stripe";
process.env.APP_MODE = "local";
if (process.env.DATABASE_URL)
  throw new Error(
    "Domain tests require an isolated local database. Unset DATABASE_URL.",
  );
const temp = mkdtempSync(path.join(os.tmpdir(), "blisko-domain-"));
process.env.BLISKO_DATA_DIR = temp;
const { transaction, query } = await import("../src/lib/db");
const {
  createProject,
  saveProject,
  projectFor,
  publishProject,
  publicGift,
  sharing,
} = await import("../src/lib/service");
const { applyPayment, handleStripeEvent, sessionFact, stripe, checkout } = await import("../src/lib/payments");
const { giftSchema, demoGift } = await import("../src/lib/schema");
const { initialCatalog } = await import("../src/lib/config");
const { passwordHash, passwordMatches, hash, rateLimit } =
  await import("../src/lib/security");
const a = {
    id: crypto.randomUUID(),
    email: "fictional-a@example.invalid",
    role: "customer",
    blocked: 0,
  },
  b = {
    id: crypto.randomUUID(),
    email: "fictional-b@example.invalid",
    role: "customer",
    blocked: 0,
  };
await transaction(async (tx) => {
  for (const u of [a, b])
    await tx.run("INSERT INTO users(id,email,created_at) VALUES(?,?,?)", [
      u.id,
      u.email,
      new Date().toISOString(),
    ]);
});
let projectId = "",
  orderId = "",
  link = "";
test("schema rejects executable markup as structure, unsupported version and invalid duration", () => {
  assert.throws(() => giftSchema.parse({ ...demoGift(), schemaVersion: 2 }));
  const d = demoGift();
  d.sections[0].items[0].duration = 0;
  assert.throws(() => giftSchema.parse(d));
  assert.throws(() =>
    giftSchema.parse({ ...demoGift(), theme: "javascript:alert(1)" }),
  );
});
test("passwords are salted and verified in constant time", () => {
  const h = passwordHash("fictional-password");
  assert.ok(passwordMatches("fictional-password", h));
  assert.ok(!passwordMatches("wrong", h));
  assert.notEqual(passwordHash("fictional-password"), h);
  assert.notEqual(hash("token"), "token");
});
test("owner can create and persist a draft; another account cannot read or modify it", async () => {
  const p = await createProject(a, "film");
  projectId = p.id;
  link = p.token;
  const draft = p.draft;
  draft.title = "A fictional persisted story";
  const r = await saveProject(a, p.id, draft, 1);
  assert.equal(r.revision, 2);
  assert.equal((await projectFor(a, p.id)).draft.title, draft.title);
  await assert.rejects(() => projectFor(b, p.id), /not found/);
  await assert.rejects(() => saveProject(b, p.id, draft, 2), /not found/);
});
test("stale revisions cannot overwrite a newer draft", async () => {
  const p = await projectFor(a, projectId);
  await assert.rejects(
    () => saveProject(a, projectId, p.draft, 1),
    /another tab/,
  );
});
test("unpaid drafts cannot publish; unlisted token alone does not expose draft", async () => {
  await assert.rejects(() => publishProject(a, projectId), /confirmed payment/);
  await assert.rejects(() => publicGift(link), /unavailable/);
});
test("foreign media cannot be assigned to a project", async () => {
  const p = await projectFor(a, projectId);
  p.draft.sections[0].items[0].mediaId = crypto.randomUUID();
  await assert.rejects(
    () => saveProject(a, projectId, p.draft, p.revision),
    /does not belong/,
  );
});
test("wrong payment amount rolls back event and entitlement atomically", async () => {
  orderId = crypto.randomUUID();
  await transaction((tx) =>
    tx.run(
      "INSERT INTO orders(id,project_id,owner_id,email,plan,amount,currency,status,stripe_session,consent,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      [
        orderId,
        projectId,
        a.id,
        a.email,
        JSON.stringify(initialCatalog.plans[0]),
        4900,
        "pln",
        "pending",
        "cs_test_fixture",
        "{}",
        new Date().toISOString(),
      ],
    ),
  );
  await assert.rejects(
    () =>
      applyPayment({
        eventId: "evt_wrong",
        orderId,
        state: "paid",
        amount: 1,
        currency: "pln",
        sessionId: "cs_test_fixture",
      }),
    /Amount mismatch/,
  );
  assert.equal(
    (await query("SELECT id FROM webhook_events WHERE id=?", ["evt_wrong"]))
      .length,
    0,
  );
  assert.equal((await projectFor(a, projectId)).paid, false);
});
test("confirmed payment unlocks only its project and duplicate/concurrent events are idempotent", async () => {
  const fact = {
    eventId: "evt_paid",
    orderId,
    state: "paid" as const,
    amount: 4900,
    currency: "pln",
    sessionId: "cs_test_fixture",
    paymentIntent: "pi_test_fixture",
  };
  const results = await Promise.all([applyPayment(fact), applyPayment(fact)]);
  assert.equal(results.filter((r) => r.duplicate).length, 1);
  assert.equal((await projectFor(a, projectId)).paid, true);
  assert.equal(
    (await query("SELECT id FROM orders WHERE project_id=?", [projectId]))
      .length,
    1,
  );
  assert.equal(
    (await query("SELECT id FROM email_jobs WHERE order_id=?", [orderId]))
      .length,
    1,
  );
  const other = await createProject(a, "archive");
  assert.equal((await projectFor(a, other.id)).paid, false);
});
test("late pending and failed events cannot downgrade a paid order", async () => {
  await applyPayment({ eventId: "evt_late_failed", orderId, state: "failed" });
  await applyPayment({
    eventId: "evt_late_pending",
    orderId,
    state: "pending",
  });
  assert.equal(
    (
      await query<{ status: string }>("SELECT status FROM orders WHERE id=?", [
        orderId,
      ])
    )[0].status,
    "paid",
  );
});
test("publication makes an atomic snapshot; drafts stay private; republish keeps link", async () => {
  const first = await publishProject(a, projectId);
  const p = await projectFor(a, projectId);
  p.draft.title = "An unpublished change";
  await saveProject(a, projectId, p.draft, p.revision);
  assert.equal(
    (await publicGift(first.token)).gift.title,
    "A fictional persisted story",
  );
  const second = await publishProject(a, projectId);
  assert.equal(second.token, first.token);
  assert.equal(
    (await publicGift(second.token)).gift.title,
    "An unpublished change",
  );
});
test("server package limits prevent publication and preserve previous snapshot", async () => {
  const p = await projectFor(a, projectId);
  p.draft.sections[0].items = Array.from({ length: 21 }, () => ({
    ...p.draft.sections[0].items[0],
    id: crypto.randomUUID(),
  }));
  await saveProject(a, projectId, p.draft, p.revision);
  await assert.rejects(() => publishProject(a, projectId), /package limits/);
  assert.equal((await publicGift(link)).gift.sections[0].items.length, 3);
});
test("optional password and rotated links protect access", async () => {
  await sharing(a, projectId, { password: "fictional-gift-pass" });
  await assert.rejects(() => publicGift(link), /correct gift password/);
  assert.ok((await publicGift(link, "fictional-gift-pass")).gift);
  await sharing(a, projectId, { rotate: true });
  await assert.rejects(
    () => publicGift(link, "fictional-gift-pass"),
    /unavailable/,
  );
  const p = await projectFor(a, projectId);
  link = p.token;
  assert.notEqual(link, "");
  assert.ok(p.hasPassword);
  assert.ok(!("password_hash" in p));
});
test("refund wins over delayed paid events, revokes recipient access, creates no second email", async () => {
  await applyPayment({
    eventId: "evt_refund",
    paymentIntent: "pi_test_fixture",
    state: "refunded",
  });
  await applyPayment({
    eventId: "evt_paid_late",
    orderId,
    state: "paid",
    amount: 4900,
    currency: "pln",
  });
  assert.equal((await projectFor(a, projectId)).paid, false);
  await assert.rejects(
    () => publicGift(link, "fictional-gift-pass"),
    /unavailable/,
  );
  assert.equal(
    (await query("SELECT id FROM email_jobs WHERE order_id=?", [orderId]))
      .length,
    1,
  );
});
test("refund arriving before payment remains terminal", async () => {
  const p = await createProject(a, "film"),
    id = crypto.randomUUID();
  await transaction((tx) =>
    tx.run(
      "INSERT INTO orders(id,project_id,owner_id,email,plan,amount,currency,status,consent,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        p.id,
        a.id,
        a.email,
        JSON.stringify(initialCatalog.plans[0]),
        4900,
        "pln",
        "pending",
        "{}",
        new Date().toISOString(),
      ],
    ),
  );
  await applyPayment({
    eventId: "evt_refund_first",
    orderId: id,
    state: "refunded",
  });
  await applyPayment({
    eventId: "evt_paid_after_refund",
    orderId: id,
    state: "paid",
    amount: 4900,
    currency: "pln",
  });
  assert.equal((await projectFor(a, p.id)).paid, false);
});
test("Stripe raw-body signature rejects tampering", () => {
  const client = new Stripe("sk_test_not_real"),
    secret = "whsec_test_fixture_only",
    payload = JSON.stringify({
      id: "evt_signature",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test" } },
    });
  const signature = client.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  assert.equal(
    client.webhooks.constructEvent(payload, signature, secret).id,
    "evt_signature",
  );
  assert.throws(() =>
    client.webhooks.constructEvent(payload + " ", signature, secret),
  );
});
test("rate limit is enforced in the database", async () => {
  await rateLimit("fictional-limit", 2, 60);
  await rateLimit("fictional-limit", 2, 60);
  await assert.rejects(
    () => rateLimit("fictional-limit", 2, 60),
    /Too many attempts/,
  );
});
test("catalog changes do not rewrite historical order pricing or limits", async () => {
  const old = (
    await query<{ plan: string; amount: number }>(
      "SELECT plan,amount FROM orders WHERE id=?",
      [orderId],
    )
  )[0];
  const updated = structuredClone(initialCatalog);
  updated.plans[0].price = 9900;
  updated.plans[0].maxItems = 100;
  await transaction((tx) =>
    tx.run(
      "INSERT INTO catalog(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
      ["main", JSON.stringify(updated)],
    ),
  );
  const current = (
    await query<{ plan: string; amount: number }>(
      "SELECT plan,amount FROM orders WHERE id=?",
      [orderId],
    )
  )[0];
  assert.deepEqual(current, old);
  assert.equal(JSON.parse(current.plan).maxItems, 20);
});
test("email failure preserves entitlements; retries reuse durable payload and stop after success", async () => {
  const { retryEmails } = await import("../src/lib/mail");
  const p = await createProject(a, "film"),
    id = crypto.randomUUID();
  await transaction((tx) =>
    tx.run(
      "INSERT INTO orders(id,project_id,owner_id,email,plan,amount,currency,status,consent,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        p.id,
        a.id,
        a.email,
        JSON.stringify(initialCatalog.plans[0]),
        4900,
        "pln",
        "pending",
        JSON.stringify({
          terms: true,
          immediate: true,
          acknowledge: true,
          version: "test-terms",
          at: new Date().toISOString(),
          termsText: "The exact accepted test terms.",
        }),
        new Date().toISOString(),
      ],
    ),
  );
  await applyPayment({
    eventId: "evt_email_fixture",
    orderId: id,
    state: "paid",
    amount: 4900,
    currency: "pln",
  });
  const original = globalThis.fetch;
  process.env.RESEND_API_KEY = "fictional-test-only";
  process.env.MAIL_FROM = "test@example.invalid";
  const bodies: string[] = [];
  const keys: string[] = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(String(options?.body));
    keys.push((options?.headers as Record<string, string>)["Idempotency-Key"]);
    return new Response("{}", { status: bodies.length === 1 ? 503 : 200 });
  };
  try {
    await retryEmails();
    assert.equal((await projectFor(a, p.id)).paid, true);
    assert.equal(
      (
        await query<{ status: string }>(
          "SELECT status FROM email_jobs WHERE order_id=?",
          [id],
        )
      )[0].status,
      "failed",
    );
    await transaction((tx) =>
      tx.run("UPDATE email_jobs SET next_at=? WHERE order_id=?", [
        "2000-01-01T00:00:00.000Z",
        id,
      ]),
    );
    assert.equal((await retryEmails()).sent, 1);
    assert.equal((await retryEmails()).sent, 0);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0], bodies[1]);
    assert.equal(keys[0], keys[1]);
    assert.ok(bodies[0].includes("The exact accepted test terms."));
  } finally {
    globalThis.fetch = original;
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
  }
});
test("unavailable media reservations cannot be assigned to a gift", async () => {
  const p = await createProject(a, "film"),
    m = crypto.randomUUID();
  await transaction((tx) =>
    tx.run(
      "INSERT INTO media(id,owner_id,project_id,storage_key,mime,bytes,created_at,state) VALUES(?,?,?,?,?,?,?,?)",
      [
        m,
        a.id,
        p.id,
        "fictional-reservation",
        "image/webp",
        20,
        new Date().toISOString(),
        "deleting",
      ],
    ),
  );
  p.draft.sections[0].items[0].mediaId = m;
  await assert.rejects(
    () => saveProject(a, p.id, p.draft, 1),
    /does not belong/,
  );
});
test("blocked gifts can still be deleted by their owner, not another account", async () => {
  const { deleteProject } = await import("../src/lib/media");
  const p = await createProject(a, "film");
  await transaction((tx) =>
    tx.run("UPDATE projects SET blocked=1 WHERE id=?", [p.id]),
  );
  await assert.rejects(() => deleteProject(b, p.id), /not found/);
  await deleteProject(a, p.id);
  assert.equal(
    (await query("SELECT id FROM projects WHERE id=?", [p.id])).length,
    0,
  );
});
test("maintenance deletes expired gifts and stale unpaid drafts, preserving recent work", async () => {
  const { maintenance } = await import("../src/lib/maintenance");
  const expired = await createProject(a, "film"),
    stale = await createProject(a, "archive"),
    recent = await createProject(a, "surprise");
  await transaction(async (tx) => {
    await tx.run("UPDATE projects SET expires_at=? WHERE id=?", [
      new Date(Date.now() - 61 * 86400000).toISOString(),
      expired.id,
    ]);
    await tx.run("UPDATE projects SET updated_at=? WHERE id=?", [
      new Date(Date.now() - 100 * 86400000).toISOString(),
      stale.id,
    ]);
  });
  const result = await maintenance();
  assert.equal(result.deleted, 2);
  assert.equal(
    (
      await query("SELECT id FROM projects WHERE id IN (?,?)", [
        expired.id,
        stale.id,
      ])
    ).length,
    0,
  );
  assert.equal((await projectFor(a, recent.id)).id, recent.id);
});
test('duplicate section and item identifiers are rejected',()=>{
 const gift=demoGift();gift.sections[0].items[1].id=gift.sections[0].items[0].id;assert.throws(()=>giftSchema.parse(gift),/identifiers must be unique/);
 const sections=demoGift();sections.sections.push(structuredClone(sections.sections[0]));assert.throws(()=>giftSchema.parse(sections),/identifiers must be unique/);
});
test('stored media type is authoritative on save',async()=>{
 const p=await createProject(b,'film'),id=crypto.randomUUID();await transaction(tx=>tx.run('INSERT INTO media(id,owner_id,project_id,storage_key,mime,bytes,created_at,state) VALUES(?,?,?,?,?,?,?,?)',[id,b.id,p.id,'fictional-kind-check','image/webp',20,new Date().toISOString(),'ready']));
 p.draft.sections[0].items[0].mediaId=id;p.draft.sections[0].items[0].mediaKind='video';await assert.rejects(()=>saveProject(b,p.id,p.draft,1),/does not match/);
 p.draft.sections[0].items[0].mediaKind='image';assert.equal((await saveProject(b,p.id,p.draft,1)).revision,2);
});
test('original presentation settings and arbitrary letter counts survive schema validation and saving',async()=>{
 const p=await createProject(b,'archive');const draft=p.draft;draft.from='Morgan';draft.to='Riley';draft.signature='Always together';draft.fromLocation='North';draft.toLocation='South';draft.finaleWords=['Our year','Morgan & Riley','A promise','Tomorrow'];draft.sections[0].gateTitle='Before you look';draft.sections[0].items=Array.from({length:17},(_,i)=>({...demoGift('archive').sections[0].items[1],id:crypto.randomUUID(),title:`Letter ${i+1}`,author:i%2?'Riley':'Morgan',category:'Letter'}));await saveProject(b,p.id,draft,1);const saved=(await projectFor(b,p.id)).draft;assert.equal(saved.sections[0].items.length,17);assert.equal(saved.signature,'Always together');assert.equal(saved.sections[0].items[16].title,'Letter 17');assert.deepEqual(saved.finaleWords,draft.finaleWords);
});
test('extra gallery and portrait media are owner-checked, with enforced file roles',async()=>{
 const p=await createProject(b,'film'),foreign=crypto.randomUUID();p.draft.sections[0].items[0].extraMediaIds=[foreign];await assert.rejects(()=>saveProject(b,p.id,p.draft,1),/does not belong/);p.draft.sections[0].items[0].extraMediaIds=[];p.draft.fromPortraitId=foreign;await assert.rejects(()=>saveProject(b,p.id,p.draft,1),/does not belong/);const id=crypto.randomUUID();await transaction(tx=>tx.run('INSERT INTO media(id,owner_id,project_id,storage_key,mime,bytes,created_at,state) VALUES(?,?,?,?,?,?,?,?)',[id,b.id,p.id,'fictional-portrait','image/webp',20,new Date().toISOString(),'ready']));p.draft.fromPortraitId=id;p.draft.musicId=id;await assert.rejects(()=>saveProject(b,p.id,p.draft,1),/audio file for music/);p.draft.musicId=null;await saveProject(b,p.id,p.draft,1);
});
test("expired pending checkout is reconciled before selecting a different package", async () => {
  const p = await createProject(a, "film"),
    id = crypto.randomUUID();
  await transaction((tx) =>
    tx.run(
      "INSERT INTO orders(id,project_id,owner_id,email,plan,amount,currency,status,stripe_session,consent,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        p.id,
        a.id,
        a.email,
        JSON.stringify(initialCatalog.plans[0]),
        4900,
        "pln",
        "pending",
        `cs-${id}`,
        "{}",
        new Date().toISOString(),
      ],
    ),
  );
  let status = "complete",
    creates = 0;
  const client = {
    checkout: {
      sessions: {
        retrieve: async () => ({
          id: `cs-${id}`,
          metadata: { orderId: id },
          status,
          payment_status: "unpaid",
        }),
        create: async (params: Stripe.Checkout.SessionCreateParams) => {
          creates++;
          assert.equal(params.mode, "payment");
          assert.equal("payment_method_types" in params, false);
          return {
            id: `cs-new-${id}`,
            status: "open",
            url: "https://checkout.stripe.com/fixture",
          };
        },
      },
    },
  } as unknown as Stripe;
  const consent = { terms: true, immediate: true, acknowledge: true };
  await assert.rejects(
    () => checkout(a, p.id, initialCatalog.plans[1].id, consent, client),
    /processing/,
  );
  assert.equal(creates, 0);
  status = "expired";
  assert.equal(
    await checkout(a, p.id, initialCatalog.plans[1].id, consent, client),
    "https://checkout.stripe.com/fixture",
  );
  assert.equal(
    (
      await query<{ status: string }>("SELECT status FROM orders WHERE id=?", [
        id,
      ])
    )[0].status,
    "expired",
  );
  assert.equal(creates, 1);
});

test("Stripe test restricted keys work and live keys are rejected", () => {
  const saved = process.env.STRIPE_SECRET_KEY;
  try {
    process.env.STRIPE_SECRET_KEY = "rk_test_fixture_only";
    assert.ok(stripe());
    process.env.STRIPE_SECRET_KEY = "rk_live_fixture_only";
    assert.throws(() => stripe(), /Test payments need/);
  } finally {
    if (saved === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = saved;
  }
});

test("completed asynchronous sessions stay pending until payment succeeds", () => {
  const session = {
    id: "cs_async",
    metadata: { orderId: "order_async" },
    status: "complete",
    payment_status: "unpaid",
    amount_total: 4900,
    currency: "pln",
  } as unknown as Stripe.Checkout.Session;
  assert.equal(sessionFact(session, "evt_async").state, "pending");
  assert.equal(sessionFact(session, "evt_failed", true).state, "failed");
  session.payment_status = "paid";
  assert.equal(sessionFact(session, "evt_paid", true).state, "paid");
  session.payment_status = "unpaid";
  session.status = "expired";
  assert.equal(sessionFact(session, "evt_expired").state, "expired");
});

test("partial refunds preserve access; disputes revoke it and won disputes never extend hosting", async () => {
  const p = await createProject(a, "film"),
    id = crypto.randomUUID();
  await transaction((tx) =>
    tx.run(
      "INSERT INTO orders(id,project_id,owner_id,email,plan,amount,currency,status,consent,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        p.id,
        a.id,
        a.email,
        JSON.stringify(initialCatalog.plans[0]),
        4900,
        "pln",
        "pending",
        "{}",
        new Date().toISOString(),
      ],
    ),
  );
  await applyPayment({
    eventId: `paid-${id}`,
    orderId: id,
    state: "paid",
    amount: 4900,
    currency: "pln",
    paymentIntent: `pi-${id}`,
  });
  await publishProject(a, p.id);
  const expires = (await projectFor(a, p.id)).expires_at;
  let refunded = false,
    disputeStatus = "needs_response";
  const client = {
    charges: {
      retrieve: async () => ({
        id: "ch_fixture",
        refunded,
        payment_intent: `pi-${id}`,
      }),
    },
    disputes: {
      retrieve: async () => ({ charge: "ch_fixture", status: disputeStatus }),
    },
    checkout: {
      sessions: {
        list: async () => ({
          data: [
            { metadata: { orderId: id }, amount_total: 4900, currency: "pln" },
          ],
        }),
      },
    },
  } as unknown as Stripe;
  const event = (eventId: string, type: string) =>
    ({
      id: eventId,
      type,
      livemode: false,
      data: { object: { id: "fixture" } },
    }) as unknown as Stripe.Event;
  await handleStripeEvent(event(`partial-${id}`, "charge.refunded"), client);
  assert.ok((await publicGift(p.token)).gift);
  await handleStripeEvent(
    event(`dispute-${id}`, "charge.dispute.created"),
    client,
  );
  await assert.rejects(() => publicGift(p.token), /unavailable/);
  await applyPayment({
    eventId: `late-paid-${id}`,
    orderId: id,
    state: "paid",
    amount: 4900,
    currency: "pln",
  });
  assert.equal((await projectFor(a, p.id)).paid, false);
  disputeStatus = "won";
  await handleStripeEvent(event(`won-${id}`, "charge.dispute.closed"), client);
  assert.equal((await projectFor(a, p.id)).paid, true);
  assert.equal((await projectFor(a, p.id)).expires_at, expires);
  // Publication requires an owner action again after a dispute.
  await assert.rejects(() => publicGift(p.token), /unavailable/);
  refunded = true;
  await handleStripeEvent(event(`full-${id}`, "charge.refunded"), client);
  await handleStripeEvent(
    event(`late-won-${id}`, "charge.dispute.closed"),
    client,
  );
  assert.equal((await projectFor(a, p.id)).paid, false);
  await assert.rejects(
    () =>
      handleStripeEvent(
        { ...event("live", "charge.refunded"), livemode: true },
        client,
      ),
    /Live payment/,
  );
});

after(() => {
  const state = (
    globalThis as unknown as { bliskoDb: { sqlite: { close: () => void } } }
  ).bliskoDb;
  state.sqlite.close();
  rmSync(temp, { recursive: true, force: true });
});
