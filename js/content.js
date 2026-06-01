export const OFFICIAL_LINKS = {
  cisaOverview:'https://www.isaca.org/credentialing/cisa',
  cisaOutline:'https://www.isaca.org/credentialing/cisa/cisa-exam-content-outline',
  qae:'https://store.isaca.org/s/store#/store/browse/detail/a2S4w000004Ko9qEAC',
  udemy:'https://www.udemy.com/'
};

export const DOMAINS = [
  { id:'D1', short:'Domain 1', title:'Information Systems Auditing Process', weight:18, color:'#7C4DFF', icon:'audit' },
  { id:'D2', short:'Domain 2', title:'Governance And Management Of IT', weight:18, color:'#00A7FF', icon:'governance' },
  { id:'D3', short:'Domain 3', title:'IS Acquisition, Development And Implementation', weight:12, color:'#18C29C', icon:'build' },
  { id:'D4', short:'Domain 4', title:'IS Operations And Business Resilience', weight:26, color:'#FFB347', icon:'resilience' },
  { id:'D5', short:'Domain 5', title:'Protection Of Information Assets', weight:26, color:'#FF5C8A', icon:'security' },
  { id:'MIX', short:'Mixed Review', title:'Mixed Review And Mock Exam Readiness', weight:0, color:'#9B5CFF', icon:'mixed' }
];

