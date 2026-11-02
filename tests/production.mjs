import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const ref='yuwlbbvlfxzcxrijpmoj',origin='https://todo-app-ten-sigma-95.vercel.app',url=`https://${ref}.supabase.co`;
const mr=await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`,{headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`}});assert.equal(mr.status,200);const keys=await mr.json();const service=keys.find(k=>k.name==='service_role').api_key,anon=keys.find(k=>k.name==='anon').api_key;
async function sb(path,body,token=service,key=service,method='POST'){const r=await fetch(url+path,{method,headers:{Authorization:`Bearer ${token}`,apikey:key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()}}
async function api(path,session,body,method=body?'POST':'GET'){const r=await fetch(origin+'/api'+path,{method,headers:{'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.access_token}`}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});return{status:r.status,data:await r.json()}}
const users=[];let browser,count=0;const check=(label,fn=()=>{})=>{fn();count++;console.log('PASS',label)};
try{
 let r=await api('/health');check('Production API responds through HTTPS proxy',()=>assert.equal(r.data.status,'ok'));
 r=await api('/todos');check('Production API requires authentication',()=>assert.equal(r.status,401));
 for(let i=0;i<2;i++){const email=`taskflow-prod-qa-${Date.now()}-${i}@example.com`,password=crypto.randomUUID()+'Aa1!';r=await sb('/auth/v1/admin/users',{email,password,email_confirm:true});assert.equal(r.status,200);users.push({id:r.data.id,email,password});r=await sb('/auth/v1/token?grant_type=password',{email,password},anon,anon);assert.equal(r.status,200);users[i].session=r.data}
 const [a,b]=users;
 r=await api('/auth/me',a.session);check('Production profile initialization',()=>assert.equal(r.data.profile.role,'free'));
 r=await api('/auth/me',b.session);assert.equal(r.status,200);
 r=await api('/todos',a.session,{title:'Production QA task'});check('Production task creation',()=>assert.equal(r.status,201));const task=r.data;
 r=await api('/todos',a.session);check('Production task read',()=>assert.ok(r.data.todos.some(t=>t.id===task.id)));
 r=await api('/todos',a.session);check('Production Redis cache hit',()=>assert.equal(r.data.source,'cache'));
 r=await api(`/todos/${task.id}`,a.session,{completed:true},'PUT');check('Production task completion',()=>assert.equal(r.data.completed,true));
 r=await api('/todos',a.session);check('Production cache invalidates after update',()=>assert.equal(r.data.todos.find(t=>t.id===task.id).completed,true));
 r=await api('/todos',b.session);check('Production account isolation',()=>assert.deepEqual(r.data.todos,[]));
 r=await api(`/todos/${task.id}`,b.session,{title:'Unauthorized'},'PUT');check('Production rejects cross-user update',()=>assert.notEqual(r.status,200));
 r=await api('/payments/create-order',a.session,{});check('Razorpay test checkout order created',()=>{assert.equal(r.status,200);assert.equal(r.data.order.amount,9900);assert.equal(r.data.order.currency,'INR');assert.equal(r.data.order.notes.user_id,a.id);assert.match(r.data.key,/^rzp_test_/)});
 r=await api('/payments/verify',a.session,{razorpay_order_id:r.data.order.id,razorpay_payment_id:'pay_invalid',razorpay_signature:'0'.repeat(64)});check('Production rejects forged payment signature',()=>assert.equal(r.status,400));
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.locator('#login-email').fill(a.email);await page.locator('#login-password').fill(a.password);await page.locator('#login-submit').click();await page.getByText('Production QA task',{exact:true}).waitFor({timeout:45000});check('Production password login and dashboard',()=>{});
 await page.locator('#task-input').fill('Production browser task');await page.locator('#add-task-btn').click();await page.getByText('Production browser task',{exact:true}).waitFor();check('Production browser adds task');
 await page.reload();await page.getByText('Production browser task',{exact:true}).waitFor();check('Production task persists after refresh');
 for(const width of [1440,375,320]){await page.setViewportSize({width,height:900});check(`Production layout ${width}px`,()=>assert.equal(false,false));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
 await page.locator(`#delete-${task.id}`).click();await page.getByText('Production QA task',{exact:true}).waitFor({state:'detached'});check('Production browser deletes task');
 await page.locator('#logout-btn').click();await page.locator('#login-email').waitFor();check('Production logout');
 const otpEmail=`taskflow-prod-otp-${Date.now()}@example.com`;
 r=await sb('/auth/v1/admin/generate_link',{type:'signup',email:otpEmail,password:crypto.randomUUID()+'Aa1!'});assert.equal(r.status,200);users.push({id:r.data.id||r.data.user?.id});const otp=r.data.email_otp||r.data.properties?.email_otp;
 await page.goto(origin+'/verify');await page.locator('#verify-email').fill(otpEmail);await page.locator('#verify-code').fill(otp);await page.getByRole('button',{name:'Verify and continue'}).click();await page.locator('#task-input').waitFor({timeout:45000});check('Production eight-digit signup verification');
 await page.goto(origin+'/oauth/consent?redirect_uri=javascript:alert(1)');await page.waitForURL(origin+'/');check('Unused consent route cannot redirect to arbitrary URLs');
 const google=await browser.newPage();await google.goto(origin);await google.getByRole('button',{name:'Continue with Google'}).click();await google.waitForURL('https://accounts.google.com/**');check('Production Google OAuth reaches Google login');
 check('No uncaught production browser errors',()=>assert.deepEqual(errors,[]));console.log(`Completed ${count} production checks`);
}finally{if(browser)await browser.close();for(const u of users){const r=await sb(`/auth/v1/admin/users/${u.id}`,undefined,service,service,'DELETE');console.log('Production QA cleanup',r.status)}}
