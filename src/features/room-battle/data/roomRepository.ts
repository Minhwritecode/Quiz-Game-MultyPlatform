import { supabase } from '@/core/network/supabase';
import type { RoomRecord, RoomRepository } from '../domain/repository';
import { battleSchema } from '../domain/battle';

type RoomRow = {
  id: string;
  code: string;
  host_id: string;
  set_id: string;
  mode: RoomRecord['mode'];
  status: RoomRecord['status'];
  question_count: number;
  seconds_per_question: number;
  max_players?: number;
  started_at: string | null;
  created_at: string;
};

function mapRoom(row: RoomRow): RoomRecord {
  return {
    id: row.id,
    code: row.code,
    hostId: row.host_id,
    setId: row.set_id,
    mode: row.mode,
    status: row.status,
    questionCount: row.question_count,
    secondsPerQuestion: row.seconds_per_question,
    maxPlayers: row.max_players ?? 4,
    startedAt: row.started_at,
    createdAt: row.created_at,
  };
}

function firstRow(data: unknown): RoomRow {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') throw new Error('Room response was empty.');
  return row as RoomRow;
}

export const isRoomBackendConfigured = Boolean(supabase);

async function rpc(name: string, args: Record<string, unknown>) {
  if (!supabase) throw new Error('Sign in to a configured server first.');
  const {data,error}=await supabase.rpc(name,args);
  if(error) throw new Error(error.message);
  return data as unknown;
}

export const battleRepository = {
  async sets() {
    if(!supabase) throw new Error('Server is not configured.');
    const {data:user,error:authError}=await supabase.auth.getUser();
    if(authError || !user.user) throw new Error('Sign in to play online.');
    const {data,error}=await supabase.from('question_sets').select('id,title').eq('owner_id',user.user.id).eq('is_deleted',false);
    if(error) throw new Error(error.message);
    return (data ?? []) as {id:string;title:string}[];
  },
  async snapshot(id:string) {return battleSchema.parse(await rpc('battle_snapshot',{target:id}));},
  async start(id:string) {await rpc('battle_start',{target:id});},
  async heartbeat(id:string,ready?:boolean) {await rpc('battle_heartbeat',{target:id,p_ready:ready??null});},
  async leave(id:string) {await rpc('battle_leave',{target:id});},
  async answer(id:string,position:number,index:number) {await rpc('submit_answer',{p_room_id:id,p_position:position,p_chosen_index:index});},
  async sendReaction(id:string,emoji:string) {await rpc('send_room_reaction',{p_room_id:id,p_emoji:emoji});},
  async updateSettings(id:string,settings:{readTimeSec?:number;reactionsEnabled?:boolean}) {
    await rpc('update_room_settings',{
      p_room_id:id,
      p_read_time_sec:settings.readTimeSec??null,
      p_reactions_enabled:settings.reactionsEnabled??null,
    });
  },
  async kickPlayer(id:string,targetUserId:string) {await rpc('kick_room_player',{p_room_id:id,p_target_user_id:targetUserId});},
  subscribe(id:string,onChange:()=>void) {
    const client=supabase;
    if(!client) return ()=>undefined;
    const channel=client.channel(`battle-events:${id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'room_players',filter:`room_id=eq.${id}`},onChange)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'rooms',filter:`id=eq.${id}`},onChange).subscribe();
    return ()=>{void client.removeChannel(channel);};
  },
};

export const roomRepository: RoomRepository = {
  async create(input) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const clampedMax = Math.min(10, Math.max(2, input.maxPlayers ?? 4));
    const withMax = await supabase.rpc('create_room', {
      p_set_id: input.setId,
      p_question_count: input.questionCount,
      p_seconds_per_question: input.secondsPerQuestion,
      p_mode: input.mode,
      p_max_players: clampedMax,
    });
    if (!withMax.error) return mapRoom(firstRow(withMax.data));

    // Backward-compatible fallback if older 4-arg create_room RPC is deployed
    const legacy = await supabase.rpc('create_room', {
      p_set_id: input.setId,
      p_question_count: input.questionCount,
      p_seconds_per_question: input.secondsPerQuestion,
      p_mode: input.mode,
    });
    if (legacy.error) throw legacy.error;
    return mapRoom(firstRow(legacy.data));
  },
  async join(code) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.rpc('join_room', { p_code: code });
    if (error) throw error;
    return mapRoom(firstRow(data));
  },
  subscribe(roomId, onRoomChanged) {
    const client = supabase;
    if (!client) return () => undefined;
    const channel = client
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        onRoomChanged(mapRoom(payload.new as RoomRow));
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
