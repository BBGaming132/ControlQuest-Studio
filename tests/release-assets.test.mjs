import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const html=readFileSync('index.html','utf8'),version=readFileSync('VERSION.txt','utf8').trim();
const map=JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]).imports;
for(const dir of ['js','config'])for(const file of readdirSync(dir).filter(n=>n.endsWith('.js'))){const key=`./${dir}/${file}`;assert.equal(map[key],`${key}?v=${version}`);const resolved=new URL(key,'https://example.test/ControlQuest-Studio/').href;assert.equal(new URL('./'+file,'https://example.test/ControlQuest-Studio/'+dir+'/app.js?v='+version).href,resolved);}
assert.match(html,/import "\.\/js\/app.js"/);
console.log('All application modules use one versioned import map, including relative dependencies.');
