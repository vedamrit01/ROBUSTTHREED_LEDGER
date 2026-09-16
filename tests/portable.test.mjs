import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, copyFile, symlink, writeFile, cp, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { openSqlite } from '../server/sqlite-store.mjs';
import { hashPassword } from '../server/auth.mjs';
const d=()=>({id:randomUUID(),kind:'payment',title:"Quote ' and ₹",amount:100025,channel:'Amazon',category:'Settlement',status:'settled',date:'2026-01-01',method:'UPI',reference:'',notes:'Portable fixture'});

test('SQLite persistence, single writer, optimistic concurrency, sessions, backup and moved database',async()=>{
 const folder=await mkdtemp(resolve(tmpdir(),'ledger-sqlite-'));let store;
 try{
  const path=resolve(folder,'ledger.sqlite');store=openSqlite(path);const row=d();
  assert.equal((await store.create(row)).amount,row.amount);
  assert.equal((await store.create(row)).id,row.id);assert.equal(await store.create({...row,amount:1}),null);
  assert.throws(()=>openSqlite(path));
  assert.ok(await store.update({...row,amount:40000},1));assert.equal(await store.update(row,1),null);
  assert.equal(await store.remove(row.id,1),false);
  await store.createSession('token','auth',Date.now()+10000);assert.equal(await store.hasSession('token','auth'),true);
  assert.equal(await store.hasSession('token','other'),false);await store.deleteSession('token');assert.equal(await store.hasSession('token','auth'),false);
  const backup=resolve(folder,'backup.sqlite');store.backup(backup);store.close();store=null;
  const moved=resolve(folder,'moved.sqlite');await rename(backup,moved);store=openSqlite(moved);
  const saved=(await store.list(0)).entries[0];assert.equal(saved.amount,40000);assert.equal(saved.version,2);
  assert.ok(await store.remove(row.id,2));
  assert.equal(store.count(),0);
 }finally{store?.close();await rm(folder,{recursive:true,force:true});}
});

test('SQLite imports are atomic, preserve metadata and refuse merging into existing records',async()=>{
 const store=openSqlite(':memory:');
 try{
  const rows=[{...d(),version:4,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-02T00:00:00.000Z'}];
  assert.throws(()=>store.importEntries([...rows,{...rows[0],id:randomUUID(),amount:-1}]));assert.equal(store.count(),0);
  store.importEntries(rows);assert.deepEqual((await store.list(0)).entries,rows);
  assert.throws(()=>store.importEntries(rows));assert.equal(store.count(),1);
 }finally{store.close();}
});

test('Portable HTTP app saves, restarts from a different folder, revokes sessions and hides private files', {timeout:45000},async()=>{
 const temp=await mkdtemp(resolve(tmpdir(),'portable-http-'));let appDir=resolve(temp,'Original folder');let child;
 const password='dummy-portable-test-password';
 async function start(){
  child=spawn(process.execPath,['portable/start.mjs'],{cwd:appDir,env:{...process.env,PORTABLE_NO_BROWSER:'1'},stdio:['pipe','pipe','pipe']});
  let log='';child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);
  for(let n=0;n<150;n++){
   if(child.exitCode!==null)throw new Error(log);
   if(log.includes('ROBUSTTHREED PORTABLE'))return;
   await new Promise(r=>setTimeout(r,100));
  }throw new Error('Portable startup timed out: '+log);
 }
 async function stop(){const exit=once(child,'exit');child.stdin.write('\n');await exit;child=null;}
 const base='http://127.0.0.1:47831';
 async function login(){const res=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});assert.equal(res.status,200);return (await res.json()).token;}
 try{
  await mkdir(appDir,{recursive:true});
  for(const name of ['server','portable','lib'])await cp(resolve(name),resolve(appDir,name),{recursive:true});
  await copyFile('package.json',resolve(appDir,'package.json'));
  await symlink(resolve('node_modules'),resolve(appDir,'node_modules'),'junction');
  await mkdir(resolve(appDir,'dist'));await writeFile(resolve(appDir,'dist/index.html'),'<html>Portable fixture</html>');
  await mkdir(resolve(appDir,'data'));await writeFile(resolve(appDir,'data/owner.json'),JSON.stringify({passwordHash:await hashPassword(password)}));
  await start();assert.equal((await fetch(base+'/api/entries')).status,401);
  for(const path of ['/data/owner.json','/data/ledger.sqlite','/portable/common.mjs'])assert.equal((await fetch(base+path)).status,404);
  const token=await login(),row=d();
  const res=await fetch(base+'/api/entries',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(row)});assert.equal(res.status,201);
  await stop();const moved=resolve(temp,'On another drive folder');await rename(appDir,moved);appDir=moved;
  await start();assert.equal((await fetch(base+'/api/entries',{headers:{Authorization:`Bearer ${token}`}})).status,401);
  const next=await login();const list=await (await fetch(base+'/api/entries',{headers:{Authorization:`Bearer ${next}`}})).json();assert.equal(list.entries[0].id,row.id);assert.equal(list.entries[0].amount,row.amount);
  await stop();
 }finally{if(child){const exit=once(child,'exit');child.kill();await exit;}await rm(temp,{recursive:true,force:true});}
});
