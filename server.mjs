import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(404).end('Not found');}});
const portFlag=process.argv.indexOf('--port');
let port=Number(portFlag>=0?process.argv[portFlag+1]:process.env.PORT||5173);
if(!Number.isInteger(port)||port<1||port>65535){
  console.error('Choose a port between 1 and 65535: npm start -- --port 5174');
  process.exit(1);
}
let retries=0;
server.on('error',error=>{
  if((error.code==='EADDRINUSE'||error.code==='EACCES')&&retries<20&&port<65535){
    console.log(`Port ${port} is unavailable; trying ${port+1}.`);
    port++;retries++;
    server.listen(port,'127.0.0.1');
  }else{
    console.error(`Could not start the planner: ${error.message}`);
    process.exitCode=1;
  }
});
server.on('listening',()=>console.log(`Local: http://127.0.0.1:${server.address().port}`));
server.listen(port,'127.0.0.1');
