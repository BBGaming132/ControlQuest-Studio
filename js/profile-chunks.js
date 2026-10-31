// Keep bulky profile fields outside Firestore's single-document limit.
// Immutable content-addressed chunks are committed before the profile pointer.
import {sha256Hex} from './runtime-crypto.js';
export async function packProfile(profile){
 const root={...profile},chunks=[],fields={};delete root._profileChunks;
 for(const [key,value] of Object.entries(root)){
  const json=JSON.stringify(value);if(!json||new TextEncoder().encode(json).length<24000)continue;
  const ids=[],characters=Array.from(json);
  for(let i=0;i<characters.length;i+=40000){const data=characters.slice(i,i+40000).join(''),id='profile_chunk_'+await sha256Hex(data);ids.push(id);chunks.push({id,recordType:'profile-chunk',data});}
  fields[key]=ids;root[key]=null;
 }
 if(Object.keys(fields).length)root._profileChunks={version:1,fields};
 if(new TextEncoder().encode(JSON.stringify(root)).length>700000)throw new Error('Profile is too large to save safely. Your pending answers remain on this device.');
 return {root,chunks};
}
export async function unpackProfile(root,read){
 if(!root?._profileChunks)return root;
 const profile={...root};
 for(const [key,ids] of Object.entries(root._profileChunks.fields||{})){
  if(['__proto__','prototype','constructor'].includes(key))throw new Error('Invalid profile field.');
  const parts=await Promise.all(ids.map(async id=>{const chunk=await read(id);if(chunk?.recordType!=='profile-chunk'||typeof chunk.data!=='string')throw new Error('Profile data could not be loaded. Please reconnect; do not reset your account.');return chunk.data;}));
  profile[key]=JSON.parse(parts.join(''));
 }
 delete profile._profileChunks;return profile;
}