export const TOPICS = [
  { domain:'D1', title:'Audit Mindset And ISACA Question Logic', focus:'Learn how CISA asks FIRST, BEST, MOST, PRIMARY, and GREATEST risk questions.', tasks:['Watch one Domain 1 overview video or Udemy section.', 'Write five CISA answer-choice rules in your notebook.', 'Do 8 Domain 1 QAE questions and explain every answer out loud.'], homework:['Create 8 flashcards from the answer-choice rules.', 'Record a 2-minute voice memo explaining the CISA auditor mindset.'], links:['cisaOutline','qae'] },
  { domain:'D1', title:'Audit Charter, Independence, And Standards', focus:'Understand authority, independence, ethics, and professional standards.', tasks:['Review audit charter purpose and independence requirements.', 'Map who owns audit, controls, remediation, and evidence.', 'Do 10 QAE questions focused on audit governance and independence.'], homework:['Make a visual ownership map.', 'Log one Mistake Forge entry for any missed independence question.'], links:['cisaOverview','qae'] },
  { domain:'D1', title:'Risk-Based Audit Planning', focus:'Audit resources should focus on areas with the greatest risk to business objectives.', tasks:['Draw the audit universe to risk assessment to audit plan flow.', 'Identify common planning traps: convenience, equal coverage, and low-risk distractions.', 'Do 10 QAE questions on risk-based planning.'], homework:['Build a mini cheat sheet: risk-based audit planning.', 'Add three examples from EY-style ITGC work.'], links:['qae'] },
  { domain:'D1', title:'Evidence, Sampling, And Testing', focus:'Evidence should be sufficient, reliable, relevant, and useful.', tasks:['Compare inquiry, observation, inspection, reperformance, and data analytics.', 'Review compliance testing versus substantive testing.', 'Do 12 QAE questions on evidence and testing.'], homework:['Create a table of evidence types and reliability.', 'Make 10 flashcards on testing terms.'], links:['qae'] },
  { domain:'D1', title:'Audit Reporting And Follow-Up', focus:'Findings need criteria, condition, cause, effect, and recommendation.', tasks:['Create a finding structure map.', 'Discuss why auditors validate cause and impact before recommending remediation.', 'Do 10 QAE questions on reporting and follow-up.'], homework:['Write one sample finding using condition, criteria, cause, effect, recommendation.', 'Review all missed Domain 1 questions so far.'], links:['qae'] },

  { domain:'D2', title:'IT Governance Structure And Accountability', focus:'Boards and senior management govern; management operates; auditors provide assurance.', tasks:['Draw governance layers from board to process owners.', 'Review ownership of risk, data, access, policies, and controls.', 'Do 10 QAE governance questions.'], homework:['Make an ownership flashcard deck.', 'Explain governance in a 2-minute audio summary.'], links:['qae'] },
  { domain:'D2', title:'Strategy, Policies, Standards, And Procedures', focus:'Distinguish policy, standard, procedure, baseline, and guideline.', tasks:['Build the policy hierarchy.', 'Review how IT strategy aligns with business objectives.', 'Do 10 QAE questions on governance documents.'], homework:['Create flashcards for policy hierarchy terms.', 'Add one notebook note summarizing strategy alignment.'], links:['qae'] },
  { domain:'D2', title:'Risk Management, KRIs, KPIs, And Compliance', focus:'Understand risk appetite, risk tolerance, monitoring, and reporting.', tasks:['Review risk appetite versus tolerance.', 'Map KPI/KRI examples.', 'Do 12 QAE questions on risk management.'], homework:['Create three KRI examples for ITGC topics.', 'Add one Mistake Forge entry if needed.'], links:['qae'] },
  { domain:'D2', title:'Third-Party, Vendor, And Outsourcing Risk', focus:'Contracts, SLAs, right-to-audit, monitoring, and exit strategy matter.', tasks:['Map vendor lifecycle controls.', 'Discuss what should be reviewed before outsourcing critical IT services.', 'Do 10 QAE questions on third-party risk.'], homework:['Create a vendor risk checklist.', 'Review SOC report purpose and limitations.'], links:['qae'] },
  { domain:'D2', title:'Data Governance And Privacy Basics', focus:'Data owners classify data and approve access based on business need.', tasks:['Review data classification, retention, privacy, and ownership.', 'Create a data lifecycle map.', 'Do 10 QAE questions on data governance.'], homework:['Create flashcards on data owner/custodian/user responsibilities.', 'Write a quick note on privacy-by-design.'], links:['qae'] },

  { domain:'D3', title:'Project Governance And Business Case', focus:'Auditors evaluate whether projects are justified, governed, and controlled.', tasks:['Review business case, feasibility, and approval gates.', 'Map steering committee and sponsor responsibilities.', 'Do 8 QAE questions on project governance.'], homework:['Create a project governance visual map.', 'Make 8 SDLC flashcards.'], links:['qae'] },
  { domain:'D3', title:'Requirements, Design, And Control Integration', focus:'Controls should be designed early, not bolted on at the end.', tasks:['Review requirements traceability and control design.', 'Compare functional, technical, security, and control requirements.', 'Do 10 QAE questions on requirements and controls.'], homework:['Create a requirements traceability mini diagram.', 'Add one note about control design in Agile.'], links:['qae'] },
  { domain:'D3', title:'Testing, UAT, And Quality Assurance', focus:'Business users own UAT; independent QA provides assurance over quality.', tasks:['Compare unit, system, integration, UAT, regression, and parallel testing.', 'Discuss why UAT is not an IT-only activity.', 'Do 10 QAE questions on testing.'], homework:['Make a testing pyramid or lifecycle chart.', 'Create flashcards for testing types.'], links:['qae'] },
  { domain:'D3', title:'Implementation, Migration, And Post-Implementation Review', focus:'Data conversion, cutover, approval, rollback, and PIR are key risks.', tasks:['Map implementation readiness and go-live approval.', 'Review data conversion controls.', 'Do 10 QAE questions on implementation.'], homework:['Create a cutover checklist.', 'Write one note on why restoration/rollback plans matter.'], links:['qae'] },

  { domain:'D4', title:'IT Operations, Scheduling, And Monitoring', focus:'Operations controls keep systems reliable, complete, accurate, and available.', tasks:['Review job scheduling, monitoring, logging, and exception handling.', 'Create an operations control map.', 'Do 12 QAE questions on operations.'], homework:['Make flashcards for batch processing, interfaces, and monitoring.', 'Log one operations-related mistake if missed.'], links:['qae'] },
  { domain:'D4', title:'Change, Release, Configuration, And Patch Management', focus:'Controlled change reduces the risk of unauthorized or untested production changes.', tasks:['Compare change, release, configuration, and patch management.', 'Map emergency change approval and follow-up.', 'Do 12 QAE questions on change management.'], homework:['Create a change lifecycle diagram.', 'Summarize patch risk in 5 bullets.'], links:['qae'] },
  { domain:'D4', title:'Incident, Problem, And Service Management', focus:'Incidents restore service; problems address root cause.', tasks:['Build an incident versus problem comparison.', 'Review SLA, escalation, and root-cause concepts.', 'Do 12 QAE questions on service management.'], homework:['Create flashcards for ITIL-style terms.', 'Add one scenario note: outage repeats every week.'], links:['qae'] },
  { domain:'D4', title:'Backup, Recovery, BIA, BCP, And DRP', focus:'BIA drives priorities; RTO/RPO define recovery requirements; testing proves readiness.', tasks:['Draw BIA to BCP to DRP to testing flow.', 'Compare RTO, RPO, MTD/MAO, hot/warm/cold sites.', 'Do 15 QAE questions on resilience.'], homework:['Create a recovery timeline diagram.', 'Memorize RTO/RPO/MTD with flashcards.'], links:['qae'] },
  { domain:'D4', title:'Business Resilience Testing And Maintenance', focus:'Plans are only useful if they are updated, tested, and understood.', tasks:['Review walkthrough, tabletop, simulation, parallel, and full interruption tests.', 'Discuss test evidence and lessons learned.', 'Do 12 QAE questions on BCP/DR testing.'], homework:['Build a BCP test-type comparison table.', 'Log any missed resilience questions in Mistake Forge.'], links:['qae'] },

  { domain:'D5', title:'Security Governance And Control Types', focus:'Security controls must align to risk, ownership, and business requirements.', tasks:['Compare preventive, detective, corrective, deterrent, compensating, and recovery controls.', 'Review security policies and baseline expectations.', 'Do 12 QAE questions on control types.'], homework:['Make a control-type flashcard deck.', 'Add 10 examples of preventive/detective/corrective controls.'], links:['qae'] },
  { domain:'D5', title:'Identity And Access Management', focus:'Least privilege, owner approval, timely removal, privileged access, and periodic review.', tasks:['Map joiner, mover, leaver access lifecycle.', 'Discuss privileged access risks and compensating controls.', 'Do 15 QAE questions on access.'], homework:['Create an IAM lifecycle diagram.', 'Make flashcards for RBAC, MFA, SSO, and PAM.'], links:['qae'] },
  { domain:'D5', title:'Network, Endpoint, Cloud, And Mobile Security', focus:'Technical controls should be understood through the lens of risk and assurance.', tasks:['Review network segmentation, firewalls, IDS/IPS, endpoint controls, and cloud shared responsibility.', 'Compare configuration baselines and vulnerability management.', 'Do 12 QAE questions on technical security.'], homework:['Create a cloud shared responsibility note.', 'Build a network controls cheat sheet.'], links:['qae'] },
  { domain:'D5', title:'Encryption, PKI, Data Protection, And DLP', focus:'Encryption is only as strong as key management and implementation.', tasks:['Review encryption at rest/in transit, hashing, digital signatures, PKI, and key management.', 'Discuss data loss prevention and classification ties.', 'Do 12 QAE questions on data protection.'], homework:['Create a PKI concept map.', 'Make 10 flashcards on encryption terms.'], links:['qae'] },
  { domain:'D5', title:'Security Monitoring, Incident Response, And Forensics', focus:'Detection, containment, evidence integrity, chain of custody, and lessons learned matter.', tasks:['Map incident response phases.', 'Review log monitoring, SIEM, vulnerability scanning, penetration testing, and chain of custody.', 'Do 15 QAE questions on incident response.'], homework:['Create an incident response flowchart.', 'Add Mistake Forge entries for missed security questions.'], links:['qae'] },

  { domain:'MIX', title:'Mixed Review Block 1', focus:'Switch domains quickly and explain why answers are right or wrong.', tasks:['Do a 25-question mixed QAE block.', 'Review every missed or guessed question.', 'Update Memory Deck and Mistake Forge.'], homework:['Create a top-10 missed-topic list.', 'Do a 10-minute flashcard sprint.'], links:['qae'] },
  { domain:'MIX', title:'Mock Exam Strategy And Timing', focus:'Practice pacing, question logic, and stamina.', tasks:['Do a timed 50-question block or two 25-question blocks.', 'Track accuracy by domain.', 'Identify top three risks before exam week.'], homework:['Write an exam-day strategy note.', 'Review all open Mistake Forge items.'], links:['qae'] },
  { domain:'MIX', title:'Final Weak Area Repair', focus:'Repair the domains/topics that are dragging down your score.', tasks:['Pick the weakest domain from QAE trend analysis.', 'Study one video, one visual map, and one QAE block.', 'Retest missed concepts.'], homework:['Create the final one-page cheat sheet.', 'Review flashcards before bed.'], links:['qae'] }
];

