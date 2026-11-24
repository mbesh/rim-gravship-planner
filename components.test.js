import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {COMPONENTS as ALL_COMPONENTS,componentDefinition,componentBounds,componentCells,componentSprite,componentVisual,barrierJoins,exhaustCells,pumpMount} from './components.js';
const COMPONENTS=ALL_COMPONENTS.filter(c=>!c.chapter);
import {blank,apply,validate,sanitize,hitItem,itemPosition,moveItem,rotateItem} from './model.js';
const engine=()=>apply(blank(),'engine',['0,0']).state;
test('component catalogue has wiki footprints and maximum counts',()=>{
  const expected={'autodoor':[1,1,undefined],'small-tank':[2,2,undefined],'large-tank':[3,3,undefined],'small-thruster':[1,2,4],'large-thruster':[2,2,6],'pilot-console':[3,2,undefined],'signal-jammer':[2,2,undefined],'power-cell':[1,1,undefined],'fuel-optimizer':[2,2,2],'shield-generator':[3,3,2],'subpersona-core':[1,1,2],'oxygen-pump':[1,1,undefined],'vac-barrier':[1,1,undefined],'heater':[1,1,undefined],'solar-generator':[4,4,undefined],'wood-fired-generator':[2,2,undefined],'chemfuel-generator':[2,2,undefined],'wind-turbine':[7,2,undefined],'geothermal-generator':[6,6,undefined],'watermill-generator':[5,6,undefined],'vanometric-power-cell':[1,2,undefined]};
  assert.equal(COMPONENTS.length,21);
  for(const c of COMPONENTS)assert.deepEqual([c.width,c.height,c.limit],expected[c.id],c.id);
});
test('all catalogue sprites exist and downloaded images are actual PNGs',()=>{
  for(const c of COMPONENTS)for(let rotation=0;rotation<4;rotation++){
    const sprite=componentSprite({type:c.id,rotation});
    assert.ok(existsSync(`assets/${sprite.file}`),sprite.file);
    if(sprite.file.endsWith('.png'))assert.equal(readFileSync(`assets/${sprite.file}`).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  }
});
test('directional sprites use north/south/east art and mirrored east for west',()=>{
  for(const type of ['small-tank','large-tank','small-thruster','large-thruster','pilot-console']){
    assert.ok(componentSprite({type,rotation:0}).file.endsWith('_south.png'));
    assert.ok(componentSprite({type,rotation:2}).file.endsWith('_north.png'));
    assert.ok(componentSprite({type,rotation:3}).file.endsWith('_east.png'));
    assert.equal(componentSprite({type,rotation:1}).flip,true);
  }
  assert.equal(componentDefinition('signal-jammer').rotate,undefined);
  assert.equal(componentBounds({type:'signal-jammer',x:0,y:0,rotation:1}).rotation,0);
});
test('rotation changes asymmetric footprints and exhaust zones consistently',()=>{
  for(const [type,w,h] of [['small-thruster',1,2],['pilot-console',3,2]])for(let rotation=0;rotation<4;rotation++){
    const c={type,x:5,y:6,rotation},b=componentBounds(c);
    assert.equal(b.width,rotation%2?h:w);assert.equal(b.height,rotation%2?w:h);
    assert.equal(componentCells(c).length,w*h);
    const exhaust=exhaustCells(c);assert.ok(exhaust.every(k=>!componentCells(c).includes(k)));
    if(type==='small-thruster')assert.equal(exhaust.length,5);
  }
  assert.deepEqual(exhaustCells({type:'small-thruster',x:5,y:6,rotation:0}),['5,5','5,4','5,3','5,2','5,1']);
  assert.deepEqual(exhaustCells({type:'small-thruster',x:5,y:6,rotation:1}),['7,6','8,6','9,6','10,6','11,6']);
  assert.deepEqual(exhaustCells({type:'small-thruster',x:5,y:6,rotation:2}),['5,8','5,9','5,10','5,11','5,12']);
  assert.deepEqual(exhaustCells({type:'small-thruster',x:5,y:6,rotation:3}),['4,6','3,6','2,6','1,6','0,6']);
});
test('all components place, report their missing support, and erase from any footprint tile',()=>{
  for(const def of COMPONENTS){
    const base=def.wallMounted?apply(engine(),'hull',['4,4']).state:engine();
    const result=apply(base,def.id,['4,4'],false,def.rotate?1:0);assert.equal(result.rejected,0,def.id);
    const c=result.state.components[0],cells=componentCells(c);
    assert.ok(cells.every(k=>validate(result.state).missing.includes(k)),def.id);
    const supported=apply(result.state,'floor',cells).state;
    assert.ok(cells.every(k=>!validate(supported).missing.includes(k)),def.id);
    const erased=apply(supported,def.id,[cells.at(-1)],true).state;
    assert.equal(erased.components.length,0);assert.equal(erased.floor.length,cells.length);
  }
});
test('all stated component maxima are enforced without affecting other types',()=>{
  for(const def of COMPONENTS.filter(c=>c.limit)){
    let s=engine();const spots=['-10,-10','-5,-10','0,-10','5,-10','-10,-5','-5,-5','0,-5'];
    for(let i=0;i<def.limit;i++){const result=apply(s,def.id,[spots[i]]);assert.equal(result.rejected,0,`${def.id} #${i+1}`);s=result.state;}
    assert.equal(apply(s,def.id,[spots[def.limit]]).rejected,1,def.id);
    assert.equal(apply(s,'power-cell',['10,5']).rejected,0);
  }
});
test('collisions are checked across full rotated footprints and all structure types',()=>{
  let s=apply(engine(),'pilot-console',['4,4'],false,1).state;
  for(const [layer,k] of [['small-tank','5,5'],['hull','5,5'],['extender','5,5']])assert.equal(apply(s,layer,[k]).rejected,1);
  assert.equal(apply(s,'engine',['5,5']).rejected,1);
  assert.equal(apply(engine(),'small-tank',['0,0']).rejected,1);
  const outside=apply(engine(),'large-tank',['18,0']);assert.equal(outside.rejected,0);assert.equal(validate(outside.state).outsideComponents.length,1);
  s=apply(s,'hull',['10,0']).state;assert.equal(apply(s,'small-thruster',['10,0']).rejected,1);
});
test('wall-mounted oxygen pumps share hull and flag wall removal',()=>{
  let s=apply(engine(),'hull',['5,5']).state;s=apply(s,'oxygen-pump',['5,5']).state;
  assert.equal(validate(s).missingWall.length,0);
  assert.equal(apply(s,'power-cell',['5,5']).rejected,1);
  s=apply(s,'hull',['5,5'],true).state;assert.equal(validate(s).missingWall.length,1);
});
test('thruster obstruction is reported after floor changes and rotates with the thruster',()=>{
  let s=apply(engine(),'small-thruster',['5,5'],false,1).state;
  s=apply(s,'floor',['7,5','5,5','6,5']).state;
  assert.deepEqual(validate(s).blockedExhaust,['7,5']);
  s=apply(s,'floor',['7,5'],true).state;assert.equal(validate(s).blockedExhaust.length,0);
});
test('shield generators can be planned outside the engine field but are flagged',()=>{
  const s=apply(engine(),'extender',['18,0']).state;
  for(const k of ['25,0','18,4']){const placed=apply(s,'shield-generator',[k]);assert.equal(placed.rejected,0);assert.equal(validate(placed.state).outsideComponents.length,1);}
  assert.equal(apply(s,'shield-generator',['15,3']).rejected,0);
});
test('component orientation survives saves and old designs load with an empty component list',()=>{
  const s=apply(engine(),'small-thruster',['5,5'],false,3).state;
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(s))),s);
  const old=engine();delete old.components;assert.deepEqual(sanitize(old).components,[]);
  const bad={...s,components:[null,{type:'unknown',x:0,y:0},...s.components]};assert.deepEqual(sanitize(bad).components,s.components);
});

