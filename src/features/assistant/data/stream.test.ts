import { createAnswerParser } from './stream';
const event=(text:string,finishReason?:string)=>`data: ${JSON.stringify({candidates:[{content:{parts:[{text}]},finishReason}]})}\r\n\r\n`;
it('reassembles split frames without losing Vietnamese text',()=>{
 const output=jest.fn(), parser=createAnswerParser(output);
 const stream=event('Xin chào ')+event('bạn','STOP');
 for(const character of stream) parser.push(character);
 expect(parser.finish()).toBe('Xin chào bạn');
});
it('does not treat a broken connection as a finished answer',()=>{
 const parser=createAnswerParser(()=>{});parser.push(event('Partial'));
 expect(()=>parser.finish()).toThrow('Kết nối');
});
it('rejects blocked and oversized responses',()=>{
 const parser=createAnswerParser(()=>{});
 expect(()=>parser.push(event('x','SAFETY'))).toThrow();
 expect(()=>createAnswerParser(()=>{}).push(event('a'.repeat(4001),'STOP'))).toThrow('giới hạn');
});
