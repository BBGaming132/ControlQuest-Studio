// Full, licensed recordings. Attribution and provenance: assets/audio/catalog.json.
import { FOCUS_TRACKS } from './focus-audio-catalog.js';
export { FOCUS_TRACKS };
const STORAGE_KEY='controlquest.focusAudio.v1';
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bounded=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
function deviceStorage(){try{return globalThis.localStorage;}catch{return undefined;}}
export function createFocusAudioController({AudioClass=globalThis.Audio,storage=deviceStorage()}={}) {
  let saved={};try{saved=JSON.parse(storage?.getItem(STORAGE_KEY)||'{}')||{};}catch{}
  let selected=FOCUS_TRACKS.find(x=>x.id===saved.trackId)?.id||'',volume=bounded(saved.volume,0,1,.2),mode=saved.mode==='repeat'?'repeat':'playlist',category=['All',...FOCUS_TRACKS.map(t=>t.category)].includes(saved.category)?saved.category:'All';
  let audio=null,playing=false,error='',time=bounded(saved.time,0,24*3600,0),lastSaved=-1,operation=0;
  const listeners=new Set();
  const track=()=>FOCUS_TRACKS.find(t=>t.id===selected)||null;
  const list=()=>FOCUS_TRACKS.filter(t=>category==='All'||t.category===category);
  const save=()=>{try{storage?.setItem(STORAGE_KEY,JSON.stringify({trackId:selected,volume,mode,category,time}));}catch{}};
  const state=()=>({track:track(),trackId:selected,volume,mode,category,playing,error,time,tracks:list()});
  const emit=()=>listeners.forEach(fn=>fn(state()));
  const ensureAudio=()=>{
    if(audio)return audio;if(!AudioClass)throw new Error('Audio playback is unavailable in this browser.');
    audio=new AudioClass();audio.preload='none';audio.volume=volume;
    audio.addEventListener('loadedmetadata',()=>{if(time>0&&Number.isFinite(audio.duration))audio.currentTime=Math.min(time,Math.max(0,audio.duration-1));});
    audio.addEventListener('timeupdate',()=>{time=Number.isFinite(audio.currentTime)?audio.currentTime:0;const slot=Math.floor(time/5);if(slot!==lastSaved){lastSaved=slot;save();}});
    audio.addEventListener('play',()=>{playing=true;error='';emit();});
    audio.addEventListener('pause',()=>{playing=false;save();emit();});
    audio.addEventListener('error',()=>{operation++;playing=false;error='This recording could not load. Try another track or study in silence.';emit();});
    audio.addEventListener('ended',()=>{playing=false;time=0;if(mode==='repeat')void play();else void next(1,true);});
    return audio;
  };
  const pause=()=>{operation++;audio?.pause();playing=false;save();emit();};
  const play=async()=>{
    if(!selected)return;
    const own=++operation;
    try{
      const el=ensureAudio(),url=new URL('../'+track().file,import.meta.url).href;
      if(el.src!==url){el.src=url;el.load();}
      await el.play();
      if(own!==operation)return;
      playing=true;error='';emit();
    }catch(err){if(own!==operation)return;playing=false;error=err?.name==='NotAllowedError'?'Tap Play to allow audio in this browser.':'Playback could not start. Try another track or study in silence.';emit();}
  };
  const select=async(id,{playNow=false}={})=>{
    pause();selected=FOCUS_TRACKS.some(t=>t.id===id)?id:'';time=0;if(audio){try{audio.currentTime=0;}catch{}}error='';lastSaved=-1;save();emit();if(playNow&&selected)await play();
  };
  const next=async(direction=1,playNow=playing)=>{const items=list();if(!items.length)return;const index=items.findIndex(t=>t.id===selected),target=index<0?(direction<0?items.length-1:0):(index+direction+items.length)%items.length;await select(items[target].id,{playNow});};
  return {getState:state,play,pause,select,next,
    silence(){pause();selected='';time=0;error='';save();emit();},
    setVolume(value){volume=bounded(value,0,1,.2);if(audio)audio.volume=volume;save();emit();},
    setMode(value){mode=value==='repeat'?'repeat':'playlist';save();emit();},
    setCategory(value){category=['All',...FOCUS_TRACKS.map(t=>t.category)].includes(value)?value:'All';save();emit();},
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    destroy(){pause();listeners.clear();if(audio){audio.removeAttribute('src');audio.load();audio=null;}}
  };
}
let controller;
export function getFocusAudioController(){return controller ||= createFocusAudioController();}
export function stopFocusAudio(){controller?.pause();}
const duration=seconds=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
const trackOptions=s=>`<option value="">Silence</option>${s.tracks.map(t=>`<option value="${t.id}" ${t.id===s.trackId?'selected':''}>${escapeHtml(t.title)} · ${duration(t.seconds)}</option>`).join('')}${s.track&&!s.tracks.some(t=>t.id===s.trackId)?`<option value="${s.trackId}" selected>${escapeHtml(s.track.title)} · playing selection</option>`:''}`;
export function renderFocusAudio(){
 const s=getFocusAudioController().getState();
 return `<details class="cq-focus-audio"><summary><span aria-hidden="true">♫</span> Focus audio <span class="cq-audio-summary">${s.playing?escapeHtml(s.track?.title):'Off · optional'}</span></summary><div class="cq-audio-panel"><p class="cq-audio-intro">${FOCUS_TRACKS.length} full instrumental recordings. Start quietly, or choose silence. Audio is optional and does not affect your study score.</p><div class="cq-audio-selects"><label>Collection<select data-audio-category>${['All',...new Set(FOCUS_TRACKS.map(t=>t.category))].map(x=>`<option ${x===s.category?'selected':''}>${escapeHtml(x)}</option>`).join('')}</select></label><label>Recording<select data-audio-track>${trackOptions(s)}</select></label></div><div class="cq-audio-controls"><button type="button" data-audio-prev aria-label="Previous recording">Previous</button><button type="button" data-audio-play ${!s.track?'disabled':''}>${s.playing?'Pause':'Play'}</button><button type="button" data-audio-next aria-label="Next recording">Next</button><button type="button" data-audio-silence>Silence</button></div><div class="cq-audio-settings"><label>Volume <output data-audio-volume-label>${Math.round(s.volume*100)}%</output><input data-audio-volume type="range" min="0" max="100" step="1" value="${Math.round(s.volume*100)}" aria-label="Focus audio volume"></label><label>When the track ends<select data-audio-mode><option value="playlist" ${s.mode==='playlist'?'selected':''}>Next in collection</option><option value="repeat" ${s.mode==='repeat'?'selected':''}>Repeat recording</option></select></label></div><p class="cq-audio-status" data-audio-status role="status">${s.error?escapeHtml(s.error):s.track?`${escapeHtml(s.track.title)} · ${s.playing?'Playing':'Ready when you are'}`:'Silence selected. Choose a recording, then press Play.'}</p><p class="cq-audio-credit" data-audio-credit>${credit(s.track)}</p><details class="cq-audio-evidence"><summary>Music, learning, and credits</summary><p>Music with lyrics can interfere with verbal learning. A controlled study found no reliable memory benefit from instrumental lo-fi compared with silence. Try low-volume instrumental music if you enjoy it, and switch to silence when it competes with the questions.</p><p><a href="https://doi.org/10.5334/joc.273" target="_blank" rel="noopener noreferrer">Read the study</a> · <a href="https://journals.sagepub.com/doi/full/10.1177/20592043221134392" target="_blank" rel="noopener noreferrer">Systematic review</a></p><p>All recordings by <a href="https://incompetech.com/" target="_blank" rel="noopener noreferrer">Kevin MacLeod</a>, licensed <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Full recordings transcoded to smaller MP3 files for mobile playback; no musical edits. Gymnopédies composed by Erik Satie, performed by Kevin MacLeod. These artists do not endorse ControlQuest.</p><a href="assets/audio/credits.txt" target="_blank" rel="noopener noreferrer">All track credits and sources</a></details></div></details>`;
}
function credit(track){return track?`“${escapeHtml(track.title)}” — ${escapeHtml(track.artist)} · <a href="${escapeHtml(track.source)}" target="_blank" rel="noopener noreferrer">Source</a> · <a href="${track.licenseUrl}" target="_blank" rel="noopener noreferrer">${track.license}</a> · <a href="${track.file}" download>Download MP3</a>`:'No audio downloads until you press Play.';}
export function bindFocusAudio(root,{controller:custom}={}){
 const container=root?.matches?.('.cq-focus-audio')?root:root?.querySelector?.('.cq-focus-audio');if(!container)return()=>{};
 const c=custom||getFocusAudioController(),handlers=[];
 const on=(selector,event,handler)=>{const el=container.querySelector(selector);if(el){el.addEventListener(event,handler);handlers.push(()=>el.removeEventListener(event,handler));}};
 const update=s=>{
  container.querySelector('.cq-audio-summary').textContent=s.playing?s.track?.title:'Off · optional';
  const select=container.querySelector('[data-audio-track]');select.innerHTML=trackOptions(s);select.value=s.trackId;
  const play=container.querySelector('[data-audio-play]');play.textContent=s.playing?'Pause':'Play';play.disabled=!s.track;
  container.querySelector('[data-audio-volume-label]').textContent=Math.round(s.volume*100)+'%';
  container.querySelector('[data-audio-volume]').value=Math.round(s.volume*100);
  container.querySelector('[data-audio-category]').value=s.category;
  container.querySelector('[data-audio-mode]').value=s.mode;
  container.querySelector('[data-audio-status]').textContent=s.error||(s.track?`${s.track.title} · ${s.playing?'Playing':'Ready when you are'}`:'Silence selected. Choose a recording, then press Play.');
  container.querySelector('[data-audio-credit]').innerHTML=credit(s.track);
 };
 on('[data-audio-track]','change',e=>void c.select(e.target.value,{playNow:c.getState().playing}));
 on('[data-audio-category]','change',e=>c.setCategory(e.target.value));
 on('[data-audio-play]','click',()=>c.getState().playing?c.pause():void c.play());
 on('[data-audio-prev]','click',()=>void c.next(-1));on('[data-audio-next]','click',()=>void c.next(1));
 on('[data-audio-silence]','click',()=>c.silence());on('[data-audio-volume]','input',e=>c.setVolume(Number(e.target.value)/100));
 on('[data-audio-mode]','change',e=>c.setMode(e.target.value));
 const unsubscribe=c.subscribe(update);update(c.getState());return()=>{unsubscribe();handlers.forEach(fn=>fn());};
}
