import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as model from './model.js';
import * as catalogue from './components.js';
import * as hull from './hull.js';
import * as measurements from './measurements.js';
import * as release from './version.js';
import * as mods from './mods.js';
import * as scenario from './scenario.js';
import * as systems from './systems.js';
import * as systemsUI from './systems-ui.js';

function createEditor({deferHullTextures=false}={}){
  const pendingHullImages=[],drawnText=[],drawnImages=[];
  const frameQueue=[],counters={frames:0,validation:0,fields:0,apply:0,placement:0,previewMove:0,move:0,libraryReads:0,clones:0};
  let frameId=0;
  const flush=()=>{let passes=0;while(frameQueue.length){assert.ok(passes++<10,'rendering should settle');const batch=frameQueue.splice(0);for(const callback of batch)callback(0);}};

  const nodes=[],ids=new Map(),storage=new Map(),events={},requestedImages=[],hullCalls={topology:0,update:0,prepare:0,simple:0,diagonal:0};
  const trackHull=(name,fn)=>(...args)=>{hullCalls[name]++;return fn(...args);};
  class Element{
    constructor(tag='div'){this.tagName=tag;this.dataset={};this.children=[];this.style={};this.attributes={};this.className='';this.value='';this.checked=true;this.hidden=false;this.classList={toggle:(c,on)=>{const set=new Set(this.className.split(' '));on?set.add(c):set.delete(c);this.className=[...set].join(' ');},add:()=>{},remove:()=>{}};nodes.push(this);}
    set innerHTML(value){this.html=value;this.children=[];for(const tag of ['strong','small','img']){if(value.includes('<'+tag)){const e=new Element(tag);e.textContent=value.match(new RegExp('<'+tag+'[^>]*>([^<]*)'))?.[1]||'';this.append(e);}}if(value.includes('component-quantity')){const q=new Element('span');q.className='component-quantity';this.append(q);}}
    get innerHTML(){return this.html||'';}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;this.replacements=(this.replacements||0)+1;}
    setAttribute(k,v){this.attributes[k]=v;}
    querySelector(q){return this.children.find(c=>q.startsWith('.')?c.className?.split(' ').includes(q.slice(1)):c.tagName===q);}
    matches(q){return q.split(',').includes(this.tagName);}
    getBoundingClientRect(){return {left:0,top:0,width:900,height:600};}
    focus(){} setPointerCapture(){} addEventListener(){} showModal(){this.open=true;}close(){this.open=false;}
  }
  const html=readFileSync('index.html','utf8');
  for(const match of html.matchAll(/<([\w-]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const el=new Element(match[1]);el.id=match[2];ids.set(el.id,el);}
  ids.get('name').value='Integration test';
  const ctx=new Proxy({clearRect:()=>{counters.frames++;drawnText.length=0;drawnImages.length=0;},drawImage:(im,...args)=>drawnImages.push({file:im.srcValue,args}),measureText:text=>({width:String(text).length*7}),fillText:(text,x,y)=>drawnText.push({text,x,y})}, {get:(target,k)=>target[k]||(()=>{}),set:(target,k,v)=>(target[k]=v,true)});
  ids.get('canvas').getContext=()=>ctx;
  const queryAll=q=>q==='[data-layer]'?nodes.filter(n=>n.dataset.layer):q==='[data-shape]'?nodes.filter(n=>n.dataset.shape):q==='.component-item'?nodes.filter(n=>n.className.split(' ').includes('component-item')):q==='#component-options h3'?ids.get('component-options').children.filter(n=>n.tagName==='h3'):[];
  const document={getElementById:id=>{assert.ok(ids.has(id),`Missing element ${id}`);return ids.get(id);},createElement:t=>new Element(t),createTextNode:text=>({textContent:text}),querySelectorAll:queryAll,querySelector:q=>q==='dialog[open]'?[...ids.values()].find(n=>n.tagName==='dialog'&&n.open):null};
  const window={devicePixelRatio:1,addEventListener:(type,fn)=>events[type]=fn,requestAnimationFrame:fn=>{frameQueue.push(fn);return ++frameId;}};
  const sandbox={...model,...catalogue,...hull,...measurements,...release,...mods,...scenario,...systems,...systemsUI,document,window,localStorage:{getItem:k=>{if(k==='gravship-designs-v1')counters.libraryReads++;return storage.get(k)||null;},setItem:(k,v)=>storage.set(k,v)},structuredClone:value=>{counters.clones++;return structuredClone(value);},crypto:{randomUUID:()=> 'test-design'},console,OffscreenCanvas:class{constructor(w,h){this.width=w;this.height=h;}getContext(){return {drawImage(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}};}},Image:class{set src(value){this.srcValue=value;const data=readFileSync(value);if(value.endsWith('.png')){this.width=data.readUInt32BE(16);this.height=data.readUInt32BE(20);}else{this.width=64;this.height=64;}if(deferHullTextures&&value.startsWith('assets/hull-prepared/'))pendingHullImages.push(()=>this.onload?.());else this.onload?.();}},ResizeObserver:class{observe(){}},setTimeout:()=>0,clearTimeout:()=>{}};
  for(const [name,fn] of [['topology','hullTopology'],['update','updateHullTopology'],['prepare','prepareHullTexture'],['simple','drawSimpleHull'],['diagonal','drawHull']])sandbox[fn]=trackHull(name,hull[fn]);
  for(const [name,fn] of [['validation','validate'],['fields','fieldCells'],['apply','apply'],['placement','checkPlacement'],['previewMove','previewMove'],['move','moveItem']])sandbox[fn]=(...args)=>{counters[name]++;return model[fn](...args);};
  const MockImage=sandbox.Image;
  sandbox.Image=class extends MockImage{set src(value){requestedImages.push(value);super.src=value;}};
  const source=readFileSync('app.js','utf8').replace(/^import .+;\r?\n/gm,'');
  vm.runInNewContext(source,sandbox,{filename:'app.js'});
  flush();
  return {nodes,ids,storage,events,drawnText,drawnImages,requestedImages,hullCalls,queryAll,flush,counters,pendingFrames:()=>frameQueue.length,finishHullImages:()=>{for(const load of pendingHullImages.splice(0))load();flush();}};
}

test('editor boots and supports palette, Q/E/buttons, placement, undo/redo and local save',()=>{
  const {nodes,ids,storage,events,requestedImages,hullCalls,queryAll,flush}=createEditor();
  const action=fn=>{fn();flush();};
  assert.equal(queryAll('.component-item').filter(n=>!n.hidden).length,15);
  assert.equal(ids.get('app-version').textContent,`v${release.APP_VERSION}`);
  assert.equal(ids.get('diagonal-hull').checked,true);
  assert.equal(hullCalls.topology,1);assert.equal(hullCalls.prepare,0);assert.ok(hullCalls.diagonal>0);
  assert.equal(requestedImages.filter(path=>path.startsWith('assets/hull-prepared/')).length,hull.HULL_REFERENCES.length);
  // Exercise fast mode for the editing workflow, then switch corners back on.
  ids.get('diagonal-hull').checked=false;ids.get('diagonal-hull').onchange();flush();
  assert.ok(hullCalls.simple>0);
  const select=type=>action(()=>nodes.find(n=>n.dataset.layer===type).onclick());
  const keyboard=key=>action(()=>events.keydown({key,target:ids.get('canvas'),preventDefault(){}}));
  const clickTile=(x,y)=>{const e={button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}};ids.get('canvas').onpointerdown(e);ids.get('canvas').onpointerup(e);flush();};
  clickTile(0,0);assert.equal(ids.get('engine-count').textContent,'1 / 1');
  select('small-thruster');assert.equal(ids.get('rotation-label').textContent,'South');
  keyboard('q');assert.equal(ids.get('rotation-label').textContent,'East');
  keyboard('e');assert.equal(ids.get('rotation-label').textContent,'South');
  action(()=>ids.get('rotate').onclick());assert.equal(ids.get('rotation-label').textContent,'West');
  action(()=>ids.get('rotate-left').onclick());assert.equal(ids.get('rotation-label').textContent,'South');
  keyboard('q');clickTile(5,5);assert.equal(ids.get('component-count').textContent,1);
  action(()=>ids.get('save').onclick());const saved=JSON.parse(storage.get('gravship-designs-v1'))[0];
  assert.equal(saved.state.components[0].rotation,3);assert.equal(saved.state.components[0].x,5);
  action(()=>ids.get('undo').onclick());assert.equal(ids.get('component-count').textContent,0);
  action(()=>ids.get('redo').onclick());assert.equal(ids.get('component-count').textContent,1);
  select('signal-jammer');assert.equal(ids.get('rotate').disabled,true);keyboard('e');assert.equal(ids.get('rotation-label').textContent,'Fixed');
  select('autodoor');assert.equal(ids.get('rotation-label').textContent,'North/south');
  keyboard('e');assert.equal(ids.get('rotation-label').textContent,'East/west');
  keyboard('e');assert.equal(ids.get('rotation-label').textContent,'North/south');
  keyboard('q');assert.equal(ids.get('rotation-label').textContent,'East/west');
  action(()=>ids.get('rotate').onclick());assert.equal(ids.get('rotation-label').textContent,'North/south');
  const pointer=(x,y,button=0)=>({button,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const saveState=()=>{action(()=>ids.get('save').onclick());return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  // An empty-space right click switches out of painting without touching the design.
  const before=saveState();const empty=pointer(17,10,2);
  ids.get('canvas').onpointerdown(empty);ids.get('canvas').onpointerup(empty);flush();
  assert.equal(ids.get('mode-label').textContent,'Select / move');assert.deepEqual(saveState(),before);
  const start=pointer(6,5),end=pointer(9,6); // Grab the second tile, preserving the cursor offset.
  ids.get('canvas').onpointerdown(start);ids.get('canvas').onpointermove(end);ids.get('canvas').onpointerup(end);flush();
  let movedState=saveState();assert.equal(movedState.components[0].x,8);assert.equal(movedState.components[0].y,6);assert.equal(movedState.components[0].rotation,3);
  action(()=>ids.get('undo').onclick());assert.equal(saveState().components[0].x,5);
  action(()=>ids.get('redo').onclick());assert.equal(saveState().components[0].x,8);
  // Invalid drops leave the component at its previous position.
  ids.get('canvas').onpointerdown(pointer(8,6));ids.get('canvas').onpointermove(pointer(0,0));ids.get('canvas').onpointerup(pointer(0,0));flush();
  assert.equal(saveState().components[0].x,8);
  // Escape cancels an in-flight move and clears the selection.
  ids.get('canvas').onpointerdown(pointer(8,6));ids.get('canvas').onpointermove(pointer(10,8));keyboard('Escape');
  ids.get('canvas').onpointerup(pointer(10,8));flush();assert.equal(saveState().components[0].x,8);assert.equal(ids.get('mode-label').textContent,'Select / move');
  // Select mode also has a visible entry point.
  select('heater');action(()=>ids.get('select-mode').onclick());assert.equal(ids.get('mode-label').textContent,'Select / move');
  // Replacing a wall/door works through the editor and remains undoable.
  select('floor');clickTile(12,4);select('hull');clickTile(12,4);select('autodoor');clickTile(12,4);
  assert.ok(!saveState().hull.includes('12,4'));assert.ok(saveState().components.some(c=>c.type==='autodoor'));
  select('hull');clickTile(12,4);assert.ok(saveState().hull.includes('12,4'));assert.ok(!saveState().components.some(c=>c.type==='autodoor'));
  action(()=>ids.get('undo').onclick());assert.ok(saveState().components.some(c=>c.type==='autodoor'));
  ids.get('component-search').value='tank';ids.get('component-search').oninput();assert.equal(queryAll('.component-item').filter(n=>!n.hidden).length,2);

  // Detailed rendering is view-only, cached per design state, and loaded once.
  const beforeToggle=saveState();assert.equal(hullCalls.topology,1);assert.equal(hullCalls.prepare,0);
  const diagonal=ids.get('diagonal-hull');diagonal.checked=true;diagonal.onchange();flush();
  assert.equal(hullCalls.topology,1);assert.equal(hullCalls.prepare,0);assert.ok(hullCalls.diagonal>0);
  assert.deepEqual(saveState(),beforeToggle);assert.equal(hullCalls.topology,1,'UI refresh does not rebuild unchanged hull');
  const loadedImages=requestedImages.length,prepared=hullCalls.prepare;
  diagonal.checked=false;diagonal.onchange();flush();
  const fastCalls=hullCalls.simple;select('hull');assert.ok(hullCalls.simple>fastCalls);assert.equal(hullCalls.topology,1);
  diagonal.checked=true;diagonal.onchange();flush();assert.equal(hullCalls.topology,1);assert.equal(requestedImages.length,loadedImages);assert.equal(hullCalls.prepare,prepared);
  // A real edit invalidates the detailed layout; the next toggle itself preserves undo.
  clickTile(13,4);assert.equal(hullCalls.topology,1);assert.equal(hullCalls.update,2);
  diagonal.checked=false;diagonal.onchange();flush();action(()=>ids.get('undo').onclick());
  assert.deepEqual(saveState(),beforeToggle);assert.equal(hullCalls.topology,1);assert.equal(hullCalls.update,2);
});

test('mod toggles enforce dependencies, update engine/rotation UI, preserve designs and restore settings on load',()=>{
  const {ids,nodes,queryAll,events,storage,requestedImages,flush}=createEditor();
  const action=fn=>{fn();flush();};
  const select=type=>action(()=>nodes.find(n=>n.dataset.layer===type).onclick());
  const toggle=(id,value)=>action(()=>{ids.get(id).checked=value;ids.get(id).onchange();});
  const click=(x,y)=>{const e={button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}};action(()=>{ids.get('canvas').onpointerdown(e);ids.get('canvas').onpointerup(e);});};
  const saved=()=>{action(()=>ids.get('save').onclick());return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  assert.equal(ids.get('mod-chapter1').checked,false);assert.equal(ids.get('mod-chapter2').checked,false);
  assert.equal(requestedImages.some(p=>p.startsWith('assets/mods/')),false,'disabled mods do not load component artwork');
  toggle('mod-chapter1',true);assert.equal(queryAll('.component-item').filter(n=>!n.hidden).length,92);
  assert.equal(ids.get('engine-type').children.length,3);assert.equal(ids.get('capacity-note').textContent,'Place an engine to support 250 tiles.');
  assert.equal(nodes.find(n=>n.dataset.layer==='small-tank').querySelector('strong').textContent,'Small astrofuel tank');
  assert.equal(requestedImages.some(p=>p.startsWith('assets/mods/chapter2/')),false);
  toggle('mod-chapter2',true);assert.equal(ids.get('mod-chapter1').checked,true);assert.equal(queryAll('.component-item').filter(n=>!n.hidden).length,124);
  action(()=>{ids.get('engine-type').value='VGE_GravhulkEngine';ids.get('engine-type').onchange();});click(0,0);
  assert.equal(ids.get('capacity').textContent,'500');assert.equal(ids.get('engine-radius').textContent,23.9);assert.equal(ids.get('extender-count').textContent,'0 / 10');
  select('fuel-optimizer');assert.equal(ids.get('rotate').disabled,false);
  action(()=>events.keydown({key:'e',target:ids.get('canvas'),preventDefault(){}}));assert.equal(ids.get('rotation-label').textContent,'West');click(5,5);
  select('VGE_Warcomputer');click(8,5);const before=saved();assert.equal(before.components.length,2);assert.equal(before.components[0].rotation,1);
  toggle('mod-chapter1',false);assert.equal(ids.get('mod-chapter2').checked,false);assert.equal(queryAll('.component-item').filter(n=>!n.hidden).length,15);
  assert.equal(saved().components.length,2,'disabling mods preserves placed components');
  action(()=>ids.get('undo').onclick());assert.equal(ids.get('mod-chapter2').checked,true);assert.equal(ids.get('engine-type').value,'VGE_GravhulkEngine');
  saved();action(()=>ids.get('new').onclick());action(()=>ids.get('accept-confirm').onclick());
  assert.equal(ids.get('mod-chapter2').checked,true,'New keeps the chosen mod settings');
  action(()=>ids.get('load').onclick());const row=ids.get('design-list').children[0];action(()=>row.children[1].onclick());
  assert.equal(ids.get('mod-chapter1').checked,true);assert.equal(ids.get('mod-chapter2').checked,true);assert.deepEqual(saved().components,before.components);
});

test('mod pipes use the linked atlas with the PNG row order and cache artwork between edits',()=>{
  const {ids,nodes,drawnImages,requestedImages,flush}=createEditor();
  ids.get('mod-chapter1').checked=true;ids.get('mod-chapter1').onchange();flush();
  const click=(x,y)=>{const e={button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}};ids.get('canvas').onpointerdown(e);ids.get('canvas').onpointerup(e);flush();};
  click(0,0);nodes.find(n=>n.dataset.layer==='VGE_OxygenPipe').onclick();flush();
  const imageCount=requestedImages.length;click(5,5);click(6,5);click(7,5);
  const path='assets/'+catalogue.componentDefinition('VGE_OxygenPipe').sprites.south;
  const png=readFileSync(path),tw=png.readUInt32BE(16)/4,th=png.readUInt32BE(20)/4;
  const crops=drawnImages.filter(im=>im.file===path).map(im=>im.args.slice(0,4));
  for(const expected of [[tw*2,th*3,tw,th],[tw*2,th,tw,th],[0,th,tw,th]])assert.ok(crops.some(c=>JSON.stringify(c)===JSON.stringify(expected)),JSON.stringify(expected));
  assert.equal(requestedImages.length,imageCount,'painting reuses already loaded textures');
});

test('ship systems update for layout and assumptions, persist through save/load, and reuse the summary on hover',()=>{
  const {ids,nodes,storage,flush}=createEditor();
  const action=fn=>{fn();flush();};
  const select=type=>action(()=>nodes.find(n=>n.dataset.layer===type).onclick());
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y)=>action(()=>{ids.get('canvas').onpointerdown(pointer(x,y));ids.get('canvas').onpointerup(pointer(x,y));});
  const input=(field,value)=>action(()=>{const el=ids.get(`scenario-${field}`);if(typeof value==='boolean')el.checked=value;else el.value=String(value);el.onchange();});
  const rows=id=>Object.fromEntries(ids.get(id).children.map(r=>r.children.map(c=>c.textContent)));
  assert.equal(ids.get('scenario-crew').disabled,true);assert.equal(ids.get('systems-range').textContent,'0 tiles');
  action(()=>{ids.get('mod-chapter1').checked=true;ids.get('mod-chapter1').onchange();});
  action(()=>{ids.get('engine-type').value='VGE_GravhulkEngine';ids.get('engine-type').onchange();});click(0,0);
  select('small-tank');click(5,5);select('small-thruster');click(8,5);
  assert.equal(ids.get('systems-range').textContent,'6 tiles');assert.equal(rows('systems-flight').Astrofuel,'250 / 250');
  input('fuelPercent',10);assert.equal(ids.get('systems-range').textContent,'5 tiles');
  input('distance',1);assert.match(ids.get('systems-jump').textContent,/1-tile jump: 25 astrofuel/);
  select('VGE_SmallOxygenTank');click(-8,5);select('VGE_LifeSupportSystem');click(-5,5);
  assert.equal(rows('systems-oxygen')['Reserve with production'],'No depletion');
  input('crew',8);assert.equal(rows('systems-oxygen')['Crew demand'],'160 / day');assert.equal(rows('systems-oxygen')['Reserve with production'],'6.25 days');
  input('oxygenPercent',50);input('cabinTiles',100);
  select('VGE_SmallHeatsink');click(12,5);assert.equal(rows('systems-heat')['Sink capacity'],'20 HU');
  input('heatPercent',100);assert.equal(rows('systems-heat')['Excess into rooms'],'5 HU');
  input('heatResearch',true);assert.equal(rows('systems-heat')['Sink capacity'],'40 HU');
  const changes=ids.get('systems-flight').replacements;ids.get('canvas').onpointermove(pointer(10,-5));flush();
  assert.equal(ids.get('systems-flight').replacements,changes,'hover does not rebuild system rows');
  action(()=>ids.get('save').onclick());const saved=JSON.parse(storage.get('gravship-designs-v1'))[0].state;
  assert.equal(saved.scenario.crew,8);assert.equal(saved.scenario.fuelPercent,10);assert.equal(saved.scenario.oxygenPercent,50);assert.equal(saved.scenario.cabinTiles,100);
  action(()=>ids.get('undo').onclick());assert.equal(ids.get('scenario-heatResearch').checked,false);assert.equal(rows('systems-heat')['Sink capacity'],'20 HU');
  action(()=>ids.get('redo').onclick());assert.equal(ids.get('scenario-heatResearch').checked,true);
  action(()=>ids.get('save').onclick());action(()=>ids.get('new').onclick());action(()=>ids.get('accept-confirm').onclick());
  assert.equal(ids.get('scenario-crew').value,'8','New preserves planning assumptions');assert.equal(ids.get('systems-range').textContent,'0 tiles');
  action(()=>ids.get('load').onclick());action(()=>ids.get('design-list').children[0].children[1].onclick());
  assert.equal(ids.get('scenario-fuelPercent').value,'10');assert.equal(ids.get('scenario-heatResearch').checked,true);assert.equal(ids.get('systems-range').textContent,'5 tiles');
  assert.equal(rows('systems-heat')['Sink capacity'],'40 HU');
});

test('hover and tool changes batch into one frame without design recomputation or edits',()=>{
  const {ids,nodes,counters,flush,pendingFrames,events}=createEditor(),canvas=ids.get('canvas');
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  canvas.onpointerdown(pointer(0,0));canvas.onpointerup(pointer(0,0));flush();
  nodes.find(n=>n.dataset.layer==='floor').onclick();flush();
  const before={...counters},inventoryUpdates=ids.get('component-inventory').replacements,checkUpdates=ids.get('checks').replacements;
  for(let i=0;i<100;i++)canvas.onpointermove(pointer(4+i%8,5));
  assert.equal(pendingFrames(),1);assert.equal(counters.frames,before.frames);
  flush();assert.equal(counters.frames,before.frames+1);assert.equal(counters.placement,before.placement+1);
  assert.equal(counters.apply,before.apply);assert.equal(counters.clones,before.clones);
  assert.equal(counters.validation,before.validation);assert.equal(counters.fields,before.fields);
  const last=pointer(4+99%8,5);for(let i=0;i<30;i++)canvas.onpointermove(last);
  assert.equal(pendingFrames(),0,'same-tile hover must not schedule more work');
  nodes.find(n=>n.dataset.layer==='small-thruster').onclick();events.keydown({key:'e',target:canvas,preventDefault(){}});
  ids.get('name').value='Renamed ship';ids.get('name').oninput();flush();
  assert.equal(counters.validation,before.validation);assert.equal(counters.fields,before.fields);assert.equal(counters.libraryReads,before.libraryReads);
  assert.equal(ids.get('component-inventory').replacements,inventoryUpdates);assert.equal(ids.get('checks').replacements,checkUpdates);
});

test('diagonal mode loads prepared images without pixel processing and updates after edits made while off',()=>{
  const {ids,nodes,requestedImages,hullCalls,finishHullImages,flush}=createEditor({deferHullTextures:true}),canvas=ids.get('canvas');
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y)=>{canvas.onpointerdown(pointer(x,y));canvas.onpointerup(pointer(x,y));flush();};
  click(0,0);nodes.find(n=>n.dataset.layer==='floor').onclick();flush();click(5,5);
  nodes.find(n=>n.dataset.layer==='hull').onclick();flush();click(5,5);
  const toggle=ids.get('diagonal-hull');toggle.checked=true;toggle.onchange();flush();
  assert.equal(requestedImages.filter(p=>p.startsWith('assets/hull-prepared/')).length,hull.HULL_REFERENCES.length);
  assert.equal(hullCalls.topology,0,'keep using the fast renderer while textures load');
  assert.equal(hullCalls.prepare,0);toggle.checked=false;toggle.onchange();flush();
  finishHullImages();assert.equal(hullCalls.topology,0);assert.equal(hullCalls.prepare,0);
  toggle.checked=true;toggle.onchange();flush();assert.equal(hullCalls.topology,1);
  toggle.checked=false;toggle.onchange();flush();click(6,5);click(6,6);
  assert.equal(hullCalls.update,0,'diagonal work remains off during painting');
  const imageRequests=requestedImages.length;toggle.checked=true;toggle.onchange();flush();
  assert.equal(hullCalls.topology,1);assert.equal(hullCalls.update,1);assert.equal(hullCalls.prepare,0);
  assert.equal(requestedImages.length,imageRequests,'prepared textures stay cached');
});

