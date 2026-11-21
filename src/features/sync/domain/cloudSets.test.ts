import {CloudSets,emptyCloudState,type CloudState,type CloudRemote} from './cloudSets';
import type {QuestionSet} from '@/core/domain/models';
const set:QuestionSet={id:'legacy-set',title:'Notes',subject:'Science',updatedAt:'2026-11-11',syncStatus:'pending',questions:[{id:'legacy-q',content:'Q?',options:['A','B','C','D'],correctIndex:0,explanation:'A',position:0}]};
function setup(){
 let id=0,now=0;const disk=new Map<string,CloudState>();
 const clone=(value:CloudState):CloudState=>JSON.parse(JSON.stringify(value));
 const store={load:async(owner:string)=>clone(disk.get(owner)??emptyCloudState()),save:async(owner:string,state:CloudState)=>{disk.set(owner,clone(state));}};
 const remote:jest.Mocked<CloudRemote>={push:jest.fn(),pull:jest.fn().mockResolvedValue({documents:[],cursor:'0',hasMore:false})};
 const service=new CloudSets(store,remote,()=>`00000000-0000-4000-8000-${String(++id).padStart(12,'0')}`,()=>now);
 return {service,remote,store,restart:()=>new CloudSets(store,remote,()=>`00000000-0000-4000-8000-${String(++id).padStart(12,'0')}`,()=>now),tick:()=>{now=100000;}};
}
test('legacy import has new stable UUIDs and stays isolated by account',async()=>{
 const {service}=setup();await service.import('A',set);
 const a=await service.list('A');expect(a.pending).toHaveLength(1);expect(a.pending[0]?.document.id).not.toBe(set.id);
 expect((await service.list('B')).documents).toEqual([]);
 await expect(service.import('A',set)).rejects.toThrow('pending change');
});
test('failed request retains the same mutation across backoff and restart',async()=>{
 const {service,remote,tick,restart}=setup();await service.import('A',set);const first=(await service.list('A')).pending[0]!;
 remote.push.mockRejectedValueOnce(new Error('offline'));
 await expect(service.sync('A')).rejects.toThrow('offline');
 await service.sync('A');expect(remote.push).toHaveBeenCalledTimes(1);
 tick();remote.push.mockResolvedValue({conflict:false,document:{...first.document,revision:'1'}});
 await restart().sync('A');expect(remote.push.mock.calls[1]?.[1].mutationId).toBe(first.mutationId);
 expect((await service.list('A')).pending).toEqual([]);
});
test('server pull cannot overwrite a local conflict; resolution explicitly rebases it',async()=>{
 const {service,remote}=setup();await service.import('A',set);const pending=(await service.list('A')).pending[0]!;
 const server={...pending.document,title:'Other device',revision:'8'};
 remote.push.mockResolvedValue({conflict:true,document:server});remote.pull.mockResolvedValue({documents:[server],cursor:'8',hasMore:false});
 await service.sync('A');expect((await service.list('A')).documents[0]?.title).toBe('Notes');
 await service.resolve('A',server.id,'local');const next=(await service.list('A')).pending[0]!;
 expect(next.baseRevision).toBe('8');expect(next.mutationId).not.toBe(pending.mutationId);
});

const nativeSet:QuestionSet={...set,tags:[],sourceDocumentId:null,id:'10000000-0000-4000-8000-000000000001',questions:set.questions.map(q=>({...q,id:'20000000-0000-4000-8000-000000000001'}))};
test('subject tags and source identity round-trip through cloud document state',async()=>{
 const {service,remote}=setup();
 const sourceSet={...nativeSet,subject:'Biology',tags:['exam','chapter 2'],sourceDocumentId:'30000000-0000-4000-8000-000000000001'};
 await service.save('A',sourceSet);
 const pending=(await service.list('A')).pending[0]!;
 expect(pending.document).toMatchObject({subject:'Biology',tags:['exam','chapter 2'],sourceDocumentId:sourceSet.sourceDocumentId});
 remote.push.mockResolvedValue({conflict:false,document:{...pending.document,revision:'1'}});
 await service.sync('A');
 expect((await service.list('A')).documents[0]).toMatchObject({tags:['exam','chapter 2'],sourceDocumentId:sourceSet.sourceDocumentId});
});

