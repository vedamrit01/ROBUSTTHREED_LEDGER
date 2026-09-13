import { access, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createInterface, emitKeypressEvents } from 'node:readline';
import { hashPassword } from '../server/auth.mjs';
import { root, settingsFile, localEnvironment } from './windows-local.mjs';

function ask(label) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(label, value => { rl.close(); resolve(value.trim()); }));
}
function secret(label) {
  if (!process.stdin.isTTY) throw new Error('Double-click SETUP_LEDGER.cmd to use an interactive terminal.');
  process.stdout.write(label);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    function finish(error) {
      process.stdin.removeListener('keypress', onKey);
      process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n');
      error ? reject(error) : resolve(value);
    }
    function onKey(str, key = {}) {
      if (key.ctrl && key.name === 'c') return finish(new Error('Setup cancelled.'));
      if (key.name === 'return' || key.name === 'enter') return finish();
      if (key.name === 'backspace') { value = Array.from(value).slice(0, -1).join(''); return; }
      if (!key.ctrl && !key.meta && str && !/[\x00-\x1f\x7f]/.test(str)) value += str;
    }
    process.stdin.on('keypress', onKey);
  });
}
try {
  if (process.platform !== 'win32') throw new Error('Run this setup on your Windows PC.');
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Install Node.js 24 or newer, then reopen setup.');
  let exists = false;
  try { await access(settingsFile); exists = true; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (exists) {
    console.log('Local setup already exists. Use START_LEDGER.cmd. To change settings, see WINDOWS_SETUP.md.');
  } else {
    console.log('ROBUSTTHREED - Windows local setup\nMySQL must already be running. This creates robustthreed_ledger on this PC.\n');
    console.log('Installing project dependencies (internet required)...');
    const install = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'npm ci'], { cwd: root, stdio: 'inherit' });
    if (install.error || install.status !== 0) throw new Error('Dependency installation failed. Check Node.js and internet, then rerun setup.');
    const user = (await ask('MySQL username [root]: ')) || 'root';
    const port = Number((await ask('MySQL port [3306]: ')) || '3306');
    const password = await secret('MySQL password (typing is hidden): ');
    const owner = await secret('Choose a NEW ledger login password (12-256 characters, hidden): ');
    if (owner.length < 12 || owner.length > 256) throw new Error('Ledger password must contain 12-256 characters.');
    if (owner !== await secret('Repeat ledger login password: ')) throw new Error('Ledger passwords did not match. Rerun setup.');
    const settings = { version: 1, user, port, password, passwordHash: await hashPassword(owner) };
    const env = localEnvironment(settings);
    const setup = spawnSync(process.execPath, ['scripts/setup-db.mjs'], { cwd: root, env, stdio: 'inherit' });
    if (setup.error || setup.status !== 0) throw new Error('Could not prepare MySQL. Check its Windows service, username, password and port, then rerun setup.');
    // Exclusive creation preserves any existing local configuration. Secrets never enter shell arguments.
    await writeFile(settingsFile, JSON.stringify(settings, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('\nSetup complete. Double-click START_LEDGER.cmd and sign in with your NEW ledger password.');
  }
} catch (e) {
  // Do not print provider errors or objects that might contain credentials.
  const safe = /^(Run this|Install Node|Local settings|Setup cancelled|Dependency installation|Ledger password|Ledger passwords|Could not prepare)/.test(e.message || '');
  console.error(safe ? e.message : 'Setup could not finish. Check folder write permissions and see WINDOWS_SETUP.md.');
  process.exitCode = 1;
}
