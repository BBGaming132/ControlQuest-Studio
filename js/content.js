export const RESOURCE_LINKS = {
  qae: "https://www.isaca.org/myisaca/learnings",
  youtubePlaylist: "https://youtube.com/playlist?list=PL7XJSuT7Dq_UvA2knww9Rlzz2JHUpeOAb&si=24LkSCqxPR3-Qixd",
  isacaCisa: "https://www.isaca.org/credentialing/cisa",
  isacaOutline: "docs/CISA_Exam_Outline_ControlQuest.docx",
  udemy: "",
  cisaResources: "https://www.isaca.org/resources/isaca-journal/issues"
};

export const TIMEZONES = (typeof Intl !== 'undefined' && Intl.supportedValuesOf)
  ? Intl.supportedValuesOf('timeZone')
  : [
    'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','America/Anchorage','Pacific/Honolulu',
    'America/Toronto','America/Vancouver','Europe/London','Europe/Paris','Europe/Berlin','Asia/Dubai','Asia/Kolkata','Asia/Singapore','Asia/Tokyo','Australia/Sydney'
  ];

export const DOMAIN_TOPICS = [
  {
    id:'d1', domain:'Domain 1', name:'Information Systems Auditing Process', weight:18, icon:'audit', color:'#7c4dff',
    topics:[
      'IS Audit Standards, Guidelines, Functions, And Codes Of Ethics','Types Of Audits, Assessments, And Reviews','Risk-Based Audit Planning','Types Of Controls And Considerations','Audit Project Management','Audit Testing And Sampling Methodology','Audit Evidence Collection Techniques','Audit Data Analytics','Reporting And Communication Techniques','Quality Assurance And Improvement Of Audit Process'
    ]
  },
  {
    id:'d2', domain:'Domain 2', name:'Governance And Management Of IT', weight:18, icon:'guild', color:'#00c2ff',
    topics:[
      'Laws, Regulations, And Industry Standards','Organizational Structure, IT Governance, And IT Strategy','IT Policies, Standards, Procedures, And Guidelines','Enterprise Architecture And Considerations','Enterprise Risk Management','Privacy Program And Principles','Data Governance And Classification','IT Resource Management','IT Vendor Management','IT Performance Monitoring And Reporting','Quality Assurance And Quality Management Of IT'
    ]
  },
  {
    id:'d3', domain:'Domain 3', name:'Information Systems Acquisition, Development, And Implementation', weight:12, icon:'roadmap', color:'#18c29c',
    topics:[
      'Project Governance And Management','Business Case And Feasibility Analysis','System Development Methodologies','Control Identification And Design','System Readiness And Implementation Testing','Implementation Configuration And Release Management','System Migration, Infrastructure Deployment, And Data Conversion','Postimplementation Review'
    ]
  },
  {
    id:'d4', domain:'Domain 4', name:'Information Systems Operations And Business Resilience', weight:26, icon:'timer', color:'#ffd166',
    topics:[
      'IT Components','IT Asset Management','Job Scheduling And Production Process Automation','System Interfaces','End-User Computing And Shadow IT','Systems Availability And Capacity Management','Problem And Incident Management','IT Change, Configuration, And Patch Management','Operational Log Management','IT Service Level Management','Database Management','Business Impact Analysis','System And Operational Resilience','Data Backup, Storage, And Restoration','Business Continuity Plan','Disaster Recovery Plans'
    ]
  },
  {
    id:'d5', domain:'Domain 5', name:'Protection Of Information Assets', weight:26, icon:'target', color:'#ff7ad9',
    topics:[
      'Information Asset Security Policies, Frameworks, Standards, And Guidelines','Physical And Environmental Controls','Identity And Access Management','Network And End-Point Security','Data Loss Prevention','Data Encryption','Public Key Infrastructure','Cloud And Virtualized Environments','Mobile, Wireless, And Internet-Of-Things Devices','Security Awareness Training And Programs','Information System Attack Methods And Techniques','Security Testing Tools And Techniques','Security Monitoring Logs, Tools, And Techniques','Security Incident Response Management','Evidence Collection And Forensics'
    ]
  }
];

