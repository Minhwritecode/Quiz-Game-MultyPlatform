import * as Crypto from 'expo-crypto';
import { supabase } from '@/core/network/supabase';
import type { QuestionSet } from '@/core/domain/models';
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

/**
 * Generates a deterministic valid v4-shaped UUID scoped to (userId + rawKey)
 * so seed/local sets can be materialized per user via sync_push_set without cross-owner UUID collisions.
 */
function deterministicUserUuid(userId: string, rawKey: string): string {
  const input = `${userId}::${rawKey}`;
  const bytes = new Uint8Array(16);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
    bytes[i % 16] = (bytes[i % 16]! ^ ((h1 >>> ((i % 4) * 8)) & 0xff) ^ ((h2 >>> (((i + 1) % 4) * 8)) & 0xff)) & 0xff;
  }
  for (let j = 0; j < 16; j++) {
    h1 = Math.imul(h1 ^ (j * 31 + 17), 0x27d4eb2d) >>> 0;
    bytes[j] = (bytes[j]! ^ (h1 & 0xff)) & 0xff;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export const battleRepository = {
  async sets() {
    if (!supabase) return [];
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from('question_sets')
        .select('id,title')
        .eq('owner_id', uid)
        .eq('is_deleted', false);
      if (error) return [];
      return (data ?? []) as { id: string; title: string }[];
    } catch {
      return [];
    }
  },
  async ensureCloudSet(localSet: QuestionSet): Promise<string> {
    if (!supabase) throw new Error('Server is not configured.');
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) throw new Error('Sign in to host an online room.');

    // Check if already owned directly
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localSet.id);
    if (isUuid) {
      const existing = await supabase
        .from('question_sets')
        .select('id')
        .eq('id', localSet.id)
        .eq('owner_id', uid)
        .eq('is_deleted', false)
        .maybeSingle();
      if (existing.data?.id) return existing.data.id;
    }

    const mappedSetId = deterministicUserUuid(uid, localSet.id);
    const alreadyMapped = await supabase
      .from('question_sets')
      .select('id')
      .eq('id', mappedSetId)
      .eq('owner_id', uid)
      .eq('is_deleted', false)
      .maybeSingle();
    if (alreadyMapped.data?.id) return alreadyMapped.data.id;

    // Normalize questions to strict 4 distinct options so sync_push_set succeeds across any schema version
    const normalizedQuestions = localSet.questions.slice(0, 50).map((q, idx) => {
      const baseOpts = q.options.map((o) => o.trim()).filter(Boolean);
      const padded = [...baseOpts];
      const fillers = ['Phương án bổ sung A', 'Phương án bổ sung B', 'Phương án bổ sung C', 'Phương án bổ sung D'];
      let fi = 0;
      while (padded.length < 4) {
        const cand = fillers[fi % fillers.length]!;
        fi++;
        if (!padded.some((x) => x.toLowerCase() === cand.toLowerCase())) {
          padded.push(cand);
        } else {
          padded.push(`${cand} (${fi})`);
        }
      }
      const fourOpts = padded.slice(0, 4).map((opt, oi) => {
        const dup = padded.slice(0, oi).some((prev) => prev.toLowerCase() === opt.toLowerCase());
        return dup ? `${opt} [${oi + 1}]` : opt;
      });
      return {
        id: deterministicUserUuid(uid, `${localSet.id}::${q.id}::${idx}`),
        content: q.content.trim() || `Câu hỏi ${idx + 1}`,
        options: fourOpts,
        correctIndex: Math.max(0, Math.min(3, q.correctIndex)),
        explanation: q.explanation || '',
        position: idx,
      };
    });

    const pushRes = await supabase.rpc('sync_push_set', {
      mutation_id: Crypto.randomUUID(),
      base_revision: '0',
      document: {
        id: mappedSetId,
        title: localSet.title.slice(0, 190),
        subject: (localSet.subject || 'Đại học').slice(0, 80),
        deleted: false,
        questions: normalizedQuestions,
      },
    });
    if (pushRes.error) throw new Error(pushRes.error.message);
    return mappedSetId;
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
