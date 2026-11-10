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
