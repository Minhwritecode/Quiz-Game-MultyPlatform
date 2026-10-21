import type { QuestionSet } from '@/core/domain/models';
import { supabase } from '@/core/network/supabase';

export async function pushQuestionSet(questionSet: QuestionSet): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('question_sets').upsert({
    id: questionSet.id,
    title: questionSet.title,
    subject: questionSet.subject,
    updated_at: questionSet.updatedAt,
    is_deleted: false,
  });
  if (error) throw error;
}
