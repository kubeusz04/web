import { z } from "zod";
import { query, transaction, type Tx } from "./db";
import {
  AppError,
  passwordHash,
  passwordMatches,
  token,
  type User,
} from "./security";
import {
  giftSchema,
  mediaIds,
  demoGift,
  type Gift,
  type GiftSection,
} from "./schema";
import { initialCatalog, type Catalog } from "./config";
export interface Project {
  id: string;
  owner_id: string;
  draft: Gift;
  published: Gift | null;
  revision: number;
  published_revision: number | null;
  token: string;
  password_hash?: string | null;
  hasPassword?: boolean;
  expires_at: string | null;
  blocked: number;
  deleting?: number;
  updated_at: string;
  paid?: boolean;
}
interface ProjectRow extends Omit<Project, "draft" | "published"> {
  draft: string;
  published: string | null;
}
export function decode(row: ProjectRow): Project {
  return {
    ...row,
    draft: giftSchema.parse(JSON.parse(row.draft)),
    published: row.published
      ? giftSchema.parse(JSON.parse(row.published))
      : null,
  };
}
export function safeProject(p: Project) {
  const { password_hash, ...safe } = p;
  return { ...safe, hasPassword: !!password_hash };
}
export async function catalog(tx?: Tx): Promise<Catalog> {
  const [row] = await (tx
    ? tx.all<{ value: string }>("SELECT value FROM catalog WHERE id=?", [
        "main",
      ])
    : query<{ value: string }>("SELECT value FROM catalog WHERE id=?", [
        "main",
      ]));
  return row ? JSON.parse(row.value) : structuredClone(initialCatalog);
}
export async function owned(
  tx: Tx,
  user: User,
  id: string,
  lock = false,
  allowUnavailable = false,
) {
  if (lock)
    await tx.run(
      "UPDATE projects SET revision=revision WHERE id=? AND owner_id=?",
      [id, user.id],
    );
  const [r] = await tx.all<ProjectRow>(
    "SELECT * FROM projects WHERE id=? AND owner_id=?",
    [id, user.id],
  );
  if (!r) throw new AppError("Gift not found.", 404);
  if ((r.blocked || r.deleting) && !allowUnavailable)
    throw new AppError(
      "This project is blocked or awaiting deletion. Contact support.",
      403,
    );
  return decode(r);
}
export async function projectFor(user: User, id: string) {
  return transaction(async (tx) => {
    const p = await owned(tx, user, id);
    const orders = await tx.all(
      "SELECT id FROM orders WHERE project_id=? AND status=?",
      [id, "paid"],
    );
    return safeProject({ ...p, paid: orders.length > 0 });
  });
}
export async function projectsFor(user: User) {
  const rows = await query<ProjectRow>(
    "SELECT * FROM projects WHERE owner_id=? ORDER BY updated_at DESC",
    [user.id],
  );
  return rows.map((r) => safeProject(decode(r)));
}
export async function createProject(user: User, type: GiftSection["type"]) {
  const c = await catalog();
  if (!c.templates.find((t) => t.id === type && t.enabled))
    throw new AppError("This template is unavailable.");
  const p = { id: crypto.randomUUID(), draft: demoGift(type), token: token() };
  await transaction(async (tx) => {
    await tx.run("UPDATE users SET blocked=blocked WHERE id=?", [user.id]);
    const [{ count }] = await tx.all<{ count: number }>(
      "SELECT COUNT(*) AS count FROM projects p WHERE p.owner_id=? AND NOT EXISTS(SELECT id FROM orders o WHERE o.project_id=p.id AND o.status='paid')",
      [user.id],
    );
    if (Number(count) >= 10)
      throw new AppError(
        "You can keep up to 10 unpaid drafts. Delete an unused draft to continue.",
      );
    await tx.run(
      "INSERT INTO projects(id,owner_id,draft,token,updated_at) VALUES(?,?,?,?,?)",
      [
        p.id,
        user.id,
        JSON.stringify(p.draft),
        p.token,
        new Date().toISOString(),
      ],
    );
  });
  return p;
}
export async function validateAssets(
  tx: Tx,
  userId: string,
  projectId: string,
  gift: Gift,
) {
  for (const id of mediaIds(gift)) {
    const [m] = await tx.all<{ id: string; mime: string }>(
      "SELECT id,mime FROM media WHERE id=? AND owner_id=? AND project_id=? AND state='ready'",
      [id, userId, projectId],
    );
    if (!m)
      throw new AppError("This file does not belong to this project.", 403);
    const kind = m.mime.split("/")[0];
    if (
      (id === gift.musicId && kind !== "audio") ||
      ([gift.fromPortraitId, gift.toPortraitId].includes(id) &&
        kind !== "image") ||
      gift.sections.some((section) =>
        section.items.some(
          (item) => item.extraMediaIds?.includes(id) && kind !== "image",
        ),
      )
    )
      throw new AppError(
        "Select an audio file for music and image files for portraits and galleries.",
      );
    if (
      gift.sections.some((section) =>
        section.items.some(
          (item) => item.mediaId === id && item.mediaKind !== kind,
        ),
      )
    )
      throw new AppError(
        "The selected media type does not match the stored file.",
      );
  }
}
export async function saveProject(
  user: User,
  id: string,
  input: unknown,
  revision: number,
) {
  const draft = giftSchema.parse(input);
  return transaction(async (tx) => {
    const p = await owned(tx, user, id, true);
    if (p.revision !== revision)
      throw new AppError(
        "This project changed in another tab. Refresh before editing.",
        409,
      );
    await validateAssets(tx, user.id, id, draft);
    await tx.run(
      "UPDATE projects SET draft=?,revision=revision+1,updated_at=? WHERE id=?",
      [JSON.stringify(draft), new Date().toISOString(), id],
    );
    return { revision: p.revision + 1 };
  });
}
export async function publishProject(user: User, id: string) {
  return transaction(async (tx) => {
    const p = await owned(tx, user, id, true);
    const [order] = await tx.all<{ plan: string }>(
      "SELECT plan FROM orders WHERE project_id=? AND status=? ORDER BY paid_at DESC",
      [id, "paid"],
    );
    if (!order)
      throw new AppError("Publishing requires a confirmed payment.", 402);
    if (!p.expires_at || p.expires_at < new Date().toISOString())
      throw new AppError("This gift’s hosting period has expired.", 403);
    const plan = JSON.parse(order.plan) as Catalog["plans"][number];
    await enforceLimits(tx, id, p.draft, plan);
    await validateAssets(tx, user.id, id, p.draft);
    await tx.run(
      "UPDATE projects SET published=?,published_revision=?,updated_at=? WHERE id=?",
      [JSON.stringify(p.draft), p.revision, new Date().toISOString(), id],
    );
    return { token: p.token, revision: p.revision };
  });
}
export async function enforceLimits(
  tx: Tx,
  id: string,
  gift: Gift,
  plan: Catalog["plans"][number],
) {
  const items = gift.sections.reduce((sum, s) => sum + s.items.length, 0);
  const [{ count, bytes }] = await tx.all<{ count: number; bytes: number }>(
    "SELECT COUNT(*) AS count,COALESCE(SUM(bytes),0) AS bytes FROM media WHERE project_id=?",
    [id],
  );
  if (
    items > plan.maxItems ||
    Number(count) > plan.maxFiles ||
    Number(bytes) > plan.maxBytes
  )
    throw new AppError(
      "This project exceeds the package limits. Remove content or choose a larger package.",
    );
}
export async function sharing(
  user: User,
  id: string,
  input: { password?: string; rotate?: boolean; revoke?: boolean },
) {
  await transaction(async (tx) => {
    await owned(tx, user, id, true);
    if (input.password !== undefined) {
      if (input.password && input.password.length < 8)
        throw new AppError("Gift passwords must have at least 8 characters.");
      await tx.run("UPDATE projects SET password_hash=? WHERE id=?", [
        input.password ? passwordHash(input.password) : null,
        id,
      ]);
    }
    if (input.rotate || input.revoke)
      await tx.run(
        "UPDATE projects SET token=?,published=CASE WHEN ?=1 THEN NULL ELSE published END WHERE id=?",
        [token(), input.revoke ? 1 : 0, id],
      );
    await tx.run("DELETE FROM viewer_sessions WHERE project_id=?", [id]);
  });
}
export async function publicGift(link: string, password?: string) {
  const [row] = await query<ProjectRow>(
    "SELECT * FROM projects WHERE token=?",
    [link],
  );
  if (
    !row ||
    !row.published ||
    row.blocked ||
    !row.expires_at ||
    row.expires_at < new Date().toISOString()
  )
    throw new AppError("This gift is unavailable.", 404);
  const [paid] = await query(
    "SELECT id FROM orders WHERE project_id=? AND status=?",
    [row.id, "paid"],
  );
  if (!paid) throw new AppError("This gift is unavailable.", 404);
  if (
    row.password_hash &&
    (!password || !passwordMatches(password, row.password_hash))
  )
    throw new AppError("Enter the correct gift password.", 401);
  return {
    id: row.id,
    gift: giftSchema.parse(JSON.parse(row.published)),
    token: row.token,
  };
}
export const catalogSchema = z.object({
  headline: z.string().min(1).max(200),
  intro: z.string().max(600),
  faq: z
    .array(z.object({ q: z.string().max(200), a: z.string().max(2000) }))
    .max(20),
  templates: z
    .array(
      z.object({
        id: z.enum(["film", "archive", "cosmos", "surprise"]),
        name: z.string().max(100),
        description: z.string().max(300),
        enabled: z.boolean(),
      }),
    )
    .length(4),
  plans: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z]+$/),
        name: z.string().max(100),
        price: z.number().int().min(100).max(100000),
        maxItems: z.number().int().min(1).max(100),
        maxFiles: z.number().int().min(1).max(100),
        maxBytes: z.number().int().min(1048576).max(1073741824),
        days: z.number().int().min(1).max(3650),
      }),
    )
    .min(1)
    .max(5),
});
