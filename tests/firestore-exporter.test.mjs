import {spawnSync} from 'node:child_process';
const r=spawnSync('python3',['-B','-m','unittest','discover','-s','tests','-p','test_firestore_exporter.py'],{stdio:'inherit'});process.exit(r.status??1);