export const CISA_RULES = [
  {term:'Auditor Independence',definition:'The auditor must remain objective and avoid owning, approving, or operating the control being audited.',domain:'Domain 1'},
  {term:'Risk-Based Audit Planning',definition:'Audit work should prioritize areas with the greatest risk and business impact, not areas that are easiest to test.',domain:'Domain 1'},
  {term:'Sufficient Evidence',definition:'Evidence must be reliable, relevant, and adequate enough to support an audit finding or conclusion.',domain:'Domain 1'},
  {term:'Management Owns Risk',definition:'Management owns risks and controls; auditors provide assurance and recommendations.',domain:'Domain 2'},
  {term:'Board Oversight',definition:'The board and senior management establish governance direction, risk appetite, and accountability.',domain:'Domain 2'},
  {term:'Data Owner',definition:'The business data owner approves access and defines classification based on business need and sensitivity.',domain:'Domain 2'},
  {term:'Business Case',definition:'A business case justifies investment by comparing expected benefits, costs, risks, and strategic alignment.',domain:'Domain 3'},
  {term:'UAT',definition:'User acceptance testing validates that the system satisfies business requirements from the user perspective.',domain:'Domain 3'},
  {term:'Postimplementation Review',definition:'A review after deployment determines whether objectives were achieved and controls are operating as intended.',domain:'Domain 3'},
  {term:'Incident Management',definition:'Incident management restores service quickly after an interruption.',domain:'Domain 4'},
  {term:'Problem Management',definition:'Problem management identifies root cause to prevent recurring incidents.',domain:'Domain 4'},
  {term:'Change Management',definition:'Changes should be authorized, tested, documented, and approved before production deployment.',domain:'Domain 4'},
  {term:'BIA',definition:'A business impact analysis identifies critical processes and recovery priorities.',domain:'Domain 4'},
  {term:'RTO',definition:'Recovery Time Objective is the target time to restore a process or system after disruption.',domain:'Domain 4'},
  {term:'RPO',definition:'Recovery Point Objective is the acceptable amount of data loss measured in time.',domain:'Domain 4'},
  {term:'Least Privilege',definition:'Users should only have the minimum access needed to perform approved job responsibilities.',domain:'Domain 5'},
  {term:'Privileged Access',definition:'Privileged accounts require stronger controls, monitoring, periodic review, and timely removal.',domain:'Domain 5'},
  {term:'Encryption',definition:'Encryption protects confidentiality of data in transit and at rest, but key management determines effectiveness.',domain:'Domain 5'},
  {term:'Security Awareness',definition:'Security awareness reduces human-factor risk by training users to recognize and respond to threats.',domain:'Domain 5'},
  {term:'Incident Response',definition:'Incident response should include detection, containment, eradication, recovery, communication, and lessons learned.',domain:'Domain 5'}
];

export const DECISION_PROMPTS = [
  {q:'An auditor discovers a control deficiency during fieldwork. What is the best next step?',choices:['Immediately implement a fix','Determine cause, impact, and evidence','Report directly to regulators','Ignore it until final reporting'],answer:1,why:'Auditors validate evidence and understand cause/impact before recommending or reporting.'},
  {q:'A business unit wants access granted quickly to sensitive data. Who should approve access?',choices:['System administrator','Help desk manager','Business data owner','Internal auditor'],answer:2,why:'The data owner has accountability for authorizing access based on business need.'},
  {q:'Which activity should usually happen before setting RTO and RPO?',choices:['Penetration testing','Business impact analysis','Code migration','Password review'],answer:1,why:'BIA identifies critical processes and recovery priorities that drive RTO/RPO.'},
  {q:'What is the primary goal of incident management?',choices:['Find root cause','Restore service','Approve changes','Classify data'],answer:1,why:'Incident management focuses on restoring normal service as quickly as possible.'},
  {q:'What is the primary goal of problem management?',choices:['Restore service immediately','Find root cause and prevent recurrence','Schedule backups','Approve access'],answer:1,why:'Problem management looks for root cause and long-term prevention.'},
  {q:'What is the best evidence that backups are useful?',choices:['Backup policy exists','Backup job says complete','Successful restoration test','Storage team says it works'],answer:2,why:'A restore test proves recoverability, not just backup creation.'},
  {q:'Which access control principle reduces excessive permissions?',choices:['Least privilege','Defense in depth','Hashing','Data mirroring'],answer:0,why:'Least privilege limits access to what is needed.'},
  {q:'For a FIRST question, what should you usually think about?',choices:['The flashiest technical fix','The first logical audit step','The cheapest solution','The most senior person'],answer:1,why:'FIRST questions test sequence and prerequisites.'}
];

