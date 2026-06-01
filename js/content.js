export const domainPlan = [
  { id:'Domain 1', short:'Audit Process', weight:18, color:'#73E0FF', topics:[
    'Audit mindset and independence','Audit charter and standards','Risk-based audit planning','Audit universe and audit programs','Evidence types and sufficiency','Sampling and testing methods','Interviews, observation, reperformance','Data analytics in audits','Finding structure and reporting','Follow-up and remediation validation'
  ]},
  { id:'Domain 2', short:'Governance', weight:18, color:'#9D7CFF', topics:[
    'IT governance structure','Board and senior management responsibilities','IT strategy alignment','Policies standards procedures','Risk appetite and risk ownership','IT resource management','Vendor and third-party risk','Data governance and classification','KPIs KRIs and performance monitoring','Privacy and regulatory governance'
  ]},
  { id:'Domain 3', short:'Acquisition & Development', weight:12, color:'#FFE66D', topics:[
    'Business case and feasibility','Project governance','SDLC overview','Agile vs waterfall audit concerns','Requirements and control design','Testing strategy and UAT','Release and configuration management','Data migration and conversion','Implementation readiness','Post-implementation review'
  ]},
  { id:'Domain 4', short:'Operations & Resilience', weight:26, color:'#62F0A4', topics:[
    'IT operations overview','Asset and inventory management','Job scheduling and batch processing','Interfaces and end-user computing','Service level management','Incident management','Problem management','Change and patch management','Logging and monitoring','Capacity and availability','Backup strategy','BIA fundamentals','RTO RPO MTD relationships','DRP and BCP design','Alternate sites and restoration testing','Resilience scenario practice'
  ]},
  { id:'Domain 5', short:'Protection of Assets', weight:26, color:'#FF7C9B', topics:[
    'Security governance foundations','Physical and environmental controls','Identity and access management','Privileged access','Access reviews and termination','Network security','Endpoint security','Encryption and key management','PKI and certificates','Cloud and virtualization security','Mobile wireless and IoT','Vulnerability management','Penetration testing vs scanning','Security monitoring','Incident response and forensics','Awareness and human risk'
  ]}
];

export const dailyQuestTemplates = [
  { title:'Morning Lock-In', detail:'Check in before 7:05 AM and finish the session checklist.', xp:100, type:'session' },
  { title:'QAE Sprint', detail:'Complete at least your daily QAE goal and log the lesson learned.', xp:80, type:'qae' },
  { title:'Mistake Forge', detail:'Turn one missed concept into an error log entry and flashcard.', xp:55, type:'error' },
  { title:'Teach-Back Clip', detail:'Record or explain a two-minute summary out loud.', xp:40, type:'audio' },
  { title:'Visual Map', detail:'Draw one concept map, table, process flow, or memory diagram.', xp:45, type:'visual' },
  { title:'Weekend Bonus', detail:'Do a Saturday or Sunday booster session for extra XP and badge progress.', xp:120, type:'weekend' }
];

