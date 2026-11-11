import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { transaction, query } from "./db";
import { localMode } from "./config";
import { supabase, bucket } from "./providers";
import { owned, catalog } from "./service";
import { mediaIds, giftSchema } from "./schema";
import { AppError, hash, type User } from "./security";
import { cookies } from "next/headers.js";
import sharp from "sharp";
const dir = () =>
  path.join(
    process.env.BLISKO_DATA_DIR || path.join(process.cwd(), ".data"),
    "media",
  );
export interface Media {
  id: string;
  owner_id: string;
  project_id: string;
  storage_key: string;
  mime: string;
  bytes: number;
  state?: string;
}
function sniff(b: Buffer): string | null {
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  if (b.toString("ascii", 4, 8) === "ftyp") return "video/mp4";
  if (
    b.toString("ascii", 0, 3) === "ID3" ||
    (b[0] === 255 && (b[1] & 224) === 224)
  )
    return "audio/mpeg";
  if (
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WAVE"
  )
    return "audio/wav";
  return null;
}
export async function upload(user: User, projectId: string, file: File) {
  if (file.size < 12 || file.size > 25 * 1024 * 1024)
    throw new AppError("File size must be between 12 bytes and 25 MB.");
  let bytes = Buffer.from(await file.arrayBuffer()),
    mime = sniff(bytes);
  if (!mime || mime !== file.type)
    throw new AppError(
      "Use JPG, PNG, WebP, MP4, MP3 or WAV. The file type must match its content.",
    );
  if (mime.startsWith("image/")) {
    try {
      bytes = Buffer.from(
        await sharp(bytes, { limitInputPixels: 40000000 })
          .autoOrient()
          .resize(2400, 2400, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 88 })
          .toBuffer(),
      );
      mime = "image/webp";
    } catch {
      throw new AppError(
        "The image cannot be decoded or exceeds 40 megapixels.",
      );
    }
  }
  const id = crypto.randomUUID(),
    key = `${user.id}/${projectId}/${id}`;
  await transaction(async (tx) => {
    await tx.run("UPDATE users SET blocked=blocked WHERE id=?", [user.id]);
    await owned(tx, user, projectId, true);
    const c = await catalog(tx);
    const [paid] = await tx.all<{ plan: string }>(
      "SELECT plan FROM orders WHERE project_id=? AND status=? ORDER BY paid_at DESC",
      [projectId, "paid"],
    );
    const plan = paid
      ? JSON.parse(paid.plan)
      : c.plans.reduce((a, b) => (a.maxBytes > b.maxBytes ? a : b));
    if (!paid) {
      const [{ total }] = await tx.all<{ total: number }>(
        "SELECT COALESCE(SUM(m.bytes),0) AS total FROM media m JOIN projects p ON p.id=m.project_id WHERE p.owner_id=? AND NOT EXISTS(SELECT id FROM orders o WHERE o.project_id=p.id AND o.status='paid')",
        [user.id],
      );
      if (Number(total) + bytes.length > plan.maxBytes)
        throw new AppError(
          "Your unpaid drafts have reached their combined storage limit. Delete unused files to continue.",
        );
    }
    const [{ count, total }] = await tx.all<{ count: number; total: number }>(
      "SELECT COUNT(*) AS count,COALESCE(SUM(bytes),0) AS total FROM media WHERE project_id=?",
      [projectId],
    );
    if (
      Number(count) >= plan.maxFiles ||
      Number(total) + bytes.length > plan.maxBytes
    )
      throw new AppError("Media storage limit reached.");
    await tx.run(
      "INSERT INTO media(id,owner_id,project_id,storage_key,mime,bytes,created_at,state) VALUES(?,?,?,?,?,?,?,'uploading')",
      [
        id,
        user.id,
        projectId,
        key,
        mime,
        bytes.length,
        new Date().toISOString(),
      ],
    );
  });
  try {
    if (localMode()) {
      await mkdir(dir(), { recursive: true });
      await writeFile(path.join(dir(), id), bytes, { flag: "wx" });
    } else {
      const { error } = await supabase(true)
        .storage.from(bucket())
        .upload(key, bytes, { contentType: mime, upsert: false });
      if (error) throw error;
    }
    await transaction((tx) =>
      tx.run("UPDATE media SET state='ready' WHERE id=?", [id]),
    );
  } catch {
    try {
      await removeStored({
        id,
        owner_id: user.id,
        project_id: projectId,
        storage_key: key,
        mime,
        bytes: bytes.length,
      });
      await transaction((tx) => tx.run("DELETE FROM media WHERE id=?", [id]));
    } catch {
      await transaction((tx) =>
        tx.run("UPDATE media SET state='deleting' WHERE id=?", [id]),
      );
    }
    throw new AppError("File upload failed. Please try again.", 503);
  }
  return { id, mime, bytes: bytes.length, state: "ready" };
}
export async function readMedia(
  id: string,
  user: User | null,
  preview = false,
) {
  const [m] = await query<Media>(
    "SELECT * FROM media WHERE id=? AND state='ready'",
    [id],
  );
  if (!m) throw new AppError("File not found.", 404);
  let authorized = m.owner_id === user?.id;
  if (!authorized) {
    const session = (await cookies()).get("blisko_view")?.value;
    if (session) {
      const [p] = await query<{ published: string; token: string }>(
        "SELECT p.published,p.token FROM viewer_sessions v JOIN projects p ON p.id=v.project_id WHERE v.token_hash=? AND v.expires_at>? AND v.project_id=? AND p.blocked=0 AND p.expires_at>? AND v.link_token_hash=?",
        [
          hash(session),
          new Date().toISOString(),
          m.project_id,
          new Date().toISOString(),
          await currentLinkHash(m.project_id),
        ],
      );
      authorized =
        !!p?.published &&
        mediaIds(giftSchema.parse(JSON.parse(p.published))).includes(id);
    }
  }
  if (!authorized) throw new AppError("File not found.", 404);
  let bytes: Buffer;
  if (localMode()) bytes = await readFile(path.join(dir(), id));
  else {
    const { data, error } = await supabase(true)
      .storage.from(bucket())
      .download(m.storage_key);
    if (error || !data)
      throw new AppError("This file is temporarily unavailable.", 503);
    bytes = Buffer.from(await data.arrayBuffer());
  }
  if (preview && m.mime.startsWith("image/"))
    return {
      bytes: await sharp(bytes, { limitInputPixels: 40000000 })
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer(),
      mime: "image/webp",
    };
  return { bytes, mime: m.mime };
}
async function currentLinkHash(id: string) {
  const [p] = await query<{ token: string }>(
    "SELECT token FROM projects WHERE id=?",
    [id],
  );
  return p ? hash(p.token) : "";
}
export async function removeStored(m: Media) {
  if (localMode()) {
    await unlink(path.join(dir(), m.id)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
  } else {
    const { error } = await supabase(true)
      .storage.from(bucket())
      .remove([m.storage_key]);
    if (error)
      throw new AppError("Storage did not confirm deletion. Try again.", 503);
  }
}
export async function deleteProject(user: User, id: string) {
  const files = await transaction(async (tx) => {
    await owned(tx, user, id, true, true);
    const uploading = await tx.all(
      "SELECT id FROM media WHERE project_id=? AND state='uploading'",
      [id],
    );
    if (uploading.length)
      throw new AppError(
        "A file is still uploading. Wait for it to finish before deleting this project.",
        409,
      );
    await tx.run("UPDATE projects SET published=NULL,deleting=1 WHERE id=?", [
      id,
    ]);
    await tx.run("DELETE FROM viewer_sessions WHERE project_id=?", [id]);
    return tx.all<Media>("SELECT * FROM media WHERE project_id=?", [id]);
  });
  for (const m of files) await removeStored(m);
  await transaction(async (tx) => {
    await owned(tx, user, id, true, true);
    await tx.run("DELETE FROM projects WHERE id=?", [id]);
  });
}