export const HOMEWORK_SUGGESTIONS = [
  {id:'qae10',title:'Log 10 QAE Questions',details:'Complete a focused 10-question QAE set and log the score in Practice Log.',xp:35,coins:14,type:'Practice',links:[{label:'Open ISACA Learning/QAE',url:RESOURCE_LINKS.qae},{label:'Open Practice Log',go:'practice'}]},
  {id:'udemy20',title:'Watch 20 Minutes Of Udemy',details:'Use the Udemy CISA course and write 3 exam-useful takeaways.',xp:28,coins:10,type:'Udemy',links:[{label:'Open Udemy Link',url:RESOURCE_LINKS.udemy},{label:'Open Notebook',go:'notebook'}]},
  {id:'missed3',title:'Review 3 Missed Questions',details:'Take three missed QAE concepts and write the reusable CISA answer logic.',xp:30,coins:12,type:'Review',links:[{label:'Open Practice Log',go:'practice'},{label:'Open Study Tools',go:'tools'}]},
  {id:'voice2',title:'Record A 2-Minute Voice Memo',details:'Explain today’s concept like you are teaching a new staff. Summarize the CISA answer logic.',xp:20,coins:8,type:'Audio',links:[{label:'Open Notebook',go:'notebook'}]},
  {id:'flash15',title:'15-Minute Flashcard Drill',details:'Use ControlQuest flashcards built from notes and missed questions.',xp:25,coins:10,type:'Flashcards',links:[{label:'Open Study Tools',go:'tools'}]},
  {id:'map1',title:'Draw One Visual Map',details:'Create a simple flowchart or diagram for today’s topic and save a note about it.',xp:26,coins:10,type:'Visual',links:[{label:'Open Notebook',go:'notebook'}]},
  {id:'arcade',title:'Play One Review Game',details:'Use Arcade mode to drill missed-question concepts and audit judgment.',xp:22,coins:9,type:'Game',links:[{label:'Open Study Tools',go:'tools'}]},
  {id:'teachback',title:'Teach-Back To Your Guild',details:'Write a concise teach-back note for the group explaining one concept and one trap.',xp:32,coins:13,type:'Guild',links:[{label:'Open Guild',go:'guild'},{label:'Open Notebook',go:'notebook'}]}
];

export const DAILY_QUEST_TEMPLATES = [
  {id:'daily-qae',title:'QAE Warm-Up',details:'Log at least 10 QAE questions or a focused practice block.',xp:30,coins:12,icon:'qae'},
  {id:'daily-learn',title:'Learn One Concept',details:'Complete one roadmap lesson or watch at least 15 minutes of lesson content.',xp:25,coins:10,icon:'roadmap'},
  {id:'daily-review',title:'Review And Retain',details:'Review missed questions, build flashcards, or complete one Arcade review round.',xp:25,coins:10,icon:'notebook'}
];

export const SHOP_ITEMS = [
  {id:'freeze',kind:'consumable',title:'Streak Freeze',details:'Protects one eligible weekday miss automatically.',cost:90,icon:'freeze'},
  {id:'boost30',kind:'boost',title:'30-Minute XP Boost',details:'Earn 1.5x XP for 30 minutes after activation.',cost:120,durationMinutes:30,multiplier:1.5,icon:'boost'},
  {id:'boost60',kind:'boost',title:'60-Minute XP Boost',details:'Earn 1.5x XP for 60 minutes after activation.',cost:210,durationMinutes:60,multiplier:1.5,icon:'boost'},
  {id:'bronzeChest',kind:'chest',title:'Bronze Chest',details:'Small randomized Audit Coin and XP reward.',cost:75,chestType:'bronze',icon:'chest-bronze'},
  {id:'silverChest',kind:'chest',title:'Silver Chest',details:'Medium randomized reward with a chance of a boost.',cost:150,chestType:'silver',icon:'chest-silver'},
  {id:'goldChest',kind:'chest',title:'Gold Chest',details:'Large reward with a chance of rare avatar unlocks.',cost:260,chestType:'gold',icon:'chest-gold'}
];

