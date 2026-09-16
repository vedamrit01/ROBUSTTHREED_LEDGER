// Run on a clean Windows CI checkout after npm ci, tests and the portable frontend build.
import { cp, mkdir, copyFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Package on Windows x64.');
const output=resolve('portable-output/ROBUSTTHREED_PORTABLE');
await mkdir(output,{recursive:true});
for(const name of ['dist','server','lib'])await cp(resolve(name),resolve(output,name),{recursive:true});
await mkdir(resolve(output,'portable'));
for(const name of ['common.mjs','start.mjs','import-mysql.mjs','backup.mjs'])await copyFile(resolve('portable',name),resolve(output,'portable',name));
for(const name of ['START_PORTABLE.cmd','IMPORT_MYSQL.cmd','BACKUP_LEDGER.cmd'])await copyFile(resolve('portable',name),resolve(output,name));
for(const name of ['package.json','package-lock.json'])await copyFile(name,resolve(output,name));
await copyFile('PORTABLE_WINDOWS.md',resolve(output,'READ_ME_FIRST.md'));
await mkdir(resolve(output,'runtime'));
await copyFile(process.execPath,resolve(output,'runtime/node.exe'));
await copyFile(resolve(dirname(process.execPath),'LICENSE'),resolve(output,'runtime/NODE_LICENSE.txt'));
const install=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/c','npm ci --omit=dev --ignore-scripts'],{cwd:output,stdio:'inherit'});
if(install.status!==0)throw new Error('Portable dependency packaging failed.');
// Build only from this allowlist. No owner config, database, MySQL credentials or backups ship.
for(const name of ['data','.env','.env.windows.json']){
 try{await access(resolve(output,name));throw new Error('Private data unexpectedly included: '+name);}catch(e){if(e.code!=='ENOENT')throw e;}
}
console.log('Portable package ready at '+output);
