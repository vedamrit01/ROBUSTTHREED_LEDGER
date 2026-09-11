import { createApp } from "./app.mjs";
import { serverConfig } from "./config.mjs";
import { createPool, mysqlStore } from "./store.mjs";

let pool;
try {
  const config = serverConfig();
  pool = createPool();
  const store = mysqlStore(pool);
  await store.health();
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT.");
  const server = createApp({ store, config }).listen(port, process.env.HOST || "127.0.0.1", () => console.log(`Robustthreed API listening on port ${port}.`));
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
    server.close(async () => { await pool.end(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  });
} catch (e) {
  const code = /^[A-Z0-9_]+$/.test(e.code || "") ? ` (${e.code})` : "";
  console.error(`API startup failed${code}. Check the server .env, run npm run password:set, and run npm run db:setup. MySQL must be reachable from this server.`);
  if (pool) await pool.end();
  process.exitCode = 1;
}
