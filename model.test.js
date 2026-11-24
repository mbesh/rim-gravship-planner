import {COMPONENTS} from './components.js';
import {checkPlacement,previewMove,moveItem,itemCells} from './model.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {blank,apply,validate,capacity,inField,shapeCells,footprint,sanitize,inEngineField,inExtenderField,fieldCells} from './model.js';
const engine=()=>apply(blank(),'engine',['0,0']).state;
test('one engine and nine manually placed support tiles',()=>{let s=engine();assert.equal(capacity(s),500);assert.equal(apply(s,'engine',['5,5']).rejected,1);assert.equal(validate(s).missing.length,9);s=apply(s,'floor',footprint(s.engine,3)).state;assert.equal(validate(s).missing.length,0);assert.equal(validate(s).disconnected.length,0);});
test('cardinal connectivity highlights isolated and diagonal floors',()=>{let s=apply(engine(),'floor',['0,0','1,0','2,0','3,1','6,6']).state;assert.deepEqual(validate(s).disconnected,['3,1','6,6']);s=apply(s,'floor',['3,0']).state;assert.deepEqual(validate(s).disconnected,['6,6']);s=apply(s,'floor',['2,0'],true).state;assert.ok(validate(s).disconnected.includes('3,0'));});
test('radius boundaries, extender placement and maximum capacity',()=>{let s=engine();assert.equal(inField(s,{x:18,y:0}),true);assert.equal(inField(s,{x:19,y:0}),false);assert.equal(checkPlacement(s,'extender','20,0').outside,true);const unsupported=apply(s,'extender',['20,0']);assert.equal(unsupported.rejected,0);assert.equal(validate(unsupported.state).invalidExtenders.length,1);assert.equal(capacity(unsupported.state),500);for(const k of ['18,0','-18,0','0,18','0,-18','12,12','-12,-12'])s=apply(s,'extender',[k]).state;assert.equal(capacity(s),2000);assert.equal(inField(s,{x:34,y:0}),true);assert.equal(inField(s,{x:35,y:0}),false);assert.equal(apply(s,'extender',['5,5']).rejected,1);});
test('floor respects capacity; removing extender reveals unsupported planned tiles',()=>{let s=apply(engine(),'floor',shapeCells('disc',{x:0,y:0},{x:18,y:0})).state;assert.equal(s.floor.length,500);assert.equal(validate(s).outside.length,0);s=apply(s,'extender',['18,0']).state;s=apply(s,'floor',['34,0']).state;assert.ok(s.floor.includes('34,0'));s=apply(s,'extender',['18,0'],true).state;assert.deepEqual(validate(s).outside,['34,0']);assert.equal(validate(s).over,1);});
test('hull needs support and cannot overlap machinery',()=>{let s=engine();assert.equal(apply(s,'hull',['0,0']).rejected,1);s=apply(s,'hull',['5,0']).state;assert.ok(validate(s).missing.includes('5,0'));s=apply(s,'floor',['5,0']).state;assert.ok(!validate(s).missing.includes('5,0'));s=apply(s,'floor',['5,0'],true).state;assert.ok(validate(s).missing.includes('5,0'));});
test('drawing tools have correct inclusive geometry',()=>{assert.equal(shapeCells('line',{x:0,y:0},{x:4,y:2}).length,5);assert.ok(shapeCells('line',{x:0,y:0},{x:4,y:2}).every(k=>k.endsWith(',0')));assert.deepEqual(shapeCells('diagonal',{x:0,y:0},{x:2,y:2}),['0,0','1,1','2,2']);assert.equal(shapeCells('rect',{x:2,y:2},{x:0,y:0}).length,8);assert.equal(shapeCells('filled',{x:2,y:2},{x:0,y:0}).length,9);assert.equal(shapeCells('disc',{x:0,y:0},{x:2,y:0}).length,25);assert.ok(!shapeCells('circle',{x:0,y:0},{x:2,y:0}).includes('0,0'));});
test('engine erase retains floor and removes its extenders',()=>{let s=apply(engine(),'extender',['5,0']).state;s=apply(s,'floor',['0,0']).state;s=apply(s,'engine',['1,1'],true).state;assert.equal(s.engine,null);assert.equal(s.extenders.length,0);assert.equal(s.floor.length,1);assert.equal(validate(s).disconnected.length,1);});
test('saved design round trip',()=>{const s=apply(engine(),'floor',['0,0','1,0']).state;assert.deepEqual(sanitize(JSON.parse(JSON.stringify(s))),s);assert.throws(()=>sanitize(null));});

