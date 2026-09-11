import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { databaseOptions, resolveServerConfig } from "../server/config.mjs";
import { digest, hashPassword, verifyPassword } from "../server/auth.mjs";

test("Cloud passwords survive API restarts and invalidate sessions when changed", async () => {
  const env = { LEDGER_PASSWORD: "cloud-fixture-password-123", LEDGER_AUTH_SALT: randomBytes(32).toString("base64"), ALLOWED_ORIGINS: "https://vedamrit01.github.io", NODE_ENV: "production" };
  const first = await resolveServerConfig(env), restarted = await resolveServerConfig(env);
  assert.equal(first.passwordHash, restarted.passwordHash);
  assert.equal(await verifyPassword(env.LEDGER_PASSWORD, first.passwordHash), true);
  assert.equal(await verifyPassword("wrong-password", first.passwordHash), false);
  const changed = await resolveServerConfig({ ...env, LEDGER_PASSWORD: "a-different-fixture-password" });
  assert.notEqual(digest(first.passwordHash), digest(changed.passwordHash));
  assert.notEqual((await resolveServerConfig({ ...env, LEDGER_AUTH_SALT: randomBytes(32).toString("base64") })).passwordHash, first.passwordHash);
});
test("Cloud login rejects incomplete settings and preserves existing hash configuration", async () => {
  await assert.rejects(resolveServerConfig({ LEDGER_PASSWORD: "too-short", LEDGER_AUTH_SALT: "a".repeat(32) }));
  await assert.rejects(resolveServerConfig({ LEDGER_PASSWORD: "cloud-fixture-password-123" }));
  const hash = await hashPassword("local-fixture-password-123");
  assert.equal((await resolveServerConfig({ LEDGER_PASSWORD_HASH: hash })).passwordHash, hash);
});
test("Cloud CA certificate values retain TLS verification and accept pasted newlines", () => {
  const env = { DB_USER: "fixture-user", DB_PASSWORD: "fixture-only-password", DB_SSL: "true", DB_SSL_CA_PEM: "-----BEGIN CERTIFICATE-----\\nfixture\\n-----END CERTIFICATE-----" };
  const options = databaseOptions(env);
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.ca, env.DB_SSL_CA_PEM.replaceAll("\\n", "\n"));
  assert.equal(databaseOptions({ ...env, DB_SSL_CA_PEM: options.ssl.ca }).ssl.ca, options.ssl.ca);
});
