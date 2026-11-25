import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MOD_COMPONENTS,MOD_ENGINES,MOD_OVERRIDES} from './mod-data.js';
import {availableComponents,componentDefinition,componentBounds,componentCells,componentSprite,exhaustCells} from './components.js';
import {hullTopology,drawSimpleHull} from './hull.js';
import {normalizeMods,engineProfile,extenderProfile} from './mods.js';
import {blank,apply,capacity,capacityDetails,engineFootprint,fieldCells,inField,inEngineField,validate,sanitize,hitItem,moveItem,shapeCells} from './model.js';

const design=(engineType='standard',chapter2=false)=>apply(blank({mods:{chapter1:true,chapter2},engineType}),'engine',['0,0']).state;
const put=(s,type,cell,rotation=0)=>{const r=apply(s,type,[cell],false,rotation);assert.equal(r.rejected,0,`${type}: ${r.message}`);return r.state;};

test('chapters gate the complete catalog, with Chapter 2 requiring Chapter 1',()=>{
  assert.deepEqual(normalizeMods({chapter2:true}),{chapter1:true,chapter2:true});
  assert.equal(availableComponents(blank()).length,78);
  assert.equal(MOD_COMPONENTS.length,109);
  const c1=design(),c2=design('standard',true);
  assert.equal(availableComponents(c1).filter(c=>c.chapter===2).length,0);
  assert.equal(availableComponents(c2).length,187);
  assert.equal(apply(blank(),'VGE_SmallHeatsink',['5,5']).rejected,1);
  assert.equal(apply(c1,'VGE_SmallElectricThruster',['5,5']).rejected,1);
  assert.equal(put(c2,'VGE_SmallElectricThruster','5,5').components.length,1);
});

test('every imported component places, rotates, saves and erases using its full footprint',()=>{
  for(const d of MOD_COMPONENTS)for(let rotation=0;rotation<(d.rotate?4:1);rotation++){
    let s=design('VGE_GravhulkEngine',true);
    if(d.wallMounted)s=put(s,'hull','8,4');
    s=put(s,d.id,'8,4',rotation);
    const c=s.components[0],cells=componentCells(c);
    assert.equal(cells.length,d.width*d.height,d.id);
    assert.equal(validate(s).missing.length,25+cells.length,d.id);
    assert.deepEqual(sanitize(JSON.parse(JSON.stringify(s))),s,d.id);
    assert.equal(hitItem(s,{x:8.1,y:4.1}).kind,'component',d.id);
    const erased=apply(s,d.id,[cells.at(-1)],true).state;
    assert.equal(erased.components.length,0,d.id);
    const moved=moveItem(s,{kind:'component',index:0},{x:12,y:4});
    if(!d.wallMounted){assert.equal(moved.rejected,0,d.id);assert.equal(moved.state.components[0].rotation,c.rotation,d.id);}
  }
});

test('all imported artwork has provenance and is an unchanged PNG',()=>{
  const sources=JSON.parse(readFileSync('assets/mods/sources.json','utf8'));
  const images=new Set([...MOD_COMPONENTS,...MOD_ENGINES,...Object.values(MOD_OVERRIDES).flatMap(Object.values)].flatMap(d=>[...Object.values(d.sprites||{}),...Object.values(d.topSprites||{}),d.topSprite,d.icon].filter(Boolean)));
  for(const image of images){
    const png=readFileSync(`assets/${image}`);
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',image);
    assert.ok(sources.artwork[image],image);
    assert.equal(createHash('sha256').update(png).digest('hex'),sources.artworkHashes[image],image);
  }
  for(const d of MOD_COMPONENTS)for(let rotation=0;rotation<4;rotation++)assert.ok(images.has(componentSprite({type:d.id,rotation}).file));
});

