import { readFileSync } from "node:fs";

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
  return {
    host: env.DB_HOST || "localhost", port, user: env.DB_USER, password: env.DB_PASSWORD,
    database: databaseName(env), charset: "utf8mb4", dateStrings: true,
    supportBigNumbers: true, bigNumberStrings: true, timezone: "Z",
    connectTimeout: 10000,
    ...(env.DB_SSL === "true" ? { ssl: { rejectUnauthorized: true, ...(env.DB_SSL_CA ? { ca: readFileSync(env.DB_SSL_CA, "utf8") } : {}) } } : {}),
  };
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
