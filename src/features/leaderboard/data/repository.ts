import { supabase } from '@/core/network/supabase';
import { AppError } from '@/core/domain/failure';
import type { LeaderboardRepository } from '../domain/repository';
export const leaderboardRepository:LeaderboardRepository={async list(offset){
 if(!supabase)throw new AppError('unavailable','Chưa cấu hình bảng xếp hạng.');
 const result=await supabase.rpc('battle_leaderboard',{p_offset:offset});
 if(result.error)throw new AppError('unavailable','Không tải được bảng xếp hạng. Hãy thử lại.');
 return (result.data??[]).map((row:{rank:number;display_name:string;points:number;matches:number;is_me:boolean})=>({rank:Number(row.rank),displayName:row.display_name,points:Number(row.points),matches:Number(row.matches),isMe:row.is_me}));
}};