test('native save keeps set and question IDs across saves without importing clones',async()=>{
 const {service,remote}=setup();
 await service.save('A',nativeSet);
 const first=(await service.list('A')).pending[0]!;
 expect(first.document.id).toBe(nativeSet.id);
 expect(first.document.questions.map(q=>q.id)).toEqual(nativeSet.questions.map(q=>q.id));
 remote.push.mockResolvedValue({conflict:false,document:{...first.document,revision:'4'}});
 await service.sync('A');
 await service.save('A',{...nativeSet,title:'Revised'});
 const state=await service.list('A');
 expect(state.documents).toHaveLength(1);
 expect(state.imports).toEqual({});
 expect(state.pending[0]).toMatchObject({baseRevision:'4',document:{id:nativeSet.id,title:'Revised'}});
 expect(state.pending[0]?.document.questions).toEqual(nativeSet.questions);
 expect((await service.list('B')).documents).toEqual([]);
});

test('offline saves coalesce and delete queues a tombstone using the original base',async()=>{
 const {service,remote}=setup();
 await service.save('A',nativeSet);
 const first=(await service.list('A')).pending[0]!;
 await service.save('A',{...nativeSet,title:'Offline edit'});
 const edit=(await service.list('A')).pending[0]!;
 expect(edit.mutationId).not.toBe(first.mutationId);
 expect(edit.baseRevision).toBe('0');
 await service.remove('A',nativeSet.id);
 const state=await service.list('A');
 expect(state.documents).toHaveLength(1);
 expect(state.pending).toHaveLength(1);
 expect(state.pending[0]).toMatchObject({baseRevision:'0',document:{id:nativeSet.id,title:'Offline edit',deleted:true}});
 expect(state.pending[0]?.mutationId).not.toBe(edit.mutationId);
 const deleted={...state.pending[0]!.document,revision:'2'};
 remote.push.mockResolvedValue({conflict:false,document:deleted});
 remote.pull.mockResolvedValue({documents:[deleted],cursor:'2',hasMore:false});
 await service.sync('A');
 expect((await service.list('A')).documents).toEqual([deleted]);
 expect((await service.list('A')).pending).toEqual([]);
});

test('crash during acknowledgement preserves the exact mutation for restart replay',async()=>{
 const {service,remote,store,restart}=setup();
 await service.save('A',nativeSet);
 const before=await service.list('A'),original=before.pending[0]!;
 remote.push.mockResolvedValue({conflict:false,document:{...original.document,revision:'3'}});
 jest.spyOn(store,'save').mockRejectedValueOnce(new Error('disk full'));
 await expect(service.sync('A')).rejects.toThrow('disk full');
 expect(remote.pull).not.toHaveBeenCalled();
 expect(await service.list('A')).toEqual(before);
 await restart().sync('A');
 expect(remote.push.mock.calls.map(([,item])=>item)).toEqual([original,original]);
 expect((await service.list('A')).pending).toEqual([]);
 expect((await service.list('A')).documents[0]?.revision).toBe('3');
});

test('edit after a lost commit response retains old base and surfaces conflict without overwriting local',async()=>{
 const {service,remote}=setup();
 await service.save('A',nativeSet);
 const original=(await service.list('A')).pending[0]!;
 remote.push.mockRejectedValueOnce(new Error('response lost after commit'));
 await expect(service.sync('A')).rejects.toThrow();
 await service.save('A',{...nativeSet,title:'Latest local'});
 const next=(await service.list('A')).pending[0]!;
 expect(next.mutationId).not.toBe(original.mutationId);
 expect(next.baseRevision).toBe(original.baseRevision);
 const server={...original.document,revision:'1'};
 remote.push.mockResolvedValue({conflict:true,document:server});
 remote.pull.mockResolvedValue({documents:[server],cursor:'1',hasMore:false});
 await service.sync('A');
 const conflicted=await service.list('A');
 expect(conflicted.documents[0]?.title).toBe('Latest local');
 expect(conflicted.pending[0]?.conflict).toEqual(server);
 await expect(service.save('A',nativeSet)).rejects.toMatchObject({code:'conflict'});
 await expect(service.remove('A',nativeSet.id)).rejects.toMatchObject({code:'conflict'});
 expect(await service.list('A')).toEqual(conflicted);
});

test.each([{cursor:'9',hasMore:false},{cursor:'10',hasMore:true}])('cursor %j cannot replace the durable state',async page=>{
 const {service,remote,store}=setup();
 const before={...emptyCloudState(),cursor:'10'};
 await store.save('A',before);
 remote.pull.mockResolvedValue({...page,documents:[{id:nativeSet.id,title:nativeSet.title,subject:nativeSet.subject,tags:[],sourceDocumentId:null,questions:nativeSet.questions,revision:'11',updatedAt:nativeSet.updatedAt,deleted:true}]});
 await expect(service.sync('A')).rejects.toThrow('cursor');
 expect(await service.list('A')).toEqual(before);
});
