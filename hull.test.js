import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {HULL_REFERENCES,hullTopology,hullPixelAlpha,prepareHullTexture,drawHull} from './hull.js';
const key=(x,y)=>`${x},${y}`;
function stateFor(rows){const hull=[],floor=[];for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++){if(rows[y][x]==='H')hull.push(key(x,y));if(rows[y][x]!=='\u002e')floor.push(key(x,y));}return {hull,floor,components:[],extenders:[],engine:null};}
function signature(s,x,y){return Array.from({length:25},(_,i)=>{const k=key(x+i%5-2,y+Math.floor(i/5)-2);return s.hull.includes(k)?'H':s.floor.includes(k)?'S':'.';}).join('');}
function rotated(rows){return Array.from({length:rows[0].length},(_,y)=>Array.from({length:rows.length},(_,x)=>rows[rows.length-1-x][y]).join(''));}

test('all supplied reference layouts select exact surrounding context for every hull corner',()=>{
  for(const ref of HULL_REFERENCES){
    assert.ok(existsSync('assets/'+ref.file),ref.file);
    const s=stateFor(ref.rows),snapshot=structuredClone(s),layout=hullTopology(s);
    for(const k of s.hull){const cell=layout.tiles.get(k);assert.ok(cell,k);assert.equal(cell.quarters.length,4);for(const q of cell.quarters)assert.equal(q.signature,signature(s,cell.x,cell.y),`${ref.id} ${k}`);}
    assert.deepEqual(s,snapshot);
  }
});
test('the three reported extended layouts use matching transitions without fallback square caps',()=>{
  for(const rows of [['HHSS','..HH'],['HS','HS','HH'],['HHS','.HH']]){
    const s=stateFor(rows),layout=hullTopology(s);
    for(const k of s.hull)assert.ok(layout.tiles.get(k).quarters.every(q=>q.signature===signature(s,...k.split(',').map(Number))));
  }
});
test('reference layouts and their mirrors work in all four rotations',()=>{
  for(const ref of HULL_REFERENCES){let rows=ref.rows;
    for(let turn=0;turn<4;turn++){
      for(const r of [rows,rows.map(row=>[...row].reverse().join(''))]){
        const s=stateFor(r),layout=hullTopology(s);
        for(const k of s.hull){const [x,y]=k.split(',').map(Number);for(const q of layout.tiles.get(k).quarters)assert.equal(q.signature,signature(s,x,y),`${ref.id} turn ${turn}`);}
      }
      rows=rotated(rows);
    }
  }
});
test('four-way diagonals and the empty hole use their specific game references',()=>{
  for(const id of ['diagonalCross','hole']){
    const ref=HULL_REFERENCES.find(r=>r.id===id),s=stateFor(ref.rows),layout=hullTopology(s);
    for(const cell of layout.tiles.values())for(const q of cell.quarters)assert.equal(q.ref.id,id);
  }
});
test('floor and terrain colors are excluded while neutral hull shades retain alpha',()=>{
  assert.equal(hullPixelAlpha(65,65,65,255),255);
  assert.equal(hullPixelAlpha(105,105,105,255),255);
  assert.equal(hullPixelAlpha(0,0,0,255),255);
  assert.equal(hullPixelAlpha(90,92,100,255),0);
  assert.equal(hullPixelAlpha(106,121,132,255),0);
  assert.equal(hullPixelAlpha(65,65,65,0),0);
});
test('empty component cells cannot receive decorative hull pixels',()=>{
  const s=stateFor(['.H','H.']);s.components=[{type:'heater',x:0,y:0}];assert.ok(!hullTopology(s).tiles.has('0,0'));
  s.components=[];s.engine={x:0,y:0};assert.ok(!hullTopology(s).tiles.has('0,0'));
});
test('hull draw commands are limited to quarter-cell patches with consistent transforms',()=>{
  const s=stateFor(['HHS','.HH']),layout=hullTopology(s),images=Object.fromEntries(HULL_REFERENCES.map(r=>[r.id,{width:r.cols*64,height:r.height*64}])),calls=[];
  const ctx=new Proxy({drawImage:(...args)=>calls.push(args)},{get:(t,k)=>t[k]||(()=>{})});
  drawHull(ctx,layout,images,(x,y)=>({x:x*32,y:y*32}),32);
  assert.equal(calls.length,layout.tiles.size*4);
  for(const args of calls){assert.equal(args[3],32);assert.equal(args[4],32);assert.ok(args[7]<=16.1);assert.ok(args[8]<=16.1);}
});
test('texture preparation leaves the original pixel buffer untouched',()=>{
  const ref=HULL_REFERENCES[0],raw=new Uint8ClampedArray([65,65,65,255,106,121,132,255]),original=raw.slice();let output;
  const image={width:2,height:1};
  prepareHullTexture(image,ref,()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:raw.slice()}),putImageData:p=>output=p.data})}));
  assert.deepEqual(raw,original);assert.equal(output[3],255);assert.equal(output[7],0);
});

test('fully connected centers never copy a reference wall end',()=>{
  const layout=hullTopology(stateFor(['.H.','HHH','.H.'])),center=layout.tiles.get('1,1');
  for(const q of center.quarters)for(const i of [7,11,13,17])assert.equal(q.signature[i],'H');
});
test('an unpictured empty U center uses one coherent background cutout',()=>{
  const layout=hullTopology(stateFor(['H.H','H.H','HHH'])),center=layout.tiles.get('1,1');
  const sources=new Set(center.quarters.map(q=>`${q.ref.id}:${q.x},${q.y}:${q.turns}:${q.flip}`));
  assert.equal(sources.size,1);
  for(const q of center.quarters){assert.equal(q.signature[11],'H');assert.equal(q.signature[13],'H');assert.equal(q.signature[17],'H');}
});

test('staircase middle tiles and cardinal cross use the new reference artwork',()=>{
  const staircase=hullTopology(stateFor(['HHSS','.HHS','..HH']));
  for(const k of ['1,1','2,1'])for(const q of staircase.tiles.get(k).quarters)assert.equal(q.ref.id,'staircaseFloor');
  const cross=hullTopology(stateFor(['.H.','HHH','.H.']));
  for(const cell of cross.tiles.values())for(const q of cell.quarters)assert.equal(q.ref.id,'cardinalCross');
});