test('three engine profiles govern field masks, footprint, support and moving/erasing',()=>{
  for(const [type,size,base,radius] of [['VGE_GravjumperEngine',1,100,7.9],['standard',3,250,11.9],['VGE_GravhulkEngine',5,500,23.9]]){
    const s=design(type),cells=fieldCells(s),profile=engineProfile(s);
    assert.deepEqual([profile.width,profile.support,profile.fieldRadius],[size,base,radius]);
    assert.equal(capacity(s),base);assert.equal(engineFootprint(s).length,size**2);assert.equal(validate(s).missing.length,size**2);
    for(let y=-25;y<=25;y++)for(let x=-25;x<=25;x++){
      const expected=x*x+y*y<radius*radius;
      assert.equal(inEngineField(s.engine,{x,y},s),expected);assert.equal(cells.has(`${x},${y}`),expected);
    }
    const extent=Math.floor(radius);
    assert.deepEqual([...fieldCells(s)].sort(),shapeCells('disc',{x:0,y:0},{x:extent,y:0}).sort());
    const half=Math.floor(size/2);assert.equal(hitItem(s,{x:half+.1,y:half+.1}).kind,'engine');
    assert.equal(apply(s,'hull',[`${half},${half}`]).rejected,1);
    const moved=moveItem(s,{kind:'engine'},{x:4,y:3});assert.equal(moved.rejected,0);assert.equal(engineFootprint(moved.state).length,size**2);
    assert.equal(apply(s,'engine',[`${half},${half}`],true).state.engine,null);
  }
});

test('extenders can link through amplifiers but cannot chain through another extender',()=>{
  const edge=put(design(),'VGE_GravFieldAmplifier','10,-1');
  assert.equal(inField(edge,{x:33,y:0}),true,'amplifiers anchor inside the engine field and can support their own overhanging footprint');
  let s=design();assert.deepEqual([extenderProfile(s).fieldRadius,extenderProfile(s).supportOffset,extenderProfile(s).limit],[12.9,100,10]);
  s=put(s,'VGE_GravFieldAmplifier','9,-1');assert.equal(capacity(s),450);
  s=put(s,'extender','30,0');assert.equal(capacity(s),550);assert.equal(inField(s,{x:42,y:0}),true);
  const unlinked=apply(s,'extender',['42,0']);assert.equal(unlinked.rejected,0);assert.equal(validate(unlinked.state).invalidExtenders.length,1);assert.equal(capacity(unlinked.state),capacity(s),'an unlinked extender adds no support');assert.equal(inField(unlinked.state,{x:53,y:0}),false,'extenders still cannot chain');
  s=apply(s,'VGE_GravFieldAmplifier',['9,-1'],true).state;
  assert.equal(validate(s).invalidExtenders.length,1);assert.equal(capacity(s),250);assert.equal(inField(s,{x:42,y:0}),false);
  s=design('VGE_GravhulkEngine');
  for(let i=0;i<10;i++)s=put(s,'extender',`${i+4},0`);
  assert.equal(capacity(s),1500);assert.equal(apply(s,'extender',['15,0']).rejected,1);
  assert.equal(sanitize(s).extenders.length,10);
});

test('capacity combines field bonuses and astrofuel thrusters; electric thrusters add no support',()=>{
  let s=put(design('VGE_GravhulkEngine',true),'extender','6,0');
  s=put(s,'small-thruster','5,5');s=put(s,'large-thruster','8,5');s=put(s,'VGE_GiantThruster','12,5');
  assert.deepEqual(capacityDetails(s),{base:500,bonus:100,multiplier:1.16,total:696});
  s=put(s,'VGE_SmallElectricThruster','5,10');assert.equal(capacity(s),696);
  assert.equal(componentDefinition('small-thruster',s).limit,10);
  assert.equal(componentDefinition('fuel-optimizer',s).limit,4);
  assert.equal(componentDefinition('shield-generator',s).limit,4);
  assert.equal(componentDefinition('signal-jammer',s).limit,1);
  assert.equal(componentDefinition('fuel-optimizer',s).rotate,true);
});

