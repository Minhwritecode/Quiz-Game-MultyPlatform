export function parseRoomInvite(input: string): string | null {
  const raw=input.trim();
  if(/^[A-Z0-9]{6}$/i.test(raw)) return raw.toUpperCase();
  try {const url=new URL(raw);if(!['papyrus:','papyrus-dev:','papyrus-preview:'].includes(url.protocol) || url.hostname!=='battle' || (url.pathname && url.pathname!=='/'))return null;const code=url.searchParams.get('code');return code && /^[A-Z0-9]{6}$/i.test(code)?code.toUpperCase():null;}catch{return null;}
}

export function roomInvite(code:string, scheme:unknown):string {
 const selected=typeof scheme==='string' && ['papyrus','papyrus-dev','papyrus-preview'].includes(scheme)?scheme:'papyrus';
 return `${selected}://battle?code=${encodeURIComponent(code)}`;
}