test('vac barrier uses both PNG orientations and keeps a one-tile placement footprint',()=>{
  for(let rotation=0;rotation<4;rotation++){
    const c={type:'vac-barrier',x:5,y:5,rotation},sprite=componentSprite(c),visual=componentVisual(c);
    assert.deepEqual(componentCells(c),['5,5']);
    assert.equal(sprite.turn,0);
    assert.equal(sprite.file,rotation%2?'VacBarrier_east-clean.png':'VacBarrier.png');
    assert.equal(sprite.flip,rotation===1);
    assert.ok(visual.y<0,'frame overlaps the tile above');
    if(rotation%2){assert.ok(visual.y+visual.height>=1,'vertical frame reaches hull below');assert.ok(visual.width<.5);}
    else{assert.ok(visual.x<=0);assert.ok(visual.x+visual.width>=1,'arch reaches hull on both sides');}
    const png=readFileSync(`assets/${sprite.file}`),w=png.readUInt32BE(16),h=png.readUInt32BE(20);
    assert.ok(visual.source[0]>=0&&visual.source[1]>=0);
    assert.ok(visual.source[0]+visual.source[2]<=w&&visual.source[1]+visual.source[3]<=h);
  }
});
test('hull joins the ends of each barrier orientation without occupying its tile',()=>{
  for(let rotation=0;rotation<4;rotation++){
    const c={type:'vac-barrier',x:5,y:5,rotation};
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[1,1],[0,0]])assert.equal(barrierJoins(c,dx,dy),rotation%2?dx===0&&Math.abs(dy)===1:dy===0&&Math.abs(dx)===1);
    let s=apply(engine(),'vac-barrier',['5,5'],false,rotation).state;
    assert.equal(apply(s,'hull',['5,5']).rejected,1);
    assert.equal(apply(s,'hull',rotation%2?['5,4','5,6']:['4,5','6,5']).rejected,0);
  }
});

