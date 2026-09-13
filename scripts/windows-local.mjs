import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const settingsFile = resolve(root, '.env.windows.json');
export function localEnvironment(settings, inherited = process.env) {
  if (settings.version !== 1 || !Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535 || typeof settings.user !== 'string' || !settings.user || typeof settings.password !== 'string' || !settings.password || !/^scrypt:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{86}$/.test(settings.passwordHash || '')) {
    throw new Error('Local settings are invalid. See WINDOWS_SETUP.md.');
  }
  const env = Object.fromEntries(Object.entries(inherited).filter(([key]) => !/^(DB_|LEDGER_|VITE_|NODE_OPTIONS$|NODE_ENV$|PORT$|HOST$|ALLOWED_ORIGINS$|TRUST_PROXY_HOPS$)/i.test(key)));
  return { ...env, DB_HOST: '127.0.0.1', DB_PORT: String(settings.port), DB_USER: settings.user, DB_PASSWORD: settings.password, DB_NAME: 'robustthreed_ledger', DB_SSL: 'false', LEDGER_PASSWORD_HASH: settings.passwordHash, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '3001', TRUST_PROXY_HOPS: '0', ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173', VITE_API_URL: '', VITE_BASE_PATH: '/' };
}
