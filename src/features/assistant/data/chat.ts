import { AppError, serviceFailure } from '@/core/domain/failure';
import { fetch } from 'expo/fetch';
import { createAnswerParser } from './stream';
import type { PdfAttachment } from './pdf';
import { supabase } from '@/core/network/supabase';
import type { ChatMessage } from '../domain/repository';
export type { ChatMessage } from '../domain/repository';
export async function askPapybot(messages: ChatMessage[], context: string, document: string | undefined, signal: AbortSignal, onText?: (text: string) => void, pdf?: PdfAttachment): Promise<string> {
  if (!supabase) throw new AppError('unavailable', 'Papybot chưa được cấu hình.');
  const {data}=await supabase.auth.getSession();
  if(!data.session) throw new AppError('unavailable', 'Đăng nhập để trò chuyện với Papybot.');
  const controller=new AbortController(); const cancel=()=>controller.abort();
  signal.addEventListener('abort',cancel); if(signal.aborted) cancel();
  const timer=setTimeout(cancel,45000);
  try {
    if(onText) {
      const url=process.env.EXPO_PUBLIC_SUPABASE_URL;
      const key=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if(!url || !key) throw new AppError('unavailable', 'Papybot chưa được cấu hình.');
      const response=await fetch(`${url}/functions/v1/papybot`, {method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${data.session.access_token}`},signal:controller.signal,body:JSON.stringify({messages,context,document,pdf:pdf?.data,stream:true})});
      if(!response.ok) throw serviceFailure(response.status);
      if(!response.body) throw new AppError('unavailable', 'Streaming không khả dụng.');
      const reader=response.body.getReader(), decoder=new TextDecoder(), parser=createAnswerParser(onText);
      try {while(true) {const {done,value}=await reader.read();if(done) break;parser.push(decoder.decode(value,{stream:true}));}parser.push(decoder.decode());return parser.finish();}
      finally {await reader.cancel().catch(()=>undefined);reader.releaseLock();}
    }
    const result=await supabase.functions.invoke('papybot',{body:{messages,context,document},signal:controller.signal});
    if(result.error) throw serviceFailure(result.error.context?.status);
    if(typeof result.data?.answer!=='string') throw new AppError('unavailable', 'Phản hồi AI không hợp lệ.');
    return result.data.answer;
  } finally {clearTimeout(timer);signal.removeEventListener('abort',cancel);}
}
