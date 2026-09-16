// Verify the assembled release with its bundled node.exe, using disposable data outside the release.
import { mkdtemp,cp,mkdir,writeFile,rm,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { hashPassword } from '../server/auth.mjs';
import { chromium } from 'playwright';
const temp=await mkdtemp(resolve(tmpdir(),'portable-package-'));let child,browser;
try{
 const root=resolve(temp,'USB folder');await cp('portable-output/ROBUSTTHREED_PORTABLE',root,{recursive:true});
 await mkdir(resolve(root,'data'));await writeFile(resolve(root,'data/owner.json'),JSON.stringify({passwordHash:await hashPassword('release-smoke-fixture-only')}));
 child=spawn(resolve(root,'runtime/node.exe'),['portable/start.mjs'],{cwd:root,env:{...process.env,PORTABLE_NO_BROWSER:'1'},stdio:['pipe','pipe','pipe']});
 let log='';child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);
 for(let i=0;i<150&&!log.includes('ROBUSTTHREED PORTABLE');i++){if(child.exitCode!==null)throw new Error(log);await new Promise(r=>setTimeout(r,100));}
 assert.ok(log.includes('ROBUSTTHREED PORTABLE'),log);
 const base='http://127.0.0.1:47831';
 assert.deepEqual(await (await fetch(base+'/api/health')).json(),{ok:true});
 const html=await (await fetch(base)).text();assert.ok(html.includes('<html'));
 const asset=html.match(/src="([^"]+\.js)"/)[1];assert.equal((await fetch(base+asset)).status,200);
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'release-smoke-fixture-only'})});assert.equal(login.status,200);
 const token=(await login.json()).token;assert.equal((await fetch(base+'/api/entries',{headers:{Authorization:`Bearer ${token}`}})).status,200);
 browser=await chromium.launch();
 const page=await browser.newPage();
 await page.goto(base);
 await page.getByLabel('Owner password',{exact:true}).waitFor({state:'visible',timeout:15000});
 assert.equal(await page.getByText('Your interface is ready.',{exact:false}).count(),0);
 await page.getByLabel('Owner password',{exact:true}).fill('release-smoke-fixture-only');
 const entriesResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/entries'&&response.status()===200);
 await page.getByRole('button',{name:'Open my ledger',exact:true}).click();
 await entriesResponse;
 await page.getByRole('button',{name:'Open my ledger',exact:true}).waitFor({state:'hidden'});
 await browser.close();browser=null;
 console.log('Built interface displays the password form and completes browser login against the portable API.');
 const exit=once(child,'exit');child.stdin.write('\n');const [code]=await exit;child=null;assert.equal(code,0);
 console.log('Packaged Windows runtime, frontend assets, SQLite, login and clean shutdown passed.');
}finally{if(browser)await browser.close();if(child){const exit=once(child,'exit');child.kill();await exit;}await rm(temp,{recursive:true,force:true});}
