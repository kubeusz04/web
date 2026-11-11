import { query, transaction } from "./db";
import { deleteProject, removeStored, type Media } from "./media";
import { retention } from "./config";
export async function maintenance() {
  const now = Date.now(),
    expired = new Date(now - retention.expiredDays * 86400000).toISOString(),
    stale = new Date(now - retention.unpaidDraftDays * 86400000).toISOString();
  const projects = await query<{ id: string; owner_id: string }>(
    "SELECT p.id,p.owner_id FROM projects p WHERE p.deleting=1 OR (p.expires_at IS NOT NULL AND p.expires_at<?) OR (p.expires_at IS NULL AND p.updated_at<? AND NOT EXISTS(SELECT id FROM orders o WHERE o.project_id=p.id AND o.status='paid')) LIMIT 100",
    [expired, stale],
  );
  let deleted = 0,
    failed = 0,
    files = 0;
  const abandoned = await query<Media>(
    "SELECT * FROM media WHERE state IN ('uploading','deleting') AND created_at<? LIMIT 100",
    [new Date(now - 3600000).toISOString()],
  );
  for (const media of abandoned) {
    try {
      await removeStored(media);
      await transaction((tx) =>
        tx.run("DELETE FROM media WHERE id=? AND state<>'ready'", [media.id]),
      );
      files++;
    } catch {
      failed++;
    }
  }
  for (const project of projects) {
    try {
      await deleteProject(
        { id: project.owner_id, email: "", role: "customer", blocked: 0 },
        project.id,
      );
      await transaction((tx) =>
        tx.run(
          "INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
          [
            crypto.randomUUID(),
            "system",
            "retention.delete",
            project.id,
            new Date().toISOString(),
          ],
        ),
      );
      deleted++;
    } catch {
      failed++;
    }
  }
  await transaction(async (tx) => {
    for (const table of ["sessions", "viewer_sessions"])
      await tx.run(`DELETE FROM ${table} WHERE expires_at<?`, [
        new Date().toISOString(),
      ]);
    await tx.run("DELETE FROM rate_limits WHERE reset_at<?", [
      new Date().toISOString(),
    ]);
  });
  return { deleted, files, failed };
}