test('engine field matches every row of the supplied 37 by 37 screenshot',()=>{
  const widths=[11,17,21,23,25,27,29,31,33,33,35,35,35,37,37,37,37,37,37,37,37,37,37,37,35,35,35,33,33,31,29,27,25,23,21,17,11];
  const s=engine(),cells=fieldCells(s);
  assert.equal(cells.size,widths.reduce((a,b)=>a+b,0));
  for(let y=-20;y<=20;y++)for(let x=-20;x<=20;x++){
    const expected=Math.abs(y)<=18&&Math.abs(x)<=(widths[y+18]-1)/2;
    assert.equal(inEngineField(s.engine,{x,y}),expected,`engine: ${x},${y}`);
    assert.equal(inField(s,{x,y}),expected,`placement: ${x},${y}`);
    assert.equal(cells.has(`${x},${y}`),expected,`overlay: ${x},${y}`);
  }
});
test('engine mask translates and marks invalid extender positions at stepped edges',()=>{
  const s=apply(blank(),'engine',['7,-9']).state;
  assert.equal(inEngineField(s.engine,{x:12,y:9}),true);
  assert.equal(inEngineField(s.engine,{x:13,y:9}),false);
  assert.equal(apply(s,'extender',['12,9']).rejected,0);
  const unsupported=apply(s,'extender',['13,9']);assert.equal(unsupported.rejected,0);assert.equal(validate(unsupported.state).invalidExtenders.length,1);assert.ok(validate(unsupported.state).outsideTiles.includes('13,9'));
  const old={...s,extenders:[{x:26,y:-9}]};
  assert.equal(validate(old).invalidExtenders.length,1);
  assert.equal(capacity(old),500);
  assert.equal(inField(old,{x:40,y:-9}),false);
});
test('overlay matches placement with extender fields',()=>{
  const s=apply(engine(),'extender',['18,0']).state,cells=fieldCells(s);
  for(let y=-36;y<=36;y++)for(let x=-36;x<=36;x++)assert.equal(cells.has(`${x},${y}`),inField(s,{x,y}));
});

test('extender field matches every row of the supplied 33 by 33 screenshot',()=>{
  const widths=[11,15,19,21,23,25,27,29,29,31,31,33,33,33,33,33,33,33,33,33,33,33,31,31,29,29,27,25,23,21,19,15,11];
  const center={x:7,y:-9};
  for(let y=-18;y<=18;y++)for(let x=-18;x<=18;x++){
    const expected=Math.abs(y)<=16&&Math.abs(x)<=(widths[y+16]-1)/2;
    assert.equal(inExtenderField(center,{x:center.x+x,y:center.y+y}),expected,`extender: ${x},${y}`);
  }
});
test('extender stepped edge warns for floor and hull and survives saved-design validation',()=>{
  const s=apply(engine(),'extender',['18,0']).state;
  // The old analytic radius admitted both of these cells.
  for(const layer of ['floor','hull']){
    assert.equal(apply(s,layer,['34,5']).rejected,0);
    for(const k of ['34,6','35,0']){const placed=apply(s,layer,[k]);assert.equal(placed.rejected,0);assert.equal(checkPlacement(s,layer,k).outside,true);assert.ok(validate(placed.state).outsideTiles.includes(k));}
  }
  const loaded={...s,floor:['34,5','34,6','35,0']};
  assert.deepEqual(validate(loaded).outside,['34,6','35,0']);
});

