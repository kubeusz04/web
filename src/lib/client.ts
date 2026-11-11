export async function api<T = Record<string, unknown>>(
  url: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const res = await fetch(`/api/${url}`, {
    method,
    headers:
      data instanceof FormData
        ? undefined
        : data === undefined
          ? undefined
          : { "Content-Type": "application/json" },
    body:
      data === undefined
        ? undefined
        : data instanceof FormData
          ? data
          : JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "The operation failed.");
  if (
    typeof window !== "undefined" &&
    (url === "auth/logout" || (url === "account" && method === "DELETE"))
  ) {
    try {
      for (const key of Object.keys(localStorage))
        if (key.startsWith("blisko-draft:")) localStorage.removeItem(key);
    } catch {}
  }
  return result;
}
