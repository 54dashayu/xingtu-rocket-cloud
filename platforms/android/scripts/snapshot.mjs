import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=resolve(root,'../../public');
const destination=resolve(root,'snapshot/public');
await mkdir(destination,{recursive:true});
// Snapshot only public web assets; never copy data, deployment files or credentials.
await cp(source,destination,{recursive:true});
const files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
 const path=resolve(dir,entry.name);
 if(entry.isDirectory())await walk(path);
 else if(entry.isFile())files.push({path:relative(source,path),sha256:createHash('sha256').update(await readFile(path)).digest('hex')});
}}
await walk(source);
files.sort((a,b)=>a.path.localeCompare(b.path));
await writeFile(resolve(root,'snapshot/manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),source:'../../public',files},null,2)+'\n');
await cp(destination,resolve(root,'www'),{recursive:true});
const page=(await readFile(resolve(destination,'map.html'),'utf8')).replace('<script defer src="/xingtu-analytics/tracker.js"></script>','');
await writeFile(resolve(root,'www/index.html'),page);
console.log(`Snapshot created: ${files.length} public assets; four-tab app entry bundled.`);