export const AVATAR_ITEMS = [
  {id:'base-blue',type:'baseColor',title:'Sky Blue',value:'#2fb7ff',cost:0,unlockLevel:1},
  {id:'base-purple',type:'baseColor',title:'Audit Purple',value:'#7c4dff',cost:50,unlockLevel:2},
  {id:'base-green',type:'baseColor',title:'Control Green',value:'#18c29c',cost:70,unlockLevel:3},
  {id:'base-gold',type:'baseColor',title:'Gold Standard',value:'#ffb347',cost:150,unlockLevel:5},
  {id:'base-rose',type:'baseColor',title:'Risk Rose',value:'#ff7ad9',cost:170,unlockLevel:6},
  {id:'base-navy',type:'baseColor',title:'Navy Night',value:'#1d3557',cost:190,unlockLevel:5},
  {id:'base-mint',type:'baseColor',title:'Mint Control',value:'#77f7d2',cost:190,unlockLevel:5},
  {id:'eyes-normal',type:'eyes',title:'Bright Eyes',value:'normal',cost:0,unlockLevel:1},
  {id:'eyes-star',type:'eyes',title:'Star Eyes',value:'star',cost:90,unlockLevel:4},
  {id:'eyes-focus',type:'eyes',title:'Focus Eyes',value:'focus',cost:80,unlockLevel:3},
  {id:'glasses-none',type:'glasses',title:'No Glasses',value:'none',cost:0,unlockLevel:1},
  {id:'glasses-round',type:'glasses',title:'Round Reviewer Glasses',value:'round',cost:80,unlockLevel:2},
  {id:'glasses-shield',type:'glasses',title:'Control Shield Glasses',value:'shield',cost:120,unlockLevel:4},
  {id:'cape-none',type:'cape',title:'No Cape',value:'none',cost:0,unlockLevel:1},
  {id:'cape-blue',type:'cape',title:'Blue Audit Cape',value:'blue',cost:120,unlockLevel:3},
  {id:'cape-gold',type:'cape',title:'Gold Assurance Cape',value:'gold',cost:220,unlockLevel:6},
  {id:'cape-emerald',type:'cape',title:'Emerald Evidence Cape',value:'emerald',cost:190,unlockLevel:5},
  {id:'cape-night',type:'cape',title:'Night Shift Cape',value:'night',cost:210,unlockLevel:6},
  {id:'hat-none',type:'hat',title:'No Hat',value:'none',cost:0,unlockLevel:1},
  {id:'hat-grad',type:'hat',title:'Graduate Cap',value:'grad',cost:140,unlockLevel:5},
  {id:'hat-crown',type:'hat',title:'Control Crown',value:'crown',cost:250,unlockLevel:8},
  {id:'hat-headset',type:'hat',title:'Study Headset',value:'headset',cost:175,unlockLevel:4},
  {id:'badge-none',type:'badge',title:'No Badge',value:'none',cost:0,unlockLevel:1},
  {id:'badge-cisa',type:'badge',title:'CISA Trainee Badge',value:'cisa',cost:110,unlockLevel:4},
  {id:'badge-fire',type:'badge',title:'Streak Flame Badge',value:'fire',cost:160,unlockLevel:7},
  {id:'badge-coffee',type:'badge',title:'Cold Brew Badge',value:'coffee',cost:130,unlockLevel:3}
];

export const GAME_CATALOG = [
  {id:'avatarSprint',title:'Avatar Sprint',details:'Race your avatar by answering audit judgment prompts. Great for quick warm-ups.',xp:22,coins:8,icon:'arcade'},
  {id:'riskRank',title:'Risk Rank Rally',details:'Rank scenarios by business risk and impact. Trains greatest-risk thinking.',xp:28,coins:10,icon:'target'},
  {id:'sequence',title:'Audit Sequence Builder',details:'Put audit actions in the right order. Trains FIRST and NEXT questions.',xp:30,coins:11,icon:'roadmap'},
  {id:'controlMatch',title:'Control Match Arena',details:'Match risks to the strongest control response.',xp:24,coins:9,icon:'qae'},
  {id:'duel',title:'Decision Duel',details:'Choose the CISA-best answer under time pressure.',xp:26,coins:10,icon:'timer'},
  {id:'missedSprint',title:'Missed-Question Sprint',details:'Race through concepts pulled from your missed-question bank.',xp:30,coins:12,icon:'qae'},
  {id:'ruleRelay',title:'Rule Relay',details:'Convert a scenario into the reusable CISA rule before time runs out.',xp:28,coins:11,icon:'audit'}
];