export const DAILY_CHALLENGE_BANK = [
  { key:'qae-mini', title:'QAE Mini Block', detail:'Complete the daily QAE target and log the result in Practice Log.', xp:45, coins:12, icon:'qae', requiresEvidence:true },
  { key:'teach-back', title:'Teach-Back Sprint', detail:'Explain one CISA concept out loud in two minutes.', xp:30, coins:8, icon:'voice', requiresEvidence:false },
  { key:'memory-review', title:'Memory Deck Review', detail:'Review at least five flashcards in Study Tools.', xp:30, coins:8, icon:'cards', requiresEvidence:false },
  { key:'mistake-forge', title:'Forge One Mistake', detail:'Turn one wrong or guessed answer into a Mistake Forge entry.', xp:35, coins:10, icon:'forge', requiresEvidence:false },
  { key:'roadmap-task', title:'Lesson Checkpoint', detail:'Complete at least one task from today’s roadmap lesson.', xp:40, coins:10, icon:'roadmap', requiresEvidence:false },
  { key:'note-capture', title:'Notebook Capture', detail:'Write a short note, diagram summary, or study takeaway.', xp:25, coins:6, icon:'notebook', requiresEvidence:false },
  { key:'arcade-round', title:'Arcade Round', detail:'Win one game round in Study Tools.', xp:35, coins:10, icon:'arcade', requiresEvidence:false },
  { key:'homework-cleanup', title:'Homework Cleanup', detail:'Complete one open homework item or catch-up task.', xp:40, coins:10, icon:'homework', requiresEvidence:false }
];

