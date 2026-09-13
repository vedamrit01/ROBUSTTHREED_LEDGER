import { readFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { root, settingsFile, localEnvironment } from './windows-local.mjs';
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
process.on('exit', () => { for (const child of children) child.kill(); });
function available(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Port ${port} is already in use. Close the other ledger window or app first.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
function launch(args, env) {
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  children.push(child);
  child.on('error', () => { console.error('Could not start a ledger process. Rerun setup if dependencies are missing.'); stop(1); });
  child.on('exit', code => { if (!stopping) { console.error('A ledger process stopped. Check the message above and that MySQL is running.'); stop(code || 1); } });
}
async function ready(url, check) {
  for (let i = 0; i < 60 && !stopping; i++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok && await check(response)) return;
    } catch { /* Startup may still be in progress. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Ledger did not become ready. Check that MySQL is running and see WINDOWS_SETUP.md.');
}
try {
  if (process.platform !== 'win32') throw new Error('Run START_LEDGER.cmd on your Windows PC.');
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Install Node.js 24 or newer.');
  const env = localEnvironment(JSON.parse(await readFile(settingsFile, 'utf8')));
  await access(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
  await Promise.all([available(3001), available(5173)]);
  console.log('Starting your LOCAL ledger. Keep this window open. Press Ctrl+C to stop.');
  launch(['server/index.mjs'], env);
  await ready('http://127.0.0.1:3001/api/health', async response => (await response.json()).ok === true);
  // The frontend receives no database credentials or owner hash.
  const frontendEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !/^(DB_|LEDGER_)/i.test(key)));
  launch(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort', '--mode', 'windows'], frontendEnv);
  await ready('http://127.0.0.1:5173', async response => (await response.text()).includes('<html'));
  if (!stopping) {
    console.log('\nReady: http://localhost:5173 - use your LOCAL ledger password.');
    const opener = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'start', '', 'http://localhost:5173'], { stdio: 'ignore' });
    opener.on('error', () => console.log('Open http://localhost:5173 in your browser.'));
  }
} catch (e) {
  const safe = /^(Run START|Install Node|Local settings|Port |Ledger did)/.test(e.message || '');
  console.error(safe ? e.message : 'Local setup or dependencies are missing or unreadable. Run SETUP_LEDGER.cmd; see WINDOWS_SETUP.md for repairs.');
  stop(1);
}
