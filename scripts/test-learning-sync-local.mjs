import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
// Credentials stay in memory and never appear in logs. Refuse any hosted target.
const raw=execFileSync(process.env.SUPABASE_CLI??'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const env=JSON.parse(raw);
assert.equal(new URL(env.API_URL).hostname,'127.0.0.1');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,options),users=[];
const check=({data,error})=>{if(error)throw new Error(error.message);return data;};
try {
 const email=`learning-${randomUUID()}@papyrus.test`,password=`${randomUUID()}Aa1!`;
 const user=check(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(user.id);
 const [a,b]=[0,1].map(()=>createClient(env.API_URL,env.ANON_KEY,options));
 for(const client of [a,b])check(await client.auth.signInWithPassword({email,password}));
 const otherEmail=`other-${randomUUID()}@papyrus.test`;
 users.push(check(await admin.auth.admin.createUser({email:otherEmail,password,email_confirm:true})).user.id);
 const outsider=createClient(env.API_URL,env.ANON_KEY,options);check(await outsider.auth.signInWithPassword({email:otherEmail,password}));
 const set={id:randomUUID(),title:'Study',subject:'Science',deleted:false,questions:[{id:randomUUID(),content:'Q?',options:['A','B','C','D'],correctIndex:0,explanation:'A',position:0}]};
 check(await a.rpc('sync_push_set',{mutation_id:randomUUID(),base_revision:'0',document:set}));
 assert.equal(check(await b.rpc('sync_pull_sets',{after_revision:'0'})).documents[0].id,set.id);
 const sourceId=randomUUID(),attemptId=randomUUID(),stamp=new Date().toISOString();
 const source={entity:'source_documents',id:sourceId,revision:'0',updatedAt:stamp,deleted:false,payload:{id:sourceId,title:'Notes',text:'Source body',createdAt:stamp}};
 const attempt={entity:'attempts',id:attemptId,revision:'0',updatedAt:stamp,deleted:false,payload:{id:attemptId,questionSetId:set.id,score:1,correctCount:1,total:1,startedAt:stamp,finishedAt:stamp,status:'completed',answers:[{questionId:set.questions[0].id,chosenIndex:0,isCorrect:true,timeMs:500}]}};
 for(const doc of [source,attempt]){
  const request={mutation_id:randomUUID(),base_revision:'0',entity:doc.entity,document:doc};
  const first=check(await a.rpc('sync_push_learning',request));
  assert.deepEqual(check(await a.rpc('sync_push_learning',request)),first);
 }
 const page=check(await b.rpc('sync_pull_learning',{after_revision:'0'}));
 assert.equal(page.documents.length,2);
 assert.deepEqual(page.documents.find(d=>d.id===attemptId).payload.answers,attempt.payload.answers);
 assert.equal(check(await outsider.rpc('sync_pull_learning',{after_revision:'0'})).documents.length,0);
 assert.ok((await outsider.rpc('sync_push_learning',{mutation_id:randomUUID(),base_revision:'0',entity:source.entity,document:source})).error);
 const server=page.documents.find(d=>d.id===sourceId);
 const replies=await Promise.all([a,b].map((client,i)=>client.rpc('sync_push_learning',{mutation_id:randomUUID(),base_revision:server.revision,entity:server.entity,document:{...server,payload:{...server.payload,title:`Device ${i}`}}})));
 assert.equal(replies.map(check).filter(r=>!r.conflict).length,1);
 const delta=check(await a.rpc('sync_pull_learning',{after_revision:page.cursor}));
 assert.equal(delta.documents.length,1);const newest=delta.documents[0];
 check(await a.rpc('sync_push_learning',{mutation_id:randomUUID(),base_revision:newest.revision,entity:newest.entity,document:{...newest,deleted:true}}));
 const tombstones=check(await b.rpc('sync_pull_learning',{after_revision:delta.cursor}));assert.equal(tombstones.documents[0].deleted,true);
 const anon=createClient(env.API_URL,env.ANON_KEY,options);assert.ok((await anon.rpc('sync_pull_learning',{})).error);
 console.log('PASS: two sessions, same set IDs, source/attempt/answers round trip, retry, concurrent conflict, account isolation, cursor and tombstone.');
} finally {for(const id of users)check(await admin.auth.admin.deleteUser(id));}