// v2.6: Exact ISACA Perform/QAE study-plan structure supplied by Bennett.
// Used for roadmap sequencing, topic dropdowns, and QAE paste import mapping.
export const ISACA_STUDY_PLAN = [
  {id:'d1',domain:'Domain 1',name:'Information Systems Auditing Process',knowledgePoints:358,time:'60+ Minutes',weight:18,topics:[
    {id:'d1-t01',title:'IS Audit Standards, Guidelines, Functions, and Codes of Ethics',knowledgePoints:50,time:'30-60 Minutes'},
    {id:'d1-t02',title:'Types of Audits, Assessments, and Reviews',knowledgePoints:20,time:'15-30 Minutes'},
    {id:'d1-t03',title:'Risk-Based Audit Planning',knowledgePoints:68,time:'60+ Minutes'},
    {id:'d1-t04',title:'Types of Controls and Considerations',knowledgePoints:36,time:'30-60 Minutes'},
    {id:'d1-t05',title:'Audit Project Management',knowledgePoints:16,time:'15-30 Minutes'},
    {id:'d1-t06',title:'Audit Testing and Sampling Methodology',knowledgePoints:42,time:'30-60 Minutes'},
    {id:'d1-t07',title:'Audit Evidence Collection Techniques',knowledgePoints:40,time:'30-60 Minutes'},
    {id:'d1-t08',title:'Audit Data Analytics',knowledgePoints:28,time:'15-30 Minutes'},
    {id:'d1-t09',title:'Reporting and Communication Techniques',knowledgePoints:40,time:'30-60 Minutes'},
    {id:'d1-t10',title:'Quality Assurance and Improvement of Audit Process',knowledgePoints:18,time:'15-30 Minutes'}
  ]},
  {id:'d2',domain:'Domain 2',name:'Governance and Management of IT',knowledgePoints:354,time:'60+ Minutes',weight:18,topics:[
    {id:'d2-t01',title:'Laws, Regulations, and Industry Standards',knowledgePoints:6,time:'Less Than 15 Minutes'},
    {id:'d2-t02',title:'Organizational Structure, IT Governance, and IT Strategy',knowledgePoints:84,time:'60+ Minutes'},
    {id:'d2-t03',title:'IT Policies, Standards, Procedures and Guidelines',knowledgePoints:48,time:'30-60 Minutes'},
    {id:'d2-t04',title:'Enterprise Architecture and Considerations',knowledgePoints:18,time:'15-30 Minutes'},
    {id:'d2-t05',title:'Enterprise Risk Management',knowledgePoints:56,time:'30-60 Minutes'},
    {id:'d2-t06',title:'Privacy Program and Principles',knowledgePoints:2,time:'Less Than 15 Minutes'},
    {id:'d2-t07',title:'Data Governance and Classification',knowledgePoints:32,time:'30-60 Minutes'},
    {id:'d2-t08',title:'IT Resource Management',knowledgePoints:30,time:'30-60 Minutes'},
    {id:'d2-t09',title:'IT Vendor Management',knowledgePoints:44,time:'30-60 Minutes'},
    {id:'d2-t10',title:'IT Performance Monitoring and Reporting',knowledgePoints:12,time:'Less Than 15 Minutes'},
    {id:'d2-t11',title:'Quality Assurance and Quality Management of IT',knowledgePoints:22,time:'15-30 Minutes'}
  ]},
  {id:'d3',domain:'Domain 3',name:'Information Systems Acquisition, Development and Implementation',knowledgePoints:338,time:'60+ Minutes',weight:12,topics:[
    {id:'d3-t01',title:'Project Governance and Management',knowledgePoints:66,time:'60+ Minutes'},
    {id:'d3-t02',title:'Business Case and Feasibility Analysis',knowledgePoints:24,time:'15-30 Minutes'},
    {id:'d3-t03',title:'System Development Methodologies',knowledgePoints:58,time:'30-60 Minutes'},
    {id:'d3-t04',title:'Control Identification and Design',knowledgePoints:42,time:'30-60 Minutes'},
    {id:'d3-t05',title:'System Readiness and Implementation Testing',knowledgePoints:54,time:'30-60 Minutes'},
    {id:'d3-t06',title:'Implementation Configuration and Release Management',knowledgePoints:36,time:'30-60 Minutes'},
    {id:'d3-t07',title:'System Migration, Infrastructure Deployment, and Data Conversion',knowledgePoints:24,time:'15-30 Minutes'},
    {id:'d3-t08',title:'Postimplementation Review',knowledgePoints:34,time:'30-60 Minutes'}
  ]},
  {id:'d4',domain:'Domain 4',name:'Information Systems Operations and Business Resilience',knowledgePoints:522,time:'60+ Minutes',weight:26,topics:[
    {id:'d4-t01',title:'IT Components',knowledgePoints:18,time:'15-30 Minutes'},
    {id:'d4-t02',title:'IT Asset Management',knowledgePoints:14,time:'Less Than 15 Minutes'},
    {id:'d4-t03',title:'Job Scheduling and Production Process Automation',knowledgePoints:8,time:'Less Than 15 Minutes'},
    {id:'d4-t04',title:'System Interfaces',knowledgePoints:6,time:'Less Than 15 Minutes'},
    {id:'d4-t05',title:'End-user Computing and Shadow IT',knowledgePoints:6,time:'Less Than 15 Minutes'},
    {id:'d4-t06',title:'Systems Availability and Capacity Management',knowledgePoints:34,time:'30-60 Minutes'},
    {id:'d4-t07',title:'Problem and Incident Management',knowledgePoints:14,time:'Less Than 15 Minutes'},
    {id:'d4-t08',title:'IT Change, Configuration, and Patch Management',knowledgePoints:66,time:'60+ Minutes'},
    {id:'d4-t09',title:'Operational Log Management',knowledgePoints:18,time:'15-30 Minutes'},
    {id:'d4-t10',title:'IT Service Level Management',knowledgePoints:24,time:'15-30 Minutes'},
    {id:'d4-t11',title:'Database Management',knowledgePoints:64,time:'60+ Minutes'},
    {id:'d4-t12',title:'Business Impact Analysis',knowledgePoints:20,time:'15-30 Minutes'},
    {id:'d4-t13',title:'System and Operational Resilience',knowledgePoints:24,time:'15-30 Minutes'},
    {id:'d4-t14',title:'Data Backup, Storage, and Restoration',knowledgePoints:46,time:'30-60 Minutes'},
    {id:'d4-t15',title:'Business Continuity Plan',knowledgePoints:76,time:'60+ Minutes'},
    {id:'d4-t16',title:'Disaster Recovery Plans',knowledgePoints:84,time:'60+ Minutes'}
  ]},
  {id:'d5',domain:'Domain 5',name:'Protection of Information Assets',knowledgePoints:572,time:'60+ Minutes',weight:26,topics:[
    {id:'d5-t01',title:'Information Asset Security Policies, Frameworks, Standards, and Guidelines',knowledgePoints:26,time:'15-30 Minutes'},
    {id:'d5-t02',title:'Physical and Environmental Controls',knowledgePoints:26,time:'15-30 Minutes'},
    {id:'d5-t03',title:'Identity and Access Management',knowledgePoints:80,time:'60+ Minutes'},
    {id:'d5-t04',title:'Network and End-Point Security',knowledgePoints:92,time:'60+ Minutes'},
    {id:'d5-t05',title:'Data Loss Prevention',knowledgePoints:38,time:'30-60 Minutes'},
    {id:'d5-t06',title:'Data Encryption',knowledgePoints:64,time:'60+ Minutes'},
    {id:'d5-t07',title:'Public Key Infrastructure',knowledgePoints:24,time:'15-30 Minutes'},
    {id:'d5-t08',title:'Cloud and Virtualized Environments',knowledgePoints:20,time:'15-30 Minutes'},
    {id:'d5-t09',title:'Mobile, Wireless, and Internet-of-Things Devices',knowledgePoints:20,time:'15-30 Minutes'},
    {id:'d5-t10',title:'Security Awareness Training and Programs',knowledgePoints:12,time:'Less Than 15 Minutes'},
    {id:'d5-t11',title:'Information System Attack Methods and Techniques',knowledgePoints:60,time:'30-60 Minutes'},
    {id:'d5-t12',title:'Security Testing Tools and Techniques',knowledgePoints:24,time:'15-30 Minutes'},
    {id:'d5-t13',title:'Security Monitoring Logs, Tools, and Techniques',knowledgePoints:46,time:'30-60 Minutes'},
    {id:'d5-t14',title:'Security Incident Response Management',knowledgePoints:28,time:'15-30 Minutes'},
    {id:'d5-t15',title:'Evidence Collection and Forensics',knowledgePoints:12,time:'Less Than 15 Minutes'}
  ]},
  {id:'practice',domain:'Practice Exams',name:'Practice Exams',knowledgePoints:900,time:'60+ Minutes',weight:0,topics:[
    {id:'pe-1',title:'Practice Exam 1',knowledgePoints:300,time:'60+ Minutes'},
    {id:'pe-2',title:'Practice Exam 2',knowledgePoints:300,time:'60+ Minutes'},
    {id:'pe-3',title:'Practice Exam 3',knowledgePoints:300,time:'60+ Minutes'}
  ]}
];
