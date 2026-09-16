import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { emitKeypressEvents, createInterface } from 'node:readline';
import { hashPassword } from '../server/auth.mjs';
export const root = fileURLToPath(new URL('../',import.meta.url));
export const dataDir = resolve(root,'data');
export const dbPath = resolve(dataDir,'ledger.sqlite');
export async function ensureData() { await mkdir(dataDir,{recursive:true}); }
export function ask(label) {
  const rl = createInterface({input:process.stdin,output:process.stdout});
  return new Promise(resolve=>rl.question(label,value=>{rl.close();resolve(value.trim());}));
}
export function secret(label) {
  if (!process.stdin.isTTY) throw new Error('Open the portable CMD launcher in an interactive terminal.');
  process.stdout.write(label); emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve,reject)=>{
    let value='';
    function finish(error) { process.stdin.removeListener('keypress',onKey);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n'); error ? reject(error) : resolve(value); }
    function onKey(str,key={}) {
      if(key.ctrl&&key.name==='c') return finish(new Error('Cancelled.'));
      if(key.name==='return'||key.name==='enter') return finish();
      if(key.name==='backspace'){value=Array.from(value).slice(0,-1).join('');return;}
      if(!key.ctrl&&!key.meta&&str&&!/[\x00-\x1f\x7f]/.test(str))value+=str;
    }
    process.stdin.on('keypress',onKey);
  });
}
export async function ownerConfig() {
  const path=resolve(dataDir,'owner.json');
  try { const cfg=JSON.parse(await readFile(path,'utf8'));if(!/^scrypt:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{86}$/.test(cfg.passwordHash||''))throw new Error('Owner settings are invalid. Restore owner.json from your backup.');return cfg; }
  catch(e){if(e.code!=='ENOENT')throw e;}
  console.log('First run: choose your PORTABLE ledger password. Typing is hidden.');
  while(true){
    const password=await secret('New password (12-256 characters): ');
    if(password.length<12||password.length>256){console.log('Use at least 12 characters. Please try again.');continue;}
    if(password!==await secret('Repeat password: ')){console.log('Passwords did not match. Please try again.');continue;}
    const cfg={passwordHash:await hashPassword(password)};
    await writeFile(path,JSON.stringify(cfg)+'\n',{flag:'wx',mode:0o600});return cfg;
  }
}
export function reportError(e) {
  // Avoid leaking imported records, credentials, SQL bindings, or validation issue objects.
  if (e.code==='ERR_SQLITE_ERROR' && /locked|busy/.test(e.message)) console.error('The portable database is in use. Close its other ledger/import/backup window first.');
  else if (e.code==='ENOSPC' || /disk is full/.test(e.message||'')) console.error('Not enough space on the drive. Free space and try again.');
  else if(e.code==='EADDRINUSE')console.error('Port 47831 is in use. Close the other portable ledger window first.');
  else if(e.code==='EACCES'||e.code==='EPERM')console.error('The drive or folder is not writable. Check its permissions and write-protection switch.');
  else console.error('Operation failed. Check that the complete app folder is extracted, the drive has free space, and no other ledger window is running. Error:', /^[A-Z0-9_]+$/.test(e.code||'')?e.code:'VALIDATION_OR_STARTUP');
}