export const HOMEWORK_IDEAS = [
  { title:'Create 8 Flashcards', detail:'Turn today’s lesson into eight clean front/back cards.', type:'Memory Deck', xp:30, coins:8 },
  { title:'Record A 2-Minute Voice Memo', detail:'Teach today’s topic like you are explaining it to a new staff.', type:'Audio Review', xp:25, coins:6 },
  { title:'Do A 10-Question QAE Retest', detail:'Use the official QAE database and log the result in Practice Log.', type:'QAE', xp:45, coins:12 },
  { title:'Build A One-Page Visual Map', detail:'Draw the flow, ownership model, or lifecycle from today’s topic.', type:'Visual', xp:35, coins:10 },
  { title:'Update Mistake Forge', detail:'Convert every missed question into one “CISA logic” note.', type:'Mistakes', xp:35, coins:10 },
  { title:'Watch One Short Video Segment', detail:'Watch a targeted video section and capture three takeaways.', type:'Video', xp:25, coins:6 },
  { title:'Review Yesterday’s Cards', detail:'Do a fast flashcard pass before the next session.', type:'Memory Deck', xp:20, coins:5 },
  { title:'Write One Scenario Example', detail:'Apply today’s concept to an EY-style IT audit scenario.', type:'Scenario', xp:30, coins:8 }
];

