import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openSqlite } from '../server/sqlite-store.mjs';
import { dataDir,dbPath,ask,reportError } from './common.mjs';
let db;
try{
  console.log('Close the portable ledger first. Choose a backup folder on a DIFFERENT drive.');
  const target=(await ask('Backup destination folder: ')).replace(/^"|"$/g,'');
  if(!target)throw new Error('Destination required.');
  // Opening read/write is necessary for the exclusive lock. The parent data folder must already exist.
  db=openSqlite(dbPath);
  const output=resolve(target,'Robustthreed-backup-'+new Date().toISOString().replace(/[:.]/g,'-'));
  await mkdir(output,{recursive:true});db.backup(resolve(output,'ledger.sqlite'));
  await copyFile(resolve(dataDir,'owner.json'),resolve(output,'owner.json'));
  console.log(`Backup complete: ${output}\nContains your database and password hash. Keep it private.`);
}catch(e){reportError(e);console.log('Backup did not complete. Do not rely on a partial backup folder.');process.exitCode=1;}
finally{if(db)db.close();}
