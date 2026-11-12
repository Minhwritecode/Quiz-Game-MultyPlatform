import { z } from 'zod';
import type { QuestionSet } from '@/core/domain/models';

const question = z.object({id:z.string().uuid(),content:z.string().min(1),options:z.array(z.string().min(1)).length(4),correctIndex:z.number().int().min(0).max(3),explanation:z.string(),position:z.number().int().nonnegative()});
export const cloudSetSchema=z.object({id:z.string().uuid(),title:z.string(),subject:z.string(),questions:z.array(question),revision:z.string().regex(/^\d+$/),updatedAt:z.string(),deleted:z.boolean()});
export type CloudSet=z.infer<typeof cloudSetSchema>;
export type PendingSet={mutationId:string;baseRevision:string;document:CloudSet;failures:number;retryAt:number;conflict?:CloudSet};
export type CloudState={cursor:string;documents:CloudSet[];pending:PendingSet[];imports:Record<string,string>};
export const emptyCloudState=():CloudState=>({cursor:'0',documents:[],pending:[],imports:{}});
export interface CloudStore {load(owner:string):Promise<CloudState>;save(owner:string,state:CloudState):Promise<void>}
export interface CloudRemote {
 push(owner:string,item:PendingSet):Promise<{conflict:boolean;document:CloudSet}>;
 pull(owner:string,cursor:string):Promise<{documents:CloudSet[];cursor:string;hasMore:boolean}>;
}

// A persisted envelope holds the cloud copy and its outbox together.
export class CloudSets {
 private tail:Promise<unknown>=Promise.resolve();
 constructor(private store:CloudStore,private remote:CloudRemote,private uuid:()=>string,private now:()=>number=Date.now){}
 private exclusive<T>(fn:()=>Promise<T>):Promise<T>{const job=this.tail.then(fn,fn);this.tail=job.catch(()=>undefined);return job;}
 list(owner:string){return this.exclusive(()=>this.store.load(owner));}
 clearAccountCache(owner:string){return this.exclusive(()=>this.store.save(owner,emptyCloudState()));}
 import(owner:string,set:QuestionSet){return this.exclusive(async()=>{
   const state=await this.store.load(owner);
   const id=state.imports[set.id]??this.uuid();
   if(state.pending.some(p=>p.document.id===id))throw new Error('Sync or resolve the existing pending change first.');
   const existing=state.documents.find(d=>d.id===id);
   const document:CloudSet={...set,id,questions:set.questions.map((q,i)=>({...q,id:existing?.questions[i]?.id??this.uuid(),position:i})),revision:existing?.revision??'0',deleted:false};
   cloudSetSchema.parse(document);
   state.imports[set.id]=id;
   state.pending.push({mutationId:this.uuid(),baseRevision:document.revision,document,failures:0,retryAt:0});
   state.documents=[document,...state.documents.filter(d=>d.id!==id)];
   await this.store.save(owner,state);
 });}
 remove(owner:string,id:string){return this.exclusive(async()=>{
   const state=await this.store.load(owner),document=state.documents.find(d=>d.id===id);
   if(!document)throw new Error('Set not found.');
   if(state.pending.some(p=>p.document.id===id))throw new Error('Resolve the pending change first.');
   const deleted={...document,deleted:true};
   state.documents=state.documents.map(d=>d.id===id?deleted:d);
   state.pending.push({mutationId:this.uuid(),baseRevision:document.revision,document:deleted,failures:0,retryAt:0});
   await this.store.save(owner,state);
 });}
 resolve(owner:string,id:string,choice:'local'|'server'){return this.exclusive(async()=>{
   const state=await this.store.load(owner),item=state.pending.find(p=>p.document.id===id);
   if(!item?.conflict)throw new Error('No conflict to resolve.');
   state.pending=state.pending.filter(p=>p!==item);
   const document=choice==='server'?item.conflict:{...item.document,revision:item.conflict.revision};
   state.documents=[document,...state.documents.filter(d=>d.id!==id)];
   if(choice==='local')state.pending.push({mutationId:this.uuid(),baseRevision:item.conflict.revision,document,failures:0,retryAt:0});
   await this.store.save(owner,state);
 });}
 sync(owner:string){return this.exclusive(async()=>{
   const state=await this.store.load(owner);
   for(const item of [...state.pending]){
     if(item.conflict||item.retryAt>this.now())continue;
     let reply:Awaited<ReturnType<CloudRemote['push']>>;
     try{reply=await this.remote.push(owner,item);}
     catch(error){item.failures++;item.retryAt=this.now()+Math.min(60000,1000*2**Math.min(item.failures,6));await this.store.save(owner,state);throw error;}
     if(reply.conflict){item.conflict=reply.document;}
     else{state.pending=state.pending.filter(p=>p.mutationId!==item.mutationId);state.documents=[reply.document,...state.documents.filter(d=>d.id!==reply.document.id)];}
     await this.store.save(owner,state);
   }
   let more=true;
   while(more){
     const page=await this.remote.pull(owner,state.cursor);
     if(page.hasMore&&page.cursor===state.cursor)throw new Error('Server returned a non-advancing cursor.');
     for(const document of page.documents){
       if(!state.pending.some(p=>p.document.id===document.id))state.documents=[document,...state.documents.filter(d=>d.id!==document.id)];
     }
     state.cursor=page.cursor;more=page.hasMore;
     await this.store.save(owner,state);
   }
   return state;
 });}
}
