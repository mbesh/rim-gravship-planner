import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as model from './model.js';
import * as catalogue from './components.js';
import * as hull from './hull.js';

test('editor boots and supports palette, Q/E/buttons, placement, undo/redo and local save',()=>{
  const nodes=[],ids=new Map(),storage=new Map(),events={},requestedImages=[],hullCalls={topology:0,prepare:0,simple:0,diagonal:0};
  const trackHull=(name,fn)=>(...args)=>{hullCalls[name]++;return fn(...args);};
  class Element{
    constructor(tag='div'){this.tagName=tag;this.dataset={};this.children=[];this.style={};this.attributes={};this.className='';this.value='';this.checked=true;this.hidden=false;this.classList={toggle:(c,on)=>{const set=new Set(this.className.split(' '));on?set.add(c):set.delete(c);this.className=[...set].join(' ');},add:()=>{},remove:()=>{}};nodes.push(this);}
    set innerHTML(value){this.html=value;if(value.includes('component-quantity')){const q=new Element('span');q.className='component-quantity';this.append(q);}}
    get innerHTML(){return this.html||'';}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;}
    setAttribute(k,v){this.attributes[k]=v;}
    querySelector(q){return this.children.find(c=>c.className?.split(' ').includes(q.slice(1)));}
    matches(q){return q.split(',').includes(this.tagName);}
    getBoundingClientRect(){return {left:0,top:0,width:900,height:600};}
    focus(){} setPointerCapture(){} addEventListener(){} showModal(){this.open=true;}close(){this.open=false;}
  }
  const html=readFileSync('index.html','utf8');
  for(const match of html.matchAll(/<([\w-]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const el=new Element(match[1]);el.id=match[2];ids.set(el.id,el);}
  ids.get('name').value='Integration test';
  const ctx=new Proxy({}, {get:(target,k)=>target[k]||(()=>{}),set:(target,k,v)=>(target[k]=v,true)});
  ids.get('canvas').getContext=()=>ctx;
  const queryAll=q=>q==='[data-layer]'?nodes.filter(n=>n.dataset.layer):q==='[data-shape]'?nodes.filter(n=>n.dataset.shape):q==='.component-item'?nodes.filter(n=>n.className.split(' ').includes('component-item')):q==='#component-options h3'?ids.get('component-options').children.filter(n=>n.tagName==='h3'):[];
  const document={getElementById:id=>{assert.ok(ids.has(id),`Missing element ${id}`);return ids.get(id);},createElement:t=>new Element(t),createTextNode:text=>({textContent:text}),querySelectorAll:queryAll,querySelector:q=>q==='dialog[open]'?[...ids.values()].find(n=>n.tagName==='dialog'&&n.open):null};
  const window={devicePixelRatio:1,addEventListener:(type,fn)=>events[type]=fn};
  const sandbox={...model,...catalogue,...hull,document,window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},structuredClone,crypto:{randomUUID:()=> 'test-design'},console,OffscreenCanvas:class{constructor(w,h){this.width=w;this.height=h;}getContext(){return {drawImage(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}};}},Image:class{set src(value){this.srcValue=value;const data=readFileSync(value);if(value.endsWith('.png')){this.width=data.readUInt32BE(16);this.height=data.readUInt32BE(20);}else{this.width=64;this.height=64;}this.onload?.();}},ResizeObserver:class{observe(){}},setTimeout:()=>0,clearTimeout:()=>{}};
  for(const [name,fn] of [['topology','hullTopology'],['prepare','prepareHullTexture'],['simple','drawSimpleHull'],['diagonal','drawHull']])sandbox[fn]=trackHull(name,hull[fn]);
  const MockImage=sandbox.Image;
  sandbox.Image=class extends MockImage{set src(value){requestedImages.push(value);super.src=value;}};
  const source=readFileSync('app.js','utf8').replace(/^import .+;\r?\n/gm,'');
  vm.runInNewContext(source,sandbox,{filename:'app.js'});
  assert.equal(queryAll('.component-item').length,14);
  assert.equal(ids.get('diagonal-hull').checked,false);
  assert.equal(hullCalls.topology,0);assert.equal(hullCalls.prepare,0);assert.equal(hullCalls.diagonal,0);
  assert.ok(hullCalls.simple>0);
  assert.deepEqual(requestedImages.filter(path=>path.startsWith('assets/hull-')),['assets/hull-3x3.png']);
  const select=type=>nodes.find(n=>n.dataset.layer===type).onclick();
  const keyboard=key=>events.keydown({key,target:ids.get('canvas'),preventDefault(){}});
  const clickTile=(x,y)=>{const e={button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}};ids.get('canvas').onpointerdown(e);ids.get('canvas').onpointerup(e);};
  clickTile(0,0);assert.equal(ids.get('engine-count').textContent,'1 / 1');
  select('small-thruster');assert.equal(ids.get('rotation-label').textContent,'South');
  keyboard('q');assert.equal(ids.get('rotation-label').textContent,'East');
  keyboard('e');assert.equal(ids.get('rotation-label').textContent,'South');
  ids.get('rotate').onclick();assert.equal(ids.get('rotation-label').textContent,'West');
  ids.get('rotate-left').onclick();assert.equal(ids.get('rotation-label').textContent,'South');
  keyboard('q');clickTile(5,5);assert.equal(ids.get('component-count').textContent,1);
  ids.get('save').onclick();const saved=JSON.parse(storage.get('gravship-designs-v1'))[0];
  assert.equal(saved.state.components[0].rotation,3);assert.equal(saved.state.components[0].x,5);
  ids.get('undo').onclick();assert.equal(ids.get('component-count').textContent,0);
  ids.get('redo').onclick();assert.equal(ids.get('component-count').textContent,1);
  select('signal-jammer');assert.equal(ids.get('rotate').disabled,true);keyboard('e');assert.equal(ids.get('rotation-label').textContent,'Fixed');
  select('autodoor');assert.equal(ids.get('rotation-label').textContent,'North/south');
  keyboard('e');assert.equal(ids.get('rotation-label').textContent,'East/west');
  keyboard('e');assert.equal(ids.get('rotation-label').textContent,'North/south');
  keyboard('q');assert.equal(ids.get('rotation-label').textContent,'East/west');
  ids.get('rotate').onclick();assert.equal(ids.get('rotation-label').textContent,'North/south');
  const pointer=(x,y,button=0)=>({button,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const saveState=()=>{ids.get('save').onclick();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  // An empty-space right click switches out of painting without touching the design.
  const before=saveState();const empty=pointer(17,10,2);
  ids.get('canvas').onpointerdown(empty);ids.get('canvas').onpointerup(empty);
  assert.equal(ids.get('mode-label').textContent,'Select / move');assert.deepEqual(saveState(),before);
  const start=pointer(6,5),end=pointer(9,6); // Grab the second tile, preserving the cursor offset.
  ids.get('canvas').onpointerdown(start);ids.get('canvas').onpointermove(end);ids.get('canvas').onpointerup(end);
  let movedState=saveState();assert.equal(movedState.components[0].x,8);assert.equal(movedState.components[0].y,6);assert.equal(movedState.components[0].rotation,3);
  ids.get('undo').onclick();assert.equal(saveState().components[0].x,5);
  ids.get('redo').onclick();assert.equal(saveState().components[0].x,8);
  // Invalid drops leave the component at its previous position.
  ids.get('canvas').onpointerdown(pointer(8,6));ids.get('canvas').onpointermove(pointer(0,0));ids.get('canvas').onpointerup(pointer(0,0));
  assert.equal(saveState().components[0].x,8);
  // Escape cancels an in-flight move and clears the selection.
  ids.get('canvas').onpointerdown(pointer(8,6));ids.get('canvas').onpointermove(pointer(10,8));keyboard('Escape');
  ids.get('canvas').onpointerup(pointer(10,8));assert.equal(saveState().components[0].x,8);assert.equal(ids.get('mode-label').textContent,'Select / move');
  // Select mode also has a visible entry point.
  select('heater');ids.get('select-mode').onclick();assert.equal(ids.get('mode-label').textContent,'Select / move');
  // Replacing a wall/door works through the editor and remains undoable.
  select('floor');clickTile(12,4);select('hull');clickTile(12,4);select('autodoor');clickTile(12,4);
  assert.ok(!saveState().hull.includes('12,4'));assert.ok(saveState().components.some(c=>c.type==='autodoor'));
  select('hull');clickTile(12,4);assert.ok(saveState().hull.includes('12,4'));assert.ok(!saveState().components.some(c=>c.type==='autodoor'));
  ids.get('undo').onclick();assert.ok(saveState().components.some(c=>c.type==='autodoor'));
  ids.get('component-search').value='tank';ids.get('component-search').oninput();assert.equal(queryAll('.component-item').filter(n=>!n.hidden).length,2);

  // The slow renderer is opt-in, view-only, cached per design state, and loaded once.
  const beforeToggle=saveState();assert.equal(hullCalls.topology,0);assert.equal(hullCalls.prepare,0);
  const diagonal=ids.get('diagonal-hull');diagonal.checked=true;diagonal.onchange();
  assert.equal(hullCalls.topology,1);assert.equal(hullCalls.prepare,hull.HULL_REFERENCES.length);assert.ok(hullCalls.diagonal>0);
  assert.deepEqual(saveState(),beforeToggle);assert.equal(hullCalls.topology,1,'UI refresh does not rebuild unchanged hull');
  const loadedImages=requestedImages.length,prepared=hullCalls.prepare;
  diagonal.checked=false;diagonal.onchange();
  const fastCalls=hullCalls.simple;select('hull');assert.ok(hullCalls.simple>fastCalls);assert.equal(hullCalls.topology,1);
  diagonal.checked=true;diagonal.onchange();assert.equal(hullCalls.topology,1);assert.equal(requestedImages.length,loadedImages);assert.equal(hullCalls.prepare,prepared);
  // A real edit invalidates the detailed layout; the next toggle itself preserves undo.
  clickTile(13,4);assert.equal(hullCalls.topology,2);
  diagonal.checked=false;diagonal.onchange();ids.get('undo').onclick();
  assert.deepEqual(saveState(),beforeToggle);assert.equal(hullCalls.topology,2);
});
