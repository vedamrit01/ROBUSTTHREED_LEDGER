import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';
import { openSqlite } from '../server/sqlite-store.mjs';
import { dbPath,ensureData,ask,reportError } from './common.mjs';
let db,connection;
try{
  console.log('ONE-TIME MYSQL IMPORT\nRun on your original Windows PC with MySQL running. Close both ledger apps first.\nThe portable ledger must be empty. MySQL records will not be changed.');
  const folder=(await ask('Original ledger project folder (containing .env.windows.json): ')).replace(/^"|"$/g,'');
  const cfg=JSON.parse(await readFile(resolve(folder,'.env.windows.json'),'utf8'));
  if(cfg.version!==1||!Number.isInteger(cfg.port)||cfg.port<1||cfg.port>65535||typeof cfg.user!=='string'||typeof cfg.password!=='string')throw new Error('Invalid original settings.');
  await ensureData();db=openSqlite(dbPath);
  if(db.count()){console.log('Import stopped: the portable ledger already contains records. Nothing was changed.');process.exitCode=1;}
  else{
    connection=await mysql.createConnection({host:'127.0.0.1',port:cfg.port,user:cfg.user,password:cfg.password,database:'robustthreed_ledger',dateStrings:true,supportBigNumbers:true,bigNumberStrings:true,connectTimeout:10000});
    await connection.query('START TRANSACTION READ ONLY');
    const [rows]=await connection.query('SELECT id,kind,title,amount,channel,category,status,date,method,reference,notes,version,created_at AS createdAt,updated_at AS updatedAt FROM ledger_entries ORDER BY id');
    const entries=rows.map(row=>({...row,amount:Number(row.amount),version:Number(row.version)}));
    const totals=entries.reduce((v,r)=>{v[r.kind]=(v[r.kind]||0n)+BigInt(r.amount);return v;},{});
    console.log(`Found ${entries.length} records. Payments: ${totals.payment||0n} paise; expenses: ${totals.expense||0n} paise.`);
    if((await ask('Type IMPORT to copy these records to the pendrive: '))==='IMPORT'){
      db.importEntries(entries);
      if(db.count()!==entries.length)throw new Error('Import verification failed.');
      console.log(`Imported and verified ${entries.length} records. MySQL is unchanged. Start the portable ledger to set its password.`);
    }else console.log('Import cancelled. Nothing copied.');
    await connection.rollback();
  }
}catch(e){reportError(e);console.log('If validation failed, no partial import was kept. Keep your original MySQL backup.');process.exitCode=1;}
finally{if(connection)await connection.end();if(db)db.close();}
