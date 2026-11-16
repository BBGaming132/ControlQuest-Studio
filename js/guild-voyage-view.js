import { VOYAGE_PORTS, buildVoyageRounds, voyageCaptain, voyageReadiness } from './guild-voyage.js';

const escape = text => String(text ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function count(value) {
  const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

export function renderVoyageLobby({ group, cards, decks }) {
  return `<section class="pirate-voyage" aria-label="Guild Domain Voyages">
    <header class="pirate-harbor">
      <div><p class="pirate-kicker">The Guild’s domain campaign</p>
      <h2>Voyages of the Audit Isles</h2>
      <p>When every crew member finishes a domain, its harbor opens. Sail together, earn salvage, and turn each duel into a saved review.</p></div>
    </header>
    <div class="pirate-chart">
      ${VOYAGE_PORTS.map((port, index) => {
        const readiness = voyageReadiness(group.members, port.id);
        const hasRounds = readiness.unlocked && buildVoyageRounds(cards, decks, port.id, group.id, () => .5).length > 0;
        const newestResult = group.studySession?.voyage?.domainId === port.id && !group.studySession.active
          ? group.studySession.voyage : null;
        return `<article class="pirate-port ${readiness.unlocked ? 'pirate-port--open' : ''}">
          <div class="pirate-port__title"><p class="pirate-kicker">Domain ${index + 1}</p><h3>${escape(port.name)}</h3><p>${escape(port.specialty)}</p></div>
          <div class="pirate-port__progress">
            <progress value="${readiness.readyCount}" max="${Math.max(1, readiness.crew.length)}" aria-label="${escape(port.name)} crew readiness"></progress>
            <p>${readiness.readyCount} / ${readiness.crew.length} crew finished</p>
          </div>
          <details class="pirate-port__crew"><summary>Crew progress</summary>
            ${readiness.crew.length ? `<ul>${readiness.crew.map(member =>
              `<li><span>${escape(member.name)}</span><strong>${member.needsSync ? 'Sync needed' : `${member.done} / ${readiness.lessonCount} lessons`}</strong></li>`).join('')}</ul>` : '<p>Invite a crew from your Guild.</p>'}
          </details>
          ${newestResult ? `<small class="pirate-port__result">Last voyage · ${count(newestResult.crewGold)} salvage</small>` : ''}
          ${hasRounds ? `<button class="primary-button" data-pirate-launch="${port.id}">Launch voyage</button>`
            : `<p class="pirate-port__locked">${readiness.unlocked ? 'Add shared questions for this domain to launch.' : 'Finish the domain together to unlock.'}</p>`}
        </article>`;
      }).join('')}
    </div>
  </section>`;
}

const facilities = [
  { name: 'Harbor Galley', reward: 'Provision the crew using salvage from accurate answers.' },
  { name: 'Shipwright’s Dry Dock', reward: 'Repair the fleet with salvage earned as a team.' },
  { name: 'Island Beacon', reward: 'Relight the channel and complete this voyage’s route.' },
];

function fleetMap(session, members) {
  const voyage = session.voyage;
  const target = Math.max(3, voyage.rounds.length * 3);
  const crewGold = count(voyage.crewGold);
  const captain = voyageCaptain(session);
  const scoreTarget = Math.max(1, voyage.rounds.length * 120 + 90);
  return `<div class="pirate-fleet">
    <div class="pirate-fleet__header"><strong>Fleet chart</strong><span>${crewGold} / ${target} salvage</span></div>
    <progress value="${Math.min(crewGold, target)}" max="${target}" aria-label="Crew salvage"></progress>
    <div class="pirate-facilities">${facilities.map((facility, index) => {
      const needed = Math.ceil(target * (index + 1) / facilities.length);
      return `<details class="pirate-facility ${crewGold >= needed ? 'pirate-facility--restored' : ''}">
        <summary><span>${escape(facility.name)}</span><strong>${crewGold >= needed ? 'Restored' : `${needed} salvage`}</strong></summary>
        <p>${escape(facility.reward)}</p>
      </details>`;
    }).join('')}</div>
    <div class="pirate-ship-lanes">${members.map(member => {
      const score = count(session.scores?.[member.uid]);
      const percent = Math.max(0, Math.min(100, Math.round(score / scoreTarget * 100)));
      return `<div class="pirate-ship-lane">
        <span>${escape(member.name)}${member.uid === captain ? ' <small>Captain</small>' : ''}</span>
        <span class="pirate-ship-lane__water"><span class="pirate-ship" style="--position:${percent}%" aria-hidden="true"></span></span>
        <strong>${score} pts</strong>
      </div>`;
    }).join('')}</div>
  </div>`;
}

export function renderVoyageSession({ session, group, uid, charge, explanation = '' }) {
  const { voyage } = session;
  const port = VOYAGE_PORTS.find(item => item.id === voyage.domainId);
  const participants = session.participants || [];
  const name = id => group.members?.[id]?.name || 'Crew member';
  const members = participants.map(id => ({ uid: id, name: name(id) }));
  const response = session.responses?.[uid];
  const card = voyage.rounds[session.index];
  const reveal = session.revealed;
  const answered = participants.filter(id => session.responses?.[id]?.answer).length;
  const allAnswered = participants.length > 0 && answered === participants.length;
  const isJoined = participants.includes(uid);
  const pending = session.pendingParticipants?.includes(uid);
  const routeHeader = `<header class="pirate-harbor pirate-harbor--round">
    <div><p class="pirate-kicker">${escape(port?.specialty || 'Guild Domain Voyage')}</p><h2>${escape(port?.name || 'Audit Isles')}</h2></div>
    <div class="pirate-harbor__tag">${card ? `Round ${count(session.index) + 1} / ${voyage.rounds.length}` : 'Voyage complete'}</div>
  </header>`;
  if (!card) {
    const rankings = Object.entries(session.scores || {}).map(([id, score]) => [id, count(score)]).sort((a, b) => b[1] - a[1]);
    const top = rankings.length ? rankings.filter(([, score]) => score === rankings[0][1]).map(([id]) => name(id)) : [];
    return `<section class="pirate-voyage" aria-label="Voyage results">${routeHeader}
      ${fleetMap(session, members)}
      <div class="pirate-question">
        <h3>${top.length && rankings[0][1] ? `${escape(top.join(' and '))} ${top.length > 1 ? 'share' : 'takes'} the captain’s purse` : 'The fleet is back in harbor'}</h3>
        <p>Your team earned ${count(voyage.crewGold)} salvage on this run. Answered questions are added to each player’s review history.</p>
        ${isJoined ? '<button class="primary-button" id="endGuildStudy">Return to harbor</button>' : ''}
      </div></section>`;
  }
  return `<section class="pirate-voyage pirate-voyage--playing" aria-label="Live pirate voyage">
    ${routeHeader}${fleetMap(session, members)}
    ${!isJoined ? `<div class="pirate-question"><h3>${pending ? 'You’re aboard next round' : 'The crew is sailing'}</h3>
      <p>${pending ? 'This question was already revealed. You’ll join as soon as the crew moves on.' : 'Board when you’re ready to answer with the crew.'}</p>
      ${pending ? '' : '<button class="primary-button" id="joinV3Guild">Board the fleet</button>'}</div>` : `
      <div class="pirate-question">
        <div class="pirate-question__crew" role="status">
          <strong>${reveal ? 'Answers revealed' : `${answered} / ${participants.length} crew locked in`}</strong>
          <span>${escape(name(voyageCaptain(session)))} at the helm</span>
        </div>
        <h3>${escape(card.question)}</h3>
        ${!reveal && !response && !voyage.fullSailUsed?.[uid] ? `<label class="pirate-tactic">
          <input id="pirateFullSail" type="checkbox" ${charge ? 'checked' : ''}>
          <span><strong>Full Sail</strong><small>One wager per voyage. +90 for a correct answer, −60 for a miss.</small></span>
        </label>` : ''}
        <div class="quiz-options pirate-options">
          ${Object.entries(card.choices).map(([letter, text]) => `<button class="quiz-option ${response?.answer === letter ? 'selected' : ''} ${reveal && letter === card.correctAnswer ? 'correct' : ''} ${reveal && response?.answer === letter && letter !== card.correctAnswer ? 'incorrect' : ''}"
            data-guild-answer="${escape(letter)}" ${reveal || response ? 'disabled' : ''}><strong>${escape(letter)}</strong><span>${escape(text)}</span></button>`).join('')}
        </div>
        ${!reveal && response ? `<p>Locked in: ${escape(response.answer)}${response.charge ? ' · Full Sail wager' : ''}</p>` : ''}
        ${reveal ? `<div class="pirate-reveal"><strong>${response?.correct ? 'On target' : 'Course correction'} · Answer ${escape(card.correctAnswer)}</strong>
          ${explanation}<ul>${members.map(member => `<li>${escape(member.name)}: ${session.responses?.[member.uid]?.correct ? 'Correct' : session.responses?.[member.uid] ? 'Missed' : 'No answer'}</li>`).join('')}</ul>
        </div><button class="primary-button" id="nextGuildQuestion">${session.index + 1 === voyage.rounds.length ? 'See voyage results' : 'Sail to next question'}</button>`
          : `<button class="primary-button" id="revealGuildAnswer" ${allAnswered ? '' : 'disabled'}>Reveal answers</button>`}
        <div class="pirate-question__exit"><button class="ghost-button" id="leaveV3Guild">Leave the crew</button>
          ${session.hostUid === uid ? '<button class="ghost-button" id="endGuildStudy">End voyage</button>' : ''}</div>
      </div>`}
  </section>`;
}
