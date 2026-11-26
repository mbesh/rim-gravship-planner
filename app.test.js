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

function createEditor({deferHullTextures=false,viewport=null}={}){
  const pendingHullImages=[],drawnText=[],drawnImages=[],drawnRects=[];
  const frameQueue=[],counters={frames:0,validation:0,fields:0,apply:0,placement:0,previewMove:0,move:0,libraryReads:0,clones:0};
  let frameId=0;
  const flush=()=>{let passes=0;while(frameQueue.length){assert.ok(passes++<10,'rendering should settle');const batch=frameQueue.splice(0);for(const callback of batch)callback(0);}};

  const nodes=[],ids=new Map(),storage=new Map(),events={},requestedImages=[],hullCalls={topology:0,update:0,prepare:0,simple:0,diagonal:0};
  const trackHull=(name,fn)=>(...args)=>{hullCalls[name]++;return fn(...args);};
  class Element{
    constructor(tag='div'){this.tagName=tag;this.dataset={};this.children=[];this.style={};this.attributes={};this.className='';this.value='';this.checked=true;this.hidden=false;this.scrollTop=0;this.classList={toggle:(c,on)=>{const set=new Set(this.className.split(' '));on?set.add(c):set.delete(c);this.className=[...set].join(' ');},contains:c=>this.className.split(' ').includes(c),add:c=>this.classList.toggle(c,true),remove:c=>this.classList.toggle(c,false)};nodes.push(this);}
    set innerHTML(value){this.html=value;this.children=[];for(const tag of ['strong','small','img']){if(value.includes('<'+tag)){const e=new Element(tag);e.textContent=value.match(new RegExp('<'+tag+'[^>]*>([^<]*)'))?.[1]||'';this.append(e);}}if(value.includes('component-quantity')){const q=new Element('span');q.className='component-quantity';this.append(q);}}
    get innerHTML(){return this.html||'';}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;this.replacements=(this.replacements||0)+1;}
    setAttribute(k,v){this.attributes[k]=v;}
    querySelector(q){return this.children.find(c=>q.startsWith('.')?c.className?.split(' ').includes(q.slice(1)):c.tagName===q);}
    matches(q){return q.split(',').includes(this.tagName);}
    getBoundingClientRect(){return {left:0,top:0,width:900,height:600};}
    focus(){document.activeElement=this;this.onfocus?.();} blur(){if(document.activeElement===this)document.activeElement=null;} setPointerCapture(){} addEventListener(){} showModal(){this.open=true;}close(){this.open=false;}
  }
  const html=readFileSync('index.html','utf8');
  for(const match of html.matchAll(/<([\w-]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const el=new Element(match[1]);el.id=match[2];ids.set(el.id,el);}
  ids.get('name').value='Integration test';
  const ctx=new Proxy({clearRect:()=>{counters.frames++;drawnText.length=0;drawnImages.length=0;drawnRects.length=0;},fillRect:(...args)=>drawnRects.push({color:ctx.fillStyle,args}),drawImage:(im,...args)=>drawnImages.push({file:im.srcValue,args}),measureText:text=>({width:String(text).length*7}),fillText:(text,x,y)=>drawnText.push({text,x,y})}, {get:(target,k)=>target[k]||(()=>{}),set:(target,k,v)=>(target[k]=v,true)});
  ids.get('canvas').getContext=()=>ctx;
  const queryAll=q=>q==='[data-layer]'?nodes.filter(n=>n.dataset.layer):q==='[data-shape]'?nodes.filter(n=>n.dataset.shape):q==='.component-item'?nodes.filter(n=>n.className.split(' ').includes('component-item')):q==='.component-group'?nodes.filter(n=>n.className==='component-group'):[];
  const document={getElementById:id=>{assert.ok(ids.has(id),`Missing element ${id}`);return ids.get(id);},createElement:t=>new Element(t),createTextNode:text=>({textContent:text}),querySelectorAll:queryAll,querySelector:q=>q==='dialog[open]'?[...ids.values()].find(n=>n.tagName==='dialog'&&n.open):null};
  const window={devicePixelRatio:1,addEventListener:(type,fn)=>events[type]=fn,requestAnimationFrame:fn=>{frameQueue.push(fn);return ++frameId;}};
  const viewportEvents={},cssProperties=new Map(),media={matches:!!viewport,addEventListener(){}};
  if(viewport){
    document.documentElement={style:{setProperty:(name,value)=>cssProperties.set(name,value)}};
    window.innerWidth=390;window.innerHeight=844;window.matchMedia=()=>media;
    window.visualViewport={...viewport,addEventListener:(type,fn)=>viewportEvents[type]=fn};
    const summary=new Element('summary');summary.getBoundingClientRect=()=>({height:44});ids.get('palette-panel').append(summary);
  }
  const sandbox={...model,...catalogue,...hull,...measurements,...release,...mods,...scenario,...systems,...systemsUI,document,window,localStorage:{getItem:k=>{if(k==='gravship-designs-v1')counters.libraryReads++;return storage.get(k)||null;},setItem:(k,v)=>storage.set(k,v)},structuredClone:value=>{counters.clones++;return structuredClone(value);},crypto:{randomUUID:()=> 'test-design'},console,OffscreenCanvas:class{constructor(w,h){this.width=w;this.height=h;}getContext(){return {drawImage(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}};}},Image:class{set src(value){this.srcValue=value;const data=readFileSync(value);if(value.endsWith('.png')){this.width=data.readUInt32BE(16);this.height=data.readUInt32BE(20);}else{this.width=64;this.height=64;}if(deferHullTextures&&value.startsWith('assets/hull-prepared/'))pendingHullImages.push(()=>this.onload?.());else this.onload?.();}},ResizeObserver:class{observe(){}},setTimeout:()=>0,clearTimeout:()=>{}};
  for(const [name,fn] of [['topology','hullTopology'],['update','updateHullTopology'],['prepare','prepareHullTexture'],['simple','drawSimpleHull'],['diagonal','drawHull']])sandbox[fn]=trackHull(name,hull[fn]);
  for(const [name,fn] of [['validation','validate'],['fields','fieldCells'],['apply','apply'],['placement','checkPlacement'],['previewMove','previewMove'],['move','moveItem']])sandbox[fn]=(...args)=>{counters[name]++;return model[fn](...args);};
  const MockImage=sandbox.Image;
  sandbox.Image=class extends MockImage{set src(value){requestedImages.push(value);super.src=value;}};
  const source=readFileSync('app.js','utf8').replace(/^import .+;\r?\n/gm,'');
  vm.runInNewContext(source,sandbox,{filename:'app.js'});
  flush();
  return {nodes,ids,storage,events,document,window,viewportEvents,cssProperties,media,drawnText,drawnImages,drawnRects,requestedImages,hullCalls,queryAll,flush,counters,pendingFrames:()=>frameQueue.length,finishHullImages:()=>{for(const load of pendingHullImages.splice(0))load();flush();}};
}

test('mobile search stays within the visual viewport through keyboard resize and pan, and restores the palette on close',()=>{
  const {ids,document,window,viewportEvents,cssProperties,media,counters}=createEditor({viewport:{width:390,height:750,offsetTop:0,offsetLeft:0}});
  const panel=ids.get('palette-panel'),input=ids.get('component-search');
  panel.open=true;panel.scrollTop=200;
  panel.getBoundingClientRect=()=>({top:50,bottom:400});
  input.getBoundingClientRect=()=>({top:120-panel.scrollTop,bottom:164-panel.scrollTop});
  input.focus();assert.equal(panel.classList.contains('searching'),true);
  assert.equal(panel.scrollTop,14,'input clears the sticky palette heading');
  Object.assign(window.visualViewport,{height:320,offsetTop:38,offsetLeft:5});viewportEvents.resize();viewportEvents.scroll();
  assert.equal(cssProperties.get('--app-height'),'320px');assert.equal(cssProperties.get('--viewport-top'),'38px');
  assert.equal(cssProperties.get('--viewport-left'),'5px');assert.equal(cssProperties.get('--viewport-width'),'390px');
  panel.scrollTop=180;input.value='bed';input.oninput();assert.equal(panel.scrollTop,14,'filtering keeps the input visible');
  input.blur();assert.equal(panel.classList.contains('searching'),true,'retain result positions between blur and the result click');
  input.focus();panel.open=false;panel.ontoggle();assert.equal(panel.classList.contains('searching'),false);assert.equal(document.activeElement,null);
  window.visualViewport=null;window.innerHeight=360;window.innerWidth=844;
  panel.open=true;input.focus();assert.equal(cssProperties.get('--app-height'),'360px');assert.equal(cssProperties.get('--viewport-top'),'0px');assert.equal(cssProperties.get('--viewport-width'),'844px','window dimensions are the fallback without VisualViewport');
  panel.open=true;input.focus();media.matches=false;viewportEvents.resize();assert.equal(panel.classList.contains('searching'),false,'desktop restores the floating palette');
  assert.equal(counters.apply,0,'search and keyboard events never edit the design');
});

test('editor boots and supports palette, Q/E/buttons, placement, undo/redo and local save',()=>{
  const {nodes,ids,storage,events,requestedImages,hullCalls,queryAll,flush}=createEditor();
  const action=fn=>{fn();flush();};
  assert.equal(queryAll('.component-item').filter(n=>!n.hidden).length,119);
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
  toggle('mod-chapter1',true);assert.equal(queryAll('.component-item').filter(n=>!n.hidden).length,196);
  assert.equal(ids.get('engine-type').children.length,3);assert.equal(ids.get('capacity-note').textContent,'Place an engine to support 250 tiles.');
  assert.equal(nodes.find(n=>n.dataset.layer==='small-tank').querySelector('strong').textContent,'Small astrofuel tank');
  assert.equal(requestedImages.some(p=>p.startsWith('assets/mods/chapter2/')),false);
  toggle('mod-chapter2',true);assert.equal(ids.get('mod-chapter1').checked,true);assert.equal(queryAll('.component-item').filter(n=>!n.hidden).length,228);
  action(()=>{ids.get('engine-type').value='VGE_GravhulkEngine';ids.get('engine-type').onchange();});click(0,0);
  assert.equal(ids.get('capacity').textContent,'500');assert.equal(ids.get('engine-radius').textContent,23.9);assert.equal(ids.get('extender-count').textContent,'0 / 10');
  select('fuel-optimizer');assert.equal(ids.get('rotate').disabled,false);
  action(()=>events.keydown({key:'e',target:ids.get('canvas'),preventDefault(){}}));assert.equal(ids.get('rotation-label').textContent,'West');click(5,5);
  select('VGE_Warcomputer');click(8,5);const before=saved();assert.equal(before.components.length,2);assert.equal(before.components[0].rotation,1);
  toggle('mod-chapter1',false);assert.equal(ids.get('mod-chapter2').checked,false);assert.equal(queryAll('.component-item').filter(n=>!n.hidden).length,119);
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
  assert.equal(ids.get('systems-electricity-total').textContent,'0 W');
  action(()=>{ids.get('mod-chapter1').checked=true;ids.get('mod-chapter1').onchange();});
  action(()=>{ids.get('engine-type').value='VGE_GravhulkEngine';ids.get('engine-type').onchange();});click(0,0);
  assert.equal(rows('systems-electricity')['Grav engine'],'7,200 W');
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
  assert.equal(ids.get('systems-electricity-total').textContent,'7,300 W');assert.equal(rows('systems-electricity')['From stored heat'],'100 W');
  const changes=ids.get('systems-flight').replacements;ids.get('canvas').onpointermove(pointer(10,-5));flush();
  assert.equal(ids.get('systems-flight').replacements,changes,'hover does not rebuild system rows');
  action(()=>ids.get('save').onclick());const saved=JSON.parse(storage.get('gravship-designs-v1'))[0].state;
  assert.equal(saved.scenario.crew,8);assert.equal(saved.scenario.fuelPercent,10);assert.equal(saved.scenario.oxygenPercent,50);assert.equal(saved.scenario.cabinTiles,100);
  action(()=>ids.get('undo').onclick());assert.equal(ids.get('scenario-heatResearch').checked,false);assert.equal(rows('systems-heat')['Sink capacity'],'20 HU');
  assert.equal(ids.get('systems-electricity-total').textContent,'7,250 W');
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


test('two-finger navigation rolls back painting, preserves history, and waits for all fingers to lift',()=>{
  const {ids,nodes,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const touch=(id,x,y)=>({button:0,pointerId:id,pointerType:'touch',clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y)=>{canvas.onpointerdown(touch(1,x,y));canvas.onpointerup(touch(1,x,y));flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  click(0,0);nodes.find(n=>n.dataset.layer==='floor').onclick();flush();click(1,1);
  const before=saved();
  canvas.onpointerdown(touch(1,4,4));canvas.onpointermove(touch(1,5,4));flush();assert.ok(ids.get('used').textContent>1);
  canvas.onpointerdown(touch(2,8,4));
  canvas.onpointermove(touch(1,3,5));canvas.onpointermove(touch(2,10,5));flush();
  assert.deepEqual(saved(),before,'pinch cancels the whole unfinished stroke');
  assert.notEqual(ids.get('zoom-level').textContent,'100%');
  canvas.onpointerup(touch(1,3,5));canvas.onlostpointercapture(touch(1,3,5));
  canvas.onpointermove(touch(2,12,5));canvas.onpointerup(touch(2,12,5));flush();assert.deepEqual(saved(),before);
  ids.get('undo').onclick();flush();assert.equal(saved().floor.length,0,'navigation creates no undo entry');
  ids.get('redo').onclick();flush();assert.deepEqual(saved(),before);
  click(2,2);assert.equal(saved().floor.length,2,'normal drawing resumes after every finger is released');
});

test('Pan mode moves the view without editing, supports touch, and returns to the previous drawing tool',()=>{
  const {ids,nodes,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const pointer=(x,y)=>({button:0,pointerId:1,pointerType:'touch',clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const stroke=(a,b)=>{canvas.onpointerdown(pointer(...a));canvas.onpointermove(pointer(...b));canvas.onpointerup(pointer(...b));flush();};
  const saved=()=>{ids.get('save').onclick();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  stroke([0,0],[0,0]);nodes.find(n=>n.dataset.layer==='floor').onclick();flush();
  ids.get('pan-mode').onclick();flush();assert.equal(ids.get('mode-label').textContent,'Pan view');assert.equal(ids.get('add').disabled,true);
  stroke([5,5],[7,6]);assert.equal(saved().floor.length,0);
  ids.get('pan-mode').onclick();flush();assert.equal(ids.get('mode-label').textContent,'Place substructure');
  stroke([5,5],[5,5]);assert.deepEqual(saved().floor,['3,4'],'painting uses the translated camera');
  ids.get('pan-mode').onclick();nodes.find(n=>n.dataset.layer==='hull').onclick();flush();
  assert.equal(ids.get('pan-mode').attributes['aria-pressed'],false,'choosing a part exits Pan mode');
});

test('pointer ownership and touch cancellation do not commit another finger or lose an edit',()=>{
  const {ids,nodes,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const pointer=(id,x,y,type='pen')=>({button:0,pointerId:id,pointerType:type,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  canvas.onpointerdown(pointer(1,0,0));canvas.onpointerup(pointer(1,0,0));nodes.find(n=>n.dataset.layer==='floor').onclick();flush();
  canvas.onpointerdown(pointer(1,4,4));canvas.onpointerdown(pointer(2,8,8));canvas.onpointermove(pointer(2,10,8));canvas.onpointerup(pointer(2,10,8));
  canvas.onpointermove(pointer(1,5,4));canvas.onpointerup(pointer(1,5,4));flush();assert.deepEqual(saved().floor,['4,4','5,4']);
  canvas.onpointerdown(pointer(1,8,8,'touch'));canvas.onpointerdown(pointer(2,10,8,'touch'));canvas.onpointercancel(pointer(2,10,8,'touch'));
  canvas.onpointermove(pointer(1,7,8,'touch'));canvas.onpointerup(pointer(1,7,8,'touch'));flush();assert.deepEqual(saved().floor,['4,4','5,4']);
});

test('first save asks for a name, trims it, and subsequent saves update the same design',()=>{
  const {ids,storage,flush}=createEditor();ids.get('name').value='Untitled gravship';ids.get('save').onclick();
  assert.equal(ids.get('save-dialog').open,true);assert.equal(storage.has('gravship-designs-v1'),false);
  ids.get('save-name').value='  ';ids.get('save-form').onsubmit({preventDefault(){}});assert.equal(storage.has('gravship-designs-v1'),false);
  ids.get('save-name').value='  The Horizon  ';ids.get('save-form').onsubmit({preventDefault(){}});flush();
  let designs=JSON.parse(storage.get('gravship-designs-v1'));assert.equal(designs.length,1);assert.equal(designs[0].name,'The Horizon');
  assert.equal(ids.get('name').value,'The Horizon');assert.equal(ids.get('save-dialog').open,false);
  ids.get('name').value='Horizon II';ids.get('name').oninput();ids.get('save').onclick();flush();
  designs=JSON.parse(storage.get('gravship-designs-v1'));assert.equal(designs.length,1);assert.equal(designs[0].name,'Horizon II');
});

test('component search opens matching categories and the shape picker updates the drawing tool',()=>{
  const {ids,nodes,queryAll,flush}=createEditor();
  for(const group of queryAll('.component-group'))group.open=false;
  ids.get('component-search').value='solar';ids.get('component-search').oninput();
  const groups=queryAll('.component-group').filter(g=>!g.hidden);assert.equal(groups.length,1);assert.equal(groups[0].open,true);
  nodes.find(n=>n.dataset.layer==='floor').onclick();ids.get('shape-picker').value='disc';ids.get('shape-picker').onchange();flush();
  assert.equal(ids.get('shape-label').textContent,'Filled circle');assert.equal(nodes.find(n=>n.dataset.shape==='disc').attributes['aria-pressed'],true);
});


test('selected component removal preserves foundations, clears selection, and is one undoable edit',()=>{
  const {ids,nodes,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y)=>{canvas.onpointerdown(pointer(x,y));canvas.onpointerup(pointer(x,y));flush();};
  const choose=type=>{nodes.find(n=>n.dataset.layer===type).onclick();flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  click(0,0);choose('floor');click(4,4);click(4,5);choose('small-thruster');click(4,4);
  const before=saved();ids.get('select-mode').onclick();flush();
  assert.equal(ids.get('remove-selected').disabled,true);assert.equal(ids.get('remove-selected').hidden,true);
  click(4,5);assert.equal(ids.get('selection-name').textContent,'Small thruster');assert.equal(ids.get('remove-selected').disabled,false);
  ids.get('remove-selected').onclick();flush();let after=saved();
  assert.equal(after.components.length,0);assert.deepEqual(after.floor,before.floor);assert.deepEqual(after.engine,before.engine);
  assert.equal(ids.get('remove-selected').disabled,true);assert.equal(ids.get('selection-name').textContent,'Select an item');
  ids.get('undo').onclick();flush();assert.deepEqual(saved(),before);
  ids.get('redo').onclick();flush();assert.deepEqual(saved(),after);
  choose('floor');assert.equal(ids.get('remove-selected').hidden,true);
});

test('Delete and Backspace remove only the selection, skip inputs and dialogs, and retain engine erase semantics',()=>{
  const {ids,nodes,events,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y)=>{canvas.onpointerdown(pointer(x,y));canvas.onpointerup(pointer(x,y));flush();};
  const keyboard=(key,target=canvas)=>{let prevented=false;events.keydown({key,target,preventDefault(){prevented=true;}});flush();return prevented;};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  click(0,0);nodes.find(n=>n.dataset.layer==='floor').onclick();click(0,0);
  nodes.find(n=>n.dataset.layer==='extender').onclick();click(6,6);ids.get('select-mode').onclick();click(6,6);
  const before=saved();assert.equal(before.extenders.length,1);
  assert.equal(keyboard('Delete',ids.get('name')),false);assert.deepEqual(saved(),before);
  ids.get('library').showModal();assert.equal(keyboard('Delete'),false);ids.get('library').close();assert.deepEqual(saved(),before);
  assert.equal(keyboard('Backspace'),true);assert.equal(saved().extenders.length,0);
  ids.get('undo').onclick();flush();click(0,0);assert.equal(keyboard('Delete'),true);
  const after=saved();assert.equal(after.engine,null);assert.equal(after.extenders.length,0);assert.deepEqual(after.floor,before.floor);
  assert.equal(keyboard('Delete'),false,'empty selection cannot remove the floor underneath');
  ids.get('undo').onclick();flush();assert.deepEqual(saved(),before);
});


test('selected-component rotation works with floating handles, toolbar and Q/E, and is undoable',()=>{
  const {ids,nodes,events,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y)=>{canvas.onpointerdown(pointer(x,y));canvas.onpointerup(pointer(x,y));flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  click(0,0);nodes.find(n=>n.dataset.layer==='pilot-console').onclick();click(5,5);
  const before=saved();ids.get('select-mode').onclick();click(5,5);
  assert.equal(ids.get('rotation-controls').hidden,false);assert.equal(ids.get('rotate').disabled,false);
  let prevented=false;events.keydown({key:' ',code:'Space',target:ids.get('component-rotate-right'),preventDefault(){prevented=true;}});assert.equal(prevented,false,'Space remains available to activate a focused rotate button');
  ids.get('component-rotate-right').onclick();flush();assert.equal(saved().components[0].rotation,1);assert.equal(ids.get('rotation-label').textContent,'West');
  ids.get('rotate-left').onclick();flush();assert.deepEqual(saved(),before);
  events.keydown({key:'q',target:canvas,preventDefault(){}});flush();assert.equal(saved().components[0].rotation,3);
  ids.get('undo').onclick();flush();assert.deepEqual(saved(),before);
  ids.get('redo').onclick();flush();assert.equal(saved().components[0].rotation,3);
  assert.equal(ids.get('component-rotation-handles').hidden,true,'undo/redo clears the selection');
  nodes.find(n=>n.dataset.layer==='heater').onclick();click(9,9);ids.get('select-mode').onclick();click(9,9);
  assert.equal(ids.get('rotation-controls').hidden,true);assert.equal(ids.get('component-rotation-handles').hidden,true);
});


test('outside-field tiles and components render red and survive save/load',()=>{
  const {ids,nodes,storage,drawnRects,flush}=createEditor(),canvas=ids.get('canvas');
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y)=>{canvas.onpointerdown(pointer(x,y));canvas.onpointerup(pointer(x,y));flush();};
  const choose=type=>{nodes.find(n=>n.dataset.layer===type).onclick();flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  click(0,0);choose('floor');click(20,0);choose('heater');click(20,0);
  assert.equal(ids.get('component-count').textContent,1);assert.equal(ids.get('used').textContent,1);
  assert.ok(drawnRects.some(r=>r.color==='#e35b5b66'),'unsupported parts have an explicit red overlay');
  const before=saved();assert.equal(model.validate(before).outsideTiles.length,1);
  ids.get('load').onclick();ids.get('design-list').children[0].children[1].onclick();flush();
  assert.deepEqual(saved(),before);assert.ok(drawnRects.some(r=>r.color==='#e35b5b66'));
});


test('missing substructure renders red and disappears from the footprint after floor is added',()=>{
  const {ids,nodes,drawnRects,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y)=>{canvas.onpointerdown(pointer(x,y));canvas.onpointerup(pointer(x,y));flush();};
  const choose=type=>{nodes.find(n=>n.dataset.layer===type).onclick();flush();};
  click(0,0);choose('floor');for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)click(x,y);
  assert.ok(!drawnRects.some(r=>r.color==='#e35b5b66'),'fully supported engine has no red tiles');
  choose('heater');click(5,5);assert.equal(ids.get('component-count').textContent,1);assert.ok(drawnRects.some(r=>r.color==='#e35b5b66'));
  ids.get('save').onclick();const saved=JSON.parse(storage.get('gravship-designs-v1'))[0].state;assert.ok(model.validate(saved).missing.includes('5,5'));
  choose('floor');click(5,5);assert.ok(!drawnRects.some(r=>r.color==='#e35b5b66'),'adding the missing foundation removes red');
  ids.get('undo').onclick();flush();assert.ok(drawnRects.some(r=>r.color==='#e35b5b66'),'Undo restores the missing-support warning');
  ids.get('redo').onclick();flush();assert.ok(!drawnRects.some(r=>r.color==='#e35b5b66'));
});


test('astrofuel pipe tools paint continuous runs and shapes, skip existing networks, and undo or erase a whole stroke',()=>{
  const {ids,nodes,storage,drawnText,flush}=createEditor(),canvas=ids.get('canvas');
  ids.get('mod-chapter1').checked=true;ids.get('mod-chapter1').onchange();flush();
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y)=>{canvas.onpointerdown(pointer(x,y));canvas.onpointerup(pointer(x,y));flush();};
  const choose=type=>{nodes.find(n=>n.dataset.layer===type).onclick();flush();};
  const shape=type=>{nodes.find(n=>n.dataset.shape===type).onclick();flush();};
  const stroke=(a,b)=>{canvas.onpointerdown(pointer(...a));canvas.onpointermove(pointer(...b));canvas.onpointerup(pointer(...b));flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  click(0,0);choose('VGE_AstrofuelPipe');assert.equal(ids.get('shape-picker').disabled,false);assert.equal(ids.get('rotation-controls').hidden,true);
  assert.ok(nodes.filter(n=>n.dataset.shape).every(n=>!n.disabled));
  stroke([4,4],[10,4]);assert.equal(saved().components.length,7);
  ids.get('undo').onclick();flush();assert.equal(saved().components.length,0);ids.get('redo').onclick();flush();assert.equal(saved().components.length,7);
  stroke([8,4],[12,4]);assert.equal(saved().components.length,9,'revisiting pipes creates no duplicates');
  choose('VGE_HiddenAstrofuelPipe');shape('filled');
  canvas.onpointerdown(pointer(8,4));canvas.onpointermove(pointer(10,6));flush();assert.ok(drawnText.some(t=>t.text==='9'),'pipe shapes show tile measurements');
  canvas.onpointerup(pointer(10,6));flush();let design=saved();assert.equal(design.components.length,15);assert.equal(design.components.filter(c=>c.type==='VGE_HiddenAstrofuelPipe').length,6);
  assert.equal(design.components.find(c=>c.x===8&&c.y===4).type,'VGE_AstrofuelPipe','painting preserves an existing pipe variant');
  ids.get('undo').onclick();flush();assert.equal(saved().components.length,9);ids.get('redo').onclick();flush();assert.equal(saved().components.length,15);
  ids.get('erase').onclick();stroke([8,4],[10,6]);assert.equal(saved().components.length,6,'universal erase removes both pipe types in the shape');
  ids.get('add').onclick();choose('heater');assert.equal(ids.get('shape-picker').disabled,true,'ordinary buildings remain single-placement tools');
});

test('universal eraser previews a mixed-component brush, preserves foundations, and undoes the entire drag',()=>{
  const {ids,nodes,storage,drawnRects,counters,flush}=createEditor(),canvas=ids.get('canvas');
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y)=>{canvas.onpointerdown(pointer(x,y));canvas.onpointerup(pointer(x,y));flush();};
  const choose=type=>{nodes.find(n=>n.dataset.layer===type).onclick();flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  click(0,0);choose('floor');for(const p of [[5,4],[6,4],[8,4],[9,4]])click(...p);
  choose('bed');ids.get('rotate').onclick();flush();click(5,4);choose('heater');click(8,4);choose('hull');click(9,4);
  const before=saved();ids.get('select-mode').onclick();flush();assert.equal(ids.get('erase').disabled,false);
  ids.get('erase').onclick();flush();assert.equal(ids.get('mode-label').textContent,'Erase components');assert.equal(ids.get('shape-picker').disabled,false);
  assert.equal(ids.get('erase-target-control').hidden,false);assert.equal(ids.get('rotation-controls').hidden,true);
  const work={validation:counters.validation,clones:counters.clones};
  canvas.onpointerdown(pointer(6,4));canvas.onpointermove(pointer(9,4));flush();
  assert.equal(ids.get('component-count').textContent,2,'preview does not mutate');assert.ok(ids.get('erase-status').textContent.startsWith('2 items'));
  assert.ok(drawnRects.some(r=>r.color==='#e7907c66'));assert.equal(counters.validation,work.validation);assert.equal(counters.clones,work.clones);
  canvas.onpointerup(pointer(9,4));flush();const after=saved();assert.equal(after.components.length,0);assert.deepEqual(after.floor,before.floor);assert.deepEqual(after.hull,before.hull);
  ids.get('undo').onclick();flush();assert.deepEqual(saved(),before);ids.get('redo').onclick();flush();assert.deepEqual(saved(),after);
  click(30,30);ids.get('undo').onclick();flush();assert.deepEqual(saved(),before,'empty strokes do not add undo entries');
  ids.get('add').onclick();flush();assert.equal(ids.get('mode-label').textContent,'Place gravship hull','Add restores the last chosen build tool');
});

test('rectangle erase filters are independent of the build tool and use the final pointer-up position',()=>{
  const {ids,nodes,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y)=>{canvas.onpointerdown(pointer(x,y));canvas.onpointerup(pointer(x,y));flush();};
  const choose=type=>{nodes.find(n=>n.dataset.layer===type).onclick();flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  const target=t=>{ids.get('erase-target').value=t;ids.get('erase-target').onchange();flush();};
  const rectangle=()=>{canvas.onpointerdown(pointer(8,6));canvas.onpointermove(pointer(7,5));canvas.onpointerup(pointer(4,4));flush();};
  click(0,0);choose('floor');for(const p of [[4,4],[4,5],[6,4],[8,4]])click(...p);
  choose('bed');click(4,4);choose('heater');click(6,4);choose('hull');click(8,4);
  const before=saved();choose('heater');ids.get('erase').onclick();nodes.find(n=>n.dataset.shape==='filled').onclick();flush();
  assert.equal(ids.get('shape-picker').disabled,false);rectangle();assert.equal(saved().components.length,0);assert.deepEqual(saved().floor,before.floor);
  ids.get('undo').onclick();flush();target('hull');rectangle();assert.equal(saved().hull.length,0);assert.deepEqual(saved().components,before.components);
  ids.get('undo').onclick();flush();target('floor');rectangle();assert.equal(saved().floor.length,0);assert.deepEqual(saved().components,before.components);assert.deepEqual(saved().hull,before.hull);
  ids.get('undo').onclick();flush();target('all');rectangle();const after=saved();assert.equal(after.components.length,0);assert.equal(after.floor.length,0);assert.equal(after.hull.length,0);assert.deepEqual(after.engine,before.engine);
  ids.get('undo').onclick();flush();assert.deepEqual(saved(),before);
  ids.get('erase').onclick();flush();assert.equal(ids.get('mode-label').textContent,'Place heater');assert.equal(ids.get('shape-picker').value,'single','leaving erase restores valid placement for a non-paintable component');
});

test('touch erasing cancels cleanly on a second finger, pointer cancellation, and changing erase tools',()=>{
  const {ids,nodes,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const touch=(id,x,y)=>({button:0,pointerId:id,pointerType:'touch',clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const drop=(id,x,y)=>{canvas.onpointerdown(touch(id,x,y));canvas.onpointerup(touch(id,x,y));flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  drop(1,0,0);nodes.find(n=>n.dataset.layer==='heater').onclick();drop(2,5,5);const before=saved();ids.get('erase').onclick();flush();
  canvas.onpointerdown(touch(3,5,5));canvas.onpointercancel(touch(3,5,5));flush();assert.deepEqual(saved(),before);
  canvas.onpointerdown(touch(4,5,5));canvas.onpointerdown(touch(5,8,5));canvas.onpointerup(touch(5,8,5));canvas.onpointermove(touch(4,5,5));canvas.onpointerup(touch(4,5,5));flush();assert.deepEqual(saved(),before);
  canvas.onpointerdown(touch(6,5,5));ids.get('erase-target').value='all';ids.get('erase-target').onchange();canvas.onpointerup(touch(6,5,5));flush();assert.deepEqual(saved(),before);
  canvas.onpointerdown(touch(7,5,5));nodes.find(n=>n.dataset.shape==='filled').onclick();canvas.onpointerup(touch(7,5,5));flush();assert.deepEqual(saved(),before);
  ids.get('undo').onclick();flush();assert.equal(saved().components.length,0,'cancelled previews did not add history');
});

test('right-click keeps typed removal and pointer ownership prevents another pointer committing universal erase',()=>{
  const {ids,nodes,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const p=(id,x,y,button=0)=>({button,pointerId:id,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y,button=0)=>{canvas.onpointerdown(p(1,x,y,button));canvas.onpointerup(p(1,x,y,button));flush();};
  const choose=type=>{nodes.find(n=>n.dataset.layer===type).onclick();flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  click(0,0);choose('heater');click(4,4);choose('bed');click(7,4);click(4,4,2);assert.equal(saved().components.length,2,'a bed right-click leaves heaters alone');
  click(7,4,2);assert.deepEqual(saved().components.map(c=>c.type),['heater']);
  ids.get('erase').onclick();flush();canvas.onpointerdown(p(2,4,4));canvas.onpointerup(p(3,4,4));flush();assert.equal(ids.get('component-count').textContent,1);
  canvas.onpointerup(p(2,4,4));flush();assert.equal(saved().components.length,0);
});

test('normal and hidden astrofuel sprites share cardinal links and never connect diagonally',()=>{
  const {ids,nodes,drawnImages,requestedImages,flush}=createEditor(),canvas=ids.get('canvas');
  ids.get('mod-chapter1').checked=true;ids.get('mod-chapter1').onchange();flush();
  const click=(x,y)=>{const e={button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}};canvas.onpointerdown(e);canvas.onpointerup(e);flush();};
  const choose=type=>{nodes.find(n=>n.dataset.layer===type).onclick();flush();};
  click(0,0);choose('VGE_AstrofuelPipe');click(6,6);click(5,5);click(10,10);
  choose('VGE_HiddenAstrofuelPipe');const imageCount=requestedImages.length;click(7,6);click(6,5);click(11,11);
  const path='assets/'+catalogue.componentDefinition('VGE_AstrofuelPipe').sprites.south,png=readFileSync(path),tw=png.readUInt32BE(16)/4,th=png.readUInt32BE(20)/4;
  const crops=drawnImages.filter(im=>im.file===path).map(im=>im.args.slice(0,4));
  for(const crop of [[tw*3,th*3,tw,th],[0,th,tw,th],[0,0,tw,th]])assert.ok(crops.some(c=>JSON.stringify(c)===JSON.stringify(crop)),JSON.stringify(crop));
  assert.equal(crops.filter(c=>JSON.stringify(c)===JSON.stringify([0,th*3,tw,th])).length,2,'a diagonal-only pair uses two disconnected sprites');
  assert.equal(requestedImages.length,imageCount,'both variants reuse the loaded atlas');
});


test('furniture is searchable by category and DLC and paints a rotated table with deferred artwork and undo',()=>{
  const {ids,nodes,requestedImages,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const choose=id=>{nodes.find(n=>n.dataset.layer===id).onclick();flush();};
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const click=(x,y)=>{canvas.onpointerdown(pointer(x,y));canvas.onpointerup(pointer(x,y));flush();};
  const search=query=>{ids.get('component-search').value=query;ids.get('component-search').oninput();};
  const visible=()=>nodes.filter(n=>n.className.split(' ').includes('component-item')&&!n.hidden);
  assert.equal(requestedImages.some(file=>file.startsWith('assets/furniture/')),false,'furniture artwork is deferred until needed');
  search('Furniture');assert.equal(visible().length,57);
  search('Biotech');assert.ok(visible().some(n=>n.dataset.layer==='kid-outfit-stand'));assert.ok(visible().some(n=>n.dataset.layer==='crib'));
  assert.ok(nodes.find(n=>n.dataset.layer==='kid-outfit-stand').querySelector('small').textContent.includes('Odyssey + Biotech'));
  search('');click(0,0);choose('table-2x4');ids.get('rotate').onclick();flush();click(4,4);
  ids.get('save').onclick();flush();let saved=JSON.parse(storage.get('gravship-designs-v1'))[0].state;
  assert.equal(saved.components[0].type,'table-2x4');assert.equal(saved.components[0].rotation,1);assert.equal(catalogue.componentCells(saved.components[0]).length,8);
  assert.ok(requestedImages.includes('assets/furniture/Table_(2x4)_east.png'));
  ids.get('undo').onclick();flush();assert.equal(ids.get('component-count').textContent,0);
  ids.get('redo').onclick();flush();assert.equal(ids.get('component-count').textContent,1);
});


test('production search, default facing, touch rotation and movement persist through undo and local saves',()=>{
  const {ids,nodes,requestedImages,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const choose=id=>{nodes.find(n=>n.dataset.layer===id).onclick();flush();};
  const touch=(id,x,y)=>({button:0,pointerId:id,pointerType:'touch',clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const drop=(id,x,y)=>{canvas.onpointerdown(touch(id,x-1,y));canvas.onpointermove(touch(id,x,y));canvas.onpointerup(touch(id,x,y));flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  assert.equal(requestedImages.some(file=>file.startsWith('assets/production/')),false,'production artwork loads only when needed');
  ids.get('component-search').value='Production';ids.get('component-search').oninput();
  assert.equal(nodes.filter(n=>n.className.split(' ').includes('component-item')&&!n.hidden).length,41);
  ids.get('component-search').value='Anomaly';ids.get('component-search').oninput();
  assert.ok(!nodes.find(n=>n.dataset.layer==='serum-lab').hidden);
  assert.ok(nodes.find(n=>n.dataset.layer==='bioferrite-shaper').querySelector('small').textContent.includes('Anomaly'));
  ids.get('component-search').value='';ids.get('component-search').oninput();drop(1,0,0);
  choose('hydroponics-basin');assert.equal(ids.get('rotation-label').textContent,'North');drop(2,4,4);
  let s=saved();assert.deepEqual(s.components[0],{type:'hydroponics-basin',x:4,y:4,rotation:2});
  assert.equal(ids.get('selection-name').textContent,'Hydroponics basin');assert.ok(requestedImages.includes('assets/production/Hydroponics_basin_north.png'));
  ids.get('rotate').onclick();flush();s=saved();assert.equal(s.components[0].rotation,3);
  const p=s.components[0];canvas.onpointerdown(touch(3,p.x,p.y));canvas.onpointermove(touch(3,p.x+2,p.y+1));canvas.onpointerup(touch(3,p.x+2,p.y+1));flush();
  s=saved();assert.equal(s.components[0].x,p.x+2);assert.equal(s.components[0].y,p.y+1);
  ids.get('remove-selected').onclick();flush();assert.equal(saved().components.length,0);
  ids.get('undo').onclick();flush();assert.deepEqual(saved(),s);
  choose('serum-lab');assert.equal(ids.get('rotation-label').textContent,'North');drop(4,-6,4);assert.equal(saved().components[1].type,'serum-lab');
  choose('fermenting-barrel');assert.equal(ids.get('rotate').disabled,true);
});

test('touch component placement previews until release, then stays selected for rotation and another move',()=>{
  const {ids,nodes,storage,flush,counters}=createEditor(),canvas=ids.get('canvas');
  const touch=(id,x,y)=>({button:0,pointerId:id,pointerType:'touch',clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const choose=type=>{nodes.find(n=>n.dataset.layer===type).onclick();flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  canvas.onpointerdown(touch(1,0,0));canvas.onpointerup(touch(1,0,0));flush();choose('bed');
  const applications=counters.apply;canvas.onpointerdown(touch(2,4,4));flush();assert.equal(ids.get('component-count').textContent,0);assert.equal(ids.get('rotate').disabled,true);
  canvas.onpointermove(touch(2,6,5));flush();assert.equal(ids.get('component-count').textContent,0);assert.equal(counters.apply,applications,'previews do not apply edits');
  canvas.onpointerup(touch(2,8,6));canvas.onlostpointercapture(touch(2,8,6));flush();let s=saved();
  assert.deepEqual(s.components,[{type:'bed',x:8,y:6,rotation:0}]);assert.equal(ids.get('selection-name').textContent,'Bed');assert.equal(ids.get('select-mode').attributes['aria-pressed'],true);
  assert.equal(ids.get('rotate').disabled,false);assert.equal(ids.get('remove-selected').disabled,false);
  ids.get('rotate').onclick();flush();s=saved();assert.equal(s.components[0].rotation,1);const beforeMove=structuredClone(s.components[0]);
  canvas.onpointerdown(touch(3,beforeMove.x,beforeMove.y));canvas.onpointermove(touch(3,beforeMove.x+3,beforeMove.y+2));canvas.onpointerup(touch(3,beforeMove.x+3,beforeMove.y+2));flush();s=saved();
  assert.equal(s.components.length,1);assert.equal(s.components[0].x,beforeMove.x+3);assert.equal(s.components[0].y,beforeMove.y+2);assert.equal(ids.get('selection-name').textContent,'Bed');
  ids.get('undo').onclick();flush();assert.deepEqual(saved().components[0],beforeMove);
  ids.get('undo').onclick();flush();assert.equal(saved().components[0].rotation,0);
  ids.get('undo').onclick();flush();assert.equal(saved().components.length,0,'one undo step for placement');
  for(let i=0;i<3;i++){ids.get('redo').onclick();flush();}assert.equal(saved().components[0].rotation,1);
});

test('touch placement cancellation, invalid drops and pinch navigation do not add components or history',()=>{
  const {ids,nodes,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const touch=(id,x,y)=>({button:0,pointerId:id,pointerType:'touch',clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const choose=type=>{nodes.find(n=>n.dataset.layer===type).onclick();flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  canvas.onpointerdown(touch(1,0,0));canvas.onpointerup(touch(1,0,0));flush();choose('bed');
  canvas.onpointerdown(touch(2,4,4));canvas.onpointermove(touch(2,5,5));canvas.onpointercancel(touch(2,5,5));flush();assert.equal(saved().components.length,0);
  canvas.onpointerdown(touch(3,4,4));canvas.onpointerup(touch(3,0,0));flush();assert.equal(saved().components.length,0);assert.equal(ids.get('mode-label').textContent,'Place bed');
  canvas.onpointerdown(touch(4,4,4));canvas.onpointerdown(touch(5,8,4));canvas.onpointermove(touch(5,10,4));canvas.onpointerup(touch(4,4,4));canvas.onpointerup(touch(5,10,4));flush();assert.equal(saved().components.length,0);
  assert.equal(ids.get('mode-label').textContent,'Place bed');
  ids.get('undo').onclick();flush();assert.equal(saved().engine,null,'cancelled and rejected placement creates no undo entries');
  ids.get('redo').onclick();flush();assert.ok(saved().engine);
});

test('touch engines and extenders drop at the release position, while floors and pipes keep painting',()=>{
  const {ids,nodes,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const touch=(id,x,y)=>({button:0,pointerId:id,pointerType:'touch',clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const choose=type=>{nodes.find(n=>n.dataset.layer===type).onclick();flush();};
  const stroke=(id,a,b)=>{canvas.onpointerdown(touch(id,...a));canvas.onpointermove(touch(id,...b));canvas.onpointerup(touch(id,...b));flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  canvas.onpointerdown(touch(1,0,0));flush();assert.equal(ids.get('engine-count').textContent,'0 / 1');canvas.onpointerup(touch(1,3,3));flush();assert.deepEqual(saved().engine,{x:3,y:3});assert.equal(ids.get('selection-name').textContent,'Grav engine');
  choose('floor');stroke(2,[5,5],[8,5]);assert.equal(saved().floor.length,4);assert.equal(ids.get('select-mode').attributes['aria-pressed'],false);
  choose('extender');stroke(3,[10,0],[12,1]);assert.deepEqual(saved().extenders,[{x:12,y:1}]);assert.equal(ids.get('selection-name').textContent,'Field extender');
  stroke(4,[12,1],[13,2]);assert.deepEqual(saved().extenders,[{x:13,y:2}]);
  ids.get('mod-chapter1').checked=true;ids.get('mod-chapter1').onchange();flush();choose('VGE_AstrofuelPipe');stroke(5,[13,5],[15,5]);
  assert.equal(saved().components.length,3);assert.equal(ids.get('select-mode').attributes['aria-pressed'],false,'pipe painting stays active');
});

test('touch replacement selects the new component and fixed components can immediately be removed',()=>{
  const {ids,nodes,storage,flush}=createEditor(),canvas=ids.get('canvas');
  const touch=(id,x,y)=>({button:0,pointerId:id,pointerType:'touch',clientX:450+x*22+11,clientY:300+y*22+11,preventDefault(){}});
  const choose=type=>{nodes.find(n=>n.dataset.layer===type).onclick();flush();};
  const tap=(id,x,y)=>{canvas.onpointerdown(touch(id,x,y));canvas.onpointerup(touch(id,x,y));flush();};
  const saved=()=>{ids.get('save').onclick();flush();return JSON.parse(storage.get('gravship-designs-v1'))[0].state;};
  tap(1,0,0);choose('hull');tap(2,5,5);choose('autodoor');tap(3,5,5);assert.equal(ids.get('selection-name').textContent,'Autodoor');assert.ok(!saved().hull.includes('5,5'));
  ids.get('rotate').onclick();flush();assert.equal(saved().components[0].rotation,1);
  choose('heater');tap(4,8,8);assert.equal(ids.get('selection-name').textContent,'Heater');assert.equal(ids.get('rotation-controls').hidden,true);ids.get('remove-selected').onclick();flush();assert.equal(saved().components.length,1);assert.equal(saved().components[0].type,'autodoor');
});
