// Only the API's public origin belongs in this bundle. MySQL credentials stay on the server.
const apiOrigin = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
const storageKey = "robustthreed-session";
let token = "";
try { token = sessionStorage.getItem(storageKey) || ""; } catch { /* In-memory sessions still work. */ }
export function hasSession() { return Boolean(token); }
export function setSession(value: string) {
  token = value;
  try { value ? sessionStorage.setItem(storageKey, value) : sessionStorage.removeItem(storageKey); } catch { /* Storage can be disabled. */ }
}
export const needsApiConfiguration = import.meta.env.PROD && !apiOrigin;
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  if (needsApiConfiguration) throw new Error("The ledger server has not been connected yet. Follow the hosting steps in the project README.");
  let r: Response;
  try {
    r = await fetch(apiOrigin + path, {
      // Free API hosts can need about a minute to wake after idling.
      ...options, cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(90000),
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
    });
  } catch {
    throw new Error("Cannot reach the ledger server. Check your connection and try again; unsaved entries stay in the form.");
  }
  let body: T & { error?: string };
  try { body = await r.json(); } catch { throw new Error("The ledger server returned an unexpected response. Please try again."); }
  if (r.status === 401 && path !== "/api/login") {
    setSession("");
    window.dispatchEvent(new Event("ledger-session-expired"));
  }
  if (!r.ok) throw new Error(body.error || "Something went wrong. Please try again.");
  return body;
}
