import { AppError } from '@/core/domain/failure';
export interface BattleSessionRepository {
 load(owner:string):Promise<string|null>;
 save(owner:string,roomId:string):Promise<void>;
 clear(owner:string):Promise<void>;
}

export function createBattleSessionUseCases(repository:BattleSessionRepository):BattleSessionRepository {
 const ownerId=(owner:string)=>{if(!owner.trim())throw new AppError('authentication','Đăng nhập lại để khôi phục phòng.');return owner;};
 return {load:owner=>repository.load(ownerId(owner)),save:(owner,id)=>{if(!id.trim())throw new AppError('validation','Phòng không hợp lệ.');return repository.save(ownerId(owner),id);},clear:owner=>repository.clear(ownerId(owner))};
}
