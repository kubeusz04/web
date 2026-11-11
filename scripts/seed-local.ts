import { readFile } from "node:fs/promises";
import { query, transaction } from "../src/lib/db";
import { passwordHash } from "../src/lib/security";
import { createProject, saveProject } from "../src/lib/service";
import { demoGift } from "../src/lib/schema";
import { upload } from "../src/lib/media";
if (process.env.APP_MODE !== "local" || process.env.DATABASE_URL)
  throw new Error("The demo seed only runs against local SQLite.");
const email = "preview@blisko.local";
if ((await query("SELECT id FROM users WHERE email=?", [email])).length) {
  console.log("Local preview account already exists.");
  process.exit(0);
}
const user = { id: crypto.randomUUID(), email, role: "customer", blocked: 0 };
await transaction((tx) =>
  tx.run(
    "INSERT INTO users(id,email,password_hash,role,created_at) VALUES(?,?,?,?,?)",
    [
      user.id,
      email,
      passwordHash("Blisko-local-preview-2026"),
      "customer",
      new Date().toISOString(),
    ],
  ),
);
const project = await createProject(user, "film");
const draft = project.draft;
draft.sections.push(
  ...(["archive", "cosmos", "surprise"] as const).map(
    (type) => demoGift(type).sections[0],
  ),
);
const bytes = await readFile("public/demo-coast.webp");
const media = await upload(
  user,
  project.id,
  new File([bytes], "fictional-coast.webp", { type: "image/webp" }),
);
draft.sections[0].items[0].mediaId = media.id;
await saveProject(user, project.id, draft, 1);
console.log(
  "Local fictional preview created. Email: preview@blisko.local. Password: Blisko-local-preview-2026. This account has no paid entitlements.",
);
process.exit(0);
