import { cookies } from "next/headers.js";
import { z, ZodError } from "zod";
import {
  AppError,
  currentUser,
  requireUser,
  requireAdmin,
  checkOrigin,
  rateLimit,
  hash,
  token,
  passwordHash,
  passwordMatches,
  issueSession,
  type User,
} from "@/lib/security";
import { query, transaction } from "@/lib/db";
import { supabase } from "@/lib/providers";
import { localMode } from "@/lib/config";
import {
  createProject,
  projectsFor,
  projectFor,
  saveProject,
  publishProject,
  sharing,
  publicGift,
  catalog,
  catalogSchema,
  owned,
} from "@/lib/service";
import {
  checkout,
  handleStripeEvent,
  stripe,
  retryEmails,
} from "@/lib/payments";
import {
  upload,
  readMedia,
  deleteProject,
  removeStored,
  type Media,
} from "@/lib/media";
import { mediaIds } from "@/lib/schema";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
async function body(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 500000)
    throw new AppError("Request too large.", 413);
  const raw = await req.text();
  if (raw.length > 500000) throw new AppError("Request too large.", 413);
  return JSON.parse(raw);
}
async function route(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: p } = await ctx.params,
      method = req.method;
    if (p.join("/") === "stripe/webhook" && method === "POST") {
      if (Number(req.headers.get("content-length") || 0) > 1048576)
        throw new AppError("Request too large.", 413);
      const signature = req.headers.get("stripe-signature");
      if (!signature || !process.env.STRIPE_WEBHOOK_SECRET)
        throw new AppError("Invalid webhook.", 400);
      let event;
      try {
        event = stripe().webhooks.constructEvent(
          await req.text(),
          signature,
          process.env.STRIPE_WEBHOOK_SECRET,
        );
      } catch {
        throw new AppError("Invalid webhook signature.", 400);
      }
      await handleStripeEvent(event);
      return json({ received: true });
    }
    checkOrigin(req);
    if (p[0] === "catalog" && method === "GET")
      return json({
        catalog: await catalog(),
        local: localMode(),
        paymentsConfigured:
          !!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"),
      });
    if (p[0] === "auth") {
      if (p[1] === "me" && method === "GET")
        return json({ user: await currentUser(), local: localMode() });
      if (p[1] === "logout" && method === "POST") {
        const jar = await cookies(),
          value = jar.get("blisko_session")?.value;
        if (value)
          await transaction((tx) =>
            tx.run("DELETE FROM sessions WHERE token_hash=?", [hash(value)]),
          );
        jar.delete("blisko_session");
        return json({ ok: true });
      }
      if (["login", "register"].includes(p[1]) && method === "POST") {
        const { email, password } = z
          .object({
            email: z
              .email()
              .max(254)
              .transform((v) => v.toLowerCase().trim()),
            password: z.string().min(10).max(128),
          })
          .parse(await body(req));
        await rateLimit(`auth:${email}`, 10, 600);
        await rateLimit("auth:global", 200, 600);
        let userId: string;
        if (localMode()) {
          if (p[1] === "register") {
            const exists = await query("SELECT id FROM users WHERE email=?", [
              email,
            ]);
            if (exists.length)
              throw new AppError("Account creation failed. Try signing in.");
            userId = crypto.randomUUID();
            await transaction((tx) =>
              tx.run(
                "INSERT INTO users(id,email,password_hash,role,created_at) VALUES(?,?,?,?,?)",
                [
                  userId,
                  email,
                  passwordHash(password),
                  process.env.ADMIN_EMAIL === email ? "admin" : "customer",
                  new Date().toISOString(),
                ],
              ),
            );
          } else {
            const [u] = await query<User>("SELECT * FROM users WHERE email=?", [
              email,
            ]);
            if (
              !u?.password_hash ||
              !passwordMatches(password, u.password_hash) ||
              u.blocked
            )
              throw new AppError("Invalid email or password.", 401);
            userId = u.id;
          }
        } else {
          const client = supabase();
          const { data, error } =
            p[1] === "register"
              ? await client.auth.signUp({ email, password })
              : await client.auth.signInWithPassword({ email, password });
          if (error) throw new AppError("Sign-in or registration failed.", 401);
          if (!data.session) return json({ confirmation: true });
          userId = data.user!.id;
          await transaction((tx) =>
            tx.run(
              "INSERT INTO users(id,email,role,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING",
              [
                userId,
                email,
                process.env.ADMIN_EMAIL === email ? "admin" : "customer",
                new Date().toISOString(),
              ],
            ),
          );
          const [u] = await query<User>("SELECT * FROM users WHERE id=?", [
            userId,
          ]);
          if (u.blocked) throw new AppError("This account is blocked.", 403);
        }
        await issueSession(userId);
        return json({ ok: true });
      }
    }
    if (p[0] === "gift" && ["GET", "POST"].includes(method)) {
      await rateLimit(`gift:${hash(p[1])}`, 100, 60);
      if (method === "POST")
        await rateLimit(`gift-password:${hash(p[1])}`, 10, 600);
      const input = method === "POST" ? await body(req) : {};
      if (input.password !== undefined)
        input.password = z.string().max(128).parse(input.password);
      const gift = await publicGift(p[1], input.password);
      const view = token();
      await transaction(async (tx) => {
        await tx.run("DELETE FROM viewer_sessions WHERE expires_at<?", [
          new Date().toISOString(),
        ]);
        await tx.run(
          "INSERT INTO viewer_sessions(token_hash,project_id,link_token_hash,expires_at) VALUES(?,?,?,?)",
          [
            hash(view),
            gift.id,
            hash(gift.token),
            new Date(Date.now() + 3600000).toISOString(),
          ],
        );
      });
      (await cookies()).set("blisko_view", view, {
        httpOnly: true,
        sameSite: "lax",
        secure: !localMode(),
        path: "/",
        maxAge: 3600,
      });
      return json({ gift: gift.gift });
    }
    if (p[0] === "media" && p[1] && method === "GET") {
      const result = await readMedia(
        p[1],
        await currentUser(),
        new URL(req.url).searchParams.get("preview") === "1",
      );
      const range = req.headers.get("range");
      const headers: Record<string, string> = {
        "Content-Type": result.mime,
        "Cache-Control": "private, no-store",
        "Accept-Ranges": "bytes",
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      };
      if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range);
        if (!match) return new Response(null, { status: 416 });
        const start = Number(match[1]),
          end = Math.min(
            Number(match[2] || result.bytes.length - 1),
            result.bytes.length - 1,
          );
        if (start > end || start >= result.bytes.length)
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${result.bytes.length}` },
          });
        return new Response(
          new Uint8Array(result.bytes.subarray(start, end + 1)),
          {
            status: 206,
            headers: {
              ...headers,
              "Content-Range": `bytes ${start}-${end}/${result.bytes.length}`,
              "Content-Length": String(end - start + 1),
            },
          },
        );
      }
      return new Response(new Uint8Array(result.bytes), { headers });
    }
    const user = await requireUser();
    await rateLimit(`user:${user.id}`, 200, 60);
    if (p[0] === "projects") {
      if (p.length === 1) {
        if (method === "GET")
          return json({ projects: await projectsFor(user) });
        if (method === "POST") {
          const { type } = z
            .object({ type: z.enum(["film", "archive", "cosmos", "surprise"]) })
            .parse(await body(req));
          return json(await createProject(user, type), 201);
        }
      }
      const id = z.uuid().parse(p[1]);
      if (p.length === 2) {
        if (method === "GET")
          return json({ project: await projectFor(user, id) });
        if (method === "PUT") {
          const data = await body(req);
          return json(
            await saveProject(
              user,
              id,
              data.draft,
              z.number().int().positive().parse(data.revision),
            ),
          );
        }
        if (method === "DELETE") {
          await deleteProject(user, id);
          return json({ ok: true });
        }
      }
      if (p[2] === "publish" && method === "POST")
        return json(await publishProject(user, id));
      if (p[2] === "sharing" && method === "POST") {
        await sharing(
          user,
          id,
          z
            .object({
              password: z.string().max(128).optional(),
              rotate: z.boolean().optional(),
              revoke: z.boolean().optional(),
            })
            .parse(await body(req)),
        );
        return json({ project: await projectFor(user, id) });
      }
      if (p[2] === "duplicate" && method === "POST") {
        const source = await projectFor(user, id),
          copy = await createProject(user, source.draft.sections[0].type);
        const draft = structuredClone(source.draft);
        draft.title += " — copy"; // Media stay private to original; duplicate text/settings only, explicitly shown in UI.
        draft.musicId=null;draft.fromPortraitId=null;draft.toPortraitId=null;
        draft.sections.forEach((s) =>
          s.items.forEach((i) => {
            i.mediaId = null;
            i.extraMediaIds=[];
          }),
        );
        await saveProject(user, copy.id, draft, 1);
        return json(copy, 201);
      }
      if (p[2] === "checkout" && method === "POST") {
        const b = await body(req);
        return json({
          url: await checkout(
            user,
            id,
            z.string().parse(b.plan),
            z
              .object({
                terms: z.boolean(),
                immediate: z.boolean(),
                acknowledge: z.boolean(),
              })
              .parse(b.consent),
          ),
        });
      }
      if (p[2] === "media" && method === "POST") {
        await rateLimit(`upload:${user.id}`, 15, 60);
        const length = Number(req.headers.get("content-length"));
        if (!length || length > 26 * 1024 * 1024)
          throw new AppError("Maximum file size is 25 MB.", 413);
        const form = await req.formData(),
          file = form.get("file");
        if (!(file instanceof File) || form.get("rights") !== "true")
          throw new AppError("Confirm your right to use this file.");
        return json(await upload(user, id, file), 201);
      }
      if (p[2] === "media" && method === "GET") {
        await projectFor(user, id);
        return json({
          media: await query(
            "SELECT id,mime,bytes,state FROM media WHERE project_id=? AND state<>'uploading'",
            [id],
          ),
        });
      }
      if (p[2] === "media" && p[3] && method === "DELETE") {
        const file = await transaction(async (tx) => {
          const project = await owned(tx, user, id, true);
          if (
            mediaIds(project.draft).includes(p[3]) ||
            (project.published && mediaIds(project.published).includes(p[3]))
          )
            throw new AppError(
              "Detach this file from both the draft and published gift first.",
            );
          const [m] = await tx.all<Media>(
            "SELECT * FROM media WHERE id=? AND project_id=? AND owner_id=?",
            [p[3], id, user.id],
          );
          if (!m) throw new AppError("File not found.", 404);
          if (m.state === "uploading")
            throw new AppError("This file is still uploading.", 409);
          await tx.run("UPDATE media SET state='deleting' WHERE id=?", [m.id]);
          return m;
        });
        await removeStored(file);
        await transaction((tx) =>
          tx.run("DELETE FROM media WHERE id=?", [file.id]),
        );
        return json({ ok: true });
      }
    }
    if (p[0] === "orders" && method === "GET")
      return json({
        orders: await query(
          "SELECT id,project_id,amount,currency,status,plan,created_at,paid_at FROM orders WHERE owner_id=? ORDER BY created_at DESC",
          [user.id],
        ),
      });
    if (p[0] === "account" && method === "DELETE") {
      for (const project of await projectsFor(user))
        await deleteProject(user, project.id);
      if (!localMode()) {
        const { error } = await supabase(true).auth.admin.deleteUser(user.id);
        if (error)
          throw new AppError(
            "Account deletion failed at the identity provider.",
            503,
          );
      }
      await transaction(async (tx) => {
        await tx.run(
          "UPDATE email_jobs SET status='canceled',payload=NULL WHERE order_id IN (SELECT id FROM orders WHERE owner_id=?)",
          [user.id],
        );
        await tx.run("UPDATE orders SET email=? WHERE owner_id=?", [
          "[account deleted]",
          user.id,
        ]);
        await tx.run("DELETE FROM users WHERE id=?", [user.id]);
      });
      (await cookies()).delete("blisko_session");
      return json({ ok: true });
    }
    if (p[0] === "admin") {
      requireAdmin(user);
      if (method === "GET")
        return json({
          catalog: await catalog(),
          orders: await query(
            "SELECT id,project_id,amount,status,created_at FROM orders ORDER BY created_at DESC LIMIT 100",
          ),
          jobs: await query(
            "SELECT id,order_id,status,attempts,last_error FROM email_jobs ORDER BY next_at DESC LIMIT 100",
          ),
          projects: await query(
            "SELECT id,owner_id,blocked,published_revision,updated_at FROM projects ORDER BY updated_at DESC LIMIT 100",
          ),
          audit: await query(
            "SELECT * FROM audit ORDER BY created_at DESC LIMIT 100",
          ),
        });
      if (p[1] === "catalog" && method === "PUT") {
        const value = catalogSchema.parse(await body(req));
        if (
          new Set(value.templates.map((t) => t.id)).size !== 4 ||
          new Set(value.plans.map((t) => t.id)).size !== value.plans.length
        )
          throw new AppError("Identifiers must be unique.");
        await transaction(async (tx) => {
          await tx.run(
            "INSERT INTO catalog(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
            ["main", JSON.stringify(value)],
          );
          await tx.run(
            "INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
            [
              crypto.randomUUID(),
              user.id,
              "catalog.update",
              "main",
              new Date().toISOString(),
            ],
          );
        });
        return json({ ok: true });
      }
      if (p[1] === "retry-mail" && method === "POST")
        return json(await retryEmails());
      if (p[1] === "block" && method === "POST") {
        const { id, blocked } = z
          .object({ id: z.uuid(), blocked: z.boolean() })
          .parse(await body(req));
        await transaction(async (tx) => {
          await tx.run("UPDATE projects SET blocked=? WHERE id=?", [
            blocked ? 1 : 0,
            id,
          ]);
          await tx.run("DELETE FROM viewer_sessions WHERE project_id=?", [id]);
          await tx.run(
            "INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
            [
              crypto.randomUUID(),
              user.id,
              blocked ? "project.block" : "project.unblock",
              id,
              new Date().toISOString(),
            ],
          );
        });
        return json({ ok: true });
      }
      if (p[1] === "inspect" && method === "POST") {
        const { id, reason } = z
          .object({ id: z.uuid(), reason: z.string().min(10).max(500) })
          .parse(await body(req));
        await transaction((tx) =>
          tx.run(
            "INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
            [
              crypto.randomUUID(),
              user.id,
              `content.inspect: ${reason}`,
              id,
              new Date().toISOString(),
            ],
          ),
        );
        const [project] = await query(
          "SELECT draft,published FROM projects WHERE id=?",
          [id],
        );
        return json({ project });
      }
    }
    throw new AppError("Resource not found.", 404);
  } catch (e) {
    if (e instanceof AppError) return json({ error: e.message }, e.status);
    if (e instanceof ZodError)
      return json(
        {
          error:
            "Check the form fields. " +
            e.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .slice(0, 3)
              .join("; "),
        },
        400,
      );
    if (e instanceof SyntaxError) return json({ error: "Invalid data." }, 400);
    return json(
      { error: "The operation failed. Try again or contact support." },
      500,
    );
  }
}
export const GET = route;
export const POST = route;
export const PUT = route;
export const DELETE = route;
