export const DOMAINS = [
  { id:'D1', name:'Information Systems Auditing Process', short:'Audit Process', weight:18, color:'#7c4dff' },
  { id:'D2', name:'Governance and Management of IT', short:'Governance', weight:18, color:'#00a7ff' },
  { id:'D3', name:'Information Systems Acquisition, Development and Implementation', short:'Acquisition + SDLC', weight:12, color:'#ff9f1c' },
  { id:'D4', name:'Information Systems Operations and Business Resilience', short:'Operations + Resilience', weight:26, color:'#18c29c' },
  { id:'D5', name:'Protection of Information Assets', short:'Asset Protection', weight:26, color:'#ff5c8a' }
];

export const TOPICS = [
  { domain:'D1', title:'CISA mindset: auditor evaluates, management owns', focus:'Learn the exam language: first, best, primary, greatest risk.', tasks:['Define the auditor role','List 5 CISA answer-choice rules','Answer 8 QAE questions','Write 2 flashcards'] },
  { domain:'D1', title:'Audit charter, standards, and independence', focus:'Understand authority, scope, ethics, and independence threats.', tasks:['Sketch the audit function structure','Explain independence in your own words','Do a 5-question independence drill','Log one common trap'] },
  { domain:'D1', title:'Risk-based audit planning', focus:'Prioritize audit work based on business risk.', tasks:['Draw audit universe → risk ranking → audit plan','Identify 3 risk factors','Do 10 QAE questions','Teach back risk-based planning'] },
  { domain:'D1', title:'Audit project execution and evidence', focus:'Evidence must be sufficient, reliable, relevant, and useful.', tasks:['Compare inquiry, observation, inspection, reperformance','Make an evidence hierarchy','Do 10 QAE questions','Add missed concepts to Mistake Forge'] },
  { domain:'D1', title:'Sampling, testing, and data analytics', focus:'Know when sampling supports assurance and what analytics can/cannot prove.', tasks:['Define compliance vs substantive testing','Work 8 sampling questions','Build one example analytics test','Make 3 cards'] },
  { domain:'D1', title:'Reporting, findings, and follow-up', focus:'A finding needs criteria, condition, cause, effect, and recommendation.', tasks:['Draft a sample audit finding','Explain follow-up responsibilities','Do 10 QAE questions','Record a 2-minute voice note'] },
  { domain:'D2', title:'IT governance structure and accountability', focus:'Board/senior management set direction; IT executes; auditors assure.', tasks:['Draw the ownership ladder','Map board vs steering committee vs IT management','Do 10 QAE questions','Log ownership traps'] },
  { domain:'D2', title:'IT strategy, policies, standards, and procedures', focus:'Strategy aligns IT to business; policies state intent; standards define rules.', tasks:['Create policy/standard/procedure examples','Explain alignment in plain English','Do 8 QAE questions','Make 3 flashcards'] },
  { domain:'D2', title:'Risk management and control frameworks', focus:'Risk appetite, ownership, KRIs, and control monitoring drive governance.', tasks:['Draw risk lifecycle','Define inherent/residual risk','Do 10 QAE questions','Teach-back risk ownership'] },
  { domain:'D2', title:'Data governance and privacy', focus:'Data owners classify; custodians protect; privacy requires lawful, limited handling.', tasks:['Map data owner vs custodian','Define classification and retention','Do 10 QAE questions','Log one privacy trap'] },
  { domain:'D2', title:'Third-party/vendor management', focus:'Contracts, SLAs, SOC reports, monitoring, and exit strategies matter.', tasks:['Sketch vendor lifecycle','List key contract clauses','Do 8 QAE questions','Write a vendor risk checklist'] },
  { domain:'D3', title:'Project governance and business case', focus:'Projects need sponsorship, feasibility, scope, controls, and benefits tracking.', tasks:['Draw project governance roles','Review business case logic','Do 8 QAE questions','Create 2 cards'] },
  { domain:'D3', title:'SDLC, Agile, and control design', focus:'Controls should be built in early, not bolted on later.', tasks:['Compare waterfall vs agile audit concerns','Draw SDLC phases','Do 10 QAE questions','Teach-back control design'] },
  { domain:'D3', title:'Testing, UAT, data conversion, and migration', focus:'Business users approve UAT; data conversion needs reconciliation and completeness.', tasks:['Map testing levels','List migration risks','Do 10 QAE questions','Log implementation traps'] },
  { domain:'D3', title:'Post-implementation review and benefits realization', focus:'After go-live, assess whether business objectives and controls are working.', tasks:['Draft PIR questions','Explain benefits realization','Do 8 QAE questions','Make 3 flashcards'] },
  { domain:'D4', title:'IT operations overview and asset management', focus:'Operations controls keep services reliable, available, and recoverable.', tasks:['Draw operational control stack','Define asset inventory risks','Do 10 QAE questions','Make a quick visual map'] },
  { domain:'D4', title:'IT service management: incident vs problem vs change', focus:'Incident restores; problem fixes root cause; change controls risk.', tasks:['Create the incident/problem/change triangle','Do 12 QAE questions','Write one scenario','Teach it out loud'] },
  { domain:'D4', title:'Change, release, patch, and configuration management', focus:'Unauthorized/uncontrolled change is one of the highest-risk operational issues.', tasks:['Map normal/emergency change','List patch controls','Do 12 QAE questions','Log one change trap'] },
  { domain:'D4', title:'Backup, restoration, and job scheduling', focus:'Backups matter only if restoration is tested and aligned to RPO/RTO.', tasks:['Draw backup types','Explain restore testing','Do 10 QAE questions','Make 3 cards'] },
  { domain:'D4', title:'Business impact analysis, RTO, RPO, MTD', focus:'BIA drives recovery priorities and recovery requirements.', tasks:['Build a BIA/RTO/RPO timeline','Do 12 QAE questions','Explain RTO vs RPO','Log one formula/timeline trap'] },
  { domain:'D4', title:'BCP, DRP, crisis management, and testing', focus:'Plans must be maintained, tested, and tied to business priorities.', tasks:['Compare tabletop/walkthrough/full test','Draw BCP vs DRP','Do 12 QAE questions','Record a 2-minute summary'] },
  { domain:'D5', title:'Security governance and asset protection basics', focus:'Security starts with governance, classification, policies, and risk.', tasks:['Draw security governance model','Define data classification','Do 10 QAE questions','Make 3 cards'] },
  { domain:'D5', title:'Identity and access management', focus:'Least privilege, owner approval, periodic reviews, and timely removal are key.', tasks:['Map user access lifecycle','Do 12 QAE questions','Explain privileged access risk','Log access traps'] },
  { domain:'D5', title:'Network, endpoint, and infrastructure security', focus:'Layered controls reduce exposure and support monitoring.', tasks:['Sketch defense-in-depth','Compare preventive/detective controls','Do 10 QAE questions','Make a visual map'] },
  { domain:'D5', title:'Encryption, PKI, and data protection', focus:'Know what encryption protects and what key management risks remain.', tasks:['Draw symmetric vs asymmetric','Explain PKI at a high level','Do 10 QAE questions','Make 3 cards'] },
  { domain:'D5', title:'Cloud, mobile, wireless, and emerging tech risks', focus:'Audit responsibilities remain even when technology shifts to vendors/cloud.', tasks:['Map shared responsibility','List cloud audit evidence','Do 10 QAE questions','Teach-back cloud risk'] },
  { domain:'D5', title:'Security monitoring, incident response, and forensics', focus:'Response requires detection, containment, evidence handling, and lessons learned.', tasks:['Draw incident response lifecycle','Do 12 QAE questions','Explain chain of custody','Log one incident trap'] },
  { domain:'MIX', title:'Mixed CISA judgment drill', focus:'Switch domains quickly and defend why each answer is best.', tasks:['Do 20 mixed QAE questions','Review every missed explanation','Update Mistake Forge','Record 3 CISA rules'] },
  { domain:'MIX', title:'Mock block and remediation', focus:'Timed practice plus careful review matters more than raw speed.', tasks:['Complete one timed block','Sort misses by domain','Create catch-up quests','Review old flashcards'] }
];

