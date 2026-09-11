import { readFile, writeFile, chmod } from "node:fs/promises";
import { emitKeypressEvents } from "node:readline";
import { hashPassword } from "../server/auth.mjs";

async function hiddenPrompt(label) {
  if (!process.stdin.isTTY) throw new Error("Run this command in an interactive terminal.");
  process.stdout.write(label);
  emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    function finish(error) {
      process.stdin.removeListener("keypress", onKey); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n");
      error ? reject(error) : resolve(value);
    }
    function onKey(str, key = {}) {
      if (key.ctrl && key.name === "c") return finish(new Error("Cancelled."));
      if (key.name === "return" || key.name === "enter") return finish();
      if (key.name === "backspace") { value = Array.from(value).slice(0, -1).join(""); return; }
      if (!key.ctrl && !key.meta && str && !/[\x00-\x1f\x7f]/.test(str)) value += str;
    }
    process.stdin.on("keypress", onKey);
  });
}
try {
  const filename = new URL("../.env", import.meta.url);
  const current = await readFile(filename, "utf8");
  const password = await hiddenPrompt("New owner password (at least 12 characters, hidden): ");
  if (password.length < 12 || password.length > 256) throw new Error("Choose a password between 12 and 256 characters.");
  if (password !== await hiddenPrompt("Confirm owner password (hidden): ")) throw new Error("Passwords did not match.");
  const hash = await hashPassword(password);
  const line = `LEDGER_PASSWORD_HASH=${hash}`;
  const next = /^LEDGER_PASSWORD_HASH=.*$/m.test(current) ? current.replace(/^LEDGER_PASSWORD_HASH=.*$/m, line) : current.trimEnd() + "\n" + line + "\n";
  await writeFile(filename, next, { mode: 0o600 });
  if (process.platform !== "win32") await chmod(filename, 0o600);
  console.log("Owner login saved in .env. Restart the API to use it. Previous sessions become invalid after the password changes.");
} catch (e) {
  console.error(e.code === "ENOENT" ? "Copy .env.example to .env first." : e.message);
  process.exitCode = 1;
}
