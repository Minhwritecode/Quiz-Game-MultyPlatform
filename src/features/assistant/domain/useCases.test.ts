import { createAssistantUseCases } from './useCases';
import type { AssistantRepository } from './repository';
const ask=jest.fn().mockResolvedValue('Answer');
const repository:AssistantRepository={ask,load:jest.fn(),save:jest.fn(),sync:jest.fn(),markDeleted:jest.fn(),pickPdf:jest.fn(),pickDocument:jest.fn()};
beforeEach(()=>jest.clearAllMocks());
it('rejects invalid requests before reaching infrastructure',()=>{const service=createAssistantUseCases(repository);expect(()=>service.ask([],'/',undefined,new AbortController().signal)).toThrow();expect(ask).not.toHaveBeenCalled();});
it('runs through injected fake without importing Expo or Supabase',async()=>{const service=createAssistantUseCases(repository);await expect(service.ask([{role:'user',content:'Question'}],'/',undefined,new AbortController().signal)).resolves.toBe('Answer');expect(ask).toHaveBeenCalledTimes(1);});
it('does not invoke a cancelled request',()=>{const controller=new AbortController();controller.abort();expect(()=>createAssistantUseCases(repository).ask([{role:'user',content:'Question'}],'/',undefined,controller.signal)).toThrow('hủy');expect(ask).not.toHaveBeenCalled();});