test('filled circle and outline match engine and extender field tile boundaries',()=>{
  for(const [extent,contains] of [[18,inEngineField],[16,inExtenderField]]){
    const center={x:7,y:-9};
    for(const edge of [{x:center.x+extent,y:center.y},{x:center.x,y:center.y-extent}]){
      const filled=new Set(shapeCells('disc',center,edge)),outline=new Set(shapeCells('circle',center,edge));
      for(let y=center.y-extent-1;y<=center.y+extent+1;y++)for(let x=center.x-extent-1;x<=center.x+extent+1;x++){
        const inside=contains(center,{x,y});
        const boundary=inside&&[{x:x-1,y},{x:x+1,y},{x,y:y-1},{x,y:y+1}].some(p=>!contains(center,p));
        assert.equal(filled.has(`${x},${y}`),inside,`filled ${extent}: ${x},${y}`);
        assert.equal(outline.has(`${x},${y}`),boundary,`outline ${extent}: ${x},${y}`);
      }
    }
  }
});
test('engine-sized circle applies without field clipping and erases the same tiles',()=>{
  const s=engine(),edge={x:18,y:0},outline=shapeCells('circle',s.engine,edge);
  const placed=apply(s,'floor',outline);
  assert.equal(placed.rejected,0);
  assert.equal(placed.state.floor.length,outline.length);
  assert.equal(apply(placed.state,'floor',outline,true).state.floor.length,0);
});
test('circle handles a click, small radii and diagonal drags',()=>{
  for(const type of ['circle','disc'])assert.deepEqual(shapeCells(type,{x:2,y:3},{x:2,y:3}),['2,3']);
  for(let radius=1;radius<=5;radius++){
    const disc=new Set(shapeCells('disc',{x:0,y:0},{x:radius,y:0}));
    assert.ok(disc.has(`${radius},0`));
    assert.ok(!disc.has(`${radius+1},0`));
    assert.ok(shapeCells('circle',{x:0,y:0},{x:radius,y:0}).every(k=>disc.has(k)));
  }
  assert.deepEqual(shapeCells('disc',{x:0,y:0},{x:3,y:4}),shapeCells('disc',{x:0,y:0},{x:5,y:0}));
});


test('placement and movement previews are read-only and never clone the design',()=>{
  let s=engine();s=apply(s,'hull',['5,5','8,5']).state;s=apply(s,'oxygen-pump',['5,5'],false,2).state;
  const snapshot=structuredClone(s),clone=globalThis.structuredClone;
  const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freeze(v);}};freeze(s);
  globalThis.structuredClone=()=>{throw new Error('preview cloned the ship');};
  try{
    assert.equal(checkPlacement(s,'oxygen-pump','8,5',2).rejected,0);
    assert.equal(checkPlacement(s,'oxygen-pump','9,5',2).rejected,1);
    const item={kind:'component',index:0},preview=previewMove(s,item,{x:8,y:5});
    assert.equal(preview.rejected,0);assert.deepEqual(preview.cells,['8,5']);assert.equal(preview.position.rotation,2);
    assert.equal(previewMove(s,item,{x:9,y:5}).rejected,1);
    assert.deepEqual(s,snapshot);
  }finally{globalThis.structuredClone=clone;}
});

test('read-only placement feedback agrees with actual edits across components and rotations',()=>{
  let s=apply(engine(),'extender',['18,0']).state;
  s=apply(s,'hull',['5,5','8,5','8,6']).state;s=apply(s,'oxygen-pump',['5,5'],false,2).state;
  s=apply(s,'small-tank',['10,0']).state;
  const original=structuredClone(s);
  for(const layer of ['engine','extender','floor','hull',...COMPONENTS.map(c=>c.id)])for(let rotation=0;rotation<4;rotation++)for(const k of ['0,0','5,5','5,4','8,5','8,6','10,0','15,5','18,0','30,0','35,0']){
    const preview=checkPlacement(s,layer,k,rotation),edit=apply(s,layer,[k],false,rotation);
    assert.equal(preview.rejected,edit.rejected,layer+' '+k);assert.equal(preview.message,edit.message,layer+' '+k);
  }
  assert.deepEqual(s,original);
});

test('movement previews exclude the source, preserve limits, and predict committed footprints',()=>{
  let s=engine();for(const k of ['5,5','8,5','11,5','14,5'])s=apply(s,'small-thruster',[k]).state;
  s=apply(s,'floor',['5,5','6,5']).state;s=apply(s,'hull',['5,5','6,5']).state;
  s=apply(s,'extender',['18,0']).state;
  const original=structuredClone(s);
  for(const item of [{kind:'component',index:0},{kind:'engine'},{kind:'extender',index:0},{kind:'floor',key:'5,5'},{kind:'hull',key:'5,5'}])for(const target of [{x:5,y:5},{x:6,y:5},{x:8,y:8},{x:0,y:0},{x:18,y:0},{x:35,y:0},{x:200,y:0}]){
    const preview=previewMove(s,item,target),edit=moveItem(s,item,target);
    assert.equal(preview.rejected,edit.rejected,JSON.stringify({item,target}));assert.equal(preview.message,edit.message);
    if(!preview.rejected)assert.deepEqual(preview.cells,itemCells(edit.state,edit.item));
  }
  assert.equal(previewMove(s,{kind:'component',index:0},{x:5,y:8}).rejected,0,'moving at maximum count is allowed');
  assert.deepEqual(s,original);
});


