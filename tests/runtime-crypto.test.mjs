import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {sha256Fallback,sha256Hex,randomId} from '../js/runtime-crypto.js';
for(const input of ['', 'abc','controlquest ✦', 'a'.repeat(2000)]){const expected=createHash('sha256').update(input).digest('hex');assert.equal(sha256Fallback(input),expected);assert.equal(await sha256Hex(input),expected);}
assert.match(randomId(),/^[0-9a-f-]{36}$/);console.log('Stable SHA-256 IDs pass known vectors in secure and local-preview modes');
