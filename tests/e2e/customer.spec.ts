import { test, expect, type APIRequestContext } from "@playwright/test";
import path from "node:path";
import { mkdirSync, readFileSync } from "node:fs";
const origin = "http://127.0.0.1:3000";
if (process.env.DATABASE_URL)
  throw new Error(
    "Browser fixtures must not use an external database. Unset DATABASE_URL.",
  );
test.beforeEach(async ({ request }) => {
  expect((await (await request.get("/api/auth/me")).json()).local).toBe(true);
});
const screenshots = path.join(
  process.env.USERPROFILE || process.cwd(),
  ".codex",
  "visualizations",
  "2026",
  "11",
  "06",
  "01a1b26a-2d6e-71e1-94b8-885c85aa95bc",
);
mkdirSync(screenshots, { recursive: true });
async function requestPost(
  request: APIRequestContext,
  url: string,
  data: unknown,
) {
  return request.post(url, { data, headers: { Origin: origin } });
}
test("HTTP access isolation, CSRF, private storage and admin role", async ({
  playwright,
}) => {
  const a = await playwright.request.newContext({ baseURL: origin }),
    b = await playwright.request.newContext({ baseURL: origin }),
    anonymous = await playwright.request.newContext({ baseURL: origin });
  for (const [i, r] of [a, b].entries())
    expect(
      (
        await requestPost(r, "/api/auth/register", {
          email: `isolation-${i}-${crypto.randomUUID()}@example.invalid`,
          password: "fictional-secret-123",
        })
      ).ok(),
    ).toBe(true);
  const created = await requestPost(a, "/api/projects", { type: "film" }),
    p = await created.json();
  expect(created.status()).toBe(201);
  expect((await b.get(`/api/projects/${p.id}`)).status()).toBe(404);
  expect(
    (
      await b.put(`/api/projects/${p.id}`, {
        headers: { Origin: origin },
        data: { draft: p.draft, revision: 1 },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await a.post("/api/projects", {
        headers: { Origin: "https://attacker.invalid" },
        data: { type: "film" },
      })
    ).status(),
  ).toBe(403);
  expect((await a.get("/api/admin")).status()).toBe(403);
  expect((await anonymous.get("/api/projects")).status()).toBe(401);
  expect((await anonymous.get(`/api/gift/${p.token}`)).status()).toBe(404);
  expect((await anonymous.get("/api/media")).status()).toBe(401);
  const good = readFileSync(path.join(process.cwd(), "public/demo-coast.webp"));
  const uploaded = await a.post(`/api/projects/${p.id}/media`, {
    headers: { Origin: origin },
    multipart: {
      rights: "true",
      file: { name: "fictional.webp", mimeType: "image/webp", buffer: good },
    },
  });
  expect(uploaded.status()).toBe(201);
  const media = await uploaded.json();
  expect((await a.get(`/api/media/${media.id}`)).status()).toBe(200);
  expect((await b.get(`/api/media/${media.id}`)).status()).toBe(404);
  expect(
    (await anonymous.get(`/api/media/${media.id}?preview=1`)).status(),
  ).toBe(404);
  const second = await (
    await requestPost(b, "/api/projects", { type: "film" })
  ).json();
  second.draft.sections[0].items[0].mediaId = media.id;
  expect(
    (
      await b.put(`/api/projects/${second.id}`, {
        headers: { Origin: origin },
        data: { draft: second.draft, revision: 1 },
      })
    ).status(),
  ).toBe(403);
  const corrupt = await a.post(`/api/projects/${p.id}/media`, {
    headers: { Origin: origin },
    multipart: {
      rights: "true",
      file: {
        name: "fake.png",
        mimeType: "image/png",
        buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0]),
      },
    },
  });
  expect(corrupt.status()).toBe(400);
  expect(
    (
      await a.delete(`/api/projects/${p.id}/media/${media.id}`, {
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(200);
  expect((await a.get(`/api/media/${media.id}`)).status()).toBe(404);
  expect(
    (
      await anonymous.post("/api/stripe/webhook", {
        data: "tampered",
        headers: { "stripe-signature": "invalid" },
      })
    ).status(),
  ).toBe(400);
  await a.dispose();
  await b.dispose();
  await anonymous.dispose();
});
test("administrator controls the storefront, sees operational data and audits changes", async ({
  page,
  context,
}) => {
  const email = `admin-fixture-${crypto.randomUUID()}@example.invalid`;
  expect(
    (
      await requestPost(context.request, "/api/auth/register", {
        email,
        password: "fictional-admin-password",
      })
    ).ok(),
  ).toBe(true);
  process.env.APP_MODE = "local";
  const { transaction } = await import("../../src/lib/db");
  await transaction((tx) =>
    tx.run("UPDATE users SET role=? WHERE email=?", ["admin", email]),
  );
  const data = await (await context.request.get("/api/admin")).json();
  expect(data.projects[0]).not.toHaveProperty("draft");
  const original = data.catalog;
  try {
    const edited = structuredClone(original);
    edited.headline = "A fictional admin headline.";
    edited.plans[0].price = 5900;
    expect(
      (
        await context.request.put("/api/admin/catalog", {
          headers: { Origin: origin },
          data: edited,
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "A fictional admin headline.",
    );
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Behind the moments." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "catalog", exact: true }).click();
    await expect(page.getByLabel("Main headline")).toHaveValue(
      "A fictional admin headline.",
    );
    await page
      .getByLabel("Introduction")
      .fill("A fictional admin description.");
    await page.getByRole("button", { name: "Save configuration" }).click();
    await expect(
      page.getByText("Configuration saved.", { exact: true }),
    ).toBeVisible();
    const after = await (await context.request.get("/api/admin")).json();
    expect(
      after.audit.some(
        (a: { action: string }) => a.action === "catalog.update",
      ),
    ).toBe(true);
  } finally {
    await context.request.put("/api/admin/catalog", {
      headers: { Origin: origin },
      data: original,
    });
  }
});
