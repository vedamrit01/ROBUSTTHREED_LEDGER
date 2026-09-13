import test from 'node:test';
import assert from 'node:assert/strict';
import { localEnvironment } from '../scripts/windows-local.mjs';
const settings = { version: 1, user: 'root', port: 3306, password: 'dummy "quoted" # $ % & \\ password', passwordHash: `scrypt:${'a'.repeat(22)}:${'b'.repeat(86)}` };
test('Windows settings preserve password characters and isolate local database from inherited cloud settings', () => {
  const env = localEnvironment(JSON.parse(JSON.stringify(settings)), { PATH: 'kept', DB_HOST: 'cloud.invalid', DB_SSL_CA_PEM: 'old CA', LEDGER_PASSWORD: 'old login', VITE_API_URL: 'https://cloud.invalid', NODE_OPTIONS: '--env-file=.env', PORT: '9999' });
  assert.equal(env.DB_PASSWORD, settings.password);
  assert.equal(env.DB_HOST, '127.0.0.1');
  assert.equal(env.DB_NAME, 'robustthreed_ledger');
  assert.equal(env.PORT, '3001');
  assert.equal(env.VITE_API_URL, '');
  assert.equal(env.PATH, 'kept');
  for (const key of ['NODE_OPTIONS', 'DB_SSL_CA_PEM', 'LEDGER_PASSWORD']) assert.equal(env[key], undefined);
});
test('Windows setup rejects malformed port, credentials and hash', () => {
  for (const patch of [{port:0}, {port:65536}, {port:3.5}, {password:''}, {user:''}, {passwordHash:'bad'}, {version:2}]) {
    assert.throws(() => localEnvironment({...settings, ...patch}), /Local settings are invalid/);
  }
});
