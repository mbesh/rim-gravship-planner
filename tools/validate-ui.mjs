import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {browserSession,projectRoot} from './browser-session.mjs';
import {APP_VERSION} from '../version.js';

// These are product contracts, checked from rendered browser styles rather than
// CSS text: peer controls must look consistent even after cascade changes.
const typography=['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','textTransform','textAlign'];
const dropdownAppearance=[...typography,'color','backgroundColor','borderTopWidth','borderTopStyle','borderTopColor','borderRadius','paddingTop','paddingBottom','paddingLeft','paddingRight','appearance'];
const viewports=[[320,568],[360,640],[390,844],[430,932],[568,320],[844,390],[768,1024],[1100,1000],[1101,1000],[1440,900]];
const artifacts=resolve(projectRoot,'artifacts/ui',new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(artifacts,{recursive:true});
const results=[],browser=await browserSession({artifacts,baseUrl:process.env.UI_BASE_URL});
let current='startup';
const snapshot=selectors=>browser.evaluate(`(()=>{
  const properties=${JSON.stringify([...new Set(dropdownAppearance)])};
  return ${JSON.stringify(selectors)}.map(selector=>{
    const e=document.querySelector(selector),s=getComputedStyle(e),r=e.getBoundingClientRect(),canvas=document.createElement('canvas'),context=canvas.getContext('2d');context.font=s.font;
    return {selector,text:e.options?e.selectedOptions[0].text:e.textContent.trim(),visible:r.width>0&&r.height>0,style:Object.fromEntries(properties.map(p=>[p,s[p]])),rect:{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom},
      textWidth:e.options?context.measureText(e.selectedOptions[0].text).width:0,textRoom:e.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)-24};
  });
})()`);
function sameStyles(controls,properties,context){
  const [first,...rest]=controls;
  for(const other of rest)for(const property of properties)assert.equal(other.style[property],first.style[property],`${context}: ${first.selector} / ${other.selector} differ in ${property} (${first.style[property]} vs ${other.style[property]})`);
}
async function capture(name,controls){
  results.push({name,controls});await writeFile(resolve(artifacts,'measurements.json'),JSON.stringify(results,null,2));
  await browser.screenshot(resolve(artifacts,name+'.png'));
}
function inViewport(control,w,h){const r=control.rect;assert.ok(control.visible,`${current}: ${control.selector} must be visible`);assert.ok(r.x>=-.5&&r.y>=-.5&&r.right<=w+.5&&r.bottom<=h+.5,`${current}: ${control.selector} is outside the viewport: ${JSON.stringify(r)}`);}
try{
  for(const [w,h] of viewports){
    current=`${w}x${h}`;await browser.open(w,h);
    assert.equal(await browser.evaluate("document.getElementById('app-version').textContent"),`v${APP_VERSION}`,current+' rendered release version must match the validated source');
    assert.equal(await browser.evaluate("document.getElementById('erase-target-control').hidden"),true,'erase targets start hidden');
    await browser.click('#erase');
    const pair=await snapshot(['#shape-picker','#erase-target']);await capture(current+'-erase',pair);
    sameStyles(pair,dropdownAppearance,current+' peer dropdowns');
    for(const control of pair){inViewport(control,w,h);assert.ok(control.rect.height>=44,'dropdown touch target must be at least 44px');if(w<=1100)assert.ok(parseFloat(control.style.fontSize)>=16,`${current}: native mobile controls need at least 16px text`);}
    assert.ok(Math.abs(pair[0].rect.y-pair[1].rect.y)<1,`${current}: dropdowns must share a row`);
    assert.ok(pair[1].rect.x>=pair[0].rect.right&&pair[1].rect.x-pair[0].rect.right<=12,`${current}: dropdowns must be directly adjacent`);
    const buttons=(await snapshot(['#add','#erase','#select-mode','#pan-mode'])).filter(c=>c.visible);sameStyles(buttons,typography,current+' toolbar button typography');
    for(const b of buttons){inViewport(b,w,h);if(w<=1100)assert.ok(b.rect.height>=44,`${current}: ${b.selector} has a small touch target`);}
    for(const [id,mode] of [['#shape-picker','shapes'],['#erase-target','targets']]){
      const values=await browser.evaluate(`Array.from(document.querySelector(${JSON.stringify(id)}).options,o=>o.value)`);
      for(const value of values){
        await browser.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change'));})()`);await browser.settle();
        const [control]=await snapshot([id]);
        assert.ok(control.textWidth<=control.textRoom+.5,`${current} ${id}: '${control.text}' is clipped (${control.textWidth.toFixed(1)}px text, ${control.textRoom.toFixed(1)}px room)`);
      }
      await capture(current+'-'+mode,await snapshot(['#shape-picker','#erase-target']));
    }
    await browser.evaluate("document.getElementById('shape-picker').focus()");await browser.settle();sameStyles(await snapshot(['#shape-picker','#erase-target']),dropdownAppearance,current+' focused dropdown typography');
    await browser.click('#erase');assert.equal(await browser.evaluate("document.getElementById('erase-target-control').hidden"),true,'erase options hide when toggled off');
    await browser.click('#select-mode');assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.draw-options')).display"),'none','selection hides drawing options');
    if(!await browser.evaluate("document.getElementById('palette-panel').open"))await browser.click('#palette-panel>summary');
    await browser.click('[data-layer="floor"]');await browser.settle();
    sameStyles((await snapshot(['#add','#erase','#select-mode','#pan-mode'])).filter(c=>c.visible),typography,current+' build-mode button typography');
    if(w<=1100){const [shape]=await snapshot(['#shape-picker']);inViewport(shape,w,h);assert.ok(parseFloat(shape.style.fontSize)>=16,'build-mode draw dropdown also retains mobile-readable text');}
    else assert.equal(await browser.evaluate("getComputedStyle(document.getElementById('shapes')).display"),'grid','desktop build mode keeps shape buttons');
    await browser.click('#pan-mode');assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.draw-options')).display"),'none','Pan hides drawing options');
    assert.equal(await browser.evaluate('document.documentElement.scrollWidth>innerWidth'),false,current+' must not overflow horizontally');
    console.log(`UI passed: ${current}`);
  }
  assert.deepEqual(browser.errors,[],'uncaught browser exceptions');
  await writeFile(resolve(artifacts,'result.json'),JSON.stringify({passed:true,version:APP_VERSION,viewports,checks:['release version','peer typography','peer appearance','mobile text size','control geometry','selected-label fit','mode visibility'],errors:browser.errors},null,2));
  console.log(`UI validation passed at ${viewports.length} viewport sizes. Artifacts: ${artifacts}`);
}catch(error){
  try{await browser.screenshot(resolve(artifacts,current+'-failure.png'));await writeFile(resolve(artifacts,'failure.json'),JSON.stringify({viewport:current,message:error.message,errors:browser.errors},null,2));}catch{}
  throw error;
}finally{await browser.close();}
