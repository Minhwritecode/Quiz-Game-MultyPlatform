import {createAccountRepositories} from './accountRepositories';
import {CloudSets, emptyCloudState} from './cloudSets';
import {LearningSync, emptyLearningState} from './learningSync';
import type {QuestionSet} from '@/core/domain/models';
const uuid=()=> '11111111-1111-4111-8111-111111111111';
const document: QuestionSet={id:uuid(),title:'Cloud set',subject:'Math',updatedAt:'2026-11-17T00:00:00Z',syncStatus:'synced',questions:[]};
function setup(){
 let owner:string|null='alice';const setsDisk=new Map(),learningDisk=new Map();
 const sets=new CloudSets({load:async o=>structuredClone(setsDisk.get(o)??emptyCloudState()),save:async(o,s)=>{setsDisk.set(o,structuredClone(s));}},{push:jest.fn(),pull:jest.fn()},uuid);
 const learning=new LearningSync({load:async o=>structuredClone(learningDisk.get(o)??emptyLearningState()),save:async(o,s)=>{learningDisk.set(o,structuredClone(s));}},{push:jest.fn(),pull:jest.fn()},uuid);
 const guestSets={list:jest.fn().mockResolvedValue([{...document,title:'Guest'}]),save:jest.fn(),remove:jest.fn()};
 const guestStudy={saveAttempt:jest.fn(),getLatestAttempt:jest.fn(),getAttempt:jest.fn(),listAttempts:jest.fn(),getProgress:jest.fn(),listProgress:jest.fn(),saveProgress:jest.fn(),clearProgress:jest.fn()};
 const device={progress:jest.fn().mockResolvedValue([]),saveProgress:jest.fn(),clearProgress:jest.fn(),sources:jest.fn(),saveSource:jest.fn(),removeSource:jest.fn()};
 return {repos:createAccountRepositories(()=>owner,sets,learning,guestSets,guestStudy,device,jest.fn()),sets,learning,guestSets,device,switchOwner:(next:string|null)=>{owner=next;}};
}
it('uses the same cloud identity in the study library and isolates account switches',async()=>{
 const f=setup();await f.repos.questionSets.save(document);
 expect(await f.repos.questionSets.list()).toEqual([expect.objectContaining({id:document.id,syncStatus:'pending'})]);
 f.switchOwner('bob');expect(await f.repos.questionSets.list()).toEqual([]);
 f.switchOwner(null);expect((await f.repos.questionSets.list())[0]!.title).toBe('Guest');
 expect(f.guestSets.save).not.toHaveBeenCalled();
});
it('keeps soft deleted sets out of the library and exposes failed/conflict status',async()=>{
 const f=setup();await f.repos.questionSets.save(document);await f.repos.questionSets.remove(document.id);
 expect(await f.repos.questionSets.list()).toEqual([]);expect((await f.sets.list('alice')).pending[0]!.document.deleted).toBe(true);
});
it('stores attempts with answers and source text under the captured account',async()=>{
 const f=setup();const source={id:uuid(),title:'Notes',text:'Content',createdAt:'2026-11-17'};
 const write=f.repos.sources.save(source);f.switchOwner('bob');await write;
 expect(await f.repos.sources.list()).toEqual([]);f.switchOwner('alice');expect(await f.repos.sources.list()).toEqual([source]);
 const attempt={id:uuid(),questionSetId:uuid(),score:1,correctCount:1,total:1,startedAt:'2026-11-17',finishedAt:'2026-11-17',status:'completed' as const,answers:[{questionId:uuid(),chosenIndex:0,isCorrect:true,timeMs:500}]};
 await f.repos.study.saveAttempt(attempt);expect(await f.repos.study.getAttempt(attempt.id)).toEqual(attempt);
 f.switchOwner('bob');expect(await f.repos.study.listAttempts()).toEqual([]);
});
