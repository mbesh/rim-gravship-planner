import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {HULL_REFERENCES,hullTopology,hullPixelAlpha,prepareHullTexture,drawHull,drawSimpleHull} from './hull.js';
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

test('fast hull rendering draws only placed tiles and never connects diagonally',()=>{
  const calls=[],ctx={drawImage:(...args)=>calls.push(args)},image={width:192,height:192};
  drawSimpleHull(ctx,stateFor(['H.','.H']),image,(x,y)=>({x:x*32,y:y*32}),32);
  assert.equal(calls.length,8);
  for(let tile=0;tile<2;tile++)for(let qy=0;qy<2;qy++)for(let qx=0;qx<2;qx++){
    const call=calls[tile*4+qy*2+qx];
    assert.equal(call[1],qx?160:0);assert.equal(call[2],qy?160:0);
    assert.equal(call[5],tile*32+qx*16);assert.equal(call[6],tile*32+qy*16);
  }
});

test('fast hull rendering joins cardinal neighbors and the correct barrier ends',()=>{
  const image={width:192,height:192},screen=(x,y)=>({x:x*32,y:y*32});
  const render=s=>{const calls=[];drawSimpleHull({drawImage:(...args)=>calls.push(args)},s,image,screen,32);return calls;};
  const joined=render(stateFor(['HH']));assert.equal(joined[1][1],96);assert.equal(joined[4][1],64);
  const s=stateFor(['H.']);s.components=[{type:'vac-barrier',x:1,y:0,rotation:0}];
  const horizontal=render(s);assert.equal(horizontal.length,4);assert.equal(horizontal[1][1],96);
  s.components[0].rotation=1;const vertical=render(s);assert.equal(vertical[1][1],160);
  assert.doesNotThrow(()=>drawSimpleHull({},s,undefined,screen,32));
});

test('singular hull caps stay upright and unmirrored in rotated and mirrored layouts',()=>{
  const cases=[
    {rows:['H'],count:1},
    {rows:['SH','HS'],count:2},
    {rows:['H.H','.H.','H.H'],count:5},
    {rows:['HSH','.H.','HSH'],count:5},
    {rows:['HSH','.H.','H.H'],count:5},
    {rows:['H.H.','.H.H','H.H.'],count:3},
    {rows:['HSS','SHS','SSH'],count:3},
  ];
  const textures=Object.fromEntries(HULL_REFERENCES.map(r=>[r.id,{width:r.cols*64,height:r.height*64}]));
  for(const fixture of cases){let rows=fixture.rows;
    for(let turn=0;turn<4;turn++){
      for(const grid of [rows,rows.map(row=>[...row].reverse().join(''))]){
        const singles=[...hullTopology(stateFor(grid)).tiles.values()].filter(cell=>cell.single);
        assert.equal(singles.length,fixture.count,grid.join('/'));
        for(const cell of singles){
          const calls=[],rejectTransform=()=>assert.fail('singular hull artwork must not be transformed');
          const ctx={drawImage:(...args)=>calls.push(args),rotate:rejectTransform,scale:rejectTransform,translate:rejectTransform};
          drawHull(ctx,{tiles:new Map([[key(cell.x,cell.y),cell]])},textures,(x,y)=>({x:x*32,y:y*32}),32);
          assert.equal(calls.length,1,'draw the complete native cap in one pass');
          assert.deepEqual(calls[0],[textures[cell.single.ref.id],cell.single.x*64,cell.single.y*64,64,64,cell.x*32,cell.y*32,32,32]);
        }
      }
      rows=rotated(rows);
    }
  }
});

test('connected diagonal hull retains its directional quarter artwork',()=>{
  for(let rows of [['HSS','.HS','..H'],['..H','.H.','H..']]){
    for(let turn=0;turn<4;turn++){
      const layout=hullTopology(stateFor(rows));
      assert.ok([...layout.tiles.values()].filter(cell=>cell.host==='H').every(cell=>!cell.single));
      rows=rotated(rows);
    }
  }
});

