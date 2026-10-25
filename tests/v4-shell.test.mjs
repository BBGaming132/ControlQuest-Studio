import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

// Execute the real app shell and its real view modules; only external startup,
// persistence and background clocks are replaced. Exercise navigation as a user.
const dom=new JSDOM('<div id="app"></div>',{url:'https://controlquest.test/',pretendToBeVisual:true});
for(const name of ['window','document','localStorage','HTMLElement','navigator'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
dom.window.scrollTo=()=>{};
const appUrl=new URL('../js/app.js',import.meta.url),source=await readFile(appUrl,'utf8'),bindings={};
for(const match of source.matchAll(/^import\s*\{([^}]+)\}\s*from\s*'([^']+)';/gm)){
 const module=await import(new URL(match[2],appUrl));
 for(const entry of match[1].split(',')){const [name,alias]=entry.trim().split(/\s+as\s+/);bindings[alias||name]=module[name];}
}
const persisted=[];bindings.saveProfile=async p=>persisted.push(structuredClone(p));bindings.updateMemberSummary=async()=>{};
const context=vm.createContext({...bindings,window:dom.window,document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage,URL,URLSearchParams,Date,Intl,console,crypto:globalThis.crypto,TextEncoder,Uint8Array,AbortController,
 setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn(),CustomEvent:dom.window.CustomEvent,
});
const executable=source.replace(/^import[^\n]+\n/gm,'').replace('\ninit();\n','\n');
vm.runInContext(executable+'\nglobalThis.shell={state,defaultProfile,renderApp,navigateTo};',context);
const {state,defaultProfile,renderApp,navigateTo}=context.shell;
state.user={uid:'shell-user',email:'learner@example.test'};state.profile=defaultProfile(state.user);state.profile.preferences.onboardingComplete=true;
const $=selector=>dom.window.document.querySelector(selector),$$=selector=>[...dom.window.document.querySelectorAll(selector)];
renderApp();
assert.deepEqual($$('.cq-primary-nav>button').map(b=>b.textContent.trim()),['Today','Study','Island','Games','Library']);
assert.deepEqual($$('.cq-bottom-nav>button').map(b=>b.textContent.trim()),['Today','Study','Island','Games','Library']);
assert.equal($('.cq-nav-more').open,false,'specialist tools start collapsed');
assert.ok($('.cq-nav-more [data-view="profile"]'),'Settings remains reachable');
assert.equal($$('.cq-primary-nav [data-view="mastery"]').length,0,'progress is in Library rather than another primary destination');
assert.ok(!$('#viewRoot').textContent.match(/\b(?:Ty|Bennett)\b/),'public interface contains no fixed personal names');

$('.cq-primary-nav [data-view="library"]').click();
assert.equal(state.activeView,'library');assert.equal($$('.cq-library-grid>button').length,4);
const shelf=$$('.cq-library-grid>button').map(b=>b.textContent);
assert.ok(shelf.some(t=>t.includes('Import files')));assert.ok(shelf.some(t=>t.includes('Your progress')));
$('.cq-library-grid [data-go="import"]').click();
assert.equal(state.activeView,'import');assert.ok($('#cqBatchFiles'));assert.equal($('#cqBatchFiles').multiple,true);
assert.ok($('.cq-primary-nav [data-view="library"]').classList.contains('active'),'Library stays selected inside its import view');
$('.cq-bottom-nav [data-mobile-view="feed"]').click();
assert.equal(state.activeView,'feed');assert.ok($('#viewRoot').textContent.includes('Add your questions to begin'),'empty library gives a concrete next step');
assert.ok($('#viewRoot [data-cq-nav="import"]'));
$('.cq-primary-nav [data-view="adventure"]').click();
assert.equal(state.activeView,'adventure');assert.ok($('.island-play'),'Island renders through the real experience module');
assert.ok($('[data-ip-site]'),'island has actual landmark hotspots');
$('[data-ip-site="greenhouse"]').click();assert.match($('[data-ip-context]').textContent,/Glowfruit garden/,'tapping a different landmark updates the actual context');
$('.cq-primary-nav [data-view="arcade"]').click();assert.equal(state.activeView,'arcade');assert.equal($$('[data-arcade-game]').length,4,'all original solo game modes are discoverable');assert.ok($('#arcadeGuild'),'Guild game entry is visible');

$('.cq-nav-more').open=true;$('.cq-nav-more').dispatchEvent(new dom.window.Event('toggle'));
$('.cq-primary-nav [data-view="command"]').click();assert.equal($('.cq-nav-more').open,true,'user choice to expand More tools survives a view render');
const select=$('#themeSelect');select.value='light';select.dispatchEvent(new dom.window.Event('change'));
assert.equal(state.profile.preferences.theme,'light');assert.equal(dom.window.document.documentElement.dataset.theme,'light');
navigateTo('library');assert.equal($('#themeSelect').value,'light','appearance is preserved across screens');
$('#helpBtn').click();assert.ok($('.modal-card').textContent.includes('Your study expedition'));assert.ok($('.modal-card').textContent.includes('Your active Guild shares one island'));
$('.modal-card [data-cancel]').click();
navigateTo('not-a-view');assert.equal(state.activeView,'command','unknown navigation recovers to Today');
dom.window.close();
console.log('App shell: five primary destinations, working desktop/mobile links, collapsed tools, import/progress discoverability, generic names, theme persistence and help passed.');
