// Mutating acceptance scenario restricted to the dedicated Docker verification instance.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const base='http://localhost:4320/api';
const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:(await readFile(process.env.LOGIN_PASSWORD_FILE||'.login-secret','utf8')).trim()})});
assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});assert.ok(r.ok,await r.clone().text());return r.json()}
const initial=await api('/state');assert.ok(!initial.sessions.length,'Do not interrupt another session');
const t=await api('/tasks','POST',{title:'v0.2 Docker pause recovery',subject_id:initial.subjects[0].id,estimated:60,is_review:false,subtasks:['甲','乙']});
const act=action=>api(`/tasks/${t.id}/action`,'POST',{action});
await api(`/tasks/${t.id}/reminder`,'PUT',{due_at:new Date(Date.now()+86400000).toISOString()});await act('start');await act('pause');
let before=await api('/state');await api('/subtasks/'+before.subtasks.find(s=>s.task_id===t.id).id,'PATCH',{completed:true});before=await api('/state');delete before.now;
execFileSync('docker-compose',['-p','dse-study-studio-v02-verify','-f','compose.yaml','-f','compose.verify.yaml','restart'],{env:process.env,stdio:'pipe'});
let after;for(let n=0;n<100;n++){try{after=await api('/state');break}catch{await new Promise(r=>setTimeout(r,200))}}
assert.ok(after);delete after.now;assert.deepEqual(after,before);await act('resume');await act('stop');
const events=await api('/history/tasks?task='+t.id);assert.equal(events.items.filter(e=>e.kind==='SESSION_STARTED').length,1);assert.equal(events.items.filter(e=>e.kind==='SESSION_STOPPED').length,1);
await writeFile(process.env.RESULT_FILE||'artifacts/session-recovery.json',JSON.stringify({status:'PASS',at:new Date().toISOString(),taskId:t.id,assertions:['Paused session, partial subtask, pending reminder and auth session survive Docker/PostgreSQL restart','Resume and stop produce one start/stop event']},null,2));
console.log('Docker paused-session, authentication and pending-reminder recovery: PASS');
