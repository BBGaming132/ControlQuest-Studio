// Offline, read-only staging validator. Does not connect to either provider.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {unpackProfile} from '../../js/profile-chunks.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>JSON.stringify(stable(value));
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));return value;}
const paths=[/^users\/[^/]+$/,/^users\/[^/]+\/(studyDecks|studyCards|studyProgress|studyReviews)\/[^/]+$/,/^groups\/[^/]+$/,/^groups\/[^/]+\/(studyDecks|studyCards|studyReviews)\/[^/]+$/,/^(publicStudyDecks|publicStudyCards|publicLessonContributions|publicLessonStatus|aiPracticeCatalog|aiPracticeQuota)\/[^/]+$/,/^deletedProfiles\/[^/]+\/backups\/[^/]+$/];
export async function validateExport(bundle){
 if(bundle?.format!=='controlquest-migration-v1'||!Array.isArray(bundle.documents)||!Number.isFinite(Date.parse(bundle.capturedAt)))throw new Error('Invalid migration envelope');
 const docs=new Map(),counts={},hydrated=[],warnings=[];
 for(const doc of bundle.documents){
  if(typeof doc.path!=='string'||!paths.some(pattern=>pattern.test(doc.path))||!doc.data||typeof doc.data!=='object'||Array.isArray(doc.data))throw new Error('Unknown or invalid document path/data');
  if(docs.has(doc.path))throw new Error(`Duplicate document path: ${doc.path}`);
  const segments=doc.path.split('/'),uid=segments[0]==='users'?segments[1]:null;
  if(uid&&doc.data.uid!==undefined&&doc.data.uid!==uid)throw new Error(`UID mismatch: ${doc.path}`);
  if(uid&&doc.data.ownerUid!==undefined&&doc.data.ownerUid!==uid)throw new Error(`Owner mismatch: ${doc.path}`);
  if(doc.data.recordType==='profile-chunk'){
   if(segments[0]!=='users'||segments[2]!=='studyReviews'||typeof doc.data.data!=='string'||segments[3]!==`profile_chunk_${hash(doc.data.data)}`||doc.data.id!==segments[3])throw new Error('Invalid profile chunk or hash');
  }
  docs.set(doc.path,doc.data);const collection=segments.filter((_,i)=>i%2===0).join('/');counts[collection]=(counts[collection]||0)+1;
 }
 for(const [path,profile] of docs){
  if(!/^users\/[^/]+$/.test(path))continue;
  if(profile._profileChunks){
   const metadata=profile._profileChunks;if(metadata.version!==1||!metadata.fields||typeof metadata.fields!=='object'||Array.isArray(metadata.fields))throw new Error('Unsupported profile chunk version');
   for(const ids of Object.values(metadata.fields))if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'||!/^profile_chunk_[a-f0-9]{64}$/.test(id)))throw new Error('Invalid chunk references');
  }
  const value=await unpackProfile(profile,id=>docs.get(`${path}/studyReviews/${id}`));
  hydrated.push({path,sha256:hash(canonical(value))});
  for(const [kind,items] of Object.entries({quiz:value.v3?.homework?.quizzes,completion:value.v3?.homework?.completions}))for(const [id,item] of Object.entries(items||{})){
   if(item.storedSeparately){const found=[...docs].some(([p,d])=>p.startsWith(`${path}/studyReviews/`)&&d.recordType===`homework-${kind}`&&(d.key===id||d.value?.weekId===id||d.value?.lessonId===id));if(!found)throw new Error(`Missing separate homework ${kind} for ${path}: ${id}`);}
  }
 }
 if(bundle.pending!==undefined&&!Array.isArray(bundle.pending))throw new Error('Invalid pending queue list');
 const events=new Map();for(const event of bundle.pending||[]){
  if(typeof event.uid!=='string'||!event.uid||typeof event.id!=='string'||!event.id||!event.payload||typeof event.payload!=='object')throw new Error('Pending event needs owner, stable ID and payload');
  const key=canonical([event.uid,event.id]),digest=hash(canonical(event.payload));
  if(events.has(key)&&events.get(key)!==digest)throw new Error('Conflicting pending event payloads');
  if(events.has(key))warnings.push('Duplicate identical pending event: deduplicate by owner and event ID');events.set(key,digest);
 }
 if(bundle.complete!==true)warnings.push('Export is partial or completeness is unverified; not suitable for production cutover');
 if(events.size)warnings.push('Pending device events require server reconciliation before cutover');
 return {format:bundle.format,documentCount:docs.size,counts,profilesHydrated:hydrated.length,hydratedProfileHashes:hydrated,pendingEventCount:events.size,manifestSha256:hash(canonical([...docs].sort(([a],[b])=>a.localeCompare(b)))),warnings,cutoverApproved:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==3)throw new Error('Usage: node scripts/migration/validate-export.mjs export.json');const report=await validateExport(JSON.parse(await readFile(process.argv[2],'utf8')));console.log(JSON.stringify(report,null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
