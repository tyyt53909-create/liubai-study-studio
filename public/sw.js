self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
let serial=Promise.resolve();
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('study-reminder-receipts',1);r.onupgradeneeded=()=>r.result.createObjectStore('receipts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function receipt(id,write=false){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('receipts',write?'readwrite':'readonly'),store=tx.objectStore('receipts');const request=write?store.put(true,id):store.get(id);tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error)})}finally{db.close()}}
async function call(path,data){const r=await fetch('/api'+path,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw new Error('Delivery not authorized or no longer valid');return r.json()}
async function deliver(data){
 if(!data?.id||!data?.claimToken)return;
 const r=await call('/reminders/'+data.id+'/validate',{claimToken:data.claimToken});
 const shown=await receipt(data.id);
 const existing=await self.registration.getNotifications({tag:'study-'+data.id});
 if(!shown&&!existing.length){
  await self.registration.showNotification('讀書提醒 · '+r.title,{body:'你設定的學習時間到了。準備好時再開始。',tag:'study-'+data.id,renotify:false,icon:'/icon-192.png',data:{taskId:r.task_id}});
 }
 await receipt(data.id,true);
 await call('/reminders/'+data.id+'/ack',{claimToken:data.claimToken});
}
function enqueue(data){const work=serial.then(()=>deliver(data));serial=work.catch(()=>{});return serial}
self.addEventListener('push',event=>{if(event.data)event.waitUntil(enqueue(event.data.json()))});
self.addEventListener('message',event=>{if(event.data?.type==='REMINDER')event.waitUntil(enqueue(event.data.data))});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const taskId=event.notification.data?.taskId;
 const url=new URL('/',self.location.origin);if(taskId)url.searchParams.set('task',taskId);
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const client=clients.find(c=>new URL(c.url).origin===self.location.origin);if(client){await client.navigate(url.href);return client.focus()}return self.clients.openWindow(url.href)}));
});
