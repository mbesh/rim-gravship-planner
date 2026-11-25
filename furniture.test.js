import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FURNITURE} from './furniture.js';
import {componentDefinition,componentCells,componentBounds} from './components.js';
import {blank,apply,sanitize,validate,moveItem,rotateItem,hitItem} from './model.js';

const ship=()=>apply(blank(),'engine',['0,0']).state;

test('furniture covers base-game and official DLC items with verified representative footprints',()=>{
  assert.equal(FURNITURE.length,57);assert.equal(FURNITURE.filter(c=>c.requiresDlc).length,21);
  assert.equal(new Set(FURNITURE.map(c=>c.id)).size,57);
  for(const [id,w,h] of [['bed',1,2],['double-bed',2,2],['hospital-bed',1,2],['table-1x2',1,2],['table-2x4',2,4],['table-3x3',3,3],['shelf',2,1],['couch',2,1],['grand-sculpture',2,2],['grand-meditation-throne',3,2],['crib',1,1],['school-desk',2,1],['blackboard',2,1],['terror-sculpture',1,1],['kid-outfit-stand',1,1]]){
    const c=componentDefinition(id);assert.deepEqual([c.width,c.height],[w,h],id);assert.equal(c.group,'Furniture');
  }
  assert.equal(componentDefinition('darklight-brazier').requiresDlc,'Royalty + Ideology');
  assert.equal(componentDefinition('kid-outfit-stand').requiresDlc,'Odyssey + Biotech');
});

test('all furniture artwork has original wiki provenance and matching hashes',()=>{
  const manifest=JSON.parse(readFileSync('assets/furniture/sources.json','utf8'));
  const sources=new Map(manifest.images.map(i=>['furniture/'+i.file,i]));
  for(const file of new Set(FURNITURE.flatMap(c=>Object.values(c.sprites)))){
    const source=sources.get(file);assert.ok(source,file);assert.ok(source.page.startsWith('https://rimworldwiki.com/wiki/'));
    const png=readFileSync('assets/'+file);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',file);
    assert.equal(createHash('sha256').update(png).digest('hex'),source.sha256,file);
  }
});

test('asymmetric furniture occupies rotated cells, blocks overlap, moves, saves and erases by the full footprint',()=>{
  for(const [id,w,h] of [['bed',2,1],['table-2x4',4,2],['grand-meditation-throne',2,3]]){
    let s=apply(ship(),id,['5,5'],false,1).state;let c=s.components[0];
    assert.deepEqual([componentBounds(c).width,componentBounds(c).height],[w,h]);
    const cells=componentCells(c);assert.equal(cells.length,w*h);
    assert.equal(apply(s,'heater',[cells.at(-1)]).rejected,1);
    s=apply(s,'floor',cells).state;
    const hit=hitItem(s,{x:5+w-.5,y:5+h-.5});assert.deepEqual(hit,{kind:'component',index:0});
    const moved=moveItem(s,hit,{x:12,y:8});assert.equal(moved.rejected,0);assert.deepEqual(moved.state.floor,s.floor);
    s=sanitize(JSON.parse(JSON.stringify(moved.state)));c=s.components[0];assert.equal(c.rotation,1);
    const erased=apply(s,id,[componentCells(c).at(-1)],true);assert.equal(erased.state.components.length,0);assert.deepEqual(erased.state.floor,cells);
  }
});

test('wall lights require hull, rotate without pump outlet rules and report removal of their mounts',()=>{
  for(const type of ['wall-lamp','wall-torch-lamp']){
    assert.equal(apply(ship(),type,['5,5']).rejected,1);
    let s=apply(ship(),'hull',['5,5','5,6']).state;s=apply(s,type,['5,5']).state;
    assert.equal(s.components.length,1);assert.ok(s.hull.includes('5,5'));assert.equal(validate(s).missingWall.length,0);
    for(let i=0;i<4;i++){const r=rotateItem(s,{kind:'component',index:0},1);assert.equal(r.rejected,0);s=r.state;}
    assert.equal(moveItem(s,{kind:'component',index:0},{x:8,y:8}).rejected,1);
    s=apply(s,'hull',['5,5'],true).state;assert.equal(validate(s).missingWall.length,1);
    s=apply(s,'hull',['5,5']).state;assert.equal(validate(s).missingWall.length,0);
  }
});
