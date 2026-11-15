import {spawnSync} from 'node:child_process';
const python=process.platform==='win32'?'python':'python3';
const r=spawnSync(python,['-B','-m','unittest','discover','-s','tests','-p','test_firestore_exporter.py'],{stdio:'inherit'});process.exit(r.status??1);
