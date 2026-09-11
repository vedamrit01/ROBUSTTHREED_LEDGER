import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { databaseName, databaseOptions } from "../server/config.mjs";

let connection;
try {
  const name = databaseName();
  const { database, ...options } = databaseOptions();
  connection = await mysql.createConnection(options);
  // The identifier is validated by databaseName; user data always uses parameters.
  // For providers with a pre-created DB and no CREATE privilege, use --existing.
  if (!process.argv.includes("--existing")) await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.changeUser({ database });
  const schema = await readFile(new URL("../server/schema.sql", import.meta.url), "utf8");
  for (const sql of schema.split(";").map(x => x.trim()).filter(Boolean)) await connection.query(sql);
  console.log(`Database ${name} is ready. Ledger and session tables are available. Existing records were preserved.`);
} catch (e) {
  const code = /^[A-Z0-9_]+$/.test(e.code || "") ? ` (${e.code})` : "";
  console.error(`Database setup failed${code}. Check DB_HOST, DB_USER, DB_PASSWORD and MySQL permissions in your local .env. This command must run where your MySQL server is reachable. No credentials are printed.`);
  process.exitCode = 1;
} finally { if (connection) await connection.end(); }
