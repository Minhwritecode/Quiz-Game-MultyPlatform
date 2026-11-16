import { AppError } from '@/core/domain/failure';
export type Ranking = {rank:number;displayName:string;points:number;matches:number;isMe:boolean};
export interface LeaderboardRepository { list(offset:number):Promise<Ranking[]> }
export function createLeaderboardUseCases(repository:LeaderboardRepository) {
 return {list(offset:number) {if(!Number.isInteger(offset)||offset<0||offset>10000)throw new AppError('validation','Trang xếp hạng không hợp lệ.');return repository.list(offset);}};
}
