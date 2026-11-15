import { supabase } from '@/core/network/supabase';
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export async function askPapybot(messages: ChatMessage[], context: string, document: string | undefined, signal: AbortSignal): Promise<string> {
  if (!supabase) throw new Error('Papybot chưa được cấu hình.');
  const {data}=await supabase.auth.getSession();
  if(!data.session) throw new Error('Đăng nhập để trò chuyện với Papybot.');
  const controller=new AbortController(); const cancel=()=>controller.abort();
  signal.addEventListener('abort',cancel); if(signal.aborted) cancel();
  const timer=setTimeout(cancel,45000);
  try {
    const result=await supabase.functions.invoke('papybot',{body:{messages,context,document},signal:controller.signal});
    if(result.error) {
      let message='Không kết nối được Papybot. Kiểm tra mạng và thử lại.';
      try {message=(await result.error.context.json()).error || message;} catch {}
      throw new Error(message);
    }
    if(typeof result.data?.answer!=='string') throw new Error('Phản hồi AI không hợp lệ.');
    return result.data.answer;
  } finally {clearTimeout(timer);signal.removeEventListener('abort',cancel);}
}
