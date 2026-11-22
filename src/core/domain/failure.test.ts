import { AppError,errorMessage } from './failure';
it('exposes only explicitly safe messages',()=>{expect(errorMessage(new Error('secret-token'),'Retry')).toBe('Retry');expect(errorMessage({message:'database password'},'Retry')).toBe('Retry');expect(errorMessage(new AppError('conflict','Choose a version'))).toBe('Choose a version');});
