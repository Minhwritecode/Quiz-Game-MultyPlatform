import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Keys stay in memory and this harness refuses any hosted URL.
const config=JSON.parse(execFileSync('npx',['--offline','supabase','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(new URL(config.API_URL).hostname,'127.0.0.1');
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,opts);
const clients=[],ids=[];
let roomId,channel;
const check=({data,error})=>{if(error)throw new Error(error.message);return data;};
try {
  for(let i=0;i<5;i++) {
    const email=`battle-${randomUUID()}@papyrus.test`,password=randomUUID()+'Aa1!';
    const {user}=check(await admin.auth.admin.createUser({email,password,email_confirm:true}));
    ids.push(user.id);
    const client=createClient(config.API_URL,config.ANON_KEY,opts);
    check(await client.auth.signInWithPassword({email,password}));clients.push(client);
  }
  const setId=randomUUID();
  check(await clients[0].from('question_sets').insert({id:setId,owner_id:ids[0],title:'Local battle smoke'}));
  check(await clients[0].from('questions').insert({id:randomUUID(),set_id:setId,content:'One plus one?',options:['2','3','4','5'],correct_index:0,explanation:'Two',position:0}));
  const [room]=check(await clients[0].rpc('create_room',{p_set_id:setId,p_question_count:1,p_seconds_per_question:5,p_mode:'speed'}));roomId=room.id;
  for(let i=1;i<4;i++)check(await clients[i].rpc('join_room',{p_code:room.code}));
  assert.ok((await clients[4].rpc('join_room',{p_code:room.code})).error,'fifth player must be denied');
  for(let i=0;i<4;i++)check(await clients[i].rpc('battle_heartbeat',{target:roomId,p_ready:true}));
  let realtimeEvents=0;
  channel=clients[1].channel(`smoke-${roomId}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'room_players',filter:`room_id=eq.${roomId}`},()=>realtimeEvents++);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Realtime subscribe timeout')),15000);channel.subscribe(state=>{if(state==='SUBSCRIBED'){clearTimeout(timer);resolve();}});});
  check(await clients[0].rpc('battle_start',{target:roomId}));
  assert.equal(check(await clients[1].rpc('battle_snapshot',{target:roomId})).phase,'countdown');
  await new Promise(r=>setTimeout(r,3300));
  const snapshot=check(await clients[1].rpc('battle_snapshot',{target:roomId}));
  assert.equal(snapshot.phase,'question_open');assert.equal(snapshot.question.correctIndex,undefined);assert.equal(snapshot.question.explanation,undefined);
  const retries=await Promise.all([0,1].map(()=>clients[1].rpc('submit_answer',{p_room_id:roomId,p_position:0,p_chosen_index:0})));
  assert.equal(check(retries[0]),check(retries[1]));
  check(await clients[0].rpc('submit_answer',{p_room_id:roomId,p_position:0,p_chosen_index:1}));
  assert.ok((await clients[4].rpc('battle_snapshot',{target:roomId})).error);
  await new Promise(r=>setTimeout(r,8200));
  const final=check(await clients[0].rpc('battle_snapshot',{target:roomId}));
  assert.equal(final.phase,'finished');assert.equal(final.players[0].userId,ids[1]);assert.equal(final.players[0].score,check(retries[0]));
  assert.ok(realtimeEvents>0,'second client receives database change event');
  console.log('PASS: four authenticated clients, fifth-seat rejection, Realtime delivery, concurrent retry, hidden answer and final ranking.');
} finally {
  if(channel)await clients[1].removeChannel(channel);
  if(roomId)check(await admin.from('rooms').delete().eq('id',roomId));
  for(const id of ids)check(await admin.auth.admin.deleteUser(id));
  for(const client of clients)await client.removeAllChannels();
}
