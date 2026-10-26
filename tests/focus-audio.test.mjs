import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {FOCUS_TRACKS,createFocusAudioController,renderFocusAudio,bindFocusAudio} from '../js/focus-audio.js';
class AudioMock extends EventTarget {
 constructor(){super();this.src='';this.currentTime=0;this.duration=300;this.volume=1;this.calls=0;AudioMock.last=this;}
 load(){} async play(){this.calls++;this.dispatchEvent(new Event('play'));} pause(){this.dispatchEvent(new Event('pause'));}removeAttribute(){this.src='';}
}
const memory=new Map();const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
let c=createFocusAudioController({AudioClass:AudioMock,storage});
assert.equal(c.getState().track,null);assert.equal(c.getState().volume,.2);assert.equal(AudioMock.last,undefined,'silence initial render never creates/fetches audio');
await c.select(FOCUS_TRACKS[0].id);assert.equal(AudioMock.last,undefined,'selection alone does not download');await c.play();assert.equal(c.getState().playing,true);assert.match(AudioMock.last.src,/assets\/audio\/late-night-radio.mp3/);
c.setVolume(.7);assert.equal(AudioMock.last.volume,.7);AudioMock.last.currentTime=42;AudioMock.last.dispatchEvent(new Event('timeupdate'));c.pause();
const resumed=createFocusAudioController({AudioClass:AudioMock,storage});assert.equal(resumed.getState().time,42);assert.equal(resumed.getState().playing,false);await resumed.play();AudioMock.last.dispatchEvent(new Event('loadedmetadata'));assert.equal(AudioMock.last.currentTime,42);
resumed.setCategory('Piano');await resumed.select('meditation-impromptu-01',{playNow:true});AudioMock.last.dispatchEvent(new Event('ended'));await Promise.resolve();assert.equal(resumed.getState().trackId,'meditation-impromptu-02');
resumed.setMode('repeat');AudioMock.last.dispatchEvent(new Event('ended'));await Promise.resolve();assert.equal(resumed.getState().trackId,'meditation-impromptu-02');
resumed.silence();assert.equal(resumed.getState().trackId,'');assert.equal(resumed.getState().playing,false);
const blocked=createFocusAudioController({AudioClass:class extends AudioMock{async play(){throw Object.assign(new Error('denied'),{name:'NotAllowedError'});}},storage});await blocked.select(FOCUS_TRACKS[0].id);await blocked.play();assert.match(blocked.getState().error,/Tap Play/);assert.equal(blocked.getState().playing,false);
const dom=new JSDOM(renderFocusAudio());const root=dom.window.document;const dispose=bindFocusAudio(root,{controller:c});const select=root.querySelector('[data-audio-track]');select.value=FOCUS_TRACKS[2].id;select.dispatchEvent(new dom.window.Event('change'));assert.equal(c.getState().trackId,FOCUS_TRACKS[2].id);
root.querySelector('[data-audio-play]').click();await Promise.resolve();assert.equal(c.getState().playing,true);dispose();root.querySelector('[data-audio-silence]').click();assert.equal(c.getState().playing,true,'cleanup removes view handlers without interrupting music');c.silence();
assert.equal(root.querySelectorAll('[autoplay]').length,0);assert.ok(root.querySelector('a[href="assets/audio/credits.txt"]'));assert.equal(root.querySelector('[data-audio-volume]').getAttribute('aria-label'),'Focus audio volume');
const manifest=JSON.parse(await readFile(new URL('../assets/audio/catalog.json',import.meta.url),'utf8'));assert.equal(manifest.length,12);assert.equal(FOCUS_TRACKS.length,manifest.length);let totalSeconds=0;
for(const track of manifest){const path=new URL('../'+track.file,import.meta.url);const file=await readFile(path);assert.equal(createHash('sha256').update(file).digest('hex'),track.sha256);assert.equal((await stat(path)).size,track.bytes);assert.equal(track.license,'CC BY 4.0');assert.ok(track.source.includes('isrc='+track.isrc));assert.ok(track.seconds>140);assert.ok(file.length>100000);totalSeconds+=track.seconds;
 // Decoder validation is also run during asset preparation; optional in CI environments without ffprobe.
 try{const output=execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name','-of','csv=p=0',path.pathname],{encoding:'utf8'});assert.equal(output.trim(),'mp3');}catch(error){if(error.code!=='ENOENT')throw error;}
}
assert.ok(totalSeconds>45*60);console.log('Focus audio: 12 licensed full recordings, hashes/decoding, explicit playback, resume, playlist, repeat, silence, errors and cleanup passed.');
