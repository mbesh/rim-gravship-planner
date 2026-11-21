// Optional audit: npm install --no-save --package-lock=false @napi-rs/canvas
// Run from the repository root: node tools/audit-hull.mjs [output-directory]
// Flags are diagnostics, not proof of in-game visual equivalence.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {writeFile,mkdir} from 'node:fs/promises';
const root=process.cwd(),require=createRequire(path.join(root,'package.json'));
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {HULL_REFERENCES,hullTopology,prepareHullTexture,drawHull}=await import(pathToFileURL(path.join(root,'hull.js')));
const out=path.resolve(process.argv[2]||'node_modules/.cache/hull-audit');await mkdir(out,{recursive:true});
const textures={};for(const ref of HULL_REFERENCES)textures[ref.id]=prepareHullTexture(await loadImage(path.join(root,'assets',ref.file)),ref,createCanvas);
const tile=16,pad=1,canvas=createCanvas(6*tile,6*tile),ctx=canvas.getContext('2d');
const key=(x,y)=>x+','+y;
function stateFor(rows){const hull=[],floor=[];rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='H')hull.push(key(x,y));if(v!=='.')floor.push(key(x,y));}));return {hull,floor,components:[],extenders:[],engine:null};}
function trim(rows){let minX=4,minY=4,maxX=-1,maxY=-1;rows.forEach((r,y)=>[...r].forEach((v,x)=>{if(v!=='.'){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}));return maxX<0?['.']:rows.slice(minY,maxY+1).map(r=>r.slice(minX,maxX+1));}
const rotate=rows=>Array.from({length:rows[0].length},(_,y)=>Array.from({length:rows.length},(_,x)=>rows[rows.length-1-x][y]).join(''));
function canonical(rows){let r=trim(rows),all=[];for(let i=0;i<4;i++){all.push(r.join('/'),r.map(row=>[...row].reverse().join('')).join('/'));r=rotate(r);}return all.sort()[0];}
const totals={},examples=new Map(),buckets={},stageCounts={};let rendered=0;
function record(type,rows,detail,score=1){totals[type]=(totals[type]||0)+1;const id=type+':'+canonical(rows),existing=examples.get(id);if(existing)return;const hullCount=rows.join('').split('H').length-1,item={type,rows:trim(rows),detail,score,hullCount};examples.set(id,item);if(!buckets[type])buckets[type]=[];buckets[type].push(item);buckets[type].sort((a,b)=>a.hullCount-b.hullCount||b.score-a.score);if(buckets[type].length>24)buckets[type].pop();}
function inspect(rows,stage){
 const s=stateFor(rows),layout=hullTopology(s);ctx.clearRect(0,0,canvas.width,canvas.height);drawHull(ctx,layout,textures,(x,y)=>({x:(x+pad)*tile,y:(y+pad)*tile}),tile);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,alpha=(x,y)=>pixels[(y*canvas.width+x)*4+3]>128;
 const issues={};let edgeMismatch=0,coreMissing=0,floorFilled=0,brokenJoin=0,mixedTurns=0;
 for(const cell of layout.tiles.values())if(cell.host==='H'){
  for(const q of cell.quarters)if(q){for(const i of [12+(q.qx?1:-1),12+(q.qy?5:-5)])if((q.signature[i]==='H')!==(cell.context[i]==='H'))edgeMismatch++;}
  if(!cell.single&&new Set(cell.quarters.map(q=>q?.turns)).size>1)mixedTurns++;
 }
 for(let y=0;y<rows.length;y++)for(let x=0;x<rows[0].length;x++){
  const type=rows[y][x],cx=(x+pad)*tile+tile/2,cy=(y+pad)*tile+tile/2;
  let coverage=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(alpha(cx+dx,cy+dy))coverage++;
  if(type==='H'&&coverage<7)coreMissing++;
  if(type==='S'&&coverage>2)floorFilled++;
  if(type==='H')for(const [dx,dy] of [[1,0],[0,1]])if(rows[y+dy]?.[x+dx]==='H'){
   const ex=cx+dx*tile/2,ey=cy+dy*tile/2;let connected=0;
   for(let offset=-1;offset<=1;offset++)if(alpha(ex+(dy?offset:-1),ey+(dx?offset:-1))&&alpha(ex+(dy?offset:0),ey+(dx?offset:0)))connected++;
   if(connected<2)brokenJoin++;
  }
 }
 if(edgeMismatch)issues.edgeMismatch=edgeMismatch;if(coreMissing)issues.missingHullCore=coreMissing;if(floorFilled)issues.filledFloorCenter=floorFilled;if(brokenJoin)issues.brokenCardinalJoin=brokenJoin;if(mixedTurns)issues.mixedQuarterTurns=mixedTurns;
 for(const [type,value] of Object.entries(issues))record(type,rows,{stage,value},value);
 rendered++;stageCounts[stage]=(stageCounts[stage]||0)+1;
}
for(const mode of ['empty','floor']){
 for(let bits=0;bits<65536;bits++){
  const rows=Array.from({length:4},(_,y)=>Array.from({length:4},(_,x)=>bits&(1<<(y*4+x))?'H':mode==='empty'?'.':'S').join(''));
  inspect(rows,mode);
  if(bits%8192===8191)console.log(JSON.stringify({stage:mode,done:bits+1,rendered,totals}));
 }
}
for(let code=0;code<3**9;code++){
 let n=code;const rows=Array.from({length:3},()=>Array.from({length:3},()=>{const c=['.','S','H'][n%3];n=Math.floor(n/3);return c;}).join(''));inspect(rows,'ternary3x3');
 if(code%6561===6560)console.log(JSON.stringify({stage:'ternary3x3',done:code+1,rendered,totals}));
}
let seed=0x47a9c1;const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
for(let i=0;i<16384;i++){
 const rows=Array.from({length:4},()=>Array.from({length:4},()=>['.','S','H'][rand()%3]).join(''));inspect(rows,'mixed4x4');
 if(i%4096===4095)console.log(JSON.stringify({stage:'mixed4x4',done:i+1,rendered,totals}));
}
const summary={rendered,stageCounts,totals,uniqueIssueLayouts:examples.size,candidates:buckets};
await writeFile(path.join(out,'hull-4x4-sweep.json'),JSON.stringify(summary,null,2));
// Save the diagnostics separately from contact sheet generation so a later visual pass can be selective.
console.log(JSON.stringify({complete:true,rendered,stageCounts,totals,uniqueIssueLayouts:examples.size}));