export const STARTER_DECKS = [
  { id:'public-d1-audit-process', scope:'public', title:'Domain 1: Audit Process Master Deck', domain:'D1', description:'Core audit process, evidence, planning, reporting, and CISA answer logic.', cards:[
    ['Auditor Role','Evaluate controls, collect evidence, and provide assurance. Management owns operations and remediation.'],
    ['Risk-Based Audit Planning','Prioritizing audit work based on areas of greatest risk to business objectives.'],
    ['Audit Universe','The full population of auditable entities, processes, systems, locations, and risks.'],
    ['Audit Charter','A formal document defining audit authority, responsibility, and scope.'],
    ['Independence','Freedom from conditions that threaten objectivity or impartiality.'],
    ['Sufficient Evidence','Enough evidence to support a finding or conclusion.'],
    ['Reliable Evidence','Evidence from independent, objective, or directly obtained sources is generally stronger.'],
    ['Relevant Evidence','Evidence that directly supports the audit objective or finding.'],
    ['Useful Evidence','Evidence that helps the auditor reach a valid conclusion or recommendation.'],
    ['Compliance Testing','Testing whether controls operate according to policies, standards, or procedures.'],
    ['Substantive Testing','Testing transactions, data, or evidence to determine whether errors or issues exist.'],
    ['Sampling Risk','Risk that the sample selected is not representative of the population.'],
    ['CAATs','Computer-assisted audit techniques used to analyze large datasets or automate audit procedures.'],
    ['Audit Finding Structure','Condition, criteria, cause, effect, and recommendation.'],
    ['Follow-Up','Determining whether management’s corrective actions were implemented and effective.']
  ]},
  { id:'public-d2-governance', scope:'public', title:'Domain 2: Governance And Management Deck', domain:'D2', description:'Governance, ownership, risk management, policies, vendors, and data governance.', cards:[
    ['IT Governance','Leadership, structures, and processes that ensure IT sustains and extends business objectives.'],
    ['Board Accountability','The board and senior management are accountable for governance and direction.'],
    ['IT Steering Committee','A governance body that helps align IT projects, priorities, and resources with business goals.'],
    ['Policy','High-level statement of management intent and required behavior.'],
    ['Standard','Mandatory specific requirement that supports a policy.'],
    ['Procedure','Step-by-step instructions for performing a process.'],
    ['Guideline','Recommended but usually not mandatory guidance.'],
    ['Risk Appetite','The level of risk an organization is willing to accept.'],
    ['Risk Tolerance','Acceptable variation around risk appetite or objectives.'],
    ['KRI','Key Risk Indicator used to monitor changes in risk exposure.'],
    ['KPI','Key Performance Indicator used to monitor performance against objectives.'],
    ['Data Owner','Business role accountable for data classification, access approval, and use.'],
    ['Data Custodian','IT or operations role responsible for storing, processing, or safeguarding data.'],
    ['Third-Party Risk Controls','Due diligence, contracts, SLAs, right-to-audit, monitoring, and exit strategy.'],
    ['Right-To-Audit Clause','Contract language allowing the organization to audit or review vendor controls.']
  ]},
  { id:'public-d3-sdlc', scope:'public', title:'Domain 3: SDLC And Implementation Deck', domain:'D3', description:'Project governance, requirements, testing, migration, and post-implementation review.', cards:[
    ['Business Case','Justification for a project based on benefits, costs, risks, and alignment.'],
    ['Feasibility Study','Assessment of whether a project is technically, operationally, legally, and economically viable.'],
    ['Requirements Traceability','Linking requirements to design, development, testing, and implementation evidence.'],
    ['SDLC','Structured process for planning, building, testing, deploying, and maintaining systems.'],
    ['Agile Audit Focus','Governance, control integration, traceability, approvals, and security within iterative delivery.'],
    ['Unit Testing','Testing individual components or modules.'],
    ['Integration Testing','Testing whether components work together.'],
    ['System Testing','Testing the complete system against requirements.'],
    ['Regression Testing','Testing to ensure changes did not break existing functionality.'],
    ['UAT','Business users validate that the system supports business requirements.'],
    ['Parallel Testing','Running old and new systems at the same time to compare results.'],
    ['Data Conversion','Migration or transformation of data from old system to new system.'],
    ['Rollback Plan','Plan for returning to a prior state if implementation fails.'],
    ['Post-Implementation Review','Review after go-live to determine whether objectives and controls are achieved.'],
    ['Change Control','Process to authorize, test, approve, and document modifications.']
  ]},
  { id:'public-d4-operations', scope:'public', title:'Domain 4: Operations And Resilience Deck', domain:'D4', description:'Operations, service management, change, backup, BCP, DR, and resilience testing.', cards:[
    ['Incident Management','Restores service as quickly as possible after disruption.'],
    ['Problem Management','Identifies and resolves root cause of incidents.'],
    ['Change Management','Controls risk from changes to systems and production environments.'],
    ['Release Management','Plans and controls movement of releases into production.'],
    ['Configuration Management','Maintains accurate information about IT assets and configuration items.'],
    ['Patch Management','Identifies, tests, approves, and deploys updates to reduce vulnerability risk.'],
    ['Backup','A copy of data or systems used for recovery.'],
    ['Restore Test','Proof that backups can actually be used to recover data or systems.'],
    ['BIA','Business Impact Analysis identifies critical processes and disruption impact.'],
    ['RTO','Target time to restore a process or system after disruption.'],
    ['RPO','Acceptable amount of data loss measured in time.'],
    ['MTD/MAO','Maximum tolerable downtime or outage before unacceptable impact.'],
    ['BCP','Business Continuity Plan for continuing critical business operations.'],
    ['DRP','Disaster Recovery Plan for restoring IT systems and infrastructure.'],
    ['Tabletop Test','Discussion-based walkthrough of a continuity or recovery scenario.']
  ]},
  { id:'public-d5-security', scope:'public', title:'Domain 5: Protection Of Information Assets Deck', domain:'D5', description:'IAM, control types, technical security, encryption, monitoring, and forensics.', cards:[
    ['Least Privilege','Users receive only the access necessary to perform job responsibilities.'],
    ['Need To Know','Access should be based on legitimate business need.'],
    ['Privileged Access','High-risk access requiring approval, monitoring, review, and restriction.'],
    ['MFA','Multi-factor authentication uses two or more authentication factors.'],
    ['RBAC','Role-based access control assigns access based on defined job roles.'],
    ['Preventive Control','Control designed to stop an issue before it occurs.'],
    ['Detective Control','Control designed to identify issues after they occur.'],
    ['Corrective Control','Control designed to fix or recover from an issue.'],
    ['Compensating Control','Alternate control used when the preferred control is not feasible.'],
    ['Encryption At Rest','Protection of stored data through encryption.'],
    ['Encryption In Transit','Protection of data moving across networks.'],
    ['Key Management','Generation, storage, rotation, and protection of cryptographic keys.'],
    ['DLP','Data Loss Prevention controls detect or prevent unauthorized data disclosure.'],
    ['Chain Of Custody','Documentation of evidence handling to preserve integrity.'],
    ['SIEM','Centralized logging and correlation for security monitoring and response.']
  ]}
];