export const quizBank = {
  blitz: [
    { q:'An auditor discovers a potential control weakness. What should happen before recommending a fix?', choices:['Recommend the most common industry control','Determine cause, impact, and evidence','Escalate immediately to the board','Ask IT to change the process'], answer:1, why:'CISA logic favors understanding root cause, impact, and evidence before recommending corrective action.' },
    { q:'For a FIRST question about a new audit area, what is usually the best first move?', choices:['Perform detailed testing','Understand the business process and risk','Write the audit report','Select a remediation owner'], answer:1, why:'Sequence matters. The auditor should understand process and risk before testing.' },
    { q:'Who owns the decision to approve user access to sensitive data?', choices:['External auditor','Help desk analyst','Data or business owner','Database administrator'], answer:2, why:'Business/data owners understand need-to-know and should approve access.' },
    { q:'What normally drives recovery priorities in a disaster recovery plan?', choices:['The newest application','The business impact analysis','The backup vendor contract','The size of the server'], answer:1, why:'The BIA identifies criticality and recovery requirements like RTO/RPO.' },
    { q:'Which answer is most aligned with audit independence?', choices:['Auditor configures the control then tests it','Auditor evaluates evidence objectively','Auditor owns remediation','Auditor approves production access'], answer:1, why:'Auditors provide assurance and should not own management responsibilities.' }
  ],
  terms: [
    { term:'RTO', prompt:'Target time to restore a process or system after disruption.', options:['RPO','RTO','MTD','BIA'], answer:'RTO' },
    { term:'RPO', prompt:'Acceptable amount of data loss measured in time.', options:['RTO','RPO','SLA','KRI'], answer:'RPO' },
    { term:'BIA', prompt:'Analysis that identifies critical business processes and disruption impact.', options:['BIA','BCP','DRP','SDLC'], answer:'BIA' },
    { term:'Preventive control', prompt:'A control designed to stop an issue before it occurs.', options:['Detective control','Corrective control','Preventive control','Compensating control'], answer:'Preventive control' },
    { term:'KRI', prompt:'Metric used to signal increasing risk exposure.', options:['KPI','KRI','SLA','UAT'], answer:'KRI' }
  ],
  controls: [
    { q:'Automated password complexity requirement', answer:'Preventive', why:'It helps prevent weak passwords from being created.' },
    { q:'Daily review of failed login reports', answer:'Detective', why:'It detects suspicious activity after attempts occur.' },
    { q:'Restore from backup after ransomware event', answer:'Corrective', why:'It helps recover after an issue has happened.' },
    { q:'Segregation of duties in change approval', answer:'Preventive', why:'It prevents unauthorized or inappropriate changes.' },
    { q:'Post-incident root cause remediation', answer:'Corrective', why:'It fixes the cause after detection.' }
  ]
};

export const badgeCatalog = [
  { id:'first-login', name:'First Flight', detail:'Open ControlQuest for the first time.', icon:'assets/badges/first-flight.svg' },
  { id:'three-streak', name:'Three-Day Takeoff', detail:'Build a 3-day streak.', icon:'assets/badges/streak.svg' },
  { id:'perfect-week', name:'Perfect Week', detail:'Complete all five weekday sessions in one active study week.', icon:'assets/badges/perfect-week.svg' },
  { id:'qae-100', name:'QAE Grinder', detail:'Log 100 QAE questions.', icon:'assets/badges/qae.svg' },
  { id:'error-25', name:'Mistake Blacksmith', detail:'Log and review 25 mistakes.', icon:'assets/badges/forge.svg' },
  { id:'weekend-warrior', name:'Weekend Warrior', detail:'Complete a weekend bonus session.', icon:'assets/badges/weekend.svg' },
  { id:'domain-master', name:'Domain Master', detail:'Complete every planned topic in a domain.', icon:'assets/badges/domain.svg' }
];

export const avatarItems = [
  { id:'none', name:'Classic Ollie', cost:0, unlock:'Unlocked from day one.', accessory:'none' },
  { id:'glasses', name:'Audit Glasses', cost:120, unlock:'Unlocked with 120 XP.', accessory:'glasses' },
  { id:'cape', name:'Control Cape', cost:250, unlock:'Unlocked with 250 XP.', accessory:'cape' },
  { id:'headphones', name:'Focus Headphones', cost:350, unlock:'Unlocked with 350 XP.', accessory:'headphones' },
  { id:'crown', name:'Streak Crown', cost:500, unlock:'Unlocked with 500 XP or a 5-day streak.', accessory:'crown' },
  { id:'shield', name:'Risk Shield', cost:700, unlock:'Unlocked with 700 XP.', accessory:'shield' }
];

export const resources = [
  { title:'Primary learning loop', detail:'Watch/listen, draw the concept, answer QAE, explain the answer, log misses, create flashcards.' },
  { title:'Official material priority', detail:'Use ISACA exam outline, ISACA review course or manual for structure, and QAE for question practice and exam logic.' },
  { title:'Remote-first study rhythm', detail:'Because Bennett is in Oakton/Tysons and Ty is in Richmond, treat the 7–8 AM session as the anchor and assign asynchronous homework after.' },
  { title:'Falling behind plan', detail:'Do not shame the gap. Generate a catch-up quest: 20 QAE, one visual map, one mistake review, and one teach-back note.' },
  { title:'Streak philosophy', detail:'Streaks should motivate, not punish. Pause blocks and freezes protect momentum when travel, client work, or life gets in the way.' },
  { title:'Weekend boost', detail:'Weekend sessions should be optional bonus XP, not required for streak survival. Use them to catch up or push ahead.' }
];
