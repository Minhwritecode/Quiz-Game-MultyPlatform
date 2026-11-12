import { supabase } from '@/core/network/supabase';
import type { GenerationRequest } from '@/core/domain/models';
import { traceOperation } from '@/core/observability/monitoring';

export const isGenerationConfigured = Boolean(supabase);

export async function requestGeneratedQuestions(request: GenerationRequest): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const {data:session}=await supabase.auth.getSession();
  if(!session.session)throw new Error('Sign in to generate questions. Manual authoring works offline.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),40000);
  try {
    return await traceOperation('generation',async()=>{
      const { data, error } = await supabase!.functions.invoke('generate-questions', {
        signal:controller.signal,
        body: { source_text: request.sourceText, question_count: request.questionCount, difficulty: request.difficulty, language: request.languageCode },
      });
      if (error) throw new Error('Generation is unavailable. Check your connection and account, then try again. Your source text is still here.');
      return typeof data === 'string' ? data : JSON.stringify(data);
    });
  } finally {clearTimeout(timeout);}
}
