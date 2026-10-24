import {readdirSync} from 'node:fs';import {spawnSync} from 'node:child_process';
for(const file of readdirSync(new URL('../tests/',import.meta.url)).filter(n=>n.endsWith('.mjs')).sort()){
 const result=spawnSync(process.execPath,[new URL('../tests/'+file,import.meta.url).pathname],{stdio:'inherit',env:process.env});
 if(result.status!==0)process.exit(result.status||1);
}
