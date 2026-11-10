import {randomUUID} from 'expo-crypto';
import {z} from 'zod';
import {supabase} from '@/core/network/supabase';
import {CloudSets,cloudSetSchema,emptyCloudState,type CloudState} from '../domain/cloudSets';
import {readCloudState,writeCloudState} from './cloudStorage';

const storedSchema=z.object({cursor:z.string(),documents:z.array(cloudSetSchema),pending:z.array(z.object({mutationId:z.string().uuid(),baseRevision:z.string(),document:cloudSetSchema,failures:z.number(),retryAt:z.number(),conflict:cloudSetSchema.optional()})),imports:z.record(z.string(),z.string())});
async function rpc(owner:string,name:string,args:object):Promise<unknown>{
 if(!supabase)throw new Error('Server is not configured.');
 const {data,error}=await supabase.auth.getSession();
 if(error||data.session?.user.id!==owner)throw new Error('Sign in to the account that owns this queue.');
 // Capture this session token for the request; a concurrent account switch cannot rebind the owner.
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),15000);
 try {
 const response=await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${name}`,{
   signal:controller.signal,
   method:'POST',headers:{'Content-Type':'application/json',apikey:process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY??'',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(args),
 });
 if(!response.ok)throw new Error(`Sync request failed (${response.status}). Your pending changes remain on this device.`);
 return await response.json();
 } finally {clearTimeout(timeout);}
}
export const cloudSets=new CloudSets({
 async load(owner){const raw=await readCloudState(owner);return raw?storedSchema.parse(JSON.parse(raw)):emptyCloudState();},
 save(owner,state:CloudState){return writeCloudState(owner,JSON.stringify(state));},
},{
 async push(owner,item){return z.object({conflict:z.boolean(),document:cloudSetSchema}).parse(await rpc(owner,'sync_push_set',{mutation_id:item.mutationId,base_revision:item.baseRevision,document:item.document}));},
 async pull(owner,cursor){return z.object({documents:z.array(cloudSetSchema),cursor:z.string(),hasMore:z.boolean()}).parse(await rpc(owner,'sync_pull_sets',{after_revision:cursor}));},
},randomUUID);
