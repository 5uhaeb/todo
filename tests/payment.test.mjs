import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from '../backend/node_modules/express/index.js';
process.env.SUPABASE_URL='http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';
const {createPaymentRouter}=await import('../backend/src/routes/paymentRoutes.js');
const secret='test-secret';
const signature=crypto.createHmac('sha256',secret).update('order_1|pay_1').digest('hex');
async function fixture(overrides={}) {
 let writes=0,created;
 const order={amount:9900,currency:'INR',notes:{user_id:'alice'},...overrides.order};
 const payment={order_id:'order_1',amount:9900,currency:'INR',status:'captured',...overrides.payment};
 const gateway={orders:{create:async value=>{created=value;return{id:'order_1',...value}},fetch:async()=>order},payments:{fetch:async()=>payment}};
 const result = async () => overrides.dbFailure ? {error:{message:'database unavailable'}} : {data:{id:'alice'}};
 const db = { from() { return { update() {
   writes++;
   return { eq() { return { select() { return { maybeSingle: result }; } }; } };
 } }; } };

 const app=express();app.use(express.json());app.use(createPaymentRouter({gateway,db,secret,key:'test-key',authenticate:(req,res,next)=>{req.user={id:'alice'};next()}}));
 const server=app.listen(0);await new Promise(r=>server.once('listening',r));
 return {server,get writes(){return writes},get created(){return created},async request(path,body){const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:r.status,data:await r.json()}}};
}
const valid={razorpay_order_id:'order_1',razorpay_payment_id:'pay_1',razorpay_signature:signature};
test('checkout order binds price and owner server-side',async()=>{const f=await fixture();try{const r=await f.request('/create-order',{amount:1,user_id:'mallory'});assert.equal(r.status,200);assert.equal(f.created.amount,9900);assert.equal(f.created.notes.user_id,'alice')}finally{f.server.close()}});
for(const [name,body,overrides,status] of [
 ['missing fields',{}, {},400],
 ['wrong signature',{...valid,razorpay_signature:'0'.repeat(64)}, {},400],
 ['malformed signature',{...valid,razorpay_signature:'oops'}, {},400],
 ['another users order',valid,{order:{notes:{user_id:'bob'}}},400],
 ['uncaptured payment',valid,{payment:{status:'authorized'}},400],
 ['wrong order',valid,{payment:{order_id:'order_other'}},400],
 ['wrong amount',valid,{payment:{amount:100}},400],
 ['wrong currency',valid,{payment:{currency:'USD'}},400],
 ['database failure',valid,{dbFailure:true},500],
 ['captured owner payment',valid,{},200],
])test(`verification handles ${name}`,async()=>{const f=await fixture(overrides);try{const r=await f.request('/verify',body);assert.equal(r.status,status);if(status===400)assert.equal(f.writes,0);if(status===200)assert.equal(f.writes,1)}finally{f.server.close()}});
