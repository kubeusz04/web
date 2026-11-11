import { createClient } from "@supabase/supabase-js";
import { AppError } from "./security";
export function supabase(admin = false) {
  const url = process.env.SUPABASE_URL,
    key = admin
      ? process.env.SUPABASE_SERVICE_ROLE_KEY
      : process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new AppError("Configure Supabase to use this feature.", 503);
  return createClient(url, key, {
    global: {
      fetch: (url, options) =>
        fetch(url, { ...options, signal: AbortSignal.timeout(30000) }),
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export const bucket = () => process.env.SUPABASE_BUCKET || "gift-media";