test('outside-field planning warns without rejecting and becomes supported after adding a valid extender',()=>{
  let s=engine();s=apply(s,'floor',['25,0']).state;s=apply(s,'hull',['25,0']).state;
  s=apply(s,'heater',['25,2']).state;s=apply(s,'extender',['26,4']).state;
  for(const layer of ['floor','hull','heater','extender'])assert.equal(checkPlacement(engine(),layer,'25,0').outside,true,layer);
  let issues=validate(s);assert.ok(issues.outsideTiles.includes('25,0'));assert.ok(issues.outsideTiles.includes('25,2'));assert.ok(issues.outsideTiles.includes('26,4'));
  assert.equal(issues.invalidExtenders.length,1);assert.equal(capacity(s),500);assert.equal(inField(s,{x:40,y:4}),false,'invalid extenders cannot add a field');
  const restored=sanitize(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored,s);assert.deepEqual(validate(restored).outsideTiles,issues.outsideTiles);
  s=apply(s,'extender',['18,0']).state;issues=validate(s);
  assert.ok(!issues.outsideTiles.includes('25,0'));assert.ok(!issues.outsideTiles.includes('25,2'));
  assert.ok(issues.outsideTiles.includes('26,4'),'an extender in another extender field remains invalid');assert.equal(capacity(s),750);
});

test('outside-field movement remains undoable by callers and preserves collision, mount, capacity, and save-grid rules',()=>{
  let s=apply(engine(),'heater',['5,5']).state;
  const item={kind:'component',index:0},preview=previewMove(s,item,{x:30,y:0});assert.equal(preview.rejected,0);assert.equal(preview.outside,true);
  const moved=moveItem(s,item,{x:30,y:0});assert.equal(moved.rejected,0);assert.equal(validate(moved.state).outsideComponents.length,1);assert.equal(s.components[0].x,5);
  assert.equal(apply(moved.state,'small-tank',['30,0']).rejected,1,'overlap is still rejected');
  assert.equal(apply(engine(),'oxygen-pump',['30,0']).rejected,1,'pumps still need hull');
  const full=apply(engine(),'floor',shapeCells('disc',{x:0,y:0},{x:18,y:0})).state;
  assert.equal(full.floor.length,500);assert.equal(apply(full,'floor',['30,0']).rejected,1,'capacity remains enforced');
  for(const layer of ['floor','hull','heater','extender'])assert.equal(apply(engine(),layer,['111,0']).rejected,1,'save-grid bounds remain enforced');
  assert.equal(apply(engine(),'pilot-console',['109,0']).rejected,1,'the full footprint must survive save/load');
});


test('missing-substructure placement is allowed, flagged, and clears tile by tile as support is added',()=>{
  assert.equal(checkPlacement(blank(),'engine','0,0').missingSupport,true);
  for(const type of ['hull','extender','heater']){
    const empty=engine(),preview=checkPlacement(empty,type,'5,5');assert.equal(preview.rejected,0);assert.equal(preview.missingSupport,true);
    const placed=apply(empty,type,['5,5']);assert.equal(placed.rejected,0);assert.ok(validate(placed.state).unsupportedTiles.includes('5,5'));
    const supported=apply(placed.state,'floor',['5,5']).state;
    assert.ok(!validate(supported).missing.includes('5,5'));assert.ok(!validate(supported).unsupportedTiles.includes('5,5'));
  }
  let s=apply(engine(),'pilot-console',['4,4']).state;
  s=apply(s,'floor',['4,4','5,4','6,4','4,5','5,5']).state;
  assert.ok(validate(s).missing.includes('6,5'));assert.ok(validate(s).unsupportedTiles.includes('6,5'));
  s=apply(s,'floor',['6,5']).state;assert.ok(!validate(s).unsupportedTiles.includes('6,5'));
});

test('moving away from supporting floor is allowed and warns without altering the floor',()=>{
  let s=apply(engine(),'heater',['5,5']).state;s=apply(s,'floor',['5,5']).state;
  const item={kind:'component',index:0},preview=previewMove(s,item,{x:6,y:5});assert.equal(preview.rejected,0);assert.equal(preview.missingSupport,true);
  const moved=moveItem(s,item,{x:6,y:5});assert.equal(moved.rejected,0);assert.deepEqual(moved.state.floor,s.floor);assert.ok(validate(moved.state).unsupportedTiles.includes('6,5'));
});
