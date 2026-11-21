import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as model from './model.js';
import * as catalogue from './components.js';
import * as hull from './hull.js';

function createEditor(){
  const frameQueue=[],counters={frames:0,validation:0,fields:0,apply:0,placement:0,previewMove:0,move:0,libraryReads:0,clones:0};
  let frameId=0;
  const flush=()=>{let passes=0;while(frameQueue.length){assert.ok(passes++<10,'rendering should settle');const batch=frameQueue.splice(0);for(const callback of batch)callback(0);}};

  const nodes=[],ids=new Map(),storage=new Map(),events={},requestedImages=[],hullCalls={topology:0,prepare:0,simple:0,diagonal:0};
  const trackHull=(name,fn)=>(...args)=>{hullCalls[name]++;return fn(...args);};
  class Element{
    constructor(tag='div'){this.tagName=tag;this.dataset={};this.children=[];this.style={};this.attributes={};this.className='';this.value='';this.checked=true;this.hidden=false;this.classList={toggle:(c,on)=>{const set=new Set(this.className.split(' '));on?set.add(c):set.delete(c);this.className=[...set].join(' ');},add:()=>{},remove:()=>{}};nodes.push(this);}
    set innerHTML(value){this.html=value;if(value.includes('component-quantity')){const q=new Element('span');q.className='component-quantity';this.append(q);}}
    get innerHTML(){return this.html||'';}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;this.replacements=(this.replacements||0)+1;}
    setAttribute(k,v){this.attributes[k]=v;}
    querySelector(q){return this.children.find(c=>c.className?.split(' ').includes(q.slice(1)));}
    matches(q){return q.split(',').includes(this.tagName);}
    getBoundingClientRect(){return {left:0,top:0,width:900,height:600};}
    focus(){} setPointerCapture(){} addEventListener(){} showModal(){this.open=true;}close(){this.open=false;}
  }
  const html=readFileSync('index.html','utf8');
  for(const match of html.matchAll(/<([\w-]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const el=new Element(match[1]);el.id=match[2];ids.set(el.id,el);}
  ids.get('name').value='Integration test';
  const ctx=new Proxy({clearRect:()=>counters.frames++}, {get:(target,k)=>target[k]||(()=>{}),set:(target,k,v)=>(target[k]=v,true)});
  ids.get('canvas').getContext=()=>ctx;
  const queryAll=q=>q==='[data-layer]'?nodes.filter(n=>n.dataset.layer):q==='[data-shape]'?nodes.filter(n=>n.dataset.shape):q==='.component-item'?nodes.filter(n=>n.className.split(' ').includes('component-item')):q==='#component-options h3'?ids.get('component-options').children.filter(n=>n.tagName==='h3'):[];
  const document={getElementById:id=>{assert.ok(ids.has(id),`Missing element ${id}`);return ids.get(id);},createElement:t=>new Element(t),createTextNode:text=>({textContent:text}),querySelectorAll:queryAll,querySelector:q=>q==='dialog[open]'?[...ids.values()].find(n=>n.tagName==='dialog'&&n.open):null};
  const window={devicePixelRatio:1,addEventListener:(type,fn)=>events[type]=fn,requestAnimationFrame:fn=>{frameQueue.push(fn);return ++frameId;}};
  const sandbox={...model,...catalogue,...hull,document,window,localStorage:{getItem:k=>{if(k==='gravship-designs-v1')counters.libraryReads++;return storage.get(k)||null;},setItem:(k,v)=>storage.set(k,v)},structuredClone:value=>{counters.clones++;return structuredClone(value);},crypto:{randomUUID:()=> 'test-design'},console,OffscreenCanvas:class{constructor(w,h){this.width=w;this.height=h;}getContext(){return {drawImage(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}};}},Image:class{set src(value){this.srcValue=value;const data=readFileSync(value);if(value.endsWith('.png')){this.width=data.readUInt32BE(16);this.height=data.readUInt32BE(20);}else{this.width=64;this.height=64;}this.onload?.();}},ResizeObserver:class{observe(){}},setTimeout:()=>0,clearTimeout:()=>{}};
  for(const [name,fn] of [['topology','hullTopology'],['prepare','prepareHullTexture'],['simple','drawSimpleHull'],['diagonal','drawHull']])sandbox[fn]=trackHull(name,hull[fn]);
  for(const [name,fn] of [['validation','validate'],['fields','fieldCells'],['apply','apply'],['placement','checkPlacement'],['previewMove','previewMove'],['move','moveItem']])sandbox[fn]=(...args)=>{counters[name]++;return model[fn](...args);};
  const MockImage=sandbox.Image;
  sandbox.Image=class extends MockImage{set src(value){requestedImages.push(value);super.src=value;}};
  const source=readFileSync('app.js','utf8').replace(/^import .+;\r?\n/gm,'');
  vm.runInNewContext(source,sandbox,{filename:'app.js'});
  flush();
  return {nodes,ids,storage,events,requestedImages,hullCalls,queryAll,flush,counters,pendingFrames:()=>frameQueue.length};
}

test('editor boots and supports palette, Q/E/buttons, placement, undo/redo and local save',()=>{
  const {nodes,ids,storage,events,requestedImages,hullCalls,queryAll,flush}=createEditor();
  const action=fn=>{fn();flush();};
  assert.equal(queryAll('.component-item').length,14);
  assert.equal(ids.get('diagonal-hull').checked,false);
  assert.equal(hullCalls.topology,0);assert.equal(hullCalls.prepare,0);assert.equal(hullCalls.diagonal,0);
  assert.ok(hullCalls.simple>0);
  assert.deepEqual(requestedImages.filter(path=>path.startsWith('assets/hull-')),['assets/hull-3x3.png']);
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

  // The slow renderer is opt-in, view-only, cached per design state, and loaded once.
  const beforeToggle=saveState();assert.equal(hullCalls.topology,0);assert.equal(hullCalls.prepare,0);
  const diagonal=ids.get('diagonal-hull');diagonal.checked=true;diagonal.onchange();flush();
  assert.equal(hullCalls.topology,1);assert.equal(hullCalls.prepare,hull.HULL_REFERENCES.length);assert.ok(hullCalls.diagonal>0);
  assert.deepEqual(saveState(),beforeToggle);assert.equal(hullCalls.topology,1,'UI refresh does not rebuild unchanged hull');
  const loadedImages=requestedImages.length,prepared=hullCalls.prepare;
  diagonal.checked=false;diagonal.onchange();flush();
  const fastCalls=hullCalls.simple;select('hull');assert.ok(hullCalls.simple>fastCalls);assert.equal(hullCalls.topology,1);
  diagonal.checked=true;diagonal.onchange();flush();assert.equal(hullCalls.topology,1);assert.equal(requestedImages.length,loadedImages);assert.equal(hullCalls.prepare,prepared);
  // A real edit invalidates the detailed layout; the next toggle itself preserves undo.
  clickTile(13,4);assert.equal(hullCalls.topology,2);
  diagonal.checked=false;diagonal.onchange();flush();action(()=>ids.get('undo').onclick());
  assert.deepEqual(saveState(),beforeToggle);assert.equal(hullCalls.topology,2);
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
