import test from 'node:test';
import assert from 'node:assert/strict';
import { apiConnection } from '../lib/api-config.ts';
test('Portable production builds use local same-origin API and enable login',()=>{
 assert.deepEqual(apiConnection(true,'',true),{apiOrigin:'',needsApiConfiguration:false});
 assert.deepEqual(apiConnection(true,'https://old-cloud.invalid',true),{apiOrigin:'',needsApiConfiguration:false});
});
test('Cloud setup warning remains for unconfigured production builds; local development still works',()=>{
 assert.deepEqual(apiConnection(true,'',false),{apiOrigin:'',needsApiConfiguration:true});
 assert.deepEqual(apiConnection(true,' https://api.example.com/ ',false),{apiOrigin:'https://api.example.com',needsApiConfiguration:false});
 assert.deepEqual(apiConnection(false,'',false),{apiOrigin:'',needsApiConfiguration:false});
});
