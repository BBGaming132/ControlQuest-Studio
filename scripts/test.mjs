import {readdirSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
for(const file of readdirSync(new URL('../tests/',import.meta.url)).filter(n=>n.endsWith('.mjs')).sort()){
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('../tests/'+file,import.meta.url))],{stdio:'inherit',env:process.env});
 if(result.status!==0)process.exit(result.status||1);
}
