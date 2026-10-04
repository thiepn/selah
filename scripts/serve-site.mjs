import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../site/',import.meta.url));
const port=Number(process.env.PORT??4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jsonl':'application/x-ndjson; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.md':'text/markdown; charset=utf-8'};
createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let target=normalize(join(root,pathname));if(!target.startsWith(root)){res.writeHead(403).end();return;}try{if((await stat(target)).isDirectory())target=join(target,'index.html');}catch{}const body=await readFile(target);res.writeHead(200,{'content-type':types[extname(target)]??'application/octet-stream','cache-control':'no-cache'});res.end(body);}catch{res.writeHead(404,{'content-type':'text/plain'});res.end('Not found');}}).listen(port,()=>console.log(`Selah: http://127.0.0.1:${port}`));
