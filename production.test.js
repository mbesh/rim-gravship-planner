import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PRODUCTION} from './production.js';
import {componentDefinition,componentBounds,componentCells,componentSprite,availableComponents} from './components.js';
import {blank,apply,validate,sanitize,moveItem,rotateItem,hitItem} from './model.js';

const ship=()=>apply(blank(),'engine',['0,0']).state;

test('production covers the base-game list, supporting facilities, and DLC production machinery',()=>{
  const base=['art-bench','brewery','butcher-spot','butcher-table','campfire','crafting-spot','fermenting-barrel','fueled-stove','simple-research-bench','hand-tailor-bench','fueled-smithy','stonecutters-table','fabrication-bench','deep-drill','drug-lab','electric-crematorium','electric-smelter','electric-smithy','electric-stove','electric-tailor-bench','hi-tech-research-bench','hydroponics-basin','machining-table','biofuel-refinery','nutrient-paste-dispenser','hopper','tool-cabinet','multi-analyzer'];
  assert.deepEqual(PRODUCTION.filter(c=>!c.requiresDlc).map(c=>c.id),base);
  assert.equal(PRODUCTION.filter(c=>c.requiresDlc==='Biotech').length,10);
  assert.equal(PRODUCTION.filter(c=>c.requiresDlc==='Anomaly').length,3);
  assert.equal(new Set(PRODUCTION.map(c=>c.id)).size,41);
  for(const [id,w,h] of [['art-bench',3,1],['fabrication-bench',5,2],['simple-research-bench',3,2],['hi-tech-research-bench',5,2],['hydroponics-basin',1,4],['nutrient-paste-dispenser',3,4],['gene-assembler',3,2],['growth-vat',1,2],['large-mech-gestator',4,3],['subcore-softscanner',3,2],['bioferrite-harvester',1,2]]){
    const c=componentDefinition(id);assert.deepEqual([c.width,c.height],[w,h],id);
  }
  for(const mods of [{},{chapter1:true},{chapter2:true}]){
    const visible=availableComponents({...blank(),mods});
    assert.equal(visible.filter(c=>c.group==='Production').length,41,'official DLC planning is independent of mod chapters');
  }
});

test('production artwork has wiki provenance, valid images and matching hashes for every facing',()=>{
  const manifest=JSON.parse(readFileSync('assets/production/sources.json','utf8'));
  const sources=new Map(manifest.images.map(i=>['production/'+i.file,i]));
  for(const c of PRODUCTION)for(let rotation=0;rotation<4;rotation++){
    const sprite=componentSprite({type:c.id,rotation}),source=sources.get(sprite.file);assert.ok(source,sprite.file);
    assert.ok(source.page.startsWith('https://rimworldwiki.com/wiki/'));assert.ok(source.image.startsWith('https://rimworldwiki.com/images/'));
    const raw=readFileSync('assets/'+sprite.file);assert.equal(createHash('sha256').update(raw).digest('hex'),source.sha256);
    assert.ok(raw.subarray(0,8).toString('hex')==='89504e470d0a1a0a'||raw.subarray(0,2).toString('hex')==='ffd8',sprite.file);
    assert.ok(sprite.turn>=0&&sprite.turn<4);
  }
});

test('north/east-only production artwork uses its actual facing and rotates within the correct footprint',()=>{
  for(const [type,rotation] of [['gene-bank',2],['bioferrite-shaper',2],['serum-lab',2],['bioferrite-harvester',3],['hydroponics-basin',2]]){
    assert.equal(componentDefinition(type).defaultRotation,rotation);
    assert.equal(componentSprite({type,rotation}).turn,0,'initial placement uses original artwork orientation');
  }
  assert.equal(componentSprite({type:'gene-bank',rotation:0}).turn,2);
  assert.equal(componentSprite({type:'bioferrite-harvester',rotation:0}).turn,1);
  assert.equal(componentSprite({type:'hydroponics-basin',rotation:3}).turn,0);
  for(let rotation=0;rotation<4;rotation++){
    const b=componentBounds({type:'hydroponics-basin',x:0,y:0,rotation});assert.deepEqual([b.width,b.height],rotation%2?[4,1]:[1,4]);
  }
});

test('all production components occupy complete footprints, report missing support, move, persist, and erase',()=>{
  for(const d of PRODUCTION)for(let rotation=0;rotation<(d.rotate?4:1);rotation++){
    let s=apply(ship(),d.id,['5,5'],false,rotation).state;assert.equal(s.components.length,1,d.id);
    let c=s.components[0],cells=componentCells(c);assert.equal(cells.length,d.width*d.height);
    assert.equal(apply(s,'heater',[cells.at(-1)]).rejected,1,'the last footprint tile blocks overlap');
    assert.ok(cells.every(k=>validate(s).missing.includes(k)));
    s=apply(s,'floor',cells).state;assert.equal(validate(s).missing.filter(k=>cells.includes(k)).length,0);
    const [x,y]=cells.at(-1).split(',').map(Number),hit=hitItem(s,{x:x+.5,y:y+.5});assert.deepEqual(hit,{kind:'component',index:0});
    const moved=moveItem(s,hit,{x:12,y:8});assert.equal(moved.rejected,0,d.id);assert.deepEqual(moved.state.floor,s.floor);
    s=sanitize(JSON.parse(JSON.stringify(moved.state)));c=s.components[0];assert.equal(c.type,d.id);assert.equal(c.rotation,d.rotate?rotation:0);
    const erased=apply(s,d.id,[componentCells(c).at(-1)],true);assert.equal(erased.state.components.length,0);assert.deepEqual(erased.state.floor,cells);
  }
});

test('production rotations respect collisions and do not impose facility link limits as ship-wide caps',()=>{
  let s=apply(ship(),'fabrication-bench',['5,5']).state;
  const rotated=rotateItem(s,{kind:'component',index:0},1);assert.equal(rotated.rejected,0);assert.equal(rotated.state.components[0].rotation,1);
  const blocked=componentCells(rotated.state.components[0]).find(k=>!componentCells(s.components[0]).includes(k));
  s=apply(s,'heater',[blocked]).state;assert.equal(rotateItem(s,{kind:'component',index:0},1).rejected,1);
  for(const type of ['multi-analyzer','tool-cabinet','gene-processor','bioferrite-harvester']){
    let next=ship();for(const k of ['5,5','10,5','15,5']){const r=apply(next,type,[k]);assert.equal(r.rejected,0);next=r.state;}
    assert.equal(next.components.length,3,type);
  }
});