export const GAME_QUESTIONS = [
  { mode:'bestFirst', domain:'D1', prompt:'An auditor sees a potential control weakness during fieldwork. What should happen before recommending a fix?', options:['Implement a new control immediately','Validate evidence, cause, and impact','Tell IT to shut down the process','Update the audit charter'], answer:1, explain:'The auditor should support the finding before recommending corrective action.' },
  { mode:'bestFirst', domain:'D1', prompt:'Which factor should primarily drive the audit plan?', options:['The easiest systems to test','Management preference only','Risk to business objectives','The newest technology'], answer:2, explain:'CISA expects a risk-based audit approach.' },
  { mode:'bestFirst', domain:'D2', prompt:'Who should approve access to sensitive business data?', options:['The help desk','The data owner','The external auditor','Any system administrator'], answer:1, explain:'The data owner understands the business need and owns access approval.' },
  { mode:'bestFirst', domain:'D2', prompt:'What is the greatest concern when outsourcing a critical IT function?', options:['Vendor branding','Loss of control without adequate oversight','Lower internal headcount','New invoice format'], answer:1, explain:'Critical outsourcing requires oversight, monitoring, contractual rights, and risk management.' },
  { mode:'bestFirst', domain:'D3', prompt:'Who should primarily perform user acceptance testing?', options:['Business users','Database administrators only','External auditors','The help desk'], answer:0, explain:'Business users validate whether the system meets business requirements.' },
  { mode:'bestFirst', domain:'D3', prompt:'What is the best reason for a post-implementation review?', options:['Punish the project team','Determine whether objectives and controls are achieved','Replace UAT','Skip future approvals'], answer:1, explain:'PIR evaluates benefits, lessons learned, and control effectiveness after go-live.' },
  { mode:'bestFirst', domain:'D4', prompt:'Which activity proves backups can actually support recovery?', options:['Backup job completed log','Successful restoration test','Storage capacity report','Vendor invoice'], answer:1, explain:'A backup is only meaningful if restoration works and meets recovery needs.' },
  { mode:'bestFirst', domain:'D4', prompt:'A recurring outage keeps happening. Which process targets root cause?', options:['Incident management','Problem management','Capacity billing','User provisioning'], answer:1, explain:'Incident management restores service; problem management addresses root cause.' },
  { mode:'bestFirst', domain:'D5', prompt:'What is the strongest control for excessive user access?', options:['Generic awareness email','Owner-approved least privilege and periodic review','Longer passwords only','Weekly screenshots'], answer:1, explain:'Access should be authorized by owners, limited to need, and periodically reviewed.' },
  { mode:'bestFirst', domain:'D5', prompt:'What is the greatest risk with encryption?', options:['Too many icons','Weak key management','Long passwords','A larger database'], answer:1, explain:'Poor key management can undermine otherwise strong encryption.' },
  { mode:'termMatch', term:'RTO', answer:'Target time to restore service after disruption' },
  { mode:'termMatch', term:'RPO', answer:'Acceptable data loss measured in time' },
  { mode:'termMatch', term:'BIA', answer:'Analysis that identifies critical processes and disruption impact' },
  { mode:'termMatch', term:'Substantive Testing', answer:'Testing evidence to determine whether an error or issue exists' },
  { mode:'termMatch', term:'Compliance Testing', answer:'Testing whether controls operate as required' },
  { mode:'termMatch', term:'Data Owner', answer:'Business owner accountable for classification and access approval' },
  { mode:'termMatch', term:'Problem Management', answer:'Process focused on root cause of incidents' },
  { mode:'termMatch', term:'UAT', answer:'Business validation that the system meets requirements' },
  { mode:'sort', item:'Access approval by data owner', bucket:'Preventive' },
  { mode:'sort', item:'Log review', bucket:'Detective' },
  { mode:'sort', item:'Backup restoration test', bucket:'Corrective / Recovery' },
  { mode:'sort', item:'Segregation of duties', bucket:'Preventive' },
  { mode:'sort', item:'Incident postmortem', bucket:'Corrective / Recovery' },
  { mode:'sort', item:'Exception report review', bucket:'Detective' }
];