test('batched painting preserves coalesced curves and pointer-up endpoints in one undo step',()=>{
  const {ids,nodes,storage,counters,flush,pendingFrames}=createEditor(),canvas=ids.get('canvas');
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  canvas.onpointerdown(pointer(0,0));canvas.onpointerup(pointer(0,0));flush();
  nodes.find(n=>n.dataset.layer==='floor').onclick();flush();
  const before={...counters},inventoryUpdates=ids.get('component-inventory').replacements;
  canvas.onpointerdown(pointer(4,4));
  canvas.onpointermove({...pointer(4,8),getCoalescedEvents:()=>[pointer(8,4),pointer(8,8)]});
  const edits=counters.apply;for(let i=0;i<30;i++)canvas.onpointermove(pointer(4,8));assert.equal(counters.apply,edits);
  canvas.onpointerup(pointer(4,9));assert.equal(pendingFrames(),1);
  assert.equal(counters.validation,before.validation);flush();
  assert.equal(counters.frames,before.frames+1);assert.equal(counters.validation,before.validation+1);
  assert.equal(counters.fields,before.fields);assert.equal(ids.get('component-inventory').replacements,inventoryUpdates);
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  const painted=saved();assert.equal(painted.floor.length,14);
  for(const k of ['4,4','8,4','8,8','4,8','4,9'])assert.ok(painted.floor.includes(k));
  assert.ok(!painted.floor.includes('6,6'),'a curved stroke must not turn into a diagonal shortcut');
  ids.get('undo').onclick();flush();assert.equal(saved().floor.length,0);
  ids.get('redo').onclick();flush();assert.deepEqual(saved(),painted);
  canvas.onpointerdown(pointer(10,10));canvas.onpointermove(pointer(12,10));canvas.onpointercancel(pointer(12,10));flush();
  assert.deepEqual(saved(),painted,'cancel restores the entire stroke');
});

