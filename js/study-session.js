// Shuffle presentation only; canonical answer keys remain attached to their text.
export function shuffle(items,random=Math.random){const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
export function choiceOrder(card,random=Math.random){const keys=Object.keys(card.choices||{});return /\b(all|none) of the above\b|\b[A-D] and [A-D]\b/i.test(Object.values(card.choices||{}).join(' '))?keys:shuffle(keys,random);}
export function clockLabel(ms){const seconds=Math.max(0,Math.floor((Number(ms)||0)/1000));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
