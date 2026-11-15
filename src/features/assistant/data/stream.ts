// SSE frames can be split at any UTF-8 byte or newline boundary.
export function createAnswerParser(onText: (text: string) => void) {
  let buffer = '', answer = '', finished = false;
  const frame = (value: string) => {
    const payload = value.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!payload) return;
    const event = JSON.parse(payload);
    if (event.error || event.promptFeedback?.blockReason) throw new Error('AI không thể trả lời yêu cầu này.');
    const candidate = event.candidates?.[0];
    for (const part of candidate?.content?.parts ?? []) {
      if (!part.thought && typeof part.text === 'string') answer += part.text;
    }
    if (answer.length > 4000) throw new Error('Phản hồi vượt giới hạn. Hãy yêu cầu câu trả lời ngắn hơn.');
    if (candidate?.finishReason) {
      if (!['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) throw new Error('AI không thể hoàn tất câu trả lời này.');
      finished = true;
    }
    onText(answer);
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      // Normalize CRLF only after both bytes have arrived.
      buffer = buffer.replace(/\r\n/g, '\n');
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) { frame(buffer.slice(0,end)); buffer = buffer.slice(end+2); }
      if(buffer.length > 100000) throw new Error('Dữ liệu stream không hợp lệ.');
    },
    finish() {
      if(buffer.trim()) frame(buffer);
      if(!finished || !answer.trim()) throw new Error('Kết nối bị ngắt trước khi trả lời xong. Hãy thử lại.');
      return answer;
    },
  };
}
