export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type Conversation = { id: string; updatedAt: number; messages: ChatMessage[] };
export type PdfAttachment = { name: string; data: string };
export interface AssistantRepository {
 ask(messages: ChatMessage[], context: string, document: string | undefined, signal: AbortSignal, onText?: (text:string)=>void, pdf?: PdfAttachment): Promise<string>;
 load(owner:string):Promise<Conversation[]>;
 save(owner:string,items:Conversation[]):Promise<void>;
 sync(owner:string,items:Conversation[]):Promise<Conversation[]>;
 markDeleted(owner:string,id:string):Promise<void>;
 pickPdf():Promise<PdfAttachment|null>;
 pickDocument():Promise<string|null>;
}
