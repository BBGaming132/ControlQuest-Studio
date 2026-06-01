export const DOMAINS = [
  { id:'D1', name:'Information Systems Auditing Process', short:'Audit Process', weight:18, color:'#7c4dff' },
  { id:'D2', name:'Governance and Management of IT', short:'Governance', weight:18, color:'#00a7ff' },
  { id:'D3', name:'Information Systems Acquisition, Development and Implementation', short:'Acquisition + SDLC', weight:12, color:'#ff9f1c' },
  { id:'D4', name:'Information Systems Operations and Business Resilience', short:'Operations + Resilience', weight:26, color:'#18c29c' },
  { id:'D5', name:'Protection of Information Assets', short:'Asset Protection', weight:26, color:'#ff5c8a' }
];

export const TOPICS = [
  { domain:'D1', title:'CISA mindset: auditor evaluates, management owns', focus:'Learn the language of first, best, primary, greatest risk, and sufficient evidence.', tasks:['Watch/listen: CISA audit mindset overview','Draw: auditor vs management responsibility ladder','Practice: 8–10 Domain 1 QAE questions','Create: 3 flashcards from traps you saw'], homework:['Record a 2-minute teach-back on auditor independence','Review 5 missed or guessed questions','Add 2 notes to your notebook'] },
  { domain:'D1', title:'Audit charter, standards, ethics, and independence', focus:'Understand authority, scope, ethics, and independence threats.', tasks:['Sketch the audit charter purpose','Compare independence in fact vs appearance','Practice 8 independence/standards questions','Log one “auditor should not own remediation” trap'], homework:['Make a one-page charter/standards cheat sheet','Teach back why independence matters'] },
  { domain:'D1', title:'Risk-based audit planning', focus:'Prioritize audit work based on business risk and assurance value.', tasks:['Draw audit universe → risk ranking → audit plan','Identify inherent and residual risk examples','Practice 10 QAE questions','Add one Mistake Forge entry'], homework:['Build 5 flashcards on audit planning','Write a mini scenario for highest-risk audit area'] },
  { domain:'D1', title:'Audit execution and evidence', focus:'Evidence must be sufficient, reliable, relevant, and useful.', tasks:['Compare inquiry, observation, inspection, reperformance','Rank evidence reliability examples','Practice 10 QAE questions','Add evidence notes to notebook'], homework:['Review your evidence hierarchy','Add 2 examples from EY-style audit work'] },
  { domain:'D1', title:'Sampling, testing, and data analytics', focus:'Know what sampling and analytics can prove and what they cannot prove.', tasks:['Define compliance vs substantive testing','Draw sample selection → test → evaluate results','Practice 8–10 QAE questions','Create 4 sampling cards'], homework:['Make a quick controls testing cheat sheet','Review one old miss'] },
  { domain:'D1', title:'Reporting, findings, and follow-up', focus:'A strong finding includes criteria, condition, cause, effect, and recommendation.', tasks:['Draft a sample audit finding','Map report → management response → follow-up','Practice 10 QAE questions','Add one finding template to notes'], homework:['Record a 2-minute finding walkthrough','Review 3 finding/reporting flashcards'] },
  { domain:'D2', title:'IT governance structure and accountability', focus:'Board and senior management set direction; IT executes; auditors assure.', tasks:['Draw governance ownership ladder','Map board vs steering committee vs IT management','Practice 10 QAE questions','Log ownership traps'], homework:['Make 5 ownership flashcards','Write a “who owns this?” mini-drill'] },
  { domain:'D2', title:'IT strategy, policies, standards, and procedures', focus:'Strategy aligns IT to business; policies state intent; standards define rules.', tasks:['Create examples of policy/standard/procedure','Explain IT-business alignment','Practice 8 QAE questions','Create 3 cards'], homework:['Review policy hierarchy','Add notebook summary'] },
  { domain:'D2', title:'Risk management and control frameworks', focus:'Risk appetite, KRIs, monitoring, and ownership drive governance.', tasks:['Draw risk lifecycle','Define inherent/residual risk','Practice 10 QAE questions','Teach-back risk ownership'], homework:['Make a risk terms deck','Review missed QAE explanations'] },
  { domain:'D2', title:'Data governance, privacy, and classification', focus:'Data owners classify; custodians protect; privacy requires lawful, limited handling.', tasks:['Map data owner vs custodian','Define classification/retention','Practice 10 QAE questions','Log one privacy trap'], homework:['Create a privacy/data governance visual map','Add 4 cards'] },
  { domain:'D2', title:'Third-party/vendor management', focus:'Contracts, SLAs, monitoring, SOC reports, and exit strategies reduce vendor risk.', tasks:['Sketch vendor lifecycle','List key contract clauses','Practice 8 QAE questions','Write vendor risk checklist'], homework:['Review SOC report concepts','Make a 6-card vendor deck'] },
  { domain:'D3', title:'Project governance and business case', focus:'Projects need sponsorship, feasibility, scope, controls, and benefits tracking.', tasks:['Draw project governance roles','Review business case logic','Practice 8 QAE questions','Create 2 cards'], homework:['Write PIR questions','Review SDLC overview'] },
  { domain:'D3', title:'SDLC, Agile, and control design', focus:'Controls should be built in early, not bolted on later.', tasks:['Compare waterfall vs agile audit concerns','Draw SDLC phases','Practice 10 QAE questions','Teach-back control design'], homework:['Create SDLC phase flashcards','Write one agile audit risk example'] },
  { domain:'D3', title:'Testing, UAT, data conversion, and migration', focus:'Business users approve UAT; data conversion needs reconciliation and completeness.', tasks:['Map testing levels','List migration risks','Practice 10 QAE questions','Log implementation traps'], homework:['Create UAT/migration checklist','Review conversion control cards'] },
  { domain:'D3', title:'Post-implementation review and benefits realization', focus:'After go-live, assess whether objectives and controls are working.', tasks:['Draft PIR questions','Explain benefits realization','Practice 8 QAE questions','Make 3 flashcards'], homework:['Review project closeout concepts','Record a short teach-back'] },
  { domain:'D4', title:'IT operations overview and asset management', focus:'Operations controls keep services reliable, available, and recoverable.', tasks:['Draw operational control stack','Define asset inventory risks','Practice 10 QAE questions','Make a visual map'], homework:['Create asset management cards','Review one operational incident example'] },
  { domain:'D4', title:'Incident vs problem vs change', focus:'Incident restores service; problem fixes root cause; change controls risk.', tasks:['Draw the incident/problem/change triangle','Practice 12 QAE questions','Write one scenario','Teach it out loud'], homework:['Make 5 ITSM cards','Review change control traps'] },
  { domain:'D4', title:'Change, release, patch, and configuration management', focus:'Unauthorized or uncontrolled change is a major operational risk.', tasks:['Map normal/emergency change','List patch controls','Practice 12 QAE questions','Log one change trap'], homework:['Add CMDB/change notes','Build 5 cards'] },
  { domain:'D4', title:'Backup, restoration, and job scheduling', focus:'Backups matter only if restoration is tested and aligned to RPO/RTO.', tasks:['Draw backup types','Explain restore testing','Practice 10 QAE questions','Make 3 cards'], homework:['Create restore-test checklist','Review RPO/RTO terms'] },
  { domain:'D4', title:'BIA, RTO, RPO, MTD/MAO', focus:'BIA drives recovery priorities and recovery requirements.', tasks:['Build BIA/RTO/RPO timeline','Practice 12 QAE questions','Explain RTO vs RPO','Log one timeline trap'], homework:['Make a disaster recovery visual','Create 6 BCP/DR cards'] },
  { domain:'D4', title:'BCP, DRP, crisis management, and testing', focus:'Plans must be maintained, tested, and tied to business priorities.', tasks:['Compare tabletop/walkthrough/full test','Draw BCP vs DRP','Practice 12 QAE questions','Record 2-minute summary'], homework:['Review one business resilience scenario','Add one mistake/flashcard'] },
  { domain:'D5', title:'Security governance and asset protection basics', focus:'Security starts with governance, classification, policies, and risk.', tasks:['Draw security governance model','Define classification','Practice 10 QAE questions','Make 3 cards'], homework:['Create security governance cards','Review owner/custodian roles'] },
  { domain:'D5', title:'Identity and access management', focus:'Least privilege, owner approval, periodic reviews, and timely removal are key.', tasks:['Map user access lifecycle','Practice 12 QAE questions','Explain privileged access risk','Log access traps'], homework:['Create IAM lifecycle flashcards','Review termination control scenario'] },
  { domain:'D5', title:'Network, endpoint, and infrastructure security', focus:'Layered controls reduce exposure and support monitoring.', tasks:['Sketch defense-in-depth','Compare preventive/detective controls','Practice 10 QAE questions','Make visual map'], homework:['Create control type cards','Review network monitoring notes'] },
  { domain:'D5', title:'Encryption, PKI, and data protection', focus:'Know what encryption protects and what key management risks remain.', tasks:['Draw symmetric vs asymmetric','Explain PKI high level','Practice 10 QAE questions','Make 3 cards'], homework:['Create encryption/PKI cards','Review key management risks'] },
  { domain:'D5', title:'Cloud, mobile, wireless, and emerging tech risks', focus:'Audit responsibilities remain even when technology shifts to vendors/cloud.', tasks:['Map shared responsibility','List cloud audit evidence','Practice 10 QAE questions','Teach-back cloud risk'], homework:['Review cloud responsibility cards','Add 2 examples to notebook'] },
  { domain:'D5', title:'Security monitoring, incident response, and forensics', focus:'Response requires detection, containment, evidence handling, and lessons learned.', tasks:['Draw incident response lifecycle','Practice 12 QAE questions','Explain chain of custody','Log one incident trap'], homework:['Create IR/forensics flashcards','Review one old miss'] },
  { domain:'MIX', title:'Mixed CISA judgment drill', focus:'Switch domains quickly and defend why each answer is best.', tasks:['Do 20 mixed QAE questions','Review every missed explanation','Update Mistake Forge','Record 3 CISA rules'], homework:['Build a weak-area list','Review old flashcards'] },
  { domain:'MIX', title:'Mock block and remediation', focus:'Timed practice plus careful review matters more than raw speed.', tasks:['Complete one timed block','Sort misses by domain','Create catch-up quests','Review old flashcards'], homework:['Build final cheat sheet','Schedule next mock block'] }
];

