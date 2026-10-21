import { supabase } from '@/core/network/supabase';
import type { GenerationRequest } from '@/core/domain/models';

export async function requestGeneratedQuestions(request: GenerationRequest): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('generate-questions', {
    body: { source_text: request.sourceText, question_count: request.questionCount, difficulty: request.difficulty, language: request.languageCode },
  });
  if (error) throw error;
  return typeof data === 'string' ? data : JSON.stringify(data);
}