test('dilutor extends the field and subtracts support; beam chains grow and collapse from the supported field',()=>{
  let s=put(design('VGE_GravhulkEngine',true),'VGE_GravFieldDilutor','8,-2');
  assert.equal(capacity(s),250);assert.equal(inField(s,{x:46,y:0}),true);
  assert.equal(apply(s,'VGE_GravFieldDilutor',['-10,-2']).rejected,1);
  s=design();s=put(s,'VGE_GravshipStructuralBeam','11,0');s=put(s,'VGE_GravshipStructuralBeam','14,0');
  assert.equal(inField(s,{x:17,y:0}),true);assert.equal(capacity(s),250);
  const moved=moveItem(s,{kind:'component',index:1},{x:17,y:0});assert.equal(moved.rejected,0);assert.equal(inField(moved.state,{x:20,y:0}),false,'an unsupported planned beam cannot extend itself');assert.equal(validate(moved.state).outsideComponents.length,1);
  s=apply(s,'VGE_GravshipStructuralBeam',['11,0'],true).state;assert.equal(inField(s,{x:17,y:0}),false);
});

test('subscaffold connects floors for free and permits planned structures with missing-support warnings',()=>{
  let s=design('VGE_GravjumperEngine');s=put(s,'floor','0,0');s=put(s,'scaffold','1,0');s=put(s,'floor','2,0');
  assert.equal(s.floor.length,2);assert.equal(capacity(s),100);assert.equal(validate(s).disconnected.length,0);
  for(const type of ['hull','extender','heater']){const planned=apply(s,type,['1,0']);assert.equal(planned.rejected,0,type);assert.ok(validate(planned.state).missing.includes('1,0'));assert.ok(validate(planned.state).unsupportedTiles.includes('1,0'));}
  s=put(s,'floor','1,0');assert.deepEqual(s.scaffold,[]);assert.equal(s.floor.length,3);
  s=put(s,'hull','1,0');const walkway=apply(s,'scaffold',['1,0']);assert.equal(walkway.rejected,0);assert.ok(validate(walkway.state).missing.includes('1,0'));
});

test('pipe networks coexist with buildings and each other; mod hull replacements retain support and mount pumps',()=>{
  let s=design('VGE_GravhulkEngine',true);s=put(s,'VGE_OxygenPipe','5,5');s=put(s,'VGE_AstrofuelPipe','5,5');s=put(s,'heater','5,5');
  assert.equal(s.components.length,3);assert.equal(apply(s,'VGE_HiddenOxygenPipe',['5,5']).rejected,1);
  s=put(s,'floor','8,5');s=put(s,'hull','8,5');s=put(s,'VGE_GravshipArmor','8,5');
  assert.ok(!s.hull.includes('8,5'));s=put(s,'oxygen-pump','8,5');assert.equal(validate(s).missingWall.length,0);
  s=put(s,'hull','8,5');assert.ok(s.floor.includes('8,5'));assert.ok(!s.components.some(c=>c.type==='VGE_GravshipArmor'));
});

test('saved designs restore dependencies, preserve disabled components and flag incompatible rules',()=>{
  let s=put(design('VGE_GravhulkEngine',true),'VGE_Warcomputer','8,5');
  s.mods={chapter2:true};const loaded=sanitize(s);assert.deepEqual(loaded.mods,{chapter1:true,chapter2:true});
  const disabled={...loaded,mods:{chapter1:false,chapter2:false}};
  assert.equal(sanitize(disabled).components.length,1);assert.equal(validate(disabled).disabledComponents.length,1);
  assert.equal(engineProfile(disabled).width,3);assert.equal(capacity(disabled),500);
  assert.deepEqual(sanitize(blank()),blank());
});