export const DAILY_CHALLENGE_BANK = [
  { key:'qae_sprint', title:'QAE Sprint', xp:60, coins:18, type:'qae', description:'Answer a focused set of QAE questions and log the score.', target:10, evidenceLabel:'How many questions did you answer?' },
  { key:'teach_back', title:'Teach-Back Audio', xp:45, coins:12, type:'evidence', description:'Explain one concept out loud in two minutes like you are teaching a new staff.', evidenceLabel:'What concept did you teach back?' },
  { key:'mistake_forge', title:'Mistake Forge', xp:50, coins:15, type:'mistake', description:'Convert one wrong or guessed answer into a reusable lesson.', evidenceLabel:'What trap did you catch?' },
  { key:'visual_map', title:'Visual Map', xp:55, coins:15, type:'evidence', description:'Draw a visual map of today’s concept: process, timeline, ownership ladder, or control flow.', evidenceLabel:'What did your map cover?' },
  { key:'flashcard_four', title:'Four-Card Forge', xp:40, coins:10, type:'flashcards', description:'Create or review four flashcards from today’s topic.', target:4, evidenceLabel:'Which cards/deck did you work on?' },
  { key:'buddy_ping', title:'Buddy Accountability Ping', xp:25, coins:8, type:'evidence', description:'Post one useful insight, reminder, or encouragement to your guild.', evidenceLabel:'What did you share?' },
  { key:'arcade_round', title:'Arcade Round', xp:35, coins:10, type:'arcade', description:'Play one mini-game round to reinforce CISA vocabulary and answer logic.', target:1, evidenceLabel:'Which game did you play?' },
  { key:'review_old', title:'Old Miss Review', xp:45, coins:12, type:'mistake', description:'Review one past mistake and mark whether it finally makes sense.', evidenceLabel:'Which old miss did you review?' },
  { key:'notebook_entry', title:'Notebook Build', xp:30, coins:8, type:'notes', description:'Add a useful note to your notebook from today’s topic.', evidenceLabel:'What did you write about?' },
  { key:'homework_check', title:'Homework Keeper', xp:45, coins:12, type:'homework', description:'Complete and verify one homework item from a prior session.', evidenceLabel:'What homework did you finish?' }
];