export const DAILY_CHALLENGE_BANK = [
  { key:'qae_sprint', title:'QAE Sprint', xp:60, type:'qae', description:'Answer a focused set of QAE questions and log the result.', target:10 },
  { key:'teach_back', title:'Teach-Back Audio', xp:45, type:'evidence', description:'Explain one concept out loud in two minutes like you are teaching a new staff.', placeholder:'What concept did you teach back?' },
  { key:'mistake_forge', title:'Mistake Forge', xp:50, type:'mistake', description:'Convert one wrong/guessed answer into a reusable lesson.', placeholder:'What trap did you catch?' },
  { key:'visual_map', title:'Visual Map', xp:55, type:'evidence', description:'Draw a visual map of today’s concept: process, timeline, ownership ladder, or control flow.', placeholder:'What did your map cover?' },
  { key:'flashcard_four', title:'Four-Card Forge', xp:40, type:'flashcards', description:'Create or review four flashcards from today’s topic.', target:4 },
  { key:'buddy_ping', title:'Buddy Accountability Ping', xp:25, type:'evidence', description:'Post one useful insight, reminder, or encouragement to the study group.', placeholder:'What did you share with the group?' },
  { key:'arcade_round', title:'Arcade Round', xp:35, type:'arcade', description:'Play one mini-game round to reinforce CISA vocabulary and answer logic.', target:1 },
  { key:'review_old', title:'Old Miss Review', xp:45, type:'mistake', description:'Review one past mistake and mark whether it finally makes sense.', placeholder:'Which old miss did you review?' }
];

