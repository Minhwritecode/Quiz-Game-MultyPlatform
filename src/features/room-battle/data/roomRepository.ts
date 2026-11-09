import { supabase } from '@/core/network/supabase';
import type { RoomRecord, RoomRepository } from '../domain/repository';

type RoomRow = {
  id: string;
  code: string;
  host_id: string;
  set_id: string;
  mode: RoomRecord['mode'];
  status: RoomRecord['status'];
  question_count: number;
  seconds_per_question: number;
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

export const roomRepository: RoomRepository = {
  async create(input) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.rpc('create_room', {
      p_set_id: input.setId,
      p_question_count: input.questionCount,
      p_seconds_per_question: input.secondsPerQuestion,
      p_mode: input.mode,
    });
    if (error) throw error;
    return mapRoom(firstRow(data));
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
