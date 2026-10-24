// Pure command reducer shared by Firestore transactions and local tests.
const validUid=uid=>typeof uid==='string'&&uid.trim().length>0&&uid.length<=200;
const uniqueUids=values=>[...new Set((Array.isArray(values)?values:[]).filter(validUid))];
function normalizeSession(current){
  const s=structuredClone(current);
  s.responses=s.responses&&typeof s.responses==='object'&&!Array.isArray(s.responses)?s.responses:{};
  s.scores=s.scores&&typeof s.scores==='object'&&!Array.isArray(s.scores)?s.scores:{};
  const legacyParticipants=[s.hostUid,...Object.keys(s.responses)];
  s.participants=uniqueUids(Array.isArray(s.participants)?s.participants:legacyParticipants);
  s.pendingParticipants=uniqueUids(s.pendingParticipants).filter(uid=>!s.participants.includes(uid));
  s.index=Number.isInteger(s.index)&&s.index>=0?s.index:0;
  return s;
}
function nextRound(s){
  s.index++;s.responses={};s.revealed=false;s.revealedAt=null;
  s.participants=uniqueUids([...s.participants,...s.pendingParticipants]);s.pendingParticipants=[];
  return s;
}
export function reduceGuildSession(current,command={}){
  if(!validUid(command.uid))throw new Error('A signed-in player is required.');
  const s=current?normalizeSession(current):null;
  if(command.type==='start'){
    if(s?.active)throw new Error('A Guild session is already active. Join or end it first.');
    const session=command.session;
    if(!session||typeof session.id!=='string'||!session.id.trim())throw new Error('A session needs a valid identifier.');
    if(!Array.isArray(session.cardKeys)||!session.cardKeys.length||session.cardKeys.length>300||session.cardKeys.some(key=>typeof key!=='string'||!key.trim()))throw new Error('Choose one to 300 valid questions before starting.');
    return {...structuredClone(session),active:true,hostUid:command.uid,participants:[command.uid],pendingParticipants:[],responses:{},scores:{},index:0,revealed:false};
  }
  if(!s?.active||s.id!==command.sessionId)throw new Error('This session has ended. Refresh to join the current one.');
  if(command.type==='join'){
    if(s.participants.includes(command.uid)||s.pendingParticipants.includes(command.uid))return s;
    // A player joining an already revealed question enters at the next question,
    // never the completed question's scoring/reveal gate.
    if(s.revealed)s.pendingParticipants.push(command.uid);else s.participants.push(command.uid);
    return s;
  }
  if(command.type==='leave'){
    const joined=s.participants.includes(command.uid)||s.pendingParticipants.includes(command.uid);
    if(!joined)throw new Error('Join the session first.');
    s.participants=s.participants.filter(uid=>uid!==command.uid);
    s.pendingParticipants=s.pendingParticipants.filter(uid=>uid!==command.uid);
    delete s.responses[command.uid];
    if(!s.participants.length){
      if(s.pendingParticipants.length&&s.revealed)nextRound(s);
      else s.active=false;
    }
    return s;
  }
  if(!s.participants.includes(command.uid))throw new Error(s.pendingParticipants.includes(command.uid)?'You will join at the next question.':'Join the session first.');
  if(command.index!==undefined&&command.index!==s.index)throw new Error('The group has moved to another question.');
  if(command.type==='answer'){
    if(s.revealed||s.responses[command.uid])return s;
    if(!['A','B','C','D'].includes(command.answer))throw new Error('Choose a valid answer.');
    if(!s.cardKeys?.[s.index])throw new Error('All questions are complete. Close this session to start another.');
    s.responses[command.uid]={answer:command.answer,at:command.at||null};return s;
  }
  if(command.type==='reveal'){
    if(s.revealed)return s;
    if(!['A','B','C','D'].includes(command.correctAnswer))throw new Error('The current question needs a valid answer key.');
    if(!s.participants.length||!s.participants.every(uid=>s.responses[uid]?.answer))throw new Error('Wait for each joined player to lock an answer.');
    for(const uid of s.participants){const response=s.responses[uid];response.correct=response.answer===command.correctAnswer;if(response.correct)s.scores[uid]=(Number(s.scores[uid])||0)+120;}
    s.revealed=true;s.revealedAt=command.at||null;return s;
  }
  if(command.type==='next'){
    if(!s.revealed)throw new Error('Reveal this question before moving on.');
    return nextRound(s);
  }
  if(command.type==='end'){s.active=false;s.endedAt=command.at||null;return s;}
  throw new Error('Unknown Guild action.');
}
