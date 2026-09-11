import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const digest = value => createHash("sha256").update(value).digest("hex");
export async function hashPassword(password, salt = randomBytes(16).toString("base64url")) {
  const hash = await scrypt(password, salt, 64, options);
  return `scrypt:${salt}:${hash.toString("base64url")}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== "string" || !password || password.length > 256) return false;
  const [, salt, encoded] = stored.split(":");
  const actual = await scrypt(password, salt, 64, options);
  const expected = Buffer.from(encoded, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function createToken() { return randomBytes(32).toString("base64url"); }

// A bounded per-process limiter; proxy configuration controls the source IP.
export function loginLimiter({ limit = 8, windowMs = 15 * 60_000, maxKeys = 10000 } = {}) {
  const attempts = new Map();
  return ip => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.reset <= now) attempts.delete(key);
    let item = attempts.get(ip);
    if (!item) {
      if (attempts.size >= maxKeys) return false;
      item = { count: 0, reset: now + windowMs }; attempts.set(ip, item);
    }
    item.count++;
    return item.count <= limit;
  };
}
