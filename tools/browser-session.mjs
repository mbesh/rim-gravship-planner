import {spawn} from 'node:child_process';
import {access,mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname,basename,join,extname,delimiter,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import http from 'node:http';

export const projectRoot=resolve(fileURLToPath(new URL('../',import.meta.url)));
const delay=ms=>new Promise(done=>setTimeout(done,ms));
async function browserPath(){
  if(process.env.BROWSER_BIN){await access(process.env.BROWSER_BIN,constants.X_OK);return process.env.BROWSER_BIN;}
  const candidates=process.platform==='win32'
    ? [process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean).map(p=>resolve(p,'Google/Chrome/Application/chrome.exe'))
    : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',...(process.env.PATH||'').split(delimiter).flatMap(p=>['google-chrome','google-chrome-stable','chromium','chromium-browser'].map(name=>resolve(p,name)))];
  for(const file of candidates)try{await access(file,constants.X_OK);return file;}catch{}
  throw Error('UI validation requires Chrome/Chromium. Install it or set BROWSER_BIN to its executable; this check cannot be skipped.');
}

export async function browserSession({artifacts,baseUrl}={}){
  const binary=await browserPath();await mkdir(artifacts,{recursive:true});
  const profile=await mkdtemp(join(tmpdir(),'gravship-ui-'));let server,child,socket,closed=false;
  const pending=new Map(),errors=[];let serial=0,sessionId,closing=false,log='';
  const close=async()=>{
    if(closed)return;closed=true;
    closing=true;
    try{if(socket?.readyState===1)await Promise.race([send('Browser.close'),delay(1500)]);}catch{}
    socket?.close();child?.kill();server?.closeAllConnections();
    if(server?.listening)await new Promise(done=>server.close(done));
    for(const task of pending.values()){clearTimeout(task.timer);task.reject(Error('Browser closed'));}pending.clear();
    // Only clean up the temporary profile created by this session.
    if(dirname(resolve(profile))===resolve(tmpdir())&&basename(profile).startsWith('gravship-ui-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100}).catch(()=>{});
  };
  const send=(method,params={},target)=>new Promise((done,reject)=>{
    const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error(`Browser command timed out: ${method}`));},20000);
    pending.set(id,{done,reject,timer});socket.send(JSON.stringify({id,method,params,...(target?{sessionId:target}:{})}));
  });
  try{
    if(!baseUrl){
      const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json'};
      server=http.createServer(async(req,res)=>{
        try{
          const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(projectRoot,'.'+(pathname==='/'?'/index.html':pathname));
          if(!file.startsWith(projectRoot+sep)){res.writeHead(403).end();return;}
          const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(content);
        }catch{res.writeHead(404).end();}
      });
      await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
      baseUrl=`http://127.0.0.1:${server.address().port}/`;
    }
    child=spawn(binary,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,...(process.env.CI?['--no-sandbox']:[]),'about:blank'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    const wsurl=await new Promise((done,reject)=>{
      const timer=setTimeout(()=>reject(Error('Chrome startup timeout: '+log.slice(-2000))),25000);
      child.once('error',e=>{clearTimeout(timer);reject(e);});
      child.once('exit',code=>{clearTimeout(timer);reject(Error(`Chrome exited (${code}): ${log.slice(-2000)}`));});
      child.stderr.on('data',chunk=>{log+=chunk;const match=log.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);done(match[1]);}});
    });
    socket=new WebSocket(wsurl);await new Promise((done,reject)=>{socket.addEventListener('open',done,{once:true});socket.addEventListener('error',reject,{once:true});});
    socket.addEventListener('message',e=>{
      const m=JSON.parse(e.data),task=pending.get(m.id);
      if(task){pending.delete(m.id);clearTimeout(task.timer);m.error?task.reject(Error(JSON.stringify(m.error))):task.done(m.result);}
      if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    });
    socket.addEventListener('close',()=>{for(const task of pending.values()){clearTimeout(task.timer);closing?task.done({}):task.reject(Error('Browser connection closed'));}pending.clear();});
    const target=await send('Target.createTarget',{url:'about:blank'});({sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true}));
    const call=(method,params={})=>send(method,params,sessionId);
    await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});
    await call('Emulation.setFocusEmulationEnabled',{enabled:true});
    const evaluate=async expression=>{
      const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
      return result.result.value;
    };
    const settle=()=>evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,50))))');
    const open=async(width,height)=>{
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=1100});
      await call('Emulation.setTouchEmulationEnabled',{enabled:width<=1100,maxTouchPoints:5});
      await call('Page.navigate',{url:baseUrl+'?ui-validation='+Date.now()});
      for(let n=0;n<120;n++){
        if(await evaluate("document.getElementById('palette')?.children.length>0&&document.getElementById('canvas')?.width>0")){await settle();return;}
        await delay(100);
      }
      throw Error('Editor did not become ready');
    };
    const click=async selector=>{
      const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();if(!r.width||!r.height)throw Error('Control is hidden: '+${JSON.stringify(selector)});return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await call('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
      await call('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});await settle();
    };
    const screenshot=async file=>{await mkdir(dirname(file),{recursive:true});const result=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(file,Buffer.from(result.data,'base64'));};
    return {call,evaluate,settle,open,click,screenshot,errors,close,baseUrl};
  }catch(error){await close();throw error;}
}