test('movement previews do not apply edits or clone the design before a drop',()=>{
  const {ids,nodes,storage,counters,flush}=createEditor(),canvas=ids.get('canvas');
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y)=>{canvas.onpointerdown(pointer(x,y));canvas.onpointerup(pointer(x,y));flush();};
  click(0,0);nodes.find(n=>n.dataset.layer==='small-thruster').onclick();flush();click(5,5);
  ids.get('select-mode').onclick();flush();canvas.onpointerdown(pointer(5,5));flush();
  const before={...counters};for(const p of [pointer(0,0),pointer(9,6),pointer(10,7)]){canvas.onpointermove(p);flush();}
  assert.equal(canvas.style.cursor,'grabbing');
  assert.equal(counters.previewMove,before.previewMove+3);assert.equal(counters.move,before.move);assert.equal(counters.apply,before.apply);assert.equal(counters.clones,before.clones);
  assert.equal(counters.validation,before.validation);assert.equal(counters.fields,before.fields);
  canvas.onpointerup(pointer(10,7));flush();assert.equal(counters.move,before.move+1);
  ids.get('save').onclick();const moved=JSON.parse(storage.get('gravship-designs-v1'))[0].state.components[0];
  assert.equal(moved.x,10);assert.equal(moved.y,7);
});