test('oxygen pumps require a hull mount and a non-hull outlet in all rotations',()=>{
  assert.equal(apply(engine(),'oxygen-pump',['5,5']).rejected,1);
  const fronts=['5,6','4,5','5,4','6,5'];
  for(let rotation=0;rotation<4;rotation++){
    const base=apply(engine(),'hull',['5,5']).state;
    const placed=apply(base,'oxygen-pump',['5,5'],false,rotation);
    assert.equal(placed.rejected,0);
    assert.equal(apply(placed.state,'hull',[fronts[rotation]]).rejected,1);
    const blocked=apply(base,'hull',[fronts[rotation]]).state;
    assert.equal(apply(blocked,'oxygen-pump',['5,5'],false,rotation).rejected,1);
    assert.equal(apply(blocked,'oxygen-pump',['5,5'],false,(rotation+1)%4).rejected,0);
    const legacy={...placed.state,hull:[...placed.state.hull,fronts[rotation]]};
    assert.equal(validate(legacy).blockedPumps.length,1);
    assert.equal(validate(apply(legacy,'hull',[fronts[rotation]],true).state).blockedPumps.length,0);
  }
});
test('oxygen pump marker covers one sixth of a tile centered on its facing edge',()=>{
  const centers=[[5.5,6],[5,5.5],[5.5,5],[6,5.5]];
  const fronts=[{x:5,y:6},{x:4,y:5},{x:5,y:4},{x:6,y:5}];
  for(let rotation=0;rotation<4;rotation++){
    const mount=pumpMount({type:'oxygen-pump',x:5,y:5,rotation});
    assert.deepEqual([mount.x,mount.y],centers[rotation]);
    assert.deepEqual(mount.facingTile,fronts[rotation]);
    assert.ok(Math.abs(mount.width*mount.height-1/6)<1e-9);
  }
});

test('autodoor has only two orientations using the original image and a quarter turn',()=>{
  for(const [requested,expected] of [[0,0],[1,1],[2,0],[3,1],[-1,1]]){
    const result=apply(engine(),'autodoor',['5,5'],false,requested);
    assert.equal(result.rejected,0);
    const c=result.state.components[0];
    assert.equal(c.rotation,expected);
    assert.deepEqual(componentSprite(c),{file:'Autodoor.png',flip:false,turn:expected});
    assert.deepEqual(componentCells(c),['5,5']);
    assert.deepEqual(sanitize(result.state).components,[c]);
    assert.ok(validate(result.state).missing.includes('5,5'));
  }
});

