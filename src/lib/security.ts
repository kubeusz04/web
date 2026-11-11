import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { cookies } from "next/headers.js";
import { query, transaction } from "./db";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const token = () => randomBytes(32).toString("base64url");
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const actual = scryptSync(password, salt, 64),
    expected = Buffer.from(key, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export interface User {
  id: string;
  email: string;
  role: string;
  blocked: number;
  password_hash?: string;
}
export async function currentUser(): Promise<User | null> {
  const value = (await cookies()).get("blisko_session")?.value;
  if (!value) return null;
  const [user] = await query<User>(
    "SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.blocked=0",
    [hash(value), new Date().toISOString()],
  );
  return user
    ? { id: user.id, email: user.email, role: user.role, blocked: user.blocked }
    : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError("Sign in to continue.", 401);
  return user;
}
export function requireAdmin(user: User) {
  if (user.role !== "admin")
    throw new AppError("Administrator access required.", 403);
}
export async function issueSession(id: string) {
  const value = token();
  await query("DELETE FROM sessions WHERE expires_at<?", [
    new Date().toISOString(),
  ]);
  await transaction((tx) =>
    tx.run(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
      [hash(value), id, new Date(Date.now() + 7 * 86400000).toISOString()],
    ),
  );
  (await cookies()).set("blisko_session", value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_MODE !== "local",
    path: "/",
    maxAge: 604800,
  });
}
export async function rateLimit(key: string, max = 30, seconds = 60) {
  await transaction(async (tx) => {
    const now = new Date();
    const [result] = await tx.all<{ hits: number }>(
      "INSERT INTO rate_limits(key_hash,hits,reset_at) VALUES(?,1,?) ON CONFLICT(key_hash) DO UPDATE SET hits=CASE WHEN rate_limits.reset_at<? THEN 1 ELSE rate_limits.hits+1 END,reset_at=CASE WHEN rate_limits.reset_at<? THEN excluded.reset_at ELSE rate_limits.reset_at END RETURNING hits",
      [
        hash(key),
        new Date(+now + seconds * 1000).toISOString(),
        now.toISOString(),
        now.toISOString(),
      ],
    );
    if (result.hits > max)
      throw new AppError("Too many attempts. Please try again later.", 429);
    await tx.run("DELETE FROM rate_limits WHERE reset_at<?", [
      now.toISOString(),
    ]);
  });
}
export function checkOrigin(request: Request) {
  if (["GET", "HEAD"].includes(request.method)) return;
  const expected = new URL(process.env.APP_URL || request.url).origin;
  if (request.headers.get("origin") !== expected)
    throw new AppError("Invalid request origin.", 403);
}
