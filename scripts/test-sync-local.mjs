import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const env=JSON.parse(execFileSync('npx',['--offline','supabase','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(new URL(env.API_URL).hostname,'127.0.0.1');
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,opts),users=[],clients=[];
const check=({data,error})=>{if(error)throw new Error(error.message);return data;};
try {
 for(let i=0;i<2;i++){
  const email=`sync-${randomUUID()}@papyrus.test`,password=randomUUID()+'Aa1!';
  const {user}=check(await admin.auth.admin.createUser({email,password,email_confirm:true}));users.push(user.id);
  const client=createClient(env.API_URL,env.ANON_KEY,opts);check(await client.auth.signInWithPassword({email,password}));clients.push(client);
 }
 const doc={id:randomUUID(),title:'Offline set',subject:'Test',deleted:false,questions:[{id:randomUUID(),content:'Q?',options:['A','B','C','D'],correctIndex:0,explanation:'A',position:0}]};
 const req={mutation_id:randomUUID(),base_revision:'0',document:doc};
 const first=check(await clients[0].rpc('sync_push_set',req));
 assert.equal(first.conflict,false);
 assert.deepEqual(check(await clients[0].rpc('sync_push_set',req)),first,'retry must return original receipt');
 assert.ok((await clients[0].rpc('sync_push_set',{...req,document:{...doc,title:'Changed retry'}})).error);
 assert.ok((await clients[1].rpc('sync_push_set',{...req,mutation_id:randomUUID()})).error,'outsider overwrite denied');
 assert.equal(check(await clients[1].rpc('sync_pull_sets',{after_revision:'0'})).documents.length,0);
 assert.equal(check(await clients[0].rpc('sync_push_set',{...req,mutation_id:randomUUID(),document:{...doc,title:'Stale'}})).conflict,true);
 const concurrent=await Promise.all(['Writer A','Writer B'].map(title=>clients[0].rpc('sync_push_set',{mutation_id:randomUUID(),base_revision:first.document.revision,document:{...doc,title}})));
 assert.equal(concurrent.map(check).filter(r=>!r.conflict).length,1,'only one concurrent writer wins');
 const page=check(await clients[0].rpc('sync_pull_sets',{after_revision:'0'}));assert.equal(page.documents.length,1);
 assert.equal(check(await clients[0].rpc('sync_pull_sets',{after_revision:page.cursor})).documents.length,0);
 const invalid=await clients[0].rpc('sync_push_set',{mutation_id:randomUUID(),base_revision:page.documents[0].revision,document:{...doc,questions:[{...doc.questions[0],correctIndex:0.5}]}});
 assert.ok(invalid.error,'fractional answer index rejected');
 assert.equal(check(await clients[0].rpc('sync_pull_sets',{after_revision:page.cursor})).documents.length,0,'invalid transaction did not advance state');
 check(await clients[0].rpc('sync_push_set',{mutation_id:randomUUID(),base_revision:page.documents[0].revision,document:{...doc,deleted:true}}));
 assert.equal(check(await clients[0].rpc('sync_pull_sets',{after_revision:page.cursor})).documents[0].deleted,true);
 const anon=createClient(env.API_URL,env.ANON_KEY,opts);assert.ok((await anon.rpc('sync_pull_sets',{})).error);
 const shared={...doc,id:randomUUID(),questions:[{...doc.questions[0],id:randomUUID()}]};
 const creations=await Promise.all(clients.map(client=>client.rpc('sync_push_set',{mutation_id:randomUUID(),base_revision:'0',document:shared})));
 assert.equal(creations.filter(r=>!r.error).length,1,'different owners cannot claim the same new set');
 const questionId=randomUUID();
 const differentSets=await Promise.all(clients.map((client,i)=>client.rpc('sync_push_set',{mutation_id:randomUUID(),base_revision:'0',document:{...doc,id:randomUUID(),questions:[{...doc.questions[0],id:questionId,content:`Owner ${i}`}]}})));
 assert.equal(differentSets.filter(r=>!r.error).length,1,'concurrent cross-set question reuse must roll back');
 console.log('PASS: owner isolation, atomic validation, replay receipt, stale/concurrent conflict, cursor and tombstone.');
} finally {for(const id of users)check(await admin.auth.admin.deleteUser(id));}