test('multi-tile airlocks and barriers join hull only at their ends in all rotations',()=>{
  for(const type of ['VGE_VacBarrierDouble','VGE_VacBarrierTriple','VGE_VacBarrierQuintuple','VGE_AirlockDoor','VGE_Airlock2x1Door','VGE_Airlock3x1Door','VGE_Airlock5x1Door'])for(let rotation=0;rotation<4;rotation++){
    const c={type,x:6,y:6,rotation},b=componentBounds(c),horizontal=rotation%2===0;
    const ends=horizontal?['5,6',`${6+b.width},6`]:['6,5',`6,${6+b.height}`];
    const s={...design('VGE_GravhulkEngine',true),components:[c],hull:ends,floor:[...ends,...componentCells(c)]};
    const index=hullTopology(s)._index;
    assert.ok(index.barriers.get('6,6')&(horizontal?8:1),type);
    assert.ok(index.barriers.get(horizontal?`${5+b.width},6`:`6,${5+b.height}`)&(horizontal?2:4),type);
    if(b.width>1||b.height>1)assert.equal(index.barriers.get('6,6')&(horizontal?2:4),0,'no connection through the middle of a wider barrier');
    const calls=[];drawSimpleHull({drawImage:(...args)=>calls.push(args)},s,{width:300,height:300},(x,y)=>({x:x*20,y:y*20}),20);
    assert.equal(calls.length,8,type);
  }
  for(const [engine,size] of [['VGE_GravjumperEngine',1],['VGE_GravhulkEngine',5]])assert.equal(hullTopology(design(engine))._index.occupied.size,size**2);
});

test('mod thrusters clear the nozzle side of their own artwork in all directions',()=>{
  const s=design('VGE_GravhulkEngine',true);
  for(const type of ['small-thruster','large-thruster','VGE_GiantThruster','VGE_SmallElectricThruster','VGE_LargeElectricThruster','VGE_GiantElectricThruster'])for(let rotation=0;rotation<4;rotation++){
    const c={type,x:5,y:5,rotation},b=componentBounds(c,s),cells=exhaustCells(c,s).map(k=>k.split(',').map(Number));
    assert.equal(cells.length,componentDefinition(type,s).width*componentDefinition(type,s).exhaust);
    assert.ok(cells.every(([x,y])=>rotation===0?y>=b.y+b.height:rotation===1?x<b.x:rotation===2?y<b.y:x>=b.x+b.width),type);
    const [blocked]=cells;const invalid={...s,components:[c],floor:[blocked.join(',')]};assert.ok(validate(invalid).blockedExhaust.includes(blocked.join(',')),type);
  }
  assert.notDeepEqual(exhaustCells({type:'small-thruster',x:5,y:5,rotation:0},s),exhaustCells({type:'small-thruster',x:5,y:5,rotation:0}), 'vanilla convention remains unchanged');
});


test('painting astrofuel pipes preserves mixed fuel-network tiles and movement cannot merge them',()=>{
  let s=design('VGE_GravhulkEngine');s=put(s,'VGE_AstrofuelPipe','5,5');s=put(s,'VGE_HiddenAstrofuelPipe','6,5');s=put(s,'VGE_AstrofuelValve','7,5');
  const painted=apply(s,'VGE_HiddenAstrofuelPipe',['5,5','6,5','7,5','8,5']);assert.equal(painted.rejected,0);assert.equal(painted.state.components.length,4);
  assert.deepEqual(painted.state.components.slice(0,3),s.components,'existing pipe styles and valves are retained');
  const moved=moveItem(painted.state,{kind:'component',index:3},{x:6,y:5});assert.equal(moved.rejected,1);assert.equal(moved.state,painted.state,'invalid moves cannot drop the source or another component');
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(painted.state))),painted.state);
});

test('bulk pipe painting respects the saved-design component limit but permits repainting existing tiles',()=>{
  const s={...design('VGE_GravhulkEngine'),components:Array.from({length:2000},(_,i)=>({type:'VGE_AstrofuelPipe',x:i%100-50,y:Math.floor(i/100)-10,rotation:0}))};
  const full=apply(s,'VGE_HiddenAstrofuelPipe',['50,50']);assert.equal(full.rejected,1);assert.match(full.message,/2,000/);assert.equal(full.state.components.length,2000);
  const repaint=apply(s,'VGE_HiddenAstrofuelPipe',['-50,-10']);assert.equal(repaint.rejected,0);assert.deepEqual(repaint.state.components,s.components);
  assert.equal(sanitize(JSON.parse(JSON.stringify(repaint.state))).components.length,2000);
});
