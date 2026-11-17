import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const cli=process.env.SUPABASE_CLI || 'supabase';
const env=JSON.parse(execFileSync(cli,['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(new URL(env.API_URL).hostname,'127.0.0.1','Never run destructive fixture tests on hosted projects');
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,opts),users=[];
const check=({data,error})=>{if(error)throw new Error(error.message);return data;};
const call=(name,token,body)=>fetch(`${env.API_URL}/functions/v1/${name}`,{
  method:'POST',headers:{'Content-Type':'application/json',apikey:env.ANON_KEY,Authorization:`Bearer ${token}`},body:typeof body==='string'?body:JSON.stringify(body),
});
try {
  const tokens=[];
  for(let i=0;i<2;i++) {
    const email=`release-${randomUUID()}@papyrus.test`,password=randomUUID()+'Aa1!';
    const {user}=check(await admin.auth.admin.createUser({email,password,email_confirm:true}));users.push(user.id);
    const client=createClient(env.API_URL,env.ANON_KEY,opts);
    tokens.push(check(await client.auth.signInWithPassword({email,password})).session.access_token);
  }
  assert.equal((await call('delete-account',env.ANON_KEY,{confirmation:'DELETE'})).status,401);
  assert.equal((await call('delete-account',tokens[0],{confirmation:'NO'})).status,400);
  assert.equal((await call('generate-questions',tokens[0],'{bad json')).status,400);
  assert.equal((await call('generate-questions',tokens[0],{source_text:55,question_count:2,difficulty:'easy',language:'vi'})).status,400);
  assert.equal((await call('generate-questions',tokens[0],{source_text:'notes',question_count:2.5,difficulty:'easy',language:'vi'})).status,400);
  // A supplied target ID must never authorize deleting someone else.
  const removed=await call('delete-account',tokens[0],{confirmation:'DELETE',user_id:users[1]});
  assert.equal(removed.status,200,await removed.text());
  assert.ok((await admin.auth.admin.getUserById(users[0])).error);
  assert.equal(check(await admin.auth.admin.getUserById(users[1])).user.id,users[1]);
  assert.equal((await call('delete-account',tokens[0],{confirmation:'DELETE'})).status,401);
  assert.equal((await call('generate-questions',tokens[0],{})).status,401,'Deleted user cannot spend AI quota with old JWT');
  console.log('PASS: local deletion subject isolation, stale JWT rejection and AI input validation (no provider calls).');
} finally {
  for(const id of users)await admin.auth.admin.deleteUser(id);
}