export const BONUS_QUESTS = [
  { key:'weekend_warrior', title:'Weekend Warrior', xp:90, coins:30, chest:'silver', description:'Complete a weekend study session and log it to the roadmap.' },
  { key:'perfect_session', title:'Perfect Live Session', xp:120, coins:45, chest:'gold', description:'Complete every live session checklist item in one study room.' },
  { key:'domain_boss', title:'Domain Boss Battle', xp:160, coins:60, chest:'gold', description:'Score 80%+ on a 25-question domain block.' },
  { key:'mistake_master', title:'Mistake Master', xp:100, coins:35, chest:'silver', description:'Review and close five old mistake entries.' }
];

export const STARTER_DECKS = [
  { id:'deck-d1-audit-mindset', scope:'public', title:'D1 Audit Mindset Essentials', domain:'D1', cards:[
    ['What is the auditor’s role?','Evaluate controls and provide assurance; management owns remediation and operations.'],
    ['What does “FIRST” usually test?','Sequence. Identify what must happen before action, such as understanding impact or validating facts.'],
    ['What does “BEST” usually test?','The most complete, risk-based answer that improves assurance or control effectiveness.'],
    ['What makes audit evidence strong?','Evidence should be sufficient, reliable, relevant, and useful.'],
    ['Who owns corrective action?','Management/process owner, not the auditor.'],
    ['What drives audit planning?','Risk to business objectives and assurance priorities.']
  ]},
  { id:'deck-d2-governance', scope:'public', title:'D2 Governance + Ownership', domain:'D2', cards:[
    ['Who is responsible for IT governance?','Board and senior management are accountable for governance and direction.'],
    ['Who classifies data?','The data owner or business owner.'],
    ['Policy vs standard','Policy states intent; standard defines mandatory requirements.'],
    ['KRI','Key risk indicator used to monitor risk exposure.'],
    ['Risk appetite','The level of risk an organization is willing to accept.'],
    ['Third-party risk key control','Contracts, SLAs, right-to-audit, monitoring, and exit planning.']
  ]},
  { id:'deck-d3-sdlc', scope:'public', title:'D3 SDLC + Implementation', domain:'D3', cards:[
    ['UAT owner','Business users validate that the system meets business requirements.'],
    ['Data conversion risk','Incomplete or inaccurate migration of data into the new system.'],
    ['Post-implementation review','Determines whether objectives, benefits, and controls are working after go-live.'],
    ['Agile audit focus','Governance, traceability, approvals, security, and control integration.'],
    ['Business case','Justifies the project and expected business benefits.'],
    ['Change control in SDLC','Prevents unauthorized or untested changes from entering production.']
  ]},
  { id:'deck-d4-resilience', scope:'public', title:'D4 Operations + Resilience', domain:'D4', cards:[
    ['Incident management','Restores service as quickly as possible.'],
    ['Problem management','Identifies and resolves root cause.'],
    ['Change management','Controls risk from modifications to systems.'],
    ['RTO','Target time to restore a process or system after disruption.'],
    ['RPO','Acceptable data loss measured in time.'],
    ['BIA','Identifies critical processes and disruption impact; drives recovery priorities.']
  ]},
  { id:'deck-d5-security', scope:'public', title:'D5 Asset Protection', domain:'D5', cards:[
    ['Least privilege','Users get only the access necessary to perform their job.'],
    ['Privileged access risk','High impact if misused; requires approval, monitoring, and review.'],
    ['Preventive control','Stops an issue before it occurs.'],
    ['Detective control','Identifies an issue after it occurs.'],
    ['Encryption risk','Weak key management can undermine encryption effectiveness.'],
    ['Chain of custody','Documentation showing evidence control, handling, and integrity.']
  ]}
];

