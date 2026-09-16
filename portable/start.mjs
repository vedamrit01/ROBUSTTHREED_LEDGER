import express from 'express';
import { access, mkdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createApp } from '../server/app.mjs';
import { openSqlite } from '../server/sqlite-store.mjs';
import { root,dataDir,dbPath,ensureData,ownerConfig,reportError } from './common.mjs';
let store,server,closing=false;
const url='http://127.0.0.1:47831';
async function startupBackup(){
  const backups=resolve(dataDir,'backups');await mkdir(backups,{recursive:true});
  const temp=resolve(backups,'before-start.tmp.sqlite');await rm(temp,{force:true});
  store.backup(temp);await rename(temp,resolve(backups,'before-start.sqlite'));
}
async function stop(){
  if(closing)return;closing=true;
  if(server){await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
  if(store){store.clearSessions();store.close();store=null;}
  process.stdin.pause();console.log('\nLedger closed. You can now safely eject the pendrive.');
}
try{
  await access(resolve(root,'dist/index.html'));
  await ensureData();store=openSqlite(dbPath);
  const owner=await ownerConfig();
  store.clearSessions();await startupBackup();
  const config={passwordHash:owner.passwordHash,origins:[url,'http://localhost:47831'],trustProxyHops:0};
  const app=express();
  app.use((req,res,next)=>{
    if(!['127.0.0.1:47831','localhost:47831'].includes(req.get('host')))return res.sendStatus(403);
    next();
  });
  app.use(express.static(resolve(root,'dist'),{dotfiles:'deny',index:'index.html'}));
  app.use(createApp({store,config}));
  await new Promise((resolve,reject)=>{server=app.listen(47831,'127.0.0.1',resolve);server.once('error',reject);});
  console.log(`\nROBUSTTHREED PORTABLE\nRecords: ${store.count()} | Data folder: ${dataDir}\nOpen ${url}\nKeep this window open while using the ledger.\nPress ENTER here to close safely BEFORE ejecting the drive.`);
  process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
  process.stdin.resume();process.stdin.once('data',()=>void stop());
  if(process.platform==='win32'&&!process.env.PORTABLE_NO_BROWSER){
    const child=spawn(process.env.ComSpec||'cmd.exe',['/d','/c','start','',url],{stdio:'ignore'});
    child.on('error',()=>console.log(`Open ${url} manually.`));
  }
}catch(e){reportError(e);await stop();process.exitCode=1;}