test('upward and downward parallel chevrons use their native reference artwork',()=>{
  const original=HULL_REFERENCES.find(ref=>ref.id==='parallelDiagonalChains').rows;
  for(const [turns,id] of [[1,'parallelDiagonalChains90'],[3,'parallelDiagonalChains270']]){
    let rows=original;for(let turn=0;turn<turns;turn++)rows=rotated(rows);
    const layout=hullTopology(stateFor(rows));
    const caps=[...layout.tiles.values()].filter(cell=>cell.single);
    assert.equal(caps.length,3);
    const chevron=[...layout.tiles.values()].filter(cell=>cell.host==='H'&&!cell.single);
    assert.equal(chevron.length,3);
    for(const cell of chevron)for(const q of cell.quarters){
      assert.equal(q.ref.id,id,'use the supplied directional drawing rather than a rotated side chevron');
      assert.equal(q.turns,0);assert.equal(q.flip,false);
      assert.equal(q.signature,cell.context);
    }
    // The enclosed gap is part of the reference too; keep it coherent with the arms.
    const gap=layout.tiles.get(turns===1?'1,2':'1,1');
    assert.ok(gap);
    for(const q of gap.quarters){assert.equal(q.ref.id,id);assert.equal(q.turns,0);assert.equal(q.flip,false);}
  }
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

test('mixed diagonal junction centers use one isolated cap rather than crossing wall pieces',()=>{
  for(const id of ['checkerboardMixedFloor','diagonalJunctionMixedFloor']){
    let rows=HULL_REFERENCES.find(ref=>ref.id===id).rows;
    for(let turn=0;turn<4;turn++){
      const center=hullTopology(stateFor(rows)).tiles.get('1,1');
      assert.equal(new Set(center.quarters.map(q=>`${q.ref.id}:${q.x},${q.y}:${q.turns}:${q.flip}`)).size,1);
      for(const q of center.quarters){
        assert.equal(q.ref.id,id);
        for(const i of [7,11,13,17])assert.notEqual(q.signature[i],'H');
      }
      rows=rotated(rows);
    }
  }
});

test('diagonal references cannot add bevels across gaps floored on both sides',()=>{
  for(let rows of [['HSS','SHS','SSH'],['HSH','SHS','SSS'],['HSH','SHS','HSH']]){
    for(let turn=0;turn<4;turn++){
      const layout=hullTopology(stateFor(rows));
      assert.ok([...layout.tiles.values()].every(cell=>cell.host!=='S'),rows.join('/'));
      rows=rotated(rows);
    }
  }
  // A one-sided floored diagonal still needs its native small inside bevel.
  const layout=hullTopology(stateFor(['HSS','.HS','..H']));
  assert.ok([...layout.tiles.values()].some(cell=>cell.host==='S'));
});

test('floor-surrounded walls and junctions preserve the cardinal connections in every orientation',()=>{
  const layouts=[['SSS','HHH','SSS'],['SHS','HHH','SHS'],['SSHS','HHHH','SSHS'],['SSS','HHH','SHS'],['HSH','HSH','HSH'],['HHH','HSH','HHH']];
  for(let rows of layouts)for(let turn=0;turn<4;turn++){
    const layout=hullTopology(stateFor(rows));
    for(const cell of layout.tiles.values())if(cell.host==='H')for(const q of cell.quarters){
      const ix=12+(q.qx?1:-1),iy=12+(q.qy?5:-5);
      assert.equal(q.signature[ix]==='H',cell.context[ix]==='H',`${rows} ${cell.x},${cell.y}: horizontal edge`);
      assert.equal(q.signature[iy]==='H',cell.context[iy]==='H',`${rows} ${cell.x},${cell.y}: vertical edge`);
      if(q.method==='orthogonal')assert.equal(q.turns,0,'composed walls retain native top/bottom shading');
    }
    rows=rotated(rows);
  }
});

test('all 6561 mixed 3x3 neighborhoods preserve the center hull cardinal edges',()=>{
  let checked=0;
  for(let n=0;n<3**8;n++){
    let code=n;const rows=Array.from({length:3},()=>Array(3).fill('.'));rows[1][1]='H';
    for(let i=0;i<9;i++)if(i!==4){rows[Math.floor(i/3)][i%3]=['.','S','H'][code%3];code=Math.floor(code/3);}
    const cell=hullTopology(stateFor(rows.map(row=>row.join('')))).tiles.get('1,1');checked++;
    for(const q of cell.quarters)for(const i of [12+(q.qx?1:-1),12+(q.qy?5:-5)]){
      assert.equal(q.signature[i]==='H',cell.context[i]==='H',`${rows} at edge ${i}`);
    }
  }
  assert.equal(checked,6561);
});

test('unpictured 4x4 transitions never invent or remove facing hull neighbors',()=>{
  for(let rows of [['.HH.','H.H.','H...','....'],['H.H.','HH..','.H..','....'],['SH..','.HS.','H...','....']]){
    for(let turn=0;turn<4;turn++){
      for(const grid of [rows,rows.map(row=>[...row].reverse().join(''))]){
        for(const cell of hullTopology(stateFor(grid)).tiles.values())if(cell.host==='H')for(const q of cell.quarters){
          assert.ok(q,grid.join('/'));
          for(const i of [12+(q.qx?1:-1),12+(q.qy?5:-5)])assert.equal(q.signature[i]==='H',cell.context[i]==='H',grid.join('/'));
        }
      }
      rows=rotated(rows);
    }
  }
});