// Original practice prompts written for study reinforcement. Do not treat these as copied ISACA QAE items.
export const GAME_QUESTIONS = [
  { mode:'bestFirst', domain:'D1', prompt:'An auditor sees a control weakness during fieldwork. What should happen before recommending a fix?', options:['Implement a new control','Validate evidence, cause, and impact','Tell IT to stop the process','Update the audit charter'], answer:1, explain:'The auditor should understand and support the finding before recommending corrective action.' },
  { mode:'bestFirst', domain:'D2', prompt:'Who should approve access to sensitive business data?', options:['The help desk','The data owner','The external auditor','Any system administrator'], answer:1, explain:'The data/business owner understands business need and owns access approval.' },
  { mode:'bestFirst', domain:'D4', prompt:'Which activity proves backups can actually support recovery?', options:['Backup job completed log','Successful restoration test','Storage capacity report','Backup vendor invoice'], answer:1, explain:'A backup is only meaningful if restoration works and meets recovery needs.' },
  { mode:'bestFirst', domain:'D4', prompt:'A recurring system outage keeps happening. Which process targets root cause?', options:['Incident management','Problem management','Capacity billing','User provisioning'], answer:1, explain:'Incident management restores service; problem management addresses root cause.' },
  { mode:'bestFirst', domain:'D5', prompt:'What is the strongest control for excessive user access?', options:['Generic awareness email','Owner-approved least privilege and periodic review','Longer passwords only','Weekly screenshots'], answer:1, explain:'Access should be authorized by owners, limited to need, and reviewed.' },
  { mode:'termMatch', term:'RTO', answer:'Maximum target time to restore service after disruption' },
  { mode:'termMatch', term:'RPO', answer:'Acceptable amount of data loss measured in time' },
  { mode:'termMatch', term:'BIA', answer:'Analysis that identifies critical processes and disruption impact' },
  { mode:'termMatch', term:'Substantive testing', answer:'Testing evidence to detect whether an error or issue exists' },
  { mode:'termMatch', term:'Compliance testing', answer:'Testing whether controls operate as required' },
  { mode:'sort', item:'Access approval by data owner', bucket:'Preventive' },
  { mode:'sort', item:'Log review', bucket:'Detective' },
  { mode:'sort', item:'Backup restoration test', bucket:'Corrective/Recovery' },
  { mode:'sort', item:'Segregation of duties', bucket:'Preventive' },
  { mode:'sort', item:'Incident postmortem', bucket:'Corrective/Recovery' }
];

