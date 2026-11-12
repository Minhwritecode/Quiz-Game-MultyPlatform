import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { corsHeaders } from '../_shared/cors.ts';

const json = (status: number, body: object) => new Response(JSON.stringify(body), {status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async request => {
  if(request.method === 'OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(request.method !== 'POST')return json(405,{error:'Method not allowed'});
  const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token)return json(401,{error:'Sign in again to delete your account.'});
  try {
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    // Resolve the subject from a verified Auth response, never from request JSON.
    const {data,error}=await admin.auth.getUser(token);
    if(error || !data.user)return json(401,{error:'Sign in again to delete your account.'});
    const body=await request.json().catch(()=>null);
    if(body?.confirmation !== 'DELETE')return json(400,{error:'Explicit deletion confirmation is required.'});
    const removed=await admin.auth.admin.deleteUser(data.user.id);
    if(removed.error)return json(503,{error:'Account deletion could not complete. Please retry or contact support.'});
    return json(200,{deleted:true});
  } catch { return json(503,{error:'Account deletion is temporarily unavailable.'}); }
});
