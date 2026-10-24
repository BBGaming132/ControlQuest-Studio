import {cp,mkdir,rm,stat,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),output=resolve(root,'dist');
if(output!==resolve(root,'dist'))throw new Error('Invalid build output');
await mkdir(output,{recursive:true});for(const entry of await readdir(output))await rm(resolve(output,entry),{recursive:true,force:true});
for(const path of ['index.html','assets','css','js','config']){await stat(resolve(root,path));await cp(resolve(root,path),resolve(output,path),{recursive:true});}
console.log('Static build ready in dist. GitHub Pages can continue serving the source root.');