export const AVATAR_ITEMS = {
  baseColor:[
    { id:'#7c4dff', label:'Quest Violet', unlock:'Start', cost:0 },
    { id:'#00a7ff', label:'Sky Audit Blue', unlock:'Start', cost:0 },
    { id:'#18c29c', label:'Control Green', unlock:'Level 2', cost:80 },
    { id:'#ff9f1c', label:'Gold Evidence', unlock:'Level 3', cost:120 },
    { id:'#ff5c8a', label:'Risk Rose', unlock:'Level 4', cost:140 },
    { id:'#0f172a', label:'Night Review', unlock:'7-day streak', cost:200 }
  ],
  cape:[
    { id:'none', label:'No Cape', unlock:'Start', cost:0 },
    { id:'blue-cape', label:'Audit Cape', unlock:'Level 2', cost:120 },
    { id:'gold-cape', label:'Gold Reviewer Cape', unlock:'Level 5', cost:300 },
    { id:'night-cape', label:'Night Study Cape', unlock:'3-day streak', cost:180 }
  ],
  glasses:[
    { id:'round', label:'Round Reviewer Glasses', unlock:'Start', cost:0 },
    { id:'visor', label:'Data Visor', unlock:'5 QAE logs', cost:160 },
    { id:'stars', label:'Star Focus', unlock:'Level 5', cost:250 }
  ],
  accessory:[
    { id:'clipboard', label:'Audit Clipboard', unlock:'Start', cost:0 },
    { id:'coffee', label:'7 AM Coffee', unlock:'3-day streak', cost:120 },
    { id:'shield', label:'Control Shield', unlock:'10 mistakes logged', cost:220 },
    { id:'crown', label:'Domain Crown', unlock:'Perfect week', cost:400 }
  ],
  mood:[
    { id:'focused', label:'Focused', unlock:'Start', cost:0 },
    { id:'happy', label:'Happy', unlock:'Start', cost:0 },
    { id:'locked-in', label:'Locked In', unlock:'Level 3', cost:120 }
  ]
};

