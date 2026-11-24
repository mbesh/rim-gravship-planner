import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {APP_VERSION} from './version.js';

test('browser release version matches package.json and generated module is current',()=>{
  const pkg=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8'));
  assert.equal(APP_VERSION,pkg.version);
  const result=spawnSync(process.execPath,['tools/sync-version.mjs','--check'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});

test('version generator detects a stale release and synchronizes a future bump',()=>{
  const root=mkdtempSync(join(tmpdir(),'gravship-version-'));
  try{
    mkdirSync(join(root,'tools'));
    copyFileSync(new URL('./tools/sync-version.mjs',import.meta.url),join(root,'tools/sync-version.mjs'));
    writeFileSync(join(root,'package.json'),JSON.stringify({version:'1.1.0'}));
    const run=(...args)=>spawnSync(process.execPath,[join(root,'tools/sync-version.mjs'),...args],{encoding:'utf8'});
    assert.notEqual(run('--check').status,0,'missing generated version must fail validation');
    const generated=run();assert.equal(generated.status,0,generated.stderr);
    const before=readFileSync(join(root,'version.js'),'utf8');assert.match(before,/APP_VERSION = '1\.1\.0'/);
    writeFileSync(join(root,'version.js'),before.replace(/\n/g,'\r\n'));
    assert.equal(run('--check').status,0,'Windows checkout line endings remain valid');
    writeFileSync(join(root,'version.js'),before);
    writeFileSync(join(root,'package.json'),JSON.stringify({version:'1.1.1'}));
    const stale=run('--check');assert.notEqual(stale.status,0);assert.match(stale.stderr,/version.js is stale/);
    assert.equal(readFileSync(join(root,'version.js'),'utf8'),before,'check must not modify a stale file');
    const updated=run();assert.equal(updated.status,0,updated.stderr);
    assert.match(readFileSync(join(root,'version.js'),'utf8'),/APP_VERSION = '1\.1\.1'/);
    assert.equal(run('--check').status,0);
  }finally{
    assert.equal(dirname(root),resolve(tmpdir()),'cleanup stays in the temporary directory');
    rmSync(root,{recursive:true,force:true});
  }
});
