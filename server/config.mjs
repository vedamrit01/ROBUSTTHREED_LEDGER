import { readFileSync } from "node:fs";
import { digest, hashPassword } from "./auth.mjs";

export function databaseName(env = process.env) {
  const name = env.DB_NAME || "robustthreed_ledger";
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(name)) throw new Error("DB_NAME must be a simple database name (letters, digits, underscores).");
  return name;
}
export function databaseOptions(env = process.env) {
  if (!env.DB_PASSWORD) throw new Error("Set DB_PASSWORD in your server .env before connecting to MySQL.");
  if (!env.DB_USER) throw new Error("Set DB_USER in your server .env.");
  const port = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid DB_PORT.");
  const ca = env.DB_SSL_CA_PEM?.replaceAll("\\n", "\n") || (env.DB_SSL_CA ? readFileSync(env.DB_SSL_CA, "utf8") : undefined);
  return {
    host: env.DB_HOST || "localhost", port, user: env.DB_USER, password: env.DB_PASSWORD,
    database: databaseName(env), charset: "utf8mb4", dateStrings: true,
    supportBigNumbers: true, bigNumberStrings: true, timezone: "Z",
    connectTimeout: 10000,
    ...(env.DB_SSL === "true" ? { ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } } : {}),
  };
}

// Cloud dashboards can provide a secret password directly; no local terminal is needed.
// A persistent, random salt keeps the hash stable across API restarts and sleep/wake cycles.
export async function resolveServerConfig(env = process.env) {
  if (env.LEDGER_PASSWORD_HASH) return serverConfig(env);
  const password = env.LEDGER_PASSWORD;
  if (typeof password !== "string" || password.length < 16 || password.length > 256) throw new Error("Set LEDGER_PASSWORD to a password between 16 and 256 characters, or configure LEDGER_PASSWORD_HASH.");
  if (!env.LEDGER_AUTH_SALT || env.LEDGER_AUTH_SALT.length < 32) throw new Error("Set a random LEDGER_AUTH_SALT of at least 32 characters.");
  const salt = Buffer.from(digest(env.LEDGER_AUTH_SALT), "hex").subarray(0, 16).toString("base64url");
  const passwordHash = await hashPassword(password, salt);
  return serverConfig({ ...env, LEDGER_PASSWORD_HASH: passwordHash });
}
export function serverConfig(env = process.env) {
  if (!/^scrypt:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{86}$/.test(env.LEDGER_PASSWORD_HASH || "")) throw new Error("Run npm run password:set to create your owner login.");
  const origins = (env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173").split(",").map(x => x.trim()).filter(Boolean);
  for (const value of origins) {
    const url = new URL(value);
    if (url.origin !== value || !["http:", "https:"].includes(url.protocol)) throw new Error("ALLOWED_ORIGINS must contain exact origins without paths or trailing slashes.");
    if (env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Production frontend origins must use HTTPS.");
  }
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) throw new Error("Invalid TRUST_PROXY_HOPS.");
  if (!origins.length) throw new Error("At least one ALLOWED_ORIGINS value is required.");
  return { passwordHash: env.LEDGER_PASSWORD_HASH, origins, trustProxyHops };
}
