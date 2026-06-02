export const RESOURCE_LINKS = {
  qae: "https://www.isaca.org/myisaca/learnings",
  youtubePlaylist: "https://youtube.com/playlist?list=PL7XJSuT7Dq_UvA2knww9Rlzz2JHUpeOAb&si=24LkSCqxPR3-Qixd",
  isacaCisa: "https://www.isaca.org/credentialing/cisa",
  isacaOutline: "docs/CISA_Exam_Outline_ControlQuest.docx",
  quizlet: "https://quizlet.com/",
  goodnotes: "https://web.goodnotes.com/"
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
  {id:'watch20',title:'Watch 20 Minutes Of Video',details:'Use the selected Udemy/YouTube/ISACA module and write 3 takeaways.',xp:28,coins:10,type:'Video',links:[{label:'Open YouTube Playlist',url:RESOURCE_LINKS.youtubePlaylist},{label:'Open Notebook',go:'notebook'}]},
  {id:'mistake3',title:'Forge 3 Mistakes',details:'Take three missed questions and convert them into audit rules in Mistake Review.',xp:30,coins:12,type:'Review',links:[{label:'Open Practice Log',go:'practice'}]},
  {id:'voice2',title:'Record A 2-Minute Voice Memo',details:'Explain today’s concept like you are teaching a new staff. Summarize the CISA answer logic.',xp:20,coins:8,type:'Audio',links:[{label:'Open Notebook',go:'notebook'}]},
  {id:'flash15',title:'Quizlet 15-Minute Drill',details:'Study a Quizlet deck and log your score/comfort level in Study Tools.',xp:25,coins:10,type:'Flashcards',links:[{label:'Open Quizlet',url:RESOURCE_LINKS.quizlet},{label:'Open Study Tools',go:'tools'}]},
  {id:'map1',title:'Draw One Visual Map',details:'Create a simple flowchart or diagram for today’s topic and save a note about it.',xp:26,coins:10,type:'Visual',links:[{label:'Open Notebook',go:'notebook'}]},
  {id:'arcade',title:'Play One Arcade Round',details:'Use Arcade mode to test audit judgment in a low-pressure game.',xp:22,coins:9,type:'Game',links:[{label:'Open Study Tools',go:'tools'}]},
  {id:'teachback',title:'Teach-Back To Your Guild',details:'Write a concise teach-back note for the group explaining one concept and one trap.',xp:32,coins:13,type:'Guild',links:[{label:'Open Guild',go:'guild'},{label:'Open Notebook',go:'notebook'}]}
];

export const DAILY_QUEST_TEMPLATES = [
  {id:'daily-qae',title:'QAE Warm-Up',details:'Log at least 10 QAE questions or a focused practice block.',xp:30,coins:12,icon:'qae'},
  {id:'daily-learn',title:'Learn One Concept',details:'Complete one roadmap lesson or watch at least 15 minutes of lesson content.',xp:25,coins:10,icon:'roadmap'},
  {id:'daily-review',title:'Review And Retain',details:'Complete a mistake review, Quizlet review, or notebook teach-back.',xp:25,coins:10,icon:'notebook'}
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
  {id:'eyes-normal',type:'eyes',title:'Bright Eyes',value:'normal',cost:0,unlockLevel:1},
  {id:'eyes-star',type:'eyes',title:'Star Eyes',value:'star',cost:90,unlockLevel:4},
  {id:'eyes-focus',type:'eyes',title:'Focus Eyes',value:'focus',cost:80,unlockLevel:3},
  {id:'glasses-none',type:'glasses',title:'No Glasses',value:'none',cost:0,unlockLevel:1},
  {id:'glasses-round',type:'glasses',title:'Round Reviewer Glasses',value:'round',cost:80,unlockLevel:2},
  {id:'glasses-shield',type:'glasses',title:'Control Shield Glasses',value:'shield',cost:120,unlockLevel:4},
  {id:'cape-none',type:'cape',title:'No Cape',value:'none',cost:0,unlockLevel:1},
  {id:'cape-blue',type:'cape',title:'Blue Audit Cape',value:'blue',cost:120,unlockLevel:3},
  {id:'cape-gold',type:'cape',title:'Gold Assurance Cape',value:'gold',cost:220,unlockLevel:6},
  {id:'hat-none',type:'hat',title:'No Hat',value:'none',cost:0,unlockLevel:1},
  {id:'hat-grad',type:'hat',title:'Graduate Cap',value:'grad',cost:140,unlockLevel:5},
  {id:'hat-crown',type:'hat',title:'Control Crown',value:'crown',cost:250,unlockLevel:8},
  {id:'badge-none',type:'badge',title:'No Badge',value:'none',cost:0,unlockLevel:1},
  {id:'badge-cisa',type:'badge',title:'CISA Trainee Badge',value:'cisa',cost:110,unlockLevel:4},
  {id:'badge-fire',type:'badge',title:'Streak Flame Badge',value:'fire',cost:160,unlockLevel:7}
];

export const GAME_CATALOG = [
  {id:'avatarSprint',title:'Avatar Sprint',details:'Race your avatar by answering audit judgment prompts. Great for quick warm-ups.',xp:22,coins:8,icon:'arcade'},
  {id:'riskRank',title:'Risk Rank Rally',details:'Rank scenarios by business risk and impact. Trains greatest-risk thinking.',xp:28,coins:10,icon:'target'},
  {id:'sequence',title:'Audit Sequence Builder',details:'Put audit actions in the right order. Trains FIRST and NEXT questions.',xp:30,coins:11,icon:'roadmap'},
  {id:'controlMatch',title:'Control Match Arena',details:'Match risks to the strongest control response.',xp:24,coins:9,icon:'qae'},
  {id:'duel',title:'Decision Duel',details:'Choose the CISA-best answer under time pressure.',xp:26,coins:10,icon:'timer'}
];