export const GAME_QUESTIONS = [
  { mode:'bestFirst', prompt:'An auditor discovers a control is not operating as documented. What should the auditor do FIRST?', choices:['Immediately recommend a new control','Determine the cause and impact with evidence','Notify regulators','Rewrite the procedure'], answer:1, why:'CISA questions often reward understanding and validating cause/impact before recommending remediation.' },
  { mode:'bestFirst', prompt:'Who is primarily responsible for approving user access to sensitive business data?', choices:['Internal auditor','Help desk','Data owner or business owner','External regulator'], answer:2, why:'The data/business owner understands business need and risk; IT often administers access.' },
  { mode:'bestFirst', prompt:'What is the PRIMARY purpose of a BIA?', choices:['Select backup software','Determine business impact and recovery priorities','Approve firewall rules','List all servers'], answer:1, why:'BIA identifies critical processes, impacts, and recovery requirements such as RTO/RPO.' },
  { mode:'bestFirst', prompt:'A change was implemented without approval. What is the greatest concern?', choices:['The change ticket is missing a screenshot','The change may introduce business or control risk','The developer worked overtime','The report format changed'], answer:1, why:'Unauthorized change matters because it can affect integrity, availability, confidentiality, and business operations.' },
  { mode:'bestFirst', prompt:'Which evidence is usually strongest?', choices:['Management says the control works','A policy document exists','Auditor reperforms the control and confirms results','A user remembers doing it'], answer:2, why:'Direct auditor evidence through reperformance is generally stronger than inquiry alone.' },
  { mode:'termMatch', term:'RTO', definition:'Target time to restore a process/system after disruption.' },
  { mode:'termMatch', term:'RPO', definition:'Acceptable amount of data loss measured in time.' },
  { mode:'termMatch', term:'MTD/MAO', definition:'Maximum tolerable downtime/outage before unacceptable impact.' },
  { mode:'termMatch', term:'Preventive Control', definition:'Designed to stop an issue before it happens.' },
  { mode:'termMatch', term:'Detective Control', definition:'Designed to identify an issue after it happens.' },
  { mode:'sort', item:'Firewall rule review', bucket:'Detective/Monitoring' },
  { mode:'sort', item:'MFA for privileged accounts', bucket:'Preventive' },
  { mode:'sort', item:'Backup restoration test', bucket:'Recovery/Resilience' },
  { mode:'sort', item:'Change approval before deployment', bucket:'Preventive' },
  { mode:'sort', item:'Incident postmortem', bucket:'Corrective' }
];

export const BADGES = [
  { id:'first_login', name:'First Flight', description:'Created your profile and entered the quest.', icon:'badge-rocket' },
  { id:'first_session', name:'Morning Lock-In', description:'Completed your first study session.', icon:'badge-sun' },
  { id:'three_day_streak', name:'Streak Spark', description:'Reached a 3-day streak.', icon:'badge-flame' },
  { id:'seven_day_streak', name:'Week Warrior', description:'Reached a 7-day streak.', icon:'badge-shield' },
  { id:'qae_100', name:'QAE Centurion', description:'Logged 100 QAE questions.', icon:'badge-target' },
  { id:'mistake_10', name:'Mistake Alchemist', description:'Logged 10 mistake lessons.', icon:'badge-forge' },
  { id:'domain_1_done', name:'Audit Apprentice', description:'Completed a Domain 1 roadmap day.', icon:'badge-scroll' },
  { id:'perfect_week', name:'Perfect Week', description:'Completed all planned weekday quests in one week.', icon:'badge-star' }
];

export const AVATAR_ITEMS = {
  baseColors: ['#7c4dff','#00a7ff','#18c29c','#ff9f1c','#ff5c8a','#3f5efb','#9b5de5','#00bbf9'],
  capes: [
    { id:'none', name:'No cape', unlock:'Start' },
    { id:'audit-cape', name:'Audit Cape', unlock:'Level 2' },
    { id:'night-cape', name:'Night Owl Cape', unlock:'7-day streak' },
    { id:'gold-cape', name:'Gold Assurance Cape', unlock:'Level 5' }
  ],
  glasses: [
    { id:'round', name:'Round Glasses', unlock:'Start' },
    { id:'visor', name:'Control Visor', unlock:'Complete 5 QAE logs' },
    { id:'stars', name:'Star Specs', unlock:'Perfect week' }
  ],
  accessories: [
    { id:'clipboard', name:'Evidence Clipboard', unlock:'Start' },
    { id:'coffee', name:'7 AM Coffee', unlock:'3-day streak' },
    { id:'shield', name:'Risk Shield', unlock:'Log 10 mistakes' },
    { id:'crown', name:'CISA Crown', unlock:'Level 8' }
  ]
};

export const DEFAULT_SESSION_FLOW = [
  { id:'warmup', label:'Warm-up recall', minutes:5, prompt:'Each person says yesterday’s topic, one rule remembered, and one thing still fuzzy.' },
  { id:'learn', label:'Watch/listen', minutes:15, prompt:'Watch or listen to the selected topic. Pause for CISA traps and ownership rules.' },
  { id:'map', label:'Draw the concept', minutes:15, prompt:'Build a visual: process map, timeline, ownership ladder, or control stack.' },
  { id:'qae', label:'QAE drill', minutes:15, prompt:'Answer QAE questions. Explain why the right answer is best and why the others lose.' },
  { id:'forge', label:'Mistake Forge + cards', minutes:8, prompt:'Log misses/guesses and create flashcards or a teach-back note.' },
  { id:'closeout', label:'Closeout', minutes:2, prompt:'Pick after-session homework and tomorrow’s starting point.' }
];
