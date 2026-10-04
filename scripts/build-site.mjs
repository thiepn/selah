import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'site');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await cp(join(root,'web'),out,{recursive:true});
await cp(join(root,'dist/src'),join(out,'core'),{recursive:true,filter:(source)=>!source.endsWith('.map')&&!source.endsWith('.d.ts')});
try { await cp(join(root,'.generated/data'),join(out,'data'),{recursive:true}); } catch { await cp(join(root,'fixtures'),join(out,'data'),{recursive:true}); }
console.log(`Built static Selah site at ${out}`);
