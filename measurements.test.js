import test from 'node:test';
import assert from 'node:assert/strict';
import {shapeCells,point} from './model.js';
import {drawShapeMeasurements} from './measurements.js';

function preview(shape,start,end,zoom=22,origin={x:150,y:150}){
  const cells=shapeCells(shape,start,end),measurement={count:cells.length,minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(const k of cells){const [x,y]=point(k);measurement.minX=Math.min(measurement.minX,x);measurement.minY=Math.min(measurement.minY,y);measurement.maxX=Math.max(measurement.maxX,x);measurement.maxY=Math.max(measurement.maxY,y);}
  const ctx={save(){},restore(){},measureText:text=>({width:text.length*7}),fillRect(){},fillText(){}};
  return drawShapeMeasurements(ctx,measurement,(x,y)=>({x:origin.x+x*zoom,y:origin.y+y*zoom}),zoom,{width:800,height:600});
}

test('rectangle totals count the outline or filled tiles and use inclusive dimensions in either direction',()=>{
  for(const [start,end] of [[{x:0,y:0},{x:4,y:6}],[{x:4,y:6},{x:0,y:0}]]){
    const outline=preview('rect',start,end),filled=preview('filled',start,end);
    assert.deepEqual(outline.map(label=>[label.role,label.text]),[['total','20'],['width','5'],['height','7']]);
    assert.deepEqual(filled.map(label=>[label.role,label.text]),[['total','35'],['width','5'],['height','7']]);
    assert.ok(outline[1].y<outline[0].y);assert.ok(outline[2].x<outline[0].x);
  }
});

test('axis values appear only above four; straight lines avoid duplicate badges and circles use their full diameter',()=>{
  assert.deepEqual(preview('rect',{x:0,y:0},{x:3,y:6}).map(label=>[label.role,label.text]),[['total','18'],['height','7']]);
  for(const end of [{x:6,y:0},{x:0,y:6}])assert.deepEqual(preview('line',{x:0,y:0},end).map(label=>label.text),['7']);
  assert.deepEqual(preview('line',{x:0,y:0},{x:3,y:0}).map(label=>[label.role,label.text]),[['total','4']]);
  assert.deepEqual(preview('diagonal',{x:0,y:0},{x:6,y:4}).map(label=>[label.role,label.text]),[['total','7'],['width','7'],['height','5']]);
  assert.deepEqual(preview('disc',{x:0,y:0},{x:2,y:0}).map(label=>[label.role,label.text]),[['total','25'],['width','5'],['height','5']]);
  const circle=preview('circle',{x:0,y:0},{x:3,y:0});
  assert.equal(circle[0].text,String(shapeCells('circle',{x:0,y:0},{x:3,y:0}).length));
  assert.deepEqual(circle.slice(1).map(label=>label.text),['7','7']);
});

test('badges remain readable, inside the viewport, and separate at small zoom near an edge',()=>{
  const labels=preview('filled',{x:0,y:0},{x:4,y:4},8,{x:0,y:0});
  assert.equal(labels.length,3);
  for(const label of labels){
    assert.ok(label.x-label.width/2>=3);assert.ok(label.y-label.height/2>=3);
    assert.ok(label.x+label.width/2<=797);assert.ok(label.y+label.height/2<=597);
  }
  for(let i=0;i<labels.length;i++)for(let j=0;j<i;j++){
    assert.ok(Math.abs(labels[i].x-labels[j].x)>=(labels[i].width+labels[j].width)/2||Math.abs(labels[i].y-labels[j].y)>=(labels[i].height+labels[j].height)/2);
  }
});
