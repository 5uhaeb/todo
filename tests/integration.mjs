import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
const ref = 'yuwlbbvlfxzcxrijpmoj';
const management = process.env.SUPABASE_ACCESS_TOKEN;
if (!management) throw new Error('SUPABASE_ACCESS_TOKEN required');
const apiUrl = `https://${ref}.supabase.co`;
async function managementCall(path, body) {
 const response = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, { method:body?'POST':'GET', headers:{Authorization:`Bearer ${management}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined });
 if(!response.ok) throw new Error(`Management ${path}: ${response.status}`);
 return response.json();
}
const keys = await managementCall('/api-keys');
const service = keys.find(k=>k.name==='service_role').api_key;
const anon = keys.find(k=>k.name==='anon').api_key;
async function sb(path,{method='GET',body,token=service,key=service}={}) {
 const r = await fetch(apiUrl+path,{method,headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined});
 const text=await r.text(); let data;try{data=JSON.parse(text)}catch{data=text}return {status:r.status,data};
}
let backend,frontend,browser; const users=[];let passed=0;
function check(name,fn){fn();passed++;console.log('PASS',name)}
async function request(path,session,{method='GET',body}={}) {
 const r=await fetch('http://127.0.0.1:5000/api'+path,{method,headers:{'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.access_token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};
}
async function wait(url){for(let i=0;i<60;i++){try{if((await fetch(url)).ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error('Server did not start')}
try {
 for(let i=0;i<2;i++) {
  const email=`taskflow-qa-${Date.now()}-${i}@example.com`; const password=crypto.randomUUID()+'Aa1!';
  const u=await sb('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});assert.equal(u.status,200);users.push(u.data.id);
  const login=await sb('/auth/v1/token?grant_type=password',{method:'POST',key:anon,token:anon,body:{email,password}});assert.equal(login.status,200);users[i]={id:u.data.id,session:login.data};
 }
 const env={...process.env,SUPABASE_URL:apiUrl,SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service,PORT:'5000',FRONTEND_URL:'http://127.0.0.1:5173',REDIS_URL:'redis://127.0.0.1:6399',RAZORPAY_KEY_ID:'',RAZORPAY_KEY_SECRET:''};delete env.SUPABASE_ACCESS_TOKEN;
 backend=spawn(process.execPath,['backend/src/index.js'],{env,stdio:'ignore'});await wait('http://127.0.0.1:5000/');
 const [a,b]=users.map(u=>u.session);
 let r=await request('/auth/me');check('API rejects unauthenticated access',()=>assert.equal(r.status,401));
 r=await request('/auth/me',a);check('First login creates free profile',()=>{assert.equal(r.status,200);assert.equal(r.data.profile.role,'free')});
 const concurrent=await Promise.all([request('/auth/me',b),request('/auth/me',b)]);check('Concurrent profile initialization succeeds',()=>assert.ok(concurrent.every(r=>r.status===200)));
 for (const migration of ['20261102_server_owned_writes.sql', '20261102_enforce_task_plan.sql']) {
   await managementCall('/database/query',{query:await readFile(`supabase/migrations/${migration}`,'utf8')});
 }
 r=await sb(`/rest/v1/profiles?id=eq.${users[0].id}`,{method:'PATCH',key:anon,token:a.access_token,body:{role:'premium'}});check('Database blocks self-upgrading premium',()=>assert.equal(r.status,403));
 r=await sb('/rest/v1/todos',{method:'POST',key:anon,token:a.access_token,body:{user_id:users[0].id,title:'bypass'}});check('Database blocks direct task quota bypass',()=>assert.equal(r.status,403));
 r=await request('/todos',a);check('Task listing works with Redis offline',()=>{assert.equal(r.status,200);assert.deepEqual(r.data.todos,[])});
 for(const body of [{title:12},{title:' '},{title:'test',priority:'urgent'}]){r=await request('/todos',a,{method:'POST',body});check('Rejects invalid task '+JSON.stringify(body),()=>assert.equal(r.status,400))}
 r=await request('/todos',a,{method:'POST',body:{title:'  QA task  ',priority:'low'}});const task=r.data;check('Create trims task title',()=>{assert.equal(r.status,201);assert.equal(task.title,'QA task')});
 r=await request('/todos',b);check('Other user cannot list task',()=>assert.equal(r.data.todos.length,0));
 r=await request(`/todos/${task.id}`,b,{method:'PUT',body:{completed:true}});check('Other user cannot update task',()=>assert.notEqual(r.status,200));
 r=await request(`/todos/${task.id}`,a,{method:'PUT',body:{completed:'yes'}});check('Rejects non-boolean completion',()=>assert.equal(r.status,400));
 r=await request(`/todos/${task.id}`,a,{method:'PUT',body:{completed:true}});check('Complete task',()=>{assert.equal(r.status,200);assert.equal(r.data.completed,true)});
 r=await request('/todos',a,{method:'POST',body:{title:'premium',priority:'high'}});check('Free user cannot create high priority',()=>assert.equal(r.status,403));
 for(let i=1;i<10;i++) assert.equal((await request('/todos',a,{method:'POST',body:{title:`Quota ${i}`}})).status,201);
 r=await request('/todos',a,{method:'POST',body:{title:'eleventh'}});check('Free account limited to ten tasks',()=>assert.equal(r.status,403));
 const simultaneous = await Promise.all(Array.from({length:15},(_,i)=>request('/todos',b,{method:'POST',body:{title:`Concurrent ${i}`}})));
 check('Concurrent requests cannot exceed task quota',()=>assert.equal(simultaneous.filter(r=>r.status===201).length,10));
 r=await request('/payments/create-order',a,{method:'POST',body:{}});check('Missing payment configuration returns 503 without crashing',()=>assert.equal(r.status,503));
 frontend=spawn(process.execPath,['frontend/node_modules/vite/bin/vite.js','frontend','--host','127.0.0.1','--port','5173'],{env:{...env,VITE_SUPABASE_URL:apiUrl,VITE_SUPABASE_ANON_KEY:anon,VITE_API_URL:'/api',VITE_ENABLE_LOCAL_MFA:'false'},stdio:'ignore'});await wait('http://127.0.0.1:5173');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${ref}-auth-token`,session:a});
 await page.goto('http://127.0.0.1:5173/dashboard');await page.getByText('QA task',{exact:true}).waitFor();check('Dashboard renders real tasks and profile',()=>assert.equal(errors.length,0));
 for(const width of [1440,375,320]) {await page.setViewportSize({width,height:900});check(`Dashboard fits ${width}px`,()=>{});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
 await page.locator(`#delete-${task.id}`).click();await page.getByText('QA task',{exact:true}).waitFor({state:'detached'});check('Browser deletes task',()=>{});
 await page.locator('#task-input').fill('Browser-created task');await page.locator('#add-task-btn').click();await page.getByText('Browser-created task',{exact:true}).waitFor();check('Browser creates task',()=>{});
 await page.reload();await page.getByText('Browser-created task',{exact:true}).waitFor();check('Task persists after reload',()=>{});
 await page.locator('#logout-btn').click();await page.locator('#login-email').waitFor();check('Browser logout returns to sign-in',()=>{});
 const callback = await browser.newPage();
 await callback.goto('http://127.0.0.1:5173/auth/callback#error=access_denied&error_description=Consent%20declined');
 await callback.getByText('Consent declined',{exact:true}).waitFor();check('OAuth hash errors displayed',()=>{});
 await callback.close();
 const signupEmail=`taskflow-otp-${Date.now()}@example.com`;
 const signup=await sb('/auth/v1/admin/generate_link',{method:'POST',body:{type:'signup',email:signupEmail,password:crypto.randomUUID()+'Aa1!'}});
 assert.equal(signup.status,200);users.push({id:(signup.data.user?.id || signup.data.id)});
 const otp=signup.data.email_otp || signup.data.properties?.email_otp;
 check('Supabase generates eight-digit signup code',()=>assert.equal(otp.length,8));
 const otpPage=await browser.newPage();
 await otpPage.goto('http://127.0.0.1:5173/verify');
 await otpPage.locator('#verify-email').fill(signupEmail);await otpPage.locator('#verify-code').fill(otp);
 await otpPage.getByRole('button',{name:'Verify and continue'}).click();await otpPage.locator('#task-input').waitFor();
 check('Email OTP creates session and loads dashboard',()=>{});await otpPage.close();
 check('No uncaught browser exceptions' ,()=>assert.deepEqual(errors,[]));
 console.log(`Completed ${passed} checks`);
} finally {
 if(browser)await browser.close();backend?.kill();frontend?.kill();
 for(const u of users){const id=typeof u==='string'?u:u.id;const result=await sb(`/auth/v1/admin/users/${id}`,{method:'DELETE'});console.log('QA user cleanup',result.status)}
}