test('autodoor and hull replace each other while preserving floor',()=>{
  let s=apply(engine(),'floor',['5,5']).state;s=apply(s,'hull',['5,5']).state;
  const original=structuredClone(s),door=apply(s,'autodoor',['5,5'],false,1);
  assert.equal(door.rejected,0);assert.ok(!door.state.hull.includes('5,5'));
  assert.equal(door.state.components[0].type,'autodoor');assert.equal(door.state.components[0].rotation,1);
  assert.deepEqual(s,original);
  const wall=apply(door.state,'hull',['5,5']);assert.equal(wall.rejected,0);
  assert.equal(wall.state.components.length,0);assert.ok(wall.state.hull.includes('5,5'));assert.ok(wall.state.floor.includes('5,5'));
});
test('replacement does not remove other structures or invalidate pump mounts',()=>{
  const tank=apply(engine(),'small-tank',['5,5']).state;
  assert.equal(apply(tank,'hull',['5,5']).rejected,1);assert.equal(apply(tank,'autodoor',['5,5']).rejected,1);
  const mounted=apply(apply(engine(),'hull',['5,5']).state,'oxygen-pump',['5,5']).state;
  const attempt=apply(mounted,'autodoor',['5,5']);assert.equal(attempt.rejected,1);assert.deepEqual(attempt.state,mounted);
});
test('moving components preserves orientation, limits, floor and original state on invalid drops',()=>{
  let s=apply(engine(),'small-thruster',['5,5'],false,3).state;
  s=apply(s,'floor',['5,5','6,5']).state;const original=structuredClone(s);
  const item=hitItem(s,{x:6.5,y:5.5});assert.deepEqual(item,{kind:'component',index:0});
  const moved=moveItem(s,item,{x:8,y:6});assert.equal(moved.rejected,0);assert.equal(moved.state.components.length,1);
  assert.deepEqual(moved.state.components[0],{type:'small-thruster',x:8,y:6,rotation:3});assert.deepEqual(moved.state.floor,s.floor);assert.deepEqual(s,original);
  for(const target of [{x:0,y:0},{x:200,y:0}]){const failed=moveItem(s,item,target);assert.equal(failed.rejected,1);assert.strictEqual(failed.state,s);}
  let max=engine();for(const k of ['5,5','8,5','11,5','14,5'])max=apply(max,'small-thruster',[k]).state;
  assert.equal(moveItem(max,{kind:'component',index:0},{x:5,y:8}).rejected,0);
});
test('moving engine/extenders preserves the other equipment; pumps retain mount rules',()=>{
  let s=apply(engine(),'extender',['10,0']).state;
  let moved=moveItem(s,{kind:'engine'},{x:2,y:0});assert.equal(moved.rejected,0);assert.equal(moved.state.extenders.length,1);
  moved=moveItem(s,{kind:'extender',index:0},{x:12,y:0});assert.equal(moved.rejected,0);assert.deepEqual(moved.state.engine,s.engine);
  const unsupported=moveItem(s,{kind:'extender',index:0},{x:25,y:0});assert.equal(unsupported.rejected,0);assert.equal(validate(unsupported.state).invalidExtenders.length,1);
  s=apply(apply(engine(),'hull',['5,5','8,5']).state,'oxygen-pump',['5,5'],false,2).state;
  assert.equal(moveItem(s,{kind:'component',index:0},{x:8,y:5}).rejected,0);
  assert.equal(moveItem(s,{kind:'component',index:0},{x:9,y:5}).rejected,1);
});
test('hit testing finds empty space and pump edge; tile moves cannot merge into existing tiles',()=>{
  let s=apply(engine(),'floor',['5,5','6,5']).state;s=apply(s,'hull',['5,5']).state;s=apply(s,'oxygen-pump',['5,5']).state;
  assert.equal(hitItem(s,{x:15.5,y:15.5}),null);
  assert.deepEqual(hitItem(s,{x:5.5,y:6.1}),{kind:'component',index:0});
  assert.deepEqual(itemPosition(s,{kind:'floor',key:'6,5'}),{x:6,y:5});
  assert.equal(moveItem(s,{kind:'floor',key:'5,5'},{x:6,y:5}).rejected,1);
});

