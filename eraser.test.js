import test from 'node:test';
import assert from 'node:assert/strict';
import {blank,planErase,eraseCells,engineFootprint} from './model.js';
import {componentCells} from './components.js';

function fixture(){
  return {...blank(),engine:{x:0,y:0},extenders:[{x:15,y:0},{x:16,y:0}],
    components:[{type:'bed',x:4,y:4,rotation:1},{type:'heater',x:8,y:4,rotation:0},{type:'autodoor',x:10,y:4,rotation:0},
      {type:'oxygen-pump',x:12,y:4,rotation:0},{type:'VGE_AstrofuelPipe',x:12,y:4,rotation:0},{type:'VGE_HiddenAstrofuelPipe',x:12,y:4,rotation:0}],
    hull:['12,4','13,4'],floor:['0,0','4,4','5,4','8,4','10,4','12,4','13,4'],scaffold:['4,7']};
}

test('universal component erase removes full rotated footprints while preserving foundations and settings',()=>{
  const s={...fixture(),scenario:{crew:4},mods:{chapter1:false,chapter2:false}},before=structuredClone(s);
  const p=planErase(s,['5,4','8,4']);assert.deepEqual(p.components,[0,1]);assert.equal(p.count,2);
  assert.deepEqual(new Set(p.cells),new Set(['4,4','5,4','8,4']));assert.deepEqual(s,before,'planning never mutates the design');
  const next=eraseCells(s,['5,4','8,4']);assert.deepEqual(next.components,s.components.slice(2));
  for(const field of ['engine','extenders','floor','hull','scaffold','mods','scenario'])assert.equal(next[field],s[field],field);
  assert.deepEqual(s,before,'applying never mutates the prior state');
});

test('component erase removes all overlapping component types, including disabled pipes, without drilling through the hull',()=>{
  const s=fixture(),p=planErase(s,['12,4']);assert.deepEqual(p.components,[3,4,5]);assert.equal(p.count,3);
  const next=eraseCells(s,['12,4']);assert.equal(next.components.length,3);assert.deepEqual(next.hull,s.hull);assert.deepEqual(next.floor,s.floor);
});

test('Hull / doors targets hull tiles and whole doors, leaving mounted components and substructure',()=>{
  const s=fixture(),p=planErase(s,['10,4','12,4'],'hull');assert.deepEqual(p.components,[2]);assert.deepEqual(p.hull,['12,4']);assert.equal(p.count,2);
  const next=eraseCells(s,['10,4','12,4'],'hull');assert.ok(next.components.some(c=>c.type==='oxygen-pump'));assert.equal(next.components.length,5);
  assert.deepEqual(next.hull,['13,4']);assert.deepEqual(next.floor,s.floor);assert.deepEqual(next.extenders,s.extenders);
});

test('Substructure targets floor and subscaffold without removing supported structures',()=>{
  const s=fixture(),p=planErase(s,['12,4','4,7'],'floor');assert.equal(p.count,2);assert.deepEqual(p.components,[]);
  const next=eraseCells(s,['12,4','4,7'],'floor');assert.deepEqual(next.scaffold,[]);assert.ok(!next.floor.includes('12,4'));
  assert.equal(next.components,s.components);assert.equal(next.hull,s.hull);assert.equal(next.engine,s.engine);
});

test('Everything removes each affected layer and complete components, but only targeted foundation tiles',()=>{
  const s=fixture(),p=planErase(s,['5,4','12,4'],'all');assert.equal(p.count,7);
  const next=eraseCells(s,['5,4','12,4'],'all');assert.deepEqual(next.components.map(c=>c.type),['heater','autodoor']);
  assert.deepEqual(next.hull,['13,4']);assert.ok(next.floor.includes('4,4'));assert.ok(!next.floor.includes('5,4'));assert.ok(!next.floor.includes('12,4'));
});

test('engine removal previews and removes all dependent extenders, including those outside the brush',()=>{
  const s=fixture(),p=planErase(s,['1,1']);assert.equal(p.engine,true);assert.deepEqual(p.extenders,[0,1]);assert.equal(p.count,3);
  for(const k of [...engineFootprint(s),'15,0','16,0'])assert.ok(p.cells.includes(k));
  const next=eraseCells(s,['1,1']);assert.equal(next.engine,null);assert.deepEqual(next.extenders,[]);assert.equal(next.components,s.components);assert.equal(next.floor,s.floor);
  assert.equal(planErase(s,['15,0']).count,1,'an extender alone does not remove the engine or its peers');
});

test('empty or unknown erase targets preserve state identity and previews deduplicate overlapping tiles',()=>{
  const s=fixture();assert.equal(eraseCells(s,[]),s);assert.equal(eraseCells(s,['99,99']),s);assert.equal(eraseCells(s,['0,0'],'unknown'),s);
  const p=planErase(s,['5,4','5,4']);assert.equal(p.count,1);assert.equal(p.cells.length,componentCells(s.components[0]).length);
});