test('saved-design cache observes external storage changes without revalidating the ship',()=>{
  const {ids,storage,events,counters,flush}=createEditor(),before={...counters};
  storage.set('gravship-designs-v1',JSON.stringify([{id:'external',name:'Other tab',state:model.blank(),updated:0}]));
  events.storage({key:'gravship-designs-v1'});flush();
  assert.equal(ids.get('saved-count').textContent,1);assert.equal(counters.libraryReads,before.libraryReads+1);
  assert.equal(counters.validation,before.validation);assert.equal(counters.fields,before.fields);
  ids.get('name').oninput();flush();assert.equal(counters.libraryReads,before.libraryReads+1);
});

test('solar generator is searchable, fixed at 4x4, and places, moves, saves and erases by its full footprint',()=>{
  const {ids,nodes,storage,requestedImages,flush}=createEditor(),canvas=ids.get('canvas');
  const pointer=(x,y,button=0)=>({button,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y,button=0)=>{canvas.onpointerdown(pointer(x,y,button));canvas.onpointerup(pointer(x,y,button));flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  click(0,0);
  ids.get('component-search').value='solar';ids.get('component-search').oninput();
  const visible=nodes.filter(n=>n.className.split(' ').includes('component-item')&&!n.hidden);
  assert.equal(visible.length,1);assert.equal(visible[0].dataset.layer,'solar-generator');visible[0].onclick();flush();
  assert.ok(requestedImages.includes('assets/Solar_generator.png'));
  assert.equal(ids.get('rotation-label').textContent,'Fixed');assert.equal(ids.get('rotate').disabled,true);
  assert.ok(ids.get('shape-label').textContent.startsWith('4 × 4'));
  click(4,4);let design=saved();const solar=design.components[0],cells=catalogue.componentCells(solar);
  assert.equal(solar.type,'solar-generator');assert.equal(cells.length,16);
  assert.ok(cells.every(k=>model.validate(design).missing.includes(k)));
  assert.equal(model.apply(design,'heater',['7,7']).rejected,1,'bottom-right tile blocks other components');
  nodes.find(n=>n.dataset.layer==='floor').onclick();flush();
  nodes.find(n=>n.dataset.shape==='filled').onclick();flush();
  canvas.onpointerdown(pointer(4,4));canvas.onpointerup(pointer(7,7));flush();design=saved();
  assert.equal(design.floor.length,16);assert.ok(cells.every(k=>!model.validate(design).missing.includes(k)));
  ids.get('select-mode').onclick();flush();
  canvas.onpointerdown(pointer(7,7));canvas.onpointermove(pointer(12,8));canvas.onpointerup(pointer(12,8));flush();
  const moved=saved();assert.equal(moved.components[0].x,9);assert.equal(moved.components[0].y,5);assert.deepEqual(moved.floor,design.floor);
  ids.get('undo').onclick();flush();assert.equal(saved().components[0].x,4);
  visible[0].onclick();flush();click(7,7,2);assert.equal(saved().components.length,0);assert.equal(saved().floor.length,16);
});

test('live shape measurements update while dragging and disappear on release or cancellation',()=>{
  const {ids,nodes,drawnText,flush,counters}=createEditor(),canvas=ids.get('canvas');
  const pointer=(x,y,button=0)=>({button,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  canvas.onpointerdown(pointer(0,0));canvas.onpointerup(pointer(0,0));flush();
  nodes.find(n=>n.dataset.layer==='floor').onclick();flush();
  const choose=shape=>{nodes.find(n=>n.dataset.shape===shape).onclick();flush();};
  const text=()=>drawnText.map(label=>label.text);
  choose('rect');canvas.onpointerdown(pointer(4,4));canvas.onpointermove(pointer(8,10));flush();
  assert.deepEqual(text(),['20','5','7']);assert.equal(ids.get('used').textContent,0,'measurement does not place the preview');
  const validationCalls=counters.validation;canvas.onpointermove(pointer(7,10));flush();
  assert.deepEqual(text(),['18','7']);assert.equal(counters.validation,validationCalls);
  canvas.onpointermove(pointer(8,10));canvas.onpointerup(pointer(8,10));flush();
  assert.deepEqual(text(),[]);assert.equal(ids.get('used').textContent,20);
  choose('filled');canvas.onpointerdown(pointer(8,10));canvas.onpointermove(pointer(4,4));flush();assert.deepEqual(text(),['35','5','7']);
  canvas.onpointercancel(pointer(4,4));flush();assert.deepEqual(text(),[]);assert.equal(ids.get('used').textContent,20);
  choose('disc');canvas.onpointerdown(pointer(4,4));canvas.onpointermove(pointer(6,4));flush();assert.deepEqual(text(),['25','5','5']);
  canvas.onpointercancel(pointer(6,4));flush();
  choose('line');canvas.onpointerdown(pointer(4,4));canvas.onpointermove(pointer(10,4));flush();assert.deepEqual(text(),['7']);
  canvas.onpointercancel(pointer(10,4));flush();
  choose('diagonal');canvas.onpointerdown(pointer(4,4));canvas.onpointermove(pointer(10,8));flush();assert.deepEqual(text(),['7','7','5']);
  canvas.onpointercancel(pointer(10,8));flush();assert.deepEqual(text(),[]);
  choose('single');canvas.onpointerdown(pointer(4,4));canvas.onpointermove(pointer(10,4));flush();assert.deepEqual(text(),[]);
  canvas.onpointercancel(pointer(10,4));flush();
  choose('rect');canvas.onpointerdown(pointer(4,4,1));canvas.onpointermove(pointer(8,10,1));flush();assert.deepEqual(text(),[]);
  canvas.onpointerup(pointer(8,10,1));flush();
});