test('both thruster sizes clear the nozzle side of their native and mirrored artwork',()=>{
  // The east image has its gold nozzle on the left; the north image has it below.
  for(const type of ['small-thruster','large-thruster'])for(let rotation=0;rotation<4;rotation++){
    const c={type,x:5,y:6,rotation},b=componentBounds(c),def=componentDefinition(type);
    const cells=exhaustCells(c).map(k=>k.split(',').map(Number));
    assert.equal(cells.length,def.width*def.exhaust);
    for(const [x,y] of cells){
      assert.ok(rotation===0?y<b.y:rotation===1?x>=b.x+b.width:rotation===2?y>=b.y+b.height:x<b.x,`${type}, rotation ${rotation}: nozzle side`);
    }
    const front=rotation===0?`${b.x},${b.y-1}`:rotation===1?`${b.x+b.width},${b.y}`:rotation===2?`${b.x},${b.y+b.height}`:`${b.x-1},${b.y}`;
    let s=apply(engine(),type,['5,6'],false,rotation).state;
    s=apply(s,'floor',[front]).state;
    assert.ok(validate(s).blockedExhaust.includes(front),`${type}, rotation ${rotation}: obstruction checks use nozzle side`);
  }
});


test('placed components rotate around a stable pivot without drifting or losing supporting tiles',()=>{
  let s=apply(engine(),'pilot-console',['5,5']).state;s=apply(s,'floor',componentCells(s.components[0])).state;
  const original=structuredClone(s),item={kind:'component',index:0};
  for(let i=1;i<=4;i++){
    const result=rotateItem(s,item,1);assert.equal(result.rejected,0);s=result.state;
    assert.equal(s.components[0].rotation,i%4);assert.deepEqual(s.floor,original.floor);
    assert.deepEqual(s.engine,original.engine);assert.deepEqual(s.extenders,original.extenders);
  }
  assert.deepEqual(s,original,'four turns restore footprint, position, and orientation');
  const left=rotateItem(s,item,-1);assert.equal(left.state.components[0].rotation,3);
  assert.deepEqual(rotateItem(left.state,left.item,1).state,original);
});

test('placed rotation allows unsupported field edges but rejects collisions and blocked pump outlets',()=>{
  let s=apply(engine(),'small-thruster',['5,5']).state;
  // A 1x2 thruster becomes 2x1 at (4,6) around its central grid tile.
  s=apply(s,'heater',['4,6']).state;let before=structuredClone(s);
  let result=rotateItem(s,{kind:'component',index:0},1);assert.equal(result.rejected,1);assert.equal(result.state,s);assert.deepEqual(s,before);
  s=apply(engine(),'pilot-console',['17,0'],false,1).state;assert.equal(s.components.length,1);
  result=rotateItem(s,{kind:'component',index:0},-1);assert.equal(result.rejected,0);assert.equal(validate(result.state).outsideComponents.length,1);
  s=apply(apply(engine(),'hull',['5,5','4,5']).state,'oxygen-pump',['5,5']).state;
  result=rotateItem(s,{kind:'component',index:0},1);assert.equal(result.rejected,1);assert.match(result.message,/non-hull/);
  result=rotateItem(s,{kind:'component',index:0},-1);assert.equal(result.rejected,0);assert.equal(result.state.components[0].rotation,3);assert.deepEqual(result.state.hull,s.hull);
});

test('placed rotation respects two-way and fixed components, limits, and door replacement rules',()=>{
  let s=apply(engine(),'autodoor',['5,5']).state;
  const first=rotateItem(s,{kind:'component',index:0},1);assert.equal(first.state.components[0].rotation,1);
  assert.deepEqual(rotateItem(first.state,first.item,1).state,s);
  s=apply(engine(),'heater',['5,5']).state;assert.equal(rotateItem(s,{kind:'component',index:0},1).rejected,1);
  assert.equal(rotateItem(s,{kind:'engine'},1).rejected,1);
  s=engine();for(const k of ['4,4','7,4','10,4','13,4'])s=apply(s,'small-thruster',[k]).state;
  assert.equal(rotateItem(s,{kind:'component',index:0},1).rejected,0,'rotating at the limit does not add a component');
  const modded={...engine(),mods:{chapter1:true,chapter2:true}};
  const door=ALL_COMPONENTS.find(c=>c.chapter&&c.replacesHull&&c.width>1&&c.height===1);
  assert.ok(door);s=apply(modded,door.id,['5,5']).state;
  const bounds=componentBounds(s.components[0]),x=5+Math.floor(bounds.width/2),y=5-Math.floor(bounds.width/2);
  s=apply(s,'hull',[`${x},${y}`]).state;
  const turned=rotateItem(s,{kind:'component',index:0},1);assert.equal(turned.rejected,0);
  assert.ok(!turned.state.hull.includes(`${x},${y}`),'rotating a door uses the same hull replacement rules as placement');
});