export const SHOP_ITEMS = [
  { id:'freeze', title:'Streak Freeze', type:'streakFreeze', cost:120, description:'Automatically protects one eligible missed weekday.' },
  { id:'xp-boost-small', title:'30-Min XP Boost', type:'xpBoost', cost:180, multiplier:1.25, minutes:30, description:'Earn 25% extra XP for the next 30 minutes.' },
  { id:'silver-chest', title:'Silver Chest', type:'chest', cost:160, chest:'silver', description:'Open for a random coin/XP reward and chance at a cosmetic.' },
  { id:'gold-chest', title:'Gold Chest', type:'chest', cost:350, chest:'gold', description:'Bigger random reward and higher cosmetic chance.' }
];

export const BADGES = [
  { id:'first_login', title:'First Login', description:'Started your ControlQuest profile.' },
  { id:'first_session', title:'First Session', description:'Completed one live study session.' },
  { id:'three_day_streak', title:'3-Day Flame', description:'Built a three-day streak.' },
  { id:'seven_day_streak', title:'7-Day Lock-In', description:'Built a seven-day streak.' },
  { id:'qae_100', title:'100 QAE Club', description:'Logged 100 QAE questions.' },
  { id:'mistake_10', title:'Mistake Miner', description:'Logged 10 mistakes.' },
  { id:'domain_1_done', title:'Domain 1 Foundation', description:'Completed Domain 1 roadmap work.' },
  { id:'shopper', title:'Quest Shopper', description:'Bought an item from the shop.' },
  { id:'notetaker', title:'Notebook Builder', description:'Created 10 notes.' },
  { id:'arcade_5', title:'Arcade Ace', description:'Won five arcade rounds.' }
];

export const ICONS = {
  quest:'<svg viewBox="0 0 64 64"><path d="M12 34c13-2 18-9 20-22 2 13 7 20 20 22-13 2-18 9-20 22-2-13-7-20-20-22Z" fill="currentColor"/></svg>',
  chest:'<svg viewBox="0 0 64 64"><rect x="10" y="24" width="44" height="28" rx="6" fill="currentColor" opacity=".82"/><path d="M14 24c1-9 8-14 18-14s17 5 18 14" fill="none" stroke="currentColor" stroke-width="6"/><rect x="27" y="30" width="10" height="12" rx="2" fill="#fff" opacity=".9"/></svg>',
  flame:'<svg viewBox="0 0 64 64"><path d="M34 58c12-3 19-12 19-24 0-13-9-21-15-28 1 13-6 15-12 24-1-6-4-10-8-13 0 7-7 13-7 23 0 11 10 19 23 18Z" fill="currentColor"/></svg>',
  owl:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="25" fill="currentColor" opacity=".88"/><circle cx="23" cy="28" r="9" fill="#fff"/><circle cx="41" cy="28" r="9" fill="#fff"/><circle cx="23" cy="29" r="4" fill="#111"/><circle cx="41" cy="29" r="4" fill="#111"/><path d="M28 38h8l-4 7-4-7Z" fill="#ffd166"/></svg>'
};