export const AVATAR_ITEMS = {
  baseColor:[
    { id:'#7c4dff', label:'Quest Violet', unlock:'Start', cost:0 },
    { id:'#00a7ff', label:'Sky Audit Blue', unlock:'Start', cost:0 },
    { id:'#18c29c', label:'Control Green', unlock:'Level 2', cost:80 },
    { id:'#ff9f1c', label:'Gold Evidence', unlock:'Level 3', cost:120 },
    { id:'#ff5c8a', label:'Risk Rose', unlock:'Level 4', cost:140 },
    { id:'#0f172a', label:'Night Review', unlock:'7-Day Streak', cost:200 },
    { id:'#14b8a6', label:'Teal Test Mode', unlock:'Level 6', cost:260 },
    { id:'#a855f7', label:'Purple Audit Aura', unlock:'Level 8', cost:340 }
  ],
  cape:[
    { id:'none', label:'No Cape', unlock:'Start', cost:0 },
    { id:'blue-cape', label:'Audit Cape', unlock:'Level 2', cost:120 },
    { id:'gold-cape', label:'Gold Reviewer Cape', unlock:'Level 5', cost:300 },
    { id:'night-cape', label:'Night Study Cape', unlock:'3-Day Streak', cost:180 },
    { id:'emerald-cape', label:'Control Champion Cape', unlock:'Level 7', cost:420 }
  ],
  glasses:[
    { id:'round', label:'Round Reviewer Glasses', unlock:'Start', cost:0 },
    { id:'visor', label:'Data Visor', unlock:'5 QAE Logs', cost:160 },
    { id:'stars', label:'Star Focus', unlock:'Level 5', cost:250 },
    { id:'audit-shades', label:'Audit Shades', unlock:'Arcade Ace', cost:300 }
  ],
  accessory:[
    { id:'clipboard', label:'Audit Clipboard', unlock:'Start', cost:0 },
    { id:'coffee', label:'7 AM Coffee', unlock:'3-Day Streak', cost:120 },
    { id:'shield', label:'Control Shield', unlock:'10 Mistakes Logged', cost:220 },
    { id:'crown', label:'Domain Crown', unlock:'Perfect Week', cost:400 },
    { id:'rocket', label:'Review Rocket', unlock:'Level 6', cost:360 }
  ],
  mood:[
    { id:'focused', label:'Focused', unlock:'Start', cost:0 },
    { id:'happy', label:'Happy', unlock:'Start', cost:0 },
    { id:'locked-in', label:'Locked In', unlock:'Level 3', cost:120 },
    { id:'victory', label:'Victory', unlock:'Level 7', cost:280 }
  ]
};

export const SHOP_ITEMS = [
  { id:'freeze', title:'Streak Freeze', type:'streakFreeze', cost:100, icon:'freeze', description:'Automatically protects one eligible missed scheduled study day.' },
  { id:'bronze-chest', title:'Bronze Chest', type:'chest', cost:80, chest:'bronze', icon:'chest', description:'Small random XP/coin reward.' },
  { id:'silver-chest', title:'Silver Chest', type:'chest', cost:170, chest:'silver', icon:'chest', description:'Medium random reward with better odds.' },
  { id:'gold-chest', title:'Gold Chest', type:'chest', cost:360, chest:'gold', icon:'chest', description:'Large random reward and best cosmetic odds.' },
  { id:'xp-boost-small', title:'30-Minute XP Boost', type:'xpBoost', cost:150, multiplier:1.25, minutes:30, icon:'boost', description:'Earn 25% extra XP for the next 30 minutes.' },
  { id:'xp-boost-large', title:'60-Minute XP Boost', type:'xpBoost', cost:275, multiplier:1.5, minutes:60, icon:'boost', description:'Earn 50% extra XP for the next 60 minutes.' }
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
