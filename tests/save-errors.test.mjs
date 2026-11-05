import assert from 'node:assert/strict';
import {saveErrorMessage} from '../js/save-errors.js';
assert.match(saveErrorMessage({code:'resource-exhausted',message:'Quota exceeded.'}),/Cloud database quota/);
assert.match(saveErrorMessage({name:'QuotaExceededError',message:'Quota exceeded.'}),/browser cannot store/);
assert.equal(saveErrorMessage(new Error('Permission denied')),'Permission denied');
console.log('Save errors distinguish cloud quota, browser capacity and unrelated failures.');
